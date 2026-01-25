// =====================================================
// SERVICE WORKER - FacturaPRO PWA
// Maneja el cache y funcionamiento offline
// =====================================================

// Nombre del cache y versión
const CACHE_NAME = 'facturapro-v1.0.1';

// Archivos que se van a cachear para funcionamiento offline
const ARCHIVOS_CACHE = [
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/firebase-config.js',
    './js/db-local.js',
    './js/auth.js',
    './js/inventario.js',
    './js/facturas.js',
    './js/contabilidad.js',
    './js/pdf-generator.js',
    './manifest.json',
    // CDN de Bootstrap (se cachea para offline)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js'
];

// =====================================================
// EVENTO: INSTALACIÓN DEL SERVICE WORKER
// Se ejecuta cuando el SW se instala por primera vez
// =====================================================
self.addEventListener('install', (evento) => {
    console.log('[SW] Instalando Service Worker...');
    
    evento.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Cacheando archivos de la aplicación');
                // Usar addAll solo con archivos que EXISTEN
                return cache.addAll(ARCHIVOS_CACHE).catch(err => {
                    console.error('[SW] Error al cachear archivos:', err);
                    // Continuar aunque falle el cache
                    return Promise.resolve();
                });
            })
            .then(() => {
                // Forzar activación inmediata
                return self.skipWaiting();
            })
    );
});

// =====================================================
// EVENTO: ACTIVACIÓN DEL SERVICE WORKER
// Limpia caches antiguos cuando hay una nueva versión
// =====================================================
self.addEventListener('activate', (evento) => {
    console.log('[SW] Activando Service Worker...');
    
    evento.waitUntil(
        caches.keys()
            .then((nombresCaches) => {
                return Promise.all(
                    nombresCaches.map((nombreCache) => {
                        // Eliminar caches antiguos que no coincidan con la versión actual
                        if (nombreCache !== CACHE_NAME) {
                            console.log('[SW] Eliminando cache antiguo:', nombreCache);
                            return caches.delete(nombreCache);
                        }
                    })
                );
            })
            .then(() => {
                // Tomar control de todas las páginas inmediatamente
                return self.clients.claim();
            })
    );
});

// =====================================================
// EVENTO: FETCH (INTERCEPTAR PETICIONES DE RED)
// Estrategia: Network First para Firebase, Cache First para assets
// =====================================================
self.addEventListener('fetch', (evento) => {
    // Ignorar peticiones que no sean GET
    if (evento.request.method !== 'GET') {
        return;
    }
    
    const url = new URL(evento.request.url);
    
    // Ignorar peticiones a Firebase (deben ir siempre a la red)
    if (url.hostname.includes('firebase') || 
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic')) {
        return;
    }
    
    // Para archivos locales y CDNs, usar Cache First
    evento.respondWith(
        caches.match(evento.request)
            .then((respuestaCache) => {
                // Si está en cache, retornar desde cache
                if (respuestaCache) {
                    return respuestaCache;
                }
                
                // Si no está en cache, buscar en la red
                return fetch(evento.request)
                    .then((respuestaRed) => {
                        // Verificar que la respuesta sea válida
                        if (!respuestaRed || respuestaRed.status !== 200 || respuestaRed.type === 'error') {
                            return respuestaRed;
                        }
                        
                        // Clonar la respuesta para guardarla en cache
                        const respuestaClonada = respuestaRed.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(evento.request, respuestaClonada);
                            });
                        
                        return respuestaRed;
                    })
                    .catch(() => {
                        // Si falla la red y es una página HTML, mostrar página offline
                        if (evento.request.headers.get('accept').includes('text/html')) {
                            return caches.match('./index.html');
                        }
                    });
            })
    );
});

// =====================================================
// EVENTO: SINCRONIZACIÓN EN SEGUNDO PLANO
// Para sincronizar datos cuando vuelve la conexión
// =====================================================
self.addEventListener('sync', (evento) => {
    console.log('[SW] Evento de sincronización:', evento.tag);
    
    if (evento.tag === 'sincronizar-datos') {
        evento.waitUntil(sincronizarDatosConServidor());
    }
});

// Función para sincronizar datos pendientes
async function sincronizarDatosConServidor() {
    console.log('[SW] Iniciando sincronización de datos...');
    // La sincronización real se maneja desde el JavaScript principal
    // Aquí solo notificamos a los clientes
    const clientes = await self.clients.matchAll();
    clientes.forEach(cliente => {
        cliente.postMessage({
            tipo: 'SINCRONIZACION_DISPONIBLE'
        });
    });
}

// =====================================================
// EVENTO: MENSAJES DESDE LA APLICACIÓN
// Comunicación bidireccional con el JavaScript principal
// =====================================================
self.addEventListener('message', (evento) => {
    console.log('[SW] Mensaje recibido:', evento.data);
    
    if (evento.data.tipo === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});