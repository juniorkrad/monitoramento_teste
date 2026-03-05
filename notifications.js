// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 6.4 - Alto Impacto Visual)
// ==============================================================================

// Memórias de Estado (O "Cérebro" do Vigilante)
let currentProblems = new Set();
let currentBackbones = new Set(); 
let currentEnergyProblems = new Set(); // Guarda o estado de Energia

// Som de Alerta (Beep curto)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

// Injeta os estilos dos novos pop-ups de Energia automaticamente sem precisar mexer no styles.css
(function injectEnergyStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* --- ESTILO 1: ATENÇÃO DE ENERGIA (AMARELO ÂMBAR SÓLIDO) --- */
        .toast-energy-warn {
            background-color: #f59e0b !important;
            color: #1a1a1a !important;
            box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4) !important;
            border-left: 8px solid #b45309 !important;
            padding: 18px 24px !important;
            min-width: 350px !important;
        }
        .toast-energy-warn .toast-icon { 
            color: #1a1a1a !important; 
            font-size: 32px !important;
        }
        .toast-energy-warn strong {
            font-size: 1.25rem !important;
            font-weight: 800 !important;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            color: #1a1a1a !important;
        }
        .toast-energy-warn span {
            font-size: 1.1rem !important;
            font-weight: 600 !important;
            color: #1a1a1a !important;
        }

        /* --- ESTILO 2: QUEDA DE ENERGIA CRÍTICA (LARANJA QUEIMADO SÓLIDO) --- */
        .toast-energy-crit {
            background-color: #f97316 !important;
            color: #1a1a1a !important;
            box-shadow: 0 8px 25px rgba(249, 115, 22, 0.5) !important;
            border-left: 8px solid #c2410c !important;
            padding: 18px 24px !important;
            min-width: 350px !important;
            animation: pulse-border 1.5s infinite;
        }
        .toast-energy-crit .toast-icon { 
            color: #1a1a1a !important; 
            font-size: 32px !important;
        }
        .toast-energy-crit strong {
            font-size: 1.25rem !important;
            font-weight: 800 !important;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            color: #1a1a1a !important;
        }
        .toast-energy-crit span {
            font-size: 1.1rem !important;
            font-weight: 600 !important;
            color: #1a1a1a !important;
        }

        @keyframes pulse-border {
            0% { border-left-width: 8px; }
            50% { border-left-width: 15px; }
            100% { border-left-width: 8px; }
        }
    `;
    document.head.appendChild(style);
})();

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
    else if (type === 'toast-energy-warn') iconName = 'offline_bolt'; // Ícone Energia (Atenção)
    else if (type === 'toast-energy-crit') iconName = 'power_off'; // Ícone Energia (Crítico)

    // Monta o HTML do Toast
    toast.innerHTML = `
        <span class="material-symbols-rounded toast-icon" style="font-size: 24px; margin-right: 10px;">${iconName}</span>
        <div style="display: flex; flex-direction: column; gap: 4px;">${message}</div>
    `;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    // Usa prepend para que o novo alarme apareça no topo da lista
    container.prepend(toast);
    
    // --- LÓGICA DE SOM ---
    if (type.includes('problem') || type.includes('warning') || type.includes('super-priority') || type.includes('energy')) {
        try { 
            alertSound.play().catch(e => {}); 
            if (type === 'super-priority' || type === 'toast-energy-crit') {
                setTimeout(() => { alertSound.play().catch(e => {}) }, 250); // Beep duplo para críticos
            }
        } catch(e){} 
    }

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
    
    // 1. PROCESSAR ALARMES DE ENERGIA (Visual Minimalista)
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
                    title = 'Alarme Múltiplo de Energia';
                } else if (severity === 'CRIT') {
                    title = 'Queda de Energia';
                } else {
                    title = 'Atenção de Energia';
                }

                const desc = `OLT: ${oltId}`;
                
                // Formatação interna agora é sobrescrita pelo CSS das classes acima
                showToast(`<strong>${title}</strong><span>${desc}</span>`, severityClass);
            }
        }
    }

    // Processar normalização de Energia
    for (const oldEp of currentEnergyProblems) {
        if (!newEnergyProblems.has(oldEp)) {
            const match = oldEp.match(/^\[(.*?)\] ENERGIA::/);
            if (match) {
                const oltId = match[1];
                // Checa se a OLT ainda está na lista nova (caso tenha apenas mudado de WARN para CRIT)
                const stillHasEnergyIssue = Array.from(newEnergyProblems).some(p => p.startsWith(`[${oltId}] ENERGIA::`));
                
                if (!stillHasEnergyIssue) {
                    showToast(`<strong style="font-size: 1.1em; margin: 0;">Energia Restabelecida</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltId}</span>`, 'status-normal');
                }
            }
        }
    }
    currentEnergyProblems = newEnergyProblems;

    // 2. DETECTAR NOVOS PROBLEMAS DE STATUS
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            // Extrai: [HEL-1] STATUS::SUPER
            const match = problemKey.match(/^\[(.*?)\] STATUS::(SUPER|CRIT|WARN)$/);
            if (!match) continue; 
            
            const oltId = match[1];
            const severity = match[2];

            if (severity === 'SUPER') {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">FALHA CRÍTICA</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltId}</span>`, 'super-priority');
            } 
            else if (severity === 'WARN') {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">ATENÇÃO</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltId}</span>`, 'warning');
            } 
            else { // CRIT
                showToast(`<strong style="font-size: 1.1em; margin: 0;">PROBLEMA</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltId}</span>`, 'problem');
            }
        }
    }

    // 3. DETECTAR PROBLEMAS DE STATUS RESOLVIDOS
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const match = oldProblem.match(/^\[(.*?)\] STATUS::/);
            if (match) {
                const oltId = match[1];
                const stillHasStatusIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`));
                
                if (!stillHasStatusIssue) {
                    showToast(`<strong style="font-size: 1.1em; margin: 0;">Circuito Normalizado</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltId} operante</span>`, 'status-normal'); 
                }
            }
        }
    }
    
    currentProblems = newProblems;

    // 4. DETECTAR REPARO DE BACKBONE
    for (const oldBackbone of currentBackbones) {
        if (!activeBackbones.has(oldBackbone)) {
            showToast(`<strong style="font-size: 1.1em; margin: 0;">Reparo de Backbone</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oldBackbone} normalizada</span>`, 'status-normal');
        }
    }
    
    currentBackbones = activeBackbones;
}