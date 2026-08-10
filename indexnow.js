#!/usr/bin/env node
/**
 * IndexNow — avisa Bing e Yandex (e os demais motores do protocolo) de que
 * as URLs abaixo mudaram. Não depende de nada instalado: só Node 18+.
 *
 * COMO RODAR (na raiz do projeto):
 *     node indexnow.js
 *
 * Para ver o que seria enviado, sem enviar de verdade:
 *     node indexnow.js --dry-run
 *
 * Para enviar só algumas URLs:
 *     node indexnow.js https://redebolha.com.br/ https://redebolha.com.br/artigos/
 *
 * ANTES DO PRIMEIRO ENVIO, confira que o arquivo da chave está publicado em:
 *     https://redebolha.com.br/99993a55828e52afb793f6ef37a5f7d3.txt
 * Ele precisa devolver exatamente a chave, em texto puro. Sem isso o
 * IndexNow responde 403 e ignora o envio.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const HOST = 'redebolha.com.br';
const KEY = '99993a55828e52afb793f6ef37a5f7d3';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

// Endpoints do protocolo. Enviar para um já propaga para os outros,
// mas mandar para os dois principais é mais rápido e não custa nada.
const ENDPOINTS = [
  'https://api.indexnow.org/indexnow',
  'https://www.bing.com/indexnow',
  'https://yandex.com/indexnow',
];

/** Lê as URLs do sitemap.xml, para a lista nunca ficar desatualizada. */
function urlsDoSitemap() {
  const arquivo = path.join(__dirname, 'sitemap.xml');
  if (!fs.existsSync(arquivo)) {
    console.error('sitemap.xml não encontrado em', arquivo);
    process.exit(1);
  }
  const xml = fs.readFileSync(arquivo, 'utf8');
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

async function enviar(endpoint, urlList) {
  const body = JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body,
  });

  const texto = await res.text().catch(() => '');
  const explica = {
    200: 'OK — URLs recebidas',
    202: 'Aceito — chave ainda em validação (normal no primeiro envio)',
    400: 'Formato inválido do JSON',
    403: 'Chave inválida — confira se o arquivo .txt está publicado na raiz',
    422: 'URL fora do domínio declarado em "host"',
    429: 'Muitos envios — espere e tente de novo',
  }[res.status] || 'resposta não documentada';

  console.log(`  ${endpoint} → ${res.status} (${explica})${texto ? ' ' + texto.slice(0, 120) : ''}`);
  return res.status;
}

(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const explicitas = args.filter((a) => a.startsWith('http'));
  const urlList = explicitas.length ? explicitas : urlsDoSitemap();

  if (!urlList.length) {
    console.error('Nenhuma URL para enviar.');
    process.exit(1);
  }
  if (urlList.length > 10000) {
    console.error('O IndexNow aceita no máximo 10.000 URLs por envio.');
    process.exit(1);
  }

  console.log(`IndexNow · ${HOST}`);
  console.log(`Chave publicada em: ${KEY_LOCATION}`);
  console.log(`${urlList.length} URL(s):`);
  urlList.forEach((u) => console.log('  -', u));

  if (dryRun) {
    console.log('\n--dry-run: nada foi enviado.');
    return;
  }

  console.log('\nEnviando...');
  let algumOk = false;
  for (const ep of ENDPOINTS) {
    try {
      const status = await enviar(ep, urlList);
      if (status === 200 || status === 202) algumOk = true;
    } catch (e) {
      console.log(`  ${ep} → falhou: ${e.message}`);
    }
  }

  console.log(algumOk ? '\nPronto.' : '\nNenhum endpoint aceitou o envio — verifique a chave.');
  process.exit(algumOk ? 0 : 1);
})();
