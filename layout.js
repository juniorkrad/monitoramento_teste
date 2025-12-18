// ==============================================================================
// layout.js - Construtor de Layout (Cabeçalho, Rodapé e Timestamp)
// ==============================================================================

// --- AUTO-INJEÇÃO DA FONTE DE ÍCONES ---
// Isso garante que todas as páginas tenham os ícones sem precisar editar o HTML de cada uma.
(function loadIconFont() {
    const fontUrl = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    // Verifica se já existe o link para não duplicar
    if (!document.querySelector(`link[href="${fontUrl}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
    }
})();

/**
 * Constrói o cabeçalho da página.
 * Atualiza também o título da aba do navegador.
 * * @param {Object} config - Configurações do cabeçalho
 * @param {string} config.title - O título da página
 * @param {boolean} [config.exactTitle] - Se true, usa o título exato. Se false/vazio, adiciona "| Monitoramento"
 * @param {string} [config.buttonText] - Texto do botão de navegação
 * @param {string} [config.buttonLink] - Link do botão de navegação
 */
function loadHeader(config) {
    // 1. Atualiza o título da aba do navegador
    if (config.title) {
        if (config.exactTitle) {
            document.title = config.title;
        } else {
            document.title = `${config.title} | Monitoramento`;
        }
    }

    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // 2. Lógica do botão (Home/Voltar) - COM ÍCONES
    let buttonHtml = '';
    if (config.buttonText && config.buttonLink) {
        // Detecta se é botão de voltar ou home para escolher o ícone certo
        const iconName = config.buttonText.toLowerCase().includes('voltar') ? 'arrow_back' : 'home';
        
        buttonHtml = `
            <a href="${config.buttonLink}" class="icon-btn" title="${config.buttonText}">
                <span class="material-symbols-rounded">${iconName}</span>
            </a>`;
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
                ${buttonHtml} 
            </nav>
        </header>
    `;
}

/**
 * Constrói o rodapé padrão.
 */
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

/**
 * Busca e exibe o timestamp da coleta de dados.
 * Inclui feedback visual de atualização com ÍCONES DE CALENDÁRIO E RELÓGIO.
 */
async function loadTimestamp(sheetTab, apiKey, sheetId) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    const range = `${sheetTab}!K1`; 
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha na busca do timestamp.');
        
        const data = await response.json();
        
        if (data.values && data.values.length > 0 && data.values[0][0]) {
            // O dado vem geralmente como: "Atualizado em: 18/12/2025 14:30:00"
            const rawText = data.values[0][0];
            
            // 1. Removemos o texto "Atualizado em:" para limpar
            const cleanText = rawText.replace('Atualizado em:', '').trim();
            
            // 2. Tentamos separar a Data da Hora (geralmente separados por espaço)
            const parts = cleanText.split(' ');
            
            let htmlFormatado = '';

            if (parts.length >= 2) {
                // Se conseguimos separar, montamos o HTML com os dois ícones
                const dataPart = parts[0]; // Ex: 18/12/2025
                const horaPart = parts[1]; // Ex: 14:30:00
                
                htmlFormatado = `
                    <span class="material-symbols-rounded">calendar_today</span> ${dataPart}
                    <span style="width: 1px; height: 12px; background: rgba(255,255,255,0.3); margin: 0 5px;"></span>
                    <span class="material-symbols-rounded">schedule</span> ${horaPart}
                `;
            } else {
                // Se não der para separar, mostra tudo com o relógio
                htmlFormatado = `<span class="material-symbols-rounded">schedule</span> ${cleanText}`;
            }
            
            // Verifica se o texto mudou comparando com um atributo salvo (para evitar piscar sem necessidade)
            if (timestampEl.getAttribute('data-val') !== cleanText) {
                timestampEl.innerHTML = htmlFormatado;
                timestampEl.setAttribute('data-val', cleanText); // Salva o valor atual
                
                timestampEl.style.color = 'var(--m3-on-surface-variant)';
                
                // Animação visual
                timestampEl.classList.remove('updated-anim');
                void timestampEl.offsetWidth; 
                timestampEl.classList.add('updated-anim');
            }
        } else {
            timestampEl.innerHTML = `<span class="material-symbols-rounded">error</span> S/ Dados`;
        }
    } catch (error) {
        console.warn('Não foi possível atualizar o horário:', error);
        if (timestampEl.textContent.includes('Aguardando') || timestampEl.textContent.includes('Buscando')) {
             timestampEl.innerHTML = `<span class="material-symbols-rounded">wifi_off</span> Erro de conexão`;
             timestampEl.style.color = 'var(--m3-color-error)';
        }
    }
}