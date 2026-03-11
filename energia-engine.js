// ==============================================================================
// energia-engine.js - Motor Dedicado de Monitorização de Energia (Dying Gasp)
// Atualização: Modo "Agente Secreto" (Alarmes puros de energia desativados)
// ==============================================================================

const ENERGY_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENERGY_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENERGY_REFRESH_SECONDS = 300;

const TAB_CIRCUITOS_ENERGIA = 'CIRCUITO'; 

const ENERGY_OLT_COLUMN_MAP = {
    'HEL1':  1,  'HEL2':  3,  'MGP':   5,  'PQA1':  7,  'PSV1':  9,  'PSV7':  11,
    'SBO2':  13, 'SBO3':  15, 'SBO4':  17, 'SB1':   19, 'SB2':   21, 'SB3':   23,
    'PQA2':  25, 'PQA3':  27, 'LTXV2': 29, 'LTXV1': 31, 'SBO1':  33
};

const ENERGY_OLT_LIST = [
    { id: 'HEL-1', sheetTab: 'HEL1', type: 'nokia' },
    { id: 'HEL-2', sheetTab: 'HEL2', type: 'nokia' },
    { id: 'PQA-1', sheetTab: 'PQA1', type: 'nokia' },
    { id: 'PSV-1', sheetTab: 'PSV1', type: 'nokia' },
    { id: 'MGP',   sheetTab: 'MGP',  type: 'nokia' },
    { id: 'LTXV-1', sheetTab: 'LTXV1', type: 'furukawa-10' }, 
    { id: 'LTXV-2', sheetTab: 'LTXV2', type: 'furukawa-2' },
    { id: 'PQA-2',  sheetTab: 'PQA2',  type: 'furukawa-2' },
    { id: 'PQA-3',  sheetTab: 'PQA3',  type: 'furukawa-2' },
    { id: 'SB-1',   sheetTab: 'SB1',   type: 'furukawa-2' },
    { id: 'SB-2',   sheetTab: 'SB2',   type: 'furukawa-2' },
    { id: 'SB-3',   sheetTab: 'SB3',   type: 'furukawa-2' },
    { id: 'PSV-7',  sheetTab: 'PSV7',  type: 'furukawa-2' },
    { id: 'SBO-1',  sheetTab: 'SBO1',  type: 'furukawa-10' },
    { id: 'SBO-2',  sheetTab: 'SBO2',  type: 'furukawa-2' },
    { id: 'SBO-3',  sheetTab: 'SBO3',  type: 'furukawa-2' },
    { id: 'SBO-4',  sheetTab: 'SBO4',  type: 'furukawa-2' }
];

const HORIZONTAL_ENERGY_MAP = {
    'HEL-1': 0, 'HEL-2': 4, 'PQA-1': 8, 'PSV-1': 12, 'MGP': 16,
    'LTXV-1': 20, 'SBO-1': 24, 'LTXV-2': 28, 'PQA-2': 32, 'PQA-3': 36,
    'SB-1': 40, 'SB-2': 44, 'SB-3': 48, 'SBO-2': 52, 'SBO-3': 56,
    'SBO-4': 60, 'PSV-7': 64
};

window.ENERGY_DATA_STORE = {};
window.NETWORK_ENERGY_STORE = new Set(); // Mantido vazio para não dar erro em outras chamadas
let energyChartInstance = null; 

// ==============================================================================
// FUNÇÃO EXTRATORA UNIVERSAL DE PORTAS
// ==============================================================================
function extractPort(val) {
    if (!val) return null;
    let s = String(val).replace(/gpon/i, '').trim();
    let parts = s.split('/');
    if (parts.length >= 2) {
        let placa = parseInt(parts[parts.length - 2], 10);
        let porta = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(placa) && !isNaN(porta)) {
            return { placa: placa.toString(), porta: porta.toString() };
        }
    }
    return null;
}

function getEnergyCircuitInfo(rowsCircuitos, oltId, placa, porta, type) {
    const colIndex = ENERGY_OLT_COLUMN_MAP[oltId];
    if (colIndex === undefined) return "-";
    if (!rowsCircuitos || !rowsCircuitos.length) return "-";

    let rowIndex = -1;
    const p = parseInt(porta);
    const sl = parseInt(placa);

    if (type === 'nokia') rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
    else if (type === 'furukawa-2') rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
    else if (type === 'furukawa-10') rowIndex = ((sl - 1) * 4) + (p - 1) + 1;

    if (rowIndex > 0 && rowIndex < rowsCircuitos.length) {
        return rowsCircuitos[rowIndex][colIndex] || "-";
    }
    return "-";
}

// ==============================================================================
// FUNÇÕES GRÁFICAS E INTERFACE
// ==============================================================================

function drawEnergyChart(oltsData) {
    let chartData = [];
    for (const key in oltsData) {
        if (oltsData[key].powerOff > 0) {
            chartData.push({ label: key, value: oltsData[key].powerOff });
        }
    }

    if (chartData.length === 0) {
        chartData.push({ label: 'Nenhuma OLT', value: 0 });
    } else {
        chartData.sort((a, b) => b.value - a.value); 
    }

    const labels = chartData.map(item => item.label);
    const data = chartData.map(item => item.value);

    const ctx = document.getElementById('energyChartOlt');
    if (!ctx) return; 

    if (energyChartInstance) {
        energyChartInstance.destroy();
    }

    if (typeof Chart !== 'undefined') {
        energyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Clientes Offline (Energia)',
                    data: data,
                    backgroundColor: '#f87171',
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(47, 14, 81, 0.9)',
                        titleFont: { family: 'Montserrat', size: 14 },
                        bodyFont: { family: 'Roboto Mono', size: 13, weight: 'bold' },
                        padding: 10,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        grid: { color: 'rgba(255,255,255,0.05)' }, 
                        ticks: { color: '#CAC4D0', font: { family: 'Roboto Mono' } } 
                    },
                    x: { 
                        grid: { display: false }, 
                        ticks: { color: '#EADDFF', font: { family: 'Montserrat', weight: '600' } } 
                    }
                }
            }
        });
    }
}

function updateGlobalEnergyCard() {
    const globalData = window.ENERGY_DATA_STORE.global;
    const oltsData = window.ENERGY_DATA_STORE.olts;

    let cardBody = document.getElementById('global-poweroff-total')?.closest('.card-body');
    if (!cardBody) {
        const chartCanvas = document.getElementById('energyChartOlt');
        if (chartCanvas) cardBody = chartCanvas.closest('.card-body');
    }
    
    if (!cardBody) return; 

    let impactoPerc = "0%";
    if (globalData.totalClients > 0) impactoPerc = ((globalData.powerOff / globalData.totalClients) * 100).toFixed(1) + '%';

    let relativoPerc = "0%";
    if (globalData.totalOffline > 0) relativoPerc = ((globalData.powerOff / globalData.totalOffline) * 100).toFixed(1) + '%';

    cardBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: stretch; width: 100%; flex-wrap: wrap; gap: 20px; height: 100%;">
            <div class="card-stats global-stat" style="padding-right: 0; min-width: 200px; display: flex; flex-direction: column; justify-content: center;">
                <div style="display: flex; align-items: center; justify-content: flex-start; margin-bottom: 5px; gap: 8px;">
                    <span class="material-symbols-rounded" style="font-size: 24px; color: #f87171; opacity: 0.9;">power_off</span>
                    <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem; font-weight: 600; letter-spacing: 1px;">CLIENTES SEM ENERGIA</span>
                </div>
                <h2 id="global-poweroff-total" class="stat-number" style="margin: 0; color: #f87171; line-height: 1;">${globalData.powerOff}</h2>
                <div id="global-poweroff-context" style="margin-top: 10px; color: var(--m3-on-surface-variant); font-size: 0.85rem; line-height: 1.4;">
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">dns</span> <strong id="global-olts-afetadas" style="color: var(--m3-on-surface);">${globalData.oltsAffected}</strong> de 17 OLTs afetadas.<br>
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">public</span> Impacto rede: <strong id="global-impacto-perc" style="color: var(--m3-on-surface);">${impactoPerc}</strong><br>
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">pie_chart</span> Relativo OFF: <strong id="global-offline-relativo-perc" style="color: #f87171;">${relativoPerc}</strong>
                </div>
            </div>
            <div style="flex: 1; border-left: 1px solid var(--m3-outline); padding-left: 30px; display: flex; flex-direction: column; min-width: 300px; justify-content: stretch;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid var(--m3-outline-variant); padding-bottom: 8px;">
                    <span class="material-symbols-rounded" style="color: var(--m3-on-surface); font-size: 20px;">bar_chart</span>
                    <h3 style="margin: 0; font-size: 1rem; color: var(--m3-on-surface);">Ranking de OLTs Críticas</h3>
                </div>
                <div style="flex: 1; width: 100%; position: relative; min-height: 160px; display: flex; flex-direction: column;">
                    <canvas id="energyChartOlt" style="flex: 1;"></canvas>
                </div>
            </div>
        </div>
    `;

    drawEnergyChart(oltsData);
}

// ==============================================================================
// MOTOR DE VARREDURA
// ==============================================================================

window.startEnergyMonitoring = async function() {
    try {
        window.ENERGY_DATA_STORE = {
            global: { powerOff: 0, totalClients: 0, oltsAffected: 0, totalOffline: 0 },
            olts: {} 
        };

        ENERGY_OLT_LIST.forEach(olt => {
            window.ENERGY_DATA_STORE.olts[olt.id] = {
                id: olt.id, type: olt.type, totalClients: 0, online: 0, offline: 0, powerOff: 0, offlineOther: 0, lastUpdate: '--/-- --:--',
                ports: {}
            };
        });

        const ranges = ['ENERGIA!A:BP', `${TAB_CIRCUITOS_ENERGIA}!A:AK`].concat(ENERGY_OLT_LIST.map(o => o.type === 'nokia' ? `${o.sheetTab}!A:E` : `${o.sheetTab}!A:C`));
        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ENERGY_SHEET_ID}/values:batchGet?key=${ENERGY_API_KEY}&ranges=${ranges.join('&ranges=')}`;
        
        const resBatch = await fetch(batchUrl);
        const dataBatch = await resBatch.json();

        if (!dataBatch.valueRanges) throw new Error("Falha na estrutura de retorno da API");

        const rowsCircuitos = dataBatch.valueRanges[1].values || [];

        ENERGY_OLT_LIST.forEach((olt, index) => {
            const vrIndex = index + 2;
            const rows = dataBatch.valueRanges[vrIndex].values ? dataBatch.valueRanges[vrIndex].values.slice(1) : [];
            const oltData = window.ENERGY_DATA_STORE.olts[olt.id];

            rows.forEach(col => {
                if(col.length === 0) return;
                let val0 = col[0];
                let status = (olt.type === 'nokia' ? col[4] : col[2]) || '';
                
                let isOnline = false;
                if (olt.type === 'nokia') {
                    isOnline = status.trim().toLowerCase().includes('up');
                } else {
                    isOnline = status.trim().toLowerCase() === 'active';
                }

                let p = extractPort(val0);
                if (p) {
                    let placa = p.placa;
                    let porta = p.porta;
                    
                    if (!oltData.ports[placa]) oltData.ports[placa] = {};
                    if (!oltData.ports[placa][porta]) {
                        const sheetAbaName = olt.id.replace('-', '');
                        const circ = getEnergyCircuitInfo(rowsCircuitos, sheetAbaName, placa, porta, olt.type);
                        oltData.ports[placa][porta] = { total: 0, online: 0, offline: 0, powerOff: 0, circuit: circ };
                    }

                    oltData.ports[placa][porta].total++;
                    if (isOnline) {
                        oltData.ports[placa][porta].online++;
                        oltData.online++;
                    } else {
                        oltData.ports[placa][porta].offline++;
                        oltData.offline++;
                        window.ENERGY_DATA_STORE.global.totalOffline++;
                    }
                    
                    oltData.totalClients++;
                    window.ENERGY_DATA_STORE.global.totalClients++;
                }
            });
        });

        const rowsEnergia = dataBatch.valueRanges[0].values ? dataBatch.valueRanges[0].values.slice(1) : [];
        
        for (const [oltId, colIndex] of Object.entries(HORIZONTAL_ENERGY_MAP)) {
            const oltData = window.ENERGY_DATA_STORE.olts[oltId];
            if (!oltData) continue;

            if (rowsEnergia.length > 0 && rowsEnergia[0][colIndex + 3]) {
                oltData.lastUpdate = rowsEnergia[0][colIndex + 3];
            }

            rowsEnergia.forEach(row => {
                if (row.length > colIndex + 2) {
                    const portaFull = row[colIndex + 1];
                    const qtd = parseInt(row[colIndex + 2]) || 0;

                    if (portaFull && qtd > 0) {
                        let p = extractPort(portaFull);
                        if (p) {
                            const placa = p.placa;
                            const porta = p.porta;

                            if (!oltData.ports[placa]) oltData.ports[placa] = {};
                            if (!oltData.ports[placa][porta]) {
                                const sheetAbaName = oltId.replace('-', '');
                                const circ = getEnergyCircuitInfo(rowsCircuitos, sheetAbaName, placa, porta, oltData.type);
                                oltData.ports[placa][porta] = { total: qtd, online: 0, offline: qtd, powerOff: 0, circuit: circ };
                            }

                            oltData.ports[placa][porta].powerOff = qtd;
                            oltData.powerOff += qtd;
                            window.ENERGY_DATA_STORE.global.powerOff += qtd;
                        }
                    }
                }
            });
        }

        ENERGY_OLT_LIST.forEach(olt => {
            const oData = window.ENERGY_DATA_STORE.olts[olt.id];
            oData.offlineOther = Math.max(0, oData.offline - oData.powerOff);
            if (oData.powerOff > 0) window.ENERGY_DATA_STORE.global.oltsAffected++;
        });

        updateGlobalEnergyCard();

        // ==============================================================================
        // --- OS ALARMES SINGULARES E MÚLTIPLOS DE ENERGIA FORAM DESATIVADOS ---
        // O motor agora funciona apenas como um "Agente Secreto", baixando e 
        // processando os dados brutos (window.ENERGY_DATA_STORE) para que o 
        // home-engine.js possa calcular os Alarmes Híbridos em silêncio.
        // ==============================================================================
        window.NETWORK_ENERGY_STORE = new Set();
        // ==============================================================================

        const gridEl = document.getElementById('energy-olt-grid');
        const isEnergyPage = window.location.pathname.includes('energia.html');

        if (isEnergyPage && gridEl) {
            gridEl.innerHTML = '';
            ENERGY_OLT_LIST.forEach(oltDef => {
                const oData = window.ENERGY_DATA_STORE.olts[oltDef.id];
                const pctOnline = oData.totalClients ? (oData.online / oData.totalClients * 100) : 0;
                const pctPowerOff = oData.totalClients ? (oData.powerOff / oData.totalClients * 100) : 0;
                const pctOfflineOther = oData.totalClients ? (oData.offlineOther / oData.totalClients * 100) : 0;
                
                gridEl.innerHTML += `
                    <div class="energy-olt-card overview-card" style="display: flex; flex-direction: column;">
                        <div class="energy-olt-card-header">
                            <h3><span class="material-symbols-rounded">dns</span> ${oData.id}</h3>
                            <button class="btn-energy-details" onclick="window.openEnergyModal('${oData.id}')" title="Ver Detalhes">
                                <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                            </button>
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; width: 100%; text-align: center; margin-bottom: 12px;">
                                <div style="flex: 1;">
                                    <span class="material-symbols-rounded" style="color:var(--m3-on-surface); font-size: 26px;">router</span><br>
                                    <strong style="color:var(--m3-on-surface); font-size: 1.3rem;">${oData.offline}</strong>
                                </div>
                                <div style="flex: 1;">
                                    <span class="material-symbols-rounded" style="color:#f87171; font-size: 26px;">bolt</span><br>
                                    <strong style="color:#f87171; font-size: 1.3rem;">${oData.powerOff}</strong>
                                </div>
                                <div style="flex: 1;">
                                    <span class="material-symbols-rounded" style="color:var(--m3-color-warning); font-size: 26px;">wifi_off</span><br>
                                    <strong style="color:var(--m3-color-warning); font-size: 1.3rem;">${oData.offlineOther}</strong>
                                </div>
                            </div>
                            <div class="triple-progress-bar">
                                <div class="bar-online" style="width: ${pctOnline}%"></div>
                                <div class="bar-poweroff" style="width: ${pctPowerOff}%"></div>
                                <div class="bar-offline" style="width: ${pctOfflineOther}%"></div>
                            </div>
                        </div>
                    </div>`;
            });
        }
    } catch (e) {
        console.error("Erro na Engine de Energia:", e);
    }
};

window.openEnergyModal = function(oltId) {
    const modal = document.getElementById('energy-detail-modal');
    if (!modal) return;
    const oData = window.ENERGY_DATA_STORE.olts[oltId];
    document.getElementById('energy-modal-title').innerHTML = `<span class="material-symbols-rounded">router</span> Detalhes - ${oltId}`;
    document.getElementById('energy-modal-last-update').innerHTML = `<span class="material-symbols-rounded" style="font-size: 14px;">history</span> Última Varredura: ${oData.lastUpdate}`;
    const placasGrid = document.getElementById('energy-placas-list');
    placasGrid.innerHTML = '';
    const placas = Object.keys(oData.ports).sort((a, b) => parseInt(a) - parseInt(b));
    placas.forEach(placa => {
        let placaPowerOff = 0;
        for (const pt in oData.ports[placa]) placaPowerOff += oData.ports[placa][pt].powerOff;
        let btnClass = 'placa-btn';
        if (placaPowerOff > 0) btnClass += ' has-alarm';
        placasGrid.innerHTML += `
            <button class="${btnClass}" onclick="window.openEnergyPlacaDetails('${oltId}', '${placa}')">
                <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span>
                Placa ${placa}
                ${placaPowerOff > 0 ? `<span class="alarm-count">${placaPowerOff} sem luz</span>` : ''}
            </button>`;
    });
    document.getElementById('energy-view-detalhes').style.display = 'none';
    document.getElementById('energy-view-placas').style.display = 'block';
    modal.style.display = 'flex';
};

window.openEnergyPlacaDetails = function(oltId, placa) {
    document.getElementById('energy-view-placas').style.display = 'none';
    document.getElementById('energy-view-detalhes').style.display = 'block';
    document.getElementById('energy-placa-subtitle').innerText = `Ocorrências - Placa ${placa}`;
    const tbody = document.getElementById('energy-detalhes-tbody');
    tbody.innerHTML = '';
    const ports = window.ENERGY_DATA_STORE.olts[oltId].ports[placa];
    Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b)).forEach(pt => {
        const pData = ports[pt];
        if (pData.total > 0) {
            const perc = pData.powerOff / pData.total;
            let statusBadge = `<span class="impact-badge impact-low">Mínimo</span>`; 
            
            // --- NOVA REGRA DE EXIBIÇÃO: 15% ---
            if ((perc >= 0.5 && pData.powerOff >= 10) || (perc === 1 && pData.total >= 5)) {
                statusBadge = `<span class="impact-badge impact-high">Crítico</span>`; 
            } else if (perc >= 0.15 && pData.powerOff >= 5) {
                statusBadge = `<span class="impact-badge impact-med">Atenção</span>`; 
            }
            // ------------------------------------

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: bold;">${placa}/${pt}</td>
                    <td><span class="circuit-badge">${pData.circuit}</span></td>
                    <td>${pData.total}</td>
                    <td style="color: #f87171; font-weight: bold;">${pData.powerOff > 0 ? pData.powerOff : '-'}</td>
                    <td>${Math.round(perc * 100)}%</td>
                    <td>${statusBadge}</td>
                </tr>`;
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const isEnergyPage = window.location.pathname.includes('energia.html');
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');

    if (isEnergyPage || isHomePage) {
        startEnergyMonitoring();
        setInterval(startEnergyMonitoring, ENERGY_REFRESH_SECONDS * 1000);
    }
});