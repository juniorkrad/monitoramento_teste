// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 4.2 - Ícones Material)
// ==============================================================================

let currentProblems = new Set();

// Som de Alerta (Beep curto)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

/**
 * Cria e exibe um pop-up (toast) na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - 'problem' (vermelho), 'warning' (amarelo) ou 'status-normal' (verde).
 */
function showToast(message, type = '') {
    // --- TRAVA DE SEGURANÇA ---
    // Verifica em qual página estamos.
    // Se NÃO for a index.html (Dashboard), cancela a exibição do alerta.
    const path = window.location.pathname;
    const pageName = path.split('/').pop(); 

    if (pageName && pageName !== 'index.html') {
        return; 
    }
    // ----------------------------------

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    // Adiciona a classe do tipo para pegar a cor de fundo (definida no CSS)
    toast.className = `toast ${type}`;
    
    // --- SELEÇÃO DE ÍCONES (Material Symbols) ---
    let iconName = 'info'; // Padrão
    
    if (type === 'problem') {
        iconName = 'error';        // Solicitado: error
    } else if (type === 'warning') {
        iconName = 'warning';      // Solicitado: warning
    } else if (type === 'status-normal' || type === 'success') {
        iconName = 'check_circle'; // Solicitado: check_circle
    }

    // Monta o HTML com o span da fonte do Google
    toast.innerHTML = `
        <span class="material-symbols-rounded" style="font-size: 24px; margin-right: 10px;">${iconName}</span>
        <span>${message}</span>
    `;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);
    
    // Toca som para problemas E avisos de atenção
    if (type === 'problem' || type === 'warning') {
        try { alertSound.play().catch(e => {}); } catch(e){} 
    }

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }, 7000); // 7 segundos de exibição
}

/**
 * Lógica Inteligente: Detecta Novos Problemas e Define a Cor (Amarelo/Vermelho)
 */
function checkAndNotifyForNewProblems(newProblems) {
    // 1. Detectar NOVOS problemas (Caiu)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const oltName = formatMessage(problemKey);
            
            // Detecta a gravidade baseada na TAG que virá do index.html
            // Exemplo de chave: "[HEL-1] STATUS::WARN" ou "[HEL-1] STATUS::CRIT"
            if (problemKey.includes('::WARN')) {
                showToast(`ATENÇÃO: <strong>${oltName}</strong>`, 'warning');
            } else {
                // Se for CRIT ou sem tag, assume problema grave
                showToast(`PROBLEMA: <strong>${oltName}</strong>`, 'problem');
            }
        }
    }

    // 2. Detectar Problemas RESOLVIDOS (Voltou)
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const oltName = formatMessage(oldProblem);
            showToast(`NORMALIZADO: <strong>${oltName}</strong>`, 'status-normal'); // Usa classe verde do CSS
        }
    }
    
    currentProblems = newProblems;
}

// Função auxiliar para extrair APENAS o nome da OLT
function formatMessage(key) {
    // A chave vem completa para garantir unicidade: "[HEL-1] STATUS::WARN"
    // Nós queremos extrair apenas "HEL-1" para exibir.
    
    const oltMatch = key.match(/^\[(.*?)\]/);
    if (oltMatch) {
        return oltMatch[1]; // Retorna "HEL-1", "SBO-1", etc.
    }
    
    return "OLT DESCONHECIDA";
}