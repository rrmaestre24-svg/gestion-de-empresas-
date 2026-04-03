// =====================================================
// MÓDULO DE FACTURAS
// Gestión de facturas y generación de PDF
// =====================================================

const Facturas = {
    
    // Lista de facturas
    facturas: [],
    
    // Items de la factura actual
    itemsActuales: [],
    
    // Factura en edición
    facturaActual: null,
    
    // -------------------------------------------------
    // INICIALIZAR MÓDULO
    // -------------------------------------------------
    inicializar: async function() {
        await this.cargarFacturas();
        this.configurarEventos();
        this.renderizarFacturas();
    },
    
    // -------------------------------------------------
    // CARGAR FACTURAS
    // -------------------------------------------------
    cargarFacturas: async function() {
        const uid = Auth.obtenerUID();
        
        if (navigator.onLine && uid) {
            try {
                this.facturas = await obtenerTodosDocumentos('facturas', uid);
                DBLocal.guardarColeccion('facturas', this.facturas);
            } catch (error) {
                console.error('Error al cargar facturas:', error);
                this.facturas = DBLocal.obtenerFacturas();
            }
        } else {
            this.facturas = DBLocal.obtenerFacturas();
        }
        
        return this.facturas;
    },
    
    // -------------------------------------------------
    // CONFIGURAR EVENTOS
    // -------------------------------------------------
    configurarEventos: function() {
        // Botón agregar item
        const btnAgregarItem = document.getElementById('btn-agregar-item');
        if (btnAgregarItem) {
            btnAgregarItem.addEventListener('click', () => this.agregarFilaItem());
        }
        
        // Botón guardar factura
        const btnGuardar = document.getElementById('btn-guardar-factura');
        if (btnGuardar) {
            btnGuardar.addEventListener('click', () => this.guardarFactura());
        }
        
        // Tipo de cliente
        const selectTipoCliente = document.getElementById('factura-tipo-cliente');
        if (selectTipoCliente) {
            selectTipoCliente.addEventListener('change', (e) => {
                const grupoDocumento = document.getElementById('grupo-documento-cliente');
                if (e.target.value === 'no-inscrito') {
                    grupoDocumento.classList.add('d-none');
                } else {
                    grupoDocumento.classList.remove('d-none');
                }
            });
        }
        
        // Filtros de fecha
        const filtroDesde = document.getElementById('filtro-fecha-desde');
        const filtroHasta = document.getElementById('filtro-fecha-hasta');
        const filtroEstado = document.getElementById('filtro-estado-factura');
        
        [filtroDesde, filtroHasta, filtroEstado].forEach(filtro => {
            if (filtro) {
                filtro.addEventListener('change', () => this.aplicarFiltros());
            }
        });
        
        // Modal de factura - limpiar al abrir
        const modalFactura = document.getElementById('modal-factura');
        if (modalFactura) {
            modalFactura.addEventListener('show.bs.modal', () => {
                this.limpiarFormularioFactura();
                this.establecerFechaActual();
            });
        }
        
        // Botón enviar WhatsApp
        const btnEnviarWA = document.getElementById('btn-enviar-wa');
        if (btnEnviarWA) {
            btnEnviarWA.addEventListener('click', () => this.enviarPorWhatsApp());
        }
        
        // Botón descargar PDF
        const btnDescargarPDF = document.getElementById('btn-descargar-pdf');
        if (btnDescargarPDF) {
            btnDescargarPDF.addEventListener('click', () => PDFGenerator.descargarFacturaActual());
        }
    },
    
    // -------------------------------------------------
    // RENDERIZAR TABLA DE FACTURAS
    // -------------------------------------------------
    renderizarFacturas: function(facturasAMostrar = null) {
        const facturas = facturasAMostrar || this.facturas;
        const tbody = document.getElementById('tabla-facturas');
        
        if (!tbody) return;
        
        if (facturas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-file-earmark display-4 d-block mb-2"></i>
                        No hay facturas registradas
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordenar por fecha descendente
        const facturasOrdenadas = [...facturas].sort((a, b) => 
            new Date(b.fecha) - new Date(a.fecha)
        );
        
        tbody.innerHTML = facturasOrdenadas.map(factura => `
            <tr>
                <td><strong>${factura.numero}</strong></td>
                <td>${this.formatearFecha(factura.fecha)}</td>
                <td>
                    ${factura.cliente.nombre}
                    ${factura.cliente.documento ? `<br><small class="text-muted">${factura.cliente.documento}</small>` : ''}
                </td>
                <td><strong>$${this.formatearNumero(factura.total)}</strong></td>
                <td>
                    <span class="badge badge-${factura.estado || 'pendiente'}">
                        ${this.obtenerTextoEstado(factura.estado)}
                    </span>
                </td>
                <td class="acciones-fila">
                    <button class="btn btn-sm btn-outline-success me-1" 
                            onclick="Facturas.verFactura('${factura.id}')"
                            title="Ver / Enviar">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary me-1" 
                            onclick="Facturas.cambiarEstado('${factura.id}')"
                            title="Cambiar estado">
                        <i class="bi bi-check-circle"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" 
                            onclick="Facturas.confirmarAnular('${factura.id}')"
                            title="Anular">
                        <i class="bi bi-x-circle"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },
    
    // -------------------------------------------------
    // AGREGAR FILA DE ITEM A LA FACTURA
    // -------------------------------------------------
    agregarFilaItem: function(item = null) {
        const tbody = document.getElementById('items-factura');
        const productos = Inventario.productos;
        
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>
                <select class="form-select form-select-sm item-producto" onchange="Facturas.seleccionarProducto(this)">
                    <option value="">Seleccionar producto...</option>
                    ${productos.map(p => `
                        <option value="${p.id}" 
                                data-precio="${p.precioVenta}" 
                                data-nombre="${p.nombre}"
                                ${item && item.productoId === p.id ? 'selected' : ''}>
                            ${p.codigo ? p.codigo + ' - ' : ''}${p.nombre}
                        </option>
                    `).join('')}
                    <option value="personalizado">+ Agregar manualmente</option>
                </select>
                <input type="text" class="form-control form-control-sm mt-1 item-nombre d-none" 
                       placeholder="Nombre del producto/servicio"
                       value="${item && item.nombre ? item.nombre : ''}">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm item-cantidad" 
                       value="${item ? item.cantidad : 1}" min="1"
                       onchange="Facturas.calcularSubtotalFila(this)">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm item-precio" 
                       value="${item ? item.precioUnitario : ''}" min="0"
                       onchange="Facturas.calcularSubtotalFila(this)">
            </td>
            <td>
                <input type="text" class="form-control form-control-sm item-subtotal" 
                       value="${item ? this.formatearNumero(item.subtotal) : '0'}" readonly>
            </td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="Facturas.eliminarFilaItem(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(fila);
        
        // Si hay item precargado y es personalizado
        if (item && !item.productoId) {
            const inputNombre = fila.querySelector('.item-nombre');
            const selectProducto = fila.querySelector('.item-producto');
            selectProducto.value = 'personalizado';
            inputNombre.classList.remove('d-none');
        }
    },
    
    // -------------------------------------------------
    // SELECCIONAR PRODUCTO EN FILA
    // -------------------------------------------------
    seleccionarProducto: function(select) {
        const fila = select.closest('tr');
        const inputPrecio = fila.querySelector('.item-precio');
        const inputNombre = fila.querySelector('.item-nombre');
        
        if (select.value === 'personalizado') {
            inputNombre.classList.remove('d-none');
            inputPrecio.value = '';
        } else if (select.value) {
            inputNombre.classList.add('d-none');
            const opcion = select.options[select.selectedIndex];
            inputPrecio.value = opcion.dataset.precio;
            this.calcularSubtotalFila(inputPrecio);
        } else {
            inputNombre.classList.add('d-none');
            inputPrecio.value = '';
        }
    },
    
    // -------------------------------------------------
    // CALCULAR SUBTOTAL DE FILA
    // -------------------------------------------------
    calcularSubtotalFila: function(input) {
        const fila = input.closest('tr');
        if (!fila) return;
        
        const cantidadInput = fila.querySelector('.item-cantidad');
        const precioInput = fila.querySelector('.item-precio');
        const subtotalInput = fila.querySelector('.item-subtotal');
        
        if (cantidadInput && precioInput && subtotalInput) {
            const cantidad = parseFloat(cantidadInput.value) || 0;
            const precio = parseFloat(precioInput.value) || 0;
            const subtotal = cantidad * precio;
            
            subtotalInput.value = this.formatearNumero(subtotal);
        }
        
        this.calcularTotalesFactura();
    },
    
    // -------------------------------------------------
    // ELIMINAR FILA DE ITEM
    // -------------------------------------------------
    eliminarFilaItem: function(btn) {
        const fila = btn.closest('tr');
        if (fila) {
            fila.remove();
            this.calcularTotalesFactura();
        }
    },
    
    // -------------------------------------------------
    // CALCULAR TOTALES DE FACTURA
    // -------------------------------------------------
    calcularTotalesFactura: function() {
        const filas = document.querySelectorAll('#items-factura tr');
        let subtotal = 0;
        
        filas.forEach(fila => {
            const cantidadInput = fila.querySelector('.item-cantidad');
            const precioInput = fila.querySelector('.item-precio');
            
            if (cantidadInput && precioInput) {
                const cantidad = parseFloat(cantidadInput.value) || 0;
                const precio = parseFloat(precioInput.value) || 0;
                subtotal += cantidad * precio;
            }
        });
        
        const config = DBLocal.obtenerConfiguracion();
        const porcentajeIVA = config.iva || 19;
        const iva = subtotal * (porcentajeIVA / 100);
        const total = subtotal + iva;
        
        // Actualizar elementos solo si existen
        const elSubtotal = document.getElementById('factura-subtotal');
        const elIvaPorcentaje = document.getElementById('factura-iva-porcentaje');
        const elIva = document.getElementById('factura-iva');
        const elTotal = document.getElementById('factura-total');
        
        if (elSubtotal) elSubtotal.textContent = '$' + this.formatearNumero(subtotal);
        if (elIvaPorcentaje) elIvaPorcentaje.textContent = porcentajeIVA;
        if (elIva) elIva.textContent = '$' + this.formatearNumero(iva);
        if (elTotal) elTotal.textContent = '$' + this.formatearNumero(total);
    },
    
    // -------------------------------------------------
    // GUARDAR FACTURA
    // -------------------------------------------------
    guardarFactura: async function() {
        // Obtener datos del cliente
        const tipoCliente = document.getElementById('factura-tipo-cliente').value;
        const cliente = {
            tipo: tipoCliente,
            documento: tipoCliente === 'inscrito' ? 
                document.getElementById('factura-cliente-documento').value.trim() : '',
            nombre: document.getElementById('factura-cliente-nombre').value.trim(),
            telefono: document.getElementById('factura-cliente-telefono').value.trim(),
            direccion: document.getElementById('factura-cliente-direccion').value.trim()
        };
        
        // Validar nombre del cliente
        if (!cliente.nombre) {
            App.mostrarNotificacion('Error', 'El nombre del cliente es obligatorio', 'danger');
            return;
        }
        
        // Obtener items
        const filas = document.querySelectorAll('#items-factura tr');
        const items = [];
        
        filas.forEach(fila => {
            const selectProducto = fila.querySelector('.item-producto');
            const inputNombre = fila.querySelector('.item-nombre');
            const cantidad = parseFloat(fila.querySelector('.item-cantidad').value) || 0;
            const precioUnitario = parseFloat(fila.querySelector('.item-precio').value) || 0;
            
            if (cantidad > 0 && precioUnitario > 0) {
                let nombre = '';
                let productoId = null;
                
                if (selectProducto.value === 'personalizado') {
                    nombre = inputNombre.value.trim() || 'Producto/Servicio';
                } else if (selectProducto.value) {
                    productoId = selectProducto.value;
                    const opcion = selectProducto.options[selectProducto.selectedIndex];
                    nombre = opcion.dataset.nombre;
                }
                
                if (nombre) {
                    items.push({
                        productoId: productoId,
                        nombre: nombre,
                        cantidad: cantidad,
                        precioUnitario: precioUnitario,
                        subtotal: cantidad * precioUnitario
                    });
                }
            }
        });
        
        // Validar que haya al menos un item
        if (items.length === 0) {
            App.mostrarNotificacion('Error', 'Debe agregar al menos un producto o servicio', 'danger');
            return;
        }
        
        // Calcular totales
        const config = DBLocal.obtenerConfiguracion();
        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const porcentajeIVA = config.iva || 19;
        const iva = subtotal * (porcentajeIVA / 100);
        const total = subtotal + iva;
        
        // Crear objeto factura
        const factura = {
            fecha: document.getElementById('factura-fecha').value,
            cliente: cliente,
            items: items,
            subtotal: subtotal,
            porcentajeIVA: porcentajeIVA,
            iva: iva,
            total: total,
            observaciones: document.getElementById('factura-observaciones').value.trim(),
            estado: 'pendiente'
        };
        
        try {
            const uid = Auth.obtenerUID();
            
            // Generar número de factura
            factura.numero = DBLocal.generarNumeroFactura();
            
            let nuevoId;
            
            if (navigator.onLine && uid) {
                nuevoId = await guardarDocumento('facturas', uid, factura);
            } else {
                nuevoId = DBLocal.agregarAColeccion('facturas', factura);
                DBLocal.marcarParaSincronizar('facturas', nuevoId);
            }
            
            factura.id = nuevoId;
            this.facturas.unshift(factura);
            
            // Actualizar stock de productos vendidos
            for (const item of items) {
                if (item.productoId) {
                    DBLocal.actualizarStock(item.productoId, item.cantidad, true);
                    
                    // Actualizar en inventario local
                    const producto = Inventario.productos.find(p => p.id === item.productoId);
                    if (producto) {
                        producto.stock = Math.max(0, (producto.stock || 0) - item.cantidad);
                    }
                }
            }
            
            // Guardar cliente si tiene documento
            if (cliente.documento) {
                const clienteExistente = DBLocal.buscarClientePorDocumento(cliente.documento);
                if (!clienteExistente) {
                    DBLocal.guardarCliente(cliente);
                }
            }
            
            // Cerrar modal y mostrar factura
            const modal = bootstrap.Modal.getInstance(document.getElementById('modal-factura'));
            modal.hide();
            
            this.renderizarFacturas();
            App.actualizarDashboard();
            
            // Guardar factura actual y mostrar preview
            this.facturaActual = factura;
            this.mostrarPreviewFactura(factura);
            
            App.mostrarNotificacion('Éxito', `Factura ${factura.numero} creada correctamente`, 'success');
            
        } catch (error) {
            console.error('Error al guardar factura:', error);
            App.mostrarNotificacion('Error', 'No se pudo guardar la factura', 'danger');
        }
    },
    
    // -------------------------------------------------
    // VER FACTURA
    // -------------------------------------------------
    verFactura: function(id) {
        const factura = this.facturas.find(f => f.id === id);
        
        if (!factura) {
            App.mostrarNotificacion('Error', 'Factura no encontrada', 'danger');
            return;
        }
        
        this.facturaActual = factura;
        this.mostrarPreviewFactura(factura);
    },
    
    // -------------------------------------------------
    // MOSTRAR PREVIEW DE FACTURA
    // -------------------------------------------------
    mostrarPreviewFactura: function(factura) {
        const contenedor = document.getElementById('preview-factura-contenido');
        const empresa = DBLocal.obtenerEmpresa();
        
        contenedor.innerHTML = `
            <div class="factura-preview">
                <div class="header-empresa text-center">
                    <h4>${empresa.nombre || 'Mi Empresa'}</h4>
                    ${empresa.nit ? `<p class="mb-0">NIT: ${empresa.nit}</p>` : ''}
                    ${empresa.direccion ? `<p class="mb-0">${empresa.direccion}</p>` : ''}
                    ${empresa.telefono ? `<p class="mb-0">Tel: ${empresa.telefono}</p>` : ''}
                </div>
                
                <div class="row mt-3">
                    <div class="col-6">
                        <strong>Factura N°:</strong> ${factura.numero}<br>
                        <strong>Fecha:</strong> ${this.formatearFecha(factura.fecha)}
                    </div>
                    <div class="col-6 text-end">
                        <strong>Cliente:</strong> ${factura.cliente.nombre}<br>
                        ${factura.cliente.documento ? `<strong>Doc:</strong> ${factura.cliente.documento}<br>` : ''}
                        ${factura.cliente.telefono ? `<strong>Tel:</strong> ${factura.cliente.telefono}` : ''}
                    </div>
                </div>
                
                <table class="table table-sm mt-3">
                    <thead class="table-light">
                        <tr>
                            <th>Descripción</th>
                            <th class="text-center">Cant.</th>
                            <th class="text-end">P. Unit.</th>
                            <th class="text-end">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${factura.items.map(item => `
                            <tr>
                                <td>${item.nombre}</td>
                                <td class="text-center">${item.cantidad}</td>
                                <td class="text-end">$${this.formatearNumero(item.precioUnitario)}</td>
                                <td class="text-end">$${this.formatearNumero(item.subtotal)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="text-end">Subtotal:</td>
                            <td class="text-end">$${this.formatearNumero(factura.subtotal)}</td>
                        </tr>
                        <tr>
                            <td colspan="3" class="text-end">IVA (${factura.porcentajeIVA}%):</td>
                            <td class="text-end">$${this.formatearNumero(factura.iva)}</td>
                        </tr>
                        <tr class="table-primary">
                            <td colspan="3" class="text-end"><strong>TOTAL:</strong></td>
                            <td class="text-end"><strong>$${this.formatearNumero(factura.total)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                
                ${factura.observaciones ? `
                    <div class="mt-3">
                        <strong>Observaciones:</strong><br>
                        <small>${factura.observaciones}</small>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Pre-llenar número de WhatsApp si existe
        if (factura.cliente.telefono) {
            document.getElementById('wa-numero').value = factura.cliente.telefono.replace(/\D/g, '');
        }
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modal-preview-factura'));
        modal.show();
    },
    
    // -------------------------------------------------
    // ENVIAR POR WHATSAPP
    // -------------------------------------------------
    enviarPorWhatsApp: function() {
        const numero = document.getElementById('wa-numero').value.trim();
        const mensaje = document.getElementById('wa-mensaje').value.trim();
        
        if (!numero) {
            App.mostrarNotificacion('Error', 'Ingresa un número de WhatsApp', 'danger');
            return;
        }
        
        // Formatear número (agregar código de país si no lo tiene)
        let numeroFormateado = numero.replace(/\D/g, '');
        if (!numeroFormateado.startsWith('57')) {
            numeroFormateado = '57' + numeroFormateado;
        }
        
        // Crear mensaje con datos de la factura
        let mensajeCompleto = mensaje;
        
        if (this.facturaActual) {
            mensajeCompleto += `\n\n📄 *Factura ${this.facturaActual.numero}*`;
            mensajeCompleto += `\n💰 Total: $${this.formatearNumero(this.facturaActual.total)}`;
            mensajeCompleto += `\n📅 Fecha: ${this.formatearFecha(this.facturaActual.fecha)}`;
        }
        
        // Codificar mensaje para URL
        const mensajeCodificado = encodeURIComponent(mensajeCompleto);
        
        // Abrir WhatsApp
        const urlWhatsApp = `https://wa.me/${numeroFormateado}?text=${mensajeCodificado}`;
        window.open(urlWhatsApp, '_blank');
    },
    
    // -------------------------------------------------
    // CAMBIAR ESTADO DE FACTURA
    // -------------------------------------------------
    cambiarEstado: async function(id) {
        const factura = this.facturas.find(f => f.id === id);
        
        if (!factura) return;
        
        // Ciclo de estados: pendiente -> pagada -> pendiente
        const nuevoEstado = factura.estado === 'pagada' ? 'pendiente' : 'pagada';
        
        try {
            const uid = Auth.obtenerUID();
            
            if (navigator.onLine && uid) {
                await guardarDocumento('facturas', uid, { estado: nuevoEstado }, id);
            }
            
            DBLocal.actualizarEnColeccion('facturas', id, { estado: nuevoEstado });
            
            // Actualizar en memoria
            factura.estado = nuevoEstado;
            
            this.renderizarFacturas();
            
            App.mostrarNotificacion('Éxito', 
                `Factura marcada como ${nuevoEstado === 'pagada' ? 'pagada' : 'pendiente'}`, 
                'success'
            );
            
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            App.mostrarNotificacion('Error', 'No se pudo cambiar el estado', 'danger');
        }
    },
    
    // -------------------------------------------------
    // CONFIRMAR ANULACIÓN
    // -------------------------------------------------
    confirmarAnular: function(id) {
        if (confirm('¿Estás seguro de anular esta factura?')) {
            this.anularFactura(id);
        }
    },
    
    // -------------------------------------------------
    // ANULAR FACTURA
    // -------------------------------------------------
    anularFactura: async function(id) {
        try {
            const uid = Auth.obtenerUID();
            
            if (navigator.onLine && uid) {
                await guardarDocumento('facturas', uid, { estado: 'anulada' }, id);
            }
            
            DBLocal.actualizarEnColeccion('facturas', id, { estado: 'anulada' });
            
            const factura = this.facturas.find(f => f.id === id);
            if (factura) {
                factura.estado = 'anulada';
            }
            
            this.renderizarFacturas();
            App.actualizarDashboard();
            
            App.mostrarNotificacion('Éxito', 'Factura anulada correctamente', 'success');
            
        } catch (error) {
            console.error('Error al anular factura:', error);
            App.mostrarNotificacion('Error', 'No se pudo anular la factura', 'danger');
        }
    },
    
    // -------------------------------------------------
    // APLICAR FILTROS
    // -------------------------------------------------
    aplicarFiltros: function() {
        const fechaDesde = document.getElementById('filtro-fecha-desde').value;
        const fechaHasta = document.getElementById('filtro-fecha-hasta').value;
        const estado = document.getElementById('filtro-estado-factura').value;
        
        let facturasFiltradas = [...this.facturas];
        
        // Filtrar por fecha
        if (fechaDesde) {
            facturasFiltradas = facturasFiltradas.filter(f => f.fecha >= fechaDesde);
        }
        
        if (fechaHasta) {
            facturasFiltradas = facturasFiltradas.filter(f => f.fecha <= fechaHasta);
        }
        
        // Filtrar por estado
        if (estado) {
            facturasFiltradas = facturasFiltradas.filter(f => f.estado === estado);
        }
        
        this.renderizarFacturas(facturasFiltradas);
    },
    
    // -------------------------------------------------
    // LIMPIAR FILTROS
    // -------------------------------------------------
    limpiarFiltros: function() {
        document.getElementById('filtro-fecha-desde').value = '';
        document.getElementById('filtro-fecha-hasta').value = '';
        document.getElementById('filtro-estado-factura').value = '';
        this.renderizarFacturas();
    },
    
    // -------------------------------------------------
    // ESTABLECER FECHA ACTUAL EN EL FORMULARIO
    // -------------------------------------------------
    establecerFechaActual: function() {
        const inputFecha = document.getElementById('factura-fecha');
        if (inputFecha) {
            const hoy = new Date().toISOString().split('T')[0];
            inputFecha.value = hoy;
        }
    },
    
    // -------------------------------------------------
    // LIMPIAR FORMULARIO DE FACTURA
    // -------------------------------------------------
    limpiarFormularioFactura: function() {
        document.getElementById('factura-id').value = '';
        document.getElementById('factura-tipo-cliente').value = 'no-inscrito';
        document.getElementById('factura-cliente-documento').value = '';
        document.getElementById('factura-cliente-nombre').value = '';
        document.getElementById('factura-cliente-telefono').value = '';
        document.getElementById('factura-cliente-direccion').value = '';
        document.getElementById('factura-observaciones').value = '';
        
        // Ocultar campo de documento para cliente no inscrito
        document.getElementById('grupo-documento-cliente').classList.add('d-none');
        
        // Limpiar items
        document.getElementById('items-factura').innerHTML = '';
        
        // Resetear totales
        document.getElementById('factura-subtotal').textContent = '$0';
        document.getElementById('factura-iva').textContent = '$0';
        document.getElementById('factura-total').textContent = '$0';
        
        // Agregar primera fila vacía
        this.agregarFilaItem();
    },
    
    // -------------------------------------------------
    // OBTENER TEXTO DE ESTADO
    // -------------------------------------------------
    obtenerTextoEstado: function(estado) {
        const estados = {
            'pendiente': 'Pendiente',
            'pagada': 'Pagada',
            'anulada': 'Anulada'
        };
        return estados[estado] || 'Pendiente';
    },
    
    // -------------------------------------------------
    // FORMATEAR NÚMERO
    // -------------------------------------------------
    formatearNumero: function(numero) {
        return new Intl.NumberFormat('es-CO').format(numero || 0);
    },
    
    // -------------------------------------------------
    // FORMATEAR FECHA
    // -------------------------------------------------
    formatearFecha: function(fecha) {
        if (!fecha) return '-';
        const opciones = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(fecha).toLocaleDateString('es-CO', opciones);
    }
};

// Hacer disponible globalmente
window.Facturas = Facturas;