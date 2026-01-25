// =====================================================
// MÓDULO DE CONTABILIDAD
// Gestión de ingresos, gastos y reportes
// =====================================================

const Contabilidad = {
    
    // Lista de gastos
    gastos: [],
    
    // Período seleccionado
    mesActual: new Date().getMonth() + 1,
    anioActual: new Date().getFullYear(),
    
    // -------------------------------------------------
    // INICIALIZAR MÓDULO
    // -------------------------------------------------
    inicializar: async function() {
        await this.cargarGastos();
        this.configurarEventos();
        this.inicializarSelectores();
        this.renderizarGastos();
        this.calcularResumen();
    },
    
    // -------------------------------------------------
    // CARGAR GASTOS
    // -------------------------------------------------
    cargarGastos: async function() {
        const uid = Auth.obtenerUID();
        
        if (navigator.onLine && uid) {
            try {
                this.gastos = await obtenerTodosDocumentos('gastos', uid);
                DBLocal.guardarColeccion('gastos', this.gastos);
            } catch (error) {
                console.error('Error al cargar gastos:', error);
                this.gastos = DBLocal.obtenerGastos();
            }
        } else {
            this.gastos = DBLocal.obtenerGastos();
        }
        
        return this.gastos;
    },
    
    // -------------------------------------------------
    // CONFIGURAR EVENTOS
    // -------------------------------------------------
    configurarEventos: function() {
        // Botón guardar gasto
        const btnGuardarGasto = document.getElementById('btn-guardar-gasto');
        if (btnGuardarGasto) {
            btnGuardarGasto.addEventListener('click', () => this.guardarGasto());
        }
        
        // Selectores de período
        const selectMes = document.getElementById('contabilidad-mes');
        const selectAnio = document.getElementById('contabilidad-anio');
        
        if (selectMes) {
            selectMes.addEventListener('change', (e) => {
                this.mesActual = parseInt(e.target.value);
                this.renderizarGastos();
                this.calcularResumen();
            });
        }
        
        if (selectAnio) {
            selectAnio.addEventListener('change', (e) => {
                this.anioActual = parseInt(e.target.value);
                this.renderizarGastos();
                this.calcularResumen();
            });
        }
        
        // Botón generar reporte
        const btnGenerarReporte = document.getElementById('btn-generar-reporte');
        if (btnGenerarReporte) {
            btnGenerarReporte.addEventListener('click', () => this.generarReporte());
        }
        
        // Botón exportar Excel
        const btnExportarExcel = document.getElementById('btn-exportar-excel');
        if (btnExportarExcel) {
            btnExportarExcel.addEventListener('click', () => this.exportarAExcel());
        }
        
        // Modal de gasto - limpiar al abrir
        const modalGasto = document.getElementById('modal-gasto');
        if (modalGasto) {
            modalGasto.addEventListener('show.bs.modal', () => {
                this.limpiarFormularioGasto();
            });
        }
    },
    
    // -------------------------------------------------
    // INICIALIZAR SELECTORES DE PERÍODO
    // -------------------------------------------------
    inicializarSelectores: function() {
        // Selector de mes - establecer mes actual
        const selectMes = document.getElementById('contabilidad-mes');
        if (selectMes) {
            selectMes.value = this.mesActual;
        }
        
        // Selector de año - llenar con años disponibles
        const selectAnio = document.getElementById('contabilidad-anio');
        if (selectAnio) {
            const anioActual = new Date().getFullYear();
            let opciones = '';
            
            for (let anio = anioActual; anio >= anioActual - 5; anio--) {
                opciones += `<option value="${anio}" ${anio === this.anioActual ? 'selected' : ''}>${anio}</option>`;
            }
            
            selectAnio.innerHTML = opciones;
        }
    },
    
    // -------------------------------------------------
    // RENDERIZAR TABLA DE GASTOS
    // -------------------------------------------------
    renderizarGastos: function() {
        const tbody = document.getElementById('tabla-gastos');
        
        if (!tbody) return;
        
        // Filtrar gastos por mes y año seleccionado
        const gastosFiltrados = this.obtenerGastosPorPeriodo(this.mesActual, this.anioActual);
        
        if (gastosFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="bi bi-cash-stack display-4 d-block mb-2"></i>
                        No hay gastos registrados en este período
                    </td>
                </tr>
            `;
            return;
        }
        
        // Ordenar por fecha descendente - CORREGIDO: usar gastosFiltrados
        const gastosOrdenados = [...gastosFiltrados].sort((a, b) => 
            new Date(b.fecha) - new Date(a.fecha)
        );
        
        tbody.innerHTML = gastosOrdenados.map(gasto => `
            <tr>
                <td>${this.formatearFecha(gasto.fecha)}</td>
                <td>${gasto.descripcion}</td>
                <td>
                    <span class="badge bg-secondary">${gasto.categoria || 'Sin categoría'}</span>
                </td>
                <td class="text-danger">
                    <strong>-$${this.formatearNumero(gasto.monto)}</strong>
                </td>
                <td class="acciones-fila">
                    <button class="btn btn-outline-primary" 
                            onclick="Contabilidad.editarGasto('${gasto.id}')"
                            title="Editar gasto">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="btn btn-outline-danger" 
                            onclick="Contabilidad.confirmarEliminarGasto('${gasto.id}')"
                            title="Eliminar gasto">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },
    
    // -------------------------------------------------
    // GUARDAR GASTO
    // -------------------------------------------------
    guardarGasto: async function() {
        const id = document.getElementById('gasto-id').value;
        const fecha = document.getElementById('gasto-fecha').value;
        const categoria = document.getElementById('gasto-categoria').value;
        const descripcion = document.getElementById('gasto-descripcion').value.trim();
        const monto = parseFloat(document.getElementById('gasto-monto').value) || 0;
        
        // Validaciones
        if (!fecha) {
            App.mostrarNotificacion('Error', 'La fecha es obligatoria', 'danger');
            return;
        }
        
        if (!categoria) {
            App.mostrarNotificacion('Error', 'Selecciona una categoría', 'danger');
            return;
        }
        
        if (!descripcion) {
            App.mostrarNotificacion('Error', 'La descripción es obligatoria', 'danger');
            return;
        }
        
        if (monto <= 0) {
            App.mostrarNotificacion('Error', 'El monto debe ser mayor a 0', 'danger');
            return;
        }
        
        const gasto = {
            fecha: fecha,
            categoria: categoria,
            descripcion: descripcion,
            monto: monto
        };
        
        try {
            const uid = Auth.obtenerUID();
            
            if (id) {
                // Editar gasto existente
                if (navigator.onLine && uid) {
                    await guardarDocumento('gastos', uid, gasto, id);
                }
                DBLocal.actualizarEnColeccion('gastos', id, gasto);
                
                const indice = this.gastos.findIndex(g => g.id === id);
                if (indice !== -1) {
                    this.gastos[indice] = { ...this.gastos[indice], ...gasto };
                }
                
                App.mostrarNotificacion('Éxito', 'Gasto actualizado correctamente', 'success');
            } else {
                // Crear nuevo gasto
                let nuevoId;
                
                if (navigator.onLine && uid) {
                    nuevoId = await guardarDocumento('gastos', uid, gasto);
                } else {
                    nuevoId = DBLocal.guardarGasto(gasto);
                    DBLocal.marcarParaSincronizar('gastos', nuevoId);
                }
                
                gasto.id = nuevoId;
                this.gastos.unshift(gasto);
                
                App.mostrarNotificacion('Éxito', 'Gasto registrado correctamente', 'success');
            }
            
            // Cerrar modal y actualizar vista
            const modal = bootstrap.Modal.getInstance(document.getElementById('modal-gasto'));
            modal.hide();
            
            this.renderizarGastos();
            this.calcularResumen();
            App.actualizarDashboard();
            
        } catch (error) {
            console.error('Error al guardar gasto:', error);
            App.mostrarNotificacion('Error', 'No se pudo guardar el gasto', 'danger');
        }
    },
    
    // -------------------------------------------------
    // EDITAR GASTO
    // -------------------------------------------------
    editarGasto: function(id) {
        const gasto = this.gastos.find(g => g.id === id);
        
        if (!gasto) {
            App.mostrarNotificacion('Error', 'Gasto no encontrado', 'danger');
            return;
        }
        
        document.getElementById('gasto-id').value = gasto.id;
        document.getElementById('gasto-fecha').value = gasto.fecha || '';
        document.getElementById('gasto-categoria').value = gasto.categoria || '';
        document.getElementById('gasto-descripcion').value = gasto.descripcion || '';
        document.getElementById('gasto-monto').value = gasto.monto || '';
        
        const modal = new bootstrap.Modal(document.getElementById('modal-gasto'));
        modal.show();
    },
    
    // -------------------------------------------------
    // CONFIRMAR ELIMINACIÓN DE GASTO
    // -------------------------------------------------
    confirmarEliminarGasto: function(id) {
        const gasto = this.gastos.find(g => g.id === id);
        
        if (!gasto) return;
        
        if (confirm(`¿Estás seguro de eliminar el gasto "${gasto.descripcion}"?`)) {
            this.eliminarGasto(id);
        }
    },
    
    // -------------------------------------------------
    // ELIMINAR GASTO
    // -------------------------------------------------
    eliminarGasto: async function(id) {
        try {
            const uid = Auth.obtenerUID();
            
            if (navigator.onLine && uid) {
                await eliminarDocumento('gastos', uid, id);
            }
            
            DBLocal.eliminarGasto(id);
            
            this.gastos = this.gastos.filter(g => g.id !== id);
            
            this.renderizarGastos();
            this.calcularResumen();
            App.actualizarDashboard();
            
            App.mostrarNotificacion('Éxito', 'Gasto eliminado correctamente', 'success');
            
        } catch (error) {
            console.error('Error al eliminar gasto:', error);
            App.mostrarNotificacion('Error', 'No se pudo eliminar el gasto', 'danger');
        }
    },
    
    // -------------------------------------------------
    // LIMPIAR FORMULARIO DE GASTO
    // -------------------------------------------------
    limpiarFormularioGasto: function() {
        document.getElementById('gasto-id').value = '';
        document.getElementById('gasto-fecha').value = new Date().toISOString().split('T')[0];
        document.getElementById('gasto-categoria').value = '';
        document.getElementById('gasto-descripcion').value = '';
        document.getElementById('gasto-monto').value = '';
    },
    
    // -------------------------------------------------
    // OBTENER GASTOS POR PERÍODO
    // -------------------------------------------------
    obtenerGastosPorPeriodo: function(mes, anio) {
        return this.gastos.filter(g => {
            const fecha = new Date(g.fecha);
            return fecha.getMonth() + 1 === mes && fecha.getFullYear() === anio;
        });
    },
    
    // -------------------------------------------------
    // OBTENER INGRESOS (FACTURAS) POR PERÍODO
    // -------------------------------------------------
    obtenerIngresosPorPeriodo: function(mes, anio) {
        const facturas = Facturas.facturas || [];
        
        return facturas.filter(f => {
            if (f.estado === 'anulada') return false;
            
            const fecha = new Date(f.fecha);
            return fecha.getMonth() + 1 === mes && fecha.getFullYear() === anio;
        });
    },
    
    // -------------------------------------------------
    // CALCULAR RESUMEN
    // -------------------------------------------------
    calcularResumen: function() {
        const gastosPeriodo = this.obtenerGastosPorPeriodo(this.mesActual, this.anioActual);
        const facturasPeriodo = this.obtenerIngresosPorPeriodo(this.mesActual, this.anioActual);
        
        const totalGastos = gastosPeriodo.reduce((sum, g) => sum + (g.monto || 0), 0);
        const totalIngresos = facturasPeriodo.reduce((sum, f) => sum + (f.total || 0), 0);
        const utilidad = totalIngresos - totalGastos;
        
        // Actualizar UI
        const resumenIngresos = document.getElementById('resumen-ingresos');
        const resumenGastos = document.getElementById('resumen-gastos');
        const resumenUtilidad = document.getElementById('resumen-utilidad');
        const utilidadCard = document.getElementById('resumen-utilidad-card');
        
        if (resumenIngresos) resumenIngresos.textContent = '$' + this.formatearNumero(totalIngresos);
        if (resumenGastos) resumenGastos.textContent = '$' + this.formatearNumero(totalGastos);
        if (resumenUtilidad) resumenUtilidad.textContent = '$' + this.formatearNumero(utilidad);
        
        // Cambiar color según utilidad
        if (utilidadCard) {
            utilidadCard.classList.remove('positivo', 'negativo');
            if (utilidad > 0) {
                utilidadCard.classList.add('positivo');
            } else if (utilidad < 0) {
                utilidadCard.classList.add('negativo');
            }
        }
        
        return { ingresos: totalIngresos, gastos: totalGastos, utilidad: utilidad };
    },
    
    // -------------------------------------------------
    // OBTENER GASTOS POR CATEGORÍA
    // -------------------------------------------------
    obtenerGastosPorCategoria: function(mes, anio) {
        const gastosPeriodo = this.obtenerGastosPorPeriodo(mes, anio);
        const porCategoria = {};
        
        gastosPeriodo.forEach(g => {
            const cat = g.categoria || 'Sin categoría';
            porCategoria[cat] = (porCategoria[cat] || 0) + (g.monto || 0);
        });
        
        return porCategoria;
    },
    
    // -------------------------------------------------
    // GENERAR REPORTE PDF
    // -------------------------------------------------
    generarReporte: function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const empresa = DBLocal.obtenerEmpresa();
        const nombreMes = this.obtenerNombreMes(this.mesActual);
        const resumen = this.calcularResumen();
        const gastosPeriodo = this.obtenerGastosPorPeriodo(this.mesActual, this.anioActual);
        const gastosPorCategoria = this.obtenerGastosPorCategoria(this.mesActual, this.anioActual);
        
        // Encabezado
        doc.setFillColor(44, 62, 80);
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.text('REPORTE CONTABLE', 105, 18, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(empresa.nombre || 'Mi Empresa', 105, 28, { align: 'center' });
        doc.text(`${nombreMes} ${this.anioActual}`, 105, 35, { align: 'center' });
        
        // Resumen general
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text('Resumen General', 20, 55);
        
        doc.autoTable({
            startY: 60,
            head: [['Concepto', 'Valor']],
            body: [
                ['Total Ingresos', '$' + this.formatearNumero(resumen.ingresos)],
                ['Total Gastos', '$' + this.formatearNumero(resumen.gastos)],
                ['Utilidad Neta', '$' + this.formatearNumero(resumen.utilidad)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] },
            columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 70, halign: 'right' } }
        });
        
        // Gastos por categoría
        let posY = doc.lastAutoTable.finalY + 15;
        
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text('Gastos por Categoría', 20, posY);
        
        const datosGastosCat = [['Categoría', 'Monto']];
        for (const cat in gastosPorCategoria) {
            datosGastosCat.push([cat, '$' + this.formatearNumero(gastosPorCategoria[cat])]);
        }
        
        if (datosGastosCat.length > 1) {
            doc.autoTable({
                startY: posY + 5,
                head: [datosGastosCat[0]],
                body: datosGastosCat.slice(1),
                theme: 'grid',
                headStyles: { fillColor: [192, 57, 43] },
                columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 70, halign: 'right' } }
            });
        }
        
        // Detalle de gastos
        posY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : posY + 20;
        
        if (posY > 250) {
            doc.addPage();
            posY = 20;
        }
        
        doc.setFontSize(14);
        doc.setTextColor(44, 62, 80);
        doc.text('Detalle de Gastos', 20, posY);
        
        if (gastosPeriodo.length > 0) {
            const datosDetalleGastos = [['Fecha', 'Descripción', 'Categoría', 'Monto']];
            gastosPeriodo.forEach(g => {
                datosDetalleGastos.push([
                    this.formatearFecha(g.fecha),
                    g.descripcion,
                    g.categoria || '-',
                    '$' + this.formatearNumero(g.monto)
                ]);
            });
            
            doc.autoTable({
                startY: posY + 5,
                head: [datosDetalleGastos[0]],
                body: datosDetalleGastos.slice(1),
                theme: 'striped',
                headStyles: { fillColor: [127, 140, 141] },
                styles: { fontSize: 9 }
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(128, 128, 128);
            doc.text('No hay gastos registrados en este período', 20, posY + 10);
        }
        
        // Pie de página
        const totalPaginas = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPaginas; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(
                `Generado el ${new Date().toLocaleDateString('es-CO')} - Página ${i} de ${totalPaginas}`,
                105, 290, { align: 'center' }
            );
        }
        
        doc.save(`Reporte_${nombreMes}_${this.anioActual}.pdf`);
        App.mostrarNotificacion('Éxito', 'Reporte PDF generado', 'success');
    },
    
    // -------------------------------------------------
    // EXPORTAR A EXCEL (CSV)
    // -------------------------------------------------
    exportarAExcel: function() {
        const gastosPeriodo = this.obtenerGastosPorPeriodo(this.mesActual, this.anioActual);
        const facturasPeriodo = this.obtenerIngresosPorPeriodo(this.mesActual, this.anioActual);
        const resumen = this.calcularResumen();
        const nombreMes = this.obtenerNombreMes(this.mesActual);
        
        let csv = 'REPORTE CONTABLE\n';
        csv += `Período: ${nombreMes} ${this.anioActual}\n\n`;
        
        csv += 'RESUMEN\n';
        csv += 'Concepto,Valor\n';
        csv += `Total Ingresos,$${resumen.ingresos}\n`;
        csv += `Total Gastos,$${resumen.gastos}\n`;
        csv += `Utilidad Neta,$${resumen.utilidad}\n\n`;
        
        csv += 'INGRESOS (FACTURAS)\n';
        csv += 'Número,Fecha,Cliente,Total\n';
        facturasPeriodo.forEach(f => {
            csv += `${f.numero},${f.fecha},"${f.cliente?.nombre || 'N/A'}",$${f.total}\n`;
        });
        csv += '\n';
        
        csv += 'GASTOS\n';
        csv += 'Fecha,Descripción,Categoría,Monto\n';
        gastosPeriodo.forEach(g => {
            csv += `${g.fecha},"${g.descripcion}",${g.categoria},$${g.monto}\n`;
        });
        
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Reporte_${nombreMes}_${this.anioActual}.csv`;
        link.click();
        
        App.mostrarNotificacion('Éxito', 'Archivo exportado correctamente', 'success');
    },
    
    // -------------------------------------------------
    // OBTENER ESTADÍSTICAS PARA DASHBOARD
    // -------------------------------------------------
    obtenerEstadisticasMes: function() {
        const mes = new Date().getMonth() + 1;
        const anio = new Date().getFullYear();
        
        const facturasMes = this.obtenerIngresosPorPeriodo(mes, anio);
        const totalVentas = facturasMes.reduce((sum, f) => sum + (f.total || 0), 0);
        const totalFacturas = facturasMes.length;
        
        return { ventas: totalVentas, facturas: totalFacturas };
    },
    
    // -------------------------------------------------
    // OBTENER NOMBRE DEL MES
    // -------------------------------------------------
    obtenerNombreMes: function(mes) {
        const meses = [
            '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return meses[mes] || '';
    },
    
    formatearNumero: function(numero) {
        return new Intl.NumberFormat('es-CO').format(numero || 0);
    },
    
    formatearFecha: function(fecha) {
        if (!fecha) return '-';
        const opciones = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(fecha).toLocaleDateString('es-CO', opciones);
    }
};

window.Contabilidad = Contabilidad;
