// ==============================================================================
// olt-engine.js - Monitoramento e Relatório (Versão Blindada)
// ==============================================================================

const API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I'; 
const SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const REFRESH_INTERVAL = 30000; 

// Mapeamento EXATO das Colunas na aba CIRCUITO (Baseado na sua lista)
// Índice: 0=A, 1=B, 2=C... (Ex: B=1, D=3, F=5...)
const CIRCUIT_TAB_NAME = 'CIRCUITO';
const CIRCUIT_COLUMNS = {
    'HEL-1': 1,   // Coluna B
    'HEL-2': 3,   // Coluna D
    'MGP':   5,   // Coluna F
    'PQA-1': 7,   // Coluna H
    'PSV-1': 9,   // Coluna J
    'PSV-7': 11,  // Coluna L
    'SBO-2': 13,  // Coluna N
    'SBO-3': 15,  // Coluna P
    'SBO-4': 17,  // Coluna R
    'SB-1':  19,  // Coluna T
    'SB-2':  21,  // Coluna V
    'SB-3':  23,  // Coluna X
    'PQA-2': 25,  // Coluna Z
    'PQA-3': 27,  // Coluna AB
    'LTXV-2': 29, // Coluna AD
    'LTXV-1': 31, // Coluna AF
    'SBO-1': 33   // Coluna AH
};

let currentOltConfig = null;
let globalStatusRows = []; 

/**
 * Inicializa o monitoramento
 */
function startOltMonitoring(config) {
    currentOltConfig = config;
    loadDataAndRender();
    setInterval(loadDataAndRender, REFRESH_INTERVAL);
}

/**
 * Busca dados da OLT e desenha
 */
async function loadDataAndRender() {
    if (!currentOltConfig) return;

    // Feedback visual seguro
    const btn = document.getElementById('btn-report');
    if(btn) btn.style.opacity = '0.5';

    const range = currentOltConfig.type === 'nokia' ? `${currentOltConfig.id}!A:E` : `${currentOltConfig.id}!A:C`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = (data.values || []).slice(1);
        
        globalStatusRows = rows;
        processAndRender(rows);

    } catch (error) {
        console.error("Erro ao buscar dados:", error);
    } finally {
        if(btn) btn.style.opacity = '1';
    }
}

/**
 * Processa e Renderiza (Tabelas e Botão)
 */
function processAndRender(rows) {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) return; // Se não tem grid, não faz nada (segurança)

    gridContainer.innerHTML = ''; 

    const boards = {}; 
    let totalOnline = 0;
    let totalOffline = 0;

    rows.forEach(row => {
        if (row.length === 0) return;

        let placa, porta, isOnline;
        
        // Parseamento
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

    // Tenta injetar o botão de forma SEGURA
    try {
        injectPrinterButton(totalOnline, totalOffline);
    } catch (e) {
        console.warn("Header ainda não pronto para receber botão.");
    }

    // Desenha as tabelas
    const sortedPlacas = Object.keys(boards).sort((a, b) => a - b);
    
    if (sortedPlacas.length === 0) {
        gridContainer.innerHTML = '<div style="color:white; padding:20px;">Sem dados.</div>';
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
                if (data.offline > 16 || (data.total > 0 && (data.offline / data.total) >= 0.5)) {
                    badgeClass = 'status-problema';
                } else if (data.offline === 16) {
                    badgeClass = 'status-atencao';
                }
                bodyRow += `<td><button class="status-btn ${badgeClass}" onclick="showSimpleDetails(${placaNum}, ${i}, ${data.offline})">${data.offline}</button></td>`;
            }
        }
        bodyRow += `</tr>`;
        table.innerHTML = `<thead>${headerRow}</thead><tbody>${bodyRow}</tbody>`;
        gridContainer.appendChild(table);
    });
}

/**
 * Cria o botão de Impressora no Header
 */
function injectPrinterButton(online, offline) {
    const nav = document.querySelector('.header-nav');
    if (!nav) return; // Se não achou o nav, sai sem quebrar nada

    const old = document.getElementById('engine-controls');
    if (old) old.remove();

    const container = document.createElement('div');
    container.id = 'engine-controls';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '10px';
    container.style.marginRight = '10px';

    const btnHtml = `
        <button id="btn-report" class="icon-btn" onclick="generateTxtReport()" title="Relatório de Problemas" 
            style="background-color: var(--m3-surface-container-high); border: 1px solid var(--m3-outline); width: 40px; height: 40px;">
            <span class="material-symbols-rounded" style="color: var(--m3-on-surface);">print</span>
        </button>
    `;

    const badgesHtml = `
        <div class="timestamp-badge"><span class="material-symbols-rounded icon-up" style="font-size:18px">check_circle</span> ${online}</div>
        <div class="timestamp-badge"><span class="material-symbols-rounded icon-down" style="font-size:18px">error</span> ${offline}</div>
    `;

    container.innerHTML = badgesHtml + btnHtml;
    nav.insertBefore(container, nav.firstChild);
}

/**
 * GERA O ARQUIVO TXT
 */
async function generateTxtReport() {
    if (!globalStatusRows.length) return alert("Aguarde o carregamento...");

    const oltName = currentOltConfig.id;
    const colIndex = CIRCUIT_COLUMNS[oltName];

    if (colIndex === undefined) {
        alert(`Coluna não configurada para ${oltName}`);
        return;
    }

    const btn = document.getElementById('btn-report');
    if(btn) {
        btn.innerHTML = '<span class="material-symbols-rounded">downloading</span>';
        btn.style.opacity = '0.7';
    }

    try {
        // 1. Baixa a aba CIRCUITO
        const urlCircuit = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${CIRCUIT_TAB_NAME}!A:AH?key=${API_KEY}`;
        const response = await fetch(urlCircuit);
        const dataCircuit = await response.json();
        const circuitRows = dataCircuit.values || [];

        // 2. Calcula quais portas têm PROBLEMA
        const portStatusMap = {};

        globalStatusRows.forEach(row => {
            if (row.length === 0) return;
            let placa, porta, isOnline;
            
            // Parseamento (Simplificado)
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

        // 3. Cruza dados e Gera Texto
        let txtContent = `${oltName}\n\n`;
        let hasProblem = false;

        const sortedKeys = Object.keys(portStatusMap).sort((a, b) => {
            const pa = portStatusMap[a];
            const pb = portStatusMap[b];
            if (pa.placa !== pb.placa) return pa.placa - pb.placa;
            return pa.porta - pb.porta;
        });

        sortedKeys.forEach(key => {
            const p = portStatusMap[key];
            const isProblem = p.offline > 16 || (p.total > 0 && (p.offline / p.total) >= 0.5);

            if (isProblem) {
                hasProblem = true;
                
                // --- LÓGICA DE LOCALIZAÇÃO NA PLANILHA ---
                // Linha 2 do Excel = Índice 1 do Array
                // Placa 1, Porta 1 => Índice 1
                // Fórmula: ((Placa - 1) * 16) + (Porta - 1) + 1
                const rowIndex = ((p.placa - 1) * 16) + (p.porta - 1) + 1;
                
                let circuitName = "N/A";
                if (circuitRows[rowIndex] && circuitRows[rowIndex][colIndex]) {
                    circuitName = circuitRows[rowIndex][colIndex];
                }

                const sPlaca = String(p.placa).padStart(2, '0');
                const sPorta = String(p.porta).padStart(2, '0');

                txtContent += `PLACA ${sPlaca} / PORTA ${sPorta} - CIRC ${circuitName} - PROBLEMA\n`;
            }
        });

        if (!hasProblem) {
            txtContent += "NENHUMA PORTA COM STATUS DE PROBLEMA ENCONTRADA.";
        }

        // 4. Download
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
        console.error("Erro no relatório:", e);
        alert("Erro ao gerar relatório.");
    } finally {
        if(btn) {
            btn.innerHTML = '<span class="material-symbols-rounded">print</span>';
            btn.style.opacity = '1';
        }
    }
}

function showSimpleDetails(placa, porta, off) {
    console.log(`P${placa}/P${porta}: ${off}`);
}