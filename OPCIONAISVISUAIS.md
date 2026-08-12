# Itens que eu NÃO apliquei — porque mexem no visual

Você pediu, no meio do trabalho: **"não mexer na parte visual do site em hipótese alguma"**.
Quatro itens do briefing só funcionam mudando o que aparece na tela, então deixei todos
fora do `index.html` e prontos aqui, para você aplicar quando quiser.

O `index.html` que está no ar hoje foi conferido pixel a pixel contra o original
(desktop 1280px e celular 390px): **0 pixels de diferença**.

---

## 1. Bloco 5 — o artigo "O silêncio que mata" aparece 3 vezes na home

É o item de maior ganho de SEO que ficou de fora. Hoje a home tem **três `<h2>` com
o mesmo título**, o que dilui o sinal e confunde o Google sobre qual bloco é o principal.

O briefing pede para manter só o `rb-destaque` (o mais completo, com imagem).
Para isso, apague dois trechos do `index.html`:

**(a) A seção do topo** — começa em `<section class="sec sec--tight">` (por volta da linha 870,
logo depois de `<div class="hyr" id="livro-homem">`) e vai até o `</section>` correspondente:

```html
<section class="sec sec--tight">
<div class="wrap" style="max-width:900px;">
<span class="eyebrow reveal">Pare e Leia · Na Rede Bolha</span>
<h2 class="reveal" style="max-width:880px;">O silêncio que mata: por que nós, homens, morremos antes — e quase ninguém toca no assunto?</h2>
<div class="rule reveal"></div>
<p class="lead reveal" style="max-width:640px;">Uma conversa franca, sem juízo e sem clichê — do jeito que a gente deveria ter tido há muito tempo. Leva cinco minutos. Pode mudar o resto.</p>
<a class="btn" href="/artigos/">Ler os artigos →</a>
</div>
</section>
```

**(b) O bloco `rb-gancho` inteiro** — de `<section class="rb-gancho" aria-label="Artigo em destaque">`
(por volta da linha 949) até o comentário `<!-- ============ FIM DO GANCHO DE MANCHETE ============ -->`.

> **Sobre o rotativo de manchetes:** ele vive dentro do `rb-gancho`. Se quiser preservá-lo,
> não dá para simplesmente movê-lo: o script troca o texto de `#rb-manchete`, que é justamente
> o `<h2>` duplicado. O caminho limpo é aplicar o rotativo ao título do `rb-destaque`
> (trocar `document.getElementById("rb-manchete")` por um `id` novo no `<h2 class="rb-destaque-titulo">`)
> — mas aí o título do bloco em destaque passa a mudar sozinho a cada 8s, o que é ruim para SEO,
> porque o Google pode indexar um título diferente do que está no `<h2>` original. **Minha
> recomendação: descartar o rotativo.**

Depois de apagar, o CSS do `.rb-gancho` (que está no `<head>`) fica sem uso. Pode deixar,
não faz mal, ou apagar o bloco `<style>` que começa com `.rb-gancho{`.

**Resultado:** a home fica visivelmente mais curta e sobra **um único `<h2>`** com esse título.

---

## 2. Bloco 6 — a animação `spinCover3d` (capa girando)

Hoje duas capas giram 360° em loop infinito, o tempo todo, em duas seções ao mesmo tempo.
É o principal peso de INP no celular. Para limitar a 3 voltas e depois parar,
troque estas **duas** linhas do `<style>` principal:

```css
/* linha ~94 — capa do hero */
.hyr .cover{...;animation:spinCover3d 8s linear infinite;}
/* linha ~211 — capa do livro físico */
.hyr .bk--destaque .bk-cover-wrap img{...;animation:spinCover3d 8s linear infinite;}
```

por (mantendo tudo o que vem antes do `animation:`):

```css
animation:spinCover3d 8s linear 3;
```

Ou, para girar só quando o mouse passa por cima (mais econômico ainda):

```css
/* remova o animation: das duas regras acima e acrescente: */
.hyr .cover:hover,
.hyr .bk--destaque .bk-cover-wrap img:hover{animation:spinCover3d 8s linear infinite;}
```

O `@media(prefers-reduced-motion:reduce)` que já existe continua valendo nos dois casos.

---

## 3. Bloco 7 — banner de cookies (LGPD) + Consent Mode v2

Este item **precisa** de um elemento novo na tela: sem banner não há como pedir consentimento,
e sem consentimento o Consent Mode v2 bloquearia GA4, Pixel e AdSense para sempre —
ou seja, aplicar meio item quebraria toda a sua medição. Por isso deixei os dois juntos aqui.

### 3.1 — Colar no `<head>`, **antes** dos scripts do Pixel e do gtag

```html
<!-- Consent Mode v2 — tudo negado por padrão, até o visitante decidir -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500
  });
</script>
```

### 3.2 — Remover do `<head>` os scripts de rastreamento

Apague os blocos `<!-- Meta Pixel Code -->` e `<!-- Google tag (gtag.js) -->` do `<head>`
e o `<script defer src="...adsbygoogle.js...">` do fim do `<body>`. Eles passam a ser
carregados pelo script do item 3.4, só depois do "Aceitar".

### 3.3 — CSS do banner (colar no fim do `<style>` principal)

```css
.rb-lgpd{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0A0A0C;border-top:1px solid rgba(201,162,75,.35);box-shadow:0 -12px 40px rgba(0,0,0,.6);padding:18px 20px;display:none;}
.rb-lgpd.is-on{display:block;}
.rb-lgpd .in{max-width:1120px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;justify-content:space-between;}
.rb-lgpd p{margin:0;color:#C6C0B5;font-size:.92rem;line-height:1.55;max-width:64ch;font-family:'Inter',system-ui,sans-serif;}
.rb-lgpd p a{color:#C9A24B;text-decoration:underline;text-underline-offset:3px;}
.rb-lgpd .acoes{display:flex;gap:10px;flex:0 0 auto;}
.rb-lgpd button{font-family:'Oswald',sans-serif;font-weight:600;font-size:.84rem;letter-spacing:.08em;text-transform:uppercase;padding:.75rem 1.5rem;border-radius:3px;cursor:pointer;border:1px solid transparent;transition:filter .2s,background .2s;}
.rb-lgpd .sim{background:linear-gradient(135deg,#E7CE8A,#C9A24B 55%,#9A7A30);color:#0A0A0C;}
.rb-lgpd .sim:hover{filter:brightness(1.06);}
.rb-lgpd .nao{background:transparent;color:#E7CE8A;border-color:rgba(201,162,75,.45);}
.rb-lgpd .nao:hover{background:rgba(201,162,75,.08);}
@media(max-width:700px){.rb-lgpd .in{justify-content:center;text-align:center;}.rb-lgpd .acoes{width:100%;}.rb-lgpd button{flex:1;}}
```

### 3.4 — HTML + script (colar logo antes de `</body>`)

```html
<div class="rb-lgpd" id="rbLgpd" role="dialog" aria-live="polite" aria-label="Aviso de cookies">
  <div class="in">
    <p>Usamos cookies para entender como você navega e para exibir anúncios que ajudam a manter a Rede Bolha no ar. Você escolhe. Saiba mais na <a href="/politica-de-privacidade.html">Política de Privacidade</a>.</p>
    <div class="acoes">
      <button type="button" class="nao" id="rbLgpdNao">Recusar</button>
      <button type="button" class="sim" id="rbLgpdSim">Aceitar</button>
    </div>
  </div>
</div>
<script>
(function () {
  var CHAVE = 'rb-consentimento';
  var banner = document.getElementById('rbLgpd');
  var carregado = false;

  function carregarRastreadores() {
    if (carregado) return;
    carregado = true;

    // GA4
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-JDV0ZGBPV9';
    document.head.appendChild(ga);
    gtag('js', new Date());
    gtag('config', 'G-JDV0ZGBPV9');

    // Meta Pixel
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '2570806596755923');
    fbq('track', 'PageView');

    // AdSense
    var ads = document.createElement('script');
    ads.async = true;
    ads.crossOrigin = 'anonymous';
    ads.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6315134930280019';
    document.body.appendChild(ads);
  }

  function aceitar() {
    gtag('consent', 'update', {
      ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted',
      analytics_storage: 'granted', functionality_storage: 'granted', personalization_storage: 'granted'
    });
    carregarRastreadores();
  }

  var salvo = null;
  try { salvo = localStorage.getItem(CHAVE); } catch (e) {}

  if (salvo === 'aceito') {
    aceitar();
  } else if (salvo !== 'recusado') {
    banner.classList.add('is-on');
  }

  document.getElementById('rbLgpdSim').addEventListener('click', function () {
    try { localStorage.setItem(CHAVE, 'aceito'); } catch (e) {}
    banner.classList.remove('is-on');
    aceitar();
  });

  document.getElementById('rbLgpdNao').addEventListener('click', function () {
    try { localStorage.setItem(CHAVE, 'recusado'); } catch (e) {}
    banner.classList.remove('is-on');
    // nada é carregado: o "denied" padrão continua valendo
  });
})();
</script>
```

> Os dois scripts de evento que já estão no fim do `index.html` (`InitiateCheckout` do Pixel e
> `clique_amazon` do GA4) continuam funcionando sem alteração: eles testam
> `typeof fbq === 'function'` / `typeof gtag === 'function'` antes de disparar,
> então simplesmente não fazem nada enquanto não houver consentimento.

---

## 4. Bloco 4 — tirar `/admin/` do menu

O briefing pede para remover o link. Como isso apaga um item visível do menu, deixei ele lá,
mas com `rel="nofollow"` — o Google não segue mais o link — e o `robots.txt` novo já tem
`Disallow: /admin/`. Para remover de vez, apague esta linha do `index.html`:

```html
<li><a class="lnk" href="/admin/" rel="nofollow">Admin</a></li>
```

---

## 5. Bloco 6 — as duas imagens que ainda vêm do Blogger

As três capas de e-book já saíram do `raw.githubusercontent.com` e apontam para os arquivos
que já estavam na raiz do repositório (`/homem-voce-nao-e-ridiculo-ebook-capa.jpg`,
`/amanha-outro-agora.jpg`, `/poder-da-decisao.jpg`) — nada para subir, funciona na hora.
Se preferir organizá-las numa pasta `/img/`, é só mover os arquivos e ajustar esses três `src`.
Faltam duas, que continuam no `blogger.googleusercontent.com` porque **eu não consegui
baixá-las daqui** (o proxy deste ambiente bloqueia o domínio) — e apontar para um arquivo
que não existe deixaria as imagens quebradas no site.

Para migrar, baixe as duas do Blogger, salve com estes nomes e troque as URLs:

| Arquivo a criar | Onde aparece hoje | Dimensões |
|---|---|---|
| `/img/homem-voce-nao-e-ridiculo-capa.jpg` | hero, capa do livro físico, `og:image`, `twitter:image` e 2 pontos do JSON-LD | 620 × 925 |
| `/img/adm-romario-cruz.jpg` | foto na seção "Sobre o autor" e `image` do `Person` no JSON-LD | 420 × 420 |

Depois é um localizar-e-substituir: troque as duas URLs longas do `blogger.googleusercontent.com`
pelos caminhos `/img/...` correspondentes. São 6 ocorrências da capa e 2 da foto.

**Ganho:** a capa do hero é o seu LCP. Servida do próprio domínio, com o `fetchpriority="high"`
que já coloquei, ela deve carregar bem mais rápido do que hoje.
