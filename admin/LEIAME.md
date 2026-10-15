# Rede Bolha — Painel Administrativo

Painel (CMS) para gerenciar o conteúdo do site **redebolha.com.br** sem escrever código.
Funciona no navegador (computador, tablet e celular), entra com a sua conta do GitHub e
publica os artigos como páginas HTML no mesmo padrão dos artigos atuais do site
(`blog.css` + `/css/brasil.css`, Google Analytics, AdSense, dados estruturados de SEO e
URLs em `/artigos/`).

---

## 1. Como acessar

Endereço do painel: **https://redebolha.com.br/admin/**

O painel não aparece nos buscadores (`noindex` + `robots.txt`) e só funciona com um token válido.

## 2. Instalação (uma única vez)

Você precisa de um **token pessoal do GitHub**, que funciona como a senha de acesso.

1. Acesse **https://github.com/settings/personal-access-tokens** (logado na conta que administra o repositório).
2. Clique em **Generate new token** (tipo *fine-grained*).
3. Em *Repository access*, escolha **Only select repositories** → `Redebolha/Redebolha`.
4. Em *Permissions* → *Repository permissions*, marque **Contents: Read and write** (só isso).
5. Defina uma validade (ex.: 90 dias) e clique em **Generate token**.
6. Copie o token (ele aparece só uma vez).
7. Abra o painel, informe seu e-mail e **cole o token** no campo de senha.
   Marque *Lembrar-me* para não precisar colar de novo neste aparelho.

> O token fica salvo **apenas no seu navegador** e só é enviado ao próprio GitHub.
> A aba **Segurança** mostra até quando o token vale e avisa se ele tem permissões demais.

## 3. Criar e publicar um artigo

1. Na **Visão Geral**, clique em **+ Criar novo artigo**.
2. Escreva o **chapéu**, o **título** e, se quiser, o subtítulo.
3. Use **+ Adicionar bloco** para parágrafos, intertítulos, citações, imagens,
   vídeos (YouTube/Vimeo/MP4), listas, boxes e chamadas (CTA).
4. No painel lateral, preencha **categoria, endereço (URL) e resumo**.
5. Clique em **Pré-visualizar** para ver no computador, tablet e celular.
6. Clique em **Publicar**. Num único commit o painel grava:
   - `artigos/<endereço>.html` (o artigo);
   - o cartão do artigo no topo de `artigos/index.html`;
   - a entrada no `sitemap.xml`;
   - o item no `feed.xml`.

   O GitHub Pages leva de 1 a 2 minutos para colocar no ar.

**Rascunhos** ficam guardados só no navegador onde foram escritos (salvamento automático
a cada 8 segundos). O site só muda quando você clica em Publicar.

## 4. Editar um artigo publicado

Em **Artigos**, clique duas vezes no artigo (ou **⋯ → Editar**). Trechos especiais do
artigo (chamadas com mais de um link, caixas, parágrafos com estilo próprio) aparecem como
**blocos preservados** e voltam iguais ao publicar. O endereço de um artigo publicado não
muda, para não quebrar links. A data de publicação original é mantida.

## 5. Tirar um artigo do ar

Em **Artigos → ⋯ → Tirar do ar**. Num único commit o arquivo é apagado e o artigo sai da
lista, do sitemap e do feed. Se a página inicial tiver link para ele, o painel avisa antes.
Dá para recuperar pelo histórico do GitHub.

## 6. Página Inicial (capa)

A aba **Página Inicial** edita o que a capa mostra hoje:

- a **tira de notícias** logo abaixo do menu;
- o bloco **Notícia em destaque**;
- o bloco **Artigo em destaque**.

Escolha uma matéria na lista *Preencher a partir de uma matéria do site* para preencher
título, resumo, imagem e link automaticamente; revise e clique em **Salvar**. Só aquele
trecho da `index.html` é regravado; o resto da capa não é tocado.

## 7. Backup e recuperação

O site inteiro vive no repositório `Redebolha/Redebolha`, então **todo o histórico é backup**:

- Cada publicação gera um *commit* com data, hora e a mensagem "(via Painel Rede Bolha)".
- Para restaurar uma versão anterior: `github.com/Redebolha/Redebolha/commits/main`.
- Backup completo: em `github.com/Redebolha/Redebolha` → **Code** → **Download ZIP**.

## 8. Segurança

- Acesso por token pessoal (nunca em texto no site).
- Bloqueio de 1 minuto após 5 tentativas incorretas.
- **Sair** apaga o token deste navegador.
- Conexão sempre em HTTPS; painel fora dos buscadores.
- Recomendado: verificação em duas etapas na conta do GitHub e token com validade.

## 9. Instalar no celular (PWA)

Abra `redebolha.com.br/admin/` no navegador do celular → menu → **Adicionar à tela inicial**.

## 10. Arquivos do painel

- `admin/index.html` — interface (login, layout, estilos, versão de celular).
- `admin/app.js` — toda a lógica (acesso, editor, publicação, capa, mídia).
- `admin/manifest.json` — configuração do app instalável (PWA).
