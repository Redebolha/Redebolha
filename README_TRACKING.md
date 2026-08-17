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

### 2. Públicos de retargeting

Com o pixel vinculado, criar em Públicos:

- Visitantes do site — últimos 30 dias
- Quem disparou `Lead` (fez o teste) — últimos 30 dias
- Quem disparou `InitiateCheckout` mas não comprou — últimos 14 dias

### 3. Páginas que não estão neste repositório

As páginas que os anúncios usam — o teste das máscaras e `/financas/` — foram
publicadas fora deste repositório e **não estão versionadas aqui**. O pixel
delas precisa ser conferido separadamente; o `js/tracking.js` não as cobre.
Se forem trazidas pro repositório, basta incluir a mesma tag e chamar
`window.RBTrack.lead('teste-das-mascaras')` no fim do quiz.
