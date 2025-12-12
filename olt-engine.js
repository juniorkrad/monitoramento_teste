// ==============================================================================
// olt-engine.js - Versão Final (Tamanhos de Modal Dinâmicos)
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

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) return;

    // --- 1. INJEÇÃO DO MODAL (POP-UP) NA PÁGINA ---
    if (!document.getElementById('detail-modal')) {
        const modalStyles = `
            <style>
                .circuit-clickable { cursor: pointer; text-decoration: underline; color: #fff; font-weight: bold; }
                .circuit-clickable:hover { color: #ffd700; }
                .client-table-container { max-height: 400px; overflow-y: auto; margin-top: 15px; }
                .client-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; color: #333; }
                .client-table th { background-color: #007bff; color: white; padding: 8px; text-align: left; position: sticky; top: 0; z-index: 10; }
                .client-table td { border-bottom: 1px solid #ddd; padding: 6px 8px; color: #333; }
                .client-table tr:nth-child(even) { background-color: #f9f9f9; }
                .client-table tr:hover { background-color: #f1f1f1; }
                .modal-section-title { font-size: 1.1rem; margin-bottom: 10px; border-bottom: 2px solid #eee; padding-bottom: 5px; }
                
                /* Tema Escuro para Modal (ajuste para combinar com o styles.css geral) */
                .modal-content { background-color: #2f0e51; color: #EADDFF; border: 1px solid #5c4e72; }
                .client-table th { background-color: #3a1c63; color: #fff; }
                .client-table td { color: #EADDFF; border-bottom: 1px solid #5c4e72; }
                .client-table tr:nth-child(even) { background-color: rgba(0,0,0,0.2); }
                .client-table tr:hover { background-color: rgba(255,255,255,0.1); }
                
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
                            <div class="modal-section-title">Clientes do Circuito</div>
                            <div class="client-table-container">
                                <table class="client-table">
                                    <thead id="clients-thead">
                                        </thead>
                                    <tbody id="clients-tbody">
                                        </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 2. Cria a estrutura HTML
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

    async function populateTables() {
        window.OLT_CLIENTS_DATA = {}; // Limpa cache

        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        const rangeOlt = `${config.id}!A:H`; 
        const urlOlt = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${rangeOlt}?key=${ENGINE_API_KEY}`;

        try {
            const [responseOlt, rowsCircuitos] = await Promise.all([fetch(urlOlt), fetchCircuitosData()]);
            if (!responseOlt.ok) throw new Error('Falha API');
            const dataOlt = await responseOlt.json();
            const rowsOlt = (dataOlt.values || []).slice(1);
            const portData = {};
            const newProblems = new Set(); 

            rowsOlt.forEach(columns => {
                if (columns.length === 0) return;
                let placa, porta, isOnline;

                // --- Lógica de Identificação (Coluna A) ---
                if (config.type === 'nokia') {
                    // Nokia: 1/1/Slot/Port
                    const pon = columns[0];
                    const status = columns[4]; // Status Nokia Col E
                    
                    if (!pon || !status) return;
                    const parts = pon.split('/'); 
                    if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                    isOnline = status.trim().toLowerCase().includes('up');
                } else { 
                    // Furukawa (Todas)
                    const portStr = columns[0];
                    const status = columns[2]; // Status Furukawa Col C
                    if (!portStr || !status) return;
                    
                    if (config.type === 'furukawa-10') {
                        // SBO1 e LTXV1: Slot/Port (ex: 1/1)
                        const parts = portStr.split('/');
                        if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                    } else {
                        // Outras Furukawa: GPONSlot/Port (ex: GPON1/1)
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

                if (isOnline) portData[portKey].online++; else portData[portKey].offline++;

                // --- Lógica de Coleta de Dados para o POP-UP ---
                let clientData = {};
                
                if (config.type === 'nokia') {
                    // Nokia: Coleta Col B, C, E, G, H
                    clientData = {
                        colB: columns[1] || '',
                        colC: columns[2] || '',
                        colE: columns[4] || '',
                        colG: columns[6] || '',
                        colH: columns[7] || ''
                    };
                } else {
                    // Furukawa (Todas): Coleta Col B, C, D
                    clientData = {
                        colB: columns[1] || '',
                        colC: columns[2] || '',
                        colD: columns[3] || ''
                    };
                }
                
                window.OLT_CLIENTS_DATA[portKey].push(clientData);
            });

            // Renderização da Tabela
            for (const portKey in portData) {
                const [placa, porta] = portKey.split('/');
                const { online, offline, info } = portData[portKey];
                const total = online + offline;
                let statusClass = 'status-normal';
                let statusText = 'Normal';

                if (offline > 16) { statusClass = 'status-problema'; statusText = 'Problema'; }
                else if (offline === 16) { statusClass = 'status-atencao'; statusText = 'Atenção'; }
                else if (total > 0 && (offline / total) >= 0.5) { statusClass = 'status-problema'; statusText = 'Problema'; }

                if (statusClass === 'status-problema') newProblems.add(portKey);

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
                                onclick="openPortDetails('${placa}', '${porta}', ${online}, ${offline}, ${total})">
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

// --- FUNÇÕES DO MODAL (POP-UP) ---

function closeModal(event) {
    if (event && event.target.id !== 'detail-modal') return;
    document.getElementById('detail-modal').style.display = 'none';
}

// Abre detalhes de Estatísticas (MODAL PEQUENO)
function openPortDetails(placa, porta, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    
    // Remove classe de modal grande se existir
    document.querySelector('.modal-content').classList.remove('modal-large');

    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta} - Status`;
    
    document.getElementById('view-stats').style.display = 'flex';
    document.getElementById('view-clients').style.display = 'none';

    document.getElementById('modal-up').textContent = online;
    document.getElementById('modal-down').textContent = offline;
    document.getElementById('modal-total').textContent = total;
    modal.style.display = 'flex';
}

// Abre lista de Clientes (MODAL GRANDE)
function openCircuitClients(placa, porta, circuitoNome, oltType) {
    const modal = document.getElementById('detail-modal');
    
    // Adiciona classe para expandir o modal
    document.querySelector('.modal-content').classList.add('modal-large');

    document.getElementById('modal-title').textContent = `Circuito: ${circuitoNome} (Placa ${placa}/Porta ${porta})`;

    document.getElementById('view-stats').style.display = 'none';
    document.getElementById('view-clients').style.display = 'block';

    const thead = document.getElementById('clients-thead');
    const tbody = document.getElementById('clients-tbody');
    
    // Limpa conteúdo anterior
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Define Cabeçalho e Renderiza Linhas com base no Tipo
    const portKey = `${placa}/${porta}`;
    const clients = window.OLT_CLIENTS_DATA[portKey] || [];

    if (oltType === 'nokia') {
        // Cabeçalho Nokia
        thead.innerHTML = `
            <tr>
                <th>Col B</th>
                <th>Col C</th>
                <th>Col E</th>
                <th>Col G</th>
                <th>Col H</th>
            </tr>
        `;
        
        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum cliente encontrado.</td></tr>';
        } else {
            clients.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td>${c.colB}</td>
                        <td>${c.colC}</td>
                        <td>${c.colE}</td>
                        <td>${c.colG}</td>
                        <td>${c.colH}</td>
                    </tr>
                `;
            });
        }

    } else {
        // Cabeçalho Furukawa (Todas)
        thead.innerHTML = `
            <tr>
                <th>Col B</th>
                <th>Col C</th>
                <th>Col D</th>
            </tr>
        `;

        if (clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum cliente encontrado.</td></tr>';
        } else {
            clients.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td>${c.colB}</td>
                        <td>${c.colC}</td>
                        <td>${c.colD}</td>
                    </tr>
                `;
            });
        }
    }

    modal.style.display = 'flex';
}