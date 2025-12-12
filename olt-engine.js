// ==============================================================================
// olt-engine.js - Motor Corrigido (Chaves Identicas ao HTML)
// ==============================================================================

const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

const TAB_CIRCUITOS = 'CIRCUITO'; // Nome da aba alterado (Singular)
const TABLE_HEADER_NAME = 'Circuitos'; 

// --- MAPA DE COLUNAS CORRIGIDO ---
// As chaves (lado esquerdo) devem ser IGUAIS ao 'id' no seu arquivo .html
// Ex: Se no HTML esta id: 'HEL1', aqui tem que ser 'HEL1'.
const OLT_COLUMN_MAP = {
    'HEL1':  1,  // Coluna B
    'HEL2':  3,  // Coluna D
    'MGP':   5,  // Coluna F
    'PQA1':  7,  // Coluna H
    'PSV1':  9,  // Coluna J
    'PSV7':  11, // Coluna L
    'SBO2':  13, // Coluna N
    'SBO3':  15, // Coluna P
    'SBO4':  17, // Coluna R
    'SB1':   19, // Coluna T
    'SB2':   21, // Coluna V
    'SB3':   23, // Coluna X
    'PQA2':  25, // Coluna Z
    'PQA3':  27, // Coluna AB
    'LTXV2': 29, // Coluna AD
    'LTXV1': 31, // Coluna AF
    'SBO1':  33  // Coluna AH
};

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) return;

    // 1. Cria a estrutura HTML
    function createTableStructure() {
        container.innerHTML = ''; 
        for (let i = 1; i <= config.boards; i++) {
            const placaId = i.toString().padStart(2, '0');
            
            const colunasBase = config.type === 'nokia' 
                ? '<th>Porta</th><th>UP</th><th>DOWN</th><th>Total</th>'
                : '<th>Porta</th><th>Active</th><th>Inactive</th><th>Total</th>';
            
            const colunasFinais = `<th>${TABLE_HEADER_NAME}</th><th>Status</th>`;

            container.innerHTML += `
                <table>
                    <thead>
                        <tr class="table-title-row">
                            <th colspan="6">PLACA ${placaId}</th>
                        </tr>
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

    // 2. Busca dados da aba CIRCUITO
    async function fetchCircuitosData() {
        // Busca ate a coluna AK para garantir
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${TAB_CIRCUITOS}!A:AK?key=${ENGINE_API_KEY}`;
        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return data.values || [];
        } catch (e) {
            console.warn("Erro ao carregar CIRCUITO", e);
            return [];
        }
    }

    // 3. Funcao Matematica de Linhas
    function getCircuitInfo(rowsCircuitos, oltId, placa, porta, type) {
        // Garante que o ID esta sendo buscado corretamente (sem traços extras se não houver)
        const colIndex = OLT_COLUMN_MAP[oltId];
        
        // Debug silencioso: Se nao achar a coluna, retorna traço
        if (colIndex === undefined) {
            // console.warn(`OLT ${oltId} não encontrada no Mapa de Colunas.`);
            return "-";
        }
        if (!rowsCircuitos.length) return "-";

        let rowIndex = -1;
        const p = parseInt(porta);
        const sl = parseInt(placa);

        // --- CALCULO DA LINHA NA PLANILHA ---
        // A planilha começa na linha 2 (Indice 1 do array)
        
        if (type === 'nokia') {
            // Nokia (16 portas): ((Placa-1)*16) + (Porta-1) + 1
            rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
        } 
        else if (type === 'furukawa-2') {
            // Furukawa (16 portas): ((Placa-1)*16) + (Porta-1) + 1
            rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
        } 
        else if (type === 'furukawa-10') {
            // Furukawa Chassis (4 portas por placa = 40 linhas totais):
            rowIndex = ((sl - 1) * 4) + (p - 1) + 1;
        }

        if (rowIndex > 0 && rowIndex < rowsCircuitos.length) {
            const row = rowsCircuitos[rowIndex];
            return row[colIndex] || "-";
        }
        return "-";
    }

    // 4. Funcao Principal
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

                } else { // Furukawa logic
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
                    // Passamos o config.id exato (Ex: 'HEL1')
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

                const htmlRow = `
                    <tr>
                        <td>Porta ${porta.padStart(2, '0')}</td>
                        <td>${online}</td>
                        <td>${offline}</td>
                        <td>${total}</td>
                        <td style="font-size: 0.85em; color: var(--m3-on-surface-variant); font-style: italic;">${info}</td>
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