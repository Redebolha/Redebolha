/* RB.JS — Rede Bolha
   Interações compartilhadas das páginas institucionais: menu mobile,
   busca expansível e alternância de tema (claro/escuro). */
(function () {
  'use strict';

  var body = document.body;
  var btMenu = document.getElementById('btMenu');
  var gaveta = document.getElementById('gaveta');
  var btBusca = document.getElementById('btBusca');
  var busca = document.getElementById('busca');
  var buscaInput = busca ? busca.querySelector('input[type="search"]') : null;
  var btTema = document.getElementById('btTema');

  function fecharMenu() {
    if (!gaveta || !btMenu) return;
    gaveta.classList.remove('aberta');
    btMenu.setAttribute('aria-expanded', 'false');
    body.classList.remove('menu-aberto');
  }

  function abrirMenu() {
    if (!gaveta || !btMenu) return;
    gaveta.classList.add('aberta');
    btMenu.setAttribute('aria-expanded', 'true');
    body.classList.add('menu-aberto');
  }

  if (btMenu && gaveta) {
    btMenu.addEventListener('click', function () {
      if (gaveta.classList.contains('aberta')) fecharMenu();
      else abrirMenu();
    });
    gaveta.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', fecharMenu);
    });
  }

  function fecharBusca() {
    if (!busca) return;
    busca.classList.remove('aberta');
  }

  if (btBusca && busca) {
    btBusca.addEventListener('click', function (e) {
      e.stopPropagation();
      var abrindo = !busca.classList.contains('aberta');
      busca.classList.toggle('aberta', abrindo);
      if (abrindo && buscaInput) buscaInput.focus();
    });
  }

  document.addEventListener('click', function (e) {
    if (busca && busca.classList.contains('aberta') && !busca.contains(e.target) && e.target !== btBusca) {
      fecharBusca();
    }
    if (gaveta && gaveta.classList.contains('aberta') && !gaveta.contains(e.target) && e.target !== btMenu && !btMenu.contains(e.target)) {
      fecharMenu();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      fecharBusca();
      fecharMenu();
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 900) fecharMenu();
  });

  if (btTema) {
    btTema.addEventListener('click', function () {
      var atual = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      var novo = atual === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', novo);
      try { localStorage.setItem('rb-tema', novo); } catch (e) {}
    });
  }

  var aqui = location.pathname.replace(/index\.html$/, '');
  document.querySelectorAll('.menu a, .gaveta a').forEach(function (a) {
    var alvo = a.getAttribute('href');
    if (!alvo || alvo.charAt(0) === '#') return;
    var caminho = alvo.split('#')[0].split('?')[0].replace(/index\.html$/, '');
    if (caminho && caminho === aqui) a.classList.add('ativo');
  });
})();
