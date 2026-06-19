// ==============================================================================
// data-store.js - Buscador Central e Gerenciador de Estado (State Manager)
// Objetivo: Fazer uma única requisição na API e distribuir os dados na memória
// ==============================================================================

window.DATA_STORE = {
    olts: {},        // Guardará os dados brutos de cada OLT (A:K)
    circuitos: [],   // Guardará a aba CIRCUITO
    localidades: [], // Guardará a aba LOCALIDADE
    temperatura: [], // Guardará a aba TEMPERATURA
    energia: [],     // Guardará a aba ENERGIA
    isReady: false   // Flag para saber se a primeira carga já aconteceu
};

async function fetchAllNetworkData() {
    try {
        // 1. Monta a lista de todas as abas que precisamos buscar
        const ranges = GLOBAL_MASTER_OLT_LIST.map(o => `${o.sheetTab}!A:K`);
        
        // 2. Adiciona as abas de apoio, temperatura e energia no mesmo pacote
        ranges.push('CIRCUITO!A:AK');
        ranges.push('LOCALIDADE!A:AH');
        ranges.push('TEMPERATURA!A:CX');
        ranges.push('ENERGIA!A:BP');

        // 3. Dispara UMA única requisição para a API do Google Sheets
        const dataBatch = await API.getBatch(ranges);
        
        if (!dataBatch || !dataBatch.valueRanges) {
            throw new Error("Falha na estrutura de retorno da API no Buscador Central");
        }

        const totalOlts = GLOBAL_MASTER_OLT_LIST.length;

        // 4. Distribui os dados das OLTs na memória
        GLOBAL_MASTER_OLT_LIST.forEach((olt, index) => {
            const values = dataBatch.valueRanges[index].values || [];
            window.DATA_STORE.olts[olt.id] = values; 
        });

        // 5. Distribui os dados das abas extras na memória
        window.DATA_STORE.circuitos = dataBatch.valueRanges[totalOlts].values || [];
        window.DATA_STORE.localidades = dataBatch.valueRanges[totalOlts + 1].values || [];
        window.DATA_STORE.temperatura = dataBatch.valueRanges[totalOlts + 2].values || [];
        window.DATA_STORE.energia = dataBatch.valueRanges[totalOlts + 3].values || [];

        window.DATA_STORE.isReady = true;

        // 6. O Pulo do Gato: Dispara um evento avisando que os dados estão atualizados!
        window.dispatchEvent(new CustomEvent('dadosAtualizados'));

    } catch (error) {
        console.error("Erro no Buscador Central ao buscar dados:", error);
    }
}

// Inicializa o Buscador
function startCentralFetcher() {
    // Faz a primeira busca imediatamente
    fetchAllNetworkData();
    
    // Configura o loop infinito baseado no tempo do config.js
    setInterval(fetchAllNetworkData, GLOBAL_REFRESH_SECONDS * 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    // Inicia o maestro assim que o HTML carregar
    startCentralFetcher();
});