#!/usr/bin/env node
/**
 * brapi.dev — cliente da API v2 da bolsa brasileira. Só Node 18+, sem nada
 * instalado.
 *
 * O token NUNCA fica no código nem no site: ele vem da variável de ambiente
 * BRAPI_TOKEN. No GitHub, fica em Settings → Secrets and variables → Actions,
 * e quem roda isto é o workflow .github/workflows/brapi-dados.yml.
 *
 * COMO RODAR (na raiz do projeto):
 *     BRAPI_TOKEN=xxx node tools/brapi.js --sondar PETR4,VALE3
 *
 * --sondar chama /api/v2/stocks/quote (e, para conhecer os campos de
 * indicadores, /stocks/statistics e /stocks/financial-data) com os códigos
 * pedidos e grava a resposta crua em dados/brapi-sondagem.json. É o passo de
 * reconhecimento: a normalização para o analisador só é escrita depois de ver
 * os campos reais, em vez de adivinhar nome de campo.
 *
 * Variáveis opcionais:
 *     BRAPI_BASE_URL  outra base (padrão https://brapi.dev) — usada nos testes
 *     BRAPI_LOTE      quantos códigos por chamada (padrão 10)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE = (process.env.BRAPI_BASE_URL || 'https://brapi.dev').replace(/\/$/, '');
const LOTE = Math.max(1, parseInt(process.env.BRAPI_LOTE, 10) || 10);
const TENTATIVAS = 4;
const ESPERA_MAX_S = 120;

class ErroFatal extends Error {}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry-After vem em segundos ("30") ou como data HTTP. Devolve milissegundos. */
function esperaRetryAfter(valor, tentativa) {
  let s = Number(valor);
  if (!Number.isFinite(s)) {
    const quando = Date.parse(valor || '');
    s = Number.isFinite(quando) ? (quando - Date.now()) / 1000 : 2 ** tentativa;
  }
  return Math.min(Math.max(s, 1), ESPERA_MAX_S) * 1000;
}

/**
 * Uma chamada GET à brapi com os códigos em `symbols`.
 * Devolve { status, corpo } para 200 e 404; lança ErroFatal para 401/403.
 */
async function chamar(rota, simbolos, token) {
  const url = `${BASE}${rota}?symbols=${encodeURIComponent(simbolos.join(','))}`;
  for (let t = 1; t <= TENTATIVAS; t++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      if (t === TENTATIVAS) throw new Error(`${rota}: rede falhou (${e.message})`);
      await dormir(2000 * t);
      continue;
    }

    const texto = await res.text().catch(() => '');
    let corpo = null;
    try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = { bruto: texto.slice(0, 500) }; }
    const msg = (corpo && (corpo.message || corpo.error)) || texto.slice(0, 160);

    if (res.ok) return { status: res.status, corpo };
    if (res.status === 401 || res.status === 403) {
      throw new ErroFatal(`${rota} → ${res.status}: token recusado ou sem acesso a este dado no seu plano (${msg}). ` +
        'Confira o secret BRAPI_TOKEN e o plano em brapi.dev/dashboard.');
    }
    if (res.status === 404) return { status: 404, corpo };
    if (res.status === 429 || res.status >= 500) {
      if (t === TENTATIVAS) throw new Error(`${rota} → ${res.status} depois de ${TENTATIVAS} tentativas (${msg})`);
      const ms = res.status === 429 ? esperaRetryAfter(res.headers.get('retry-after'), t) : 2000 * t;
      console.log(`  ${rota} → ${res.status}, nova tentativa em ${Math.round(ms / 1000)}s`);
      await dormir(ms);
      continue;
    }
    throw new Error(`${rota} → ${res.status}: ${msg}`);
  }
  throw new Error(`${rota}: sem resposta`);
}

/** Divide os códigos em lotes e junta as respostas; 404 vira lista de ausentes. */
async function buscar(rota, simbolos, token) {
  const respostas = [];
  const ausentes = [];
  for (let i = 0; i < simbolos.length; i += LOTE) {
    const lote = simbolos.slice(i, i + LOTE);
    const r = await chamar(rota, lote, token);
    if (r.status === 404) ausentes.push(...lote);
    respostas.push({ simbolos: lote, status: r.status, corpo: r.corpo });
  }
  return { rota, respostas, ausentes };
}

/** Lista os campos que vieram null — o analisador vai precisar tratá-los. */
function camposNulos(obj, prefixo = '', saida = []) {
  if (obj === null) { saida.push(prefixo || '(raiz)'); return saida; }
  if (Array.isArray(obj)) { obj.slice(0, 1).forEach((v) => camposNulos(v, `${prefixo}[0]`, saida)); return saida; }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) camposNulos(v, prefixo ? `${prefixo}.${k}` : k, saida);
  }
  return saida;
}

async function sondar(simbolos, token) {
  const rotas = ['/api/v2/stocks/quote', '/api/v2/stocks/statistics', '/api/v2/stocks/financial-data'];
  const resultado = { geradoEm: new Date().toISOString(), base: BASE, simbolos, rotas: [] };

  for (const rota of rotas) {
    try {
      const r = await buscar(rota, simbolos, token);
      resultado.rotas.push(r);
      const ok = r.respostas.filter((x) => x.status === 200);
      const nulos = ok.flatMap((x) => camposNulos(x.corpo));
      console.log(`  ${rota} → ${ok.length}/${r.respostas.length} lote(s) OK` +
        (r.ausentes.length ? `, não encontrados: ${r.ausentes.join(', ')}` : '') +
        (nulos.length ? `, ${nulos.length} campo(s) null` : ''));
    } catch (e) {
      if (e instanceof ErroFatal && rota === rotas[0]) throw e; // sem cotação não adianta seguir
      console.log(`  ${rota} → falhou: ${e.message}`);
      resultado.rotas.push({ rota, erro: e.message });
    }
  }
  return resultado;
}

(async () => {
  const args = process.argv.slice(2);
  const i = args.indexOf('--sondar');
  if (i < 0) {
    console.error('Uso: BRAPI_TOKEN=xxx node tools/brapi.js --sondar PETR4,VALE3');
    process.exit(1);
  }
  const simbolos = (args[i + 1] || 'PETR4,VALE3').toUpperCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (!simbolos.every((s) => /^[A-Z]{4}\d{1,2}B?$/.test(s))) {
    console.error('Códigos inválidos:', simbolos.join(', '));
    process.exit(1);
  }

  const token = (process.env.BRAPI_TOKEN || '').trim();
  if (!token) {
    console.error('BRAPI_TOKEN não definido. No GitHub: Settings → Secrets and variables → Actions → New repository secret.');
    process.exit(1);
  }

  console.log(`brapi · sondagem de ${simbolos.join(', ')}`);
  try {
    const r = await sondar(simbolos, token);
    const destino = path.join(__dirname, '..', 'dados', 'brapi-sondagem.json');
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify(r, null, 2) + '\n');
    console.log(`\nGravado em dados/brapi-sondagem.json`);
  } catch (e) {
    console.error(`\n${e.message}`);
    process.exit(1);
  }
})();
