// ==============================================================================
// layout.js - Construtor de Layout (Corrigido e Formatado)
// ==============================================================================

/**
 * Constrói o cabeçalho da página de forma dinâmica.
 */
function loadHeader(config) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    
    // Atualiza o título da aba do navegador
    if (config.title) {
        document.title = `${config.title} | Monitoramento`;
    }

    if (!headerPlaceholder) return;

    // Lógica inteligente para o botão (Voltar vs Normal)
    let buttonHtml = '';
    if (config.buttonText && config.buttonLink) {
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
 * Busca a data na planilha e remove os segundos para visual limpo.
 */
async function loadTimestamp(sheetTab, apiKey, sheetId) {
    const timestampEl = document.getElementById('update-timestamp');
    if (!timestampEl) return;

    // Texto inicial discreto
    timestampEl.textContent = 'Atualizando...';
    timestampEl.classList.add('loading-timestamp');

    const range = `${sheetTab}!K1`;
    // Usamos um número aleatório para garantir que o Google não nos dê dados velhos (Cache)
    const cacheBust = Math.floor(Math.random() * 10000);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}&cb=${cacheBust}`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Erro na API');
        
        const data = await response.json();
        
        if (data.values && data.values.length > 0 && data.values[0][0]) {
            let rawText = data.values[0][0]; // Ex: "Atualizado em: 05/12/2025 12:25:04"
            
            // --- MÁGICA PARA REMOVER SEGUNDOS ---
            // Procura por ":dois digitos" no final da frase e remove
            // Transforma "12:25:04" em "12:25"
            let formattedText = rawText.replace(/:\d{2}$/, '');
            
            timestampEl.textContent = formattedText;
            timestampEl.classList.remove('loading-timestamp');
        } else {
            throw new Error('Célula vazia');
        }
    } catch (error) {
        console.warn('Usando data local devido a erro na planilha:', error);
        
        // FALLBACK: Se der erro, mostra a data do PC no formato correto (sem "Ref")
        const now = new Date();
        const options = { 
            day: '2-digit', month: '2-digit', year: 'numeric', 
            hour: '2-digit', minute: '2-digit' // Sem segundos!
        };
        const dataLocal = now.toLocaleDateString('pt-BR', options);
        timestampEl.textContent = `Atualizado em: ${dataLocal}`;
    }
}