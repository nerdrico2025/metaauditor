import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildTeamInviteEmail, sendEmail } from '../_shared/resend.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
    email: string;
    role: string;
    company_id: string;
}

const DEFAULT_INVITE_PASSWORD = '12345678';

function invitePassword(): string {
    return Deno.env.get('TEAM_INVITE_DEFAULT_PASSWORD') || DEFAULT_INVITE_PASSWORD;
}

function roleLabel(role: string): string {
    return role === 'company_admin' ? 'Administrador' : 'Membro';
}

async function findAuthUserByEmail(supabase: ReturnType<typeof createClient>, email: string) {
    const normalized = email.toLowerCase();
    let page = 1;
    const perPage = 200;

    while (page <= 10) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        const match = data.users.find((u) => u.email?.toLowerCase() === normalized);
        if (match) return match;
        if (data.users.length < perPage) break;
        page += 1;
    }
    return null;
}

async function sendInviteEmail(
    companyName: string,
    inviteeEmail: string,
    initialPassword: string,
    inviteRole: string,
): Promise<boolean> {
    const { subject, text, html } = buildTeamInviteEmail({
        companyName,
        inviteeEmail,
        initialPassword,
        roleLabel: roleLabel(inviteRole),
    });
    return sendEmail(inviteeEmail, subject, text, html);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        const { data: { user: caller }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !caller) {
            throw new Error('Unauthorized');
        }

        const { data: callerProfile } = await supabase
            .from('users')
            .select('company_id, role')
            .eq('id', caller.id)
            .single();

        if (!callerProfile?.company_id) {
            throw new Error('Caller not associated with any company');
        }

        if (callerProfile.role !== 'company_admin' && callerProfile.role !== 'super_admin') {
            return new Response(
                JSON.stringify({ error: 'Apenas administradores podem convidar membros.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        const { email, role, company_id } = await req.json() as InviteRequest;

        if (!email || !company_id) {
            throw new Error('Email and company_id are required');
        }

        if (callerProfile.role !== 'super_admin' && callerProfile.company_id !== company_id) {
            return new Response(
                JSON.stringify({ error: 'Você só pode convidar para a sua própria empresa.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        const validRoles = ['company_admin', 'operador'];
        const inviteRole = validRoles.includes(role) ? role : 'operador';
        const normalizedEmail = email.trim().toLowerCase();
        const initialPassword = invitePassword();

        const { data: company } = await supabase
            .from('companies')
            .select('max_users, name')
            .eq('id', company_id)
            .single();

        if (!company) {
            throw new Error('Company not found');
        }

        const maxUsers = company.max_users ?? 6;

        const { count: currentUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company_id)
            .eq('is_active', true);

        if ((currentUsers || 0) >= maxUsers) {
            return new Response(
                JSON.stringify({
                    error: `Limite de ${maxUsers} membros atingido (1 dono + até ${Math.max(0, maxUsers - 1)} convidados). Remova um membro ou faça upgrade do plano.`,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            );
        }

        const { data: existingProfile } = await supabase
            .from('users')
            .select('id, company_id, is_active')
            .ilike('email', normalizedEmail)
            .maybeSingle();

        if (existingProfile?.company_id) {
            if (existingProfile.company_id === company_id) {
                return new Response(
                    JSON.stringify({ error: 'Este usuário já faz parte da sua equipe.' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
                );
            }
            return new Response(
                JSON.stringify({ error: 'Este email já pertence a outra empresa.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
            );
        }

        const companyName = company.name || 'sua empresa';
        let responseType: 'created' | 'added';
        let baseMessage: string;

        const existingAuthUser = await findAuthUserByEmail(supabase, normalizedEmail);

        if (existingAuthUser) {
            await supabase.auth.admin.updateUserById(existingAuthUser.id, {
                password: initialPassword,
                user_metadata: {
                    ...existingAuthUser.user_metadata,
                    invited_company_id: company_id,
                    invited_role: inviteRole,
                },
            });

            await supabase
                .from('users')
                .upsert({
                    id: existingAuthUser.id,
                    email: normalizedEmail,
                    company_id: company_id,
                    role: inviteRole,
                    is_active: true,
                    password_hash: 'managed_by_supabase_auth',
                    updated_at: new Date().toISOString(),
                });

            responseType = 'added';
            baseMessage = `Usuário ${normalizedEmail} adicionado à equipe. Senha inicial: ${initialPassword}`;
        } else {
            const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
                email: normalizedEmail,
                password: initialPassword,
                email_confirm: true,
                user_metadata: {
                    invited_company_id: company_id,
                    invited_role: inviteRole,
                    first_name: '',
                    last_name: '',
                },
            });

            if (createError) {
                console.error('Create user error:', createError);
                throw new Error(`Falha ao criar membro: ${createError.message}`);
            }

            if (!createdUser.user) {
                throw new Error('Falha ao criar membro: usuário não retornado.');
            }

            responseType = 'created';
            baseMessage = `Membro ${normalizedEmail} criado. Senha inicial: ${initialPassword}`;
        }

        const emailSent = await sendInviteEmail(companyName, normalizedEmail, initialPassword, inviteRole);
        const message = emailSent
            ? `${baseMessage} Convite enviado por e-mail.`
            : `${baseMessage} Não foi possível enviar o e-mail de convite (verifique RESEND_API_KEY).`;

        return new Response(
            JSON.stringify({
                success: true,
                message,
                type: responseType,
                initial_password: initialPassword,
                email_sent: emailSent,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );

    } catch (error) {
        console.error('invite-user error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: String((error as Error)?.message || error),
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
});
