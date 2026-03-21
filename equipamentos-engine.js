// ==============================================================================
// equipamentos-engine.js - Motor Dedicado de Monitoramento de Fabricantes
// Atualização: Margens e blocos internos compactados para o novo design Justo
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
    
    try {
        const data = await API.get(range);
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
    if (timestampEl && timestampEl.textContent.includes('Aguardando')) {
        timestampEl.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Buscando dados...';
    }

    window.listaDesconhecidos = []; 
    
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

    const grid = document.getElementById('fabricantes-grid');
    if (grid) {
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

                let btnDetalhes = '';
                if (fab.nome === 'OUTROS') {
                    btnDetalhes = `
                        <button onclick="openUnknownModal()" class="card-header-button" title="Ver Detalhes" style="border: 1px solid rgba(255,255,255,0.3); cursor: pointer; background: rgba(0,0,0,0.3); padding: 6px 8px;">
                            <span class="material-symbols-rounded" style="font-size: 20px;">search</span>
                        </button>
                    `;
                }

                let marcaVisual = `<span class="material-symbols-rounded" style="margin-right: 5px; opacity: 0.8;">router</span> ${fab.nome}`;
                if (fab.nome === 'NOKIA') marcaVisual = `<img src="imagens/logos/nokia.png" alt="Nokia" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'FURUKAWA') marcaVisual = `<img src="imagens/logos/furukawa.png" alt="Furukawa" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'CHINA MOBILE') marcaVisual = `<img src="imagens/logos/china-mobile.png" alt="China Mobile" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'ASKEY') marcaVisual = `<img src="imagens/logos/askey.png" alt="Askey" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'EURONET') marcaVisual = `<img src="imagens/logos/euronet.png" alt="Euronet" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'HUAWEI') marcaVisual = `<img src="imagens/logos/huawei.png" alt="Huawei" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'MITRASTAR') marcaVisual = `<img src="imagens/logos/mitrastar.png" alt="Mitrastar" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'PARKS') marcaVisual = `<img src="imagens/logos/parks.png" alt="Parks" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'TENDA') marcaVisual = `<img src="imagens/logos/tenda.png" alt="Tenda" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'SHORELINE') marcaVisual = `<img src="imagens/logos/shoreline.png" alt="Shoreline" style="height: 24px; object-fit: contain;">`;
                else if (fab.nome === 'MAXPRINT / V-SOL') {
                    marcaVisual = `<div style="display: flex; gap: 10px; align-items: center;"><img src="imagens/logos/maxprint.png" alt="Maxprint" style="height: 24px; object-fit: contain;"><span style="color: var(--m3-outline); font-size: 16px;">+</span><img src="imagens/logos/v-sol.png" alt="V-SOL" style="height: 24px; object-fit: contain;"></div>`;
                }

                grid.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column;">
                        <div class="card-header" style="flex-direction: column; align-items: flex-start; gap: 5px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <h3 style="display: flex; align-items: center; margin: 0;">${marcaVisual}</h3>
                                ${btnDetalhes}
                            </div>
                            <span style="font-size: 0.75rem; opacity: 0.6; font-family: var(--font-family-mono);">Prefixos: ${fab.prefixos}</span>
                        </div>
                        <div class="card-body" style="flex-direction: column; padding: 20px; align-items: stretch;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <div class="card-stats" style="flex: 1;">
                                    <div class="stat-item" style="display: grid; grid-template-columns: 60px 1fr; gap: 15px; margin-bottom: 12px; align-items: center;">
                                        <span class="stat-number" style="font-size: 1.5rem; display: block; text-align: left;">${total}</span>
                                        <label style="font-size: 1rem; opacity: 0.9; margin: 0;">Total</label>
                                    </div>
                                    <div class="stat-item online" style="display: grid; grid-template-columns: 60px 1fr; gap: 15px; margin-bottom: 8px; align-items: center;">
                                        <span class="stat-number" style="font-size: 1.2rem; display: block; text-align: left;">${fab.online}</span>
                                        <label style="font-size: 0.95rem; opacity: 0.9; margin: 0;">Online</label>
                                    </div>
                                    <div class="stat-item offline" style="display: grid; grid-template-columns: 60px 1fr; gap: 15px; align-items: center;">
                                        <span class="stat-number" style="font-size: 1.2rem; display: block; text-align: left;">${fab.offline}</span>
                                        <label style="font-size: 0.95rem; opacity: 0.9; margin: 0;">Offline</label>
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
    }

    const globalBody = document.getElementById('global-equipamentos-body');
    if (globalBody) {
        let totalEquipamentos = 0;
        listaOrdenada.forEach(f => {
            totalEquipamentos += (f.online + f.offline);
        });

        const top5 = listaOrdenada.slice(0, 5);
        let rankingHtml = '';

        top5.forEach((fab, index) => {
            let logoSrc = '';
            if (fab.nome === 'NOKIA') logoSrc = 'imagens/logos/nokia.png';
            else if (fab.nome === 'FURUKAWA') logoSrc = 'imagens/logos/furukawa.png';
            else if (fab.nome === 'CHINA MOBILE') logoSrc = 'imagens/logos/china-mobile.png';
            else if (fab.nome === 'ASKEY') logoSrc = 'imagens/logos/askey.png';
            else if (fab.nome === 'EURONET') logoSrc = 'imagens/logos/euronet.png';
            else if (fab.nome === 'HUAWEI') logoSrc = 'imagens/logos/huawei.png';
            else if (fab.nome === 'MITRASTAR') logoSrc = 'imagens/logos/mitrastar.png';
            else if (fab.nome === 'PARKS') logoSrc = 'imagens/logos/parks.png';
            else if (fab.nome === 'TENDA') logoSrc = 'imagens/logos/tenda.png';
            else if (fab.nome === 'SHORELINE') logoSrc = 'imagens/logos/shoreline.png';

            let marcaVisual = `<span style="font-size: 0.95rem; font-weight: bold; color: var(--m3-on-surface);">${fab.nome}</span>`;
            if (logoSrc) {
                marcaVisual = `<img src="${logoSrc}" alt="${fab.nome}" style="height: 20px; object-fit: contain;">`;
            } else if (fab.nome === 'MAXPRINT / V-SOL') {
                marcaVisual = `<div style="display: flex; gap: 5px; align-items: center; height: 20px;"><img src="imagens/logos/maxprint.png" style="height: 100%;"><span style="color:var(--m3-outline)">+</span><img src="imagens/logos/v-sol.png" style="height: 100%;"></div>`;
            }

            const totalFab = fab.online + fab.offline;
            const pct = totalEquipamentos > 0 ? (totalFab / totalEquipamentos) * 100 : 0;

            // Margens super reduzidas para não esmagar
            rankingHtml += `
                <div style="margin-bottom: 8px; width: 100%;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1rem; font-weight: bold; color: var(--m3-on-surface-variant); width: 20px;">${index + 1}º</span>
                            ${marcaVisual}
                        </div>
                        <span style="font-family: var(--font-family-mono); font-weight: bold; color: var(--m3-on-surface);">${totalFab}</span>
                    </div>
                    <div style="height: 8px; background: var(--m3-surface-container-high); border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${pct}%; background: #60a5fa; border-radius: 4px;"></div>
                    </div>
                </div>
            `;
        });

        // Removida linha divisória extra e ícone em azul
        globalBody.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; justify-content: stretch; height: 100%;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span class="material-symbols-rounded" style="color: #60a5fa; font-size: 20px;">emoji_events</span>
                    <h3 style="margin: 0; font-size: 1rem; color: var(--m3-on-surface);">Top 5 Fabricantes</h3>
                </div>
                <div style="flex: 1; width: 100%; display: flex; flex-direction: column; justify-content: center;">
                    ${rankingHtml}
                </div>
            </div>
        `;
    }

    if (typeof updateGlobalTimestamp === 'function') updateGlobalTimestamp();
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
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');
    
    if (isEqpPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Equipamentos", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
    }

    if (isEqpPage || isHomePage) {
        setTimeout(renderFabricantesDashboard, 500);
        setInterval(renderFabricantesDashboard, GLOBAL_REFRESH_SECONDS * 1000);
    }
});