// ==============================================================================
// olt-engine.js - Motor Dedicado de Monitoramento de Rede (Individual e Global)
// ==============================================================================

const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

const TAB_CIRCUITOS = 'CIRCUITO'; 
const TABLE_HEADER_NAME = 'Circuitos'; 

const OLT_COLUMN_MAP = {
    'HEL1':  1,  'HEL2':  3,  'MGP':   5,  'PQA1':  7,  'PSV1':  9,  'PSV7':  11,
    'SBO2':  13, 'SBO3':  15, 'SBO4':  17, 'SB1':   19, 'SB2':   21, 'SB3':   23,
    'PQA2':  25, 'PQA3':  27, 'LTXV2': 29, 'LTXV1': 31, 'SBO1':  33
};

const GLOBAL_OLT_LIST = [
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

window.OLT_CLIENTS_DATA = {};
window.CURRENT_OLT_PORT_DATA = {}; 
window.NETWORK_PROBLEMS_STORE = new Set();
window.NETWORK_BACKBONE_STORE = new Set();
window.currentOltInterval = null; 

// ==============================================================================
// FUNÇÕES DE VARREDURA DE REDE GLOBAL (PARA A HOME)
// ==============================================================================

async function fetchGlobalOltData(olt) {
    const range = olt.type === 'nokia' ? `${olt.sheetTab}!A:E` : `${olt.sheetTab}!A:C`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${range}?key=${ENGINE_API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Falha aba ${olt.sheetTab}`);
        const data = await response.json();
        const rows = (data.values || []).slice(1);
        
        let totalOnline = 0, totalOffline = 0;
        const portData = {};

        rows.forEach(columns => {
            if (columns.length === 0) return;
            let placa, porta, isOnline;

            if (olt.type === 'nokia') {
                isOnline = (columns[4] || '').trim().toLowerCase().includes('up');
                if (columns[0] && columns[0].includes('1/1/')) {
                    const parts = columns[0].split('/');
                    if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                }
            } else { 
                isOnline = (columns[2] || '').trim().toLowerCase() === 'active';
                if (columns[0]) {
                    if (olt.type === 'furukawa-10') {
                        const parts = columns[0].split('/');
                        if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                    } else { 
                        const match = columns[0].match(/GPON(\d+)\/(\d+)/);
                        if (match) { placa = match[1]; porta = match[2]; }
                    }
                }
            }

            if (isOnline) totalOnline++; else totalOffline++;
            if (placa && porta) {
                const portKey = `${placa}/${porta}`;
                if (!portData[portKey]) portData[portKey] = { off: 0, total: 0 };
                portData[portKey].total++;
                if (!isOnline) portData[portKey].off++;
            }
        });

        return { id: olt.id, onlineCount: totalOnline, offlineCount: totalOffline, type: olt.type, portData };
    } catch (error) {
        return { id: olt.id, onlineCount: 0, offlineCount: 0, type: olt.type, portData: {} };
    }
}

function updateGlobalNetworkCard(globalOnline, globalOffline, nokiaOnline, nokiaTotal, furukawaOnline, furukawaTotal, top3Olts) {
    const cardBody = document.querySelector('#card-global .card-body');
    if (!cardBody) return;
    
    const total = globalOnline + globalOffline;
    
    const statsHtml = `
        <div class="stat-item global-stat">
            <span class="stat-number">${total}</span>
            <label><span class="material-symbols-rounded icon-total">router</span> Total Geral</label>
        </div>
        <div class="stat-item online global-stat">
            <span class="stat-number">${globalOnline}</span>
            <label><span class="material-symbols-rounded icon-up">check_circle</span> Equipamentos Online</label>
        </div>
        <div class="stat-item offline global-stat">
            <span class="stat-number">${globalOffline}</span>
            <label><span class="material-symbols-rounded icon-down">error</span> Equipamentos Offline</label>
        </div>
    `;

    const nokiaPct = nokiaTotal > 0 ? (nokiaOnline / nokiaTotal) * 100 : 0;
    const furukawaPct = furukawaTotal > 0 ? (furukawaOnline / furukawaTotal) * 100 : 0;
    
    const vendorHtml = `
        <div style="display: flex; flex-direction: column; justify-content: center; gap: 25px; width: 100%; height: 100%;">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <img src="imagens/nokia.png" alt="Nokia" style="max-height: 28px; width: auto; object-fit: contain;">
                    <span class="stat-number" style="font-size: 1.4rem; width: auto;">${Math.round(nokiaPct)}%</span>
                </div>
                <div style="height: 14px; background: var(--m3-surface-container-high); border-radius: 7px; overflow: hidden;">
                    <div style="height: 100%; width: ${nokiaPct}%; background: var(--m3-color-success); border-radius: 7px;"></div>
                </div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <img src="imagens/furukawa.png" alt="Furukawa" style="max-height: 28px; width: auto; object-fit: contain;">
                    <span class="stat-number" style="font-size: 1.4rem; width: auto;">${Math.round(furukawaPct)}%</span>
                </div>
                <div style="height: 14px; background: var(--m3-surface-container-high); border-radius: 7px; overflow: hidden;">
                    <div style="height: 100%; width: ${furukawaPct}%; background: var(--m3-color-success); border-radius: 7px;"></div>
                </div>
            </div>
        </div>
    `;

    let rankingHtmlContent = '';
    if (top3Olts.some(olt => olt.offline > 0)) {
        top3Olts.forEach((olt, index) => {
            if (olt.offline === 0) return;
            const offlinePct = olt.total > 0 ? (olt.offline / olt.total) * 100 : 0;
            rankingHtmlContent += `
                <div style="margin-bottom: 18px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px; align-items: baseline;">
                        <strong style="color: var(--m3-on-surface); font-size: 1.2rem;">${index + 1}º ${olt.id}</strong>
                        <span class="stat-number" style="font-size: 1.3rem; color: var(--m3-color-error); width: auto;">${olt.offline} OFF</span>
                    </div>
                    <div style="height: 12px; background: var(--m3-surface-container-high); border-radius: 6px; overflow: hidden;">
                        <div style="height: 100%; width: ${offlinePct}%; background: var(--m3-color-error); border-radius: 6px;"></div>
                    </div>
                </div>
            `;
        });
    } else {
        rankingHtmlContent = `<div style="text-align: center; color: var(--m3-color-success); font-weight: 700; margin-top: 15px; width: 100%;"><span class="material-symbols-rounded" style="font-size: 48px;">sentiment_very_satisfied</span><br>Rede 100% Online!</div>`;
    }

    cardBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: stretch; width: 100%; flex-wrap: wrap; gap: 20px;">
            <div class="card-stats" style="padding-right: 0; min-width: 200px;">
                ${statsHtml}
            </div>
            <div style="flex: 1; border-left: 1px solid var(--m3-outline); padding-left: 30px; display: flex; flex-direction: column; min-width: 250px;">
                ${vendorHtml}
            </div>
            <div style="flex: 1; border-left: 1px solid var(--m3-outline); padding-left: 30px; display: flex; flex-direction: column; justify-content: center; min-width: 250px;">
                <div style="display: flex; flex-direction: column; justify-content: center; width: 100%; height: 100%;">
                    ${rankingHtmlContent}
                </div>
            </div>
        </div>
    `;
}

async function runGlobalNetworkOverview() {
    const oltPromises = GLOBAL_OLT_LIST.map(olt => fetchGlobalOltData(olt));
    const results = await Promise.all(oltPromises);
    
    let globalOnline = 0, globalOffline = 0;
    let nokiaOnline = 0, nokiaTotal = 0, furukawaOnline = 0, furukawaTotal = 0;
    let oltStatsList = [], currentBackbones = new Set();
    let allProblems = new Set();

    results.forEach(result => {
        globalOnline += result.onlineCount; 
        globalOffline += result.offlineCount;
        let total = result.onlineCount + result.offlineCount;
        
        if (result.type === 'nokia') { nokiaOnline += result.onlineCount; nokiaTotal += total; }
        else { furukawaOnline += result.onlineCount; furukawaTotal += total; }
        
        oltStatsList.push({ id: result.id, offline: result.offlineCount, total });

        let ports100Down = 0;
        let localProblems = []; 
        
        for (const key in result.portData) {
            const { off, total: pTotal } = result.portData[key];
            if (pTotal >= 5) {
                let severity = null;
                const percOffline = off / pTotal;

                if (percOffline === 1) { 
                    ports100Down++; 
                    severity = 'SUPER'; 
                } else if (percOffline >= 0.5 || off >= 32) { 
                    severity = 'CRIT'; 
                } else if (off >= 16) { 
                    severity = 'WARN'; 
                }

                if (severity) {
                    localProblems.push({ porta: key, severity: severity, off: off });
                }
            }
        }
        
        let filteredProblems = localProblems;
        
        if (ports100Down >= 2) { 
            currentBackbones.add(result.id); 
            filteredProblems = localProblems.filter(p => p.severity !== 'SUPER');
        } 

        if (filteredProblems.length >= 2) {
            const multiStr = filteredProblems.map(p => p.porta).join(',');
            allProblems.add(`[${result.id}] STATUS::MULTI::${multiStr}`);
        } 
        else if (filteredProblems.length === 1) {
            const p = filteredProblems[0];
            allProblems.add(`[${result.id}] STATUS::${p.severity}_${p.porta}::${p.off}`);
        }
    });

    oltStatsList.sort((a, b) => b.offline - a.offline);
    updateGlobalNetworkCard(globalOnline, globalOffline, nokiaOnline, nokiaTotal, furukawaOnline, furukawaTotal, oltStatsList.slice(0, 3));

    window.NETWORK_PROBLEMS_STORE = allProblems;
    window.NETWORK_BACKBONE_STORE = currentBackbones;
}

// ==============================================================================
// MOTOR DE OLT (SUPER MODAL - FLUXO MD3: PLACAS -> PORTAS)
// ==============================================================================

window.stopOltMonitoring = function() {
    if (window.currentOltInterval) {
        clearInterval(window.currentOltInterval);
        window.currentOltInterval = null;
    }
};

async function fetchCircuitosData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${TAB_CIRCUITOS}!A:AK?key=${ENGINE_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return data.values || [];
    } catch (e) { return []; }
}

function getCircuitInfo(rowsCircuitos, sheetTab, placa, porta, type) {
    const colIndex = OLT_COLUMN_MAP[sheetTab];
    if (colIndex === undefined) return "-";
    if (!rowsCircuitos.length) return "-";

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

window.startOltMonitoring = function(config) {
    window.stopOltMonitoring(); 

    if (!document.getElementById('detail-modal')) {
        const modalHTML = `
            <div id="detail-modal" class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3 id="modal-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">Detalhes</h3>
                        <button class="close-modal" onclick="closeModal()" title="Fechar">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="view-stats" class="modal-stats-grid">
                            <div class="modal-stat-box">
                                <span id="modal-up" class="modal-stat-value val-online">0</span>
                                <span class="modal-stat-label">${config.type === 'nokia' ? 'UP' : 'ACTIVE'}</span>
                            </div>
                            <div class="modal-stat-box">
                                <span id="modal-down" class="modal-stat-value val-offline">0</span>
                                <span class="modal-stat-label">${config.type === 'nokia' ? 'DOWN' : 'INACTIVE'}</span>
                            </div>
                            <div class="modal-stat-box">
                                <span id="modal-total" class="modal-stat-value val-total">0</span>
                                <span class="modal-stat-label">TOTAL</span>
                            </div>
                        </div>

                        <div id="view-clients" style="display:none;">
                            <div class="modal-section-title">
                                <span id="circuit-title-text">Clientes do Circuito</span>
                            </div>
                            <div class="filter-bar">
                                <input type="text" id="search-input" class="filter-input" placeholder="Buscar (Nome, Serial...)" onkeyup="filterClients()">
                                <select id="status-filter" class="filter-select" onchange="filterClients()"></select>
                            </div>
                            <div class="client-table-container">
                                <table id="table-clients">
                                    <thead id="clients-thead" class="table-header-row"></thead>
                                    <tbody id="clients-tbody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async function populateTables() {
        window.CURRENT_OLT_PORT_DATA = {}; 
        window.OLT_CLIENTS_DATA = {}; 

        const rangeOlt = `${config.id}!A:Z`; 
        const urlOlt = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${rangeOlt}?key=${ENGINE_API_KEY}`;

        try {
            const [responseOlt, rowsCircuitos] = await Promise.all([fetch(urlOlt), fetchCircuitosData()]);
            if (!responseOlt.ok) throw new Error('Falha API OLT');
            const dataOlt = await responseOlt.json();

            // --- INÍCIO DA CAPTURA BLINDADA COM REGEX ---
            let datePart = '--/--/----';
            let timePart = '--:--:--';
            
            if (dataOlt.values && dataOlt.values.length > 0) {
                const firstRow = dataOlt.values[0];
                let cellData = firstRow[10] ? String(firstRow[10]) : '';
                
                // Se K1 estiver vazio, procura na linha inteira
                if (!cellData) {
                    for (let i = firstRow.length - 1; i >= 0; i--) {
                        let val = firstRow[i] ? String(firstRow[i]) : '';
                        if (val.match(/\d{2}\/\d{2}/) && val.match(/\d{2}:\d{2}/)) {
                            cellData = val;
                            break;
                        }
                    }
                }
                
                if (cellData) {
                    // Ignora qualquer texto e suga apenas os formatos numéricos puros
                    const dateMatch = cellData.match(/\d{2}\/\d{2}\/\d{2,4}/);
                    const timeMatch = cellData.match(/\d{2}:\d{2}(:\d{2})?/);
                    
                    if (dateMatch) datePart = dateMatch[0];
                    if (timeMatch) timePart = timeMatch[0];
                }
            }
            
            const elDate = document.getElementById('olt-update-date');
            const elTime = document.getElementById('olt-update-time');
            if (elDate) elDate.textContent = datePart;
            if (elTime) elTime.textContent = timePart;
            // --- FIM DA CAPTURA BLINDADA ---

            const rowsOlt = (dataOlt.values || []).slice(1);

            rowsOlt.forEach(columns => {
                if (columns.length === 0) return;
                let placa, porta, isOnline;

                if (config.type === 'nokia') {
                    const pon = columns[0];
                    const status = columns[4]; 
                    if (!pon || !status) return;
                    const parts = pon.split('/'); 
                    if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                    isOnline = status.trim().toLowerCase().includes('up');
                } else { 
                    const portStr = columns[0];
                    const status = columns[2]; 
                    if (!portStr || !status) return;
                    
                    if (config.type === 'furukawa-10') {
                        const parts = portStr.split('/');
                        if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                    } else {
                        const match = portStr.match(/GPON(\d+)\/(\d+)/);
                        if (match) { placa = match[1]; porta = match[2]; }
                    }
                    isOnline = status.trim().toLowerCase() === 'active';
                }

                if (!placa || !porta) return;
                
                const placaNum = parseInt(placa);
                const portaNum = parseInt(porta);
                const portKey = `${placaNum}/${portaNum}`;
                
                if (!window.CURRENT_OLT_PORT_DATA[placaNum]) {
                    window.CURRENT_OLT_PORT_DATA[placaNum] = {};
                }

                if (!window.CURRENT_OLT_PORT_DATA[placaNum][portaNum]) {
                    const infoExtra = getCircuitInfo(rowsCircuitos, config.id, placa, porta, config.type);
                    window.CURRENT_OLT_PORT_DATA[placaNum][portaNum] = { online: 0, offline: 0, info: infoExtra };
                    window.OLT_CLIENTS_DATA[portKey] = [];
                }

                if (isOnline) window.CURRENT_OLT_PORT_DATA[placaNum][portaNum].online++;
                else window.CURRENT_OLT_PORT_DATA[placaNum][portaNum].offline++;
                
                let clientData = {};
                if (config.type === 'nokia') {
                    clientData = { colB: columns[1] || '', colC: columns[2] || '', colE: columns[4] || '', colH: columns[7] || '', colI: columns[8] || '', statusRef: columns[4] || '' };
                } else {
                    clientData = { colB: columns[1] || '', colC: columns[2] || '', colD: columns[3] || '', colH: columns[7] || '', statusRef: columns[2] || '' };
                }
                
                window.OLT_CLIENTS_DATA[portKey].push(clientData);
            });

            // Renderização Tela A
            const placasList = document.getElementById('olt-placas-list');
            if (placasList) placasList.innerHTML = '';

            for (let i = 1; i <= config.boards; i++) {
                const placaNum = i;
                const ports = window.CURRENT_OLT_PORT_DATA[placaNum] || {};
                
                let hasCritical = false;
                let hasWarning = false;
                let alarmCount = 0;

                for (const pt in ports) {
                    const p = ports[pt];
                    const total = p.online + p.offline;
                    const percOffline = total > 0 ? (p.offline / total) : 0;
                    
                    if (total >= 5) {
                        if (percOffline === 1 || percOffline >= 0.5 || p.offline >= 32) {
                            hasCritical = true;
                            alarmCount++;
                        } else if (p.offline >= 16) {
                            hasWarning = true;
                        }
                    }
                }

                let btnClass = 'placa-btn';
                let badgeHtml = '';
                if (hasCritical) {
                    btnClass += ' has-alarm';
                    badgeHtml = `<span class="alarm-count critico">${alarmCount} crítico(s)</span>`;
                } else if (hasWarning) {
                    btnClass += ' has-warning';
                    badgeHtml = `<span class="alarm-count atencao">Atenção</span>`;
                }

                if (placasList) {
                    placasList.innerHTML += `
                        <button class="${btnClass}" onclick="openOltPlacaDetails('${placaNum}', '${config.type}')">
                            <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span>
                            Placa ${placaNum}
                            ${badgeHtml}
                        </button>
                    `;
                }
            }

            // Atualização Tela B
            const detalhesView = document.getElementById('olt-view-detalhes');
            if (detalhesView && detalhesView.style.display === 'block') {
                const subtitle = document.getElementById('olt-placa-subtitle').innerText;
                const match = subtitle.match(/Placa (\d+)/);
                if (match) {
                    window.openOltPlacaDetails(match[1], config.type);
                }
            }

        } catch (error) { 
            console.error('Erro na engine (populateTables):', error); 
            const placasList = document.getElementById('olt-placas-list');
            if (placasList) placasList.innerHTML = `<p style="color: #f87171; text-align: center; padding: 20px; grid-column: 1 / -1;">Erro ao carregar os dados da OLT. Verifique a conexão.</p>`;
        }
    }

    const runUpdate = async () => { await populateTables(); };
    runUpdate(); 
    window.currentOltInterval = setInterval(runUpdate, ENGINE_REFRESH_SECONDS * 1000); 
}

window.openOltPlacaDetails = function(placa, oltType) {
    document.getElementById('olt-view-placas').style.display = 'none';
    document.getElementById('olt-view-detalhes').style.display = 'block';
    document.getElementById('olt-placa-subtitle').innerText = `Detalhes - Placa ${placa}`;
    
    const tbody = document.getElementById('olt-detalhes-tbody');
    tbody.innerHTML = '';
    
    const ports = window.CURRENT_OLT_PORT_DATA[placa] || {};
    const sortedPorts = Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (sortedPorts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--m3-on-surface-variant);">Nenhuma porta ativa com clientes encontrada nesta placa.</td></tr>`;
        return;
    }

    sortedPorts.forEach(pt => {
        const { online, offline, info } = ports[pt];
        const total = online + offline;
        
        let statusClass = 'status-normal';
        let statusText = 'Normal';
        const percOffline = total > 0 ? (offline / total) : 0;

        if (total >= 5) {
            if (percOffline === 1) { statusClass = 'status-problema'; statusText = 'Crítico'; }
            else if (percOffline >= 0.5 || offline >= 32) { statusClass = 'status-problema'; statusText = 'Problema'; }
            else if (offline >= 16) { statusClass = 'status-atencao'; statusText = 'Atenção'; }
        }

        const safeInfo = info.replace(/'/g, "\\'");

        tbody.innerHTML += `
            <tr>
                <td>Porta ${String(pt).padStart(2, '0')}</td>
                <td>
                    <span class="circuit-badge circuit-clickable" 
                          onclick="openCircuitClients('${placa}', '${pt}', '${safeInfo}', '${oltType}')"
                          title="Ver clientes deste circuito">
                        ${info}
                    </span>
                </td>
                <td>
                    <button class="status ${statusClass} status-btn" style="border: none; cursor: pointer;"
                        onclick="openPortDetails('${placa}', '${pt}', '${safeInfo}', ${online}, ${offline}, ${total})">
                        ${statusText}
                    </button>
                </td>
            </tr>
        `;
    });
};

window.closeModal = function(event) {
    if (event && event.target.id !== 'detail-modal' && !event.target.classList.contains('close-modal')) return;
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
}

window.openPortDetails = function(placa, porta, circuito, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('#detail-modal .modal-content');
    modalContent.classList.remove('modal-large'); 

    const textoCircuito = (circuito && circuito !== "-") ? ` - Circuito: ${circuito}` : "";
    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta}${textoCircuito}`;
    document.getElementById('view-stats').style.display = 'flex';
    document.getElementById('view-clients').style.display = 'none';
    document.getElementById('modal-up').textContent = online;
    document.getElementById('modal-down').textContent = offline;
    document.getElementById('modal-total').textContent = total;
    modal.style.display = 'flex';
}

window.openCircuitClients = function(placa, porta, circuitoNome, oltType) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('#detail-modal .modal-content');
    modalContent.classList.add('modal-large');     

    document.getElementById('circuit-title-text').textContent = `Circuito: ${circuitoNome} (Placa ${placa}/Porta ${porta})`;
    document.getElementById('view-stats').style.display = 'none';
    document.getElementById('view-clients').style.display = 'block';
    document.getElementById('search-input').value = '';

    const statusSelect = document.getElementById('status-filter');
    statusSelect.innerHTML = '<option value="all">Todos Status</option>';
    if (oltType === 'nokia') {
        statusSelect.innerHTML += `<option value="online">Online (UP)</option><option value="offline">Offline (DOWN)</option>`;
    } else {
        statusSelect.innerHTML += `<option value="online">Online (Active)</option><option value="offline">Offline (Inactive)</option>`;
    }
    statusSelect.value = 'all'; 

    const thead = document.getElementById('clients-thead');
    const tbody = document.getElementById('clients-tbody');
    
    if (oltType === 'nokia') {
        thead.innerHTML = `<tr><th>Posição/Serial</th><th>Tipo/Perfil</th><th>Status</th><th>Descrição 1</th><th>Descrição 2</th></tr>`;
    } else {
        thead.innerHTML = `<tr><th>Posição</th><th>Status</th><th>Serial</th><th>Descrição</th></tr>`;
    }
    
    tbody.innerHTML = '';

    const portKey = `${placa}/${porta}`;
    const clients = window.OLT_CLIENTS_DATA[portKey] || [];

    if (clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${oltType === 'nokia' ? 5 : 4}" style="text-align:center;">Nenhum cliente encontrado.</td></tr>`;
    } else {
        clients.forEach(c => {
            let statusRaw = c.statusRef.toLowerCase();
            let statusClass = 'filter-unknown';
            if (oltType === 'nokia') {
                if (statusRaw.includes('up')) statusClass = 'filter-online';
                else if (statusRaw.includes('down')) statusClass = 'filter-offline';
            } else {
                if (statusRaw.includes('active') && !statusRaw.includes('inactive')) statusClass = 'filter-online';
                else if (statusRaw.includes('inactive')) statusClass = 'filter-offline';
            }
            
            let rowHTML = '';
            if (oltType === 'nokia') {
                rowHTML = `<tr class="client-row ${statusClass}"><td>${c.colB}</td><td>${c.colC}</td><td>${c.colE}</td><td>${c.colH}</td><td>${c.colI}</td></tr>`;
            } else {
                rowHTML = `<tr class="client-row ${statusClass}"><td>${c.colB}</td><td>${c.colC}</td><td>${c.colD}</td><td>${c.colH}</td></tr>`;
            }
            tbody.innerHTML += rowHTML;
        });
    }
    modal.style.display = 'flex';
}

window.filterClients = function() {
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    const rows = document.querySelectorAll('.client-row');
    
    rows.forEach(row => {
        const textContent = row.textContent.toLowerCase();
        let matchesSearch = textContent.includes(searchText);
        let matchesStatus = true;
        if (statusFilter === 'online') matchesStatus = row.classList.contains('filter-online');
        if (statusFilter === 'offline') matchesStatus = row.classList.contains('filter-offline');
        
        if (matchesSearch && matchesStatus) row.style.display = '';
        else row.style.display = 'none';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');
    if (isHomePage) {
        runGlobalNetworkOverview();
        setInterval(runGlobalNetworkOverview, ENGINE_REFRESH_SECONDS * 1000);
    }
});