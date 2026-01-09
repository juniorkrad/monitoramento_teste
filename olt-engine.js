// ==============================================================================
// olt-engine.js - Versão 6.0 (Leitura Local JSON)
// ==============================================================================

// Configuração de atualização (em segundos)
const ENGINE_REFRESH_SECONDS = 60; // Agora podemos atualizar mais rápido pois é local
const TABLE_HEADER_NAME = 'Circuitos'; 

// Armazena dados dos clientes para o Pop-up
window.OLT_CLIENTS_DATA = {};

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) return;

    // --- 1. INJEÇÃO DO MODAL (POP-UP) ---
    if (!document.getElementById('detail-modal')) {
        injectModalHTML(config);
    }

    // --- 2. CRIA A ESTRUTURA DAS TABELAS (PLACAS) ---
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

    // --- 3. FUNÇÃO PRINCIPAL: LER JSON E POVOA TABELAS ---
    async function populateTables() {
        window.OLT_CLIENTS_DATA = {}; // Limpa cache da memória

        // Limpa as tabelas visualmente antes de preencher
        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        // Adiciona timestamp para garantir que o navegador não use cache antigo
        const url = `dados.json?t=${new Date().getTime()}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Arquivo dados.json não encontrado ou erro de leitura.');
            
            const rowsOlt = await response.json(); // O Python já salva como Lista de Listas
            
            const portData = {};
            const boardStats = {}; 
            const newProblems = new Set(); 

            // Percorre cada linha do JSON gerado pelo Python
            rowsOlt.forEach(columns => {
                if (!columns || columns.length === 0) return;
                
                let placa, porta, isOnline, circuitName = "-";

                // --- Lógica de Interpretação Baseada no Tipo ---
                if (config.type === 'nokia') {
                    // Nokia Script: Col 0 (Porta 1/1/x/x), Col 4 (Status)
                    const pon = columns[0];
                    const status = columns[4]; 
                    
                    if (!pon || !status) return;
                    
                    const parts = pon.split('/'); 
                    if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                    
                    isOnline = status.trim().toLowerCase().includes('up');
                    
                    // Nota: O script Nokia atual não está cruzando descrições, 
                    // então usamos a coluna 2 (Serial/Desc) se houver, ou traço.
                    circuitName = columns[2] || "-"; 

                } else { 
                    // Furukawa Script: Col 0 (Porta), Col 2 (Status), Col 7 (Descrição/Circuito)
                    const portStr = columns[0];
                    const status = columns[2]; 
                    const descPython = columns[7]; // O Python salva a descrição na coluna 8 (index 7)

                    if (!portStr || !status) return;
                    
                    if (config.type === 'furukawa-10') {
                        const parts = portStr.split('/');
                        if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                    } else {
                        // Padrão GPON 0/x
                        const match = portStr.match(/(?:GPON)?\s*(\d+)\/(\d+)/i);
                        if (match) { placa = match[1]; porta = match[2]; }
                    }

                    isOnline = (status.trim().toLowerCase() === 'active');
                    circuitName = descPython || "-";
                }

                // Validação básica se conseguiu extrair placa/porta
                if (!placa || !porta) return;
                
                // Converte para inteiros para remover zeros à esquerda (ex: "01" vira 1)
                placa = parseInt(placa).toString();
                porta = parseInt(porta).toString();

                const portKey = `${placa}/${porta}`;
                
                // Inicializa dados da Porta se for a primeira vez que vemos ela
                if (!portData[portKey]) {
                    portData[portKey] = { online: 0, offline: 0, info: circuitName };
                    window.OLT_CLIENTS_DATA[portKey] = [];
                }

                // Inicializa estatísticas da Placa
                if (!boardStats[placa]) {
                    boardStats[placa] = { total: 0, offline: 0 };
                }

                // Contabiliza
                if (isOnline) {
                    portData[portKey].online++;
                } else {
                    portData[portKey].offline++;
                }
                
                boardStats[placa].total++;
                if (!isOnline) boardStats[placa].offline++;

                // --- Armazena dados detalhados para o Modal ---
                let clientData = {};
                if (config.type === 'nokia') {
                    clientData = {
                        colB: columns[1] || '', // ID/Serial
                        colC: columns[2] || '', // Desc
                        colE: columns[4] || '', // Status
                        colH: columns[7] || '', // Extra
                        colI: columns[8] || '', // Extra
                        statusRef: columns[4] || '' 
                    };
                } else {
                    clientData = {
                        colB: columns[1] || '', // ID
                        colC: columns[2] || '', // Status
                        colD: columns[3] || '', // Serial/Dist
                        colH: columns[7] || '', // Descrição (Circuito)
                        statusRef: columns[2] || '' 
                    };
                }
                window.OLT_CLIENTS_DATA[portKey].push(clientData);
            });

            // --- DETECÇÃO DE PROBLEMAS (Lógica mantida) ---
            for (const placa in boardStats) {
                const bStat = boardStats[placa];
                if (bStat.total > 0 && bStat.offline === bStat.total) {
                    newProblems.add(`[${config.id} PLACA ${placa}] FALHA::SUPER`);
                }
            }

            // --- RENDERIZAÇÃO NA TELA ---
            for (const portKey in portData) {
                const [placa, porta] = portKey.split('/');
                const { online, offline, info } = portData[portKey];
                const total = online + offline;
                
                let statusClass = 'status-normal';
                let statusText = 'Normal';
                let alertTag = '::NORMAL';

                // Lógica de Alarmes
                if (total > 0 && (offline / total) > 0.5) {
                    statusClass = 'status-problema'; 
                    statusText = 'CRÍTICO';
                    alertTag = '::SUPER';
                } else if (offline > 16 || (total > 0 && (offline / total) === 0.5)) {
                    statusClass = 'status-problema';
                    statusText = 'Problema';
                    alertTag = '::CRIT';
                } else if (offline === 16) {
                    statusClass = 'status-atencao';
                    statusText = 'Atenção';
                    alertTag = '::WARN';
                }

                if (alertTag !== '::NORMAL') {
                    newProblems.add(`[${config.id} PORTA ${porta}] ${alertTag}`);
                }

                // Cria a linha HTML
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

            // Notifica sistema de áudio/visual se houver problemas
            if (typeof checkAndNotifyForNewProblems === 'function') checkAndNotifyForNewProblems(newProblems);

        } catch (error) { 
            console.error('Erro ao ler dados.json:', error);
            // Opcional: Mostrar aviso na tela se falhar a leitura
        }
    }

    async function updateTime() {
        // Agora o tempo de atualização pode vir da data do arquivo se quisermos, 
        // mas por enquanto mantemos a lógica ou exibimos "Local"
        const tsElement = document.getElementById('last-update');
        if(tsElement) tsElement.innerText = "Fonte: Local (dados.json)";
    }

    // Inicialização
    createTableStructure();
    const runUpdate = () => { populateTables(); updateTime(); };
    runUpdate(); 
    setInterval(runUpdate, ENGINE_REFRESH_SECONDS * 1000); 
}

// ==============================================================================
// HELPERS E MODAL (Mantidos praticamente iguais, apenas ajustes estéticos)
// ==============================================================================

function injectModalHTML(config) {
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
            
            /* Tema Escuro Modal */
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
                            <select id="status-filter" class="filter-select" onchange="filterClients()">
                            </select>
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

function closeModal(event) {
    if (event && event.target.id !== 'detail-modal') return;
    document.getElementById('detail-modal').style.display = 'none';
}

function openPortDetails(placa, porta, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('.modal-content');

    modalContent.classList.remove('modal-large'); 
    modalContent.classList.add('modal-status');    

    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta} - Status`;
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

    // Dropdown
    const statusSelect = document.getElementById('status-filter');
    statusSelect.innerHTML = '<option value="all">Todos Status</option>';
    if (oltType === 'nokia') {
        statusSelect.innerHTML += `<option value="online">Online (UP)</option><option value="offline">Offline (DOWN)</option>`;
    } else {
        statusSelect.innerHTML += `<option value="online">Online (Active)</option><option value="offline">Offline (Inactive)</option>`;
    }
    statusSelect.value = 'all';

    const tbody = document.getElementById('clients-tbody');
    const thead = document.getElementById('clients-thead');
    thead.innerHTML = '';
    tbody.innerHTML = '';

    const portKey = `${parseInt(placa)}/${parseInt(porta)}`;
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
                rowHTML = `<tr class="client-row ${statusClass}">
                    <td>${c.colB}</td><td>${c.colC}</td><td>${c.colE}</td><td>${c.colH}</td><td>${c.colI}</td>
                </tr>`;
            } else {
                rowHTML = `<tr class="client-row ${statusClass}">
                    <td>${c.colB}</td><td>${c.colC}</td><td>${c.colD}</td><td>${c.colH}</td>
                </tr>`;
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
        
        row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
    });
}