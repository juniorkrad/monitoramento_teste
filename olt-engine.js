// ==============================================================================
// olt-engine.js - Motor Universal de Monitoramento de OLTs
// ==============================================================================

// --- Configurações Centrais ---
const ENGINE_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const ENGINE_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const ENGINE_REFRESH_SECONDS = 300;

/**
 * Inicia o monitoramento da página.
 * @param {Object} config - Configurações da OLT.
 * @param {string} config.id - Nome da aba na planilha (Ex: 'HEL1', 'SBO2').
 * @param {string} config.type - Tipo da OLT: 'nokia', 'furukawa-10', 'furukawa-2'.
 * @param {number} config.boards - Quantidade de placas (Ex: 8, 10, 2).
 */
function startOltMonitoring(config) {
    const container = document.querySelector('.grid-container');
    if (!container) {
        console.error('Elemento .grid-container não encontrado!');
        return;
    }

    // 1. Cria a estrutura das tabelas (esqueleto)
    function createTableStructure() {
        container.innerHTML = ''; // Limpa antes de criar
        for (let i = 1; i <= config.boards; i++) {
            const placaId = i.toString().padStart(2, '0');
            const colunas = config.type === 'nokia' 
                ? '<th>Porta</th><th>UP</th><th>DOWN</th><th>Total</th><th>Status</th>'
                : '<th>Porta</th><th>Active</th><th>Inactive</th><th>Total</th><th>Status</th>';
            
            container.innerHTML += `
                <table>
                    <caption>PLACA ${placaId}</caption>
                    <thead><tr>${colunas}</tr></thead>
                    <tbody id="tbody-placa-${i}"></tbody>
                </table>
            `;
        }
    }

    // 2. Função principal que busca e processa os dados
    async function populateTables() {
        // Limpa as tabelas antes de preencher
        for (let i = 1; i <= config.boards; i++) {
            const tbody = document.getElementById(`tbody-placa-${i}`);
            if (tbody) tbody.innerHTML = '';
        }

        // Define o range baseado no tipo (Nokia usa mais colunas que Furukawa)
        const range = config.type === 'nokia' ? `${config.id}!A:J` : `${config.id}!A:C`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${ENGINE_SHEET_ID}/values/${range}?key=${ENGINE_API_KEY}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha na API do Google Sheets');
            
            const data = await response.json();
            const rows = (data.values || []).slice(1); // Ignora cabeçalho
            
            const portData = {};
            const newProblems = new Set(); 

            // --- PROCESSAMENTO DAS LINHAS ---
            rows.forEach(columns => {
                if (columns.length === 0) return;

                let placa, porta, status, isOnline;

                // Lógica específica para cada TIPO de OLT
                if (config.type === 'nokia') {
                    // Nokia: Coluna 0 (PON), Coluna 4 (Status)
                    const pon = columns[0];
                    status = columns[4];
                    if (!pon || !status) return;
                    
                    const parts = pon.split('/'); // Ex: GPON/1/1/1
                    if (parts.length < 4) return;
                    placa = parts[2];
                    porta = parts[3];
                    
                    // Verifica se é UP
                    isOnline = status.trim().toLowerCase().includes('up');

                } else if (config.type === 'furukawa-10') {
                    // Furukawa (10 Placas): Coluna 0 (Porta), Coluna 2 (Status) - Split Simples
                    const portStr = columns[0];
                    status = columns[2];
                    if (!portStr || !status) return;

                    const parts = portStr.split('/'); // Ex: 1/1
                    if (parts.length < 2) return;
                    placa = parts[0];
                    porta = parts[1];

                    // Verifica se é Active
                    isOnline = status.trim().toLowerCase() === 'active';

                } else if (config.type === 'furukawa-2') {
                    // Furukawa (2 Placas): Coluna 0 (Porta), Coluna 2 (Status) - Regex GPON
                    const portStr = columns[0];
                    status = columns[2];
                    if (!portStr || !status) return;

                    const match = portStr.match(/GPON(\d+)\/(\d+)/); // Ex: GPON1/1
                    if (!match) return;
                    placa = match[1];
                    porta = match[2];

                    // Verifica se é Active
                    isOnline = status.trim().toLowerCase() === 'active';
                }

                // Consolida os dados
                const portKey = `${placa}/${porta}`;
                if (!portData[portKey]) {
                    portData[portKey] = { online: 0, offline: 0 };
                }

                if (isOnline) portData[portKey].online++;
                else portData[portKey].offline++;
            });

            // --- RENDERIZAÇÃO E REGRAS DE NEGÓCIO ---
            for (const portKey in portData) {
                const [placa, porta] = portKey.split('/');
                const { online, offline } = portData[portKey];
                const total = online + offline;

                let statusClass = 'status-normal';
                let statusText = 'Normal';

                // Regras Universais de Alarme
                if (offline > 16) {
                    statusClass = 'status-problema';
                    statusText = 'Problema';
                } else if (offline === 16) {
                    statusClass = 'status-atencao';
                    statusText = 'Atenção';
                } else if (total > 0 && (offline / total) >= 0.5) {
                    // Regra de 50% ou 100% offline
                    statusClass = 'status-problema';
                    statusText = 'Problema';
                }

                if (statusClass === 'status-problema') {
                    newProblems.add(portKey);
                }

                // Monta o HTML da linha
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

            // Chama o sistema de notificações central
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

    // 3. Atualiza o Timestamp
    async function updateTime() {
        if (typeof loadTimestamp === 'function') {
            await loadTimestamp(config.id, ENGINE_API_KEY, ENGINE_SHEET_ID);
        }
    }

    // --- Inicialização ---
    createTableStructure();
    
    const runUpdate = () => {
        populateTables();
        updateTime();
    };

    runUpdate(); // Roda a primeira vez
    setInterval(runUpdate, ENGINE_REFRESH_SECONDS * 1000); // Agenda as próximas
}