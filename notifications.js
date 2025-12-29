// ==============================================================================
// notifications.js - Sistema Central de Alertas (Versão 7.0 - Infraestrutura)
// ==============================================================================

// Armazena o estado atual dos problemas para comparação
let currentProblems = new Set();

// Controle de alertas já emitidos para não ficar repetindo o mesmo aviso
// Estrutura: { 'HEL1': 'problem', 'HEL2': 'warning' }
let activeAlerts = {}; 

const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"); 

/**
 * Exibe o Toast na tela
 * Tipos suportados: 'problem' (Vermelho), 'warning' (Amarelo), 'success' (Verde)
 */
function showToast(message, type = '') {
    // TRAVA DE SEGURANÇA: Só exibe alertas se estiver na Home (index.html) ou na raiz
    const path = window.location.pathname;
    const isHome = path.includes('index.html') || path.endsWith('/') || path.endsWith('automacao-olt/'); // Ajuste conforme sua URL
    
    if (!isHome) return; 

    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Ícones Baseados no Tipo
    let icon = 'ℹ️ ';
    if (type === 'problem') icon = '🚨 '; // Sirene para problema grave
    if (type === 'warning') icon = '⚠️ '; // Triângulo para atenção
    if (type === 'success') icon = '✅ ';
    
    toast.innerHTML = `<span style="font-size: 1.1em;">${icon} ${message}</span>`;
    
    toast.onclick = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    };

    container.appendChild(toast);
    
    // Toca som apenas se for Problema (17+) ou Atenção (16)
    if (type === 'problem' || type === 'warning') {
        try { alertSound.play().catch(e => {}); } catch(e){} 
    }

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }
    }, 8000); // 8 segundos
}

/**
 * Nova Lógica: Agrupa por Porta e decide Nível de Alerta (16 vs 17+)
 */
function checkAndNotifyForNewProblems(newProblems) {
    
    // 1. Agrupar contagem por OLT e por PORTA
    // Estrutura: counts['HEL1']['1/1'] = 15
    const counts = {};

    for (const key of newProblems) {
        // Extrai dados: [HEL1] 1/1
        const parsed = parseProblemKey(key);
        if (parsed) {
            const { olt, porta } = parsed;
            
            if (!counts[olt]) counts[olt] = {};
            if (!counts[olt][porta]) counts[olt][porta] = 0;
            
            counts[olt][porta]++;
        }
    }

    // 2. Analisar gravidade por OLT
    const currentOltStatus = {}; // Vai guardar o pior status de cada OLT agora

    for (const olt in counts) {
        let maxOff = 0;
        let piorCenario = 'normal'; // normal, warning, problem

        // Vê qual porta está pior nessa OLT
        for (const porta in counts[olt]) {
            const qtd = counts[olt][porta];
            if (qtd > maxOff) maxOff = qtd;
        }

        // --- REGRAS DE GATILHO ---
        if (maxOff === 16) {
            piorCenario = 'warning';
        } else if (maxOff >= 17) {
            piorCenario = 'problem';
        }

        // Se detectou algo relevante, armazena
        if (piorCenario !== 'normal') {
            currentOltStatus[olt] = piorCenario;

            // Só notifica se o status MUDOU ou PIOROU em relação ao último alerta
            // Ex: Se já avisou WARNING, e agora virou PROBLEM -> Avisa
            // Ex: Se já avisou PROBLEM, e continua PROBLEM -> Silêncio (não spamma)
            if (activeAlerts[olt] !== piorCenario) {
                
                if (piorCenario === 'warning') {
                    showToast(`<strong>ATENÇÃO: ${olt}</strong><br><span style="font-size:0.85em">Possível CTO isolada (${maxOff} clientes OFF)</span>`, 'warning');
                } 
                else if (piorCenario === 'problem') {
                    showToast(`<strong>PROBLEMA: ${olt}</strong><br><span style="font-size:0.85em">Falha massiva detectada (${maxOff} clientes OFF)</span>`, 'problem');
                }

                // Atualiza o estado do alerta dessa OLT
                activeAlerts[olt] = piorCenario;
            }
        } else {
            // Se a OLT voltou ao normal (abaixo de 16), limpa o alerta
            if (activeAlerts[olt]) {
                delete activeAlerts[olt];
                // Opcional: Avisar que normalizou (showToast "Normalizado")
                // Por enquanto deixei mudo na normalização para menos ruído
            }
        }
    }

    currentProblems = newProblems;
}

/**
 * Helper para extrair OLT e Porta da string "[HEL1] 1/1/1/4"
 */
function parseProblemKey(key) {
    // Regex: Pega o nome entre [] e depois pega o resto
    const match = key.match(/^\[(.*?)\]\s*(.*)$/);
    if (!match) return null;

    const olt = match[1]; // HEL1
    const resto = match[2]; // 1/1/1/4 ou GPON 1/1/4

    // Tenta pegar "Placa/Porta" (ex: 1/1)
    // Assume que a string vem algo como "1/1/3/4" -> Placa 3, Porta 4? 
    // Ou se vem "1/4" direto. Vamos simplificar agrupando pela string da porta.
    // Vamos pegar os dois primeiros números significativos se houver barras
    
    // Se o formato for "1/1/1/15", queremos agrupar pelo Pon: "1/1/1/15" pertence à porta Pon?
    // Geralmente é Slot/Porta. Vamos usar um regex genérico para agrupar "interface".
    
    // Simulação: Agrupa pelo prefixo da porta (ex: remove o id do cliente final se existir)
    // Se a chave for apenas OLT + Porta PON, usamos ela inteira.
    
    // Para garantir o funcionamento com o seu padrão atual, vamos retornar o "resto" 
    // mas removendo o último dígito se for ID de cliente, ou usar a lógica anterior.
    
    // Estratégia Segura: Agrupar pela string "Placa/Porta" definida no script principal.
    // Vou assumir que o script principal envia "[HEL1] 1/1/8" (Placa/Porta/ID) ou "[HEL1] 1/1"
    
    const partes = resto.split('/');
    let portaGroup = "";
    
    if (partes.length >= 2) {
        // Pega as duas primeiras partes (Ex: 1/1) que representam a porta PON
        portaGroup = partes[0] + '/' + partes[1]; 
    } else {
        portaGroup = resto;
    }

    return { olt, porta: portaGroup };
}