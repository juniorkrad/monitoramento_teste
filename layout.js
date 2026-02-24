// ==============================================================================
// layout.js - Construtor de Layout e Menu Inteligente (Versão 2.2 - Grid 2 Colunas)
// ==============================================================================

// --- LISTA MESTRA DE PÁGINAS ---
const OLT_MENU_LIST = [
    { name: 'HEL-1',  file: 'hel1.html' },
    { name: 'HEL-2',  file: 'hel2.html' },
    { name: 'PQA-1',  file: 'pqa1.html' },
    { name: 'PSV-1',  file: 'psv1.html' },
    { name: 'MGP',    file: 'mgp.html' },
    { name: 'LTXV-1', file: 'ltxv1.html' },
    { name: 'LTXV-2', file: 'ltxv2.html' },
    { name: 'PQA-2',  file: 'pqa2.html' },
    { name: 'PQA-3',  file: 'pqa3.html' },
    { name: 'SB-1',   file: 'sb1.html' },
    { name: 'SB-2',   file: 'sb2.html' },
    { name: 'SB-3',   file: 'sb3.html' },
    { name: 'PSV-7',  file: 'psv7.html' },
    { name: 'SBO-1',  file: 'sbo1.html' },
    { name: 'SBO-2',  file: 'sbo2.html' },
    { name: 'SBO-3',  file: 'sbo3.html' },
    { name: 'SBO-4',  file: 'sbo4.html' }
];

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
    const isHome = currentPage === 'index.html';

    let navHtml = '';

    if (!isHome) {
        // --- BOTÃO MENU (Abre a sidebar) ---
        navHtml = `
            <button class="icon-btn" onclick="toggleSidebar()" title="Abrir Menu" style="border-radius: 8px; width: auto; padding: 0 15px; gap: 8px;">
                <span class="material-symbols-rounded">menu</span>
                <span style="font-weight: 500; font-size: 0.9rem;">MENU</span>
            </button>
        `;
        loadSidebar(currentPage);
    } else {
        // --- BOTÃO HOME (Legado/Opcional) ---
        if (config.buttonText && config.buttonLink) {
            const iconName = config.buttonText.toLowerCase().includes('voltar') ? 'arrow_back' : 'home';
            navHtml = `
                <a href="${config.buttonLink}" class="icon-btn" title="${config.buttonText}">
                    <span class="material-symbols-rounded">${iconName}</span>
                </a>`;
        }
    }

    headerPlaceholder.innerHTML = `
        <header class="header">
            <div class="logo-title-group">
                <img src="banner2.png" alt="Logo" onerror="this.style.display='none'">
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

    let linksHtml = '';
    
    OLT_MENU_LIST.forEach(olt => {
        if (olt.file === currentPage) return; 

        linksHtml += `
            <a href="${olt.file}" class="sidebar-link">
                <span class="material-symbols-rounded">dns</span>
                ${olt.name}
            </a>
        `;
    });

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
                <a href="index.html" class="sidebar-link home-highlight">
                    <span class="material-symbols-rounded" style="font-size: 28px;">home</span>
                    HOME
                </a>
                
                <a href="equipamentos.html" class="sidebar-link home-highlight" style="margin-top: 5px; background-color: rgba(0,0,0,0.2); font-size: 1rem; padding: 12px;">
                    <span class="material-symbols-rounded" style="font-size: 24px;">router</span>
                    EQUIPAMENTOS
                </a>
                
                <div class="sidebar-divider"></div>
                <div class="menu-label">Outras OLTs</div>

                <div class="olt-link-grid">
                    ${linksHtml}
                </div>
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
 * Rodapé (ATUALIZADO)
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