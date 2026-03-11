/* ==========================================================================
   home-engine.js - Controlador Geral e Vigilante de Alarmes (Home)
   Atualização: Hierarquia de Força (Múltiplo de Energia anula o Híbrido)
   ========================================================================== */

let lastNotifiedState = ""; // Memória unificada para não spammar os alarmes

function watchHomeAlarms() {
    // Busca os dados dos cofres de rede e energia gerados pelos motores
    let networkProblems = new Set(window.NETWORK_PROBLEMS_STORE || []);
    let backboneProblems = new Set(window.NETWORK_BACKBONE_STORE || []);
    let energyProblems = new Set(window.NETWORK_ENERGY_STORE || []); // Lê a energia unificada
    let hybridProblems = new Set(); 

    // ============================================================
    // 1. IDENTIFICAR OLTS COM ALARME MÚLTIPLO DE ENERGIA
    // ============================================================
    let multiEnergyOlts = new Set();
    for (const ep of energyProblems) {
        const match = ep.match(/^\[(.*?)\] ENERGIA::MULTI::/);
        if (match) {
            multiEnergyOlts.add(match[1]); // Guarda o nome da OLT que tem 2+ portas sem luz
        }
    }

    // ============================================================
    // 2. VIGILANTE DE ENERGIA E MOTOR HÍBRIDO
    // ============================================================
    if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.global) {
        const globalData = window.ENERGY_DATA_STORE.global;

        // Atualiza o número total de clientes sem energia na Home
        const totalPowerOffEl = document.getElementById('global-poweroff-total');
        if (totalPowerOffEl) {
            totalPowerOffEl.innerText = globalData.powerOff;
        }

        // Atualiza o contexto (OLTs afetadas e Impacto) na Home
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
        // 2.2 CRIAÇÃO DO ALARME HÍBRIDO (COM TRAVA DE HIERARQUIA)
        // ============================================================
        for (const oltId in window.ENERGY_DATA_STORE.olts) {
            // TRAVA DE OURO: Se a OLT já tem um Alarme Múltiplo de Energia, aborta o Híbrido para ela!
            if (multiEnergyOlts.has(oltId)) continue; 

            const oltData = window.ENERGY_DATA_STORE.olts[oltId];
            for (const placa in oltData.ports) {
                for (const porta in oltData.ports[placa]) {
                    const pData = oltData.ports[placa][porta];
                    const pt = `${placa}/${porta}`;

                    // Gatilho: Mínimo de 16 offline E Energia representa >= 70% do problema
                    if (pData.offline >= 16 && pData.powerOff > 0) {
                        const overlap = pData.powerOff / pData.offline;
                        if (overlap >= 0.70) {
                            hybridProblems.add(`[${oltId}] HIBRIDO::${pt}::${pData.offline}::${pData.powerOff}`);
                        }
                    }
                }
            }
        }
    }

    // ============================================================
    // 3. DISPARO CENTRALIZADO DE TODOS OS ALARMES
    // ============================================================
    const currentStateStr = 
        Array.from(networkProblems).sort().join('|') + "||" + 
        Array.from(backboneProblems).sort().join('|') + "||" + 
        Array.from(energyProblems).sort().join('|') + "||" + 
        Array.from(hybridProblems).sort().join('|');

    if (currentStateStr !== lastNotifiedState) {
        lastNotifiedState = currentStateStr;
        
        if (typeof checkAndNotifyForNewProblems === 'function') {
            checkAndNotifyForNewProblems(networkProblems, backboneProblems, energyProblems, hybridProblems);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadHeader === 'function') {
        loadHeader({ title: "Dashboard Gerencial", exactTitle: true });
    }
    
    if (typeof loadFooter === 'function') {
        loadFooter();
    }

    setTimeout(() => {
        const timestampEl = document.getElementById('update-timestamp');
        if (timestampEl) {
            const now = new Date();
            const data = now.toLocaleDateString('pt-BR');
            const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            timestampEl.innerHTML = `
                <span class="material-symbols-rounded">calendar_today</span> ${data}
                <span style="width: 1px; height: 12px; background: rgba(255,255,255,0.3); margin: 0 5px;"></span>
                <span class="material-symbols-rounded">schedule</span> ${hora}
            `;
            timestampEl.style.color = 'var(--m3-on-surface-variant)';
        }
    }, 500);

    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');
    
    if (isHomePage) {
        setInterval(watchHomeAlarms, 2000); 
    }
});