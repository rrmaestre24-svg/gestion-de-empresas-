// =====================================================
// MÓDULO DE REPORTES Y GRÁFICOS
// Análisis visual de datos con Chart.js
// =====================================================

const Reportes = {
    
    // Referencias a gráficos
    graficos: {
        ventasSemana: null,
        productosTop: null,
        evolucionVentas: null,
        gastosCategoria: null,
        topProductos: null,
        ingresosGastos: null
    },
    
    // Colores para gráficos
    colores: {
        primario: '#2c3e50',
        acento: '#3498db',
        exito: '#27ae60',
        peligro: '#c0392b',
        advertencia: '#f39c12',
        morado: '#8e44ad',
        gris: '#7f8c8d',
        paleta: [
            '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#27ae60', '#2980b9'
        ]
    },
    
    // -------------------------------------------------
    // INICIALIZAR REPORTES
    // -------------------------------------------------
    inicializar: function() {
        this.configurarEventos();
    },
    
    // -------------------------------------------------
    // CONFIGURAR EVENTOS
    // -------------------------------------------------
    configurarEventos: function() {
        const selectPeriodo = document.getElementById('reporte-periodo');
        if (selectPeriodo) {
            selectPeriodo.addEventListener('change', () => this.generarReporteCompleto());
        }
    },
    
    // -------------------------------------------------
    // ACTUALIZAR GRÁFICOS DEL DASHBOARD
    // -------------------------------------------------
    actualizarDashboard: function() {
        this.graficoVentasSemana();
        this.graficoProductosTopDashboard();
    },
    
    // -------------------------------------------------
    // GRÁFICO: VENTAS DE LOS ÚLTIMOS 7 DÍAS
    // -------------------------------------------------
    graficoVentasSemana: function() {
        const canvas = document.getElementById('grafico-ventas-semana');
        if (!canvas) return;
        
        // Destruir gráfico anterior si existe
        if (this.graficos.ventasSemana) {
            this.graficos.ventasSemana.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        const datos = this.obtenerVentasUltimos7Dias();
        
        this.graficos.ventasSemana = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datos.etiquetas,
                datasets: [{
                    label: 'Ventas',
                    data: datos.valores,
                    backgroundColor: this.colores.acento + '80',
                    borderColor: this.colores.acento,
                    borderWidth: 2,
                    borderRadius: 6,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: this.colores.primario,
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => ' $' + this.formatearNumero(context.raw)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e1e5e9' },
                        ticks: {
                            callback: (value) => '$' + this.formatearNumeroCorto(value)
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    },
    
    // -------------------------------------------------
    // GRÁFICO: PRODUCTOS MÁS VENDIDOS (DASHBOARD)
    // -------------------------------------------------
    graficoProductosTopDashboard: function() {
        const canvas = document.getElementById('grafico-productos-top');
        if (!canvas) return;
        
        if (this.graficos.productosTop) {
            this.graficos.productosTop.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        const datos = this.obtenerProductosTopVendidos(5);
        
        if (datos.etiquetas.length === 0) {
            // Mostrar mensaje si no hay datos
            ctx.font = '14px Inter';
            ctx.fillStyle = '#7f8c8d';
            ctx.textAlign = 'center';
            ctx.fillText('Sin datos de ventas', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        this.graficos.productosTop = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: datos.etiquetas,
                datasets: [{
                    data: datos.valores,
                    backgroundColor: this.colores.paleta.slice(0, datos.etiquetas.length),
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: this.colores.primario,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => ` ${context.label}: ${context.raw} unidades`
                        }
                    }
                }
            }
        });
    },
    
    // -------------------------------------------------
    // GENERAR REPORTE COMPLETO
    // -------------------------------------------------
    generarReporteCompleto: function() {
        const periodo = parseInt(document.getElementById('reporte-periodo')?.value || 30);
        
        this.graficoEvolucionVentas(periodo);
        this.graficoGastosPorCategoria(periodo);
        this.graficoTopProductos(periodo);
        this.graficoIngresosVsGastos(periodo);
    },
    
    // -------------------------------------------------
    // GRÁFICO: EVOLUCIÓN DE VENTAS
    // -------------------------------------------------
    graficoEvolucionVentas: function(dias) {
        const canvas = document.getElementById('grafico-evolucion-ventas');
        if (!canvas) return;
        
        if (this.graficos.evolucionVentas) {
            this.graficos.evolucionVentas.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        const datos = this.obtenerVentasPorPeriodo(dias);
        
        this.graficos.evolucionVentas = new Chart(ctx, {
            type: 'line',
            data: {
                labels: datos.etiquetas,
                datasets: [{
                    label: 'Ventas',
                    data: datos.valores,
                    borderColor: this.colores.exito,
                    backgroundColor: this.colores.exito + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: this.colores.exito,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: this.colores.primario,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => ' $' + this.formatearNumero(context.raw)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e1e5e9' },
                        ticks: {
                            callback: (value) => '$' + this.formatearNumeroCorto(value)
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    },
    
    // -------------------------------------------------
    // GRÁFICO: GASTOS POR CATEGORÍA
    // -------------------------------------------------
    graficoGastosPorCategoria: function(dias) {
        const canvas = document.getElementById('grafico-gastos-categoria');
        if (!canvas) return;
        
        if (this.graficos.gastosCategoria) {
            this.graficos.gastosCategoria.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        const datos = this.obtenerGastosPorCategoria(dias);
        
        this.graficos.gastosCategoria = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: datos.etiquetas,
                datasets: [{
                    data: datos.valores,
                    backgroundColor: this.colores.paleta.slice(0, datos.etiquetas.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 12,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: this.colores.primario,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => ` ${context.label}: $${this.formatearNumero(context.raw)}`
                        }
                    }
                }
            }
        });
    },
    
    // -------------------------------------------------
    // GRÁFICO: TOP 10 PRODUCTOS VENDIDOS
    // -------------------------------------------------
    graficoTopProductos: function(dias) {
        const canvas = document.getElementById('grafico-top-productos');
        if (!canvas) return;
        
        if (this.graficos.topProductos) {
            this.graficos.topProductos.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        const datos = this.obtenerProductosTopVendidos(10, dias);
        
        this.graficos.topProductos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datos.etiquetas,
                datasets: [{
                    label: 'Unidades vendidas',
                    data: datos.valores,
                    backgroundColor: this.colores.paleta,
                    borderRadius: 4,
                    barThickness: 25
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: this.colores.primario,
                        padding: 12,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#e1e5e9' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 11 }
                        }
                    }
                }
            }
        });
    },
    
    // -------------------------------------------------
    // GRÁFICO: INGRESOS VS GASTOS
    // -------------------------------------------------
    graficoIngresosVsGastos: function(dias) {
        const canvas = document.getElementById('grafico-ingresos-gastos');
        if (!canvas) return;
        
        if (this.graficos.ingresosGastos) {
            this.graficos.ingresosGastos.destroy();
        }
        
        const ctx = canvas.getContext('2d');
        const datos = this.obtenerIngresosVsGastos(dias);
        
        this.graficos.ingresosGastos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: datos.etiquetas,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: datos.ingresos,
                        backgroundColor: this.colores.exito + 'CC',
                        borderColor: this.colores.exito,
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Gastos',
                        data: datos.gastos,
                        backgroundColor: this.colores.peligro + 'CC',
                        borderColor: this.colores.peligro,
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'rect',
                            padding: 20
                        }
                    },
                    tooltip: {
                        backgroundColor: this.colores.primario,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => ` ${context.dataset.label}: $${this.formatearNumero(context.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e1e5e9' },
                        ticks: {
                            callback: (value) => '$' + this.formatearNumeroCorto(value)
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    },
    
    // -------------------------------------------------
    // OBTENER DATOS: VENTAS ÚLTIMOS 7 DÍAS
    // -------------------------------------------------
    obtenerVentasUltimos7Dias: function() {
        const facturas = Facturas?.facturas || [];
        const hoy = new Date();
        const etiquetas = [];
        const valores = [];
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        for (let i = 6; i >= 0; i--) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            const fechaStr = fecha.toISOString().split('T')[0];
            
            etiquetas.push(diasSemana[fecha.getDay()]);
            
            const ventasDia = facturas
                .filter(f => f.fecha === fechaStr && f.estado !== 'anulada')
                .reduce((sum, f) => sum + (f.total || 0), 0);
            
            valores.push(ventasDia);
        }
        
        return { etiquetas, valores };
    },
    
    // -------------------------------------------------
    // OBTENER DATOS: VENTAS POR PERÍODO
    // -------------------------------------------------
    obtenerVentasPorPeriodo: function(dias) {
        const facturas = Facturas?.facturas || [];
        const hoy = new Date();
        const datos = {};
        
        // Agrupar por semana o mes según el período
        const agruparPor = dias <= 30 ? 'dia' : dias <= 90 ? 'semana' : 'mes';
        
        for (let i = dias - 1; i >= 0; i--) {
            const fecha = new Date(hoy);
            fecha.setDate(hoy.getDate() - i);
            
            let clave;
            if (agruparPor === 'dia') {
                clave = fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
            } else if (agruparPor === 'semana') {
                const semana = Math.floor(i / 7);
                clave = `Sem ${dias / 7 - semana}`;
            } else {
                clave = fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
            }
            
            if (!datos[clave]) datos[clave] = 0;
        }
        
        facturas.forEach(f => {
            if (f.estado === 'anulada') return;
            
            const fechaFactura = new Date(f.fecha);
            const diffDias = Math.floor((hoy - fechaFactura) / (1000 * 60 * 60 * 24));
            
            if (diffDias >= 0 && diffDias < dias) {
                let clave;
                if (agruparPor === 'dia') {
                    clave = fechaFactura.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
                } else if (agruparPor === 'semana') {
                    const semana = Math.floor(diffDias / 7);
                    clave = `Sem ${dias / 7 - semana}`;
                } else {
                    clave = fechaFactura.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
                }
                
                if (datos[clave] !== undefined) {
                    datos[clave] += f.total || 0;
                }
            }
        });
        
        // Limitar a máximo 12 puntos para legibilidad
        const entries = Object.entries(datos);
        const step = Math.ceil(entries.length / 12);
        const filteredEntries = entries.filter((_, i) => i % step === 0 || i === entries.length - 1);
        
        return {
            etiquetas: filteredEntries.map(e => e[0]),
            valores: filteredEntries.map(e => e[1])
        };
    },
    
    // -------------------------------------------------
    // OBTENER DATOS: PRODUCTOS TOP VENDIDOS
    // -------------------------------------------------
    obtenerProductosTopVendidos: function(cantidad = 5, dias = 30) {
        const facturas = Facturas?.facturas || [];
        const hoy = new Date();
        const productosVendidos = {};
        
        facturas.forEach(f => {
            if (f.estado === 'anulada') return;
            
            const fechaFactura = new Date(f.fecha);
            const diffDias = Math.floor((hoy - fechaFactura) / (1000 * 60 * 60 * 24));
            
            if (diffDias >= 0 && diffDias < dias) {
                (f.items || []).forEach(item => {
                    const nombre = item.nombre || 'Producto';
                    productosVendidos[nombre] = (productosVendidos[nombre] || 0) + (item.cantidad || 0);
                });
            }
        });
        
        const ordenados = Object.entries(productosVendidos)
            .sort((a, b) => b[1] - a[1])
            .slice(0, cantidad);
        
        return {
            etiquetas: ordenados.map(p => p[0].substring(0, 20)),
            valores: ordenados.map(p => p[1])
        };
    },
    
    // -------------------------------------------------
    // OBTENER DATOS: GASTOS POR CATEGORÍA
    // -------------------------------------------------
    obtenerGastosPorCategoria: function(dias = 30) {
        const gastos = Contabilidad?.gastos || [];
        const hoy = new Date();
        const porCategoria = {};
        
        gastos.forEach(g => {
            const fechaGasto = new Date(g.fecha);
            const diffDias = Math.floor((hoy - fechaGasto) / (1000 * 60 * 60 * 24));
            
            if (diffDias >= 0 && diffDias < dias) {
                const cat = g.categoria || 'Sin categoría';
                porCategoria[cat] = (porCategoria[cat] || 0) + (g.monto || 0);
            }
        });
        
        const ordenados = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
        
        return {
            etiquetas: ordenados.map(c => c[0]),
            valores: ordenados.map(c => c[1])
        };
    },
    
    // -------------------------------------------------
    // OBTENER DATOS: INGRESOS VS GASTOS
    // -------------------------------------------------
    obtenerIngresosVsGastos: function(dias = 30) {
        const facturas = Facturas?.facturas || [];
        const gastos = Contabilidad?.gastos || [];
        const hoy = new Date();
        
        // Agrupar por mes
        const meses = {};
        const numMeses = Math.min(Math.ceil(dias / 30), 6);
        
        for (let i = numMeses - 1; i >= 0; i--) {
            const fecha = new Date(hoy);
            fecha.setMonth(hoy.getMonth() - i);
            const clave = fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
            meses[clave] = { ingresos: 0, gastos: 0 };
        }
        
        facturas.forEach(f => {
            if (f.estado === 'anulada') return;
            const fecha = new Date(f.fecha);
            const clave = fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
            if (meses[clave]) {
                meses[clave].ingresos += f.total || 0;
            }
        });
        
        gastos.forEach(g => {
            const fecha = new Date(g.fecha);
            const clave = fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
            if (meses[clave]) {
                meses[clave].gastos += g.monto || 0;
            }
        });
        
        const entries = Object.entries(meses);
        
        return {
            etiquetas: entries.map(e => e[0]),
            ingresos: entries.map(e => e[1].ingresos),
            gastos: entries.map(e => e[1].gastos)
        };
    },
    
    // -------------------------------------------------
    // FORMATEAR NÚMEROS
    // -------------------------------------------------
    formatearNumero: function(numero) {
        return new Intl.NumberFormat('es-CO').format(numero || 0);
    },
    
    formatearNumeroCorto: function(numero) {
        if (numero >= 1000000) {
            return (numero / 1000000).toFixed(1) + 'M';
        } else if (numero >= 1000) {
            return (numero / 1000).toFixed(0) + 'K';
        }
        return numero.toString();
    }
};

window.Reportes = Reportes;
