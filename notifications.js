// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 8.5 - Minimalista Extremo)
// Reformulação: Textos enxutos, Foco na OLT/Porta e Interface Limpa
// ==============================================================================

// Memórias de Estado
let currentProblems = new Set();
let currentBackbones = new Set(); 
let currentEnergyProblems = new Set(); 
let currentHybridProblems = new Set(); 

/**
 * Cria e exibe um pop-up (toast) na tela com tamanho único.
 * @param {string} title - O título em negrito
 * @param {string} description - O texto menor
 * @param {string} typeClass - Classe de estilo (rede, energia, hibrido, etc)
 * @param {string} icon - Nome do ícone do Google Fonts
 * @param {string} position - 'left' ou 'right'
 */
function showToast(title, description, typeClass, icon, position = 'right') {
    // --- TRAVA DE SEGURANÇA ---
    const path = window.location.pathname;
    const pageName = path.split('/').pop(); 

    if (pageName && pageName !== 'index.html' && pageName !== '') {
        return; 
    }
    // ----------------------------------

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

/**
 * Lógica Inteligente: Detecta Novos Problemas, Normalizações, Rede, Energia, HÍBRIDOS e BACKBONE
 */
function checkAndNotifyForNewProblems(newProblems, activeBackbones = new Set(), newEnergyProblems = new Set(), newHybridProblems = new Set()) {
    
    // ============================================================
    // 1. DETECTAR NORMALIZAÇÕES (Limpeza de tela)
    // ============================================================

    // 1.1 Reparo de Backbone
    for (const oldBb of currentBackbones) {
        if (!activeBackbones.has(oldBb)) {
            showToast('Backbone Normalizado', `${oldBb}`, 'status-normal', 'check_circle', 'right');
        }
    }

    // 1.2 Status de Rede Resolvidos (Singular e Multi)
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            
            // Checa se era um alarme MULTI que foi resolvido
            if (oldProblem.includes("STATUS::MULTI::")) {
                const matchMulti = oldProblem.match(/^\[(.*?)\] STATUS::MULTI::/);
                if (matchMulti) {
                    const oltId = matchMulti[1];
                    const stillHasIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`));
                    if (!stillHasIssue) {
                        showToast('Rede Normalizada', `${oltId} operando normalmente`, 'status-normal', 'check_circle', 'right');
                    }
                }
            } 
            // Checa se era um alarme Singular que foi resolvido
            else {
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
    
    // 1.3 Energia Restabelecida
    for (const oldEp of currentEnergyProblems) {
        if (!newEnergyProblems.has(oldEp)) {
            const match = oldEp.match(/^\[(.*?)\] ENERGIA::(.*?)_(\d+\/\d+)/);
            if (match) {
                const oltId = match[1];
                const porta = match[3];
                const stillHasIssue = Array.from(newEnergyProblems).some(p => p.startsWith(`[${oltId}] ENERGIA::`) && p.includes(`_${porta}`));
                
                if (!stillHasIssue) {
                    showToast('Energia Retornou', `${oltId} - ${porta}`, 'status-normal', 'check_circle', 'left');
                }
            }
        }
    }

    // ============================================================
    // 2. DISPAROS: BACKBONE (Vem da Direita - Prioridade Máxima)
    // ============================================================
    for (const bb of activeBackbones) {
        if (!currentBackbones.has(bb)) {
            showToast(
                'ROMPIMENTO DE BACKBONE', 
                `${bb}`, // Mantido APENAS o nome da OLT, super limpo
                'rede-super', 
                'sos', 
                'right'
            );
        }
    }
    currentBackbones = activeBackbones;

    // ============================================================
    // 3. DISPAROS: HÍBRIDO (Vem da Esquerda)
    // ============================================================
    for (const hb of newHybridProblems) {
        if (!currentHybridProblems.has(hb)) {
            const match = hb.match(/^\[(.*?)\] HIBRIDO::(\d+\/\d+)::(\d+)::(\d+)$/);
            if (match) {
                const oltId = match[1];
                const porta = match[2];
                const offRede = match[3];
                const offEnergia = match[4];
                
                showToast(
                    'Possível Queda de Energia', 
                    `${oltId} (${porta}): ${offRede} OFF / ${offEnergia} S.LUZ`, 
                    'hibrido', 
                    'offline_bolt', 
                    'left' 
                );
            }
        }
    }
    currentHybridProblems = newHybridProblems;

    // ============================================================
    // 4. DISPAROS: ENERGIA PURA (Vem da Esquerda)
    // ============================================================
    for (const ep of newEnergyProblems) {
        if (!currentEnergyProblems.has(ep)) {
            const match = ep.match(/^\[(.*?)\] ENERGIA::(CRIT|WARN)_(\d+\/\d+)::(\d+)$/);
            if (match) {
                const oltId = match[1];
                const severity = match[2];
                const porta = match[3];
                const powerOff = match[4];
                
                const typeClass = severity === 'CRIT' ? 'energia-crit' : 'energia-warn';
                const title = severity === 'CRIT' ? 'Alarme de Energia' : 'Atenção de Energia';
                const icon = severity === 'CRIT' ? 'power_off' : 'warning';
                
                showToast(
                    title, 
                    `${oltId} (${porta}) - ${powerOff} s/ luz`, 
                    typeClass, 
                    icon, 
                    'left' 
                );
            }
        }
    }
    currentEnergyProblems = newEnergyProblems;

    // ============================================================
    // 5. DISPAROS: REDE PURA (Vem da Direita)
    // ============================================================
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {

            // --- CAPTURA DO ALARME MULTI-PORTAS ---
            const matchMulti = problemKey.match(/^\[(.*?)\] STATUS::MULTI::(.*)$/);
            if (matchMulti) {
                const oltId = matchMulti[1];
                const multiString = matchMulti[2]; // ex: "1/1(CRIT),1/2(WARN)"
                
                // Limpeza Mágica: Remove os (textos) e troca a vírgula por "e"
                const descLimpa = multiString
                    .replace(/\([^)]+\)/g, '') // Apaga qualquer coisa entre parênteses
                    .replace(/,/g, ' e ');

                showToast(
                    'Falha Múltipla de Rede', 
                    `${oltId} - ${descLimpa}`, // Visual super limpo sem o texto "Portas:"
                    'energia-crit', 
                    'error',        
                    'right' 
                );
                continue; 
            }

            // --- CAPTURA DO ALARME SINGULAR PADRÃO ---
            const matchSingle = problemKey.match(/^\[(.*?)\] STATUS::(SUPER|CRIT|WARN)_(\d+\/\d+)::(\d+)$/);
            if (matchSingle) {
                const oltId = matchSingle[1];
                const severity = matchSingle[2];
                const porta = matchSingle[3];

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
                    `${oltId} - ${porta}`, // Visual super limpo sem o texto "Porta"
                    typeClass, 
                    icon, 
                    'right' 
                );
            }
        }
    }
    currentProblems = newProblems;
}