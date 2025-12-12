// ==============================================================================
// olt-engine.js - Versão FINAL "Drill-Down Completo" (Lista Zebrada)
// ==============================================================================

const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

const TAB_CIRCUITOS = 'CIRCUITO'; 
const TABLE_HEADER_NAME = 'Circuitos'; 

// Mapa para o TEXTO RESUMIDO do botão na tabela (Coluna da OLT)
const OLT_COLUMN_MAP = {
    'HEL1':  1,  'HEL2':  3,  'MGP':   5,  'PQA1':  7,  'PSV1':  9,  'PSV7':  11,
    'SBO2':  13, 'SBO3':  15, 'SBO4':  17, 'SB1':   19, 'SB2':   21, 'SB3':   23,
    'PQA2':  25, 'PQA3':  27, 'LTXV2': 29, 'LTXV1': 31, 'SBO1':  33
};

// Variável Global para guardar os dados da planilha
window.GLOBAL_CIRCUIT_MAP = new Map();

// --- 1. GERA A CHAVE DE BUSCA (Conforme suas regras) ---
function getSearchKey(type, placa, porta) {
    const p = parseInt(porta);
    const sl = parseInt(placa);

    if (type === 'nokia') {
        return `1/1/${sl}/${p}`; // Regra Nokia
    } 
    else if (type === 'furukawa-10') {
        return `${sl}/${p}`;     // Regra SBO1 e LTXV1
    } 
    else { 
        return `GPON${sl}/${p}`; // Regra Outras Furukawa
    }
}

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) return;

    // --- 2. INJEÇÃO DO HTML DO MODAL ---
    if (!document.getElementById('detail-modal')) {
        const modalHTML = `
            <div id="detail-modal" class="modal-overlay" onclick="window.closeModal(event)">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="modal-title">Detalhes</h3>
                        <button class="close-modal" onclick="window.closeModal()">×</button>
                    </div>
                    <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
                        
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

                        <div id="modal-info-view" style="display:none;">
                            <div style="text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--m3-outline);">
                                <span style="font-size: 0.8em; color: var(--m3-on-surface-variant); text-transform: uppercase;">Referência Técnica (Coluna A):</span><br>
                                <code id="modal-tech-id" style="font-size: 1.4em; color: var(--m3-primary); font-weight: bold;">-</code>
                            </div>
                            
                            <div id="modal-full-list" style="display: flex; flex-direction: column; gap: 2px;">
                                </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // 3. Busca Planilha e Mapeia
    async function fetchAndMapData() {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${TAB_CIRCUITOS}!A:AZ?key=${ENGINE_API_KEY}`;
        try {
            const response = await fetch(url);
            if (!response.ok) return;
            const data = await response.json();
            const rows = data.values || [];
            
            window.GLOBAL_CIRCUIT_MAP.clear();
            rows.forEach(row => {
                if (row[0]) {
                    // Chave sempre maiúscula e sem espaços nas pontas
                    const key = String(row[0]).trim().toUpperCase();
                    window.GLOBAL_CIRCUIT_MAP.set(key, row);
                }
            });
            console.log(`[ENGINE] Mapa de Circuitos: ${window.GLOBAL_CIRCUIT_MAP.size} registros carregados.`);
        } catch (e) { console.error(e); }
    }

    // 4. Renderiza Tabelas
    async function populateTables() {
        // Limpa visual
        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        // Cria tabelas se não existirem
        if (container.innerHTML === "") {
            for (let i = 1; i <= config.boards; i++) {
                const pid = i.toString().padStart(2, '0');
                container.innerHTML += `
                    <table>
                        <thead>
                            <tr class="table-title-row"><th colspan="3">PLACA ${pid}</th></tr>
                            <tr class="table-header-row"><th>Porta</th><th>${TABLE_HEADER_NAME}</th><th>Status</th></tr>
                        </thead>
                        <tbody id="tbody-placa-${i}"></tbody>
                    </table>`;
            }
        }

        const rangeOlt = config.type === 'nokia' ? `${config.id}!A:E` : `${config.id}!A:C`;
        const urlOlt = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${rangeOlt}?key=${ENGINE_API_KEY}`;

        try {
            await fetchAndMapData(); // Garante dados frescos
            const responseOlt = await fetch(urlOlt);
            if (!responseOlt.ok) throw new Error('Erro API OLT');
            const dataOlt = await responseOlt.json();
            const rowsOlt = (dataOlt.values || []).slice(1);

            const portData = {};
            const newProblems = new Set(); 

            rowsOlt.forEach(columns => {
                if (columns.length === 0) return;
                let placa, porta, isOnline;

                // Parsing (Mesma lógica de sempre)
                if (config.type === 'nokia') {
                    const pon = columns[0];
                    const status = columns[4] || "";
                    if (!pon) return;
                    const parts = pon.split('/'); 
                    if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                    isOnline = status.toLowerCase().includes('up');
                } else { 
                    const portStr = columns[0];
                    const status = columns[2] || "";
                    if (!portStr) return;
                    if (config.type === 'furukawa-10') {
                        const parts = portStr.split('/');
                        if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                    } else {
                        const match = portStr.match(/GPON(\d+)\/(\d+)/);
                        if (match) { placa = match[1]; porta = match[2]; }
                    }
                    isOnline = status.toLowerCase() === 'active';
                }

                if (!placa || !porta) return;

                const portKey = `${parseInt(placa)}/${parseInt(porta)}`;
                if (!portData[portKey]) {
                    // --- GERAÇÃO DA CHAVE E BUSCA ---
                    const searchKey = getSearchKey(config.type, placa, porta);
                    const row = window.GLOBAL_CIRCUIT_MAP.get(searchKey.toUpperCase());
                    
                    // Texto do botão (apenas a coluna configurada)
                    const colIndex = OLT_COLUMN_MAP[config.id];
                    let infoButton = "-";
                    if (row && colIndex !== undefined && row[colIndex]) {
                        infoButton = row[colIndex];
                    }

                    portData[portKey] = { 
                        online: 0, offline: 0, 
                        info: infoButton, 
                        techId: searchKey // Chave para o modal usar
                    };
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

                // --- BOTÕES CLICÁVEIS ---
                const htmlRow = `
                    <tr>
                        <td>Porta ${porta.toString().padStart(2, '0')}</td>
                        <td>
                            <span class="circuit-badge" onclick="window.openGlobalTechDetails('${techId}')">
                                ${info}
                            </span>
                        </td>
                        <td>
                            <button class="status ${statusClass} status-btn" 
                                onclick="window.openPortDetails('${placa}', '${porta}', ${online}, ${offline}, ${total})">
                                ${statusText}
                            </button>
                        </td>
                    </tr>`;

                const tbody = document.getElementById(`tbody-placa-${placa}`);
                if (tbody) tbody.innerHTML += htmlRow;
            }

            if (typeof checkAndNotifyForNewProblems === 'function') checkAndNotifyForNewProblems(newProblems);

        } catch (error) { console.error(error); }
    }

    async function updateTime() {
        if (typeof loadTimestamp === 'function') await loadTimestamp(config.id, ENGINE_API_KEY, ENGINE_SHEET_ID);
    }

    const runUpdate = () => { populateTables(); updateTime(); };
    runUpdate(); 
    setInterval(runUpdate, ENGINE_REFRESH_SECONDS * 1000); 
}

// --- FUNÇÕES DO MODAL ---

window.closeModal = function(event) {
    if (event && event.target.id !== 'detail-modal') return;
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
}

window.openPortDetails = function(placa, porta, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    if(!modal) return;
    
    document.getElementById('modal-stats-view').style.display = 'grid';
    document.getElementById('modal-info-view').style.display = 'none';
    
    document.getElementById('modal-title').textContent = `Status: Placa ${placa} / Porta ${porta}`;
    document.getElementById('modal-up').textContent = online;
    document.getElementById('modal-down').textContent = offline;
    document.getElementById('modal-total').textContent = total;
    
    modal.style.display = 'flex';
}

// --- FUNÇÃO DO CLIQUE NO CIRCUITO (LISTA TUDO) ---
window.openGlobalTechDetails = function(techId) {
    const modal = document.getElementById('detail-modal');
    if(!modal) return;

    document.getElementById('modal-stats-view').style.display = 'none';
    document.getElementById('modal-info-view').style.display = 'block';
    
    document.getElementById('modal-title').textContent = `Dados do Circuito`;
    document.getElementById('modal-tech-id').textContent = techId;

    const listContainer = document.getElementById('modal-full-list');
    listContainer.innerHTML = ''; // Limpa anterior

    // Busca na memória
    const row = window.GLOBAL_CIRCUIT_MAP.get(techId.toUpperCase());

    if (row && row.length > 0) {
        // Percorre todas as colunas da linha
        row.forEach((cellData, index) => {
            if (index === 0) return; // Pula a Coluna A (Chave)
            
            if (cellData && cellData.toString().trim() !== "") {
                // Converte index 1 -> B, 2 -> C...
                const colLetter = String.fromCharCode(65 + index);
                
                // Cria HTML bonitinho para cada dado
                const itemHTML = `
                    <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 4px; display: flex; flex-direction: column; border-left: 3px solid var(--m3-primary);">
                        <span style="font-size: 0.75em; color: var(--m3-on-surface-variant); font-weight: bold;">COLUNA ${colLetter}</span>
                        <span style="font-size: 1em; color: var(--m3-on-surface); word-break: break-word;">${cellData}</span>
                    </div>
                `;
                listContainer.innerHTML += itemHTML;
            }
        });
    } else {
        listContainer.innerHTML = `<p style="color: var(--m3-color-error); text-align: center;">Nenhuma informação encontrada na planilha para a chave <strong>${techId}</strong>.</p>`;
    }
    
    modal.style.display = 'flex';
}