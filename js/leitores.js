/*
 * Área do Leitor — a porta que abre com o código que chega junto com a dedicatória.
 *
 * POR QUE ASSIM
 * O site é estático e o repositório é público: qualquer "senha" conferida em
 * JavaScript seria enfeite, porque o conteúdo estaria ali, legível no GitHub.
 * Então o conteúdo exclusivo não fica em texto aberto em lugar nenhum do
 * repositório. Ele vem cifrado (AES-256-GCM) no bloco #rb-cofre da página, e
 * só o código de leitor gera a chave que o abre.
 *
 * UM CÓDIGO POR LIVRO
 * O conteúdo é cifrado com uma chave só. Essa chave vai guardada várias vezes,
 * uma para cada código (um por livro). Qualquer código certo abre a área —
 * "comprou qualquer livro, entrou". Se o código de um livro vazar, troca-se só
 * aquele, e os leitores dos outros livros nem percebem.
 *
 * O E-MAIL
 * Depois do código certo, a página pede o e-mail para A Carta, com o mesmo
 * mecanismo do resto do site (js/newsletter.json): o e-mail vai já digitado
 * para a página de cadastro do provedor, numa aba nova, e a área abre nesta.
 * Dá para entrar sem deixar e-mail — o livro já foi pago, e consentimento
 * arrancado na porta não vale como consentimento.
 *
 * Quem escreve o cofre é tools/leitores.py. Os dois lados precisam concordar
 * em três coisas: a normalização do código, o PBKDF2 e o formato do JSON.
 */
(function () {
  'use strict';

  var GUARDA = 'rb-leitor';            // o que fica no aparelho do leitor
  var CONFIG_CARTA = '/js/newsletter.json';

  var cofre = null;
  var carta = null;
  var pedidoCarta = Promise.resolve();
  var sessao = null;                   // { html, livro, nome, codigo }

  function $(id) { return document.getElementById(id); }

  function evento(nome, dados) {
    if (typeof window.gtag === 'function') window.gtag('event', nome, dados || {});
  }

  /* ── guarda no aparelho (pode falhar: aba anônima, bloqueio de site) ── */
  function ler() {
    try { return JSON.parse(localStorage.getItem(GUARDA) || 'null'); } catch (e) { return null; }
  }
  function gravar(v) {
    try { localStorage.setItem(GUARDA, JSON.stringify(v)); } catch (e) { /* segue sem lembrar */ }
  }
  function esquecer() {
    try { localStorage.removeItem(GUARDA); } catch (e) { /* nada a fazer */ }
  }

  /* ── cripto ─────────────────────────────────────────────────────────── */

  // Igual ao normalizar() do tools/leitores.py: sem acento, maiúsculo, só A-Z e 0-9.
  // "hvnr 7kq4-m9tx" e "HVNR-7KQ4-M9TX" são o mesmo código.
  function normalizar(c) {
    return String(c || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function bytes(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }

  async function abrir(codigo) {
    var norm = normalizar(codigo);
    if (norm.length < 6) return null;

    var base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(norm), 'PBKDF2', false, ['deriveKey']);
    var chaveDoCodigo = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: bytes(cofre.kdf.salt), iterations: cofre.kdf.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);

    for (var i = 0; i < cofre.chaves.length; i++) {
      var ch = cofre.chaves[i], aberta;
      try {
        aberta = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: bytes(ch.iv) }, chaveDoCodigo, bytes(ch.ct));
      } catch (e) { continue; }                     // não é o código deste livro

      var info = JSON.parse(new TextDecoder().decode(aberta));
      var chaveDoConteudo = await crypto.subtle.importKey(
        'raw', bytes(info.k), 'AES-GCM', false, ['decrypt']);
      var claro = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes(cofre.conteudo.iv) }, chaveDoConteudo, bytes(cofre.conteudo.ct));
      return { html: new TextDecoder().decode(claro), livro: info.livro, nome: info.nome, codigo: norm };
    }
    return null;
  }

  /* ── telas ─────────────────────────────────────────────────────────── */

  function mostrar(qual) {
    $('lt-porta').hidden = qual !== 'porta';
    $('lt-passo-email').hidden = qual !== 'email';
    $('lt-area').hidden = qual !== 'area';
  }

  function esperando(sim) {
    $('lt-esperando').hidden = !sim;
    $('lt-form-codigo').hidden = sim;
  }

  // Só as mensagens fixas desta página passam como HTML (para o link do WhatsApp).
  function erro(msg, comLink) {
    if (comLink) $('lt-erro').innerHTML = msg; else $('lt-erro').textContent = msg || '';
  }

  function juntar(url, par) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + par;
  }

  function enderecoCarta(email) {
    var url = juntar(carta.cadastro,
      (carta.parametro_email || 'email') + '=' + encodeURIComponent(email));
    return juntar(url, 'utm_source=redebolha&utm_medium=site&utm_campaign=' +
      encodeURIComponent('leitores-' + (sessao.livro || 'livro')));
  }

  function mostrarArea(opcoes) {
    opcoes = opcoes || {};
    var area = $('lt-area');

    var barra = document.createElement('div');
    barra.className = 'lt-barra';
    var rotulo = document.createElement('span');
    rotulo.appendChild(document.createTextNode('Aberta com o código de '));
    var b = document.createElement('b');
    b.textContent = sessao.nome || 'um dos livros';
    rotulo.appendChild(b);
    var sair = document.createElement('button');
    sair.type = 'button';
    sair.textContent = 'Sair deste aparelho';
    sair.addEventListener('click', function () {
      esquecer();
      location.reload();
    });
    barra.appendChild(rotulo);
    barra.appendChild(sair);

    area.innerHTML = '';
    area.appendChild(barra);

    if (opcoes.linkCarta) {
      var aviso = document.createElement('p');
      aviso.className = 'lt-aviso';
      aviso.innerHTML = 'A Carta: termine a inscrição na aba que abriu. Não abriu? ' +
        '<a rel="noopener" target="_blank">Confirmar aqui</a>.';
      aviso.querySelector('a').href = opcoes.linkCarta;
      area.appendChild(aviso);
    }

    var corpo = document.createElement('div');
    corpo.innerHTML = sessao.html;        // escrito pelo autor, cifrado por ele
    area.appendChild(corpo);

    // Quem entrou sem e-mail vê o convite n'A Carta lá no fim, sem insistência.
    var convite = corpo.querySelector('[data-convite-carta]');
    if (convite && (!carta || !carta.cadastro || (ler() || {}).e === 1)) convite.remove();

    mostrar('area');
    window.scrollTo(0, 0);
    var h1 = area.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }

  function depoisDoCodigo(s, guardado) {
    sessao = s;
    var lembrado = guardado || {};
    gravar({ c: s.codigo, e: lembrado.e });

    // Sem endereço de cadastro não se pede e-mail — mesma regra do newsletter.js.
    // E quem já respondeu (deu o e-mail ou pulou) não é perguntado de novo.
    if (carta && carta.cadastro && lembrado.e === undefined) {
      $('lt-livro-nome').textContent = s.nome || '';
      if (carta.provedor) {
        $('lt-provedor').textContent =
          carta.provedor.charAt(0).toUpperCase() + carta.provedor.slice(1);
      }
      mostrar('email');
      $('lt-titulo-email').focus({ preventScroll: true });
      window.scrollTo(0, 0);
      return;
    }
    mostrarArea();
  }

  /* ── ligações ─────────────────────────────────────────────────────── */

  function ligar() {
    $('lt-form-codigo').addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var campo = $('lt-codigo');
      var botao = this.querySelector('button');
      if (!campo.value.trim()) { erro('Digite o código que veio com a dedicatória.'); campo.focus(); return; }

      botao.disabled = true;
      botao.textContent = 'Conferindo…';
      erro('');
      var s = null;
      try { s = await abrir(campo.value); } catch (e) { s = null; }
      botao.disabled = false;
      botao.textContent = 'Abrir a área';

      if (!s) {
        evento('leitor_codigo_errado');
        erro('Esse código não abriu a porta. Confira letra por letra — e, se continuar travado, ' +
          'me chama no <a href="https://wa.me/5551980482820?text=' +
          encodeURIComponent('Olá, Romário! Meu código da Área do Leitor não está abrindo.') +
          '" rel="noopener" target="_blank">WhatsApp</a>.', true);
        campo.focus();
        campo.select();
        return;
      }
      evento('leitor_desbloqueio', { livro: s.livro });
      await pedidoCarta;                       // o endereço d'A Carta já chegou
      depoisDoCodigo(s, ler());
    });

    $('lt-form-email').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var campo = $('lt-email');
      var email = campo.value.trim();
      if (!email || email.indexOf('@') < 1 || email.indexOf('.') === -1) {
        $('lt-erro-email').textContent = 'Confira o e-mail — parece que falta um pedaço.';
        campo.focus();
        return;
      }
      var url = enderecoCarta(email);
      evento('newsletter_signup', { origem: location.pathname, perfil: 'leitor-' + sessao.livro });

      // A aba nova precisa abrir aqui, dentro do clique, senão o navegador bloqueia.
      var aba = window.open(url, '_blank');
      if (aba) { try { aba.opener = null; } catch (e) { /* ok */ } }

      gravar({ c: sessao.codigo, e: 1 });
      mostrarArea({ linkCarta: url });
    });

    $('lt-pular').addEventListener('click', function () {
      evento('leitor_pulou_email', { livro: sessao.livro });
      gravar({ c: sessao.codigo, e: 0 });
      mostrarArea();
    });
  }

  /* ── começo ───────────────────────────────────────────────────────── */

  async function comecar() {
    try { cofre = JSON.parse($('rb-cofre').textContent); } catch (e) { cofre = null; }

    if (!cofre || !cofre.kdf || !cofre.chaves || !cofre.chaves.length || !cofre.conteudo) {
      $('lt-form-codigo').innerHTML =
        '<p class="lt-erro" style="color:var(--body)">A área está sendo arrumada. Volta daqui a pouco.</p>';
      return;
    }
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) {
      $('lt-form-codigo').innerHTML =
        '<p class="lt-erro">Este navegador é antigo demais para abrir a área. ' +
        'Tente pelo Chrome ou pelo Safari atualizados.</p>';
      return;
    }

    ligar();

    // A Carta: o endereço mora em js/newsletter.json. Sem ele, a porta abre direto.
    pedidoCarta = fetch(CONFIG_CARTA, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { carta = d; })
      .catch(function () { carta = null; });

    // Quem já entrou neste aparelho não digita de novo.
    var guardado = ler();
    if (guardado && guardado.c) {
      esperando(true);
      var s = null;
      try { s = await abrir(guardado.c); } catch (e) { s = null; }
      await pedidoCarta;
      esperando(false);
      if (s) { depoisDoCodigo(s, guardado); return; }
      esquecer();
      erro('O código guardado neste aparelho mudou. Digite o seu código de leitor.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', comecar);
  } else {
    comecar();
  }
})();
