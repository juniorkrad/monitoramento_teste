// ==============================================================================
// potencia-engine.js - Motor Dedicado para Análise de Potência Óptica
// Atualização: Wallboard da Home - Gráfico de Velocímetro (Pointer Gauge)
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
            <span style="color: var(--m3-on-surface-variant);">Zonas Críticas (<= -28):</span> 
            <strong style="color: var(--m3-color-error);">${el.dataset.criticos}</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Total de Leituras:</span> 
            <strong>${el.dataset.count}</strong>
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
            <span style="font-size: 1rem; color: var(--m3-on-surface-variant);">dBm</span>
        </div>
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between;">
            <div>
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Total de Leituras</span><br>
                <strong style="font-size: 1.2rem;">${el.dataset.count}</strong>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Sinal Crítico</span><br>
                <strong style="font-size: 1.2rem; color: var(--m3-color-error);">${el.dataset.criticos}</strong>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

function runPotenciaEngine() {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    const gridPotenciaPage = document.getElementById('potencia-olt-grid');
    const isPotenciaPage = window.location.pathname.includes('potencia.html');
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));

    if (!isPotenciaPage && !isHomePage) return;

    try {
        let globalSomaDbm = 0;
        let globalCountDbm = 0;
        let globalCriticos = 0;
        let oltStats = [];

        GLOBAL_MASTER_OLT_LIST.forEach((olt) => {
            const values = window.DATA_STORE.olts[olt.id] || [];
            const rows = values.slice(1);
            
            let somaDbm = 0;
            let countDbm = 0;
            let criticos = 0;

            rows.forEach(columns => {
                if (columns.length === 0) return;
                
                // Potência fica na Coluna F (Índice 5)
                let pVal = String(columns[5] || '').replace(/dbm/ig, '').replace(/,/g, '.').replace(/\s+/g, '');
                let dbm = parseFloat(pVal);
                
                if (!isNaN(dbm) && dbm < 0) { // Considera apenas valores válidos (negativos)
                    somaDbm += dbm;
                    countDbm++;
                    if (dbm <= -28) criticos++;
                }
            });

            let mediaDbm = countDbm > 0 ? (somaDbm / countDbm) : 0;
            
            globalSomaDbm += somaDbm;
            globalCountDbm += countDbm;
            globalCriticos += criticos;

            oltStats.push({ 
                id: olt.id, 
                media: mediaDbm, 
                criticos: criticos,
                count: countDbm
            });
        });

        let mediaGlobal = globalCountDbm > 0 ? (globalSomaDbm / globalCountDbm) : 0;

        // ==============================================================================
        // INJEÇÃO DA HOME (Wallboard Widescreen com Gráfico de Velocímetro)
        // ==============================================================================
        if (isHomePage) {
            const targetWidescreen = document.getElementById('target-potencia-widescreen');
            
            if (targetWidescreen) {
                targetWidescreen.className = 'card-body-layout'; // Aplica o novo formato dividido
                
                let htmlWidescreen = `
                    <div class="resumo-lateral" style="background: rgba(217, 70, 239, 0.05); border-color: rgba(217, 70, 239, 0.15);">
                        <div>
                            <div class="resumo-title"><span class="material-symbols-rounded" style="font-size:14px;">insights</span> Redes Ópticas</div>
                            <div style="margin-top: 10px;">
                                <span style="font-size: 0.7rem; color: var(--m3-on-surface-variant); text-transform: uppercase;">Média Geral</span>
                                <div style="font-family:'Roboto Mono', monospace; font-size: 2.2rem; font-weight: bold; color: var(--color-potencia); line-height: 1;">${mediaGlobal ? mediaGlobal.toFixed(1) : '--'} <span style="font-size:1rem; color: var(--m3-on-surface-variant);">dBm</span></div>
                            </div>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--m3-on-surface-variant); border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
                            Atenção Óptica: <strong style="color:var(--m3-color-warning)">${globalCriticos}</strong>
                        </div>
                    </div>
                    <div class="grafico-lateral">
                        <div class="potencia-chart-area">
                `;

                // Seleciona as 3 piores OLTs (menores médias ex: -28 < -20) para exibir os velocímetros
                let worstOlts = oltStats.filter(stat => stat.count > 0).sort((a, b) => a.media - b.media).slice(0, 3);
                
                if (worstOlts.length === 0) {
                    htmlWidescreen += `<div style="color: var(--m3-on-surface-variant); font-size: 0.9rem; text-align: center; width: 100%;">Nenhum dado de potência óptica disponível.</div>`;
                } else {
                    worstOlts.forEach(stat => {
                        const mediaVal = stat.media;
                        
                        let angle = 0;
                        let color = 'var(--m3-color-success)';
                        let label = 'Ótimo';
                        
                        // Lógica de Rotação do Ponteiro (Mapeando de 0 a 220 graus baseando-se no viewBox)
                        if (mediaVal <= -28) {
                            color = 'var(--m3-color-error)';
                            label = 'Crítico';
                            // Mapeia -33 a -28 para 5 a 50 graus
                            angle = Math.max(5, 50.4 - ((Math.abs(mediaVal) - 28) * 9));
                        } else if (mediaVal < -25) {
                            color = 'var(--m3-color-warning)';
                            label = 'Atenção';
                            // Mapeia -28 a -25 para 50.4 a 108.4 graus
                            angle = 50.4 + ((mediaVal - (-28)) * 19.33); 
                        } else {
                            color = 'var(--m3-color-success)';
                            label = 'Ótimo';
                            // Mapeia -25 a -15 para 108.4 a 220 graus
                            angle = 108.4 + ((mediaVal - (-25)) * 11.16); 
                        }
                        
                        // Limites físicos do arco do SVG
                        if (angle < 0) angle = 0;
                        if (angle > 220) angle = 220;

                        htmlWidescreen += `
                            <div class="olt-gauge-box" 
                                 data-olt="${stat.id}" 
                                 data-media="${mediaVal.toFixed(1)}" 
                                 data-criticos="${stat.criticos}" 
                                 data-count="${stat.count}" 
                                 data-color="${color}"
                                 onmouseenter="handlePotHover(event)"
                                 onmouseleave="handlePotLeave()"
                                 onclick="handlePotClick(event)"
                                 style="cursor: pointer;">
                                <svg width="110" height="110" viewBox="0 0 100 100" style="transform: rotate(-225deg);">
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--m3-color-error)" stroke-width="6" stroke-dasharray="35 250" stroke-dashoffset="0"></circle>
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--m3-color-warning)" stroke-width="6" stroke-dasharray="40 250" stroke-dashoffset="-35"></circle>
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--m3-color-success)" stroke-width="6" stroke-dasharray="80 250" stroke-dashoffset="-75"></circle>
                                    
                                    <line x1="50" y1="50" x2="50" y2="15" stroke="#ffffff" stroke-width="3" stroke-linecap="round" style="transform: rotate(${angle}deg); transform-origin: 50px 50px; filter: drop-shadow(0 0 4px #fff); transition: transform 1.5s cubic-bezier(0.22, 1, 0.36, 1);"/>
                                    <circle cx="50" cy="50" r="5" fill="#ffffff"></circle>
                                </svg>
                                <div class="gauge-inner-text">
                                    <span style="font-family:'Roboto Mono', monospace; font-size: 1.1rem; font-weight: bold;">${mediaVal.toFixed(1)}</span>
                                    <span style="font-size: 0.55rem; color: ${color}; text-transform: uppercase; font-weight: bold;">${label}</span>
                                </div>
                                <span class="olt-gauge-label">${stat.id}</span>
                            </div>
                        `;
                    });
                }

                htmlWidescreen += `
                        </div>
                    </div>
                `;
                
                targetWidescreen.innerHTML = htmlWidescreen;
            }
        }

        // ==============================================================================
        // INJEÇÃO DA PÁGINA POTENCIA.HTML (Cards individuais mantidos originais)
        // ==============================================================================
        if (isPotenciaPage && gridPotenciaPage) {
            gridPotenciaPage.innerHTML = '';
            
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const o = oltStats.find(stats => stats.id === oltDef.id);
                if(!o) return;

                const btnHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button class="card-header-button" onclick="window.openPotenciaSuperModal('${o.id}')" title="Detalhes de Potência">
                            <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                        </button>
                    </div>`;

                let statusCor = 'var(--m3-color-success)';
                if (o.media <= -28) statusCor = 'var(--m3-color-error)';
                else if (o.media < -25) statusCor = 'var(--m3-color-warning)';

                gridPotenciaPage.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column; width: 100%;">
                        <div class="card-header" style="justify-content: space-between; width: 100%; box-sizing: border-box;">
                            <h3><span class="material-symbols-rounded" style="color: var(--color-potencia);">dns</span> ${o.id}</h3>
                            ${btnHtml}
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 16px 20px; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; width: 100%;">
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Clientes Críticos">
                                        <span class="material-symbols-rounded" style="color:#f87171; font-size: 20px;">warning</span>
                                        <span style="font-size: 1.2rem; color:#f87171; font-weight: bold; font-family: var(--font-family-mono);">${o.criticos}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Leituras Totais">
                                        <span class="material-symbols-rounded" style="color:var(--m3-on-surface-variant); font-size: 20px;">bar_chart</span>
                                        <span style="font-size: 1.2rem; color:var(--m3-on-surface-variant); font-weight: bold; font-family: var(--font-family-mono);">${o.count}</span>
                                    </div>
                                </div>
                                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;" title="Média OLT">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:${statusCor}; font-size: 28px;">speed</span>
                                        <span style="font-size: 2.2rem; font-family: var(--font-family-mono); font-weight: bold; color: ${statusCor}; line-height: 1;">${o.media.toFixed(1)}</span>
                                    </div>
                                    <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-top: 6px;">Média dBm</span>
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

window.openPotenciaSuperModal = function(id) {
    const modal = document.getElementById('super-modal');
    if (!modal) return;
    
    window.CURRENT_POTENCIA_CONFIG = id; 
    
    document.getElementById('super-modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${id}`; 
    document.getElementById('potencia-view-detalhes').style.display = 'none';
    document.getElementById('potencia-view-placas').style.display = 'block';
    
    modal.style.display = 'flex';
    populatePotenciaModal(id);
}

function populatePotenciaModal(oltId) {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    try {
        const dataOlt = window.DATA_STORE.olts[oltId] || [];
        const rowsOlt = dataOlt.slice(1);
        const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
        if (!oltConfig) return;

        window.POTENCIA_PORT_DATA = {};
        window.POTENCIA_CLIENTS_DATA = {};

        const rowsCircuitos = window.DATA_STORE.circuitos || [];

        rowsOlt.forEach(columns => {
            if (columns.length === 0) return;
            
            const portInfo = DataMapper.extractPort(columns[0], oltConfig.type);
            if (!portInfo) return;
            
            const { placa, porta } = portInfo;
            const placaNum = parseInt(placa);
            const portaNum = parseInt(porta);
            const portKey = `${placaNum}/${portaNum}`;
            
            let pVal = String(columns[5] || '').replace(/dbm/ig, '').replace(/,/g, '.').replace(/\s+/g, '');
            let dbm = parseFloat(pVal);

            if (isNaN(dbm) || dbm >= 0) return; 

            if (!window.POTENCIA_PORT_DATA[placaNum]) {
                window.POTENCIA_PORT_DATA[placaNum] = {};
            }

            if (!window.POTENCIA_PORT_DATA[placaNum][portaNum]) {
                const infoExtra = DataMapper.getCircuitInfo(rowsCircuitos, oltConfig, placa, porta);
                window.POTENCIA_PORT_DATA[placaNum][portaNum] = { soma: 0, count: 0, criticos: 0, info: infoExtra };
                window.POTENCIA_CLIENTS_DATA[portKey] = [];
            }

            window.POTENCIA_PORT_DATA[placaNum][portaNum].soma += dbm;
            window.POTENCIA_PORT_DATA[placaNum][portaNum].count++;
            if (dbm <= -28) window.POTENCIA_PORT_DATA[placaNum][portaNum].criticos++;

            let serialVal = oltConfig.type === 'nokia' ? columns[2] : columns[3];
            let codigoVal = oltConfig.type === 'nokia' ? columns[8] : columns[7];

            window.POTENCIA_CLIENTS_DATA[portKey].push({
                serial: String(serialVal || '').trim(),
                codigo: String(codigoVal || '').trim(),
                dbm: dbm
            });
        });

        const placasList = document.getElementById('potencia-placas-list');
        if (placasList) placasList.innerHTML = '';

        for (let i = 1; i <= oltConfig.boards; i++) {
            const placaNum = i;
            const ports = window.POTENCIA_PORT_DATA[placaNum] || {};
            
            let hasCritical = false;
            let totalCriticos = 0;

            for (const pt in ports) {
                totalCriticos += ports[pt].criticos;
                if (ports[pt].criticos > 0) hasCritical = true;
            }

            let btnClass = 'placa-btn';
            let badgeHtml = '';
            
            if (hasCritical) {
                btnClass += ' has-alarm';
                badgeHtml = `<span class="alarm-count critico">${totalCriticos} crítico(s)</span>`;
            }

            if (placasList) {
                placasList.innerHTML += `
                    <button class="${btnClass}" onclick="window.openPotenciaPlacaDetails('${placaNum}', '${oltConfig.type}')">
                        <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span>
                        Placa ${placaNum}
                        ${badgeHtml}
                    </button>
                `;
            }
        }
    } catch (error) {
        console.error('Erro ao popular modal de potência:', error);
    }
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
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--m3-on-surface-variant);">Nenhuma porta ativa com leitura de potência nesta placa.</td></tr>`;
        return;
    }

    sortedPorts.forEach(pt => {
        const { soma, count, criticos, info } = ports[pt];
        const media = count > 0 ? (soma / count) : 0;
        
        let statusClass = 'status-normal';
        let statusText = 'Normal';

        if (media <= -28 || criticos >= 5) { 
            statusClass = 'status-critico'; statusText = 'Crítico'; 
        } else if (media < -25 || criticos > 0) { 
            statusClass = 'status-atencao'; statusText = 'Atenção'; 
        }

        const safeInfo = info.replace(/'/g, "\\'");

        tbody.innerHTML += `
            <tr>
                <td>Porta ${String(pt).padStart(2, '0')}</td>
                <td>
                    <span class="circuit-badge circuit-clickable" 
                          onclick="window.openPotenciaClients('${placa}', '${pt}', '${safeInfo}')"
                          title="Ver clientes deste circuito">
                        ${info}
                    </span>
                </td>
                <td style="font-family: var(--font-family-mono); font-size: 0.95rem; font-weight: bold;">
                    ${media.toFixed(1)} <span style="font-size: 0.7rem; color: var(--m3-on-surface-variant);">dBm</span>
                </td>
                <td>
                    <button class="status ${statusClass} status-btn" style="cursor: pointer;"
                        onclick="window.openPotenciaClients('${placa}', '${pt}', '${safeInfo}')">
                        ${statusText}
                    </button>
                </td>
            </tr>
        `;
    });
}

window.openPotenciaClients = function(placa, porta, circuitoNome) {
    const modal = document.getElementById('detail-modal');
    
    document.getElementById('modal-title').innerHTML = `<span class="material-symbols-rounded" style="margin-right: 8px;">insights</span> Detalhes Potência: Placa ${placa} / Porta ${porta} - ${circuitoNome}`;

    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = '';

    const portKey = `${placa}/${porta}`;
    const clients = window.POTENCIA_CLIENTS_DATA[portKey] || [];

    if (clients.length === 0) {
        tbody.innerHTML = `<tr><td style="text-align:center; padding: 20px;">Nenhum cliente encontrado.</td></tr>`;
    } else {
        // Ordenar dos piores (mais negativos) para os melhores
        clients.sort((a, b) => a.dbm - b.dbm).forEach(c => {
            let statusClass = 'filter-online'; // Reutilizando classes CSS do motor geral para cores
            let iconColor = 'var(--m3-color-success)';
            
            if (c.dbm <= -28) {
                statusClass = 'filter-offline'; // Vermelho
                iconColor = 'var(--m3-color-error)';
            } else if (c.dbm < -25) {
                statusClass = 'filter-unknown'; // Amarelo
                iconColor = 'var(--m3-color-warning)';
            }
            
            let rowHTML = `
                <tr class="client-row ${statusClass}">
                    <td style="padding: 15px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; gap: 20px; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span class="material-symbols-rounded" style="color: var(--m3-color-primary);">barcode</span> 
                                    <strong style="font-family: var(--font-family-mono); font-size: 1.05rem;">${c.serial || 'N/A'}</strong>
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span class="material-symbols-rounded" style="color: var(--m3-color-primary);">deployed_code_account</span> 
                                    <strong style="font-family: var(--font-family-mono); font-size: 1.05rem;">${c.codigo || 'N/A'}</strong>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; font-family: var(--font-family-mono); font-size: 1.15rem; font-weight: bold; color: ${iconColor};">
                                ${c.dbm.toFixed(1)} <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant);">dBm</span>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            tbody.innerHTML += rowHTML;
        });
    }
    modal.style.display = 'flex';
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

    if (window.CURRENT_POTENCIA_CONFIG && typeof window.populatePotenciaModal === 'function') {
        window.populatePotenciaModal(window.CURRENT_POTENCIA_CONFIG);
        
        if (document.getElementById('potencia-view-detalhes') && document.getElementById('potencia-view-detalhes').style.display === 'block' && window.CURRENT_VIEW_PLACA) {
            const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === window.CURRENT_POTENCIA_CONFIG);
            if (oltConfig) window.openPotenciaPlacaDetails(window.CURRENT_VIEW_PLACA, oltConfig.type);
        }
    }
});