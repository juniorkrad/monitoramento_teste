// ==============================================================================
// potencia-engine.js - Motor Dedicado para Análise de Potência Óptica
// ==============================================================================

window.POTENCIA_CLIENTS_DATA = {};
window.POTENCIA_LAST_UPDATES = {}; 

function parsePowerValue(powerStr) {
    if (!powerStr) return null;
    const cleaned = powerStr.replace(/[^\d.-]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
}

async function runPotenciaEngine() {
    const gridEl = document.getElementById('potencia-grid');
    const globalBody = document.getElementById('global-potencia-body');
    const timestampEl = document.getElementById('update-timestamp');
    
    const isPotenciaPage = window.location.pathname.includes('potencia.html');
    
    if (!globalBody && !gridEl) return; 

    if (timestampEl && timestampEl.textContent.includes('Aguardando')) {
        timestampEl.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Buscando dados...';
    }

    try {
        let globalCriticos = 0;
        let globalAnalisados = 0;
        let oltStats = [];
        let todosClientesCriticos = []; 
        
        window.POTENCIA_CLIENTS_DATA = {};
        window.POTENCIA_LAST_UPDATES = {};

        const ranges = GLOBAL_MASTER_OLT_LIST.map(o => `${o.sheetTab}!A:K`);
        
        // Chamada limpa utilizando o API Service
        const dataBatch = await API.getBatch(ranges);

        if (!dataBatch.valueRanges) throw new Error("Falha ao carregar dados da API.");

        GLOBAL_MASTER_OLT_LIST.forEach((olt, index) => {
            const rawValues = dataBatch.valueRanges[index].values;
            
            let timestamp = '--/-- --:--';
            if (rawValues && rawValues.length > 0) {
                timestamp = rawValues[0][10] || '--/-- --:--';
                timestamp = timestamp.replace('Atualizado em:', '').trim();
            }
            window.POTENCIA_LAST_UPDATES[olt.id] = timestamp;
            
            const rows = rawValues && rawValues.length > 1 ? rawValues.slice(1) : [];
            
            let criticosNestaOlt = 0;
            let totalNestaOlt = 0;
            let clientesCriticos = [];

            rows.forEach(col => {
                if(col.length === 0) return;
                
                let portaFinal = '';
                let serial = '';
                let potenciaStr = '';
                let codigoCliente = '';
                let isCritical = false;
                let potenciaValue = null;

                if (olt.type === 'nokia') {
                    let portaRaw = col[0] || '';
                    if (portaRaw.includes('1/1/')) {
                        let parts = portaRaw.split('/');
                        if(parts.length >= 4) portaFinal = `${parts[2]}/${parts[3]}`;
                    }
                    serial = col[2] || '-';
                    potenciaStr = col[5] || '';
                    codigoCliente = col[8] || '-';
                    
                    potenciaValue = parsePowerValue(potenciaStr);
                    if (potenciaValue !== null && potenciaValue <= -25) {
                        isCritical = true;
                    }
                } else {
                    let portaRaw = col[0] || '';
                    if (olt.type === 'furukawa-10') {
                        portaFinal = portaRaw;
                    } else {
                        let match = portaRaw.match(/GPON(\d+\/\d+)/i);
                        if (match) portaFinal = match[1];
                        else portaFinal = portaRaw;
                    }

                    serial = col[3] || '-';
                    potenciaStr = col[5] || '';
                    codigoCliente = col[7] || '-';

                    potenciaValue = parsePowerValue(potenciaStr);
                    if (potenciaValue !== null && potenciaValue <= -23) {
                        isCritical = true;
                    }
                }

                if (potenciaValue !== null) {
                    totalNestaOlt++;
                    globalAnalisados++;
                    
                    if (isCritical && portaFinal) {
                        criticosNestaOlt++;
                        globalCriticos++;
                        const clientData = { olt: olt.id, porta: portaFinal, serial: serial, potencia: potenciaValue, codigo: codigoCliente };
                        clientesCriticos.push(clientData);
                        todosClientesCriticos.push(clientData); 
                    }
                }
            });

            clientesCriticos.sort((a, b) => a.potencia - b.potencia);
            
            window.POTENCIA_CLIENTS_DATA[olt.id] = clientesCriticos;
            oltStats.push({ id: olt.id, criticos: criticosNestaOlt, total: totalNestaOlt });
        });

        if (globalBody) {
            todosClientesCriticos.sort((a, b) => a.potencia - b.potencia);
            const piores5 = todosClientesCriticos.slice(0, 5);

            let piores5Html = '';
            if (piores5.length > 0) {
                piores5Html = `
                    <div style="display: grid; grid-template-columns: 1.5fr 2fr 1fr 1fr; gap: 10px; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 8px; color: var(--m3-on-surface-variant); font-weight: 700; text-align: left;">
                        <div>OLT / Porta</div>
                        <div>Serial</div>
                        <div>Código</div>
                        <div style="text-align: right;">Sinal</div>
                    </div>
                `;
                piores5.forEach(c => {
                    piores5Html += `
                        <div style="display: grid; grid-template-columns: 1.5fr 2fr 1fr 1fr; gap: 10px; font-size: 0.85rem; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03); padding: 6px 0; text-align: left;">
                            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><strong style="color: var(--m3-on-surface);">${c.olt}</strong> <span style="opacity: 0.7;">(${c.porta})</span></div>
                            <div style="font-family: var(--font-family-mono); opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.serial}</div>
                            <div style="opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.codigo}</div>
                            <div style="text-align: right; color: #f87171; font-weight: bold; font-family: var(--font-family-mono);">${c.potencia}</div>
                        </div>
                    `;
                });
            } else {
                piores5Html = `<div style="text-align: center; color: var(--m3-color-success); font-weight: bold; margin-top: 20px;"><span class="material-symbols-rounded" style="vertical-align: middle;">verified</span> Nenhum sinal crítico na rede!</div>`;
            }

            oltStats.sort((a, b) => b.criticos - a.criticos);
            const pioresOlts = oltStats.filter(o => o.criticos > 0).slice(0, 3);
            
            let rankingHtml = '';
            if (pioresOlts.length > 0) {
                pioresOlts.forEach((olt, idx) => {
                    const offlinePct = olt.total > 0 ? (olt.criticos / olt.total) * 100 : 0;
                    rankingHtml += `
                        <div style="margin-bottom: 18px; width: 100%;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; align-items: baseline;">
                                <strong style="color: var(--m3-on-surface); font-size: 1.2rem;">${idx + 1}º ${olt.id}</strong>
                                <span class="stat-number" style="font-size: 1.3rem; color: #f87171; width: auto;">${olt.criticos} OFF</span>
                            </div>
                            <div style="height: 12px; background: var(--m3-surface-container-high); border-radius: 6px; overflow: hidden; width: 100%;">
                                <div style="height: 100%; width: ${offlinePct}%; background: #f87171; border-radius: 6px;"></div>
                            </div>
                        </div>
                    `;
                });
            } else {
                rankingHtml = `<span style="color: var(--m3-color-success); font-weight: bold;"><span class="material-symbols-rounded" style="vertical-align: middle;">check_circle</span> Rede 100% no padrão!</span>`;
            }

            globalBody.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: stretch; width: 100%; flex-wrap: wrap; gap: 20px; height: 100%;">
                    
                    <div class="card-stats" style="flex: 1; min-width: 200px; display: flex; flex-direction: column; justify-content: center;">
                        <div class="stat-item global-stat" style="display: flex; flex-direction: column; align-items: flex-start; padding: 0;">
                            <div style="display: flex; align-items: center; justify-content: flex-start; margin-bottom: 5px; gap: 8px;">
                                <span class="material-symbols-rounded" style="font-size: 24px; color: var(--m3-on-surface-variant); opacity: 0.9;">cable</span>
                                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Clientes Lidos</span>
                            </div>
                            <h2 class="stat-number" style="margin: 0; color: var(--m3-on-surface); line-height: 1; font-size: 2.2rem;">${globalAnalisados}</h2>
                        </div>
                        <div class="stat-item offline global-stat" style="display: flex; flex-direction: column; align-items: flex-start; margin-top: 25px; padding: 0;">
                            <div style="display: flex; align-items: center; justify-content: flex-start; margin-bottom: 5px; gap: 8px;">
                                <span class="material-symbols-rounded" style="font-size: 24px; color: #f87171; opacity: 0.9;">sensors_off</span>
                                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Sinal Crítico</span>
                            </div>
                            <h2 class="stat-number" style="margin: 0; color: #f87171; line-height: 1; font-size: 2.2rem;">${globalCriticos}</h2>
                        </div>
                    </div>
                    
                    <div style="flex: 1.8; border-left: 1px solid var(--m3-outline); padding-left: 30px; min-width: 380px; display: flex; flex-direction: column; justify-content: center;">
                        <h4 style="margin-top: 0; color: var(--m3-on-surface-variant); margin-bottom: 15px; display: flex; align-items: center; gap: 6px;">
                            <span class="material-symbols-rounded" style="font-size: 20px; color: #f87171;">warning</span> Top 5 Piores Sinais da Rede
                        </h4>
                        <div style="width: 100%;">
                            ${piores5Html}
                        </div>
                    </div>
                    
                    <div style="flex: 1; border-left: 1px solid var(--m3-outline); padding-left: 30px; min-width: 250px; display: flex; flex-direction: column; justify-content: center;">
                        <h4 style="margin-top: 0; color: var(--m3-on-surface-variant); margin-bottom: 15px;">Equipamentos em Alerta</h4>
                        <div style="width: 100%;">
                            ${rankingHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        if (isPotenciaPage && gridEl) {
            gridEl.innerHTML = '';
            oltStats.forEach(olt => {
                const percOlt = olt.total > 0 ? ((olt.criticos / olt.total) * 100).toFixed(1) : 0;
                let statusColor = olt.criticos > 0 ? '#f87171' : 'var(--m3-color-success)';

                gridEl.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column;">
                        <div class="card-header">
                            <h3><span class="material-symbols-rounded">dns</span> ${olt.id}</h3>
                            <button class="card-header-button" onclick="window.abrirModalPotencia('${olt.id}')" title="Ver Detalhes">
                                <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                            </button>
                        </div>
                        <div class="card-body" style="padding: 20px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <span style="font-size: 2.2rem; font-weight: 800; color: ${statusColor};">${olt.criticos}</span><br>
                                <span style="color: var(--m3-on-surface-variant); font-size: 0.8rem; text-transform: uppercase;">Atenção Necessária</span>
                            </div>
                            <div style="text-align: right;">
                                <span style="font-size: 1.2rem; font-weight: bold; color: var(--m3-on-surface);">${percOlt}%</span><br>
                                <span style="color: var(--m3-on-surface-variant); font-size: 0.8rem;">do equipamento</span>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        if (typeof updateGlobalTimestamp === 'function') updateGlobalTimestamp();

    } catch (e) {
        console.error("Erro no Motor de Potência:", e);
        if (globalBody) {
            globalBody.innerHTML = `<p style="color: #f87171;">❌ Falha ao processar os dados da rede. Verifique a conexão.</p>`;
        }
    }
}

window.abrirModalPotencia = function(oltId) {
    const modal = document.getElementById('potencia-modal');
    if (!modal) return; 

    const tbody = document.getElementById('potencia-tbody');
    const title = document.getElementById('modal-potencia-title');
    const searchInput = document.getElementById('potencia-search');
    
    if (searchInput) searchInput.value = '';
    
    if (title) title.innerHTML = `<span class="material-symbols-rounded">dns</span> ${oltId}`;
    
    let datePart = '--/--/----';
    let timePart = '--:--:--';
    let cellData = window.POTENCIA_LAST_UPDATES[oltId] ? String(window.POTENCIA_LAST_UPDATES[oltId]) : '';

    if (cellData && cellData !== '--/-- --:--') {
        const dateMatch = cellData.match(/\d{2}\/\d{2}\/\d{2,4}/);
        const timeMatch = cellData.match(/\d{2}:\d{2}(:\d{2})?/);

        if (dateMatch) datePart = dateMatch[0];
        if (timeMatch) timePart = timeMatch[0];
    }

    const elDate = document.getElementById('potencia-update-date');
    const elTime = document.getElementById('potencia-update-time');
    if (elDate) elDate.textContent = datePart;
    if (elTime) elTime.textContent = timePart;
    
    const clientes = window.POTENCIA_CLIENTS_DATA[oltId] || [];

    if (clientes.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 30px; color: var(--m3-color-success); font-weight: bold;">Nenhum cliente fora do padrão nesta OLT. Parabéns!</td></tr>`;
    } else {
        let htmlBuffer = '';
        
        clientes.forEach(c => {
            let colorClass = c.potencia <= -30 ? 'sinal-critico' : 'sinal-atencao';
            htmlBuffer += `
                <tr class="linha-cliente-potencia">\r
                    <td style="font-weight: bold;">${c.porta}</td>
                    <td>${c.serial}</td>
                    <td><span class="${colorClass}">${c.potencia} dBm</span></td>
                    <td>${c.codigo}</td>
                </tr>
            `;
        });
        
        if (tbody) tbody.innerHTML = htmlBuffer;
    }

    modal.style.display = 'flex';
};

window.fecharModalPotencia = function(event) {
    if (event && event.target.id !== 'potencia-modal' && !event.target.classList.contains('close-modal')) return;
    document.getElementById('potencia-modal').style.display = 'none';
};

window.filtrarTabelaPotencia = function() {
    const termo = document.getElementById('potencia-search').value.toLowerCase();
    const linhas = document.querySelectorAll('.linha-cliente-potencia');
    
    linhas.forEach(linha => {
        const texto = linha.textContent.toLowerCase();
        linha.style.display = texto.includes(termo) ? '' : 'none';
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const isPotenciaPage = window.location.pathname.includes('potencia.html');
    
    if (isPotenciaPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Análise de Potência", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        setTimeout(updateGlobalTimestamp, 500);
    }
    
    if (isPotenciaPage || checkIsHomePage()) {
        runPotenciaEngine();
        setInterval(runPotenciaEngine, GLOBAL_REFRESH_SECONDS * 1000);
    }
});