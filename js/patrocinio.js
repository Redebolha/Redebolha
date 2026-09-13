/*
 * Patrocinio — o "ad server" da Rede Bolha.
 *
 * O site nao vende mais na home: os livros passam a patrocinar o conteudo.
 * Este script cuida de tres coisas, em uma pagina so:
 *
 *   1. ROTULA   — todo convite a um livro ganha o selo "Patrocinio". E a
 *                 honestidade do formato que faz ele funcionar: o leitor
 *                 baixa a guarda quando sabe o que esta vendo.
 *   2. VEICULA  — paginas sem convite recebem o livro certo para o assunto
 *                 delas, lido de js/patrocinadores.json.
 *   3. MEDE     — dispara patrocinio_view e patrocinio_click no GA4, com o
 *                 nome do livro e o tema, para responder "qual assunto vende
 *                 qual livro".
 *
 * Regra de inventario: no maximo UMA unidade de livro por pagina. Se a pagina
 * ja tem um convite escrito a mao, o script respeita o texto e so rotula e
 * mede — nao empilha outro.
 *
 * Para trocar campanha, edite js/patrocinadores.json. Nenhum HTML muda.
 */
(function () {
  'use strict';

  var DADOS = '/js/patrocinadores.json';

  /* ---------------------------------------------------------------- CSS ---
     Vai no JS de proposito: o site tem dois sistemas visuais (blog.css nos
     artigos, estilo embutido na home) e a unidade precisa ficar igual nos
     dois. Assim existe um lugar so para mexer.                            */
  var CSS = [
    '.rb-patrocinio{margin:2.6rem 0;max-width:100%}',
    '.rb-patrocinio-selo{display:flex;align-items:center;gap:10px;margin:0 0 12px;',
    '  font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;',
    '  color:#8b9694;font-family:inherit}',
    '.rb-patrocinio-selo::after{content:"";flex:1;height:1px;background:currentColor;opacity:.25}',
    '.rb-patrocinio-card{display:flex;gap:18px;align-items:center;text-decoration:none;',
    '  border:1px solid rgba(201,162,75,.28);border-radius:3px;padding:16px;',
    '  background:rgba(255,255,255,.02);transition:border-color .2s,background .2s}',
    '.rb-patrocinio-card:hover{border-color:rgba(201,162,75,.65);background:rgba(201,162,75,.05)}',
    '.rb-patrocinio-card img{width:66px;flex:0 0 auto;border-radius:2px;display:block;',
    '  box-shadow:0 6px 18px rgba(0,0,0,.45)}',
    '.rb-patrocinio-texto{display:flex;flex-direction:column;gap:6px;min-width:0}',
    '.rb-patrocinio-frase{font-size:.95rem;line-height:1.4;color:#c6ccca}',
    '.rb-patrocinio-titulo{font-size:1.05rem;line-height:1.25;color:#eceae3;font-weight:600}',
    '.rb-patrocinio-acao{font-size:.8rem;color:#c9a24b;letter-spacing:.04em}',
    '@media(max-width:520px){',
    '  .rb-patrocinio-card{gap:14px;padding:14px}',
    '  .rb-patrocinio-card img{width:52px}',
    '  .rb-patrocinio-titulo{font-size:.98rem}',
    '}'
  ].join('\n');

  function injetarCSS() {
    if (document.getElementById('rb-patrocinio-css')) return;
    var s = document.createElement('style');
    s.id = 'rb-patrocinio-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------ medicao ---
     patrocinio_view so dispara quando a unidade entra mesmo na tela — contar
     impressao de algo que ninguem rolou ate ver estragaria o CTR.          */
  function medir(el, livro, tema) {
    function enviar(nome) {
      if (typeof window.gtag !== 'function') return;
      window.gtag('event', nome, { livro: livro, tema: tema });
    }

    if ('IntersectionObserver' in window) {
      var visto = false;
      var obs = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting && !visto) {
            visto = true;
            enviar('patrocinio_view');
            obs.disconnect();
          }
        });
      }, { threshold: 0.5 });
      obs.observe(el);
    } else {
      enviar('patrocinio_view');
    }

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('a')) enviar('patrocinio_click');
    });
  }

  /* ------------------------------------------------------------- rotulo ---
     Convites escritos a mao ja tem texto sob medida para o artigo. Bom texto
     nao se joga fora: aqui so entra o selo e a medicao.                    */
  function rotular(bloco, livro, tema) {
    if (bloco.querySelector('.rb-patrocinio-selo')) return;
    var selo = document.createElement('p');
    selo.className = 'rb-patrocinio-selo';
    selo.textContent = 'Patrocínio';
    bloco.insertBefore(selo, bloco.firstChild);
    bloco.classList.add('rb-patrocinado');
    medir(bloco, livro, tema);
  }

  /* ------------------------------------------------------------ unidade ---*/
  function montar(livro, chave) {
    var aside = document.createElement('aside');
    aside.className = 'rb-patrocinio';
    aside.setAttribute('data-livro', chave);

    var selo = document.createElement('p');
    selo.className = 'rb-patrocinio-selo';
    selo.textContent = livro.selo || 'Patrocínio';
    aside.appendChild(selo);

    var card = document.createElement('a');
    card.className = 'rb-patrocinio-card';
    card.href = livro.destino;
    if (/^https?:/.test(livro.destino)) {
      card.rel = 'noopener';
      card.target = '_blank';
    }

    if (livro.capa) {
      var img = document.createElement('img');
      img.src = livro.capa;
      img.alt = 'Capa do livro ' + livro.titulo;
      img.loading = 'lazy';
      img.decoding = 'async';
      card.appendChild(img);
    }

    var txt = document.createElement('span');
    txt.className = 'rb-patrocinio-texto';
    [['rb-patrocinio-frase', livro.frase],
     ['rb-patrocinio-titulo', livro.titulo],
     ['rb-patrocinio-acao', livro.acao + ' →']].forEach(function (par) {
      var s = document.createElement('span');
      s.className = par[0];
      s.textContent = par[1];
      txt.appendChild(s);
    });

    card.appendChild(txt);
    aside.appendChild(card);
    return aside;
  }

  /* Onde a unidade entra: depois do conteudo, nunca antes. O leitor precisa
     receber alguma coisa antes de ser convidado.
     Sem <article>/<main> e sem ponto marcado, a unidade nao entra — melhor
     nenhuma do que uma no lugar errado (dentro do menu, por exemplo).      */
  function ancora() {
    var marcado = document.querySelector('[data-patrocinio]');
    if (marcado) return marcado;
    return document.querySelector('article') || document.querySelector('main');
  }

  function jaTemConvite() {
    var blocos = document.querySelectorAll('.cta');
    for (var i = 0; i < blocos.length; i++) {
      if (blocos[i].querySelector('a[href*="/livros/"]')) return blocos[i];
    }
    return null;
  }

  function iniciar(cfg) {
    var tema = document.body.getAttribute('data-tema') || '';
    var chave = cfg.temas[tema] || cfg.padrao;
    var livro = cfg.livros[chave];
    if (!livro) return;

    injetarCSS();

    var existente = jaTemConvite();
    if (existente) {            // respeita o texto sob medida
      rotular(existente, chave, tema || '(sem tema)');
      return;
    }

    var alvo = ancora();
    if (!alvo) return;
    var unidade = montar(livro, chave);
    alvo.appendChild(unidade);
    medir(unidade, chave, tema || '(sem tema)');
  }

  function comecar() {
    fetch(DADOS, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { if (cfg) iniciar(cfg); })
      .catch(function () { /* sem patrocinio e melhor que pagina quebrada */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', comecar);
  } else {
    comecar();
  }
})();
