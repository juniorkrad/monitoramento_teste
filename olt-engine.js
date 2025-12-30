// ==============================================================================
// olt-engine.js - Motor de Renderização e Monitoramento (Versão 5.0 - Com Relatórios)
// ==============================================================================

const API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I'; 
const SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const REFRESH_INTERVAL = 30000; // 30 segundos

let currentOltConfig = null;
let currentRawRows = []; // Armazena os dados brutos para gerar o relatório

/**
 * Inicia o monitoramento de uma OLT específica.
 */
function startOltMonitoring(config) {
    currentOltConfig = config;
    loadDataAndRender();
    setInterval(loadDataAndRender, REFRESH_INTERVAL);
}

/**
 * Busca dados e gerencia a renderização.
 */
async function loadDataAndRender() {
    const config = currentOltConfig;
    if (!config) return;

    // Mostra loading no header se existir (feedback visual rápido)
    const existingStats = document.getElementById('header-stats-block');
    if (existingStats) {
        // Opção: Mudar opacidade para indicar atualização
        existingStats.style.opacity = '0.5';
    }

    // Define o range baseado no tipo (Nokia precisa de mais colunas para status)
    const range = config.type === 'nokia' ? `${config.id}!A:E` : `${config.id}!A:C`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = (data.values || []).slice(1); // Ignora cabeçalho
        
        // Salva nas variáveis globais para o relatório usar depois
        currentRawRows = rows;

        processAndRender(rows, config);

    } catch (error) {
        console.error("Erro no engine:", error);
        // showToast(`Erro ao conectar com a planilha: ${config.id}`, 'problem'); // Opcional: descomentar se quiser flood de erro
    }
}

/**
 * Processa os dados brutos e desenha a tela.
 */
function processAndRender(rows, config) {
    const gridContainer = document.querySelector('.grid-container');
    if(!gridContainer) return;
    
    gridContainer.innerHTML = ''; // Limpa tela

    // Estruturas de dados
    const boards = {}; // Agrupamento por placa
    let totalOnline = 0;
    let totalOffline = 0;

    // 1. Processamento (Loop Principal)
    rows.forEach(row => {
        if (row.length === 0) return;

        let placa, porta, circuito, status, isOnline;
        
        // --- LÓGICA DE PARSEAMENTO ---
        if (config.type === 'nokia') {
            // Nokia: Col A (PON), Col C (Desc/Circuito), Col E (Status)
            const pon = row[0];
            circuito = row[2] || 'S/ DESC'; // Coluna C geralmente é o circuito/descrição
            status = row[4] || '';
            
            isOnline = status.trim().toLowerCase().includes('up');
            
            if (pon) {
                const parts = pon.split('/'); // Ex: 1/1/1/1
                if (parts.length >= 4) {
                    placa = parts[2]; // O terceiro item é a placa
                    porta = parts[3]; // O quarto item é a porta
                }
            }

        } else if (config.type.includes('furukawa')) {
            // Furukawa: Col A (Porta), Col B (Desc/Circuito), Col C (Status)
            const portStr = row[0];
            circuito = row[1] || 'S/ DESC'; // Coluna B
            status = row[2] || '';
            
            isOnline = status.trim().toLowerCase() === 'active';

            if (portStr) {
                if (config.type === 'furukawa-10') {
                    // Ex: 1/1
                    const parts = portStr.split('/');
                    if (parts.length >= 2) {
                        placa = parts[0];
                        porta = parts[1];
                    }
                } else {
                    // Ex: GPON 0/1
                    const match = portStr.match(/GPON\s*(\d+)\/(\d+)/i);
                    if (match) {
                        placa = match[1];
                        porta = match[2];
                    }
                }
            }
        }

        // Se conseguiu identificar Placa e Porta
        if (placa && porta) {
            // Normaliza números (01, 1 -> 1)
            const placaKey = parseInt(placa);
            const portaKey = parseInt(porta);

            if (!boards[placaKey]) boards[placaKey] = {};
            if (!boards[placaKey][portaKey]) {
                boards[placaKey][portaKey] = { 
                    total: 0, 
                    online: 0, 
                    offline: 0, 
                    circuits: [] 
                };
            }

            const slot = boards[placaKey][portaKey];
            slot.total++;
            if (isOnline) {
                slot.online++;
                totalOnline++;
            } else {
                slot.offline++;
                totalOffline++;
            }
        }
    });

    // 2. Renderiza Header com Botão de Relatório
    // AQUI É A MÁGICA: Injetamos o botão no layout existente
    renderHeaderStats(config.id, totalOnline, totalOffline);

    // 3. Renderiza Tabelas (Placas)
    // Ordena as placas (1, 2, 3...)
    const sortedPlacas = Object.keys(boards).sort((a, b) => a - b);
    
    if (sortedPlacas.length === 0) {
        gridContainer.innerHTML = '<div style="color:white; padding:20px;">Nenhum dado encontrado para esta OLT.</div>';
        return;
    }

    sortedPlacas.forEach(placaNum => {
        const slots = boards[placaNum];
        const table = document.createElement('table');
        
        // Cabeçalho da Tabela (Placa)
        let headerRow = `
            <tr class="table-title-row">
                <th colspan="17">PLACA ${placaNum}</th>
            </tr>
            <tr class="table-header-row">
                <th>PORTA</th>
        `;
        
        // Cria colunas de 1 a 16
        for (let i = 1; i <= 16; i++) {
            headerRow += `<th>${i}</th>`;
        }
        headerRow += `</tr>`;
        
        // Corpo da Tabela
        let bodyRow = `<tr><td>STATUS</td>`;
        
        for (let i = 1; i <= 16; i++) {
            const data = slots[i];
            
            if (!data) {
                // Porta vazia/inexistente na planilha
                bodyRow += `<td><span style="opacity:0.3">-</span></td>`;
            } else {
                // Lógica de Cores (Atenção vs Problema)
                let badgeClass = 'status-normal';
                
                // Regra: >16 OFF ou >50% OFF = Problema
                // Regra: =16 OFF = Atenção
                if (data.offline > 16 || (data.total > 0 && (data.offline / data.total) >= 0.5)) {
                    badgeClass = 'status-problema';
                } else if (data.offline === 16) {
                    badgeClass = 'status-atencao';
                }

                // Cria o botão da célula
                bodyRow += `
                    <td>
                        <button class="status-btn ${badgeClass}" 
                                onclick="showPortDetails('${config.id}', ${placaNum}, ${i}, ${data.online}, ${data.offline})">
                            ${data.offline}
                        </button>
                    </td>
                `;
            }
        }
        bodyRow += `</tr>`;

        table.innerHTML = `<thead>${headerRow}</thead><tbody>${bodyRow}</tbody>`;
        gridContainer.appendChild(table);
    });
}

/**
 * Renderiza as estatísticas no cabeçalho E O BOTÃO DE RELATÓRIO
 */
function renderHeaderStats(oltName, online, offline) {
    const total = online + offline;
    
    // Procura o placeholder do header (criado pelo layout.js)
    const nav = document.querySelector('.header-nav');
    
    // Remove estatísticas antigas se houver para não duplicar e atualizar
    const oldStats = document.getElementById('header-stats-block');
    if (oldStats) oldStats.remove();

    const statsDiv = document.createElement('div');
    statsDiv.id = 'header-stats-block';
    statsDiv.style.display = 'flex';
    statsDiv.style.alignItems = 'center';
    statsDiv.style.gap = '10px';
    statsDiv.style.marginRight = '15px';

    // Badge Online
    const badgeUp = `
        <div class="timestamp-badge" style="background: rgba(0,0,0,0.4); border: 1px solid var(--m3-outline); padding: 4px 12px;">
            <span class="material-symbols-rounded icon-up" style="font-size:18px">check_circle</span> 
            <span style="font-weight:700; color:#fff">${online}</span>
        </div>`;

    // Badge Offline
    const badgeDown = `
        <div class="timestamp-badge" style="background: rgba(0,0,0,0.4); border: 1px solid var(--m3-outline); padding: 4px 12px;">
            <span class="material-symbols-rounded icon-down" style="font-size:18px">error</span> 
            <span style="font-weight:700; color:#fff">${offline}</span>
        </div>`;
        
    // BOTÃO DE IMPRESSÃO / RELATÓRIO
    // Note o onclick chamando a função generateAndDownloadReport
    const btnPrint = `
        <button class="icon-btn" onclick="generateAndDownloadReport()" title="Baixar Relatório de Falhas (.txt)" 
                style="background-color: var(--m3-surface-container-high); border: 1px solid var(--m3-outline); width: 36px; height: 36px;">
            <span class="material-symbols-rounded" style="color: var(--m3-on-surface); font-size: 20px;">description</span>
        </button>
    `;

    statsDiv.innerHTML = badgeUp + badgeDown + btnPrint;

    // Insere no início do NAV (antes do relógio)
    if (nav) {
        nav.insertBefore(statsDiv, nav.firstChild);
    }
}

/**
 * FUNÇÃO DE RELATÓRIO (TXT)
 * Gera um arquivo texto com as portas que estão com PROBLEMA.
 */
function generateAndDownloadReport() {
    if (!currentRawRows || !currentOltConfig) {
        alert("Aguarde os dados carregarem...");
        return;
    }

    const oltName = currentOltConfig.id;
    const now = new Date();
    const dataHora = now.toLocaleString('pt-BR');
    
    let reportContent = `==================================================\n`;
    reportContent += `RELATÓRIO DE FALHAS - ${oltName}\n`;
    reportContent += `GERADO EM: ${dataHora}\n`;
    reportContent += `==================================================\n\n`;
    reportContent += `LISTAGEM DE PORTAS COM PROBLEMA (>16 OFF ou >50% OFF):\n\n`;

    let problemFound = false;
    const portStats = {};

    // Reprocessa os dados brutos especificamente para o relatório
    currentRawRows.forEach(row => {
        if (row.length === 0) return;
        
        let placa, porta, circuito, status, isOnline;
        
        // --- LÓGICA DE PARSEAMENTO (Idêntica ao render) ---
        if (currentOltConfig.type === 'nokia') {
            const pon = row[0];
            circuito = row[2] || 'S/ DESC';
            status = row[4] || '';
            isOnline = status.trim().toLowerCase().includes('up');
            if (pon) {
                const parts = pon.split('/');
                if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
            }
        } else {
            const portStr = row[0];
            circuito = row[1] || 'S/ DESC';
            status = row[2] || '';
            isOnline = status.trim().toLowerCase() === 'active';
            if (portStr) {
                 if (currentOltConfig.type === 'furukawa-10') {
                    const parts = portStr.split('/');
                    if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
                } else {
                    const match = portStr.match(/GPON\s*(\d+)\/(\d+)/i);
                    if (match) { placa = match[1]; porta = match[2]; }
                }
            }
        }

        if (placa && porta) {
            const key = `${placa}-${porta}`;
            if (!portStats[key]) {
                portStats[key] = { 
                    placa: parseInt(placa), 
                    porta: parseInt(porta), 
                    total: 0, 
                    offline: 0, 
                    details: [] 
                };
            }
            portStats[key].total++;
            if (!isOnline) {
                portStats[key].offline++;
                portStats[key].details.push(circuito);
            }
        }
    });

    // Ordenação numérica para o relatório
    const sortedKeys = Object.keys(portStats).sort((a, b) => {
        const p1 = portStats[a].placa;
        const p2 = portStats[b].placa;
        if (p1 !== p2) return p1 - p2;
        return portStats[a].porta - portStats[b].porta;
    });

    sortedKeys.forEach(key => {
        const data = portStats[key];
        
        // Aplica a mesma regra de "Problema" da visualização
        const isProblem = data.offline > 16 || (data.total > 0 && (data.offline / data.total) >= 0.5);
        
        if (isProblem) {
            problemFound = true;
            reportContent += `--------------------------------------------------\n`;
            reportContent += `[PLACA ${String(data.placa).padStart(2, '0')} / PORTA ${String(data.porta).padStart(2, '0')}] - STATUS: CRÍTICO\n`;
            reportContent += `Resumo: ${data.offline} clientes Offline de ${data.total} Total\n`;
            reportContent += `Circuitos Afetados:\n`;
            
            data.details.forEach(circ => {
                reportContent += `   - CIRCUITO: ${circ} - STATUS: Down\n`;
            });
            reportContent += `\n`;
        }
    });

    if (!problemFound) {
        reportContent += `NENHUMA PORTA COM STATUS CRÍTICO ENCONTRADA.\n`;
    }

    reportContent += `\n==================================================\n`;
    reportContent += `Fim do Relatório\n`;

    // Download do arquivo
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RELATORIO_FALHAS_${oltName}_${now.getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Modal simplificado (mantido para compatibilidade)
function showPortDetails(oltId, placa, porta, online, offline) {
    alert(`${oltId}\nPlaca ${placa} / Porta ${porta}\n\nOnline: ${online}\nOffline: ${offline}`);
}