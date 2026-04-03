// =====================================================
// MÓDULO DE INVENTARIO (CORREGIDO PARA IMÁGENES)
// =====================================================

const Inventario = {
    
    productos: [],
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
                this.productos = await obtenerTodosDocumentos('productos', uid);
                DBLocal.guardarColeccion('productos', this.productos);
            } catch (error) {
                console.error('Error al cargar productos de Firebase:', error);
                this.productos = DBLocal.obtenerProductos();
            }
        } else {
            this.productos = DBLocal.obtenerProductos();
        }
        
        return this.productos;
    },
    
    // -------------------------------------------------
    // CONFIGURAR EVENTOS
    // -------------------------------------------------
    configurarEventos: function() {
        const btnGuardar = document.getElementById('btn-guardar-producto');
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => this.guardarProducto());
        }
        
        const inputImagen = document.getElementById('producto-imagen');
        if (inputImagen) {
            inputImagen.addEventListener('change', (e) => this.previsualizarImagen(e));
        }
        
        const buscador = document.getElementById('buscar-producto');
        if (buscador) {
            buscador.addEventListener('input', (e) => this.buscarProductos(e.target.value));
        }
        
        const filtroCategoria = document.getElementById('filtro-categoria');
        if (filtroCategoria) {
            filtroCategoria.addEventListener('change', (e) => this.filtrarPorCategoria(e.target.value));
        }
        
        const filtroStock = document.getElementById('filtro-stock');
        if (filtroStock) {
            filtroStock.addEventListener('change', (e) => this.filtrarPorStock(e.target.value));
        }
        
        const modalProducto = document.getElementById('modal-producto');
        if (modalProducto) {
            modalProducto.addEventListener('show.bs.modal', (e) => {
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

        const umbral = DBLocal.obtenerConfiguracion().umbralStockBajo || 10;

        tbody.innerHTML = productos.map(producto => {
            const stockClass = producto.stock > umbral ? 'badge-success'
                             : producto.stock > 0      ? 'badge-warning'
                             : 'badge-danger';
            return `
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
                        <span class="badge ${stockClass}">
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
            `;
        }).join('');
    },
    
    // -------------------------------------------------
    // GUARDAR PRODUCTO (CORREGIDO PARA IMÁGENES)
    // -------------------------------------------------
    guardarProducto: async function() {
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
        
        // Preparar datos del producto (SIN IMAGEN por ahora)
        const producto = {
            codigo: codigo,
            nombre: nombre,
            descripcion: descripcion,
            categoria: categoria,
            precioCompra: precioCompra,
            precioVenta: precioVenta,
            stock: stock
        };
        
        // 🔥 MANEJO DE IMAGEN CORREGIDO
        const inputImagen = document.getElementById('producto-imagen');
        if (inputImagen.files && inputImagen.files[0]) {
            const archivo = inputImagen.files[0];
            
            // Validar tamaño de imagen (máximo 500KB para Base64)
            if (archivo.size > 500000) {
                App.mostrarNotificacion('Advertencia', 'La imagen es muy grande. Por ahora no se guardará. Usa imágenes menores a 500KB.', 'warning');
                // NO guardar la imagen si es muy grande
                producto.imagen = null;
            } else {
                try {
                    // Guardar en Base64 solo si es pequeña
                    producto.imagen = await archivoABase64(archivo);
                } catch (error) {
                    console.error('Error al procesar imagen:', error);
                    producto.imagen = null;
                }
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
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('modal-producto'));
            modal.hide();
            
            this.renderizarProductos();
            this.cargarCategorias();
            App.actualizarDashboard();
            
        } catch (error) {
            console.error('Error al guardar producto:', error);
            
            if (error.message && error.message.includes('longer than')) {
                App.mostrarNotificacion('Error', 'La imagen es demasiado grande. Usa una imagen más pequeña.', 'danger');
            } else {
                App.mostrarNotificacion('Error', 'No se pudo guardar el producto', 'danger');
            }
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
        
        document.getElementById('producto-id').value = producto.id;
        document.getElementById('producto-codigo').value = producto.codigo || '';
        document.getElementById('producto-nombre').value = producto.nombre || '';
        document.getElementById('producto-descripcion').value = producto.descripcion || '';
        document.getElementById('producto-categoria').value = producto.categoria || '';
        document.getElementById('producto-precio-compra').value = producto.precioCompra || '';
        document.getElementById('producto-precio-venta').value = producto.precioVenta || '';
        document.getElementById('producto-stock').value = producto.stock || 0;
        
        const previewContainer = document.getElementById('preview-producto-imagen');
        if (producto.imagen) {
            previewContainer.innerHTML = `<img src="${producto.imagen}" alt="Imagen actual">`;
        } else {
            previewContainer.innerHTML = '';
        }
        
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
    // LIMPIAR FILTROS
    // -------------------------------------------------
    limpiarFiltros: function() {
        document.getElementById('buscar-producto').value = '';
        document.getElementById('filtro-categoria').value = '';
        document.getElementById('filtro-stock').value = '';
        this.renderizarProductos();
    },
    
    // -------------------------------------------------
    // FILTRAR POR STOCK
    // -------------------------------------------------
    filtrarPorStock: function(tipoStock) {
        if (!tipoStock) {
            this.renderizarProductos();
            return;
        }

        const umbral = DBLocal.obtenerConfiguracion().umbralStockBajo || 10;
        let resultados = [...this.productos];

        if (tipoStock === 'agotado') {
            resultados = resultados.filter(p => (p.stock || 0) === 0);
        } else if (tipoStock === 'bajo') {
            resultados = resultados.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= umbral);
        }

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
        
        const selectFiltro = document.getElementById('filtro-categoria');
        if (selectFiltro) {
            selectFiltro.innerHTML = '<option value="">Todas las categorías</option>' +
                categorias.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }
        
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
            // Validar tamaño
            if (archivo.size > 500000) {
                App.mostrarNotificacion('Advertencia', 'La imagen es muy grande (>500KB). Se recomienda usar imágenes más pequeñas.', 'warning');
            }
            
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

window.Inventario = Inventario;