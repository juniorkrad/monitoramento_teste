// ==============================================================================
// notifications.js - Sistema Central de Alertas (Com Hierarquia de Backbone)
// Atualização: Unificação de Alarmes Híbridos e Ocultação de Portas
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
        toast.style.animation = 'none';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'none';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }
    }, 10000); 
}

function checkAndNotifyForNewProblems(networkProblems, backboneProblems, energyProblems, hybridProblems) {
    
    const newBackbones = [...backboneProblems].filter(x => !currentBackbones.has(x));
    const newHybridProblems = [...hybridProblems].filter(x => !currentHybridProblems.has(x));
    const newProblems = [...networkProblems].filter(x => !currentProblems.has(x));

    // 1. Processa Híbridos (Dying Gasp)
    const activeHybridPorts = new Set();
    
    // Mapeia todas as portas híbridas ativas para evitar duplicação em problemas de rede normais
    hybridProblems.forEach(problemKey => {
        const match = problemKey.match(/^\[(.*?)\] HIBRIDO::(\d+\/\d+)::(\d+)::(\d+)$/);
        if (match) {
            activeHybridPorts.add(`${match[1]}_${match[2]}`);
        }
    });

    // Agrupa os NOVOS alarmes híbridos por OLT
    const hybridOltSet = new Set();
    newHybridProblems.forEach(problemKey => {
        const match = problemKey.match(/^\[(.*?)\] HIBRIDO::(\d+\/\d+)::(\d+)::(\d+)$/);
        if (match) {
            hybridOltSet.add(match[1]);
        }
    });

    // Dispara apenas 1 alerta Híbrido unificado por OLT afetada
    hybridOltSet.forEach(oltId => {
        showToast(
            'Alerta Híbrido', 
            `<span class="olt-highlight">${oltId}</span>`, 
            'rede-warn', 
            'warning',        
            'right' 
        );
    });


    // 2. Processa Backbones
    newBackbones.forEach(problemKey => {
        const match = problemKey.match(/^\[(.*?)\] STATUS::SUPER_(.*)$/);
        if (match) {
            const oltId = match[1];
            // Remove a listagem de portas e exibe apenas a OLT em destaque
            showToast(
                'Backbone', 
                `<span class="olt-highlight">${oltId}</span>`, 
                'backbone-l1', 
                'fmd_bad',      
                'right' 
            );
        }
    });

    // 3. Processa Problemas de Rede (Multi e Single)
    newProblems.forEach(problemKey => {
        
        // Falha Múltipla
        const matchMulti = problemKey.match(/^\[(.*?)\] STATUS::MULTI::(.*)$/);
        if (matchMulti) {
            const oltId = matchMulti[1];
            // Oculta a listagem de portas (matchMulti[2]) do alerta visual
            showToast(
                'Falha Múltipla', 
                `<span class="olt-highlight">${oltId}</span>`, 
                'rede-problem', 
                'error',        
                'right' 
            );
            return; 
        }

        // Falha Singular (Problema/Atenção)
        const matchSingle = problemKey.match(/^\[(.*?)\] STATUS::(SUPER|CRIT|WARN)_(\d+\/\d+)::(\d+)$/);
        if (matchSingle) {
            const oltId = matchSingle[1];
            const severity = matchSingle[2];
            const porta = matchSingle[3];

            // Trava: se a porta já bipou como Híbrido, não avisa como rede
            if (activeHybridPorts.has(`${oltId}_${porta}`)) return;

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

            // Exibe o alerta isolado mantendo apenas a OLT no descritivo
            showToast(
                title, 
                `<span class="olt-highlight">${oltId}</span>`, 
                typeClass, 
                icon, 
                'right' 
            );
        }
    });

    // Sincroniza a memória de estado atual
    currentProblems = new Set(networkProblems);
    currentBackbones = new Set(backboneProblems);
    currentHybridProblems = new Set(hybridProblems);
}