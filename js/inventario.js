// =====================================================
// MÓDULO DE INVENTARIO
// Gestión de productos con fotos
// =====================================================

const Inventario = {
    
    // Lista de productos en memoria
    productos: [],
    
    // Producto en edición
    productoActual: null,
    
    // -------------------------------------------------
    // INICIALIZAR MÓDULO
    // -------------------------------------------------
    inicializar: async function() {
        await this.cargarProductos();
        this.configurarEventos();
        this.renderizarProductos();
        this.cargarCategorias();
    },
    
    // -------------------------------------------------
    // CARGAR PRODUCTOS
    // -------------------------------------------------
    cargarProductos: async function() {
        const uid = Auth.obtenerUID();
        
        if (navigator.onLine && uid) {
            try {
                // Cargar desde Firebase
                this.productos = await obtenerTodosDocumentos('productos', uid);
                
                // Guardar en localStorage para offline
                DBLocal.guardarColeccion('productos', this.productos);
                
            } catch (error) {
                console.error('Error al cargar productos de Firebase:', error);
                // Cargar desde localStorage si falla
                this.productos = DBLocal.obtenerProductos();
            }
        } else {
            // Cargar desde localStorage
            this.productos = DBLocal.obtenerProductos();
        }
        
        return this.productos;
    },
    
    // -------------------------------------------------
    // CONFIGURAR EVENTOS
    // -------------------------------------------------
    configurarEventos: function() {
        // Botón guardar producto
        const btnGuardar = document.getElementById('btn-guardar-producto');
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => this.guardarProducto());
        }
        
        // Preview de imagen
        const inputImagen = document.getElementById('producto-imagen');
        if (inputImagen) {
            inputImagen.addEventListener('change', (e) => this.previsualizarImagen(e));
        }
        
        // Buscador
        const buscador = document.getElementById('buscar-producto');
        if (buscador) {
            buscador.addEventListener('input', (e) => this.buscarProductos(e.target.value));
        }
        
        // Filtro por categoría
        const filtroCategoria = document.getElementById('filtro-categoria');
        if (filtroCategoria) {
            filtroCategoria.addEventListener('change', (e) => this.filtrarPorCategoria(e.target.value));
        }
        
        // Limpiar formulario al abrir modal
        const modalProducto = document.getElementById('modal-producto');
        if (modalProducto) {
            modalProducto.addEventListener('show.bs.modal', (e) => {
                // Si es nuevo producto, limpiar formulario
                if (!e.relatedTarget || !e.relatedTarget.dataset.productoId) {
                    this.limpiarFormulario();
                }
            });
        }
    },
    
    // -------------------------------------------------
    // RENDERIZAR TABLA DE PRODUCTOS
    // -------------------------------------------------
    renderizarProductos: function(productosAMostrar = null) {
        const productos = productosAMostrar || this.productos;
        const tbody = document.getElementById('tabla-productos');
        
        if (!tbody) return;
        
        if (productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-inbox display-4 d-block mb-2"></i>
                        No hay productos registrados
                    </td>
                </tr>
            `;
            return;
        }
        
tbody.innerHTML = productos.map(producto => `
    <tr>
        <td>
            ${producto.imagen 
                ? `<img src="${producto.imagen}" class="producto-imagen" alt="${producto.nombre}">`
                : `<div class="producto-imagen-placeholder"><i class="bi bi-image"></i></div>`
            }
        </td>
        <td><code>${producto.codigo || '-'}</code></td>
        <td>
            <strong>${producto.nombre}</strong>
            ${producto.categoria ? `<br><small class="text-muted">${producto.categoria}</small>` : ''}
        </td>
        <td>$${this.formatearNumero(producto.precioVenta)}</td>
        <td>
            <span class="badge ${producto.stock > 10 ? 'bg-success' : producto.stock > 0 ? 'bg-warning' : 'bg-danger'}">
                ${producto.stock || 0}
            </span>
        </td>
        <td class="acciones-fila">
            <button class="btn btn-outline-primary" 
                    onclick="Inventario.editarProducto('${producto.id}')"
                    title="Editar producto">
                <i class="bi bi-pencil-fill"></i>
            </button>
            <button class="btn btn-outline-danger" 
                    onclick="Inventario.confirmarEliminar('${producto.id}')"
                    title="Eliminar producto">
                <i class="bi bi-trash-fill"></i>
            </button>
        </td>
    </tr>
`).join('');

    },
    
    // -------------------------------------------------
    // GUARDAR PRODUCTO
    // -------------------------------------------------
    guardarProducto: async function() {
        // Obtener datos del formulario
        const id = document.getElementById('producto-id').value;
        const codigo = document.getElementById('producto-codigo').value.trim();
        const nombre = document.getElementById('producto-nombre').value.trim();
        const descripcion = document.getElementById('producto-descripcion').value.trim();
        const categoria = document.getElementById('producto-categoria').value.trim();
        const precioCompra = parseFloat(document.getElementById('producto-precio-compra').value) || 0;
        const precioVenta = parseFloat(document.getElementById('producto-precio-venta').value) || 0;
        const stock = parseInt(document.getElementById('producto-stock').value) || 0;
        
        // Validaciones
        if (!nombre) {
            App.mostrarNotificacion('Error', 'El nombre del producto es obligatorio', 'danger');
            return;
        }
        
        if (precioVenta <= 0) {
            App.mostrarNotificacion('Error', 'El precio de venta debe ser mayor a 0', 'danger');
            return;
        }
        
        // Verificar código duplicado
        if (codigo) {
            const productoExistente = this.productos.find(p => 
                p.codigo === codigo && p.id !== id
            );
            if (productoExistente) {
                App.mostrarNotificacion('Error', 'Ya existe un producto con este código', 'danger');
                return;
            }
        }
        
        // Preparar datos del producto
        const producto = {
            codigo: codigo,
            nombre: nombre,
            descripcion: descripcion,
            categoria: categoria,
            precioCompra: precioCompra,
            precioVenta: precioVenta,
            stock: stock
        };
        
        // Procesar imagen si se seleccionó una nueva
        const inputImagen = document.getElementById('producto-imagen');
        if (inputImagen.files && inputImagen.files[0]) {
            try {
                // Convertir a Base64 para almacenamiento local
                producto.imagen = await archivoABase64(inputImagen.files[0]);
            } catch (error) {
                console.error('Error al procesar imagen:', error);
            }
        } else if (id) {
            // Mantener imagen existente si estamos editando
            const productoExistente = this.productos.find(p => p.id === id);
            if (productoExistente && productoExistente.imagen) {
                producto.imagen = productoExistente.imagen;
            }
        }
        
        try {
            const uid = Auth.obtenerUID();
            
            if (id) {
                // Actualizar producto existente
                producto.id = id;
                
                if (navigator.onLine && uid) {
                    await guardarDocumento('productos', uid, producto, id);
                }
                
                DBLocal.actualizarEnColeccion('productos', id, producto);
                
                // Actualizar en memoria
                const indice = this.productos.findIndex(p => p.id === id);
                if (indice !== -1) {
                    this.productos[indice] = { ...this.productos[indice], ...producto };
                }
                
                App.mostrarNotificacion('Éxito', 'Producto actualizado correctamente', 'success');
                
            } else {
                // Crear nuevo producto
                let nuevoId;
                
                if (navigator.onLine && uid) {
                    nuevoId = await guardarDocumento('productos', uid, producto);
                } else {
                    nuevoId = DBLocal.agregarAColeccion('productos', producto);
                    DBLocal.marcarParaSincronizar('productos', nuevoId);
                }
                
                producto.id = nuevoId;
                this.productos.unshift(producto);
                
                App.mostrarNotificacion('Éxito', 'Producto creado correctamente', 'success');
            }
            
            // Cerrar modal y actualizar vista
            const modal = bootstrap.Modal.getInstance(document.getElementById('modal-producto'));
            modal.hide();
            
            this.renderizarProductos();
            this.cargarCategorias();
            App.actualizarDashboard();
            
        } catch (error) {
            console.error('Error al guardar producto:', error);
            App.mostrarNotificacion('Error', 'No se pudo guardar el producto', 'danger');
        }
    },
    
    // -------------------------------------------------
    // EDITAR PRODUCTO
    // -------------------------------------------------
    editarProducto: function(id) {
        const producto = this.productos.find(p => p.id === id);
        
        if (!producto) {
            App.mostrarNotificacion('Error', 'Producto no encontrado', 'danger');
            return;
        }
        
        // Llenar formulario
        document.getElementById('producto-id').value = producto.id;
        document.getElementById('producto-codigo').value = producto.codigo || '';
        document.getElementById('producto-nombre').value = producto.nombre || '';
        document.getElementById('producto-descripcion').value = producto.descripcion || '';
        document.getElementById('producto-categoria').value = producto.categoria || '';
        document.getElementById('producto-precio-compra').value = producto.precioCompra || '';
        document.getElementById('producto-precio-venta').value = producto.precioVenta || '';
        document.getElementById('producto-stock').value = producto.stock || 0;
        
        // Mostrar imagen actual
        const previewContainer = document.getElementById('preview-producto-imagen');
        if (producto.imagen) {
            previewContainer.innerHTML = `<img src="${producto.imagen}" alt="Imagen actual">`;
        } else {
            previewContainer.innerHTML = '';
        }
        
        // Abrir modal
        const modal = new bootstrap.Modal(document.getElementById('modal-producto'));
        modal.show();
    },
    
    // -------------------------------------------------
    // CONFIRMAR ELIMINACIÓN
    // -------------------------------------------------
    confirmarEliminar: function(id) {
        const producto = this.productos.find(p => p.id === id);
        
        if (!producto) return;
        
        if (confirm(`¿Estás seguro de eliminar el producto "${producto.nombre}"?`)) {
            this.eliminarProducto(id);
        }
    },
    
    // -------------------------------------------------
    // ELIMINAR PRODUCTO
    // -------------------------------------------------
    eliminarProducto: async function(id) {
        try {
            const uid = Auth.obtenerUID();
            
            if (navigator.onLine && uid) {
                await eliminarDocumento('productos', uid, id);
            }
            
            DBLocal.eliminarProducto(id);
            
            // Eliminar de memoria
            this.productos = this.productos.filter(p => p.id !== id);
            
            this.renderizarProductos();
            App.actualizarDashboard();
            
            App.mostrarNotificacion('Éxito', 'Producto eliminado correctamente', 'success');
            
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            App.mostrarNotificacion('Error', 'No se pudo eliminar el producto', 'danger');
        }
    },
    
    // -------------------------------------------------
    // BUSCAR PRODUCTOS
    // -------------------------------------------------
    buscarProductos: function(texto) {
        if (!texto.trim()) {
            this.renderizarProductos();
            return;
        }
        
        const textoMinusculas = texto.toLowerCase();
        const resultados = this.productos.filter(p => 
            (p.nombre && p.nombre.toLowerCase().includes(textoMinusculas)) ||
            (p.codigo && p.codigo.toLowerCase().includes(textoMinusculas)) ||
            (p.categoria && p.categoria.toLowerCase().includes(textoMinusculas))
        );
        
        this.renderizarProductos(resultados);
    },
    
    // -------------------------------------------------
    // FILTRAR POR CATEGORÍA
    // -------------------------------------------------
    filtrarPorCategoria: function(categoria) {
        if (!categoria) {
            this.renderizarProductos();
            return;
        }
        
        const resultados = this.productos.filter(p => p.categoria === categoria);
        this.renderizarProductos(resultados);
    },
    
    // -------------------------------------------------
    // CARGAR CATEGORÍAS EN SELECT
    // -------------------------------------------------
    cargarCategorias: function() {
        const categorias = DBLocal.obtenerCategorias();
        
        // Actualizar select de filtro
        const selectFiltro = document.getElementById('filtro-categoria');
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="">Todas las categorías</option>' +
                categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
        
        // Actualizar datalist del formulario
        const datalist = document.getElementById('lista-categorias');
        if (datalist) {
            datalist.innerHTML = categorias.map(cat => 
                `<option value="${cat}">`
            ).join('');
        }
    },
    
    // -------------------------------------------------
    // PREVISUALIZAR IMAGEN
    // -------------------------------------------------
    previsualizarImagen: function(evento) {
        const archivo = evento.target.files[0];
        const previewContainer = document.getElementById('preview-producto-imagen');
        
        if (archivo) {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewContainer.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(archivo);
        } else {
            previewContainer.innerHTML = '';
        }
    },
    
    // -------------------------------------------------
    // LIMPIAR FORMULARIO
    // -------------------------------------------------
    limpiarFormulario: function() {
        document.getElementById('producto-id').value = '';
        document.getElementById('producto-codigo').value = '';
        document.getElementById('producto-nombre').value = '';
        document.getElementById('producto-descripcion').value = '';
        document.getElementById('producto-categoria').value = '';
        document.getElementById('producto-precio-compra').value = '';
        document.getElementById('producto-precio-venta').value = '';
        document.getElementById('producto-stock').value = '0';
        document.getElementById('producto-imagen').value = '';
        document.getElementById('preview-producto-imagen').innerHTML = '';
    },
    
    // -------------------------------------------------
    // OBTENER PRODUCTO POR ID
    // -------------------------------------------------
    obtenerProducto: function(id) {
        return this.productos.find(p => p.id === id) || null;
    },
    
    // -------------------------------------------------
    // FORMATEAR NÚMERO
    // -------------------------------------------------
    formatearNumero: function(numero) {
        return new Intl.NumberFormat('es-CO').format(numero || 0);
    }
};

// Hacer disponible globalmente
window.Inventario = Inventario;