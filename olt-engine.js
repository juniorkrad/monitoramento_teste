// ==============================================================================
// olt-engine.js - Versão Final (Visual Correto + Chaves de Busca Precisas)
// ==============================================================================

const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

const TAB_CIRCUITOS = 'CIRCUITO'; 
const TABLE_HEADER_NAME = 'Circuitos'; 

// Mapa de Colunas (Onde está a info descritiva na planilha)
const OLT_COLUMN_MAP = {
    'HEL1':  1,  'HEL2':  3,  'MGP':   5,  'PQA1':  7,  'PSV1':  9,  'PSV7':  11,
    'SBO2':  13, 'SBO3':  15, 'SBO4':  17, 'SB1':   19, 'SB2':   21, 'SB3':   23,
    'PQA2':  25, 'PQA3':  27, 'LTXV2': 29, 'LTXV1': 31, 'SBO1':  33
};

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) return;

    // --- 1. INJEÇÃO DO MODAL ---
    if (!document.getElementById('detail-modal')) {
        const modalHTML = `
            <div id="detail-modal" class="modal-overlay" onclick="window.closeModal(event)">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Detalhes</h3>
                        <button class="close-modal" onclick="window.closeModal()">×</button>
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
                            <p style="font-size: 0.9em; color: var(--m3-on-surface-variant); margin-bottom: 5px;">Descrição do Circuito:</p>
                            <h3 id="modal-desc-text" style="color: var(--m3-primary); margin: 0 0 20px 0;">-</h3>
                            
                            <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border: 1px solid var(--m3-outline); text-align: left;">
                                <p style="font-size: 0.85em; color: var(--m3-on-surface-variant); margin: 0 0 5px 0;">Referência Técnica (Coluna A):</p>
                                <code id="modal-tech-id" style="font-size: 1.2em; font-weight: bold; color: var(--m3-on-surface);">-</code>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 2. Estrutura da Tabela
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

    // --- GERAÇÃO DA CHAVE DE BUSCA (REGRA DE NEGÓCIO) ---
    function generateSearchKey(type, placa, porta) {
        const p = parseInt(porta);
        const sl = parseInt(placa);

        if (type === 'nokia') {
            // Regra: 1/1/1/1 (1/1/Placa/Porta)
            return `1/1/${sl}/${p}`;
        } 
        else if (type === 'furukawa-10') {
            // Regra: 1/1 (Placa/Porta) - Para SBO1 e LTXV1
            return `${sl}/${p}`;
        } 
        else { 
            // Regra: GPON1/1 (GPONPlaca/Porta) - Para as demais Furukawa
            return `GPON${sl}/${p}`;
        }
    }

    // Limpa strings para evitar quebra do HTML no onclick
    function escapeHtml(text) {
        if (!text) return "";
        return text.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
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
            
            if (!responseOlt.ok) throw new Error('Falha API');
            const dataOlt = await responseOlt.json();
            const rowsOlt = (dataOlt.values || []).slice(1);
            
            // Mapa de Busca (Chave da Coluna A -> Linha Inteira)
            const circuitMap = new Map();
            rowsCircuitos.forEach(row => {
                if (row[0]) {
                    const key = row[0].toString().trim().toUpperCase();
                    circuitMap.set(key, row);
                }
            });

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
                    // 1. Gera a chave técnica (ex: GPON1/1)
                    const searchKey = generateSearchKey(config.type, placa, porta);
                    
                    // 2. Busca na planilha usando essa chave
                    const row = circuitMap.get(searchKey.toUpperCase());
                    const colIndex = OLT_COLUMN_MAP[config.id];
                    
                    // 3. Pega a descrição visual (ex: "Link Bairro")
                    let infoExtra = (row && colIndex !== undefined && row[colIndex]) ? row[colIndex] : "-";
                    if(infoExtra.trim() === "") infoExtra = "-";

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

                const safeInfo = escapeHtml(info);
                const safeTechId = escapeHtml(techId);

                const htmlRow = `
                    <tr>
                        <td>Porta ${porta.padStart(2, '0')}</td>
                        <td>
                            <span class="circuit-badge" style="cursor:pointer;" 
                                  onclick="window.openTechDetails('${safeInfo}', '${safeTechId}')">
                                  ${safeInfo}
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

// --- FUNÇÕES GLOBAIS (WINDOW) ---
window.closeModal = function(event) {
    if (event && event.target.id !== 'detail-modal') return;
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
}

window.openPortDetails = function(placa, porta, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    document.getElementById('modal-stats-view').style.display = 'grid';
    document.getElementById('modal-info-view').style.display = 'none';
    
    document.getElementById('modal-title').textContent = `Status: Placa ${placa} / Porta ${porta}`;
    document.getElementById('modal-up').textContent = online;
    document.getElementById('modal-down').textContent = offline;
    document.getElementById('modal-total').textContent = total;
    modal.style.display = 'flex';
}

window.openTechDetails = function(infoText, techId) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    document.getElementById('modal-stats-view').style.display = 'none';
    document.getElementById('modal-info-view').style.display = 'block';
    
    document.getElementById('modal-title').textContent = `Detalhes do Circuito`;
    document.getElementById('modal-desc-text').textContent = infoText; // O texto "Link Bairro X"
    document.getElementById('modal-tech-id').textContent = techId;     // A chave técnica "GPON1/1"
    modal.style.display = 'flex';
}