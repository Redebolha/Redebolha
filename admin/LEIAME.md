# Rede Bolha — Painel Administrativo

Painel (CMS) para gerenciar o conteúdo do site **redebolha.com.br** sem escrever código.
Ele funciona 100% no navegador (computador, tablet e celular), autentica na sua conta do
GitHub e publica os artigos como páginas HTML estáticas no mesmo padrão do site
(usa \`blog.css\`, dados estruturados de SEO e preserva as URLs em \`/artigos/\`).

---

## 1. Como acessar

Endereço do painel: **https://redebolha.com.br/admin/**

O painel é marcado como não indexável (\`noindex\`) e só funciona com um token válido.

## 2. Instalação (uma única vez)

Você precisa de um **token pessoal do GitHub**, que funciona como a senha de acesso.

1. Acesse **https://github.com/settings/tokens** (logado na conta que administra o repositório).
2. Clique em **Generate new token** -> **Fine-grained token** (recomendado).
3. Em *Repository access*, escolha **Only select repositories** -> \`Redebolha/Redebolha\`.
4. Em *Permissions* -> *Repository permissions*, marque **Contents: Read and write**.
5. Defina uma validade (ex.: 90 dias) e clique em **Generate token**.
6. Copie o token (ele aparece so uma vez).
7. Abra o painel, informe seu e-mail e **cole o token** no campo de senha.
   Marque *Lembrar-me* para nao precisar colar novamente neste dispositivo.

> O token fica salvo **apenas no seu navegador**. Ele nunca e enviado a terceiros.
> Por seguranca, ninguem alem de voce deve inserir o token.

## 3. Como criar e publicar um artigo

1. Na **Visao Geral**, clique em **+ Criar novo artigo**.
2. Escreva o **titulo**, o **chapeu** (categoria editorial) e, se quiser, o subtitulo.
3. Use **+ Adicionar bloco** para inserir paragrafos, intertitulos, citacoes, imagens,
   videos (YouTube/Vimeo/MP4), listas, boxes e chamadas (CTA).
4. Formate o texto com a barra de ferramentas (negrito, italico, links etc.).
5. No painel lateral, preencha **categoria, tags, endereco (URL) e resumo**.
   A previa de SEO e a verificacao de acessibilidade aparecem ali.
6. Clique em **Pre-visualizar** para ver o resultado no computador, tablet e celular.
7. Clique em **Publicar**. O artigo e gravado em \`artigos/<endereco>.html\` e entra no ar.
   (O GitHub Pages leva de 1 a 2 minutos para atualizar.)

O texto e **salvo automaticamente** enquanto voce escreve. Se fechar a pagina sem querer,
o conteudo e recuperado ao reabrir o artigo.

## 4. Fluxo editorial e perfis

- **Administrador** — acesso completo.
- **Editor** — cria, edita, revisa e publica.
- **Autor** — cria e edita; depende de aprovacao para publicar.
- **Revisor** — aprova ou devolve para correcao.

Status de um conteudo: Rascunho -> Aguardando revisao -> Agendado -> Publicado -> Arquivado.
Para dar acesso a outra pessoa, convide-a como *colaboradora* do repositorio no GitHub;
cada pessoa usa o proprio token.

## 5. Backup e recuperacao

O site inteiro (inclusive os artigos) vive no repositorio GitHub \`Redebolha/Redebolha\`.
Isso significa que **todo o historico e um backup automatico**:

- Cada publicacao/edicao gera um *commit* com data, hora e autor.
- Para **restaurar uma versao anterior** de um artigo: abra o arquivo em
  \`github.com/Redebolha/Redebolha/commits/main/artigos\`, escolha a versao e restaure.
- Para **backup completo**: em \`github.com/Redebolha/Redebolha\` -> botao **Code** ->
  **Download ZIP**.
- Excluir um artigo pelo painel apenas o **arquiva**; o arquivo permanece no historico.

## 6. Seguranca

- Acesso por token pessoal (nunca em texto puro no site).
- Bloqueio apos 5 tentativas incorretas.
- Conexao sempre em HTTPS.
- Painel \`noindex\` (fora dos buscadores).
- Recomendado: ative a verificacao em duas etapas na sua conta do GitHub.

## 7. Instalar no celular (PWA)

Abra \`redebolha.com.br/admin/\` no navegador do celular -> menu -> **Adicionar a tela inicial**.

## 8. Arquivos do painel

- \`admin/index.html\` — interface (login, layout, estilos).
- \`admin/app.js\` — toda a logica (autenticacao, editor, publicacao).
- \`admin/manifest.json\` — configuracao do app instalavel (PWA).

Nada do conteudo existente do site foi alterado: o painel apenas **adiciona** a pasta \`/admin/\`.
