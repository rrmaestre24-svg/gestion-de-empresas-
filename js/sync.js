// =====================================================
// SISTEMA DE SINCRONIZACIÓN AUTOMÁTICA
// Sincroniza datos entre Firebase y LocalStorage
// =====================================================

const Sync = {
    
    sincronizando: false,
    ultimaSincronizacion: null,
    intervalSync: null,
    
    // -------------------------------------------------
    // INICIALIZAR SISTEMA DE SINCRONIZACIÓN
    // -------------------------------------------------
    inicializar: function() {
        console.log('🔄 Sistema de sincronización iniciado');
        
        // Cargar última fecha de sincronización
        this.ultimaSincronizacion = localStorage.getItem('ultima_sync');
        
        // Sincronizar cada 5 minutos si hay conexión
        this.intervalSync = setInterval(() => {
            if (navigator.onLine && Auth.obtenerUID()) {
                this.sincronizarTodo();
            }
        }, 5 * 60 * 1000); // 5 minutos
        
        // Escuchar eventos de conexión
        window.addEventListener('online', () => {
            console.log('✅ Conexión restablecida - Sincronizando...');
            this.sincronizarTodo();
        });
        
        // Sincronizar al cerrar/recargar página
        window.addEventListener('beforeunload', () => {
            this.sincronizarPendientes();
        });
    },
    
    // -------------------------------------------------
    // SINCRONIZACIÓN COMPLETA AL INICIAR SESIÓN
    // -------------------------------------------------
    sincronizarAlIniciarSesion: async function(uid) {
        if (!navigator.onLine) {
            console.log('📴 Sin conexión - Usando datos locales');
            this.cargarDatosLocales();
            return false;
        }
        
        console.log('🔄 Sincronizando datos al iniciar sesión...');
        
        try {
            // 1. DESCARGAR DATOS DE FIREBASE
            const [productos, facturas, gastos, clientes, empresa, config] = await Promise.all([
                obtenerTodosDocumentos('productos', uid).catch(e => { console.warn('No se pudieron cargar productos:', e); return []; }),
                obtenerTodosDocumentos('facturas', uid).catch(e => { console.warn('No se pudieron cargar facturas:', e); return []; }),
                obtenerTodosDocumentos('gastos', uid).catch(e => { console.warn('No se pudieron cargar gastos:', e); return []; }),
                obtenerTodosDocumentos('clientes', uid).catch(e => { console.warn('No se pudieron cargar clientes:', e); return []; }),
                obtenerDatosEmpresa(uid).catch(e => { console.warn('No se pudieron cargar datos de empresa:', e); return null; }),
                obtenerDocumento('configuracion', uid, 'general').catch(e => { console.warn('No se pudo cargar configuración:', e); return null; })
            ]);
            
            // 2. GUARDAR EN LOCALSTORAGE
            if (productos.length > 0) DBLocal.guardarColeccion('productos', productos);
            if (facturas.length > 0) DBLocal.guardarColeccion('facturas', facturas);
            if (gastos.length > 0) DBLocal.guardarColeccion('gastos', gastos);
            if (clientes.length > 0) DBLocal.guardarColeccion('clientes', clientes);
            if (empresa) DBLocal.guardarEmpresa(empresa);
            if (config) DBLocal.guardarConfiguracion(config);
            
            // 3. ACTUALIZAR ARRAYS EN MEMORIA
            if (typeof Inventario !== 'undefined') Inventario.productos = productos;
            if (typeof Facturas !== 'undefined') Facturas.facturas = facturas;
            if (typeof Contabilidad !== 'undefined') Contabilidad.gastos = gastos;
            
            // 4. MARCAR ÚLTIMA SINCRONIZACIÓN
            this.ultimaSincronizacion = new Date().toISOString();
            localStorage.setItem('ultima_sync', this.ultimaSincronizacion);
            
            console.log('✅ Sincronización inicial completada');
            console.log(`📦 Datos sincronizados:`, {
                productos: productos.length,
                facturas: facturas.length,
                gastos: gastos.length,
                clientes: clientes.length
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Error en sincronización inicial:', error);
            console.log('📁 Cargando datos locales como respaldo...');
            this.cargarDatosLocales();
            return false;
        }
    },
    
    // -------------------------------------------------
    // CARGAR DATOS DESDE LOCALSTORAGE
    // -------------------------------------------------
    cargarDatosLocales: function() {
        console.log('📁 Cargando datos desde localStorage...');
        
        // Cargar datos locales
        const productos = DBLocal.obtenerProductos();
        const facturas = DBLocal.obtenerFacturas();
        const gastos = DBLocal.obtenerGastos();
        
        // Actualizar arrays en memoria
        if (typeof Inventario !== 'undefined') Inventario.productos = productos;
        if (typeof Facturas !== 'undefined') Facturas.facturas = facturas;
        if (typeof Contabilidad !== 'undefined') Contabilidad.gastos = gastos;
        
        console.log(`📦 Datos locales cargados:`, {
            productos: productos.length,
            facturas: facturas.length,
            gastos: gastos.length
        });
    },
    
    // -------------------------------------------------
    // SINCRONIZAR TODO (BIDIRECCIONAL)
    // -------------------------------------------------
    sincronizarTodo: async function() {
        if (this.sincronizando) {
            console.log('⏳ Sincronización en progreso...');
            return;
        }
        
        const uid = Auth.obtenerUID();
        if (!uid || !navigator.onLine) {
            return;
        }
        
        this.sincronizando = true;
        console.log('🔄 Iniciando sincronización bidireccional...');
        
        try {
            // 1. SUBIR DATOS PENDIENTES A FIREBASE
            await this.sincronizarPendientes();
            
            // 2. DESCARGAR DATOS ACTUALIZADOS DE FIREBASE
            await this.descargarDatosActualizados(uid);
            
            // 3. ACTUALIZAR TIMESTAMP
            this.ultimaSincronizacion = new Date().toISOString();
            localStorage.setItem('ultima_sync', this.ultimaSincronizacion);
            
            console.log('✅ Sincronización completa exitosa');
            
            // Notificar al usuario
            if (typeof App !== 'undefined') {
                App.mostrarNotificacion('Sincronizado', 'Datos actualizados correctamente', 'success');
            }
            
        } catch (error) {
            console.error('❌ Error en sincronización:', error);
        } finally {
            this.sincronizando = false;
        }
    },
    
    // -------------------------------------------------
    // SINCRONIZAR DATOS PENDIENTES (LOCAL → FIREBASE)
    // -------------------------------------------------
    sincronizarPendientes: async function() {
        const uid = Auth.obtenerUID();
        if (!uid || !navigator.onLine) return;
        
        const pendientes = DBLocal.obtenerPendientesSincronizar();
        
        if (pendientes.length === 0) {
            console.log('✅ No hay datos pendientes para sincronizar');
            return;
        }
        
        console.log(`📤 Subiendo ${pendientes.length} elementos pendientes...`);
        
        for (const item of pendientes) {
            try {
                const datos = DBLocal.buscarPorId(item.coleccion, item.id);
                
                if (datos) {
                    await guardarDocumento(item.coleccion, uid, datos, item.id);
                    DBLocal.limpiarSincronizado(item.coleccion, item.id);
                    console.log(`✅ Sincronizado: ${item.coleccion}/${item.id}`);
                }
            } catch (error) {
                console.error(`❌ Error al sincronizar ${item.coleccion}/${item.id}:`, error);
            }
        }
    },
    
    // -------------------------------------------------
    // DESCARGAR DATOS ACTUALIZADOS (FIREBASE → LOCAL)
    // -------------------------------------------------
    descargarDatosActualizados: async function(uid) {
        console.log('📥 Descargando datos actualizados de Firebase...');
        
        try {
            // Obtener datos de Firebase
            const [productos, facturas, gastos] = await Promise.all([
                obtenerTodosDocumentos('productos', uid),
                obtenerTodosDocumentos('facturas', uid),
                obtenerTodosDocumentos('gastos', uid)
            ]);
            
            // Actualizar LocalStorage
            DBLocal.guardarColeccion('productos', productos);
            DBLocal.guardarColeccion('facturas', facturas);
            DBLocal.guardarColeccion('gastos', gastos);
            
            // Actualizar memoria
            if (typeof Inventario !== 'undefined') {
                Inventario.productos = productos;
                Inventario.renderizarProductos();
            }
            
            if (typeof Facturas !== 'undefined') {
                Facturas.facturas = facturas;
                Facturas.renderizarFacturas();
            }
            
            if (typeof Contabilidad !== 'undefined') {
                Contabilidad.gastos = gastos;
                Contabilidad.renderizarGastos();
            }
            
            // Actualizar dashboard
            if (typeof App !== 'undefined') {
                App.actualizarDashboard();
            }
            
            console.log('✅ Datos actualizados desde Firebase');
            
        } catch (error) {
            console.error('❌ Error al descargar datos:', error);
            throw error;
        }
    },
    
    // -------------------------------------------------
    // ESCUCHAR CAMBIOS EN TIEMPO REAL
    // -------------------------------------------------
    escucharCambiosEnTiempoReal: function(uid) {
        if (!uid) return;
        
        console.log('👂 Escuchando cambios en tiempo real...');
        
        // Escuchar productos
        const unsubProductos = escucharColeccion('productos', uid, (productos, error) => {
            if (error) {
                console.error('Error al escuchar productos:', error);
                return;
            }
            
            if (productos) {
                DBLocal.guardarColeccion('productos', productos);
                if (typeof Inventario !== 'undefined') {
                    Inventario.productos = productos;
                    Inventario.renderizarProductos();
                }
                console.log('🔄 Productos actualizados en tiempo real');
            }
        });
        
        // Escuchar facturas
        const unsubFacturas = escucharColeccion('facturas', uid, (facturas, error) => {
            if (error) {
                console.error('Error al escuchar facturas:', error);
                return;
            }
            
            if (facturas) {
                DBLocal.guardarColeccion('facturas', facturas);
                if (typeof Facturas !== 'undefined') {
                    Facturas.facturas = facturas;
                    Facturas.renderizarFacturas();
                }
                console.log('🔄 Facturas actualizadas en tiempo real');
            }
        });
        
        // Escuchar gastos
        const unsubGastos = escucharColeccion('gastos', uid, (gastos, error) => {
            if (error) {
                console.error('Error al escuchar gastos:', error);
                return;
            }
            
            if (gastos) {
                DBLocal.guardarColeccion('gastos', gastos);
                if (typeof Contabilidad !== 'undefined') {
                    Contabilidad.gastos = gastos;
                    Contabilidad.renderizarGastos();
                }
                console.log('🔄 Gastos actualizados en tiempo real');
            }
        });
        
        // Guardar funciones de desuscripción para limpiar después
        window.unsubscribeListeners = {
            productos: unsubProductos,
            facturas: unsubFacturas,
            gastos: unsubGastos
        };
    },
    
    // -------------------------------------------------
    // DETENER ESCUCHA EN TIEMPO REAL
    // -------------------------------------------------
    detenerEscuchaEnTiempoReal: function() {
        if (window.unsubscribeListeners) {
            window.unsubscribeListeners.productos();
            window.unsubscribeListeners.facturas();
            window.unsubscribeListeners.gastos();
            console.log('👋 Escucha en tiempo real detenida');
        }
    },
    
    // -------------------------------------------------
    // LIMPIAR AL CERRAR SESIÓN
    // -------------------------------------------------
    limpiarAlCerrarSesion: function() {
        // Detener sincronización automática
        if (this.intervalSync) {
            clearInterval(this.intervalSync);
            this.intervalSync = null;
        }
        
        // Detener escucha en tiempo real
        this.detenerEscuchaEnTiempoReal();
        
        console.log('🔚 Sistema de sincronización detenido');
    }
};

// Hacer disponible globalmente
window.Sync = Sync;