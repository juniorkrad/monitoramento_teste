// ==============================================================================
// olt-engine.js - Monitoramento e Relatório TXT (Versão Final)
// ==============================================================================

const API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I'; 
const SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const REFRESH_INTERVAL = 30000; 

// CONFIGURAÇÃO: Onde estão os nomes dos circuitos na aba "CIRCUITO"?
// Mapeamento: ID da OLT -> Índice da Coluna (A=0, B=1, C=2, D=3...)
const CIRCUIT_TAB_NAME = 'CIRCUITO';
const CIRCUIT_COLUMNS = {
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
    'SB-3':  23, // Coluna X
    'PQA-2': 25, // Coluna Z
    'PQA-3': 27, // Coluna AB
    'LTXV-2': 29, // Coluna AD
    'LTXV-1': 31, // Coluna AF
    'SBO-1': 33  // Coluna AH
};

let currentOltConfig = null;
let globalStatusRows = []; // Guarda os dados de status (Online/Offline)

/**
 * Inicia o monitoramento
 */
function startOltMonitoring(config) {
    currentOltConfig = config;
    loadDataAndRender();
    setInterval(loadDataAndRender, REFRESH_INTERVAL);
}

/**
 * 1. Busca dados da OLT (Status) e desenha na tela
 */
async function loadDataAndRender() {
    if (!currentOltConfig) return;

    // Feedback visual sutil no botão (se existir)
    const btn = document.getElementById('btn-report');
    if(btn) btn.style.opacity = '0.5';

    // Define range de busca na aba da OLT
    const range = currentOltConfig.type === 'nokia' ? `${currentOltConfig.id}!A:E` : `${currentOltConfig.id}!A:C`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = (data.values || []).slice(1); // Remove cabeçalho
        
        globalStatusRows = rows; // Salva para uso no relatório
        processAndRender(rows);  // Desenha as tabelas

    } catch (error) {
        console.error("Erro ao buscar dados:", error);
    } finally {
        if(btn) btn.style.opacity = '1';
    }
}

/**
 * 2. Processa os dados e desenha as tabelas de Placas/Portas
 */
function processAndRender(rows) {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) return;
    gridContainer.innerHTML = ''; 

    const boards = {}; 
    let totalOnline = 0;
    let totalOffline = 0;

    // Processa linha a linha da OLT
    rows.forEach(row => {
        if (row.length === 0) return;

        let placa, porta, isOnline;
        
        // --- LÓGICA DE PARSEAMENTO (Nokia vs Furukawa) ---
        if (currentOltConfig.type === 'nokia') {
            const pon = row[0];
            const status = row[4] || '';
            isOnline = status.trim().toLowerCase().includes('up');
            if (pon) {
                const parts = pon.split('/');
                if (parts.length >= 4) { placa = parts[2]; porta = parts[3]; }
            }
        } else {
            const portStr = row[0];
            const status = row[2] || '';
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
            const pKey = parseInt(placa);
            const ptKey = parseInt(porta);

            if (!boards[pKey]) boards[pKey] = {};
            if (!boards[pKey][ptKey]) {
                boards[pKey][ptKey] = { total: 0, online: 0, offline: 0 };
            }

            boards[pKey][ptKey].total++;
            if (isOnline) {
                boards[pKey][ptKey].online++;
                totalOnline++;
            } else {
                boards[pKey][ptKey].offline++;
                totalOffline++;
            }
        }
    });

    // Injeta o botão de Impressora no Header AGORA
    injectPrinterButton(totalOnline, totalOffline);

    // Renderiza as tabelas HTML
    const sortedPlacas = Object.keys(boards).sort((a, b) => a - b);
    
    if (sortedPlacas.length === 0) {
        gridContainer.innerHTML = '<div style="color:white; padding:20px;">Sem dados para exibir.</div>';
        return;
    }

    sortedPlacas.forEach(placaNum => {
        const slots = boards[placaNum];
        const table = document.createElement('table');
        
        let headerRow = `<tr class="table-title-row"><th colspan="17">PLACA ${placaNum}</th></tr>`;
        headerRow += `<tr class="table-header-row"><th>PORTA</th>`;
        for (let i = 1; i <= 16; i++) headerRow += `<th>${i}</th>`;
        headerRow += `</tr>`;
        
        let bodyRow = `<tr><td>STATUS</td>`;
        for (let i = 1; i <= 16; i++) {
            const data = slots[i];
            if (!data) {
                bodyRow += `<td><span style="opacity:0.3">-</span></td>`;
            } else {
                let badgeClass = 'status-normal';
                // Regra de Problema: >16 OFF ou >50% OFF
                if (data.offline > 16 || (data.total > 0 && (data.offline / data.total) >= 0.5)) {
                    badgeClass = 'status-problema';
                } else if (data.offline === 16) {
                    badgeClass = 'status-atencao';
                }
                
                bodyRow += `
                    <td>
                        <button class="status-btn ${badgeClass}" onclick="showSimpleDetails(${placaNum}, ${i}, ${data.offline})">
                            ${data.offline}
                        </button>
                    </td>`;
            }
        }
        bodyRow += `</tr>`;
        table.innerHTML = `<thead>${headerRow}</thead><tbody>${bodyRow}</tbody>`;
        gridContainer.appendChild(table);
    });
}

/**
 * 3. Cria o botão de Impressora e coloca ao lado do relógio
 */
function injectPrinterButton(online, offline) {
    const nav = document.querySelector('.header-nav');
    if (!nav) return;

    // Remove anterior para não duplicar
    const old = document.getElementById('engine-controls');
    if (old) old.remove();

    const container = document.createElement('div');
    container.id = 'engine-controls';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';
    container.style.marginRight = '10px';

    // Botão Print
    const btnHtml = `
        <button id="btn-report" class="icon-btn" onclick="generateTxtReport()" title="Gerar Relatório de Falhas" 
            style="background-color: var(--m3-surface-container-high); border: 1px solid var(--m3-outline); width: 40px; height: 40px;">
            <span class="material-symbols-rounded" style="color: var(--m3-on-surface);">print</span>
        </button>
    `;

    // Badges Online/Offline
    const badgesHtml = `
        <div class="timestamp-badge"><span class="material-symbols-rounded icon-up" style="font-size:18px">check_circle</span> ${online}</div>
        <div class="timestamp-badge"><span class="material-symbols-rounded icon-down" style="font-size:18px">error</span> ${offline}</div>
    `;

    container.innerHTML = badgesHtml + btnHtml;
    nav.insertBefore(container, nav.firstChild);
}

/**
 * 4. GERA O ARQUIVO TXT (CRUZANDO DADOS)
 */
async function generateTxtReport() {
    if (!globalStatusRows.length) return alert("Aguarde os dados carregarem...");

    const oltName = currentOltConfig.id;
    const colIndex = CIRCUIT_COLUMNS[oltName];

    // Verifica se temos mapeamento para essa OLT
    if (colIndex === undefined) {
        alert(`Erro: Coluna de circuitos não configurada para ${oltName}`);
        return;
    }

    const btn = document.getElementById('btn-report');
    if(btn) {
        btn.innerHTML = '<span class="material-symbols-rounded">downloading</span>';
        btn.style.opacity = '0.7';
    }

    try {
        // --- PASSO A: Baixar a aba CIRCUITO (apenas a coluna necessária) ---
        // A API permite buscar por coluna usando letras. Vamos converter indice 1 -> B, 3 -> D, etc.
        // Mas para simplificar e ser robusto, vamos baixar a aba inteira, é rápido.
        const urlCircuit = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${CIRCUIT_TAB_NAME}!A:AH?key=${API_KEY}`;
        const response = await fetch(urlCircuit);
        const dataCircuit = await response.json();
        const circuitRows = dataCircuit.values || [];

        // --- PASSO B: Identificar portas com PROBLEMA nos dados locais ---
        const problemPorts = []; // Array para guardar {placa, porta}

        // Primeiro, vamos recalcular o status de cada porta
        const portStatusMap = {};

        globalStatusRows.forEach(row => {
            if (row.length === 0) return;
            let placa, porta, isOnline;
            
            // (Reutilizando lógica de parseamento para garantir consistência)
            if (currentOltConfig.type === 'nokia') {
                const pon = row[0];
                const status = row[4] || '';
                isOnline = status.trim().toLowerCase().includes('up');
                if (pon) {
                    const parts = pon.split('/');
                    if (parts.length >= 4) { placa = parseInt(parts[2]); porta = parseInt(parts[3]); }
                }
            } else {
                const portStr = row[0];
                const status = row[2] || '';
                isOnline = status.trim().toLowerCase() === 'active';
                if (portStr) {
                    if (currentOltConfig.type === 'furukawa-10') {
                        const parts = portStr.split('/');
                        if (parts.length >= 2) { placa = parseInt(parts[0]); porta = parseInt(parts[1]); }
                    } else {
                        const match = portStr.match(/GPON\s*(\d+)\/(\d+)/i);
                        if (match) { placa = parseInt(match[1]); porta = parseInt(match[2]); }
                    }
                }
            }

            if (placa && porta) {
                const key = `${placa}-${porta}`;
                if (!portStatusMap[key]) portStatusMap[key] = { placa, porta, total: 0, offline: 0 };
                portStatusMap[key].total++;
                if (!isOnline) portStatusMap[key].offline++;
            }
        });

        // Filtrar apenas o que é PROBLEMA
        Object.values(portStatusMap).forEach(p => {
            const isProblem = p.offline > 16 || (p.total > 0 && (p.offline / p.total) >= 0.5);
            if (isProblem) {
                problemPorts.push(p);
            }
        });

        // Se não tiver problemas, avisa e para
        if (problemPorts.length === 0) {
            alert("Nenhuma porta com status 'PROBLEMA' encontrada.");
            return;
        }

        // Ordenar: Placa 1 Porta 1, Placa 1 Porta 2...
        problemPorts.sort((a, b) => {
            if (a.placa !== b.placa) return a.placa - b.placa;
            return a.porta - b.porta;
        });

        // --- PASSO C: Montar o TXT ---
        let txtContent = `${oltName}\n\n`;

        problemPorts.forEach(p => {
            // Calcular a linha correspondente na aba CIRCUITO
            // Regra Padrão GPON: Cada placa tem 16 portas.
            // Fórmula do Índice (começando do 0): ((Placa - 1) * 16) + (Porta - 1)
            // Como a planilha tem cabeçalho na linha 1, adicionamos + 1 ao índice da array.
            
            // Ex: Placa 1, Porta 1 -> (0*16)+0 = Índice 0 -> Row 1 (cabeçalho) + 1 = Row 2 (dados)
            const circuitIndex = ((p.placa - 1) * 16) + (p.porta - 1) + 1; // +1 pelo cabeçalho
            
            let circuitName = "N/A";
            
            // Tenta pegar o nome na coluna específica
            if (circuitRows[circuitIndex] && circuitRows[circuitIndex][colIndex]) {
                circuitName = circuitRows[circuitIndex][colIndex];
            }

            const sPlaca = String(p.placa).padStart(2, '0');
            const sPorta = String(p.porta).padStart(2, '0');

            txtContent += `PLACA ${sPlaca} / PORTA ${sPorta} - CIRC ${circuitName} - PROBLEMA\n`;
        });

        // --- PASSO D: Download ---
        const blob = new Blob([txtContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RELATORIO_${oltName}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (e) {
        console.error("Erro ao gerar relatório:", e);
        alert("Erro ao consultar aba CIRCUITO.");
    } finally {
        if(btn) {
            btn.innerHTML = '<span class="material-symbols-rounded">print</span>';
            btn.style.opacity = '1';
        }
    }
}

function showSimpleDetails(placa, porta, off) {
    // Apenas para não quebrar se clicar no botão da tabela
    console.log(`Placa ${placa} Porta ${porta}: ${off} offline`);
}