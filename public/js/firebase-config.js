// =====================================================
// CONFIGURACIÓN DE FIREBASE
// Inicialización y configuración de los servicios de Firebase
// =====================================================

// Configuración de Firebase - REEMPLAZAR CON TUS CREDENCIALES
// Obtener estas credenciales desde la consola de Firebase:
// https://console.firebase.google.com/
const firebaseConfig = {
    apiKey: "AIzaSyD-H8RzoDeAvJ7FPYSeJqjKmqneSuLvaH4",
    authDomain: "facturapro-colombia.firebaseapp.com",
    projectId: "facturapro-colombia",
    storageBucket: "facturapro-colombia.firebasestorage.app",
    messagingSenderId: "479316908038",
    appId: "1:479316908038:web:181b8c2e28207b2d584b87"
};

// Variable para verificar si Firebase está inicializado
let firebaseInicializado = false;

// =====================================================
// INICIALIZAR FIREBASE
// =====================================================
function inicializarFirebase() {
    try {
        // Verificar si ya está inicializado
        if (!firebaseInicializado) {
            firebase.initializeApp(firebaseConfig);
            firebaseInicializado = true;
            console.log('Firebase inicializado correctamente');
        }
        return true;
    } catch (error) {
        console.error('Error al inicializar Firebase:', error);
        return false;
    }
}

// =====================================================
// OBTENER INSTANCIAS DE SERVICIOS
// =====================================================

// Obtener instancia de autenticación
function obtenerAuth() {
    if (!firebaseInicializado) inicializarFirebase();
    return firebase.auth();
}

// Obtener instancia de Firestore (base de datos)
function obtenerDB() {
    if (!firebaseInicializado) inicializarFirebase();
    return firebase.firestore();
}

// Obtener instancia de Storage (almacenamiento de archivos)
function obtenerStorage() {
    if (!firebaseInicializado) inicializarFirebase();
    return firebase.storage();
}

// =====================================================
// CONFIGURACIÓN DE PERSISTENCIA OFFLINE
// Permite que Firestore funcione sin conexión
// =====================================================
async function configurarPersistencia() {
    try {
        const db = obtenerDB();
        
        // Habilitar persistencia offline
        await db.enablePersistence({
            synchronizeTabs: true // Sincronizar entre pestañas del navegador
        });
        
        console.log('Persistencia offline habilitada');
        return true;
    } catch (error) {
        if (error.code === 'failed-precondition') {
            // Múltiples pestañas abiertas, la persistencia solo puede habilitarse en una
            console.warn('Persistencia offline no disponible: múltiples pestañas abiertas');
        } else if (error.code === 'unimplemented') {
            // El navegador no soporta persistencia
            console.warn('Persistencia offline no soportada en este navegador');
        } else {
            console.error('Error al configurar persistencia:', error);
        }
        return false;
    }
}

// =====================================================
// FUNCIONES DE BASE DE DATOS FIRESTORE
// =====================================================

// Referencia a colecciones según el usuario
function obtenerColeccion(nombreColeccion, uid) {
    const db = obtenerDB();
    return db.collection('usuarios').doc(uid).collection(nombreColeccion);
}

// Guardar documento en una colección
async function guardarDocumento(coleccion, uid, datos, idDocumento = null) {
    try {
        const ref = obtenerColeccion(coleccion, uid);
        
        // Agregar timestamp de creación/actualización
        const datosConFecha = {
            ...datos,
            actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (idDocumento) {
            // Actualizar documento existente
            await ref.doc(idDocumento).set(datosConFecha, { merge: true });
            return idDocumento;
        } else {
            // Crear nuevo documento con ID automático
            datosConFecha.creadoEn = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await ref.add(datosConFecha);
            return docRef.id;
        }
    } catch (error) {
        console.error('Error al guardar documento:', error);
        throw error;
    }
}

// Obtener un documento específico
async function obtenerDocumento(coleccion, uid, idDocumento) {
    try {
        const ref = obtenerColeccion(coleccion, uid);
        const doc = await ref.doc(idDocumento).get();
        
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error al obtener documento:', error);
        throw error;
    }
}

// Obtener todos los documentos de una colección
async function obtenerTodosDocumentos(coleccion, uid, ordenarPor = 'creadoEn', direccion = 'desc') {
    try {
        const ref = obtenerColeccion(coleccion, uid);
        const snapshot = await ref.orderBy(ordenarPor, direccion).get();
        
        const documentos = [];
        snapshot.forEach(doc => {
            documentos.push({ id: doc.id, ...doc.data() });
        });
        
        return documentos;
    } catch (error) {
        console.error('Error al obtener documentos:', error);
        throw error;
    }
}

// Obtener documentos con filtro
async function obtenerDocumentosFiltrados(coleccion, uid, campo, operador, valor) {
    try {
        const ref = obtenerColeccion(coleccion, uid);
        const snapshot = await ref.where(campo, operador, valor).get();
        
        const documentos = [];
        snapshot.forEach(doc => {
            documentos.push({ id: doc.id, ...doc.data() });
        });
        
        return documentos;
    } catch (error) {
        console.error('Error al obtener documentos filtrados:', error);
        throw error;
    }
}

// Eliminar un documento
async function eliminarDocumento(coleccion, uid, idDocumento) {
    try {
        const ref = obtenerColeccion(coleccion, uid);
        await ref.doc(idDocumento).delete();
        return true;
    } catch (error) {
        console.error('Error al eliminar documento:', error);
        throw error;
    }
}

// =====================================================
// FUNCIONES DE STORAGE (ALMACENAMIENTO DE ARCHIVOS)
// =====================================================

// Subir imagen a Firebase Storage
async function subirImagen(archivo, ruta) {
    try {
        const storage = obtenerStorage();
        const ref = storage.ref(ruta);
        
        // Subir el archivo
        const snapshot = await ref.put(archivo);
        
        // Obtener la URL de descarga
        const urlDescarga = await snapshot.ref.getDownloadURL();
        
        return urlDescarga;
    } catch (error) {
        console.error('Error al subir imagen:', error);
        throw error;
    }
}

// Eliminar imagen de Firebase Storage
async function eliminarImagen(ruta) {
    try {
        const storage = obtenerStorage();
        const ref = storage.ref(ruta);
        await ref.delete();
        return true;
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        // No lanzar error si la imagen no existe
        if (error.code === 'storage/object-not-found') {
            return true;
        }
        throw error;
    }
}

// Convertir archivo a Base64 (para almacenamiento local)
function archivoABase64(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(archivo);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// =====================================================
// FUNCIONES DE DATOS DE EMPRESA
// =====================================================

// Guardar datos de la empresa del usuario
async function guardarDatosEmpresa(uid, datosEmpresa) {
    try {
        const db = obtenerDB();
        await db.collection('usuarios').doc(uid).set({
            empresa: datosEmpresa,
            actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        return true;
    } catch (error) {
        console.error('Error al guardar datos de empresa:', error);
        throw error;
    }
}

// Obtener datos de la empresa del usuario
async function obtenerDatosEmpresa(uid) {
    try {
        const db = obtenerDB();
        const doc = await db.collection('usuarios').doc(uid).get();
        
        if (doc.exists && doc.data().empresa) {
            return doc.data().empresa;
        }
        return null;
    } catch (error) {
        console.error('Error al obtener datos de empresa:', error);
        throw error;
    }
}

// =====================================================
// ESCUCHAR CAMBIOS EN TIEMPO REAL
// =====================================================

// Escuchar cambios en una colección (tiempo real)
function escucharColeccion(coleccion, uid, callback) {
    const ref = obtenerColeccion(coleccion, uid);
    
    // Retorna función para cancelar la suscripción
    return ref.orderBy('creadoEn', 'desc').onSnapshot(
        (snapshot) => {
            const documentos = [];
            snapshot.forEach(doc => {
                documentos.push({ id: doc.id, ...doc.data() });
            });
            callback(documentos, null);
        },
        (error) => {
            console.error('Error al escuchar colección:', error);
            callback(null, error);
        }
    );
}

// =====================================================
// SINCRONIZACIÓN DE DATOS
// =====================================================

// Verificar estado de conexión
function verificarConexion() {
    return navigator.onLine;
}

// Exportar todos los datos del usuario (backup)
async function exportarDatosUsuario(uid) {
    try {
        const datos = {
            empresa: await obtenerDatosEmpresa(uid),
            productos: await obtenerTodosDocumentos('productos', uid),
            facturas: await obtenerTodosDocumentos('facturas', uid),
            gastos: await obtenerTodosDocumentos('gastos', uid),
            clientes: await obtenerTodosDocumentos('clientes', uid),
            configuracion: await obtenerDocumento('configuracion', uid, 'general'),
            fechaExportacion: new Date().toISOString(),
            version: '1.0.0'
        };
        
        return datos;
    } catch (error) {
        console.error('Error al exportar datos:', error);
        throw error;
    }
}

// Importar datos del usuario (restaurar backup)
async function importarDatosUsuario(uid, datos) {
    try {
        // Validar estructura de datos
        if (!datos.version) {
            throw new Error('Formato de backup no válido');
        }
        
        // Importar empresa
        if (datos.empresa) {
            await guardarDatosEmpresa(uid, datos.empresa);
        }
        
        // Importar productos
        if (datos.productos && Array.isArray(datos.productos)) {
            for (const producto of datos.productos) {
                const { id, ...datosProducto } = producto;
                await guardarDocumento('productos', uid, datosProducto, id);
            }
        }
        
        // Importar facturas
        if (datos.facturas && Array.isArray(datos.facturas)) {
            for (const factura of datos.facturas) {
                const { id, ...datosFactura } = factura;
                await guardarDocumento('facturas', uid, datosFactura, id);
            }
        }
        
        // Importar gastos
        if (datos.gastos && Array.isArray(datos.gastos)) {
            for (const gasto of datos.gastos) {
                const { id, ...datosGasto } = gasto;
                await guardarDocumento('gastos', uid, datosGasto, id);
            }
        }
        
        // Importar clientes
        if (datos.clientes && Array.isArray(datos.clientes)) {
            for (const cliente of datos.clientes) {
                const { id, ...datosCliente } = cliente;
                await guardarDocumento('clientes', uid, datosCliente, id);
            }
        }
        
        // Importar configuración
        if (datos.configuracion) {
            await guardarDocumento('configuracion', uid, datos.configuracion, 'general');
        }
        
        return true;
    } catch (error) {
        console.error('Error al importar datos:', error);
        throw error;
    }
}


// Función para inicializar Firebase de forma segura
async function inicializarFirebaseSafe() {
    try {
        // Verificar que Firebase esté cargado
        if (typeof firebase === 'undefined') {
            console.error('Firebase no está cargado. Verifica los scripts en index.html');
            return false;
        }
        
        // Inicializar Firebase
        const resultado = inicializarFirebase();
        
        if (resultado) {
            // Configurar persistencia
            await configurarPersistencia();
            console.log('✅ Firebase listo y configurado');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Error al inicializar Firebase:', error);
        return false;
    }
}