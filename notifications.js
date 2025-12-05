// ==============================================================================
// notifications.js - Sistema Avançado de Alertas (Visual + Sonoro)
// ==============================================================================

let currentProblems = new Set();
const MAX_VISIBLE_TOASTS = 5; // Limite para não poluir a tela

/**
 * Toca um bip curto para chamar atenção (AudioContext).
 * Funciona sem arquivos externos.
 */
function playAlertSound(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'problem') {
            // Som grave e pulsante para erro
            osc.type = 'sawtooth';
            osc.frequency.value = 150;
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } else {
            // Som agudo e limpo para sucesso (resolução)
            osc.type = 'sine';
            osc.frequency.value = 800;
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) {
        // Navegadores bloqueiam áudio sem interação do usuário, ignoramos o erro silenciosamente
        console.warn("Áudio bloqueado pelo navegador até primeira interação.");
    }
}

/**
 * Exibe notificação visual e toca som.
 */
function showToast(message, type = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Controle de Spam: Remove o mais antigo se tiver muitos na tela
    if (container.childElementCount >= MAX_VISIBLE_TOASTS) {
        container.removeChild(container.firstChild);
    }

    const toast = document.createElement('div');
    // Adicionamos ícones baseados no tipo
    let icon = '';
    if (type === 'problem') icon = '⚠️ ';
    if (type === 'success') icon = '✅ ';
    
    toast.className = `toast ${type}`;
    toast.innerHTML = `<strong>${icon}</strong> ${message}`;
    
    container.appendChild(toast);
    
    // Toca o som correspondente
    playAlertSound(type);

    // Animação de entrada
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove após 6 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) toast.remove();
        });
    }, 6000);
}

/**
 * Lógica Inteligente: Detecta novos problemas E problemas resolvidos.
 * @param {Set} newProblems - Set com chaves dos problemas atuais.
 */
function checkAndNotifyForNewProblems(newProblems) {
    // 1. Detectar NOVOS problemas (Caiu)
    for (const problemKey of newProblems) {
        if (!currentProblems.has(problemKey)) {
            const msg = formatMessage(problemKey);
            showToast(`ALERTA: ${msg} ficou OFFLINE`, 'problem');
        }
    }

    // 2. Detectar problemas RESOLVIDOS (Voltou)
    for (const oldProblem of currentProblems) {
        if (!newProblems.has(oldProblem)) {
            // Se estava na lista antiga, mas não está na nova, é porque voltou!
            const msg = formatMessage(oldProblem);
            showToast(`RESOLVIDO: ${msg} está ONLINE novamente`, 'success');
        }
    }
    
    // Atualiza a memória
    currentProblems = newProblems;
}

/**
 * Helper para formatar a mensagem da placa/porta bonitinha.
 */
function formatMessage(key) {
    // Tenta separar por barra (ex: "1/1", "GPON1/5")
    const parts = key.split('/');
    
    if (parts.length >= 2) {
        // Limpa "GPON" se existir e formata
        let placa = parts[0].replace(/GPON/i, '').trim();
        let porta = parts[1].trim();
        
        // Adiciona zero à esquerda para ficar alinhado (01, 02...)
        placa = placa.padStart(2, '0');
        porta = porta.padStart(2, '0');
        
        return `PLACA ${placa} / PORTA ${porta}`;
    }
    
    return key; // Retorna original se não conseguir formatar
}