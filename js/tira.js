/* A tira que alterna entre as ferramentas.
 *
 * O HTML ja traz uma chamada de verdade escrita a mao. Este script troca por
 * outra da lista em js/tiras.json — entao quem estiver sem JavaScript, ou
 * quem chegar antes de o arquivo carregar, ve uma tira valida do mesmo jeito.
 *
 * Sorteia evitando repetir a ultima que apareceu: com sorteio puro, em sete
 * itens, a mesma tira voltava na visita seguinte com frequencia incomoda.
 */
(function () {
  'use strict';

  var DADOS = '/js/tiras.json';
  var CHAVE = 'rb-tira';          // guarda so o indice da ultima mostrada

  function ultima() {
    try { return Number(localStorage.getItem(CHAVE)); } catch (e) { return NaN; }
  }
  function guardar(i) {
    try { localStorage.setItem(CHAVE, String(i)); } catch (e) {}
  }

  function escolher(total) {
    if (total <= 1) return 0;
    var anterior = ultima();
    var i = Math.floor(Math.random() * total);
    if (i === anterior) i = (i + 1) % total;   // nunca a mesma duas vezes
    return i;
  }

  function pintar(el, t) {
    var selo = el.querySelector('.tira-selo');
    var txt = el.querySelector('.tira-txt');
    if (!selo || !txt || !t.url || !t.texto) return false;
    el.href = t.url;
    selo.textContent = t.selo || 'Grátis';
    txt.textContent = t.texto;
    return true;
  }

  var tiras = document.querySelectorAll('[data-tira]');
  if (!tiras.length) return;

  fetch(DADOS, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var lista = (d && d.tiras) || [];
      lista = lista.filter(function (t) { return t && t.url && t.texto; });

      // Lista vazia: some com a tira. Melhor faltar do que ficar uma
      // chamada vazia no meio da pagina.
      if (!lista.length) {
        Array.prototype.forEach.call(tiras, function (el) { el.hidden = true; });
        return;
      }

      var i = escolher(lista.length);
      guardar(i);

      Array.prototype.forEach.call(tiras, function (el) {
        if (!pintar(el, lista[i])) return;
        el.addEventListener('click', function () {
          if (typeof gtag === 'function') {
            gtag('event', 'tira_clique', {
              ferramenta: lista[i].url, chamada: lista[i].texto
            });
          }
        });
        i = (i + 1) % lista.length;   // duas tiras na mesma pagina nao repetem
      });
    })
    .catch(function () {
      /* Sem o arquivo, fica a chamada escrita no HTML. Nada a fazer. */
    });
})();
