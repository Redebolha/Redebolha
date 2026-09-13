/*
 * A Carta do Homem e o Dinheiro — captura de e-mail.
 *
 * ONDE FICA O ENDERECO: em js/newsletter.json, nao aqui. Trocar de provedor
 * e editar aquele arquivo. Se o cadastro estiver vazio la, este bloco NAO
 * aparece — melhor nao pedir e-mail do que mandar a pessoa para uma pagina
 * que pede cartao de credito antes do endereco.
 *
 * Era o buraco central do site: nenhum formulario em pagina nenhuma. Toda a
 * audiencia conquistada evaporava no fechamento da aba.
 *
 * COMO FUNCIONA, E POR QUE ASSIM
 * O cadastro e feito por um provedor de fora. Ha tres caminhos possiveis e
 * cada um tem um problema:
 *   - iframe de embed: sempre funciona, mas vem com estilo proprio, que
 *                      briga com o site escuro.
 *   - fetch na API   : provedor nenhum libera chamada de outro dominio
 *                      (CORS), entao falharia calado — o pior dos mundos.
 *   - formulario que leva para a pagina de cadastro, com o e-mail ja digitado.
 *
 * Ficou o terceiro. O visitante digita o e-mail aqui, no visual do site, e
 * termina o cadastro no provedor. Se um dia ele parar de aceitar o e-mail
 * pela URL, a pessoa cai na pagina de cadastro e digita de novo: um passo a
 * mais, nunca um beco sem saida.
 */
(function () {
  'use strict';

  var CONFIG = '/js/newsletter.json';
  var cfg = null;

  var CSS = [
    '.rb-carta{margin:2.8rem 0;border:1px solid rgba(201,162,75,.3);border-radius:4px;',
    '  padding:24px;background:rgba(201,162,75,.045)}',
    '.rb-carta-selo{font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;',
    '  color:#c9a24b;margin:0 0 10px}',
    '.rb-carta h2{font-size:1.3rem;line-height:1.25;color:#eceae3;margin:0 0 8px;',
    '  font-weight:600;text-transform:none;letter-spacing:normal;font-family:inherit}',
    '.rb-carta p{font-size:.92rem;line-height:1.55;color:#c6ccca;margin:0 0 16px;max-width:60ch}',
    '.rb-carta form{display:flex;flex-wrap:wrap;gap:10px}',
    '.rb-carta input{flex:1 1 220px;min-width:0;padding:11px 14px;font:inherit;font-size:.92rem;',
    '  color:#eceae3;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.16);border-radius:3px}',
    '.rb-carta input::placeholder{color:#7d8583}',
    '.rb-carta input:focus{outline:2px solid #c9a24b;outline-offset:1px;border-color:#c9a24b}',
    '.rb-carta button{flex:0 0 auto;padding:11px 20px;font:inherit;font-size:.82rem;font-weight:600;',
    '  letter-spacing:.04em;color:#0a0a0c;background:#c9a24b;border:0;border-radius:3px;cursor:pointer}',
    '.rb-carta button:hover{background:#dcb45c}',
    '.rb-carta button:focus-visible{outline:2px solid #eceae3;outline-offset:2px}',
    '.rb-carta-nota{font-size:.78rem;color:#8b9694;margin:12px 0 0}',
    '.rb-carta-nota a{color:inherit}',
    '@media(max-width:480px){.rb-carta{padding:20px}.rb-carta button{flex:1 1 100%}}'
  ].join('\n');

  function injetarCSS() {
    if (document.getElementById('rb-carta-css')) return;
    var s = document.createElement('style');
    s.id = 'rb-carta-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  var contador = 0;

  function montar() {
    contador += 1;
    var id = 'rb-carta-email-' + contador;

    var box = document.createElement('aside');
    box.className = 'rb-carta';

    box.innerHTML =
      '<p class="rb-carta-selo">A Carta do Homem e o Dinheiro</p>' +
      '<h2>Uma conversa por semana, na sexta de manhã.</h2>' +
      '<p>Dinheiro, masculinidade e as contas que ninguém ensina o homem a fazer. ' +
      'De graça, e você sai quando quiser.</p>';

    var form = document.createElement('form');
    form.noValidate = true;

    var rotulo = document.createElement('label');
    rotulo.setAttribute('for', id);
    rotulo.textContent = 'Seu e-mail';
    rotulo.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';

    var campo = document.createElement('input');
    campo.type = 'email';
    campo.id = id;
    campo.name = 'email';
    campo.required = true;
    campo.autocomplete = 'email';
    campo.placeholder = 'seu@email.com';

    var botao = document.createElement('button');
    botao.type = 'submit';
    botao.textContent = 'Quero receber';

    form.appendChild(rotulo);
    form.appendChild(campo);
    form.appendChild(botao);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = campo.value.trim();
      if (!email || email.indexOf('@') < 1) {
        campo.focus();
        return;
      }
      if (typeof window.gtag === 'function') {
        // Conta o envio feito no site. A confirmacao acontece no provedor e
        // nao volta para ca — o numero real de inscritos e o do painel dele.
        window.gtag('event', 'newsletter_signup', {
          origem: location.pathname,
          perfil: form.getAttribute('data-origem') || ''
        });
      }
      // Se quem montou o bloco marcou uma origem (o quiz marca o perfil), ela
      // viaja junto: o provedor registra a origem de cada inscrito, e assim a
      // segmentacao aparece tambem no painel dele, nao so no GA4.
      // O endereco de cadastro pode ja trazer parametros (o do Beehiiv vem com
      // ?modal=signup). Juntar com "?" nesse caso quebraria a URL.
      function juntar(url, par) {
        return url + (url.indexOf('?') === -1 ? '?' : '&') + par;
      }

      var destino = juntar(cfg.cadastro,
        (cfg.parametro_email || 'email') + '=' + encodeURIComponent(email));

      var origem = form.getAttribute('data-origem');
      if (origem) {
        destino = juntar(destino,
          'utm_source=redebolha&utm_medium=site&utm_campaign=' +
          encodeURIComponent(origem));
      }
      window.location.href = destino;
    });

    box.appendChild(form);

    var nota = document.createElement('p');
    nota.className = 'rb-carta-nota';
    var casa = cfg.provedor
      ? cfg.provedor.charAt(0).toUpperCase() + cfg.provedor.slice(1)
      : 'nosso provedor de e-mail';
    nota.innerHTML = 'Só o e-mail, sem cartão e sem cobrança. O cadastro é feito no ' +
      casa + ' — e o ' +
      '<a href="' + cfg.publicacao + '" rel="noopener" target="_blank">arquivo das cartas</a> ' +
      'fica aberto para ler antes de assinar.';
    box.appendChild(nota);

    return box;
  }

  /* Onde entra: nos pontos marcados e, nos artigos, no fim do texto — depois
     de o leitor ter recebido alguma coisa.                                  */
  function colocar() {
    // Sem endereco de cadastro nao ha bloco: pedir e-mail e nao ter onde
    // guardar e pior do que nao pedir.
    if (!cfg || !cfg.cadastro || !cfg.publicacao) return;
    injetarCSS();

    var marcados = document.querySelectorAll('[data-newsletter]');
    if (marcados.length) {
      marcados.forEach(function (m) {
        if (!m.querySelector('.rb-carta')) m.appendChild(montar());
      });
      return;
    }

    var artigo = document.querySelector('article');
    if (artigo && !document.querySelector('.rb-carta')) {
      artigo.appendChild(montar());
    }
  }

  function comecar() {
    fetch(CONFIG, { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { cfg = d; colocar(); })
      .catch(function () { /* sem captura e melhor que captura quebrada */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', comecar);
  } else {
    comecar();
  }
})();
