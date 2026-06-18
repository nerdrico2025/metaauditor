const DEFAULT_FROM = 'Click Auditor <alerts@clickhero.app>';

export function getResendFrom(): string {
    return Deno.env.get('RESEND_FROM') || DEFAULT_FROM;
}

export function getAppLoginUrl(): string {
    return Deno.env.get('APP_LOGIN_URL') || 'https://clickhero.app/login';
}

export async function sendEmail(
    toEmail: string,
    subject: string,
    text: string,
    html?: string,
): Promise<boolean> {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
        console.warn('RESEND_API_KEY not set — email skipped');
        return false;
    }

    const payload: Record<string, unknown> = {
        from: getResendFrom(),
        to: [toEmail],
        subject,
        text,
    };
    if (html) payload.html = html;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        console.error('Resend failed', await res.text());
        return false;
    }
    return true;
}

export function buildTeamInviteEmail(params: {
    companyName: string;
    inviteeEmail: string;
    initialPassword: string;
    roleLabel: string;
}): { subject: string; text: string; html: string } {
    const loginUrl = getAppLoginUrl();
    const subject = `Convite para a equipe ${params.companyName} — Click Auditor`;

    const text = [
        `Olá,`,
        ``,
        `Você foi convidado(a) para a equipe "${params.companyName}" no Click Auditor como ${params.roleLabel}.`,
        ``,
        `Acesse: ${loginUrl}`,
        `E-mail: ${params.inviteeEmail}`,
        `Senha inicial: ${params.initialPassword}`,
        ``,
        `Recomendamos trocar a senha após o primeiro acesso.`,
        ``,
        `— Equipe ClickHero`,
    ].join('\n');

    const html = `
<p>Olá,</p>
<p>Você foi convidado(a) para a equipe <strong>${escapeHtml(params.companyName)}</strong> no Click Auditor como <strong>${escapeHtml(params.roleLabel)}</strong>.</p>
<p><a href="${escapeHtml(loginUrl)}">Acessar o Click Auditor</a></p>
<ul>
  <li><strong>E-mail:</strong> ${escapeHtml(params.inviteeEmail)}</li>
  <li><strong>Senha inicial:</strong> ${escapeHtml(params.initialPassword)}</li>
</ul>
<p>Recomendamos trocar a senha após o primeiro acesso.</p>
<p>— Equipe ClickHero</p>
`.trim();

    return { subject, text, html };
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
