// ==============================================================================
// temperatura-engine.js - Motor Dedicado para Análise Térmica das OLTs
// Atualização: Implementação do Grid/Nuvem Global na Home (17 OLTs simultâneas)
// ==============================================================================

const TAB_TEMPERATURA = 'TEMPERATURA'; 

// Mapa de Colunas baseado na arquitetura exata do Python Script (A=0, F=5)
const MAPA_COLUNAS_TEMP = {
    'HEL-1': 0, 'HEL-2': 6, 'MGP': 12, 'PQA-1': 18, 'PSV-1': 24, 'PSV-7': 30, 
    'SBO-1': 36, 'SBO-2': 42, 'SBO-3': 48, 'SBO-4': 54, 'LTXV-1': 60, 
    'LTXV-2': 66, 'PQA-2': 72, 'PQA-3': 78, 'SB-1': 84, 'SB-2': 90, 'SB-3': 96
};

window.TEMP_DATA_STORE = {}; 
window.CURRENT_VIEW_SLOT = null; 

// ==============================================================================
// FUNÇÕES DE EXPORTAÇÃO (PNG E TXT)
// ==============================================================================
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

// ==============================================================================
// MOTOR PRINCIPAL DE TEMPERATURA
// ==============================================================================
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

        // Busca toda a aba de TEMPERATURA de A até CX
        const range = `${TAB_TEMPERATURA}!A:CX`;
        const dataBatch = await API.get(range);
        
        if (!dataBatch.values || dataBatch.values.length < 2) {
            console.warn("Aba de Temperatura sem dados estruturados.");
            return;
        }

        const rows = dataBatch.values.slice(2); // Pula Linha 1(Títulos OLT) e 2(Cabeçalhos)

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

                let isCritico = false, isAtencao = false;
                
                if (!isNaN(limCrit) && tempAtual >= limCrit) {
                    criticos++;
                    isCritico = true;
                } else if (!isNaN(limAlta) && tempAtual >= limAlta) {
                    atencao++;
                    isAtencao = true;
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

        // ==============================================================================
        // INJEÇÃO DA HOME (Nuvem de Badges - Visão Global de 17 OLTs)
        // ==============================================================================
        if (globalBody) {
            let badgesHtml = '';
            
            // Usamos a lista mestre (GLOBAL_MASTER_OLT_LIST) para garantir a ordem fixa das OLTs no painel
            GLOBAL_MASTER_OLT_LIST.forEach(oltDef => {
                const o = oltStats.find(stats => stats.id === oltDef.id);
                
                if (!o || o.analisados === 0) {
                    // Se a OLT estiver sem dados de temperatura
                    badgesHtml += `
                        <div class="temp-badge-item" style="background-color: rgba(255,255,255,0.02); opacity: 0.5;">
                            <span class="olt-name">${oltDef.id}</span>
                            <span class="temp-value">--</span>
                        </div>
                    `;
                    return;
                }

                let classeCSS = 'status-normal';

                // A cor do badge é baseada no pior sensor daquela OLT
                if (o.criticos > 0) {
                    classeCSS = 'status-critico';
                } else if (o.atencao > 0) {
                    classeCSS = 'status-atencao';
                }

                badgesHtml += `
                    <div class="temp-badge-item ${classeCSS}" title="Pico de temperatura na OLT">
                        <span class="olt-name">${o.id}</span>
                        <span class="temp-value">${o.maxTemp}°C</span>
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

        // ==============================================================================
        // INJEÇÃO DA PÁGINA TEMPERATURA
        // ==============================================================================
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

// ==============================================================================
// SISTEMA DE NAVEGAÇÃO DE MODAIS (OLT -> SLOTS)
// ==============================================================================

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