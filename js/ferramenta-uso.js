/*
 * ferramenta_uso — mede o que as ferramentas realmente fazem.
 *
 * Pageview nao diz nada sobre uma calculadora: a pessoa pode abrir e sair sem
 * mexer. O que importa e se ela USOU. Entao o evento dispara uma unica vez por
 * pagina, quando o visitante mexe no primeiro campo.
 *
 * Dispara tambem ferramenta_abrir nos cartoes do hub, para dar o outro lado da
 * conta: quantos abrem versus quantos usam.
 *
 * Nenhum valor digitado e enviado — so o fato de ter havido uso. Nao ha por que
 * mandar a meta financeira de ninguem para o Google.
 */
(function () {
  'use strict';

  function enviar(nome, dados) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', nome, dados);
  }

  /* Qual ferramenta e esta pagina: o titulo e o nome que o leitor ve. */
  function nomeDaFerramenta() {
    var h1 = document.querySelector('h1');
    var t = (h1 && (h1.innerText || h1.textContent)) || document.title || '';
    return t.replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  /* ------------------------------------------------------------- uso ---- */
  var campos = document.querySelectorAll(
    'input[type="number"], input[type="range"], input[type="text"], select'
  );

  if (campos.length) {
    var jaContou = false;
    var marcar = function () {
      if (jaContou) return;
      jaContou = true;
      enviar('ferramenta_uso', {
        ferramenta: nomeDaFerramenta(),
        caminho: location.pathname
      });
      campos.forEach(function (c) {
        c.removeEventListener('input', marcar);
        c.removeEventListener('change', marcar);
      });
    };

    campos.forEach(function (c) {
      c.addEventListener('input', marcar, { passive: true });
      c.addEventListener('change', marcar, { passive: true });
    });
  }

  /* ---------------------------------------------------------- abrir ----- */
  document.querySelectorAll('[data-ferramenta]').forEach(function (card) {
    card.addEventListener('click', function () {
      enviar('ferramenta_abrir', {
        ferramenta: card.getAttribute('data-ferramenta'),
        origem: location.pathname
      });
    });
  });
})();
