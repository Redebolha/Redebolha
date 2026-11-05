/*
 * Vitrine — a faixa de livros no topo das paginas.
 *
 * Um livro por vez, girando como carrossel, logo abaixo do menu. Os livros
 * mantem o site: a faixa e o anuncio deles, e por isso leva o selo
 * "Patrocinio" (mesma regra de honestidade do js/patrocinio.js).
 *
 * Os livros, os textos e o tempo de cada um ficam em js/patrocinadores.json,
 * na chave "vitrine". Para trocar, edite so o JSON: nenhum HTML muda.
 *
 * Acessibilidade: botao de pausar (gira sozinho so com movimento liberado),
 * pausa com o mouse em cima ou com o foco dentro, e para quando a aba some.
 * Quem pediu "reduzir movimento" no aparelho ve a faixa parada.
 *
 * Carregado pelo js/patrocinio.js, entao vale em todas as paginas que ja
 * tem o patrocinio. Nao aparece na capa (ela tem a secao "Nossos livros").
 */
(function () {
  'use strict';

  if (location.pathname === '/' || location.pathname === '/index.html') return;
  if (document.querySelector('.rb-vitrine')) return;

  var DADOS = '/js/patrocinadores.json';

  var CSS = [
    '.rb-vitrine{background:#071332;border-bottom:1px solid rgba(255,223,0,.28);color:#EEF2F8;font-family:inherit}',
    '.rb-vitrine-in{max-width:1100px;margin:0 auto;padding:8px 16px;display:flex;align-items:center;gap:12px;min-height:64px}',
    '.rb-vitrine-selo{flex:none;font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:#8b9694}',
    '.rb-vitrine-palco{flex:1;min-width:0;position:relative}',
    '.rb-vitrine-slide{display:none;align-items:center;gap:12px;text-decoration:none;color:inherit;border-radius:6px;padding:2px 4px}',
    '.rb-vitrine-slide.ativo{display:flex}',
    '.rb-vitrine.anima .rb-vitrine-slide.ativo{animation:rbVitrine .45s ease}',
    '@keyframes rbVitrine{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
    '.rb-vitrine-slide:hover .rb-vitrine-cta,.rb-vitrine-slide:focus-visible .rb-vitrine-cta{text-decoration:underline}',
    '.rb-vitrine-slide img{flex:none;width:34px;height:auto;border-radius:2px;box-shadow:0 4px 12px rgba(0,0,0,.5)}',
    '.rb-vitrine-txt{display:flex;flex-direction:column;min-width:0;line-height:1.25}',
    '.rb-vitrine-tit{font-weight:700;font-size:.98rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rb-vitrine-frase{font-size:.84rem;color:#c6ccca;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rb-vitrine-preco{flex:none;margin-left:auto;font-size:.78rem;color:#c6ccca;text-align:right;line-height:1.2}',
    '.rb-vitrine-preco b{display:block;font-size:1.05rem;color:#FFDF00}',
    '.rb-vitrine-cta{flex:none;font-size:.8rem;font-weight:700;color:#071332;background:#FFDF00;border-radius:999px;padding:7px 14px;white-space:nowrap}',
    '.rb-vitrine-ctl{flex:none;display:flex;gap:4px}',
    '.rb-vitrine-ctl button{width:34px;height:34px;display:grid;place-items:center;border:1px solid rgba(255,223,0,.4);border-radius:8px;background:transparent;color:#FFDF00;cursor:pointer;padding:0}',
    '.rb-vitrine-ctl button:hover{background:rgba(255,223,0,.12)}',
    '.rb-vitrine-ctl button:focus-visible,.rb-vitrine-slide:focus-visible{outline:3px solid #FFDF00;outline-offset:2px}',
    '.rb-vitrine-pontos{position:absolute;left:4px;bottom:-7px;display:flex;gap:4px}',
    '.rb-vitrine-pontos i{width:14px;height:3px;border-radius:2px;background:rgba(255,255,255,.25)}',
    '.rb-vitrine-pontos i.ativo{background:#FFDF00}',
    '@media(max-width:760px){.rb-vitrine-frase,.rb-vitrine-selo{display:none}.rb-vitrine-cta{padding:6px 10px}}',
    '@media(max-width:480px){.rb-vitrine-in{gap:8px;padding:6px 10px}.rb-vitrine-cta{display:none}.rb-vitrine-ctl .rb-vitrine-ant{display:none}.rb-vitrine-ctl button{width:40px;height:40px}',
    '  .rb-vitrine-tit{font-size:.9rem;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}}',
    '@media(prefers-reduced-motion:reduce){.rb-vitrine.anima .rb-vitrine-slide.ativo{animation:none}}'
  ].join('\n');

  var ICO = {
    ant: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    prox: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    pausa: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>',
    tocar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>'
  };

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }

  function medir(nome, livro) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', nome, { livro: livro, formato: 'vitrine', tema: document.body.getAttribute('data-tema') || '(sem tema)' });
  }

  /* Onde a faixa entra: logo abaixo do cabecalho do site */
  function ancora() {
    return document.querySelector('body > header') || document.querySelector('header');
  }

  function montar(cfg) {
    var V = cfg.vitrine, L = cfg.livros || {};
    if (!V || !V.itens || !V.itens.length) return;
    var itens = V.itens.filter(function (i) { return L[i.livro]; });
    if (!itens.length) return;
    var alvo = ancora(); if (!alvo) return;

    if (!document.getElementById('rb-vitrine-css')) {
      var st = el('style'); st.id = 'rb-vitrine-css'; st.textContent = CSS; document.head.appendChild(st);
    }

    var box = el('aside', 'rb-vitrine');
    box.setAttribute('aria-roledescription', 'carrossel');
    box.setAttribute('aria-label', V.rotulo || 'Livros de Adm. Romário Cruz');
    var inn = el('div', 'rb-vitrine-in');
    inn.appendChild(el('span', 'rb-vitrine-selo', V.selo || 'Patrocínio'));
    var palco = el('div', 'rb-vitrine-palco');
    palco.setAttribute('aria-live', 'off');
    var pontos = el('div', 'rb-vitrine-pontos'); pontos.setAttribute('aria-hidden', 'true');

    var slides = itens.map(function (it, n) {
      var lv = L[it.livro];
      var a = el('a', 'rb-vitrine-slide');
      a.href = it.destino || lv.destino;
      a.setAttribute('role', 'group');
      a.setAttribute('aria-roledescription', 'slide');
      a.setAttribute('aria-label', (n + 1) + ' de ' + itens.length + ': ' + lv.titulo + ', ' + (it.formato || 'E-book') + ' ' + (it.preco || ''));
      var capa = it.capa || lv.capa;
      if (capa) { var img = el('img'); img.src = capa; img.alt = ''; img.width = 34; img.decoding = 'async'; a.appendChild(img); }
      var t = el('span', 'rb-vitrine-txt');
      t.appendChild(el('span', 'rb-vitrine-tit', lv.titulo));
      if (it.frase) t.appendChild(el('span', 'rb-vitrine-frase', it.frase));
      a.appendChild(t);
      if (it.preco) { var p = el('span', 'rb-vitrine-preco', it.formato || 'E-book'); p.appendChild(el('b', '', it.preco)); a.appendChild(p); }
      a.appendChild(el('span', 'rb-vitrine-cta', (it.acao || 'Conheça o livro') + ' →'));
      a.addEventListener('click', function () { medir('patrocinio_click', it.livro); });
      palco.appendChild(a);
      pontos.appendChild(el('i'));
      return a;
    });
    palco.appendChild(pontos);
    inn.appendChild(palco);

    var ctl = el('div', 'rb-vitrine-ctl');
    var bAnt = el('button', 'rb-vitrine-ant'); bAnt.type = 'button'; bAnt.innerHTML = ICO.ant; bAnt.setAttribute('aria-label', 'Livro anterior');
    var bPau = el('button', 'rb-vitrine-pausa'); bPau.type = 'button';
    var bPro = el('button', 'rb-vitrine-prox'); bPro.type = 'button'; bPro.innerHTML = ICO.prox; bPro.setAttribute('aria-label', 'Próximo livro');
    if (itens.length > 1) { ctl.appendChild(bAnt); ctl.appendChild(bPau); ctl.appendChild(bPro); inn.appendChild(ctl); }
    box.appendChild(inn);
    /* A margem de baixo do cabecalho passa para baixo da faixa (sem buraco entre os dois) */
    var mb = parseFloat(getComputedStyle(alvo).marginBottom) || 0;
    if (mb > 0) { box.style.marginBottom = mb + 'px'; alvo.style.marginBottom = '0'; }
    alvo.parentNode.insertBefore(box, alvo.nextSibling);

    /* Primeiro livro: o do tema da pagina, se estiver na faixa */
    var tema = document.body.getAttribute('data-tema') || '';
    var doTema = (cfg.temas || {})[tema] || cfg.padrao;
    var i = Math.max(0, itens.map(function (x) { return x.livro; }).indexOf(doTema));
    var parado = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pausadoUsuario = parado, sobre = false, timer = null;
    var tempo = Math.max(4, Number(V.intervalo_segundos) || 6) * 1000;
    var vistos = {};

    function mostrar(n, manual) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('ativo', k === i); });
      Array.prototype.forEach.call(pontos.children, function (p, k) { p.classList.toggle('ativo', k === i); });
      palco.setAttribute('aria-live', manual ? 'polite' : 'off');
      if (!vistos[i] && visivel) { vistos[i] = true; medir('patrocinio_view', itens[i].livro); }
    }
    function pintarPausa() {
      bPau.innerHTML = pausadoUsuario ? ICO.tocar : ICO.pausa;
      bPau.setAttribute('aria-label', pausadoUsuario ? 'Continuar a troca dos livros' : 'Pausar a troca dos livros');
      bPau.setAttribute('aria-pressed', pausadoUsuario ? 'true' : 'false');
    }
    function agendar() {
      clearInterval(timer); timer = null;
      if (slides.length < 2 || pausadoUsuario || sobre || document.hidden) return;
      timer = setInterval(function () { mostrar(i + 1, false); }, tempo);
    }

    var visivel = !('IntersectionObserver' in window);
    if (!visivel) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { visivel = e.isIntersecting; if (visivel && !vistos[i]) { vistos[i] = true; medir('patrocinio_view', itens[i].livro); } });
      }, { threshold: 0.5 }).observe(box);
    }

    bAnt.addEventListener('click', function () { mostrar(i - 1, true); agendar(); });
    bPro.addEventListener('click', function () { mostrar(i + 1, true); agendar(); });
    bPau.addEventListener('click', function () { pausadoUsuario = !pausadoUsuario; pintarPausa(); agendar(); });
    box.addEventListener('mouseenter', function () { sobre = true; agendar(); });
    box.addEventListener('mouseleave', function () { sobre = false; agendar(); });
    box.addEventListener('focusin', function () { sobre = true; agendar(); });
    box.addEventListener('focusout', function (e) { if (!box.contains(e.relatedTarget)) { sobre = false; agendar(); } });
    document.addEventListener('visibilitychange', agendar);

    pintarPausa();
    mostrar(i, false);
    box.classList.add('anima');
    agendar();
  }

  function comecar() {
    fetch(DADOS, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { if (cfg) montar(cfg); })
      .catch(function () { /* sem faixa e melhor que pagina quebrada */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar);
  else comecar();
})();
