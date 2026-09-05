import { Resend } from 'resend';
import { createHash } from 'crypto';
import { SAAS_COMPANY_NAME } from './constants';

// Lazy initialization — avoids build-time error when RESEND_API_KEY is not set
function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY environment variable is not set');
  return new Resend(key);
}

const FROM = `${SAAS_COMPANY_NAME} <noreply@aura-system.com.br>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://aura-system-mu.vercel.app';
const TERMS_VERSION = '1.0';

// Texto exibido ao usuário no momento do aceite dos Termos de Uso
// SHA-256 grava a prova de qual conteúdo estava vigente quando a pessoa aceitou
const TERMS_TEXT =
  `Termos de Uso e Política de Privacidade do ${SAAS_COMPANY_NAME} versão ${TERMS_VERSION}. ` +
  'Ao se cadastrar, você concorda com o tratamento dos seus dados conforme a LGPD ' +
  'e com os Termos de Uso disponíveis em /terms-of-use.';
const TERMS_TEXT_HASH = createHash('sha256').update(TERMS_TEXT).digest('hex');

export { TERMS_VERSION, TERMS_TEXT_HASH };

// ── Layout base dos emails ──────────────────────────────────────────────────
function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5ebe0;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ebe0;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#bd7b65,#8b5a47);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">✦ ${SAAS_COMPANY_NAME}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">Gestão Premium para Clínicas de Estética</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#fdfcfb;padding:24px 40px;border-top:1px solid #f0e8e0;text-align:center;">
            <p style="margin:0;color:#a09890;font-size:12px;">
              © ${new Date().getFullYear()} ${SAAS_COMPANY_NAME} · Todos os direitos reservados<br/>
              <a href="${APP_URL}/termos-de-uso" style="color:#bd7b65;text-decoration:none;">Termos de Uso</a> ·
              <a href="${APP_URL}/politica-de-privacidade" style="color:#bd7b65;text-decoration:none;">Política de Privacidade</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, text: string): string {
  return `<a href="${href}" style="display:inline-block;margin:24px 0;padding:14px 32px;background:#bd7b65;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:50px;letter-spacing:0.3px;">
    ${text}
  </a>`;
}

// ── Email: verificação de conta ─────────────────────────────────────────────
export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/verificar-email?token=${token}`;
  const html = baseTemplate(`Confirme seu email — ${SAAS_COMPANY_NAME}`, `
    <h2 style="margin:0 0 8px;color:#1c1917;font-size:22px;">Olá, ${name}! 👋</h2>
    <p style="margin:0 0 16px;color:#57534e;font-size:15px;line-height:1.6;">
      Sua conta no <strong>${SAAS_COMPANY_NAME}</strong> foi criada com sucesso.<br/>
      Para ativar o acesso, confirme seu email clicando no botão abaixo:
    </p>
    ${btn(link, 'Confirmar meu email →')}
    <p style="margin:16px 0 0;color:#a09890;font-size:13px;">
      Este link expira em <strong>24 horas</strong>.<br/>
      Se você não criou esta conta, ignore este email.
    </p>
    <hr style="border:none;border-top:1px solid #f0e8e0;margin:24px 0;"/>
    <p style="margin:0;color:#a09890;font-size:12px;">
      Ou copie e cole este link no navegador:<br/>
      <span style="color:#bd7b65;">${link}</span>
    </p>
  `);

  return getResend().emails.send({ from: FROM, to, subject: `✦ Confirme seu email — ${SAAS_COMPANY_NAME}`, html });
}

// ── Email: reset de senha ────────────────────────────────────────────────────
export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/redefinir-senha?token=${token}`;
  const html = baseTemplate(`Redefinição de senha — ${SAAS_COMPANY_NAME}`, `
    <h2 style="margin:0 0 8px;color:#1c1917;font-size:22px;">Redefinir senha</h2>
    <p style="margin:0 0 16px;color:#57534e;font-size:15px;line-height:1.6;">
      Olá, <strong>${name}</strong>.<br/>
      Recebemos uma solicitação para redefinir a senha da sua conta ${SAAS_COMPANY_NAME}.<br/>
      Clique no botão abaixo para criar uma nova senha:
    </p>
    ${btn(link, 'Redefinir minha senha →')}
    <div style="background:#fef3c7;border-radius:12px;padding:16px;margin-top:8px;">
      <p style="margin:0;color:#92400e;font-size:13px;">
        ⚠️ Este link expira em <strong>2 horas</strong>.<br/>
        Se você não solicitou a redefinição, sua senha permanece a mesma e você pode ignorar este email.
      </p>
    </div>
    <hr style="border:none;border-top:1px solid #f0e8e0;margin:24px 0;"/>
    <p style="margin:0;color:#a09890;font-size:12px;">
      Ou copie e cole este link no navegador:<br/>
      <span style="color:#bd7b65;">${link}</span>
    </p>
  `);

  return getResend().emails.send({ from: FROM, to, subject: `🔑 Redefinição de senha — ${SAAS_COMPANY_NAME}`, html });
}

// ── Email: novo agendamento (para o admin) ──────────────────────────────────
export async function sendNewAppointmentEmail(
  to: string,
  adminName: string,
  patientName: string,
  procedure: string,
  dateStr: string,
  timeStr: string,
  clinicSlug: string,
) {
  const link = `${APP_URL}/dashboard`;
  const html = baseTemplate(`Novo agendamento solicitado — ${SAAS_COMPANY_NAME}`, `
    <h2 style="margin:0 0 8px;color:#1c1917;font-size:22px;">Novo agendamento! 📅</h2>
    <p style="margin:0 0 20px;color:#57534e;font-size:15px;line-height:1.6;">
      Olá, <strong>${adminName}</strong>! Um novo agendamento foi solicitado e aguarda sua aprovação.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdfcfb;border-radius:14px;border:1px solid #f0e8e0;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="6">
          <tr>
            <td style="color:#a09890;font-size:13px;font-weight:600;width:140px;">PACIENTE</td>
            <td style="color:#1c1917;font-size:14px;font-weight:700;">${patientName}</td>
          </tr>
          <tr>
            <td style="color:#a09890;font-size:13px;font-weight:600;">PROCEDIMENTO</td>
            <td style="color:#1c1917;font-size:14px;">${procedure}</td>
          </tr>
          <tr>
            <td style="color:#a09890;font-size:13px;font-weight:600;">DATA</td>
            <td style="color:#1c1917;font-size:14px;">${dateStr}</td>
          </tr>
          <tr>
            <td style="color:#a09890;font-size:13px;font-weight:600;">HORÁRIO</td>
            <td style="color:#1c1917;font-size:14px;">${timeStr}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    ${btn(link, 'Ver e aprovar agendamento →')}
  `);

  return getResend().emails.send({ from: FROM, to, subject: `📅 Novo agendamento: ${patientName} — ${procedure}`, html });
}

// ── Email: agendamento confirmado (para o paciente) ─────────────────────────
export async function sendAppointmentConfirmedEmail(
  to: string,
  patientName: string,
  clinicName: string,
  procedure: string,
  dateStr: string,
  timeStr: string,
) {
  const html = baseTemplate(`Agendamento confirmado — ${SAAS_COMPANY_NAME}`, `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">✅</div>
    </div>
    <h2 style="margin:0 0 8px;color:#1c1917;font-size:22px;text-align:center;">Agendamento confirmado!</h2>
    <p style="margin:0 0 20px;color:#57534e;font-size:15px;line-height:1.6;text-align:center;">
      Olá, <strong>${patientName}</strong>! Seu agendamento na <strong>${clinicName}</strong> foi aprovado. Até breve!
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdfcfb;border-radius:14px;border:1px solid #f0e8e0;overflow:hidden;margin-bottom:24px;">
      <tr><td style="padding:20px;">
        <table width="100%" cellpadding="6">
          <tr>
            <td style="color:#a09890;font-size:13px;font-weight:600;width:140px;">PROCEDIMENTO</td>
            <td style="color:#1c1917;font-size:14px;font-weight:700;">${procedure}</td>
          </tr>
          <tr>
            <td style="color:#a09890;font-size:13px;font-weight:600;">DATA</td>
            <td style="color:#1c1917;font-size:14px;">${dateStr}</td>
          </tr>
          <tr>
            <td style="color:#a09890;font-size:13px;font-weight:600;">HORÁRIO</td>
            <td style="color:#1c1917;font-size:14px;">${timeStr}</td>
          </tr>
          <tr>
            <td style="color:#a09890;font-size:13px;font-weight:600;">CLÍNICA</td>
            <td style="color:#1c1917;font-size:14px;">${clinicName}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0;color:#a09890;font-size:13px;text-align:center;">
      Em caso de dúvidas, entre em contato diretamente com a clínica.
    </p>
  `);

  return getResend().emails.send({ from: FROM, to, subject: `✅ Agendamento confirmado — ${clinicName}`, html });
}
