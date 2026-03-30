// ==============================================================================
// olt-page.js - Controlador Exclusivo da Página de Status das OLTs (olt.html)
// Atualização: Exportação em imagem PNG (HTML2Canvas) com fundo transparente
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
                <div class="card-body" style="display: flex; flex-direction: column; padding: 15px 20px;">
                     <div class="card-stats" style="flex: 1; width: 100%;">
                        <p>Carregando...</p>
                    </div>
                </div>
            </div>
        `;
    });
}

// Função para capturar e exportar a imagem do card com bordas arredondadas (Fundo Transparente)
window.exportCardToImage = function(event, cardId, oltName) {
    if (event) event.stopPropagation();

    const card = document.getElementById(cardId);
    if (!card) return;

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        // Muda o ícone temporariamente para indicar carregamento
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
    }

    // Configura e dispara o html2canvas com backgroundColor: null para respeitar o border-radius
    html2canvas(card, {
        backgroundColor: null, 
        scale: 2, 
        useCORS: true,
        logging: false
    }).then(canvas => {
        // Cria um link temporário para forçar o download
        const link = document.createElement('a');
        link.download = `Status_${oltName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Restaura o ícone original da câmera
        if (btn) btn.innerHTML = originalContent;
    }).catch(error => {
        console.error('Erro ao gerar imagem:', error);
        alert('Ocorreu um erro ao exportar a imagem.');
        if (btn) btn.innerHTML = originalContent;
    });
};

async function fetchOltData(olt) {
    const range = `${olt.sheetTab}!A:K`;
    
    try {
        const data = await API.get(range);
        
        let datePart = '--/--/----';
        let timePart = '--:--:--';
        if (data.values && data.values.length > 0) {
            const firstRow = data.values[0];
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
                if (dateMatch) datePart = dateMatch[0];
                if (timeMatch) timePart = timeMatch[0];
            }
        }
        
        window.OLT_LAST_UPDATES[olt.id] = { date: datePart, time: timePart };

        const rows = (data.values || []).slice(1);
        
        let totalOnline = 0;
        let totalOffline = 0;

        rows.forEach(columns => {
            if (columns.length === 0) return;
            let isOnline;

            if (olt.type === 'nokia') {
                const status = columns[4] || '';
                isOnline = status.trim().toLowerCase().includes('up');
            } else { 
                const status = columns[2] || '';
                isOnline = status.trim().toLowerCase() === 'active';
            }

            if (isOnline) totalOnline++; else totalOffline++;
        });

        updateCardUI(olt.id, { onlineCount: totalOnline, offlineCount: totalOffline, type: olt.type });
        
    } catch (error) {
        console.error(`Erro para OLT ${olt.id}:`, error);
        updateCardUI(olt.id, { error: true });
    }
}

function updateCardUI(oltId, data) {
    const card = document.getElementById(`card-${oltId}`);
    if (!card) return;
    if (data.error) {
        card.querySelector('.card-stats').innerHTML = `<p style="color: #f87171;">Erro ao carregar.</p>`;
        return;
    }
    const { onlineCount, offlineCount, type } = data;
    const total = onlineCount + offlineCount;
    const onlinePercent = total > 0 ? (onlineCount / total) * 100 : 0;
    const offlinePercent = 100 - onlinePercent;
    
    const header = card.querySelector('.card-header');
    header.classList.remove('status-normal', 'status-atencao', 'status-problema');
    
    if (offlinePercent > 15 || offlineCount >= 300) { 
        header.classList.add('status-problema'); 
    }
    else if (offlinePercent > 8 || offlineCount >= 150) { 
        header.classList.add('status-atencao'); 
    }
    else { 
        header.classList.add('status-normal'); 
    }
    
    const statsHtml = `
        <div class="stat-item" style="display: grid; grid-template-columns: 50px 1fr; gap: 10px; margin-bottom: 12px; align-items: center;">
            <span class="stat-number" style="font-size: 1.5rem; display: block; text-align: left;">${total}</span>
            <label style="font-size: 0.95rem; opacity: 0.9; margin: 0; display: flex; align-items: center; gap: 6px;"><span class="material-symbols-rounded icon-total" style="font-size: 18px;">router</span> Total</label>
        </div>
        <div class="stat-item online" style="display: grid; grid-template-columns: 50px 1fr; gap: 10px; margin-bottom: 8px; align-items: center;">
            <span class="stat-number" style="font-size: 1.2rem; display: block; text-align: left;">${onlineCount}</span>
            <label style="font-size: 0.9rem; opacity: 0.9; margin: 0; display: flex; align-items: center; gap: 6px;"><span class="material-symbols-rounded icon-up" style="font-size: 18px;">check_circle</span> ${type === 'nokia' ? 'Up' : 'Active'}</label>
        </div>
        <div class="stat-item offline" style="display: grid; grid-template-columns: 50px 1fr; gap: 10px; align-items: center;">
            <span class="stat-number" style="font-size: 1.2rem; display: block; text-align: left;">${offlineCount}</span>
            <label style="font-size: 0.9rem; opacity: 0.9; margin: 0; display: flex; align-items: center; gap: 6px;"><span class="material-symbols-rounded icon-down" style="font-size: 18px;">error</span> ${type === 'nokia' ? 'Down' : 'Inactive'}</label>
        </div>
    `;
    
    const newRadius = 40; 
    const circumference = 2 * Math.PI * newRadius; 
    const offset = circumference - (onlinePercent / 100) * circumference;
    
    const chartHtml = `
        <div class="donut-chart-container" style="position: relative; right: auto; top: auto; transform: none; margin-left: 10px; flex-shrink: 0; width: 100px; height: 100px;">
            <svg class="donut-chart" width="100" height="100" viewBox="0 0 100 100">
                <circle class="donut-bg" cx="50" cy="50" r="${newRadius}"></circle>
                <circle class="donut-fg" cx="50" cy="50" r="${newRadius}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}">
                </circle>
            </svg>
            <div class="chart-text"><span class="stat-number">${Math.round(onlinePercent)}%</span></div>
        </div>
    `;

    let dateVal = '--/--/----';
    let timeVal = '--:--:--';
    if (window.OLT_LAST_UPDATES && window.OLT_LAST_UPDATES[oltId]) {
        dateVal = window.OLT_LAST_UPDATES[oltId].date;
        timeVal = window.OLT_LAST_UPDATES[oltId].time;
    }

    const footerHtml = `
        <div style="border-top: 1px solid var(--m3-outline); padding-top: 12px; margin-top: 15px; display: flex; justify-content: center; align-items: center; gap: 15px; width: 100%;">
            <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: var(--m3-on-surface-variant); font-family: var(--font-family-mono);">
                <span class="material-symbols-rounded" style="font-size: 14px;">calendar_today</span> ${dateVal}
            </div>
            <span style="color: rgba(255,255,255,0.1);">|</span>
            <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: var(--m3-on-surface-variant); font-family: var(--font-family-mono);">
                <span class="material-symbols-rounded" style="font-size: 14px;">schedule</span> ${timeVal}
            </div>
        </div>
    `;

    card.querySelector('.card-body').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div class="card-stats" style="flex: 1; min-width: 0;">${statsHtml}</div>
            ${chartHtml}
        </div>
        ${footerHtml}
    `;
}

async function runOverview() {
    const timestampEl = document.getElementById('update-timestamp');
    if (timestampEl && (timestampEl.textContent === "" || timestampEl.textContent.includes('Aguardando'))) {
        timestampEl.innerHTML = '<span class="material-symbols-rounded">hourglass_empty</span> Buscando dados...';
    }
    
    if(document.getElementById('overview-grid') && document.getElementById('overview-grid').innerHTML.trim() === "") {
        createCardPlaceholders();
    }
    
    const oltPromises = GLOBAL_MASTER_OLT_LIST.map(olt => fetchOltData(olt));
    await Promise.all(oltPromises);
    
    if (typeof updateGlobalTimestamp === 'function') {
        updateGlobalTimestamp();
    }
}

function openSuperModal(id, sheetTab, type, boards) {
    document.getElementById('super-modal-title').innerHTML = `<span class="material-symbols-rounded">dns</span> ${id}`;
    
    document.getElementById('olt-view-detalhes').style.display = 'none';
    document.getElementById('olt-view-placas').style.display = 'block';
    
    document.getElementById('olt-placas-list').innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
            <span class="material-symbols-rounded" style="font-size: 48px; display: block; margin-bottom: 10px;">hourglass_top</span>
            <h2>Estabelecendo conexão com a OLT...</h2>
            <p>Buscando status de placas, portas e circuitos.</p>
        </div>
    `;
    
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
    
    if (typeof stopOltMonitoring === 'function') {
        stopOltMonitoring();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const isOltPage = window.location.pathname.includes('olt.html');
    if (isOltPage) {
        if (typeof loadHeader === 'function') loadHeader({ title: "Status das OLTs", exactTitle: true });
        if (typeof loadFooter === 'function') loadFooter();
        runOverview();
        setInterval(runOverview, GLOBAL_REFRESH_SECONDS * 1000);
    }
});