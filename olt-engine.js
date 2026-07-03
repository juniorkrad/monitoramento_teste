// ==============================================================================
// olt-engine.js - Motor Dedicado de Monitoramento de Rede (Individual e Global)
// Atualização: Wallboard da Home - Ajustes Finos de Ícones e Resumo
// ==============================================================================

window.OLT_CLIENTS_DATA = {};
window.CURRENT_OLT_PORT_DATA = {}; 
window.NETWORK_PROBLEMS_STORE = new Set();
window.NETWORK_BACKBONE_STORE = new Set();
window.CURRENT_VIEW_PLACA = null; 
window.CURRENT_MONITORING_CONFIG = null;

// ==============================================================================
// FUNÇÕES DO SISTEMA HÍBRIDO (TOOLTIP PC / MODAL MOBILE)
// ==============================================================================
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
}

window.handleNetHover = function(event) {
    if (isMobileDevice()) return;
    const tooltip = document.getElementById('smart-tooltip');
    if (!tooltip) return;

    const el = event.currentTarget;
    let statusTexto = 'Normal';
    let statusCor = 'var(--m3-color-success)';
    
    if (el.classList.contains('danger')) {
        statusTexto = 'Crítico';
        statusCor = 'var(--m3-color-error)';
    } else if (el.classList.contains('warning')) {
        statusTexto = 'Atenção';
        statusCor = 'var(--m3-color-warning)';
    }

    tooltip.innerHTML = `
        <div class="smart-tooltip-title">
            <span class="material-symbols-rounded" style="font-size: 18px; color: ${statusCor};">lan</span>
            ${el.dataset.olt}
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Status:</span> 
            <strong style="color: ${statusCor};">${statusTexto}</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Total Offline:</span> 
            <strong style="color: ${statusCor};">${el.dataset.off}</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Total Analisado:</span> 
            <strong>${el.dataset.total}</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Impacto na OLT:</span> 
            <strong>${el.dataset.pct}%</strong>
        </div>
    `;

    const rect = el.getBoundingClientRect();
    tooltip.style.left = (rect.left + (rect.width / 2) + window.scrollX) + 'px';
    tooltip.style.top = (rect.top + window.scrollY) + 'px';
    tooltip.style.opacity = 1;
};

window.handleNetLeave = function() {
    const tooltip = document.getElementById('smart-tooltip');
    if (tooltip) tooltip.style.opacity = 0;
};

window.handleNetClick = function(event) {
    if (!isMobileDevice()) return;
    const modal = document.getElementById('mobile-fast-modal');
    const content = document.getElementById('fast-modal-content');
    if (!modal || !content) return;

    const el = event.currentTarget;
    let statusCor = 'var(--m3-color-success)';
    if (el.classList.contains('danger')) statusCor = 'var(--m3-color-error)';
    else if (el.classList.contains('warning')) statusCor = 'var(--m3-color-warning)';

    content.innerHTML = `
        <h3 style="margin-top: 0; border-bottom: 1px solid var(--m3-outline); padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: ${statusCor};">lan</span> ${el.dataset.olt}
        </h3>
        <div style="margin-bottom: 15px; text-align: center;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Total Offline</span><br>
            <strong style="font-size: 2.5rem; font-family: var(--font-family-mono); color: ${statusCor}; line-height: 1;">${el.dataset.off}</strong>
        </div>
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between;">
            <div>
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Total Analisado</span><br>
                <strong style="font-size: 1.2rem;">${el.dataset.total}</strong>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Impacto na OLT</span><br>
                <strong style="font-size: 1.2rem; color: ${statusCor};">${el.dataset.pct}%</strong>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

// ==============================================================================

function fetchGlobalOltData(olt) {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) {
        return { id: olt.id, onlineCount: 0, offlineCount: 0, type: olt.type, portData: {}, lastUpdate: '--/--/---- --:--:--' };
    }

    try {
        const values = window.DATA_STORE.olts[olt.id] || [];
        const rows = values.slice(1);
        
        let totalOnline = 0, totalOffline = 0;
        const portData = {};
        let lastUpdateStr = '--/--/---- --:--:--';

        if (values.length > 0) {
            const firstRow = values[0];
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

        rows.forEach(columns => {
            if (columns.length === 0) return;
            
            const isOnline = DataMapper.isOnline(columns[olt.type === 'nokia' ? 4 : 2], olt.type);
            const portInfo = DataMapper.extractPort(columns[0], olt.type);

            if (isOnline) totalOnline++; else totalOffline++;
            
            if (portInfo) {
                const { placa, porta } = portInfo;
                const portKey = `${placa}/${porta}`; 
                // Guardamos também a placa e porta separadas para facilitar o lookup do circuito
                if (!portData[portKey]) portData[portKey] = { off: 0, total: 0, placa: placa, porta: porta };
                portData[portKey].total++;
                if (!isOnline) portData[portKey].off++;
            }
        });

        return { id: olt.id, onlineCount: totalOnline, offlineCount: totalOffline, type: olt.type, portData, lastUpdate: lastUpdateStr };
    } catch (error) {
        return { id: olt.id, onlineCount: 0, offlineCount: 0, type: olt.type, portData: {}, lastUpdate: '--/--/---- --:--:--' };
    }
}

function updateGlobalNetworkCard(globalOnline, globalOffline, latestUpdateStr) {
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));
    if (!isHomePage) return;

    const total = globalOnline + globalOffline;
    const elTotal = document.getElementById('net-total-geral');
    const elOnline = document.getElementById('net-total-online');
    const elOffline = document.getElementById('net-total-offline');
    const elDate = document.getElementById('net-date');
    const elTime = document.getElementById('net-time');
    
    if (elTotal) elTotal.textContent = total;
    if (elOnline) elOnline.textContent = globalOnline;
    if (elOffline) elOffline.textContent = globalOffline;

    if (latestUpdateStr) {
        const dateParts = latestUpdateStr.split(' ');
        if (elDate) elDate.textContent = dateParts[0] || '--/--/----';
        if (elTime) elTime.textContent = dateParts[1] || '--:--:--';
    }
}

function runGlobalNetworkOverview() {
    const results = GLOBAL_MASTER_OLT_LIST.map(olt => fetchGlobalOltData(olt));
    
    let globalOnline = 0, globalOffline = 0;
    let oltStatsList = [], currentBackbones = new Set();
    let allProblems = new Set();
    let latestUpdateStr = '--/--/---- --:--:--';

    // Necessário para resgatar os nomes dos circuitos na varredura global
    const rowsCircuitos = (window.DATA_STORE && window.DATA_STORE.circuitos) ? window.DATA_STORE.circuitos : [];

    results.forEach(result => {
        globalOnline += result.onlineCount; 
        globalOffline += result.offlineCount;
        
        if (result.lastUpdate && result.lastUpdate !== '--/--/---- --:--:--') {
            latestUpdateStr = result.lastUpdate;
        }

        let total = result.onlineCount + result.offlineCount;
        oltStatsList.push({ id: result.id, offline: result.offlineCount, total });

        let ports100Down = 0;
        let localProblems = []; 
        let superPorts = []; // Agrupa temporariamente as portas 100% caídas
        
        const pseudoConfig = { id: result.id, oltName: result.id, type: result.type };

        for (const key in result.portData) {
            const { off, total: pTotal, placa, porta } = result.portData[key];
            if (pTotal >= 5) {
                let severity = null;
                const percOffline = off / pTotal;

                if (percOffline === 1) { 
                    ports100Down++; 
                    superPorts.push({ key, placa, porta, off });
                } else if (percOffline >= 0.5 || off >= 32) { 
                    severity = 'CRIT'; 
                } else if (off >= 16) { 
                    severity = 'WARN'; 
                }

                // As portas super (100% down) são processadas separadamente agora
                if (severity) {
                    const circuitoNome = DataMapper.getCircuitInfo(rowsCircuitos, pseudoConfig, placa, porta);
                    localProblems.push({ porta: key, severity: severity, off: off, circuito: circuitoNome });
                }
            }
        }
        
        // ============================================================
        // NOVA REGRA DE ENCAMINHAMENTO (BACKBONE VS CIRCUITO)
        // ============================================================
        if (ports100Down >= 2) { 
            // Emite o Backbone clássico com assinatura nova incluindo total offline
            currentBackbones.add(`[${result.id}] BACKBONE::${result.offlineCount}`); 
        } else if (ports100Down === 1) {
            // Emite o gatilho exclusivo de Circuito para 1 única porta isolada
            const sp = superPorts[0];
            const circuitoNome = DataMapper.getCircuitInfo(rowsCircuitos, pseudoConfig, sp.placa, sp.porta);
            allProblems.add(`[${result.id}] STATUS::CIRCUITO::${circuitoNome}::${sp.key}::${sp.off}`);
        }

        // ============================================================
        // PROBLEMAS LOCAIS (CRIT, WARN, MULTI)
        // ============================================================
        if (localProblems.length >= 2) {
            // Empacota enviando a porta separada do circuito por "::" e cada pacote por ","
            const multiStr = localProblems.map(p => `${p.porta}::${p.circuito}`).join(',');
            allProblems.add(`[${result.id}] STATUS::MULTI::${multiStr}`);
        } 
        else if (localProblems.length === 1) {
            const p = localProblems[0];
            // Assinatura de Atenção/Problema agora inclui o nome do circuito
            allProblems.add(`[${result.id}] STATUS::${p.severity}_${p.porta}::${p.off}::${p.circuito}`);
        }
    });

    oltStatsList.sort((a, b) => b.offline - a.offline);
    updateGlobalNetworkCard(globalOnline, globalOffline, latestUpdateStr);

    // ==============================================================================
    // INJEÇÃO DOS MINICARDS E RESUMO WALLBOARD (HOME)
    // ==============================================================================
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));
    
    if (isHomePage) {
        const targetWidescreen = document.getElementById('target-rede-widescreen');
        if (targetWidescreen) {
            let globalTotal = globalOnline + globalOffline;

            let htmlWidescreen = `
                <div class="resumo-card">
                    <div>
                        <div class="resumo-title"><span class="material-symbols-rounded" style="font-size:16px;">router_off</span> Resumo Global</div>
                        <div class="resumo-main-val" style="color: var(--m3-color-error);">${globalOffline}</div>
                        <div style="font-size: 0.8rem; color: var(--m3-on-surface-variant);">Clientes Offline no momento</div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 8px;">
                        <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant);">Clientes Online:</span>
                        <strong style="color: var(--m3-color-success); font-size: 1rem;">${globalOnline}</strong>
                    </div>
                    <div class="resumo-sec-val">
                        <span>Total Analisado:</span>
                        <strong style="color: var(--m3-on-surface); font-size: 1rem;">${globalTotal}</strong>
                    </div>
                </div>
            `;
            
            oltStatsList.forEach(stat => {
                const perc = stat.total > 0 ? ((stat.offline / stat.total) * 100).toFixed(1) : 0;
                let statusClass = 'ok';
                let contentHtml = `<span class="material-symbols-rounded" style="pointer-events: none;">check_circle</span>`;
                
                if (stat.offline > 0) {
                    statusClass = stat.offline >= 15 ? 'danger' : 'warning';
                    contentHtml = `
                        <div style="display: flex; align-items: center; gap: 4px; pointer-events: none;">
                            <span class="material-symbols-rounded" style="font-size: 16px; color: ${statusClass === 'danger' ? 'var(--m3-color-error)' : 'var(--m3-color-warning)'};">wifi_off</span>
                            <span class="olt-value">${stat.offline}</span>
                        </div>
                    `;
                }

                htmlWidescreen += `
                    <div class="status-card ${statusClass}"
                         data-olt="${stat.id}"
                         data-off="${stat.offline}"
                         data-total="${stat.total}"
                         data-pct="${perc}"
                         onmouseenter="handleNetHover(event)"
                         onmouseleave="handleNetLeave()"
                         onclick="handleNetClick(event)">
                        <div style="display: flex; align-items: center; gap: 4px; pointer-events: none;">
                            <span class="material-symbols-rounded" style="font-size: 14px; color: var(--m3-on-surface-variant);">dns</span>
                            <span class="olt-name">${stat.id}</span>
                        </div>
                        ${contentHtml}
                    </div>
                `;
            });
            
            targetWidescreen.innerHTML = htmlWidescreen;
        }
    }

    window.NETWORK_PROBLEMS_STORE = allProblems;
    window.NETWORK_BACKBONE_STORE = currentBackbones;
}

window.stopOltMonitoring = function() {
    window.CURRENT_MONITORING_CONFIG = null;
};

window.startOltMonitoring = function(config) {
    window.stopOltMonitoring(); 
    window.CURRENT_MONITORING_CONFIG = config;
    
    if (!document.getElementById('detail-modal')) {
        const modalHTML = `
            <div id="detail-modal" class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3 id="modal-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">Detalhes</h3>
                        <div style="display: flex; gap: 15px; align-items: center;">
                            <button id="btn-export-detail-png" onclick="exportDetailModalToImage(event)" title="Exportar para PNG" style="background: transparent; border: none; color: var(--m3-on-surface-variant); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: color 0.2s;">
                                <span class="material-symbols-rounded" style="font-size: 26px;">photo_camera</span>
                            </button>
                            <button class="close-modal" onclick="closeModal()" title="Fechar">&times;</button>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div id="view-stats" class="modal-stats-grid">
                            <div class="modal-stat-box">
                                <span id="modal-up" class="modal-stat-value val-online">0</span>
                                <span class="modal-stat-label">${config.type === 'nokia' ? 'UP' : 'ACTIVE'}</span>
                            </div>
                            <div class="modal-stat-box">
                                <span id="modal-down" class="modal-stat-value val-offline">0</span>
                                <span class="modal-stat-label">${config.type === 'nokia' ? 'DOWN' : 'INACTIVE'}</span>
                            </div>
                            <div class="modal-stat-box">
                                <span id="modal-total" class="modal-stat-value val-total">0</span>
                                <span class="modal-stat-label">TOTAL</span>
                            </div>
                        </div>

                        <div id="view-clients" style="display:none;">
                            <div class="filter-bar">
                                <input type="text" id="search-input" class="filter-input" placeholder="Buscar por Serial ou Código..." onkeyup="filterClients()">
                                <select id="status-filter" class="filter-select" onchange="filterClients()"></select>
                            </div>
                            <div class="table-container">
                                <table id="table-clients" class="noc-table">
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

    function populateTables() {
        if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

        window.CURRENT_OLT_PORT_DATA = {}; 
        window.OLT_CLIENTS_DATA = {}; 

        try {
            const rowsCircuitos = window.DATA_STORE.circuitos || [];
            const rowsLocalidades = window.DATA_STORE.localidades || [];
            
            const dataOlt = window.DATA_STORE.olts[config.oltName || config.id] || [];

            window.GLOBAL_BAIRROS_DATA = rowsLocalidades;

            const rowsOlt = dataOlt.slice(1);

            rowsOlt.forEach(columns => {
                if (columns.length === 0) return;
                
                const isOnline = DataMapper.isOnline(columns[config.type === 'nokia' ? 4 : 2], config.type);
                const portInfo = DataMapper.extractPort(columns[0], config.type);
                
                if (!portInfo) return;
                
                const { placa, porta } = portInfo;
                const placaNum = parseInt(placa);
                const portaNum = parseInt(porta);
                const portKey = `${placaNum}/${portaNum}`;
                
                if (!window.CURRENT_OLT_PORT_DATA[placaNum]) {
                    window.CURRENT_OLT_PORT_DATA[placaNum] = {};
                }

                if (!window.CURRENT_OLT_PORT_DATA[placaNum][portaNum]) {
                    const infoExtra = DataMapper.getCircuitInfo(rowsCircuitos, config, placa, porta);
                    const bairroExtra = DataMapper.getBairroInfo(rowsLocalidades, config.oltName || config.id, placa, porta, config.type);
                    
                    window.CURRENT_OLT_PORT_DATA[placaNum][portaNum] = { online: 0, offline: 0, info: infoExtra, bairro: bairroExtra };
                    window.OLT_CLIENTS_DATA[portKey] = [];
                }

                if (isOnline) window.CURRENT_OLT_PORT_DATA[placaNum][portaNum].online++;
                else window.CURRENT_OLT_PORT_DATA[placaNum][portaNum].offline++;
                
                let serialVal = '';
                let codigoVal = '';
                let statusRefVal = '';
                
                // Mapeamento exclusivo: Nokia e Furukawa
                if (config.type === 'nokia') {
                    // Coluna C (índice 2) = Serial, Coluna I (índice 8) = Código, Coluna E (índice 4) = Status
                    serialVal = columns[2] || '';
                    codigoVal = columns[8] || '';
                    statusRefVal = columns[4] || '';
                } else {
                    // Furukawa: Coluna D (índice 3) = Serial, Coluna H (índice 7) = Código, Coluna C (índice 2) = Status
                    serialVal = columns[3] || '';
                    codigoVal = columns[7] || '';
                    statusRefVal = columns[2] || '';
                }
                
                let clientData = { 
                    serial: String(serialVal).trim(), 
                    codigo: String(codigoVal).trim(), 
                    statusRef: String(statusRefVal).trim(),
                    oltName: config.oltName || config.id,
                    placa: placaNum,
                    porta: portaNum,
                    circuito: window.CURRENT_OLT_PORT_DATA[placaNum][portaNum].info
                };
                
                window.OLT_CLIENTS_DATA[portKey].push(clientData);
            });

            const placasList = document.getElementById('olt-placas-list');
            if (placasList) placasList.innerHTML = '';

            for (let i = 1; i <= config.boards; i++) {
                const placaNum = i;
                const ports = window.CURRENT_OLT_PORT_DATA[placaNum] || {};
                
                let hasCritical = false;
                let hasWarning = false;
                let alarmCount = 0;

                for (const pt in ports) {
                    const p = ports[pt];
                    const total = p.online + p.offline;
                    const percOffline = total > 0 ? (p.offline / total) : 0;
                    
                    if (total >= 5) {
                        if (percOffline === 1 || percOffline >= 0.5 || p.offline >= 32) {
                            hasCritical = true;
                            alarmCount++;
                        } else if (p.offline >= 16) {
                            hasWarning = true;
                        }
                    }
                }

                let btnClass = 'placa-btn';
                let badgeHtml = '';
                if (hasCritical) {
                    btnClass += ' has-alarm';
                    badgeHtml = `<span class="alarm-count critico">${alarmCount} crítico(s)</span>`;
                } else if (hasWarning) {
                    btnClass += ' has-warning';
                    badgeHtml = `<span class="alarm-count atencao">Atenção</span>`;
                }

                if (placasList) {
                    placasList.innerHTML += `
                        <button class="${btnClass}" onclick="openOltPlacaDetails('${placaNum}', '${config.type}')">
                            <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span>
                            Placa ${placaNum}
                            ${badgeHtml}
                        </button>
                    `;
                }
            }

            const detalhesView = document.getElementById('olt-view-detalhes');
            if (detalhesView && detalhesView.style.display === 'block') {
                if (window.CURRENT_VIEW_PLACA) window.openOltPlacaDetails(window.CURRENT_VIEW_PLACA, config.type);
            }

        } catch (error) { 
            console.error('Erro na engine (populateTables):', error); 
        }
    }

    window.updateOltModal = populateTables; 
    populateTables(); 
}

window.openOltPlacaDetails = function(placa, oltType) {
    window.CURRENT_VIEW_PLACA = placa; 
    
    document.getElementById('olt-view-placas').style.display = 'none';
    document.getElementById('olt-view-detalhes').style.display = 'block';

    const modalTitle = document.getElementById('super-modal-title');
    if (modalTitle && window.CURRENT_MONITORING_CONFIG) {
        modalTitle.innerHTML = `<span class="material-symbols-rounded">dns</span> ${window.CURRENT_MONITORING_CONFIG.oltName}`;
    }

    const btnBoletim = document.getElementById('btn-gerar-boletim');
    const btnComunicado = document.getElementById('btn-gerar-comunicado');
    
    if (btnBoletim) btnBoletim.style.display = 'none';
    if (btnComunicado) btnComunicado.style.display = 'none';
    
    const tbody = document.getElementById('olt-detalhes-tbody');
    tbody.innerHTML = '';
    
    const ports = window.CURRENT_OLT_PORT_DATA[placa] || {};
    const sortedPorts = Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (sortedPorts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--m3-on-surface-variant);">Nenhuma porta ativa com clientes encontrada nesta placa.</td></tr>`;
        return;
    }

    sortedPorts.forEach(pt => {
        const { online, offline, info, bairro } = ports[pt];
        const total = online + offline;
        
        let statusClass = 'status-normal';
        let statusText = 'Normal';
        const percOffline = total > 0 ? (offline / total) : 0;

        if (total >= 5) {
            if (percOffline === 1) { statusClass = 'status-critico'; statusText = 'Crítico'; }
            else if (percOffline >= 0.5 || offline >= 32) { statusClass = 'status-problema'; statusText = 'Problema'; }
            else if (offline >= 16) { statusClass = 'status-atencao'; statusText = 'Atenção'; }
        }

        const safeInfo = info.replace(/'/g, "\\'");
        const textoBairro = bairro && bairro !== '-' ? bairro : 'N/A';

        tbody.innerHTML += `
            <tr>
                <td>Porta ${String(pt).padStart(2, '0')}</td>
                <td>
                    <span class="circuit-badge circuit-clickable" 
                          onclick="openCircuitClients('${placa}', '${pt}', '${safeInfo}', '${oltType}')"
                          title="Ver clientes deste circuito">
                        ${info}
                    </span>
                </td>
                <td style="font-family: var(--font-family-mono); font-size: 0.9rem; color: var(--m3-on-surface-variant);">
                    ${textoBairro}
                </td>
                <td>
                    <button class="status ${statusClass} status-btn" style="cursor: pointer;"
                        onclick="openPortDetails('${placa}', '${pt}', '${safeInfo}', ${online}, ${offline}, ${total})">
                        ${statusText}
                    </button>
                </td>
            </tr>
        `;
    });
};

window.backToOltPlacas = function() {
    document.getElementById('olt-view-detalhes').style.display = 'none';
    document.getElementById('olt-view-placas').style.display = 'block';
    
    window.CURRENT_VIEW_PLACA = null;

    const modalTitle = document.getElementById('super-modal-title');
    if (modalTitle && window.CURRENT_MONITORING_CONFIG) {
        modalTitle.innerHTML = `<span class="material-symbols-rounded">dns</span> ${window.CURRENT_MONITORING_CONFIG.oltName}`;
    }

    const btnBoletim = document.getElementById('btn-gerar-boletim');
    const btnComunicado = document.getElementById('btn-gerar-comunicado');
    
    if (btnBoletim) btnBoletim.style.display = 'inline-block';
    if (btnComunicado) btnComunicado.style.display = 'inline-block';
};

window.exportPlacaToTXT = function() {
    const titleEl = document.getElementById('super-modal-title');
    let oltName = 'OLT_Desconhecida';
    if (titleEl) {
        oltName = titleEl.innerText.replace('dns', '').split('-')[0].trim();
    }
    const placa = window.CURRENT_VIEW_PLACA || '?';
    
    let txtContent = `=================================================\n`;
    txtContent += `   RELATÓRIO DE STATUS - ${oltName} (PLACA ${placa})\n`;
    txtContent += `   Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
    txtContent += `=================================================\n\n`;
    
    const tbody = document.getElementById('olt-detalhes-tbody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0 || rows[0].innerText.includes('Nenhuma porta')) {
        alert('Nenhum dado disponível para exportação.');
        return;
    }
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 4) { 
            const porta = cols[0].innerText.trim();
            const circuito = cols[1].innerText.trim();
            const localidade = cols[2].innerText.trim();
            const status = cols[3].innerText.trim();
            
            txtContent += `• ${porta.padEnd(10, ' ')} | Circuito: ${circuito.padEnd(10, ' ')} | Bairro: ${localidade.padEnd(45, ' ')} | Status: ${status}\n`;
        }
    });
    
    txtContent += `\n=================================================\n`;
    
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Status_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_Placa_${placa}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.exportDetailModalToImage = function(event) {
    if (event) event.stopPropagation();

    const modalContent = document.querySelector('#detail-modal .modal-content');
    if (!modalContent) return;

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
    }

    const titleEl = document.getElementById('modal-title');
    let titleName = 'Detalhes';
    if (titleEl) {
        titleName = titleEl.textContent.replace(/[^a-zA-Z0-9-]/g, '_');
    }

    const clone = modalContent.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    
    if (!modalContent.classList.contains('modal-large')) {
        clone.style.width = '500px'; 
    } else {
        clone.style.width = modalContent.offsetWidth + 'px';
    }
    
    document.body.appendChild(clone);

    const viewStats = clone.querySelector('#view-stats');
    const viewClients = clone.querySelector('#view-clients');
    if (viewStats && modalContent.querySelector('#view-stats').style.display !== 'none') viewStats.style.display = 'flex';
    if (viewClients && modalContent.querySelector('#view-clients').style.display !== 'none') viewClients.style.display = 'block';

    html2canvas(clone, {
        backgroundColor: null, 
        scale: 2, 
        useCORS: true,
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Status_${titleName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        document.body.removeChild(clone);
        if (btn) btn.innerHTML = originalContent;
    }).catch(error => {
        console.error('Erro ao gerar imagem:', error);
        alert('Ocorreu um erro ao exportar a imagem.');
        if (clone.parentNode) document.body.removeChild(clone);
        if (btn) btn.innerHTML = originalContent;
    });
};

window.closeModal = function(event) {
    if (event && event.target.id !== 'detail-modal' && !event.target.classList.contains('close-modal')) return;
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
};

window.openPortDetails = function(placa, porta, circuito, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('#detail-modal .modal-content');
    modalContent.classList.remove('modal-large'); 

    const btnPng = document.getElementById('btn-export-detail-png');
    if (btnPng) btnPng.style.display = 'inline-block';

    const textoCircuito = (circuito && circuito !== "-") ? ` - Circuito: ${circuito}` : "";
    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta}${textoCircuito}`;
    document.getElementById('view-stats').style.display = 'flex';
    document.getElementById('view-clients').style.display = 'none';
    document.getElementById('modal-up').textContent = online;
    document.getElementById('modal-down').textContent = offline;
    document.getElementById('modal-total').textContent = total;
    modal.style.display = 'flex';
};

window.openCircuitClients = function(placa, porta, circuitoNome, oltType) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('#detail-modal .modal-content');
    modalContent.classList.add('modal-large');     

    const btnPng = document.getElementById('btn-export-detail-png');
    if (btnPng) btnPng.style.display = 'none';

    // Alterado o título para a nova área de pesquisa
    document.getElementById('modal-title').innerHTML = `<span class="material-symbols-rounded" style="margin-right: 8px;">manage_search</span> Pesquisa de Clientes e Equipamentos`;

    document.getElementById('view-stats').style.display = 'none';
    document.getElementById('view-clients').style.display = 'block';
    document.getElementById('search-input').value = '';

    const statusSelect = document.getElementById('status-filter');
    statusSelect.innerHTML = '<option value="all">Todos Status</option>';
    if (oltType === 'nokia') {
        statusSelect.innerHTML += `<option value="online">Online (UP)</option><option value="offline">Offline (DOWN)</option>`;
    } else {
        statusSelect.innerHTML += `<option value="online">Online (Active)</option><option value="offline">Offline (Inactive)</option>`;
    }
    statusSelect.value = 'all'; 

    const thead = document.getElementById('clients-thead');
    const tbody = document.getElementById('clients-tbody');
    
    // Cabeçalho simplificado focado no visual de cards/linhas ricas
    thead.innerHTML = `<tr><th style="text-align: left; padding-left: 15px;">Detalhes do Equipamento e Assinante</th></tr>`;
    tbody.innerHTML = '';

    const portKey = `${placa}/${porta}`;
    const clients = window.OLT_CLIENTS_DATA[portKey] || [];

    if (clients.length === 0) {
        tbody.innerHTML = `<tr><td style="text-align:center;">Nenhum cliente encontrado.</td></tr>`;
    } else {
        clients.forEach(c => {
            let statusRaw = c.statusRef.toLowerCase();
            let statusClass = 'filter-unknown';
            let statusText = 'UNKNOWN';
            
            if (oltType === 'nokia') {
                if (statusRaw.includes('up')) { statusClass = 'filter-online'; statusText = 'UP'; }
                else if (statusRaw.includes('down')) { statusClass = 'filter-offline'; statusText = 'DOWN'; }
            } else {
                if (statusRaw.includes('active') && !statusRaw.includes('inactive')) { statusClass = 'filter-online'; statusText = 'UP'; }
                else if (statusRaw.includes('inactive')) { statusClass = 'filter-offline'; statusText = 'DOWN'; }
            }
            
            let buttonClass = statusClass === 'filter-online' ? 'status-normal' : 'status-critico';
            if (statusClass === 'filter-unknown') buttonClass = 'status-atencao';

            // Geração da linha rica com as tags invisíveis data-serial e data-codigo
            let rowHTML = `
                <tr class="client-row ${statusClass}" data-serial="${c.serial}" data-codigo="${c.codigo}">
                    <td style="padding: 15px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center; justify-content: space-between;">
                            <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                                
                                <div style="display: flex; align-items: center; gap: 6px;" title="Serial do Equipamento">
                                    <span class="material-symbols-rounded" style="color: var(--m3-color-primary);">barcode</span> 
                                    <strong style="font-family: var(--font-family-mono); font-size: 1.05rem;">${c.serial || 'N/A'}</strong>
                                </div>
                                
                                <div style="display: flex; align-items: center; gap: 6px;" title="Código do Cliente">
                                    <span class="material-symbols-rounded" style="color: var(--m3-color-primary);">deployed_code_account</span> 
                                    <strong style="font-family: var(--font-family-mono); font-size: 1.05rem;">${c.codigo || 'N/A'}</strong>
                                </div>

                                <div style="display: flex; align-items: center; gap: 6px; color: var(--m3-on-surface-variant);" title="Nome da OLT">
                                    <span class="material-symbols-rounded" style="font-size: 20px;">dns</span> ${c.oltName}
                                </div>

                                <div style="display: flex; align-items: center; gap: 6px; color: var(--m3-on-surface-variant);" title="Placa/Porta">
                                    <span class="material-symbols-rounded" style="font-size: 20px;">developer_board</span> ${c.placa}/${c.porta}
                                </div>

                                <div style="display: flex; align-items: center; gap: 6px; color: var(--m3-on-surface-variant);" title="Circuito">
                                    <span class="material-symbols-rounded" style="font-size: 20px;">network_node</span> ${c.circuito}
                                </div>

                            </div>
                            <div>
                                <button class="status-btn ${buttonClass}" style="display: flex; align-items: center; gap: 6px; cursor: default; pointer-events: none;">
                                    <span class="material-symbols-rounded" style="font-size: 20px;">online_prediction</span> ${statusText}
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            tbody.innerHTML += rowHTML;
        });
    }
    modal.style.display = 'flex';
};

window.filterClients = function() {
    const searchText = document.getElementById('search-input').value.toLowerCase().trim();
    const statusFilter = document.getElementById('status-filter').value;
    const rows = document.querySelectorAll('.client-row');
    
    rows.forEach(row => {
        // Resgata os valores injetados nas tags invisíveis
        const serial = (row.dataset.serial || '').toLowerCase();
        const codigo = (row.dataset.codigo || '').toLowerCase();
        
        // A busca se torna cirúrgica avaliando exclusivamente as tags
        let matchesSearch = searchText === '' || serial.includes(searchText) || codigo.includes(searchText);
        
        let matchesStatus = true;
        if (statusFilter === 'online') matchesStatus = row.classList.contains('filter-online');
        if (statusFilter === 'offline') matchesStatus = row.classList.contains('filter-offline');
        
        if (matchesSearch && matchesStatus) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
};

// OUVINTE DO MAESTRO CENTRAL (data-store.js)
window.addEventListener('dadosAtualizados', () => {
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));
    
    if (isHomePage) {
        runGlobalNetworkOverview();
    }
    
    if (window.CURRENT_MONITORING_CONFIG && typeof window.updateOltModal === 'function') {
        window.updateOltModal();
    }
});