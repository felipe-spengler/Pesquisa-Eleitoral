'use strict';
require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: parseInt(process.env.SMTP_PORT, 10) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

/**
 * Envia e-mail com link de pesquisa para o contato.
 * @param {object} opts
 * @param {string} opts.to - E-mail do destinatário
 * @param {string} opts.name - Nome do contato
 * @param {string} opts.surveyTitle - Título da pesquisa
 * @param {string} opts.surveyUrl - URL única com token
 */
async function sendSurveyEmail({ to, name, surveyTitle, surveyUrl }) {
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pesquisa Eleitoral</title>
    </head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1e293b,#0f172a);border-radius:16px;border:1px solid #334155;overflow:hidden;">
              <tr>
                <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
                  <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">🗳️ Pesquisa Eleitoral</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:40px;color:#e2e8f0;">
                  <p style="font-size:18px;margin:0 0 16px;">Olá, <strong>${name || 'Participante'}</strong>!</p>
                  <p style="font-size:15px;color:#94a3b8;line-height:1.6;margin:0 0 32px;">
                    Você foi convidado(a) a participar da pesquisa:
                    <strong style="color:#a78bfa;">${surveyTitle}</strong>.
                    Sua opinião é muito importante para nós.
                  </p>
                  <div style="text-align:center;margin:32px 0;">
                    <a href="${surveyUrl}"
                       style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.5px;">
                      ✅ Participar da Pesquisa
                    </a>
                  </div>
                  <p style="font-size:13px;color:#64748b;text-align:center;margin:24px 0 0;">
                    Ou copie e cole o link no seu navegador:<br>
                    <a href="${surveyUrl}" style="color:#818cf8;">${surveyUrl}</a>
                  </p>
                  <hr style="border:none;border-top:1px solid #334155;margin:32px 0;">
                  <p style="font-size:12px;color:#475569;text-align:center;margin:0;">
                    Este link é de uso exclusivo seu e garante sua privacidade. Não compartilhe.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `📊 Sua participação é importante — ${surveyTitle}`,
    html,
  });
}

module.exports = { sendSurveyEmail };
