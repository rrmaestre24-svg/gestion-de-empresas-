// =====================================================
// GENERADOR DE PDF - FACTURAS
// Generación de facturas en formato PDF
// =====================================================

const PDFGenerator = {
    
    // Factura actual para descargar
    facturaActual: null,
    
    // -------------------------------------------------
    // GENERAR PDF DE FACTURA
    // -------------------------------------------------
    generarFacturaPDF: function(factura) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Obtener datos de empresa
        const empresa = DBLocal.obtenerEmpresa();
        const config = DBLocal.obtenerConfiguracion();
        
        // Configuración de colores
        const colorPrimario = [26, 35, 126]; // Azul oscuro
        const colorSecundario = [108, 117, 125]; // Gris
        
        // -------------------------------------------------
        // ENCABEZADO DE LA EMPRESA
        // -------------------------------------------------
        
        // Logo (si existe)
        if (empresa.logo) {
            try {
                doc.addImage(empresa.logo, 'PNG', 20, 10, 30, 30);
            } catch (e) {
                console.log('No se pudo agregar el logo');
            }
        }
        
        // Datos de la empresa
        const xEmpresa = empresa.logo ? 55 : 20;
        
        doc.setFontSize(16);
        doc.setTextColor(...colorPrimario);
        doc.setFont('helvetica', 'bold');
        doc.text(empresa.nombre || 'Mi Empresa', xEmpresa, 18);
        
        doc.setFontSize(9);
        doc.setTextColor(...colorSecundario);
        doc.setFont('helvetica', 'normal');
        
        let yEmpresa = 24;
        
        if (empresa.nit) {
            doc.text(`NIT: ${empresa.nit}`, xEmpresa, yEmpresa);
            yEmpresa += 5;
        }
        
        if (empresa.direccion) {
            doc.text(empresa.direccion, xEmpresa, yEmpresa);
            yEmpresa += 5;
        }
        
        if (empresa.ciudad) {
            doc.text(empresa.ciudad + ', Colombia', xEmpresa, yEmpresa);
            yEmpresa += 5;
        }
        
        if (empresa.telefono) {
            doc.text(`Tel: ${empresa.telefono}`, xEmpresa, yEmpresa);
            yEmpresa += 5;
        }
        
        if (empresa.email) {
            doc.text(empresa.email, xEmpresa, yEmpresa);
        }
        
        // -------------------------------------------------
        // NÚMERO DE FACTURA
        // -------------------------------------------------
        
        doc.setFillColor(...colorPrimario);
        doc.rect(130, 10, 65, 25, 'F');
        
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('FACTURA DE VENTA', 162.5, 18, { align: 'center' });
        
        doc.setFontSize(14);
        doc.text(factura.numero, 162.5, 28, { align: 'center' });
        
        // Fecha
        doc.setFontSize(9);
        doc.setTextColor(...colorSecundario);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${this.formatearFecha(factura.fecha)}`, 162.5, 40, { align: 'center' });
        
        // Línea separadora
        doc.setDrawColor(...colorPrimario);
        doc.setLineWidth(0.5);
        doc.line(20, 50, 190, 50);
        
        // -------------------------------------------------
        // DATOS DEL CLIENTE
        // -------------------------------------------------
        
        doc.setFillColor(245, 245, 245);
        doc.rect(20, 55, 170, 30, 'F');
        
        doc.setFontSize(10);
        doc.setTextColor(...colorPrimario);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTE', 25, 63);
        
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        
        // Nombre del cliente
        doc.setFont('helvetica', 'bold');
        doc.text(factura.cliente.nombre || 'Consumidor Final', 25, 71);
        doc.setFont('helvetica', 'normal');
        
        // Documento
        if (factura.cliente.documento) {
            doc.text(`NIT/CC: ${factura.cliente.documento}`, 25, 78);
        } else {
            doc.text('Cliente no inscrito', 25, 78);
        }
        
        // Dirección y teléfono en columna derecha
        if (factura.cliente.direccion) {
            doc.text(`Dirección: ${factura.cliente.direccion}`, 110, 71);
        }
        
        if (factura.cliente.telefono) {
            doc.text(`Teléfono: ${factura.cliente.telefono}`, 110, 78);
        }
        
        // -------------------------------------------------
        // TABLA DE PRODUCTOS
        // -------------------------------------------------
        
        const datosTabla = factura.items.map(item => [
            item.nombre,
            item.cantidad.toString(),
            '$' + this.formatearNumero(item.precioUnitario),
            '$' + this.formatearNumero(item.subtotal)
        ]);
        
        doc.autoTable({
            startY: 92,
            head: [['Descripción', 'Cantidad', 'Precio Unitario', 'Subtotal']],
            body: datosTabla,
            theme: 'striped',
            headStyles: {
                fillColor: colorPrimario,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 25, halign: 'center' },
                2: { cellWidth: 40, halign: 'right' },
                3: { cellWidth: 40, halign: 'right' }
            },
            styles: {
                fontSize: 9,
                cellPadding: 4
            },
            alternateRowStyles: {
                fillColor: [250, 250, 250]
            }
        });
        
        // -------------------------------------------------
        // TOTALES
        // -------------------------------------------------
        
        const yTotales = doc.lastAutoTable.finalY + 10;
        
        // Caja de totales
        doc.setFillColor(245, 245, 245);
        doc.rect(120, yTotales, 70, 35, 'F');
        
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        
        // Subtotal
        doc.text('Subtotal:', 125, yTotales + 8);
        doc.text('$' + this.formatearNumero(factura.subtotal), 185, yTotales + 8, { align: 'right' });
        
        // IVA
        doc.text(`IVA (${factura.porcentajeIVA}%):`, 125, yTotales + 16);
        doc.text('$' + this.formatearNumero(factura.iva), 185, yTotales + 16, { align: 'right' });
        
        // Línea antes del total
        doc.setDrawColor(...colorPrimario);
        doc.line(125, yTotales + 21, 185, yTotales + 21);
        
        // Total
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colorPrimario);
        doc.text('TOTAL:', 125, yTotales + 30);
        doc.text('$' + this.formatearNumero(factura.total), 185, yTotales + 30, { align: 'right' });
        
        // -------------------------------------------------
        // OBSERVACIONES
        // -------------------------------------------------
        
        if (factura.observaciones) {
            const yObs = yTotales + 45;
            
            doc.setFontSize(9);
            doc.setTextColor(...colorPrimario);
            doc.setFont('helvetica', 'bold');
            doc.text('Observaciones:', 20, yObs);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            
            const lineasObs = doc.splitTextToSize(factura.observaciones, 100);
            doc.text(lineasObs, 20, yObs + 6);
        }
        
        // -------------------------------------------------
        // MENSAJE PERSONALIZADO
        // -------------------------------------------------
        
        if (config.mensajeFactura) {
            doc.setFontSize(9);
            doc.setTextColor(...colorSecundario);
            doc.setFont('helvetica', 'italic');
            
            const yMensaje = 260;
            doc.text(config.mensajeFactura, 105, yMensaje, { align: 'center' });
        }
        
        // -------------------------------------------------
        // PIE DE PÁGINA
        // -------------------------------------------------
        
        doc.setDrawColor(...colorPrimario);
        doc.setLineWidth(0.3);
        doc.line(20, 275, 190, 275);
        
        doc.setFontSize(8);
        doc.setTextColor(...colorSecundario);
        doc.setFont('helvetica', 'normal');
        doc.text('Documento generado por FacturaPRO Colombia', 105, 282, { align: 'center' });
        doc.text(`Fecha de impresión: ${new Date().toLocaleString('es-CO')}`, 105, 287, { align: 'center' });
        
        // Guardar referencia para descarga
        this.facturaActual = {
            doc: doc,
            numero: factura.numero
        };
        
        return doc;
    },
    
    // -------------------------------------------------
    // DESCARGAR FACTURA ACTUAL
    // -------------------------------------------------
    descargarFacturaActual: function() {
        if (Facturas.facturaActual) {
            const doc = this.generarFacturaPDF(Facturas.facturaActual);
            doc.save(`Factura_${Facturas.facturaActual.numero}.pdf`);
            App.mostrarNotificacion('Éxito', 'Factura descargada correctamente', 'success');
        } else {
            App.mostrarNotificacion('Error', 'No hay factura para descargar', 'danger');
        }
    },
    
    // -------------------------------------------------
    // OBTENER PDF COMO BLOB (PARA COMPARTIR)
    // -------------------------------------------------
    obtenerPDFBlob: function(factura) {
        const doc = this.generarFacturaPDF(factura);
        return doc.output('blob');
    },
    
    // -------------------------------------------------
    // OBTENER PDF COMO BASE64 (PARA PREVIEW)
    // -------------------------------------------------
    obtenerPDFBase64: function(factura) {
        const doc = this.generarFacturaPDF(factura);
        return doc.output('datauristring');
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
        const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(fecha).toLocaleDateString('es-CO', opciones);
    }
};

// Hacer disponible globalmente
window.PDFGenerator = PDFGenerator;