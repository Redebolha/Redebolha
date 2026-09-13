/*
 * A Carta do Homem e o Dinheiro — captura de e-mail.
 *
 * Era o buraco central do site: nenhum formulario em pagina nenhuma. Toda a
 * audiencia conquistada evaporava no fechamento da aba.
 *
 * COMO FUNCIONA, E POR QUE ASSIM
 * O cadastro e feito pela Substack. Ha tres caminhos possiveis e cada um tem
 * um problema:
 *   - iframe /embed  : sempre funciona, mas vem com fundo branco e estilo
 *                      proprio, que briga com o site escuro.
 *   - fetch na API   : a Substack nao libera chamada de outro dominio (CORS),
 *                      entao falharia calado — o pior dos mundos.
 *   - formulario que leva para a pagina de cadastro, com o e-mail ja digitado.
 *
 * Ficou o terceiro. O visitante digita o e-mail aqui, no visual do site, e
 * termina o cadastro na Substack. Se um dia a Substack parar de aceitar o
 * e-mail pela URL, a pessoa cai na pagina de cadastro e digita de novo: um
 * passo a mais, nunca um beco sem saida.
 */
(function () {
  'use strict';

  var PUBLICACAO = 'https://romariocruz.substack.com';
  var CADASTRO = PUBLICACAO + '/subscribe';

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
        // Conta o envio feito no site. A confirmacao acontece na Substack e
        // nao volta para ca — o numero real de inscritos e o do painel dela.
        window.gtag('event', 'newsletter_signup', { origem: location.pathname });
      }
      window.location.href = CADASTRO + '?email=' + encodeURIComponent(email);
    });

    box.appendChild(form);

    var nota = document.createElement('p');
    nota.className = 'rb-carta-nota';
    nota.innerHTML = 'O cadastro é feito na Substack. Sem spam — e o ' +
      '<a href="' + PUBLICACAO + '" rel="noopener" target="_blank">arquivo das cartas</a> ' +
      'fica aberto para ler antes de assinar.';
    box.appendChild(nota);

    return box;
  }

  /* Onde entra: nos pontos marcados e, nos artigos, no fim do texto — depois
     de o leitor ter recebido alguma coisa.                                  */
  function colocar() {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', colocar);
  } else {
    colocar();
  }
})();
