// ==============================================================================
// layout.js - Construtor de Layout Otimizado
// ==============================================================================

/**
 * Constrói o cabeçalho da página de forma dinâmica.
 * @param {Object} config - { title: string, buttonText?: string, buttonLink?: string }
 */
function loadHeader(config) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    
    // 1. Atualiza o título da aba do navegador automaticamente
    if (config.title) {
        document.title = `${config.title} | Monitoramento`;
    }

    if (!headerPlaceholder) return;

    // 2. Lógica inteligente para o botão
    let buttonHtml = '';
    if (config.buttonText && config.buttonLink) {
        // Se o texto contiver "Voltar", usa a classe específica .back-button (que tem borda)
        // Caso contrário, usa .nav-button (estilo padrão)
        const cssClass = config.buttonText.toLowerCase().includes('voltar') 
            ? 'back-button' 
            : 'nav-button';
            
        buttonHtml = `<a href="${config.buttonLink}" class="${cssClass}">${config.buttonText}</a>`;
    }

    headerPlaceholder.innerHTML = `
        <header class="header">
            <div class="logo-title-group">
                <img src="banner2.png" alt="Logo" onerror="this.style.display='none'">
                <h1>${config.title || 'Painel'}</h1>
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
            <p>
                © ${currentYear} Painel de Monitoramento <br>
                <span style="font-size: 0.85em; opacity: 0.8;">
                    Desenvolvido por 👤@juniorkrad + 🤖Gemini
                </span>
            </p>
        </footer>
    `;
}

/**
 * Busca e exibe o timestamp da célula K1 da planilha.
 * Inclui "Cache Busting" para garantir dados frescos.
 */
async function loadTimestamp(sheetTab, apiKey, sheetId) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    // Estado de carregamento com classe CSS (se quiser estilizar depois)
    timestampEl.textContent = 'Verificando atualização...';
    timestampEl.classList.add('loading-timestamp');

    const range = `${sheetTab}!K1`;
    // Adiciona o parâmetro &cacheBust para evitar cache do navegador/API
    const cacheBust = new Date().getTime(); 
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}&cacheBust=${cacheBust}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Erro na API');
        
        const data = await response.json();
        
        if (data.values && data.values.length > 0 && data.values[0][0]) {
            // Sucesso
            timestampEl.textContent = data.values[0][0];
            // Remove animação de carregamento se houver
            timestampEl.classList.remove('loading-timestamp');
        } else {
            timestampEl.textContent = 'Data indisponível';
        }
    } catch (error) {
        console.warn('Não foi possível carregar a data da planilha:', error);
        // Em caso de erro, mostramos a hora do navegador como fallback
        const now = new Date();
        timestampEl.textContent = `Ref: ${now.toLocaleTimeString()}`;
    }
}