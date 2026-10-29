/* ==========================================================================
   Acessibilidade RS — regras da classificação
   --------------------------------------------------------------------------
   Arquivo único usado pela página pública (/acessibilidade-rs/) e pelo
   painel (/admin/). Mudou um recurso ou uma regra aqui, muda nos dois.
   ========================================================================== */
(function (w) {
  'use strict';

  var CATS = [
    ['hospedagem', 'Hotéis e pousadas'], ['alimentacao', 'Restaurantes e cafés'], ['eventos', 'Espaços de eventos'],
    ['turismo', 'Atrativos turísticos'], ['comercio', 'Lojas e comércio'], ['parques', 'Parques e praças'],
    ['lazer', 'Lazer, praias e esporte'], ['cultura', 'Cultura e museus'], ['publico', 'Serviços públicos'],
    ['transporte', 'Transporte'], ['educacao', 'Educação'], ['saude', 'Saúde']
  ];

  /* Recursos agrupados pelo tipo de necessidade */
  var DIMS = [
    { k: 'mob', nome: 'Mobilidade', longo: 'Deficiência física e mobilidade reduzida',
      recs: [['rampa', 'Entrada sem degraus ou com rampa'], ['circulacao', 'Corredores e portas largos, sem obstáculos'], ['banheiro', 'Banheiro acessível'], ['estac', 'Vaga de estacionamento reservada'], ['elevador', 'Elevador ou plataforma elevatória'], ['quarto', 'Quarto adaptado'], ['cadeira', 'Cadeira de rodas ou anfíbia disponível']],
      regra: 'Atende: entrada sem degraus e banheiro acessível. Parcial: pelo menos um recurso.' },
    { k: 'vis', nome: 'Visual', longo: 'Cegos e pessoas com baixa visão',
      recs: [['piso', 'Piso tátil'], ['braille', 'Sinalização em Braille'], ['material', 'Cardápio ou material em letra grande, Braille ou áudio'], ['contraste', 'Sinalização com alto contraste e boa iluminação'], ['caoguia', 'Aceita cão-guia'], ['audio', 'Audiodescrição']],
      regra: 'Atende: dois recursos ou mais. Parcial: um recurso.' },
    { k: 'aud', nome: 'Auditiva', longo: 'Surdos e pessoas com deficiência auditiva',
      recs: [['libras', 'Atendimento em Libras'], ['escrita', 'Atendimento por escrito ou informação em tela'], ['alarme', 'Alarme ou aviso luminoso']],
      regra: 'Atende: Libras, ou atendimento por escrito com aviso luminoso. Parcial: um recurso.' },
    { k: 'int', nome: 'Intelectual e TEA', longo: 'Deficiência intelectual, autismo e neurodivergências',
      recs: [['sensorial', 'Ambiente calmo ou sala sensorial'], ['simples', 'Comunicação simples, com figuras'], ['horario', 'Horário com menos barulho e luz'], ['girassol', 'Reconhece o cordão de girassol']],
      regra: 'Atende: dois recursos ou mais. Parcial: um recurso.' }
  ];
  var GERAIS = [['equipe', 'Equipe treinada em atendimento inclusivo'], ['prioritario', 'Atendimento prioritário e assentos de espera']];

  var NIV = {
    3: { nome: 'Acessibilidade plena', curto: 'Plena', stars: '★★★', desc: 'Atende três ou quatro tipos de necessidade.' },
    2: { nome: 'Boa acessibilidade', curto: 'Boa', stars: '★★', desc: 'Atende dois tipos, ou um tipo e parte de outros dois.' },
    1: { nome: 'Acessibilidade básica', curto: 'Básica', stars: '★', desc: 'Atende um tipo ou tem parte dos recursos.' },
    0: { nome: 'Em análise', curto: 'Em análise', stars: '?', desc: 'Ainda sem recursos informados.' }
  };
  /* Regiões: mesorregiões do IBGE (código) com nomes de uso corrente */
  var REGIOES = {
    '05': { nome: 'Metropolitana e Litoral', sub: 'Porto Alegre, Vale do Sinos, Litoral Norte, Gramado-Canela e Camaquã', ibge: 'Metropolitana de Porto Alegre' },
    '02': { nome: 'Serra Nordeste', sub: 'Caxias do Sul, Bento Gonçalves, Farroupilha, Vacaria e Guaporé', ibge: 'Nordeste Rio-grandense' },
    '01': { nome: 'Noroeste', sub: 'Missões, Alto Uruguai e Planalto: Passo Fundo, Ijuí, Santo Ângelo, Erechim, Santa Rosa', ibge: 'Noroeste Rio-grandense' },
    '04': { nome: 'Vales do Centro', sub: 'Vale do Taquari e Vale do Rio Pardo: Lajeado, Santa Cruz do Sul, Cachoeira do Sul', ibge: 'Centro Oriental Rio-grandense' },
    '03': { nome: 'Região Central', sub: 'Santa Maria, Quarta Colônia e Santiago', ibge: 'Centro Ocidental Rio-grandense' },
    '06': { nome: 'Fronteira e Campanha', sub: 'Uruguaiana, Alegrete, Bagé e Santana do Livramento', ibge: 'Sudoeste Rio-grandense' },
    '07': { nome: 'Sul e Costa Doce', sub: 'Pelotas, Rio Grande, Jaguarão e Serras de Sudeste', ibge: 'Sudeste Rio-grandense' }
  };
  var REG_ORDER = ['05', '02', '01', '04', '03', '06', '07'];
  var FAD = { ouro: 'Ouro', prata: 'Prata', bronze: 'Bronze', certificado: 'Certificado' };
  var MST = { adesao: 'Termo de Adesão assinado', participa: 'Participa (data de adesão a confirmar)', comite: 'Comitê Gestor em formação' };

  var REC = {};
  DIMS.forEach(function (d) { d.recs.forEach(function (r) { REC[r[0]] = r[1]; }); });
  GERAIS.forEach(function (r) { REC[r[0]] = r[1]; });

  /* 2 = atende, 1 = parcial, 0 = sem informação */
  function avaliar(recursos) {
    var s = {};
    (recursos || []).forEach(function (k) { s[k] = true; });
    function cnt(d) { return d.recs.filter(function (r) { return s[r[0]]; }).length; }
    var v = {
      mob: s.rampa && s.banheiro ? 2 : cnt(DIMS[0]) ? 1 : 0,
      vis: cnt(DIMS[1]) >= 2 ? 2 : cnt(DIMS[1]) ? 1 : 0,
      aud: s.libras || (s.escrita && s.alarme) ? 2 : cnt(DIMS[2]) ? 1 : 0,
      int: cnt(DIMS[3]) >= 2 ? 2 : cnt(DIMS[3]) ? 1 : 0
    };
    var A = 0, P = 0;
    ['mob', 'vis', 'aud', 'int'].forEach(function (k) { if (v[k] === 2) A++; else if (v[k] === 1) P++; });
    var nivel = A >= 3 ? 3 : (A === 2 || (A === 1 && P >= 2)) ? 2 : (A >= 1 || P >= 1) ? 1 : 0;
    return { v: v, nivel: nivel };
  }

  w.ARS = { REGIOES: REGIOES, REG_ORDER: REG_ORDER, CATS: CATS, DIMS: DIMS, GERAIS: GERAIS, NIV: NIV, FAD: FAD, MST: MST, REC: REC, avaliar: avaliar };
})(window);
