// ==============================================================================
// api-service.js - Gerenciador Central de Requisições (Google Sheets API)
// ==============================================================================

const API = {
    // Base da URL utilizando o ID global definido no config.js
    baseUrl: `https://sheets.googleapis.com/v4/spreadsheets/${GLOBAL_SHEET_ID}`,

    /**
     * Busca um único intervalo (range) de dados.
     * @param {string} range Ex: 'HEL1!A:K'
     * @returns {Promise<Object>} Resposta JSON da API
     */
    async get(range) {
        const url = `${this.baseUrl}/values/${range}?key=${GLOBAL_API_KEY}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Erro na API (Status: ${response.status}) para o range: ${range}`);
            return await response.json();
        } catch (error) {
            console.error('[API Service] Falha na requisição GET:', error);
            throw error; // Repassa o erro para o motor tratar (ex: exibir badge de erro)
        }
    },

    /**
     * Busca múltiplos intervalos (ranges) simultaneamente (Batch).
     * @param {Array<string>} ranges Ex: ['ENERGIA!A:BP', 'CIRCUITO!A:AK', 'HEL1!A:E']
     * @returns {Promise<Object>} Resposta JSON da API com os valueRanges
     */
    async getBatch(ranges) {
        if (!ranges || ranges.length === 0) throw new Error('[API Service] Nenhum range fornecido para Batch Get.');
        
        const rangesQuery = ranges.join('&ranges=');
        const url = `${this.baseUrl}/values:batchGet?key=${GLOBAL_API_KEY}&ranges=${rangesQuery}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Erro na API Batch (Status: ${response.status})`);
            return await response.json();
        } catch (error) {
            console.error('[API Service] Falha na requisição BATCH GET:', error);
            throw error;
        }
    }
};