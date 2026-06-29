/**
 * Service Worker for FitCoach AI PWA
 * 缓存静态资源，API 请求走网络
 */
const CACHE_NAME = "fitcoach-cache-v1";
// 安装时预缓存
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "/manifest.json",
        "/icons/icon.svg",
      ]);
    })
  );
  self.skipWaiting();
});
// 激活时清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});
// 网络优先策略，只缓存 GET 请求
self.addEventListener("fetch", (event) => {
  // 仅处理 GET 请求，POST 等请求不缓存也不拦截
  if (event.request.method !== "GET") {
    return;
  }
  // API 请求不缓存
  if (event.request.url.includes("/api/")) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});