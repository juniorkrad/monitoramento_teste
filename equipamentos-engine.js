// ==============================================================================
// equipamentos-engine.js - Motor Dedicado de Monitoramento de Fabricantes
// ==============================================================================

const EQP_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const EQP_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const EQP_REFRESH_SECONDS = 300;

const EQP_OLT_LIST = [
    { id: 'HEL-1', sheetTab: 'HEL1', type: 'nokia' },
    { id: 'HEL-2', sheetTab: 'HEL2', type: 'nokia' },
    { id: 'PQA-1', sheetTab: 'PQA1', type: 'nokia' },
    { id: 'PSV-1', sheetTab: 'PSV1', type: 'nokia' },
    { id: 'MGP',   sheetTab: 'MGP',  type: 'nokia' },
    { id: 'LTXV-1', sheetTab: 'LTXV1', type: 'furukawa-10' }, 
    { id: 'LTXV-2', sheetTab: 'LTXV2', type: 'furukawa-2' },
    { id: 'PQA-2',  sheetTab: 'PQA2',  type: 'furukawa-2' },
    { id: 'PQA-3',  sheetTab: 'PQA3',  type: 'furukawa-2' },
    { id: 'SB-1',   sheetTab: 'SB1',   type: 'furukawa-2' },
    { id: 'SB-2',   sheetTab: 'SB2',   type: 'furukawa-2' },
    { id: 'SB-3',   sheetTab: 'SB3',   type: 'furukawa-2' },
    { id: 'PSV-7',  sheetTab: 'PSV7',  type: 'furukawa-2' },
    { id: 'SBO-1',  sheetTab: 'SBO1',  type: 'furukawa-10' },
    { id: 'SBO-2',  sheetTab: 'SBO2',  type: 'furukawa-2' },
    { id: 'SBO-3',  sheetTab: 'SBO3',  type: 'furukawa-2' },
    { id: 'SBO-4',  sheetTab: 'SBO4',  type: 'furukawa-2' },
];

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

// ==============================================================================
// FUNÇÕES DE BUSCA E PROCESSAMENTO
// ==============================================================================

async function fetchEqpOltData(olt) {
    const range = olt.type === 'nokia' ? `${olt.sheetTab}!A:E` : `${olt.sheetTab}!A:D`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${EQP_SHEET_ID}/values/${range}?key=${EQP_API_KEY}`;
    
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
    if (!grid) return; // Trava de segurança caso não esteja na página

    window.listaDesconhecidos = []; 
    
    const promises = EQP_OLT_LIST.map(olt => fetchEqpOltData(olt));
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

            let marcaVisual = `<span class="material-symbols-rounded" style="margin-right: 5px;">router</span> ${fab.nome}`;
            
            if (fab.nome === 'NOKIA') {
                marcaVisual = `<img src="imagens/logos/nokia.png" alt="Nokia" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'FURUKAWA') {
                marcaVisual = `<img src="imagens/logos/furukawa.png" alt="Furukawa" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'CHINA MOBILE') {
                marcaVisual = `<img src="imagens/logos/china-mobile.png" alt="China Mobile" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'ASKEY') {
                marcaVisual = `<img src="imagens/logos/askey.png" alt="Askey" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'EURONET') {
                marcaVisual = `<img src="imagens/logos/euronet.png" alt="Euronet" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'HUAWEI') {
                marcaVisual = `<img src="imagens/logos/huawei.png" alt="Huawei" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'MITRASTAR') {
                marcaVisual = `<img src="imagens/logos/mitrastar.png" alt="Mitrastar" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'PARKS') {
                marcaVisual = `<img src="imagens/logos/parks.png" alt="Parks" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'TENDA') {
                marcaVisual = `<img src="imagens/logos/tenda.png" alt="Tenda" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'SHORELINE') {
                marcaVisual = `<img src="imagens/logos/shoreline.png" alt="Shoreline" style="height: 24px; object-fit: contain;">`;
            } else if (fab.nome === 'MAXPRINT / V-SOL') {
                marcaVisual = `
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <img src="imagens/logos/maxprint.png" alt="Maxprint" style="height: 24px; object-fit: contain;">
                        <span style="color: var(--m3-outline); font-size: 16px;">+</span>
                        <img src="imagens/logos/v-sol.png" alt="V-SOL" style="height: 24px; object-fit: contain;">
                    </div>
                `;
            }

            grid.innerHTML += `
                <div class="overview-card" style="display: flex; flex-direction: column;">
                    <div class="card-header" style="flex-direction: column; align-items: flex-start; padding: 12px 15px; background: rgba(234, 208, 255, 0.15); border-bottom: 1px solid rgba(234, 208, 255, 0.3);">
                        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                            <h3 style="font-size: 1.2rem; margin-bottom: 2px; display: flex; align-items: center; gap: 5px;">${marcaVisual} ${alertIcon}</h3>
                            ${btnDetalhes}
                        </div>
                        <span style="font-size: 0.75rem; opacity: 0.8; font-family: var(--font-family-mono);">Prefixos: ${fab.prefixos}</span>
                    </div>
                    
                    <div class="card-body" style="flex-direction: column; align-items: stretch; padding: 15px;">
                        
                        <div style="display: flex; position: relative; padding-bottom: 15px; border-bottom: 1px solid var(--m3-outline);">
                            <div class="card-stats" style="padding-right: 90px;">
                                <div class="stat-item" style="grid-template-columns: 50px 1fr; gap: 8px;">
                                    <span class="stat-number" style="font-size: 1.5rem;">${total}</span>
                                    <label style="font-size: 0.8rem;"><span class="material-symbols-rounded" style="font-size: 16px; width: 16px;">router</span> Total</label>
                                </div>
                                <div class="stat-item online" style="grid-template-columns: 50px 1fr; gap: 8px;">
                                    <span class="stat-number" style="font-size: 1.5rem;">${fab.online}</span>
                                    <label style="font-size: 0.8rem;"><span class="material-symbols-rounded" style="font-size: 16px; width: 16px;">check_circle</span> Online</label>
                                </div>
                                <div class="stat-item offline" style="grid-template-columns: 50px 1fr; gap: 8px;">
                                    <span class="stat-number" style="font-size: 1.5rem;">${fab.offline}</span>
                                    <label style="font-size: 0.8rem;"><span class="material-symbols-rounded" style="font-size: 16px; width: 16px;">error</span> Offline</label>
                                </div>
                            </div>
                            
                            <div class="donut-chart-container" style="width: 80px; height: 80px; right: 0;">
                                <svg class="donut-chart" width="80" height="80" viewBox="0 0 100 100">
                                    <circle class="donut-bg" cx="50" cy="50" r="${newRadius}" stroke-width="12"></circle>
                                    <circle class="donut-fg" cx="50" cy="50" r="${newRadius}" stroke-width="12"
                                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}">
                                    </circle>
                                </svg>
                                <div class="chart-text"><span class="stat-number" style="font-size: 1rem;">${Math.round(pctOnline)}%</span></div>
                            </div>
                        </div>

                        <div style="margin-top: 10px;">
                            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--m3-on-surface-variant); font-weight: bold; margin-bottom: 5px; letter-spacing: 0.5px;">
                                Distribuição na Rede
                            </div>
                            <div style="max-height: 100px; overflow-y: auto; padding-right: 5px;" class="custom-scroll">
                                ${oltsHtml}
                            </div>
                        </div>

                    </div>
                </div>
            `;
        });
    }

    // --- ATUALIZAÇÃO DO HORÁRIO NO CABEÇALHO ---
    const now = new Date();
    const dataHoje = now.toLocaleDateString('pt-BR');
    // Força o formato hh:mm:ss
    const horaAgora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (timestampEl) {
        timestampEl.innerHTML = `
            <span class="material-symbols-rounded">calendar_today</span> ${dataHoje}
            <span style="width: 1px; height: 12px; background: rgba(255,255,255,0.3); margin: 0 5px;"></span>
            <span class="material-symbols-rounded">schedule</span> ${horaAgora}
        `;
        
        timestampEl.classList.remove('updated-anim');
        void timestampEl.offsetWidth; 
        timestampEl.classList.add('updated-anim');
    }
}

// ==============================================================================
// MODAIS E INTERAÇÕES
// ==============================================================================

window.openUnknownModal = function() {
    const tbody = document.querySelector('#tabela-desconhecidos tbody');
    if (!tbody) return;
    
    tbody.innerHTML = ''; 

    window.listaDesconhecidos.forEach(item => {
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

// ==============================================================================
// INICIALIZADOR AUTÔNOMO
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Verifica se estamos na página de equipamentos para rodar o motor
    const isEqpPage = window.location.pathname.includes('equipamentos.html');
    
    if (isEqpPage) {
        // Atraso de 500ms para garantir que o layout.js injetou o cabeçalho primeiro
        setTimeout(renderFabricantesDashboard, 500);
        
        // Configura a auto-atualização em background (ex: a cada 5 minutos)
        setInterval(renderFabricantesDashboard, EQP_REFRESH_SECONDS * 1000);
    }
});