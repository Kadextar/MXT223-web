const CACHE_NAME = 'mxt223-schedule-v4';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/static/styles.css',
    '/static/app.js',
    '/static/schedule_data.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
    'https://kit.fontawesome.com/a076d05399.js',
];

// Install Event
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force waiting SW to become active immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all: app shell and content');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // Если есть в кэше — возвращаем
            if (response) {
                return response;
            }
            // Нет в кэше — качаем из сети
            return fetch(event.request);
        })
    );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim()) // Become available to all pages immediately
    );
});
// Push Event
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        console.log('[Service Worker] Push Received:', data);

        const title = data.title || 'МХТ-223';
        const options = {
            body: data.body,
            icon: data.icon || '/static/icons/icon-192x192.png',
            badge: '/static/icons/icon-72x72.png',
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(self.registration.showNotification(title, options));
    }
});

// Notification Click Event
self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification click Received.', event.notification.data);

    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there is already a window open and focus it
            for (const client of clientList) {
                if (client.url.includes(event.notification.data.url) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});
