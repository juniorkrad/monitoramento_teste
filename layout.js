// ==============================================================================
// layout.js - Construtor de Layout e Menu Inteligente (Com Busca de Serial Integrada)
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
        <button class="icon-btn" onclick="toggleSidebar()" title="Abrir Menu" style="border-radius: 8px; width: auto; padding: 8px 12px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; color: var(--m3-on-surface); transition: background 0.2s;">
            <span class="material-symbols-rounded">menu</span>
        </button>
    `;
    
    loadSidebar(currentPage);
    injectSearchModal(); // Injeta o Pop-up na página

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
                
                <a href="equipamentos.html" class="sidebar-link home-highlight" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">router</span>
                    EQUIPAMENTOS
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

                <div class="sidebar-divider" style="margin: 15px 0;"></div>
                
                <a href="#" onclick="openSearchModal(); return false;" class="sidebar-link home-highlight" style="margin-top: 5px; font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left; background-color: var(--m3-surface-container-highest);">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px; color: var(--m3-primary);">manage_search</span>
                    BUSCAR SERIAL
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
            <p>© ${currentYear} Painel de Monitoramento | Desenvolvido por 👤@juniorkrad + 🤖Gemini</p>
            <p style="font-size: 0.75rem; margin-top: 6px; opacity: 0.7; font-weight: 400;">
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
                    <h2><span class="material-symbols-rounded">manage_search</span> Localizar Equipamento</h2>
                    <button class="search-close-btn" onclick="closeSearchModal()" title="Fechar"><span class="material-symbols-rounded">close</span></button>
                </div>
                
                <div class="search-input-group">
                    <input type="text" id="serial-search-input" class="search-input" placeholder="Digite no mínimo 4 dígitos finais..." autocomplete="off" onkeypress="if(event.key === 'Enter') executeSerialSearch()">
                    <button class="search-btn" onclick="executeSerialSearch()" title="Pesquisar">
                        <span class="material-symbols-rounded" style="font-size: 28px;">search</span>
                    </button>
                </div>
                
                <div id="search-results-area" class="search-results-container">
                    <div style="text-align:center; color: var(--m3-on-surface-variant); padding: 20px; font-size: 0.95rem;">
                        O sistema fará uma varredura em todas as OLTs cadastradas. Você pode colar o serial completo ou apenas o trecho final (ex: FHTT123456 ou 3456).
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
    
    // Fecha o menu lateral automaticamente
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
    
    const searchTarget = input.length >= 8 ? input.slice(-8) : input;

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
        
        const fetchPromises = GLOBAL_MASTER_OLT_LIST.map(async (olt) => {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${GLOBAL_SHEET_ID}/values/${olt.sheetTab}!A:Z?key=${GLOBAL_API_KEY}`;
            try {
                const response = await fetch(url);
                if (!response.ok) return null;
                const data = await response.json();
                if (!data.values) return null;
                
                for (let i = 1; i < data.values.length; i++) {
                    const row = data.values[i];
                    
                    for (let j = 0; j < row.length; j++) {
                        const cellVal = String(row[j]).toUpperCase().trim();
                        
                        if (cellVal.endsWith(searchTarget) || cellVal.includes(searchTarget)) {
                            
                            let statusStr = "Desconhecido";
                            let statusClass = "status-unknown";
                            const rowStr = row.join(" ").toUpperCase();
                            
                            if (rowStr.includes("UP") || rowStr.includes("ACTIVE")) { 
                                statusStr = "UP"; 
                                statusClass = "status-up"; 
                            } else if (rowStr.includes("DOWN") || rowStr.includes("OFFLINE")) { 
                                statusStr = "DOWN"; 
                                statusClass = "status-down"; 
                            }
                            
                            foundResults.push({
                                serial: cellVal,
                                oltName: olt.id || olt.sheetTab,
                                porta: row[0] || "N/A", 
                                status: statusStr,
                                statusClass: statusClass
                            });
                            
                            break; 
                        }
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
                    Nenhum equipamento correspondente a <b>"${input}"</b> foi encontrado nas OLTs.
                </div>
            `;
            return;
        }

        // Renderiza os resultados limpos e minimalistas
        let html = '';
        foundResults.forEach(res => {
            html += `
                <div class="search-result-card">
                    <div class="search-result-row">
                        <span class="material-symbols-rounded">barcode</span>
                        <span class="search-result-val">${res.serial}</span>
                    </div>
                    <div class="search-result-row">
                        <span class="material-symbols-rounded">dns</span>
                        <span class="search-result-val">${res.oltName}</span>
                    </div>
                    <div class="search-result-row">
                        <span class="material-symbols-rounded">settings_input_component</span>
                        <span class="search-result-val">${res.porta}</span>
                    </div>
                    <div class="search-result-row" style="margin-top: 5px;">
                        <span class="material-symbols-rounded">online_prediction</span>
                        <span class="search-result-status ${res.statusClass}">${res.status}</span>
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
// UTILITÁRIOS GLOBAIS BLINDADOS
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

function getGlobalCircuitInfo(rowsCircuitos, oltIdentifier, placa, porta, type) {
    const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltIdentifier || o.sheetTab === oltIdentifier);
    if (!oltConfig || oltConfig.circuitCol === undefined) return "-";
    
    const colIndex = oltConfig.circuitCol;
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

function getGlobalBairroInfo(rowsLocalidades, oltIdentifier, placa, porta, type) {
    if (!rowsLocalidades || !rowsLocalidades.length) return null;

    const cleanOlt = (oltIdentifier || "").toUpperCase().replace(/[^A-Z0-9]/g, '');

    const bairroColMap = {
        'HEL1': 1,  'HEL2': 3,  'MGP': 5,   'PQA1': 7,  'PSV1': 9,  
        'PSV7': 11, 'SBO2': 13, 'SBO3': 15, 'SBO4': 17, 'SB1': 19,  
        'SB2': 21,  'SB3': 23,  'PQA2': 25, 'PQA3': 27, 'LTXV2': 29,
        'LTXV1': 31, 'SBO1': 33  
    };

    const colIndex = bairroColMap[cleanOlt];
    if (colIndex === undefined) return null;

    let rowIndex = -1;
    const p = parseInt(porta);
    const sl = parseInt(placa);

    if (type === 'nokia') rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
    else if (type === 'furukawa-2') rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
    else if (type === 'furukawa-10') rowIndex = ((sl - 1) * 4) + (p - 1) + 1;

    if (rowIndex > 0 && rowIndex < rowsLocalidades.length) {
        const bairro = rowsLocalidades[rowIndex][colIndex];
        return bairro ? bairro.trim() : null;
    }
    return null;
}

async function loadTimestamp(sheetTab, apiKey, sheetId) {
    updateGlobalTimestamp();
}

// ==============================================================================
// SISTEMA DE AUTO-HIDE (MODO KIOSK/IMERSÃO EXPANSIVA)
// ==============================================================================
function initAutoHide() {
    let idleTimer;
    const idleTime = 10000; // 10 segundos de inatividade para ocultar

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