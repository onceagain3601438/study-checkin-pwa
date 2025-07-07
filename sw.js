/**
 * 学习打卡PWA Service Worker
 * 实现离线缓存和应用安装功能
 */

const CACHE_NAME = 'study-checkin-v2.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/voice-reminder.js',
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
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

/**
 * 激活Service Worker
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
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
        // 如果在缓存中找到，返回缓存的版本
        if (response) {
          return response;
        }
        // 否则从网络获取
        return fetch(event.request);
      })
  );
});

/**
 * 监听消息
 */
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);
  
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
