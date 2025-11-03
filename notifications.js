// ==============================================================================
// notifications.js - Sistema Central de Alertas (Toast Notifications)
// ==============================================================================

// "Memória" global para armazenar os problemas e evitar alertas repetidos.
// Cada página que usar este script compartilhará a mesma memória enquanto estiver aberta.
let currentProblems = new Set();

/**
 * Cria e exibe um pop-up (toast) na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - O tipo de toast (ex: 'problem') para estilização.
 */
function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return; // Não faz nada se o container não existir

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Animação de entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove o toast após 5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
}

/**
 * Compara a nova lista de problemas com a memória e dispara alertas apenas para novos problemas.
 * @param {Set} newProblems - Um Set contendo as chaves dos problemas da verificação atual (ex: '1/1', 'GPON2/5').
 */
function checkAndNotifyForNewProblems(newProblems) {
    for (const problemKey of newProblems) {
        // Se o problema atual NÃO estava na lista de problemas antigos...
        if (!currentProblems.has(problemKey)) {
            // ...então é um problema novo! Dispara o alerta.
            const [placa, porta] = problemKey.split('/');
            const placaFmt = placa.replace('GPON', '').padStart(2, '0');
            const portaFmt = porta.padStart(2, '0');
            showToast(`Novo PROBLEMA detectado: PLACA ${placaFmt} / PORTA ${portaFmt}`, 'problem');
        }
    }
    
    // Atualiza a memória com a lista de problemas da verificação atual.
    currentProblems = newProblems;
}