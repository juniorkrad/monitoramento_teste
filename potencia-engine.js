// ==============================================================================
// potencia-engine.js - Motor Dedicado para Análise de Potência Óptica
// Atualização: Wallboard da Home - Resumo Médio + Minicards (Grid Dense) e Ajustes Finos
// ==============================================================================

window.POTENCIA_CLIENTS_DATA = {};
window.POTENCIA_PORT_DATA = {}; 
window.CURRENT_VIEW_PLACA = null; 
window.CURRENT_POTENCIA_CONFIG = null;

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
}

window.handlePotHover = function(event) {
    if (isMobileDevice()) return;
    const tooltip = document.getElementById('smart-tooltip');
    if (!tooltip) return;

    const el = event.currentTarget;
    tooltip.innerHTML = `
        <div class="smart-tooltip-title">
            <span class="material-symbols-rounded" style="font-size: 18px; color: ${el.dataset.color};">dns</span>
            ${el.dataset.olt}
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Média de Potência:</span> 
            <strong style="font-family: var(--font-family-mono); color: ${el.dataset.color};">${el.dataset.media} dBm</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Saúde da Rede:</span> 
            <strong style="color: ${el.dataset.health >= 90 ? 'var(--m3-color-success)' : 'var(--m3-color-error)'};">${el.dataset.health}%</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Clientes Críticos:</span> 
            <strong style="color: var(--m3-color-error);">${el.dataset.crit}</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Total Analisado:</span> 
            <strong>${el.dataset.total}</strong>
        </div>
    `;

    const rect = el.getBoundingClientRect();
    tooltip.style.left = (rect.left + (rect.width / 2) + window.scrollX) + 'px';
    tooltip.style.top = (rect.top + window.scrollY) + 'px';
    tooltip.style.opacity = 1;
};

window.handlePotLeave = function() {
    const tooltip = document.getElementById('smart-tooltip');
    if (tooltip) tooltip.style.opacity = 0;
};

window.handlePotClick = function(event) {
    if (!isMobileDevice()) return;
    const modal = document.getElementById('mobile-fast-modal');
    const content = document.getElementById('fast-modal-content');
    if (!modal || !content) return;

    const el = event.currentTarget;
    content.innerHTML = `
        <h3 style="margin-top: 0; border-bottom: 1px solid var(--m3-outline); padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: ${el.dataset.color};">dns</span> ${el.dataset.olt}
        </h3>
        <div style="margin-bottom: 15px; text-align: center;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Média de Potência</span><br>
            <strong style="font-size: 2.5rem; font-family: var(--font-family-mono); color: ${el.dataset.color}; line-height: 1;">${el.dataset.media}</strong>
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">dBm</span>
        </div>
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between;">
            <div>
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Clientes Críticos</span><br>
                <strong style="font-size: 1.2rem; color: var(--m3-color-error);">${el.dataset.crit}</strong>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Total Analisado</span><br>
                <strong style="font-size: 1.2rem;">${el.dataset.total}</strong>
            </div>
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Saúde Óptica da OLT</span><br>
            <strong style="color: ${el.dataset.health >= 90 ? 'var(--m3-color-success)' : 'var(--m3-color-error)'}; font-size: 1.2rem;">${el.dataset.health}%</strong>
        </div>
    `;
    modal.style.display = 'flex';
};

window.exportCardToImage = function(event, cardId, oltName) {
    if (event) event.stopPropagation();

    const card = document.getElementById(cardId);
    if (!card) return;

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
    }

    html2canvas(card, {
        backgroundColor: null,
        scale: 2, 
        useCORS: true,
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Potencia_${oltName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        if (btn) btn.innerHTML = originalContent;
    }).catch(error => {
        console.error('Erro ao gerar imagem:', error);
        alert('Ocorreu um erro ao exportar a imagem.');
        if (btn) btn.innerHTML = originalContent;
    });
};

window.exportPotenciaPlacaToTXT = function() {
    const titleEl = document.getElementById('super-modal-title');
    let oltName = 'OLT_Desconhecida';
    if (titleEl) {
        oltName = titleEl.innerText.replace('dns', '').trim();
    }
    const placa = window.CURRENT_VIEW_PLACA || '?';
    
    let txtContent = `=================================================\n`;
    txtContent += `   RELATÓRIO DE POTÊNCIA - ${oltName} (PLACA ${placa})\n`;
    txtContent += `   Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
    txtContent += `=================================================\n\n`;
    
    const tbody = document.getElementById('potencia-detalhes-tbody');
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
            const bairro = cols[2].innerText.trim();
            const media = cols[3].innerText.trim();
            
            txtContent += `• ${porta.padEnd(10, ' ')} | Circuito: ${circuito.padEnd(12, ' ')} | Bairro: ${bairro.padEnd(45, ' ')} | Média: ${media}\n`;
        }
    });
    
    txtContent += `\n=================================================\n`;
    
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Potencia_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_Placa_${placa}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function runPotenciaEngine() {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    const gridEl = document.getElementById('potencia-grid');
    const isPotenciaPage = window.location.pathname.includes('potencia.html');
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));

    if (!isPotenciaPage && !isHomePage) return;

    try {
        let globalCriticos = 0;
        let globalAnalisados = 0;
        let globalDbmSums = 0;
        let globalLatestUpdate = '--/--/---- --:--:--';
        let oltStats = [];
        let todosClientesCriticos = []; 
        
        window.POTENCIA_CLIENTS_DATA = {};
        window.POTENCIA_LAST_UPDATES = {};

        GLOBAL_MASTER_OLT_LIST.forEach((olt) => {
            const values = window.DATA_STORE.olts[olt.id] || [];
            const rows = values.slice(1);
            
            let analisados = 0;
            let criticos = 0;
            let dbmSums = 0;
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
                    if (dateMatch && timeMatch) {
                        lastUpdateStr = `${dateMatch[0]} ${timeMatch[0]}`;
                        globalLatestUpdate = lastUpdateStr;
                    }
                }
            }

            window.POTENCIA_LAST_UPDATES[olt.id] = lastUpdateStr;

            rows.forEach(columns => {
                if (columns.length === 0) return;

                const isOnline = DataMapper.isOnline(columns[olt.type === 'nokia' ? 4 : 2], olt.type);
                if (!isOnline) return;

                const portInfo = DataMapper.extractPort(columns[0], olt.type);
                if (!portInfo) return;

                const powerVal = DataMapper.parsePowerValue(columns[5]);
                
                if (DataMapper.isValidPower(powerVal)) {
                    analisados++;
                    dbmSums += powerVal;
                    
                    if (powerVal <= -28.00) { 
                        criticos++; 
                        let serial = olt.type === 'nokia' ? columns[2] : columns[3];
                        let codigo = olt.type === 'nokia' ? columns[8] : columns[7];
                        todosClientesCriticos.push({ olt: olt.id, porta: `${portInfo.placa}/${portInfo.porta}`, serial: serial || '', codigo: codigo || '', potencia: powerVal });
                    } 
                }
            });

            const media = analisados > 0 ? (dbmSums / analisados).toFixed(1) : 0;
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
            globalDbmSums += dbmSums;
        });

        // ==============================================================================
        // INJEÇÃO DA HOME (Wallboard Widescreen com Resumo + Minicards)
        // ==============================================================================
        if (isHomePage) {
            const globalMedia = globalAnalisados > 0 ? (globalDbmSums / globalAnalisados).toFixed(1) : "0.0";
            
            // Suporte legado
            const elAnalisado = document.getElementById('potencia-total-analisado');
            const elCriticos = document.getElementById('potencia-total-criticos');
            const elMedia = document.getElementById('potencia-global-media');
            const elIcon = document.getElementById('potencia-main-icon');
            const elDate = document.getElementById('potencia-date');
            const elTime = document.getElementById('potencia-time');

            if (elAnalisado) elAnalisado.textContent = globalAnalisados;
            if (elCriticos) elCriticos.textContent = globalCriticos;
            
            let globalMediaColor = 'var(--m3-color-success)'; 
            let gMediaVal = parseFloat(globalMedia);
            if (gMediaVal <= -28.00) globalMediaColor = 'var(--m3-color-error)'; 
            else if (gMediaVal <= -26.00) globalMediaColor = 'var(--m3-color-warning)';

            if (elMedia) {
                elMedia.textContent = globalMedia;
                elMedia.style.color = globalMediaColor;
                if (elIcon) elIcon.style.color = globalMediaColor;
            }

            if (globalLatestUpdate !== '--/--/---- --:--:--') {
                const dateParts = globalLatestUpdate.split(' ');
                if (elDate) elDate.textContent = dateParts[0] || '--/--/----';
                if (elTime) elTime.textContent = dateParts[1] || '--:--:--';
            }

            // Alvo do layout novo de Widescreen (Grid de Minicards e Resumo)
            const targetWidescreen = document.getElementById('target-potencia-widescreen');
            
            if (targetWidescreen) {
                // Inicia montando o Card Médio de Resumo Geral
                let htmlWidescreen = `
                    <div class="resumo-card">
                        <div>
                            <div class="resumo-title"><span class="material-symbols-rounded" style="font-size:16px;">settings_input_antenna</span> Média de Potência</div>
                            <div class="resumo-main-val" style="color: ${globalMediaColor};">${globalMedia}</div>
                            <div style="font-size: 0.8rem; color: var(--m3-on-surface-variant);">Média (dBm) na Rede</div>
                        </div>
                        <div class="resumo-sec-val">
                            <span>Clientes Críticos:</span>
                            <strong style="color: var(--m3-color-error); font-size: 1.1rem;">${globalCriticos}</strong>
                        </div>
                    </div>
                `;
                
                // Filtra OLTs que tem dados analisados
                const validOlts = oltStats.filter(o => o.analisados > 0);
                
                // Ordenar da pior média para a melhor
                validOlts.sort((a, b) => parseFloat(a.media) - parseFloat(b.media));

                // Montar os minicards fluidos
                validOlts.forEach(stat => {
                    let statusClass = 'ok';
                    let mediaColor = 'var(--m3-color-success)';
                    let mediaVal = parseFloat(stat.media);
                    
                    if (mediaVal <= -28.00) {
                        statusClass = 'danger';
                        mediaColor = 'var(--m3-color-error)';
                    } else if (mediaVal <= -26.00) {
                        statusClass = 'warning';
                        mediaColor = 'var(--m3-color-warning)';
                    }

                    htmlWidescreen += `
                        <div class="status-card ${statusClass}"
                             data-olt="${stat.id}"
                             data-media="${stat.media}"
                             data-health="${stat.health.toFixed(1)}"
                             data-crit="${stat.criticos}"
                             data-total="${stat.analisados}"
                             data-color="${mediaColor}"
                             onmouseenter="handlePotHover(event)"
                             onmouseleave="handlePotLeave()"
                             onclick="handlePotClick(event)">
                            <div style="display: flex; align-items: center; gap: 4px; pointer-events: none;">
                                <span class="material-symbols-rounded" style="font-size: 14px; color: var(--m3-on-surface-variant);">dns</span>
                                <span class="olt-name">${stat.id}</span>
                            </div>
                            <span class="olt-value" style="color: ${mediaColor}; pointer-events: none;">${stat.media}</span>
                            <span class="olt-label" style="pointer-events: none;">dBm</span>
                        </div>
                    `;
                });
                
                // Injeta o HTML limpo e dinâmico direto no Body do Widescreen
                targetWidescreen.innerHTML = htmlWidescreen;
            }
        }

        // ==============================================================================
        // INJEÇÃO DA PÁGINA POTENCIA.HTML (Cards individuais mantidos)
        // ==============================================================================
        if (isPotenciaPage && gridEl) {
            gridEl.innerHTML = '';
            
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const o = oltStats.find(stats => stats.id === oltDef.id);
                if(!o) return;

                const btnHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button class="card-header-button" onclick="exportCardToImage(event, 'card-${o.id}', '${o.id}')" title="Exportar Card">
                            <span class="material-symbols-rounded">photo_camera</span>
                        </button>
                        <button class="card-header-button" onclick="window.openPotenciaSuperModal('${o.id}', '${oltDef.sheetTab}', '${oltDef.type}', ${oltDef.boards})" title="Ver Placas e Portas">
                            <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                        </button>
                    </div>`;
                
                const dateParts = o.lastUpdate ? o.lastUpdate.split(' ') : ['--/--/----', '--:--:--'];
                const dateVal = dateParts[0] || '--/--/----';
                const timeVal = dateParts[1] || '--:--:--';
                
                let mediaVal = parseFloat(o.media);
                let mediaColor = 'var(--m3-color-success)';
                if (mediaVal <= -28.00) {
                    mediaColor = 'var(--m3-color-error)';
                } else if (mediaVal <= -26.00) {
                    mediaColor = 'var(--m3-color-warning)';
                }

                gridEl.innerHTML += `
                    <div class="overview-card" id="card-${o.id}" style="display: flex; flex-direction: column; width: 100%;">
                        <div class="card-header" style="justify-content: space-between; width: 100%; box-sizing: border-box;">
                            <h3><span class="material-symbols-rounded">dns</span> ${o.id}</h3>
                            ${btnHtml}
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 16px 20px; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; width: 100%;">
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Total Analisado">
                                        <span class="material-symbols-rounded" style="color:var(--m3-on-surface); font-size: 20px;">search</span>
                                        <span style="font-size: 1.2rem; color:var(--m3-on-surface); font-weight: bold; font-family: var(--font-family-mono);">${o.analisados}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Clientes Críticos">
                                        <span class="material-symbols-rounded" style="color:var(--m3-color-error); font-size: 20px;">warning</span>
                                        <span style="font-size: 1.2rem; color:var(--m3-color-error); font-weight: bold; font-family: var(--font-family-mono);">${o.criticos}</span>
                                    </div>
                                </div>
                                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;" title="Média de Potência">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:${mediaColor}; font-size: 28px;">insights</span>
                                        <span style="font-size: 2.2rem; font-family: var(--font-family-mono); font-weight: bold; color: ${mediaColor}; line-height: 1;">${o.media}</span>
                                    </div>
                                    <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-top: 6px;">Média (dBm)</span>
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

window.openPotenciaSuperModal = function(id, sheetTab, type, boards) {
    try {
        const modal = document.getElementById('super-modal');
        if (!modal) return;
        
        document.getElementById('super-modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${id}`;
        document.getElementById('potencia-view-detalhes').style.display = 'none';
        document.getElementById('potencia-view-placas').style.display = 'block';
        
        modal.style.display = 'flex';
        
        window.startPotenciaMonitoring({ id: sheetTab, type: type, boards: boards, oltName: id });
    } catch (e) {
        console.error("Erro ao abrir o modal das OLTs:", e);
    }
}

window.startPotenciaMonitoring = function(config) {
    window.CURRENT_POTENCIA_CONFIG = config;

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

        window.POTENCIA_PORT_DATA = {}; 
        window.POTENCIA_CLIENTS_DATA = {}; 

        try {
            const rowsCircuitos = window.DATA_STORE.circuitos || [];
            const rowsLocalidades = window.DATA_STORE.localidades || [];
            const dataOlt = window.DATA_STORE.olts[config.oltName || config.id] || [];
            
            const rowsOlt = dataOlt.slice(1);

            rowsOlt.forEach(columns => {
                if (columns.length === 0) return;

                const isOnline = DataMapper.isOnline(columns[config.type === 'nokia' ? 4 : 2], config.type);
                if (!isOnline) return;

                const portInfo = DataMapper.extractPort(columns[0], config.type);
                if (!portInfo) return;

                const powerVal = DataMapper.parsePowerValue(columns[5]);
                if (!DataMapper.isValidPower(powerVal)) return;

                const { placa, porta } = portInfo;
                const placaNum = parseInt(placa);
                const portaNum = parseInt(porta);
                const portKey = `${placaNum}/${portaNum}`;
                
                let pos = '', serial = '', desc1 = '', desc2 = '';

                if (config.type === 'nokia') {
                    pos = columns[1] || '';
                    serial = columns[2] || '';
                    desc1 = columns[7] || ''; 
                    desc2 = columns[8] || ''; 
                } else { 
                    pos = columns[1] || '';
                    serial = columns[3] || ''; 
                    desc1 = columns[7] || ''; 
                }
                
                if (!window.POTENCIA_PORT_DATA[placaNum]) {
                    window.POTENCIA_PORT_DATA[placaNum] = {};
                }

                if (!window.POTENCIA_PORT_DATA[placaNum][portaNum]) {
                    const infoExtra = DataMapper.getCircuitInfo(rowsCircuitos, config, placa, porta);
                    const bairroExtra = DataMapper.getBairroInfo(rowsLocalidades, config.oltName || config.id, placa, porta, config.type);
                    
                    window.POTENCIA_PORT_DATA[placaNum][portaNum] = { validCount: 0, sumPower: 0, info: infoExtra, bairro: bairroExtra };
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

        } catch (error) { 
            console.error('Erro na engine de potência (populateTables):', error); 
        }
    }

    window.updatePotenciaModal = populateTables;
    populateTables();
}

window.openPotenciaPlacaDetails = function(placa, oltType) {
    window.CURRENT_VIEW_PLACA = placa; 

    document.getElementById('potencia-view-placas').style.display = 'none';
    document.getElementById('potencia-view-detalhes').style.display = 'block';
    
    const tbody = document.getElementById('potencia-detalhes-tbody');
    tbody.innerHTML = '';
    
    const ports = window.POTENCIA_PORT_DATA[placa] || {};
    const sortedPorts = Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (sortedPorts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--m3-on-surface-variant);">Nenhuma porta com leituras de potência nesta placa.</td></tr>`;
        return;
    }

    sortedPorts.forEach(pt => {
        const { validCount, sumPower, info, bairro } = ports[pt];
        const media = validCount > 0 ? (sumPower / validCount).toFixed(1) : 0;
        
        let statusClass = 'status-normal';
        if (media <= -28.00) statusClass = 'status-critico'; 
        else if (media <= -26.00) statusClass = 'status-atencao'; 

        const safeInfo = info.replace(/'/g, "\\'");
        const textoBairro = bairro && bairro !== '-' ? bairro : 'N/A';

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
                <td style="font-family: var(--font-family-mono); font-size: 0.9rem; color: var(--m3-on-surface-variant);">${textoBairro}</td>
                <td>
                    <button class="status ${statusClass} status-btn" style="cursor: default;">
                        ${media} dBm
                    </button>
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
            const valColor = isCritical ? 'var(--m3-color-error)' : 'inherit';
            
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
    window.CURRENT_POTENCIA_CONFIG = null;
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
        if (typeof loadHeader === 'function') loadHeader({ title: "Monitoramento de Potência", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        setTimeout(updateGlobalTimestamp, 500);
    }
});

window.addEventListener('dadosAtualizados', () => {
    runPotenciaEngine();

    if (window.CURRENT_POTENCIA_CONFIG && typeof window.updatePotenciaModal === 'function') {
        window.updatePotenciaModal();
        
        if (document.getElementById('potencia-view-detalhes') && document.getElementById('potencia-view-detalhes').style.display === 'block' && window.CURRENT_VIEW_PLACA) {
            window.openPotenciaPlacaDetails(window.CURRENT_VIEW_PLACA, window.CURRENT_POTENCIA_CONFIG.type);
        }
    }
});