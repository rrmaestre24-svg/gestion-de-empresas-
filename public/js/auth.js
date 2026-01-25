// =====================================================
// AUTENTICACIÓN - FIREBASE AUTH
// Manejo de login, registro y sesión de usuarios
// =====================================================

const Auth = {
    
    // Usuario actual
    usuarioActual: null,
    
    // Callback cuando cambia el estado de autenticación
    onAuthStateChanged: null,
    
    // -------------------------------------------------
    // INICIALIZAR OBSERVADOR DE AUTENTICACIÓN
    // -------------------------------------------------
    inicializar: function(callback) {
        this.onAuthStateChanged = callback;
        
        const auth = obtenerAuth();
        
        // Observar cambios en el estado de autenticación
        auth.onAuthStateChanged((usuario) => {
            if (usuario) {
                // Usuario ha iniciado sesión
                this.usuarioActual = {
                    uid: usuario.uid,
                    email: usuario.email,
                    nombre: usuario.displayName,
                    foto: usuario.photoURL,
                    emailVerificado: usuario.emailVerified
                };
                
                // Guardar en localStorage para acceso offline
                DBLocal.guardarSesion(this.usuarioActual);
                
                console.log('Usuario autenticado:', usuario.email);
            } else {
                // Usuario ha cerrado sesión
                this.usuarioActual = null;
                DBLocal.limpiarSesion();
                
                console.log('Usuario no autenticado');
            }
            
            // Ejecutar callback
            if (this.onAuthStateChanged) {
                this.onAuthStateChanged(this.usuarioActual);
            }
        });
    },
    
    // -------------------------------------------------
    // REGISTRO DE NUEVO USUARIO
    // -------------------------------------------------
    registrar: async function(email, password, datosEmpresa) {
        try {
            const auth = obtenerAuth();
            
            // Crear usuario en Firebase Auth
            const credencial = await auth.createUserWithEmailAndPassword(email, password);
            const usuario = credencial.user;
            
            // Actualizar perfil con nombre de empresa
            await usuario.updateProfile({
                displayName: datosEmpresa.nombre
            });
            
            // Guardar datos de empresa en Firestore
            await guardarDatosEmpresa(usuario.uid, {
                nombre: datosEmpresa.nombre,
                nit: datosEmpresa.nit || '',
                ciudad: datosEmpresa.ciudad || '',
                direccion: datosEmpresa.direccion || '',
                telefono: datosEmpresa.telefono || '',
                email: email,
                creadoEn: new Date().toISOString()
            });
            
            // Guardar también en localStorage
            DBLocal.guardarEmpresa({
                nombre: datosEmpresa.nombre,
                nit: datosEmpresa.nit || '',
                ciudad: datosEmpresa.ciudad || '',
                direccion: datosEmpresa.direccion || '',
                telefono: datosEmpresa.telefono || '',
                email: email
            });
            
            // Configuración inicial de facturación
            const configInicial = {
                prefijoFactura: 'FAC',
                numeroFacturaActual: 0,
                iva: 19,
                mensajeFactura: 'Gracias por su compra. Es un placer atenderle.'
            };
            
            await guardarDocumento('configuracion', usuario.uid, configInicial, 'general');
            DBLocal.guardarConfiguracion(configInicial);
            
            return {
                exito: true,
                usuario: {
                    uid: usuario.uid,
                    email: usuario.email,
                    nombre: datosEmpresa.nombre
                }
            };
            
        } catch (error) {
            console.error('Error en registro:', error);
            
            let mensaje = 'Error al crear la cuenta';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    mensaje = 'Este correo electrónico ya está registrado';
                    break;
                case 'auth/invalid-email':
                    mensaje = 'El correo electrónico no es válido';
                    break;
                case 'auth/weak-password':
                    mensaje = 'La contraseña debe tener al menos 6 caracteres';
                    break;
                case 'auth/network-request-failed':
                    mensaje = 'Error de conexión. Verifica tu internet';
                    break;
            }
            
            return {
                exito: false,
                error: mensaje
            };
        }
    },
    
    // -------------------------------------------------
    // INICIAR SESIÓN
    // -------------------------------------------------
    iniciarSesion: async function(email, password) {
        try {
            const auth = obtenerAuth();
            
            const credencial = await auth.signInWithEmailAndPassword(email, password);
            const usuario = credencial.user;
            
            // Cargar datos de empresa desde Firestore
            const datosEmpresa = await obtenerDatosEmpresa(usuario.uid);
            if (datosEmpresa) {
                DBLocal.guardarEmpresa(datosEmpresa);
            }
            
            // Cargar configuración desde Firestore
            const config = await obtenerDocumento('configuracion', usuario.uid, 'general');
            if (config) {
                DBLocal.guardarConfiguracion(config);
            }
            
            return {
                exito: true,
                usuario: {
                    uid: usuario.uid,
                    email: usuario.email,
                    nombre: usuario.displayName
                }
            };
            
        } catch (error) {
            console.error('Error en inicio de sesión:', error);
            
            let mensaje = 'Error al iniciar sesión';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    mensaje = 'No existe una cuenta con este correo';
                    break;
                case 'auth/wrong-password':
                    mensaje = 'Contraseña incorrecta';
                    break;
                case 'auth/invalid-email':
                    mensaje = 'El correo electrónico no es válido';
                    break;
                case 'auth/user-disabled':
                    mensaje = 'Esta cuenta ha sido deshabilitada';
                    break;
                case 'auth/too-many-requests':
                    mensaje = 'Demasiados intentos fallidos. Intenta más tarde';
                    break;
                case 'auth/network-request-failed':
                    mensaje = 'Error de conexión. Verifica tu internet';
                    break;
            }
            
            return {
                exito: false,
                error: mensaje
            };
        }
    },
    
    // -------------------------------------------------
    // CERRAR SESIÓN
    // -------------------------------------------------
    cerrarSesion: async function() {
        try {
            const auth = obtenerAuth();
            await auth.signOut();
            
            // Limpiar datos locales de sesión
            DBLocal.limpiarSesion();
            
            return { exito: true };
            
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            return {
                exito: false,
                error: 'Error al cerrar sesión'
            };
        }
    },
    
    // -------------------------------------------------
    // RECUPERAR CONTRASEÑA
    // -------------------------------------------------
    recuperarPassword: async function(email) {
        try {
            const auth = obtenerAuth();
            await auth.sendPasswordResetEmail(email);
            
            return {
                exito: true,
                mensaje: 'Se ha enviado un correo para restablecer tu contraseña'
            };
            
        } catch (error) {
            console.error('Error al recuperar contraseña:', error);
            
            let mensaje = 'Error al enviar correo de recuperación';
            
            if (error.code === 'auth/user-not-found') {
                mensaje = 'No existe una cuenta con este correo';
            }
            
            return {
                exito: false,
                error: mensaje
            };
        }
    },
    
    // -------------------------------------------------
    // VERIFICAR SI HAY SESIÓN ACTIVA
    // -------------------------------------------------
    verificarSesion: function() {
        // Primero verificar en Firebase
        const auth = obtenerAuth();
        const usuario = auth.currentUser;
        
        if (usuario) {
            return {
                uid: usuario.uid,
                email: usuario.email,
                nombre: usuario.displayName
            };
        }
        
        // Si no hay conexión, verificar localStorage
        return DBLocal.obtenerSesion();
    },
    
    // -------------------------------------------------
    // OBTENER UID DEL USUARIO ACTUAL
    // -------------------------------------------------
    obtenerUID: function() {
        if (this.usuarioActual) {
            return this.usuarioActual.uid;
        }
        
        const sesion = DBLocal.obtenerSesion();
        return sesion ? sesion.uid : null;
    },
    
    // -------------------------------------------------
    // ACTUALIZAR PERFIL DE USUARIO
    // -------------------------------------------------
    actualizarPerfil: async function(datos) {
        try {
            const auth = obtenerAuth();
            const usuario = auth.currentUser;
            
            if (!usuario) {
                throw new Error('No hay usuario autenticado');
            }
            
            // Actualizar displayName si se proporciona
            if (datos.nombre) {
                await usuario.updateProfile({
                    displayName: datos.nombre
                });
            }
            
            // Actualizar email si se proporciona
            if (datos.email && datos.email !== usuario.email) {
                await usuario.updateEmail(datos.email);
            }
            
            return { exito: true };
            
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            return {
                exito: false,
                error: 'Error al actualizar el perfil'
            };
        }
    },
    
    // -------------------------------------------------
    // CAMBIAR CONTRASEÑA
    // -------------------------------------------------
    cambiarPassword: async function(passwordActual, passwordNuevo) {
        try {
            const auth = obtenerAuth();
            const usuario = auth.currentUser;
            
            if (!usuario) {
                throw new Error('No hay usuario autenticado');
            }
            
            // Re-autenticar usuario
            const credencial = firebase.auth.EmailAuthProvider.credential(
                usuario.email,
                passwordActual
            );
            
            await usuario.reauthenticateWithCredential(credencial);
            
            // Cambiar contraseña
            await usuario.updatePassword(passwordNuevo);
            
            return { exito: true };
            
        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            
            let mensaje = 'Error al cambiar la contraseña';
            
            if (error.code === 'auth/wrong-password') {
                mensaje = 'La contraseña actual es incorrecta';
            }
            
            return {
                exito: false,
                error: mensaje
            };
        }
    }
};

// Hacer disponible globalmente
window.Auth = Auth;