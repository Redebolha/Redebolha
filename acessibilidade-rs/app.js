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
    ['Faders entrega Selo de Acessibilidade para quatro instituições em abril', 'https://social.rs.gov.br/faders-entrega-selo-de-acessibilidade-para-quatro-instituicoes-em-abril'],
    ['Operação Verão Total · Rede Praia Acessível (temporada 2026/2027)', 'https://operacaoveraototal.rs.gov.br/praia-acessivel'],
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
  /* "Como chegar": abre o mapa do celular pela coordenada ou pelo endereço */
  function rotaUrl(p) {
    var q = hasCoord(p) ? Number(p.lat) + ',' + Number(p.lon) : [p.nome, p.endereco, munName(p.mun), 'RS'].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }

  function normPlace(d) {
    var recursos = Array.isArray(d.recursos) ? d.recursos.filter(function (k) { return A.REC[k]; }) : [];
    var av = A.avaliar(recursos);
    var o = {}; for (var k in d) o[k] = d[k];
    o.faders = A.FAD[d.faders] ? d.faders : '';
    o.recursos = recursos; o.verificado = !!d.verificado;
    o.avaliacoes = Math.max(0, parseInt(d.avaliacoes, 10) || 0);
    o.st = A.situacao(o); o.rank = A.SITU[o.st].ordem; o.atende = av.atende; o.dimv = av.v;
    return o;
  }
  /* Marcador: cor e símbolo da situação da informação. Lugar que só tem o
     Selo FADERS, sem recursos informados, aparece como quadrado "F". */
  function mkType(p) { return (p.st === 'c' && !p.recursos.length && p.faders) ? 'f' : p.st; }

  /* ---------- Ícones ---------- */
  var ICON = {
    mob: '<circle cx="12" cy="4.2" r="2.2" fill="currentColor"/><path d="M10.6 7.5h3l-.5 5h4.6l2.2 5.7-1.9.7-1.7-4.3h-5.4z" fill="currentColor"/><path d="M9.4 10.2a5.6 5.6 0 1 0 7.5 7.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    vis: '<path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.3" fill="currentColor"/>',
    aud: '<path d="M7 9.5a5 5 0 0 1 10 0c0 3.4-3.6 4.3-3.6 7.2a3 3 0 0 1-5.6 1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.2 9.6a1.8 1.8 0 0 1 3.6 0c0 1.3-1.4 1.6-1.4 2.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    int: '<path d="M12 12c-1.6-2.4-3.2-3.6-4.8-3.6a3.6 3.6 0 0 0 0 7.2c1.6 0 3.2-1.2 4.8-3.6zm0 0c1.6 2.4 3.2 3.6 4.8 3.6a3.6 3.6 0 0 0 0-7.2c-1.6 0-3.2 1.2-4.8 3.6z" fill="none" stroke="currentColor" stroke-width="2.2"/>'
  };
  function icon(k, size) { size = size || 22; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>'; }

  /* Ícone do tipo de lugar, ao lado do nome (hotel, câmara, praia…).
     Sai da categoria do lugar: lugar novo já entra com o ícone certo. */
  var CAT_ICON = {
    hospedagem: '<path d="M3 18.5V6.5M3 14h18v4.5M21 14v-2a2.5 2.5 0 0 0-2.5-2.5H11V14"/><circle cx="7" cy="11" r="1.9"/>',
    alimentacao: '<path d="M6.5 3v7.5M4.5 3v5a2 2 0 0 0 4 0V3M6.5 10.5V21M16.5 21V3c-2.2 1.4-3.5 4-3.5 7.5h3.5"/>',
    eventos: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m12 12.4.95 1.9 2.1.3-1.5 1.5.35 2.1-1.9-1-1.9 1 .35-2.1-1.5-1.5 2.1-.3z"/>',
    turismo: '<path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.3" r="3.4"/>',
    comercio: '<path d="M5 8h14l-1.1 12.5H6.1z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
    parques: '<path d="M12 3c-3.3 0-5.4 2.6-5 5.6C4.6 9.4 4.2 13.8 7.4 15h9.2c3.2-1.2 2.8-5.6.4-6.4.4-3-1.7-5.6-5-5.6z"/><path d="M12 21v-9M12 15.5l-2.6-2.2M12 13.8l2.4-1.9"/>',
    lazer: '<path d="M3.5 11.5a8.5 8.5 0 0 1 17 0z"/><path d="M12 11.5v6.5M12 3v1"/><path d="M2.5 20.5c1.6 0 1.6-1 3.2-1s1.6 1 3.2 1 1.6-1 3.1-1 1.6 1 3.2 1 1.6-1 3.2-1 1.6 1 3.1 1"/>',
    cultura: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="m4 16.5 4.5-4.5 3.5 3.5 2.5-2.5 5.5 5.5"/><circle cx="15" cy="8.7" r="1.6"/>',
    publico: '<path d="M12 3 3.5 8h17z"/><path d="M4.5 10.5h15M6 10.5v7M10 10.5v7M14 10.5v7M18 10.5v7M4 17.5h16M3 21h18"/>',
    transporte: '<rect x="5" y="3.5" width="14" height="14" rx="2.5"/><path d="M5 10.5h14M8 17.5V20.5M16 17.5V20.5"/><circle cx="8.6" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="15.4" cy="14" r="1" fill="currentColor" stroke="none"/>',
    educacao: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11.2v4.3c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.3M21.5 9v5"/>',
    saude: '<path d="M9.5 3.5h5V9h5.5v5h-5.5v5.5h-5V14H4V9h5.5z"/>'
  };
  function catSvg(k, size) { return CAT_ICON[k] ? '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + CAT_ICON[k] + '</svg>' : ''; }
  function catIcon(k, size) { return CAT_ICON[k] ? '<span class="cat-ic" aria-hidden="true" title="' + esc(CAT[k] || '') + '">' + catSvg(k, size || 22) + '</span>' : ''; }
  function titulo(p, size) { return catIcon(p.categoria, size) + '<span>' + esc(p.nome) + '</span>'; }
  var MK_FILL = { v: 'var(--sv)', a: 'var(--sa)', c: 'var(--sc)', f: 'var(--faders)' };
  /* Símbolos dentro do marcador (raio 1): ✓ verificado, balão de conversa
     para avaliado pela comunidade (alguém contou como foi), alfinete para
     cadastrado, F para o selo. A cor nunca é a única pista. */
  function mkGlyph(t) {
    var k = '#050E22';
    if (t === 'v') return '<path d="M-.5 .03 L-.14 .38 L.5 -.34" fill="none" stroke="' + k + '" stroke-width=".27" stroke-linecap="round" stroke-linejoin="round"/>';
    if (t === 'a') return '<path d="M-.42-.5h.84a.16 .16 0 0 1 .16 .16v.56a.16 .16 0 0 1-.16 .16H.04L-.36 .62V.38h-.06a.16 .16 0 0 1-.16-.16v-.56a.16 .16 0 0 1 .16-.16z" fill="' + k + '"/><circle cx="-.27" cy="-.06" r=".085" fill="' + MK_FILL.a + '"/><circle cy="-.06" r=".085" fill="' + MK_FILL.a + '"/><circle cx=".27" cy="-.06" r=".085" fill="' + MK_FILL.a + '"/>';
    if (t === 'c') return '<path d="M0 .62C-.1 .44-.42 .1-.42-.13a.42 .42 0 0 1 .84 0C.42 .1 .1 .44 0 .62z" fill="' + k + '"/><circle cy="-.14" r=".15" fill="' + MK_FILL.c + '"/>';
    return '<text y=".05" font-size="1.25" font-weight="800" text-anchor="middle" dominant-baseline="central" fill="' + k + '" font-family="Atkinson Hyperlegible Next, system-ui, sans-serif">F</text>';
  }
  function mkIcon(t, ring, size) {
    size = size || 26;
    var shape = t === 'f' ? '<rect class="b" x="-1" y="-1" width="2" height="2" rx=".35" fill="' + MK_FILL[t] + '" stroke="#050E22" stroke-width=".14"/>' : '<circle class="b" r="1" fill="' + MK_FILL[t] + '" stroke="#050E22" stroke-width=".14"/>';
    var vb = ring ? '-1.45 -1.45 2.9 2.9' : '-1.12 -1.12 2.24 2.24';
    return '<svg width="' + size + '" height="' + size + '" viewBox="' + vb + '" aria-hidden="true">' + (ring ? '<circle r="1.32" fill="none" stroke="var(--faders)" stroke-width=".22"/>' : '') + shape + mkGlyph(t) + '</svg>';
  }
  function sitBadge(p) {
    var s = p.st, txt = A.SITU[s].curto + (s === 'a' && p.avaliacoes ? ' · ' + p.avaliacoes : '');
    return '<span class="nivel s' + s + '">' + mkIcon(s, false, 20) + '<span>' + esc(txt) + '</span>' + (s === 'a' && p.avaliacoes ? '<span class="sr"> ' + (p.avaliacoes === 1 ? 'avaliação' : 'avaliações') + '</span>' : '') + '</span>';
  }
  function sitBadgeKey(s) { return '<span class="nivel s' + s + '">' + mkIcon(s, false, 20) + '<span>' + esc(A.SITU[s].curto) + '</span></span>'; }
  function fadersBadge(f, ano) { return f ? '<span class="fbadge">' + mkIcon('f', false, 18) + 'Selo FADERS ' + esc(A.FAD[f]) + (ano ? ' · ' + esc(ano) : '') + '</span>' : ''; }
  /* ---------- Rede Praia Acessível: guaritas, balneários e piscinas ----------
     Vêm de praia-acessivel.json (a temporada está no próprio arquivo). No
     mapa, o símbolo do cadeirante num quadrado azul, como nas placas de
     acesso, para não confundir com os lugares do guia (círculos). */
  var PRAIA_TRECHOS = ['Litoral Norte', 'Litoral Sul', 'Águas internas', 'Piscinas'];
  var PRAIA_TIPO = { mar: 'Mar', aguas: 'Rio ou lagoa', piscina: 'Piscina' };
  var PRAIA_SERV = {
    mar: 'Banho de mar assistido, com cadeira anfíbia e guarda-vidas do CBMRS. Gratuito.',
    aguas: 'Banho assistido em rio ou lagoa, com cadeira anfíbia e guarda-vidas do CBMRS. Gratuito.',
    piscina: 'Banho assistido em piscina acessível. Gratuito.'
  };
  function praiaGlyph() { return '<g transform="scale(.078) translate(-12 -11.8)" style="color:#fff">' + ICON.mob + '</g>'; }
  function praiaIcon(size) { size = size || 26; return '<svg class="pr-ic" width="' + size + '" height="' + size + '" viewBox="-1.12 -1.12 2.24 2.24" aria-hidden="true"><rect x="-1" y="-1" width="2" height="2" rx=".38" fill="var(--praia)" stroke="#fff" stroke-width=".12"/>' + praiaGlyph() + '</svg>'; }
  function praiaById(id) { return state.praia.filter(function (x) { return x.id === id; })[0]; }
  function praiaCidade(p) { return p.cidade || munName(p.mun); }
  function praiaRota(p) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([p.tipo === 'piscina' ? p.nome : (p.tipo === 'mar' ? 'Praia ' : '') + p.nome, p.cidade ? '' : munName(p.mun), 'RS'].filter(Boolean).join(', ')); }
  function praiaItem(p) { return '<li><button type="button" class="pitem" data-praia="' + esc(p.id) + '"><b class="ttl">' + praiaIcon(24) + '<span>' + esc(p.nome) + '</span></b><span class="meta"><span>' + esc(p.guaritas) + ' · ' + esc(praiaCidade(p)) + '</span></span></button></li>'; }

  var SV = { 2: 'Atende', 1: 'Parcial', 0: 'Sem informação' };
  var SVC = { 2: '✓ Atende', 1: '◐ Parcial', 0: '— Sem info' };
  function dimsHTML(p) { return '<div class="dims">' + A.DIMS.map(function (d) { return '<div class="dim v' + p.dimv[d.k] + '">' + icon(d.k, 22) + '<span>' + esc(d.nome) + '</span><span class="s">' + SVC[p.dimv[d.k]] + '</span></div>'; }).join('') + '</div>'; }

  /* ---------- Estado ---------- */
  var state = { locais: [], municipios: {}, praia: [], praiaInfo: {}, showPraia: true, status: 'loading', fSit: new Set(), fDim: new Set(), fCat: new Set(), sel: { type: 'estado', id: null }, vb: { x: 0, y: 0, w: 1000, h: 960 } };

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
  var VIEWS = ['mapa', 'lista', 'praia', 'avaliar', 'cadastro', 'avaliacao', 'sobre'];
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
    $('#l-niv').innerHTML = '<option value="">Todas</option>' + A.SITU_ORDER.map(function (s) { return '<option value="' + s + '">' + esc(A.SITU[s].nome) + '</option>'; }).join('') + '<option value="f">Com Selo FADERS</option>';
    $('#c-dims').innerHTML = recFieldsets('cr', true);
    $('#a-dims').innerHTML = recFieldsets('ar', true);
    $('#f-niv').innerHTML = A.SITU_ORDER.map(function (s) { return '<button type="button" class="chip" aria-pressed="false" data-sit="' + s + '">' + mkIcon(s, false, 24) + esc(A.SITU[s].curto) + '</button>'; }).join('') + '<button type="button" class="chip" aria-pressed="false" data-sit="f">' + mkIcon('f', false, 24) + 'Selo FADERS</button>';
    $('#f-dim').innerHTML = A.DIMS.map(function (d) { return '<button type="button" class="chip" aria-pressed="false" data-dim="' + d.k + '">' + icon(d.k, 22) + esc(d.nome) + '</button>'; }).join('');
    $('#f-cat').innerHTML = A.CATS.map(function (c) { return '<button type="button" class="chip t" aria-pressed="false" data-cat="' + c[0] + '">' + catSvg(c[0], 18) + esc(c[1]) + '</button>'; }).join('');
    $('#legend').innerHTML = A.SITU_ORDER.map(function (s) { return '<div>' + mkIcon(s, false, 28) + '<span><b>' + esc(A.SITU[s].nome) + '</b></span></div>'; }).join('')
      + '<div>' + mkIcon('f', false, 28) + '<span><b>Só Selo Estadual FADERS</b></span></div><div>' + mkIcon('c', true, 32) + '<span>Anel azul: também tem o Selo FADERS</span></div>'
      + '<div>' + praiaIcon(28) + '<span><b>Praia Acessível</b>: guarita, balneário ou piscina com banho assistido</span></div>'
      + '<p class="hint" style="margin-top:.2rem">A cor diz de onde veio a informação, não dá nota ao lugar. <a href="#avaliacao">Como funciona</a></p>';
    $('#dimcards').innerHTML = A.DIMS.map(function (d) { return '<article class="dimcard"><h3>' + icon(d.k, 28) + esc(d.nome) + '</h3><p class="hint">' + esc(d.longo) + '</p><ul>' + d.recs.map(function (r) { return '<li>' + esc(r[1]) + '</li>'; }).join('') + '</ul><p class="rule">' + esc(d.regra) + '</p></article>'; }).join('');
    $('#gerais').textContent = A.GERAIS.map(function (r) { return r[1].replace(/ \(.*\)$/, '').toLowerCase(); }).join('; ') + '.';
    $('#levelcards').innerHTML = A.SITU_ORDER.slice().reverse().map(function (s, i) { return '<div class="level s' + s + '"><span class="eyebrow">Etapa ' + (i + 1) + '</span><div class="lv">' + mkIcon(s, false, 34) + esc(A.SITU[s].nome) + '</div><p>' + esc(A.SITU[s].desc) + '</p></div>'; }).join('')
      + '<div class="level sf"><span class="eyebrow">À parte</span><div class="lv">' + mkIcon('f', false, 34) + 'Selo FADERS</div><p>Certificação oficial do Governo do Estado, por vistoria técnica. Quando o lugar tem, mostramos junto, com um anel azul no marcador.</p></div>';
    $('#refs').innerHTML = REFS.map(function (r) { return '<article class="ref"><span class="where">' + esc(r.onde) + '</span><h3>' + esc(r.nome) + '</h3><p>' + esc(r.txt) + '</p><a href="' + esc(r.url) + '" target="_blank" rel="noopener">Ver fonte (' + esc(host(r.url)) + ')</a></article>'; }).join('');
    $('#fontes').innerHTML = FONTES.map(function (f) { return '<li><a href="' + esc(f[1]) + '" target="_blank" rel="noopener">' + esc(f[0]) + '</a></li>'; }).join('');
  }

  /* ---------- Mapa ---------- */
  var svg = $('#map'), gMk = null, gLbl = null, gPr = null;
  function buildMap() {
    var h = '<g id="g-reg">';
    MAP.regioes.forEach(function (r) { h += '<path class="reg" data-reg="' + r.cod + '" d="' + r.d + '" style="fill:var(--r' + r.cod + ')"/>'; });
    h += '</g><g id="g-mun">';
    MUNS.forEach(function (m) { if (m.d) h += '<path class="mun" data-cod="' + m.cod + '" d="' + m.d + '"/>'; });
    h += '</g><g>';
    MAP.regioes.forEach(function (r) { h += '<path class="regline" d="' + r.d + '"/>'; });
    h += '</g><path class="rsline" d="' + MAP.rs + '"/><g id="g-lbl"></g><g id="g-praia"></g><g id="g-mk"></g>';
    svg.insertAdjacentHTML('beforeend', h);
    gMk = $('#g-mk'); gLbl = $('#g-lbl'); gPr = $('#g-praia');
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
      if (state.fSit.size && !(state.fSit.has(p.st) || (state.fSit.has('f') && p.faders))) return false;
      var ok = true; state.fDim.forEach(function (d) { if (p.dimv[d] !== 2) ok = false; });
      return ok;
    });
  }
  /* Ordem: informação mais confiável primeiro, depois quem cobre mais tipos de necessidade */
  function byNivelNome(a, b) { return b.rank - a.rank || b.atende - a.atende || String(a.nome).localeCompare(String(b.nome), 'pt-BR'); }
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
    list.slice().sort(function (a, b) { return a.rank - b.rank; }).forEach(function (p) {
      var xy = pos.get(p.id); if (!xy) return;
      var t = mkType(p), sel = state.sel.type === 'local' && state.sel.id === p.id ? ' sel' : '';
      var shape = t === 'f' ? '<rect class="b" x="-1" y="-1" width="2" height="2" rx=".35" fill="' + MK_FILL[t] + '"/>' : '<circle class="b" r="1" fill="' + MK_FILL[t] + '"/>';
      h += '<g class="mk' + sel + '" data-id="' + esc(p.id) + '" data-x="' + xy[0].toFixed(1) + '" data-y="' + xy[1].toFixed(1) + '"><title>' + esc(p.nome) + ' · ' + esc(A.SITU[p.st].nome) + (p.faders ? ' · Selo FADERS ' + esc(A.FAD[p.faders]) : '') + '</title>' + (p.faders && t !== 'f' ? '<circle class="ring" r="1.3"/>' : '') + shape + mkGlyph(t) + '</g>';
    });
    gMk.innerHTML = h;
    renderPraia();
  }
  /* Guaritas da Rede Praia Acessível (o selecionado fica por cima) */
  function renderPraia() {
    if (!gPr) return;
    var h = '', selId = state.sel.type === 'praia' ? state.sel.id : null, T = state.praiaInfo.temporada || '';
    if (state.showPraia) state.praia.slice().sort(function (a, b) { return (a.id === selId) - (b.id === selId); }).forEach(function (p) {
      var xy = proj(p.lon, p.lat);
      h += '<g class="mk mkp' + (p.id === selId ? ' sel' : '') + '" data-praia="' + esc(p.id) + '" data-x="' + xy[0].toFixed(1) + '" data-y="' + xy[1].toFixed(1) + '"><title>' + esc(p.nome) + ' · Praia Acessível ' + esc(T) + '</title><rect class="b" x="-1" y="-1" width="2" height="2" rx=".38"/>' + praiaGlyph() + '</g>';
    });
    gPr.innerHTML = h;
    updateMarkerScale();
  }
  function updateMarkerScale() {
    if (!gMk || !svgW()) return;
    var u = unitsPerPx(), k = 11 * u * (FS[fsIdx] / 112.5);
    Array.prototype.forEach.call(gMk.children, function (g) { g.setAttribute('transform', 'translate(' + g.dataset.x + ',' + g.dataset.y + ') scale(' + k.toFixed(3) + ')'); });
    if (gPr) Array.prototype.forEach.call(gPr.children, function (g) { g.setAttribute('transform', 'translate(' + g.dataset.x + ',' + g.dataset.y + ') scale(' + (k * 0.86).toFixed(3) + ')'); });
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
      if (t.classList.contains('mk') && t.dataset.praia) { var pg = praiaById(t.dataset.praia); tip.textContent = pg ? pg.nome + ' · ' + pg.guaritas : ''; }
      else if (t.classList.contains('mk')) { var pl = state.locais.filter(function (p) { return p.id === t.dataset.id; })[0]; tip.textContent = pl ? pl.nome : ''; }
      else tip.textContent = munName(t.dataset.cod);
      tip.style.left = (e.clientX - pb.left) + 'px'; tip.style.top = (e.clientY - pb.top) + 'px'; tip.hidden = !tip.textContent;
    });
    svg.addEventListener('pointerup', function (e) {
      if (!down) return;
      var wasMoved = moved; down = null; moved = false; svg.classList.remove('dragging');
      try { svg.releasePointerCapture(e.pointerId); } catch (x) {}
      if (wasMoved) return;
      var t = e.target.closest('.mk, .mun, .reg'); if (!t) return;
      if (t.classList.contains('mk') && t.dataset.praia) selectPraia(t.dataset.praia, false);
      else if (t.classList.contains('mk')) selectPlace(t.dataset.id, false);
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
  function selectPraia(id, zoom) {
    var p = praiaById(id); if (!p) return;
    state.sel = { type: 'praia', id: id };
    if (zoom !== false || MAP.W / state.vb.w < 1.6) zoomMun(p.mun);
    renderSide(); renderMunClasses(); renderMarkers();
  }
  /* Todas as guaritas: aproxima no Litoral Norte, onde fica a maioria */
  function selectPraias() {
    if (!MAP || !state.praia.length) return;
    if (!state.showPraia) { state.showPraia = true; var fp = $('#f-praia'); if (fp) fp.setAttribute('aria-pressed', 'true'); }
    state.sel = { type: 'praias', id: null };
    var xs = [], ys = [];
    state.praia.forEach(function (p) { if (p.trecho !== 'Litoral Norte') return; var q = proj(p.lon, p.lat); xs.push(q[0]); ys.push(q[1]); });
    var x0 = Math.min.apply(null, xs), y0 = Math.min.apply(null, ys);
    animateTo(fitBox({ x: x0, y: y0, width: Math.max.apply(null, xs) - x0, height: Math.max.apply(null, ys) - y0 }, 1.25));
    renderSide(); renderMunClasses(); renderMarkers();
  }

  /* ---------- Painel lateral ---------- */
  function placeItems(list, max) {
    max = max || 50;
    if (!list.length) return '<p class="empty">Nenhum lugar com os filtros atuais.</p>';
    var sorted = list.slice().sort(byNivelNome);
    return '<ul class="placelist">' + sorted.slice(0, max).map(function (p) { return '<li><button type="button" class="pitem" data-place="' + esc(p.id) + '"><b class="ttl">' + titulo(p, 20) + '</b><span class="meta">' + sitBadge(p) + (p.faders ? fadersBadge(p.faders) : '') + '<span>' + esc(CAT[p.categoria] || '—') + ' · ' + esc(munName(p.mun)) + '</span></span></button></li>'; }).join('') + '</ul>' + (sorted.length > max ? '<p class="hint">Mostrando ' + max + ' de ' + sorted.length + '. Veja todos na aba Lista.</p>' : '');
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
        + '<div><p class="eyebrow" style="margin-bottom:.45rem">Lugares (' + inMun.length + ')</p>' + (notice() || placeItems(inMun)) + '</div>' + praiaMunHTML(sel.id) + '</div>';
    } else if (sel.type === 'praia') {
      var g = praiaById(sel.id), I = state.praiaInfo;
      if (!g) { state.sel = { type: 'estado', id: null }; renderSide(); return; }
      var pf = safeUrl(I.fonte), tel = String(I.disque || '').replace(/\D/g, '');
      ctx.innerHTML = '<div class="stack"><button type="button" class="back" data-go="praias">← Todas as guaritas</button>'
        + '<div><p class="eyebrow">Rede Praia Acessível · ' + esc(I.temporada || '') + '</p><h2 class="ttl" style="font-size:1.45rem">' + praiaIcon(34) + '<span>' + esc(g.nome) + '</span></h2></div>'
        + '<dl class="kv"><dt>Onde</dt><dd>' + esc(g.guaritas) + '</dd><dt>Cidade</dt><dd>' + esc(praiaCidade(g)) + '</dd><dt>Trecho</dt><dd>' + esc(g.trecho) + ' · ' + esc(PRAIA_TIPO[g.tipo] || '') + '</dd><dt>Serviço</dt><dd>' + esc(PRAIA_SERV[g.tipo] || '') + '</dd>'
        + (tel ? '<dt>Contato</dt><dd>Disque Banho Assistido: <a href="tel:+55' + esc(tel) + '">' + esc(I.disque) + '</a></dd>' : '') + '</dl>'
        + '<p class="hint">Ponto da temporada ' + esc(I.temporada || '') + '. A lista da próxima temporada é divulgada pela FADERS e pelo Governo do RS: confirme antes de ir.</p>'
        + '<div class="row"><a class="btn small" href="#avaliar" data-avaliar-praia="' + esc(g.id) + '">Avaliar este ponto</a><a class="btn small ghost" href="' + esc(praiaRota(g)) + '" target="_blank" rel="noopener">Como chegar</a>' + (g.cidade ? '' : '<button type="button" class="btn small ghost" data-mun="' + esc(g.mun) + '">Ver ' + esc(munName(g.mun)) + '</button>') + '</div>'
        + (pf ? '<p style="font-size:.92rem"><a href="' + esc(pf) + '" target="_blank" rel="noopener">Fonte: ' + esc(I.fonteNome || host(pf)) + '</a></p>' : '') + '</div>';
    } else if (sel.type === 'praias') {
      ctx.innerHTML = '<div class="stack"><button type="button" class="back" data-go="estado">← Estado inteiro</button>'
        + '<div><p class="eyebrow">Rede Praia Acessível · ' + esc(state.praiaInfo.temporada || '') + '</p><h2 class="ttl" style="font-size:1.45rem">' + praiaIcon(34) + '<span>Onde teve guarita acessível</span></h2><p class="muted" style="font-size:.95rem">' + state.praia.length + ' pontos com banho assistido no mar, em rios, lagoas e piscinas. Escolha um para ver os detalhes.</p></div>'
        + '<div class="praias-scroll" tabindex="0" role="region" aria-label="Lista das guaritas acessíveis">' + PRAIA_TRECHOS.map(function (t) { var l = state.praia.filter(function (p) { return p.trecho === t; }); return l.length ? '<div><p class="eyebrow" style="margin-bottom:.45rem">' + esc(t) + ' (' + l.length + ')</p><ul class="placelist">' + l.map(praiaItem).join('') + '</ul></div>' : ''; }).join('') + '</div></div>';
    } else if (sel.type === 'local') {
      var p = state.locais.filter(function (x) { return x.id === sel.id; })[0];
      if (!p) { state.sel = { type: 'estado', id: null }; renderSide(); return; }
      var site = safeUrl(p.site), fonte = safeUrl(p.fonte), fotos = safeUrl(p.fotos);
      ctx.innerHTML = '<div class="stack"><button type="button" class="back" data-mun="' + esc(p.mun) + '">← ' + esc(munName(p.mun)) + '</button>'
        + '<div><p class="eyebrow">' + esc(CAT[p.categoria] || 'Lugar') + '</p><h2 class="ttl" style="font-size:1.45rem">' + titulo(p, 27) + '</h2></div>'
        + '<div class="row">' + sitBadge(p) + fadersBadge(p.faders, p.fadersAno) + '</div>'
        + '<p class="hint">' + esc(A.SITU[p.st].desc) + '</p>'
        + dimsHTML(p)
        + '<dl class="kv"><dt>Cidade</dt><dd>' + esc(munName(p.mun)) + ' · ' + esc(REG[regOf(p.mun)] ? REG[regOf(p.mun)].nome : '') + '</dd>' + (p.endereco ? '<dt>Endereço</dt><dd>' + esc(p.endereco) + '</dd>' : '') + (p.contato ? '<dt>Contato</dt><dd>' + esc(p.contato) + '</dd>' : '') + (site ? '<dt>Site</dt><dd><a href="' + esc(site) + '" target="_blank" rel="noopener">' + esc(host(site)) + '</a></dd>' : '') + '<dt>Avaliações</dt><dd>' + (p.avaliacoes ? p.avaliacoes + ' da comunidade' : 'Ainda nenhuma. Seja a primeira pessoa a avaliar.') + '</dd></dl>'
        + (p.recursos.length ? '<div><p class="eyebrow" style="margin-bottom:.4rem">Recursos</p><div class="recs">' + p.recursos.map(function (r) { return '<span class="rec">' + esc(A.REC[r]) + '</span>'; }).join('') + '</div></div>' : '')
        + (p.obs ? '<p style="font-size:.95rem">' + esc(p.obs) + '</p>' : '')
        + '<div class="row"><a class="btn small" href="#avaliar" data-avaliar="' + esc(p.id) + '">Avaliar este lugar</a><a class="btn small ghost" href="' + esc(rotaUrl(p)) + '" target="_blank" rel="noopener">Como chegar</a></div>'
        + ((fotos || fonte) ? '<p style="font-size:.92rem">' + (fotos ? '<a href="' + esc(fotos) + '" target="_blank" rel="noopener">Ver fotos</a>' : '') + (fotos && fonte ? ' · ' : '') + (fonte ? '<a href="' + esc(fonte) + '" target="_blank" rel="noopener">Fonte: ' + esc(host(fonte)) + '</a>' : '') + '</p>' : '') + '</div>';
    } else {
      var byReg = {}; list.forEach(function (p) { var r = regOf(p.mun); byReg[r] = (byReg[r] || 0) + 1; });
      ctx.innerHTML = '<div class="stack"><div><p class="eyebrow">Regiões</p><p class="muted" style="font-size:.95rem">Escolha uma região para ver as cidades e os lugares.</p></div>'
        + '<ul class="reglist">' + REG_ORDER.map(function (r) { return '<li><button type="button" data-reg="' + r + '"><span class="nm"><span class="sw" style="background:var(--r' + r + ')"></span>' + esc(REG[r].nome) + '</span><span class="ct">' + (state.status === 'ok' ? (byReg[r] || 0) + ' lugares' : '') + '</span></button></li>'; }).join('') + '</ul>' + notice()
        + (state.praia.length ? '<div class="praia-box"><p class="eyebrow">Rede Praia Acessível · ' + esc(state.praiaInfo.temporada || '') + '</p><p>' + praiaIcon(26) + '<span>' + state.praia.length + ' pontos com banho assistido: mar, rios, lagoas e piscinas. No mapa, o símbolo do cadeirante.</span></p><button type="button" class="btn small" data-go="praias">Ver as guaritas</button></div>' : '')
        + '</div>';
    }
  }
  function praiaMunHTML(cod) {
    var l = state.praia.filter(function (p) { return p.mun === cod; }); if (!l.length) return '';
    return '<div><p class="eyebrow" style="margin-bottom:.45rem">Praia Acessível · ' + esc(state.praiaInfo.temporada || '') + ' (' + l.length + ')</p><ul class="placelist">' + l.map(praiaItem).join('') + '</ul></div>';
  }
  /* Lista da aba Praia Acessível, por trecho; cada item abre o ponto no mapa */
  function renderPraiaLista() {
    var box = $('#praia-lista'); if (!box || !state.praia.length) return;
    box.innerHTML = PRAIA_TRECHOS.map(function (t) {
      var l = state.praia.filter(function (p) { return p.trecho === t; }); if (!l.length) return '';
      return '<div class="pl-grupo"><h4>' + esc(t) + '</h4><ul>' + l.map(function (p) { return '<li><a href="#mapa" data-praia-ir="' + esc(p.id) + '">' + praiaIcon(22) + '<span><b>' + esc(p.nome) + '</b><span>' + esc(p.guaritas) + (p.cidade || norm(p.nome) === norm(munName(p.mun)) ? '' : ' · ' + esc(munName(p.mun))) + '</span></span></a></li>'; }).join('') + '</ul></div>';
    }).join('');
    var t = $('#praia-temporada'); if (t) t.textContent = state.praiaInfo.temporada || '';
  }
  function bindSide() {
    $('#ctx').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !MAP) return;
      if (b.dataset.place) selectPlace(b.dataset.place);
      else if (b.dataset.praia) selectPraia(b.dataset.praia);
      else if (b.dataset.mun) selectMun(b.dataset.mun);
      else if (b.dataset.reg) selectRegion(b.dataset.reg);
      else if (b.dataset.go === 'praias') selectPraias();
      else if (b.dataset.go === 'estado') { state.sel = { type: 'estado', id: null }; resetView(); renderSide(); renderMunClasses(); renderMarkers(); }
    });
    var fp = $('#f-praia');
    if (fp) fp.addEventListener('click', function () { state.showPraia = !state.showPraia; fp.setAttribute('aria-pressed', state.showPraia); renderPraia(); });
    function toggle(set, key, b) { if (set.has(key)) set.delete(key); else set.add(key); b.setAttribute('aria-pressed', set.has(key)); renderMarkers(); renderSide(); }
    $('#f-niv').addEventListener('click', function (e) { var b = e.target.closest('[data-sit]'); if (b) toggle(state.fSit, b.dataset.sit, b); });
    $('#f-dim').addEventListener('click', function (e) { var b = e.target.closest('[data-dim]'); if (b) toggle(state.fDim, b.dataset.dim, b); });
    $('#f-cat').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (!b) return; toggle(state.fCat, b.dataset.cat, b); $('#cat-count').textContent = state.fCat.size ? '· ' + state.fCat.size + ' escolhido' + (state.fCat.size > 1 ? 's' : '') : ''; });
    var last = '';
    $('#busca').addEventListener('change', function (e) { if (norm(e.target.value) === last) return; last = norm(e.target.value); runSearch(e.target.value); });
    $('#busca').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); last = norm(e.target.value); runSearch(e.target.value); } });
  }
  function fillSearchList() {
    var opts = MUNS.map(function (m) { return '<option value="' + esc(m.n) + '">Cidade · ' + esc(REG[m.r].nome) + '</option>'; });
    state.locais.forEach(function (p) { opts.push('<option value="' + esc(p.nome) + '">' + esc(CAT[p.categoria] || 'Lugar') + ' · ' + esc(munName(p.mun)) + '</option>'); });
    state.praia.forEach(function (p) { if (norm(p.nome) !== norm(munName(p.mun))) opts.push('<option value="' + esc(p.nome) + '">Praia Acessível · ' + esc(praiaCidade(p)) + '</option>'); });
    $('#dl-busca').innerHTML = opts.join('');
  }
  function runSearch(v) {
    var q = norm(v); if (!q || !MAP) return;
    var cod = MUN_BY_NAME.get(q); if (cod) return selectMun(cod);
    var exact = state.locais.filter(function (p) { return norm(p.nome) === q; })[0]; if (exact) return selectPlace(exact.id);
    if (/guarita|praia acessivel|cadeira anfibia|banho assistido/.test(q)) return selectPraias();
    var pr = state.praia.filter(function (p) { return norm(p.nome) === q; })[0] || state.praia.filter(function (p) { return norm(p.nome).indexOf(q) >= 0; })[0]; if (pr) return selectPraia(pr.id);
    var part = state.locais.filter(function (p) { return norm(p.nome).indexOf(q) >= 0 || norm(CAT[p.categoria]).indexOf(q) >= 0; })[0]; if (part) return selectPlace(part.id);
    var mp = MUNS.filter(function (m) { return norm(m.n).indexOf(q) === 0; })[0]; if (mp) return selectMun(mp.cod);
    toast('Nada encontrado para essa busca.');
  }

  /* ---------- Números ---------- */
  function renderStats() {
    var ok = state.status === 'ok', c = { v: 0, a: 0, c: 0 }, f = 0;
    state.locais.forEach(function (p) { c[p.st]++; if (p.faders) f++; });
    function v(n) { return ok ? n : '–'; }
    var rot = { v: ['verificado', 'verificados'], a: ['avaliado pela comunidade', 'avaliados pela comunidade'], c: ['cadastrado', 'cadastrados'] };
    $('#stats').innerHTML = '<div class="stat plain"><b>' + v(state.locais.length) + '</b><span>lugares no guia</span></div>'
      + A.SITU_ORDER.map(function (s) { return '<div class="stat">' + mkIcon(s, false, 26) + '<b>' + v(c[s]) + '</b><span>' + rot[s][c[s] === 1 ? 0 : 1] + '</span></div>'; }).join('')
      + '<div class="stat">' + mkIcon('f', false, 26) + '<b>' + v(f) + '</b><span>com Selo FADERS</span></div>';
  }

  /* ---------- Lista ---------- */
  function renderList() {
    var q = norm($('#l-q').value), r = $('#l-reg').value, c = $('#l-cat').value, n = $('#l-niv').value;
    var list = state.locais.filter(function (p) { return (!r || regOf(p.mun) === r) && (!c || p.categoria === c) && (!n || (n === 'f' ? !!p.faders : p.st === n)); });
    if (q) list = list.filter(function (p) { return norm([p.nome, munName(p.mun), CAT[p.categoria], p.endereco].concat(p.recursos.map(function (k) { return A.REC[k]; })).join(' ')).indexOf(q) >= 0; });
    list.sort(byNivelNome);
    $('#l-count').textContent = state.status !== 'ok' ? '' : list.length + ' ' + (list.length === 1 ? 'lugar' : 'lugares');
    var nt = notice();
    if (nt) { $('#l-cards').innerHTML = nt; return; }
    if (!list.length) { $('#l-cards').innerHTML = '<p class="empty">Nenhum lugar com esses filtros.</p>'; return; }
    $('#l-cards').innerHTML = list.map(function (p) {
      var fonte = safeUrl(p.fonte), site = safeUrl(p.site);
      return '<article class="card"><h3 class="ttl">' + titulo(p, 25) + '</h3><div class="row">' + sitBadge(p) + fadersBadge(p.faders, p.fadersAno) + '</div>'
        + '<p class="where">' + esc(CAT[p.categoria] || '—') + ' · ' + esc(munName(p.mun)) + ' · ' + esc(REG[regOf(p.mun)] ? REG[regOf(p.mun)].nome : '') + '</p>'
        + dimsHTML(p)
        + (p.obs ? '<p style="font-size:.95rem" class="muted">' + esc(p.obs) + '</p>' : '')
        + '<div class="foot"><a href="#mapa" data-show="' + esc(p.id) + '">Ver no mapa</a><a href="#avaliar" data-avaliar="' + esc(p.id) + '">Avaliar</a>' + (site ?'<a href="' + esc(site) + '" target="_blank" rel="noopener">Site</a>' : '') + (fonte ? '<a href="' + esc(fonte) + '" target="_blank" rel="noopener">Fonte</a>' : '') + '</div></article>';
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
    $('#c-calc').innerHTML = '<span class="hint" style="font-weight:800">O lugar entra no guia como</span>' + sitBadgeKey('c') + '<span class="hint">' + A.DIMS.map(function (d) { return d.nome + ': ' + SV[av.v[d.k]].toLowerCase(); }).join(' · ') + '</span>'
      + '<span class="hint">Depois sobe para <b>Avaliado pela comunidade</b>, quando pessoas com deficiência avaliarem a visita, e para <b>Verificado</b>, quando a equipe conferir fotos e documentos.</span>';
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

  /* ---------- Avaliação de quem visitou ----------
     Chega como mensagem (Formspree/WhatsApp, pelo /js/rb-lista.js). A equipe
     confere e soma a avaliação no painel; com uma ou mais, o lugar passa a
     "Avaliado pela comunidade". */
  function fillPlaceList() {
    $('#dl-lugares').innerHTML = state.locais.slice().sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); })
      .map(function (p) { return '<option value="' + esc(p.nome) + '">' + esc(munName(p.mun)) + '</option>'; }).join('');
  }
  function prefillAval(id) {
    var p = state.locais.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    $('#a-lugar').value = p.nome; $('#a-mun').value = munName(p.mun); $('#a-id').value = p.id;
  }
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-avaliar]'); if (a) prefillAval(a.dataset.avaliar); });
  /* Praia Acessível: avaliar um ponto, abrir um ponto no mapa (aba Praia) e "ver as guaritas" (manchete) */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var a = e.target.closest('[data-avaliar-praia]');
    if (a) { var p = praiaById(a.dataset.avaliarPraia); if (p) { $('#a-lugar').value = 'Praia Acessível · ' + p.nome + ' (' + p.guaritas + ')'; $('#a-mun').value = p.cidade ? '' : munName(p.mun); $('#a-id').value = 'praia:' + p.id; } return; }
    var ir = e.target.closest('[data-praia-ir]');
    if (ir) { setTimeout(function () { selectPraia(ir.dataset.praiaIr); irAoMapa(); }, 80); return; }
    var ver = e.target.closest('[data-ver-praia]');
    if (ver) { e.preventDefault(); if (location.hash !== '#mapa' && location.hash !== '') location.hash = '#mapa'; setTimeout(function () { selectPraias(); irAoMapa(); }, 80); }
  });
  function irAoMapa() { var mg = $('.mapgrid'); if (mg) mg.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
  $('#f-av').addEventListener('reset', function () { setTimeout(function () { $('#a-id').value = ''; }, 0); });
  $('#a-lugar').addEventListener('change', function () {
    var q = norm(this.value), p = state.locais.filter(function (x) { return norm(x.nome) === q; })[0];
    $('#a-id').value = p ? p.id : '';
    if (p && !$('#a-mun').value.trim()) $('#a-mun').value = munName(p.mun);
  });
  $('#f-av').addEventListener('submit', function (e) {
    var err = $('#a-err'); err.hidden = true;
    var miss = [];
    if (!$('#a-lugar').value.trim()) miss.push('nome do lugar');
    var cod = munCod($('#a-mun').value);
    if (!cod) miss.push('cidade (escolha um nome da lista)'); else $('#a-mun').value = munName(cod);
    if (!$('#a-indica').value) miss.push('se você indicaria o lugar');
    if ($('#a-nome').value.trim().length < 2) miss.push('seu nome');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test($('#a-email').value.trim())) miss.push('e-mail válido');
    if (!$('#a-lgpd').checked) miss.push('autorização de uso dos dados');
    if (miss.length) {
      e.preventDefault(); e.stopImmediatePropagation();
      err.textContent = 'Falta preencher: ' + miss.join(', ') + '.'; err.hidden = false; err.focus();
    }
  }, true);

  /* ---------- Render geral ---------- */
  function renderAll() { renderStats(); renderMunClasses(); renderMarkers(); renderSide(); renderList(); renderSeloMun(); fillSearchList(); fillPlaceList(); }

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
    /* Rede Praia Acessível: arquivo à parte, não depende do painel */
    fetch(BASE + 'praia-acessivel.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      state.praiaInfo = d;
      state.praia = (d.pontos || []).filter(function (p) { return p && p.id && MAP.mun[p.mun] && validCoord(Number(p.lat), Number(p.lon)); });
      renderPraia(); renderSide(); fillSearchList(); renderPraiaLista();
    }).catch(function () {});
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
