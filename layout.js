// ==============================================================================
// layout.js - Construtor de Layout Local (Versão 3.0 - JSON Edition)
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

    // Cria o header com o placeholder de timestamp
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
        // Marca o link ativo
        const isActive = olt.file === currentPage ? 'active-link' : '';
        // Se quiser ocultar a própria página, descomente a linha abaixo:
        // if (olt.file === currentPage) return; 

        linksHtml += `
            <a href="${olt.file}" class="sidebar-link ${isActive}">
                <span class="material-symbols-rounded">router</span>
                ${olt.name}
            </a>
        `;
    });

    sidebarContainer.innerHTML = `
        <div class="sidebar-overlay" onclick="toggleSidebar()"></div>
        
        <div class="sidebar" id="main-sidebar">
            <div class="sidebar-header">
                <h3>NAVEGAÇÃO</h3>
                <button class="close-btn" onclick="toggleSidebar()">
                    <span class="material-symbols-rounded" style="font-size: 28px;">close</span>
                </button>
            </div>
            
            <nav class="sidebar-nav">
                <a href="index.html" class="sidebar-link home-highlight">
                    <span class="material-symbols-rounded" style="font-size: 28px;">home</span>
                    HOME
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
 * Rodapé
 */
function loadFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;
    
    const currentYear = new Date().getFullYear();
    footerPlaceholder.innerHTML = `
        <footer class="footer">
            <p>© ${currentYear} Painel de Monitoramento | Infraestrutura Local</p>
        </footer>
    `;
}

/**
 * Timestamp LOCAL (Lê do arquivo JSON)
 * @param {string} jsonFileName - Nome do arquivo JSON (ex: 'dados_mgp.json')
 */
async function loadTimestamp(jsonFileName) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    // Adiciona timestamp para evitar cache do navegador
    const url = `${jsonFileName}?t=${new Date().getTime()}`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Arquivo ${jsonFileName} não encontrado`);
        }
        
        const data = await response.json();
        
        // Verifica se existe o metadado de atualização
        if (data.meta && data.meta.atualizado_em) {
            const rawText = data.meta.atualizado_em; // Ex: "10/01/2026 14:30:00"
            const parts = rawText.split(' '); // Divide data e hora
            
            let htmlFormatado = '';
            
            if (parts.length >= 2) {
                // Formato completo: Data + Hora
                htmlFormatado = `
                    <span class="material-symbols-rounded">calendar_today</span> ${parts[0]}
                    <span style="width: 1px; height: 12px; background: rgba(255,255,255,0.3); margin: 0 5px;"></span>
                    <span class="material-symbols-rounded">schedule</span> ${parts[1]}
                `;
            } else {
                // Apenas texto
                htmlFormatado = `<span class="material-symbols-rounded">schedule</span> ${rawText}`;
            }
            
            // Só atualiza o DOM se o texto mudou (evita piscar)
            if (timestampEl.getAttribute('data-val') !== rawText) {
                timestampEl.innerHTML = htmlFormatado;
                timestampEl.setAttribute('data-val', rawText);
                timestampEl.style.color = 'var(--m3-on-surface-variant)';
                
                // Reinicia a animação CSS
                timestampEl.classList.remove('updated-anim');
                void timestampEl.offsetWidth; 
                timestampEl.classList.add('updated-anim');
            }
        } else {
            timestampEl.innerHTML = `<span class="material-symbols-rounded">warning</span> Formato Inválido`;
        }
        
    } catch (error) {
        console.warn('Erro ao carregar timestamp:', error);
        // Só mostra erro se ainda estiver no estado inicial de "Aguardando"
        if (timestampEl.textContent.includes('Aguardando')) {
             timestampEl.innerHTML = `<span class="material-symbols-rounded">cloud_off</span> Offline`;
             timestampEl.style.color = 'var(--m3-color-error)';
        }
    }
}