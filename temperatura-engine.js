// ==============================================================================
// temperatura-engine.js - Motor Dedicado para Análise Térmica das OLTs
// Atualização: Wallboard da Home - Gráfico de Colunas Verticais (Bar Chart Ortodoxo)
// ==============================================================================

const TAB_TEMPERATURA = 'TEMPERATURA'; 

const MAPA_COLUNAS_TEMP = {
    'HEL-1': 0, 'HEL-2': 6, 'MGP': 12, 'PQA-1': 18, 'PSV-1': 24, 'PSV-7': 30, 
    'SBO-1': 36, 'SBO-2': 42, 'SBO-3': 48, 'SBO-4': 54, 'LTXV-1': 60, 
    'LTXV-2': 66, 'PQA-2': 72, 'PQA-3': 78, 'SB-1': 84, 'SB-2': 90, 'SB-3': 96
};

window.TEMP_DATA_STORE = {}; 
window.CURRENT_VIEW_SLOT = null; 
window.CURRENT_TEMP_OLT = null; 

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
}

window.handleTempHover = function(event) {
    if (isMobileDevice()) return;
    const tooltip = document.getElementById('smart-tooltip');
    if (!tooltip) return;

    const el = event.currentTarget;
    const temp = parseFloat(el.dataset.temp);
    
    let statusTexto = 'Normal';
    let statusCor = 'var(--m3-color-success)';
    
    if (temp >= 65) {
        statusTexto = 'Crítico (Superaquecimento)';
        statusCor = 'var(--m3-color-error)';
    } else if (temp >= 50) {
        statusTexto = 'Atenção (Aquecimento)';
        statusCor = 'var(--m3-color-warning)';
    }

    tooltip.innerHTML = `
        <div class="smart-tooltip-title">
            <span class="material-symbols-rounded" style="font-size: 18px; color: ${statusCor};">device_thermostat</span>
            ${el.dataset.olt}
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Pico Térmico:</span> 
            <strong style="font-family: var(--font-family-mono); color: ${statusCor};">${temp > 0 ? temp + '°C' : '--'}</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Status:</span> 
            <strong style="color: ${statusCor};">${statusTexto}</strong>
        </div>
    `;

    const rect = el.getBoundingClientRect();
    tooltip.style.left = (rect.left + (rect.width / 2) + window.scrollX) + 'px';
    tooltip.style.top = (rect.top + window.scrollY) + 'px';
    tooltip.style.opacity = 1;
};

window.handleTempLeave = function() {
    const tooltip = document.getElementById('smart-tooltip');
    if (tooltip) tooltip.style.opacity = 0;
};

window.handleTempClick = function(event) {
    if (!isMobileDevice()) return;
    const modal = document.getElementById('mobile-fast-modal');
    const content = document.getElementById('fast-modal-content');
    if (!modal || !content) return;

    const el = event.currentTarget;
    const temp = parseFloat(el.dataset.temp);
    
    let statusTexto = 'Normal';
    let statusCor = 'var(--m3-color-success)';
    
    if (temp >= 65) {
        statusTexto = 'Crítico';
        statusCor = 'var(--m3-color-error)';
    } else if (temp >= 50) {
        statusTexto = 'Atenção';
        statusCor = 'var(--m3-color-warning)';
    }

    content.innerHTML = `
        <h3 style="margin-top: 0; border-bottom: 1px solid var(--m3-outline); padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: ${statusCor};">device_thermostat</span> ${el.dataset.olt}
        </h3>
        <div style="margin-bottom: 15px; text-align: center;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Pico Térmico</span><br>
            <strong style="font-size: 2.5rem; font-family: var(--font-family-mono); color: ${statusCor}; line-height: 1;">${temp > 0 ? temp : '--'}</strong>
            <span style="font-size: 1rem; color: var(--m3-on-surface-variant);">°C</span>
        </div>
        <div style="margin-bottom: 15px; text-align: center;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Status</span><br>
            <strong style="font-size: 1.2rem; color: ${statusCor}; text-transform: uppercase;">${statusTexto}</strong>
        </div>
    `;
    modal.style.display = 'flex';
};

function runTemperaturaEngine() {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    const gridTemperaturaPage = document.getElementById('temperatura-olt-grid');
    const isTemperaturaPage = window.location.pathname.includes('temperatura.html');
    const isHomePage = typeof checkIsHomePage === 'function' ? checkIsHomePage() : (window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html'));

    if (!isTemperaturaPage && !isHomePage) return;

    try {
        const rowsTemp = window.DATA_STORE.temperatura ? window.DATA_STORE.temperatura.slice(1) : [];
        let oltStats = [];

        GLOBAL_MASTER_OLT_LIST.forEach(olt => {
            let maxTemp = 0;
            let criticos = 0;
            let count = 0;

            const colBase = MAPA_COLUNAS_TEMP[olt.id];
            
            if (colBase !== undefined && rowsTemp.length > 0) {
                rowsTemp.forEach(row => {
                    if (row.length > colBase + 1) {
                        const valStr = String(row[colBase + 1] || '').replace(/[^\d.-]/g, '');
                        const temp = parseFloat(valStr);
                        
                        if (!isNaN(temp) && temp > 0) {
                            count++;
                            if (temp > maxTemp) maxTemp = temp;
                            if (temp >= 65) criticos++;
                        }
                    }
                });
            }

            oltStats.push({ 
                id: olt.id, 
                maxTemp: maxTemp, 
                criticos: criticos,
                count: count
            });
        });

        // ==============================================================================
        // INJEÇÃO DA HOME (Wallboard Widescreen com Gráfico de Colunas Clássico)
        // ==============================================================================
        if (isHomePage) {
            const targetWidescreen = document.getElementById('target-temperatura-widescreen');
            
            if (targetWidescreen) {
                targetWidescreen.className = 'card-body-layout'; 
                
                let globalMaxTemp = 0;
                oltStats.forEach(stat => {
                    if (stat.maxTemp > globalMaxTemp) globalMaxTemp = stat.maxTemp;
                });

                let globalStatusText = 'Resfriado';
                let globalStatusColor = 'var(--m3-color-success)';
                
                if (globalMaxTemp >= 65) {
                    globalStatusText = 'Crítico';
                    globalStatusColor = 'var(--m3-color-error)';
                } else if (globalMaxTemp >= 50) {
                    globalStatusText = 'Atenção';
                    globalStatusColor = 'var(--m3-color-warning)';
                }

                let htmlWidescreen = `
                    <div class="resumo-lateral" style="background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2);">
                        <div>
                            <div class="resumo-title"><span class="material-symbols-rounded" style="font-size:14px;">thermostat</span> Pico Térmico</div>
                            <div class="resumo-main-val" style="color: var(--color-temperatura);">${globalMaxTemp > 0 ? globalMaxTemp + '°C' : '--'}</div>
                            <div style="font-size: 0.75rem; color: var(--m3-on-surface-variant); border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">Status: <strong style="color:${globalStatusColor}">${globalStatusText}</strong></div>
                        </div>
                    </div>
                    <div class="grafico-lateral">
                        <div class="temp-chart-area">
                `;

                // Ordenação alfabética para manter as OLTs consistentes lado a lado
                const sortedOlts = [...oltStats].sort((a, b) => a.id.localeCompare(b.id));

                sortedOlts.forEach(stat => {
                    const temp = stat.maxTemp;
                    
                    let statusClass = 'normal';
                    let valColor = 'var(--m3-color-success)';
                    
                    if (temp >= 65) {
                        statusClass = 'critico';
                        valColor = 'var(--m3-color-error)';
                    } else if (temp >= 50) {
                        statusClass = 'warning';
                        valColor = 'var(--m3-color-warning)';
                    }

                    // A altura máxima da barra representa 80°C. 
                    // Se for 0, deixa 2% residual para a barra não desaparecer visualmente.
                    let barHeight = temp > 0 ? Math.max(5, (temp / 80) * 100) : 2;
                    barHeight = Math.min(100, barHeight);

                    htmlWidescreen += `
                        <div class="temp-bar-col"
                             data-olt="${stat.id}"
                             data-temp="${temp}"
                             onmouseenter="handleTempHover(event)"
                             onmouseleave="handleTempLeave()"
                             onclick="handleTempClick(event)"
                             style="cursor: pointer;">
                            <div class="temp-bar-val" style="color: ${temp > 0 ? valColor : 'var(--m3-on-surface-variant)'};">${temp > 0 ? temp + '°' : '-'}</div>
                            <div class="temp-bar-fill ${temp > 0 ? statusClass : ''}" style="height: ${barHeight}%;"></div>
                            <span class="temp-bar-label">${stat.id}</span>
                        </div>
                    `;
                });

                htmlWidescreen += `
                        </div>
                    </div>
                `;
                
                targetWidescreen.innerHTML = htmlWidescreen;
            }
        }

        // ==============================================================================
        // INJEÇÃO DA PÁGINA TEMPERATURA.HTML (Cards individuais mantidos originais)
        // ==============================================================================
        if (isTemperaturaPage && gridTemperaturaPage) {
            gridTemperaturaPage.innerHTML = '';
            
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const o = oltStats.find(stats => stats.id === oltDef.id);
                if(!o) return;

                const btnHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button class="card-header-button" onclick="window.openTemperaturaSuperModal('${o.id}')" title="Detalhes Térmicos">
                            <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                        </button>
                    </div>`;

                let statusCor = 'var(--m3-color-success)';
                if (o.maxTemp >= 65) statusCor = 'var(--m3-color-error)';
                else if (o.maxTemp >= 50) statusCor = 'var(--m3-color-warning)';

                gridTemperaturaPage.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column; width: 100%;">
                        <div class="card-header" style="justify-content: space-between; width: 100%; box-sizing: border-box;">
                            <h3><span class="material-symbols-rounded" style="color: var(--color-temperatura);">device_thermostat</span> ${o.id}</h3>
                            ${btnHtml}
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 16px 20px; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; width: 100%;">
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Alarmes Críticos (>65°C)">
                                        <span class="material-symbols-rounded" style="color:#f87171; font-size: 20px;">warning</span>
                                        <span style="font-size: 1.2rem; color:#f87171; font-weight: bold; font-family: var(--font-family-mono);">${o.criticos}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Leituras Térmicas Encontradas">
                                        <span class="material-symbols-rounded" style="color:var(--m3-on-surface-variant); font-size: 20px;">sensors</span>
                                        <span style="font-size: 1.2rem; color:var(--m3-on-surface-variant); font-weight: bold; font-family: var(--font-family-mono);">${o.count}</span>
                                    </div>
                                </div>
                                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;" title="Pico Máximo OLT">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="material-symbols-rounded" style="color:${statusCor}; font-size: 28px;">thermostat</span>
                                        <span style="font-size: 2.2rem; font-family: var(--font-family-mono); font-weight: bold; color: ${statusCor}; line-height: 1;">${o.maxTemp > 0 ? o.maxTemp : '--'}</span>
                                    </div>
                                    <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-top: 6px;">Pico °C</span>
                                </div>
                            </div>
                        </div>
                    </div>`;
            });
        }

    } catch (e) {
        console.error("Erro no motor de temperatura:", e);
    }
}

window.openTemperaturaSuperModal = function(id) {
    const modal = document.getElementById('super-modal');
    if (!modal) return;
    
    window.CURRENT_TEMP_OLT = id; 
    
    document.getElementById('super-modal-title').innerHTML = `<span class="material-symbols-rounded">device_thermostat</span> ${id}`; 
    document.getElementById('temperatura-view-detalhes').style.display = 'none';
    document.getElementById('temperatura-view-slots').style.display = 'block';
    
    modal.style.display = 'flex';
    populateTemperaturaModal(id);
}

function populateTemperaturaModal(oltId) {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    try {
        const rowsTemp = window.DATA_STORE.temperatura ? window.DATA_STORE.temperatura.slice(1) : [];
        const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
        if (!oltConfig) return;

        const colBase = MAPA_COLUNAS_TEMP[oltId];
        if (colBase === undefined) return;

        window.TEMP_DATA_STORE[oltId] = {};

        rowsTemp.forEach(row => {
            if (row.length > colBase + 1) {
                const slotName = String(row[colBase] || '').trim();
                const tempValStr = String(row[colBase + 1] || '').replace(/[^\d.-]/g, '');
                const temp = parseFloat(tempValStr);
                
                if (slotName && !isNaN(temp)) {
                    window.TEMP_DATA_STORE[oltId][slotName] = temp;
                }
            }
        });

        const slotsList = document.getElementById('temperatura-slots-list');
        if (slotsList) slotsList.innerHTML = '';

        const slots = window.TEMP_DATA_STORE[oltId] || {};
        
        if (Object.keys(slots).length === 0) {
            if (slotsList) slotsList.innerHTML = '<p style="color: var(--m3-on-surface-variant);">Nenhum dado térmico disponível.</p>';
            return;
        }

        for (const slot in slots) {
            const temp = slots[slot];
            
            let btnClass = 'placa-btn';
            let badgeHtml = '';
            
            if (temp >= 65) {
                btnClass += ' has-alarm';
                badgeHtml = `<span class="alarm-count critico">${temp}°C Crítico</span>`;
            } else if (temp >= 50) {
                btnClass += ' has-warning';
                badgeHtml = `<span class="alarm-count atencao">${temp}°C</span>`;
            } else {
                badgeHtml = `<span class="alarm-count" style="background: rgba(74,222,128,0.1); color: var(--m3-color-success); border-color: rgba(74,222,128,0.3);">${temp}°C</span>`;
            }

            if (slotsList) {
                slotsList.innerHTML += `
                    <button class="${btnClass}" style="cursor: default;">
                        <span class="material-symbols-rounded" style="font-size: 32px;">memory</span>
                        ${slot}
                        ${badgeHtml}
                    </button>
                `;
            }
        }
    } catch (error) {
        console.error('Erro ao popular modal de temperatura:', error);
    }
}

window.closeSuperModal = function(event) {
    if (event && event.target.id !== 'super-modal' && !event.target.classList.contains('close-modal')) return;
    document.getElementById('super-modal').style.display = 'none';
    window.CURRENT_TEMP_OLT = null;
    window.CURRENT_VIEW_SLOT = null;
}

window.backToTemperaturaSlots = function() {
    document.getElementById('temperatura-view-detalhes').style.display = 'none';
    document.getElementById('temperatura-view-slots').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    const isTemperaturaPage = window.location.pathname.includes('temperatura.html');
    
    if (isTemperaturaPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Monitoramento Térmico", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        setTimeout(updateGlobalTimestamp, 500);
    }
});

window.addEventListener('dadosAtualizados', () => {
    runTemperaturaEngine();

    const modal = document.getElementById('super-modal');
    if (modal && modal.style.display === 'flex' && window.CURRENT_TEMP_OLT) {
        window.openTemperaturaSuperModal(window.CURRENT_TEMP_OLT);
    }
});