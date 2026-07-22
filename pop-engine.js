// ==============================================================================
// pop-engine.js - Controlador Exclusivo da Página de Visão Geral de POPs
// ==============================================================================

const POP_MAP_CONFIG = [
    { name: 'POP São Vicente', olts: ['PSV-1', 'PSV-7'] },
    { name: 'POP Heliópolis', olts: ['HEL-1', 'HEL-2'] },
    { name: 'POP Lote XV', olts: ['LTXV-1', 'LTXV-2'] },
    { name: 'POP Piabetá', olts: ['MGP'] },
    { name: 'POP Parque Amorim', olts: ['PQA-1', 'PQA-2', 'PQA-3'] },
    { name: 'POP São Bento', olts: ['SB-1', 'SB-2', 'SB-3'] },
    { name: 'POP São Bernardo', olts: ['SBO-1', 'SBO-2', 'SBO-3', 'SBO-4'] }
];

window.triggerRelatorio = function(popName, funcName, event) {
    if (event) event.stopPropagation();
    
    let dummyTitle = document.getElementById('super-modal-title');
    if (!dummyTitle) {
        dummyTitle = document.createElement('div');
        dummyTitle.id = 'super-modal-title';
        dummyTitle.style.display = 'none';
        document.body.appendChild(dummyTitle);
    }
    
    dummyTitle.innerHTML = `<span class="material-symbols-rounded">dns</span> ${popName}`;
    
    if (typeof window[funcName] === 'function') {
        window[funcName](event);
    } else {
        alert('Função de relatório não encontrada. Verifique se os scripts foram carregados.');
    }
};

function createPopCards() {
    const grid = document.getElementById('pop-grid');
    if (!grid) return;
    grid.innerHTML = ''; 

    POP_MAP_CONFIG.forEach(pop => {
        const safeId = pop.name.replace(/[^a-zA-Z0-9]/g, '');
        
        grid.innerHTML += `
            <div class="pop-card" id="card-${safeId}" style="background-color: var(--m3-surface-container); border-radius: 16px; border: 1px solid var(--m3-outline); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                <div class="pop-header" style="background-color: var(--m3-surface-container-high); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--m3-outline);">
                    <h3 style="margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1.2rem; color: var(--m3-on-surface);">
                        <span class="material-symbols-rounded">domain</span> ${pop.name}
                    </h3>
                </div>
                
                <div class="pop-body" style="padding: 20px; display: flex; flex-direction: column; gap: 20px;">
                    <div class="pop-summary" style="display: flex; justify-content: space-between; align-items: center; background-color: rgba(0, 0, 0, 0.2); padding: 15px; border-radius: 12px;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-bottom: 4px;">Online</span>
                            <span id="on-${safeId}" style="font-family: var(--font-family-mono); font-size: 1.5rem; font-weight: 700; color: var(--m3-color-success);">--</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-bottom: 4px;">Offline</span>
                            <span id="off-${safeId}" style="font-family: var(--font-family-mono); font-size: 1.5rem; font-weight: 700; color: var(--m3-color-error);">--</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-bottom: 4px;">Sem Energia</span>
                            <span id="pwr-${safeId}" style="font-family: var(--font-family-mono); font-size: 1.5rem; font-weight: 700; color: #fbbf24;">--</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-bottom: 4px;">Total</span>
                            <span id="tot-${safeId}" style="font-family: var(--font-family-mono); font-size: 1.5rem; font-weight: 700; color: #ffffff;">--</span>
                        </div>
                    </div>
                    
                    <div class="pop-actions" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <button style="font-family: inherit; font-weight: 500; background-color: var(--m3-surface-container-highest); color: var(--m3-on-surface); border: 1px solid var(--m3-outline); padding: 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem; transition: background 0.2s;" onclick="triggerRelatorio('${pop.name}', 'gerarRelatorioOltOffscreen', event)" onmouseover="this.style.backgroundColor='var(--m3-state-layer-hover)'" onmouseout="this.style.backgroundColor='var(--m3-surface-container-highest)'">
                            <span class="material-symbols-rounded" style="color: var(--m3-color-error); font-size: 20px;">warning</span> Alarmes
                        </button>
                        <button style="font-family: inherit; font-weight: 500; background-color: var(--m3-surface-container-highest); color: var(--m3-on-surface); border: 1px solid var(--m3-outline); padding: 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem; transition: background 0.2s;" onclick="triggerRelatorio('${pop.name}', 'gerarComunicadoSocialOffscreen', event)" onmouseover="this.style.backgroundColor='var(--m3-state-layer-hover)'" onmouseout="this.style.backgroundColor='var(--m3-surface-container-highest)'">
                            <span class="material-symbols-rounded" style="color: var(--m3-primary); font-size: 20px;">campaign</span> Comunicado
                        </button>
                        <button style="font-family: inherit; font-weight: 500; background-color: var(--m3-surface-container-highest); color: var(--m3-on-surface); border: 1px solid var(--m3-outline); padding: 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem; transition: background 0.2s;" onclick="triggerRelatorio('${pop.name}', 'gerarRelatorioEnergiaOffscreen', event)" onmouseover="this.style.backgroundColor='var(--m3-state-layer-hover)'" onmouseout="this.style.backgroundColor='var(--m3-surface-container-highest)'">
                            <span class="material-symbols-rounded" style="color: #fbbf24; font-size: 20px;">bolt</span> Energia
                        </button>
                        <button style="font-family: inherit; font-weight: 500; background-color: var(--m3-surface-container-highest); color: var(--m3-on-surface); border: 1px solid var(--m3-outline); padding: 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem; transition: background 0.2s;" onclick="triggerRelatorio('${pop.name}', 'gerarRelatorioTxtOffscreen', event)" onmouseover="this.style.backgroundColor='var(--m3-state-layer-hover)'" onmouseout="this.style.backgroundColor='var(--m3-surface-container-highest)'">
                            <span class="material-symbols-rounded" style="color: var(--m3-on-surface-variant); font-size: 20px;">description</span> TXT
                        </button>
                        <button style="font-family: inherit; grid-column: 1 / -1; background-color: var(--m3-primary); color: var(--m3-on-primary); border: none; padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: bold; transition: opacity 0.2s;" onclick="openPopModal('${pop.name}')" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                            <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span> VER DETALHES
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
}

function updatePopData() {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    POP_MAP_CONFIG.forEach(pop => {
        let popOnline = 0;
        let popOffline = 0;
        let popSemEnergia = 0;

        pop.olts.forEach(oltId => {
            const oltConfig = typeof GLOBAL_MASTER_OLT_LIST !== 'undefined' ? GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId) : null;
            if (!oltConfig) return;

            const values = window.DATA_STORE.olts[oltId] || [];
            const rows = values.slice(1);

            rows.forEach(columns => {
                if (columns.length === 0) return;
                
                const isOnline = DataMapper.isOnline(columns[oltConfig.type === 'nokia' ? 4 : 2], oltConfig.type);
                
                if (isOnline) {
                    popOnline++;
                } else {
                    popOffline++;
                }
            });

            if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.olts && window.ENERGY_DATA_STORE.olts[oltId] && window.ENERGY_DATA_STORE.olts[oltId].ports) {
                const portsMap = window.ENERGY_DATA_STORE.olts[oltId].ports;
                for (const placa in portsMap) {
                    for (const porta in portsMap[placa]) {
                        popSemEnergia += portsMap[placa][porta].powerOff || 0;
                    }
                }
            }
        });

        const safeId = pop.name.replace(/[^a-zA-Z0-9]/g, '');
        const popTotal = popOnline + popOffline;

        const elOn = document.getElementById(`on-${safeId}`);
        const elOff = document.getElementById(`off-${safeId}`);
        const elPwr = document.getElementById(`pwr-${safeId}`);
        const elTot = document.getElementById(`tot-${safeId}`);

        if (elOn) elOn.textContent = popOnline;
        if (elOff) elOff.textContent = popOffline;
        if (elPwr) elPwr.textContent = popSemEnergia;
        if (elTot) elTot.textContent = popTotal;
    });
}

window.openPopModal = function(popName) {
    const pop = POP_MAP_CONFIG.find(p => p.name === popName);
    if (!pop) return;

    document.getElementById('pop-modal-title').innerHTML = `<span class="material-symbols-rounded">domain</span> Detalhes: ${popName}`;
    const tbody = document.getElementById('pop-detalhes-tbody');
    tbody.innerHTML = '';

    if (!window.DATA_STORE || !window.DATA_STORE.isReady) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">Aguardando dados...</td></tr>`;
        document.getElementById('pop-modal').style.display = 'flex';
        return;
    }

    pop.olts.forEach(oltId => {
        const oltConfig = typeof GLOBAL_MASTER_OLT_LIST !== 'undefined' ? GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId) : null;
        if (!oltConfig) return;

        const values = window.DATA_STORE.olts[oltId] || [];
        const rows = values.slice(1);
        
        let online = 0, offline = 0, semEnergia = 0, potCritica = 0;
        
        rows.forEach(columns => {
            if (columns.length === 0) return;
            const isOnline = DataMapper.isOnline(columns[oltConfig.type === 'nokia' ? 4 : 2], oltConfig.type);
            
            if (isOnline) {
                online++;
            } else {
                offline++;
            }
            
            const pwrOpt = DataMapper.parsePowerValue(columns[5]);
            if (DataMapper.isValidPower(pwrOpt) && (pwrOpt < -25.00 || pwrOpt > -15.00)) {
                potCritica++;
            }
        });

        if (window.ENERGY_DATA_STORE && window.ENERGY_DATA_STORE.olts && window.ENERGY_DATA_STORE.olts[oltId] && window.ENERGY_DATA_STORE.olts[oltId].ports) {
            const portsMap = window.ENERGY_DATA_STORE.olts[oltId].ports;
            for (const placa in portsMap) {
                for (const porta in portsMap[placa]) {
                    semEnergia += portsMap[placa][porta].powerOff || 0;
                }
            }
        }

        const total = online + offline;
        
        let tempStatus = '<span style="color: var(--m3-on-surface-variant);">N/A</span>';
        if (window.TEMP_DATA_STORE && window.TEMP_DATA_STORE[oltId]) {
            let hasCritico = false;
            let hasAtencao = false;
            let totalSensores = 0;
            
            const slots = window.TEMP_DATA_STORE[oltId];
            for (const slot in slots) {
                slots[slot].forEach(sensor => {
                    totalSensores++;
                    if (sensor.isCritico) hasCritico = true;
                    if (sensor.isAtencao) hasAtencao = true;
                });
            }
            
            if (totalSensores > 0) {
                if (hasCritico) {
                    tempStatus = '<span style="color: var(--m3-color-error); font-weight: bold;">Crítico</span>';
                } else if (hasAtencao) {
                    tempStatus = '<span style="color: var(--m3-color-warning); font-weight: bold;">Atenção</span>';
                } else {
                    tempStatus = '<span style="color: var(--m3-color-success); font-weight: bold;">Normal</span>';
                }
            }
        }

        const potDisplay = potCritica > 0 
            ? '<span style="color: var(--m3-color-error);">' + potCritica + ' alertas</span>' 
            : '<span style="color: var(--m3-color-success);">OK</span>';

        tbody.innerHTML += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 12px; font-weight: bold; color: var(--m3-primary);">${oltId}</td>
                <td style="padding: 12px; font-family: var(--font-family-mono);">${total}</td>
                <td style="padding: 12px; font-family: var(--font-family-mono); color: var(--m3-color-success);">${online}</td>
                <td style="padding: 12px; font-family: var(--font-family-mono); color: var(--m3-color-error);">${offline}</td>
                <td style="padding: 12px; font-family: var(--font-family-mono); color: #fbbf24;">${semEnergia > 0 ? semEnergia + ' falhas' : 'OK'}</td>
                <td style="padding: 12px; font-family: var(--font-family-mono);">${potDisplay}</td>
                <td style="padding: 12px;">${tempStatus}</td>
            </tr>
        `;
    });

    document.getElementById('pop-modal').style.display = 'flex';
};

window.closePopModal = function(event) {
    if (event && event.target.id !== 'pop-modal' && !event.target.classList.contains('close-modal')) return;
    document.getElementById('pop-modal').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof loadHeader === 'function') loadHeader({ title: "Visão Geral de POPs", exactTitle: true });
    if (typeof loadFooter === 'function') loadFooter();
    if (typeof updateGlobalTimestamp === 'function') updateGlobalTimestamp();
    
    createPopCards();
});

window.addEventListener('dadosAtualizados', () => {
    updatePopData();
});