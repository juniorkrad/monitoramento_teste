// ==============================================================================
// notifications.js - Sistema Central de Alertas (Restauração Completa Base Old)
// ==============================================================================

// Memórias de Estado
let currentProblems = new Set();
let currentBackbones = new Set(); 
let currentHybridProblems = new Set(); 

function showToast(title, description, typeClass, icon, position = 'right') {
    const path = window.location.pathname;
    const pageName = path.split('/').pop(); 

    if (pageName && pageName !== 'index.html' && pageName !== '') {
        return; 
    }

    let containerId = position === 'left' ? 'toast-container-left' : 'toast-container-right';
    let container = document.getElementById(containerId);
    
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const slideClass = position === 'left' ? 'slide-left' : 'slide-right';
    toast.className = `toast ${typeClass} ${slideClass}`;
    
    toast.innerHTML = `
        <span class="material-symbols-rounded toast-icon">${icon}</span>
        <div class="toast-content">
            <strong>${title}</strong>
            <span>${description}</span>
        </div>
    `;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); 
    };

    container.prepend(toast); 

    setTimeout(() => toast.classList.add('show'), 50);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 400);
        }
    }, 10000); 
}

function checkAndNotifyForNewProblems(newProblems, activeBackbones = new Set(), newEnergyProblems = new Set(), newHybridProblems = new Set()) {
    
    // 1. DETECTAR NORMALIZAÇÕES
    for (const oldBb of currentBackbones) {
        if (!activeBackbones.has(oldBb)) {
            showToast('Backbone Normalizado', `${oldBb}`, 'status-normal', 'check_circle', 'right');
        }
    }

    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            if (oldProblem.includes("STATUS::MULTI::")) {
                const matchMulti = oldProblem.match(/^\[(.*?)\] STATUS::MULTI::/);
                if (matchMulti) {
                    const oltId = matchMulti[1];
                    const stillHasIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`));
                    if (!stillHasIssue) {
                        showToast('Rede Normalizada', `${oltId} operando normalmente`, 'status-normal', 'check_circle', 'right');
                    }
                }
            } else {
                const matchSingle = oldProblem.match(/^\[(.*?)\] STATUS::(.*?)_(\d+\/\d+)/);
                if (matchSingle) {
                    const oltId = matchSingle[1];
                    const porta = matchSingle[3];
                    const stillHasIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`) && p.includes(porta));
                    
                    if (!stillHasIssue) {
                        showToast('Sinal Normalizado', `${oltId} - ${porta}`, 'status-normal', 'check_circle', 'right'); 
                    }
                }
            }
        }
    }

    // 2. DISPAROS: BACKBONE
    for (const bb of activeBackbones) {
        if (!currentBackbones.has(bb)) {
            showToast(
                'ROMPIMENTO DE BACKBONE', 
                `${bb}`, 
                'rede-super', 
                'sos', 
                'right'
            );
        }
    }
    currentBackbones = new Set(activeBackbones);

    // 3. DISPAROS: HÍBRIDO E SILENCIADOR
    const activeHybridPorts = new Set(); 

    for (const hb of newHybridProblems) {
        // Formato Exato da versão old que extrai offline e powerOff
        const match = hb.match(/^\[(.*?)\] HIBRIDO::(\d+\/\d+)::(\d+)::(\d+)$/);
        if (match) {
            const oltId = match[1];
            const porta = match[2];
            const offRede = match[3];
            const offEnergia = match[4];
            
            activeHybridPorts.add(`${oltId}_${porta}`);
            
            if (!currentHybridProblems.has(hb)) {
                showToast(
                    'Possível Queda de Energia', 
                    `${oltId} (${porta}): ${offRede} <span class="material-symbols-rounded" style="font-size: 22px; vertical-align: middle;">router</span> / ${offEnergia} <span class="material-symbols-rounded" style="font-size: 22px; vertical-align: middle;">power_off</span>`, 
                    'hibrido', 
                    'offline_bolt', 
                    'left' 
                );
            }
        }
    }
    currentHybridProblems = new Set(newHybridProblems);

    // 4. DISPAROS: REDE PURA
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {

            const matchMulti = problemKey.match(/^\[(.*?)\] STATUS::MULTI::(.*)$/);
            if (matchMulti) {
                const oltId = matchMulti[1];
                const multiString = matchMulti[2]; 
                
                let portsArray = multiString.split(',');

                portsArray = portsArray.filter(p => !activeHybridPorts.has(`${oltId}_${p}`));
                if (portsArray.length === 0) continue;

                const descLimpa = portsArray.join(', ');

                showToast(
                    'Falha Múltipla de Rede', 
                    `${oltId} - ${descLimpa}`, 
                    'rede-problem', 
                    'error',        
                    'right' 
                );
                continue; 
            }

            // Regex Exato da versão old: (\d+\/\d+)
            const matchSingle = problemKey.match(/^\[(.*?)\] STATUS::(SUPER|CRIT|WARN)_(\d+\/\d+)::(\d+)$/);
            if (matchSingle) {
                const oltId = matchSingle[1];
                const severity = matchSingle[2];
                const porta = matchSingle[3];

                if (activeHybridPorts.has(`${oltId}_${porta}`)) continue;

                let title = 'Problema de Rede';
                let typeClass = 'rede-problem';
                let icon = 'error';

                if (severity === 'SUPER') {
                    title = 'FALHA CRÍTICA';
                    typeClass = 'rede-super';
                    icon = 'fmd_bad';
                } else if (severity === 'WARN') {
                    title = 'Atenção na Rede';
                    typeClass = 'rede-warn';
                    icon = 'warning';
                }

                showToast(
                    title, 
                    `${oltId} - ${porta}`, 
                    typeClass, 
                    icon, 
                    'right' 
                );
            }
        }
    }
    currentProblems = new Set(newProblems);
}