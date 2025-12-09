// ==============================================================================
// layout.js - Construtor de Layout (Cabeçalho, Rodapé e Timestamp)
// ==============================================================================

/**
 * Constrói o cabeçalho da página.
 * Atualiza também o título da aba do navegador.
 */
function loadHeader(config) {
    // 1. Atualiza o título da aba do navegador automaticamente
    if (config.title) {
        document.title = `${config.title} | Monitoramento`;
    }

    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // 2. Lógica do botão (Home/Voltar)
    let buttonHtml = '';
    if (config.buttonText && config.buttonLink) {
        buttonHtml = `<a href="${config.buttonLink}" class="nav-button">${config.buttonText}</a>`;
    }

    headerPlaceholder.innerHTML = `
        <header class="header">
            <div class="logo-title-group">
                <img src="banner2.png" alt="Logo" onerror="this.style.display='none'">
                <h1>${config.title}</h1>
            </div>
            <nav class="header-nav">
                <span id="update-timestamp" class="timestamp-badge">Aguardando dados...</span>
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
 * Inclui feedback visual de atualização.
 */
async function loadTimestamp(sheetTab, apiKey, sheetId) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    // range: A célula onde o script Python salva a data
    const range = `${sheetTab}!K1`; 
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha na busca do timestamp.');
        
        const data = await response.json();
        
        if (data.values && data.values.length > 0 && data.values[0][0]) {
            const novaData = data.values[0][0];
            
            // Só atualiza o DOM se a data for diferente (evita repaint desnecessário)
            if (timestampEl.textContent !== novaData) {
                timestampEl.textContent = novaData;
                timestampEl.style.color = 'var(--m3-on-surface-variant)'; // Cor normal
                
                // Efeito visual de "blink" para mostrar que atualizou
                timestampEl.classList.remove('updated-anim');
                void timestampEl.offsetWidth; // Força reflow para reiniciar animação
                timestampEl.classList.add('updated-anim');
            }
        } else {
            timestampEl.textContent = 'Data Indisponível';
        }
    } catch (error) {
        // Em caso de erro, não apaga a data antiga se ela existir, apenas muda a cor ou avisa no console
        console.warn('Não foi possível atualizar o horário:', error);
        if (timestampEl.textContent === 'Aguardando dados...' || timestampEl.textContent === 'Buscando data...') {
             timestampEl.textContent = 'Erro de conexão';
             timestampEl.style.color = 'var(--m3-color-error)';
        }
    }
}