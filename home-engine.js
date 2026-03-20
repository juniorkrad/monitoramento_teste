/* ==========================================================================
   home-engine.js - Controlador Geral e Vigilante de Alarmes (Home)
   Atualização: Lógica exata da versão Old restaurada (Trava de estado preservando Set)
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

        for (const oltId in window.ENERGY_DATA_STORE.olts) {
            const oltData = window.ENERGY_DATA_STORE.olts[oltId];
            for (const placa in oltData.ports) {
                for (const porta in oltData.ports[placa]) {
                    const pData = oltData.ports[placa][porta];
                    const pt = `${placa}/${porta}`;
                    
                    if (pData.powerOff > 0) {
                        const portRef = `[${oltId}] STATUS::CRIT_${pt}`;
                        const portRefWarn = `[${oltId}] STATUS::WARN_${pt}`;
                        const portRefSuper = `[${oltId}] STATUS::SUPER_${pt}`;
                        
                        let handled = false;

                        for (const netProb of networkProblems) {
                            if (netProb.includes(`[${oltId}] STATUS::MULTI::`)) {
                                const affectedPortsStr = netProb.split('STATUS::MULTI::')[1];
                                const affectedPorts = affectedPortsStr.split(',');
                                
                                if (affectedPorts.includes(pt)) {
                                    hybridProblems.add(`[${oltId}] HÍBRIDO::${pt}::${pData.powerOff}`);
                                    handled = true;
                                }
                            }
                        }

                        if (!handled) {
                            for (const netProb of networkProblems) {
                                if (netProb.startsWith(portRef) || netProb.startsWith(portRefWarn) || netProb.startsWith(portRefSuper)) {
                                    hybridProblems.add(`[${oltId}] HÍBRIDO::${pt}::${pData.powerOff}`);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Trava de estado e formatação da string idênticos ao Old
    let currentState = Array.from(networkProblems).sort().join('|') + 
                       Array.from(backboneProblems).sort().join('|') + 
                       Array.from(hybridProblems).sort().join('|');

    if (currentState !== lastNotifiedState) {
        if (typeof checkAndNotifyForNewProblems === 'function') {
            if (checkIsHomePage()) {
                checkAndNotifyForNewProblems(networkProblems, backboneProblems, new Set(), hybridProblems);
            }
        }
        lastNotifiedState = currentState;
    }
}

// Inicialização Unificada
document.addEventListener('DOMContentLoaded', () => {
    if (checkIsHomePage()) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Dashboard Gerencial", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        
        setTimeout(updateGlobalTimestamp, 500);
        
        // Gatilho rápido de 2 segundos (ajustado sem quebrar o loop)
        setTimeout(watchHomeAlarms, 2000); 

        // Loop de verificação
        setInterval(watchHomeAlarms, 60000); 
    }
});