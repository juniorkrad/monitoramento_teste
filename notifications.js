// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 6.1 - Supressão por Porta)
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
        .toast-energy-warn {
            border-left-color: #fbbf24 !important;
            background: linear-gradient(90deg, rgba(251, 191, 36, 0.1) 0%, var(--m3-surface-container-high) 20%) !important;
        }
        .toast-energy-warn .toast-icon { color: #fbbf24 !important; }

        .toast-energy-crit {
            border-left-color: #f87171 !important;
            background: linear-gradient(90deg, rgba(248, 113, 113, 0.1) 0%, var(--m3-surface-container-high) 20%) !important;
        }
        .toast-energy-crit .toast-icon { color: #f87171 !important; }
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

    container.appendChild(toast);
    
    // --- LÓGICA DE SOM ---
    if (type.includes('problem') || type.includes('warning') || type.includes('super-priority') || type.includes('energy')) {
        try { 
            alertSound.play().catch(e => {}); 
            if (type === 'super-priority' || type === 'toast-energy-crit') {
                setTimeout(() => { alertSound.play().catch(e => {}) }, 250); // Beep duplo para críticos
            }
        } catch(e){} 
    }

    setTimeout(() => toast.classList.add('show'), 10);

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
 * Lógica Inteligente: Detecta Novos Problemas, Normalizações, Reparo de Backbone E ENERGIA (Com Supressão)
 */
function checkAndNotifyForNewProblems(newProblems, activeBackbones = new Set(), newEnergyProblems = new Set()) {
    
    // 0. MAPEAR PORTAS EXATAS COM PROBLEMA DE ENERGIA PARA SUPRESSÃO
    const portsWithEnergyIssues = new Set();
    for (const ep of newEnergyProblems) {
        const match = ep.match(/^\[(.*?) PORTA (.*?)\]/);
        if (match) portsWithEnergyIssues.add(`[${match[1]} PORTA ${match[2]}]`);
    }

    // 1. PROCESSAR ALARMES DE ENERGIA E AGRUPAR PARA O TOAST VISUAL
    let energyAlertsToTrigger = {};
    for (const ep of newEnergyProblems) {
        if (!currentEnergyProblems.has(ep)) {
            const match = ep.match(/^\[(.*?) PORTA (.*?)\] ENERGIA::(CRIT|WARN)::(\d+)$/);
            if (match) {
                const oltId = match[1];
                const severity = match[3];
                const clients = parseInt(match[4]);
                
                if (!energyAlertsToTrigger[oltId]) {
                    energyAlertsToTrigger[oltId] = { clients: 0, ports: 0, crit: 0 };
                }
                energyAlertsToTrigger[oltId].clients += clients;
                energyAlertsToTrigger[oltId].ports++;
                if (severity === 'CRIT') energyAlertsToTrigger[oltId].crit++;
            }
        }
    }

    // Disparar os Toasts agrupados de energia (para não flodar a tela se várias portas caírem)
    for (const oltId in energyAlertsToTrigger) {
        const data = energyAlertsToTrigger[oltId];
        const severityClass = data.crit > 0 ? 'toast-energy-crit' : 'toast-energy-warn';
        const title = data.crit > 0 ? 'Queda de Energia' : 'Atenção: Energia';
        const desc = data.ports > 1 ? `OLT: ${oltId} (${data.clients} clientes em ${data.ports} portas)` : `OLT: ${oltId} (${data.clients} clientes afetados)`;
        showToast(`<strong style="font-size: 1.1em; margin: 0;">${title}</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">${desc}</span>`, severityClass);
    }

    // Processar normalização de Energia
    for (const oldEp of currentEnergyProblems) {
        if (!newEnergyProblems.has(oldEp)) {
            const match = oldEp.match(/^\[(.*?) PORTA (.*?)\]/);
            if (match) {
                const portKey = `[${match[1]} PORTA ${match[2]}]`;
                // Só avisa que a energia da porta voltou se ela não estiver na nova lista
                if (!portsWithEnergyIssues.has(portKey)) {
                    showToast(`<strong style="font-size: 1.1em; margin: 0;">Energia Restabelecida</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">${match[1]} (Porta ${match[2]})</span>`, 'status-normal');
                }
            }
        }
    }
    currentEnergyProblems = newEnergyProblems;

    // 2. DETECTAR NOVOS PROBLEMAS DE STATUS (COM SUPRESSÃO CIRÚRGICA)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            // Regex agora aceita PORTA e PLACA (do olt-engine)
            const match = problemKey.match(/^\[(.*?) (PORTA|PLACA) (.*?)\] (.*?)$/);
            if (!match) continue; 
            
            const oltId = match[1];
            const tipo = match[2]; // PORTA ou PLACA
            const idAlvo = match[3];
            const statusType = match[4];
            
            // --- A MÁGICA DA SUPRESSÃO CORRIGIDA ---
            if (tipo === 'PORTA') {
                const portKey = `[${oltId} PORTA ${idAlvo}]`;
                // Se ESTA EXATA PORTA estiver sem luz, silencia o alerta genérico de "DOWN"!
                if (portsWithEnergyIssues.has(portKey)) {
                    continue; 
                }
            }

            const descName = tipo === 'PORTA' ? `${oltId} (Porta ${idAlvo})` : `${oltId} (Placa ${idAlvo})`;

            if (statusType.includes('SUPER')) {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">FALHA CRÍTICA</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">${descName}</span>`, 'super-priority');
            } 
            else if (statusType.includes('WARN')) {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">ATENÇÃO</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">${descName}</span>`, 'warning');
            } 
            else {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">PROBLEMA</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">${descName}</span>`, 'problem');
            }
        }
    }

    // 3. DETECTAR PROBLEMAS DE STATUS RESOLVIDOS
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const match = oldProblem.match(/^\[(.*?) (PORTA|PLACA) (.*?)\]/);
            if (match) {
                const oltId = match[1];
                const tipo = match[2];
                const idAlvo = match[3];
                
                if (tipo === 'PORTA') {
                    const portKey = `[${oltId} PORTA ${idAlvo}]`;
                    if (portsWithEnergyIssues.has(portKey)) continue; // Evita pop-up se ela "normalizou" o status só pq a energia caiu
                }
                
                const descName = tipo === 'PORTA' ? `${oltId} (Porta ${idAlvo})` : `${oltId} (Placa ${idAlvo})`;
                showToast(`<strong style="font-size: 1.1em; margin: 0;">Circuito Normalizado</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">${descName} operante</span>`, 'status-normal'); 
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