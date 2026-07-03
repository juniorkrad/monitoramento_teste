// ==============================================================================
// notifications.js - Sistema Central de Alertas (Com Hierarquia de Backbone)
// ==============================================================================

// Memórias de Estado
let currentProblems = new Set();
let currentBackbones = new Set(); 
let currentHybridProblems = new Set(); 

// Helper para formatar o nome do circuito corretamente
function formatarNomeCircuito(nome) {
    if (!nome || nome === '-') return 'Circ. N/A';
    const lower = nome.toLowerCase();
    if (lower.startsWith('circ') || lower.startsWith('link')) return nome;
    return `Circ. ${nome}`;
}

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
            // Nova assinatura Backbone inclui a quantidade de clientes.
            // Para não spammar normalização se apenas o número mudar, verificamos se a OLT ainda está no set.
            const matchBb = oldBb.match(/^\[(.*?)\] BACKBONE::(\d+)$/);
            if (matchBb) {
                const oltId = matchBb[1];
                const stillHas = Array.from(activeBackbones).some(b => b.startsWith(`[${oltId}] BACKBONE::`));
                if (!stillHas) {
                    showToast('Backbone Normalizado', `${oltId}`, 'status-normal', 'check_circle', 'right');
                }
            } else {
                // Fallback de segurança
                showToast('Backbone Normalizado', `${oldBb}`, 'status-normal', 'check_circle', 'right');
            }
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
            } else if (oldProblem.includes("STATUS::CIRCUITO::")) {
                const matchCircuito = oldProblem.match(/^\[(.*?)\] STATUS::CIRCUITO::(.*?)::(\d+\/\d+)/);
                if (matchCircuito) {
                    const oltId = matchCircuito[1];
                    const circuitoNome = matchCircuito[2];
                    const porta = matchCircuito[3];
                    const stillHasIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`) && p.includes(porta));
                    
                    if (!stillHasIssue) {
                        const circText = formatarNomeCircuito(circuitoNome);
                        showToast('Circuito Normalizado', `${oltId} - ${porta} - ${circText}`, 'status-normal', 'check_circle', 'right'); 
                    }
                }
            } else {
                const matchSingle = oldProblem.match(/^\[(.*?)\] STATUS::(.*?)_(\d+\/\d+)::\d+::(.*)$/);
                if (matchSingle) {
                    const oltId = matchSingle[1];
                    const porta = matchSingle[3];
                    const circuitoNome = matchSingle[4];
                    const stillHasIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`) && p.includes(porta));
                    
                    if (!stillHasIssue) {
                        const circText = formatarNomeCircuito(circuitoNome);
                        showToast('Sinal Normalizado', `${oltId} - ${porta} - ${circText}`, 'status-normal', 'check_circle', 'right'); 
                    }
                }
            }
        }
    }

    // 2. DISPAROS: BACKBONE NÍVEL 2 (Massivo)
    for (const bb of activeBackbones) {
        if (!currentBackbones.has(bb)) {
            const matchBb = bb.match(/^\[(.*?)\] BACKBONE::(\d+)$/);
            if (matchBb) {
                const oltId = matchBb[1];
                const offCount = matchBb[2];
                // Evita disparar novamente se apenas o número de offline atualizou
                const alreadyHas = Array.from(currentBackbones).some(b => b.startsWith(`[${oltId}] BACKBONE::`));
                
                if (!alreadyHas) {
                    showToast(
                        'BACKBONE', 
                        `${oltId} - ${offCount} <span class="material-symbols-rounded" style="font-size: 22px; vertical-align: middle;">router_off</span>`, 
                        'backbone-l2', 
                        'sos', 
                        'right'
                    );
                }
            }
        }
    }
    currentBackbones = new Set(activeBackbones);

    // 3. DISPAROS: HÍBRIDO E SILENCIADOR
    const activeHybridPorts = new Set(); 

    for (const hb of newHybridProblems) {
        // Nova assinatura: Alarme Múltiplo de Energia
        const matchMultiplo = hb.match(/^\[(.*?)\] HIBRIDO_MULTIPLO::(.*?)::(\d+)::(\d+)$/);
        if (matchMultiplo) {
            const oltId = matchMultiplo[1];
            const portasStr = matchMultiplo[2];
            const offEnergia = matchMultiplo[4]; // Pegamos apenas o de energia como requisitado
            
            const portas = portasStr.split(',');
            portas.forEach(p => activeHybridPorts.add(`${oltId}_${p}`));
            
            if (!currentHybridProblems.has(hb)) {
                showToast(
                    'Alarme Múltiplo de Energia', 
                    `${oltId} - ${offEnergia} <span class="material-symbols-rounded" style="font-size: 22px; vertical-align: middle;">power_off</span>`, 
                    'hibrido-multiplo', 
                    'electric_bolt', 
                    'left' 
                );
            }
            continue;
        }

        // Assinatura clássica: Alarme Híbrido Individual
        const match = hb.match(/^\[(.*?)\] HIBRIDO::(\d+\/\d+)::(\d+)::(\d+)::(.*)$/);
        if (match) {
            const oltId = match[1];
            const porta = match[2];
            const offEnergia = match[4]; // Ignorando o offRede a pedido do novo padrão
            const circuitoNome = match[5];
            
            const circText = formatarNomeCircuito(circuitoNome);
            activeHybridPorts.add(`${oltId}_${porta}`);
            
            if (!currentHybridProblems.has(hb)) {
                showToast(
                    'Queda de Energia', 
                    `${oltId} - ${porta} - ${circText}: ${offEnergia} <span class="material-symbols-rounded" style="font-size: 22px; vertical-align: middle;">power_off</span>`, 
                    'hibrido', 
                    'offline_bolt', 
                    'left' 
                );
            }
        }
    }
    currentHybridProblems = new Set(newHybridProblems);

    // 4. DISPAROS: REDE PURA E BACKBONE NÍVEL 1
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {

            // Nova Assinatura: Alarme de Circuito
            const matchCircuito = problemKey.match(/^\[(.*?)\] STATUS::CIRCUITO::(.*?)::(\d+\/\d+)::(\d+)$/);
            if (matchCircuito) {
                const oltId = matchCircuito[1];
                const circuitoNome = matchCircuito[2];
                const porta = matchCircuito[3];

                if (activeHybridPorts.has(`${oltId}_${porta}`)) continue;

                const circText = formatarNomeCircuito(circuitoNome);

                showToast(
                    'Alarme de Circuito', 
                    `${oltId} - ${porta} - ${circText}`, 
                    'backbone-l1', 
                    'crisis_alert', 
                    'right' 
                );
                continue;
            }

            // Verifica Assinatura Múltipla
            const matchMulti = problemKey.match(/^\[(.*?)\] STATUS::MULTI::(.*)$/);
            if (matchMulti) {
                const oltId = matchMulti[1];
                const multiString = matchMulti[2]; 
                
                let portsArray = multiString.split(',');

                portsArray = portsArray.filter(p => !activeHybridPorts.has(`${oltId}_${p}`));
                if (portsArray.length === 0) continue;

                showToast(
                    'Falha Múltipla', 
                    `${oltId} - Múltiplos circuitos afetados`, 
                    'rede-problem', 
                    'error',        
                    'right' 
                );
                continue; 
            }

            // Verifica Assinatura Individual (Super, Crit, Warn)
            const matchSingle = problemKey.match(/^\[(.*?)\] STATUS::(SUPER|CRIT|WARN)_(\d+\/\d+)::(\d+)::(.*)$/);
            if (matchSingle) {
                const oltId = matchSingle[1];
                const severity = matchSingle[2];
                const porta = matchSingle[3];
                const circuitoNome = matchSingle[5];

                if (activeHybridPorts.has(`${oltId}_${porta}`)) continue;

                const circText = formatarNomeCircuito(circuitoNome);

                let title = 'Problema';
                let typeClass = 'rede-problem';
                let icon = 'error';

                if (severity === 'SUPER') {
                    title = 'Backbone';
                    typeClass = 'backbone-l1';
                    icon = 'fmd_bad';
                } else if (severity === 'WARN') {
                    title = 'Atenção';
                    typeClass = 'rede-warn';
                    icon = 'warning';
                }

                showToast(
                    title, 
                    `${oltId} - ${porta} - ${circText}`, 
                    typeClass, 
                    icon, 
                    'right' 
                );
            }
        }
    }
    currentProblems = new Set(newProblems);
}