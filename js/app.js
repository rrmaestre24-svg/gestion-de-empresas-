// =====================================================
// APLICACIÓN PRINCIPAL - FacturaPRO Colombia
// =====================================================

const App = {
    usuarioActual: null,
    seccionActual: 'dashboard',
    deferredPrompt: null,
    
inicializar: async function() {
        console.log('🚀 Iniciando FacturaPRO...');
        
        if (typeof inicializarFirebaseSafe === 'function') {
            const firebaseOK = await inicializarFirebaseSafe();
            if (!firebaseOK) console.warn('⚠️ Modo OFFLINE');
        }
        
        this.registrarServiceWorker();
        this.configurarInstalacionPWA();
        
        // 🔥 INICIALIZAR SISTEMA DE SINCRONIZACIÓN
        if (typeof Sync !== 'undefined') {
            Sync.inicializar();
        }
        
        Auth.inicializar((usuario) => this.manejarCambioAuth(usuario));
        this.configurarEventosGlobales();
        this.configurarMonitorConexion();
        this.mostrarFechaActual();
        
        setTimeout(() => this.ocultarPantallaCarga(), 800);
    },
    registrarServiceWorker: async function() {
        if ('serviceWorker' in navigator) {
            try {
                const registro = await navigator.serviceWorker.register('./sw.js');
                console.log('✅ Service Worker registrado');
                registro.addEventListener('updatefound', () => {
                    const nuevoSW = registro.installing;
                    nuevoSW.addEventListener('statechange', () => {
                        if (nuevoSW.state === 'installed' && navigator.serviceWorker.controller) {
                            this.mostrarNotificacion('Actualización', 'Nueva versión disponible', 'info');
                        }
                    });
                });
            } catch (error) {
                console.error('Error SW:', error);
            }
        }
    },
    
    configurarInstalacionPWA: function() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const banner = document.getElementById('banner-instalacion');
            if (banner) banner.classList.remove('d-none');
        });
        
        const btnInstalar = document.getElementById('btn-instalar-pwa');
        if (btnInstalar) btnInstalar.addEventListener('click', () => this.instalarPWA());
        
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            const banner = document.getElementById('banner-instalacion');
            if (banner) banner.classList.add('d-none');
        });
    },
    
    instalarPWA: async function() {
        if (!this.deferredPrompt) return;
        this.deferredPrompt.prompt();
        await this.deferredPrompt.userChoice;
        this.deferredPrompt = null;
    },
    
    manejarCambioAuth: async function(usuario) {
        const seccionAuth = document.getElementById('seccion-auth');
        const seccionPrincipal = document.getElementById('seccion-principal');
        
        if (usuario) {
            this.usuarioActual = usuario;
            seccionAuth.classList.add('d-none');
            seccionPrincipal.classList.remove('d-none');
            
            const empresa = DBLocal.obtenerEmpresa();
            const nombreNav = document.getElementById('nombre-empresa-nav');
            if (nombreNav && empresa.nombre) nombreNav.textContent = empresa.nombre;
            
            await this.inicializarModulos();
            this.irASeccion('dashboard');
        } else {
            this.usuarioActual = null;
            seccionAuth.classList.remove('d-none');
            seccionPrincipal.classList.add('d-none');
        }
    },
    
    inicializarModulos: async function() {
        try {
            await Inventario.inicializar();
            await Facturas.inicializar();
            await Contabilidad.inicializar();
            if (typeof Reportes !== 'undefined') Reportes.inicializar();
            this.actualizarDashboard();
        } catch (error) {
            console.error('Error módulos:', error);
        }
    },
    
    configurarEventosGlobales: function() {
        // Login
        const formLogin = document.getElementById('form-login');
        if (formLogin) formLogin.addEventListener('submit', (e) => { e.preventDefault(); this.procesarLogin(); });
        
        // Registro
        const formRegistro = document.getElementById('form-registro');
        if (formRegistro) formRegistro.addEventListener('submit', (e) => { e.preventDefault(); this.procesarRegistro(); });
        
        // Cerrar sesión
        const btnCerrar = document.getElementById('btn-cerrar-sesion');
        if (btnCerrar) btnCerrar.addEventListener('click', () => this.cerrarSesion());
        
        // Sincronizar
        const btnSync = document.getElementById('btn-sync');
        if (btnSync) btnSync.addEventListener('click', () => this.sincronizarDatos());
        
        // Sidebar móvil
        const btnToggle = document.getElementById('btn-toggle-sidebar');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (btnToggle && sidebar) {
            btnToggle.addEventListener('click', () => {
                sidebar.classList.toggle('show');
                overlay?.classList.toggle('show');
            });
        }
        
        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar?.classList.remove('show');
                overlay.classList.remove('show');
            });
        }
        
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 992) {
                    sidebar?.classList.remove('show');
                    overlay?.classList.remove('show');
                }
            });
        });
    },
    
    configurarMonitorConexion: function() {
        const indicador = document.getElementById('indicador-conexion');
        const actualizar = () => {
            if (indicador) {
                indicador.classList.toggle('online', navigator.onLine);
                indicador.classList.toggle('offline', !navigator.onLine);
            }
        };
        window.addEventListener('online', () => { actualizar(); this.mostrarNotificacion('Conexión', 'Conectado', 'success'); });
        window.addEventListener('offline', () => { actualizar(); this.mostrarNotificacion('Sin conexión', 'Modo offline', 'warning'); });
        actualizar();
    },
    
    mostrarFechaActual: function() {
        const el = document.getElementById('fecha-actual');
        if (el) el.textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    },
    
    procesarLogin: async function() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        if (!email || !password) { this.mostrarNotificacion('Error', 'Completa todos los campos', 'danger'); return; }
        
        const btn = document.querySelector('#form-login button[type="submit"]');
        const txt = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Ingresando...';
        btn.disabled = true;
        
        const res = await Auth.iniciarSesion(email, password);
        btn.innerHTML = txt;
        btn.disabled = false;
        if (!res.exito) this.mostrarNotificacion('Error', res.error, 'danger');
    },
    
    procesarRegistro: async function() {
        const empresa = document.getElementById('registro-empresa').value;
        const nit = document.getElementById('registro-nit').value;
        const email = document.getElementById('registro-email').value;
        const password = document.getElementById('registro-password').value;
        const ciudad = document.getElementById('registro-ciudad').value;
        
        if (!empresa || !email || !password || !ciudad) { this.mostrarNotificacion('Error', 'Completa los campos obligatorios', 'danger'); return; }
        
        const btn = document.querySelector('#form-registro button[type="submit"]');
        const txt = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creando...';
        btn.disabled = true;
        
        const res = await Auth.registrar(email, password, { nombre: empresa, nit, ciudad });
        btn.innerHTML = txt;
        btn.disabled = false;
        
        if (res.exito) this.mostrarNotificacion('¡Bienvenido!', 'Cuenta creada', 'success');
        else this.mostrarNotificacion('Error', res.error, 'danger');
    },
    
    cerrarSesion: async function() {
        if (confirm('¿Cerrar sesión?')) {
            await Auth.cerrarSesion();
            this.mostrarNotificacion('Sesión cerrada', 'Has salido correctamente', 'info');
        }
    },
    
    irASeccion: function(seccion) {
        document.querySelectorAll('.seccion-contenido').forEach(el => el.classList.add('d-none'));
        const vista = document.getElementById(`vista-${seccion}`);
        if (vista) vista.classList.remove('d-none');
        
        document.querySelectorAll('.sidebar .nav-link, .nav-mobile .nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('onclick')?.includes(seccion)) link.classList.add('active');
        });
        
        this.seccionActual = seccion;
        
        if (seccion === 'dashboard') this.actualizarDashboard();
        else if (seccion === 'reportes' && typeof Reportes !== 'undefined') Reportes.generarReporteCompleto();
        else if (seccion === 'configuracion') this.cargarConfiguracion();
    },
    
    actualizarDashboard: function() {
        const stats = Contabilidad.obtenerEstadisticasMes();
        document.getElementById('stat-ventas-mes').textContent = '$' + this.formatearNumero(stats.ventas);
        document.getElementById('stat-facturas-mes').textContent = stats.facturas;
        document.getElementById('stat-productos').textContent = Inventario.productos?.length || 0;
        
        const pendientes = (Facturas.facturas || []).filter(f => f.estado === 'pendiente').length;
        document.getElementById('stat-pendientes').textContent = pendientes;
        
        this.renderizarUltimasFacturas();
        if (typeof Reportes !== 'undefined') Reportes.actualizarDashboard();
    },
    
    renderizarUltimasFacturas: function() {
        const tbody = document.getElementById('tabla-ultimas-facturas');
        if (!tbody) return;
        
        const ultimas = (Facturas.facturas || []).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 5);
        
        if (ultimas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Sin facturas recientes</td></tr>';
            return;
        }
        
        tbody.innerHTML = ultimas.map(f => `
            <tr onclick="App.irASeccion('facturas')" style="cursor:pointer">
                <td><strong>${f.numero}</strong></td>
                <td>${f.cliente?.nombre || 'Consumidor Final'}</td>
                <td>$${this.formatearNumero(f.total)}</td>
                <td><span class="badge badge-${f.estado || 'pendiente'}">${this.textoEstado(f.estado)}</span></td>
            </tr>
        `).join('');
    },
    
    cargarConfiguracion: function() {
        const empresa = DBLocal.obtenerEmpresa();
        const config = DBLocal.obtenerConfiguracion();
        
        document.getElementById('config-empresa-nombre').value = empresa.nombre || '';
        document.getElementById('config-empresa-nit').value = empresa.nit || '';
        document.getElementById('config-empresa-direccion').value = empresa.direccion || '';
        document.getElementById('config-empresa-ciudad').value = empresa.ciudad || '';
        document.getElementById('config-empresa-telefono').value = empresa.telefono || '';
        
        const previewLogo = document.getElementById('preview-logo');
        if (empresa.logo && previewLogo) previewLogo.innerHTML = `<img src="${empresa.logo}" style="max-width: 150px; border-radius: 8px;">`;
        
        document.getElementById('config-prefijo').value = config.prefijoFactura || 'FAC';
        document.getElementById('config-numero-actual').value = config.numeroFacturaActual || 0;
        document.getElementById('config-iva').value = config.iva || 19;
        document.getElementById('config-mensaje').value = config.mensajeFactura || '';
    },
    
    guardarConfigEmpresa: async function() {
        const empresa = {
            nombre: document.getElementById('config-empresa-nombre').value,
            nit: document.getElementById('config-empresa-nit').value,
            direccion: document.getElementById('config-empresa-direccion').value,
            ciudad: document.getElementById('config-empresa-ciudad').value,
            telefono: document.getElementById('config-empresa-telefono').value
        };
        
        const inputLogo = document.getElementById('config-empresa-logo');
        if (inputLogo.files && inputLogo.files[0]) {
            try { empresa.logo = await archivoABase64(inputLogo.files[0]); } catch (e) {}
        } else {
            empresa.logo = DBLocal.obtenerEmpresa().logo;
        }
        
        try {
            const uid = Auth.obtenerUID();
            if (navigator.onLine && uid) await guardarDatosEmpresa(uid, empresa);
            DBLocal.guardarEmpresa(empresa);
            
            const nombreNav = document.getElementById('nombre-empresa-nav');
            if (nombreNav) nombreNav.textContent = empresa.nombre;
            
            this.mostrarNotificacion('Éxito', 'Datos guardados', 'success');
        } catch (error) {
            this.mostrarNotificacion('Error', 'No se pudieron guardar', 'danger');
        }
    },
    
    guardarConfigFacturacion: async function() {
        const config = {
            prefijoFactura: document.getElementById('config-prefijo').value || 'FAC',
            numeroFacturaActual: parseInt(document.getElementById('config-numero-actual').value) || 0,
            iva: parseInt(document.getElementById('config-iva').value) || 19,
            mensajeFactura: document.getElementById('config-mensaje').value || ''
        };
        
        try {
            const uid = Auth.obtenerUID();
            if (navigator.onLine && uid) await guardarDocumento('configuracion', uid, config, 'general');
            DBLocal.guardarConfiguracion(config);
            this.mostrarNotificacion('Éxito', 'Configuración guardada', 'success');
        } catch (error) {
            this.mostrarNotificacion('Error', 'No se pudo guardar', 'danger');
        }
    },
    
    sincronizarDatos: async function() {
        if (!navigator.onLine) { this.mostrarNotificacion('Sin conexión', 'No hay internet', 'warning'); return; }
        
        const uid = Auth.obtenerUID();
        if (!uid) return;
        
        const btn = document.getElementById('btn-sync');
        const icono = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        btn.disabled = true;
        
        try {
            const pendientes = DBLocal.obtenerPendientesSincronizar();
            for (const p of pendientes) {
                const datos = DBLocal.buscarPorId(p.coleccion, p.id);
                if (datos) {
                    await guardarDocumento(p.coleccion, uid, datos, p.id);
                    DBLocal.limpiarSincronizado(p.coleccion, p.id);
                }
            }
            
            await Inventario.cargarProductos();
            await Facturas.cargarFacturas();
            await Contabilidad.cargarGastos();
            
            Inventario.renderizarProductos();
            Facturas.renderizarFacturas();
            Contabilidad.renderizarGastos();
            this.actualizarDashboard();
            
            this.mostrarNotificacion('Éxito', 'Datos sincronizados', 'success');
        } catch (error) {
            this.mostrarNotificacion('Error', 'Error al sincronizar', 'danger');
        }
        
        btn.innerHTML = icono;
        btn.disabled = false;
    },
    
    sincronizarConNube: async function() {
        if (!navigator.onLine) { this.mostrarNotificacion('Sin conexión', 'No hay internet', 'warning'); return; }
        if (!confirm('¿Sincronizar todos los datos?')) return;
        
        const uid = Auth.obtenerUID();
        if (!uid) return;
        
        try {
            const productos = await obtenerTodosDocumentos('productos', uid);
            const facturas = await obtenerTodosDocumentos('facturas', uid);
            const gastos = await obtenerTodosDocumentos('gastos', uid);
            const empresa = await obtenerDatosEmpresa(uid);
            const config = await obtenerDocumento('configuracion', uid, 'general');
            
            DBLocal.guardarColeccion('productos', productos);
            DBLocal.guardarColeccion('facturas', facturas);
            DBLocal.guardarColeccion('gastos', gastos);
            if (empresa) DBLocal.guardarEmpresa(empresa);
            if (config) DBLocal.guardarConfiguracion(config);
            
            Inventario.productos = productos;
            Facturas.facturas = facturas;
            Contabilidad.gastos = gastos;
            
            Inventario.renderizarProductos();
            Facturas.renderizarFacturas();
            Contabilidad.renderizarGastos();
            this.actualizarDashboard();
            
            this.mostrarNotificacion('Éxito', 'Sincronizado desde la nube', 'success');
        } catch (error) {
            this.mostrarNotificacion('Error', 'Error al sincronizar', 'danger');
        }
    },
    
    descargarBackup: function() {
        const datos = DBLocal.exportarTodo();
        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `backup_facturapro_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(link.href);
        this.mostrarNotificacion('Éxito', 'Backup descargado', 'success');
    },
    
    restaurarBackup: function(evento) {
        const archivo = evento.target.files[0];
        if (!archivo) return;
        if (!confirm('¿Reemplazar todos los datos?')) { evento.target.value = ''; return; }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const datos = JSON.parse(e.target.result);
                if (DBLocal.importarTodo(datos)) {
                    Inventario.productos = datos.productos || [];
                    Facturas.facturas = datos.facturas || [];
                    Contabilidad.gastos = datos.gastos || [];
                    Inventario.renderizarProductos();
                    Facturas.renderizarFacturas();
                    Contabilidad.renderizarGastos();
                    this.actualizarDashboard();
                    this.mostrarNotificacion('Éxito', 'Backup restaurado', 'success');
                }
            } catch (error) {
                this.mostrarNotificacion('Error', 'Archivo inválido', 'danger');
            }
        };
        reader.readAsText(archivo);
        evento.target.value = '';
    },
    
    ocultarPantallaCarga: function() {
        const pantalla = document.getElementById('pantalla-carga');
        const app = document.getElementById('app');
        if (pantalla) {
            pantalla.style.opacity = '0';
            pantalla.style.transition = 'opacity 0.3s ease';
            setTimeout(() => pantalla.style.display = 'none', 300);
        }
        if (app) app.classList.remove('d-none');
    },
    
    mostrarNotificacion: function(titulo, mensaje, tipo = 'info') {
        const toastEl = document.getElementById('toast-notificacion');
        const toastTitulo = document.getElementById('toast-titulo');
        const toastMensaje = document.getElementById('toast-mensaje');
        if (!toastEl) return;
        
        toastTitulo.textContent = titulo;
        toastMensaje.textContent = mensaje;
        toastEl.className = 'toast';
        
        const colores = { success: 'bg-success text-white', danger: 'bg-danger text-white', warning: 'bg-warning text-dark', info: 'bg-info text-white' };
        if (colores[tipo]) toastEl.classList.add(...colores[tipo].split(' '));
        
        new bootstrap.Toast(toastEl, { delay: 4000 }).show();
    },
    
    formatearNumero: function(n) { return new Intl.NumberFormat('es-CO').format(n || 0); },
    textoEstado: function(e) { return { pendiente: 'Pendiente', pagada: 'Pagada', anulada: 'Anulada' }[e] || 'Pendiente'; }
};

document.addEventListener('DOMContentLoaded', () => App.inicializar());
window.App = App;
