// ==============================================================================
// olt-engine.js - Motor de Renderização e Relatório (Versão Minimalista)
// ==============================================================================

const API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I'; 
const SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const REFRESH_INTERVAL = 30000; 

// Mapeamento das colunas na aba "CIRCUITO" (Baseado na sua lista)
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

function startOltMonitoring(config) {
    currentOltConfig = config;
    loadDataAndRender();
    setInterval(loadDataAndRender, REFRESH_INTERVAL);
}

async function loadDataAndRender() {
    if (!currentOltConfig) return;

    const range = currentOltConfig.type === 'nokia' ? `${currentOltConfig.id}!A:E` : `${currentOltConfig.id}!A:C`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = (data.values || []).slice(1);
        
        globalStatusRows = rows; // Guarda dados para o relatório
        
        // 1. PRIMEIRO: Renderiza as tabelas (Prioridade Máxima)
        renderTables(rows);

        // 2. DEPOIS: Injeta o botão de impressora de forma segura
        injectPrinterButtonSafe();

    } catch (error) {
        console.error("Erro ao buscar dados:", error);
    }
}

function renderTables(rows) {
    const gridContainer = document.querySelector('.grid-container');
    if (!gridContainer) return;

    gridContainer.innerHTML = ''; // Limpa a área das tabelas

    const boards = {}; 

    // Processamento dos dados
    rows.forEach(row => {
        if (row.length === 0) return;

        let placa, porta, isOnline;
        
        // Lógica Nokia
        if (currentOltConfig.type === 'nokia') {
            const pon = row[0];
            const status = row[4] || '';
            isOnline = status.trim().toLowerCase().includes('up');
            if (pon) {
                const parts = pon.split('/');
                if (parts.length >= 4) { placa = parseInt(parts[2]); porta = parseInt(parts[3]); }
            }
        } 
        // Lógica Furukawa
        else {
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
            if (!boards[placa]) boards[placa] = {};
            if (!boards[placa][porta]) {
                boards[placa][porta] = { total: 0, offline: 0 };
            }

            boards[placa][porta].total++;
            if (!isOnline) boards[placa][porta].offline++;
        }
    });

    // Renderiza HTML das Tabelas
    const sortedPlacas = Object.keys(boards).sort((a, b) => a - b);
    
    if (sortedPlacas.length === 0) {
        gridContainer.innerHTML = '<div style="color:white; padding:20px;">Nenhum dado encontrado.</div>';
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
                bodyRow += `<td><button class="status-btn ${badgeClass}" style="cursor: default">${data.offline}</button></td>`;
            }
        }
        bodyRow += `</tr>`;
        table.innerHTML = `<thead>${headerRow}</thead><tbody>${bodyRow}</tbody>`;
        gridContainer.appendChild(table);
    });
}

function injectPrinterButtonSafe() {
    // Procura o container de navegação criado pelo layout.js
    const nav = document.querySelector('.header-nav');
    if (!nav) return; 

    // Verifica se o botão JÁ existe para não duplicar
    if (document.getElementById('btn-report')) return;

    // Cria o botão isolado
    const btn = document.createElement('button');
    btn.id = 'btn-report';
    btn.className = 'icon-btn';
    btn.title = 'Gerar Relatório de Falhas (.txt)';
    btn.onclick = generateTxtReport;
    btn.style.cssText = 'background-color: var(--m3-surface-container-high); border: 1px solid var(--m3-outline); width: 40px; height: 40px; margin-right: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;';
    btn.innerHTML = '<span class="material-symbols-rounded" style="color: var(--m3-on-surface);">print</span>';

    // Insere o botão como PRIMEIRO item do menu (à esquerda do relógio)
    // Isso evita mexer no relógio ou no botão de menu lateral
    nav.insertBefore(btn, nav.firstChild);
}

async function generateTxtReport() {
    if (!globalStatusRows.length) return alert("Aguarde os dados carregarem...");

    const oltName = currentOltConfig.id;
    const colIndex = CIRCUIT_COLUMNS[oltName];

    if (colIndex === undefined) {
        alert(`Coluna de circuito não configurada para ${oltName}.`);
        return;
    }

    // Muda ícone para indicar carregamento
    const btn = document.getElementById('btn-report');
    if(btn) btn.innerHTML = '<span class="material-symbols-rounded">downloading</span>';

    try {
        // 1. Baixa a aba CIRCUITO
        const urlCircuit = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${CIRCUIT_TAB_NAME}!A:AH?key=${API_KEY}`;
        const response = await fetch(urlCircuit);
        const dataCircuit = await response.json();
        const circuitRows = dataCircuit.values || [];

        // 2. Identifica Portas com PROBLEMA
        const portStatusMap = {};

        globalStatusRows.forEach(row => {
            if (row.length === 0) return;
            let placa, porta, isOnline;
            
            // Reutiliza lógica de parseamento
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

        // 3. Monta o Conteúdo do TXT
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
                
                // Cálculo da Linha na Planilha CIRCUITO
                const rowIndex = ((p.placa - 1) * 16) + (p.porta - 1) + 1;
                
                let circuitName = "CIRC_NAO_ENCONTRADO";
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
        const now = new Date();
        a.download = `RELATORIO_${oltName}_${now.getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (e) {
        console.error("Erro relatório:", e);
        alert("Erro ao gerar relatório.");
    } finally {
        if(btn) btn.innerHTML = '<span class="material-symbols-rounded">print</span>';
    }
}