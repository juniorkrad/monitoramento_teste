// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 5.1 - Memória Backbone)
// ==============================================================================

// Memórias de Estado (O "Cérebro" do Vigilante)
let currentProblems = new Set();
let currentBackbones = new Set(); 

// Som de Alerta (Beep curto)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

/**
 * Cria e exibe um pop-up (toast) na tela.
 */
function showToast(message, type = '') {
    // --- TRAVA DE SEGURANÇA ---
    const path = window.location.pathname;
    const pageName = path.split('/').pop(); 

    if (pageName && pageName !== 'index.html' && pageName !== '') {
        return; 
    }
    // ----------------------------------

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // --- SELEÇÃO DE ÍCONES (Material Symbols) ---
    let iconName = 'info'; 
    if (type === 'super-priority') iconName = 'fmd_bad';
    else if (type === 'problem') iconName = 'error';
    else if (type === 'warning') iconName = 'warning';
    else if (type === 'status-normal' || type === 'success') iconName = 'check_circle';

    // Monta o HTML do Toast
    toast.innerHTML = `
        <span class="material-symbols-rounded toast-icon" style="font-size: 24px; margin-right: 10px;">${iconName}</span>
        <div style="display: flex; flex-direction: column; gap: 4px;">${message}</div>
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
            if (type === 'super-priority') {
                setTimeout(() => { alertSound.play().catch(e => {}) }, 250);
            }
        } catch(e){} 
    }

    setTimeout(() => toast.classList.add('show'), 10);

    // --- TEMPO DE EXIBIÇÃO ---
    const duration = (type === 'super-priority') ? 10000 : 8000;

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }, duration); 
}

/**
 * Lógica Inteligente: Detecta Novos Problemas, Normalizações e Reparo de Backbone
 */
function checkAndNotifyForNewProblems(newProblems, activeBackbones = new Set()) {
    
    // 1. Detectar NOVOS problemas (Caiu)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const oltName = formatMessage(problemKey);
            
            // --- HIERARQUIA DE ALERTAS (CTO) ---
            if (problemKey.includes('::SUPER')) {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">FALHA CRÍTICA</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltName}</span>`, 'super-priority');
            } 
            else if (problemKey.includes('::WARN')) {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">ATENÇÃO</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltName}</span>`, 'warning');
            } 
            else {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">PROBLEMA</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltName}</span>`, 'problem');
            }
        }
    }

    // 2. Detectar Problemas RESOLVIDOS (Voltou - Normalização Padrão)
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const oltName = formatMessage(oldProblem);
            showToast(`<strong style="font-size: 1.1em; margin: 0;">Circuito Normalizado</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltName} operante</span>`, 'status-normal'); 
        }
    }
    
    currentProblems = newProblems;

    // 3. Detectar REPARO DE BACKBONE (Normalização Massiva)
    for (const oldBackbone of currentBackbones) {
        if (!activeBackbones.has(oldBackbone)) {
            // Se estava rompido na varredura passada e não está na atual = Reparo!
            showToast(`<strong style="font-size: 1.1em; margin: 0;">Reparo de Backbone</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oldBackbone} normalizada</span>`, 'status-normal');
        }
    }
    
    currentBackbones = activeBackbones;
}

// Função auxiliar para extrair APENAS o nome da OLT
function formatMessage(key) {
    const oltMatch = key.match(/^\[(.*?)\]/);
    if (oltMatch) {
        return oltMatch[1]; 
    }
    return "OLT DESCONHECIDA";
}