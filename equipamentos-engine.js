// ==============================================================================
// equipamentos-engine.js - Motor Dedicado de Monitoramento de Fabricantes
// Atualização: Correção do caminho de imagens (Home) e Restauração dos Cards (Página OLT)
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

// Paleta de Cores Fixa para os Gráficos
const BRAND_COLORS = {
    'NOKIA': '#3b82f6', 
    'CHINA MOBILE': '#06b6d4', 
    'FURUKAWA': '#10b981', 
    'ASKEY': '#8b5cf6', 
    'EURONET': '#ec4899', 
    'HUAWEI': '#ef4444', 
    'MITRASTAR': '#f59e0b', 
    'MAXPRINT / V-SOL': '#f97316', 
    'PARKS': '#6366f1', 
    'TENDA': '#14b8a6', 
    'SHORELINE': '#84cc16', 
    'DESCONHECIDOS': '#6b7280'
};

window.listaDesconhecidos = [];
window.EQP_TOTALS = {};
window.eqpChartInstances = window.eqpChartInstances || {}; // Armazena gráficos para evitar sobreposição

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
        window.EQP_TOTALS = {};
        window.listaDesconhecidos = [];
        let oltBrandData = {}; // Armazena a contagem de marcas por OLT
        
        EQP_MARCAS.forEach(m => {
            window.EQP_TOTALS[m.nome] = { total: 0, online: 0, offline: 0 };
        });
        window.EQP_TOTALS['DESCONHECIDOS'] = { total: 0, online: 0, offline: 0 };

        const ranges = GLOBAL_MASTER_OLT_LIST.map(o => `${o.sheetTab}!A:K`);
        const dataBatch = await API.getBatch(ranges);

        if (!dataBatch.valueRanges) return;

        GLOBAL_MASTER_OLT_LIST.forEach((olt, index) => {
            oltBrandData[olt.id] = {};
            EQP_MARCAS.forEach(m => oltBrandData[olt.id][m.nome] = 0);
            oltBrandData[olt.id]['DESCONHECIDOS'] = 0;

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
                oltBrandData[olt.id][marca]++; // Incrementa para o gráfico individual

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
        // INJEÇÃO NA PÁGINA DE EQUIPAMENTOS (Restauração dos Cards e Gráficos)
        // ==============================================================================
        if (isEqpPage && gridEqpPage) {
            
            // Destrói gráficos antigos para evitar sobreposição ao atualizar
            Object.values(window.eqpChartInstances).forEach(chart => chart.destroy());
            window.eqpChartInstances = {};
            gridEqpPage.innerHTML = '';

            GLOBAL_MASTER_OLT_LIST.forEach(olt => {
                const data = oltBrandData[olt.id];
                const totalOlt = Object.values(data).reduce((a, b) => a + b, 0);

                if (totalOlt === 0) return;

                const sortedOltBrands = Object.keys(data)
                    .map(name => ({ nome: name, count: data[name] }))
                    .filter(item => item.count > 0)
                    .sort((a, b) => b.count - a.count);

                let listHtml = '';
                let chartLabels = [];
                let chartData = [];
                let chartColors = [];

                sortedOltBrands.forEach((item, idx) => {
                    chartLabels.push(item.nome);
                    chartData.push(item.count);
                    chartColors.push(BRAND_COLORS[item.nome] || '#9ca3af');

                    if (idx < 4) { // Mostra apenas os 4 maiores na lista para não quebrar o layout
                        const pct = ((item.count / totalOlt) * 100).toFixed(1);
                        listHtml += `
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">
                                <span style="color: var(--m3-on-surface); display: flex; align-items: center;">
                                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${BRAND_COLORS[item.nome] || '#9ca3af'}; margin-right:6px;"></span>
                                    ${item.nome}
                                </span>
                                <strong>${item.count} <span style="color: var(--m3-on-surface-variant); font-size: 0.75rem;">(${pct}%)</span></strong>
                            </div>
                        `;
                    }
                });

                if (sortedOltBrands.length > 4) {
                    const othersCount = sortedOltBrands.slice(4).reduce((acc, curr) => acc + curr.count, 0);
                    listHtml += `
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--m3-on-surface-variant); padding-top: 2px;">
                            <span style="display: flex; align-items: center;">
                                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color: transparent; border: 1px solid var(--m3-on-surface-variant); margin-right:6px;"></span>
                                Outros...
                            </span>
                            <strong>${othersCount}</strong>
                        </div>
                    `;
                }

                gridEqpPage.innerHTML += `
                    <div class="overview-card" style="display: flex; flex-direction: column; width: 100%;">
                        <div class="card-header" style="justify-content: space-between; padding: 12px 20px;">
                            <h3 style="font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 8px;">
                                <span class="material-symbols-rounded" style="font-size: 20px;">dns</span> ${olt.id}
                            </h3>
                            <span style="font-size: 0.85rem; font-weight: bold; color: var(--m3-on-surface-variant); display: flex; align-items: center; gap: 5px;">
                                <span class="material-symbols-rounded" style="font-size: 16px;">router</span> Total: ${totalOlt}
                            </span>
                        </div>
                        <div class="card-body" style="display: flex; flex-direction: row; gap: 20px; padding: 20px; align-items: center;">
                            <div style="width: 100px; height: 100px; position: relative; flex-shrink: 0;">
                                <canvas id="chart-${olt.id}"></canvas>
                            </div>
                            <div style="flex: 1; display: flex; flex-direction: column; gap: 8px; justify-content: center;">
                                ${listHtml}
                            </div>
                        </div>
                    </div>
                `;

                // Renderiza o gráfico logo após a injeção do HTML
                setTimeout(() => {
                    const ctx = document.getElementById(`chart-${olt.id}`);
                    if (ctx) {
                        window.eqpChartInstances[olt.id] = new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: chartLabels,
                                datasets: [{
                                    data: chartData,
                                    backgroundColor: chartColors,
                                    borderWidth: 0,
                                    hoverOffset: 4
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '75%',
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        callbacks: {
                                            label: function(context) {
                                                const val = context.parsed;
                                                const pct = ((val / totalOlt) * 100).toFixed(1);
                                                return ` ${val} eqp (${pct}%)`;
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                }, 50);
            });

            // Preenchimento da Tabela de Desconhecidos (Mantido Intacto)
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

document.addEventListener('DOMContentLoaded', () => {
    const isEqpPage = window.location.pathname.includes('equipamentos.html');
    const isHomePage = window.location.pathname.includes('index.html') || window.location.pathname === '/' || !window.location.pathname.endsWith('.html');
    
    if (isEqpPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Equipamentos", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
    }

    if (isEqpPage || isHomePage) {
        setTimeout(runEquipamentosEngine, 1000);
        setInterval(runEquipamentosEngine, GLOBAL_REFRESH_SECONDS * 1000);
    }
});