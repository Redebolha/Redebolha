/* ==========================================================================
   Acessibilidade RS — página pública (/acessibilidade-rs/)
   Lê o mapa (mapa-rs.json) e os lugares (dados.json). Os lugares são
   publicados pelo painel: redebolha.com.br/admin → Acessibilidade RS.
   As regras de classificação ficam em regras.js.
   ========================================================================== */
(function () {
  'use strict';

  var A = window.ARS;
  var BASE = '/acessibilidade-rs/';
  var REG = A.REGIOES;
  var REG_ORDER = A.REG_ORDER;
  var CAT = {}; A.CATS.forEach(function (c) { CAT[c[0]] = c[1]; });
  var REFS = [
    { nome: 'Guiaderodas', onde: 'Brasil · aplicativo', txt: 'Visitantes respondem um questionário rápido sobre balcão, circulação e banheiro e o app mostra a nota de cada local.', url: 'https://exame.com/tecnologia/aplicativo-mapeia-locais-com-acessibilidade-para-cadeirantes/' },
    { nome: 'Turismo Acessível', onde: 'Brasil · Ministério do Turismo', txt: 'Site e aplicativo colaborativo; o ministério modera as avaliações antes de publicar.', url: 'https://www.gov.br/pt-br/servicos/cadastrar-se-no-site-turismo-acessivel' },
    { nome: 'Selo Estadual de Acessibilidade', onde: 'RS · FADERS', txt: 'Certificação oficial Bronze, Prata e Ouro, por vistoria do Comitê Gestor Municipal. Primeiro Ouro do estado em 2026.', url: 'https://faders.rs.gov.br/selo-de-acessibilidade-68dbe89fadfef' },
    { nome: 'Wheelmap', onde: 'Alemanha · desde 2010', txt: 'Mapa mundial colaborativo com semáforo verde, amarelo e vermelho; quase 600 mil lugares avaliados.', url: 'https://en.wikipedia.org/wiki/Wheelmap.org' },
    { nome: 'Tourisme & Handicap', onde: 'França · selo do Estado', txt: 'Avalia estabelecimentos turísticos para quatro tipos de deficiência: motora, visual, auditiva e mental.', url: 'https://www.data.gouv.fr/datasets/etablissements-labellises-tourisme-handicap' },
    { nome: 'AccessAble', onde: 'Reino Unido', txt: 'Guias detalhados feitos por avaliadores que visitam cada local e registram fatos, sem dar nota.', url: 'https://www.accessable.co.uk/what-is-an-access-guide' }
  ];
  var FONTES = [
    ['FADERS · Selo de Acessibilidade', 'https://faders.rs.gov.br/selo-de-acessibilidade-68dbe89fadfef'],
    ['Prefeitura de Marau · Primeiro Selo Ouro do RS', 'https://www.pmmarau.com.br/noticias-geral/1155-primeiro-selo-ouro-de-acessibilidade-do-rs-e-de-marau'],
    ['Empreendimentos de Farroupilha recebem selo (2024)', 'https://miriamcaravaggio.com.br/empreendimentos-de-farroupilha-recebem-selo-de-acessibilidade/'],
    ['SEDES · entrega de selos a quatro instituições (2024)', 'https://social.rs.gov.br/faders-entrega-selo-de-acessibilidade-para-quatro-instituicoes-em-abril'],
    ['Governo do RS · Rede Praia Acessível (2023)', 'https://estado.rs.gov.br/servico-telefonico-amplia-acesso-a-cadeiras-especiais-que-permitem-banho-de-mar-a-pessoas-com-deficiencia-e-mobilidade-reduzi'],
    ['IBGE · malha municipal e mesorregiões', 'https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais.html']
  ];

  /* ---------- Utilidades ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function safeUrl(u) { try { var x = new URL(String(u)); return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : ''; } catch (e) { return ''; } }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var toastT;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3800); }

  var MAP = null, MUNS = [], MUN_BY_NAME = new Map(), ASPECT = 1;
  function munCod(name) { return MUN_BY_NAME.get(norm(name)) || null; }
  function munName(cod) { return MAP && MAP.mun[cod] ? MAP.mun[cod].n : '—'; }
  function regOf(cod) { return MAP && MAP.mun[cod] ? MAP.mun[cod].r : null; }
  function proj(lon, lat) { var s = MAP.proj.s, tx = MAP.proj.tx, ty = MAP.proj.ty; var l = lon * Math.PI / 180, p = lat * Math.PI / 180; return [s * l + tx, ty - s * Math.log(Math.tan(Math.PI / 4 + p / 2))]; }
  function validCoord(lat, lon) { return isFinite(lat) && isFinite(lon) && lat <= -27 && lat >= -34 && lon >= -58 && lon <= -49; }
  function hasCoord(p) { return p.lat !== null && p.lat !== undefined && p.lat !== '' && validCoord(Number(p.lat), Number(p.lon)); }

  function normPlace(d) {
    var recursos = Array.isArray(d.recursos) ? d.recursos.filter(function (k) { return A.REC[k]; }) : [];
    var av = A.avaliar(recursos);
    var o = {}; for (var k in d) o[k] = d[k];
    o.faders = A.FAD[d.faders] ? d.faders : '';
    o.recursos = recursos; o.verificado = !!d.verificado; o.nivel = av.nivel; o.dimv = av.v;
    return o;
  }
  function mkType(p) { return p.nivel > 0 ? 'n' + p.nivel : p.faders ? 'f' : 'n0'; }

  /* ---------- Ícones ---------- */
  var ICON = {
    mob: '<circle cx="12" cy="4.2" r="2.2" fill="currentColor"/><path d="M10.6 7.5h3l-.5 5h4.6l2.2 5.7-1.9.7-1.7-4.3h-5.4z" fill="currentColor"/><path d="M9.4 10.2a5.6 5.6 0 1 0 7.5 7.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    vis: '<path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.3" fill="currentColor"/>',
    aud: '<path d="M7 9.5a5 5 0 0 1 10 0c0 3.4-3.6 4.3-3.6 7.2a3 3 0 0 1-5.6 1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.2 9.6a1.8 1.8 0 0 1 3.6 0c0 1.3-1.4 1.6-1.4 2.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    int: '<path d="M12 12c-1.6-2.4-3.2-3.6-4.8-3.6a3.6 3.6 0 0 0 0 7.2c1.6 0 3.2-1.2 4.8-3.6zm0 0c1.6 2.4 3.2 3.6 4.8 3.6a3.6 3.6 0 0 0 0-7.2c-1.6 0-3.2 1.2-4.8 3.6z" fill="none" stroke="currentColor" stroke-width="2.2"/>'
  };
  function icon(k, size) { size = size || 22; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>'; }
  var MK_FILL = { n3: 'var(--n3)', n2: 'var(--n2)', n1: 'var(--n1)', n0: 'var(--n0)', f: 'var(--faders)' };
  var MK_TXT = { n3: '3', n2: '2', n1: '1', n0: '?', f: 'F' };
  function mkIcon(t, ring, size) {
    size = size || 26;
    var shape = t === 'f' ? '<rect class="b" x="-1" y="-1" width="2" height="2" rx=".35" fill="' + MK_FILL[t] + '" stroke="#050E22" stroke-width=".14"/>' : '<circle class="b" r="1" fill="' + MK_FILL[t] + '" stroke="#050E22" stroke-width=".14"/>';
    var vb = ring ? '-1.45 -1.45 2.9 2.9' : '-1.12 -1.12 2.24 2.24';
    return '<svg width="' + size + '" height="' + size + '" viewBox="' + vb + '" aria-hidden="true">' + (ring ? '<circle r="1.32" fill="none" stroke="var(--faders)" stroke-width=".22"/>' : '') + shape + '<text y=".05" font-size="1.25" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="#050E22" font-family="Atkinson Hyperlegible Next, system-ui, sans-serif">' + MK_TXT[t] + '</text></svg>';
  }
  function nivelBadge(n) { return '<span class="nivel n' + n + '">' + mkIcon('n' + n, false, 20) + '<span>' + esc(A.NIV[n].curto) + '</span>' + (n > 0 ? '<span class="st" aria-hidden="true">' + A.NIV[n].stars + '</span>' : '') + '</span>'; }
  function fadersBadge(f, ano) { return f ? '<span class="fbadge">' + mkIcon('f', false, 18) + 'Selo FADERS ' + esc(A.FAD[f]) + (ano ? ' · ' + esc(ano) : '') + '</span>' : ''; }
  var SV = { 2: 'Atende', 1: 'Parcial', 0: 'Sem informação' };
  var SVC = { 2: '✓ Atende', 1: '◐ Parcial', 0: '— Sem info' };
  function dimsHTML(p) { return '<div class="dims">' + A.DIMS.map(function (d) { return '<div class="dim v' + p.dimv[d.k] + '">' + icon(d.k, 22) + '<span>' + esc(d.nome) + '</span><span class="s">' + SVC[p.dimv[d.k]] + '</span></div>'; }).join('') + '</div>'; }

  /* ---------- Estado ---------- */
  var state = { locais: [], municipios: {}, status: 'loading', fNiv: new Set(), fDim: new Set(), fCat: new Set(), sel: { type: 'estado', id: null }, vb: { x: 0, y: 0, w: 1000, h: 960 } };

  /* ---------- Leitura: tamanho do texto e contraste ---------- */
  var FS = [100, 112.5, 125, 137.5, 150, 162.5];
  var fsIdx = Math.max(0, FS.indexOf(Number(store.get('ars_fs')) || 112.5));
  function applyFs() { document.documentElement.style.setProperty('--fs', FS[fsIdx] + '%'); store.set('ars_fs', FS[fsIdx]); }
  $('#fs-up').onclick = function () { fsIdx = Math.min(FS.length - 1, fsIdx + 1); applyFs(); updateMarkerScale(); };
  $('#fs-down').onclick = function () { fsIdx = Math.max(0, fsIdx - 1); applyFs(); updateMarkerScale(); };
  function applyHc(on) { if (on) document.documentElement.setAttribute('data-contrast', 'alto'); else document.documentElement.removeAttribute('data-contrast'); $('#hc').setAttribute('aria-pressed', on ? 'true' : 'false'); store.set('ars_hc', on ? '1' : '0'); }
  $('#hc').onclick = function () { applyHc($('#hc').getAttribute('aria-pressed') !== 'true'); };
  applyFs(); applyHc(store.get('ars_hc') === '1');

  /* ---------- Navegação ---------- */
  var VIEWS = ['mapa', 'lista', 'avaliacao', 'cadastro', 'sobre'];
  function route() {
    var h = location.hash.slice(1), v = VIEWS.indexOf(h) >= 0 ? h : 'mapa';
    VIEWS.forEach(function (n) { $('#v-' + n).hidden = n !== v; });
    $$('nav.tabs a[data-view]').forEach(function (a) { if (a.dataset.view === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (v === 'mapa') requestAnimationFrame(updateMarkerScale);
  }
  window.addEventListener('hashchange', function () { route(); $('#conteudo').focus({ preventScroll: true }); window.scrollTo(0, 0); });

  /* ---------- Conteúdo fixo ---------- */
  function recFieldsets(pre, named) {
    function box(k, v) { return '<label><input type="checkbox" id="' + pre + '-' + k + '" value="' + esc(v) + '"' + (named ? ' name="recurso_' + k + '" data-rotulo="Recurso"' : '') + '> ' + esc(v) + '</label>'; }
    return A.DIMS.map(function (d) { return '<fieldset><legend>' + icon(d.k, 24) + ' ' + esc(d.nome) + ' <span class="hint">· ' + esc(d.longo) + '</span></legend><div class="checks">' + d.recs.map(function (r) { return box(r[0], r[1]); }).join('') + '</div></fieldset>'; }).join('')
      + '<fieldset><legend>Para todos</legend><div class="checks">' + A.GERAIS.map(function (r) { return box(r[0], r[1]); }).join('') + '</div></fieldset>';
  }
  function fillStatic() {
    $('#c-cat').innerHTML = '<option value="">Escolha</option>' + A.CATS.map(function (c) { return '<option value="' + esc(c[1]) + '">' + esc(c[1]) + '</option>'; }).join('');
    $('#l-reg').innerHTML = '<option value="">Todas</option>' + REG_ORDER.map(function (r) { return '<option value="' + r + '">' + esc(REG[r].nome) + '</option>'; }).join('');
    $('#l-cat').innerHTML = '<option value="">Todos</option>' + A.CATS.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('');
    $('#l-niv').innerHTML = '<option value="">Todos</option>' + [3, 2, 1, 0].map(function (n) { return '<option value="' + n + '">' + esc(A.NIV[n].nome) + '</option>'; }).join('') + '<option value="f">Com Selo FADERS</option>';
    $('#c-dims').innerHTML = recFieldsets('cr', true);
    $('#f-niv').innerHTML = [3, 2, 1, 0].map(function (n) { return '<button type="button" class="chip" aria-pressed="false" data-niv="' + n + '">' + mkIcon('n' + n, false, 24) + esc(A.NIV[n].curto) + '</button>'; }).join('') + '<button type="button" class="chip" aria-pressed="false" data-niv="f">' + mkIcon('f', false, 24) + 'Selo FADERS</button>';
    $('#f-dim').innerHTML = A.DIMS.map(function (d) { return '<button type="button" class="chip" aria-pressed="false" data-dim="' + d.k + '">' + icon(d.k, 22) + esc(d.nome) + '</button>'; }).join('');
    $('#f-cat').innerHTML = A.CATS.map(function (c) { return '<button type="button" class="chip t" aria-pressed="false" data-cat="' + c[0] + '">' + esc(c[1]) + '</button>'; }).join('');
    $('#legend').innerHTML = [3, 2, 1, 0].map(function (n) { return '<div>' + mkIcon('n' + n, false, 28) + '<span><b>' + esc(A.NIV[n].nome) + '</b></span></div>'; }).join('')
      + '<div>' + mkIcon('f', false, 28) + '<span><b>Só Selo Estadual FADERS</b></span></div><div>' + mkIcon('n2', true, 32) + '<span>Anel azul: também tem o Selo FADERS</span></div>';
    $('#dimcards').innerHTML = A.DIMS.map(function (d) { return '<article class="dimcard"><h3>' + icon(d.k, 28) + esc(d.nome) + '</h3><p class="hint">' + esc(d.longo) + '</p><ul>' + d.recs.map(function (r) { return '<li>' + esc(r[1]) + '</li>'; }).join('') + '</ul><p class="rule">' + esc(d.regra) + '</p></article>'; }).join('');
    $('#levelcards').innerHTML = [3, 2, 1, 0].map(function (n) { return '<div class="level n' + n + '"><div class="lv">' + mkIcon('n' + n, false, 34) + esc(A.NIV[n].nome) + '</div><p>' + esc(A.NIV[n].desc) + '</p></div>'; }).join('');
    $('#refs').innerHTML = REFS.map(function (r) { return '<article class="ref"><span class="where">' + esc(r.onde) + '</span><h3>' + esc(r.nome) + '</h3><p>' + esc(r.txt) + '</p><a href="' + esc(r.url) + '" target="_blank" rel="noopener">Ver fonte (' + esc(host(r.url)) + ')</a></article>'; }).join('');
    $('#fontes').innerHTML = FONTES.map(function (f) { return '<li><a href="' + esc(f[1]) + '" target="_blank" rel="noopener">' + esc(f[0]) + '</a></li>'; }).join('');
  }

  /* ---------- Mapa ---------- */
  var svg = $('#map'), gMk = null, gLbl = null;
  function buildMap() {
    var h = '<g id="g-reg">';
    MAP.regioes.forEach(function (r) { h += '<path class="reg" data-reg="' + r.cod + '" d="' + r.d + '" style="fill:var(--r' + r.cod + ')"/>'; });
    h += '</g><g id="g-mun">';
    MUNS.forEach(function (m) { if (m.d) h += '<path class="mun" data-cod="' + m.cod + '" d="' + m.d + '"/>'; });
    h += '</g><g>';
    MAP.regioes.forEach(function (r) { h += '<path class="regline" d="' + r.d + '"/>'; });
    h += '</g><path class="rsline" d="' + MAP.rs + '"/><g id="g-lbl"></g><g id="g-mk"></g>';
    svg.insertAdjacentHTML('beforeend', h);
    gMk = $('#g-mk'); gLbl = $('#g-lbl');
    var pts = {}; MUNS.forEach(function (m) { (pts[m.r] = pts[m.r] || []).push([m.x, m.y]); });
    var fix = { '05': [-10, 12], '06': [-10, 10], '07': [-20, 0] };
    MAP.regioes.forEach(function (r) {
      var b = svg.querySelector('.reg[data-reg="' + r.cod + '"]').getBBox(); r.bb = { x: b.x, y: b.y, width: b.width, height: b.height };
      var p = pts[r.cod], f = fix[r.cod] || [0, 0];
      r.cx = p.reduce(function (a, q) { return a + q[0]; }, 0) / p.length + f[0];
      r.cy = p.reduce(function (a, q) { return a + q[1]; }, 0) / p.length + f[1];
    });
  }
  function svgW() { return svg.getBoundingClientRect().width; }
  function unitsPerPx() { return state.vb.w / Math.max(1, svgW()); }
  function setVB(vb) { state.vb = vb; svg.setAttribute('viewBox', vb.x.toFixed(2) + ' ' + vb.y.toFixed(2) + ' ' + vb.w.toFixed(2) + ' ' + vb.h.toFixed(2)); updateMarkerScale(); }
  var anim;
  function animateTo(t) {
    var from = { x: state.vb.x, y: state.vb.y, w: state.vb.w, h: state.vb.h };
    cancelAnimationFrame(anim);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVB(t); return; }
    var t0 = performance.now(), dur = 380;
    function step(now) {
      var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      setVB({ x: from.x + (t.x - from.x) * e, y: from.y + (t.y - from.y) * e, w: from.w + (t.w - from.w) * e, h: from.h + (t.h - from.h) * e });
      if (k < 1) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }
  function clampVB(v) { var w = Math.max(30, Math.min(MAP.W * 1.15, v.w)), h = w / ASPECT, cx = v.x + v.w / 2, cy = v.y + v.h / 2; var x = Math.max(-w * 0.5, Math.min(MAP.W - w * 0.5, cx - w / 2)), y = Math.max(-h * 0.5, Math.min(MAP.H - h * 0.5, cy - h / 2)); return { x: x, y: y, w: w, h: h }; }
  function fitBox(b, pad, minW) { pad = pad || 1.18; minW = minW || 60; var w = Math.max(b.width * pad, b.height * pad * ASPECT, minW), h = w / ASPECT; return clampVB({ x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - h / 2, w: w, h: h }); }
  function zoomBy(f) { var v = state.vb, w = v.w * f, h = w / ASPECT; animateTo(clampVB({ x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w: w, h: h })); }
  function resetView() { animateTo({ x: 0, y: 0, w: MAP.W, h: MAP.H }); }

  function filteredLocais() {
    return state.locais.filter(function (p) {
      if (state.fCat.size && !state.fCat.has(p.categoria)) return false;
      if (state.fNiv.size && !(state.fNiv.has(String(p.nivel)) || (state.fNiv.has('f') && p.faders))) return false;
      var ok = true; state.fDim.forEach(function (d) { if (p.dimv[d] !== 2) ok = false; });
      return ok;
    });
  }
  function byNivelNome(a, b) { return b.nivel - a.nivel || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); }
  function placePositions(list) {
    var byMun = {}, out = new Map();
    list.slice().sort(byNivelNome).forEach(function (p) {
      if (hasCoord(p)) { out.set(p.id, proj(Number(p.lon), Number(p.lat))); return; }
      var m = MAP.mun[p.mun]; if (!m) return;
      var i = byMun[p.mun] = (byMun[p.mun] === undefined ? -1 : byMun[p.mun]) + 1;
      if (i === 0) out.set(p.id, [m.x, m.y]);
      else { var a = i * 2.39996, r = 3.6 * Math.sqrt(i); out.set(p.id, [m.x + r * Math.cos(a), m.y + r * Math.sin(a)]); }
    });
    return out;
  }
  function renderMarkers() {
    if (!gMk) return;
    var list = filteredLocais(), pos = placePositions(list), h = '';
    list.slice().sort(function (a, b) { return a.nivel - b.nivel; }).forEach(function (p) {
      var xy = pos.get(p.id); if (!xy) return;
      var t = mkType(p), sel = state.sel.type === 'local' && state.sel.id === p.id ? ' sel' : '';
      var shape = t === 'f' ? '<rect class="b" x="-1" y="-1" width="2" height="2" rx=".35" fill="' + MK_FILL[t] + '"/>' : '<circle class="b" r="1" fill="' + MK_FILL[t] + '"/>';
      h += '<g class="mk' + sel + '" data-id="' + esc(p.id) + '" data-x="' + xy[0].toFixed(1) + '" data-y="' + xy[1].toFixed(1) + '"><title>' + esc(p.nome) + ' · ' + esc(A.NIV[p.nivel].nome) + (p.faders ? ' · Selo FADERS ' + esc(A.FAD[p.faders]) : '') + '</title>' + (p.faders && t !== 'f' ? '<circle class="ring" r="1.3"/>' : '') + shape + '<text y=".04" font-size="1.25">' + MK_TXT[t] + '</text></g>';
    });
    gMk.innerHTML = h;
    updateMarkerScale();
  }
  function updateMarkerScale() {
    if (!gMk || !svgW()) return;
    var u = unitsPerPx(), k = 11 * u * (FS[fsIdx] / 112.5);
    Array.prototype.forEach.call(gMk.children, function (g) { g.setAttribute('transform', 'translate(' + g.dataset.x + ',' + g.dataset.y + ') scale(' + k.toFixed(3) + ')'); });
    renderLabels(u);
  }
  function renderLabels(u) {
    if (!gLbl) return;
    var zoom = MAP.W / state.vb.w, fs = 15 * u * (FS[fsIdx] / 112.5), h = '';
    if (zoom < 2.2) {
      if (svgW() < 560) { gLbl.innerHTML = ''; return; }
      MAP.regioes.forEach(function (r) { h += '<text class="lbl" x="' + r.cx.toFixed(1) + '" y="' + r.cy.toFixed(1) + '" font-size="' + fs.toFixed(2) + '" stroke-width="' + (4 * u).toFixed(2) + '">' + esc(REG[r.cod].nome) + '</text>'; });
    } else {
      var names = new Set(state.locais.map(function (p) { return p.mun; }));
      if (state.sel.type === 'mun') names.add(state.sel.id);
      var v = state.vb;
      names.forEach(function (c) { var m = MAP.mun[c]; if (!m || m.x < v.x || m.x > v.x + v.w || m.y < v.y || m.y > v.y + v.h) return;
        h += '<text class="lbl" x="' + m.x + '" y="' + (m.y - 17 * u).toFixed(1) + '" font-size="' + (fs * 0.9).toFixed(2) + '" stroke-width="' + (4 * u).toFixed(2) + '">' + esc(m.n) + '</text>'; });
    }
    gLbl.innerHTML = h;
  }
  function renderMunClasses() {
    var withPlaces = new Set(state.locais.map(function (p) { return p.mun; }));
    $$('#g-mun .mun').forEach(function (p) { var c = p.dataset.cod; p.classList.toggle('tem', withPlaces.has(c)); p.classList.toggle('sel', state.sel.type === 'mun' && state.sel.id === c); });
    $$('#g-reg .reg').forEach(function (p) { p.classList.toggle('dim', state.sel.type === 'regiao' && state.sel.id !== p.dataset.reg); });
  }
  function mapEvents() {
    var down = null, moved = false, tip = $('#tip');
    svg.addEventListener('pointerdown', function (e) { if (e.button !== 0) return; down = { x: e.clientX, y: e.clientY, vb: { x: state.vb.x, y: state.vb.y, w: state.vb.w, h: state.vb.h } }; moved = false; });
    svg.addEventListener('pointermove', function (e) {
      if (down) {
        var dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!moved && Math.sqrt(dx * dx + dy * dy) > 5) { moved = true; svg.setPointerCapture(e.pointerId); svg.classList.add('dragging'); tip.hidden = true; }
        if (moved) { var u = down.vb.w / svgW(); setVB(clampVB({ x: down.vb.x - dx * u, y: down.vb.y - dy * u, w: down.vb.w, h: down.vb.h })); }
        return;
      }
      var t = e.target.closest('.mk, .mun');
      if (!t) { tip.hidden = true; return; }
      var pb = svg.parentElement.getBoundingClientRect();
      if (t.classList.contains('mk')) { var pl = state.locais.filter(function (p) { return p.id === t.dataset.id; })[0]; tip.textContent = pl ? pl.nome : ''; }
      else tip.textContent = munName(t.dataset.cod);
      tip.style.left = (e.clientX - pb.left) + 'px'; tip.style.top = (e.clientY - pb.top) + 'px'; tip.hidden = !tip.textContent;
    });
    svg.addEventListener('pointerup', function (e) {
      if (!down) return;
      var wasMoved = moved; down = null; moved = false; svg.classList.remove('dragging');
      try { svg.releasePointerCapture(e.pointerId); } catch (x) {}
      if (wasMoved) return;
      var t = e.target.closest('.mk, .mun, .reg'); if (!t) return;
      if (t.classList.contains('mk')) selectPlace(t.dataset.id, false);
      else if (t.classList.contains('mun')) {
        var zoom = MAP.W / state.vb.w, r = regOf(t.dataset.cod), other = state.sel.type === 'regiao' && state.sel.id !== r;
        if (zoom < 1.6 && (state.sel.type === 'estado' || other)) selectRegion(r); else selectMun(t.dataset.cod);
      } else selectRegion(t.dataset.reg);
    });
    svg.addEventListener('pointercancel', function () { down = null; moved = false; svg.classList.remove('dragging'); });
    svg.addEventListener('pointerleave', function () { if (!down) tip.hidden = true; });
    svg.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      var f = e.deltaY > 0 ? 1.25 : 0.8, r = svg.getBoundingClientRect(), u = state.vb.w / r.width;
      var px = state.vb.x + (e.clientX - r.left) * u, py = state.vb.y + (e.clientY - r.top) * u, w = state.vb.w * f;
      setVB(clampVB({ x: px - (px - state.vb.x) * f, y: py - (py - state.vb.y) * f, w: w, h: w / ASPECT }));
    }, { passive: false });
    $('#z-in').onclick = function () { zoomBy(0.6); };
    $('#z-out').onclick = function () { zoomBy(1.6); };
    $('#z-reset').onclick = function () { state.sel = { type: 'estado', id: null }; resetView(); renderSide(); renderMunClasses(); };
    window.addEventListener('resize', updateMarkerScale);
  }

  /* ---------- Seleção ---------- */
  function selectRegion(cod) {
    if (!REG[cod]) return;
    state.sel = { type: 'regiao', id: cod };
    animateTo(fitBox(MAP.regioes.filter(function (x) { return x.cod === cod; })[0].bb, 1.12));
    renderSide(); renderMunClasses();
  }
  function zoomMun(cod) { var p = svg.querySelector('.mun[data-cod="' + cod + '"]'), m = MAP.mun[cod]; var b = p ? p.getBBox() : { x: m.x - 20, y: m.y - 20, width: 40, height: 40 }; animateTo(fitBox(b, 2.6, 170)); }
  function selectMun(cod, zoom) { if (!MAP.mun[cod]) return; state.sel = { type: 'mun', id: cod }; if (zoom !== false) zoomMun(cod); renderSide(); renderMunClasses(); renderMarkers(); }
  function selectPlace(id, zoom) {
    var p = state.locais.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    state.sel = { type: 'local', id: id };
    if (zoom !== false || MAP.W / state.vb.w < 1.6) zoomMun(p.mun);
    renderSide(); renderMunClasses(); renderMarkers();
  }

  /* ---------- Painel lateral ---------- */
  function placeItems(list, max) {
    max = max || 50;
    if (!list.length) return '<p class="empty">Nenhum lugar com os filtros atuais.</p>';
    var sorted = list.slice().sort(byNivelNome);
    return '<ul class="placelist">' + sorted.slice(0, max).map(function (p) { return '<li><button type="button" class="pitem" data-place="' + esc(p.id) + '"><b>' + esc(p.nome) + '</b><span class="meta">' + nivelBadge(p.nivel) + (p.faders ? fadersBadge(p.faders) : '') + '<span>' + esc(CAT[p.categoria] || '—') + ' · ' + esc(munName(p.mun)) + '</span></span></button></li>'; }).join('') + '</ul>' + (sorted.length > max ? '<p class="hint">Mostrando ' + max + ' de ' + sorted.length + '. Veja todos na aba Lista.</p>' : '');
  }
  function notice() {
    if (state.status === 'loading') return '<p class="empty">Carregando lugares…</p>';
    if (state.status === 'erro') return '<p class="empty">Não foi possível carregar os lugares agora. Recarregue a página em instantes.</p>';
    if (!state.locais.length) return '<p class="empty">Nenhum lugar cadastrado ainda. <a href="#cadastro">Cadastre o primeiro</a>.</p>';
    return '';
  }
  function renderSide() {
    var ctx = $('#ctx'), list = filteredLocais(), sel = state.sel;
    if (sel.type === 'regiao') {
      var R = REG[sel.id], inReg = list.filter(function (p) { return regOf(p.mun) === sel.id; });
      ctx.innerHTML = '<div class="stack"><button type="button" class="back" data-go="estado">← Estado inteiro</button>'
        + '<div><p class="eyebrow">Região</p><h2 style="font-size:1.45rem">' + esc(R.nome) + '</h2><p class="muted" style="font-size:.95rem">' + esc(R.sub) + '</p></div>'
        + '<dl class="kv"><dt>Municípios</dt><dd class="mono">' + MUNS.filter(function (m) { return m.r === sel.id; }).length + '</dd><dt>Mesorregião IBGE</dt><dd>' + esc(R.ibge) + '</dd></dl>'
        + '<div><p class="eyebrow" style="margin-bottom:.45rem">Lugares (' + inReg.length + ')</p>' + (notice() || placeItems(inReg)) + '</div></div>';
    } else if (sel.type === 'mun') {
      var m = MAP.mun[sel.id], info = state.municipios[sel.id], inMun = list.filter(function (p) { return p.mun === sel.id; }), f = info ? safeUrl(info.fonte) : '';
      ctx.innerHTML = '<div class="stack"><button type="button" class="back" data-reg="' + m.r + '">← ' + esc(REG[m.r].nome) + '</button>'
        + '<div><p class="eyebrow">Cidade</p><h2 style="font-size:1.45rem">' + esc(m.n) + '</h2></div>'
        + '<dl class="kv"><dt>Região</dt><dd>' + esc(REG[m.r].nome) + '</dd><dt>Microrregião</dt><dd>' + esc(m.m) + '</dd>' + (info ? '<dt>Selo FADERS</dt><dd>' + esc(A.MST[info.status] || info.status) + (info.data ? ' · <span class="mono">' + esc(info.data) + '</span>' : '') + (f ? ' · <a href="' + esc(f) + '" target="_blank" rel="noopener">fonte</a>' : '') + '</dd>' : '') + '</dl>'
        + '<div><p class="eyebrow" style="margin-bottom:.45rem">Lugares (' + inMun.length + ')</p>' + (notice() || placeItems(inMun)) + '</div></div>';
    } else if (sel.type === 'local') {
      var p = state.locais.filter(function (x) { return x.id === sel.id; })[0];
      if (!p) { state.sel = { type: 'estado', id: null }; renderSide(); return; }
      var site = safeUrl(p.site), fonte = safeUrl(p.fonte);
      ctx.innerHTML = '<div class="stack"><button type="button" class="back" data-mun="' + esc(p.mun) + '">← ' + esc(munName(p.mun)) + '</button>'
        + '<div><p class="eyebrow">' + esc(CAT[p.categoria] || 'Lugar') + '</p><h2 style="font-size:1.45rem">' + esc(p.nome) + '</h2></div>'
        + '<div class="row">' + nivelBadge(p.nivel) + fadersBadge(p.faders, p.fadersAno) + '</div>'
        + dimsHTML(p)
        + '<p class="hint">' + (p.verificado ? 'Conferido pela equipe' : 'Informado pelo estabelecimento ou por fonte pública') + '</p>'
        + '<dl class="kv"><dt>Cidade</dt><dd>' + esc(munName(p.mun)) + ' · ' + esc(REG[regOf(p.mun)] ? REG[regOf(p.mun)].nome : '') + '</dd>' + (p.endereco ? '<dt>Endereço</dt><dd>' + esc(p.endereco) + '</dd>' : '') + (p.contato ? '<dt>Contato</dt><dd>' + esc(p.contato) + '</dd>' : '') + (site ? '<dt>Site</dt><dd><a href="' + esc(site) + '" target="_blank" rel="noopener">' + esc(host(site)) + '</a></dd>' : '') + '</dl>'
        + (p.recursos.length ? '<div><p class="eyebrow" style="margin-bottom:.4rem">Recursos</p><div class="recs">' + p.recursos.map(function (r) { return '<span class="rec">' + esc(A.REC[r]) + '</span>'; }).join('') + '</div></div>' : '')
        + (p.obs ? '<p style="font-size:.95rem">' + esc(p.obs) + '</p>' : '')
        + (fonte ? '<p style="font-size:.92rem"><a href="' + esc(fonte) + '" target="_blank" rel="noopener">Fonte: ' + esc(host(fonte)) + '</a></p>' : '') + '</div>';
    } else {
      var byReg = {}; list.forEach(function (p) { var r = regOf(p.mun); byReg[r] = (byReg[r] || 0) + 1; });
      ctx.innerHTML = '<div class="stack"><div><p class="eyebrow">Regiões</p><p class="muted" style="font-size:.95rem">Escolha uma região para ver as cidades e os lugares.</p></div>'
        + '<ul class="reglist">' + REG_ORDER.map(function (r) { return '<li><button type="button" data-reg="' + r + '"><span class="nm"><span class="sw" style="background:var(--r' + r + ')"></span>' + esc(REG[r].nome) + '</span><span class="ct">' + (state.status === 'ok' ? (byReg[r] || 0) + ' lugares' : '') + '</span></button></li>'; }).join('') + '</ul>' + notice() + '</div>';
    }
  }
  function bindSide() {
    $('#ctx').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !MAP) return;
      if (b.dataset.place) selectPlace(b.dataset.place);
      else if (b.dataset.mun) selectMun(b.dataset.mun);
      else if (b.dataset.reg) selectRegion(b.dataset.reg);
      else if (b.dataset.go === 'estado') { state.sel = { type: 'estado', id: null }; resetView(); renderSide(); renderMunClasses(); }
    });
    function toggle(set, key, b) { if (set.has(key)) set.delete(key); else set.add(key); b.setAttribute('aria-pressed', set.has(key)); renderMarkers(); renderSide(); }
    $('#f-niv').addEventListener('click', function (e) { var b = e.target.closest('[data-niv]'); if (b) toggle(state.fNiv, b.dataset.niv, b); });
    $('#f-dim').addEventListener('click', function (e) { var b = e.target.closest('[data-dim]'); if (b) toggle(state.fDim, b.dataset.dim, b); });
    $('#f-cat').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; toggle(state.fCat, b.dataset.cat, b); $('#cat-count').textContent = state.fCat.size ? '· ' + state.fCat.size + ' escolhido' + (state.fCat.size > 1 ? 's' : '') : ''; });
    var last = '';
    $('#busca').addEventListener('change', function (e) { if (norm(e.target.value) === last) return; last = norm(e.target.value); runSearch(e.target.value); });
    $('#busca').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); last = norm(e.target.value); runSearch(e.target.value); } });
  }
  function fillSearchList() {
    var opts = MUNS.map(function (m) { return '<option value="' + esc(m.n) + '">Cidade · ' + esc(REG[m.r].nome) + '</option>'; });
    state.locais.forEach(function (p) { opts.push('<option value="' + esc(p.nome) + '">' + esc(CAT[p.categoria] || 'Lugar') + ' · ' + esc(munName(p.mun)) + '</option>'); });
    $('#dl-busca').innerHTML = opts.join('');
  }
  function runSearch(v) {
    var q = norm(v); if (!q || !MAP) return;
    var cod = MUN_BY_NAME.get(q); if (cod) return selectMun(cod);
    var exact = state.locais.filter(function (p) { return norm(p.nome) === q; })[0]; if (exact) return selectPlace(exact.id);
    var part = state.locais.filter(function (p) { return norm(p.nome).indexOf(q) >= 0 || norm(CAT[p.categoria]).indexOf(q) >= 0; })[0]; if (part) return selectPlace(part.id);
    var mp = MUNS.filter(function (m) { return norm(m.n).indexOf(q) === 0; })[0]; if (mp) return selectMun(mp.cod);
    toast('Nada encontrado para essa busca.');
  }

  /* ---------- Números ---------- */
  function renderStats() {
    var ok = state.status === 'ok', c = { 3: 0, 2: 0, 1: 0, 0: 0 }, f = 0;
    state.locais.forEach(function (p) { c[p.nivel]++; if (p.faders) f++; });
    function v(n) { return ok ? n : '–'; }
    $('#stats').innerHTML = '<div class="stat plain"><b>' + v(state.locais.length) + '</b><span>lugares no guia</span></div>'
      + [3, 2, 1].map(function (n) { return '<div class="stat">' + mkIcon('n' + n, false, 26) + '<b>' + v(c[n]) + '</b><span>' + esc(A.NIV[n].curto) + '</span></div>'; }).join('')
      + '<div class="stat">' + mkIcon('f', false, 26) + '<b>' + v(f) + '</b><span>com Selo FADERS</span></div>';
  }

  /* ---------- Lista ---------- */
  function renderList() {
    var q = norm($('#l-q').value), r = $('#l-reg').value, c = $('#l-cat').value, n = $('#l-niv').value;
    var list = state.locais.filter(function (p) { return (!r || regOf(p.mun) === r) && (!c || p.categoria === c) && (!n || (n === 'f' ? !!p.faders : String(p.nivel) === n)); });
    if (q) list = list.filter(function (p) { return norm([p.nome, munName(p.mun), CAT[p.categoria], p.endereco].concat(p.recursos.map(function (k) { return A.REC[k]; })).join(' ')).indexOf(q) >= 0; });
    list.sort(byNivelNome);
    $('#l-count').textContent = state.status !== 'ok' ? '' : list.length + ' ' + (list.length === 1 ? 'lugar' : 'lugares');
    var nt = notice();
    if (nt) { $('#l-cards').innerHTML = nt; return; }
    if (!list.length) { $('#l-cards').innerHTML = '<p class="empty">Nenhum lugar com esses filtros.</p>'; return; }
    $('#l-cards').innerHTML = list.map(function (p) {
      var fonte = safeUrl(p.fonte), site = safeUrl(p.site);
      return '<article class="card"><h3>' + esc(p.nome) + '</h3><div class="row">' + nivelBadge(p.nivel) + fadersBadge(p.faders, p.fadersAno) + '</div>'
        + '<p class="where">' + esc(CAT[p.categoria] || '—') + ' · ' + esc(munName(p.mun)) + ' · ' + esc(REG[regOf(p.mun)] ? REG[regOf(p.mun)].nome : '') + '</p>'
        + dimsHTML(p)
        + (p.obs ? '<p style="font-size:.95rem" class="muted">' + esc(p.obs) + '</p>' : '')
        + '<div class="foot"><a href="#mapa" data-show="' + esc(p.id) + '">Ver no mapa</a>' + (site ? '<a href="' + esc(site) + '" target="_blank" rel="noopener">Site</a>' : '') + (fonte ? '<a href="' + esc(fonte) + '" target="_blank" rel="noopener">Fonte</a>' : '') + '</div></article>';
    }).join('');
  }
  ['#l-q', '#l-reg', '#l-cat', '#l-niv'].forEach(function (s) { $(s).addEventListener('input', renderList); });
  $('#l-cards').addEventListener('click', function (e) { var a = e.target.closest('[data-show]'); if (a) setTimeout(function () { selectPlace(a.dataset.show); }, 60); });

  /* ---------- Selo FADERS: municípios ---------- */
  function renderSeloMun() {
    var rows = Object.keys(state.municipios).sort(function (a, b) { return munName(a).localeCompare(munName(b), 'pt-BR'); });
    if (state.status !== 'ok' || !rows.length) { $('#t-mun').innerHTML = '<tr><td colspan="5" class="muted">' + (state.status === 'loading' ? 'Carregando…' : 'Nenhum município informado.') + '</td></tr>'; return; }
    $('#t-mun').innerHTML = rows.map(function (cod) {
      var i = state.municipios[cod], n = state.locais.filter(function (p) { return p.mun === cod && p.faders; }).length, f = safeUrl(i.fonte);
      return '<tr><td>' + esc(munName(cod)) + '</td><td>' + esc(REG[regOf(cod)] ? REG[regOf(cod)].nome : '') + '</td><td>' + esc(A.MST[i.status] || i.status) + (i.data ? ' · <span class="mono">' + esc(i.data) + '</span>' : '') + '</td><td class="n">' + n + '</td><td>' + (f ? '<a href="' + esc(f) + '" target="_blank" rel="noopener">' + esc(host(f)) + '</a>' : '—') + '</td></tr>';
    }).join('');
  }

  /* ---------- Cadastro do negócio ---------- */
  function readRecs(pre) { return Object.keys(A.REC).filter(function (k) { var el = $('#' + pre + '-' + k); return el && el.checked; }); }
  function calcBox() {
    var av = A.avaliar(readRecs('cr'));
    $('#c-calc').innerHTML = '<span class="hint" style="font-weight:800">Nível calculado:</span>' + nivelBadge(av.nivel) + '<span class="hint">' + A.DIMS.map(function (d) { return d.nome + ': ' + SV[av.v[d.k]].toLowerCase(); }).join(' · ') + '</span>';
  }
  var form = $('#f-cad');
  $('#c-dims').addEventListener('change', calcBox);
  form.addEventListener('reset', function () { setTimeout(calcBox, 0); });
  /* Valida antes do envio. O envio em si é do /js/rb-lista.js (Formspree, com WhatsApp de reserva). */
  form.addEventListener('submit', function (e) {
    var err = $('#c-err'); err.hidden = true;
    var miss = [];
    if (!$('#c-nome').value.trim()) miss.push('nome do estabelecimento');
    if (!$('#c-cat').value) miss.push('tipo de lugar');
    var cod = munCod($('#c-mun').value);
    if (!cod) miss.push('cidade (escolha um nome da lista)'); else $('#c-mun').value = munName(cod);
    if (!$('#c-end').value.trim()) miss.push('endereço');
    if ($('#c-resp').value.trim().length < 2) miss.push('nome do responsável');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test($('#c-email').value.trim())) miss.push('e-mail válido');
    if (!$('#c-lgpd').checked) miss.push('autorização de uso dos dados');
    if (miss.length) {
      e.preventDefault(); e.stopImmediatePropagation();
      err.textContent = 'Falta preencher: ' + miss.join(', ') + '.'; err.hidden = false; err.focus();
    }
  }, true);

  /* ---------- Render geral ---------- */
  function renderAll() { renderStats(); renderMunClasses(); renderMarkers(); renderSide(); renderList(); renderSeloMun(); fillSearchList(); }

  /* ---------- Início ---------- */
  fillStatic();
  calcBox();
  route();
  fetch(BASE + 'mapa-rs.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (m) {
    MAP = m; ASPECT = MAP.W / MAP.H;
    MUNS = Object.keys(MAP.mun).map(function (cod) { var o = { cod: cod }; var x = MAP.mun[cod]; for (var k in x) o[k] = x[k]; return o; }).sort(function (a, b) { return a.n.localeCompare(b.n, 'pt-BR'); });
    MUNS.forEach(function (x) { MUN_BY_NAME.set(norm(x.n), x.cod); });
    var dl = document.createElement('datalist'); dl.id = 'dl-mun';
    dl.innerHTML = MUNS.map(function (x) { return '<option value="' + esc(x.n) + '"></option>'; }).join('');
    document.body.appendChild(dl);
    buildMap(); mapEvents(); bindSide();
    setVB({ x: 0, y: 0, w: MAP.W, h: MAP.H });
    renderAll();
    return fetch(BASE + 'dados.json', { cache: 'no-cache' });
  }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (d) {
    state.locais = (d.locais || []).filter(function (p) { return p && p.id && MAP.mun[p.mun]; }).map(normPlace);
    var mu = {}; Object.keys(d.municipios || {}).forEach(function (c) { if (MAP.mun[c]) mu[c] = d.municipios[c]; });
    state.municipios = mu; state.status = 'ok';
    renderAll();
  }).catch(function () {
    state.status = 'erro';
    if (MAP) renderAll(); else $('#ctx').innerHTML = '<p class="empty">Não foi possível carregar o mapa agora. Recarregue a página em instantes.</p>';
  });
})();
