/* Rede Bolha — Service Worker
   Troque a versão abaixo sempre que publicar mudanças grandes no site.
   Isso força a atualização do cache no celular das pessoas. */

const VERSAO = 'redebolha-v5';
const OFFLINE_URL = '/offline.html';

const PRE_CACHE = [
  '/',
  '/artigos/',
  '/livros/',
  OFFLINE_URL,
  '/icon-192.png',
  '/icon-512.png',
  '/css/rb.css',
  '/js/rb.js',
];

// Instalação: guarda o essencial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSAO).then((cache) =>
      // addAll falha inteiro se um item der 404; por isso vai um a um
      Promise.all(PRE_CACHE.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só cuidamos de GET no próprio domínio
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: rede primeiro (conteúdo sempre atual), cache como reserva
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
          return resp;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Imagens, CSS, JS: cache primeiro (abre rápido), atualiza por trás
  event.respondWith(
    caches.match(req).then((cacheado) => {
      const rede = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => cacheado);
      return cacheado || rede;
    })
  );
});
