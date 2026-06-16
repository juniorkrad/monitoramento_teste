// ==============================================================================
// data-mapper.js - O "Cérebro" de Tratamento e Cruzamento de Dados
// Responsável por padronizar portas, status e cruzar Localidades e Circuitos.
// ==============================================================================

const DataMapper = {

    // 1. Dicionário de Colunas de Bairros (Tirado do layout.js)
    BAIRRO_COL_MAP: {
        'HEL1': 1,  'HEL2': 3,  'MGP': 5,   'PQA1': 7,  'PSV1': 9,  
        'PSV7': 11, 'SBO2': 13, 'SBO3': 15, 'SBO4': 17, 'SB1': 19,  
        'SB2': 21,  'SB3': 23,  'PQA2': 25, 'PQA3': 27, 'LTXV2': 29,
        'LTXV1': 31, 'SBO1': 33  
    },

    // 2. Extrator Inteligente de Porta e Placa
    // Limpa regex e strings sujas (Ex: "GPON 01/02" ou "1/1/3/4")
    extractPort: function(rawPortStr, oltType) {
        if (!rawPortStr) return null;
        let placa = null, porta = null;

        if (oltType === 'nokia') {
            const match = String(rawPortStr).match(/(\d+)\/(\d+)\/(\d+)\/(\d+)/);
            if (match) { placa = match[3]; porta = match[4]; }
        } else if (oltType === 'furukawa-10') {
            const parts = String(rawPortStr).split('/');
            if (parts.length >= 2) { placa = parts[0]; porta = parts[1]; }
        } else {
            // Padrão Furukawa-2 / Outros
            const match = String(rawPortStr).match(/GPON\s*(\d+)\/(\d+)/i);
            if (match) { placa = match[1]; porta = match[2]; }
        }

        if (placa && porta) {
            return { placa: parseInt(placa, 10), porta: parseInt(porta, 10) };
        }
        return null;
    },

    // 3. Normalizador de Status
    // Transforma qualquer variação de texto em um simples Booleano (Online = true/false)
    isOnline: function(rawStatusStr, oltType) {
        const status = String(rawStatusStr || '').trim().toLowerCase();
        if (oltType === 'nokia') {
            return status.includes('up');
        } else {
            return status === 'active';
        }
    },

    // 4. Calculadora de Linha (Onde o circuito/bairro dessa porta está na planilha?)
    calculateRowIndex: function(placa, porta, oltType) {
        const p = parseInt(porta);
        const sl = parseInt(placa);
        
        if (oltType === 'nokia' || oltType === 'furukawa-2') {
            return ((sl - 1) * 16) + (p - 1) + 1;
        } else if (oltType === 'furukawa-10') {
            return ((sl - 1) * 4) + (p - 1) + 1;
        }
        return -1;
    },

    // 5. Cruzamento: Busca o Circuito
    getCircuitInfo: function(rowsCircuitos, oltConfig, placa, porta) {
        if (!rowsCircuitos || !rowsCircuitos.length || oltConfig.circuitCol === undefined) return "-";
        
        const rowIndex = this.calculateRowIndex(placa, porta, oltConfig.type);
        if (rowIndex > 0 && rowIndex < rowsCircuitos.length) {
            return rowsCircuitos[rowIndex][oltConfig.circuitCol] || "-";
        }
        return "-";
    },

    // 6. Cruzamento: Busca a Localidade (Bairro)
    getBairroInfo: function(rowsLocalidades, oltIdentifier, placa, porta, type) {
        if (!rowsLocalidades || !rowsLocalidades.length) return null;

        const cleanOlt = (oltIdentifier || "").toUpperCase().replace(/[^A-Z0-9]/g, '');
        const colIndex = this.BAIRRO_COL_MAP[cleanOlt];
        
        if (colIndex === undefined) return null;

        const rowIndex = this.calculateRowIndex(placa, porta, type);
        if (rowIndex > 0 && rowIndex < rowsLocalidades.length) {
            const bairro = rowsLocalidades[rowIndex][colIndex];
            return bairro ? bairro.trim() : null;
        }
        return null;
    }
};