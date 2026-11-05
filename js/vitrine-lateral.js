/*
 * Vitrine lateral — banner vertical de livros, no lado direito da tela.
 *
 * Um livro por vez, girando: os 3 e-books e o livro fisico. Leva o selo
 * "Patrocinio" (mesma regra de honestidade do js/patrocinio.js).
 * Os itens ficam em js/patrocinadores.json, na chave "lateral".
 *
 * SO APARECE ONDE FICA BEM:
 *   - tela larga e alta o bastante;
 *   - sobra espaco livre a direita do conteudo da pagina (o script mede o
 *     texto, imagens e graficos de verdade, nao um numero fixo);
 *   - some enquanto outro anuncio de livro esta na tela (faixa do topo,
 *     patrocinio do fim do texto, secao "Nossos livros" da capa) e quando o
 *     rodape aparece, para nunca empilhar nem cobrir nada;
 *   - o leitor pode fechar no X: fica fechado ate fechar a aba.
 *
 * Acessibilidade: botao de pausar, pausa com mouse ou foco em cima, para
 * quando a aba some, e fica parado para quem pediu "reduzir movimento".
 *
 * Carregado pelo js/patrocinio.js e pelo js/newsletter.js.
 */
(function () {
  'use strict';

  var FORA = /^\/(acessibilidade-rs|admin|livros|oferta)(\/|$)|^\/offline\.html$|^\/404\.html$/;
  if (FORA.test(location.pathname)) return;
  if (window.__rbLateral) return;
  window.__rbLateral = true;

  var DADOS = '/js/patrocinadores.json';
  var LARG = 176;          // largura do banner (px)
  var FOLGA = 20;          // espaco minimo entre o conteudo e o banner (px)
  var CHAVE_FECHADO = 'rb-lateral-fechado';

  try { if (sessionStorage.getItem(CHAVE_FECHADO) === '1') return; } catch (e) {}

  var CSS = [
    '.rb-lateral,.rb-lateral *{box-sizing:border-box}',
    '.rb-lateral{font-family:Inter,"Atkinson Hyperlegible Next",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif!important;letter-spacing:normal;text-transform:none}',
    '.rb-lateral *{font-family:inherit!important}',
    '.rb-lateral{position:fixed;z-index:40;top:50%;width:' + LARG + 'px;transform:translateY(-50%);',
    '  background:#071332;border:1px solid rgba(255,223,0,.35);border-radius:14px;padding:12px 12px 10px;',
    '  color:#EEF2F8;font-family:inherit;box-shadow:0 18px 40px rgba(0,0,0,.5);',
    '  transition:opacity .25s,visibility .25s}',
    '.rb-lateral[hidden]{display:none}',
    '.rb-lateral.escondido{opacity:0;visibility:hidden;pointer-events:none}',
    '.rb-lateral-topo{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px}',
    '.rb-lateral .rb-lateral-selo{font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:#8b9694}',
    '.rb-lateral-x{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:#c6ccca;cursor:pointer;font-size:1.1rem;line-height:1;padding:0}',
    '.rb-lateral-x:hover{background:rgba(255,255,255,.1)}',
    '.rb-lateral-slide{display:none;flex-direction:column;align-items:center;text-align:center;gap:6px;text-decoration:none;color:inherit;border-radius:8px}',
    '.rb-lateral-slide.ativo{display:flex}',
    '.rb-lateral.anima .rb-lateral-slide.ativo{animation:rbLateral .45s ease}',
    '@keyframes rbLateral{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.rb-lateral-capa{position:relative;width:118px;margin:2px 0 4px}',
    '.rb-lateral-capa img{display:block;width:100%;height:auto;border-radius:3px;box-shadow:0 10px 24px rgba(0,0,0,.55)}',
    '.rb-lateral .rb-lateral-fmt{font-size:.62rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#4BE08C}',
    '.rb-lateral .rb-lateral-fmt.fisico{color:#071332;background:#FFDF00;border-radius:999px;padding:2px 8px}',
    '.rb-lateral-tit{font-weight:700;font-size:.92rem;line-height:1.2}',
    '.rb-lateral-preco{font-size:1.25rem;font-weight:800;color:#FFDF00;line-height:1}',
    '.rb-lateral-extra{font-size:.72rem;color:#c6ccca;line-height:1.25}',
    '.rb-lateral-cta{margin-top:4px;font-size:.78rem;font-weight:800;color:#071332;background:#FFDF00;border-radius:999px;padding:7px 12px}',
    '.rb-lateral-slide:hover .rb-lateral-cta,.rb-lateral-slide:focus-visible .rb-lateral-cta{background:#FFE566}',
    '.rb-lateral-pe{display:flex;align-items:center;justify-content:space-between;margin-top:10px}',
    '.rb-lateral-pontos{display:flex;gap:4px}',
    '.rb-lateral-pontos i{width:12px;height:3px;border-radius:2px;background:rgba(255,255,255,.25)}',
    '.rb-lateral-pontos i.ativo{background:#FFDF00}',
    '.rb-lateral-ctl{display:flex;gap:3px}',
    '.rb-lateral-ctl button{width:28px;height:28px;display:grid;place-items:center;border:1px solid rgba(255,223,0,.4);border-radius:7px;background:transparent;color:#FFDF00;cursor:pointer;padding:0}',
    '.rb-lateral-ctl button:hover{background:rgba(255,223,0,.12)}',
    '.rb-lateral button:focus-visible,.rb-lateral-slide:focus-visible{outline:3px solid #FFDF00;outline-offset:2px}',
    '@media(prefers-reduced-motion:reduce){.rb-lateral,.rb-lateral.anima .rb-lateral-slide.ativo{transition:none;animation:none}}',
    '@media print{.rb-lateral{display:none!important}}'
  ].join('\n');

  var ICO = {
    ant: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    prox: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    pausa: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>',
    tocar: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>'
  };

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function medir(nome, livro) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', nome, { livro: livro, formato: 'lateral', tema: document.body.getAttribute('data-tema') || '(sem tema)' });
  }

  /* ---- Quanto espaco sobra a direita do conteudo ----
     Mede texto, imagens, graficos e campos de verdade, ignorando cabecalho,
     menu, rodape, elementos fixos e os proprios anuncios. */
  var IGNORA = 'header,nav,footer,.rb-lateral,.rb-vitrine,[aria-hidden="true"]';
  function bordaDoConteudo() {
    var max = 0;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (n.matches(IGNORA)) return NodeFilter.FILTER_REJECT;
          var cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return NodeFilter.FILTER_REJECT;
          return /^(IMG|SVG|CANVAS|VIDEO|IFRAME|INPUT|SELECT|TEXTAREA|BUTTON|TABLE|PICTURE)$/i.test(n.tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
        return /\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var r = document.createRange(), n, b;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { r.selectNodeContents(n); b = r.getBoundingClientRect(); }
      else b = n.getBoundingClientRect();
      if (b.width && b.right > max && b.right <= window.innerWidth + 2) max = b.right;
    }
    return max;
  }

  function montar(cfg) {
    var V = cfg.lateral, L = cfg.livros || {};
    if (!V || !V.itens || !V.itens.length) return;
    var itens = V.itens.filter(function (i) { return L[i.livro]; });
    if (!itens.length) return;

    if (!document.getElementById('rb-lateral-css')) { var st = el('style'); st.id = 'rb-lateral-css'; st.textContent = CSS; document.head.appendChild(st); }

    var box = el('aside', 'rb-lateral');
    box.hidden = true;
    box.setAttribute('aria-roledescription', 'carrossel');
    box.setAttribute('aria-label', V.rotulo || 'Livros de Adm. Romário Cruz');

    var topo = el('div', 'rb-lateral-topo');
    topo.appendChild(el('span', 'rb-lateral-selo', V.selo || 'Patrocínio'));
    var bX = el('button', 'rb-lateral-x', '×'); bX.type = 'button'; bX.setAttribute('aria-label', 'Fechar o anúncio de livros');
    topo.appendChild(bX);
    box.appendChild(topo);

    var palco = el('div', 'rb-lateral-palco'); palco.setAttribute('aria-live', 'off');
    var slides = itens.map(function (it, n) {
      var lv = L[it.livro], fisico = /f[ií]sico/i.test(it.formato || '');
      var a = el('a', 'rb-lateral-slide');
      a.href = it.destino || lv.destino;
      a.setAttribute('role', 'group');
      a.setAttribute('aria-roledescription', 'slide');
      a.setAttribute('aria-label', (n + 1) + ' de ' + itens.length + ': ' + lv.titulo + ', ' + (it.formato || 'E-book') + ', ' + (it.preco || '') + (it.extra ? ' ' + it.extra : ''));
      var capa = it.capa || lv.capa;
      if (capa) { var c = el('span', 'rb-lateral-capa'); var img = el('img'); img.src = capa; img.alt = ''; img.decoding = 'async'; img.loading = n ? 'lazy' : 'eager'; c.appendChild(img); a.appendChild(c); }
      a.appendChild(el('span', 'rb-lateral-fmt' + (fisico ? ' fisico' : ''), it.formato || 'E-book'));
      a.appendChild(el('span', 'rb-lateral-tit', lv.titulo));
      if (it.preco) a.appendChild(el('span', 'rb-lateral-preco', it.preco));
      if (it.extra) a.appendChild(el('span', 'rb-lateral-extra', it.extra));
      a.appendChild(el('span', 'rb-lateral-cta', (it.acao || 'Conheça o livro') + ' →'));
      a.addEventListener('click', function () { medir('patrocinio_click', it.livro + (fisico ? '_fisico' : '')); });
      palco.appendChild(a);
      return a;
    });
    box.appendChild(palco);

    var pe = el('div', 'rb-lateral-pe');
    var pontos = el('div', 'rb-lateral-pontos'); pontos.setAttribute('aria-hidden', 'true');
    itens.forEach(function () { pontos.appendChild(el('i')); });
    var ctl = el('div', 'rb-lateral-ctl');
    var bAnt = el('button'); bAnt.type = 'button'; bAnt.innerHTML = ICO.ant; bAnt.setAttribute('aria-label', 'Livro anterior');
    var bPau = el('button'); bPau.type = 'button';
    var bPro = el('button'); bPro.type = 'button'; bPro.innerHTML = ICO.prox; bPro.setAttribute('aria-label', 'Próximo livro');
    ctl.appendChild(bAnt); ctl.appendChild(bPau); ctl.appendChild(bPro);
    pe.appendChild(pontos); pe.appendChild(ctl);
    if (itens.length > 1) box.appendChild(pe);
    document.body.appendChild(box);

    /* ---- Carrossel ---- */
    var i = 0, parado = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pausado = parado, sobre = false, timer = null, vistos = {}, mostrando = false;
    var tempo = Math.max(4, Number(V.intervalo_segundos) || 7) * 1000;
    function chave(k) { return itens[k].livro + (/f[ií]sico/i.test(itens[k].formato || '') ? '_fisico' : ''); }
    function mostrar(n, manual) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('ativo', k === i); });
      Array.prototype.forEach.call(pontos.children, function (p, k) { p.classList.toggle('ativo', k === i); });
      palco.setAttribute('aria-live', manual ? 'polite' : 'off');
      if (mostrando && !vistos[i]) { vistos[i] = true; medir('patrocinio_view', chave(i)); }
    }
    function pintarPausa() {
      bPau.innerHTML = pausado ? ICO.tocar : ICO.pausa;
      bPau.setAttribute('aria-label', pausado ? 'Continuar a troca dos livros' : 'Pausar a troca dos livros');
      bPau.setAttribute('aria-pressed', pausado ? 'true' : 'false');
    }
    function agendar() {
      clearInterval(timer); timer = null;
      if (slides.length < 2 || pausado || sobre || document.hidden || !mostrando) return;
      timer = setInterval(function () { mostrar(i + 1, false); }, tempo);
    }
    bAnt.addEventListener('click', function () { mostrar(i - 1, true); agendar(); });
    bPro.addEventListener('click', function () { mostrar(i + 1, true); agendar(); });
    bPau.addEventListener('click', function () { pausado = !pausado; pintarPausa(); agendar(); });
    box.addEventListener('mouseenter', function () { sobre = true; agendar(); });
    box.addEventListener('mouseleave', function () { sobre = false; agendar(); });
    box.addEventListener('focusin', function () { sobre = true; agendar(); });
    box.addEventListener('focusout', function (e) { if (!box.contains(e.relatedTarget)) { sobre = false; agendar(); } });
    document.addEventListener('visibilitychange', agendar);
    bX.addEventListener('click', function () {
      try { sessionStorage.setItem(CHAVE_FECHADO, '1'); } catch (e) {}
      clearInterval(timer); box.remove(); window.removeEventListener('resize', aoRedimensionar);
      if (obs) obs.disconnect();
    });

    /* Todos os livros com a mesma altura: o banner nao "pula" ao trocar */
    function igualarAltura() {
      var max = 0;
      palco.style.minHeight = '';
      slides.forEach(function (s) { var d = s.style.display; s.style.display = 'flex'; max = Math.max(max, s.offsetHeight); s.style.display = d; });
      if (max) palco.style.minHeight = max + 'px';
    }
    palco.addEventListener('load', function () { if (!box.hidden) igualarAltura(); }, true);

    /* ---- Onde fica e quando aparece ---- */
    var cabe = false, cobre = 0, obs = null, rt = null;
    function aoRedimensionar() { clearTimeout(rt); rt = setTimeout(reposicionar, 200); }
    function atualizar() {
      var antes = mostrando;
      mostrando = cabe && cobre === 0;
      box.classList.toggle('escondido', !mostrando);
      box.setAttribute('aria-hidden', mostrando ? 'false' : 'true');
      if (mostrando && !antes && !vistos[i]) { vistos[i] = true; medir('patrocinio_view', chave(i)); }
      agendar();
    }
    function reposicionar() {
      if (!box.isConnected) return;
      box.hidden = true;
      var vw = window.innerWidth, vh = window.innerHeight;
      if (vw < 1180 || vh < 600) { cabe = false; atualizar(); return; }
      var borda = bordaDoConteudo();
      var livre = vw - borda;
      cabe = livre >= LARG + FOLGA * 2;
      if (cabe) {
        var dir = Math.max(16, Math.round((livre - LARG) / 2));
        box.style.right = dir + 'px';
        box.hidden = false;
        igualarAltura();
        if (box.offsetHeight > vh - 140) { cabe = false; box.hidden = true; }
      }
      atualizar();
    }

    /* Some enquanto outro anuncio de livro ou o rodape estao na tela */
    if ('IntersectionObserver' in window) {
      var naTela = new Set();
      obs = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) naTela.add(e.target); else naTela.delete(e.target); });
        cobre = naTela.size; atualizar();
      });
      var vigiar = function () {
        document.querySelectorAll('.rb-vitrine, .rb-patrocinio, .rb-patrocinado, .outros-livros, .book-showcase, footer').forEach(function (n) { obs.observe(n); });
      };
      vigiar();
      setTimeout(vigiar, 1500);   // a faixa e o patrocinio chegam depois
    }

    pintarPausa();
    mostrar(0, false);
    box.classList.add('anima');
    window.addEventListener('resize', aoRedimensionar);
    reposicionar();
    setTimeout(reposicionar, 1500);   // depois de fontes, imagens e anuncios carregarem
    window.addEventListener('load', function () { if (box.isConnected) reposicionar(); });
  }

  function comecar() {
    fetch(DADOS, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) { if (cfg) montar(cfg); })
      .catch(function () { /* sem banner e melhor que pagina quebrada */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', comecar);
  else comecar();
})();
