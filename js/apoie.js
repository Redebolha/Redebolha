/*
 * Apoie a Rede Bolha — o pedido de apoio do leitor.
 *
 * Entra no FIM do conteúdo (nunca no meio): o leitor recebe a matéria
 * primeiro e só depois é convidado. É o que mais funciona no mundo todo.
 *
 * Onde aparece:
 *   - em qualquer página com um ponto marcado <section data-apoie></section>
 *     (a home tem um, logo depois da editoria de Economia);
 *   - nas demais páginas que carregam js/patrocinio.js, no fim do
 *     <article> (ou do <main>), antes do livro patrocinado.
 *   - nunca na própria página /apoie/.
 *
 * Para trocar o texto, a chave Pix ou os links, edite o objeto TEXTO abaixo.
 * Mede no GA4: apoio_view (a caixa entrou na tela) e apoio_click
 * (com o rótulo: pix_copiar, pagina_apoie ou livros).
 */
(function () {
  'use strict';

  if (/^\/apoie(\/|$)/.test(location.pathname)) return;
  if (document.getElementById('rb-apoie')) return;

  var TEXTO = {
    selo: 'Apoie a Rede Bolha',
    titulo: 'Você chegou até o fim. Posso te pedir uma coisa?',
    corpo: [
      'A Rede Bolha não tem grupo de mídia por trás nem patrão para agradar. Tem um jornalista registrado, apuração com fonte e muito chimarrão.',
      'O anúncio que aparece por aqui ajuda, mas paga pouco. Quem garante que a notícia continue saindo, de verdade, é você.'
    ],
    chave: 'redebolhaoficial@gmail.com',
    botaoPix: 'Apoiar com Pix',
    botaoLivros: 'Ou leve um livro',
    rodape: 'Pix de qualquer valor. Cinco reais já ajudam. E obrigado, de coração.'
  };

  var CSS = [
    '#rb-apoie{position:relative;margin:2.6rem 0;padding:24px 24px 20px;border-radius:14px;',
    '  background:#0E1D3D;border:1px solid #1F3566;color:#EEF2F8;overflow:hidden;',
    '  font-family:inherit;text-align:left;box-shadow:0 14px 30px rgba(0,0,0,.28)}',
    '#rb-apoie::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;',
    '  background:linear-gradient(90deg,#009C3B 0 50%,#FFDF00 50% 100%)}',
    '#rb-apoie .ap-selo{display:block;font-size:.68rem;letter-spacing:.2em;text-transform:uppercase;',
    '  color:#2FBF6B;margin:0 0 10px;font-weight:600}',
    '#rb-apoie .ap-titulo{font-size:1.35rem;line-height:1.25;font-weight:600;margin:0 0 12px;color:#EEF2F8}',
    '#rb-apoie .ap-corpo{font-size:1rem;line-height:1.6;color:#C3CCDB;margin:0 0 10px}',
    '#rb-apoie .ap-pix{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:16px 0 18px;',
    '  padding:12px 14px;border-radius:10px;background:#08142D;border:1px dashed rgba(255,223,0,.45)}',
    '#rb-apoie .ap-pix-rot{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#93A0B8}',
    '#rb-apoie .ap-pix-chave{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.95rem;',
    '  color:#FFDF00;word-break:break-all;flex:1 1 auto}',
    '#rb-apoie .ap-copiar{font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;border-radius:8px;',
    '  padding:8px 14px;border:1px solid #009C3B;background:transparent;color:#EEF2F8;white-space:nowrap}',
    '#rb-apoie .ap-copiar:hover{background:rgba(0,156,59,.2)}',
    '#rb-apoie .ap-copiar.ok{background:#009C3B;color:#fff}',
    '#rb-apoie .ap-acoes{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 14px}',
    '#rb-apoie .ap-btn{display:inline-block;font-weight:700;font-size:.95rem;text-decoration:none;',
    '  border-radius:9px;padding:12px 20px;line-height:1.2}',
    '#rb-apoie .ap-btn-pix{background:#FFDF00;color:#08142D}',
    '#rb-apoie .ap-btn-pix:hover{background:#FFE566}',
    '#rb-apoie .ap-btn-livros{border:1px solid #1F3566;color:#EEF2F8}',
    '#rb-apoie .ap-btn-livros:hover{border-color:#FFDF00;color:#FFDF00}',
    '#rb-apoie .ap-btn:focus-visible,#rb-apoie .ap-copiar:focus-visible{outline:2px solid #FFE566;outline-offset:3px}',
    '#rb-apoie .ap-rodape{font-size:.85rem;color:#93A0B8;margin:0}',
    '@media(max-width:520px){#rb-apoie{padding:22px 18px 18px}#rb-apoie .ap-titulo{font-size:1.2rem}',
    '  #rb-apoie .ap-btn{flex:1 1 100%;text-align:center}}'
  ].join('\n');

  function evento(rotulo) {
    if (typeof window.gtag === 'function') window.gtag('event', 'apoio_click', { rotulo: rotulo });
  }

  function copiar(texto, botao) {
    function pronto() {
      botao.textContent = 'Chave copiada ✓';
      botao.classList.add('ok');
      setTimeout(function () { botao.textContent = 'Copiar chave'; botao.classList.remove('ok'); }, 2600);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(pronto, function () { reserva(); });
    } else { reserva(); }
    function reserva() {
      var t = document.createElement('textarea');
      t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'absolute'; t.style.left = '-9999px';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); pronto(); } catch (e) { window.prompt('Copie a chave Pix:', texto); }
      document.body.removeChild(t);
    }
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }

  function montar() {
    var box = el('aside');
    box.id = 'rb-apoie';
    box.setAttribute('aria-label', TEXTO.selo);

    box.appendChild(el('span', 'ap-selo', TEXTO.selo));
    box.appendChild(el('p', 'ap-titulo', TEXTO.titulo));
    TEXTO.corpo.forEach(function (p) { box.appendChild(el('p', 'ap-corpo', p)); });

    var pix = el('div', 'ap-pix');
    pix.appendChild(el('span', 'ap-pix-rot', 'Chave Pix'));
    pix.appendChild(el('span', 'ap-pix-chave', TEXTO.chave));
    var bt = el('button', 'ap-copiar', 'Copiar chave');
    bt.type = 'button';
    bt.addEventListener('click', function () { copiar(TEXTO.chave, bt); evento('pix_copiar'); });
    pix.appendChild(bt);
    box.appendChild(pix);

    var acoes = el('div', 'ap-acoes');
    var a1 = el('a', 'ap-btn ap-btn-pix', TEXTO.botaoPix + ' →');
    a1.href = '/apoie/#pix';
    a1.addEventListener('click', function () { evento('pagina_apoie'); });
    var a2 = el('a', 'ap-btn ap-btn-livros', TEXTO.botaoLivros + ' →');
    a2.href = '/apoie/#livros';
    a2.addEventListener('click', function () { evento('livros'); });
    acoes.appendChild(a1); acoes.appendChild(a2);
    box.appendChild(acoes);

    box.appendChild(el('p', 'ap-rodape', TEXTO.rodape));
    return box;
  }

  function medirVista(box) {
    if (typeof window.gtag !== 'function' || !('IntersectionObserver' in window)) return;
    var obs = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) { window.gtag('event', 'apoio_view', {}); obs.disconnect(); }
    }, { threshold: 0.5 });
    obs.observe(box);
  }

  function iniciar() {
    if (document.getElementById('rb-apoie')) return;
    var slot = document.querySelector('[data-apoie]');
    var alvo = slot || document.querySelector('article') || document.querySelector('main');
    if (!alvo) return;

    var s = document.createElement('style');
    s.id = 'rb-apoie-css';
    s.textContent = CSS;
    document.head.appendChild(s);

    var box = montar();
    var patrocinio = !slot && alvo.querySelector(':scope > .rb-patrocinio');
    if (patrocinio) alvo.insertBefore(box, patrocinio);
    else alvo.appendChild(box);
    medirVista(box);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
