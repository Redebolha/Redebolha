# Events Manager — Passo a Passo Prático

**Status:** Você já está logado  
**Link:** https://eventsmanager.facebook.com/events_manager2/pixel_creation?business_id=1281798318353962&pixel_id=3792335180914057

---

## 🎯 Seu Objetivo
Configurar o Conversions API Gateway para que eventos do site (cliques, compras, etc.) sejam rastreados **via servidor**, além do rastreamento do navegador.

---

## ✅ Checklist - Faça Nessa Ordem

### [ ] 1. Conectar Dados (Data Sources)
```
Events Manager → Seu Pixel (3792335180914057)
         ↓
    "Configurar" (ícone de engrenagem)
         ↓
    "Conversions API" ou "Data Source"
         ↓
    Botão "Conectar dados" (azul)
         ↓
    Tipo: "Conversions API"
```

**Na janela que abre:**
- [x] Selecionar: **"Website"** (não "App")
- [x] Tipo de gateway: **"Conversions API Gateway"** (recomendado)
- [x] Próximo

---

### [ ] 2. Domínio do Servidor
```
Na tela que aparece depois:
```

**Entrada 1 - Domínio:**
```
www.redebolha.com.br
```
(copie e cole exatamente)

**Entrada 2 - Endpoint (opcional por enquanto):**
```
https://www.redebolha.com.br/conversions
```
(ou deixe em branco — pode configurar depois)

**Clique:** "Próximo"

---

### [ ] 3. Gerar Token de Acesso

**Opção A: Via Events Manager**
```
Settings (engrenagem) → Gerenciador de Negócios
         ↓
"Configurações da Empresa" → "Usuários"
         ↓
Seu usuário → "Gerar novo token de acesso"
         ↓
Permissões necessárias (marque):
   ✓ ads_management
   ✓ business_management
   ✓ events_manager
   ✓ read_instagram_business_account
         ↓
Clique: "Gerar"
         ↓
COPIE O TOKEN INTEIRO (vai parecer assim):
   EAA...dH8ZAlk...2BZBs...
```

**Opção B: Via Graph API (mais direto)**
```
1. Abra: https://developers.facebook.com/docs/facebook-login/access-tokens
2. Gere um token de acesso longo (long-lived, 60 dias)
3. Copie
```

---

### [ ] 4. Colar Token no Events Manager

```
Volte para Events Manager → Configurações do Gateway
         ↓
Campo "Access Token" ou "Token de autenticação"
         ↓
Cole o token que copiou
         ↓
Clique: "Validar" ou "Testar"
         ↓
Mensagem: "✓ Token válido"
```

---

### [ ] 5. Testar Conexão

```
Botão: "Enviar evento de teste" (Test Event)
         ↓
Meta envia um ping para seu domínio
         ↓
Se tudo OK: "✓ Conexão validada"
```

**Se der erro:**
- Domínio pode estar errado → Confirme DNS
- Token expirou → Gere novo
- Endpoint offline → Suba o servidor (veja próxima seção)

---

### [ ] 6. Configurar Eventos Personalizados

**No campo "Eventos para rastrear", configure:**

```
Evento          Descrição
─────────────────────────────────────────────────────────
PageView        ✓ Já ativado (padrão)
ViewContent     Acesso a página de produto/livro
InitiateCheckout Clique em "Comprar"
AddToCart       Item adicionado ao carrinho
Purchase        Compra confirmada ← IMPORTANTE
Contact         Inscrição WhatsApp/Newsletter
Lead            Preenchimento de formulário
```

**Para cada um:**
1. Clique em "Adicionar"
2. Selecione o tipo
3. Mapeie os campos (preço, produto, etc.)
4. Salve

**Configuração recomendada para Rede Bolha:**

**Purchase (PRIORIDADE):**
```
Evento: Purchase
Campo: value = preço do livro (39.90)
Campo: currency = BRL
Campo: content_name = "Homem, Você Não É Ridículo"
Campo: content_ids = homem-ridiculo
Campo: num_items = 1
```

**ViewContent:**
```
Evento: ViewContent
Quando: Usuário entra em /oferta/index.html
Valor: 39.90
Produto: Livro
```

**Contact:**
```
Evento: Contact
Quando: Clique em WhatsApp ou inscrição em newsletter
```

---

## 🚀 Configurar Servidor Local (Node.js)

**Isso é opcional se usar Madgicx Gateway**, mas recomendado para controle total.

### Instalação Rápida:

```bash
cd /home/user/Redebolha

# Instalar dependências
npm install express node-fetch dotenv

# Criar arquivo .env
cat > .env << EOF
META_ACCESS_TOKEN=cole_seu_token_aqui_EAA...
META_PIXEL_ID=3792335180914057
WEBHOOK_SECRET=seu_webhook_secret_aleatorio
PORT=3000
EOF

# Rodar servidor
node conversions-api-webhook.js
```

**Saída esperada:**
```
╔════════════════════════════════════════════════════════════╗
║  🔌 Conversions API Webhook — Rede Bolha                   ║
║  Rodando em: http://localhost:3000                        ║
║  Pixel ID:  3792335180914057                ║
║  Status:    ✓ Token configurado              ║
╚════════════════════════════════════════════════════════════╝
```

### Testar o Webhook:

```bash
# Teste de evento simples
curl -X POST http://localhost:3000/test-event

# Teste de compra (simulação)
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "customer_email": "test@redebolha.com.br",
    "customer_phone": "+5551980482820",
    "product_name": "Homem, Você Não É Ridículo",
    "value": 39.90,
    "hotmart_transaction_id": "transacao_123"
  }'

# Resposta esperada:
# {"success":true,"event_id":"transacao_123","result":{"events_received":1,"fbl_strong_match":1}}
```

---

## 📊 Verificar Setup

### No Events Manager:
```
Seu Pixel → "Atividade" (Activity)
         ↓
Procure por: Event name = "Purchase", "ViewContent", etc.
         ↓
Se aparecer: ✓ Está funcionando!
```

### No Meta Ads Manager:
```
Campanhas → Conversões
         ↓
Ver gráfico de conversões do pixel
         ↓
Comparar com Google Analytics (devem ser próximos)
```

---

## 🔌 Integração com Hotmart (E-commerce)

Se usar Hotmart para vender o livro, adicione este webhook:

```
Hotmart → Configurações → Webhooks
         ↓
Novo webhook:
  URL: https://www.redebolha.com.br/purchase
  Eventos: purchase_approved, subscription_status_updated
         ↓
Teste disparando uma compra de teste
```

**Payload que Hotmart envia (automático):**
```json
{
  "customer": {
    "email": "comprador@example.com",
    "phone": "5551980482820",
    "name": "João Silva"
  },
  "product": {
    "name": "Homem, Você Não É Ridículo"
  },
  "price": 39.90,
  "transaction": "123456789"
}
```

**Seu webhook (/purchase) recebe e envia para Meta.**

---

## ⚡ Resumo: 10 Minutos para Setup Completo

| Tempo | Ação |
|-------|------|
| 0-2 min | Abra o link do Events Manager (já feito ✓) |
| 2-4 min | Clique em "Conectar dados" → "Conversions API" |
| 4-6 min | Gere token no Gerenciador de Negócios |
| 6-8 min | Cole token e teste conexão |
| 8-10 min | Configure eventos (Purchase, ViewContent, Contact) |
| ✓ Pronto! | Pixel já está rastreando 🎉 |

---

## ❓ Dúvidas Frequentes

### P: Qual é a diferença entre Pixel do navegador e Conversions API?

**R:**
- **Pixel (navegador):** Rastreia de forma mais fácil, mas bloqueadores de anúncios podem interferir
- **Conversions API (servidor):** Confiável 100%, mas precisa de integração backend
- **Recomendado:** Usar os dois! Meta deduplica automaticamente com `eventID`

---

### P: Preciso de SSL/HTTPS?

**R:** Sim, obrigatório para Conversions API. Seu domínio usa HTTPS? 
```bash
curl https://www.redebolha.com.br
# Deve responder com status 200, não erro de certificado
```

---

### P: Posso usar a solução do Madgicx em vez de servidor próprio?

**R:** Sim! Ambas funcionam. Madgicx é mais fácil (sem código), mas custa. Servidor próprio é grátis e tem mais controle.

---

### P: Como rastrear compras do Hotmart?

**R:** Integrar webhook conforme seção acima. Hotmart envia dados → seu servidor → Meta Conversions API.

---

## 📞 Suporte

Qualquer dúvida:
1. Verifique o console do navegador (F12)
2. Verifique logs do servidor (`node conversions-api-webhook.js`)
3. Teste evento via `curl` ou Postman
4. Valide token em: https://developers.facebook.com/tools/debug/accesstoken/

---

**Criado:** 2026-09-17  
**Última atualização:** 2026-09-17  
**Status:** Pronto para seguir
