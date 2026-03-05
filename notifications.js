// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 6.0 - Inteligência de Energia)
// ==============================================================================

// Memórias de Estado (O "Cérebro" do Vigilante)
let currentProblems = new Set();
let currentBackbones = new Set(); 
let currentEnergyProblems = new Set(); // NOVA MEMÓRIA: Guarda o estado de Energia

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
    
    // --- LÓGICA DE SOM (Agora toca também para alarmes de Energia) ---
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
    
    // 0. MAPEAR OLTs COM PROBLEMA DE ENERGIA PARA SUPRESSÃO
    const oltsWithEnergyIssues = new Set();
    for (const ep of newEnergyProblems) {
        oltsWithEnergyIssues.add(formatMessage(ep));
    }

    // 1. PROCESSAR ALARMES DE ENERGIA
    for (const ep of newEnergyProblems) {
        if (!currentEnergyProblems.has(ep)) {
            // Extrai as variáveis do formato "[PQA-1] ENERGIA::CRIT::150::4"
            const match = ep.match(/^\[(.*?)\] ENERGIA::(CRIT|WARN)::(\d+)::(\d+)$/);
            if (match) {
                const oltId = match[1];
                const severity = match[2];
                const clients = match[3];
                const ports = match[4];

                if (severity === 'CRIT') {
                    showToast(`<strong style="font-size: 1.1em; margin: 0;">Queda de Energia</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltId} (${clients} clientes afetados)</span>`, 'toast-energy-crit');
                } else {
                    showToast(`<strong style="font-size: 1.1em; margin: 0;">Atenção: Energia</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltId} (${clients} clientes afetados)</span>`, 'toast-energy-warn');
                }
            }
        }
    }

    // Processar normalização de Energia
    for (const oldEp of currentEnergyProblems) {
        if (!newEnergyProblems.has(oldEp)) {
            const oltId = formatMessage(oldEp);
            // Só avisa que a energia voltou se a OLT realmente saiu da lista de problemas elétricos
            if (!oltsWithEnergyIssues.has(oltId)) {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">Energia Restabelecida</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltId}</span>`, 'status-normal');
            }
        }
    }
    currentEnergyProblems = newEnergyProblems;


    // 2. DETECTAR NOVOS PROBLEMAS DE STATUS (COM SUPRESSÃO DE CASCATA)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const oltName = formatMessage(problemKey);
            
            // --- A MÁGICA DA SUPRESSÃO ACONTECE AQUI ---
            // Se a OLT estiver sem energia, nós IGNORAMOS o alerta genérico de offline
            if (oltsWithEnergyIssues.has(oltName)) {
                continue; 
            }

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

    // 3. DETECTAR PROBLEMAS DE STATUS RESOLVIDOS
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const oltName = formatMessage(oldProblem);
            // Evita gerar pop-up de "Circuito Normalizado" se a OLT apenas trocou o motivo da falha para energia
            if (!oltsWithEnergyIssues.has(oltName)) {
                showToast(`<strong style="font-size: 1.1em; margin: 0;">Circuito Normalizado</strong><span style="font-family: var(--font-family-mono); font-size: 0.95em; margin: 0;">OLT: ${oltName} operante</span>`, 'status-normal'); 
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

// Função auxiliar para extrair APENAS o nome da OLT das strings criptografadas
function formatMessage(key) {
    const oltMatch = key.match(/^\[(.*?)\]/);
    if (oltMatch) {
        return oltMatch[1]; 
    }
    return "OLT DESCONHECIDA";
}