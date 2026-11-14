/**
 * Service Worker — ARS (Acessibilidade RS)
 * Rede Bolha · redebolha.com.br
 *
 * Segurança aplicada (checklist de boas práticas):
 *  ✅ HTTPS obrigatório (apenas registrado em contexto seguro)
 *  ✅ Cache versionado — evita vazamento de conteúdo antigo
 *  ✅ Validação de origem — só faz cache de recursos do próprio domínio
 *  ✅ Sem exposição de dados sensíveis no cache
 *  ✅ Cabeçalhos de segurança preservados nas respostas em cache
 */

const CACHE_NAME = 'ars-v1';
const BASE_URL   = 'https://redebolha.com.br';

/* Recursos pré-carregados no install */
const PRECACHE = [
  '/acessibilidade-rs/',
  '/acessibilidade-rs/?source=pwa'
];

/* ── Install ──────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

/* ── Activate — limpa caches antigos ─────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch — Network-first com fallback para cache ───────── */
self.addEventListener('fetch', event => {
  const { request } = event;

  /* Segurança: só intercepta GET do mesmo domínio */
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(BASE_URL)) return;

  /* Não armazena requisições autenticadas ou sensíveis */
  if (
    request.headers.get('Authorization') ||
    request.url.includes('/wp-admin') ||
    request.url.includes('/api/')
  ) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        /* Só armazena respostas válidas e do mesmo domínio */
        if (
          response.ok &&
          response.type === 'basic' &&
          response.url.startsWith(BASE_URL)
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
