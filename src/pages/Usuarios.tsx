import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyUsers, useUpdateUser, useRemoveUser } from '@/hooks/useUsers';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Users,
    UserPlus,
    MoreHorizontal,
    Loader2,
    Shield,
    Trash2,
    Edit2,
} from 'lucide-react';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { motionVariants } from '@/lib/motion-presets';
import { SectionHeader } from '@/components/ui/section-header';
import { supabase } from '@/integrations/supabase/client';
import { friendlyEdgeFunctionError, parseSupabaseFunctionError } from '@/lib/edgeFunctionErrors';
import { logActivity } from '@/lib/activityLog';
import { toast } from 'sonner';

const DEFAULT_MAX_USERS = 6;

export default function Usuarios() {
    const { user: currentUser } = useAuth();
    const reduced = useReducedMotion();
    const { staggerContainer: container, fadeUp: item } = motionVariants(reduced);
    const { data: users, isLoading, refetch: refetchUsers } = useCompanyUsers();
    const { data: company } = useCompany();
    const updateUser = useUpdateUser();
    const removeUser = useRemoveUser();

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<string>('operador');
    const [isInviting, setIsInviting] = useState(false);

    const activeUsers = users?.filter(u => u.is_active) || [];
    const maxUsers = company?.max_users ?? DEFAULT_MAX_USERS;
    const atMemberLimit = activeUsers.length >= maxUsers;
    const inviteSlotsLeft = Math.max(0, maxUsers - activeUsers.length);

    const handleInvite = async () => {
        if (!inviteEmail.trim() || !currentUser?.company?.id || atMemberLimit) return;

        setIsInviting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada');

            const response = await supabase.functions.invoke('invite-user', {
                body: {
                    email: inviteEmail.trim(),
                    role: inviteRole,
                    company_id: currentUser.company.id,
                },
                headers: { Authorization: `Bearer ${session.access_token}` },
            });

            if (response.error || !response.data?.success) {
                const detail = await parseSupabaseFunctionError(response.error, response.data);
                throw new Error(friendlyEdgeFunctionError(detail, 'Erro ao convidar membro.'));
            }

            const message = response.data.message as string | undefined;
            const emailSent = response.data.email_sent as boolean | undefined;
            const initialPassword = response.data.initial_password as string | undefined;
            const toastMessage = message
                || (initialPassword
                    ? `Convite enviado${emailSent === false ? ' (e-mail não entregue)' : ''}. Senha inicial: ${initialPassword}`
                    : `Membro adicionado: ${inviteEmail.trim()}`);
            toast.success(toastMessage);
            void logActivity({
                eventType: 'action',
                action: 'user.invite',
                path: '/usuarios',
                metadata: { email: inviteEmail.trim(), role: inviteRole },
            });
            setInviteEmail('');
            await refetchUsers();
        } catch (error: unknown) {
            console.error('Error inviting user:', error);
            const msg = error instanceof Error ? error.message : String(error);
            toast.error(friendlyEdgeFunctionError(msg, 'Erro ao convidar membro.'));
        } finally {
            setIsInviting(false);
        }
    };

    const handleRoleChange = (userId: string, newRole: 'super_admin' | 'company_admin' | 'operador') => {
        updateUser.mutate({ userId, updates: { role: newRole } });
    };

    const handleRemove = (userId: string, userName: string) => {
        if (confirm(`Tem certeza que deseja desativar ${userName}?`)) {
            removeUser.mutate(userId);
        }
    };

    const getRoleBadge = (role: string) => {
        const config: Record<string, { label: string; className: string }> = {
            super_admin: { label: 'Super Admin', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
            company_admin: { label: 'Admin', className: 'bg-ch-orange/10 text-ch-orange border-ch-orange/20' },
            operador: { label: 'Membro', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
        };
        const c = config[role] || { label: role, className: 'bg-muted text-muted-foreground border-border' };
        return (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${c.className}`}>
                {(role === 'company_admin' || role === 'super_admin') && <Shield className="w-3 h-3" />}
                {c.label}
            </span>
        );
    };

    return (
        <motion.div initial="hidden" animate="visible" variants={container} className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
            <motion.div variants={item} className="flex flex-col gap-4">
                <SectionHeader
                    title="Usuários"
                    description="Gerencie membros da equipe e permissões de acesso."
                />
                <SettingsNav />
            </motion.div>

            <motion.div variants={item} className="rounded-2xl bg-card border border-border shadow-sm hover-lift transition-all p-6 space-y-4">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Convidar Membro</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Adicione até 5 convidados além do dono da conta ({activeUsers.length} / {maxUsers} membros).
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        O convite é enviado por e-mail (Resend) com link de acesso e senha inicial. A senha também aparece aqui após o convite — recomendamos trocá-la no primeiro login.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <label className="text-sm font-medium text-foreground mb-1.5 block">E-mail do Usuário</label>
                        <Input
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="exemplo@email.com"
                            type="email"
                            className="bg-muted/50 border-border"
                        />
                    </div>
                    <div className="w-full sm:w-40">
                        <label className="text-sm font-medium text-foreground mb-1.5 block">Função</label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger className="bg-muted/50 border-border">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="operador">Membro</SelectItem>
                                <SelectItem value="company_admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button
                            onClick={handleInvite}
                            disabled={isInviting || !inviteEmail.trim() || atMemberLimit}
                            className="bg-ch-orange hover:bg-ch-orange/90 text-white font-medium w-full sm:w-auto"
                        >
                            {isInviting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <UserPlus className="w-4 h-4 mr-2" />
                            )}
                            Convidar
                        </Button>
                    </div>
                </div>
                {atMemberLimit && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                        Limite de membros atingido. Desative alguém da equipe para convidar outra pessoa.
                    </p>
                )}
                {!atMemberLimit && inviteSlotsLeft <= 2 && inviteSlotsLeft > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Restam {inviteSlotsLeft} vaga(s) na equipe.
                    </p>
                )}
            </motion.div>

            {/* Membros da Equipe Card */}
            <motion.div variants={item} className="rounded-2xl bg-card border border-border shadow-sm hover-lift transition-all overflow-hidden">
                <div className="p-6 pb-4">
                    <h2 className="text-lg font-semibold text-foreground">Membros da Equipe</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {activeUsers.length} / {maxUsers} membros ativos nesta organização.
                    </p>
                </div>

                {isLoading ? (
                    <div className="p-8 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-ch-orange" />
                    </div>
                ) : activeUsers.length > 0 ? (
                    <div>
                        {/* Table Header */}
                        <div className="px-6 py-3 border-t border-b border-border grid grid-cols-[1fr_auto_auto] gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <span>Usuário</span>
                            <span className="w-28 text-center">Função</span>
                            <span className="w-16 text-center">Ações</span>
                        </div>

                        {/* Table Rows */}
                        <div className="divide-y divide-border/10">
                            {activeUsers.map((u) => (
                                <div
                                    key={u.id}
                                    className="px-6 py-4 grid grid-cols-[1fr_auto_auto] gap-4 items-center hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-muted/50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                            {u.avatar_url ? (
                                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-semibold text-muted-foreground">
                                                    {u.first_name?.charAt(0)}{u.last_name?.charAt(0)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-medium text-sm text-foreground truncate">
                                                {u.first_name} {u.last_name}
                                                {u.id === currentUser?.id && (
                                                    <span className="ml-1.5 text-muted-foreground">(Você)</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                        </div>
                                    </div>

                                    <div className="w-28 flex justify-center">
                                        {getRoleBadge(u.role)}
                                    </div>

                                    <div className="w-16 flex justify-center">
                                        {u.id !== currentUser?.id ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleRoleChange(u.id, 'company_admin')}>
                                                        <Shield className="w-4 h-4 mr-2" />
                                                        Tornar Admin
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleRoleChange(u.id, 'operador')}>
                                                        <Edit2 className="w-4 h-4 mr-2" />
                                                        Tornar Membro
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleRemove(u.id, `${u.first_name} ${u.last_name}`)}
                                                        className="text-red-500 focus:text-red-500"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Desativar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center border-t border-border">
                        <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
