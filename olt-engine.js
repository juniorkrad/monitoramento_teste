// ==============================================================================
// olt-engine.js - Versão 7.4 (Sincronia de Gatilho Duplo - Energia)
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

const ENGINE_OLT_LIST = [
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
window.ENERGY_DATA_STORE = {};

// ==============================================================================
// FUNÇÕES GLOBAIS
// ==============================================================================

async function fetchCircuitosData() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${TAB_CIRCUITOS}!A:AK?key=${ENGINE_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return data.values || [];
    } catch (e) { return []; }
}

function getCircuitInfo(rowsCircuitos, oltId, placa, porta, type) {
    const colIndex = OLT_COLUMN_MAP[oltId];
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

// ==============================================================================
// MOTOR DE MONITORAMENTO DE OLTS (PÁGINAS INDIVIDUAIS)
// ==============================================================================

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) return;

    if (!document.getElementById('detail-modal')) {
        const modalStyles = `
            <style>
                .circuit-clickable { cursor: pointer; text-decoration: underline; color: #fff; font-weight: bold; }
                .circuit-clickable:hover { color: #ffd700; }
                .client-table-container { max-height: 400px; overflow-y: auto; margin-top: 10px; }
                .client-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; color: #333; }
                .client-table th { background-color: #007bff; color: white; padding: 8px; text-align: left; position: sticky; top: 0; z-index: 10; }
                .client-table td { border-bottom: 1px solid #ddd; padding: 6px 8px; color: #333; }
                .client-table tr:nth-child(even) { background-color: #f9f9f9; }
                .client-table tr:hover { background-color: #f1f1f1; }
                .modal-section-title { font-size: 1.1rem; margin-bottom: 10px; border-bottom: 2px solid #eee; padding-bottom: 5px; }
                
                .modal-content { background-color: #2f0e51; color: #EADDFF; border: 1px solid #5c4e72; }
                .client-table th { background-color: #3a1c63; color: #fff; }
                .client-table td { color: #EADDFF; border-bottom: 1px solid #5c4e72; }
                .client-table tr:nth-child(even) { background-color: rgba(0,0,0,0.2); }
                .client-table tr:hover { background-color: rgba(255,255,255,0.1); }
                
                .filter-bar { display: flex; gap: 10px; margin-bottom: 10px; }
                .filter-input { flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #5c4e72; background-color: rgba(0,0,0,0.2); color: #fff; }
                .filter-select { padding: 8px; border-radius: 4px; border: 1px solid #5c4e72; background-color: #3a1c63; color: #fff; cursor: pointer; }
                
                .modal-view-stats { display: flex; }
                .modal-view-clients { display: none; }
            </style>
        `;

        const modalHTML = `
            ${modalStyles}
            <div id="detail-modal" class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Detalhes</h3>
                        <button class="close-modal" onclick="closeModal()">×</button>
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
                                <table class="client-table" id="table-clients">
                                    <thead id="clients-thead"></thead>
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

    function createTableStructure() {
        container.innerHTML = ''; 
        for (let i = 1; i <= config.boards; i++) {
            const placaId = i.toString().padStart(2, '0');
            const colunasBase = '<th>Porta</th>'; 
            const colunasFinais = `<th>${TABLE_HEADER_NAME}</th><th>Status</th>`;

            container.innerHTML += `
                <table>
                    <thead>
                        <tr class="table-title-row"><th colspan="3">PLACA ${placaId}</th></tr>
                        <tr class="table-header-row">${colunasBase}${colunasFinais}</tr>
                    </thead>
                    <tbody id="tbody-placa-${i}"></tbody>
                </table>
            `;
        }
    }

    async function populateTables() {
        window.OLT_CLIENTS_DATA = {}; 

        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        const rangeOlt = `${config.id}!A:I`; 
        const urlOlt = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${rangeOlt}?key=${ENGINE_API_KEY}`;

        try {
            const [responseOlt, rowsCircuitos] = await Promise.all([fetch(urlOlt), fetchCircuitosData()]);
            if (!responseOlt.ok) throw new Error('Falha API');
            const dataOlt = await responseOlt.json();
            const rowsOlt = (dataOlt.values || []).slice(1);
            
            const portData = {};
            const boardStats = {}; 
            const newProblems = new Set(); 

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
                const portKey = `${placa}/${porta}`;
                
                if (!portData[portKey]) {
                    const infoExtra = getCircuitInfo(rowsCircuitos, config.id, placa, porta, config.type);
                    portData[portKey] = { online: 0, offline: 0, info: infoExtra };
                    window.OLT_CLIENTS_DATA[portKey] = [];
                }

                if (!boardStats[placa]) boardStats[placa] = { total: 0, offline: 0 };

                if (isOnline) portData[portKey].online++;
                else portData[portKey].offline++;
                
                boardStats[placa].total++;
                if (!isOnline) boardStats[placa].offline++;

                let clientData = {};
                if (config.type === 'nokia') {
                    clientData = { colB: columns[1] || '', colC: columns[2] || '', colE: columns[4] || '', colH: columns[7] || '', colI: columns[8] || '', statusRef: columns[4] || '' };
                } else {
                    clientData = { colB: columns[1] || '', colC: columns[2] || '', colD: columns[3] || '', colH: columns[7] || '', statusRef: columns[2] || '' };
                }
                
                window.OLT_CLIENTS_DATA[portKey].push(clientData);
            });

            for (const placa in boardStats) {
                const bStat = boardStats[placa];
                if (bStat.total >= 5 && bStat.offline === bStat.total) {
                    newProblems.add(`[${config.id} PLACA ${placa}] FALHA::SUPER`);
                }
            }

            for (const portKey in portData) {
                const [placa, porta] = portKey.split('/');
                const { online, offline, info } = portData[portKey];
                const total = online + offline;
                
                let statusClass = 'status-normal';
                let statusText = 'Normal';
                let alertTag = '::NORMAL';

                const percOffline = total > 0 ? (offline / total) : 0;

                if (total >= 5) {
                    if (percOffline === 1) {
                        statusClass = 'status-critico'; 
                        statusText = 'Crítico';
                        alertTag = '::SUPER';
                    } else if (percOffline >= 0.5 || offline >= 32) {
                        statusClass = 'status-problema'; 
                        statusText = 'Problema';
                        alertTag = '::CRIT';
                    } else if (offline >= 16) {
                        statusClass = 'status-atencao';
                        statusText = 'Atenção';
                        alertTag = '::WARN';
                    }
                } else {
                    statusClass = 'status-normal';
                    statusText = 'Normal';
                    alertTag = '::NORMAL';
                }

                if (alertTag !== '::NORMAL') newProblems.add(`[${config.id} PORTA ${porta}] ${alertTag}`);

                const htmlRow = `
                    <tr>
                        <td>Porta ${porta.padStart(2, '0')}</td>
                        <td>
                            <span class="circuit-badge circuit-clickable" 
                                  onclick="openCircuitClients('${placa}', '${porta}', '${info}', '${config.type}')"
                                  title="Ver clientes deste circuito">
                                ${info}
                            </span>
                        </td>
                        <td>
                            <button class="status ${statusClass} status-btn" 
                                onclick="openPortDetails('${placa}', '${porta}', '${info}', ${online}, ${offline}, ${total})">
                                ${statusText}
                            </button>
                        </td>
                    </tr>
                `;

                const targetTbody = document.getElementById(`tbody-placa-${placa}`);
                if (targetTbody) targetTbody.innerHTML += htmlRow;
            }

            // checkAndNotifyForNewProblems é chamado aqui para as páginas de OLT, mas os toasts só aparecem na Home.
            if (typeof checkAndNotifyForNewProblems === 'function') checkAndNotifyForNewProblems(newProblems);

        } catch (error) { console.error('Erro na engine:', error); }
    }

    async function updateTime() {
        if (typeof loadTimestamp === 'function') await loadTimestamp(config.id, ENGINE_API_KEY, ENGINE_SHEET_ID);
    }

    createTableStructure();
    const runUpdate = () => { populateTables(); updateTime(); };
    runUpdate(); 
    setInterval(runUpdate, ENGINE_REFRESH_SECONDS * 1000); 
}

function closeModal(event) {
    if (event && event.target.id !== 'detail-modal') return;
    document.getElementById('detail-modal').style.display = 'none';
}

function openPortDetails(placa, porta, circuito, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('.modal-content');
    modalContent.classList.remove('modal-large'); 
    modalContent.classList.add('modal-status');   

    const textoCircuito = (circuito && circuito !== "-") ? ` - Circuito: ${circuito}` : "";
    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta}${textoCircuito}`;
    document.getElementById('view-stats').style.display = 'flex';
    document.getElementById('view-clients').style.display = 'none';
    document.getElementById('modal-up').textContent = online;
    document.getElementById('modal-down').textContent = offline;
    document.getElementById('modal-total').textContent = total;
    modal.style.display = 'flex';
}

window.CURRENT_MODAL_TYPE = '';

function openCircuitClients(placa, porta, circuitoNome, oltType) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('.modal-content');
    modalContent.classList.remove('modal-status'); 
    modalContent.classList.add('modal-large');     
    window.CURRENT_MODAL_TYPE = oltType; 

    const tableObj = document.getElementById('table-clients');
    tableObj.className = 'client-table ' + (oltType === 'nokia' ? 'mode-nokia' : 'mode-furukawa');

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
    thead.innerHTML = ''; tbody.innerHTML = '';

    const portKey = `${placa}/${porta}`;
    const clients = window.OLT_CLIENTS_DATA[portKey] || [];

    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum cliente encontrado.</td></tr>';
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

function filterClients() {
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

// ==============================================================================
// MOTOR GLOBAL DE ENERGIA (DYING GASP) - LAYOUT CARDS E MODAL PLACAS
// ==============================================================================

window.startEnergyMonitoring = async function() {
    const gridEl = document.getElementById('energy-olt-grid');
    if (!gridEl) return;

    try {
        window.ENERGY_DATA_STORE = {
            global: { powerOff: 0, totalClients: 0, oltsAffected: 0, totalOffline: 0 },
            olts: {} 
        };

        ENGINE_OLT_LIST.forEach(olt => {
            window.ENERGY_DATA_STORE.olts[olt.id] = {
                id: olt.id, type: olt.type, totalClients: 0, online: 0, offline: 0, powerOff: 0, offlineOther: 0, lastUpdate: '--/-- --:--',
                ports: {}
            };
        });

        const ranges = ['ENERGIA!A:D', 'CIRCUITO!A:AK'].concat(ENGINE_OLT_LIST.map(o => o.type === 'nokia' ? `${o.sheetTab}!A:E` : `${o.sheetTab}!A:C`));
        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values:batchGet?key=${ENGINE_API_KEY}&ranges=${ranges.join('&ranges=')}`;
        
        const resBatch = await fetch(batchUrl);
        const dataBatch = await resBatch.json();

        if (!dataBatch.valueRanges) throw new Error("Falha na estrutura de retorno da API");

        const rowsCircuitos = dataBatch.valueRanges[1].values || [];

        ENGINE_OLT_LIST.forEach((olt, index) => {
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
                        const circ = getCircuitInfo(rowsCircuitos, sheetAbaName, placa, porta, olt.type);
                        oltData.ports[placa][porta] = { total: 0, online: 0, offline: 0, powerOff: 0, circuit: circ };
                    }

                    oltData.ports[placa][porta].total++;
                    if (isOnline) {
                        oltData.ports[placa][porta].online++;
                        oltData.online++;
                    } else {
                        oltData.ports[placa][porta].offline++;
                        oltData.offline++;
                        window.ENERGY_DATA_STORE.global.totalOffline++; // Incrementa global de Offline
                    }
                    
                    oltData.totalClients++;
                    window.ENERGY_DATA_STORE.global.totalClients++;
                }
            });
        });

        const rowsEnergia = dataBatch.valueRanges[0].values ? dataBatch.valueRanges[0].values.slice(1) : [];
        rowsEnergia.forEach(row => {
            const oltId = row[0]; 
            const portaFull = row[1]; 
            const qtd = parseInt(row[2]) || 0;
            const lastUpdate = row[3] || '--/-- --:--';

            const oltData = window.ENERGY_DATA_STORE.olts[oltId];
            if (oltData && qtd > 0) {
                const parts = portaFull.split('/');
                const placa = parts[0];
                const porta = parts[1];

                if (!oltData.ports[placa]) oltData.ports[placa] = {};
                if (!oltData.ports[placa][porta]) {
                    const sheetAbaName = oltId.replace('-', '');
                    const circ = getCircuitInfo(rowsCircuitos, sheetAbaName, placa, porta, oltData.type);
                    oltData.ports[placa][porta] = { total: qtd, online: 0, offline: qtd, powerOff: 0, circuit: circ };
                }

                oltData.ports[placa][porta].powerOff = qtd;
                oltData.powerOff += qtd;
                oltData.lastUpdate = lastUpdate;
                window.ENERGY_DATA_STORE.global.powerOff += qtd;
            }
        });

        ENGINE_OLT_LIST.forEach(olt => {
            const oData = window.ENERGY_DATA_STORE.olts[olt.id];
            oData.offlineOther = Math.max(0, oData.offline - oData.powerOff);
            if (oData.powerOff > 0) window.ENERGY_DATA_STORE.global.oltsAffected++;
        });

        // ==========================================
        // ATUALIZAÇÃO DA INTERFACE (UI)
        // ==========================================

        const globalPerc = window.ENERGY_DATA_STORE.global.totalClients > 0 
            ? ((window.ENERGY_DATA_STORE.global.powerOff / window.ENERGY_DATA_STORE.global.totalClients) * 100).toFixed(1) 
            : 0;

        const globalRelativoPerc = window.ENERGY_DATA_STORE.global.totalOffline > 0 
            ? ((window.ENERGY_DATA_STORE.global.powerOff / window.ENERGY_DATA_STORE.global.totalOffline) * 100).toFixed(1) 
            : 0;
        
        document.getElementById('global-poweroff-total').innerText = window.ENERGY_DATA_STORE.global.powerOff;
        document.getElementById('global-olts-afetadas').innerText = window.ENERGY_DATA_STORE.global.oltsAffected;
        document.getElementById('global-impacto-perc').innerText = `${globalPerc}%`;
        
        const elRelativo = document.getElementById('global-offline-relativo-perc');
        if(elRelativo) elRelativo.innerText = `${globalRelativoPerc}%`;

        gridEl.innerHTML = '';
        let chartLabels = [];
        let chartData = [];

        ENGINE_OLT_LIST.forEach(oltDef => {
            const oData = window.ENERGY_DATA_STORE.olts[oltDef.id];
            
            // Cálculos para a barrinha tríplice
            const pctOnline = oData.totalClients ? (oData.online / oData.totalClients * 100) : 0;
            const pctPowerOff = oData.totalClients ? (oData.powerOff / oData.totalClients * 100) : 0;
            const pctOfflineOther = oData.totalClients ? (oData.offlineOther / oData.totalClients * 100) : 0;
            
            // Geração da UI dos Cards com as novas Cores
            gridEl.innerHTML += `
                <div class="overview-card" style="display: flex; flex-direction: column;">
                    <div class="energy-olt-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">dns</span> ${oData.id}
                        </h3>
                        <button class="btn-energy-details" onclick="window.openEnergyModal('${oData.id}')" title="Ver Detalhes">
                            <span class="material-symbols-rounded" style="font-size: 22px;">pageview</span>
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
            
            if (oData.powerOff > 0) {
                chartLabels.push(oData.id);
                chartData.push(oData.powerOff);
            }
        });

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
        gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #f87171; padding: 40px;">❌ Erro ao cruzar dados. Verifique o console ou a conexão com a API.</div>`;
    }
};

// ==============================================================================
// CONTROLE DO MODAL DE DETALHES DE ENERGIA (PLACAS E PORTAS)
// ==============================================================================

window.openEnergyModal = function(oltId) {
    const modal = document.getElementById('energy-detail-modal');
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
            
            // --- CÁLCULO ATUALIZADO (GATILHO DUPLO SINCROMIZADO COM A HOME) ---
            const perc = pData.powerOff / pData.total;
            const percDisplay = Math.round(perc * 100);
            
            let statusBadge = `<span class="impact-badge impact-low">Mínimo</span>`; 
            
            if ((perc >= 0.5 && pData.powerOff >= 10) || (perc === 1 && pData.total >= 5)) {
                statusBadge = `<span class="impact-badge impact-high">Crítico</span>`; 
            } else if (perc >= 0.2 && pData.powerOff >= 5) {
                statusBadge = `<span class="impact-badge impact-med">Atenção</span>`; 
            }
            // ------------------------------------------------------------------

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

// Auto-Refresh nativo da página
if (window.location.pathname.includes('energia.html')) {
    setInterval(startEnergyMonitoring, ENGINE_REFRESH_SECONDS * 1000);
}