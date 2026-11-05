# Acessibilidade RS: LEIA-ME da equipe

Registro do trabalho de 4 de novembro de 2026 e guia para o lançamento.
O nome começa com "_" para o arquivo ficar só no GitHub e não ser publicado no site.

## Situação hoje

- **Lançamento oficial:** janeiro de 2027.
- **Público:** em redebolha.com.br/acessibilidade-rs/ aparece só a tela "Lançamento Acessibilidade RS 2027".
- **Prévia** (equipe e apoiadores; serve de portfólio): https://redebolha.com.br/acessibilidade-rs/?previa=rb2027
  - O navegador lembra a prévia. Para voltar a ver como o público: `?previa=sair` ou janela anônima.
  - A prévia não é senha: o código está neste repositório, que é público.
- **Abas com formulário** ("Avalie um lugar" e "Cadastre seu negócio"): mostram a tela de lançamento até janeiro, inclusive na prévia.
- **Contato até o lançamento:** só WhatsApp (51) 98048-2820 e e-mail admromariocruz@gmail.com.

## Interruptores

Ficam no início de `acessibilidade-rs/index.html`, no primeiro `<script>` do `<head>`.

| Variável | Hoje | O que faz |
|---|---|---|
| `TRAVADO` | `true` | `true`: público vê só a tela de lançamento e os formulários ficam fechados. `false`: página liberada para todos. |
| `APOIO_PENDENTE` | `true` | `true`: tarja "Aguardando autorização" sobre os logos da FADERS e do COEPEDE. `false`: logos normais. |
| `CHAVE` | `rb2027` | Código da prévia (`?previa=rb2027`). |

## O que foi feito em 4/nov/2026

| Envio | O quê |
|---|---|
| `7963e23` | Página travada com a tela "Lançamento Acessibilidade RS 2027" e prévia para a equipe. |
| `217fcd0` | Capa do site: observação "Lançamento oficial · Janeiro de 2027" no destaque do ARS. |
| `32014d6` | Imagens: logos do COEPEDE e da FADERS, foto do garoto-propaganda e foto das cadeiras anfíbias. |
| `df475aa` | Guaritas da Rede Praia Acessível no mapa com o símbolo do cadeirante, garoto-propaganda no topo, logos de apoio e símbolo internacional de acessibilidade como marca do ARS. |
| `abe0e50` | Disque Banho Assistido trocado para (51) 98482-0292. |
| `ba2e450` | Disque Banho Assistido marcado como temporada 2026/2027. |
| `52a64d8` | Abas de formulário travadas até o lançamento; contato só por WhatsApp e e-mail na tela de lançamento. |
| `a366fc9` | Aviso na aba Praia Acessível: os locais são da temporada anterior e a lista oficial 2026/2027 será disponibilizada pela FADERS. |
| `8bde17c` | Tarja "Aguardando autorização" sobre os logos da FADERS e do COEPEDE. |

### Detalhes

- **Guaritas no mapa:** 47 pontos da temporada 2025/2026 (Litoral Norte, Litoral Sul, águas internas e piscinas), conforme as listas da Operação Verão Total. Somam as 61 guaritas e as 7 piscinas da temporada (as 5 piscinas dos centros comunitários de Porto Alegre ficam num ponto só). Marcador: quadrado azul com o cadeirante. Há botão para mostrar ou esconder, busca por nome (ex.: "Cassino"), painel com guarita, cidade, serviço, Disque, "Como chegar" e "Avaliar", e a lista completa na aba Praia Acessível.
- **Coordenadas:** aproximadas, na praia, rio, lagoa ou piscina de cada cidade.
- **Marca:** o símbolo internacional de acessibilidade identifica o ARS (todas as deficiências). O cadeirante ficou só para as guaritas, para não confundir no mapa.
- **Garoto-propaganda:** foto do banho assistido com cadeira anfíbia e guarda-vidas do CBMRS, no topo da aba Mapa.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `acessibilidade-rs/index.html` | Página, tela de lançamento, prévia, interruptores e textos. |
| `acessibilidade-rs/app.js` | Mapa, camada das guaritas, painéis, busca e listas. |
| `acessibilidade-rs/praia-acessivel.json` | Guaritas: temporada, fonte, Disque e pontos. Para 2026/2027, troque `temporada` e os `pontos`. |
| `acessibilidade-rs/dados.json` | Lugares do guia (publicados pelo painel /admin). |
| `img/ars-apoio-coepede.png`, `img/ars-apoio-faders.png` | Logos de apoio. |
| `img/ars-praia-garoto-propaganda.jpg`, `img/ars-praia-cadeiras-anfibias.jpg` | Fotos da Rede Praia Acessível. |
| `index.html` (capa do site) | Observação de lançamento no destaque do ARS (há um comentário marcando o lugar). |

## Pendências

- [ ] Autorização de uso das marcas da FADERS e do COEPEDE. Depois: `APOIO_PENDENTE = false`.
- [ ] Autorização de uso de imagem das pessoas nas fotos da Praia Acessível.
- [ ] Foto do garoto-propaganda em resolução maior (a atual tem 400×300).
- [ ] Confirmar a cidade da Guarita 49 (Balneário Santa Rita): Arroio do Sal ou Capão da Canoa.
- [ ] Lista oficial da temporada 2026/2027 (FADERS): atualizar `praia-acessivel.json`.
- [ ] Cadastrar mais empresas antes de janeiro.

## Checklist do lançamento (janeiro de 2027)

1. Em `acessibilidade-rs/index.html`: `TRAVADO = false`.
2. Se as autorizações chegaram: `APOIO_PENDENTE = false`.
3. Na capa (`index.html`): trocar ou tirar a observação "Lançamento oficial · Janeiro de 2027".
4. Conferir se `praia-acessivel.json` já está com a temporada 2026/2027.
5. Revisar os textos que dizem "em breve" (manchete da aba Mapa e aba Praia Acessível).
6. Subir a `VERSAO` em `/service-worker.js` (hoje `redebolha-v29`) para os celulares pegarem a versão nova.
7. Conferir a página numa janela anônima, no computador e no celular.

## Ideias da pesquisa de similares (4/nov/2026)

- Usar os dados livres do Wheelmap/OpenStreetMap para o mapa já começar com mais lugares.
- Apoiar a certificação no Selo Estadual da FADERS em vez de criar um selo próprio.
- Publicar os dados do guia como dados abertos, como faz o Acceslibre na França.
