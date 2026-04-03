// =====================================================
// SERVICE WORKER - FacturaPRO PWA
// Maneja el cache y funcionamiento offline
// =====================================================

const CACHE_NAME = 'facturapro-v1.0.2';

// Archivos de la aplicación (rutas absolutas para Vercel)
const ARCHIVOS_APP = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/firebase-config.js',
    '/js/db-local.js',
    '/js/sync.js',
    '/js/auth.js',
    '/js/inventario.js',
    '/js/facturas.js',
    '/js/contabilidad.js',
    '/js/reportes.js',
    '/js/pdf-generator.js',
    '/js/app.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// Recursos CDN que también se cachean para offline
const ARCHIVOS_CDN = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js'
];

// =====================================================
// INSTALACIÓN
// =====================================================
self.addEventListener('install', (evento) => {
    console.log('[SW] Instalando v' + CACHE_NAME);

    evento.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cachear archivos de la app (críticos)
            try {
                await cache.addAll(ARCHIVOS_APP);
                console.log('[SW] Archivos de app cacheados');
            } catch (err) {
                console.warn('[SW] Error cacheando app:', err);
                // Intentar uno a uno para no fallar todo por uno
                for (const url of ARCHIVOS_APP) {
                    try { await cache.add(url); } catch (e) { /* ignorar */ }
                }
            }

            // Cachear CDNs (no críticos, puede fallar)
            for (const url of ARCHIVOS_CDN) {
                try { await cache.add(url); } catch (e) { /* ignorar */ }
            }
        }).then(() => self.skipWaiting())
    );
});

// =====================================================
// ACTIVACIÓN — limpiar caches antiguos
// =====================================================
self.addEventListener('activate', (evento) => {
    console.log('[SW] Activando ' + CACHE_NAME);

    evento.waitUntil(
        caches.keys().then((caches) =>
            Promise.all(
                caches
                    .filter((nombre) => nombre !== CACHE_NAME)
                    .map((nombre) => {
                        console.log('[SW] Eliminando cache antiguo:', nombre);
                        return caches.delete(nombre);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// =====================================================
// FETCH — estrategia por tipo de recurso
// =====================================================
self.addEventListener('fetch', (evento) => {
    if (evento.request.method !== 'GET') return;

    const url = new URL(evento.request.url);

    // Firebase y googleapis siempre van a la red (nunca cachear)
    if (
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic') ||
        url.hostname.includes('firebaseio') ||
        url.hostname.includes('firestore')
    ) {
        return;
    }

    // Fuentes de Google — Cache First (cambian muy poco)
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
        evento.respondWith(cacheFirst(evento.request));
        return;
    }

    // Archivos de la app y CDNs — Cache First con actualización en background
    evento.respondWith(staleWhileRevalidate(evento.request));
});

// Cache First: usa cache si existe, si no va a la red y cachea
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Recurso no disponible offline', { status: 503 });
    }
}

// Stale-While-Revalidate: responde con cache inmediatamente y actualiza en background
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => null);

    if (cached) return cached;

    // Sin cache: esperar la red
    const response = await fetchPromise;
    if (response) return response;

    // Sin red ni cache: fallback a index.html para navegación
    if (request.headers.get('accept')?.includes('text/html')) {
        return cache.match('/index.html');
    }

    return new Response('Sin conexión', { status: 503 });
}

// =====================================================
// MENSAJES DESDE LA APLICACIÓN
// =====================================================
self.addEventListener('message', (evento) => {
    if (evento.data?.tipo === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// =====================================================
// SINCRONIZACIÓN EN SEGUNDO PLANO (Background Sync)
// =====================================================
self.addEventListener('sync', (evento) => {
    if (evento.tag === 'sincronizar-datos') {
        evento.waitUntil(notificarSincronizacion());
    }
});

async function notificarSincronizacion() {
    const clientes = await self.clients.matchAll({ includeUncontrolled: true });
    clientes.forEach((cliente) => {
        cliente.postMessage({ tipo: 'SINCRONIZACION_DISPONIBLE' });
    });
}
