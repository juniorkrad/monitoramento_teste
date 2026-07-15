// ==============================================================================
// relatorio-pdf.js - Gerador de Relatório PDF de Equipamentos por Porta
// Formato A4, Identidade Visual (Roxo/Branco) e Agrupamento por Fabricante
// Atualização: Borda flutuante, Logos combinadas, Pílulas escuras e Resumo Global
// ==============================================================================

window.RELATORIO_SELECTIONS = [];

// Mapeamento de Fabricantes (Espelhado do equipamentos-engine)
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

// Helper para gerar as logos no PDF
function getPdfLogoHtml(marcaNome) {
    if (marcaNome === 'MAXPRINT / V-SOL') {
        return `
            <div style="display: flex; gap: 6px; align-items: center; justify-content: flex-start; width: 100%;">
                <img src="imagens/logos/maxprint.png" style="max-height: 20px; max-width: 45%; object-fit: contain;">
                <span style="color: rgba(255,255,255,0.5); font-size: 14px; font-weight: bold;">/</span>
                <img src="imagens/logos/v-sol.png" style="max-height: 20px; max-width: 45%; object-fit: contain;">
            </div>
        `;
    } else {
        let logoFile = marcaNome.toLowerCase().replace(/\s+/g, '-') + '.png';
        if (marcaNome === 'CHINA MOBILE') logoFile = 'china-mobile.png';
        if (marcaNome === 'DESCONHECIDOS') logoFile = 'desconhecidos.png';
        return `<img src="imagens/logos/${logoFile}" style="max-height: 22px; max-width: 120px; object-fit: contain;" onerror="this.outerHTML='<span style=\\'font-size:12px; font-weight:bold; color:#ffffff;\\'>${marcaNome}</span>'">`;
    }
}

// Helper para gerar a "Pílula" escura do fabricante
function getPdfPillHtml(marcaNome, count) {
    return `
        <div style="border-radius: 8px; padding: 10px 15px; display: flex; align-items: center; gap: 15px; min-width: 200px; background-color: #2f0e51;">
            <div style="flex: 1; display: flex; justify-content: flex-start; align-items: center;">
                ${getPdfLogoHtml(marcaNome)}
            </div>
            <div style="font-family: 'Roboto Mono', monospace; font-weight: bold; font-size: 18px; color: #ffffff;">
                ${count}
            </div>
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
                    <h2><span class="material-symbols-rounded">picture_as_pdf</span> Relatório de Equipamentos</h2>
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
                    <button class="search-btn" id="btn-gerar-pdf-final" style="width: 100%; padding: 16px; font-size: 1.1rem; font-weight: bold; background-color: #67079f; gap: 10px; display: none;" onclick="if(window.gerarPDFFinal) window.gerarPDFFinal()">
                        <span class="material-symbols-rounded">download</span> GERAR PDF
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
    
    // Fecha o menu lateral se estiver aberto
    const sidebar = document.getElementById('main-sidebar');
    if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
};

window.closeRelatorioModal = function(event) {
    if (event && event.target.id !== 'relatorio-pdf-modal' && event.type === 'click') return;
    const modal = document.getElementById('relatorio-pdf-modal');
    if (modal) modal.classList.remove('active');
};

// Atualiza o dropdown de Placas baseado na OLT selecionada
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

// Atualiza o dropdown de Portas (Busca portas ativas dinamicamente)
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

    // Resgata o circuito
    let circuitoNome = "N/A";
    const oltConfig = GLOBAL_MASTER_OLT_LIST.find(o => o.id === oltId);
    if (oltConfig && window.DATA_STORE && window.DATA_STORE.circuitos) {
        const pseudoConfig = { id: oltId, type: oltConfig.type };
        circuitoNome = DataMapper.getCircuitInfo(window.DATA_STORE.circuitos, pseudoConfig, placaId, portaId);
    }

    // Verifica duplicação
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
    
    // Reseta selects para próxima adição
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

// Gera o arquivo PDF e faz o download
window.gerarPDFFinal = async function() {
    const btn = document.getElementById('btn-gerar-pdf-final');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-rounded spinner" style="animation: spin 1s linear infinite;">autorenew</span> GERANDO PDF...`;
    btn.disabled = true;

    try {
        // Acumuladores Globais para o Resumo Geral
        let globalMarcaContagem = {};
        let globalTotalEquipamentos = 0;

        // Cria a folha A4 em memória (Off-screen)
        const wrapperDiv = document.createElement('div');
        wrapperDiv.style.position = 'absolute';
        wrapperDiv.style.left = '-9999px';
        wrapperDiv.style.top = '0';

        const a4Div = document.createElement('div');
        a4Div.style.width = '794px'; 
        a4Div.style.minHeight = '1123px'; 
        a4Div.style.backgroundColor = '#ffffff'; 
        a4Div.style.padding = '20px'; // Espaçamento para criar a borda flutuante
        a4Div.style.boxSizing = 'border-box';

        // Cabeçalho com Banner (Margem superior ajustada)
        const headerHtml = `
            <div style="width: 100%; text-align: center; border-bottom: 3px solid #67079f; padding-bottom: 15px; margin-bottom: 25px;">
                <img src="imagens/banner_cor.png" style="max-width: 80%; max-height: 120px; object-fit: contain; margin-top: 5px;" onerror="this.style.display='none'">
                <h1 style="color: #67079f; margin: 10px 0 5px 0; font-size: 24px; text-transform: uppercase;">Relatório de Equipamentos em Campo</h1>
                <p style="color: #49454f; margin: 0; font-family: 'Roboto Mono', monospace; font-size: 12px;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        `;

        let contentHtml = '';

        // Agrupa seleções por OLT
        const agrupadoPorOlt = {};
        window.RELATORIO_SELECTIONS.forEach(sel => {
            if (!agrupadoPorOlt[sel.olt]) agrupadoPorOlt[sel.olt] = [];
            agrupadoPorOlt[sel.olt].push(sel);
        });

        for (const oltId of Object.keys(agrupadoPorOlt)) {
            const itens = agrupadoPorOlt[oltId];
            const rowsData = window.DATA_STORE.olts[oltId].slice(1);
            
            contentHtml += `
                <div style="background-color: #f3edf7; padding: 10px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 6px solid #67079f;">
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

                    // Contagem Local
                    if (!marcaContagem[marca]) marcaContagem[marca] = 0;
                    marcaContagem[marca]++;
                    totalEquipamentos++;

                    // Contagem Global
                    if (!globalMarcaContagem[marca]) globalMarcaContagem[marca] = 0;
                    globalMarcaContagem[marca]++;
                    globalTotalEquipamentos++;
                });

                contentHtml += `
                    <div style="margin-bottom: 25px; padding-left: 10px; border-bottom: 1px dashed #cac4d0; padding-bottom: 15px;">
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
                    contentHtml += `<div style="display: flex; flex-wrap: wrap; gap: 15px;">`;
                    
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
        // RESUMO GERAL (Apenas se >= 2 portas)
        // ==========================================
        let summaryHtml = '';
        if (window.RELATORIO_SELECTIONS.length >= 2 && globalTotalEquipamentos > 0) {
            summaryHtml += `
                <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #67079f;">
                    <h2 style="margin: 0 0 15px 0; color: #67079f; font-size: 20px; text-transform: uppercase;">
                        Resumo Geral (Todas as Portas)
                    </h2>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
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

        // Montagem do Container Flutuante com Borda
        a4Div.innerHTML = `
            <div style="border: 2px solid #67079f; border-radius: 16px; padding: 20px 30px; min-height: 1083px; box-sizing: border-box; background-color: #ffffff;">
                ${headerHtml}
                <div style="padding: 0 10px;">
                    ${contentHtml}
                    ${summaryHtml}
                </div>
            </div>
        `;

        wrapperDiv.appendChild(a4Div);
        document.body.appendChild(wrapperDiv);

        if (typeof html2pdf === 'undefined') {
            throw new Error("Biblioteca html2pdf não encontrada. Verifique as tags script.");
        }

        const opt = {
            margin:       0,
            filename:     `Relatorio_Equipamentos_${new Date().getTime()}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(a4Div).save();

        document.body.removeChild(wrapperDiv);
        window.closeRelatorioModal();

    } catch (error) {
        console.error("Erro na geração do PDF:", error);
        alert("Ocorreu um erro ao gerar o PDF. Verifique o console.");
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