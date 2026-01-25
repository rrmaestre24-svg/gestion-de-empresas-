// =====================================================
// CONFIGURACIÓN DE FIREBASE
// Inicialización y configuración de los servicios de Firebase
// =====================================================

// Configuración de Firebase - REEMPLAZAR CON TUS CREDENCIALES
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

function obtenerAuth() {
    if (!firebaseInicializado) inicializarFirebase();
    return firebase.auth();
}

function obtenerDB() {
    if (!firebaseInicializado) inicializarFirebase();
    return firebase.firestore();
}

function obtenerStorage() {
    if (!firebaseInicializado) inicializarFirebase();
    return firebase.storage();
}

// =====================================================
// CONFIGURACIÓN DE PERSISTENCIA OFFLINE - CORREGIDA
// =====================================================
async function configurarPersistencia() {
    try {
        const db = obtenerDB();
        
        // Para Firebase Compat: usar enablePersistence (el método correcto)
        await db.enablePersistence({
            synchronizeTabs: true
        });
        
        console.log('Persistencia offline habilitada');
        return true;
    } catch (error) {
        if (error.code === 'failed-precondition') {
            console.warn('Persistencia offline no disponible: múltiples pestañas abiertas');
        } else if (error.code === 'unimplemented') {
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

function obtenerColeccion(nombreColeccion, uid) {
    const db = obtenerDB();
    return db.collection('usuarios').doc(uid).collection(nombreColeccion);
}

async function guardarDocumento(coleccion, uid, datos, idDocumento = null) {
    try {
        const ref = obtenerColeccion(coleccion, uid);
        
        const datosConFecha = {
            ...datos,
            actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (idDocumento) {
            await ref.doc(idDocumento).set(datosConFecha, { merge: true });
            return idDocumento;
        } else {
            datosConFecha.creadoEn = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await ref.add(datosConFecha);
            return docRef.id;
        }
    } catch (error) {
        console.error('Error al guardar documento:', error);
        throw error;
    }
}

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
// FUNCIONES DE STORAGE
// =====================================================

async function subirImagen(archivo, ruta) {
    try {
        const storage = obtenerStorage();
        const ref = storage.ref(ruta);
        const snapshot = await ref.put(archivo);
        const urlDescarga = await snapshot.ref.getDownloadURL();
        return urlDescarga;
    } catch (error) {
        console.error('Error al subir imagen:', error);
        throw error;
    }
}

async function eliminarImagen(ruta) {
    try {
        const storage = obtenerStorage();
        const ref = storage.ref(ruta);
        await ref.delete();
        return true;
    } catch (error) {
        console.error('Error al eliminar imagen:', error);
        if (error.code === 'storage/object-not-found') {
            return true;
        }
        throw error;
    }
}

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

function escucharColeccion(coleccion, uid, callback) {
    const ref = obtenerColeccion(coleccion, uid);
    
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

function verificarConexion() {
    return navigator.onLine;
}

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

async function importarDatosUsuario(uid, datos) {
    try {
        if (!datos.version) {
            throw new Error('Formato de backup no válido');
        }
        
        if (datos.empresa) {
            await guardarDatosEmpresa(uid, datos.empresa);
        }
        
        if (datos.productos && Array.isArray(datos.productos)) {
            for (const producto of datos.productos) {
                const { id, ...datosProducto } = producto;
                await guardarDocumento('productos', uid, datosProducto, id);
            }
        }
        
        if (datos.facturas && Array.isArray(datos.facturas)) {
            for (const factura of datos.facturas) {
                const { id, ...datosFactura } = factura;
                await guardarDocumento('facturas', uid, datosFactura, id);
            }
        }
        
        if (datos.gastos && Array.isArray(datos.gastos)) {
            for (const gasto of datos.gastos) {
                const { id, ...datosGasto } = gasto;
                await guardarDocumento('gastos', uid, datosGasto, id);
            }
        }
        
        if (datos.clientes && Array.isArray(datos.clientes)) {
            for (const cliente of datos.clientes) {
                const { id, ...datosCliente } = cliente;
                await guardarDocumento('clientes', uid, datosCliente, id);
            }
        }
        
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
        if (typeof firebase === 'undefined') {
            console.error('Firebase no está cargado. Verifica los scripts en index.html');
            return false;
        }
        
        const resultado = inicializarFirebase();
        
        if (resultado) {
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