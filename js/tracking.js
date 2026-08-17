/*
 * Rede Bolha — rastreamento do funil (Meta Pixel + GA4)
 *
 * Um unico arquivo para todas as paginas. Inclua no <head>:
 *   <script src="/js/tracking.js" defer></script>
 *
 * O GA4 (gtag.js) continua sendo carregado inline em cada pagina; aqui
 * so disparamos eventos nele quando ele existir.
 *
 * Eventos enviados ao Meta:
 *   PageView         — toda pagina
 *   ViewContent      — paginas de livro (/livros/*.html)
 *   InitiateCheckout — clique em link de loja (Amazon, Mercado Livre, Hotmart)
 *   Lead             — chamado por quem quiser via window.RBTrack.lead()
 *
 * Purchase NAO e disparado aqui de proposito: a compra acontece fora do
 * site (Amazon / Mercado Livre / Hotmart), entao esta pagina nunca fica
 * sabendo dela. Ver README_TRACKING.md.
 */
(function () {
  'use strict';

  var PIXEL_ID = '2570806596755923'; // "HVNR Tracking"

  var LIVROS = {
    B0H59NTYV9: 'Homem, Voce Nao E Ridiculo',
    B0GXSNXT3J: 'Amanha E Outro Agora',
    B0H66VZDN4: 'O Poder da Decisao'
  };

  // Dominios que significam "foi comprar"
  var LOJAS = ['amazon.com.br', 'mercadolivre.com.br', 'mercadolibre.com', 'pay.hotmart.com', 'hotmart.com'];

  // ---------------------------------------------------------------- pixel
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  // <noscript> equivalente, para quem bloqueia JS nao ficamos sem nada a fazer.
  // (o img beacon so faz sentido sem JS, e aqui JS ja rodou — omitido de proposito)

  function ga(evento, params) {
    if (typeof window.gtag === 'function') window.gtag('event', evento, params || {});
  }

  // --------------------------------------------------------- ViewContent
  // Toda pagina de livro conta como visualizacao de produto.
  var path = window.location.pathname;
  if (/^\/livros\/[^/]+\.html$/.test(path)) {
    var titulo = (document.title || '').split('|')[0].trim();
    fbq('track', 'ViewContent', {
      content_name: titulo,
      content_type: 'product',
      content_category: 'livro'
    });
    ga('view_item', { item_name: titulo });
  }

  // ---------------------------------------------------- InitiateCheckout
  function ehLoja(href) {
    if (!href) return false;
    for (var i = 0; i < LOJAS.length; i++) {
      if (href.indexOf(LOJAS[i]) !== -1) return true;
    }
    return false;
  }

  function nomeDoLivro(href, texto) {
    var m = href.match(/dp\/([A-Z0-9]+)/);
    if (m && LIVROS[m[1]]) return LIVROS[m[1]];
    return (texto || '').trim().slice(0, 80) || 'desconhecido';
  }

  function loja(href) {
    if (href.indexOf('amazon') !== -1) return 'amazon';
    if (href.indexOf('mercado') !== -1) return 'mercado-livre';
    if (href.indexOf('hotmart') !== -1) return 'hotmart';
    return 'outra';
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a || !ehLoja(a.href)) return;

    var livro = nomeDoLivro(a.href, a.textContent);
    var origem = loja(a.href);

    fbq('track', 'InitiateCheckout', {
      content_name: livro,
      content_category: origem,
      content_type: 'product'
    });
    ga('begin_checkout', { item_name: livro, loja: origem });
  }, true);

  // ------------------------------------------------------------- API
  // Para o teste das mascaras e outros formularios chamarem no fim:
  //   window.RBTrack.lead('teste-das-mascaras');
  window.RBTrack = {
    lead: function (nome) {
      fbq('track', 'Lead', { content_name: nome || 'lead' });
      ga('generate_lead', { origem: nome || 'lead' });
    },
    completeRegistration: function (nome) {
      fbq('track', 'CompleteRegistration', { content_name: nome || 'registro' });
      ga('sign_up', { origem: nome || 'registro' });
    }
  };
})();
