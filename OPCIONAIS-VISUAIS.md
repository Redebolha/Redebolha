# Rede Bolha — o que ficou pendente

O site inteiro já está no novo desenho: 30 páginas, um só sistema visual,
`css/rb.css` e `js/rb.js` compartilhados. Este arquivo lista **só o que ainda
depende de você** — os itens antigos deste documento (artigo duplicado na home,
animação da capa girando, link `/admin/` no menu) foram resolvidos pela virada
e não existem mais.

---

## 1. Formulário da newsletter não está ligado a nada

Na home, a seção "Receber os próximos textos" tem um formulário completo, mas
**sem serviço por trás**. Hoje ele avisa isso na própria tela quando enviado.

Para ligar, escolha um serviço (Mailchimp, Brevo, MailerLite) e troque, no
`index.html`, o `action` do formulário `id="assinar"` pela URL que o serviço
fornece. Depois apague o trecho no fim do arquivo que começa com o comentário
`/* ---------- newsletter: ainda sem servidor ---------- */`.

Enquanto isso não acontece, o canal de contato que funciona é o WhatsApp,
que está logo ao lado.

---

## 2. Duas imagens ainda vêm do Blogger

A capa do livro físico e a sua foto continuam hospedadas em
`blogger.googleusercontent.com`. São as **únicas** imagens externas do site.
Todo o resto é servido do seu próprio domínio.

Vale migrar porque a capa do hero é o seu LCP — a maior imagem que a pessoa vê
ao abrir o site — e ela já tem `fetchpriority="high"` esperando por um arquivo
local para render rápido.

| Arquivo a criar | Onde aparece | Dimensões |
|---|---|---|
| `/homem-voce-nao-e-ridiculo-capa.jpg` | hero, estante, `og:image`, `twitter:image` e 2 pontos do JSON-LD | 620 × 925 |
| `/adm-romario-cruz.jpg` | coluna do autor na home e `image` do `Person` no JSON-LD | 420 × 420 |

Baixe as duas do Blogger, suba com esses nomes e faça localizar-e-substituir
das URLs longas pelos caminhos `/...jpg`.

---

## 3. LGPD: banner de cookies e Consent Mode v2

O site carrega GA4, Meta Pixel e AdSense **sem pedir consentimento**. Para
adequar à LGPD é preciso um banner e o Consent Mode v2, que só libera os
rastreadores depois do "Aceitar".

### 3.1 — No `<head>`, antes dos scripts do Pixel e do gtag

```html
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'denied',
    personalization_storage: 'denied', security_storage: 'granted',
    wait_for_update: 500
  });
</script>
```

### 3.2 — No fim do `css/rb.css`

```css
.rb-lgpd{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:var(--fundo);border-top:1px solid var(--linha-forte);box-shadow:0 -12px 40px rgba(0,0,0,.5);padding:18px 20px;display:none;}
.rb-lgpd.is-on{display:block;}
.rb-lgpd .in{max-width:var(--max);margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px;justify-content:space-between;}
.rb-lgpd p{margin:0;color:var(--corpo);font-size:.92rem;line-height:1.55;max-width:64ch;}
.rb-lgpd p a{color:var(--ouro);border-bottom:1px solid var(--linha);}
.rb-lgpd .acoes{display:flex;gap:10px;flex:0 0 auto;}
@media(max-width:700px){.rb-lgpd .in{justify-content:center;text-align:center;}.rb-lgpd .acoes{width:100%;}.rb-lgpd .bt{flex:1;}}
```

### 3.3 — Antes de `</body>`, em todas as páginas

```html
<div class="rb-lgpd" id="rbLgpd" role="dialog" aria-live="polite" aria-label="Aviso de cookies">
  <div class="in">
    <p>Usamos cookies para entender como você navega e para exibir anúncios que ajudam a manter a Rede Bolha no ar. Você escolhe. Saiba mais na <a href="/politica-de-privacidade.html">Política de Privacidade</a>.</p>
    <div class="acoes">
      <button type="button" class="bt bt--fant" id="rbLgpdNao">Recusar</button>
      <button type="button" class="bt" id="rbLgpdSim">Aceitar</button>
    </div>
  </div>
</div>
<script>
(function () {
  var CHAVE='rb-consentimento', banner=document.getElementById('rbLgpd'), carregado=false;
  function carregar(){
    if(carregado) return; carregado=true;
    var ga=document.createElement('script'); ga.async=true;
    ga.src='https://www.googletagmanager.com/gtag/js?id=G-JDV0ZGBPV9';
    document.head.appendChild(ga);
    gtag('js', new Date()); gtag('config','G-JDV0ZGBPV9');
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','2570806596755923'); fbq('track','PageView');
    var ads=document.createElement('script'); ads.async=true; ads.crossOrigin='anonymous';
    ads.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6315134930280019';
    document.body.appendChild(ads);
  }
  function aceitar(){
    gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',
      analytics_storage:'granted',functionality_storage:'granted',personalization_storage:'granted'});
    carregar();
  }
  var salvo=null; try{ salvo=localStorage.getItem(CHAVE); }catch(e){}
  if(salvo==='aceito') aceitar();
  else if(salvo!=='recusado') banner.classList.add('is-on');
  document.getElementById('rbLgpdSim').addEventListener('click',function(){
    try{localStorage.setItem(CHAVE,'aceito');}catch(e){} banner.classList.remove('is-on'); aceitar();});
  document.getElementById('rbLgpdNao').addEventListener('click',function(){
    try{localStorage.setItem(CHAVE,'recusado');}catch(e){} banner.classList.remove('is-on');});
})();
</script>
```

Depois disso, remova do `<head>` os blocos do Meta Pixel e do gtag, e o script
do AdSense do fim do `<body>` — eles passam a ser carregados só após o aceite.

---

## 4. Depois de publicar

1. Reenviar o `sitemap.xml` no Google Search Console e pedir reindexação da home.
2. Cadastrar o site no Bing Webmaster Tools (dá para importar do Search Console).
3. Conferir que `https://redebolha.com.br/99993a55828e52afb793f6ef37a5f7d3.txt`
   abre em texto puro e rodar `node indexnow.js` na raiz.
4. No JSON-LD da home, preencher `isbn` e `numberOfPages` de cada livro
   (estão marcados como `_isbn` e `_numberOfPages`) e acrescentar a URL da sua
   página de autor na Amazon no `sameAs` do `Person`.
5. Se tiver perfil no X, descomentar o `twitter:site` no `<head>` da home.

---

## Observação

`artigos/blog.css` **não é mais usado por nenhuma página**. Deixei o arquivo no
repositório por segurança, mas ele pode ser apagado quando você tiver certeza
de que nada externo aponta para ele.
