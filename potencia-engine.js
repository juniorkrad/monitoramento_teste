// ==============================================================================
// potencia-engine.js - Motor Dedicado para Análise de Potência Óptica
// Atualização: Wallboard da Home - Grelha 100% com Micro-Velocímetros SVG
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

            oltStats.push({ 
                id: olt.id, 
                media: mediaDbm, 
                criticos: criticos,
                count: countDbm
            });
        });

        // ==============================================================================
        // INJEÇÃO DA HOME (Wallboard Widescreen com Grelha 100% de Velocímetros SVG)
        // ==============================================================================
        if (isHomePage) {
            const targetWidescreen = document.getElementById('target-potencia-widescreen');
            
            if (targetWidescreen) {
                // Removemos os paddings/gaps de divisão do card antigo, a grelha toma 100% do espaço
                targetWidescreen.className = ''; 
                targetWidescreen.style.cssText = 'padding: 20px; width: 100%; display: flex; align-items: center; justify-content: center; height: calc(100% - 60px); box-sizing: border-box;';
                
                let htmlWidescreen = `<div class="grid-17-cards">`;

                // Ordena alfabeticamente para a apresentação ser padronizada
                const sortedOlts = [...oltStats].sort((a, b) => a.id.localeCompare(b.id));

                if (sortedOlts.length === 0) {
                    htmlWidescreen += `<div style="grid-column: 1 / -1; text-align: center; color: var(--m3-on-surface-variant); width: 100%;">Nenhum dado de potência óptica disponível.</div>`;
                } else {
                    sortedOlts.forEach(stat => {
                        const mediaVal = stat.media;
                        
                        let color = 'var(--m3-color-success)';
                        let bgWarningStyle = ''; // Fundo de destaque se houver alarmes
                        
                        if (mediaVal <= -28) {
                            color = 'var(--m3-color-error)';
                            bgWarningStyle = 'background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2);';
                        } else if (mediaVal < -25) {
                            color = 'var(--m3-color-warning)';
                        }

                        // Matemática do Velocímetro: -32 dBm (0 graus, Esquerda) até -15 dBm (180 graus, Direita)
                        // Calculando a angulação e o preenchimento do arco SVG
                        let angle = (mediaVal + 32) * (180 / 17);
                        if (angle < 0) angle = 0;
                        if (angle > 180) angle = 180;

                        // Comprimento do arco visível (126 é o comprimento total de meia-circunferência r=40)
                        let fillLength = 126 * (angle / 180);

                        htmlWidescreen += `
                            <div class="mini-status-card" 
                                 style="${bgWarningStyle}"
                                 data-olt="${stat.id}" 
                                 data-media="${mediaVal.toFixed(1)}" 
                                 data-criticos="${stat.criticos}" 
                                 data-count="${stat.count}" 
                                 data-color="${color}"
                                 onmouseenter="handlePotHover(event)"
                                 onmouseleave="handlePotLeave()"
                                 onclick="handlePotClick(event)">
                                
                                <span class="mini-card-title" style="color: ${mediaVal <= -28 ? color : '#fff'};">${stat.id}</span>
                                <span class="mini-card-value" style="color: ${color};">${mediaVal !== 0 ? mediaVal.toFixed(1) : '--'}</span>
                                
                                <svg class="micro-gauge-svg" viewBox="0 0 100 50">
                                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8" stroke-dasharray="126" stroke-dashoffset="0" stroke-linecap="round"/>
                                    <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${fillLength} 126" stroke-dashoffset="0" stroke-linecap="round"/>
                                    <g style="transform: rotate(${angle}deg); transform-origin: 50px 50px; transition: transform 1s ease;">
                                        <line x1="50" y1="50" x2="16" y2="50" stroke="#fff" stroke-width="4" stroke-linecap="round" filter="drop-shadow(0 0 3px rgba(255,255,255,0.5))"/>
                                    </g>
                                </svg>
                            </div>
                        `;
                    });

                    // Caso a rede possua as 17 OLTs exatas, insere um card invisível 
                    // para manter a simetria da grelha que possui 9 colunas (9 em cima, 8 em baixo centralizadas)
                    if (sortedOlts.length === 17) {
                        htmlWidescreen += `<div class="mini-status-card" style="opacity: 0.1; background: transparent; border: none; cursor: default; pointer-events: none;"></div>`;
                    }
                }

                htmlWidescreen += `</div>`;
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
                                        <span style="font-size: 2.2rem; font-family: var(--font-family-mono); font-weight: bold; color: ${statusCor}; line-height: 1;">${o.media !== 0 ? o.media.toFixed(1) : '--'}</span>
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

    if (window.CURRENT_POTENCIA_CONFIG && typeof window.updatePotenciaModal === 'function') {
        window.updatePotenciaModal();
        
        if (document.getElementById('potencia-view-detalhes') && document.getElementById('potencia-view-detalhes').style.display === 'block' && window.CURRENT_VIEW_PLACA) {
            const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === window.CURRENT_POTENCIA_CONFIG);
            if (oltConfig) window.openPotenciaPlacaDetails(window.CURRENT_VIEW_PLACA, oltConfig.type);
        }
    }
});