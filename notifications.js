// ==============================================================================
// notifications.js - Sistema Central de Alertas (Visual e Silencioso)
// ==============================================================================

// "Memória" global para armazenar os problemas e evitar alertas repetidos.
let currentProblems = new Set();
const MAX_VISIBLE_TOASTS = 5; // Limite para não poluir a tela visualmente

/**
 * Cria e exibe um pop-up (toast) na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - 'problem' (vermelho) ou 'success' (verde).
 */
function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return; // Não faz nada se o container não existir

    // Controle de Spam: Remove o alerta mais antigo se tiver muitos na tela
    if (container.childElementCount >= MAX_VISIBLE_TOASTS) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    
    // Define ícones visuais baseados no tipo
    let icon = '';
    if (type === 'problem') icon = '⚠️ ';
    if (type === 'success') icon = '✅ ';

    toast.className = `toast ${type}`;
    toast.innerHTML = `<strong>${icon}</strong> ${message}`;
    
    container.appendChild(toast);
    
    // Animação de entrada
    // Usamos requestAnimationFrame para garantir que a transição CSS funcione
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove o toast automaticamente após 6 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) toast.remove();
        });
    }, 6000);
}

/**
 * Lógica Inteligente: Detecta novos problemas E problemas resolvidos.
 * @param {Set} newProblems - Set com chaves dos problemas atuais da verificação.
 */
function checkAndNotifyForNewProblems(newProblems) {
    // 1. Detectar NOVOS problemas (Caiu)
    for (const problemKey of newProblems) {
        // Se o problema atual NÃO estava na lista antiga...
        if (!currentProblems.has(problemKey)) {
            const msg = formatMessage(problemKey);
            showToast(`ALERTA: ${msg} ficou OFFLINE`, 'problem');
        }
    }

    // 2. Detectar problemas RESOLVIDOS (Voltou)
    for (const oldProblem of currentProblems) {
        // Se estava na lista antiga, mas NÃO está na nova...
        if (!newProblems.has(oldProblem)) {
            const msg = formatMessage(oldProblem);
            showToast(`RESOLVIDO: ${msg} está ONLINE novamente`, 'success');
        }
    }
    
    // Atualiza a memória com a lista de problemas da verificação atual.
    currentProblems = newProblems;
}

/**
 * Helper para formatar a mensagem da placa/porta de forma legível.
 * Transforma "GPON1/5" em "PLACA 01 / PORTA 05"
 */
function formatMessage(key) {
    const parts = key.split('/');
    
    if (parts.length >= 2) {
        // Limpa "GPON" se existir e formata
        let placa = parts[0].replace(/GPON/i, '').trim();
        let porta = parts[1].trim();
        
        // Adiciona zero à esquerda para ficar alinhado (01, 02...)
        placa = placa.padStart(2, '0');
        porta = porta.padStart(2, '0');
        
        return `PLACA ${placa} / PORTA ${porta}`;
    }
    
    return key; // Retorna original se não conseguir formatar
}