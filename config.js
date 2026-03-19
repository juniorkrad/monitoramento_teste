// ==============================================================================
// config.js - Cérebro Central de Configurações do Sistema
// ==============================================================================

const GLOBAL_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const GLOBAL_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const GLOBAL_REFRESH_SECONDS = 300; // 5 minutos padrão para todo o sistema

const GLOBAL_MASTER_OLT_LIST = [
    { id: 'HEL-1',  sheetTab: 'HEL1',  type: 'nokia',       boards: 8,  circuitCol: 1 },
    { id: 'HEL-2',  sheetTab: 'HEL2',  type: 'nokia',       boards: 8,  circuitCol: 3 },
    { id: 'PQA-1',  sheetTab: 'PQA1',  type: 'nokia',       boards: 8,  circuitCol: 7 },
    { id: 'PSV-1',  sheetTab: 'PSV1',  type: 'nokia',       boards: 8,  circuitCol: 9 },
    { id: 'MGP',    sheetTab: 'MGP',   type: 'nokia',       boards: 8,  circuitCol: 5 },
    { id: 'LTXV-1', sheetTab: 'LTXV1', type: 'furukawa-10', boards: 10, circuitCol: 31 }, 
    { id: 'LTXV-2', sheetTab: 'LTXV2', type: 'furukawa-2',  boards: 2,  circuitCol: 29 },
    { id: 'PQA-2',  sheetTab: 'PQA2',  type: 'furukawa-2',  boards: 2,  circuitCol: 25 },
    { id: 'PQA-3',  sheetTab: 'PQA3',  type: 'furukawa-2',  boards: 2,  circuitCol: 27 },
    { id: 'SB-1',   sheetTab: 'SB1',   type: 'furukawa-2',  boards: 2,  circuitCol: 19 },
    { id: 'SB-2',   sheetTab: 'SB2',   type: 'furukawa-2',  boards: 2,  circuitCol: 21 },
    { id: 'SB-3',   sheetTab: 'SB3',   type: 'furukawa-2',  boards: 2,  circuitCol: 23 },
    { id: 'PSV-7',  sheetTab: 'PSV7',  type: 'furukawa-2',  boards: 2,  circuitCol: 11 },
    { id: 'SBO-1',  sheetTab: 'SBO1',  type: 'furukawa-10', boards: 10, circuitCol: 33 },
    { id: 'SBO-2',  sheetTab: 'SBO2',  type: 'furukawa-2',  boards: 2,  circuitCol: 13 },
    { id: 'SBO-3',  sheetTab: 'SBO3',  type: 'furukawa-2',  boards: 2,  circuitCol: 15 },
    { id: 'SBO-4',  sheetTab: 'SBO4',  type: 'furukawa-2',  boards: 2,  circuitCol: 17 }
];