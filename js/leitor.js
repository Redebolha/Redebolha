/* Leitor de amostra — Rede Bolha
 *
 * Le js/leitura-hvnr.json e monta a tela. Capitulo sem texto nao aparece:
 * nem no indice, nem na navegacao. Melhor faltar um capitulo do que abrir
 * uma tela em branco na cara de quem veio ler.
 *
 * Sobre "proteger o texto": nao ha bloqueio de botao direito aqui, de
 * proposito. O texto esta no HTML — quem quiser copiar copia pelo codigo
 * fonte, e o bloqueio so atrapalharia leitor de tela, tradutor e quem quer
 * mandar um trecho para um amigo. Isto e uma AMOSTRA: ser compartilhada e
 * o objetivo, nao o risco.
 */
(function () {
  'use strict';

  var CFG = '/js/leitura-hvnr.json';
  var CHAVE = 'rb-leitor';          // preferencias + onde parou
  var raiz = document.documentElement;
  var dados = null, capitulos = [], atual = 0;

  // ------------------------------------------------------- preferencias ---
  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; }
    catch (e) { return {}; }        // aba anonima, cookies bloqueados
  }
  function gravar(p) {
    try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) {}
  }

  function aplicar(p) {
    raiz.setAttribute('data-tema-leitura', p.tema || temaDoSistema());
    raiz.setAttribute('data-corpo', String(p.corpo || 2));
    raiz.setAttribute('data-fonte', p.fonte || 'serif');
    document.querySelectorAll('[data-opcao]').forEach(function (b) {
      var par = b.getAttribute('data-opcao');
      var val = b.getAttribute('data-valor');
      var agora = String(par === 'corpo' ? (p.corpo || 2)
                  : par === 'fonte' ? (p.fonte || 'serif')
                  : (p.tema || temaDoSistema()));
      b.setAttribute('aria-pressed', val === agora ? 'true' : 'false');
    });
  }

  function temaDoSistema() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  }

  // -------------------------------------------------------------- GA4 ----
  var marcos = {};
  function evento(nome, extra) {
    if (typeof gtag !== 'function') return;
    var d = { livro: dados ? dados.livro.titulo : '' };
    for (var k in extra) d[k] = extra[k];
    gtag('event', nome, d);
  }

  // ---------------------------------------------------------- montagem ---
  function texto(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d;
  }

  function mostrar(i, rolarTopo) {
    var c = capitulos[i];
    if (!c) return;
    atual = i;

    document.getElementById('lt-numero').textContent = c.numero || '';
    document.getElementById('lt-titulo').textContent = c.titulo || c.numero || '';
    var cred = document.getElementById('lt-credito');
    cred.textContent = c.autor || '';
    cred.hidden = !c.autor;

    var alvo = document.getElementById('lt-texto');
    alvo.innerHTML = '';
    alvo.appendChild(texto(c.texto));

    var ant = document.getElementById('lt-ant'), prox = document.getElementById('lt-prox');
    ant.hidden = i === 0;
    prox.hidden = i === capitulos.length - 1;
    if (!ant.hidden) ant.textContent = '← ' + (capitulos[i - 1].numero || 'Anterior');
    if (!prox.hidden) prox.textContent = (capitulos[i + 1].numero || 'Próximo') + ' →';

    document.title = (c.titulo || c.numero) + ' — ' + dados.livro.titulo + ' | Rede Bolha';
    if (history.replaceState) history.replaceState(null, '', '#' + c.id);

    var p = ler(); p.onde = c.id; gravar(p);
    marcos = {};
    evento('leitura_capitulo', { capitulo: c.numero });
    if (rolarTopo) window.scrollTo(0, 0);
  }

  function progresso() {
    var doc = document.documentElement;
    var total = doc.scrollHeight - doc.clientHeight;
    var pct = total > 0 ? Math.min(100, Math.round(window.scrollY / total * 100)) : 0;
    document.getElementById('lt-barra').style.width = pct + '%';

    [25, 50, 75, 100].forEach(function (m) {
      if (pct >= m && !marcos[m]) {
        marcos[m] = true;
        evento('leitura_progresso', {
          capitulo: capitulos[atual] ? capitulos[atual].numero : '', porcentagem: m
        });
      }
    });
  }

  function montarCompra() {
    var caixa = document.getElementById('lt-compra');
    (dados.compra || []).forEach(function (c) {
      var a = document.createElement('a');
      a.href = c.url;
      a.rel = 'noopener'; a.target = '_blank';
      if (c.destaque) a.className = 'destaque';

      // O selo da loja fica num quadradinho branco: as marcas tem cores
      // proprias e sem o fundo claro a do Hotmart sumiria no modo escuro.
      if (c.selo) {
        var s = document.createElement('span');
        s.className = 'lt-selo';
        var img = document.createElement('img');
        img.src = c.selo; img.alt = ''; img.loading = 'lazy';
        img.width = 22; img.height = 22;
        s.appendChild(img);
        a.appendChild(s);
      }
      var txt = document.createElement('span');
      txt.className = 'lt-compra-txt';
      if (c.marca) {
        var m = document.createElement('b');
        m.textContent = c.marca;
        txt.appendChild(m);
        txt.appendChild(document.createTextNode(' · '));
      }
      txt.appendChild(document.createTextNode(c.rotulo));
      a.appendChild(txt);
      a.addEventListener('click', function () {
        evento('amostra_compra_clique', { destino: c.rotulo });
      });
      caixa.appendChild(a);
    });
    document.getElementById('lt-restantes').textContent =
      Math.max(0, (dados.livro.total_capitulos || 0) - 1);
  }

  // ------------------------------------------------------------ ligacao --
  function ligar() {
    var p = ler();
    aplicar(p);

    document.getElementById('lt-abrir').addEventListener('click', function () {
      var painel = document.getElementById('lt-ajustes');
      var aberto = !painel.hidden;
      painel.hidden = aberto;
      this.setAttribute('aria-expanded', String(!aberto));
    });

    document.querySelectorAll('[data-opcao]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pref = ler();
        var par = b.getAttribute('data-opcao'), val = b.getAttribute('data-valor');
        pref[par] = par === 'corpo' ? Number(val) : val;
        gravar(pref); aplicar(pref);
        evento('leitura_ajuste', { ajuste: par, valor: val });
      });
    });

    document.getElementById('lt-ant').addEventListener('click', function (e) {
      e.preventDefault(); mostrar(atual - 1, true);
    });
    document.getElementById('lt-prox').addEventListener('click', function (e) {
      e.preventDefault(); mostrar(atual + 1, true);
    });

    document.addEventListener('keydown', function (e) {
      if (e.target.closest('input, textarea, button')) return;
      if (e.key === 'ArrowRight') mostrar(atual + 1, true);
      if (e.key === 'ArrowLeft') mostrar(atual - 1, true);
    });

    var esperando = false;
    window.addEventListener('scroll', function () {
      if (esperando) return;
      esperando = true;
      requestAnimationFrame(function () { progresso(); esperando = false; });
    }, { passive: true });
  }

  // ------------------------------------------------------------- inicio --
  fetch(CFG, { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      dados = d;
      // O filtro que importa: capitulo sem texto nao existe para o leitor.
      capitulos = (d.capitulos || []).filter(function (c) {
        return c.texto && c.texto.trim();
      });
      if (!capitulos.length) throw new Error('nenhum capitulo com texto');

      document.getElementById('lt-carregando').hidden = true;
      document.getElementById('lt-leitor').hidden = false;

      montarCompra();
      ligar();

      // Volta para onde a pessoa parou, se o capitulo ainda existir.
      var alvo = (location.hash || '').replace('#', '') || ler().onde;
      var i = capitulos.findIndex(function (c) { return c.id === alvo; });
      mostrar(i >= 0 ? i : 0, false);
      progresso();
      evento('amostra_abrir', {});
    })
    .catch(function (e) {
      var c = document.getElementById('lt-carregando');
      c.hidden = false;
      c.innerHTML = '<p>A amostra não pôde ser carregada agora. ' +
        '<a href="/livros/homem-voce-nao-e-ridiculo.html">Ver a página do livro</a>.</p>';
      if (window.console) console.error('leitor:', e);
    });
})();
