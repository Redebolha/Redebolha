# Setup Conversions API Gateway — Rede Bolha

**Status:** ✓ Pixel instalado | Configuração do Gateway em progresso  
**Site:** www.redebolha.com.br  
**Pixel:** 3792335180914057  
**Data:** 2026-09-17

---

## 1️⃣ Informações Técnicas

### Pixel Meta (Browser)
- **ID:** `3792335180914057`
- **Tipo:** Conversions API Gateway
- **Localização:** Todas as 16 páginas principais (via `<!-- Meta Pixel Code -->`)
- **Eventos:** PageView + eventos customizados (AddToCart, Purchase, Contact, ViewContent)

### Configuração Atual
```javascript
// Em cada página HTML (<head>):
fbq('init', '3792335180914057');
fbq('track', 'PageView');
```

**Páginas com pixel:**
- index.html (homepage)
- oferta/index.html (landing do livro)
- livros/* (4 páginas de livros)
- simulador-renda-passiva.html (2 locais)
- economia/* (3 artigos)
- artigos/ponto-de-virada-renda-passiva.html
- palestras/index.html
- cursos/index.html
- teste-mascara-masculina/index.html

---

## 2️⃣ Passos no Events Manager (Facebook Business)

### A. Criar o Gateway

1. Acesse: https://eventsmanager.facebook.com/events_manager2/
2. Pixel: **3792335180914057**
3. Menu: **"Configurar → Conversions API"**
4. Clique: **"Criar um novo domínio"** (ou continue se já criou)
5. Tipo: **Conversions API Gateway**

### B. Gerar Token de Acesso

1. Em Settings → Business Settings → Users
2. Sistema → Gerar novo token de acesso
3. Permissões necessárias:
   - `ads_management`
   - `business_management`
   - `events_manager`
4. **Copie o token** (vai precisar no código)

### C. Configurar Servidor

No Events Manager:
1. **Domínio:** `www.redebolha.com.br`
2. **Endpoint:** (vai gerar automaticamente ou você fornece)
3. **Token:** Cole o token gerado acima
4. **Teste a conexão:** Meta vai fazer um ping para validar

---

## 3️⃣ Implementação Server-Side (Node.js/Express)

Se usar servidor próprio (não Madgicx), criar um webhook assim:

```javascript
// conversions-webhook.js
const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const PIXEL_ID = '3792335180914057';
const ACCESS_TOKEN = 'seu_token_aqui'; // Copiar do Events Manager
const BUSINESS_ACCOUNT_ID = '1281798318353962';

// Webhook para Meta Pixel eventos
app.post('/conversions', async (req, res) => {
  const { event_name, user_data, event_id } = req.body;
  
  try {
    // Validar assinatura (segurança)
    const signature = req.headers['x-hub-signature'];
    if (!validateSignature(JSON.stringify(req.body), signature)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // Enviar para Conversions API do Meta
    const payload = {
      data: [{
        event_name: event_name,
        event_id: event_id || crypto.randomUUID(),
        event_time: Math.floor(Date.now() / 1000),
        user_data: user_data || {}
      }],
      access_token: ACCESS_TOKEN
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();
    console.log('Meta Conversions API:', result);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erro ao enviar para Conversions API:', error);
    res.status(500).json({ error: error.message });
  }
});

// Função de validação de assinatura
function validateSignature(payload, signature) {
  // Implementar validação HMAC-SHA256
  // Usar o webhook secret do Meta
  return true; // Placeholder
}

app.listen(3000, () => {
  console.log('Conversions API Webhook rodando em :3000/conversions');
});
```

---

## 4️⃣ Eventos a Rastrear

### Recomendado para Rede Bolha:

```javascript
// HomePage - PageView (já configurado)
fbq('track', 'PageView');

// Landing do Livro
fbq('track', 'ViewContent', {
  content_ids: ['homem-ridiculo'],
  content_name: 'Homem, Você Não É Ridículo',
  content_type: 'product',
  value: 39.90,
  currency: 'BRL'
});

// Click em "Comprar"
fbq('track', 'InitiateCheckout', {
  content_ids: ['homem-ridiculo'],
  content_name: 'Livro Homem, Você Não É Ridículo',
  num_items: 1,
  value: 39.90,
  currency: 'BRL'
});

// Compra confirmada (integração com Hotmart/Hotmart)
fbq('track', 'Purchase', {
  content_ids: ['homem-ridiculo'],
  content_name: 'Livro + E-book',
  content_type: 'product',
  value: 39.90,
  currency: 'BRL',
  num_items: 1
});

// Newsletter
fbq('track', 'Contact', {
  content_name: 'Newsletter - Rede Bolha',
  value: 0,
  currency: 'BRL'
});

// WhatsApp
fbq('track', 'Contact', {
  content_name: 'WhatsApp - Contato',
  value: 0,
  currency: 'BRL'
});
```

---

## 5️⃣ Checklist de Configuração

### Frontend ✓
- [x] Pixel ID atualizado (3792335180914057)
- [x] Meta Pixel Code em 16 páginas
- [x] Comentários padronizados
- [x] Noscript fallback incluído
- [x] config.js atualizado

### Meta Events Manager (Em andamento)
- [ ] Acessar: https://eventsmanager.facebook.com/events_manager2/pixel_creation?business_id=1281798318353962&pixel_id=3792335180914057
- [ ] Criar domínio `www.redebolha.com.br`
- [ ] Gerar Access Token
- [ ] Validar conexão

### Backend/Servidor
- [ ] Criar endpoint `/conversions` se usar servidor próprio
- [ ] Ou configurar gateway da Madgicx se optar por terceiro
- [ ] Testar integração com evento de teste

### Hotmart (E-commerce)
- [ ] Integrar webhook de compra para enviar evento Purchase
- [ ] Validar que conversão aparece no Meta Ads Manager

---

## 6️⃣ Validação de Setup

### No Events Manager:
1. Ir para **Test Events**
2. Enviar evento de teste
3. Verificar se aparece em **Activity**
4. Confirmar que o domínio reconhece dados

### No Meta Ads Manager:
1. **Conversions → Rede Bolha Pixel**
2. Verificar se conversões aparecem
3. Comparar números com Google Analytics (devem ser próximos)

---

## 7️⃣ Dados Importantes

| Item | Valor |
|------|-------|
| **Business ID** | 1281798318353962 |
| **Pixel ID** | 3792335180914057 |
| **Site** | www.redebolha.com.br |
| **Owner Email** | admromariocruz@gmail.com |
| **Timezone** | America/Sao_Paulo |
| **Moeda** | BRL |
| **Tipo de Gateway** | MadgicxSetupFlavor (ou servidor próprio) |

---

## 8️⃣ Troubleshooting

### Pixel não rastreia eventos
- Verificar console do navegador (F12 → Console)
- Confirmar que `fbq` está definido
- Validar que não há erro de Content Security Policy

### Conversões não aparecem no Meta Ads
- Validar Access Token (pode expirar)
- Confirmar que domínio está autorizado
- Verificar formato de eventos no payload

### Discrepância entre navegador e server-side
- Adicionar `eventID` em ambos para deduplicação
- Usar ferramenta de debug do Meta para validar payload

---

## 9️⃣ Próximos Passos

1. **Agora:** Complete o setup no Events Manager (link que você abriu)
2. **Gere o token** no Business Settings
3. **Teste a conexão** antes de publicar
4. **Configure eventos customizados** (Purchase, Contact, ViewContent)
5. **Integre com Hotmart** para rastrear vendas do livro

---

**Criado:** 2026-09-17  
**Commit:** 41342bd  
**Branch:** claude/serene-lovelace-n9n7sj
