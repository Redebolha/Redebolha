/**
 * Conversions API Webhook — Rede Bolha
 *
 * Servidor que recebe eventos do frontend (fbq) e os reenvia
 * via Conversions API do Meta para deduplicação automática.
 *
 * Instalação:
 *   npm install express node-fetch dotenv
 *   node conversions-api-webhook.js
 *
 * Arquivo .env necessário:
 *   META_ACCESS_TOKEN=seu_token_aqui
 *   META_PIXEL_ID=3792335180914057
 *   PORT=3000
 */

require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(express.json());

// Configuração
const PIXEL_ID = process.env.META_PIXEL_ID || '3792335180914057';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'seu_webhook_secret';
const PORT = process.env.PORT || 3000;

if (!ACCESS_TOKEN) {
  console.warn('⚠️  META_ACCESS_TOKEN não configurado. Webhook rodará sem validação.');
}

// Validar assinatura do webhook (segurança)
function validateSignature(payload, signature) {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'seu_webhook_secret') {
    console.warn('⚠️  Webhook secret não configurado. Validação desabilitada.');
    return true;
  }

  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return signature === hash;
}

// Hash de dados do usuário (PII) — Privacy-preserving
function hashUserData(email, phone, firstName, lastName) {
  const sha256 = (str) =>
    crypto.createHash('sha256').update(str.toLowerCase().trim()).digest('hex');

  return {
    ...(email && { em: sha256(email) }),
    ...(phone && { ph: sha256(phone.replace(/[^\d]/g, '')) }),
    ...(firstName && { fn: sha256(firstName) }),
    ...(lastName && { ln: sha256(lastName) })
  };
}

/**
 * POST /conversions
 *
 * Body esperado:
 * {
 *   "event_name": "Purchase",
 *   "event_id": "evt_12345", // Opcional (gerado se não houver)
 *   "event_time": 1695555600,
 *   "user_data": {
 *     "email": "user@example.com",
 *     "phone": "+5551980482820",
 *     "first_name": "João",
 *     "last_name": "Silva"
 *   },
 *   "custom_data": {
 *     "value": 39.90,
 *     "currency": "BRL",
 *     "content_name": "Homem, Você Não É Ridículo",
 *     "content_ids": ["homem-ridiculo"],
 *     "num_items": 1
 *   },
 *   "ip_address": "203.0.113.45", // Opcional (coletado do request se não houver)
 *   "user_agent": "Mozilla/5.0..." // Opcional
 * }
 */
app.post('/conversions', async (req, res) => {
  const payload = JSON.stringify(req.body);
  const signature = req.headers['x-hub-signature'];

  // Validar assinatura (se configurada)
  if (signature && !validateSignature(payload, signature)) {
    console.error('❌ Assinatura inválida');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  try {
    const {
      event_name,
      event_id,
      event_time,
      user_data = {},
      custom_data = {},
      ip_address,
      user_agent
    } = req.body;

    // Validação mínima
    if (!event_name) {
      return res.status(400).json({ error: 'event_name é obrigatório' });
    }

    // Gerar event_id único se não fornecido (para deduplicação)
    const finalEventId = event_id || crypto.randomUUID();

    // Hash dos dados pessoais (PII hashing)
    const hashedUserData = hashUserData(
      user_data.email,
      user_data.phone,
      user_data.first_name,
      user_data.last_name
    );

    // Montar payload para Meta Conversions API
    const conversionPayload = {
      data: [{
        event_name,
        event_id: finalEventId,
        event_time: event_time || Math.floor(Date.now() / 1000),
        user_data: {
          ...hashedUserData,
          client_ip_address: ip_address || req.ip || req.connection.remoteAddress,
          client_user_agent: user_agent || req.get('user-agent')
        },
        custom_data: custom_data || {},
        // Opcional: adicionar fbc/fbp se disponível (do pixel)
        ...(req.body.fbc && { fbc: req.body.fbc }),
        ...(req.body.fbp && { fbp: req.body.fbp })
      }],
      access_token: ACCESS_TOKEN
    };

    // Enviar para Meta Conversions API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversionPayload)
      }
    );

    const result = await response.json();

    // Log estruturado
    console.log(`📊 [${new Date().toISOString()}] Event: ${event_name}`);
    console.log(`   Event ID: ${finalEventId}`);
    console.log(`   Response:`, result);

    if (!response.ok) {
      console.error('❌ Meta Conversions API Error:', result);
      return res.status(response.status).json({
        error: result.error?.message || 'Erro ao enviar para Meta',
        details: result
      });
    }

    res.json({
      success: true,
      event_id: finalEventId,
      event_name,
      result
    });

  } catch (error) {
    console.error('❌ Erro no webhook:', error.message);
    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});

/**
 * POST /test-event
 *
 * Envia um evento de teste para validar configuração
 */
app.post('/test-event', async (req, res) => {
  const testPayload = {
    event_name: 'PageView',
    event_id: `test_${Date.now()}`,
    event_time: Math.floor(Date.now() / 1000),
    user_data: {
      email: 'teste@redebolha.com.br',
      client_ip_address: req.ip
    },
    custom_data: {
      currency: 'BRL'
    }
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [testPayload.user_data ? {
            ...testPayload,
            user_data: {
              ...testPayload.user_data,
              em: crypto.createHash('sha256').update('teste@redebolha.com.br').digest('hex')
            }
          } : testPayload]
        })
      }
    );

    const result = await response.json();
    console.log('✅ Test Event Response:', result);
    res.json({ success: !!result.events_received, result });
  } catch (error) {
    console.error('❌ Test Event Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /health
 *
 * Verificar se o webhook está rodando
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    pixel_id: PIXEL_ID,
    access_token_configured: !!ACCESS_TOKEN,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /purchase
 *
 * Endpoint simplificado para rastrear compras da Hotmart
 * (exemplo de integração específica)
 */
app.post('/purchase', async (req, res) => {
  const {
    customer_email,
    customer_phone,
    product_name,
    value,
    hotmart_transaction_id
  } = req.body;

  if (!customer_email || !value) {
    return res.status(400).json({
      error: 'customer_email e value são obrigatórios'
    });
  }

  const purchasePayload = {
    event_name: 'Purchase',
    event_id: hotmart_transaction_id || `hotmart_${Date.now()}`,
    event_time: Math.floor(Date.now() / 1000),
    user_data: {
      email: customer_email,
      phone: customer_phone
    },
    custom_data: {
      value: parseFloat(value),
      currency: 'BRL',
      content_name: product_name || 'Livro - Rede Bolha',
      content_ids: ['homem-ridiculo'],
      num_items: 1
    },
    ip_address: req.ip,
    user_agent: req.get('user-agent')
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [{
            ...purchasePayload,
            user_data: {
              ...purchasePayload.user_data,
              em: crypto.createHash('sha256').update(customer_email.toLowerCase()).digest('hex'),
              ...(customer_phone && {
                ph: crypto.createHash('sha256').update(customer_phone.replace(/[^\d]/g, '')).digest('hex')
              })
            }
          }]
        })
      }
    );

    const result = await response.json();

    console.log(`💰 Purchase tracked: ${product_name} - R$ ${value}`);
    console.log(`   Customer: ${customer_email}`);
    console.log(`   Transaction ID: ${purchasePayload.event_id}`);

    res.json({
      success: !!result.events_received,
      event_id: purchasePayload.event_id,
      result
    });

  } catch (error) {
    console.error('❌ Purchase tracking error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  🔌 Conversions API Webhook — Rede Bolha                   ║
║                                                            ║
║  Rodando em: http://localhost:${PORT}                        ║
║  Pixel ID:  ${PIXEL_ID}                ║
║  Status:    ${ACCESS_TOKEN ? '✓ Token configurado' : '⚠️  Token não configurado'}              ║
║                                                            ║
║  Endpoints:                                                ║
║  • POST /conversions  — Rastrear evento genérico          ║
║  • POST /purchase    — Rastrear compra Hotmart            ║
║  • POST /test-event  — Enviar evento de teste             ║
║  • GET  /health      — Verificar status                   ║
║                                                            ║
║  Docs: https://redebolha.com.br/CONVERSIONS_API_SETUP.md  ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
