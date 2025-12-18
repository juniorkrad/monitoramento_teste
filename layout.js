// ==============================================================================
// layout.js - Construtor de Layout (Cabeçalho, Rodapé e Timestamp)
// ==============================================================================

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
            // Se pedir o título exato, usa apenas o texto informado (Para a Home)
            document.title = config.title;
        } else {
            // Padrão para as outras páginas: Adiciona o sufixo da empresa/sistema
            document.title = `${config.title} | Monitoramento`;
        }
    }

    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!headerPlaceholder) return;

    // 2. Lógica do botão (Home/Voltar) - AGORA COM ÍCONES
    let buttonHtml = '';
    if (config.buttonText && config.buttonLink) {
        // Detecta se é botão de voltar ou home para escolher o ícone certo
        // Se o texto incluir "Voltar" (maiusculo ou minusculo), usa seta. Senão, usa casa.
        const iconName = config.buttonText.toLowerCase().includes('voltar') ? 'arrow_back' : 'home';
        
        // Usa a classe .icon-btn definida no CSS e title para acessibilidade (tooltip)
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
                <span id="update-timestamp" class="timestamp-badge">
                    <span class="material-symbols-rounded" style="font-size: 18px;">schedule</span> 
                    Aguardando dados...
                </span>
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
            
            // Lógica de comparação: 
            // Como agora temos um ícone dentro do elemento, o .textContent ou .innerText pode conter a palavra "schedule".
            // Removemos "schedule" e espaços para comparar apenas a data/hora.
            const textoAtualLimpo = timestampEl.innerText.replace('schedule', '').trim();

            // Só atualiza o DOM se a data for diferente
            if (textoAtualLimpo !== novaData) {
                
                // IMPORTANTE: Usamos innerHTML para reinserir o ícone junto com a nova data
                timestampEl.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px;">schedule</span> ${novaData}`;
                
                timestampEl.style.color = 'var(--m3-on-surface-variant)'; // Cor normal
                
                // Efeito visual de "blink"
                timestampEl.classList.remove('updated-anim');
                void timestampEl.offsetWidth; // Força reflow
                timestampEl.classList.add('updated-anim');
            }
        } else {
            // Mantém o ícone mesmo em caso de data indisponível
            timestampEl.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px;">schedule</span> Data Indisponível`;
        }
    } catch (error) {
        console.warn('Não foi possível atualizar o horário:', error);
        if (timestampEl.textContent.includes('Aguardando') || timestampEl.textContent.includes('Buscando')) {
             // Mantém o ícone e avisa erro
             timestampEl.innerHTML = `<span class="material-symbols-rounded" style="font-size: 18px;">error</span> Erro de conexão`;
             timestampEl.style.color = 'var(--m3-color-error)';
        }
    }
}