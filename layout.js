// ==============================================================================
// layout.js - Construtor de Layout (Cabeçalho, Rodapé e Timestamp)
// ==============================================================================

/**
 * Constrói o cabeçalho da página.
 * Oculta o botão se config.buttonText ou config.buttonLink não forem fornecidos.
 */
function loadHeader(config) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // --- INÍCIO DA ALTERAÇÃO ---
    // Cria o HTML do botão apenas se o texto e o link do botão existirem
    let buttonHtml = '';
    if (config.buttonText && config.buttonLink) {
        buttonHtml = `<a href="${config.buttonLink}" class="nav-button">${config.buttonText}</a>`;
    }
    // --- FIM DA ALTERAÇÃO ---

    headerPlaceholder.innerHTML = `
        <header class="header">
            <div class="logo-title-group">
                <img src="banner2.png" alt="Logo da Empresa">
                <h1>${config.title}</h1>
            </div>
            <nav class="header-nav">
                <span id="update-timestamp"></span>
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
 * Busca e exibe o timestamp da coleta de dados a partir da planilha.
 */
async function loadTimestamp(sheetTab, apiKey, sheetId) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    timestampEl.textContent = 'Buscando data...';
    const range = `${sheetTab}!K1`; // A célula onde o script Python salva a data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha na busca do timestamp.');
        
        const data = await response.json();
        if (data.values && data.values.length > 0 && data.values[0][0]) {
            timestampEl.textContent = data.values[0][0]; // Exibe o texto da célula K1
        } else {
            timestampEl.textContent = 'Data não encontrada.';
        }
    } catch (error) {
        timestampEl.textContent = 'Falha ao buscar data.';
        console.error('Erro ao buscar timestamp:', error);
    }
}