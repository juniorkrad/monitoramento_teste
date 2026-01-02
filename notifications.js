// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 5.0 - Super Prioridade)
// ==============================================================================

let currentProblems = new Set();

// Som de Alerta (Beep curto)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

/**
 * Cria e exibe um pop-up (toast) na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - 'super-priority', 'problem', 'warning' ou 'status-normal'.
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
    // Adiciona a classe do tipo para pegar a cor de fundo (será definida no CSS)
    toast.className = `toast ${type}`;
    
    // --- SELEÇÃO DE ÍCONES (Material Symbols) ---
    let iconName = 'info'; // Padrão
    
    if (type === 'super-priority') {
        iconName = 'fmd_bad';      // Ícone de Perigo Extremo / Localização de Erro
    } else if (type === 'problem') {
        iconName = 'error';        // Erro comum
    } else if (type === 'warning') {
        iconName = 'warning';      // Atenção
    } else if (type === 'status-normal' || type === 'success') {
        iconName = 'check_circle'; // Resolvido
    }

    // Monta o HTML com o span da fonte do Google
    // OBS: A classe toast-icon permite que o CSS controle o tamanho (gigante no super priority)
    toast.innerHTML = `
        <span class="material-symbols-rounded toast-icon" style="font-size: 24px; margin-right: 10px;">${iconName}</span>
        <span>${message}</span>
    `;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);
    
    // --- LÓGICA DE SOM ---
    if (type === 'problem' || type === 'warning' || type === 'super-priority') {
        try { 
            alertSound.play().catch(e => {}); 
            
            // SE FOR SUPER PRIORIDADE: Toca duas vezes para dar ênfase (Tudum... Tudum!)
            if (type === 'super-priority') {
                setTimeout(() => { alertSound.play().catch(e => {}) }, 250);
            }
        } catch(e){} 
    }

    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // --- TEMPO DE EXIBIÇÃO ---
    // Super Prioridade fica mais tempo (10s), outros ficam 7s
    const duration = (type === 'super-priority') ? 10000 : 7000;

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }, duration); 
}

/**
 * Lógica Inteligente: Detecta Novos Problemas e Define a Gravidade
 */
function checkAndNotifyForNewProblems(newProblems) {
    // 1. Detectar NOVOS problemas (Caiu)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const oltName = formatMessage(problemKey);
            
            // --- HIERARQUIA DE ALERTAS ---
            
            // NÍVEL 1: SUPER PRIORIDADE (100% Down - Tag ::SUPER)
            if (problemKey.includes('::SUPER')) {
                showToast(`FALHA CRÍTICA: <strong>${oltName}</strong>`, 'super-priority');
            } 
            // NÍVEL 2: ATENÇÃO (Exatos 16 - Tag ::WARN)
            else if (problemKey.includes('::WARN')) {
                showToast(`ATENÇÃO: <strong>${oltName}</strong>`, 'warning');
            } 
            // NÍVEL 3: PROBLEMA COMUM (>16 ou >50% - Sem tag ou ::CRIT)
            else {
                showToast(`PROBLEMA: <strong>${oltName}</strong>`, 'problem');
            }
        }
    }

    // 2. Detectar Problemas RESOLVIDOS (Voltou)
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const oltName = formatMessage(oldProblem);
            showToast(`NORMALIZADO: <strong>${oltName}</strong>`, 'status-normal'); 
        }
    }
    
    currentProblems = newProblems;
}

// Função auxiliar para extrair APENAS o nome da OLT
function formatMessage(key) {
    // A chave vem completa: "[HEL-1] STATUS::WARN" ou "[HEL-1] STATUS::SUPER"
    const oltMatch = key.match(/^\[(.*?)\]/);
    if (oltMatch) {
        return oltMatch[1]; // Retorna "HEL-1"
    }
    
    return "OLT DESCONHECIDA";
}