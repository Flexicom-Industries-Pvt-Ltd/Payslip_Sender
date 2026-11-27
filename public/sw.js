// Minimal pass-through Service Worker enabling native PWA Desktop App installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Always use network-first so auth, payroll data, and multi-tenant branding stay live
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response('Offline — please check your internet connection.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    }))
  );
});
