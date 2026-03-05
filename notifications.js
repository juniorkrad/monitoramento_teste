// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 6.6 - Padronização Global)
// ==============================================================================

// Memórias de Estado (O "Cérebro" do Vigilante)
let currentProblems = new Set();
let currentBackbones = new Set(); 
let currentEnergyProblems = new Set(); // Guarda o estado de Energia

// Som de Alerta (Beep curto)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

// Injeta os estilos padronizados para TODOS os pop-ups diretamente no navegador
(function injectGlobalToastStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* --- PADRONIZAÇÃO DE TAMANHO E FONTE PARA TODOS OS ALERTAS --- */
        .toast {
            padding: 18px 24px !important;
            width: auto !important;
            min-width: 280px !important;
            max-width: 400px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
        }
        
        .toast .toast-icon { 
            font-size: 32px !important;
            margin-right: 15px !important;
        }
        
        /* Estilo do Título (Strong) */
        .toast strong {
            font-size: 1.25rem !important;
            font-weight: 800 !important;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            display: block;
            margin-bottom: 2px;
        }
        
        /* Estilo da Descrição/OLT (Span) */
        .toast span {
            font-size: 1.1rem !important;
            font-weight: 600 !important;
            font-family: var(--font-family-mono) !important;
            display: block;
        }

        /* --- ESTILO 1: ATENÇÃO DE ENERGIA (AMARELO ÂMBAR SÓLIDO) --- */
        .toast-energy-warn {
            background-color: #f59e0b !important;
            box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4) !important;
            border-left: 8px solid #b45309 !important;
        }
        .toast-energy-warn .toast-icon, .toast-energy-warn strong, .toast-energy-warn span { 
            color: #1a1a1a !important; 
        }

        /* --- ESTILO 2: ALARME/ALERTA DE ENERGIA CRÍTICA (LARANJA QUEIMADO SÓLIDO) --- */
        .toast-energy-crit {
            background-color: #f97316 !important;
            box-shadow: 0 8px 25px rgba(249, 115, 22, 0.5) !important;
            border-left: 8px solid #c2410c !important;
            animation: pulse-border 1.5s infinite;
        }
        .toast-energy-crit .toast-icon, .toast-energy-crit strong, .toast-energy-crit span { 
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

    // Monta o HTML do Toast limpo (O CSS cuida do layout interno agora)
    toast.innerHTML = `
        <span class="material-symbols-rounded toast-icon">${iconName}</span>
        <div style="display: flex; flex-direction: column; justify-content: center;">${message}</div>
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
    
    // 1. PROCESSAR ALARMES DE ENERGIA (Com nova escala de criticidade)
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
                
                // Formatação HTML limpa
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
                const stillHasEnergyIssue = Array.from(newEnergyProblems).some(p => p.startsWith(`[${oltId}] ENERGIA::`));
                
                if (!stillHasEnergyIssue) {
                    showToast(`<strong>Energia Restabelecida</strong><span>OLT: ${oltId}</span>`, 'status-normal');
                }
            }
        }
    }
    currentEnergyProblems = newEnergyProblems;

    // 2. DETECTAR NOVOS PROBLEMAS DE STATUS (Formatação HTML limpa)
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

    // 3. DETECTAR PROBLEMAS DE STATUS RESOLVIDOS (Formatação HTML limpa)
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
    
    currentProblems = newProblems;

    // 4. DETECTAR REPARO DE BACKBONE (Formatação HTML limpa)
    for (const oldBackbone of currentBackbones) {
        if (!activeBackbones.has(oldBackbone)) {
            showToast(`<strong>Reparo de Backbone</strong><span>OLT: ${oldBackbone} normalizada</span>`, 'status-normal');
        }
    }
    
    currentBackbones = activeBackbones;
}