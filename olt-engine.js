// ==============================================================================
// olt-engine.js - Versão Final Corrigida (Busca Robusta + Click Funcional)
// ==============================================================================

const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

const TAB_CIRCUITOS = 'CIRCUITO'; 
const TABLE_HEADER_NAME = 'Circuitos'; 

// Mapa de Colunas (Onde está a info na planilha)
const OLT_COLUMN_MAP = {
    'HEL1':  1,  'HEL2':  3,  'MGP':   5,  'PQA1':  7,  'PSV1':  9,  'PSV7':  11,
    'SBO2':  13, 'SBO3':  15, 'SBO4':  17, 'SB1':   19, 'SB2':   21, 'SB3':   23,
    'PQA2':  25, 'PQA3':  27, 'LTXV2': 29, 'LTXV1': 31, 'SBO1':  33
};

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) return;

    // --- 1. INJEÇÃO DO MODAL (POP-UP) ---
    if (!document.getElementById('detail-modal')) {
        const modalHTML = `
            <div id="detail-modal" class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Detalhes</h3>
                        <button class="close-modal" onclick="closeModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div id="modal-stats-view" class="modal-stats-grid" style="display:none;">
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

                        <div id="modal-info-view" style="display:none; text-align: center;">
                            <p style="font-size: 0.9em; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-bottom: 10px;">Identificação Técnica (Planilha):</p>
                            <h2 id="modal-tech-id" style="color: var(--m3-primary); margin: 0 0 20px 0;">-</h2>
                            
                            <p style="font-size: 0.9em; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-bottom: 10px;">Informação do Circuito:</p>
                            <div id="modal-circuit-desc" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border: 1px solid var(--m3-outline); font-size: 1.1em;">
                                -
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
            if (!response.ok) {
                console.error("Erro HTTP ao baixar Circuitos:", response.status);
                return [];
            }
            const data = await response.json();
            return data.values || [];
        } catch (e) { 
            console.error("Erro de rede ao baixar Circuitos:", e);
            return []; 
        }
    }

    // Gera a chave de busca EXATAMENTE como descrito (Coluna A)
    function generateSearchKey(type, placa, porta) {
        const p = parseInt(porta);
        const sl = parseInt(placa);

        if (type === 'nokia') return `1/1/${sl}/${p}`; // Ex: 1/1/1/1
        else if (type === 'furukawa-10') return `${sl}/${p}`; // Ex: 1/1
        else return `GPON${sl}/${p}`; // Ex: GPON1/1
    }

    async function populateTables() {
        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        const rangeOlt = config.type === 'nokia' ? `${config.id}!A:E` : `${config.id}!A:C`;
        const urlOlt = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${rangeOlt}?key=${ENGINE_API_KEY}`;

        try {
            const [responseOlt, rowsCircuitos] = await Promise.all([fetch(urlOlt), fetchCircuitosData()]);
            
            if (!responseOlt.ok) throw new Error('Falha na API OLT');
            const dataOlt = await responseOlt.json();
            const rowsOlt = (dataOlt.values || []).slice(1);
            
            // --- CRIA MAPA DE BUSCA ---
            const circuitMap = new Map();
            rowsCircuitos.forEach(row => {
                if (row[0]) {
                    // Normaliza a chave (remove espaços e força string)
                    circuitMap.set(row[0].toString().trim(), row);
                }
            });

            console.log(`[DEBUG] Mapa de Circuitos carregado com ${circuitMap.size} linhas.`);

            const portData = {};
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

                const portKey = `${placa}/${porta}`;
                if (!portData[portKey]) {
                    const searchKey = generateSearchKey(config.type, placa, porta);
                    const row = circuitMap.get(searchKey);
                    const colIndex = OLT_COLUMN_MAP[config.id];
                    
                    let infoExtra = "-";
                    // Validação rigorosa para não dar erro
                    if (row && colIndex !== undefined && row[colIndex]) {
                        infoExtra = row[colIndex];
                    }

                    // Se infoExtra for vazio, coloca um traço para manter o clique funcional
                    if (infoExtra === "" || infoExtra === " ") infoExtra = "-";

                    portData[portKey] = { online: 0, offline: 0, info: infoExtra, techId: searchKey };
                }
                if (isOnline) portData[portKey].online++; else portData[portKey].offline++;
            });

            for (const portKey in portData) {
                const [placa, porta] = portKey.split('/');
                const { online, offline, info, techId } = portData[portKey];
                const total = online + offline;
                let statusClass = 'status-normal';
                let statusText = 'Normal';

                if (offline > 16) { statusClass = 'status-problema'; statusText = 'Problema'; }
                else if (offline === 16) { statusClass = 'status-atencao'; statusText = 'Atenção'; }
                else if (total > 0 && (offline / total) >= 0.5) { statusClass = 'status-problema'; statusText = 'Problema'; }

                if (statusClass === 'status-problema') newProblems.add(portKey);

                // --- GERAÇÃO HTML COM FUNÇÕES GLOBAIS ---
                const htmlRow = `
                    <tr>
                        <td>Porta ${porta.padStart(2, '0')}</td>
                        <td>
                            <span class="circuit-badge" style="cursor:pointer;" 
                                  onclick="window.openTechDetails('${placa}', '${porta}', '${techId}', '${info.replace(/'/g, "\\'")}')">
                                  ${info}
                            </span>
                        </td>
                        <td>
                            <button class="status ${statusClass} status-btn" 
                                onclick="window.openPortDetails('${placa}', '${porta}', ${online}, ${offline}, ${total})">
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

// --- FUNÇÕES GLOBAIS (WINDOW) PARA GARANTIR O CLIQUE ---
window.closeModal = function(event) {
    if (event && event.target.id !== 'detail-modal') return;
    const modal = document.getElementById('detail-modal');
    if(modal) modal.style.display = 'none';
}

window.openPortDetails = function(placa, porta, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    if(!modal) return;
    
    document.getElementById('modal-stats-view').style.display = 'grid';
    document.getElementById('modal-info-view').style.display = 'none';
    
    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta}`;
    document.getElementById('modal-up').textContent = online;
    document.getElementById('modal-down').textContent = offline;
    document.getElementById('modal-total').textContent = total;
    
    modal.style.display = 'flex';
}

window.openTechDetails = function(placa, porta, techId, infoDesc) {
    const modal = document.getElementById('detail-modal');
    if(!modal) return;

    document.getElementById('modal-stats-view').style.display = 'none';
    document.getElementById('modal-info-view').style.display = 'block';
    
    document.getElementById('modal-title').textContent = `Info da Porta`;
    document.getElementById('modal-tech-id').textContent = techId; // Mostra: 1/1/1/1 ou GPON1/1
    document.getElementById('modal-circuit-desc').textContent = infoDesc; // Mostra o texto da planilha
    
    modal.style.display = 'flex';
}