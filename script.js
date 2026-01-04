// ============================================
// CONFIGURACIÓN - ACTUALIZA ESTOS VALORES
// ============================================

// ID de tu Google Sheet (lo sacas de la URL)
// URL ejemplo: https://docs.google.com/spreadsheets/d/1FZFaRjqsVXzJODPo5Qa3stKoW66Dy0pS0_plLCw_Y5U/edit
const SHEET_ID = '1FZFaRjqsVXzJODPo5Qa3stKoW66Dy0pS0_plLCw_Y5U';
const SHEET_NAME = 'Resumen'; // Nombre de la hoja

// ============================================
// VARIABLES GLOBALES
// ============================================
let allData = [];
let charts = {};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    updateCurrentDate();
    loadData();
    
    // Event listener para búsqueda en tabla
    document.getElementById('searchTable').addEventListener('input', filterTable);
});

// ============================================
// FUNCIONES DE CARGA DE DATOS
// ============================================

async function loadData() {
    showLoading(true);
    
    try {
        // URL para leer la hoja pública de Google Sheets
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
        
        const response = await fetch(url);
        const text = await response.text();
        
        // Parsear respuesta (Google retorna JSONP, necesitamos extraer el JSON)
        const json = JSON.parse(text.substr(47).slice(0, -2));
        
        // Procesar datos
        allData = processGoogleSheetData(json);
        
        // Actualizar dashboard
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
        if (cells && cells[0] && cells[0].v) { // Verificar que haya datos
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

// ============================================
// ACTUALIZACIÓN DEL DASHBOARD
// ============================================

function updateDashboard() {
    updateKPIs();
    populateFilters();
    createCharts();
    updateTable();
}

function updateKPIs() {
    // Total Ejecutivos únicos
    const ejecutivosUnicos = [...new Set(allData.map(d => d.ejecutivo))];
    document.getElementById('totalEjecutivos').textContent = ejecutivosUnicos.length;
    
    // NAP Promedio
    const napPromedio = allData.reduce((sum, d) => sum + d.nap, 0) / allData.length;
    document.getElementById('totalNAP').textContent = napPromedio.toFixed(2);
    
    // Total Negocios
    const totalNegocios = allData.reduce((sum, d) => sum + d.negocios, 0);
    document.getElementById('totalNegocios').textContent = totalNegocios.toLocaleString();
    
    // Total Clínicas
    const clinicasUnicas = [...new Set(allData.map(d => d.clinica))];
    document.getElementById('totalClinicas').textContent = clinicasUnicas.length;
}

function populateFilters() {
    // Obtener valores únicos
    const equipos = [...new Set(allData.map(d => d.equipo))].sort();
    const clinicas = [...new Set(allData.map(d => d.clinica))].sort();
    const meses = [...new Set(allData.map(d => d.mes))];
    
    // Orden correcto de meses
    const ordenMeses = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const mesesOrdenados = ordenMeses.filter(m => meses.includes(m));
    
    // Poblar selectores de equipo
    const equipoSelects = ['equipoFilterTendencia', 'equipoFilterScatter', 'equipoFilterTable'];
    equipoSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        equipos.forEach(equipo => {
            const option = document.createElement('option');
            option.value = equipo;
            option.textContent = equipo;
            select.appendChild(option);
        });
    });
    
    // Poblar selector de clínicas
    const clinicaSelect = document.getElementById('clinicaFilterTable');
    clinicas.forEach(clinica => {
        const option = document.createElement('option');
        option.value = clinica;
        option.textContent = clinica;
        clinicaSelect.appendChild(option);
    });
    
    // Poblar selector de mes
    const mesSelect = document.getElementById('mesFilterTop');
    mesesOrdenados.forEach(mes => {
        const option = document.createElement('option');
        option.value = mes;
        option.textContent = mes;
        mesSelect.appendChild(option);
    });
}

// ============================================
// CREACIÓN DE GRÁFICOS
// ============================================

function createCharts() {
    createTendenciaMensualChart();
    createTopEjecutivosChart();
    createComparacionEquiposChart();
    createDistribucionClinicasChart();
    createNegociosVsNAPChart();
}

// Gráfico 1: Tendencia Mensual de NAP
function createTendenciaMensualChart() {
    const ctx = document.getElementById('tendenciaMensualChart').getContext('2d');
    
    const equipoFilter = document.getElementById('equipoFilterTendencia').value;
    const filteredData = equipoFilter === 'all' ? allData : allData.filter(d => d.equipo === equipoFilter);
    
    const ordenMeses = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    
    // Agrupar por mes
    const napPorMes = {};
    ordenMeses.forEach(mes => {
        const datosMes = filteredData.filter(d => d.mes === mes);
        napPorMes[mes] = datosMes.length > 0 
            ? datosMes.reduce((sum, d) => sum + d.nap, 0) / datosMes.length 
            : 0;
    });
    
    if (charts.tendenciaMensual) {
        charts.tendenciaMensual.destroy();
    }
    
    charts.tendenciaMensual = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ordenMeses,
            datasets: [{
                label: 'NAP Promedio',
                data: ordenMeses.map(mes => napPorMes[mes]),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 },
                    callbacks: {
                        label: function(context) {
                            return 'NAP: ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
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

// Gráfico 2: Top 10 Ejecutivos
function createTopEjecutivosChart() {
    const ctx = document.getElementById('topEjecutivosChart').getContext('2d');
    
    const mesFilter = document.getElementById('mesFilterTop').value;
    const filteredData = mesFilter === 'all' ? allData : allData.filter(d => d.mes === mesFilter);
    
    // Agrupar por ejecutivo
    const napPorEjecutivo = {};
    filteredData.forEach(d => {
        if (!napPorEjecutivo[d.ejecutivo]) {
            napPorEjecutivo[d.ejecutivo] = { total: 0, count: 0 };
        }
        napPorEjecutivo[d.ejecutivo].total += d.nap;
        napPorEjecutivo[d.ejecutivo].count++;
    });
    
    // Calcular promedio y ordenar
    const ejecutivos = Object.keys(napPorEjecutivo).map(ejecutivo => ({
        nombre: ejecutivo,
        napPromedio: napPorEjecutivo[ejecutivo].total / napPorEjecutivo[ejecutivo].count
    })).sort((a, b) => b.napPromedio - a.napPromedio).slice(0, 10);
    
    if (charts.topEjecutivos) {
        charts.topEjecutivos.destroy();
    }
    
    charts.topEjecutivos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ejecutivos.map(e => e.nombre),
            datasets: [{
                label: 'NAP Promedio',
                data: ejecutivos.map(e => e.napPromedio),
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Gráfico 3: Comparación por Equipo
function createComparacionEquiposChart() {
    const ctx = document.getElementById('comparacionEquiposChart').getContext('2d');
    
    // Agrupar por equipo
    const equipos = {};
    allData.forEach(d => {
        if (!equipos[d.equipo]) {
            equipos[d.equipo] = { nap: 0, negocios: 0, count: 0 };
        }
        equipos[d.equipo].nap += d.nap;
        equipos[d.equipo].negocios += d.negocios;
        equipos[d.equipo].count++;
    });
    
    const labels = Object.keys(equipos).sort();
    
    if (charts.comparacionEquipos) {
        charts.comparacionEquipos.destroy();
    }
    
    charts.comparacionEquipos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'NAP Promedio',
                    data: labels.map(e => equipos[e].nap / equipos[e].count),
                    backgroundColor: 'rgba(37, 99, 235, 0.8)',
                    borderColor: 'rgba(37, 99, 235, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Negocios Totales',
                    data: labels.map(e => equipos[e].negocios),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
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

// Gráfico 4: Distribución por Clínica
function createDistribucionClinicasChart() {
    const ctx = document.getElementById('distribucionClinicasChart').getContext('2d');
    
    // Contar registros por clínica
    const clinicas = {};
    allData.forEach(d => {
        clinicas[d.clinica] = (clinicas[d.clinica] || 0) + 1;
    });
    
    const labels = Object.keys(clinicas).sort();
    const colores = [
        '#2563eb',
        '#10b981',
        '#f59e0b',
        '#8b5cf6',
        '#ef4444',
        '#06b6d4'
    ];
    
    if (charts.distribucionClinicas) {
        charts.distribucionClinicas.destroy();
    }
    
    charts.distribucionClinicas = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: labels.map(c => clinicas[c]),
                backgroundColor: colores,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
}

// Gráfico 5: Negocios vs NAP (Scatter)
function createNegociosVsNAPChart() {
    const ctx = document.getElementById('negociosVsNAPChart').getContext('2d');
    
    const equipoFilter = document.getElementById('equipoFilterScatter').value;
    const filteredData = equipoFilter === 'all' ? allData : allData.filter(d => d.equipo === equipoFilter);
    
    if (charts.negociosVsNAP) {
        charts.negociosVsNAP.destroy();
    }
    
    charts.negociosVsNAP = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Ejecutivos',
                data: filteredData.map(d => ({
                    x: d.negocios,
                    y: d.nap
                })),
                backgroundColor: 'rgba(139, 92, 246, 0.6)',
                borderColor: 'rgba(139, 92, 246, 1)',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return 'Negocios: ' + context.parsed.x + ', NAP: ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Negocios'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'NAP'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

// ============================================
// FUNCIONES DE ACTUALIZACIÓN DE GRÁFICOS
// ============================================

function updateTendenciaMensual() {
    createTendenciaMensualChart();
}

function updateTopEjecutivos() {
    createTopEjecutivosChart();
}

function updateNegociosVsNAP() {
    createNegociosVsNAPChart();
}

// ============================================
// TABLA DE DATOS
// ============================================

function updateTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    allData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.clinica}</td>
            <td>${row.ejecutivo}</td>
            <td>${row.equipo}</td>
            <td>${row.mes}</td>
            <td>${row.nap.toFixed(2)}</td>
            <td>${row.negocios}</td>
            <td>${row.ir > 0 ? row.ir.toFixed(2) : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterTable() {
    const searchTerm = document.getElementById('searchTable').value.toLowerCase();
    const clinicaFilter = document.getElementById('clinicaFilterTable').value;
    const equipoFilter = document.getElementById('equipoFilterTable').value;
    
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    const filteredData = allData.filter(row => {
        const matchSearch = row.ejecutivo.toLowerCase().includes(searchTerm) ||
                          row.clinica.toLowerCase().includes(searchTerm);
        const matchClinica = clinicaFilter === 'all' || row.clinica === clinicaFilter;
        const matchEquipo = equipoFilter === 'all' || row.equipo === equipoFilter;
        
        return matchSearch && matchClinica && matchEquipo;
    });
    
    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.clinica}</td>
            <td>${row.ejecutivo}</td>
            <td>${row.equipo}</td>
            <td>${row.mes}</td>
            <td>${row.nap.toFixed(2)}</td>
            <td>${row.negocios}</td>
            <td>${row.ir > 0 ? row.ir.toFixed(2) : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function sortTable(columnIndex) {
    // Implementación simple de ordenamiento
    const table = document.getElementById('dataTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent;
        const bValue = b.cells[columnIndex].textContent;
        
        // Intentar convertir a número
        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
        }
        
        return aValue.localeCompare(bValue);
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
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