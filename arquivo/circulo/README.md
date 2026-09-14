# Círculo Rede Bolha — fora do ar, inteiro e pronto

Nada aqui foi apagado. Estas páginas saíram do ar em setembro de 2026 porque
o site ainda não gera receita e a assinatura estava disputando a atenção do
visitante com a única coisa que precisa crescer agora: **a audiência**.

O sistema está praticamente pronto. Voltar é questão de uma hora de trabalho,
não de recomeçar.

## O que está guardado aqui

| Arquivo | O que é |
|---|---|
| `assinatura/index.html` | A página de venda do Círculo — R$ 37/mês, os dois caminhos de pagamento (cartão pelo Beehiiv, Pix pelo WhatsApp), a promessa já corrigida para o que o Beehiiv realmente entrega |
| `membros/index.html` | A área do assinante |
| `circulo-beehiiv.py` | O script que migrou o Círculo da Hotmart para o Beehiiv e escreveu os dois caminhos de pagamento |

## Como colocar de volta no ar

1. `git mv arquivo/circulo/assinatura assinatura` e o mesmo para `membros`.
2. `git mv arquivo/circulo/circulo-beehiiv.py tools/`.
3. Em `tools/rodape.py`, devolver a linha do Círculo à coluna
   "Trabalhe com Romário", e rodar `python3 tools/rodape.py`.
4. Em `tools/hub-ferramentas.py`, devolver a `<section class="hub-circulo">`,
   e rodar `python3 tools/hub-ferramentas.py`.
5. Em `js/newsletter.json`, devolver a chave `assinatura` com o endereço da
   página de pagamento do Beehiiv.
6. `python3 tools/sitemap.py` para a `/assinatura/` voltar ao Google.

O que **não** volta sozinho: as 25 chamadas de fim de artigo. Elas foram
removidas de propósito — o lugar delas hoje é d'A Carta, que é grátis e que
alimenta a audiência. Se o Círculo voltar, o certo é escrever a chamada de
novo, não ressuscitar a antiga.

## O que aprender antes de reabrir

- **O Pix é manual.** Quem paga por Pix espera o Romário liberar à mão, em até
  24 horas. Isso tem que estar escrito na página — e estava.
- **Três promessas não cabem no Beehiiv:** vídeo semanal, live mensal e e-book
  na entrada. Já foram removidas da página. Não as devolva sem ter onde
  hospedar o vídeo e como entregar o arquivo.
- **Reabrir sem audiência é reabrir para ninguém.** Foi o que aconteceu. A
  ordem certa é lista primeiro, cobrança depois.
