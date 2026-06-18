// ==============================================================================
// energia-engine.js - Motor Dedicado de Monitorização de Energia (Dying Gasp)
// Atualização: Separação Estrita (Caminho 2) e Integração com Buscador Central
// ==============================================================================

window.ENERGY_DATA_STORE = {};
window.NETWORK_ENERGY_STORE = new Set(); 
window.CURRENT_ENERGY_OLT = null; 
window.CURRENT_ENERGY_PLACA = null; 
let energyChartInstance = null; 

function extractEnergyPort(val) {
    if (!val) return null;
    let s = String(val).replace(/gpon/i, '').replace(/\\/g, '/').trim();
    s = s.replace(/[^0-9]+$/, ''); 
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
        oltName = titleEl.innerText.replace('electric_bolt', '').trim();
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
        if (cols.length >= 5) {
            const porta = cols[0].innerText.trim();
            const circuito = cols[1].innerText.trim();
            const online = cols[2].innerText.trim();
            const offline = cols[3].innerText.trim();
            const powerOff = cols[4].innerText.trim();
            
            txtContent += `• ${porta.padEnd(10, ' ')} | Circuito: ${circuito.padEnd(20, ' ')} | ON: ${online.padEnd(4, ' ')} | OFF: ${offline.padEnd(4, ' ')} | PowerOff: ${powerOff}\n`;
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
    const globalBody = document.getElementById('global-energia-body');
    
    const isEnergyPage = window.location.pathname.includes('energia.html');
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));

    if (!isHomePage && globalBody) {
        globalBody.style.display = 'none';
    }

    if (!isEnergyPage && !isHomePage) return;

    try {
        let globalPowerOff = 0;
        let globalTotalClients = 0;
        let globalTotalOffline = 0;
        let oltsAffected = 0;
        let oltStats = [];

        window.ENERGY_DATA_STORE = { global: null, olts: {} };
        window.NETWORK_ENERGY_STORE.clear(); 

        GLOBAL_MASTER_OLT_LIST.forEach((olt) => {
            const values = window.DATA_STORE.olts[olt.id] || [];
            const rows = values.slice(1);
            let oltPowerOff = 0, oltOnline = 0, oltOffline = 0;
            let lastUpdateStr = '--/--/---- --:--:--';
            
            const portDataTemp = {}; 

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
                const portInfo = extractEnergyPort(columns[0]);
                
                if (!portInfo) return;

                if (isOnline) oltOnline++; else oltOffline++;

                const desc1 = (columns[7] || '').toLowerCase();
                const desc2 = (columns[8] || '').toLowerCase();
                const isDyingGasp = desc1.includes('dyinggasp') || desc1.includes('dying gasp') || 
                                    desc2.includes('dyinggasp') || desc2.includes('dying gasp');

                if (isDyingGasp && !isOnline) {
                    oltPowerOff++;
                }

                if (!portDataTemp[portInfo.placa]) portDataTemp[portInfo.placa] = {};
                if (!portDataTemp[portInfo.placa][portInfo.porta]) {
                    portDataTemp[portInfo.placa][portInfo.porta] = { online: 0, offline: 0, powerOff: 0 };
                }

                if (isOnline) portDataTemp[portInfo.placa][portInfo.porta].online++;
                else {
                    portDataTemp[portInfo.placa][portInfo.porta].offline++;
                    if (isDyingGasp) portDataTemp[portInfo.placa][portInfo.porta].powerOff++;
                }
            });

            globalPowerOff += oltPowerOff;
            globalTotalClients += (oltOnline + oltOffline);
            globalTotalOffline += oltOffline;
            if (oltPowerOff > 0) oltsAffected++;

            oltStats.push({ id: olt.id, online: oltOnline, offline: oltOffline, powerOff: oltPowerOff, lastUpdate: lastUpdateStr });
            
            window.ENERGY_DATA_STORE.olts[olt.id] = {
                powerOff: oltPowerOff, totalClients: (oltOnline + oltOffline), ports: portDataTemp
            };
        });

        window.ENERGY_DATA_STORE.global = {
            powerOff: globalPowerOff, totalClients: globalTotalClients,
            totalOffline: globalTotalOffline, oltsAffected: oltsAffected
        };

        if (globalBody && isHomePage) {
            globalBody.style.display = 'flex'; 
            
            const loadingEl = document.getElementById('global-energia-loading');
            const contentEl = document.getElementById('global-energia-content');
            
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'flex';

            const impactoRede = globalTotalClients > 0 
                ? ((globalPowerOff / globalTotalClients) * 100).toFixed(1) 
                : 0;
            const relativoOff = globalTotalOffline > 0 
                ? ((globalPowerOff / globalTotalOffline) * 100).toFixed(1) 
                : 0;

            const poEl = document.getElementById('energia-global-poweroff');
            const afEl = document.getElementById('energia-olts-afetadas');
            const toEl = document.getElementById('energia-olts-total');
            const irEl = document.getElementById('energia-impacto-rede');
            const roEl = document.getElementById('energia-relativo-off');

            if (poEl) poEl.textContent = globalPowerOff;
            if (afEl) afEl.textContent = oltsAffected;
            if (toEl) toEl.textContent = GLOBAL_MASTER_OLT_LIST.length;
            if (irEl) irEl.textContent = `${impactoRede}%`;
            if (roEl) roEl.textContent = `${relativoOff}%`;
        }

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
                        <button class="card-header-button" onclick="window.openEnergySuperModal('${o.id}', '${oltDef.sheetTab}', '${oltDef.type}', ${oltDef.boards})" title="Detalhes de Energia">
                            <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                        </button>
                    </div>`;
                
                const dateParts = o.lastUpdate ? o.lastUpdate.split(' ') : ['--/--/----', '--:--:--'];
                const dateVal = dateParts[0] || '--/--/----';
                const timeVal = dateParts[1] || '--:--:--';
                
                const showPulse = o.powerOff >= 10 ? 'pulse-energy' : '';

                gridEnergyPage.innerHTML += `
                    <div class="overview-card ${showPulse}" id="card-${o.id}" style="display: flex; flex-direction: column; width: 100%;">
                        <div class="card-header" style="justify-content: space-between; width: 100%; box-sizing: border-box;">
                            <h3><span class="material-symbols-rounded">electric_bolt</span> ${o.id}</h3>
                            ${btnHtml}
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 16px 20px; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; width: 100%;">
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Online">
                                        <span class="material-symbols-rounded" style="color:var(--m3-color-success); font-size: 18px;">check_circle</span>
                                        <span style="font-size: 1.1rem; color:var(--m3-on-surface); font-weight: 500;">${o.online}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Offline Geral">
                                        <span class="material-symbols-rounded" style="color:#f87171; font-size: 18px;">router_off</span>
                                        <span style="font-size: 1.1rem; color:var(--m3-on-surface); font-weight: 500;">${o.offline}</span>
                                    </div>
                                </div>
                                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
                                    <span style="font-size: 2.5rem; font-family: var(--font-family-mono); font-weight: bold; color: #fbbf24; line-height: 1;">${o.powerOff}</span>
                                    <span style="font-size: 0.75rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-top: 5px;">Power Off</span>
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

window.openEnergySuperModal = function(id, sheetTab, type, boards) {
    const modal = document.getElementById('energy-super-modal');
    if (!modal) return;
    
    window.CURRENT_ENERGY_OLT = id; // Salva o ID monitorado globalmente
    
    document.getElementById('super-modal-title').innerHTML = `<span class="material-symbols-rounded">electric_bolt</span> ${id}`;
    document.getElementById('energy-view-detalhes').style.display = 'none';
    document.getElementById('energy-view-placas').style.display = 'block';
    
    modal.style.display = 'flex';
    populateEnergyModal(id, sheetTab, type, boards);
}

function populateEnergyModal(oltId, sheetTab, type, boards) {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    try {
        const rowsCircuitos = window.DATA_STORE.circuitos || [];
        const pltData = window.ENERGY_DATA_STORE.olts[oltId]?.ports || {};

        const placasList = document.getElementById('energy-placas-list');
        if (placasList) placasList.innerHTML = '';

        for (let i = 1; i <= boards; i++) {
            const placaNum = i;
            const ports = pltData[placaNum] || {};
            
            let totalPowerOff = 0;
            for (const pt in ports) {
                totalPowerOff += ports[pt].powerOff;
            }

            let btnClass = 'placa-btn';
            let badgeHtml = '';
            
            if (totalPowerOff > 0) {
                btnClass += ' has-energy-alarm'; 
                badgeHtml = `<span class="alarm-count" style="background:#fbbf24; color:#000;">${totalPowerOff} Sinais</span>`;
            }

            if (placasList) {
                placasList.innerHTML += `
                    <button class="${btnClass}" onclick="window.openEnergyPlacaDetails('${oltId}', '${placaNum}', '${type}')">
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
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--m3-on-surface-variant);">Nenhuma porta com dados de energia nesta placa.</td></tr>`;
        return;
    }

    const rowsCircuitos = window.DATA_STORE.circuitos || [];

    sortedPorts.forEach(pt => {
        const { online, offline, powerOff } = ports[pt];
        const info = DataMapper.getCircuitInfo(rowsCircuitos, { id: oltId }, placa, pt);
        
        let powerColor = 'var(--m3-on-surface)';
        if (powerOff > 0) powerColor = '#fbbf24'; 

        const safeInfo = info.replace(/'/g, "\\'");

        tbody.innerHTML += `
            <tr>
                <td>Porta ${String(pt).padStart(2, '0')}</td>
                <td>
                    <span class="circuit-badge circuit-clickable" onclick="window.openEnergyPortClients('${placa}', '${pt}', '${safeInfo}', ${online}, ${offline}, ${powerOff})">
                        ${info}
                    </span>
                </td>
                <td style="color: var(--m3-color-success); font-weight: bold;">${online}</td>
                <td style="color: #f87171; font-weight: bold;">${offline}</td>
                <td><strong style="color: ${powerColor}; font-size: 1.1rem;">${powerOff}</strong></td>
            </tr>
        `;
    });
};

window.openEnergyPortClients = function(placa, porta, circuitoNome, online, offline, powerOff) {
    const modal = document.getElementById('energy-port-modal');
    if (!modal) return;

    const textoCircuito = (circuitoNome && circuitoNome !== "-") ? ` - Circuito: ${circuitoNome}` : "";
    document.getElementById('energy-port-title').textContent = `Placa ${placa} / Porta ${porta}${textoCircuito}`;

    document.getElementById('energy-modal-online').textContent = online;
    document.getElementById('energy-modal-offline').textContent = offline;
    document.getElementById('energy-modal-poweroff').textContent = powerOff;

    modal.style.display = 'flex';
};

window.closeEnergyPortModal = function(event) {
    if (event && event.target.id !== 'energy-port-modal' && !event.target.classList.contains('close-modal')) return;
    const modal = document.getElementById('energy-port-modal');
    if (modal) modal.style.display = 'none';
};

window.closeEnergyModal = function(event) {
    if (event && event.target.id !== 'energy-detail-modal' && !event.target.classList.contains('close-modal')) return;
    document.getElementById('energy-detail-modal').style.display = 'none';
};

window.backToEnergyPlacas = function() {
    document.getElementById('energy-view-detalhes').style.display = 'none';
    document.getElementById('energy-view-placas').style.display = 'block';
};

// OUVINTE DO BUSCADOR CENTRAL
window.addEventListener('dadosAtualizados', () => {
    runEnergyMonitoring();

    // Atualização em tempo real do modal de sub-placas caso esteja aberto
    const modal = document.getElementById('energy-super-modal');
    if (modal && modal.style.display === 'flex' && window.CURRENT_ENERGY_OLT) {
        const oltDef = GLOBAL_MASTER_OLT_LIST.find(o => o.id === window.CURRENT_ENERGY_OLT);
        if (oltDef) {
            populateEnergyModal(oltDef.id, oltDef.sheetTab, oltDef.type, oltDef.boards);
            if (document.getElementById('energy-view-detalhes').style.display === 'block' && window.CURRENT_ENERGY_PLACA) {
                window.openEnergyPlacaDetails(oltDef.id, window.CURRENT_ENERGY_PLACA, oltDef.type);
            }
        }
    }
});