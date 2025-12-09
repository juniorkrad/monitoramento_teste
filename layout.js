// ==============================================================================
// layout.js - Construtor de Layout (Cabeçalho, Rodapé e Timestamp)
// ==============================================================================

/**
 * Constrói o cabeçalho da página.
 * Oculta o botão se config.buttonText ou config.buttonLink não forem fornecidos.
 * @param {Object} config - Objeto contendo title, buttonText, buttonLink.
 */
function loadHeader(config = {}) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // --- LÓGICA DO BOTÃO ---
    // Cria o HTML do botão apenas se o texto e o link existirem.
    // Caso contrário, deixa a variável vazia (não renderiza nada).
    let buttonHtml = '';
    if (config.buttonText && config.buttonLink) {
        buttonHtml = `<a href="${config.buttonLink}" class="nav-button">${config.buttonText}</a>`;
    }

    headerPlaceholder.innerHTML = `
        <header class="header">
            <div class="logo-title-group">
                <img src="banner2.png" alt="Logo da Empresa">
                <h1>${config.title || 'Painel de Monitoramento'}</h1>
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
 * @param {string} sheetTab - O nome da aba na planilha (ex: 'Resumo').
 * @param {string} apiKey - Sua chave de API do Google.
 * @param {string} sheetId - O ID da planilha.
 */
async function loadTimestamp(sheetTab, apiKey, sheetId) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    timestampEl.textContent = 'Buscando data...';
    
    // NOTA: Se o nome da aba tiver espaços, o ideal é usar aspas simples: `'${sheetTab}'!K1`
    const range = `${sheetTab}!K1`; // A célula onde o script Python salva a data
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha na busca do timestamp.');
        
        const data = await response.json();
        
        // Verifica se veio valor na célula
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