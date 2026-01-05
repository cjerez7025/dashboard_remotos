// ============================================
// CONFIGURACIÓN - ACTUALIZA ESTOS VALORES
// ============================================

// ID de tu Google Sheet
const SHEET_ID = '1FZFaRjqsVXzJODPo5Qa3stKoW66Dy0pS0_plLCw_Y5U';
const SHEET_NAME = 'Resumen';

// ============================================
// VARIABLES GLOBALES
// ============================================
let allData = [];
let charts = {};
let currentView = 'ejecutivo';

// Variables para drill down de NAP por Clínica
let drillDownState = {
    nivel: 1, // 1=Clínica, 2=Equipo, 3=Ejecutivo
    clinicaSeleccionada: null,
    equipoSeleccionado: null
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    updateCurrentDate();
    loadData();
});

// ============================================
// CAMBIO DE VISTAS
// ============================================

function switchView(viewName) {
    currentView = viewName;
    
    // Actualizar pestañas activas
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    // Mostrar/ocultar vistas
    document.querySelectorAll('.dashboard-view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`view-${viewName}`).classList.add('active');
    
    // Actualizar contenido según la vista
    if (viewName === 'ejecutivo') {
        updateVistaEjecutivo();
    } else if (viewName === 'operativo') {
        updateVistaOperativo();
    } else if (viewName === 'individual') {
        updateVistaIndividual();
    }
}

// ============================================
// CARGA DE DATOS
// ============================================

async function loadData() {
    showLoading(true);
    
    try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
        
        const response = await fetch(url);
        const text = await response.text();
        const json = JSON.parse(text.substr(47).slice(0, -2));
        
        allData = processGoogleSheetData(json);
        updateDashboard();
        showLoading(false);
    } catch (error) {
        console.error('Error al cargar datos:', error);
        showLoading(false);
        alert('Error al cargar los datos. Asegúrate de que la hoja esté compartida públicamente.');
    }
}

function processGoogleSheetData(json) {
    const rows = json.table.rows;
    const processedData = [];
    
    rows.forEach(row => {
        const cells = row.c;
        if (cells && cells[0] && cells[0].v) {
            processedData.push({
                clinica: cells[0]?.v || '',
                ejecutivo: cells[1]?.v || '',
                coordinador: cells[2]?.v || '',
                equipo: cells[3]?.v || '',
                ir: parseFloat(cells[4]?.v) || 0,
                nap: parseFloat(cells[5]?.v) || 0,
                negocios: parseFloat(cells[6]?.v) || 0,
                mes: cells[7]?.v || '',
                ano: cells[8]?.v || 2025
            });
        }
    });
    
    return processedData;
}

function updateDashboard() {
    populateFilters();
    updateVistaEjecutivo();
}

function populateFilters() {
    const equipos = [...new Set(allData.map(d => d.equipo))].sort();
    const ejecutivos = [...new Set(allData.map(d => d.ejecutivo))].sort();
    
    // Poblar selector de equipos (Vista Operativa)
    const equipoSelectOp = document.getElementById('equipoFilterOp');
    if (equipoSelectOp) {
        equipoSelectOp.innerHTML = '<option value="all">Todos los Equipos</option>';
        equipos.forEach(equipo => {
            const option = document.createElement('option');
            option.value = equipo;
            option.textContent = equipo;
            equipoSelectOp.appendChild(option);
        });
    }
    
    // Poblar selector de ejecutivos (Vista Individual)
    const ejecutivoSelectInd = document.getElementById('ejecutivoFilterInd');
    if (ejecutivoSelectInd) {
        ejecutivoSelectInd.innerHTML = '<option value="">Seleccione un ejecutivo...</option>';
        ejecutivos.forEach(ejecutivo => {
            const option = document.createElement('option');
            option.value = ejecutivo;
            option.textContent = ejecutivo;
            ejecutivoSelectInd.appendChild(option);
        });
    }
}

// ============================================
// VISTA EJECUTIVO
// ============================================

function updateVistaEjecutivo() {
    const totalNAP = allData.reduce((sum, d) => sum + d.nap, 0);
    const ejecutivosUnicos = [...new Set(allData.map(d => d.ejecutivo))];
    const coordinadoresUnicos = [...new Set(allData.map(d => d.coordinador).filter(c => c && c !== ''))];
    
    const datosConIR = allData.filter(d => d.ir > 0);
    const irPromedio = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    
    const napPromedio = ejecutivosUnicos.length > 0 ? totalNAP / ejecutivosUnicos.length : 0;
    
    document.getElementById('napPromedio_exec').textContent = napPromedio.toLocaleString('es-CL', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' UF';
    document.getElementById('irPromedio_exec').textContent = irPromedio.toFixed(1) + '%';
    document.getElementById('cantidadCoordinadores_exec').textContent = coordinadoresUnicos.length;
    document.getElementById('totalEjecutivos_exec').textContent = ejecutivosUnicos.length;
    
    createEvolucionIRChart();
    createNAPPromedioClinicaChart();
    createTopSaludChart();
    createAlertasEjecutivos();
}

function createEvolucionIRChart() {
    const ctx = document.getElementById('evolucionIRChart');
    if (!ctx) return;
    
    const ordenMeses = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const todosEquipos = [...new Set(allData.map(d => d.equipo))].sort();
    
    // Filtrar solo equipos que tienen al menos un dato de IR
    const equiposConDatos = todosEquipos.filter(equipo => {
        return allData.some(d => d.equipo === equipo && d.ir > 0);
    });
    
    // Si no hay equipos con datos, mostrar mensaje
    if (equiposConDatos.length === 0) {
        const container = ctx.parentElement;
        const mensaje = document.createElement('p');
        mensaje.textContent = 'No hay datos de IR disponibles para mostrar';
        mensaje.style.textAlign = 'center';
        mensaje.style.padding = '40px';
        mensaje.style.color = 'var(--text-secondary)';
        container.appendChild(mensaje);
        ctx.style.display = 'none';
        return;
    }
    
    // Diferentes formas de puntos para distinguir equipos
    const pointStyles = ['circle', 'rect', 'triangle', 'rectRot', 'star', 'cross', 'crossRot'];
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];
    
    const datasets = equiposConDatos.map((equipo, index) => {
        const color = colors[index % colors.length];
        const pointStyle = pointStyles[index % pointStyles.length];
        
        const dataEquipo = ordenMeses.map(mes => {
            const datosMes = allData.filter(d => d.equipo === equipo && d.mes === mes && d.ir > 0);
            return datosMes.length > 0 
                ? datosMes.reduce((sum, d) => sum + d.ir, 0) / datosMes.length 
                : null;
        });
        
        return {
            label: equipo,
            data: dataEquipo,
            borderColor: color,
            backgroundColor: color,
            fill: false,
            tension: 0.3,
            borderWidth: 3,
            pointStyle: pointStyle,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointBorderColor: color,
            pointBackgroundColor: '#fff',
            pointBorderWidth: 3,
            pointHoverBorderWidth: 4
        };
    });
    
    if (charts.evolucionIR) charts.evolucionIR.destroy();
    
    charts.evolucionIR = new Chart(ctx, {
        type: 'line',
        data: { labels: ordenMeses, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    },
                    onClick: (e, legendItem, legend) => {
                        const index = legendItem.datasetIndex;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(index);
                        meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                        chart.update();
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: (context) => {
                            if (context.parsed.y === null) return null;
                            return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { 
                        display: true, 
                        text: 'IR (%)',
                        font: {
                            size: 13,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function createNAPPromedioClinicaChart() {
    const ctx = document.getElementById('napPromedioClinicaChart');
    if (!ctx) return;
    
    // Según el nivel actual, generar datos diferentes
    let chartData;
    let titulo;
    
    if (drillDownState.nivel === 1) {
        // NIVEL 1: Por Clínica
        chartData = generarDatosNivel1_Clinicas();
        titulo = '<i class="fas fa-hospital"></i> NAP Promedio por Clínica';
        document.getElementById('btnVolverClinica').style.display = 'none';
    } else if (drillDownState.nivel === 2) {
        // NIVEL 2: Equipos de la clínica seleccionada
        chartData = generarDatosNivel2_Equipos(drillDownState.clinicaSeleccionada);
        titulo = '<i class="fas fa-users-cog"></i> Equipos de ' + drillDownState.clinicaSeleccionada;
        document.getElementById('btnVolverClinica').style.display = 'flex';
    } else if (drillDownState.nivel === 3) {
        // NIVEL 3: Ejecutivos del equipo seleccionado
        chartData = generarDatosNivel3_Ejecutivos(drillDownState.clinicaSeleccionada, drillDownState.equipoSeleccionado);
        titulo = '<i class="fas fa-user"></i> Ejecutivos de ' + drillDownState.equipoSeleccionado;
        document.getElementById('btnVolverClinica').style.display = 'flex';
    }
    
    // Actualizar título
    document.getElementById('napClinicaTitle').innerHTML = titulo;
    
    if (!chartData || chartData.labels.length === 0) {
        return;
    }
    
    // Destruir chart anterior
    if (charts.napPromedioClinica) {
        charts.napPromedioClinica.destroy();
    }
    
    // Crear nuevo chart
    charts.napPromedioClinica = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'NAP Promedio',
                data: chartData.data,
                backgroundColor: chartData.colors,
                borderColor: chartData.colors.map(c => c.replace('0.8', '1')),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    handleDrillDownClick(index, chartData.items[index]);
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            const item = chartData.items[context.dataIndex];
                            return [
                                'NAP Promedio: ' + item.napPromedio.toLocaleString('es-CL', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' UF',
                                'Ejecutivos: ' + item.ejecutivos,
                                '',
                                '💡 Click para ver detalle'
                            ];
                        }
                    }
                }
            },
            scales: {
                x: { 
                    beginAtZero: true,
                    title: { 
                        display: true, 
                        text: 'NAP Promedio (UF)',
                        font: { size: 13, weight: 'bold' }
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });
}

// NIVEL 1: Generar datos por Clínica
function generarDatosNivel1_Clinicas() {
    const ejecutivosData = {};
    allData.forEach(d => {
        if (!ejecutivosData[d.ejecutivo]) {
            ejecutivosData[d.ejecutivo] = {
                clinica: d.clinica,
                napTotal: 0,
                count: 0
            };
        }
        ejecutivosData[d.ejecutivo].napTotal += d.nap;
        ejecutivosData[d.ejecutivo].count++;
    });
    
    Object.keys(ejecutivosData).forEach(ejecutivo => {
        const data = ejecutivosData[ejecutivo];
        data.napPromedio = data.count > 0 ? data.napTotal / data.count : 0;
    });
    
    const clinicas = {};
    Object.keys(ejecutivosData).forEach(ejecutivo => {
        const data = ejecutivosData[ejecutivo];
        const clinica = data.clinica;
        
        if (!clinicas[clinica]) {
            clinicas[clinica] = { sumaPromedios: 0, cantidadEjecutivos: 0 };
        }
        
        clinicas[clinica].sumaPromedios += data.napPromedio;
        clinicas[clinica].cantidadEjecutivos++;
    });
    
    const clinicasArray = Object.keys(clinicas).map(clinica => {
        const napPromedioClinica = clinicas[clinica].cantidadEjecutivos > 0
            ? clinicas[clinica].sumaPromedios / clinicas[clinica].cantidadEjecutivos
            : 0;
        
        return {
            nombre: clinica,
            napPromedio: napPromedioClinica,
            ejecutivos: clinicas[clinica].cantidadEjecutivos
        };
    }).sort((a, b) => b.napPromedio - a.napPromedio);
    
    const maxNAP = Math.max(...clinicasArray.map(c => c.napPromedio));
    const colors = clinicasArray.map(c => {
        const intensity = c.napPromedio / maxNAP;
        const r = Math.round(37 + (16 - 37) * intensity);
        const g = Math.round(99 + (185 - 99) * intensity);
        const b = Math.round(235 + (129 - 235) * intensity);
        return `rgba(${r}, ${g}, ${b}, 0.8)`;
    });
    
    return {
        labels: clinicasArray.map(c => c.nombre),
        data: clinicasArray.map(c => c.napPromedio),
        colors: colors,
        items: clinicasArray
    };
}

// NIVEL 2: Generar datos por Equipo (dentro de una clínica)
function generarDatosNivel2_Equipos(clinica) {
    const datosClinica = allData.filter(d => d.clinica === clinica);
    
    const ejecutivosData = {};
    datosClinica.forEach(d => {
        if (!ejecutivosData[d.ejecutivo]) {
            ejecutivosData[d.ejecutivo] = {
                equipo: d.equipo,
                napTotal: 0,
                count: 0
            };
        }
        ejecutivosData[d.ejecutivo].napTotal += d.nap;
        ejecutivosData[d.ejecutivo].count++;
    });
    
    Object.keys(ejecutivosData).forEach(ejecutivo => {
        const data = ejecutivosData[ejecutivo];
        data.napPromedio = data.count > 0 ? data.napTotal / data.count : 0;
    });
    
    const equipos = {};
    Object.keys(ejecutivosData).forEach(ejecutivo => {
        const data = ejecutivosData[ejecutivo];
        const equipo = data.equipo;
        
        if (!equipos[equipo]) {
            equipos[equipo] = { sumaPromedios: 0, cantidadEjecutivos: 0 };
        }
        
        equipos[equipo].sumaPromedios += data.napPromedio;
        equipos[equipo].cantidadEjecutivos++;
    });
    
    const equiposArray = Object.keys(equipos).map(equipo => {
        const napPromedioEquipo = equipos[equipo].cantidadEjecutivos > 0
            ? equipos[equipo].sumaPromedios / equipos[equipo].cantidadEjecutivos
            : 0;
        
        return {
            nombre: equipo,
            napPromedio: napPromedioEquipo,
            ejecutivos: equipos[equipo].cantidadEjecutivos
        };
    }).sort((a, b) => b.napPromedio - a.napPromedio);
    
    const maxNAP = Math.max(...equiposArray.map(e => e.napPromedio));
    const colors = equiposArray.map(e => {
        const intensity = e.napPromedio / maxNAP;
        return `rgba(37, 99, ${Math.round(235 - 106 * intensity)}, 0.8)`;
    });
    
    return {
        labels: equiposArray.map(e => e.nombre),
        data: equiposArray.map(e => e.napPromedio),
        colors: colors,
        items: equiposArray
    };
}

// NIVEL 3: Generar datos por Ejecutivo (dentro de un equipo y clínica)
function generarDatosNivel3_Ejecutivos(clinica, equipo) {
    const datosEquipo = allData.filter(d => d.clinica === clinica && d.equipo === equipo);
    
    const ejecutivosData = {};
    datosEquipo.forEach(d => {
        if (!ejecutivosData[d.ejecutivo]) {
            ejecutivosData[d.ejecutivo] = { napTotal: 0, count: 0 };
        }
        ejecutivosData[d.ejecutivo].napTotal += d.nap;
        ejecutivosData[d.ejecutivo].count++;
    });
    
    const ejecutivosArray = Object.keys(ejecutivosData).map(ejecutivo => {
        const data = ejecutivosData[ejecutivo];
        const napPromedio = data.count > 0 ? data.napTotal / data.count : 0;
        
        return {
            nombre: ejecutivo,
            napPromedio: napPromedio,
            ejecutivos: 1
        };
    }).sort((a, b) => b.napPromedio - a.napPromedio);
    
    const maxNAP = Math.max(...ejecutivosArray.map(e => e.napPromedio));
    const colors = ejecutivosArray.map(e => {
        const intensity = e.napPromedio / maxNAP;
        return `rgba(${Math.round(139 - 123 * intensity)}, ${Math.round(92 + 93 * intensity)}, ${Math.round(246 - 117 * intensity)}, 0.8)`;
    });
    
    return {
        labels: ejecutivosArray.map(e => e.nombre),
        data: ejecutivosArray.map(e => e.napPromedio),
        colors: colors,
        items: ejecutivosArray
    };
}

// Manejar click en el gráfico
function handleDrillDownClick(index, item) {
    if (drillDownState.nivel === 1) {
        // Click en clínica → ir a nivel 2 (equipos)
        drillDownState.nivel = 2;
        drillDownState.clinicaSeleccionada = item.nombre;
    } else if (drillDownState.nivel === 2) {
        // Click en equipo → ir a nivel 3 (ejecutivos)
        drillDownState.nivel = 3;
        drillDownState.equipoSeleccionado = item.nombre;
    } else {
        // Ya estamos en nivel 3 (ejecutivos), no hay más drill down
        return;
    }
    
    // Regenerar gráfico con nuevo nivel
    createNAPPromedioClinicaChart();
}

// Función para volver al nivel anterior
function volverNivelClinica() {
    if (drillDownState.nivel === 3) {
        // Volver de ejecutivos a equipos
        drillDownState.nivel = 2;
        drillDownState.equipoSeleccionado = null;
    } else if (drillDownState.nivel === 2) {
        // Volver de equipos a clínicas
        drillDownState.nivel = 1;
        drillDownState.clinicaSeleccionada = null;
    }
    
    // Regenerar gráfico
    createNAPPromedioClinicaChart();
}

function createTopSaludChart() {
    const ctx = document.getElementById('topSaludChart');
    if (!ctx) return;
    
    const ejecutivos = {};
    allData.forEach(d => {
        if (!ejecutivos[d.ejecutivo]) {
            ejecutivos[d.ejecutivo] = { nap: 0, ir: [], count: 0 };
        }
        ejecutivos[d.ejecutivo].nap += d.nap;
        if (d.ir > 0) ejecutivos[d.ejecutivo].ir.push(d.ir);
    });
    
    const ranking = Object.keys(ejecutivos).map(ejecutivo => {
        const data = ejecutivos[ejecutivo];
        const irPromedio = data.ir.length > 0 
            ? data.ir.reduce((a, b) => a + b, 0) / data.ir.length 
            : 0;
        const indiceSalud = (data.nap * irPromedio) / 100;
        
        return {
            nombre: ejecutivo,
            indiceSalud: indiceSalud,
            nap: data.nap,
            ir: irPromedio
        };
    }).sort((a, b) => b.indiceSalud - a.indiceSalud).slice(0, 10);
    
    if (charts.topSalud) charts.topSalud.destroy();
    
    charts.topSalud = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ranking.map(e => e.nombre),
            datasets: [{
                label: 'Índice de Salud',
                data: ranking.map(e => e.indiceSalud),
                backgroundColor: 'rgba(16, 185, 129, 0.8)'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const ej = ranking[context.dataIndex];
                            return 'Salud: ' + ej.indiceSalud.toLocaleString('es-CL') + ' (NAP: ' + ej.nap.toLocaleString('es-CL') + ' UF, IR: ' + ej.ir.toFixed(1) + '%)';
                        }
                    }
                }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

function createAlertasEjecutivos() {
    const container = document.getElementById('alertasEjecutivos');
    if (!container) return;
    
    const ejecutivos = {};
    allData.forEach(d => {
        if (!ejecutivos[d.ejecutivo]) {
            ejecutivos[d.ejecutivo] = { ir: [], nap: 0, negocios: 0, meses: new Set(), equipo: d.equipo };
        }
        if (d.ir > 0) ejecutivos[d.ejecutivo].ir.push(d.ir);
        ejecutivos[d.ejecutivo].nap += d.nap;
        ejecutivos[d.ejecutivo].negocios += d.negocios;
        ejecutivos[d.ejecutivo].meses.add(d.mes);
    });
    
    const alertas = [];
    Object.keys(ejecutivos).forEach(ejecutivo => {
        const data = ejecutivos[ejecutivo];
        if (data.ir.length > 0) {
            const irPromedio = data.ir.reduce((a, b) => a + b, 0) / data.ir.length;
            // Solo mostrar ejecutivos con IR <80% (Persistencia R4)
            if (irPromedio < 80) {
                const cantidadMeses = data.meses.size;
                const napPromedio = cantidadMeses > 0 ? data.nap / cantidadMeses : 0;
                const negociosPromedio = cantidadMeses > 0 ? data.negocios / cantidadMeses : 0;
                let categoria = 'R4';
                let color = 'critical';
                
                alertas.push({
                    ejecutivo: ejecutivo,
                    ir: irPromedio,
                    napPromedio: napPromedio,
                    negociosPromedio: negociosPromedio,
                    equipo: data.equipo,
                    categoria: categoria,
                    color: color
                });
            }
        }
    });
    
    alertas.sort((a, b) => a.ir - b.ir);
    
    if (alertas.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--success-color); padding: 40px;"><i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 10px;"></i><br>No hay ejecutivos en Persistencia R4</p>';
        return;
    }
    
    container.innerHTML = alertas.map(alerta => `
        <div class="alert-item ${alerta.color}">
            <i class="fas fa-exclamation-triangle"></i>
            <div class="alert-content">
                <h4>${alerta.ejecutivo} - ${alerta.equipo}</h4>
                <p><strong>Persistencia ${alerta.categoria}:</strong> ${alerta.ir.toFixed(1)}% (Esperado: ≥80%)</p>
                <div class="alert-metrics">
                    <span class="alert-metric"><strong>NAP Promedio:</strong> ${alerta.napPromedio.toLocaleString('es-CL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} UF/mes</span>
                    <span class="alert-metric"><strong>Negocios Promedio:</strong> ${alerta.negociosPromedio.toFixed(1)}/mes</span>
                </div>
                <div class="alert-metrics" style="margin-top: 4px;">
                    <span class="alert-metric"><strong>Acción:</strong> Revisar proceso de venta</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================
// VISTA OPERATIVA
// ============================================

function updateVistaOperativo() {
    const equipoSeleccionado = document.getElementById('equipoFilterOp').value;
    
    if (equipoSeleccionado === 'all') {
        document.getElementById('tablaEquipoBody').innerHTML = '<tr><td colspan="7" class="loading">Seleccione un equipo específico</td></tr>';
        document.getElementById('coordinadorEquipo_op').textContent = '-';
        return;
    }
    
    const datosEquipo = allData.filter(d => d.equipo === equipoSeleccionado);
    const napEquipo = datosEquipo.reduce((sum, d) => sum + d.nap, 0);
    const datosConIR = datosEquipo.filter(d => d.ir > 0);
    const irEquipo = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    const ejecutivosEnEquipo = [...new Set(datosEquipo.map(d => d.ejecutivo))].length;
    
    // Obtener coordinador del equipo
    const coordinadorEquipo = datosEquipo.length > 0 ? datosEquipo[0].coordinador : '-';
    
    document.getElementById('napEquipo_op').textContent = napEquipo.toLocaleString('es-CL') + ' UF';
    document.getElementById('irEquipo_op').textContent = irEquipo.toFixed(1) + '%';
    document.getElementById('ejecutivosEquipo_op').textContent = ejecutivosEnEquipo;
    document.getElementById('coordinadorEquipo_op').textContent = coordinadorEquipo || 'Sin asignar';
    
    // Crear gráficos
    createDesempenoEquipoChart(datosEquipo);
    createEvolucionEquipoChart(datosEquipo);
    createDistribucionEquipoChart(datosEquipo);
    
    const ejecutivos = {};
    datosEquipo.forEach(d => {
        if (!ejecutivos[d.ejecutivo]) {
            ejecutivos[d.ejecutivo] = {
                clinica: d.clinica,
                nap: 0,
                ir: [],
                negocios: 0
            };
        }
        ejecutivos[d.ejecutivo].nap += d.nap;
        if (d.ir > 0) ejecutivos[d.ejecutivo].ir.push(d.ir);
        ejecutivos[d.ejecutivo].negocios += d.negocios;
    });
    
    const tbody = document.getElementById('tablaEquipoBody');
    tbody.innerHTML = Object.keys(ejecutivos).sort().map(ejecutivo => {
        const data = ejecutivos[ejecutivo];
        const irPromedio = data.ir.length > 0 
            ? data.ir.reduce((a, b) => a + b, 0) / data.ir.length 
            : 0;
        const napPorNegocio = data.negocios > 0 ? data.nap / data.negocios : 0;
        const indiceSalud = (data.nap * irPromedio) / 100;
        
        return `
            <tr>
                <td>${ejecutivo}</td>
                <td>${data.clinica}</td>
                <td>${data.nap.toLocaleString('es-CL')} UF</td>
                <td>${irPromedio.toFixed(1)}%</td>
                <td>${data.negocios}</td>
                <td>${napPorNegocio.toFixed(2)} UF</td>
                <td>${indiceSalud.toLocaleString('es-CL')}</td>
            </tr>
        `;
    }).join('');
}

function createDesempenoEquipoChart(datosEquipo) {
    const ctx = document.getElementById('desempenoEquipoChart');
    if (!ctx) return;
    
    // Agrupar por ejecutivo
    const ejecutivos = {};
    datosEquipo.forEach(d => {
        if (!ejecutivos[d.ejecutivo]) {
            ejecutivos[d.ejecutivo] = { nap: 0, ir: [], negocios: 0 };
        }
        ejecutivos[d.ejecutivo].nap += d.nap;
        if (d.ir > 0) ejecutivos[d.ejecutivo].ir.push(d.ir);
        ejecutivos[d.ejecutivo].negocios += d.negocios;
    });
    
    const labels = Object.keys(ejecutivos).sort();
    const napData = labels.map(ej => ejecutivos[ej].nap);
    const irData = labels.map(ej => {
        const irs = ejecutivos[ej].ir;
        return irs.length > 0 ? irs.reduce((a,b) => a+b, 0) / irs.length : 0;
    });
    
    if (charts.desempenoEquipo) charts.desempenoEquipo.destroy();
    
    charts.desempenoEquipo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'NAP Total',
                    data: napData,
                    backgroundColor: 'rgba(37, 99, 235, 0.8)',
                    yAxisID: 'y'
                },
                {
                    label: 'IR Promedio (%)',
                    data: irData,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'NAP (UF)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    max: 100,
                    title: { display: true, text: 'IR (%)' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function createEvolucionEquipoChart(datosEquipo) {
    const ctx = document.getElementById('evolucionEquipoChart');
    if (!ctx) return;
    
    const ordenMeses = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    
    const napPorMes = ordenMeses.map(mes => {
        const datosMes = datosEquipo.filter(d => d.mes === mes);
        return datosMes.reduce((sum, d) => sum + d.nap, 0);
    });
    
    const irPorMes = ordenMeses.map(mes => {
        const datosMes = datosEquipo.filter(d => d.mes === mes && d.ir > 0);
        return datosMes.length > 0 
            ? datosMes.reduce((sum, d) => sum + d.ir, 0) / datosMes.length 
            : null;
    });
    
    if (charts.evolucionEquipo) charts.evolucionEquipo.destroy();
    
    charts.evolucionEquipo = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ordenMeses,
            datasets: [
                {
                    label: 'NAP Total',
                    data: napPorMes,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4
                },
                {
                    label: 'IR Promedio',
                    data: irPorMes,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'NAP (UF)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    max: 100,
                    title: { display: true, text: 'IR (%)' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function createDistribucionEquipoChart(datosEquipo) {
    const ctx = document.getElementById('distribucionEquipoChart');
    if (!ctx) return;
    
    // Calcular NAP promedio del equipo
    const ejecutivos = {};
    datosEquipo.forEach(d => {
        if (!ejecutivos[d.ejecutivo]) {
            ejecutivos[d.ejecutivo] = { nap: 0 };
        }
        ejecutivos[d.ejecutivo].nap += d.nap;
    });
    
    const naps = Object.values(ejecutivos).map(e => e.nap);
    const promedio = naps.reduce((a, b) => a + b, 0) / naps.length;
    
    // Categorizar
    let alto = 0, medio = 0, bajo = 0;
    naps.forEach(nap => {
        if (nap > promedio * 1.2) alto++;
        else if (nap < promedio * 0.8) bajo++;
        else medio++;
    });
    
    if (charts.distribucionEquipo) charts.distribucionEquipo.destroy();
    
    charts.distribucionEquipo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Alto Desempeño', 'Desempeño Normal', 'Bajo Desempeño'],
            datasets: [{
                data: [alto, medio, bajo],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// ============================================
// VISTA INDIVIDUAL
// ============================================

function updateVistaIndividual() {
    const ejecutivoSeleccionado = document.getElementById('ejecutivoFilterInd').value;
    
    if (!ejecutivoSeleccionado) {
        document.getElementById('objetivosPersonales').innerHTML = '<p class="loading">Seleccione un ejecutivo</p>';
        document.getElementById('coordinadorPersonal_ind').textContent = '-';
        return;
    }
    
    const datosEjecutivo = allData.filter(d => d.ejecutivo === ejecutivoSeleccionado);
    const napPersonal = datosEjecutivo.reduce((sum, d) => sum + d.nap, 0);
    const datosConIR = datosEjecutivo.filter(d => d.ir > 0);
    const irPersonal = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    const negociosPersonal = datosEjecutivo.reduce((sum, d) => sum + d.negocios, 0);
    
    // Obtener coordinador personal
    const coordinadorPersonal = datosEjecutivo.length > 0 ? datosEjecutivo[0].coordinador : '-';
    
    const napPromedioGeneral = allData.reduce((sum, d) => sum + d.nap, 0) / [...new Set(allData.map(d => d.ejecutivo))].length;
    const datosGeneralConIR = allData.filter(d => d.ir > 0);
    const irPromedioGeneral = datosGeneralConIR.length > 0 
        ? datosGeneralConIR.reduce((sum, d) => sum + d.ir, 0) / datosGeneralConIR.length 
        : 0;
    
    document.getElementById('napPersonal_ind').textContent = napPersonal.toLocaleString('es-CL') + ' UF';
    document.getElementById('irPersonal_ind').textContent = irPersonal.toFixed(1) + '%';
    document.getElementById('negociosPersonal_ind').textContent = negociosPersonal;
    document.getElementById('coordinadorPersonal_ind').textContent = coordinadorPersonal || 'Sin asignar';
    
    const napDiff = ((napPersonal - napPromedioGeneral) / napPromedioGeneral * 100);
    const irDiff = irPersonal - irPromedioGeneral;
    
    document.getElementById('napCompare_ind').innerHTML = napDiff > 0 
        ? `<i class="fas fa-arrow-up"></i> ${napDiff.toFixed(1)}% vs promedio`
        : `<i class="fas fa-arrow-down"></i> ${Math.abs(napDiff).toFixed(1)}% vs promedio`;
    document.getElementById('napCompare_ind').className = napDiff > 0 ? 'kpi-compare positive' : 'kpi-compare negative';
    
    document.getElementById('irCompare_ind').innerHTML = irDiff > 0 
        ? `<i class="fas fa-arrow-up"></i> ${irDiff.toFixed(1)}% vs promedio`
        : `<i class="fas fa-arrow-down"></i> ${Math.abs(irDiff).toFixed(1)}% vs promedio`;
    document.getElementById('irCompare_ind').className = irDiff > 0 ? 'kpi-compare positive' : 'kpi-compare negative';
    
    // Crear gráficos
    createEvolucionPersonalChart(datosEjecutivo);
    createComparacionEquipoChart(datosEjecutivo, napPersonal, irPersonal, negociosPersonal);
    createDesempenoMensualChart(datosEjecutivo);
    
    const metaNAP = 500;
    const cumplimientoNAP = (napPersonal / metaNAP) * 100;
    
    document.getElementById('objetivosPersonales').innerHTML = `
        <div class="objetivo-item">
            <div class="objetivo-header">
                <h4>Meta NAP Total</h4>
                <span class="objetivo-badge ${cumplimientoNAP >= 100 ? 'success' : cumplimientoNAP >= 70 ? 'warning' : 'danger'}">
                    ${cumplimientoNAP.toFixed(0)}% Completado
                </span>
            </div>
            <div class="objetivo-progress">
                <div class="objetivo-progress-bar ${cumplimientoNAP >= 100 ? 'success' : cumplimientoNAP >= 70 ? 'warning' : ''}" 
                     style="width: ${Math.min(cumplimientoNAP, 100)}%"></div>
            </div>
            <div class="objetivo-details">
                <span>Logrado: ${napPersonal.toLocaleString('es-CL')} UF</span>
                <span>Meta: ${metaNAP.toLocaleString('es-CL')} UF</span>
            </div>
        </div>
        <div class="objetivo-item">
            <div class="objetivo-header">
                <h4>Meta IR Mínimo (70%)</h4>
                <span class="objetivo-badge ${irPersonal >= 70 ? 'success' : 'danger'}">
                    ${irPersonal >= 70 ? 'Cumplido' : 'Por Mejorar'}
                </span>
            </div>
            <div class="objetivo-progress">
                <div class="objetivo-progress-bar ${irPersonal >= 70 ? 'success' : ''}" 
                     style="width: ${Math.min((irPersonal / 70) * 100, 100)}%"></div>
            </div>
            <div class="objetivo-details">
                <span>IR Actual: ${irPersonal.toFixed(1)}%</span>
                <span>Meta: 70%</span>
            </div>
        </div>
    `;
}

function createEvolucionPersonalChart(datosEjecutivo) {
    const ctx = document.getElementById('evolucionPersonalChart');
    if (!ctx) return;
    
    const ordenMeses = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    
    const napPorMes = ordenMeses.map(mes => {
        const datosMes = datosEjecutivo.filter(d => d.mes === mes);
        return datosMes.reduce((sum, d) => sum + d.nap, 0);
    });
    
    const irPorMes = ordenMeses.map(mes => {
        const datosMes = datosEjecutivo.filter(d => d.mes === mes && d.ir > 0);
        return datosMes.length > 0 
            ? datosMes.reduce((sum, d) => sum + d.ir, 0) / datosMes.length 
            : null;
    });
    
    if (charts.evolucionPersonal) charts.evolucionPersonal.destroy();
    
    charts.evolucionPersonal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ordenMeses,
            datasets: [
                {
                    label: 'Mi NAP',
                    data: napPorMes,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Mi IR (%)',
                    data: irPorMes,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    title: { display: true, text: 'NAP (UF)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    max: 100,
                    title: { display: true, text: 'IR (%)' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function createComparacionEquipoChart(datosEjecutivo, napPersonal, irPersonal, negociosPersonal) {
    const ctx = document.getElementById('comparacionEquipoChart');
    if (!ctx) return;
    
    // Calcular promedios del equipo
    const equipoEjecutivo = datosEjecutivo[0]?.equipo;
    const datosEquipo = allData.filter(d => d.equipo === equipoEjecutivo && d.ejecutivo !== datosEjecutivo[0]?.ejecutivo);
    
    const ejecutivosEquipo = {};
    datosEquipo.forEach(d => {
        if (!ejecutivosEquipo[d.ejecutivo]) {
            ejecutivosEquipo[d.ejecutivo] = { nap: 0, ir: [], negocios: 0 };
        }
        ejecutivosEquipo[d.ejecutivo].nap += d.nap;
        if (d.ir > 0) ejecutivosEquipo[d.ejecutivo].ir.push(d.ir);
        ejecutivosEquipo[d.ejecutivo].negocios += d.negocios;
    });
    
    const cantidadEjecutivos = Object.keys(ejecutivosEquipo).length;
    const napPromedioEquipo = Object.values(ejecutivosEquipo).reduce((sum, e) => sum + e.nap, 0) / cantidadEjecutivos;
    const irPromedioEquipo = Object.values(ejecutivosEquipo).reduce((sum, e) => {
        const ir = e.ir.length > 0 ? e.ir.reduce((a,b) => a+b, 0) / e.ir.length : 0;
        return sum + ir;
    }, 0) / cantidadEjecutivos;
    const negociosPromedioEquipo = Object.values(ejecutivosEquipo).reduce((sum, e) => sum + e.negocios, 0) / cantidadEjecutivos;
    
    if (charts.comparacionEquipo) charts.comparacionEquipo.destroy();
    
    charts.comparacionEquipo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['NAP Total', 'IR Promedio', 'Total Negocios'],
            datasets: [
                {
                    label: 'Yo',
                    data: [napPersonal, irPersonal, negociosPersonal],
                    backgroundColor: 'rgba(37, 99, 235, 0.8)'
                },
                {
                    label: 'Promedio del Equipo',
                    data: [napPromedioEquipo, irPromedioEquipo, negociosPromedioEquipo],
                    backgroundColor: 'rgba(156, 163, 175, 0.8)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createDesempenoMensualChart(datosEjecutivo) {
    const ctx = document.getElementById('desempenoMensualChart');
    if (!ctx) return;
    
    const ordenMeses = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    
    const napPorMes = ordenMeses.map(mes => {
        const datosMes = datosEjecutivo.filter(d => d.mes === mes);
        return datosMes.reduce((sum, d) => sum + d.nap, 0);
    });
    
    const negociosPorMes = ordenMeses.map(mes => {
        const datosMes = datosEjecutivo.filter(d => d.mes === mes);
        return datosMes.reduce((sum, d) => sum + d.negocios, 0);
    });
    
    if (charts.desempenoMensual) charts.desempenoMensual.destroy();
    
    charts.desempenoMensual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ordenMeses,
            datasets: [
                {
                    label: 'NAP',
                    data: napPorMes,
                    backgroundColor: 'rgba(37, 99, 235, 0.8)'
                },
                {
                    label: 'Negocios',
                    data: negociosPorMes,
                    backgroundColor: 'rgba(245, 158, 11, 0.8)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function updateCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date().toLocaleDateString('es-ES', options);
    document.getElementById('currentDate').textContent = date;
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}