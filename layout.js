// ==============================================================================
// layout.js - Construtor de Layout e Menu Inteligente (Versão Final Consolidada)
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

// Mantido apenas por segurança caso algum script antigo procure pela função
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

    // Escuta eventos de interação para resetar o tempo
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('mousedown', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('touchmove', resetTimer);
    window.addEventListener('scroll', resetTimer);

    // Inicia o timer logo no carregamento da página
    resetTimer();
}

// Inicia o monitor de inatividade assim que o layout.js for carregado
document.addEventListener('DOMContentLoaded', initAutoHide);