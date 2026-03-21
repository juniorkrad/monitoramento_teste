// ==============================================================================
// potencia-engine.js - Motor Dedicado para Análise de Potência Óptica
// Atualização: Itens super compactados para a nova grade Justa da Home
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

        const ranges = GLOBAL_MASTER_OLT_LIST.map(o => o.type === 'nokia' ? `${o.sheetTab}!A:L` : `${o.sheetTab}!A:H`);
        const dataBatch = await API.getBatch(ranges);

        if (!dataBatch.valueRanges) throw new Error("Falha na estrutura de retorno da API de Potência");

        GLOBAL_MASTER_OLT_LIST.forEach((olt, index) => {
            const rows = dataBatch.valueRanges[index].values ? dataBatch.valueRanges[index].values.slice(1) : [];
            
            let analisados = 0;
            let criticos = 0;
            let dbmSums = 0;
            let lastUpdateStr = '--/-- --:--';

            window.POTENCIA_CLIENTS_DATA[olt.id] = [];

            if (dataBatch.valueRanges[index].values && dataBatch.valueRanges[index].values.length > 0) {
                const firstRow = dataBatch.valueRanges[index].values[0];
                let cellData = firstRow[10] ? String(firstRow[10]) : '';
                if (!cellData) {
                    for (let i = firstRow.length - 1; i >= 0; i--) {
                        let val = firstRow[i] ? String(firstRow[i]) : '';
                        if (val.match(/\d{2}\/\d{2}/) && val.match(/\d{2}:\d{2}/)) {
                            cellData = val; break;
                        }
                    }
                }
                if (cellData) {
                    const dateMatch = cellData.match(/\d{2}\/\d{2}\/\d{2,4}/);
                    const timeMatch = cellData.match(/\d{2}:\d{2}(:\d{2})?/);
                    if (dateMatch && timeMatch) lastUpdateStr = `${dateMatch[0]} ${timeMatch[0]}`;
                }
            }

            window.POTENCIA_LAST_UPDATES[olt.id] = lastUpdateStr;

            rows.forEach(columns => {
                if (columns.length === 0) return;

                let isOnline = false, pwrStr = '', porta = '', serial = '', codigo = '';

                if (olt.type === 'nokia') {
                    isOnline = (columns[4] || '').trim().toLowerCase().includes('up');
                    if (!isOnline) return;
                    pwrStr = columns[11];
                    porta = columns[0] || '';
                    serial = columns[2] || '';
                    codigo = columns[8] || ''; 
                } else {
                    isOnline = (columns[2] || '').trim().toLowerCase() === 'active';
                    if (!isOnline) return;
                    pwrStr = columns[5];
                    porta = columns[0] || '';
                    serial = columns[3] || '';
                    codigo = columns[7] || ''; 
                }

                const powerVal = parsePowerValue(pwrStr);
                
                if (powerVal !== null && powerVal !== 0 && powerVal < 0 && powerVal > -60.00) {
                    analisados++;
                    dbmSums += powerVal;
                    let pLevel = 'normal';
                    
                    if (powerVal <= -28.00) { 
                        criticos++; 
                        pLevel = 'critico'; 
                        const cData = { olt: olt.id, porta, serial, codigo, potencia: powerVal };
                        window.POTENCIA_CLIENTS_DATA[olt.id].push(cData);
                        todosClientesCriticos.push(cData);
                    } 
                    else if (powerVal <= -26.00) pLevel = 'atencao';
                }
            });

            const media = analisados > 0 ? (dbmSums / analisados).toFixed(2) : 0;
            const health = analisados > 0 ? (((analisados - criticos) / analisados) * 100) : 0;

            oltStats.push({
                id: olt.id,
                analisados,
                criticos,
                media,
                health,
                lastUpdate: lastUpdateStr
            });

            globalCriticos += criticos;
            globalAnalisados += analisados;
        });

        if (globalBody) {
            todosClientesCriticos.sort((a, b) => a.potencia - b.potencia);
            const top5Piores = todosClientesCriticos.slice(0, 5);

            let rankingPioresHtml = '';
            top5Piores.forEach((c, index) => {
                // Padding e margens cortadas para o limite
                rankingPioresHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); width: 100%;">
                       <div style="display: flex; flex-direction: column; gap: 2px; align-items: flex-start; text-align: left;">
                           <strong style="color: var(--m3-on-surface); font-size: 1rem;">
                               <span style="color: var(--m3-on-surface-variant); margin-right: 5px;">${index + 1}º</span> 
                               ${c.olt} <span style="color:var(--m3-outline); font-weight: normal; margin: 0 3px;">|</span> ${c.porta}
                           </strong>
                           <span style="color: var(--m3-on-surface-variant); font-family: var(--font-family-mono); font-size: 0.75rem;">SN: ${c.serial} <span style="color:var(--m3-outline); font-weight: normal; margin: 0 3px;">|</span> Cód: ${c.codigo}</span>
                       </div>
                       <span style="font-family: var(--font-family-mono); font-weight: bold; color: #f87171; font-size: 1.1rem;">${c.potencia} dBm</span>
                    </div>
                `;
            });

            if (rankingPioresHtml === '') {
                rankingPioresHtml = `<div style="text-align: center; color: var(--m3-color-success); font-weight: 700; margin-top: 15px; width: 100%;"><span class="material-symbols-rounded" style="font-size: 48px;">sentiment_very_satisfied</span><br>Rede 100% Saudável!</div>`;
            }

            globalBody.innerHTML = `
                <div style="width: 100%; display: flex; flex-direction: column; justify-content: stretch; height: 100%;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span class="material-symbols-rounded" style="color: #f87171; font-size: 20px;">warning</span>
                        <h3 style="margin: 0; font-size: 1rem; color: var(--m3-on-surface);">Top 5 Piores Sinais</h3>
                    </div>
                    <div style="flex: 1; width: 100%; display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start;">
                        ${rankingPioresHtml}
                    </div>
                </div>
            `;
        }

        if (isPotenciaPage && gridEl) {
            gridEl.innerHTML = '';
            
            todosClientesCriticos.sort((a, b) => a.potencia - b.potencia);
            const pioresRede = todosClientesCriticos.slice(0, 10);
            
            let htmlPiores = '';
            pioresRede.forEach((c, idx) => {
                htmlPiores += `
                    <tr>
                        <td style="font-family: var(--font-family-mono); font-size: 0.8rem;">${idx + 1}º</td>
                        <td style="font-weight: bold;">${c.olt}</td>
                        <td style="font-family: var(--font-family-mono);">${c.porta}</td>
                        <td style="color: #f87171; font-weight: bold; font-family: var(--font-family-mono);">${c.potencia} dBm</td>
                    </tr>
                `;
            });

            gridEl.innerHTML += `
                <div class="overview-card piores-card" style="grid-column: 1 / -1; display: flex; flex-direction: row; background: rgba(248, 113, 113, 0.05); border: 1px solid rgba(248, 113, 113, 0.2);">
                    <div style="flex: 0 0 250px; padding: 25px; border-right: 1px solid rgba(248, 113, 113, 0.2); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                        <span class="material-symbols-rounded" style="font-size: 54px; color: #f87171; margin-bottom: 15px;">warning</span>
                        <h3 style="color: #f87171; margin: 0 0 10px 0; font-size: 1.2rem;">TOP 10 PIORES</h3>
                        <p style="font-size: 0.85rem; color: var(--m3-on-surface-variant); margin: 0;">Sinais mais críticos detectados em toda a rede no momento.</p>
                    </div>
                    <div style="flex: 1; padding: 15px 25px; max-height: 250px; overflow-y: auto;" class="custom-scroll">
                        <table style="width: 100%; border-collapse: collapse; text-align: left;">
                            <thead>
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--m3-on-surface-variant); font-size: 0.8rem; text-transform: uppercase;">
                                    <th style="padding: 10px 5px;">Pos</th>
                                    <th style="padding: 10px 5px;">OLT</th>
                                    <th style="padding: 10px 5px;">Placa/Porta</th>
                                    <th style="padding: 10px 5px;">Sinal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${htmlPiores || '<tr><td colspan="4" style="padding: 15px; text-align: center;">Nenhum sinal crítico extremo detectado.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            oltStats.sort((a, b) => b.criticos - a.criticos);
            
            oltStats.forEach(o => {
                const btnHtml = `
                    <button class="card-header-button" onclick="window.abrirModalPotencia('${o.id}')" title="Ver Clientes">
                        <span class="material-symbols-rounded" style="font-size: 22px;">list_alt</span>
                    </button>`;
                
                gridEl.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column;">
                        <div class="card-header" style="justify-content: space-between;">
                            <h3><span class="material-symbols-rounded">dns</span> ${o.id}</h3>
                            ${btnHtml}
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:var(--m3-on-surface); font-size: 18px;">search</span>
                                        <span style="font-size: 1.1rem; color:var(--m3-on-surface); font-weight: 500;">${o.analisados}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:#fbbf24; font-size: 18px;">warning</span>
                                        <span style="font-size: 1.1rem; color:#fbbf24; font-weight: bold;">${o.criticos}</span>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 2rem; font-family: var(--font-family-mono); font-weight: bold; color: ${o.health >= 90 ? 'var(--m3-color-success)' : 'var(--m3-color-error)'};">${o.health.toFixed(1)}%</span><br>
                                    <span style="font-size: 0.75rem; color: var(--m3-on-surface-variant); text-transform: uppercase;">Saúde</span>
                                </div>
                            </div>
                            <div style="border-top: 1px solid var(--m3-outline); padding-top: 12px; font-size: 0.85rem; color: var(--m3-on-surface-variant); display: flex; justify-content: space-between;">
                                <span>Média: <strong style="color: var(--m3-on-surface);">${o.media} dBm</strong></span>
                                <span style="font-size: 0.75rem;">${o.lastUpdate}</span>
                            </div>
                        </div>
                    </div>`;
            });
        }

    } catch (e) {
        console.error("Erro no motor de potência:", e);
    }
}

window.abrirModalPotencia = function(oltId) {
    const modal = document.getElementById('potencia-modal');
    if (!modal) return;
    
    document.getElementById('potencia-modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${oltId} - Sinais Críticos`;
    
    const tbody = document.getElementById('potencia-detalhes-tbody');
    const clientes = window.POTENCIA_CLIENTS_DATA[oltId] || [];
    
    if (clientes.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 30px;">Nenhum cliente com sinal crítico (<= -28 dBm) encontrado.</td></tr>`;
    } else {
        clientes.sort((a, b) => a.potencia - b.potencia);
        
        let htmlBuffer = '';
        clientes.forEach(c => {
            const colorClass = c.potencia <= -30.00 ? 'status-problema' : 'status-atencao';
            htmlBuffer += `
                <tr class="linha-cliente-potencia">
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
        setTimeout(runPotenciaEngine, 1000);
        setInterval(runPotenciaEngine, GLOBAL_REFRESH_SECONDS * 1000);
    }
});