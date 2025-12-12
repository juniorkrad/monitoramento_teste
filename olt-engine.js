// ==============================================================================
// olt-engine.js - Motor com Mapeamento Matricial (Corrigido)
// ==============================================================================

const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

const TAB_CIRCUITOS = 'CIRCUITOS'; // Nome EXATO da aba na planilha
const TABLE_HEADER_NAME = 'Circuitos'; // Nome que aparece no site

// --- MAPA DE COLUNAS (Baseado na sua lista) ---
// A=0, B=1, C=2, D=3, ... Z=25, AA=26, AB=27...
const OLT_COLUMN_MAP = {
    'HEL-1': 1,  // Coluna B
    'HEL-2': 3,  // Coluna D
    'MGP':   5,  // Coluna F
    'PQA-1': 7,  // Coluna H
    'PSV-1': 9,  // Coluna J
    'PSV-7': 11, // Coluna L
    'SBO-2': 13, // Coluna N
    'SBO-3': 15, // Coluna P
    'SBO-4': 17, // Coluna R
    'SB-1':  19, // Coluna T
    'SB-2':  21, // Coluna V
    'SB-3':  23, // Coluna X (Confirme se SB3 e PQA2 compartilham X ou se foi erro de digitação)
    'PQA-2': 25, // Coluna Z (Ajustado para Z seguindo a lógica par)
    'PQA-3': 27, // Coluna AB
    'LTXV-2': 29,// Coluna AD
    'LTXV-1': 31,// Coluna AF
    'SBO-1': 33  // Coluna AH
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
            
            // Coluna nova com o nome corrigido
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

    // 2. Busca dados da aba CIRCUITOS
    async function fetchCircuitosData() {
        // Busca até a coluna AK para garantir que pegamos tudo
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${TAB_CIRCUITOS}!A:AK?key=${ENGINE_API_KEY}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                console.error("Erro ao ler aba CIRCUITOS. Verifique o nome da aba.");
                return [];
            }
            const data = await response.json();
            return data.values || [];
        } catch (e) {
            console.warn("Erro de rede ao carregar CIRCUITOS", e);
            return [];
        }
    }

    // 3. Função Matemática: Calcula a linha exata baseada na porta
    function getCircuitInfo(rowsCircuitos, oltId, placa, porta, type) {
        // Pega o índice da coluna baseado no Mapa
        const colIndex = OLT_COLUMN_MAP[oltId];
        
        // Se a OLT não estiver no mapa ou planilha vazia, retorna traço
        if (colIndex === undefined || !rowsCircuitos.length) return "-";

        let rowIndex = -1;
        const p = parseInt(porta);
        const sl = parseInt(placa);

        // LÓGICA DE LINHAS (Baseada na informação: Linha 2 é a primeira porta)
        // O array 'rowsCircuitos' começa no índice 0 (que é a Linha 1 do Excel)
        // Então Linha 2 do Excel = Índice 1 do Array.
        
        if (type === 'nokia') {
            // Nokia: 16 portas por placa.
            // Placa 1 (1-16) -> Linhas 2-17 (Indices 1-16)
            // Placa 2 (1-16) -> Linhas 18-33 (Indices 17-32)
            // Fórmula: ((Placa - 1) * 16) + (Porta - 1) + 1
            rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
        } 
        else if (type === 'furukawa-2') {
            // Furukawa (PQA2, SB1...): 16 portas por placa?
            // Se for 16 portas:
            rowIndex = ((sl - 1) * 16) + (p - 1) + 1;
        } 
        else if (type === 'furukawa-10') {
            // LTXV1, SBO1: "Linha 2 até 41". Isso são 40 linhas.
            // Se são 10 placas (como sugere o nome furukawa-10), são 4 portas por placa?
            // 10 placas * 4 portas = 40.
            rowIndex = ((sl - 1) * 4) + (p - 1) + 1;
        }

        // Segurança para não travar se o cálculo sair fora da planilha
        if (rowIndex > 0 && rowIndex < rowsCircuitos.length) {
            const row = rowsCircuitos[rowIndex];
            // Retorna o valor da coluna ou traço se estiver vazio
            return row[colIndex] || "-";
        }
        return "-";
    }

    // 4. Função Principal
    async function populateTables() {
        // Limpa visual
        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        const rangeOlt = config.type === 'nokia' ? `${config.id}!A:E` : `${config.id}!A:C`;
        const urlOlt = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${rangeOlt}?key=${ENGINE_API_KEY}`;

        try {
            // Busca PARALELA (OLT + Circuitos)
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

                // Lógica de Parsing (Nokia vs Furukawa)
                if (config.type === 'nokia') {
                    const pon = columns[0];
                    const status = columns[4];
                    if (!pon || !status) return;
                    const parts = pon.split('/'); 
                    if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
                    isOnline = status.trim().toLowerCase().includes('up');

                } else { // Furukawa
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
                    // --- O MOMENTO DO CRUZAMENTO ---
                    // Usa a função matemática para pegar a info correta da linha
                    const infoExtra = getCircuitInfo(rowsCircuitos, config.id, placa, porta, config.type);
                    portData[portKey] = { online: 0, offline: 0, info: infoExtra };
                }

                if (isOnline) portData[portKey].online++; else portData[portKey].offline++;
            });

            // Renderiza Tabela
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