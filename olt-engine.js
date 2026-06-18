// ==============================================================================
// olt-engine.js - Motor Dedicado de Monitoramento de Rede (Individual e Global)
// Atualização: Limpeza de injeção HTML para Home e Reinserção dos Subtítulos
// ==============================================================================

const TAB_CIRCUITOS = 'CIRCUITO'; 
const TAB_LOCALIDADE = 'LOCALIDADE'; 

window.OLT_CLIENTS_DATA = {};
window.CURRENT_OLT_PORT_DATA = {}; 
window.NETWORK_PROBLEMS_STORE = new Set();
window.NETWORK_BACKBONE_STORE = new Set();
window.currentOltInterval = null; 
window.CURRENT_VIEW_PLACA = null; 

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
    tooltip.innerHTML = `
        <div class="smart-tooltip-title">
            <span class="material-symbols-rounded" style="font-size: 18px; color: var(--m3-color-error);">warning</span>
            ${el.dataset.olt}
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Status:</span> 
            <strong style="color: var(--m3-color-error);">Crítico</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Total Offline:</span> 
            <strong style="color: var(--m3-color-error);">${el.dataset.off}</strong>
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
    content.innerHTML = `
        <h3 style="margin-top: 0; border-bottom: 1px solid var(--m3-outline); padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: var(--m3-color-error);">warning</span> ${el.dataset.olt}
        </h3>
        <div style="margin-bottom: 15px; text-align: center;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Total Offline</span><br>
            <strong style="font-size: 2.5rem; font-family: var(--font-family-mono); color: var(--m3-color-error); line-height: 1;">${el.dataset.off}</strong>
        </div>
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between;">
            <div>
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Total Analisado</span><br>
                <strong style="font-size: 1.2rem;">${el.dataset.total}</strong>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Impacto na OLT</span><br>
                <strong style="font-size: 1.2rem; color: var(--m3-color-error);">${el.dataset.pct}%</strong>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

// ==============================================================================

async function fetchGlobalOltData(olt) {
    const range = `${olt.sheetTab}!A:K`;
    
    try {
        const data = await API.get(range);
        const rows = (data.values || []).slice(1);
        
        let totalOnline = 0, totalOffline = 0;
        const portData = {};

        rows.forEach(columns => {
            if (columns.length === 0) return;
            
            const isOnline = DataMapper.isOnline(columns[olt.type === 'nokia' ? 4 : 2], olt.type);
            const portInfo = DataMapper.extractPort(columns[0], olt.type);

            if (isOnline) totalOnline++; else totalOffline++;
            
            if (portInfo) {
                const { placa, porta } = portInfo;
                const portKey = `${placa}/${porta}`; 
                if (!portData[portKey]) portData[portKey] = { off: 0, total: 0 };
                portData[portKey].total++;
                if (!isOnline) portData[portKey].off++;
            }
        });

        return { id: olt.id, onlineCount: totalOnline, offlineCount: totalOffline, type: olt.type, portData };
    } catch (error) {
        return { id: olt.id, onlineCount: 0, offlineCount: 0, type: olt.type, portData: {} };
    }
}

function updateGlobalNetworkCard(globalOnline, globalOffline, top3Olts) {
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));
    if (!isHomePage) return;

    // 1. Oculta o loading e exibe o container estruturado
    const loadingEl = document.getElementById('global-net-loading');
    const contentEl = document.getElementById('global-net-content');
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'flex';

    // 2. Atualiza Estatísticas Gerais (Textos)
    const total = globalOnline + globalOffline;
    const elTotal = document.getElementById('net-total-geral');
    const elOnline = document.getElementById('net-total-online');
    const elOffline = document.getElementById('net-total-offline');
    
    if (elTotal) elTotal.textContent = total;
    if (elOnline) elOnline.textContent = globalOnline;
    if (elOffline) elOffline.textContent = globalOffline;

    // 3. Atualiza Ranking Top 3 (Sem injetar HTML)
    const hasIssues = top3Olts.some(olt => olt.offline > 0);
    const noIssuesEl = document.getElementById('net-no-issues');
    
    if (!hasIssues) {
        if (noIssuesEl) noIssuesEl.style.display = 'block';
        for (let i = 1; i <= 3; i++) {
            const row = document.getElementById(`net-top-${i}`);
            if (row) row.style.display = 'none';
        }
    } else {
        if (noIssuesEl) noIssuesEl.style.display = 'none';
        
        for (let i = 1; i <= 3; i++) {
            const row = document.getElementById(`net-top-${i}`);
            const nameEl = document.getElementById(`net-top-${i}-name`);
            const offEl = document.getElementById(`net-top-${i}-off`);
            const barEl = document.getElementById(`net-top-${i}-bar`);
            
            const olt = top3Olts[i - 1]; 
            
            if (olt && olt.offline > 0 && row) {
                const offlinePct = olt.total > 0 ? ((olt.offline / olt.total) * 100).toFixed(1) : 0;
                
                // Atualiza Dataset para manter a compatibilidade com o Hover/Click (Tooltips e Modais)
                row.dataset.olt = olt.id;
                row.dataset.off = olt.offline;
                row.dataset.total = olt.total;
                row.dataset.pct = offlinePct;

                // Preenche os dados nos placeholders
                if (nameEl) nameEl.textContent = `${i}º ${olt.id}`;
                if (offEl) offEl.textContent = `${olt.offline} OFF`;
                if (barEl) barEl.style.width = `${offlinePct}%`;
                
                row.style.display = 'block';
            } else {
                if (row) row.style.display = 'none';
            }
        }
    }
}

async function runGlobalNetworkOverview() {
    const oltPromises = GLOBAL_MASTER_OLT_LIST.map(olt => fetchGlobalOltData(olt));
    const results = await Promise.all(oltPromises);
    
    let globalOnline = 0, globalOffline = 0;
    let oltStatsList = [], currentBackbones = new Set();
    let allProblems = new Set();

    results.forEach(result => {
        globalOnline += result.onlineCount; 
        globalOffline += result.offlineCount;
        let total = result.onlineCount + result.offlineCount;
        
        oltStatsList.push({ id: result.id, offline: result.offlineCount, total });

        let ports100Down = 0;
        let localProblems = []; 
        
        for (const key in result.portData) {
            const { off, total: pTotal } = result.portData[key];
            if (pTotal >= 5) {
                let severity = null;
                const percOffline = off / pTotal;

                if (percOffline === 1) { 
                    ports100Down++; 
                    severity = 'SUPER'; 
                } else if (percOffline >= 0.5 || off >= 32) { 
                    severity = 'CRIT'; 
                } else if (off >= 16) { 
                    severity = 'WARN'; 
                }

                if (severity) {
                    localProblems.push({ porta: key, severity: severity, off: off });
                }
            }
        }
        
        let filteredProblems = localProblems;
        
        if (ports100Down >= 2) { 
            currentBackbones.add(result.id); 
            filteredProblems = localProblems.filter(p => p.severity !== 'SUPER');
        } 

        if (filteredProblems.length >= 2) {
            const multiStr = filteredProblems.map(p => p.porta).join(',');
            allProblems.add(`[${result.id}] STATUS::MULTI::${multiStr}`);
        } 
        else if (filteredProblems.length === 1) {
            const p = filteredProblems[0];
            allProblems.add(`[${result.id}] STATUS::${p.severity}_${p.porta}::${p.off}`);
        }
    });

    oltStatsList.sort((a, b) => b.offline - a.offline);
    updateGlobalNetworkCard(globalOnline, globalOffline, oltStatsList.slice(0, 3));

    window.NETWORK_PROBLEMS_STORE = allProblems;
    window.NETWORK_BACKBONE_STORE = currentBackbones;
}

window.stopOltMonitoring = function() {
    if (window.currentOltInterval) {
        clearInterval(window.currentOltInterval);
        window.currentOltInterval = null;
    }
};

async function fetchCircuitosData() {
    const range = `${TAB_CIRCUITOS}!A:AK`;
    try {
        const data = await API.get(range);
        return data.values || [];
    } catch (e) { return []; }
}

async function fetchLocalidadeData() {
    const range = `${TAB_LOCALIDADE}!A:AH`;
    try {
        const data = await API.get(range);
        return data.values || [];
    } catch (e) { 
        console.error('Erro ao baixar aba LOCALIDADE:', e);
        return []; 
    }
}

window.startOltMonitoring = function(config) {
    window.stopOltMonitoring(); 
    
    if (!document.getElementById('detail-modal')) {
        const modalHTML = `
            <div id="detail-modal" class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3 id="modal-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">Detalhes</h3>
                        <div style="display: flex; gap: 15px; align-items: center;">
                            <button onclick="exportDetailModalToImage(event)" title="Exportar para PNG" style="background: transparent; border: none; color: var(--m3-on-surface-variant); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; transition: color 0.2s;">
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
                                <input type="text" id="search-input" class="filter-input" placeholder="Buscar (Nome, Serial...)" onkeyup="filterClients()">
                                <select id="status-filter" class="filter-select" onchange="filterClients()"></select>
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
        window.CURRENT_OLT_PORT_DATA = {}; 
        window.OLT_CLIENTS_DATA = {}; 
        const rangeOlt = `${config.id}!A:K`; 

        try {
            const [dataOlt, rowsCircuitos, rowsLocalidades] = await Promise.all([
                API.get(rangeOlt), 
                fetchCircuitosData(),
                fetchLocalidadeData()
            ]);

            window.GLOBAL_BAIRROS_DATA = rowsLocalidades;

            const rowsOlt = (dataOlt.values || []).slice(1);

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
                
                let clientData = {};
                if (config.type === 'nokia') {
                    clientData = { colB: columns[1] || '', colC: columns[2] || '', colE: columns[4] || '', colH: columns[7] || '', colI: columns[8] || '', statusRef: columns[4] || '' };
                } else {
                    clientData = { colB: columns[1] || '', colC: columns[2] || '', colD: columns[3] || '', colH: columns[7] || '', statusRef: columns[2] || '' };
                }
                
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
                const subtitle = document.getElementById('olt-placa-subtitle');
                if (subtitle) {
                    const match = subtitle.innerText.match(/Placa (\d+)/);
                    if (match) window.openOltPlacaDetails(match[1], config.type);
                }
            }

        } catch (error) { 
            console.error('Erro na engine (populateTables):', error); 
        }
    }

    const runUpdate = async () => { await populateTables(); };
    runUpdate(); 
    window.currentOltInterval = setInterval(runUpdate, GLOBAL_REFRESH_SECONDS * 1000); 
}

window.openOltPlacaDetails = function(placa, oltType) {
    window.CURRENT_VIEW_PLACA = placa; 
    
    document.getElementById('olt-view-placas').style.display = 'none';
    document.getElementById('olt-view-detalhes').style.display = 'block';
    
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

        // Linha com a coluna de Bairros formatada para alinhar à esquerda
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

window.exportPlacaToTXT = function() {
    const titleEl = document.getElementById('super-modal-title');
    let oltName = 'OLT_Desconhecida';
    if (titleEl) {
        oltName = titleEl.innerText.replace('dns', '').trim();
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
            
            txtContent += `• ${porta.padEnd(10, ' ')} | Circuito: ${circuito.padEnd(20, ' ')} | Local: ${localidade.padEnd(20, ' ')} | Status: ${status}\n`;
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
        titleName = titleName.replace(/[^a-zA-Z0-9-]/g, '_');
    }

    html2canvas(modalContent, {
        backgroundColor: null, 
        scale: 2, 
        useCORS: true,
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Status_${titleName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        if (btn) btn.innerHTML = originalContent;
    }).catch(error => {
        console.error('Erro ao gerar imagem:', error);
        alert('Ocorreu um erro ao exportar a imagem.');
        if (btn) btn.innerHTML = originalContent;
    });
};

window.closeModal = function(event) {
    if (event && event.target.id !== 'detail-modal' && !event.target.classList.contains('close-modal')) return;
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
}

window.openPortDetails = function(placa, porta, circuito, online, offline, total) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('#detail-modal .modal-content');
    modalContent.classList.remove('modal-large'); 

    const textoCircuito = (circuito && circuito !== "-") ? ` - Circuito: ${circuito}` : "";
    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta}${textoCircuito}`;
    document.getElementById('view-stats').style.display = 'flex';
    document.getElementById('view-clients').style.display = 'none';
    document.getElementById('modal-up').textContent = online;
    document.getElementById('modal-down').textContent = offline;
    document.getElementById('modal-total').textContent = total;
    modal.style.display = 'flex';
}

window.openCircuitClients = function(placa, porta, circuitoNome, oltType) {
    const modal = document.getElementById('detail-modal');
    const modalContent = document.querySelector('#detail-modal .modal-content');
    modalContent.classList.add('modal-large');     

    const textoCircuito = (circuitoNome && circuitoNome !== "-") ? ` - Circuito: ${circuitoNome}` : "";
    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta}${textoCircuito}`;

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
    
    if (oltType === 'nokia') {
        thead.innerHTML = `<tr><th>Posição</th><th>Serial</th><th>Status</th><th>Descrição 1</th><th>Descrição 2</th></tr>`;
    } else {
        thead.innerHTML = `<tr><th>Posição</th><th>Status</th><th>Serial</th><th>Descrição</th></tr>`;
    }
    
    tbody.innerHTML = '';

    const portKey = `${placa}/${porta}`;
    const clients = window.OLT_CLIENTS_DATA[portKey] || [];

    if (clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${oltType === 'nokia' ? 5 : 4}" style="text-align:center;">Nenhum cliente encontrado.</td></tr>`;
    } else {
        clients.forEach(c => {
            let statusRaw = c.statusRef.toLowerCase();
            let statusClass = 'filter-unknown';
            if (oltType === 'nokia') {
                if (statusRaw.includes('up')) statusClass = 'filter-online';
                else if (statusRaw.includes('down')) statusClass = 'filter-offline';
            } else {
                if (statusRaw.includes('active') && !statusRaw.includes('inactive')) statusClass = 'filter-online';
                else if (statusRaw.includes('inactive')) statusClass = 'filter-offline';
            }
            
            let rowHTML = '';
            if (oltType === 'nokia') {
                rowHTML = `<tr class="client-row ${statusClass}"><td>${c.colB}</td><td>${c.colC}</td><td>${c.colE}</td><td>${c.colH}</td><td>${c.colI}</td></tr>`;
            } else {
                rowHTML = `<tr class="client-row ${statusClass}"><td>${c.colB}</td><td>${c.colC}</td><td>${c.colD}</td><td>${c.colH}</td></tr>`;
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
        if (statusFilter === 'online') matchesStatus = row.classList.contains('filter-online');
        if (statusFilter === 'offline') matchesStatus = row.classList.contains('filter-offline');
        
        if (matchesSearch && matchesStatus) row.style.display = '';
        else row.style.display = 'none';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (checkIsHomePage()) {
        runGlobalNetworkOverview();
        setInterval(runGlobalNetworkOverview, GLOBAL_REFRESH_SECONDS * 1000);
    }
});