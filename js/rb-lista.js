/* ==========================================================================
   Rede Bolha — Captação de e-mails (lista de espera, orçamento, newsletter)
   --------------------------------------------------------------------------
   AQUI EMBAIXO FICAM AS CAIXAS DE ENTRADA DO SITE.

   Cada formulário do site tem um tipo, e cada tipo pode ter a sua própria
   caixa. Para separar uma delas, crie um formulário novo em formspree.io,
   copie o endereço que ele te dá (tem esta cara: formspree.io/f/xxxxxxxx)
   e cole na linha do tipo correspondente, entre as aspas.

   Linha vazia = aquele tipo usa a caixa geral (RB_LISTA_PADRAO).
   Nenhuma caixa preenchida = o site volta ao modo WhatsApp, sem servidor:
   o formulário monta a mensagem e abre o WhatsApp com tudo pronto.

   Por que separar: cada caixa do Formspree tem o seu próprio limite mensal
   no plano gratuito. Com o orçamento de palestra numa caixa só dele, um mês
   movimentado de newsletter não come a cota dos pedidos de palestra — que
   é o contato que vale dinheiro.
   ========================================================================== */

/* Caixa geral: vale para todo tipo que estiver com a linha vazia abaixo. */
var RB_LISTA_PADRAO = 'https://formspree.io/f/mnpqovlp';

var RB_LISTAS = {
  /* Pedidos de orçamento de palestra — /palestras/ */
  palestra:   '',

  /* Lista de espera dos cursos — /cursos/ */
  curso:      '',

  /* Lista da Rede Bolha (newsletter) — página inicial */
  newsletter: ''
};

/* WhatsApp e e-mail de destino no modo direto */
var RB_LISTA_WHATSAPP = '5551980482820';
var RB_LISTA_EMAIL    = 'admromariocruz@gmail.com';

(function () {
  'use strict';

  var forms = document.querySelectorAll('form[data-rb-lista]');
  if (!forms.length) return;

  function campos(form) {
    var out = [];
    var els = form.querySelectorAll('input[name], select[name], textarea[name]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.type === 'checkbox' && !el.checked) continue;
      if (!String(el.value || '').trim()) continue;
      var rot = el.getAttribute('data-rotulo');
      if (!rot) {
        var lab = form.querySelector('label[for="' + el.id + '"]');
        rot = lab ? lab.textContent.replace(/\*/g, '').trim() : el.name;
      }
      out.push({ nome: el.name, rotulo: rot, valor: String(el.value).trim() });
    }
    return out;
  }

  function emailValido(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function mensagem(form, dados) {
    var linhas = [form.getAttribute('data-rb-assunto') || 'Contato pelo site'];
    linhas.push('');
    for (var i = 0; i < dados.length; i++) {
      linhas.push(dados[i].rotulo + ': ' + dados[i].valor);
    }
    linhas.push('');
    linhas.push('(enviado por redebolha.com.br' + location.pathname + ')');
    return linhas.join('\n');
  }

  function rastrear(form) {
    var tipo = form.getAttribute('data-rb-lista') || 'lista';
    try {
      if (typeof gtag === 'function') {
        gtag('event', 'generate_lead', { lead_type: tipo, page_path: location.pathname });
      }
    } catch (e) {}
    try {
      if (typeof fbq === 'function') fbq('track', 'Lead', { content_name: tipo });
    } catch (e) {}
  }

  function aviso(form, texto, ok) {
    var box = form.querySelector('[data-rb-aviso]');
    if (!box) {
      box = document.createElement('p');
      box.setAttribute('data-rb-aviso', '');
      form.appendChild(box);
    }
    box.className = 'rb-form-aviso' + (ok ? ' is-ok' : ' is-erro');
    box.innerHTML = texto;
    box.hidden = false;
    if (!ok) box.setAttribute('role', 'alert');
  }

  function agradecer(form, texto, msg, ok) {
    var link = 'https://wa.me/' + RB_LISTA_WHATSAPP + '?text=' + encodeURIComponent(msg);
    var mail = 'mailto:' + RB_LISTA_EMAIL +
               '?subject=' + encodeURIComponent(form.getAttribute('data-rb-assunto') || 'Contato pelo site') +
               '&body=' + encodeURIComponent(msg);
    aviso(form, texto +
      ' <br><a href="' + link + '" target="_blank" rel="noopener">Confirmar no WhatsApp</a>' +
      ' &nbsp;·&nbsp; <a href="' + mail + '">ou enviar por e-mail</a>', ok !== false);
  }

  function enviar(form, dados, msg, botao, rotuloBotao) {
    /* Do mais específico para o mais geral: o endereço posto direto no HTML
       vence a caixa do tipo, que vence a caixa geral. */
    var tipo = form.getAttribute('data-rb-lista') || '';
    var destino = form.getAttribute('data-rb-endpoint') ||
                  (RB_LISTAS && RB_LISTAS[tipo]) ||
                  RB_LISTA_PADRAO;

    if (destino) {
      var carga = {};
      for (var i = 0; i < dados.length; i++) carga[dados[i].nome] = dados[i].valor;
      carga.origem = location.pathname;
      carga.tipo = tipo || 'lista';

      botao.disabled = true;
      botao.textContent = 'Enviando…';

      fetch(destino, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(carga)
      }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        rastrear(form);
        form.reset();
        aviso(form, form.getAttribute('data-rb-ok') || 'Pronto, seu nome está na lista. Te aviso em primeira mão.', true);
      }).catch(function () {
        agradecer(form, 'O envio não foi — deu alguma coisa errada na conexão. Teus dados continuam aí, nada se perdeu. Manda direto por aqui:', msg, false);
      }).then(function () {
        botao.disabled = false;
        botao.textContent = rotuloBotao;
      });
      return;
    }

    /* Modo direto: sem servidor, abre o WhatsApp com tudo preenchido. */
    rastrear(form);
    window.open('https://wa.me/' + RB_LISTA_WHATSAPP + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    agradecer(form, form.getAttribute('data-rb-ok') || 'Recebido! Abri o WhatsApp com sua mensagem pronta — é só apertar enviar.', msg);
  }

  for (var f = 0; f < forms.length; f++) {
    (function (form) {
      var botao = form.querySelector('button[type="submit"], .rb-form-btn');
      var rotuloBotao = botao ? botao.textContent : 'Enviar';

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();

        var email = form.querySelector('input[type="email"], input[name="email"]');
        if (email && !emailValido(email.value.trim())) {
          aviso(form, 'Confere o e-mail para mim? Parece que faltou alguma coisa nele.', false);
          email.focus();
          return;
        }
        var nome = form.querySelector('input[name="nome"]');
        if (nome && nome.value.trim().length < 2) {
          aviso(form, 'Me diz teu nome — gosto de chamar as pessoas pelo nome.', false);
          nome.focus();
          return;
        }

        var dados = campos(form);
        enviar(form, dados, mensagem(form, dados), botao, rotuloBotao);
      });
    })(forms[f]);
  }
})();
