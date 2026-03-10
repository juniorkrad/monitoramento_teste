// ==============================================================================
// layout.js - Construtor de Layout e Menu Inteligente (Versão 3.0 - Limpa)
// ==============================================================================

// --- AUTO-INJEÇÃO DA FONTE DE ÍCONES ---
(function loadIconFont() {
    const fontUrl = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    if (!document.querySelector(`link[href="${fontUrl}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
    }
})();

/**
 * Constrói o cabeçalho da página.
 */
function loadHeader(config) {
    if (config.title) {
        document.title = config.exactTitle ? config.title : `${config.title} | Monitoramento`;
    }

    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // Identifica a página atual
    const path = window.location.pathname;
    const currentPage = path.split('/').pop() || 'index.html';

    // Botão de navegação atualizado: apenas o ícone, sem o texto "MENU"
    let navHtml = `
        <button class="icon-btn" onclick="toggleSidebar()" title="Abrir Menu" style="border-radius: 8px; width: auto; padding: 8px 12px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; color: var(--m3-on-surface); transition: background 0.2s;">
            <span class="material-symbols-rounded">menu</span>
        </button>
    `;
    
    // Sempre carrega a sidebar
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

/**
 * Gera o HTML do Menu Lateral (SIDEBAR)
 */
function loadSidebar(currentPage) {
    let sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) {
        sidebarContainer = document.createElement('div');
        sidebarContainer.id = 'sidebar-container';
        document.body.prepend(sidebarContainer);
    }

    // Sidebar limpa, apenas com os módulos principais do sistema
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

                <a href="olt.html" class="sidebar-link home-highlight" style="margin-top: 5px; background-color: rgba(0,0,0,0.2); font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">dns</span>
                    STATUS OLTS
                </a>
                
                <a href="equipamentos.html" class="sidebar-link home-highlight" style="margin-top: 5px; background-color: rgba(0,0,0,0.2); font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">router</span>
                    EQUIPAMENTOS
                </a>

                <a href="energia.html" class="sidebar-link home-highlight" style="margin-top: 5px; background-color: rgba(0,0,0,0.2); font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">bolt</span>
                    ENERGIA
                </a>

                <a href="potencia.html" class="sidebar-link home-highlight" style="margin-top: 5px; background-color: rgba(0,0,0,0.2); font-size: 1rem; padding: 12px 12px 12px 20px; justify-content: flex-start; text-align: left;">
                    <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 12px;">sensors</span>
                    POTÊNCIA
                </a>
            </nav>
        </div>
    `;
}

/**
 * Abre/Fecha Sidebar
 */
function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

/**
 * Rodapé
 */
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

/**
 * Timestamp
 */
async function loadTimestamp(sheetTab, apiKey, sheetId) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    const range = `${sheetTab}!K1`; 
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha timestamp');
        const data = await response.json();
        
        if (data.values && data.values.length > 0 && data.values[0][0]) {
            const rawText = data.values[0][0];
            const cleanText = rawText.replace('Atualizado em:', '').trim();
            const parts = cleanText.split(' ');
            
            let htmlFormatado = '';
            if (parts.length >= 2) {
                htmlFormatado = `
                    <span class="material-symbols-rounded">calendar_today</span> ${parts[0]}
                    <span style="width: 1px; height: 12px; background: rgba(255,255,255,0.3); margin: 0 5px;"></span>
                    <span class="material-symbols-rounded">schedule</span> ${parts[1]}
                `;
            } else {
                htmlFormatado = `<span class="material-symbols-rounded">schedule</span> ${cleanText}`;
            }
            
            if (timestampEl.getAttribute('data-val') !== cleanText) {
                timestampEl.innerHTML = htmlFormatado;
                timestampEl.setAttribute('data-val', cleanText);
                timestampEl.style.color = 'var(--m3-on-surface-variant)';
                timestampEl.classList.remove('updated-anim');
                void timestampEl.offsetWidth; 
                timestampEl.classList.add('updated-anim');
            }
        } else {
            timestampEl.innerHTML = `<span class="material-symbols-rounded">error</span> S/ Dados`;
        }
    } catch (error) {
        if (timestampEl.textContent.includes('Aguardando')) {
             timestampEl.innerHTML = `<span class="material-symbols-rounded">wifi_off</span> Erro`;
             timestampEl.style.color = 'var(--m3-color-error)';
        }
    }
}