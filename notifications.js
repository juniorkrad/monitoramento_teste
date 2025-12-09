// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 2.0 - Proactive)
// ==============================================================================

let currentProblems = new Set();

// Som de Alerta (Beep curto em Base64 para não depender de arquivos externos)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); // Som vazio por padrão, substitua se tiver um arquivo real ou use um link.
// Dica: Para um beep real, recomendo baixar um arquivo 'beep.mp3' curto e colocar na pasta.
// Exemplo: const alertSound = new Audio("beep.mp3");

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
    
    // Adiciona ícones baseados no tipo
    const icon = type === 'problem' ? '⚠️ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
    toast.innerHTML = `<strong>${icon}</strong> ${message}`;
    
    // Permite fechar ao clicar
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);
    
    // Toca som apenas se for problema crítico
    if (type === 'problem') {
        // O navegador exige interação do usuário antes de tocar som.
        // Isso vai funcionar após o primeiro clique do usuário na página.
        try { alertSound.play().catch(e => {}); } catch(e){} 
    }

    // Animação de entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove automaticamente após 7 segundos (aumentei um pouco para dar tempo de ler)
    setTimeout(() => {
        if (toast.parentElement) { // Verifica se já não foi removido pelo clique
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
    // Se estava na lista antiga (current) mas NÃO está na nova (new), então voltou!
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const msg = formatMessage(oldProblem);
            showToast(`NORMALIZADO: ${msg}`, 'status-normal'); // Usa a cor verde do seu CSS (status-normal ou success)
        }
    }
    
    // Atualiza a memória
    currentProblems = newProblems;
}

// Função auxiliar para formatar o texto da porta
function formatMessage(key) {
    const [placa, porta] = key.split('/');
    const placaFmt = placa.replace('GPON', '').padStart(2, '0');
    const portaFmt = porta.padStart(2, '0');
    return `PLACA ${placaFmt} / PORTA ${portaFmt}`;
}