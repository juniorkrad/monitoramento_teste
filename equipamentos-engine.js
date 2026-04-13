// ==============================================================================
// equipamentos-engine.js - Motor Dedicado de Monitoramento de Fabricantes
// Atualização: Correção do caminho das imagens para 'imagens/logos/'
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
window.EQP_TOTALS = {};

// Função auxiliar para converter o nome da marca no nome do arquivo da logo
function getLogoFilename(nome) {
    if (nome === 'MAXPRINT / V-SOL') return 'v-sol.png';
    if (nome === 'CHINA MOBILE') return 'china-mobile.png';
    if (nome === 'DESCONHECIDOS') return 'desconhecidos.png';
    return nome.toLowerCase().replace(/\s+/g, '-') + '.png';
}

async function runEquipamentosEngine() {
    const globalBody = document.getElementById('global-equipamentos-body');
    const isEqpPage = window.location.pathname.includes('equipamentos.html');

    if (!globalBody && !isEqpPage) return;

    try {
        window.EQP_TOTALS = {};
        window.listaDesconhecidos = [];
        
        EQP_MARCAS.forEach(m => {
            window.EQP_TOTALS[m.nome] = { total: 0, online: 0, offline: 0 };
        });
        window.EQP_TOTALS['DESCONHECIDOS'] = { total: 0, online: 0, offline: 0 };

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
                    window.listaDesconhecidos.push({ olt: olt.id, pon: porta, serial: serial, isOnline: isOnline });
                }

                window.EQP_TOTALS[marca].total++;
                if (isOnline) window.EQP_TOTALS[marca].online++;
                else window.EQP_TOTALS[marca].offline++;
            });
        });

        // ==============================================================================
        // INJEÇÃO NA HOME (12 Logos em Grid)
        // ==============================================================================
        if (globalBody) {
            const allMarcas = [...EQP_MARCAS.map(m => m.nome), 'DESCONHECIDOS'];
            
            const sortedMarcas = allMarcas.map(nome => {
                return {
                    nome: nome,
                    total: window.EQP_TOTALS[nome].total,
                    online: window.EQP_TOTALS[nome].online,
                    offline: window.EQP_TOTALS[nome].offline
                };
            }).sort((a, b) => b.total - a.total); 

            let eqpHtml = `<div class="eqp-badge-grid">`;
            
            sortedMarcas.forEach(marca => {
                let color = '#60a5fa'; 
                if (marca.nome === 'DESCONHECIDOS') color = '#f87171'; 
                else if (marca.total === 0) color = 'var(--m3-on-surface-variant)';
                
                const disabledClass = marca.total === 0 ? 'disabled' : '';
                const pctOnline = marca.total > 0 ? ((marca.online / marca.total) * 100).toFixed(1) : 0;
                const logoFile = getLogoFilename(marca.nome);

                let tooltipHtml = `
                    <div class="eqp-tooltip">
                        <div class="eqp-tooltip-title">
                            <span class="material-symbols-rounded" style="font-size: 18px; color: ${color};">router</span>
                            ${marca.nome}
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

                // Injeção da imagem com o caminho corrigido para imagens/logos/
                eqpHtml += `
                    <div class="eqp-badge-item ${disabledClass}">
                        <img src="imagens/logos/${logoFile}" class="eqp-logo-img" alt="${marca.nome}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <span class="eqp-logo-text" style="display: none; color: ${marca.total > 0 ? 'var(--m3-on-surface)' : 'var(--m3-on-surface-variant)'};">${marca.nome}</span>
                        <span class="eqp-total-value">${marca.total}</span>
                        ${tooltipHtml}
                    </div>
                `;
            });
            eqpHtml += `</div>`;

            globalBody.innerHTML = `
                <div style="width: 100%; display: flex; flex-direction: column; justify-content: stretch; height: 100%;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <span class="material-symbols-rounded" style="color: #60a5fa; font-size: 20px;">inventory_2</span>
                        <h3 style="margin: 0; font-size: 1rem; color: var(--m3-on-surface);">Top 12 Fabricantes</h3>
                    </div>
                    ${eqpHtml}
                </div>
            `;
        }

        // ==============================================================================
        // INJEÇÃO NA PÁGINA DE EQUIPAMENTOS
        // ==============================================================================
        if (isEqpPage) {
            const tbody = document.querySelector('#tabela-desconhecidos tbody');
            if (tbody) {
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
            }
        }

    } catch (e) {
        console.error("Erro no motor de equipamentos:", e);
    }
}

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
        setTimeout(runEquipamentosEngine, 1500);
        setInterval(runEquipamentosEngine, GLOBAL_REFRESH_SECONDS * 1000);
    }
});