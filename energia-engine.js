// ==============================================================================
// energia-engine.js - Motor Dedicado de Monitorização de Energia (Dying Gasp)
// Atualização: Wallboard da Home - Resumo Médio + Minicards (Grid Dense)
// ==============================================================================

window.ENERGY_DATA_STORE = {};
window.NETWORK_ENERGY_STORE = new Set(); 
window.CURRENT_ENERGY_OLT = null; 
window.CURRENT_ENERGY_PLACA = null; 

// ==============================================================================
// FUNÇÕES DO SISTEMA HÍBRIDO (TOOLTIP PC / MODAL MOBILE)
// ==============================================================================
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
}

window.handleEnergyHover = function(event) {
    if (isMobileDevice()) return;
    const tooltip = document.getElementById('smart-tooltip');
    if (!tooltip) return;

    const el = event.currentTarget;
    let statusTexto = el.classList.contains('warning') ? 'Atenção (Sem Energia)' : 'Normal';
    let statusCor = el.classList.contains('warning') ? 'var(--m3-color-warning)' : 'var(--m3-color-success)';

    tooltip.innerHTML = `
        <div class="smart-tooltip-title">
            <span class="material-symbols-rounded" style="font-size: 18px; color: ${statusCor};">bolt</span>
            ${el.dataset.olt}
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Status:</span> 
            <strong style="color: ${statusCor};">${statusTexto}</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Sem Energia:</span> 
            <strong style="color: var(--m3-color-warning);">${el.dataset.poweroff}</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Total Offline:</span> 
            <strong style="color: var(--m3-color-error);">${el.dataset.offline}</strong>
        </div>
    `;

    const rect = el.getBoundingClientRect();
    tooltip.style.left = (rect.left + (rect.width / 2) + window.scrollX) + 'px';
    tooltip.style.top = (rect.top + window.scrollY) + 'px';
    tooltip.style.opacity = 1;
};

window.handleEnergyLeave = function() {
    const tooltip = document.getElementById('smart-tooltip');
    if (tooltip) tooltip.style.opacity = 0;
};

window.handleEnergyClick = function(event) {
    if (!isMobileDevice()) return;
    const modal = document.getElementById('mobile-fast-modal');
    const content = document.getElementById('fast-modal-content');
    if (!modal || !content) return;

    const el = event.currentTarget;
    let statusCor = el.classList.contains('warning') ? 'var(--m3-color-warning)' : 'var(--m3-color-success)';

    content.innerHTML = `
        <h3 style="margin-top: 0; border-bottom: 1px solid var(--m3-outline); padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: ${statusCor};">bolt</span> ${el.dataset.olt}
        </h3>
        <div style="margin-bottom: 15px; text-align: center;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Sem Energia (Dying Gasp)</span><br>
            <strong style="font-size: 2.5rem; font-family: var(--font-family-mono); color: var(--m3-color-warning); line-height: 1;">${el.dataset.poweroff}</strong>
        </div>
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between;">
            <div>
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Total Offline</span><br>
                <strong style="font-size: 1.2rem; color: var(--m3-color-error);">${el.dataset.offline}</strong>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Status</span><br>
                <strong style="font-size: 1.1rem; color: ${statusCor}; text-transform: uppercase;">${el.classList.contains('warning') ? 'Atenção' : 'Normal'}</strong>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

// ==============================================================================

function extractEnergyPort(val) {
    if (!val) return null;
    let s = String(val).replace(/gpon/i, '').trim();
    let parts = s.split('/');
    if (parts.length >= 2) {
        let placa = parseInt(parts[parts.length - 2], 10);
        let porta = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(placa) && !isNaN(porta)) {
            return { placa: placa.toString(), porta: porta.toString() };
        }
    }
    return null;
}

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
        link.download = `Energia_${oltName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        if (btn) btn.innerHTML = originalContent;
    }).catch(error => {
        console.error('Erro ao gerar imagem:', error);
        alert('Ocorreu um erro ao exportar a imagem.');
        if (btn) btn.innerHTML = originalContent;
    });
};

window.exportEnergiaPlacaToTXT = function() {
    const titleEl = document.getElementById('super-modal-title');
    let oltName = 'OLT_Desconhecida';
    if (titleEl) {
        oltName = titleEl.innerText.replace('dns', '').trim();
    }
    const placa = window.CURRENT_ENERGY_PLACA || '?';
    
    let txtContent = `=================================================\n`;
    txtContent += `   RELATÓRIO DE ENERGIA - ${oltName} (PLACA ${placa})\n`;
    txtContent += `   Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
    txtContent += `=================================================\n\n`;
    
    const tbody = document.getElementById('energy-detalhes-tbody');
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
            const status = cols[3].innerText.trim();
            
            txtContent += `• ${porta.padEnd(10, ' ')} | Circuito: ${circuito.padEnd(20, ' ')} | Bairro: ${bairro.padEnd(20, ' ')} | Status: ${status}\n`;
        }
    });
    
    txtContent += `\n=================================================\n`;
    
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Energia_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_Placa_${placa}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function runEnergyMonitoring() {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    const gridEnergyPage = document.getElementById('energy-olt-grid');
    const isEnergyPage = window.location.pathname.includes('energia.html');
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));

    if (!isEnergyPage && !isHomePage) return;

    try {
        let globalPowerOff = 0;
        let globalTotalClients = 0;
        let globalTotalOffline = 0;
        let oltsAffected = 0;
        let oltStats = [];
        let globalLastUpdateStr = '--/--/---- --:--:--';

        window.ENERGY_DATA_STORE = { global: null, olts: {} };
        window.NETWORK_ENERGY_STORE.clear(); 

        GLOBAL_MASTER_OLT_LIST.forEach((olt) => {
            const values = window.DATA_STORE.olts[olt.id] || [];
            const rows = values.slice(1);
            let oltOnline = 0, oltOffline = 0;
            const portDataTemp = {}; 

            rows.forEach(columns => {
                if (columns.length === 0) return;
                
                const isOnline = DataMapper.isOnline(columns[olt.type === 'nokia' ? 4 : 2], olt.type);
                const portInfo = extractEnergyPort(columns[0]);
                
                if (!portInfo) return;

                if (isOnline) oltOnline++; else oltOffline++;

                if (!portDataTemp[portInfo.placa]) portDataTemp[portInfo.placa] = {};
                if (!portDataTemp[portInfo.placa][portInfo.porta]) {
                    portDataTemp[portInfo.placa][portInfo.porta] = { total: 0, online: 0, offline: 0, powerOff: 0 };
                }

                portDataTemp[portInfo.placa][portInfo.porta].total++;
                if (isOnline) portDataTemp[portInfo.placa][portInfo.porta].online++;
                else portDataTemp[portInfo.placa][portInfo.porta].offline++;
            });

            window.ENERGY_DATA_STORE.olts[olt.id] = {
                id: olt.id, type: olt.type, boards: olt.boards, sheetTab: olt.sheetTab,
                totalClients: oltOnline + oltOffline, online: oltOnline, offline: oltOffline, powerOff: 0, offlineOther: 0,
                lastUpdate: '--/--/---- --:--:--', ports: portDataTemp
            };
            
            globalTotalClients += (oltOnline + oltOffline);
            globalTotalOffline += oltOffline;
        });

        const rowsEnergia = window.DATA_STORE.energia ? window.DATA_STORE.energia.slice(1) : [];
        
        GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
            const oltData = window.ENERGY_DATA_STORE.olts[oltDef.id];
            if (!oltData) return;

            if (oltDef.energyCol !== undefined) {
                const colIndex = oltDef.energyCol;
                
                if (rowsEnergia.length > 0 && rowsEnergia[0][colIndex + 3]) {
                    const rawDate = rowsEnergia[0][colIndex + 3];
                    const dateMatch = String(rawDate).match(/\d{2}\/\d{2}\/\d{2,4}/);
                    const timeMatch = String(rawDate).match(/\d{2}:\d{2}(:\d{2})?/);
                    if (dateMatch && timeMatch) {
                        oltData.lastUpdate = `${dateMatch[0]} ${timeMatch[0]}`;
                        globalLastUpdateStr = oltData.lastUpdate;
                    } else {
                        oltData.lastUpdate = rawDate;
                    }
                }

                rowsEnergia.forEach(row => {
                    if (row.length > colIndex + 2) {
                        const portaFull = row[colIndex + 1];
                        const qtd = parseInt(row[colIndex + 2]) || 0;

                        if (portaFull && qtd > 0) {
                            let p = extractEnergyPort(portaFull);
                            if (p) {
                                const placa = p.placa;
                                const porta = p.porta;

                                if (!oltData.ports[placa]) oltData.ports[placa] = {};
                                if (!oltData.ports[placa][porta]) {
                                    oltData.ports[placa][porta] = { total: qtd, online: 0, offline: qtd, powerOff: 0 };
                                }

                                oltData.ports[placa][porta].powerOff = qtd;
                                oltData.powerOff += qtd;
                                globalPowerOff += qtd;
                            }
                        }
                    }
                });
            }

            oltData.offlineOther = Math.max(0, oltData.offline - oltData.powerOff);
            if (oltData.powerOff > 0) oltsAffected++;

            oltStats.push({ 
                id: oltData.id, 
                online: oltData.online, 
                offline: oltData.offline, 
                powerOff: oltData.powerOff, 
                offlineOther: oltData.offlineOther,
                lastUpdate: oltData.lastUpdate 
            });
        });

        window.ENERGY_DATA_STORE.global = {
            powerOff: globalPowerOff, totalClients: globalTotalClients,
            totalOffline: globalTotalOffline, oltsAffected: oltsAffected
        };

        // ==============================================================================
        // INJEÇÃO DA HOME (Wallboard Widescreen com Resumo + Minicards)
        // ==============================================================================
        if (isHomePage) {
            // Suporte legado (Caso existam as IDs fixas antigas, atualiza-as)
            const elTotalOffline = document.getElementById('energia-total-offline');
            const elOfflineOther = document.getElementById('energia-offline-other');
            const elPowerOff = document.getElementById('energia-global-poweroff');
            
            if (elTotalOffline) elTotalOffline.textContent = globalTotalOffline;
            if (elOfflineOther) elOfflineOther.textContent = Math.max(0, globalTotalOffline - globalPowerOff);
            if (elPowerOff) elPowerOff.textContent = globalPowerOff;

            // Alvo do layout novo de Widescreen (Grid de Minicards e Resumo)
            const targetWidescreen = document.querySelector('#home-card-energia .widescreen-body');
            
            if (targetWidescreen) {
                let globalOfflineOther = Math.max(0, globalTotalOffline - globalPowerOff);
                
                // Inicia montando o Card Médio de Resumo Geral
                let htmlWidescreen = `
                    <div class="resumo-card">
                        <div>
                            <div class="resumo-title"><span class="material-symbols-rounded" style="font-size:16px;">power_off</span> Resumo Global</div>
                            <div class="resumo-main-val" style="color: var(--m3-color-warning);">${globalPowerOff}</div>
                            <div style="font-size: 0.8rem; color: var(--m3-on-surface-variant);">Sem Energia (Dying Gasp)</div>
                        </div>
                        <div class="resumo-sec-val">
                            <span>Falta de Sinal Óptico:</span>
                            <strong style="color: var(--m3-color-error); font-size: 1.1rem;">${globalOfflineOther}</strong>
                        </div>
                    </div>
                `;

                // Ordenar pelo maior número de clientes sem energia
                oltStats.sort((a, b) => b.powerOff - a.powerOff);

                // Montar os 17 minicards fluidos
                oltStats.forEach(stat => {
                    if (stat.powerOff > 0) {
                        htmlWidescreen += `
                            <div class="status-card warning"
                                 data-olt="${stat.id}"
                                 data-poweroff="${stat.powerOff}"
                                 data-offline="${stat.offline}"
                                 onmouseenter="handleEnergyHover(event)"
                                 onmouseleave="handleEnergyLeave()"
                                 onclick="handleEnergyClick(event)">
                                <span class="olt-name" style="pointer-events: none;">${stat.id}</span>
                                <span class="olt-value" style="pointer-events: none;">${stat.powerOff}</span>
                            </div>
                        `;
                    } else {
                        htmlWidescreen += `
                            <div class="status-card ok"
                                 data-olt="${stat.id}"
                                 data-poweroff="0"
                                 data-offline="${stat.offline}"
                                 onmouseenter="handleEnergyHover(event)"
                                 onmouseleave="handleEnergyLeave()"
                                 onclick="handleEnergyClick(event)">
                                <span class="olt-name" style="pointer-events: none;">${stat.id}</span>
                                <span class="material-symbols-rounded" style="pointer-events: none;">bolt</span>
                            </div>
                        `;
                    }
                });

                // Injeta o HTML limpo e dinâmico direto no Body do Widescreen
                targetWidescreen.innerHTML = htmlWidescreen;
            }
        }

        // ==============================================================================
        // INJEÇÃO DA PÁGINA ENERGIA.HTML (Cards individuais mantidos)
        // ==============================================================================
        if (isEnergyPage && gridEnergyPage) {
            gridEnergyPage.innerHTML = '';
            
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const o = oltStats.find(stats => stats.id === oltDef.id);
                if(!o) return;

                const btnHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button class="card-header-button" onclick="exportCardToImage(event, 'card-${o.id}', '${o.id}')" title="Exportar Card">
                            <span class="material-symbols-rounded">photo_camera</span>
                        </button>
                        <button class="card-header-button" onclick="window.openEnergySuperModal('${o.id}')" title="Detalhes de Energia">
                            <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                        </button>
                    </div>`;
                
                const dateParts = o.lastUpdate ? o.lastUpdate.split(' ') : ['--/--/----', '--:--:--'];
                const dateVal = dateParts[0] || '--/--/----';
                const timeVal = dateParts[1] || '--:--:--';

                gridEnergyPage.innerHTML += `
                    <div class="overview-card" id="card-${o.id}" style="display: flex; flex-direction: column; width: 100%;">
                        <div class="card-header" style="justify-content: space-between; width: 100%; box-sizing: border-box;">
                            <h3><span class="material-symbols-rounded">dns</span> ${o.id}</h3>
                            ${btnHtml}
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 16px 20px; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; width: 100%;">
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Total Offline">
                                        <span class="material-symbols-rounded" style="color:#f87171; font-size: 20px;">router_off</span>
                                        <span style="font-size: 1.2rem; color:#f87171; font-weight: bold; font-family: var(--font-family-mono);">${o.offline}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Falta de Sinal Óptico">
                                        <span class="material-symbols-rounded" style="color:#f97316; font-size: 20px;">wifi_off</span>
                                        <span style="font-size: 1.2rem; color:#f97316; font-weight: bold; font-family: var(--font-family-mono);">${o.offlineOther}</span>
                                    </div>
                                </div>
                                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;" title="Sem Energia">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:#fbbf24; font-size: 28px;">power_off</span>
                                        <span style="font-size: 2.2rem; font-family: var(--font-family-mono); font-weight: bold; color: #fbbf24; line-height: 1;">${o.powerOff}</span>
                                    </div>
                                    <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-top: 6px;">Sem Energia</span>
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
        console.error("Erro no motor de energia:", e);
    }
}

window.openEnergySuperModal = function(id) {
    const modal = document.getElementById('super-modal');
    if (!modal) return;
    
    window.CURRENT_ENERGY_OLT = id; 
    
    document.getElementById('super-modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${id}`; 
    document.getElementById('energy-view-detalhes').style.display = 'none';
    document.getElementById('energy-view-placas').style.display = 'block';
    
    modal.style.display = 'flex';
    populateEnergyModal(id);
}

function populateEnergyModal(oltId) {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    try {
        const oltData = window.ENERGY_DATA_STORE.olts[oltId];
        if (!oltData) return;
        
        const pltData = oltData.ports || {};

        const placasList = document.getElementById('energy-placas-list');
        if (placasList) placasList.innerHTML = '';

        for (let i = 1; i <= oltData.boards; i++) {
            const placaNum = i;
            const ports = pltData[placaNum] || {};
            
            let totalPowerOff = 0;
            for (const pt in ports) {
                totalPowerOff += ports[pt].powerOff;
            }

            let btnClass = 'placa-btn';
            let badgeHtml = '';
            
            if (totalPowerOff > 0) {
                btnClass += ' has-warning'; 
                badgeHtml = `<span class="alarm-count" style="background-color: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3);">${totalPowerOff} sem energia</span>`;
            }

            if (placasList) {
                placasList.innerHTML += `
                    <button class="${btnClass}" onclick="window.openEnergyPlacaDetails('${oltId}', '${placaNum}', '${oltData.type}')">
                        <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span>
                        Placa ${placaNum}
                        ${badgeHtml}
                    </button>
                `;
            }
        }
    } catch (error) {
        console.error('Erro ao popular modal de energia:', error);
    }
}

window.openEnergyPlacaDetails = function(oltId, placa, type) {
    window.CURRENT_ENERGY_PLACA = placa;
    
    document.getElementById('energy-view-placas').style.display = 'none';
    document.getElementById('energy-view-detalhes').style.display = 'block';
    
    const tbody = document.getElementById('energy-detalhes-tbody');
    tbody.innerHTML = '';
    
    const ports = window.ENERGY_DATA_STORE.olts[oltId]?.ports[placa] || {};
    const sortedPorts = Object.keys(ports).sort((a, b) => parseInt(a) - parseInt(b));
    
    if (sortedPorts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--m3-on-surface-variant);">Nenhuma porta com dados de energia nesta placa.</td></tr>`;
        return;
    }

    const rowsCircuitos = window.DATA_STORE.circuitos || [];
    const rowsLocalidades = window.DATA_STORE.localidades || [];

    sortedPorts.forEach(pt => {
        const { online, offline, powerOff, total } = ports[pt];
        const calcTotal = total || (online + offline);
        
        const info = DataMapper.getCircuitInfo(rowsCircuitos, { id: oltId, type: type }, placa, pt);
        const bairro = DataMapper.getBairroInfo(rowsLocalidades, oltId, placa, pt, type);
        
        const safeInfo = info.replace(/'/g, "\\'");
        const textoBairro = bairro && bairro !== '-' ? bairro : 'N/A';
        
        let statusClass = 'status-normal';
        let statusText = 'Normal';
        
        if (calcTotal > 0) {
            const perc = powerOff / calcTotal;
            if ((perc >= 0.5 && powerOff >= 10) || (perc === 1 && calcTotal >= 5)) {
                statusClass = 'status-critico';
                statusText = 'Crítico';
            } else if (perc >= 0.15 && powerOff >= 5) {
                statusClass = 'status-atencao';
                statusText = 'Atenção';
            }
        }

        tbody.innerHTML += `
            <tr>
                <td>Porta ${String(pt).padStart(2, '0')}</td>
                <td>
                    <span class="circuit-badge circuit-clickable" onclick="window.openEnergyPortClients('${placa}', '${pt}', '${safeInfo}', ${calcTotal}, ${offline}, ${powerOff})">
                        ${info}
                    </span>
                </td>
                <td style="font-family: var(--font-family-mono); font-size: 0.9rem; color: var(--m3-on-surface-variant);">${textoBairro}</td>
                <td>
                    <button class="status ${statusClass} status-btn" style="cursor: pointer;"
                        onclick="window.openEnergyPortClients('${placa}', '${pt}', '${safeInfo}', ${calcTotal}, ${offline}, ${powerOff})">
                        ${statusText}
                    </button>
                </td>
            </tr>
        `;
    });
};

window.openEnergyPortClients = function(placa, porta, circuitoNome, total, offline, powerOff) {
    let modal = document.getElementById('detail-modal');
    if (!modal) {
        const modalHTML = `
            <div id="detail-modal" class="modal-overlay" style="display: none;" onclick="closeModal(event)">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h3 id="modal-title" style="margin: 0; display: flex; align-items: center; gap: 8px;">Detalhes</h3>
                        <button class="close-modal" onclick="closeModal()" title="Fechar">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="modal-stats-grid" style="grid-template-columns: repeat(3, 1fr); gap: 10px;">
                            <div class="modal-stat-box" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                                <span id="modal-val-total" class="modal-stat-value" style="color: #ffffff;">0</span>
                                <span class="modal-stat-label">TOTAL</span>
                            </div>
                            <div class="modal-stat-box" style="background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2);">
                                <span id="modal-val-offline" class="modal-stat-value" style="color: #f87171;">0</span>
                                <span class="modal-stat-label">OFFLINE</span>
                            </div>
                            <div class="modal-stat-box" style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.2);">
                                <span id="modal-val-poweroff" class="modal-stat-value" style="color: #fbbf24;">0</span>
                                <span class="modal-stat-label">ENERGIA</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('detail-modal');
    }

    const textoCircuito = (circuitoNome && circuitoNome !== "-") ? ` - Circuito: ${circuitoNome}` : "";
    document.getElementById('modal-title').textContent = `Placa ${placa} / Porta ${porta}${textoCircuito}`;

    document.getElementById('modal-val-total').textContent = total;
    document.getElementById('modal-val-offline').textContent = offline;
    document.getElementById('modal-val-poweroff').textContent = powerOff;

    modal.style.display = 'flex';
};

window.closeModal = function(event) {
    if (event && event.target.id !== 'detail-modal' && !event.target.classList.contains('close-modal')) return;
    const modal = document.getElementById('detail-modal');
    if (modal) modal.style.display = 'none';
};

window.closeSuperModal = function(event) {
    if (event && event.target.id !== 'super-modal' && !event.target.classList.contains('close-modal')) return;
    const modal = document.getElementById('super-modal');
    if (modal) modal.style.display = 'none';
    window.CURRENT_ENERGY_OLT = null;
};

window.backToEnergyPlacas = function() {
    document.getElementById('energy-view-detalhes').style.display = 'none';
    document.getElementById('energy-view-placas').style.display = 'block';
};

document.addEventListener('DOMContentLoaded', () => {
    const isEnergyPage = window.location.pathname.includes('energia.html');
    
    if (isEnergyPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Alarmes de Energia", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        setTimeout(updateGlobalTimestamp, 500);
    }
});

window.addEventListener('dadosAtualizados', () => {
    runEnergyMonitoring();

    const modal = document.getElementById('super-modal');
    if (modal && modal.style.display === 'flex' && window.CURRENT_ENERGY_OLT) {
        populateEnergyModal(window.CURRENT_ENERGY_OLT);
        if (document.getElementById('energy-view-detalhes').style.display === 'block' && window.CURRENT_ENERGY_PLACA) {
            const oltDef = GLOBAL_MASTER_OLT_LIST.find(o => o.id === window.CURRENT_ENERGY_OLT);
            if (oltDef) window.openEnergyPlacaDetails(window.CURRENT_ENERGY_OLT, window.CURRENT_ENERGY_PLACA, oltDef.type);
        }
    }
});