/* Rede Bolha — Service Worker
   Troque a versão abaixo sempre que publicar mudanças grandes no site.
   Isso força a atualização do cache no celular das pessoas. */

const VERSAO = 'redebolha-v10';
const OFFLINE_URL = '/offline.html';

const PRE_CACHE = [
  '/',
  '/artigos/',
  '/economia/',
  '/expediente/',
  '/economia/economia.css',
  '/livros/',
  '/cursos/',
  '/palestras/',
  OFFLINE_URL,
  '/icon-192.png',
  '/icon-512.png',
  '/css/rb.css',
  '/js/rb.js',
  '/js/rb-lista.js',
  '/js/rb-origem.js',
  '/css/rb-comercial.css',
  '/artigos/blog.css',
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

  /* CSS e JS: rede primeiro, cache como reserva.
     Em "cache primeiro" o aparelho servia a folha de estilo antiga e só
     buscava a nova para a VISITA SEGUINTE — então uma publicação parecia
     não ter surtido efeito, mesmo com o HTML já atualizado. Preço a pagar:
     alguns kB por visita. Vale, porque o que sai errado é o site inteiro. */
  if (req.destination === 'style' || req.destination === 'script') {
    event.respondWith(
      /* no-cache pergunta ao servidor "mudou?" em vez de confiar no cache do
         navegador. Se não mudou, volta um 304 e não baixa nada; se mudou, vem
         a versão nova. Sem isso, o cache do próprio navegador ainda servia a
         folha antiga mesmo com o service worker indo à rede. */
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Imagens e o resto: cache primeiro (abre rápido), atualiza por trás
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
