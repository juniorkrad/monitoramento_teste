// ==============================================================================
// olt-engine.js - VERSÃO TESTE (Colunas Ocultas)
// ==============================================================================

const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

const TAB_CIRCUITOS = 'CIRCUITO'; 
const TABLE_HEADER_NAME = 'Circuitos'; 

const OLT_COLUMN_MAP = {
    'HEL1':  1,  'HEL2':  3,  'MGP':   5,  'PQA1':  7,  'PSV1':  9,  'PSV7':  11,
    'SBO2':  13, 'SBO3':  15, 'SBO4':  17, 'SB1':   19, 'SB2':   21, 'SB3':   23,
    'PQA2':  25, 'PQA3':  27, 'LTXV2': 29, 'LTXV1': 31, 'SBO1':  33
};

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) return;

    // 1. Cria a estrutura HTML (SEM AS COLUNAS DE CONTAGEM)
    function createTableStructure() {
        container.innerHTML = ''; 
        for (let i = 1; i <= config.boards; i++) {
            const placaId = i.toString().padStart(2, '0');
            
            // --- TESTE: REMOVIDAS AS COLUNAS UP/DOWN/TOTAL ---
            const colunasBase = '<th>Porta</th>'; 
            
            const colunasFinais = `<th>${TABLE_HEADER_NAME}</th><th>Status</th>`;

            container.innerHTML += `
                <table>
                    <thead>
                        <tr class="table-title-row">
                            <th colspan="3">PLACA ${placaId}</th> </tr>
                        <tr class="table-header-row">
                            ${colunasBase}
                            ${colunasFinais}
                        </tr>
                    </thead>
                    <tbody id="tbody-placa-${i}"></tbody>
                </table>
            `;
        }
    }

    async function fetchCircuitosData() {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${TAB_CIRCUITOS}!A:AK?key=${ENGINE_API_KEY}`;
        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return data.values || [];
        } catch (e) {
            return [];
        }
    }

    function getCircuitInfo(rowsCircuitos, oltId, placa, porta, type) {
        const colIndex = OLT_COLUMN_MAP[oltId];
        if (colIndex === undefined) return "-";
        if (!rowsCircuitos.length) return "-";

        let rowIndex = -1;
        const p = parseInt(porta);
        const sl = parseInt(placa);

        if (type === 'nokia') rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
        else if (type === 'furukawa-2') rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
        else if (type === 'furukawa-10') rowIndex = ((sl - 1) * 4) + (p - 1) + 1;

        if (rowIndex > 0 && rowIndex < rowsCircuitos.length) {
            const row = rowsCircuitos[rowIndex];
            return row[colIndex] || "-";
        }
        return "-";
    }

    async function populateTables() {
        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        const rangeOlt = config.type === 'nokia' ? `${config.id}!A:E` : `${config.id}!A:C`;
        const urlOlt = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${rangeOlt}?key=${ENGINE_API_KEY}`;

        try {
            const [responseOlt, rowsCircuitos] = await Promise.all([
                fetch(urlOlt),
                fetchCircuitosData()
            ]);

            if (!responseOlt.ok) throw new Error('Falha na API OLT');
            const dataOlt = await responseOlt.json();
            const rowsOlt = (dataOlt.values || []).slice(1);
            
            const portData = {};
            const newProblems = new Set(); 

            rowsOlt.forEach(columns => {
                if (columns.length === 0) return;
                let placa, porta, isOnline;

                if (config.type === 'nokia') {
                    const pon = columns[0];
                    const status = columns[4];
                    if (!pon || !status) return;
                    const parts = pon.split('/'); 
                    if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                    isOnline = status.trim().toLowerCase().includes('up');

                } else { 
                    const portStr = columns[0];
                    const status = columns[2];
                    if (!portStr || !status) return;
                    
                    if (config.type === 'furukawa-10') {
                        const parts = portStr.split('/');
                        if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                    } else {
                        const match = portStr.match(/GPON(\d+)\/(\d+)/);
                        if (match) { placa = match[1]; porta = match[2]; }
                    }
                    isOnline = status.trim().toLowerCase() === 'active';
                }

                const portKey = `${placa}/${porta}`;
                if (!portData[portKey]) {
                    const infoExtra = getCircuitInfo(rowsCircuitos, config.id, placa, porta, config.type);
                    portData[portKey] = { online: 0, offline: 0, info: infoExtra };
                }

                if (isOnline) portData[portKey].online++; else portData[portKey].offline++;
            });

            for (const portKey in portData) {
                const [placa, porta] = portKey.split('/');
                const { online, offline, info } = portData[portKey];
                const total = online + offline;

                let statusClass = 'status-normal';
                let statusText = 'Normal';

                if (offline > 16) { statusClass = 'status-problema'; statusText = 'Problema'; }
                else if (offline === 16) { statusClass = 'status-atencao'; statusText = 'Atenção'; }
                else if (total > 0 && (offline / total) >= 0.5) { statusClass = 'status-problema'; statusText = 'Problema'; }

                if (statusClass === 'status-problema') newProblems.add(portKey);

                // --- LINHA HTML SIMPLIFICADA ---
                const htmlRow = `
                    <tr>
                        <td>Porta ${porta.padStart(2, '0')}</td>
                        <td><span class="circuit-badge">${info}</span></td>
                        <td><span class="status ${statusClass}">${statusText}</span></td>
                    </tr>
                `;

                const targetTbody = document.getElementById(`tbody-placa-${placa}`);
                if (targetTbody) targetTbody.innerHTML += htmlRow;
            }

            if (typeof checkAndNotifyForNewProblems === 'function') {
                checkAndNotifyForNewProblems(newProblems);
            }

        } catch (error) {
            console.error('Erro na engine:', error);
        }
    }

    async function updateTime() {
        if (typeof loadTimestamp === 'function') {
            await loadTimestamp(config.id, ENGINE_API_KEY, ENGINE_SHEET_ID);
        }
    }

    createTableStructure();
    const runUpdate = () => { populateTables(); updateTime(); };
    runUpdate(); 
    setInterval(runUpdate, ENGINE_REFRESH_SECONDS * 1000); 
}