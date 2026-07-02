/* ==========================================================================
   home-engine.js - Controlador Geral e Vigilante de Alarmes (Home)
   Atualização: Limpeza de UI redundante, focando apenas na emissão do Alarme Híbrido
   ========================================================================== */

let lastNotifiedState = ""; 

function watchHomeAlarms() {
    // 1. Coleta os alarmes gerais já mastigados pelo olt-engine.js
    let networkProblems = new Set(window.NETWORK_PROBLEMS_STORE || []);
    let backboneProblems = new Set(window.NETWORK_BACKBONE_STORE || []);
    let hybridProblems = new Set(); 

    // 2. Avalia a Regra dos Híbridos (Se os dados de energia existirem)
    // O desenho na tela da Home agora é responsabilidade do energia-engine.js!
    if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.global) {
        
        // Objeto para agrupar as portas que entraram na regra, separadas por OLT
        const hibridosPorOlt = {};

        // ============================================================
        // A REGRA DOS HÍBRIDOS: >= 32 clientes offline e >= 70% de energia
        // ============================================================
        for (const oltId in window.ENERGY_DATA_STORE.olts) {
            const oltData = window.ENERGY_DATA_STORE.olts[oltId];
            
            for (const placa in oltData.ports) {
                for (const porta in oltData.ports[placa]) {
                    const pData = oltData.ports[placa][porta];
                    const pt = `${placa}/${porta}`;

                    if (pData.offline >= 32 && pData.powerOff > 0) {
                        const overlap = pData.powerOff / pData.offline;
                        if (overlap >= 0.70) {
                            // Inicializa o array da OLT se não existir
                            if (!hibridosPorOlt[oltId]) {
                                hibridosPorOlt[oltId] = [];
                            }
                            
                            // Guarda os dados da porta afetada
                            hibridosPorOlt[oltId].push({
                                pt: pt,
                                offline: pData.offline,
                                powerOff: pData.powerOff
                            });
                        }
                    }
                }
            }
        }

        // ============================================================
        // AVALIAÇÃO DE AGRUPAMENTO (ÚNICO VS MÚLTIPLO)
        // ============================================================
        for (const oltId in hibridosPorOlt) {
            const portasAfetadas = hibridosPorOlt[oltId];
            
            if (portasAfetadas.length === 1) {
                // Emite o alarme normal/individual se apenas 1 porta estiver na regra
                const p = portasAfetadas[0];
                // TODO Futuro: Injetar a Localidade (Bairro) aqui para unificação
                hybridProblems.add(`[${oltId}] HIBRIDO::${p.pt}::${p.offline}::${p.powerOff}`);
            } else if (portasAfetadas.length >= 2) {
                // Emite a nova assinatura de alarme múltiplo agrupando as portas
                let totalOffline = 0;
                let totalPowerOff = 0;
                const listaPortas = [];
                
                portasAfetadas.forEach(p => {
                    totalOffline += p.offline;
                    totalPowerOff += p.powerOff;
                    listaPortas.push(p.pt);
                });
                
                const portasStr = listaPortas.join(',');
                hybridProblems.add(`[${oltId}] HIBRIDO_MULTIPLO::${portasStr}::${totalOffline}::${totalPowerOff}`);
            }
        }
    }

    // Exporta os híbridos para a memória global
    window.NETWORK_HYBRID_STORE = hybridProblems;

    // 3. Disparo sincronizado para o sistema de Notificações
    // Cria uma "assinatura" do estado atual para não disparar alertas repetidos
    const currentStateStr = 
        Array.from(networkProblems).sort().join('|') + "||" + 
        Array.from(backboneProblems).sort().join('|') + "||" + 
        Array.from(hybridProblems).sort().join('|');

    if (currentStateStr !== lastNotifiedState) {
        lastNotifiedState = currentStateStr;
        
        if (typeof checkAndNotifyForNewProblems === 'function') {
            // Repassa os problemas para o motor de pop-ups/alertas na tela
            checkAndNotifyForNewProblems(networkProblems, backboneProblems, new Set(), hybridProblems);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Só inicia o vigilante se estiver na tela inicial
    if (checkIsHomePage()) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Dashboard Gerencial", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        
        setTimeout(updateGlobalTimestamp, 500);
        
        // Chamada imediata para remover o delay inicial
        watchHomeAlarms();
        // Roda a vigilância a cada 2 segundos (Não gasta internet, apenas lê a memória)
        setInterval(watchHomeAlarms, 2000); 
    }
});