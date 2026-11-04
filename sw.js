// Service worker: cho phép "Thêm vào màn hình chính" và mở app khi mạng chập chờn.
// Chỉ lưu các file của app; KHÔNG lưu gì gọi tới ElevenLabs. Sửa app thì tăng số VERSION.
const VERSION = 'tvs-v1';
const FILES = ['./', 'index.html', 'logic.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // API ElevenLabs đi thẳng
  // Ưu tiên bản mới trên mạng, mất mạng thì dùng bản đã lưu
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
