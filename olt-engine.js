// ==============================================================================
// olt-engine.js - Motor Universal de Monitoramento de OLTs
// ==============================================================================

const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) {
        console.error('Elemento .grid-container não encontrado!');
        return;
    }

    // 1. Cria a estrutura das tabelas (esqueleto)
    function createTableStructure() {
        container.innerHTML = ''; 
        for (let i = 1; i <= config.boards; i++) {
            const placaId = i.toString().padStart(2, '0');
            
            // Define colunas
            const colunas = config.type === 'nokia' 
                ? '<th>Porta</th><th>UP</th><th>DOWN</th><th>Total</th><th>Status</th>'
                : '<th>Porta</th><th>Active</th><th>Inactive</th><th>Total</th><th>Status</th>';
            
            // --- MUDANÇA AQUI: Título agora é uma linha da tabela (thead) ---
            container.innerHTML += `
                <table>
                    <thead>
                        <tr class="table-title-row">
                            <th colspan="5">PLACA ${placaId}</th>
                        </tr>
                        <tr class="table-header-row">
                            ${colunas}
                        </tr>
                    </thead>
                    <tbody id="tbody-placa-${i}"></tbody>
                </table>
            `;
        }
    }

    // 2. Função principal que busca e processa os dados
    async function populateTables() {
        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        const range = config.type === 'nokia' ? `${config.id}!A:J` : `${config.id}!A:C`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${range}?key=${ENGINE_API_KEY}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha na API do Google Sheets');
            
            const data = await response.json();
            const rows = (data.values || []).slice(1); 
            
            const portData = {};
            const newProblems = new Set(); 

            rows.forEach(columns => {
                if (columns.length === 0) return;

                let placa, porta, isOnline;

                if (config.type === 'nokia') {
                    const pon = columns[0];
                    const status = columns[4];
                    if (!pon || !status) return;
                    
                    const parts = pon.split('/'); 
                    if (parts.length < 4) return;
                    placa = parts[2];
                    porta = parts[3];
                    isOnline = status.trim().toLowerCase().includes('up');

                } else if (config.type === 'furukawa-10') {
                    const portStr = columns[0];
                    const status = columns[2];
                    if (!portStr || !status) return;

                    const parts = portStr.split('/');
                    if (parts.length < 2) return;
                    placa = parts[0];
                    porta = parts[1];
                    isOnline = status.trim().toLowerCase() === 'active';

                } else if (config.type === 'furukawa-2') {
                    const portStr = columns[0];
                    const status = columns[2];
                    if (!portStr || !status) return;

                    const match = portStr.match(/GPON(\d+)\/(\d+)/);
                    if (!match) return;
                    placa = match[1];
                    porta = match[2];
                    isOnline = status.trim().toLowerCase() === 'active';
                }

                const portKey = `${placa}/${porta}`;
                if (!portData[portKey]) {
                    portData[portKey] = { online: 0, offline: 0 };
                }

                if (isOnline) portData[portKey].online++;
                else portData[portKey].offline++;
            });

            for (const portKey in portData) {
                const [placa, porta] = portKey.split('/');
                const { online, offline } = portData[portKey];
                const total = online + offline;

                let statusClass = 'status-normal';
                let statusText = 'Normal';

                if (offline > 16) {
                    statusClass = 'status-problema';
                    statusText = 'Problema';
                } else if (offline === 16) {
                    statusClass = 'status-atencao';
                    statusText = 'Atenção';
                } else if (total > 0 && (offline / total) >= 0.5) {
                    statusClass = 'status-problema';
                    statusText = 'Problema';
                }

                if (statusClass === 'status-problema') {
                    newProblems.add(portKey);
                }

                const htmlRow = `
                    <tr>
                        <td>Porta ${porta.padStart(2, '0')}</td>
                        <td>${online}</td>
                        <td>${offline}</td>
                        <td>${total}</td>
                        <td><span class="status ${statusClass}">${statusText}</span></td>
                    </tr>
                `;

                const targetTbody = document.getElementById(`tbody-placa-${placa}`);
                if (targetTbody) {
                    targetTbody.innerHTML += htmlRow;
                }
            }

            if (typeof checkAndNotifyForNewProblems === 'function') {
                checkAndNotifyForNewProblems(newProblems);
            }

        } catch (error) {
            console.error('Erro na engine:', error);
            if (typeof showToast === 'function') {
                showToast("Erro ao atualizar dados.", "problem");
            }
        }
    }

    async function updateTime() {
        if (typeof loadTimestamp === 'function') {
            await loadTimestamp(config.id, ENGINE_API_KEY, ENGINE_SHEET_ID);
        }
    }

    createTableStructure();
    
    const runUpdate = () => {
        populateTables();
        updateTime();
    };

    runUpdate(); 
    setInterval(runUpdate, ENGINE_REFRESH_SECONDS * 1000); 
}