// ==============================================================================
// temperatura-engine.js - Motor Dedicado para Análise Térmica das OLTs
// Atualização: Sistema Híbrido (Smart Tooltip / Fast Modal) Integrado
// ==============================================================================

const TAB_TEMPERATURA = 'TEMPERATURA'; 

const MAPA_COLUNAS_TEMP = {
    'HEL-1': 0, 'HEL-2': 6, 'MGP': 12, 'PQA-1': 18, 'PSV-1': 24, 'PSV-7': 30, 
    'SBO-1': 36, 'SBO-2': 42, 'SBO-3': 48, 'SBO-4': 54, 'LTXV-1': 60, 
    'LTXV-2': 66, 'PQA-2': 72, 'PQA-3': 78, 'SB-1': 84, 'SB-2': 90, 'SB-3': 96
};

window.TEMP_DATA_STORE = {}; 
window.CURRENT_VIEW_SLOT = null; 

function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 900;
}

// Funções Injetadas Globalmente para o Hover/Clique
window.handleTempHover = function(event) {
    if (isMobileDevice()) return;
    const tooltip = document.getElementById('smart-tooltip');
    if (!tooltip) return;

    const el = event.currentTarget;
    tooltip.innerHTML = `
        <div class="smart-tooltip-title">
            <span class="material-symbols-rounded" style="font-size: 18px; color: ${el.dataset.color};">${el.dataset.icon}</span>
            ${el.dataset.olt}
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Pico Atual:</span> 
            <strong style="font-family: var(--font-family-mono); font-size: 1rem;">${el.dataset.max}°C</strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Sensores em Alerta:</span> 
            <strong><span style="color:#f87171">${el.dataset.crit}</span> / <span style="color:#f97316">${el.dataset.warn}</span></strong>
        </div>
        <div class="smart-tooltip-line">
            <span style="color: var(--m3-on-surface-variant);">Status Geral:</span> 
            <strong style="color: ${el.dataset.color};">${el.dataset.status}</strong>
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
    content.innerHTML = `
        <h3 style="margin-top: 0; border-bottom: 1px solid var(--m3-outline); padding-bottom: 10px; display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="color: ${el.dataset.color};">${el.dataset.icon}</span> ${el.dataset.olt}
        </h3>
        <div style="margin-bottom: 15px; text-align: center;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Temperatura Máxima Lida</span><br>
            <strong style="font-size: 2.5rem; font-family: var(--font-family-mono); color: ${el.dataset.color}; line-height: 1;">${el.dataset.max}°C</strong>
        </div>
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between;">
            <div>
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Sensores Críticos</span><br>
                <strong style="font-size: 1.2rem; color: #f87171;">${el.dataset.crit}</strong>
            </div>
            <div style="text-align: right;">
                <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Sensores em Atenção</span><br>
                <strong style="font-size: 1.2rem; color: #f97316;">${el.dataset.warn}</strong>
            </div>
        </div>
        <div style="text-align: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
            <span style="color: var(--m3-on-surface-variant); font-size: 0.85rem;">Status do Equipamento</span><br>
            <strong style="color: ${el.dataset.color}; font-size: 1.1rem; text-transform: uppercase;">${el.dataset.status}</strong>
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
        link.download = `Temperatura_${oltName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        if (btn) btn.innerHTML = originalContent;
    }).catch(error => {
        console.error('Erro ao gerar imagem:', error);
        alert('Ocorreu um erro ao exportar a imagem.');
        if (btn) btn.innerHTML = originalContent;
    });
};

window.exportTemperaturaSlotToTXT = function() {
    const titleEl = document.getElementById('super-modal-title');
    let oltName = 'OLT_Desconhecida';
    if (titleEl) {
        oltName = titleEl.innerText.replace('device_thermostat', '').trim();
    }
    const slot = window.CURRENT_VIEW_SLOT || '?';
    
    let txtContent = `=================================================\n`;
    txtContent += `   RELATÓRIO TÉRMICO - ${oltName} (SLOT ${slot})\n`;
    txtContent += `   Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
    txtContent += `=================================================\n\n`;
    
    const tbody = document.getElementById('temperatura-detalhes-tbody');
    const rows = tbody.querySelectorAll('tr');
    
    if (rows.length === 0 || rows[0].innerText.includes('Nenhum dado')) {
        alert('Nenhum dado disponível para exportação.');
        return;
    }
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 4) {
            const sensor = cols[0].innerText.trim();
            const temp = cols[1].innerText.trim();
            const limites = cols[2].innerText.trim();
            const status = cols[3].innerText.trim();
            
            txtContent += `• Sensor ${sensor.padEnd(5, ' ')} | Temp: ${temp.padEnd(8, ' ')} | ${limites.padEnd(15, ' ')} | Status: ${status}\n`;
        }
    });
    
    txtContent += `\n=================================================\n`;
    
    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Temperatura_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_Slot_${slot.replace(/[^a-zA-Z0-9]/g, '')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

async function runTemperaturaEngine() {
    const gridEl = document.getElementById('temperatura-grid');
    const globalBody = document.getElementById('global-temperatura-body');
    const timestampEl = document.getElementById('update-timestamp');
    
    const isTemperaturaPage = window.location.pathname.includes('temperatura.html');
    
    if (!globalBody && !gridEl) return; 

    if (timestampEl && timestampEl.textContent.includes('Aguardando')) {
        timestampEl.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Buscando dados...';
    }

    try {
        let oltStats = [];
        window.TEMP_DATA_STORE = {};

        const range = `${TAB_TEMPERATURA}!A:CX`;
        const dataBatch = await API.get(range);
        
        if (!dataBatch.values || dataBatch.values.length < 2) {
            console.warn("Aba de Temperatura sem dados estruturados.");
            return;
        }

        const rows = dataBatch.values.slice(2); 

        GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
            const oltId = oltDef.id;
            const startCol = MAPA_COLUNAS_TEMP[oltId];
            
            if (startCol === undefined) return;

            let analisados = 0, criticos = 0, atencao = 0;
            let maxTemp = 0;
            let lastUpdateStr = '--/--/---- --:--:--';
            
            window.TEMP_DATA_STORE[oltId] = {}; 

            rows.forEach(row => {
                const slot = row[startCol + 0];
                const sensor = row[startCol + 1];
                const tempAtual = parseFloat(row[startCol + 2]);
                const limAlta = parseFloat(row[startCol + 3]);
                const limCrit = parseFloat(row[startCol + 4]);
                const dataHora = row[startCol + 5];

                if (!slot || isNaN(tempAtual)) return;
                
                if (dataHora) lastUpdateStr = dataHora;
                analisados++;
                
                if (tempAtual > maxTemp) maxTemp = tempAtual;

                let isCritico = tempAtual >= 90 || (!isNaN(limCrit) && tempAtual >= limCrit);
                let isAtencao = (!isCritico) && (tempAtual >= 80 || (!isNaN(limAlta) && tempAtual >= limAlta));
                
                if (isCritico) {
                    criticos++;
                } else if (isAtencao) {
                    atencao++;
                }

                if (!window.TEMP_DATA_STORE[oltId][slot]) {
                    window.TEMP_DATA_STORE[oltId][slot] = [];
                }
                window.TEMP_DATA_STORE[oltId][slot].push({
                    sensor, tempAtual, limAlta, limCrit, isCritico, isAtencao
                });
            });

            const normalCount = analisados - criticos - atencao;
            const health = analisados > 0 ? ((normalCount / analisados) * 100) : 0;

            oltStats.push({
                id: oltId,
                analisados,
                criticos,
                atencao,
                maxTemp,
                health,
                lastUpdate: lastUpdateStr
            });
        });

        if (globalBody) {
            let badgesHtml = '';
            
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const o = oltStats.find(stats => stats.id === oltDef.id);
                
                if (!o || o.analisados === 0) {
                    badgesHtml += `
                        <div class="temp-badge-item" style="background-color: rgba(255,255,255,0.02); opacity: 0.5;">
                            <div style="display: flex; align-items: center; gap: 6px; pointer-events: none;">
                                <span class="material-symbols-rounded" style="font-size: 18px; color: var(--m3-on-surface-variant);">device_thermostat</span>
                                <span class="olt-name">${oltDef.id}</span>
                            </div>
                            <span class="temp-value" style="pointer-events: none;">--</span>
                        </div>
                    `;
                    return;
                }

                let classeCSS = 'status-normal';
                let icone = 'device_thermostat';
                let statusText = 'Estável';
                let colorStatus = '#4ade80';

                if (o.criticos > 0 || o.maxTemp >= 90) {
                    classeCSS = 'status-critico';
                    icone = 'local_fire_department'; 
                    statusText = 'Crítico';
                    colorStatus = '#f87171';
                } else if (o.atencao > 0 || o.maxTemp >= 80) {
                    classeCSS = 'status-atencao';
                    icone = 'device_thermostat';
                    statusText = 'Atenção';
                    colorStatus = '#f97316';
                }

                badgesHtml += `
                    <div class="temp-badge-item ${classeCSS}"
                         data-olt="${o.id}"
                         data-max="${o.maxTemp}"
                         data-crit="${o.criticos}"
                         data-warn="${o.atencao}"
                         data-status="${statusText}"
                         data-color="${colorStatus}"
                         data-icon="${icone}"
                         onmouseenter="handleTempHover(event)"
                         onmouseleave="handleTempLeave()"
                         onclick="handleTempClick(event)">
                        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; pointer-events: none;">
                            <span class="material-symbols-rounded" style="font-size: 18px;">${icone}</span>
                            <span class="olt-name">${o.id}</span>
                        </div>
                        <span class="temp-value" style="pointer-events: none;">${o.maxTemp}°C</span>
                    </div>
                `;
            });

            globalBody.innerHTML = `
                <div style="width: 100%; display: flex; flex-direction: column; justify-content: stretch; height: 100%;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <span class="material-symbols-rounded" style="color: #f97316; font-size: 20px;">grid_view</span>
                        <h3 style="margin: 0; font-size: 1rem; color: var(--m3-on-surface);">Pico Térmico Global</h3>
                    </div>
                    <div class="temp-badge-grid">
                        ${badgesHtml}
                    </div>
                </div>
            `;
        }

        if (isTemperaturaPage && gridEl) {
            gridEl.innerHTML = '';
            
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const o = oltStats.find(stats => stats.id === oltDef.id);
                if(!o || o.analisados === 0) return;

                const btnHtml = `
                    <div style="display: flex; gap: 8px;">
                        <button class="card-header-button" onclick="exportCardToImage(event, 'card-${o.id}', '${o.id}')" title="Exportar Card">
                            <span class="material-symbols-rounded">photo_camera</span>
                        </button>
                        <button class="card-header-button" onclick="window.openTemperaturaSuperModal('${o.id}')" title="Ver Placas e Sensores">
                            <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                        </button>
                    </div>`;
                
                const dateParts = o.lastUpdate ? o.lastUpdate.split(' ') : ['--/--/----', '--:--:--'];
                const dateVal = dateParts[0] || '--/--/----';
                const timeVal = dateParts[1] || '--:--:--';
                
                gridEl.innerHTML += `
                    <div class="overview-card" id="card-${o.id}" style="display: flex; flex-direction: column; width: 100%;">
                        <div class="card-header" style="justify-content: space-between; width: 100%; box-sizing: border-box;">
                            <h3><span class="material-symbols-rounded">dns</span> ${o.id}</h3>
                            ${btnHtml}
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 16px 20px; width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; width: 100%;">
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Sensores Lidos">
                                        <span class="material-symbols-rounded" style="color:var(--m3-on-surface); font-size: 18px;">memory</span>
                                        <span style="font-size: 1.1rem; color:var(--m3-on-surface); font-weight: 500;">${o.analisados}</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Crítico / Atenção">
                                        <span class="material-symbols-rounded" style="color:#f87171; font-size: 18px;">warning</span>
                                        <span style="font-size: 1.1rem; color:var(--m3-on-surface); font-weight: bold;">
                                            <span style="color:#f87171">${o.criticos}</span> / <span style="color:#f97316">${o.atencao}</span>
                                        </span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 8px;" title="Pico de Temperatura">
                                        <span class="material-symbols-rounded" style="color:#f97316; font-size: 18px;">local_fire_department</span>
                                        <span style="font-size: 1.1rem; color:var(--m3-on-surface); font-weight: 500;">${o.maxTemp} °C</span>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-size: 2rem; font-family: var(--font-family-mono); font-weight: bold; color: ${o.health >= 90 ? 'var(--m3-color-success)' : 'var(--m3-color-error)'};">${o.health.toFixed(1)}%</span><br>
                                    <span style="font-size: 0.75rem; color: var(--m3-on-surface-variant); text-transform: uppercase;">Saúde Térmica</span>
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
        console.error("Erro no motor de temperatura:", e);
    }
}

window.openTemperaturaSuperModal = function(oltId) {
    const modal = document.getElementById('super-modal');
    if (!modal) return;
    
    document.getElementById('super-modal-title').innerHTML = `<span class="material-symbols-rounded">device_thermostat</span> ${oltId}`;
    document.getElementById('temperatura-view-detalhes').style.display = 'none';
    document.getElementById('temperatura-view-slots').style.display = 'block';
    
    const placasList = document.getElementById('temperatura-slots-list');
    placasList.innerHTML = '';
    
    const slotsObj = window.TEMP_DATA_STORE[oltId] || {};
    const slotNames = Object.keys(slotsObj).sort(); 
    
    if (slotNames.length === 0) {
        placasList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--m3-on-surface-variant);">Nenhum dado de slot encontrado.</div>`;
    }

    slotNames.forEach(slot => {
        const sensores = slotsObj[slot];
        let hasCritico = false;
        let hasAtencao = false;
        
        sensores.forEach(s => {
            if (s.isCritico) hasCritico = true;
            if (s.isAtencao) hasAtencao = true;
        });

        let btnClass = 'placa-btn';
        let badgeHtml = '';
        
        if (hasCritico) {
            btnClass += ' has-alarm';
            badgeHtml = `<span class="alarm-count critico">CRÍTICO</span>`;
        } else if (hasAtencao) {
            btnClass += ' has-warning';
            badgeHtml = `<span class="alarm-count atencao" style="background:#f97316; color:#000;">ATENÇÃO</span>`;
        }

        placasList.innerHTML += `
            <button class="${btnClass}" onclick="window.openTemperaturaSlotDetails('${oltId}', '${slot}')">
                <span class="material-symbols-rounded" style="font-size: 32px;">developer_board</span>
                ${slot}
                ${badgeHtml}
            </button>
        `;
    });

    modal.style.display = 'flex';
}

window.openTemperaturaSlotDetails = function(oltId, slot) {
    window.CURRENT_VIEW_SLOT = slot;

    document.getElementById('temperatura-view-slots').style.display = 'none';
    document.getElementById('temperatura-view-detalhes').style.display = 'block';
    
    const tbody = document.getElementById('temperatura-detalhes-tbody');
    tbody.innerHTML = '';
    
    const sensores = window.TEMP_DATA_STORE[oltId][slot] || [];
    
    if (sensores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--m3-on-surface-variant);">Nenhum dado de sensor.</td></tr>`;
        return;
    }

    sensores.forEach(s => {
        let statusBadge = `<span class="temp-normal">Normal</span>`;
        let tempColor = 'var(--m3-on-surface)';
        let rowClass = '';
        
        if (s.isCritico) {
            statusBadge = `<span class="temp-critico">Crítico</span>`;
            tempColor = '#f87171';
            rowClass = 'bg-alerta-temp-critico';
        } else if (s.isAtencao) {
            statusBadge = `<span class="temp-atencao" style="background: rgba(249, 115, 22, 0.15); color: #f97316 !important;">Atenção</span>`;
            tempColor = '#f97316';
            rowClass = 'bg-alerta-temp-atencao';
        }

        let lAlta = isNaN(s.limAlta) ? '-' : `${s.limAlta}°C`;
        let lCrit = isNaN(s.limCrit) ? '-' : `${s.limCrit}°C`;

        tbody.innerHTML += `
            <tr class="${rowClass}">
                <td style="font-weight: bold;">${s.sensor}</td>
                <td><strong style="color: ${tempColor}; font-size: 1.1rem;">${s.tempAtual} °C</strong></td>
                <td><span class="limites-badge">${lAlta} / ${lCrit}</span></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
};

window.closeSuperModal = function(event) {
    if (event && event.target.id !== 'super-modal' && !event.target.classList.contains('close-modal')) return;
    document.getElementById('super-modal').style.display = 'none';
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
    
    if (isTemperaturaPage || checkIsHomePage()) {
        setTimeout(runTemperaturaEngine, 1000);
        setInterval(runTemperaturaEngine, GLOBAL_REFRESH_SECONDS * 1000);
    }
});