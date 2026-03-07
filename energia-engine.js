// ==============================================================================
// energia-engine.js - Motor Dedicado de Monitorização de Energia (Dying Gasp)
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

// MAPA FIXO: Índice da coluna inicial para cada OLT na aba ENERGIA
const HORIZONTAL_ENERGY_MAP = {
    'HEL-1': 0, 'HEL-2': 4, 'PQA-1': 8, 'PSV-1': 12, 'MGP': 16,
    'LTXV-1': 20, 'SBO-1': 24, 'LTXV-2': 28, 'PQA-2': 32, 'PQA-3': 36,
    'SB-1': 40, 'SB-2': 44, 'SB-3': 48, 'SBO-2': 52, 'SBO-3': 56,
    'SBO-4': 60, 'PSV-7': 64
};

window.ENERGY_DATA_STORE = {};

// ==============================================================================
// FUNÇÕES AUXILIARES DE ENERGIA
// ==============================================================================

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
// MOTOR GLOBAL DE ENERGIA
// ==============================================================================

window.startEnergyMonitoring = async function() {
    // REMOVIDA A TRAVA: Agora o motor continua executando mesmo sem achar a grid (perfeito para a Home)
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
                let placa, porta;
                
                let isOnline = false;
                if (olt.type === 'nokia') {
                    isOnline = status.trim().toLowerCase().includes('up');
                    if (val0 && val0.includes('1/1/')) { 
                        let parts = val0.split('/');
                        if(parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                    }
                } else {
                    isOnline = status.trim().toLowerCase() === 'active';
                    if (val0) {
                        if (olt.type === 'furukawa-10') {
                            const parts = val0.split('/');
                            if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                        } else {
                            let match = val0.match(/GPON(\d+)\/(\d+)/i);
                            if(match) { placa = match[1]; porta = match[2]; }
                        }
                    }
                }

                if (placa && porta) {
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

        // PROCESSAMENTO DE ENERGIA (MAPA HORIZONTAL)
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
                        const parts = portaFull.split('/');
                        const placa = parts[0];
                        const porta = parts[1];

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
            });
        }

        ENERGY_OLT_LIST.forEach(olt => {
            const oData = window.ENERGY_DATA_STORE.olts[olt.id];
            oData.offlineOther = Math.max(0, oData.offline - oData.powerOff);
            if (oData.powerOff > 0) window.ENERGY_DATA_STORE.global.oltsAffected++;
        });

        // =========================================================
        // ATUALIZAÇÃO DA INTERFACE (UI) GLOBAL
        // =========================================================
        const globalPerc = window.ENERGY_DATA_STORE.global.totalClients > 0 
            ? ((window.ENERGY_DATA_STORE.global.powerOff / window.ENERGY_DATA_STORE.global.totalClients) * 100).toFixed(1) 
            : 0;

        const globalRelativoPerc = window.ENERGY_DATA_STORE.global.totalOffline > 0 
            ? ((window.ENERGY_DATA_STORE.global.powerOff / window.ENERGY_DATA_STORE.global.totalOffline) * 100).toFixed(1) 
            : 0;
        
        const elTotal = document.getElementById('global-poweroff-total');
        if (elTotal) elTotal.innerText = window.ENERGY_DATA_STORE.global.powerOff;
        
        const elOlts = document.getElementById('global-olts-afetadas');
        if (elOlts) elOlts.innerText = window.ENERGY_DATA_STORE.global.oltsAffected;
        
        const elImpacto = document.getElementById('global-impacto-perc');
        if (elImpacto) elImpacto.innerText = `${globalPerc}%`;
        
        const elRelativo = document.getElementById('global-offline-relativo-perc');
        if (elRelativo) elRelativo.innerText = `${globalRelativoPerc}%`;

        // =========================================================
        // ATUALIZAÇÃO DOS GRÁFICOS E CARDS INDIVIDUAIS
        // =========================================================
        let chartLabels = [];
        let chartData = [];
        
        const gridEl = document.getElementById('energy-olt-grid');
        const isEnergyPage = window.location.pathname.includes('energia.html');

        if (isEnergyPage && gridEl) {
            gridEl.innerHTML = ''; // Limpa a grid apenas se for a página oficial de Energia
        }

        ENERGY_OLT_LIST.forEach(oltDef => {
            const oData = window.ENERGY_DATA_STORE.olts[oltDef.id];
            
            // Popula os dados do gráfico (Necessário na Home e na página de Energia)
            if (oData.powerOff > 0) {
                chartLabels.push(oData.id);
                chartData.push(oData.powerOff);
            }
            
            // Renderiza o card individual (SOMENTE se estivermos na página de Energia)
            if (isEnergyPage && gridEl) {
                const pctOnline = oData.totalClients ? (oData.online / oData.totalClients * 100) : 0;
                const pctPowerOff = oData.totalClients ? (oData.powerOff / oData.totalClients * 100) : 0;
                const pctOfflineOther = oData.totalClients ? (oData.offlineOther / oData.totalClients * 100) : 0;
                
                gridEl.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column;">
                        <div class="card-header" style="justify-content: space-between; background-color: rgba(234, 208, 255, 0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                                <span class="material-symbols-rounded">dns</span> ${oData.id}
                            </h3>
                            <button class="card-header-button" onclick="window.openEnergyModal('${oData.id}')" title="Ver Detalhes">
                                <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                            </button>
                        </div>
                        
                        <div class="card-body" style="flex-direction: column; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; width: 100%; text-align: center; margin-bottom: 12px;">
                                <div style="flex: 1;">
                                    <span class="material-symbols-rounded" style="color:var(--m3-on-surface); font-size: 26px;">router</span><br>
                                    <strong style="color:var(--m3-on-surface); font-size: 1.3rem;">${oData.offline}</strong><br>
                                    <small style="color:var(--m3-on-surface-variant); font-size: 0.8rem; font-weight: 600;">TOTAL</small>
                                </div>
                                <div style="flex: 1;">
                                    <span class="material-symbols-rounded" style="color:#f87171; font-size: 26px;">bolt</span><br>
                                    <strong style="color:#f87171; font-size: 1.3rem;">${oData.powerOff}</strong><br>
                                    <small style="color:var(--m3-on-surface-variant); font-size: 0.8rem; font-weight: 600;">ENERGIA</small>
                                </div>
                                <div style="flex: 1;">
                                    <span class="material-symbols-rounded" style="color:var(--m3-color-warning); font-size: 26px;">wifi_off</span><br>
                                    <strong style="color:var(--m3-color-warning); font-size: 1.3rem;">${oData.offlineOther}</strong><br>
                                    <small style="color:var(--m3-on-surface-variant); font-size: 0.8rem; font-weight: 600;">GPON</small>
                                </div>
                            </div>
                            
                            <div class="triple-progress-bar">
                                <div class="bar-online" style="width: ${pctOnline}%" title="Online (Oculto)"></div>
                                <div class="bar-poweroff" style="width: ${pctPowerOff}%" title="Energia OFF"></div>
                                <div class="bar-offline" style="width: ${pctOfflineOther}%" title="GPON OFF"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        // Ordenação e Renderização do Gráfico Global
        let chartCombined = chartLabels.map((l, i) => ({ label: l, data: chartData[i] }));
        chartCombined.sort((a, b) => b.data - a.data);
        chartLabels = chartCombined.map(x => x.label);
        chartData = chartCombined.map(x => x.data);

        const chartCtx = document.getElementById('energyChartOlt');
        if (chartCtx && window.Chart) {
            if (window.energyChartInstance) window.energyChartInstance.destroy();
            
            window.energyChartInstance = new Chart(chartCtx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Clientes Sem Energia',
                        data: chartData,
                        backgroundColor: '#f87171',
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const val = context.raw;
                                    const oData = window.ENERGY_DATA_STORE.olts[context.label];
                                    let portsAffected = 0;
                                    let worstCircuit = '';
                                    let maxPortOff = 0;
                                    
                                    if (oData) {
                                        for (const pl in oData.ports) {
                                            for (const pt in oData.ports[pl]) {
                                                if (oData.ports[pl][pt].powerOff > 0) {
                                                    portsAffected++;
                                                    if (oData.ports[pl][pt].powerOff > maxPortOff) {
                                                        maxPortOff = oData.ports[pl][pt].powerOff;
                                                        worstCircuit = oData.ports[pl][pt].circuit;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    return [
                                        ` Clientes OFF: ${val}`,
                                        ` Portas Afetadas: ${portsAffected}`,
                                        ` Pior Circuito: ${worstCircuit || 'N/A'}`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        y: { ticks: { color: '#EADDFF' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                        x: { ticks: { color: '#EADDFF', font: { family: "'Montserrat', sans-serif" } }, grid: { display: false } }
                    }
                }
            });
        }

    } catch (e) {
        console.error("Erro na Engine de Energia:", e);
        const gridEl = document.getElementById('energy-olt-grid');
        const isEnergyPage = window.location.pathname.includes('energia.html');
        if (isEnergyPage && gridEl) {
            gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #f87171; padding: 40px;">❌ Erro ao cruzar dados. Verifique a conexão com a API.</div>`;
        }
    }
};

// ==============================================================================
// CONTROLE DO MODAL DE DETALHES DE ENERGIA (PLACAS E PORTAS)
// ==============================================================================

window.openEnergyModal = function(oltId) {
    const modal = document.getElementById('energy-detail-modal');
    if (!modal) return; // Trava de segurança caso seja chamado na Home
    
    const oData = window.ENERGY_DATA_STORE.olts[oltId];
    
    document.getElementById('energy-modal-title').innerHTML = `<span class="material-symbols-rounded">router</span> Detalhes - ${oltId}`;
    document.getElementById('energy-modal-last-update').innerHTML = `<span class="material-symbols-rounded" style="font-size: 14px;">history</span> Última Varredura: ${oData.lastUpdate}`;
    
    const placasGrid = document.getElementById('energy-placas-list');
    placasGrid.innerHTML = '';
    
    const placas = Object.keys(oData.ports).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (placas.length === 0) {
        placasGrid.innerHTML = '<p style="color: var(--m3-on-surface-variant); width: 100%;">Nenhuma placa conectada.</p>';
    }

    placas.forEach(placa => {
        let placaPowerOff = 0;
        for (const pt in oData.ports[placa]) {
            placaPowerOff += oData.ports[placa][pt].powerOff;
        }
        
        let btnClass = 'placa-btn';
        let badgeHtml = '';
        if (placaPowerOff > 0) {
            btnClass += ' has-alarm';
            badgeHtml = `<span class="alarm-count">${placaPowerOff} sem luz</span>`;
        }
        
        placasGrid.innerHTML += `
            <button class="${btnClass}" onclick="window.openEnergyPlacaDetails('${oltId}', '${placa}')">
                <span class="material-symbols-rounded" style="font-size: 32px; color: ${placaPowerOff > 0 ? '#f87171' : 'var(--m3-on-surface-variant)'};">developer_board</span>
                Placa ${placa}
                ${badgeHtml}
            </button>
        `;
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
    const portKeys = Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b));
    
    let hasRows = false;

    portKeys.forEach(pt => {
        const pData = ports[pt];
        if (pData.total > 0) {
            hasRows = true;
            
            const perc = pData.powerOff / pData.total;
            const percDisplay = Math.round(perc * 100);
            
            let statusBadge = `<span class="impact-badge impact-low">Mínimo</span>`; 
            
            if ((perc >= 0.5 && pData.powerOff >= 10) || (perc === 1 && pData.total >= 5)) {
                statusBadge = `<span class="impact-badge impact-high">Crítico</span>`; 
            } else if (perc >= 0.2 && pData.powerOff >= 5) {
                statusBadge = `<span class="impact-badge impact-med">Atenção</span>`; 
            }

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: bold;">${placa}/${pt}</td>
                    <td><span class="circuit-badge">${pData.circuit}</span></td>
                    <td>${pData.total}</td>
                    <td style="color: #f87171; font-weight: bold;">${pData.powerOff > 0 ? pData.powerOff : '-'}</td>
                    <td>${percDisplay}%</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }
    });

    if (!hasRows) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">Nenhum cliente registrado nesta placa.</td></tr>`;
    }
};

// Inicia o motor após o carregamento completo do DOM (garante que o layout.js já carregou tudo)
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('energia.html')) {
        startEnergyMonitoring();
        setInterval(startEnergyMonitoring, ENERGY_REFRESH_SECONDS * 1000);
    }
});