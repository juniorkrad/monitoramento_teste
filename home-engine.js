/* ==========================================================================
   home-engine.js - Controlador Geral e Vigilante de Alarmes (Home)
   ========================================================================== */

function watchHomeAlarms() {
    // ============================================================
    // 1. VIGILANTE DE ENERGIA (Atualiza o Card da Home)
    // ============================================================
    if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.global) {
        const globalData = window.ENERGY_DATA_STORE.global;

        // Atualiza o número total de clientes sem energia
        const totalPowerOffEl = document.getElementById('global-poweroff-total');
        if (totalPowerOffEl) {
            totalPowerOffEl.innerText = globalData.powerOff;
        }

        // Atualiza o contexto (OLTs afetadas e Impacto)
        const contextEl = document.getElementById('global-poweroff-context');
        if (contextEl) {
            const impacto = globalData.totalClients > 0 
                ? ((globalData.powerOff / globalData.totalClients) * 100).toFixed(1) 
                : 0;
                
            const relativo = globalData.totalOffline > 0 
                ? ((globalData.powerOff / globalData.totalOffline) * 100).toFixed(1) 
                : 0;

            contextEl.innerHTML = `
                <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">dns</span> 
                <strong style="color: var(--m3-on-surface);">${globalData.oltsAffected}</strong> de 17 OLTs afetadas.<br>
                <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">public</span> 
                Impacto rede: <strong style="color: var(--m3-on-surface);">${impacto}%</strong><br>
                <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">pie_chart</span> 
                Relativo OFF: <strong style="color: #f87171;">${relativo}%</strong>
            `;
        }
    }
    
    // ============================================================
    // 2. VIGILANTE DE REDE (Backbone)
    // ============================================================
    // O olt-engine.js atualmente injeta o alerta de Backbone diretamente,
    // mas o home-engine já está preparado para centralizar isso no futuro
    // se precisarmos puxar os dados de window.OLT_CLIENTS_DATA.
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa os componentes de layout globais da Home
    if (typeof loadHeader === 'function') {
        loadHeader({ title: "Dashboard Gerencial", exactTitle: true });
    }
    
    if (typeof loadFooter === 'function') {
        loadFooter();
    }

    // 2. Inicia o Vigilante de Alarmes apenas na página Home
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');
    
    if (isHomePage) {
        // Checa os cofres de dados a cada 2 segundos e atualiza a interface
        setInterval(watchHomeAlarms, 2000); 
    }
});