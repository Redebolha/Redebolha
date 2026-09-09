/* ==========================================================================
   Rede Bolha — origem do clique nos botões de compra
   --------------------------------------------------------------------------
   Sem isso, toda venda chega na Hotmart marcada como "site_oferta", venha da
   bio do Instagram, de um Reel, do WhatsApp ou de um anúncio. Fica impossível
   saber o que vendeu.

   Com isso, basta acrescentar ?de=algumacoisa no fim do endereço da página:

     redebolha.com.br/oferta/?de=ig_bio        -> Hotmart recebe src=ig_bio
     redebolha.com.br/oferta/?de=ig_reels      -> Hotmart recebe src=ig_reels
     redebolha.com.br/oferta/?de=whats         -> Hotmart recebe src=whats

   Aí, no relatório da Hotmart, cada venda mostra de onde veio. Sem o ?de=,
   nada muda: continua valendo o src que já está escrito no link.
   ========================================================================== */
(function () {
  'use strict';

  var CHAVE = 'rb_origem';

  function limpa(v) {
    /* só letras, números e _ — evita sujeira e link quebrado */
    return String(v || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 30);
  }

  var achou = (window.location.search || '').match(/[?&]de=([^&#]+)/);
  var origem = achou ? limpa(decodeURIComponent(achou[1])) : '';

  /* A pessoa chega pela bio na home e só depois vai para a página do livro.
     Sem guardar, o ?de= morre no primeiro clique e a venda volta a aparecer
     como origem genérica. Guardamos pela visita (sessionStorage), então a
     marca acompanha ela pelo site e some quando ela fecha o navegador. */
  try {
    if (origem) window.sessionStorage.setItem(CHAVE, origem);
    else origem = limpa(window.sessionStorage.getItem(CHAVE));
  } catch (e) {
    /* navegador com armazenamento bloqueado: segue só com o da URL */
  }

  if (!origem) return;

  var links = document.querySelectorAll('a[href*="go.hotmart.com"], a[href*="pay.hotmart.com"]');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href');
    links[i].setAttribute('href',
      /[?&]src=/.test(href) ? href.replace(/([?&]src=)[^&#]*/, '$1' + origem)
                            : href + (href.indexOf('?') === -1 ? '?' : '&') + 'src=' + origem);
  }

  try {
    if (typeof gtag === 'function') {
      gtag('event', 'origem_marcada', { origem: origem, page_path: location.pathname });
    }
  } catch (e) {}
})();
