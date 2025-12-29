// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 4.0 - Actionable Links)
// ==============================================================================

let currentProblems = new Set();

// Som de Alerta (Beep curto)
const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

/**
 * Cria e exibe um pop-up (toast) na tela.
 * @param {string} message - A mensagem a ser exibida (aceita HTML).
 * @param {string} type - 'problem' (vermelho) ou 'success' (verde).
 */
function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Define o ícone baseado no tipo
    const icon = type === 'problem' ? '⚠️ ' : type === 'success' ? '✅ ' : 'ℹ️ ';
    
    // innerHTML permite que o link <a> funcione
    toast.innerHTML = `<strong>${icon}</strong> ${message}`;
    
    // Clique no balão fecha o alerta (mas o link tem proteção contra isso)
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);
    
    // Toca som apenas se for problema
    if (type === 'problem') {
        try { alertSound.play().catch(e => {}); } catch(e){} 
    }

    // Animação de entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto-fechamento após 7 segundos (pode aumentar se quiser dar tempo de clicar)
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }, 7000); // 7000ms = 7 segundos
}

/**
 * Lógica Inteligente: Detecta Novos Problemas E Problemas Resolvidos
 */
function checkAndNotifyForNewProblems(newProblems) {
    // 1. Detectar NOVOS problemas (Caiu)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const msg = formatMessage(problemKey, true); // true = gera link
            // Removido o texto "ALERTA:", mantendo apenas a mensagem formatada
            showToast(msg, 'problem');
        }
    }

    // 2. Detectar Problemas RESOLVIDOS (Voltou)
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            const msg = formatMessage(oldProblem, false); // false = sem link (opcional)
            // Removido o texto "NORMALIZADO:"
            showToast(msg, 'status-normal'); 
        }
    }
    
    currentProblems = newProblems;
}

/**
 * Formata o texto da porta e adiciona o Link de Circuito
 * @param {string} key - A chave do problema (ex: "[HEL1] 1/1")
 * @param {boolean} addLink - Se deve adicionar o link "CIRC" (Geralmente sim para erros)
 */
function formatMessage(key, addLink = true) {
    let prefixoOlt = "";
    let nomeOltLimpo = ""; 
    let restoDaChave = key;

    // Regex: Captura o nome da OLT entre colchetes
    // Ex: "[HEL-1] 1/4" -> Grupo 1: "HEL-1", Grupo 2: "1/4"
    const oltMatch = key.match(/^\[(.*?)\]\s*(.*)$/);

    if (oltMatch) {
        nomeOltLimpo = oltMatch[1]; 
        prefixoOlt = `<strong>${nomeOltLimpo}</strong>: `; 
        restoDaChave = oltMatch[2];
    }

    const [placa, porta] = restoDaChave.split('/');
    
    // Tratamento de segurança
    if (!placa || !porta) return key; 

    const placaFmt = placa.replace('GPON', '').padStart(2, '0');
    const portaFmt = porta.padStart(2, '0');
    
    let linkHtml = "";

    // --- MONTAGEM DO LINK ---
    if (addLink) {
        // ⚠️ CONFIGURAÇÃO: Coloque aqui o começo da URL do seu sistema
        // Exemplo: http://192.168.1.50/sistema/busca.php
        const baseUrl = "http://seu-sistema-interno.com/buscar";
        
        // Monta os parâmetros (ajuste conforme seu sistema pede: ?olt=X&slot=Y...)
        const params = `?olt=${nomeOltLimpo}&placa=${placaFmt}&porta=${portaFmt}`;
        const finalUrl = baseUrl + params;

        // event.stopPropagation() é CRUCIAL: impede que clicar no link feche o alerta
        linkHtml = `, <a href="${finalUrl}" target="_blank" class="link-circ" onclick="event.stopPropagation()">CIRC</a>`;
    }

    return `${prefixoOlt}PLACA ${placaFmt} / PORTA ${portaFmt}${linkHtml}`;
}