// ==============================================================================
// notifications.js - Sistema de Monitoramento e Alertas OLT (Corrigido)
// ==============================================================================

class NotificationSystem {
    constructor() {
        this.currentProblems = new Set();
        this.containerId = 'toast-container';
        // Não chamamos ensureContainerExists aqui para evitar erro de DOM não carregado
    }

    /**
     * Inicializa o sistema. Deve ser chamado após o DOM estar pronto.
     */
    init() {
        this.ensureContainerExists();
        console.log("Sistema de Notificações Iniciado.");
    }

    ensureContainerExists() {
        if (!document.getElementById(this.containerId)) {
            // Verifica se o body existe antes de tentar anexar
            if (!document.body) {
                console.error("Erro: O script de notificação foi carregado antes do <body>.");
                return;
            }
            const container = document.createElement('div');
            container.id = this.containerId;
            // O estilo agora é controlado pelo CSS que te passei anteriormente, 
            // mas mantemos um fallback aqui caso o CSS falhe.
            container.style.position = 'fixed';
            container.style.top = '20px';
            container.style.right = '20px';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById(this.containerId);
        if (!container) return; // Segurança extra

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Ícones
        const icon = type === 'error' ? '⚠️' : (type === 'success' ? '✅' : 'ℹ️');
        toast.innerHTML = `<strong>${icon}</strong> <span>${message}</span>`;

        container.appendChild(toast);

        // Animação
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Remover após 5s
        setTimeout(() => {
            this.removeToast(toast);
        }, 5000);

        toast.onclick = () => this.removeToast(toast);
    }

    removeToast(toast) {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) toast.remove();
        });
    }

    formatMessage(problemKey) {
        try {
            const [placa, porta] = problemKey.split('/');
            const placaFmt = placa.replace(/\D/g, '').padStart(2, '0'); 
            const portaFmt = porta.padStart(2, '0');
            return `PLACA ${placaFmt} / PORTA ${portaFmt}`;
        } catch (e) {
            return problemKey; // Retorna o texto original se der erro na formatação
        }
    }

    updateStatus(dataInput) {
        // BLINDAGEM: Converte Array para Set se necessário
        let newProblems;
        if (Array.isArray(dataInput)) {
            newProblems = new Set(dataInput);
        } else if (dataInput instanceof Set) {
            newProblems = dataInput;
        } else {
            console.error("Formato de dados inválido. Esperado Array ou Set.");
            return;
        }

        // 1. Detectar NOVOS problemas
        for (const problem of newProblems) {
            if (!this.currentProblems.has(problem)) {
                this.showToast(`FALHA: ${this.formatMessage(problem)}`, 'error');
            }
        }

        // 2. Detectar problemas RESOLVIDOS
        for (const problem of this.currentProblems) {
            if (!newProblems.has(problem)) {
                this.showToast(`NORMALIZADO: ${this.formatMessage(problem)}`, 'success');
            }
        }

        this.currentProblems = newProblems;
    }
}

// ==============================================================================
// INICIALIZAÇÃO SEGURA
// ==============================================================================

// Cria a instância globalmente
window.monitorAlerts = new NotificationSystem();

// Garante que o container só seja criado quando a página terminar de carregar
document.addEventListener('DOMContentLoaded', () => {
    window.monitorAlerts.init();
});