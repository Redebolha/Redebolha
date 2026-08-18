# Rastreamento do funil — Rede Bolha

Referência de como o Meta Pixel e o GA4 estão montados neste site, e o que
ainda precisa ser feito fora do código.

## Como está agora

| Item | Onde |
|---|---|
| Meta Pixel `2570806596755923` ("HVNR Tracking") | `js/tracking.js` |
| GA4 `G-JDV0ZGBPV9` | bloco inline no `<head>` de cada página |
| Eventos do funil | `js/tracking.js` |

O `js/tracking.js` é incluído em todas as páginas públicas:

```html
<script src="/js/tracking.js" defer></script>
```

## Eventos enviados

| Evento | Quando dispara |
|---|---|
| `PageView` | toda página |
| `ViewContent` | páginas de livro (`/livros/*.html`) |
| `InitiateCheckout` | clique em link de Amazon, Mercado Livre ou Hotmart |
| `Lead` | manual — `window.RBTrack.lead('nome-da-origem')` |
| `CompleteRegistration` | manual — `window.RBTrack.completeRegistration('...')` |

Para marcar a conclusão do teste das máscaras, chame no fim do quiz:

```js
window.RBTrack.lead('teste-das-mascaras');
```

## Por que `Purchase` não existe aqui

A compra acontece **fora** do site — Amazon, Mercado Livre ou Hotmart. O
navegador nunca volta pra uma página nossa depois do pagamento, então não há
onde disparar `Purchase`. Só existem duas saídas:

- **Hotmart** — tem integração nativa com o Meta Pixel. Basta cadastrar o ID
  `2570806596755923` no painel da Hotmart (Ferramentas → Pixel de rastreamento)
  e ela passa a disparar `Purchase` no servidor dela.
- **Amazon e Mercado Livre** — não há como. Nenhum dos dois deixa instalar
  pixel de terceiro. Vendas por esses canais serão sempre invisíveis pro Meta.

Consequência prática: enquanto a venda principal for por Amazon/Mercado Livre,
o evento de otimização das campanhas deve ser **`InitiateCheckout`** (clique
pra loja) ou **`Lead`**, não `Purchase`.

### Qual livro vende por onde

| Livro | Canais de compra | `Purchase` rastreável? |
|---|---|---|
| Homem, Você Não É Ridículo | Mercado Livre + Amazon | ❌ nunca |
| O Poder da Decisão | Hotmart `M106424796P` + Amazon | ✅ só a parte Hotmart |
| Amanhã é Outro Agora | Hotmart `Q106424744D` + Amazon | ✅ só a parte Hotmart |

Atenção: **o livro que os anúncios promovem (HVNR) não passa pela Hotmart.**
Configurar a Hotmart dá sinal de compra dos outros dois títulos, não do funil
que está rodando.

O código `R106833548K` aparece só no `js/config.js`, que é código morto
(nunca é importado por nenhuma página). É um link órfão.

## O que falta fazer fora do código

### 1. Vincular o pixel à conta de anúncios ← bloqueia tudo

O pixel existe e funciona, mas pertence ao business `3873914489434378` e
**não está compartilhado com a conta de anúncios `351203535`**. Por isso as
campanhas não registram conversão nenhuma.

Como resolver, no Gerenciador de Negócios:

1. Configurações do Negócio → Fontes de Dados → Conjuntos de Dados
2. Selecione **HVNR Tracking**
3. Aba **Contas de anúncios conectadas** → Adicionar → escolha a conta `351203535`
4. Salve

Depois disso as campanhas passam a mostrar conversão e dá pra criar públicos
de site.

**Status: feito em 17/08/2026.**

### 2. Públicos de retargeting

**Status: feito em 17/08/2026.** Criados na conta:

| Público | ID | Janela |
|---|---|---|
| Site — Todos os visitantes | `52510458650229` | 30 dias |
| Fez o teste das máscaras — Lead | `52510458697629` | 30 dias |
| Clicou pra comprar — InitiateCheckout | `52510458749229` | 14 dias |

Não é possível criar "clicou mas não comprou": excluir compradores exigiria o
evento `Purchase`, que não existe para Amazon/Mercado Livre.

### 3. Purchase pela Hotmart

Só vale para *O Poder da Decisão* e *Amanhã é Outro Agora* — ver a tabela de
canais acima. Fazer **uma vez por produto**, no painel da Hotmart:

1. Entrar em `app.hotmart.com` com a conta de **Produtor**
2. **Produtos** → escolher o produto → menu lateral **Ferramentas**
3. Abrir **Pixel de rastreamento** (em algumas contas aparece como
   "Pixels e Rastreamento" ou dentro de "Integrações")
4. **Adicionar pixel** → plataforma **Meta Ads / Facebook**
5. ID do pixel: `2570806596755923`
6. Marcar os eventos por página:
   - Página de compra / checkout → `InitiateCheckout`
   - **Compra aprovada → `Purchase`** ← o que importa
7. Se aparecer a opção **API de Conversões**, ativar e gerar o token de acesso
   no Gerenciador de Eventos do Meta (Configurações → API de Conversões →
   Gerar token de acesso). Isso manda a compra pelo servidor da Hotmart e
   sobrevive a bloqueador de anúncio.
8. Salvar e repetir para o segundo produto.

Os nomes de menu da Hotmart mudam de tempos em tempos; o que procurar é a
seção de pixel/rastreamento dentro das ferramentas do produto.

Para conferir se funcionou: Gerenciador de Eventos do Meta → conjunto
**HVNR Tracking** → aba **Testar eventos**, e fazer uma compra de teste.
O `Purchase` deve aparecer com origem `server` (se ativou a API) ou `browser`.

### 4. Páginas que não estão neste repositório

As páginas que os anúncios usam — o teste das máscaras e `/financas/` — foram
publicadas fora deste repositório e **não estão versionadas aqui**. O pixel
delas precisa ser conferido separadamente; o `js/tracking.js` não as cobre.
Se forem trazidas pro repositório, basta incluir a mesma tag e chamar
`window.RBTrack.lead('teste-das-mascaras')` no fim do quiz.
