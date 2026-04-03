// =====================================================
// BASE DE DATOS LOCAL - LOCALSTORAGE
// Manejo de datos offline con LocalStorage
// =====================================================

// Prefijo para las claves en localStorage
const PREFIJO_DB = 'facturapro_';

// =====================================================
// CLASE PRINCIPAL DE BASE DE DATOS LOCAL
// =====================================================
const DBLocal = {
    
    // -------------------------------------------------
    // FUNCIONES BÁSICAS DE ALMACENAMIENTO
    // -------------------------------------------------
    
    // Guardar datos en localStorage
    guardar: function(clave, datos) {
        try {
            const claveCompleta = PREFIJO_DB + clave;
            const datosString = JSON.stringify(datos);
            localStorage.setItem(claveCompleta, datosString);
            return true;
        } catch (error) {
            console.error('Error al guardar en localStorage:', error);
            // Verificar si es error de espacio
            if (error.name === 'QuotaExceededError') {
                this.mostrarErrorEspacio();
            }
            return false;
        }
    },
    
    // Obtener datos de localStorage
    obtener: function(clave) {
        try {
            const claveCompleta = PREFIJO_DB + clave;
            const datosString = localStorage.getItem(claveCompleta);
            
            if (datosString) {
                return JSON.parse(datosString);
            }
            return null;
        } catch (error) {
            console.error('Error al obtener de localStorage:', error);
            return null;
        }
    },
    
    // Eliminar datos de localStorage
    eliminar: function(clave) {
        try {
            const claveCompleta = PREFIJO_DB + clave;
            localStorage.removeItem(claveCompleta);
            return true;
        } catch (error) {
            console.error('Error al eliminar de localStorage:', error);
            return false;
        }
    },
    
    // Verificar si existe una clave
    existe: function(clave) {
        const claveCompleta = PREFIJO_DB + clave;
        return localStorage.getItem(claveCompleta) !== null;
    },
    
    // -------------------------------------------------
    // FUNCIONES PARA COLECCIONES (ARRAYS DE OBJETOS)
    // -------------------------------------------------
    
    // Obtener todos los elementos de una colección
    obtenerColeccion: function(nombreColeccion) {
        const datos = this.obtener(nombreColeccion);
        return datos || [];
    },
    
    // Guardar colección completa
    guardarColeccion: function(nombreColeccion, datos) {
        return this.guardar(nombreColeccion, datos);
    },
    
    // Agregar elemento a una colección
    agregarAColeccion: function(nombreColeccion, elemento) {
        const coleccion = this.obtenerColeccion(nombreColeccion);
        
        // Generar ID único si no tiene
        if (!elemento.id) {
            elemento.id = this.generarId();
        }
        
        // Agregar timestamps
        elemento.creadoEn = new Date().toISOString();
        elemento.actualizadoEn = new Date().toISOString();
        
        coleccion.push(elemento);
        this.guardarColeccion(nombreColeccion, coleccion);
        
        return elemento.id;
    },
    
    // Actualizar elemento en una colección
    actualizarEnColeccion: function(nombreColeccion, id, datosActualizados) {
        const coleccion = this.obtenerColeccion(nombreColeccion);
        const indice = coleccion.findIndex(item => item.id === id);
        
        if (indice !== -1) {
            // Mantener datos originales y actualizar
            coleccion[indice] = {
                ...coleccion[indice],
                ...datosActualizados,
                actualizadoEn: new Date().toISOString()
            };
            
            this.guardarColeccion(nombreColeccion, coleccion);
            return true;
        }
        
        return false;
    },
    
    // Eliminar elemento de una colección
    eliminarDeColeccion: function(nombreColeccion, id) {
        const coleccion = this.obtenerColeccion(nombreColeccion);
        const coleccionFiltrada = coleccion.filter(item => item.id !== id);
        
        if (coleccionFiltrada.length < coleccion.length) {
            this.guardarColeccion(nombreColeccion, coleccionFiltrada);
            return true;
        }
        
        return false;
    },
    
    // Buscar elemento por ID en una colección
    buscarPorId: function(nombreColeccion, id) {
        const coleccion = this.obtenerColeccion(nombreColeccion);
        return coleccion.find(item => item.id === id) || null;
    },
    
    // Buscar elementos con filtro
    buscarConFiltro: function(nombreColeccion, filtro) {
        const coleccion = this.obtenerColeccion(nombreColeccion);
        
        return coleccion.filter(item => {
            for (const campo in filtro) {
                if (item[campo] !== filtro[campo]) {
                    return false;
                }
            }
            return true;
        });
    },
    
    // Buscar por texto en múltiples campos
    buscarPorTexto: function(nombreColeccion, texto, campos) {
        const coleccion = this.obtenerColeccion(nombreColeccion);
        const textoMinusculas = texto.toLowerCase();
        
        return coleccion.filter(item => {
            return campos.some(campo => {
                const valor = item[campo];
                if (valor && typeof valor === 'string') {
                    return valor.toLowerCase().includes(textoMinusculas);
                }
                return false;
            });
        });
    },
    
    // -------------------------------------------------
    // FUNCIONES PARA PRODUCTOS
    // -------------------------------------------------
    
    // Obtener todos los productos
    obtenerProductos: function() {
        return this.obtenerColeccion('productos');
    },
    
    // Guardar producto
    guardarProducto: function(producto) {
        if (producto.id) {
            return this.actualizarEnColeccion('productos', producto.id, producto);
        } else {
            return this.agregarAColeccion('productos', producto);
        }
    },
    
    // Eliminar producto
    eliminarProducto: function(id) {
        return this.eliminarDeColeccion('productos', id);
    },
    
    // Buscar producto por código
    buscarProductoPorCodigo: function(codigo) {
        const productos = this.obtenerProductos();
        return productos.find(p => p.codigo === codigo) || null;
    },
    
    // Actualizar stock de producto
    actualizarStock: function(idProducto, cantidad, esVenta = true) {
        const producto = this.buscarPorId('productos', idProducto);
        
        if (producto) {
            if (esVenta) {
                producto.stock = Math.max(0, (producto.stock || 0) - cantidad);
            } else {
                producto.stock = (producto.stock || 0) + cantidad;
            }
            
            return this.actualizarEnColeccion('productos', idProducto, { stock: producto.stock });
        }
        
        return false;
    },
    
    // Obtener categorías de productos
    obtenerCategorias: function() {
        const productos = this.obtenerProductos();
        const categorias = [...new Set(productos.map(p => p.categoria).filter(c => c))];
        return categorias.sort();
    },
    
    // -------------------------------------------------
    // FUNCIONES PARA FACTURAS
    // -------------------------------------------------
    
    // Obtener todas las facturas
    obtenerFacturas: function() {
        return this.obtenerColeccion('facturas');
    },
    
    // Guardar factura
    guardarFactura: function(factura) {
        // Generar número de factura si es nueva
        if (!factura.numero) {
            factura.numero = this.generarNumeroFactura();
        }
        
        if (factura.id) {
            return this.actualizarEnColeccion('facturas', factura.id, factura);
        } else {
            return this.agregarAColeccion('facturas', factura);
        }
    },
    
    // Generar número de factura consecutivo
    generarNumeroFactura: function() {
        const config = this.obtenerConfiguracion();
        const prefijo = config.prefijoFactura || 'FAC';
        let numeroActual = config.numeroFacturaActual || 0;
        
        numeroActual++;
        
        // Guardar el nuevo número
        this.guardarConfiguracion({ ...config, numeroFacturaActual: numeroActual });
        
        // Formatear número con ceros a la izquierda
        const numeroFormateado = String(numeroActual).padStart(6, '0');
        
        return `${prefijo}-${numeroFormateado}`;
    },
    
    // Obtener facturas por rango de fechas
    obtenerFacturasPorFecha: function(fechaDesde, fechaHasta) {
        const facturas = this.obtenerFacturas();
        
        return facturas.filter(f => {
            const fechaFactura = new Date(f.fecha);
            const desde = fechaDesde ? new Date(fechaDesde) : new Date('1900-01-01');
            const hasta = fechaHasta ? new Date(fechaHasta) : new Date('2100-12-31');
            
            return fechaFactura >= desde && fechaFactura <= hasta;
        });
    },
    
    // Obtener facturas por estado
    obtenerFacturasPorEstado: function(estado) {
        return this.buscarConFiltro('facturas', { estado: estado });
    },
    
    // -------------------------------------------------
    // FUNCIONES PARA GASTOS
    // -------------------------------------------------
    
    // Obtener todos los gastos
    obtenerGastos: function() {
        return this.obtenerColeccion('gastos');
    },
    
    // Guardar gasto
    guardarGasto: function(gasto) {
        if (gasto.id) {
            return this.actualizarEnColeccion('gastos', gasto.id, gasto);
        } else {
            return this.agregarAColeccion('gastos', gasto);
        }
    },
    
    // Eliminar gasto
    eliminarGasto: function(id) {
        return this.eliminarDeColeccion('gastos', id);
    },
    
    // Obtener gastos por mes y año
    obtenerGastosPorMes: function(mes, anio) {
        const gastos = this.obtenerGastos();
        
        return gastos.filter(g => {
            const fecha = new Date(g.fecha);
            return fecha.getMonth() + 1 === mes && fecha.getFullYear() === anio;
        });
    },
    
    // -------------------------------------------------
    // FUNCIONES PARA CLIENTES
    // -------------------------------------------------
    
    // Obtener todos los clientes
    obtenerClientes: function() {
        return this.obtenerColeccion('clientes');
    },
    
    // Guardar cliente
    guardarCliente: function(cliente) {
        if (cliente.id) {
            return this.actualizarEnColeccion('clientes', cliente.id, cliente);
        } else {
            return this.agregarAColeccion('clientes', cliente);
        }
    },
    
    // Buscar cliente por documento
    buscarClientePorDocumento: function(documento) {
        const clientes = this.obtenerClientes();
        return clientes.find(c => c.documento === documento) || null;
    },
    
    // -------------------------------------------------
    // FUNCIONES PARA CONFIGURACIÓN
    // -------------------------------------------------
    
    // Obtener configuración
    obtenerConfiguracion: function() {
        return this.obtener('configuracion') || {
            prefijoFactura: 'FAC',
            numeroFacturaActual: 0,
            iva: 19,
            mensajeFactura: 'Gracias por su compra',
            umbralStockBajo: 10
        };
    },
    
    // Guardar configuración
    guardarConfiguracion: function(config) {
        return this.guardar('configuracion', config);
    },
    
    // -------------------------------------------------
    // FUNCIONES PARA DATOS DE EMPRESA
    // -------------------------------------------------
    
    // Obtener datos de empresa
    obtenerEmpresa: function() {
        return this.obtener('empresa') || {};
    },
    
    // Guardar datos de empresa
    guardarEmpresa: function(empresa) {
        return this.guardar('empresa', empresa);
    },
    
    // -------------------------------------------------
    // FUNCIONES PARA USUARIO
    // -------------------------------------------------
    
    // Guardar datos de sesión del usuario
    guardarSesion: function(usuario) {
        return this.guardar('sesion', usuario);
    },
    
    // Obtener datos de sesión
    obtenerSesion: function() {
        return this.obtener('sesion');
    },
    
    // Limpiar sesión
    limpiarSesion: function() {
        return this.eliminar('sesion');
    },
    
    // -------------------------------------------------
    // FUNCIONES DE SINCRONIZACIÓN
    // -------------------------------------------------
    
    // Marcar elemento para sincronizar
    marcarParaSincronizar: function(nombreColeccion, id) {
        const pendientes = this.obtener('pendientes_sync') || [];
        
        const existe = pendientes.find(p => 
            p.coleccion === nombreColeccion && p.id === id
        );
        
        if (!existe) {
            pendientes.push({
                coleccion: nombreColeccion,
                id: id,
                fecha: new Date().toISOString()
            });
            this.guardar('pendientes_sync', pendientes);
        }
    },
    
    // Obtener elementos pendientes de sincronizar
    obtenerPendientesSincronizar: function() {
        return this.obtener('pendientes_sync') || [];
    },
    
    // Limpiar elemento sincronizado
    limpiarSincronizado: function(nombreColeccion, id) {
        const pendientes = this.obtener('pendientes_sync') || [];
        const filtrados = pendientes.filter(p => 
            !(p.coleccion === nombreColeccion && p.id === id)
        );
        this.guardar('pendientes_sync', filtrados);
    },
    
    // Limpiar todos los pendientes
    limpiarTodosPendientes: function() {
        this.eliminar('pendientes_sync');
    },
    
    // -------------------------------------------------
    // FUNCIONES DE UTILIDAD
    // -------------------------------------------------
    
    // Generar ID único
    generarId: function() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    // Calcular espacio usado en localStorage
    calcularEspacioUsado: function() {
        let total = 0;
        
        for (const clave in localStorage) {
            if (clave.startsWith(PREFIJO_DB)) {
                total += localStorage[clave].length * 2; // UTF-16 usa 2 bytes por carácter
            }
        }
        
        // Estimación de espacio total disponible (5MB es el límite típico)
        const limiteBytes = 5 * 1024 * 1024;
        const porcentajeUsado = ((total / limiteBytes) * 100).toFixed(1);
        
        return {
            bytes: total,
            kb: (total / 1024).toFixed(2),
            mb: (total / (1024 * 1024)).toFixed(2),
            porcentajeUsado: porcentajeUsado,
            disponible: (limiteBytes - total) > 0
        };
    },
    
    // Verificar si hay espacio disponible
    verificarEspacioDisponible: function() {
        const espacio = this.calcularEspacioUsado();
        if (parseFloat(espacio.porcentajeUsado) > 80) {
            console.warn('⚠️ localStorage casi lleno:', espacio.porcentajeUsado + '%');
        }
        return espacio.disponible;
    },
    
    // Mostrar error de espacio
    mostrarErrorEspacio: function() {
        App.mostrarNotificacion(
            'Sin espacio',
            'El almacenamiento local está lleno. Por favor, sincroniza con la nube.',
            'warning'
        );
    },
    
    // Exportar todos los datos
    exportarTodo: function() {
        const datos = {
            productos: this.obtenerProductos(),
            facturas: this.obtenerFacturas(),
            gastos: this.obtenerGastos(),
            clientes: this.obtenerClientes(),
            empresa: this.obtenerEmpresa(),
            configuracion: this.obtenerConfiguracion(),
            fechaExportacion: new Date().toISOString(),
            version: '1.0.0'
        };
        
        return datos;
    },
    
    // Importar datos
    importarTodo: function(datos) {
        try {
            if (datos.productos) this.guardarColeccion('productos', datos.productos);
            if (datos.facturas) this.guardarColeccion('facturas', datos.facturas);
            if (datos.gastos) this.guardarColeccion('gastos', datos.gastos);
            if (datos.clientes) this.guardarColeccion('clientes', datos.clientes);
            if (datos.empresa) this.guardarEmpresa(datos.empresa);
            if (datos.configuracion) this.guardarConfiguracion(datos.configuracion);
            
            return true;
        } catch (error) {
            console.error('Error al importar datos:', error);
            return false;
        }
    },
    
    // Limpiar todos los datos de la aplicación
    limpiarTodo: function() {
        const clavesAEliminar = [];
        
        for (const clave in localStorage) {
            if (clave.startsWith(PREFIJO_DB)) {
                clavesAEliminar.push(clave);
            }
        }
        
        clavesAEliminar.forEach(clave => localStorage.removeItem(clave));
        
        return true;
    }
};

// Hacer disponible globalmente
window.DBLocal = DBLocal;