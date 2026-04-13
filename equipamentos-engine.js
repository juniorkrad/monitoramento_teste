// ==============================================================================
// equipamentos-engine.js - Motor de Fabricantes (Visão por Marca)
// Atualização: Cards da página agora são baseados nos Fabricantes.
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

function getLogoFilename(nome) {
    if (nome === 'MAXPRINT / V-SOL') return 'v-sol.png';
    if (nome === 'CHINA MOBILE') return 'china-mobile.png';
    if (nome === 'DESCONHECIDOS') return 'desconhecidos.png';
    return nome.toLowerCase().replace(/\s+/g, '-') + '.png';
}

async function runEquipamentosEngine() {
    const globalBody = document.getElementById('global-equipamentos-body');
    const gridEqpPage = document.getElementById('equipamentos-grid');
    const isEqpPage = window.location.pathname.includes('equipamentos.html');

    if (!globalBody && !isEqpPage) return;

    try {
        let brandData = {}; // Estrutura: { 'NOKIA': { total, online, offline, olts: { 'HEL-1': 10 } } }
        let listaDesconhecidos = [];

        // Inicializa
        const todasMarcas = [...EQP_MARCAS.map(m => m.nome), 'DESCONHECIDOS'];
        todasMarcas.forEach(m => {
            brandData[m] = { total: 0, online: 0, offline: 0, olts: {} };
        });

        const ranges = GLOBAL_MASTER_OLT_LIST.map(o => `${o.sheetTab}!A:K`);
        const dataBatch = await API.getBatch(ranges);

        if (!dataBatch.valueRanges) return;

        GLOBAL_MASTER_OLT_LIST.forEach((olt, index) => {
            const rows = dataBatch.valueRanges[index].values ? dataBatch.valueRanges[index].values.slice(1) : [];

            rows.forEach(columns => {
                if (columns.length === 0) return;
                let isOnline = false, serial = '', porta = '';

                if (olt.type === 'nokia') {
                    isOnline = (columns[4] || '').trim().toLowerCase().includes('up');
                    porta = columns[0] || '';
                    serial = (columns[2] || '').trim().toUpperCase();
                } else {
                    isOnline = (columns[2] || '').trim().toLowerCase() === 'active';
                    porta = columns[0] || '';
                    serial = (columns[3] || '').trim().toUpperCase();
                }

                if (!serial || serial === '-' || serial === '') return;

                let prefix = serial.substring(0, 4);
                let marca = prefixToMarca[prefix] || 'DESCONHECIDOS';

                if (marca === 'DESCONHECIDOS') {
                    listaDesconhecidos.push({ olt: olt.id, pon: porta, serial: serial, isOnline: isOnline });
                }

                // Incrementa Globais da Marca
                brandData[marca].total++;
                if (isOnline) brandData[marca].online++;
                else brandData[marca].offline++;

                // Incrementa Breakdown por OLT
                if (!brandData[marca].olts[olt.id]) brandData[marca].olts[olt.id] = 0;
                brandData[marca].olts[olt.id]++;
            });
        });

        // ==============================================================================
        // INJEÇÃO NA HOME (Mantida conforme layout anterior)
        // ==============================================================================
        if (globalBody) {
            let eqpHtml = `<div class="eqp-badge-grid">`;
            todasMarcas.map(nome => ({ nome, ...brandData[nome] }))
                .sort((a, b) => b.total - a.total)
                .forEach(marca => {
                    const logoFile = getLogoFilename(marca.nome);
                    const color = marca.nome === 'DESCONHECIDOS' ? '#f87171' : '#60a5fa';
                    const disabledClass = marca.total === 0 ? 'disabled' : '';

                    eqpHtml += `
                        <div class="eqp-badge-item ${disabledClass}">
                            <img src="imagens/logos/${logoFile}" class="eqp-logo-img" alt="${marca.nome}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                            <span class="eqp-logo-text" style="display: none;">${marca.nome}</span>
                            <span class="eqp-total-value">${marca.total}</span>
                        </div>
                    `;
                });
            eqpHtml += `</div>`;
            globalBody.innerHTML = `<div style="width:100%"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span class="material-symbols-rounded" style="color:#60a5fa;font-size:20px">inventory_2</span><h3 style="margin:0;font-size:1rem;color:var(--m3-on-surface)">Fabricantes na Rede</h3></div>${eqpHtml}</div>`;
        }

        // ==============================================================================
        // INJEÇÃO NA PÁGINA EQUIPAMENTOS (Agora por FABRICANTE)
        // ==============================================================================
        if (isEqpPage && gridEqpPage) {
            gridEqpPage.innerHTML = '';

            todasMarcas.map(nome => ({ nome, ...brandData[nome] }))
                .filter(m => m.total > 0) // Só mostra marcas que existem na rede
                .sort((a, b) => b.total - a.total)
                .forEach(m => {
                    const logoFile = getLogoFilename(m.nome);
                    const health = ((m.online / m.total) * 100).toFixed(1);

                    // Monta a lista de OLTs
                    let oltListHtml = '';
                    Object.keys(m.olts).sort().forEach(oltId => {
                        oltListHtml += `
                            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
                                <span style="color:var(--m3-on-surface-variant)">${oltId}</span>
                                <strong style="font-family:var(--font-family-mono)">${m.olts[oltId]}</strong>
                            </div>
                        `;
                    });

                    gridEqpPage.innerHTML += `
                        <div class="overview-card" style="display:flex; flex-direction:column;">
                            <div class="card-header" style="justify-content:center; padding:15px;">
                                <img src="imagens/logos/${logoFile}" style="max-height:30px; max-width:80%; object-fit:contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                <h3 style="display:none; margin:0;">${m.nome}</h3>
                            </div>
                            <div class="card-body" style="flex-direction:column; padding:20px; gap:15px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                                    <div style="display:flex; flex-direction:column; gap:4px;">
                                        <span style="font-size:0.75rem; color:var(--m3-on-surface-variant); text-transform:uppercase;">Total Geral</span>
                                        <span style="font-size:1.8rem; font-weight:700; color:#60a5fa; font-family:var(--font-family-mono); line-height:1;">${m.total}</span>
                                    </div>
                                    <div style="text-align:right;">
                                        <span style="font-size:1.5rem; font-weight:700; color:${health >= 95 ? 'var(--m3-color-success)' : '#fbbf24'}; font-family:var(--font-family-mono);">${health}%</span><br>
                                        <span style="font-size:0.7rem; color:var(--m3-on-surface-variant); text-transform:uppercase;">Saúde</span>
                                    </div>
                                </div>

                                <div style="display:flex; gap:10px; width:100%;">
                                    <div style="flex:1; background:rgba(74,222,128,0.1); padding:8px; border-radius:8px; text-align:center;">
                                        <span style="display:block; font-size:0.7rem; color:#4ade80;">ONLINE</span>
                                        <strong style="font-family:var(--font-family-mono); color:#4ade80;">${m.online}</strong>
                                    </div>
                                    <div style="flex:1; background:rgba(248,113,113,0.1); padding:8px; border-radius:8px; text-align:center;">
                                        <span style="display:block; font-size:0.7rem; color:#f87171;">OFFLINE</span>
                                        <strong style="font-family:var(--font-family-mono); color:#f87171;">${m.offline}</strong>
                                    </div>
                                </div>

                                <div style="width:100%; margin-top:5px;">
                                    <span style="font-size:0.75rem; color:var(--m3-on-surface-variant); font-weight:700; display:block; margin-bottom:8px; border-bottom:1px solid var(--m3-outline); padding-bottom:4px;">DISTRIBUIÇÃO POR OLT</span>
                                    <div class="custom-scroll" style="max-height:150px; overflow-y:auto; padding-right:5px;">
                                        ${oltListHtml}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });

            // Tabela de Desconhecidos (Mantida no final da página)
            const tbody = document.querySelector('#tabela-desconhecidos tbody');
            if (tbody) {
                tbody.innerHTML = '';
                listaDesconhecidos.sort((a, b) => a.olt.localeCompare(b.olt)).forEach(item => {
                    tbody.innerHTML += `
                        <tr>
                            <td><strong>${item.olt}</strong></td>
                            <td>${item.pon || '-'}</td>
                            <td style="font-family: var(--font-family-mono);">${item.serial}</td>
                            <td><span class="status ${item.isOnline ? 'status-normal' : 'status-problema'}">${item.isOnline ? 'Online' : 'Offline'}</span></td>
                        </tr>
                    `;
                });
            }
        }

    } catch (e) {
        console.error("Erro no motor de equipamentos:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const isEqpPage = window.location.pathname.includes('equipamentos.html');
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');
    
    if (isEqpPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Equipamentos por Fabricante", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
    }

    if (isEqpPage || isHomePage) {
        setTimeout(runEquipamentosEngine, 1000);
        setInterval(runEquipamentosEngine, GLOBAL_REFRESH_SECONDS * 1000);
    }
});