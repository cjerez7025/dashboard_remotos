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
                equipo: cells[2]?.v || '',
                ir: parseFloat(cells[3]?.v) || 0,
                nap: parseFloat(cells[4]?.v) || 0,
                negocios: parseFloat(cells[5]?.v) || 0,
                mes: cells[6]?.v || '',
                ano: cells[7]?.v || 2025
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
    const totalNegocios = allData.reduce((sum, d) => sum + d.negocios, 0);
    const ejecutivosUnicos = [...new Set(allData.map(d => d.ejecutivo))];
    
    const datosConIR = allData.filter(d => d.ir > 0);
    const irPromedio = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    
    const napPorNegocio = totalNegocios > 0 ? totalNAP / totalNegocios : 0;
    
    document.getElementById('totalNAP_exec').textContent = '$' + (totalNAP / 1000).toFixed(1) + 'K';
    document.getElementById('irPromedio_exec').textContent = irPromedio.toFixed(1) + '%';
    document.getElementById('napPorNegocio_exec').textContent = '$' + napPorNegocio.toFixed(2);
    document.getElementById('totalEjecutivos_exec').textContent = ejecutivosUnicos.length;
    
    createEvolucionIRChart();
    createMatrizNAPvsIRChart();
    createTopSaludChart();
    createIRPorClinicaChart();
    createAlertasEjecutivos();
}

function createEvolucionIRChart() {
    const ctx = document.getElementById('evolucionIRChart');
    if (!ctx) return;
    
    const ordenMeses = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const equipos = [...new Set(allData.map(d => d.equipo))].sort();
    
    const datasets = equipos.map((equipo, index) => {
        const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
        const color = colors[index % colors.length];
        
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
            backgroundColor: color + '20',
            fill: false,
            tension: 0.4,
            pointRadius: 4
        };
    });
    
    if (charts.evolucionIR) charts.evolucionIR.destroy();
    
    charts.evolucionIR = new Chart(ctx, {
        type: 'line',
        data: { labels: ordenMeses, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'IR (%)' }
                }
            }
        }
    });
}

function createMatrizNAPvsIRChart() {
    const ctx = document.getElementById('matrizNAPvsIRChart');
    if (!ctx) return;
    
    const ejecutivos = {};
    allData.forEach(d => {
        if (!ejecutivos[d.ejecutivo]) {
            ejecutivos[d.ejecutivo] = { nap: 0, ir: [], count: 0 };
        }
        ejecutivos[d.ejecutivo].nap += d.nap;
        if (d.ir > 0) ejecutivos[d.ejecutivo].ir.push(d.ir);
        ejecutivos[d.ejecutivo].count++;
    });
    
    const scatterData = Object.keys(ejecutivos).map(ejecutivo => {
        const data = ejecutivos[ejecutivo];
        const irPromedio = data.ir.length > 0 
            ? data.ir.reduce((a, b) => a + b, 0) / data.ir.length 
            : 0;
        
        return {
            x: data.nap,
            y: irPromedio,
            label: ejecutivo
        };
    }).filter(d => d.y > 0);
    
    if (charts.matrizNAPvsIR) charts.matrizNAPvsIR.destroy();
    
    charts.matrizNAPvsIR = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Ejecutivos',
                data: scatterData,
                backgroundColor: 'rgba(37, 99, 235, 0.6)',
                borderColor: 'rgba(37, 99, 235, 1)',
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const punto = scatterData[context.dataIndex];
                            return punto.label + ': NAP $' + punto.x.toFixed(0) + ', IR ' + punto.y.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'NAP Total' } },
                y: { 
                    title: { display: true, text: 'IR Promedio (%)' },
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
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
                            return 'Salud: ' + ej.indiceSalud.toFixed(0) + ' (NAP: $' + ej.nap.toFixed(0) + ', IR: ' + ej.ir.toFixed(1) + '%)';
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

function createIRPorClinicaChart() {
    const ctx = document.getElementById('irPorClinicaChart');
    if (!ctx) return;
    
    const clinicas = {};
    allData.forEach(d => {
        if (!clinicas[d.clinica]) {
            clinicas[d.clinica] = { ir: [] };
        }
        if (d.ir > 0) clinicas[d.clinica].ir.push(d.ir);
    });
    
    const labels = Object.keys(clinicas).sort();
    const data = labels.map(clinica => {
        const irs = clinicas[clinica].ir;
        return irs.length > 0 ? irs.reduce((a, b) => a + b, 0) / irs.length : 0;
    });
    
    if (charts.irPorClinica) charts.irPorClinica.destroy();
    
    charts.irPorClinica = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'IR Promedio',
                data: data,
                backgroundColor: data.map(ir => 
                    ir >= 80 ? 'rgba(16, 185, 129, 0.8)' :
                    ir >= 60 ? 'rgba(245, 158, 11, 0.8)' :
                    'rgba(239, 68, 68, 0.8)'
                )
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'IR (%)' }
                }
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
            ejecutivos[d.ejecutivo] = { ir: [], nap: 0, equipo: d.equipo };
        }
        if (d.ir > 0) ejecutivos[d.ejecutivo].ir.push(d.ir);
        ejecutivos[d.ejecutivo].nap += d.nap;
    });
    
    const alertas = [];
    Object.keys(ejecutivos).forEach(ejecutivo => {
        const data = ejecutivos[ejecutivo];
        if (data.ir.length > 0) {
            const irPromedio = data.ir.reduce((a, b) => a + b, 0) / data.ir.length;
            if (irPromedio < 70) {
                alertas.push({
                    ejecutivo: ejecutivo,
                    ir: irPromedio,
                    nap: data.nap,
                    equipo: data.equipo,
                    riesgo: (data.nap * (100 - irPromedio)) / 100
                });
            }
        }
    });
    
    alertas.sort((a, b) => a.ir - b.ir);
    
    if (alertas.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--success-color); padding: 40px;"><i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 10px;"></i><br>No hay ejecutivos que requieran atención</p>';
        return;
    }
    
    container.innerHTML = alertas.map(alerta => `
        <div class="alert-item ${alerta.ir < 60 ? '' : 'warning'}">
            <i class="fas fa-exclamation-triangle"></i>
            <div class="alert-content">
                <h4>${alerta.ejecutivo} - ${alerta.equipo}</h4>
                <p>IR Crítico: ${alerta.ir.toFixed(1)}% | Monto en riesgo: $${alerta.riesgo.toFixed(0)}</p>
                <div class="alert-metrics">
                    <span class="alert-metric"><strong>NAP Total:</strong> $${alerta.nap.toFixed(0)}</span>
                    <span class="alert-metric"><strong>Acción:</strong> Seguimiento urgente</span>
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
        return;
    }
    
    const datosEquipo = allData.filter(d => d.equipo === equipoSeleccionado);
    const napEquipo = datosEquipo.reduce((sum, d) => sum + d.nap, 0);
    const datosConIR = datosEquipo.filter(d => d.ir > 0);
    const irEquipo = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    const ejecutivosEnEquipo = [...new Set(datosEquipo.map(d => d.ejecutivo))].length;
    
    document.getElementById('napEquipo_op').textContent = '$' + (napEquipo / 1000).toFixed(1) + 'K';
    document.getElementById('irEquipo_op').textContent = irEquipo.toFixed(1) + '%';
    document.getElementById('ejecutivosEquipo_op').textContent = ejecutivosEnEquipo;
    document.getElementById('rankingEquipo_op').textContent = 'Top 3';
    
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
                <td>$${data.nap.toFixed(0)}</td>
                <td>${irPromedio.toFixed(1)}%</td>
                <td>${data.negocios}</td>
                <td>$${napPorNegocio.toFixed(2)}</td>
                <td>${indiceSalud.toFixed(0)}</td>
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
                    title: { display: true, text: 'NAP' }
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
                    title: { display: true, text: 'NAP' }
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
        return;
    }
    
    const datosEjecutivo = allData.filter(d => d.ejecutivo === ejecutivoSeleccionado);
    const napPersonal = datosEjecutivo.reduce((sum, d) => sum + d.nap, 0);
    const datosConIR = datosEjecutivo.filter(d => d.ir > 0);
    const irPersonal = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    const negociosPersonal = datosEjecutivo.reduce((sum, d) => sum + d.negocios, 0);
    
    const napPromedioGeneral = allData.reduce((sum, d) => sum + d.nap, 0) / [...new Set(allData.map(d => d.ejecutivo))].length;
    const datosGeneralConIR = allData.filter(d => d.ir > 0);
    const irPromedioGeneral = datosGeneralConIR.length > 0 
        ? datosGeneralConIR.reduce((sum, d) => sum + d.ir, 0) / datosGeneralConIR.length 
        : 0;
    
    document.getElementById('napPersonal_ind').textContent = '$' + (napPersonal / 1000).toFixed(1) + 'K';
    document.getElementById('irPersonal_ind').textContent = irPersonal.toFixed(1) + '%';
    document.getElementById('negociosPersonal_ind').textContent = negociosPersonal;
    document.getElementById('rankingPersonal_ind').textContent = '#5';
    
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
                <span>Logrado: $${napPersonal.toFixed(0)}</span>
                <span>Meta: $${metaNAP.toFixed(0)}</span>
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
                    title: { display: true, text: 'NAP' }
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
    }// ============================================
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
                equipo: cells[2]?.v || '',
                ir: parseFloat(cells[3]?.v) || 0,
                nap: parseFloat(cells[4]?.v) || 0,
                negocios: parseFloat(cells[5]?.v) || 0,
                mes: cells[6]?.v || '',
                ano: cells[7]?.v || 2025
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
    const totalNegocios = allData.reduce((sum, d) => sum + d.negocios, 0);
    const ejecutivosUnicos = [...new Set(allData.map(d => d.ejecutivo))];
    
    const datosConIR = allData.filter(d => d.ir > 0);
    const irPromedio = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    
    const napPorNegocio = totalNegocios > 0 ? totalNAP / totalNegocios : 0;
    
    document.getElementById('totalNAP_exec').textContent = totalNAP.toLocaleString('es-CL') + ' UF';
    document.getElementById('irPromedio_exec').textContent = irPromedio.toFixed(1) + '%';
    document.getElementById('napPorNegocio_exec').textContent = napPorNegocio.toFixed(2) + ' UF';
    document.getElementById('totalEjecutivos_exec').textContent = ejecutivosUnicos.length;
    
    createEvolucionIRChart();
    createMatrizNAPvsIRChart();
    createTopSaludChart();
    createIRPorClinicaChart();
    createAlertasEjecutivos();
}

function createEvolucionIRChart() {
    const ctx = document.getElementById('evolucionIRChart');
    if (!ctx) return;
    
    const ordenMeses = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const equipos = [...new Set(allData.map(d => d.equipo))].sort();
    
    const datasets = equipos.map((equipo, index) => {
        const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
        const color = colors[index % colors.length];
        
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
            backgroundColor: color + '20',
            fill: false,
            tension: 0.4,
            pointRadius: 4
        };
    });
    
    if (charts.evolucionIR) charts.evolucionIR.destroy();
    
    charts.evolucionIR = new Chart(ctx, {
        type: 'line',
        data: { labels: ordenMeses, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (context) => context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'IR (%)' }
                }
            }
        }
    });
}

function createMatrizNAPvsIRChart() {
    const ctx = document.getElementById('matrizNAPvsIRChart');
    if (!ctx) return;
    
    const ejecutivos = {};
    allData.forEach(d => {
        if (!ejecutivos[d.ejecutivo]) {
            ejecutivos[d.ejecutivo] = { nap: 0, ir: [], count: 0 };
        }
        ejecutivos[d.ejecutivo].nap += d.nap;
        if (d.ir > 0) ejecutivos[d.ejecutivo].ir.push(d.ir);
        ejecutivos[d.ejecutivo].count++;
    });
    
    const scatterData = Object.keys(ejecutivos).map(ejecutivo => {
        const data = ejecutivos[ejecutivo];
        const irPromedio = data.ir.length > 0 
            ? data.ir.reduce((a, b) => a + b, 0) / data.ir.length 
            : 0;
        
        return {
            x: data.nap,
            y: irPromedio,
            label: ejecutivo
        };
    }).filter(d => d.y > 0);
    
    if (charts.matrizNAPvsIR) charts.matrizNAPvsIR.destroy();
    
    charts.matrizNAPvsIR = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Ejecutivos',
                data: scatterData,
                backgroundColor: 'rgba(37, 99, 235, 0.6)',
                borderColor: 'rgba(37, 99, 235, 1)',
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const punto = scatterData[context.dataIndex];
                            return punto.label + ': NAP ' + punto.x.toLocaleString('es-CL') + ' UF, IR ' + punto.y.toFixed(1) + '%';
                        }
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'NAP Total (UF)' } },
                y: { 
                    title: { display: true, text: 'IR Promedio (%)' },
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
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

function createIRPorClinicaChart() {
    const ctx = document.getElementById('irPorClinicaChart');
    if (!ctx) return;
    
    const clinicas = {};
    allData.forEach(d => {
        if (!clinicas[d.clinica]) {
            clinicas[d.clinica] = { ir: [] };
        }
        if (d.ir > 0) clinicas[d.clinica].ir.push(d.ir);
    });
    
    const labels = Object.keys(clinicas).sort();
    const data = labels.map(clinica => {
        const irs = clinicas[clinica].ir;
        return irs.length > 0 ? irs.reduce((a, b) => a + b, 0) / irs.length : 0;
    });
    
    if (charts.irPorClinica) charts.irPorClinica.destroy();
    
    charts.irPorClinica = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'IR Promedio',
                data: data,
                backgroundColor: data.map(ir => 
                    ir >= 80 ? 'rgba(16, 185, 129, 0.8)' :
                    ir >= 60 ? 'rgba(245, 158, 11, 0.8)' :
                    'rgba(239, 68, 68, 0.8)'
                )
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'IR (%)' }
                }
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
            ejecutivos[d.ejecutivo] = { ir: [], nap: 0, equipo: d.equipo };
        }
        if (d.ir > 0) ejecutivos[d.ejecutivo].ir.push(d.ir);
        ejecutivos[d.ejecutivo].nap += d.nap;
    });
    
    const alertas = [];
    Object.keys(ejecutivos).forEach(ejecutivo => {
        const data = ejecutivos[ejecutivo];
        if (data.ir.length > 0) {
            const irPromedio = data.ir.reduce((a, b) => a + b, 0) / data.ir.length;
            if (irPromedio < 70) {
                alertas.push({
                    ejecutivo: ejecutivo,
                    ir: irPromedio,
                    nap: data.nap,
                    equipo: data.equipo,
                    riesgo: (data.nap * (100 - irPromedio)) / 100
                });
            }
        }
    });
    
    alertas.sort((a, b) => a.ir - b.ir);
    
    if (alertas.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--success-color); padding: 40px;"><i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 10px;"></i><br>No hay ejecutivos que requieran atención</p>';
        return;
    }
    
    container.innerHTML = alertas.map(alerta => `
        <div class="alert-item ${alerta.ir < 60 ? '' : 'warning'}">
            <i class="fas fa-exclamation-triangle"></i>
            <div class="alert-content">
                <h4>${alerta.ejecutivo} - ${alerta.equipo}</h4>
                <p>IR Crítico: ${alerta.ir.toFixed(1)}% | Monto en riesgo: ${alerta.riesgo.toLocaleString('es-CL')} UF</p>
                <div class="alert-metrics">
                    <span class="alert-metric"><strong>NAP Total:</strong> ${alerta.nap.toLocaleString('es-CL')} UF</span>
                    <span class="alert-metric"><strong>Acción:</strong> Seguimiento urgente</span>
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
        return;
    }
    
    const datosEquipo = allData.filter(d => d.equipo === equipoSeleccionado);
    const napEquipo = datosEquipo.reduce((sum, d) => sum + d.nap, 0);
    const datosConIR = datosEquipo.filter(d => d.ir > 0);
    const irEquipo = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    const ejecutivosEnEquipo = [...new Set(datosEquipo.map(d => d.ejecutivo))].length;
    
    document.getElementById('napEquipo_op').textContent = napEquipo.toLocaleString('es-CL') + ' UF';
    document.getElementById('irEquipo_op').textContent = irEquipo.toFixed(1) + '%';
    document.getElementById('ejecutivosEquipo_op').textContent = ejecutivosEnEquipo;
    document.getElementById('rankingEquipo_op').textContent = 'Top 3';
    
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
        return;
    }
    
    const datosEjecutivo = allData.filter(d => d.ejecutivo === ejecutivoSeleccionado);
    const napPersonal = datosEjecutivo.reduce((sum, d) => sum + d.nap, 0);
    const datosConIR = datosEjecutivo.filter(d => d.ir > 0);
    const irPersonal = datosConIR.length > 0 
        ? datosConIR.reduce((sum, d) => sum + d.ir, 0) / datosConIR.length 
        : 0;
    const negociosPersonal = datosEjecutivo.reduce((sum, d) => sum + d.negocios, 0);
    
    const napPromedioGeneral = allData.reduce((sum, d) => sum + d.nap, 0) / [...new Set(allData.map(d => d.ejecutivo))].length;
    const datosGeneralConIR = allData.filter(d => d.ir > 0);
    const irPromedioGeneral = datosGeneralConIR.length > 0 
        ? datosGeneralConIR.reduce((sum, d) => sum + d.ir, 0) / datosGeneralConIR.length 
        : 0;
    
    document.getElementById('napPersonal_ind').textContent = napPersonal.toLocaleString('es-CL') + ' UF';
    document.getElementById('irPersonal_ind').textContent = irPersonal.toFixed(1) + '%';
    document.getElementById('negociosPersonal_ind').textContent = negociosPersonal;
    document.getElementById('rankingPersonal_ind').textContent = '#5';
    
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
}