/**
 * 学习打卡PWA Service Worker
 * 实现离线缓存和应用安装功能
 */

const CACHE_NAME = 'study-checkin-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-144.png',
  '/icon-192.png',
  '/icon-512.png'
];

/**
 * 安装Service Worker
 */
self.addEventListener('install', (event) => {
  console.log('学习打卡PWA安装中...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('缓存文件中...');
        return cache.addAll(urlsToCache);
      })
  );
});

/**
 * 激活Service Worker
 */
self.addEventListener('activate', (event) => {
  console.log('学习打卡PWA激活中...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

/**
 * 拦截网络请求
 */
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果缓存中有，直接返回缓存
        if (response) {
          return response;
        }
        
        // 否则从网络获取
        return fetch(event.request).then((response) => {
          // 检查是否是有效响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // 克隆响应并缓存
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});

/**
 * 监听消息
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 