// ==============================================================================
// potencia-engine.js - Motor Dedicado para Análise de Potência Óptica
// Atualização: Remoção da injeção do texto "Detalhes - Placa X"
// ==============================================================================

const TAB_CIRCUITOS_POTENCIA = 'CIRCUITO'; 

window.POTENCIA_CLIENTS_DATA = {};
window.POTENCIA_PORT_DATA = {}; 
window.currentPotenciaInterval = null; 

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
        const dataBatch = await API.getBatch(ranges);

        if (!dataBatch.valueRanges) throw new Error("Falha na estrutura de retorno da API de Potência");

        GLOBAL_MASTER_OLT_LIST.forEach((olt, index) => {
            const rows = dataBatch.valueRanges[index].values ? dataBatch.valueRanges[index].values.slice(1) : [];
            
            let analisados = 0;
            let criticos = 0;
            let dbmSums = 0;
            let lastUpdateStr = '--/--/---- --:--:--'; 

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
                    pwrStr = columns[5]; 
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
                
                if (powerVal !== null && powerVal !== 0 && powerVal < 0 && powerVal >= -60.00) {
                    analisados++;
                    dbmSums += powerVal;
                    
                    if (powerVal <= -28.00) { 
                        criticos++; 
                        todosClientesCriticos.push({ olt: olt.id, porta, serial, codigo, potencia: powerVal });
                    } 
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

        // ==============================================================================
        // INJEÇÃO DA HOME (Apenas Top 5 Piores Sinais)
        // ==============================================================================
        if (globalBody) {
            todosClientesCriticos.sort((a, b) => a.potencia - b.potencia);
            const top5Piores = todosClientesCriticos.slice(0, 5);

            let rankingPioresHtml = '';
            top5Piores.forEach((c, index) => {
                rankingPioresHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); width: 100%;">
                       <div style="display: flex; flex-direction: column; gap: 2px; align-items: flex-start; text-align: left;">
                           <strong style="color: var(--m3-on-surface); font-size: 1rem;">
                               <span style="color: var(--m3-on-surface-variant); margin-right: 5px;">${index + 1}º</span> 
                               ${c.olt} <span style="color:var(--m3-outline); font-weight: normal; margin: 0 3px;">|</span> ${c.porta}
                           </strong>
                           <span style="color: var(--m3-on-surface-variant); font-family: var(--font-family-mono); font-size: 0.75rem;">
                               SN: ${c.serial} 
                               <span class="mobile-break-separator" style="color:var(--m3-outline); font-weight: normal; margin: 0 3px;">|</span> 
                               <span class="mobile-break-line">Cód: ${c.codigo}</span>
                           </span>
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

        // ==============================================================================
        // INJEÇÃO DA PÁGINA POTÊNCIA
        // ==============================================================================
        if (isPotenciaPage && gridEl) {
            gridEl.innerHTML = '';
            
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const o = oltStats.find(stats => stats.id === oltDef.id);
                if(!o) return;

                const btnHtml = `
                    <button class="card-header-button" onclick="window.openPotenciaSuperModal('${o.id}', '${oltDef.sheetTab}', '${oltDef.type}', ${oltDef.boards})" title="Ver Placas e Portas">
                        <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                    </button>`;
                
                // Separação da data e hora para os ícones do rodapé
                const dateParts = o.lastUpdate ? o.lastUpdate.split(' ') : ['--/--/----', '--:--:--'];
                const dateVal = dateParts[0] || '--/--/----';
                const timeVal = dateParts[1] || '--:--:--';
                
                gridEl.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column; width: 100%;">
                        <div class="card-header" style="justify-content: space-between; width: 100%; box-sizing: border-box;">
                            <h3><span class="material-symbols-rounded">dns</span> ${o.id}</h3>
                            ${btnHtml}
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 16px 20px; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; width: 100%;">
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:var(--m3-on-surface); font-size: 18px;">search</span>
                                        <span style="font-size: 1.1rem; color:var(--m3-on-surface); font-weight: 500;">${o.analisados}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:#fbbf24; font-size: 18px;">warning</span>
                                        <span style="font-size: 1.1rem; color:#fbbf24; font-weight: bold;">${o.criticos}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:#60a5fa; font-size: 18px;">insights</span>
                                        <span style="font-size: 1.1rem; color:var(--m3-on-surface); font-weight: 500;">${o.media} dBm</span>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 2rem; font-family: var(--font-family-mono); font-weight: bold; color: ${o.health >= 90 ? 'var(--m3-color-success)' : 'var(--m3-color-error)'};">${o.health.toFixed(1)}%</span><br>
                                    <span style="font-size: 0.75rem; color: var(--m3-on-surface-variant); text-transform: uppercase;">Saúde</span>
                                </div>
                            </div>
                            <div style="border-top: 1px solid var(--m3-outline); padding-top: 12px; display: flex; justify-content: center; align-items: center; gap: 15px; width: 100%;">
                                <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: var(--m3-on-surface-variant); font-family: var(--font-family-mono);">
                                    <span class="material-symbols-rounded" style="font-size: 14px;">calendar_today</span> ${dateVal}
                                </div>
                                <span style="color: rgba(255,255,255,0.1);">|</span>
                                <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: var(--m3-on-surface-variant); font-family: var(--font-family-mono);">
                                    <span class="material-symbols-rounded" style="font-size: 14px;">schedule</span> ${timeVal}
                                </div>
                            </div>
                        </div>
                    </div>`;
            });
        }

    } catch (e) {
        console.error("Erro no motor de potência:", e);
    }
}

// ==============================================================================
// SISTEMA DE NAVEGAÇÃO DE MODAIS (PLACA -> PORTA -> CLIENTES)
// ==============================================================================

async function fetchCircuitosData() {
    const range = `${TAB_CIRCUITOS_POTENCIA}!A:AK`;
    try {
        const data = await API.get(range);
        return data.values || [];
    } catch (e) { return []; }
}

window.stopPotenciaMonitoring = function() {
    if (window.currentPotenciaInterval) {
        clearInterval(window.currentPotenciaInterval);
        window.currentPotenciaInterval = null;
    }
};

window.openPotenciaSuperModal = function(id, sheetTab, type, boards) {
    try {
        const modal = document.getElementById('super-modal');
        if (!modal) {
            console.error("[Potência] Modal principal não encontrado no HTML.");
            return;
        }
        
        document.getElementById('super-modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${id}`;
        document.getElementById('potencia-view-detalhes').style.display = 'none';
        document.getElementById('potencia-view-placas').style.display = 'block';
        
        document.getElementById('potencia-placas-list').innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 10px;">hourglass_top</span>
                <h2>Lendo potências da OLT...</h2>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        if (typeof window.startPotenciaMonitoring === 'function') {
            window.startPotenciaMonitoring({ id: sheetTab, type: type, boards: boards, oltName: id });
        } else {
            console.error("[Potência] A função startPotenciaMonitoring não está definida no escopo global.");
        }
    } catch (e) {
        console.error("[Potência] Erro fatal ao abrir o modal das OLTs:", e);
    }
}

window.startPotenciaMonitoring = function(config) {
    window.stopPotenciaMonitoring(); 

    if (!document.getElementById('detail-modal')) {
        const modalHTML = `
            <div id="detail-modal" class="modal-overlay" style="display: none;" onclick="closeModal(event)">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3 id="modal-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">Detalhes</h3>
                        <button class="close-modal" onclick="closeModal()" title="Fechar">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="view-clients">
                            <div class="filter-bar">
                                <input type="text" id="search-input" class="filter-input" placeholder="Buscar (Nome, Serial...)" onkeyup="filterClients()">
                                <select id="status-filter" class="filter-select" onchange="filterClients()">
                                    <option value="all">Todos os Sinais</option>
                                    <option value="critico">Crítico (<= -28 dBm)</option>
                                </select>
                            </div>
                            <div class="client-table-container">
                                <table id="table-clients">
                                    <thead id="clients-thead" class="table-header-row"></thead>
                                    <tbody id="clients-tbody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async function populateTables() {
        window.POTENCIA_PORT_DATA = {}; 
        window.POTENCIA_CLIENTS_DATA = {}; 
        const rangeOlt = `${config.id}!A:K`; 

        try {
            const [dataOlt, rowsCircuitos] = await Promise.all([API.get(rangeOlt), fetchCircuitosData()]);
            const rowsOlt = (dataOlt.values || []).slice(1);

            rowsOlt.forEach(columns => {
                if (columns.length === 0) return;
                let placa, porta, isOnline;
                let pos = '', serial = '', potencia = '', desc1 = '', desc2 = '';

                if (config.type === 'nokia') {
                    const pon = columns[0];
                    const status = columns[4]; 
                    if (!pon || !status) return;
                    const match = pon.match(/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
                    if (match) { placa = match[3]; porta = match[4]; }
                    isOnline = status.trim().toLowerCase().includes('up');

                    pos = columns[1] || '';
                    serial = columns[2] || '';
                    potencia = columns[5] || ''; 
                    desc1 = columns[7] || ''; 
                    desc2 = columns[8] || ''; 
                } else { 
                    const portStr = columns[0];
                    const status = columns[2]; 
                    if (!portStr || !status) return;
                    
                    if (config.type === 'furukawa-10') {
                        const parts = portStr.split('/');
                        if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                    } else {
                        const match = portStr.match(/GPON\s*(\d+)\/(\d+)/i);
                        if (match) { placa = match[1]; porta = match[2]; }
                    }
                    isOnline = status.trim().toLowerCase() === 'active';

                    pos = columns[1] || '';
                    potencia = columns[5] || ''; 
                    serial = columns[3] || ''; 
                    desc1 = columns[7] || ''; 
                }

                if (!placa || !porta || !isOnline) return;
                
                const powerVal = parsePowerValue(potencia);
                if (powerVal === null || powerVal >= 0 || powerVal < -60.00) return; 

                const placaNum = parseInt(placa);
                const portaNum = parseInt(porta);
                const portKey = `${placaNum}/${portaNum}`;
                
                if (!window.POTENCIA_PORT_DATA[placaNum]) {
                    window.POTENCIA_PORT_DATA[placaNum] = {};
                }

                if (!window.POTENCIA_PORT_DATA[placaNum][portaNum]) {
                    const infoExtra = getGlobalCircuitInfo(rowsCircuitos, config.oltName || config.id, placa, porta, config.type);
                    window.POTENCIA_PORT_DATA[placaNum][portaNum] = { validCount: 0, sumPower: 0, info: infoExtra };
                    window.POTENCIA_CLIENTS_DATA[portKey] = [];
                }

                window.POTENCIA_PORT_DATA[placaNum][portaNum].validCount++;
                window.POTENCIA_PORT_DATA[placaNum][portaNum].sumPower += powerVal;
                
                window.POTENCIA_CLIENTS_DATA[portKey].push({
                    pos, serial, potencia: powerVal, desc1, desc2
                });
            });

            const placasList = document.getElementById('potencia-placas-list');
            if (placasList) placasList.innerHTML = '';

            for (let i = 1; i <= config.boards; i++) {
                const placaNum = i;
                const ports = window.POTENCIA_PORT_DATA[placaNum] || {};
                
                let hasCritical = false;

                for (const pt in ports) {
                    const p = ports[pt];
                    const media = p.validCount > 0 ? (p.sumPower / p.validCount) : 0;
                    if (media <= -28.00) {
                        hasCritical = true;
                    }
                }

                let btnClass = 'placa-btn';
                let badgeHtml = '';
                if (hasCritical) {
                    btnClass += ' has-alarm';
                    badgeHtml = `<span class="alarm-count critico">Média Crítica</span>`;
                }

                if (placasList) {
                    placasList.innerHTML += `
                        <button class="${btnClass}" onclick="openPotenciaPlacaDetails('${placaNum}', '${config.type}')">
                            <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span>
                            Placa ${placaNum}
                            ${badgeHtml}
                        </button>
                    `;
                }
            }

            const detalhesView = document.getElementById('potencia-view-detalhes');
            if (detalhesView && detalhesView.style.display === 'block') {
                const subtitle = document.getElementById('potencia-placa-subtitle');
                if (subtitle) {
                    const match = subtitle.innerText.match(/Placa (\d+)/);
                    if (match) window.openPotenciaPlacaDetails(match[1], config.type);
                }
            }

        } catch (error) { 
            console.error('Erro na engine de potência (populateTables):', error); 
        }
    }

    const runUpdate = async () => { await populateTables(); };
    runUpdate(); 
    window.currentPotenciaInterval = setInterval(runUpdate, GLOBAL_REFRESH_SECONDS * 1000); 
}

window.openPotenciaPlacaDetails = function(placa, oltType) {
    document.getElementById('potencia-view-placas').style.display = 'none';
    document.getElementById('potencia-view-detalhes').style.display = 'block';
    
    // Removida a injeção do subtítulo
    
    const tbody = document.getElementById('potencia-detalhes-tbody');
    tbody.innerHTML = '';
    
    const ports = window.POTENCIA_PORT_DATA[placa] || {};
    const sortedPorts = Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (sortedPorts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--m3-on-surface-variant);">Nenhuma porta com leituras de potência nesta placa.</td></tr>`;
        return;
    }

    sortedPorts.forEach(pt => {
        const { validCount, sumPower, info } = ports[pt];
        const media = validCount > 0 ? (sumPower / validCount).toFixed(2) : 0;
        
        let mediaColor = 'var(--m3-on-surface)';
        if (media <= -28.00) mediaColor = '#f87171'; 
        else if (media <= -26.00) mediaColor = '#fbbf24'; 

        const safeInfo = info.replace(/'/g, "\\'");

        tbody.innerHTML += `
            <tr>
                <td>Porta ${String(pt).padStart(2, '0')}</td>
                <td>
                    <span class="circuit-badge circuit-clickable" 
                          onclick="window.openPotenciaCircuitClients('${placa}', '${pt}', '${safeInfo}', '${oltType}')"
                          title="Ver clientes deste circuito">
                        ${info}
                    </span>
                </td>
                <td>
                    <strong style="color: ${mediaColor};">${media} dBm</strong>
                </td>
            </tr>
        `;
    });
};

window.openPotenciaCircuitClients = function(placa, porta, circuitoNome, oltType) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    
    const modalContent = document.querySelector('#detail-modal .modal-content');
    modalContent.classList.add('modal-large');     

    const textoCircuito = (circuitoNome && circuitoNome !== "-") ? ` - Circuito: ${circuitoNome}` : "";
    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta}${textoCircuito}`;

    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = 'all'; 

    const thead = document.getElementById('clients-thead');
    const tbody = document.getElementById('clients-tbody');
    
    if (oltType === 'nokia') {
        thead.innerHTML = `<tr><th>Posição</th><th>Serial</th><th>Potência</th><th>Descrição 1</th><th>Descrição 2</th></tr>`;
    } else {
        thead.innerHTML = `<tr><th>Posição</th><th>Potência</th><th>Serial</th><th>Descrição</th></tr>`;
    }
    
    tbody.innerHTML = '';

    const portKey = `${placa}/${porta}`;
    const clients = window.POTENCIA_CLIENTS_DATA[portKey] || [];

    if (clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${oltType === 'nokia' ? 5 : 4}" style="text-align:center;">Nenhum cliente com leitura válida.</td></tr>`;
    } else {
        clients.sort((a, b) => a.potencia - b.potencia); 

        clients.forEach(c => {
            const isCritical = c.potencia <= -28.00;
            const rowClass = isCritical ? 'client-row filter-critico bg-alerta-sinal' : 'client-row filter-normal';
            const valColor = isCritical ? '#f87171' : 'inherit';
            
            let rowHTML = '';
            if (oltType === 'nokia') {
                rowHTML = `<tr class="${rowClass}"><td>${c.pos}</td><td>${c.serial}</td><td><strong style="color:${valColor};">${c.potencia} dBm</strong></td><td>${c.desc1}</td><td>${c.desc2}</td></tr>`;
            } else {
                rowHTML = `<tr class="${rowClass}"><td>${c.pos}</td><td><strong style="color:${valColor};">${c.potencia} dBm</strong></td><td>${c.serial}</td><td>${c.desc1}</td></tr>`;
            }
            tbody.innerHTML += rowHTML;
        });
    }
    modal.style.display = 'flex';
}

window.filterClients = function() {
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('status-filter').value;
    const rows = document.querySelectorAll('.client-row');
    
    rows.forEach(row => {
        const textContent = row.textContent.toLowerCase();
        let matchesSearch = textContent.includes(searchText);
        let matchesStatus = true;
        if (statusFilter === 'critico') matchesStatus = row.classList.contains('filter-critico');
        
        if (matchesSearch && matchesStatus) row.style.display = '';
        else row.style.display = 'none';
    });
}

window.closeSuperModal = function(event) {
    if (event && event.target.id !== 'super-modal' && !event.target.classList.contains('close-modal')) return;
    document.getElementById('super-modal').style.display = 'none';
    if (typeof window.stopPotenciaMonitoring === 'function') window.stopPotenciaMonitoring();
}

window.backToPotenciaPlacas = function() {
    document.getElementById('potencia-view-detalhes').style.display = 'none';
    document.getElementById('potencia-view-placas').style.display = 'block';
}

window.closeModal = function(event) {
    if (event && event.target.id !== 'detail-modal' && !event.target.classList.contains('close-modal')) return;
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
}

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