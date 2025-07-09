/**
 * 学习打卡PWA Service Worker
 * 实现离线缓存和应用安装功能
 */

const CACHE_NAME = 'study-checkin-v2.0.0';
const CACHE_VERSION = '2024-01-07-002';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './voice-reminder.js',
  './icon-72.png',
  './icon-192.png',
  './icon-512.png'
];

/**
 * 🆕 智能缓存清理（保护用户数据）
 */
async function forceCleanOldCaches() {
    console.log('🧹 开始智能缓存清理（保护用户数据）...');
    
    try {
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
                console.log('🗑️ 删除旧缓存:', cacheName);
                return caches.delete(cacheName);
            });
        
        await Promise.all(deletePromises);
        console.log('✅ 所有旧缓存已清除');
        
        // 🆕 向所有客户端发送缓存清理完成消息，提醒保护用户数据
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'CACHE_CLEANED',
                version: CACHE_VERSION,
                timestamp: Date.now(),
                // 🆕 提醒客户端保护用户数据
                protectUserData: true
            });
        });
        
    } catch (error) {
        console.error('💥 清除缓存失败:', error);
    }
}

/**
 * 安装Service Worker
 */
self.addEventListener('install', (event) => {
  console.log(`🚀 Service Worker installing... 版本: ${CACHE_VERSION}`);
  
  event.waitUntil(
    (async () => {
        // 强制清除所有旧缓存
        await forceCleanOldCaches();
        
        // 打开新缓存
        const cache = await caches.open(CACHE_NAME);
        console.log('📦 打开新缓存:', CACHE_NAME);
        
        // 缓存所有文件，添加时间戳防止缓存
        const urlsWithTimestamp = urlsToCache.map(url => {
            if (url === './') return url;
            return `${url}?v=${CACHE_VERSION}&t=${Date.now()}`;
        });
        
        console.log('📥 缓存文件列表:', urlsWithTimestamp);
        
        try {
            await cache.addAll(urlsWithTimestamp);
            console.log('✅ 所有文件缓存成功');
        } catch (error) {
            console.error('💥 文件缓存失败:', error);
            // 逐个尝试缓存文件
            for (const url of urlsWithTimestamp) {
                try {
                    await cache.add(url);
                    console.log('✅ 单独缓存成功:', url);
                } catch (individualError) {
                    console.error('💥 单独缓存失败:', url, individualError);
                }
            }
        }
        
        // 强制跳过等待，立即激活
        self.skipWaiting();
    })()
  );
});

/**
 * 激活Service Worker
 */
self.addEventListener('activate', (event) => {
  console.log(`🎯 Service Worker activating... 版本: ${CACHE_VERSION}`);
  
  event.waitUntil(
    (async () => {
        // 再次确保清除所有旧缓存
        await forceCleanOldCaches();
        
        // 立即控制所有客户端，不等待
        await self.clients.claim();
        console.log('🎮 Service Worker已控制所有客户端');
        
        // 向所有客户端发送强制刷新消息
        const clients = await self.clients.matchAll({ 
            includeUncontrolled: true,
            type: 'window' 
        });
        
        console.log(`📱 找到 ${clients.length} 个客户端页面`);
        
        clients.forEach(client => {
            console.log('📤 向客户端发送更新消息:', client.url);
            client.postMessage({
                type: 'FORCE_UPDATE_AVAILABLE',
                version: CACHE_VERSION,
                message: '检测到新版本，正在强制更新...',
                timestamp: Date.now()
            });
        });
        
        console.log('✅ Service Worker激活完成，已通知所有客户端更新');
    })()
  );
});

/**
 * 🆕 增强的网络请求拦截
 */
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // 对于关键文件，始终从网络获取最新版本
  const criticalFiles = ['index.html', 'voice-reminder.js', 'manifest.json', 'sw.js'];
  const isCriticalFile = criticalFiles.some(file => requestUrl.pathname.includes(file));
  
  if (isCriticalFile) {
    console.log('🔄 关键文件请求，优先从网络获取:', requestUrl.pathname);
    
    event.respondWith(
      (async () => {
        try {
          // 首先尝试从网络获取最新版本
          const networkResponse = await fetch(event.request);
          
          if (networkResponse.ok) {
            // 更新缓存
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, networkResponse.clone());
            console.log('✅ 关键文件已更新缓存:', requestUrl.pathname);
            return networkResponse;
          }
        } catch (error) {
          console.warn('⚠️ 网络获取失败，尝试从缓存获取:', requestUrl.pathname, error);
        }
        
        // 网络失败时从缓存获取
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          console.log('📦 从缓存返回:', requestUrl.pathname);
          return cachedResponse;
        }
        
        // 缓存也没有，返回错误
        console.error('💥 文件未找到:', requestUrl.pathname);
        return new Response('文件未找到', { status: 404 });
      })()
    );
  } else {
    // 非关键文件使用标准缓存策略
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // 如果在缓存中找到，返回缓存的版本
          if (response) {
            return response;
          }
          // 否则从网络获取
          return fetch(event.request);
        })
    );
  }
});

/**
 * 🆕 增强的消息处理
 */
self.addEventListener('message', (event) => {
  console.log('📨 Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // 强制跳过等待，立即激活新版本
    console.log('收到SKIP_WAITING消息，强制激活新版本');
    self.skipWaiting();
    return;
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    // 返回当前版本信息
    event.ports[0].postMessage({
      type: 'VERSION_INFO',
      cacheVersion: CACHE_VERSION,
      cacheName: CACHE_NAME,
      timestamp: Date.now()
    });
    return;
  }
  
  if (event.data && event.data.type === 'FORCE_CACHE_CLEAR') {
    // 强制清除缓存
    console.log('收到强制清除缓存请求');
    event.waitUntil(
      forceCleanOldCaches().then(() => {
        // 通知客户端缓存已清除
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'CACHE_CLEARED',
              version: CACHE_VERSION,
              timestamp: Date.now()
            });
          });
        });
      })
    );
    return;
  }
  
  if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
    scheduleReminder(event.data.reminder);
  }
  
  if (event.data && event.data.type === 'CANCEL_REMINDER') {
    cancelReminder(event.data.reminderId);
  }
});

/**
 * 存储定时器
 */
const activeReminders = new Map();

/**
 * 安排提醒
 */
function scheduleReminder(reminder) {
  const { id, title, body, triggerTime, type } = reminder;
  
  console.log('Scheduling reminder:', reminder);
  
  // 计算延迟时间
  const delay = new Date(triggerTime).getTime() - Date.now();
  
  if (delay > 0) {
    const timerId = setTimeout(() => {
      // 显示通知
      showNotification(title, body, type);
      
      // 发送消息给主线程
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'REMINDER_TRIGGERED',
            reminder: reminder
          });
        });
      });
      
      // 清除已完成的提醒
      activeReminders.delete(id);
    }, delay);
    
    // 存储定时器ID
    activeReminders.set(id, timerId);
  }
}

/**
 * 取消提醒
 */
function cancelReminder(reminderId) {
  if (activeReminders.has(reminderId)) {
    clearTimeout(activeReminders.get(reminderId));
    activeReminders.delete(reminderId);
    console.log('Cancelled reminder:', reminderId);
  }
}

/**
 * 显示通知
 */
function showNotification(title, body, type = 'default') {
  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'view',
        title: '查看应用',
        icon: '/icon-72.png'
      },
      {
        action: 'dismiss',
        title: '关闭',
        icon: '/icon-72.png'
      }
    ],
    data: {
      type: type,
      timestamp: Date.now()
    }
  };
  
  // 设置不同类型的通知样式
  switch (type) {
    case 'studyStart':
      options.body = `🕐 ${body}`;
      options.tag = 'study-start';
      break;
    case 'studyEnd':
      options.body = `⏰ ${body}`;
      options.tag = 'study-end';
      break;
    case 'taskComplete':
      options.body = `✅ ${body}`;
      options.tag = 'task-complete';
      break;
    case 'taskMaster':
      options.body = `🎯 ${body}`;
      options.tag = 'task-master';
      break;
    default:
      options.body = `🔔 ${body}`;
      options.tag = 'general';
  }
  
  console.log('Showing notification:', title, options);
  
  return self.registration.showNotification(title, options);
}

/**
 * 处理通知点击
 */
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  if (event.action === 'view') {
    // 打开应用
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        // 如果应用已打开，聚焦到该窗口
        const client = clients.find(c => c.url.includes('study-checkin-pwa'));
        if (client) {
          return client.focus();
        }
        // 否则打开新窗口
        return self.clients.openWindow('/');
      })
    );
  }
});

/**
 * 处理通知关闭
 */
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});

/**
 * 后台同步
 */
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-reminder') {
    event.waitUntil(handleBackgroundReminder());
  }
});

/**
 * 处理后台提醒
 */
function handleBackgroundReminder() {
  return self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_REMINDER',
        timestamp: Date.now()
      });
    });
  });
}

/**
 * 定期检查提醒（每分钟）
 */
setInterval(() => {
  const now = Date.now();
  
  // 发送心跳消息给主线程
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'SERVICE_WORKER_HEARTBEAT',
        timestamp: now,
        activeReminders: activeReminders.size
      });
    });
  });
}, 60000); // 每分钟检查一次

console.log('Enhanced Service Worker loaded successfully');
