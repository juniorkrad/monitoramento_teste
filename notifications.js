// ==============================================================================
// notifications.js - Sistema Central de Alertas (Toast Notifications)
// ==============================================================================

// "Memória" global para armazenar os problemas e evitar alertas repetidos.
let currentProblems = new Set();

/**
 * Cria e exibe um pop-up (toast) na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - A classe CSS do tipo (ex: 'toast-error' ou 'toast-success').
 */
function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    
    // Se o container ainda não existir (segurança), cria ele rapidinho para não dar erro
    if (!container) return; 

    const toast = document.createElement('div');
    // Aplica a classe base 'toast' e o tipo específico (error ou success)
    toast.className = `toast ${type}`;
    
    // Adiciona um ícone simples baseado no tipo para ficar visualmente claro
    const icon = type.includes('error') ? '⚠️' : '✅';
    toast.innerHTML = `<strong>${icon}</strong> ${message}`;
    
    container.appendChild(toast);
    
    // Animação de entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove o toast após 5 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) toast.remove();
        });
    }, 5000);
}

/**
 * Helper simples para formatar o texto (Evita repetir código)
 */
function formatarTextoOLT(problemKey) {
    const [placa, porta] = problemKey.split('/');
    // Remove qualquer texto (GPON, EPON) e deixa só numeros, com 2 digitos
    const placaFmt = placa.replace(/\D/g, '').padStart(2, '0'); 
    const portaFmt = porta.padStart(2, '0');
    return `PLACA ${placaFmt} / PORTA ${portaFmt}`;
}

/**
 * Compara a nova lista de problemas com a memória.
 * Dispara alertas para NOVOS problemas e para NORMALIZAÇÕES.
 * @param {Set} newProblems - Set com os problemas atuais.
 */
function checkAndNotifyForNewProblems(newProblems) {
    
    // 1. Verifica se entrou um NOVO problema (Vermelho)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const msg = formatarTextoOLT(problemKey);
            showToast(`FALHA: ${msg}`, 'toast-error');
        }
    }
    
    // 2. Verifica se um problema SAIU (Verde/Normalizado) - [ATUALIZAÇÃO QUE VOCÊ PEDIU]
    for (const problemKey of currentProblems) {
        if (!newProblems.has(problemKey)) {
            const msg = formatarTextoOLT(problemKey);
            showToast(`NORMALIZADO: ${msg}`, 'toast-success');
        }
    }
    
    // Atualiza a memória
    currentProblems = newProblems;
}