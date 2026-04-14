// ==============================================================================
// equipamentos-engine.js - Motor de Fabricantes (Visão por Marca)
// Atualização: Inclusão da exibição dos Prefixos na Home (Tooltip) e nos Cards
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

// Lógica de Renderização de Logo (Suporte a Múltiplas Logos)
function getLogoHtml(nome) {
    if (nome === 'MAXPRINT / V-SOL') {
        // Exibe as duas logos lado a lado
        return `
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="imagens/logos/maxprint.png" class="eqp-logo-img" alt="Maxprint" style="max-height: 24px;" onerror="this.style.display='none';">
                <span style="color: var(--m3-on-surface-variant); font-size: 10px;">/</span>
                <img src="imagens/logos/v-sol.png" class="eqp-logo-img" alt="V-SOL" style="max-height: 24px;" onerror="this.style.display='none';">
            </div>
        `;
    }
    
    let logoFile = nome.toLowerCase().replace(/\s+/g, '-') + '.png';
    if (nome === 'CHINA MOBILE') logoFile = 'china-mobile.png';
    if (nome === 'DESCONHECIDOS') logoFile = 'desconhecidos.png';

    return `<img src="imagens/logos/${logoFile}" class="eqp-logo-img" alt="${nome}" style="max-height: 24px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <span class="eqp-logo-text" style="display: none; color: var(--m3-on-surface); font-size: 0.85rem; font-weight: bold; text-transform: uppercase;">${nome}</span>`;
}

async function runEquipamentosEngine() {
    const globalBody = document.getElementById('global-equipamentos-body');
    const gridEqpPage = document.getElementById('equipamentos-grid');
    const isEqpPage = window.location.pathname.includes('equipamentos.html');

    if (!globalBody && !isEqpPage) return;

    try {
        let brandData = {}; 
        let listaDesconhecidos = [];

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

                brandData[marca].total++;
                if (isOnline) brandData[marca].online++;
                else brandData[marca].offline++;

                if (!brandData[marca].olts[olt.id]) brandData[marca].olts[olt.id] = 0;
                brandData[marca].olts[olt.id]++;
            });
        });

        // ==============================================================================
        // INJEÇÃO NA HOME
        // ==============================================================================
        if (globalBody) {
            let eqpHtml = `<div class="eqp-badge-grid">`;
            todasMarcas.map(nome => ({ nome, ...brandData[nome] }))
                .sort((a, b) => b.total - a.total)
                .forEach(marca => {
                    const color = marca.nome === 'DESCONHECIDOS' ? '#f87171' : '#60a5fa';
                    const disabledClass = marca.total === 0 ? 'disabled' : '';
                    const pctOnline = marca.total > 0 ? ((marca.online / marca.total) * 100).toFixed(1) : 0;
                    
                    // Busca os prefixos da marca atual para exibir no tooltip
                    const marcaInfo = EQP_MARCAS.find(em => em.nome === marca.nome);
                    const prefixosTxt = marcaInfo ? marcaInfo.prefixos : 'Não Mapeado';

                    let tooltipHtml = `
                        <div class="eqp-tooltip">
                            <div class="eqp-tooltip-title">
                                <span class="material-symbols-rounded" style="font-size: 18px; color: ${color};">router</span>
                                ${marca.nome}
                            </div>
                            <div class="eqp-tooltip-line">
                                <span style="color: var(--m3-on-surface-variant);">Prefixos:</span> 
                                <strong style="font-family: var(--font-family-mono); font-size: 0.75rem;">${prefixosTxt}</strong>
                            </div>
                            <div class="eqp-tooltip-line">
                                <span style="color: var(--m3-on-surface-variant);">Total na Rede:</span> 
                                <strong>${marca.total}</strong>
                            </div>
                            <div class="eqp-tooltip-line">
                                <span style="color: var(--m3-on-surface-variant);">Online:</span> 
                                <strong style="color: #4ade80;">${marca.online}</strong>
                            </div>
                            <div class="eqp-tooltip-line">
                                <span style="color: var(--m3-on-surface-variant);">Offline:</span> 
                                <strong style="color: #f87171;">${marca.offline}</strong>
                            </div>
                            <div class="eqp-tooltip-line">
                                <span style="color: var(--m3-on-surface-variant);">Saúde:</span> 
                                <strong>${pctOnline}%</strong>
                            </div>
                        </div>
                    `;

                    eqpHtml += `
                        <div class="eqp-badge-item ${disabledClass}">
                            ${getLogoHtml(marca.nome)}
                            <span class="eqp-total-value" style="margin-top: 8px;">${marca.total}</span>
                            ${tooltipHtml}
                        </div>
                    `;
                });
            eqpHtml += `</div>`;
            globalBody.innerHTML = `<div style="width:100%"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span class="material-symbols-rounded" style="color:#60a5fa;font-size:20px">inventory_2</span><h3 style="margin:0;font-size:1rem;color:var(--m3-on-surface)">Fabricantes na Rede</h3></div>${eqpHtml}</div>`;
        }

        // ==============================================================================
        // INJEÇÃO NA PÁGINA EQUIPAMENTOS
        // ==============================================================================
        if (isEqpPage && gridEqpPage) {
            gridEqpPage.innerHTML = '';

            todasMarcas.map(nome => ({ nome, ...brandData[nome] }))
                .filter(m => m.total > 0) 
                .sort((a, b) => b.total - a.total)
                .forEach(m => {
                    const health = ((m.online / m.total) * 100).toFixed(1);
                    
                    // Busca os prefixos da marca atual para exibir no card
                    const marcaInfo = EQP_MARCAS.find(em => em.nome === m.nome);
                    const prefixosTxt = marcaInfo ? marcaInfo.prefixos : 'Não Mapeado';

                    let oltListHtml = '';
                    Object.keys(m.olts).sort().forEach(oltId => {
                        oltListHtml += `
                            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem;">
                                <span style="color:var(--m3-on-surface-variant)">${oltId}</span>
                                <strong style="font-family:var(--font-family-mono)">${m.olts[oltId]}</strong>
                            </div>
                        `;
                    });

                    // Botão Padrão Ícone no Cabeçalho (Apenas para Desconhecidos)
                    let headerButtonHtml = '';
                    if (m.nome === 'DESCONHECIDOS') {
                        headerButtonHtml = `
                            <button class="card-header-button" onclick="openUnknownModal()" title="Ver Detalhes">
                                <span class="material-symbols-rounded" style="font-size: 22px;">manage_search</span>
                            </button>
                        `;
                    }

                    gridEqpPage.innerHTML += `
                        <div class="overview-card" style="display:flex; flex-direction:column;">
                            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; padding:15px 20px;">
                                <div style="display:flex; align-items:center; justify-content:center; flex:1;">
                                    ${getLogoHtml(m.nome)}
                                </div>
                                ${headerButtonHtml}
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

                                <div style="width: 100%; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 6px; text-align: center; margin-top: -5px; box-sizing: border-box;">
                                    <span style="font-size:0.7rem; color:var(--m3-on-surface-variant); text-transform:uppercase; margin-right: 5px;">Prefixos:</span>
                                    <span style="font-family:var(--font-family-mono); font-size:0.8rem; color:var(--m3-on-surface); font-weight:bold;">${prefixosTxt}</span>
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

            // Popula a tabela do Modal de Desconhecidos
            const tbody = document.querySelector('#tabela-desconhecidos tbody');
            if (tbody) {
                tbody.innerHTML = '';
                if (listaDesconhecidos.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--m3-on-surface-variant);">Nenhum equipamento desconhecido encontrado.</td></tr>`;
                } else {
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
        }

    } catch (e) {
        console.error("Erro no motor de equipamentos:", e);
    }
}

// Funções para controle do Modal
window.openUnknownModal = function() {
    const modal = document.getElementById('modal-desconhecidos');
    if (modal) modal.style.display = 'flex';
};

window.closeUnknownModal = function(event) {
    if (event && event.target.id !== 'modal-desconhecidos' && !event.target.classList.contains('close-modal')) return;
    const modal = document.getElementById('modal-desconhecidos');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    const isEqpPage = window.location.pathname.includes('equipamentos.html');
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');
    
    if (isEqpPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Equipamentos por Fabricante", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        
        setTimeout(updateGlobalTimestamp, 500); 
    }

    if (isEqpPage || isHomePage) {
        setTimeout(runEquipamentosEngine, 1000);
        setInterval(runEquipamentosEngine, GLOBAL_REFRESH_SECONDS * 1000);
    }
});