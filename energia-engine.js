// ==============================================================================
// energia-engine.js - Motor Dedicado de Monitorização de Energia (Dying Gasp)
// Atualização: Margens compactadas para acompanhar novo layout da Home
// ==============================================================================

const TAB_CIRCUITOS_ENERGIA = 'CIRCUITO'; 

window.ENERGY_DATA_STORE = {};
window.NETWORK_ENERGY_STORE = new Set(); 
let energyChartInstance = null; 

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
                    backgroundColor: '#fbbf24', 
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

    let cardBody = document.getElementById('global-energia-body');
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
        <div style="display: flex; justify-content: space-between; align-items: stretch; width: 100%; flex-wrap: wrap; gap: 10px; height: 100%;">
            <div class="card-stats global-stat" style="padding-right: 15px; min-width: 200px; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start !important; text-align: left !important;">
                <div style="display: flex; align-items: center; justify-content: flex-start; margin-bottom: 5px; gap: 8px;">
                    <span class="material-symbols-rounded" style="font-size: 24px; color: #fbbf24; opacity: 0.9;">power_off</span>
                    <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem; font-weight: 600; letter-spacing: 1px;">CLIENTES SEM ENERGIA</span>
                </div>
                <h2 id="global-poweroff-total" class="stat-number" style="margin: 0; color: #fbbf24; line-height: 1;">${globalData.powerOff}</h2>
                <div id="global-poweroff-context" style="margin-top: 6px; color: var(--m3-on-surface-variant); font-size: 0.85rem; line-height: 1.4;">
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">dns</span> <strong id="global-olts-afetadas" style="color: var(--m3-on-surface);">${globalData.oltsAffected}</strong> de 17 OLTs afetadas.<br>
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">public</span> Impacto rede: <strong id="global-impacto-perc" style="color: var(--m3-on-surface);">${impactoPerc}</strong><br>
                    <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">pie_chart</span> Relativo OFF: <strong id="global-offline-relativo-perc" style="color: #fbbf24;">${relativoPerc}</strong>
                </div>
            </div>
            <div style="flex: 3; border-left: 1px solid var(--m3-outline); padding-left: 20px; display: flex; flex-direction: column; min-width: 300px; justify-content: stretch;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span class="material-symbols-rounded" style="color: #fbbf24; font-size: 20px;">bar_chart</span>
                    <h3 style="margin: 0; font-size: 1rem; color: var(--m3-on-surface);">Ranking de OLTs Críticas</h3>
                </div>
                <div style="flex: 1; width: 100%; position: relative; min-height: 110px; display: flex; flex-direction: column;">
                    <canvas id="energyChartOlt" style="flex: 1;"></canvas>
                </div>
            </div>
        </div>
    `;

    drawEnergyChart(oltsData);
}

window.startEnergyMonitoring = async function() {
    try {
        window.ENERGY_DATA_STORE = {
            global: { powerOff: 0, totalClients: 0, oltsAffected: 0, totalOffline: 0 },
            olts: {} 
        };

        GLOBAL_MASTER_OLT_LIST.forEach(olt => {
            window.ENERGY_DATA_STORE.olts[olt.id] = {
                id: olt.id, type: olt.type, totalClients: 0, online: 0, offline: 0, powerOff: 0, offlineOther: 0, lastUpdate: '--/-- --:--',
                ports: {}
            };
        });

        const ranges = ['ENERGIA!A:BP', `${TAB_CIRCUITOS_ENERGIA}!A:AK`].concat(GLOBAL_MASTER_OLT_LIST.map(o => o.type === 'nokia' ? `${o.sheetTab}!A:E` : `${o.sheetTab}!A:C`));
        
        const dataBatch = await API.getBatch(ranges);

        if (!dataBatch.valueRanges) throw new Error("Falha na estrutura de retorno da API");

        const rowsCircuitos = dataBatch.valueRanges[1].values || [];

        GLOBAL_MASTER_OLT_LIST.forEach((olt, index) => {
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
                        const circ = getGlobalCircuitInfo(rowsCircuitos, olt.id, placa, porta, olt.type);
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
        
        GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
            if (oltDef.energyCol === undefined) return;
            const oltId = oltDef.id;
            const colIndex = oltDef.energyCol;
            const oltData = window.ENERGY_DATA_STORE.olts[oltId];
            if (!oltData) return;

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
                                const circ = getGlobalCircuitInfo(rowsCircuitos, oltId, placa, porta, oltData.type);
                                oltData.ports[placa][porta] = { total: qtd, online: 0, offline: qtd, powerOff: 0, circuit: circ };
                            }

                            oltData.ports[placa][porta].powerOff = qtd;
                            oltData.powerOff += qtd;
                            window.ENERGY_DATA_STORE.global.powerOff += qtd;
                        }
                    }
                }
            });
        });

        GLOBAL_MASTER_OLT_LIST.forEach(olt => {
            const oData = window.ENERGY_DATA_STORE.olts[olt.id];
            oData.offlineOther = Math.max(0, oData.offline - oData.powerOff);
            if (oData.powerOff > 0) window.ENERGY_DATA_STORE.global.oltsAffected++;
        });

        updateGlobalEnergyCard();
        window.NETWORK_ENERGY_STORE = new Set();

        const gridEl = document.getElementById('energy-olt-grid');
        const isEnergyPage = window.location.pathname.includes('energia.html');

        if (isEnergyPage && gridEl) {
            gridEl.innerHTML = '';
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const oData = window.ENERGY_DATA_STORE.olts[oltDef.id];
                const pctOnline = oData.totalClients ? (oData.online / oData.totalClients * 100) : 0;
                const pctPowerOff = oData.totalClients ? (oData.powerOff / oData.totalClients * 100) : 0;
                const pctOfflineOther = oData.totalClients ? (oData.offlineOther / oData.totalClients * 100) : 0;
                
                gridEl.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column;">
                        <div class="card-header">
                            <h3><span class="material-symbols-rounded">dns</span> ${oData.id}</h3>
                            <button class="card-header-button" onclick="window.openEnergyModal('${oData.id}')" title="Ver Detalhes">
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
                                    <span class="material-symbols-rounded" style="color:#fbbf24; font-size: 26px;">bolt</span><br>
                                    <strong style="color:#fbbf24; font-size: 1.3rem;">${oData.powerOff}</strong>
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
    
    document.getElementById('energy-modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${oltId}`;
    
    let datePart = '--/--/----';
    let timePart = '--:--:--';
    let cellData = oData.lastUpdate ? String(oData.lastUpdate) : '';

    if (cellData && cellData !== '--/-- --:--') {
        const dateMatch = cellData.match(/\d{2}\/\d{2}\/\d{2,4}/);
        const timeMatch = cellData.match(/\d{2}:\d{2}(:\d{2})?/);

        if (dateMatch) datePart = dateMatch[0];
        if (timeMatch) timePart = timeMatch[0];
    }

    const elDate = document.getElementById('energy-update-date');
    const elTime = document.getElementById('energy-update-time');
    if (elDate) elDate.textContent = datePart;
    if (elTime) elTime.textContent = timePart;

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
            
            if ((perc >= 0.5 && pData.powerOff >= 10) || (perc === 1 && pData.total >= 5)) {
                statusBadge = `<span class="impact-badge impact-high">Crítico</span>`; 
            } else if (perc >= 0.15 && pData.powerOff >= 5) {
                statusBadge = `<span class="impact-badge impact-med">Atenção</span>`; 
            }

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: bold;">${placa}/${pt}</td>
                    <td><span class="circuit-badge">${pData.circuit}</span></td>
                    <td>${pData.total}</td>
                    <td style="color: #fbbf24; font-weight: bold;">${pData.powerOff > 0 ? pData.powerOff : '-'}</td>
                    <td>${Math.round(perc * 100)}%</td>
                    <td>${statusBadge}</td>
                </tr>`;
        }
    });
};

window.closeEnergyModal = function(event) {
    if (event && event.target.id !== 'energy-detail-modal' && !event.target.classList.contains('close-modal')) return;
    document.getElementById('energy-detail-modal').style.display = 'none';
};

window.backToEnergyPlacas = function() {
    document.getElementById('energy-view-detalhes').style.display = 'none';
    document.getElementById('energy-view-placas').style.display = 'block';
};

document.addEventListener('DOMContentLoaded', () => {
    const isEnergyPage = window.location.pathname.includes('energia.html');
    
    if (isEnergyPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Alarmes de Energia", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        setTimeout(updateGlobalTimestamp, 500);
    }
    
    if (isEnergyPage || checkIsHomePage()) {
        startEnergyMonitoring();
        setInterval(startEnergyMonitoring, GLOBAL_REFRESH_SECONDS * 1000);
    }
});