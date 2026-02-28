const CACHE_NAME = 'kgv-manager-v2';
const ASSETS = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json'
];

// Installation: Cache App Shell
self.addEventListener('install', (event) => {
    // Ggf. alten SW sofort überspringen
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Übernimmt sofort Kontrolle
    );
});

// Fetch: Network-First Strategy 
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Netzwerk-Antwort kopieren und in Cache legen
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                }
                return response;
            })
            .catch(() => {
                // Offline Fallback 
                return caches.match(event.request);
            })
    );
});
