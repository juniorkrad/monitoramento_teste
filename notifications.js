// ==============================================================================
// notifications.js - Sistema de Monitoramento e Alertas OLT
// ==============================================================================

class NotificationSystem {
    constructor() {
        this.currentProblems = new Set();
        this.containerId = 'toast-container';
        this.ensureContainerExists();
    }

    /**
     * Garante que o container de notificações exista no DOM.
     */
    ensureContainerExists() {
        if (!document.getElementById(this.containerId)) {
            const container = document.createElement('div');
            container.id = this.containerId;
            // Estilos básicos inline para garantir funcionamento imediato
            container.style.position = 'fixed';
            container.style.top = '20px';
            container.style.right = '20px';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
    }

    /**
     * Exibe o Toast na tela.
     * @param {string} message - Texto do alerta.
     * @param {string} type - 'error' (problema) ou 'success' (resolvido).
     */
    showToast(message, type = 'info') {
        const container = document.getElementById(this.containerId);
        const toast = document.createElement('div');
        
        // Adiciona classes para estilização CSS
        toast.className = `toast toast-${type}`;
        
        // Adiciona ícone baseada no tipo (Opcional, mas recomendado)
        const icon = type === 'error' ? '⚠️ ' : (type === 'success' ? '✅ ' : 'ℹ️ ');
        toast.textContent = `${icon} ${message}`;

        container.appendChild(toast);

        // Animação de entrada (Next Frame)
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remove automaticamente após 5 segundos
        setTimeout(() => {
            this.removeToast(toast);
        }, 5000);

        // Permite fechar clicando
        toast.onclick = () => this.removeToast(toast);
    }

    removeToast(toast) {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) toast.remove();
        });
    }

    /**
     * Formata a string "GPONX/Y" para algo legível.
     */
    formatMessage(problemKey) {
        const [placa, porta] = problemKey.split('/');
        // Remove 'GPON', 'EPON', etc e deixa números com 2 dígitos
        const placaFmt = placa.replace(/\D/g, '').padStart(2, '0'); 
        const portaFmt = porta.padStart(2, '0');
        return `PLACA ${placaFmt} / PORTA ${portaFmt}`;
    }

    /**
     * Lógica principal: Compara estados e notifica entradas e saídas.
     * @param {Set} newProblems - Set com o estado atual dos problemas.
     */
    updateStatus(newProblems) {
        // 1. Detectar NOVOS problemas (Diferença: New - Current)
        for (const problem of newProblems) {
            if (!this.currentProblems.has(problem)) {
                this.showToast(`FALHA: ${this.formatMessage(problem)}`, 'error');
            }
        }

        // 2. Detectar problemas RESOLVIDOS (Diferença: Current - New)
        // Isso é crucial para monitoramento: saber que voltou ao normal.
        for (const problem of this.currentProblems) {
            if (!newProblems.has(problem)) {
                this.showToast(`NORMALIZADO: ${this.formatMessage(problem)}`, 'success');
            }
        }

        // Atualiza a memória
        this.currentProblems = newProblems; // Atualiza a referência
    }
}

// Inicializa a instância globalmente para ser usada na sua aplicação
const monitorAlerts = new NotificationSystem();

// EXEMPLO DE COMO CHAMAR NO SEU CÓDIGO EXTERNO:
// monitorAlerts.updateStatus(new Set(['GPON1/1', 'GPON2/5']));