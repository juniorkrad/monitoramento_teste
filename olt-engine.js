// ==============================================================================
// olt-engine.js - Versão 6.1 (Correção de Escopo Global para Painel de Energia)
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

// Armazena dados dos clientes para o Pop-up
window.OLT_CLIENTS_DATA = {};

// ==============================================================================
// FUNÇÕES GLOBAIS (COMPARTILHADAS ENTRE OLTS E ENERGIA)
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
// MOTOR GLOBAL DE ENERGIA (DYING GASP)
// ==============================================================================

window.startEnergyMonitoring = async function() {
    const tableBody = document.getElementById('energy-table-body');
    const totalQuedasEl = document.getElementById('card-total-quedas');
    const portasAfetadasEl = document.getElementById('card-portas-afetadas');
    const lastUpdateEl = document.getElementById('card-last-update');
    const chartCtx = document.getElementById('energyChart');
    
    if (!tableBody) return;

    try {
        const urlEnergia = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/ENERGIA!A:D?key=${ENGINE_API_KEY}`;
        const resEnergia = await fetch(urlEnergia);
        const dataEnergia = await resEnergia.json();
        const rowsEnergia = dataEnergia.values ? dataEnergia.values.slice(1) : [];

        const portasComQueda = rowsEnergia.filter(r => parseInt(r[2]) > 0);
        let totalPowerOffGeral = 0;
        let ultimaAtt = "-";

        const oltsAfetadas = [...new Set(portasComQueda.map(r => r[0].replace('-', '')))];
        let clientesPorPorta = {}; 

        if (oltsAfetadas.length > 0) {
            const ranges = oltsAfetadas.map(olt => `ranges=${olt}!A:E`).join('&');
            const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values:batchGet?key=${ENGINE_API_KEY}&${ranges}`;
            
            const resBatch = await fetch(batchUrl);
            const dataBatch = await resBatch.json();

            if (dataBatch.valueRanges) {
                dataBatch.valueRanges.forEach(vr => {
                    const sheetName = vr.range.split('!')[0].replace(/'/g, ''); 
                    clientesPorPorta[sheetName] = {};
                    const rows = vr.values ? vr.values.slice(1) : [];

                    rows.forEach(col => {
                        if(col.length === 0) return;
                        let val0 = col[0];
                        let placa, porta;
                        
                        if (val0.includes('1/1/')) { 
                            let parts = val0.split('/');
                            if(parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                        } else if (val0.toLowerCase().startsWith('gpon')) { 
                            let match = val0.match(/GPON(\d+)\/(\d+)/i);
                            if(match) { placa = match[1]; porta = match[2]; }
                        } else if (val0.includes('/')) { 
                            let parts = val0.split('/');
                            placa = parts[0]; porta = parts[1];
                        }

                        if (placa && porta) {
                            let key = `${placa}/${porta}`; 
                            clientesPorPorta[sheetName][key] = (clientesPorPorta[sheetName][key] || 0) + 1;
                        }
                    });
                });
            }
        }

        // AQUI ESTÁ O SEGREDO: Agora a função consegue enxergar a fetchCircuitosData globalmente
        const rowsCircuitos = await fetchCircuitosData();

        let chartLabels = [];
        let chartData = [];
        tableBody.innerHTML = '';

        portasComQueda.sort((a, b) => parseInt(b[2]) - parseInt(a[2]));

        portasComQueda.forEach(row => {
            const oltName = row[0]; 
            const porta = row[1]; 
            const qtdPowerOff = parseInt(row[2]);
            const abaName = oltName.replace('-', '');
            ultimaAtt = row[3];

            totalPowerOffGeral += qtdPowerOff;

            const totalClientes = (clientesPorPorta[abaName] && clientesPorPorta[abaName][porta]) ? clientesPorPorta[abaName][porta] : qtdPowerOff;
            
            const isNokia = ['HEL1', 'HEL2', 'MGP', 'PQA1', 'PSV1'].includes(abaName);
            const oltType = isNokia ? 'nokia' : 'furukawa-10'; 
            
            const [placaNum, portaNum] = porta.split('/');
            const circuitoNome = getCircuitInfo(rowsCircuitos, abaName, placaNum, portaNum, oltType);

            const porcentagem = Math.round((qtdPowerOff / totalClientes) * 100);
            
            let statusBadge = `<span class="impact-badge impact-low">Mínimo</span>`; 
            if (porcentagem >= 50) statusBadge = `<span class="impact-badge impact-high">Crítico</span>`; 
            else if (porcentagem >= 20) statusBadge = `<span class="impact-badge impact-med">Atenção</span>`; 

            tableBody.innerHTML += `
                <tr>
                    <td style="font-weight: 700;">${oltName}</td>
                    <td>${porta}</td>
                    <td><span class="circuit-badge">${circuitoNome}</span></td>
                    <td>${totalClientes}</td>
                    <td style="color: #f87171; font-weight: bold;">${qtdPowerOff}</td>
                    <td>${porcentagem}%</td>
                    <td>${statusBadge}</td>
                </tr>
            `;

            if (chartLabels.length < 8) {
                chartLabels.push(`${oltName} (${porta})`);
                chartData.push(qtdPowerOff);
            }
        });

        if (portasComQueda.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--m3-on-surface-variant);">Nenhuma queda de energia detectada no momento!</td></tr>`;
        }

        if(totalQuedasEl) totalQuedasEl.innerText = totalPowerOffGeral;
        if(portasAfetadasEl) portasAfetadasEl.innerText = portasComQueda.length;
        if(lastUpdateEl) lastUpdateEl.innerText = ultimaAtt;

        if (chartCtx && window.Chart) {
            if (window.energyChartInstance) window.energyChartInstance.destroy();
            
            window.energyChartInstance = new Chart(chartCtx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Clientes Offline (Power Off)',
                        data: chartData,
                        backgroundColor: '#f87171',
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#EADDFF', font: { family: "'Montserrat', sans-serif" } } }
                    },
                    scales: {
                        y: { ticks: { color: '#EADDFF' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                        x: { ticks: { color: '#EADDFF' }, grid: { display: false } }
                    }
                }
            });
        }

    } catch (e) {
        console.error("Erro ao carregar o Painel de Energia:", e);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171; padding: 20px;">❌ Erro ao cruzar os dados. Verifique o console ou a conexão com a Planilha.</td></tr>`;
    }
};

if (window.location.pathname.includes('energia.html')) {
    setInterval(startEnergyMonitoring, ENGINE_REFRESH_SECONDS * 1000);
}