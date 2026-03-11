// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 8.1 - Novo Padrão)
// Reformulação: Tamanho Único, Entrada Bilateral, Suporte Híbrido e Backbone
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

    // Determina o container baseado na posição desejada (Esquerda ou Direita)
    let containerId = position === 'left' ? 'toast-container-left' : 'toast-container-right';
    let container = document.getElementById(containerId);
    
    // Se o container ainda não existir no HTML, cria dinamicamente
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const slideClass = position === 'left' ? 'slide-left' : 'slide-right';
    toast.className = `toast ${typeClass} ${slideClass}`;
    
    // Monta o HTML interno no novo formato padronizado
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

    // Tempo de exibição universal (10 segundos)
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
            showToast('Backbone Normalizado', `OLT: ${oldBb}`, 'status-normal', 'check_circle', 'right');
        }
    }

    // 1.2 Status de Rede Resolvidos
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const match = oldProblem.match(/^\[(.*?)\] STATUS::(.*?)_(\d+)\/(\d+)/);
            if (match) {
                const oltId = match[1];
                const placa = match[3];
                const porta = match[4];
                const stillHasIssue = Array.from(newProblems).some(p => p.startsWith(`[${oltId}] STATUS::`) && p.includes(`_${placa}/${porta}`));
                
                if (!stillHasIssue) {
                    showToast('Sinal Normalizado', `${oltId} - Porta ${placa}/${porta}`, 'status-normal', 'check_circle', 'right'); 
                }
            }
        }
    }
    
    // 1.3 Energia Restabelecida
    for (const oldEp of currentEnergyProblems) {
        if (!newEnergyProblems.has(oldEp)) {
            const match = oldEp.match(/^\[(.*?)\] ENERGIA::(.*?)_(\d+)\/(\d+)/);
            if (match) {
                const oltId = match[1];
                const placa = match[3];
                const porta = match[4];
                const stillHasIssue = Array.from(newEnergyProblems).some(p => p.startsWith(`[${oltId}] ENERGIA::`) && p.includes(`_${placa}/${porta}`));
                
                if (!stillHasIssue) {
                    showToast('Energia Retornou', `${oltId} - Porta ${placa}/${porta}`, 'status-normal', 'check_circle', 'left');
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
                `Múltiplas portas OFF na ${bb}`, 
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
            const match = problemKey.match(/^\[(.*?)\] STATUS::(SUPER|CRIT|WARN)_(\d+\/\d+)::(\d+)$/);
            if (match) {
                const oltId = match[1];
                const severity = match[2];
                const porta = match[3];
                const offline = match[4];

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
                    `${oltId} (${porta}) - ${offline} clientes off`, 
                    typeClass, 
                    icon, 
                    'right' 
                );
            }
        }
    }
    currentProblems = newProblems;
}