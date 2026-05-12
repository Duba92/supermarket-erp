const CACHE_NAME = 'supermarket-erp-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/login.html',
    '/dashboard.html',
    '/pos.html',
    '/products.html',
    '/inventory.html',
    '/reports.html',
    '/expenses.html',
    '/css/style.css',
    '/js/app.js',
    '/js/auth.js',
    '/js/db.js',
    '/js/offline.js',
    '/js/sync.js',
    '/js/pos.js',
    '/js/products.js',
    '/js/inventory.js',
    '/js/reports.js',
    '/js/expenses.js',
    '/manifest.json'
];

// Install service worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch from cache first, then network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Clone the request
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then(
                    response => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone the response
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    }
                );
            })
    );
});

// Activate and clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Handle background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-sales') {
        event.waitUntil(syncSales());
    }
});

async function syncSales() {
    // Custom sync logic
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'SYNC_SALES',
            message: 'Syncing pending sales...'
        });
    });
}
