// ==============================================================================
// layout.js - Construtor de Layout e Menu Inteligente (Com Busca e Emergência Autenticada)
// Atualização: Reordenação do menu e substituição de emojis por ícones no rodapé preenchidos (FILL)
// ==============================================================================

(function loadIconFont() {
    const fontUrl = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    if (!document.querySelector(`link[href="${fontUrl}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
    }
})();

function loadHeader(config) {
    if (config.title) {
        document.title = config.exactTitle ? config.title : `${config.title} | Monitoramento`;
    }

    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    const path = window.location.pathname;
    const currentPage = path.split('/').pop() || 'index.html';

    let navHtml = `
        <button class="icon-btn" onclick="toggleSidebar()" title="Abrir Menu" style="border-radius: 8px; width: auto; padding: 8px 12px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; color: var(--m3-on-surface); transition: background-color 0.2s, box-shadow 0.2s;">
            <span class="material-symbols-rounded">menu</span>
        </button>
    `;
    
    loadSidebar(currentPage);
    injectSearchModal(); 
    injectEmergencyModal(); 

    headerPlaceholder.innerHTML = `
        <header class="header">
            <div class="logo-title-group">
                <a href="index.html" title="Voltar para a Home" style="display: flex; align-items: center; text-decoration: none;">
                    <img src="banner2.png" alt="Logo" onerror="this.style.display='none'">
                </a>
                <h1>${config.title}</h1>
            </div>
            <nav class="header-nav">
                <div id="update-timestamp" class="timestamp-badge">
                    <span class="material-symbols-rounded">hourglass_empty</span> Aguardando...
                </div>
                ${navHtml}
            </nav>
        </header>
    `;
}

function loadSidebar(currentPage) {
    let sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) {
        sidebarContainer = document.createElement('div');
        sidebarContainer.id = 'sidebar-container';
        document.body.prepend(sidebarContainer);
    }

    sidebarContainer.innerHTML = `
        <div class="sidebar-overlay" onclick="toggleSidebar()"></div>
        
        <div class="sidebar" id="main-sidebar">
            <div class="sidebar-header">
                <h3>NAVEGAÇÃO</h3>
                <button class="close-btn" onclick="toggleSidebar()" style="background: none; border: none; color: var(--m3-on-surface-variant); cursor: pointer; padding: 0;">
                    <span class="material-symbols-rounded" style="font-size: 28px;">close</span>
                </button>
            </div>
            
            <nav class="sidebar-nav">
                <a href="index.html" class="sidebar-link home-highlight" style="justify-content: flex-start; text-align: left; padding-left: 20px;">
                    <span class="material-symbols-rounded" style="font-size: 28px; margin-right: 12px;">home</span>
                    HOME
                </a>

                <a href="olt.html" class="sidebar-link home-highlight" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">dns</span>
                    STATUS OLTS
                </a>
                
                <a href="energia.html" class="sidebar-link home-highlight" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">bolt</span>
                    ENERGIA
                </a>

                <a href="potencia.html" class="sidebar-link home-highlight" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">sensors</span>
                    POTÊNCIA
                </a>

                <a href="temperatura.html" class="sidebar-link home-highlight" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">device_thermostat</span>
                    TEMPERATURA
                </a>

                <a href="equipamentos.html" class="sidebar-link home-highlight" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">router</span>
                    EQUIPAMENTOS
                </a>

                <div class="sidebar-divider" style="margin: 15px 0;"></div>
                
                <a href="#" onclick="openSearchModal(); return false;" class="sidebar-link home-highlight" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left; background-color: var(--m3-surface-container-highest);">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px; color: var(--m3-primary);">manage_search</span>
                    BUSCAR CLIENTE
                </a>

                <a href="#" onclick="checkAuthAndOpenEmergency(); return false;" class="sidebar-link home-highlight bg-danger-highlight text-danger" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded text-danger" style="font-size: 24px; margin-right: 12px;">warning</span>
                    COLETA DE EMERGÊNCIA
                </a>
            </nav>
        </div>
    `;
}

function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function loadFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;
    
    const currentYear = new Date().getFullYear();
    footerPlaceholder.innerHTML = `
        <footer class="footer">
            <div style="display: flex; justify-content: center; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>© ${currentYear} Painel de Monitoramento | Desenvolvido por</span>
                <span class="material-symbols-rounded" style="font-size: 16px; font-variation-settings: 'FILL' 1;">person</span> @juniorkrad 
                <span>+</span>
                <span class="material-symbols-rounded" style="font-size: 16px; font-variation-settings: 'FILL' 1;">smart_toy</span> Gemini
            </div>
            <p style="font-size: 0.75rem; margin-top: 6px; opacity: 0.7; font-weight: 400; margin-bottom: 0;">
                Todos os direitos reservados. Projeto registrado. Proibida a reprodução não autorizada.
            </p>
        </footer>
    `;
}

// ==============================================================================
// SISTEMA DE BUSCA GLOBAL DE SERIAL (MODAL E LÓGICA)
// ==============================================================================

function injectSearchModal() {
    if (document.getElementById('search-serial-modal')) return;

    const modalHtml = `
        <div class="search-modal-overlay" id="search-serial-modal" onclick="closeSearchModal(event)">
            <div class="search-modal" onclick="event.stopPropagation()">
                <div class="search-modal-header">
                    <h2><span class="material-symbols-rounded">manage_search</span> Pesquisa de Clientes e Equipamentos</h2>
                    <button class="search-close-btn" onclick="closeSearchModal()" title="Fechar"><span class="material-symbols-rounded">close</span></button>
                </div>
                
                <div class="search-input-group">
                    <input type="text" id="serial-search-input" class="search-input" placeholder="Buscar por Serial ou Código..." autocomplete="off" onkeypress="if(event.key === 'Enter') executeSerialSearch()">
                    <button class="search-btn" onclick="executeSerialSearch()" title="Pesquisar">
                        <span class="material-symbols-rounded" style="font-size: 28px;">search</span>
                    </button>
                </div>
                
                <div id="search-results-area" class="search-results-container">
                    <div style="text-align:center; color: var(--m3-on-surface-variant); padding: 20px; font-size: 0.95rem;">
                        O sistema fará uma varredura cirúrgica em todas as OLTs cadastradas. Você pode buscar pelo Serial completo do equipamento, Código do cliente ou trechos finais.
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openSearchModal() {
    injectSearchModal(); 
    document.getElementById('search-serial-modal').classList.add('active');
    document.getElementById('serial-search-input').value = '';
    document.getElementById('search-results-area').innerHTML = '';
    setTimeout(() => document.getElementById('serial-search-input').focus(), 100);
    
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        toggleSidebar();
    }
}

function closeSearchModal(event) {
    if (event && event.target.id !== 'search-serial-modal' && event.type === 'click') return;
    const modal = document.getElementById('search-serial-modal');
    if(modal) modal.classList.remove('active');
}

async function executeSerialSearch() {
    const inputField = document.getElementById('serial-search-input');
    const input = inputField.value.trim().toUpperCase(); 
    const resultsArea = document.getElementById('search-results-area');
    
    if (input.length < 4) {
        resultsArea.innerHTML = `<div style="text-align:center; color: var(--m3-error); padding: 20px;">Por favor, digite pelo menos 4 caracteres para realizar a busca.</div>`;
        return;
    }
    
    const searchTarget = input;

    resultsArea.innerHTML = `
        <div class="search-loading">
            <div class="spinner"></div>
            <span>Varrendo dados nas OLTs. Por favor, aguarde...</span>
        </div>
    `;

    try {
        if (typeof GLOBAL_MASTER_OLT_LIST === 'undefined' || typeof GLOBAL_API_KEY === 'undefined' || typeof GLOBAL_SHEET_ID === 'undefined') {
             resultsArea.innerHTML = `<div style="text-align:center; color: var(--m3-error); padding: 20px;">Erro Interno: Variáveis de API e Lista de OLTs não detectadas. A busca requer que a arquitetura global esteja carregada.</div>`;
             return;
        }

        let foundResults = [];
        
        // Puxa os circuitos uma vez para não ter que buscar repetidamente
        const rowsCircuitos = (window.DATA_STORE && window.DATA_STORE.circuitos) ? window.DATA_STORE.circuitos : [];
        
        const fetchPromises = GLOBAL_MASTER_OLT_LIST.map(async (olt) => {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${GLOBAL_SHEET_ID}/values/${olt.sheetTab}!A:Z?key=${GLOBAL_API_KEY}`;
            try {
                const response = await fetch(url);
                if (!response.ok) return null;
                const data = await response.json();
                if (!data.values) return null;
                
                for (let i = 1; i < data.values.length; i++) {
                    const row = data.values[i];
                    
                    let serialVal = '';
                    let codigoVal = '';
                    let potenciaVal = String(row[5] || '').trim(); // Coluna F
                    let colStatus = 2;

                    // Mapeamento focado: Nokia e Furukawa
                    if (olt.type === 'nokia') {
                        serialVal = String(row[2] || '').toUpperCase().trim();
                        codigoVal = String(row[8] || '').toUpperCase().trim();
                        colStatus = 4;
                    } else { // Furukawa
                        serialVal = String(row[3] || '').toUpperCase().trim();
                        codigoVal = String(row[7] || '').toUpperCase().trim();
                        colStatus = 2;
                    }
                    
                    if ((serialVal && (serialVal.endsWith(searchTarget) || serialVal.includes(searchTarget))) || 
                        (codigoVal && (codigoVal.endsWith(searchTarget) || codigoVal.includes(searchTarget)))) {
                        
                        let statusStr = "UNKNOWN";
                        let statusClass = "status-unknown";
                        
                        let isOnline = false;
                        if (typeof DataMapper !== 'undefined') {
                            isOnline = DataMapper.isOnline(row[colStatus], olt.type);
                        } else {
                            let statusCell = row[colStatus] ? String(row[colStatus]).toUpperCase().trim() : '';
                            isOnline = statusCell.includes("UP") || statusCell === "ACTIVE";
                        }
                        
                        if (isOnline) { 
                            statusStr = "UP"; 
                            statusClass = "status-up"; 
                        } else { 
                            statusStr = "DOWN"; 
                            statusClass = "status-down"; 
                        }

                        let portaFull = row[0] || "N/A";
                        let placa = "-";
                        let porta = "-";
                        let circuitoNome = "-";

                        if (typeof DataMapper !== 'undefined') {
                            const portInfo = DataMapper.extractPort(portaFull, olt.type);
                            if (portInfo) {
                                placa = portInfo.placa;
                                porta = portInfo.porta;
                                const pseudoConfig = { id: olt.id || olt.sheetTab, oltName: olt.id || olt.sheetTab, type: olt.type };
                                circuitoNome = DataMapper.getCircuitInfo(rowsCircuitos, pseudoConfig, placa, porta);
                            } else {
                                const parts = String(portaFull).split('/');
                                if(parts.length >= 2) {
                                    placa = parts[parts.length-2];
                                    porta = parts[parts.length-1];
                                }
                            }
                        }

                        foundResults.push({
                            serial: serialVal,
                            codigo: codigoVal,
                            oltName: olt.id || olt.sheetTab,
                            placa: placa,
                            porta: porta,
                            circuito: circuitoNome,
                            potencia: potenciaVal,
                            status: statusStr,
                            statusClass: statusClass
                        });
                    }
                }
            } catch(e) {
                console.error("Erro ao varrer a aba: " + olt.sheetTab, e);
            }
        });

        await Promise.all(fetchPromises);

        if (foundResults.length === 0) {
            resultsArea.innerHTML = `
                <div style="text-align:center; padding: 30px; color: var(--m3-on-surface-variant);">
                    <span class="material-symbols-rounded" style="font-size: 40px; margin-bottom: 10px; opacity: 0.5;">search_off</span><br>
                    Nenhum cliente correspondente a <b>"${input}"</b> foi encontrado nas OLTs.
                </div>
            `;
            return;
        }

        let html = '';
        foundResults.forEach(res => {
            html += `
                <div class="search-result-card" style="padding: 15px;">
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        
                        <div style="display: flex; align-items: center; gap: 6px;" title="Serial do Equipamento">
                            <span class="material-symbols-rounded" style="color: var(--m3-color-primary);">barcode</span> 
                            <strong style="font-family: var(--font-family-mono); font-size: 1.05rem;">${res.serial || 'N/A'}</strong>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 6px;" title="Código do Cliente">
                            <span class="material-symbols-rounded" style="color: var(--m3-color-primary);">deployed_code_account</span> 
                            <strong style="font-family: var(--font-family-mono); font-size: 1.05rem;">${res.codigo || 'N/A'}</strong>
                        </div>

                        <div style="display: flex; align-items: center; gap: 6px; color: var(--m3-on-surface-variant);" title="Nome da OLT">
                            <span class="material-symbols-rounded" style="font-size: 20px;">dns</span> ${res.oltName}
                        </div>

                        <div style="display: flex; align-items: center; gap: 6px; color: var(--m3-on-surface-variant);" title="Placa/Porta">
                            <span class="material-symbols-rounded" style="font-size: 20px;">developer_board</span> ${res.placa}/${res.porta}
                        </div>

                        <div style="display: flex; align-items: center; gap: 6px; color: var(--m3-on-surface-variant);" title="Circuito">
                            <span class="material-symbols-rounded" style="font-size: 20px;">network_node</span> ${res.circuito}
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 6px; color: var(--m3-on-surface-variant);" title="Potência (dBm)">
                            <span class="material-symbols-rounded" style="font-size: 20px;">infrared</span> ${res.potencia || 'N/A'} dBm
                        </div>

                        <div style="margin-top: 4px;">
                            <span class="search-result-status ${res.statusClass}" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.95rem;">
                                <span class="material-symbols-rounded" style="font-size: 20px;">online_prediction</span> ${res.status}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        resultsArea.innerHTML = html;

    } catch (error) {
        resultsArea.innerHTML = `<div style="text-align:center; color: var(--m3-error); padding: 20px;">Falha de comunicação com o banco de dados. Tente novamente mais tarde.</div>`;
        console.error(error);
    }
}

// ==============================================================================
// SISTEMA DE EMERGÊNCIA (GOOGLE LOGIN E COLETA ASSÍNCRONA)
// ==============================================================================

const OLT_EMERGENCY_MAP = {
    'HEL-1': { row: 2, timeSecs: 300 }, 
    'HEL-2': { row: 3, timeSecs: 240 }, 
    'PQA-1': { row: 4, timeSecs: 300 }, 
    'PSV-1': { row: 5, timeSecs: 300 }, 
    'MGP':   { row: 6, timeSecs: 240 }, 
    'SBO-1': { row: 7, timeSecs: 180 }, 
    'SBO-2': { row: 8, timeSecs: 180 }, 
    'SBO-3': { row: 9, timeSecs: 180 }, 
    'SBO-4': { row: 10, timeSecs: 180 }, 
    'PSV-7': { row: 11, timeSecs: 180 }, 
    'LTXV-1':{ row: 12, timeSecs: 180 }, 
    'LTXV-2':{ row: 13, timeSecs: 180 }, 
    'PQA-2': { row: 14, timeSecs: 180 }, 
    'PQA-3': { row: 15, timeSecs: 180 }, 
    'SB-1':  { row: 16, timeSecs: 180 }, 
    'SB-2':  { row: 17, timeSecs: 180 }, 
    'SB-3':  { row: 18, timeSecs: 180 }
};

let emergencyInterval = null;
let tokenClient;
let gapiAccessToken = null;

function checkAuthAndOpenEmergency() {
    if (gapiAccessToken) {
        openEmergencyModal();
        return;
    }

    if (!window.google || !window.google.accounts) {
        alert("A segurança do Google ainda está carregando ou o script não foi adicionado. Tente novamente em alguns segundos.");
        return;
    }

    if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '310061647059-cl0o934un533jum0uka0t0fmnef5m211.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    gapiAccessToken = tokenResponse.access_token;
                    openEmergencyModal();
                }
            },
        });
    }
    
    tokenClient.requestAccessToken({prompt: ''}); 
}

function injectEmergencyModal() {
    if (document.getElementById('emergency-action-modal')) return;

    const modalHtml = `
        <div class="search-modal-overlay" id="emergency-action-modal" onclick="closeEmergencyModal(event)">
            <div class="search-modal" onclick="event.stopPropagation()">
                <div class="search-modal-header emergency-header">
                    <h2><span class="material-symbols-rounded">warning</span> Painel de Emergência</h2>
                    <button class="search-close-btn" onclick="closeEmergencyModal()" title="Cancelar"><span class="material-symbols-rounded">close</span></button>
                </div>
                <div id="emergency-dynamic-area"></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function openEmergencyModal() {
    injectEmergencyModal();
    const modal = document.getElementById('emergency-action-modal');
    modal.classList.add('active');
    
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar && sidebar.classList.contains('active')) toggleSidebar();

    renderEmergencySelection();
}

function closeEmergencyModal(event) {
    if (event && event.target.id !== 'emergency-action-modal' && event.type === 'click') return;
    const modal = document.getElementById('emergency-action-modal');
    if (modal) modal.classList.remove('active');
    
    if(emergencyInterval) clearInterval(emergencyInterval);
}

function renderEmergencySelection() {
    const area = document.getElementById('emergency-dynamic-area');
    
    if (typeof GLOBAL_MASTER_OLT_LIST === 'undefined') {
        area.innerHTML = `<div style="text-align:center; color: var(--m3-error); padding: 20px;">Erro: Lista de OLTs não encontrada.</div>`;
        return;
    }

    let cardsHtml = '';
    GLOBAL_MASTER_OLT_LIST.forEach(olt => {
        const displayId = olt.id || olt.sheetTab;
        cardsHtml += `
            <div class="emergency-card-btn" onclick="confirmEmergencyOlt('${displayId}')">
                <span class="material-symbols-rounded">dns</span>
                <span class="emergency-card-name">${displayId}</span>
            </div>
        `;
    });

    area.innerHTML = `
        <p style="text-align: center; color: var(--m3-on-surface-variant); margin-bottom: 10px;">Selecione o equipamento que necessita de varredura prioritária local:</p>
        <div class="emergency-grid">
            ${cardsHtml}
        </div>
        <div style="text-align:center; margin-top: 15px; font-size: 0.8rem; color: #4ade80;">
            <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">verified_user</span> 
            Sessão autenticada ativa. Suas ações serão registradas.
        </div>
    `;
}

function confirmEmergencyOlt(oltId) {
    const area = document.getElementById('emergency-dynamic-area');
    area.innerHTML = `
        <div class="emergency-confirm-box">
            <span class="material-symbols-rounded text-danger" style="font-size: 60px;">warning</span>
            <div class="emergency-confirm-title">
                Deseja realmente disparar a coleta de emergência no servidor local para a OLT:
                <span class="emergency-confirm-highlight">${oltId}</span>
            </div>
            <div class="emergency-btn-group">
                <button class="btn-cancel" onclick="renderEmergencySelection()">NÃO, VOLTAR</button>
                <button class="btn-confirm-danger" onclick="executeEmergencySignal('${oltId}')">SIM, DISPARAR</button>
            </div>
        </div>
    `;
}

async function executeEmergencySignal(oltId) {
    const area = document.getElementById('emergency-dynamic-area');
    const oltData = OLT_EMERGENCY_MAP[oltId];

    if (!oltData) {
        area.innerHTML = `<div class="emergency-confirm-box"><span class="text-danger">Erro de mapeamento para OLT ${oltId}.</span><br><button class="btn-cancel" style="margin-top:20px;" onclick="renderEmergencySelection()">VOLTAR</button></div>`;
        return;
    }

    area.innerHTML = `
        <div class="search-loading">
            <div class="spinner"></div>
            <span style="color: var(--m3-on-surface);">Autenticando e enviando sinal para Nuvem...</span>
        </div>
    `;

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GLOBAL_SHEET_ID}/values/CONTROLE!B${oltData.row}?valueInputOption=USER_ENTERED`;
        
        const payload = {
            "range": `CONTROLE!B${oltData.row}`,
            "majorDimension": "ROWS",
            "values": [ ["COLETAR"] ]
        };

        const response = await fetch(url, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${gapiAccessToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || "Erro de permissão na escrita.");
        }

        startEmergencyTimer(oltId, oltData.timeSecs);

    } catch (error) {
        console.error("Erro ao enviar sinal de emergência autenticado:", error);
        area.innerHTML = `
            <div class="emergency-confirm-box">
                <span class="text-danger">Falha de Autorização ou Conexão.</span>
                <p style="font-size: 0.85rem; color: var(--m3-on-surface-variant);">${error.message}</p>
                <button class="btn-cancel" style="margin-top:20px;" onclick="renderEmergencySelection()">VOLTAR</button>
            </div>`;
    }
}

function startEmergencyTimer(oltId, totalSeconds) {
    const area = document.getElementById('emergency-dynamic-area');
    let timeLeft = totalSeconds;

    function formatTime(secs) {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    area.innerHTML = `
        <div class="emergency-confirm-box" style="gap: 10px;">
            <span class="material-symbols-rounded text-danger" style="font-size: 40px; animation: textFlash 2s infinite;">sync</span>
            <div style="font-size: 1.1rem; color: var(--m3-on-surface);">
                Sinal enviado com sucesso para <b class="text-danger">${oltId}</b>!
            </div>
            <div style="font-size: 0.9rem; color: var(--m3-on-surface-variant); margin-bottom: 10px;">
                O Servidor local já iniciou a coleta. Aguarde a finalização...
            </div>
            
            <div class="emergency-timer-text" id="emergency-clock">${formatTime(timeLeft)}</div>
            
            <div class="emergency-progress-container">
                <div class="emergency-progress-bar" id="emergency-bar"></div>
            </div>
        </div>
    `;

    if(emergencyInterval) clearInterval(emergencyInterval);

    emergencyInterval = setInterval(() => {
        timeLeft--;
        
        const clockEl = document.getElementById('emergency-clock');
        const barEl = document.getElementById('emergency-bar');
        
        if (clockEl && barEl) {
            clockEl.textContent = formatTime(timeLeft);
            const percent = ((totalSeconds - timeLeft) / totalSeconds) * 100;
            barEl.style.width = `${percent}%`;
        }

        if (timeLeft <= 0) {
            clearInterval(emergencyInterval);
            area.innerHTML = `
                <div class="emergency-confirm-box">
                    <span class="material-symbols-rounded" style="font-size: 60px; color: #4ade80;">check_circle</span>
                    <div style="font-size: 1.3rem; color: var(--m3-on-surface); margin-top: 10px;">
                        Coleta Finalizada!
                    </div>
                    <div style="font-size: 0.95rem; color: var(--m3-on-surface-variant); margin-top: 5px;">
                        Os dados da OLT ${oltId} já devem estar atualizados na nuvem.<br>Atualize a página no menu para visualizar.
                    </div>
                    <button class="btn-cancel" style="margin-top: 25px; width: 100%;" onclick="closeEmergencyModal()">FECHAR JANELA</button>
                </div>
            `;
        }
    }, 1000);
}

// ==============================================================================
// UTILITÁRIOS GLOBAIS DE UI
// ==============================================================================

function checkIsHomePage() {
    const path = window.location.pathname;
    return path.includes('index.html') || path === '/' || !path.endsWith('.html');
}

function updateGlobalTimestamp() {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    const now = new Date();
    const dataFormatada = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaFormatada = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    timestampEl.innerHTML = `
        <span class="material-symbols-rounded">calendar_today</span> ${dataFormatada}
        <span style="display: inline-block; width: 1px; height: 12px; background: rgba(255,255,255,0.3); margin: 0 5px;"></span>
        <span class="material-symbols-rounded">schedule</span> ${horaFormatada}
    `;
    timestampEl.style.color = 'var(--m3-on-surface-variant)';
    
    timestampEl.classList.remove('updated-anim');
    void timestampEl.offsetWidth; 
    timestampEl.classList.add('updated-anim');
}

async function loadTimestamp(sheetTab, apiKey, sheetId) {
    updateGlobalTimestamp();
}

// ==============================================================================
// SISTEMA DE AUTO-HIDE (MODO KIOSK/IMERSÃO EXPANSIVA)
// ==============================================================================
function initAutoHide() {
    let idleTimer;
    const idleTime = 10000; 

    const resetTimer = () => {
        document.body.classList.remove('idle');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => document.body.classList.add('idle'), idleTime);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('touchmove', resetTimer);
    window.addEventListener('scroll', resetTimer);

    resetTimer();
}

document.addEventListener('DOMContentLoaded', initAutoHide);