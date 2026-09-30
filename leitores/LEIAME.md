# Área do Leitor — `/leitores/`

A área de quem comprou qualquer livro. Abre com o **código de leitor** que vai
no livro. Fora do Google (`noindex`), fora do menu: quem chega, chega pelo livro.

## Como a porta funciona

O site é estático e este repositório é **público**. Uma senha conferida em
JavaScript seria enfeite: o conteúdo estaria aqui, legível no GitHub.

Por isso o conteúdo exclusivo **não existe em texto aberto neste repositório**.
Ele fica cifrado (AES-256-GCM) dentro do bloco `#rb-cofre` de `index.html`, e só
um código de leitor gera a chave que o abre. Quem abrir o código-fonte vê texto
embaralhado.

- **Um código por livro.** Qualquer um deles abre a área. Se o código de um livro
  vazar, troca-se só aquele — os outros continuam valendo.
- **O aparelho lembra.** Quem entrou uma vez não digita de novo naquele aparelho.
  O botão "Sair deste aparelho" apaga.
- **A Carta.** Depois do código certo, a página pede o e-mail e o manda, já
  digitado, para o cadastro d'A Carta numa aba nova (o endereço vem de
  `js/newsletter.json`, como no resto do site). Dá para entrar sem deixar
  e-mail: o livro já foi pago, e consentimento arrancado na porta não vale.
- **GA4.** Eventos `leitor_desbloqueio` (com o livro), `leitor_codigo_errado`,
  `leitor_pulou_email`, `newsletter_signup` (perfil `leitor-<livro>`) e
  `leitor_planilha` (formato `excel` ou `google`).

## O que fica FORA do repositório

Numa pasta privada (no seu computador ou no Google Drive — nunca aqui):

| Arquivo | O que é |
|---|---|
| `conteudo.html` | O miolo da área, em HTML simples |
| `codigos.json` | Os códigos, um por livro |

`tools/leitores.py` se recusa a rodar se a pasta privada estiver dentro do
repositório.

## Mudar o conteúdo ou os códigos

```bash
pip install cryptography                                   # uma vez
python3 tools/leitores.py --novo-codigo HVNR               # sorteia um código
python3 tools/leitores.py --privado ~/leitores-privado     # cifra e grava
```

Depois: suba `leitores/index.html` e aumente `VERSAO` em `service-worker.js`.

## Arquivos para baixar (planilha, PDF, áudio)

**Não** coloque neste repositório — qualquer arquivo aqui tem endereço público.
Suba no Google Drive com "qualquer pessoa com o link" e cole o link dentro do
`conteudo.html`. O link só aparece para quem abriu a área.

Para trocar um arquivo sem mudar o link (ex.: nova versão da planilha), use
"Gerenciar versões" no Drive em vez de subir um arquivo novo.

## O limite, dito com franqueza

É um código por livro, não uma senha por pessoa. Quem tem o código entra — e
pode passá-lo adiante. Para um bônus de leitor, é o equilíbrio certo entre
trabalho e proteção. Se um dia a área valer mais do que isso, o próximo passo é
login individual por e-mail (Supabase ou Firebase), e o conteúdo daqui migra
inteiro.
