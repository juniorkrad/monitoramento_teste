/* ==========================================================================
   home-engine.js - Controlador Geral e Vigilante de Alarmes (Home)
   Atualização: Gatilho imediato e correção do filtro híbrido.
   ========================================================================== */

let lastNotifiedState = ""; 

function watchHomeAlarms() {
    // Clonando as variáveis globais para não destruí-las
    let networkProblems = new Set(window.NETWORK_PROBLEMS_STORE || []);
    let backboneProblems = new Set(window.NETWORK_BACKBONE_STORE || []);
    let hybridProblems = new Set(); 

    if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.global) {
        const globalData = window.ENERGY_DATA_STORE.global;

        // Atualização visual do card de Energia
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

        // Lógica de Cruzamento (Híbrido)
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

                        // Verifica se a porta com falta de energia está dentro de um problema Múltiplo de rede
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

                        // Verifica se a porta com falta de energia é um problema isolado de rede
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

    // Dispara a notificação visual na tela
    if (typeof checkAndNotifyForNewProblems === 'function') {
        if (checkIsHomePage()) {
            checkAndNotifyForNewProblems(networkProblems, backboneProblems, new Set(), hybridProblems);
        }
    }
}

// Inicialização Unificada
document.addEventListener('DOMContentLoaded', () => {
    if (checkIsHomePage()) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Dashboard Gerencial", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        
        setTimeout(updateGlobalTimestamp, 500);
        
        // Gatilho rápido: espera as Engines carregarem os dados (8 seg) e faz a primeira verificação
        setTimeout(watchHomeAlarms, 8000); 

        // Mantém a vigilância rodando
        setInterval(watchHomeAlarms, 60000); 
    }
});