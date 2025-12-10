// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 3.0 - Global Aware)
// ==============================================================================

let currentProblems = new Set();

// Som de Alerta (Beep curto)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

/**
 * Cria e exibe um pop-up (toast) na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - 'problem' (vermelho) ou 'success' (verde).
 */
function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'problem' ? '⚠️ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
    toast.innerHTML = `<strong>${icon}</strong> ${message}`;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);
    
    if (type === 'problem') {
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
    }, 7000);
}

/**
 * Lógica Inteligente: Detecta Novos Problemas E Problemas Resolvidos
 */
function checkAndNotifyForNewProblems(newProblems) {
    // 1. Detectar NOVOS problemas (Caiu)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const msg = formatMessage(problemKey);
            showToast(`ALERTA: ${msg}`, 'problem');
        }
    }

    // 2. Detectar Problemas RESOLVIDOS (Voltou)
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const msg = formatMessage(oldProblem);
            showToast(`NORMALIZADO: ${msg}`, 'status-normal'); 
        }
    }
    
    currentProblems = newProblems;
}

// Função auxiliar para formatar o texto da porta
// AGORA PREPARADA PARA RECEBER O NOME DA OLT DA HOME PAGE
function formatMessage(key) {
    let prefixoOlt = "";
    let restoDaChave = key;

    // Verifica se a chave começa com [NOME] (padrão que criamos no index.html)
    // Ex: "[HEL-1] 1/4"
    const oltMatch = key.match(/^\[(.*?)\]\s*(.*)$/);

    if (oltMatch) {
        prefixoOlt = `<strong>${oltMatch[1]}</strong>: `; // Ex: "HEL-1: "
        restoDaChave = oltMatch[2]; // Ex: "1/4"
    }

    const [placa, porta] = restoDaChave.split('/');
    
    // Tratamento de segurança caso venha dados estranhos
    if (!placa || !porta) return key; 

    const placaFmt = placa.replace('GPON', '').padStart(2, '0');
    const portaFmt = porta.padStart(2, '0');
    
    return `${prefixoOlt}PLACA ${placaFmt} / PORTA ${portaFmt}`;
}