// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 6.0 - Aggregated OLT Health)
// ==============================================================================

// Mantemos o histórico detalhado internamente para saber o que mudou
let currentProblems = new Set();

// Som de Alerta (Beep curto)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

/**
 * Exibe o Toast na tela
 */
function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Ícones
    const icon = type === 'problem' ? '⚠️ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
    
    // Mensagem aceita HTML
    toast.innerHTML = `<span style="font-size: 1.1em;">${icon} ${message}</span>`;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);
    
    if (type === 'problem') {
        try { alertSound.play().catch(e => {}); } catch(e){} 
    }

    setTimeout(() => toast.classList.add('show'), 10);

    // Tempo de exibição (7s)
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }, 7000);
}

/**
 * Nova Lógica: Agrupa problemas por OLT e notifica mudanças na QUANTIDADE
 */
function checkAndNotifyForNewProblems(newProblems) {
    
    // 1. Conta quantos problemas existem POR OLT no cenário NOVO
    const newCounts = countProblemsByOLT(newProblems);
    
    // 2. Conta quantos problemas existiam POR OLT no cenário ANTIGO
    const oldCounts = countProblemsByOLT(currentProblems);
    
    // 3. Identifica todas as OLTs envolvidas
    const allOlts = new Set([...Object.keys(newCounts), ...Object.keys(oldCounts)]);

    for (const olt of allOlts) {
        const qtdNova = newCounts[olt] || 0;
        const qtdVelha = oldCounts[olt] || 0;

        // CASO 1: PIOROU (Quantidade de Offlines Aumentou)
        if (qtdNova > qtdVelha) {
            const diferenca = qtdNova - qtdVelha;
            // Ex: "HEL1: 15 Clientes OFF (+2)"
            const msg = `<strong>${olt}</strong>: ${qtdNova} Clientes OFF <span style="font-size:0.8em; opacity:0.8;">(🔺 +${diferenca})</span>`;
            showToast(msg, 'problem');
        }
        
        // CASO 2: MELHOROU (Quantidade de Offlines Diminuiu)
        else if (qtdNova < qtdVelha) {
            const diferenca = qtdVelha - qtdNova;
            // Ex: "HEL1: 10 Clientes OFF (-5)"
            const msg = `<strong>${olt}</strong>: ${qtdNova} Clientes OFF <span style="font-size:0.8em; opacity:0.8;">(🔽 -${diferenca})</span>`;
            showToast(msg, 'status-normal');
        }
    }
    
    // Atualiza o histórico
    currentProblems = newProblems;
}

/**
 * Função Auxiliar: Transforma o Set de problemas em um Objeto de contagem
 * Entrada: {'[HEL1] 1/1', '[HEL1] 1/2', '[SBO1] 5/5'}
 * Saída: { 'HEL1': 2, 'SBO1': 1 }
 */
function countProblemsByOLT(problemSet) {
    const counts = {};
    
    for (const key of problemSet) {
        // Extrai o nome da OLT que está entre colchetes
        // Regex: Pega tudo que está dentro de [ ] no começo da string
        const match = key.match(/^\[(.*?)\]/);
        
        if (match) {
            const oltName = match[1]; // Ex: "HEL1"
            counts[oltName] = (counts[oltName] || 0) + 1;
        } else {
            // Caso não consiga ler o nome, agrupa como "Desconhecido"
            counts['Geral'] = (counts['Geral'] || 0) + 1;
        }
    }
    
    return counts;
}

// A função formatMessage antiga não é mais necessária para os alertas,
// mas se for usada em outro lugar, pode manter ou remover.