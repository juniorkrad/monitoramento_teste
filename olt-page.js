// ==============================================================================
// olt-page.js - Controlador Exclusivo da Página de Status das OLTs (olt.html)
// Atualização: Escala Visual Padronizada, Cores e Ícones Específicos
// ==============================================================================

window.OLT_LAST_UPDATES = {};
        
function createCardPlaceholders() {
    const grid = document.getElementById('overview-grid');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    GLOBAL_MASTER_OLT_LIST.forEach(olt => {
        grid.innerHTML += `
            <div class="overview-card" id="card-${olt.id}" style="display: flex; flex-direction: column;">
                <div class="card-header">
                    <h3><span class="material-symbols-rounded">dns</span> ${olt.id}</h3>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="exportCardToImage(event, 'card-${olt.id}', '${olt.id}')" class="card-header-button" title="Exportar Card">
                            <span class="material-symbols-rounded">photo_camera</span>
                        </button>
                        <button onclick="openSuperModal('${olt.id}', '${olt.sheetTab}', '${olt.type}', ${olt.boards})" class="card-header-button" title="Ver Placas e Portas">
                            <span class="material-symbols-rounded">manage_search</span>
                        </button>
                    </div>
                </div>
                <div class="card-body" id="body-${olt.id}" style="display: flex; flex-direction: column; padding: 16px 20px; width: 100%; box-sizing: border-box;">
                    <div class="loading-spinner-small" style="margin: 20px auto;"></div>
                </div>
            </div>
        `;
    });
}

function updateOltCards() {
    if (!window.DATA_STORE || !window.DATA_STORE.isReady) return;

    GLOBAL_MASTER_OLT_LIST.forEach(olt => {
        const values = window.DATA_STORE.olts[olt.id] || [];
        const rows = values.slice(1);
        
        let online = 0;
        let offline = 0;
        let lastUpdateStr = '--/--/---- --:--:--';

        if (values.length > 0) {
            const firstRow = values[0];
            let cellData = firstRow[10] ? String(firstRow[10]) : '';
            if (!cellData) {
                for (let i = firstRow.length - 1; i >= 0; i--) {
                    let val = firstRow[i] ? String(firstRow[i]) : '';
                    if (val.match(/\d{2}\/\d{2}/) && val.match(/\d{2}:\d{2}/)) {
                        cellData = val;
                        break;
                    }
                }
            }
            if (cellData) {
                const dateMatch = cellData.match(/\d{2}\/\d{2}\/\d{2,4}/);
                const timeMatch = cellData.match(/\d{2}:\d{2}(:\d{2})?/);
                if (dateMatch && timeMatch) {
                    lastUpdateStr = `${dateMatch[0]} ${timeMatch[0]}`;
                }
            }
        }

        window.OLT_LAST_UPDATES[olt.id] = lastUpdateStr;

        rows.forEach(columns => {
            if (columns.length === 0) return;
            const statusStr = columns[olt.type === 'nokia' ? 4 : 2];
            if (DataMapper.isOnline(statusStr, olt.type)) {
                online++;
            } else {
                offline++;
            }
        });

        const total = online + offline;
        
        const bodyEl = document.getElementById(`body-${olt.id}`);
        if (bodyEl) {
            bodyEl.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; width: 100%;">
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;" title="Clientes Online">
                            <span class="material-symbols-rounded" style="color: var(--m3-color-success); font-size: 20px;">arrow_circle_up</span>
                            <span style="font-size: 1.2rem; color: var(--m3-color-success); font-weight: bold; font-family: var(--font-family-mono);">${online}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;" title="Clientes Offline">
                            <span class="material-symbols-rounded" style="color: var(--m3-color-error); font-size: 20px;">arrow_circle_down</span>
                            <span style="font-size: 1.2rem; color: var(--m3-color-error); font-weight: bold; font-family: var(--font-family-mono);">${offline}</span>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;" title="Total de Clientes">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded" style="color: #ffffff; font-size: 28px;">router</span>
                            <span style="font-size: 2.2rem; font-family: var(--font-family-mono); font-weight: bold; color: #ffffff; line-height: 1;">${total}</span>
                        </div>
                        <span style="font-size: 0.8rem; color: var(--m3-on-surface-variant); text-transform: uppercase; margin-top: 6px;">Total</span>
                    </div>
                </div>
                <div style="border-top: 1px solid var(--m3-outline); padding-top: 12px; display: flex; justify-content: center; align-items: center; gap: 15px; width: 100%; font-size: 0.75rem; color: var(--m3-on-surface-variant); font-family: var(--font-family-mono);">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="material-symbols-rounded" style="font-size: 14px;">calendar_today</span> ${lastUpdateStr.split(' ')[0] || '--/--/----'}
                    </div>
                    <span style="color: rgba(255,255,255,0.1);">|</span>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="material-symbols-rounded" style="font-size: 14px;">schedule</span> ${lastUpdateStr.split(' ')[1] || '--:--:--'}
                    </div>
                </div>
            `;
        }
    });
}

window.exportCardToImage = function(event, cardId, oltName) {
    if (event) event.stopPropagation();

    const card = document.getElementById(cardId);
    if (!card) return;

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
    }

    html2canvas(card, {
        backgroundColor: null, 
        scale: 2, 
        useCORS: true,
        logging: false
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Status_${oltName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        if (btn) btn.innerHTML = originalContent;
    }).catch(error => {
        console.error('Erro ao gerar imagem:', error);
        alert('Ocorreu um erro ao exportar a imagem.');
        if (btn) btn.innerHTML = originalContent;
    });
};

function openSuperModal(id, sheetTab, type, boards) {
    const btnTxt = document.getElementById('btn-export-placa-txt');
    if (btnTxt) btnTxt.style.display = 'inline-block';

    const placasList = document.getElementById('olt-placas-list');
    if (placasList) {
        placasList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: var(--m3-on-surface-variant); padding: 40px 0;">
                <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 10px;">hourglass_top</span>
                <h2>Estabelecendo conexão com a OLT...</h2>
                <p>Buscando status de placas, portas e circuitos.</p>
            </div>
        `;
    }
    
    document.getElementById('super-modal').style.display = 'flex';
    
    if (typeof startOltMonitoring === 'function') {
        startOltMonitoring({
            id: sheetTab,
            type: type,
            boards: boards,
            oltName: id 
        });
    }
}

function backToOltPlacas() {
    document.getElementById('olt-view-detalhes').style.display = 'none';
    document.getElementById('olt-view-placas').style.display = 'block';
}

function closeSuperModal(event) {
    if (event && event.target.id !== 'super-modal' && !event.target.classList.contains('close-modal')) return;
    document.getElementById('super-modal').style.display = 'none';
    document.getElementById('olt-placas-list').innerHTML = ''; 
    
    const btnTxt = document.getElementById('btn-export-placa-txt');
    if (btnTxt) btnTxt.style.display = 'none';

    if (typeof stopOltMonitoring === 'function') {
        stopOltMonitoring();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const isOltPage = window.location.pathname.includes('olt.html');
    if (isOltPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Status Geral de OLTs", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        createCardPlaceholders();
    }
});

window.addEventListener('dadosAtualizados', () => {
    const isOltPage = window.location.pathname.includes('olt.html');
    if (isOltPage) {
        updateOltCards();
    }
});