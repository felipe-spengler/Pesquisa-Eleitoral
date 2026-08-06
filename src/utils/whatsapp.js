'use strict';
require('dotenv').config();

const META_API_VERSION = 'v18.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Envia mensagem de template WhatsApp via Meta Cloud API.
 * @param {object} opts
 * @param {string} opts.phone - Número do destinatário (formato internacional: 5511999999999)
 * @param {string} opts.name - Nome do contato (para o header do template)
 * @param {string} opts.surveyUrl - URL única com token a ser enviada como parâmetro do template
 */
async function sendWhatsAppTemplate({ phone, name, surveyUrl }) {
  // Remove caracteres não numéricos do telefone
  const cleanPhone = phone.replace(/\D/g, '');

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanPhone,
    type: 'template',
    template: {
      name: process.env.META_TEMPLATE_NAME,
      language: { code: 'pt_BR' },
      components: [
        {
          type: 'header',
          parameters: [
            { type: 'text', text: name || 'Participante' },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: surveyUrl },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: surveyUrl },
          ],
        },
      ],
    },
  };

  // Usando fetch nativo do Node.js 18+
  const response = await fetch(
    `${META_BASE_URL}/${process.env.META_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.META_WA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const errMsg = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Meta API error: ${errMsg}`);
  }

  return data;
}

module.exports = { sendWhatsAppTemplate };
