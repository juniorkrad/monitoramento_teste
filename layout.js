// ==============================================================================
// layout.js - Construtor de Layout (Header, Sidebar, Footer e Utils)
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

// ==============================================================================
// 1. HEADER (CABEÇALHO)
// ==============================================================================
function loadHeader(config) {
    // Atualiza título da aba
    if (config.title) {
        document.title = config.exactTitle ? config.title : `${config.title} | Monitoramento`;
    }

    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // Botão de Toggle do Menu (Novo) + Botão de Voltar/Home (Existente)
    let navButtons = `
        <button id="menu-toggle" class="icon-btn" title="Menu Principal">
            <span class="material-symbols-rounded">menu</span>
        </button>
    `;

    if (config.buttonText && config.buttonLink) {
        const iconName = config.buttonText.toLowerCase().includes('voltar') ? 'arrow_back' : 'home';
        navButtons += `
            <a href="${config.buttonLink}" class="icon-btn" title="${config.buttonText}">
                <span class="material-symbols-rounded">${iconName}</span>
            </a>`;
    }

    headerPlaceholder.innerHTML = `
        <header class="header">
            <div class="logo-title-group">
                ${navButtons}
                <img src="banner2.png" alt="Logo" onerror="this.style.display='none'" style="margin-left: 10px;">
                <h1>${config.title}</h1>
            </div>
            <nav class="header-nav">
                <div id="update-timestamp" class="timestamp-badge">
                    <span class="material-symbols-rounded">hourglass_empty</span> Aguardando...
                </div>
            </nav>
        </header>
    `;

    // Inicia a escuta do botão do menu (agora que ele existe no DOM)
    initSidebarLogic();
}

// ==============================================================================
// 2. SIDEBAR (MENU LATERAL - NOVO)
// ==============================================================================
function loadSidebar() {
    // Procura um placeholder ou cria se não existir (para facilitar)
    let sidebarContainer = document.getElementById('sidebar-placeholder');
    if (!sidebarContainer) {
        // Se não tiver placeholder, injeta no início do body
        sidebarContainer = document.createElement('div');
        sidebarContainer.id = 'sidebar-placeholder';
        document.body.prepend(sidebarContainer);
    }

    // Define os links do seu projeto aqui
    const menuItems = [
        { name: 'Dashboard Geral', link: 'index.html', icon: 'dashboard' },
        { type: 'separator', label: 'Nokia' },
        { name: 'HEL1 (Nokia)', link: 'hel1.html', icon: 'router' },
        { name: 'HEL2 (Nokia)', link: 'hel2.html', icon: 'router' },
        { type: 'separator', label: 'Furukawa' },
        { name: 'MGP (Furukawa)', link: 'mgp.html', icon: 'settings_ethernet' },
        // Adicione mais links conforme necessário
    ];

    let menuHtml = '<ul class="sidebar-menu">';
    
    // Identifica página atual para marcar ativo
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';

    menuItems.forEach(item => {
        if (item.type === 'separator') {
            menuHtml += `<li class="menu-label">${item.label}</li>`;
        } else {
            const isActive = item.link === currentPath ? 'active-link' : '';
            menuHtml += `
                <li>
                    <a href="${item.link}" class="${isActive}">
                        <span class="material-symbols-rounded">${item.icon}</span>
                        ${item.name}
                    </a>
                </li>
            `;
        }
    });

    menuHtml += '</ul>';
    
    // Adiciona o Relógio Local no final do menu
    menuHtml += `<div id="live-clock" class="menu-clock">--:--:--</div>`;

    sidebarContainer.innerHTML = `
        <nav class="sidebar" id="main-sidebar">
            <div class="sidebar-header">
                <h3>Navegação</h3>
                <button id="close-sidebar" class="icon-btn-small">✕</button>
            </div>
            ${menuHtml}
        </nav>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;

    // Inicia o relógio local
    startLiveClock();
}

// Lógica de Abrir/Fechar Menu
function initSidebarLogic() {
    const toggleBtn = document.getElementById('menu-toggle');
    const closeBtn = document.getElementById('close-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('main-sidebar');

    function toggleMenu() {
        if (sidebar) sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
    }

    if (toggleBtn) toggleBtn.addEventListener('click', toggleMenu);
    if (closeBtn) closeBtn.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);
}

// ==============================================================================
// 3. UTILS (Relógio Local e Timestamp Google Sheets)
// ==============================================================================

function startLiveClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;
    
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('pt-BR');
    }, 1000);
}

// Mantido igual ao seu original, apenas encapsulado no arquivo layout
async function loadTimestamp(sheetTab, apiKey, sheetId) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    const range = `${sheetTab}!K1`; 
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha timestamp');
        const data = await response.json();
        
        if (data.values && data.values.length > 0) {
            const rawText = data.values[0][0];
            const cleanText = rawText.replace('Atualizado em:', '').trim();
            const parts = cleanText.split(' ');
            
            let htmlFormatado = '';
            if (parts.length >= 2) {
                htmlFormatado = `
                    <span class="material-symbols-rounded">calendar_today</span> ${parts[0]}
                    <span style="opacity:0.3; margin:0 5px;">|</span>
                    <span class="material-symbols-rounded">schedule</span> ${parts[1]}
                `;
            } else {
                htmlFormatado = `<span class="material-symbols-rounded">schedule</span> ${cleanText}`;
            }
            
            if (timestampEl.getAttribute('data-val') !== cleanText) {
                timestampEl.innerHTML = htmlFormatado;
                timestampEl.setAttribute('data-val', cleanText);
                timestampEl.classList.remove('updated-anim');
                void timestampEl.offsetWidth; 
                timestampEl.classList.add('updated-anim');
            }
        }
    } catch (e) { console.warn('Erro Timestamp', e); }
}

// ==============================================================================
// 4. FOOTER
// ==============================================================================
function loadFooter() {
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (!footerPlaceholder) return;
    const currentYear = new Date().getFullYear();
    footerPlaceholder.innerHTML = `
        <footer class="footer">
            <p>© ${currentYear} Painel de Monitoramento | Desenvolvido por 👤@juniorkrad + 🤖Gemini</p>
        </footer>
    `;
}