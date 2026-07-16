// ==============================================================================
// relatorio-pdf.js - Gerador de Relatório de Equipamentos (Exportação PNG A4)
// Identidade Visual (Roxo/Branco) e Agrupamento por Fabricante
// Atualização: Correção de renderização do html2canvas (Remoção de calc e flex)
// ==============================================================================

window.RELATORIO_SELECTIONS = [];

// Mapeamento de Fabricantes
const PDF_EQP_MARCAS = [
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
    { nome: 'SHORELINE', prefixos: 'SHLN' },
    { nome: 'ZTE', prefixos: 'ZTEG' }
];

const pdfPrefixToMarca = {};
PDF_EQP_MARCAS.forEach(marca => {
    marca.prefixos.split(',').forEach(p => {
        pdfPrefixToMarca[p.trim().toUpperCase()] = marca.nome;
    });
});

// Helper para gerar as logos no PNG
function getPdfLogoHtml(marcaNome) {
    if (marcaNome === 'MAXPRINT / V-SOL') {
        return `<img src="imagens/logos/v-sol.png" style="max-height: 22px; max-width: 90px; object-fit: contain; display: block;" onerror="this.outerHTML='<span style=\\'font-size:11px; font-weight:bold; color:#ffffff;\\'>V-SOL/MAXPRINT</span>'">`;
    } else {
        let logoFile = marcaNome.toLowerCase().replace(/\s+/g, '-') + '.png';
        if (marcaNome === 'CHINA MOBILE') logoFile = 'china-mobile.png';
        if (marcaNome === 'DESCONHECIDOS') logoFile = 'desconhecidos.png';
        return `<img src="imagens/logos/${logoFile}" style="max-height: 22px; max-width: 90px; object-fit: contain; display: block;" onerror="this.outerHTML='<span style=\\'font-size:11px; font-weight:bold; color:#ffffff;\\'>${marcaNome}</span>'">`;
    }
}

// Helper para a Pílula do fabricante (Uso de Tabela e Inline-Block para estabilidade do html2canvas)
function getPdfPillHtml(marcaNome, count) {
    return `
        <div style="display: inline-block; width: 31%; background-color: #2f0e51; border-radius: 8px; padding: 12px; margin-right: 1.5%; margin-bottom: 15px; box-sizing: border-box; vertical-align: top;">
            <table style="width: 100%; border: none; padding: 0; margin: 0; background-color: transparent;">
                <tr>
                    <td style="text-align: left; vertical-align: middle; border: none; padding: 0;">
                        ${getPdfLogoHtml(marcaNome)}
                    </td>
                    <td style="text-align: right; vertical-align: middle; border: none; padding: 0; font-family: 'Roboto Mono', monospace; font-weight: bold; font-size: 16px; color: #ffffff;">
                        ${count}
                    </td>
                </tr>
            </table>
        </div>
    `;
}

// Injeta o Modal Globalmente
function injectRelatorioModal() {
    if (document.getElementById('relatorio-pdf-modal')) return;

    const modalHtml = `
        <div class="search-modal-overlay" id="relatorio-pdf-modal" onclick="if(window.closeRelatorioModal) window.closeRelatorioModal(event)">
            <div class="search-modal" onclick="event.stopPropagation()">
                <div class="search-modal-header">
                    <h2><span class="material-symbols-rounded">receipt_long</span> Relatório de Equipamentos</h2>
                    <button class="search-close-btn" onclick="if(window.closeRelatorioModal) window.closeRelatorioModal()" title="Fechar"><span class="material-symbols-rounded">close</span></button>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: flex; gap: 10px;">
                        <select id="relatorio-select-olt" class="filter-select" onchange="if(window.updateRelatorioPlacas) window.updateRelatorioPlacas()">
                            <option value="">1. Selecione a OLT</option>
                        </select>
                        <select id="relatorio-select-placa" class="filter-select" onchange="if(window.updateRelatorioPortas) window.updateRelatorioPortas()" disabled>
                            <option value="">2. Placa</option>
                        </select>
                        <select id="relatorio-select-porta" class="filter-select" disabled>
                            <option value="">3. Porta</option>
                        </select>
                    </div>
                    
                    <button class="search-btn" style="width: 100%; padding: 12px; font-weight: bold; gap: 8px;" onclick="if(window.addRelatorioSelection) window.addRelatorioSelection()">
                        <span class="material-symbols-rounded">add_circle</span> ADICIONAR PORTA AO RELATÓRIO
                    </button>
                </div>

                <div id="relatorio-selections-area" style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px; max-height: 200px; overflow-y: auto; padding-right: 5px;" class="custom-scroll">
                    <!-- Seleções aparecerão aqui -->
                </div>

                <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px; margin-top: 10px;">
                    <button class="search-btn" id="btn-gerar-pdf-final" style="width: 100%; padding: 16px; font-size: 1.1rem; font-weight: bold; background-color: #67079f; gap: 10px; display: none;" onclick="if(window.gerarImagemFinal) window.gerarImagemFinal()">
                        <span class="material-symbols-rounded">image</span> GERAR RELATÓRIO (PNG)
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Abre o Modal e carrega as OLTs
window.openRelatorioModal = function() {
    injectRelatorioModal();
    window.RELATORIO_SELECTIONS = [];
    window.renderRelatorioSelections();
    
    const oltSelect = document.getElementById('relatorio-select-olt');
    oltSelect.innerHTML = '<option value="">1. Selecione a OLT</option>';
    
    if (typeof GLOBAL_MASTER_OLT_LIST !== 'undefined') {
        GLOBAL_MASTER_OLT_LIST.forEach(olt => {
            oltSelect.innerHTML += `<option value="${olt.id}">${olt.id}</option>`;
        });
    }

    document.getElementById('relatorio-pdf-modal').classList.add('active');
    
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
};

window.closeRelatorioModal = function(event) {
    if (event && event.target.id !== 'relatorio-pdf-modal' && event.type === 'click') return;
    const modal = document.getElementById('relatorio-pdf-modal');
    if (modal) modal.classList.remove('active');
};

// Atualiza o dropdown de Placas
window.updateRelatorioPlacas = function() {
    const oltId = document.getElementById('relatorio-select-olt').value;
    const placaSelect = document.getElementById('relatorio-select-placa');
    const portaSelect = document.getElementById('relatorio-select-porta');
    
    placaSelect.innerHTML = '<option value="">2. Placa</option>';
    portaSelect.innerHTML = '<option value="">3. Porta</option>';
    portaSelect.disabled = true;

    if (!oltId || !window.DATA_STORE || !window.DATA_STORE.olts[oltId]) {
        placaSelect.disabled = true;
        return;
    }

    const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
    if (oltConfig) {
        for (let i = 1; i <= oltConfig.boards; i++) {
            placaSelect.innerHTML += `<option value="${i}">Placa ${i}</option>`;
        }
        placaSelect.disabled = false;
    }
};

// Atualiza o dropdown de Portas
window.updateRelatorioPortas = function() {
    const oltId = document.getElementById('relatorio-select-olt').value;
    const placaId = document.getElementById('relatorio-select-placa').value;
    const portaSelect = document.getElementById('relatorio-select-porta');
    
    portaSelect.innerHTML = '<option value="">3. Porta</option>';

    if (!placaId || !window.DATA_STORE || !window.DATA_STORE.olts[oltId]) {
        portaSelect.disabled = true;
        return;
    }

    const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
    const rows = window.DATA_STORE.olts[oltId].slice(1);
    const portasEncontradas = new Set();

    rows.forEach(col => {
        if (col.length === 0) return;
        const portInfo = DataMapper.extractPort(col[0], oltConfig.type);
        if (portInfo && String(portInfo.placa) === String(placaId)) {
            portasEncontradas.add(parseInt(portInfo.porta));
        }
    });

    const portasArray = Array.from(portasEncontradas).sort((a, b) => a - b);
    portasArray.forEach(p => {
        portaSelect.innerHTML += `<option value="${p}">Porta ${String(p).padStart(2, '0')}</option>`;
    });

    portaSelect.disabled = false;
};

// Adiciona a seleção à lista temporária
window.addRelatorioSelection = function() {
    const oltId = document.getElementById('relatorio-select-olt').value;
    const placaId = document.getElementById('relatorio-select-placa').value;
    const portaId = document.getElementById('relatorio-select-porta').value;

    if (!oltId || !placaId || !portaId) {
        alert('Por favor, selecione OLT, Placa e Porta.');
        return;
    }

    let circuitoNome = "N/A";
    const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
    if (oltConfig && window.DATA_STORE && window.DATA_STORE.circuitos) {
        const pseudoConfig = { id: oltId, type: oltConfig.type };
        circuitoNome = DataMapper.getCircuitInfo(window.DATA_STORE.circuitos, pseudoConfig, placaId, portaId);
    }

    const existe = window.RELATORIO_SELECTIONS.find(s => s.olt === oltId && s.placa === placaId && s.porta === portaId);
    if (existe) {
        alert('Esta porta já foi adicionada ao relatório.');
        return;
    }

    window.RELATORIO_SELECTIONS.push({
        olt: oltId,
        placa: placaId,
        porta: portaId,
        circuito: circuitoNome,
        type: oltConfig.type
    });

    window.renderRelatorioSelections();
    
    document.getElementById('relatorio-select-olt').value = '';
    document.getElementById('relatorio-select-placa').innerHTML = '<option value="">2. Placa</option>';
    document.getElementById('relatorio-select-placa').disabled = true;
    document.getElementById('relatorio-select-porta').innerHTML = '<option value="">3. Porta</option>';
    document.getElementById('relatorio-select-porta').disabled = true;
};

// Renderiza a lista de itens selecionados no Modal
window.renderRelatorioSelections = function() {
    const area = document.getElementById('relatorio-selections-area');
    const btnGerar = document.getElementById('btn-gerar-pdf-final');
    area.innerHTML = '';

    if (window.RELATORIO_SELECTIONS.length === 0) {
        area.innerHTML = `<div style="text-align:center; color: var(--m3-on-surface-variant); padding: 10px; font-size: 0.9rem;">Nenhuma porta adicionada ainda.</div>`;
        btnGerar.style.display = 'none';
        return;
    }

    window.RELATORIO_SELECTIONS.forEach((sel, index) => {
        area.innerHTML += `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid var(--m3-outline); padding: 10px 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column;">
                    <strong style="color: var(--m3-on-surface); font-size: 1rem;">${sel.olt} - Placa ${sel.placa} / Porta ${sel.porta}</strong>
                    <span style="color: var(--m3-on-surface-variant); font-size: 0.8rem; font-family: var(--font-family-mono);">Circuito: ${sel.circuito}</span>
                </div>
                <button onclick="window.removeRelatorioSelection(${index})" style="background: none; border: none; color: #f87171; cursor: pointer; padding: 5px;">
                    <span class="material-symbols-rounded">delete</span>
                </button>
            </div>
        `;
    });

    btnGerar.style.display = 'flex';
};

window.removeRelatorioSelection = function(index) {
    window.RELATORIO_SELECTIONS.splice(index, 1);
    window.renderRelatorioSelections();
};

// Gera a Imagem PNG (A4) contínua
window.gerarImagemFinal = async function() {
    const btn = document.getElementById('btn-gerar-pdf-final');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-rounded spinner" style="animation: spin 1s linear infinite;">autorenew</span> RENDERIZANDO...`;
    btn.disabled = true;

    try {
        let globalMarcaContagem = {};
        let globalTotalEquipamentos = 0;

        // Container posicionado absolutamente fora da tela
        const wrapperDiv = document.createElement('div');
        wrapperDiv.style.position = 'absolute';
        wrapperDiv.style.left = '-9999px';
        wrapperDiv.style.top = '0';

        const a4Div = document.createElement('div');
        a4Div.style.width = '794px'; 
        a4Div.style.backgroundColor = '#ffffff'; 
        a4Div.style.color = '#1c1b1f'; 
        a4Div.style.fontFamily = "'Montserrat', sans-serif";
        a4Div.style.boxSizing = 'border-box';
        a4Div.style.border = '10px solid #67079f'; 
        a4Div.style.borderRadius = '16px'; 
        a4Div.style.padding = '30px 40px'; 

        const headerHtml = `
            <div style="display: block; width: 100%; text-align: center; border-bottom: 3px solid #67079f; padding-bottom: 15px; margin-bottom: 25px;">
                <img src="imagens/banner_cor.png" style="max-width: 80%; max-height: 120px; object-fit: contain; margin-top: 5px;" onerror="this.style.display='none'">
                <h1 style="color: #67079f; margin: 10px 0 5px 0; font-size: 24px; text-transform: uppercase;">Relatório de Equipamentos em Campo</h1>
                <p style="color: #49454f; margin: 0; font-family: 'Roboto Mono', monospace; font-size: 12px;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        `;

        let contentHtml = '';

        const agrupadoPorOlt = {};
        window.RELATORIO_SELECTIONS.forEach(sel => {
            if (!agrupadoPorOlt[sel.olt]) agrupadoPorOlt[sel.olt] = [];
            agrupadoPorOlt[sel.olt].push(sel);
        });

        for (const oltId of Object.keys(agrupadoPorOlt)) {
            const itens = agrupadoPorOlt[oltId];
            const rowsData = window.DATA_STORE.olts[oltId].slice(1);
            
            contentHtml += `
                <div style="display: block; background-color: #f3edf7; padding: 10px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 6px solid #67079f;">
                    <h2 style="margin: 0; color: #67079f; font-size: 20px; display: flex; align-items: center; gap: 8px;">
                        OLT: ${oltId}
                    </h2>
                </div>
            `;

            for (const item of itens) {
                const marcaContagem = {};
                let totalEquipamentos = 0;

                rowsData.forEach(col => {
                    if (col.length === 0) return;
                    
                    const portInfo = DataMapper.extractPort(col[0], item.type);
                    if (!portInfo || String(portInfo.placa) !== String(item.placa) || String(portInfo.porta) !== String(item.porta)) return;

                    let serial = '';
                    if (item.type === 'nokia') {
                        serial = (col[2] || '').trim().toUpperCase();
                    } else {
                        serial = (col[3] || '').trim().toUpperCase();
                    }

                    if (!serial || serial === '-' || serial === '') return;

                    let prefix = serial.substring(0, 4);
                    let marca = pdfPrefixToMarca[prefix] || 'DESCONHECIDOS';

                    if (!marcaContagem[marca]) marcaContagem[marca] = 0;
                    marcaContagem[marca]++;
                    totalEquipamentos++;

                    if (!globalMarcaContagem[marca]) globalMarcaContagem[marca] = 0;
                    globalMarcaContagem[marca]++;
                    globalTotalEquipamentos++;
                });

                contentHtml += `
                    <div style="display: block; margin-bottom: 25px; padding-left: 10px; border-bottom: 1px dashed #cac4d0; padding-bottom: 15px;">
                        <h3 style="margin: 0 0 5px 0; color: #1c1b1f; font-size: 16px;">
                            Placa ${item.placa} / Porta ${String(item.porta).padStart(2, '0')}
                        </h3>
                        <p style="margin: 0 0 15px 0; color: #49454f; font-family: 'Roboto Mono', monospace; font-size: 14px; font-weight: bold;">
                            Circuito: ${item.circuito}
                        </p>
                `;

                if (totalEquipamentos === 0) {
                    contentHtml += `<p style="color: #f56c6c; font-size: 13px; font-weight: bold;">Nenhum equipamento válido identificado nesta porta.</p>`;
                } else {
                    // Container em bloco para as pílulas inline-block
                    contentHtml += `<div style="display: block; width: 100%; text-align: left;">`;
                    
                    Object.keys(marcaContagem).sort((a,b) => marcaContagem[b] - marcaContagem[a]).forEach(marcaNome => {
                        contentHtml += getPdfPillHtml(marcaNome, marcaContagem[marcaNome]);
                    });
                    
                    contentHtml += `</div>`;
                    contentHtml += `<p style="margin: 10px 0 0 0; text-align: right; font-size: 12px; color: #49454f;">Total na porta: <strong style="font-size: 14px;">${totalEquipamentos}</strong></p>`;
                }
                
                contentHtml += `</div>`;
            }
        }

        // ==========================================
        // RESUMO GERAL
        // ==========================================
        let summaryHtml = '';
        if (window.RELATORIO_SELECTIONS.length >= 2 && globalTotalEquipamentos > 0) {
            summaryHtml += `
                <div style="display: block; margin-top: 30px; padding-top: 20px; border-top: 2px solid #67079f;">
                    <h2 style="margin: 0 0 15px 0; color: #67079f; font-size: 20px; text-transform: uppercase;">
                        Resumo Geral (Todas as Portas)
                    </h2>
                    <div style="display: block; width: 100%; text-align: left;">
            `;
            
            Object.keys(globalMarcaContagem).sort((a,b) => globalMarcaContagem[b] - globalMarcaContagem[a]).forEach(marcaNome => {
                summaryHtml += getPdfPillHtml(marcaNome, globalMarcaContagem[marcaNome]);
            });
            
            summaryHtml += `
                    </div>
                    <p style="margin: 15px 0 0 0; text-align: right; font-size: 14px; color: #1c1b1f;">
                        Total Geral Selecionado: <strong style="font-size: 18px; color: #67079f;">${globalTotalEquipamentos}</strong>
                    </p>
                </div>
            `;
        }

        const footnoteHtml = `
            <div style="display: block; margin-top: 40px; padding-top: 15px; border-top: 1px solid #eaeaea; width: 100%;">
                <p style="margin: 0; font-size: 11px; color: #777; font-style: italic;">* Nota: Os equipamentos Maxprint e V-SOL utilizam o mesmo padrão de prefixo serial. A contagem correspondente abrange ambos os fabricantes.</p>
            </div>
        `;

        a4Div.innerHTML = headerHtml + contentHtml + summaryHtml + footnoteHtml;
        wrapperDiv.appendChild(a4Div);
        document.body.appendChild(wrapperDiv);

        if (typeof html2canvas === 'undefined') {
            throw new Error("Biblioteca html2canvas não encontrada. Verifique as tags script.");
        }

        // Trava para aguardar o carregamento de imagens
        await new Promise(resolve => setTimeout(resolve, 1000));

        const canvas = await html2canvas(a4Div, {
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            logging: false
        });

        const link = document.createElement('a');
        link.download = `Relatorio_Equipamentos_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        document.body.removeChild(wrapperDiv);
        window.closeRelatorioModal();

    } catch (error) {
        console.error("Erro na geração da Imagem:", error);
        alert("Ocorreu um erro ao gerar a imagem. Verifique o console.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

const style = document.createElement('style');
style.innerHTML = `
@keyframes spin { 100% { transform: rotate(360deg); } }
.spinner { display: inline-block; }
`;
document.head.appendChild(style);