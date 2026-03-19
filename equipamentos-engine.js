// ==============================================================================
// equipamentos-engine.js - Motor Dedicado de Monitoramento de Fabricantes
// ==============================================================================

const EQP_MARCAS = [
    { nome: 'NOKIA', prefixos: 'ALCL' },
    { nome: 'CHINA MOBILE', prefixos: 'NBEL' },
    { nome: 'FURUKAWA', prefixos: 'FRKW, FIOG' },
    { nome: 'ASKEY', prefixos: 'ASKY, INVP, TLCM' },
    { nome: 'EURONET', prefixos: 'CIOT, YHTC' },
    { nome: 'HUAWEI', prefixos: 'HWTC' },
    { nome: 'MITRASTAR', prefixos: 'MSTC' },
    { nome: 'MAXPRINT / V-SOL', prefixos: 'GPON, VSOL, DE30' },
    { nome: 'PARKS', prefixos: 'PRKS' },
    { nome: 'TENDA', prefixos: 'TDTC' },
    { nome: 'SHORELINE', prefixos: 'SHLN' }
];

const prefixToMarca = {};
EQP_MARCAS.forEach(marca => {
    marca.prefixos.split(',').forEach(p => {
        prefixToMarca[p.trim().toUpperCase()] = marca.nome;
    });
});

window.listaDesconhecidos = [];

async function fetchEqpOltData(olt) {
    const range = olt.type === 'nokia' ? `${olt.sheetTab}!A:E` : `${olt.sheetTab}!A:D`;
    // Utilizando as chaves globais do Cérebro
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GLOBAL_SHEET_ID}/values/${range}?key=${GLOBAL_API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) return { id: olt.id, prefixCounts: {} };
        const data = await response.json();
        const rows = (data.values || []).slice(1);
        
        const prefixCounts = {};

        rows.forEach(columns => {
            if (columns.length === 0) return;
            
            let isOnline = false;
            let serialRaw = '';
            let ponRaw = (columns[0] || '').trim(); 

            if (olt.type === 'nokia') {
                isOnline = (columns[4] || '').trim().toLowerCase().includes('up');
                serialRaw = (columns[2] || '').trim(); 
            } else { 
                isOnline = (columns[2] || '').trim().toLowerCase() === 'active';
                serialRaw = (columns[3] || '').trim(); 
            }

            if (!serialRaw) return;

            const prefix = serialRaw.substring(0, 4).toUpperCase();
            if (!prefix) return;

            if (!prefixCounts[prefix]) {
                prefixCounts[prefix] = { online: 0, offline: 0, devices: [] };
            }
            
            prefixCounts[prefix].devices.push({ pon: ponRaw, serial: serialRaw, isOnline: isOnline });

            if (isOnline) prefixCounts[prefix].online++;
            else prefixCounts[prefix].offline++;
        });

        return { id: olt.id, prefixCounts };
    } catch (error) {
        console.error(`Erro buscando seriais de ${olt.id}`, error);
        return { id: olt.id, prefixCounts: {} };
    }
}

async function renderFabricantesDashboard() {
    const timestampEl = document.getElementById('update-timestamp');
    if (timestampEl) {
        timestampEl.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Buscando dados...';
    }

    const grid = document.getElementById('fabricantes-grid');
    if (!grid) return; 

    window.listaDesconhecidos = []; 
    
    // Utilizando a lista do Cérebro
    const promises = GLOBAL_MASTER_OLT_LIST.map(olt => fetchEqpOltData(olt));
    const oltsData = await Promise.all(promises);

    const statsPorFabricante = {};
    
    EQP_MARCAS.forEach(marca => {
        statsPorFabricante[marca.nome] = {
            nome: marca.nome,
            prefixos: marca.prefixos,
            online: 0,
            offline: 0,
            olts: {} 
        };
    });

    statsPorFabricante['OUTROS'] = {
        nome: 'OUTROS',
        prefixos: 'Vários',
        online: 0,
        offline: 0,
        olts: {}
    };

    oltsData.forEach(oltData => {
        if (!oltData.prefixCounts) return;

        Object.entries(oltData.prefixCounts).forEach(([prefix, counts]) => {
            const marcaNome = prefixToMarca[prefix] || 'OUTROS';
            
            statsPorFabricante[marcaNome].online += counts.online;
            statsPorFabricante[marcaNome].offline += counts.offline;

            if (!statsPorFabricante[marcaNome].olts[oltData.id]) {
                statsPorFabricante[marcaNome].olts[oltData.id] = { online: 0, offline: 0 };
            }
            statsPorFabricante[marcaNome].olts[oltData.id].online += counts.online;
            statsPorFabricante[marcaNome].olts[oltData.id].offline += counts.offline;

            if (marcaNome === 'OUTROS') {
                counts.devices.forEach(dev => {
                    window.listaDesconhecidos.push({
                        olt: oltData.id,
                        pon: dev.pon,
                        serial: dev.serial,
                        isOnline: dev.isOnline
                    });
                });
            }
        });
    });

    const listaOrdenada = Object.values(statsPorFabricante)
        .filter(f => (f.online + f.offline) > 0) 
        .sort((a, b) => (b.online + b.offline) - (a.online + a.offline));

    grid.innerHTML = '';
    
    if (listaOrdenada.length === 0) {
        grid.innerHTML = '<p style="padding: 20px;">Nenhum equipamento com serial foi encontrado na rede.</p>';
    } else {
        listaOrdenada.forEach(fab => {
            const total = fab.online + fab.offline;
            const pctOnline = total > 0 ? (fab.online / total) * 100 : 0;
            const pctOffline = 100 - pctOnline;

            const newRadius = 35; 
            const circumference = 2 * Math.PI * newRadius; 
            const offset = circumference - (pctOnline / 100) * circumference;

            let oltsHtml = '';
            const oltsOrdenadas = Object.entries(fab.olts).sort((a,b) => (b[1].online + b[1].offline) - (a[1].online + a[1].offline));
            oltsOrdenadas.forEach(([oltId, stats]) => {
                oltsHtml += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
                        <span style="color: var(--m3-on-surface); font-weight: 500;">${oltId}</span>
                        <div style="display: flex; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 4px; width: 65px; justify-content: flex-end; color: var(--m3-color-success); font-weight: bold; font-family: var(--font-family-mono);">
                                ${stats.online} <span class="material-symbols-rounded" style="font-size: 16px;">check_circle</span>
                            </div>
                            <span style="color: var(--m3-outline); margin: 0 8px;">|</span>
                            <div style="display: flex; align-items: center; gap: 4px; width: 65px; justify-content: flex-start; color: var(--m3-color-error); font-weight: bold; font-family: var(--font-family-mono);">
                                <span class="material-symbols-rounded" style="font-size: 16px;">error</span> ${stats.offline}
                            </div>
                        </div>
                    </div>
                `;
            });

            let alertIcon = '';
            let btnDetalhes = '';

            if (fab.nome === 'OUTROS') {
                btnDetalhes = `
                    <button onclick="openUnknownModal()" class="card-header-button" title="Ver Detalhes" style="border: 1px solid rgba(255,255,255,0.3); cursor: pointer; background: rgba(0,0,0,0.3); padding: 6px 8px;">
                        <span class="material-symbols-rounded" style="font-size: 20px;">search</span>
                    </button>
                `;
            }

            let marcaVisual = `<span class="material-symbols-rounded" style="margin-right: 5px; opacity: 0.8;">router</span> ${fab.nome}`;
            if (fab.nome === 'NOKIA') marcaVisual = `<img src="imagens/nokia.png" alt="Nokia" style="max-height: 18px; margin-right: 8px;"> NOKIA`;
            else if (fab.nome === 'FURUKAWA') marcaVisual = `<img src="imagens/furukawa.png" alt="Furukawa" style="max-height: 18px; margin-right: 8px;"> FURUKAWA`;

            grid.innerHTML += `
                <div class="overview-card" style="display: flex; flex-direction: column;">
                    <div class="card-header">
                        <h3 style="display: flex; align-items: center;">${marcaVisual}</h3>
                        ${btnDetalhes}
                    </div>
                    <div class="card-body" style="flex-direction: column; padding: 20px; align-items: stretch;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                            <div class="card-stats" style="flex: unset;">
                                <div class="stat-item" style="grid-template-columns: auto 1fr; gap: 8px;">
                                    <span class="stat-number" style="font-size: 1.5rem;">${total}</span>
                                    <label>Total</label>
                                </div>
                                <div class="stat-item online" style="grid-template-columns: auto 1fr; gap: 8px;">
                                    <span class="stat-number" style="font-size: 1.2rem;">${fab.online}</span>
                                    <label>Online</label>
                                </div>
                                <div class="stat-item offline" style="grid-template-columns: auto 1fr; gap: 8px;">
                                    <span class="stat-number" style="font-size: 1.2rem;">${fab.offline}</span>
                                    <label>Offline</label>
                                </div>
                            </div>
                            <div class="donut-chart-container" style="position: relative; right: auto; top: auto; transform: none;">
                                <svg class="donut-chart" width="80" height="80" viewBox="0 0 80 80">
                                    <circle class="donut-bg" cx="40" cy="40" r="${newRadius}"></circle>
                                    <circle class="donut-fg" cx="40" cy="40" r="${newRadius}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
                                </svg>
                                <div class="chart-text" style="font-size: 1.1em;"><span class="stat-number">${Math.round(pctOnline)}%</span></div>
                            </div>
                        </div>
                        <div style="border-top: 1px solid var(--m3-outline); padding-top: 15px;">
                            <p style="margin: 0 0 10px 0; font-size: 0.8rem; text-transform: uppercase; color: var(--m3-on-surface-variant); font-weight: 600;">Presença por OLT</p>
                            <div style="max-height: 120px; overflow-y: auto; padding-right: 5px;" class="custom-scroll">
                                ${oltsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    if (timestampEl) {
        const now = new Date();
        timestampEl.innerHTML = `
            <span class="material-symbols-rounded">calendar_today</span> ${now.toLocaleDateString('pt-BR')}
            <span style="width: 1px; height: 12px; background: rgba(255,255,255,0.3); margin: 0 5px;"></span>
            <span class="material-symbols-rounded">schedule</span> ${now.toLocaleTimeString('pt-BR')}
        `;
    }
}

window.openUnknownModal = function() {
    const tbody = document.querySelector('#tabela-desconhecidos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    window.listaDesconhecidos.sort((a, b) => a.olt.localeCompare(b.olt)).forEach(item => {
        const statusHtml = item.isOnline 
            ? '<span class="status status-normal">Online</span>' 
            : '<span class="status status-problema">Offline</span>';
        
        tbody.innerHTML += `
            <tr>
                <td><strong>${item.olt}</strong></td>
                <td>${item.pon || '-'}</td>
                <td style="font-family: var(--font-family-mono);">${item.serial}</td>
                <td>${statusHtml}</td>
            </tr>
        `;
    });

    const modal = document.getElementById('modal-desconhecidos');
    if (modal) modal.style.display = 'flex';
};

window.closeUnknownModal = function() {
    const modal = document.getElementById('modal-desconhecidos');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    const isEqpPage = window.location.pathname.includes('equipamentos.html');
    
    if (isEqpPage) {
        setTimeout(renderFabricantesDashboard, 500);
        setInterval(renderFabricantesDashboard, GLOBAL_REFRESH_SECONDS * 1000);
    }
});