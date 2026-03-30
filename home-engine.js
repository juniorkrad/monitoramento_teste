/* ==========================================================================
   home-engine.js - Controlador Geral e Vigilante de Alarmes (Home)
   Atualização: Regra do Híbrido ajustada para >= 32 clientes
   ========================================================================== */

let lastNotifiedState = ""; 

function watchHomeAlarms() {
    let networkProblems = new Set(window.NETWORK_PROBLEMS_STORE || []);
    let backboneProblems = new Set(window.NETWORK_BACKBONE_STORE || []);
    let hybridProblems = new Set(); 

    if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.global) {
        const globalData = window.ENERGY_DATA_STORE.global;

        const totalPowerOffEl = document.getElementById('global-poweroff-total');
        if (totalPowerOffEl) {
            totalPowerOffEl.innerText = globalData.powerOff;
            totalPowerOffEl.style.display = 'block';
        }

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

        // ============================================================
        // A REGRA DOS 70% (ATUALIZADA PARA 32 CLIENTES)
        // ============================================================
        for (const oltId in window.ENERGY_DATA_STORE.olts) {
            const oltData = window.ENERGY_DATA_STORE.olts[oltId];
            for (const placa in oltData.ports) {
                for (const porta in oltData.ports[placa]) {
                    const pData = oltData.ports[placa][porta];
                    const pt = `${placa}/${porta}`;

                    // Gatilho: Mínimo de 32 offline E Energia representa >= 70% do problema
                    if (pData.offline >= 32 && pData.powerOff > 0) {
                        const overlap = pData.powerOff / pData.offline;
                        if (overlap >= 0.70) {
                            // O formato exato que a RegEx do notifications-old espera
                            hybridProblems.add(`[${oltId}] HIBRIDO::${pt}::${pData.offline}::${pData.powerOff}`);
                        }
                    }
                }
            }
        }
    }

    // Exporta os híbridos
    window.NETWORK_HYBRID_STORE = hybridProblems;

    // Disparo sincronizado com trava protetora original
    const currentStateStr = 
        Array.from(networkProblems).sort().join('|') + "||" + 
        Array.from(backboneProblems).sort().join('|') + "||" + 
        Array.from(hybridProblems).sort().join('|');

    if (currentStateStr !== lastNotifiedState) {
        lastNotifiedState = currentStateStr;
        
        if (typeof checkAndNotifyForNewProblems === 'function') {
            checkAndNotifyForNewProblems(networkProblems, backboneProblems, new Set(), hybridProblems);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (checkIsHomePage()) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Dashboard Gerencial", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        
        setTimeout(updateGlobalTimestamp, 500);
        
        setInterval(watchHomeAlarms, 2000); 
    }
});