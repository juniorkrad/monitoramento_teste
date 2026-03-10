// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 7.1 - Prioridade Visual Energia)
// ==============================================================================

// Memórias de Estado (O "Cérebro" do Vigilante)
let currentProblems = new Set();
let currentBackbones = new Set(); 
let currentEnergyProblems = new Set(); 

/**
 * Cria e exibe um pop-up (toast) na tela.
 */
function showToast(message, type = '') {
    // --- TRAVA DE SEGURANÇA ---
    const path = window.location.pathname;
    const pageName = path.split('/').pop(); 

    // Garante que os Toasts só apareçam na Home (index.html)
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
    else if (type === 'toast-energy-warn') iconName = 'offline_bolt'; 
    else if (type === 'toast-energy-crit') iconName = 'power_off'; 

    // Monta o HTML do Toast limpo 
    toast.innerHTML = `
        <span class="material-symbols-rounded toast-icon">${iconName}</span>
        <div style="display: flex; flex-direction: column; justify-content: center;">${message}</div>
    `;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    // Usa prepend para que o último alarme processado apareça no topo visual da lista
    container.prepend(toast);

    setTimeout(() => toast.classList.add('show'), 50);

    // --- TEMPO DE EXIBIÇÃO ---
    const duration = (type === 'super-priority' || type === 'toast-energy-crit') ? 10000 : 8000;

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }, duration); 
}

/**
 * Lógica Inteligente: Detecta Novos Problemas, Normalizações, Reparo de Backbone E ENERGIA
 */
function checkAndNotifyForNewProblems(newProblems, activeBackbones = new Set(), newEnergyProblems = new Set()) {
    
    // ============================================================
    // 1. DETECTAR NORMALIZAÇÕES (Processadas primeiro para limpar a tela)
    // ============================================================

    // 1.1 Reparo de Backbone
    for (const oldBackbone of currentBackbones) {
        if (!activeBackbones.has(oldBackbone)) {
            showToast(`<strong>Reparo de Backbone</strong><span>OLT: ${oldBackbone} normalizada</span>`, 'status-normal');
        }
    }
    currentBackbones = activeBackbones;

    // 1.2 Status de Rede Resolvidos
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const match = oldProblem.match(/^\[(.*?)\] STATUS::/);
            if (match) {
                const oltId = match[1];
                const stillHasStatusIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`));
                
                if (!stillHasStatusIssue) {
                    showToast(`<strong>Circuito Normalizado</strong><span>OLT: ${oltId} operante</span>`, 'status-normal'); 
                }
            }
        }
    }
    
    // 1.3 Energia Restabelecida
    for (const oldEp of currentEnergyProblems) {
        if (!newEnergyProblems.has(oldEp)) {
            const match = oldEp.match(/^\[(.*?)\] ENERGIA::/);
            if (match) {
                const oltId = match[1];
                const stillHasEnergyIssue = Array.from(newEnergyProblems).some(p => p.startsWith(`[${oltId}] ENERGIA::`));
                
                if (!stillHasEnergyIssue) {
                    showToast(`<strong>Energia Restabelecida</strong><span>OLT: ${oltId}</span>`, 'status-normal');
                }
            }
        }
    }

    // ============================================================
    // 2. DETECTAR NOVOS PROBLEMAS DE REDE
    // ============================================================
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const match = problemKey.match(/^\[(.*?)\] STATUS::(SUPER|CRIT|WARN)$/);
            if (!match) continue; 
            
            const oltId = match[1];
            const severity = match[2];

            if (severity === 'SUPER') {
                showToast(`<strong>FALHA CRÍTICA</strong><span>OLT: ${oltId}</span>`, 'super-priority');
            } 
            else if (severity === 'WARN') {
                showToast(`<strong>ATENÇÃO</strong><span>OLT: ${oltId}</span>`, 'warning');
            } 
            else { // CRIT
                showToast(`<strong>PROBLEMA</strong><span>OLT: ${oltId}</span>`, 'problem');
            }
        }
    }
    currentProblems = newProblems;

    // ============================================================
    // 3. DETECTAR NOVOS ALARMES DE ENERGIA (Garante o Topo Visual)
    // ============================================================
    for (const ep of newEnergyProblems) {
        if (!currentEnergyProblems.has(ep)) {
            // Extrai: [HEL-1] ENERGIA::CRIT::150::4
            const match = ep.match(/^\[(.*?)\] ENERGIA::(CRIT|WARN)::(\d+)::(\d+)$/);
            if (match) {
                const oltId = match[1];
                const severity = match[2];
                const ports = parseInt(match[4]);
                
                const severityClass = severity === 'CRIT' ? 'toast-energy-crit' : 'toast-energy-warn';
                
                let title = '';
                if (ports > 1) {
                    title = 'Alerta de Energia';   // Nível 3: Múltiplas Portas
                } else if (severity === 'CRIT') {
                    title = 'Alarme de Energia';   // Nível 2: Queda (Power off)
                } else {
                    title = 'Atenção de Energia';  // Nível 1: Instabilidade
                }

                const desc = `OLT: ${oltId}`;
                
                showToast(`<strong>${title}</strong><span>${desc}</span>`, severityClass);
            }
        }
    }
    currentEnergyProblems = newEnergyProblems;
}