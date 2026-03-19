// ==============================================================================
// config.js - Cérebro Central de Configurações do Sistema
// ==============================================================================

const GLOBAL_API_KEY = 'AIzaSyA88uPhiRhU3JZwKYjA5B1rX7ndXpfka0I';
const GLOBAL_SHEET_ID = '1BDx0zd0UGzOr2qqg1nftfe5WLUMh6MkcFO5psAG5GtU';
const GLOBAL_REFRESH_SECONDS = 300; // 5 minutos padrão para todo o sistema

const GLOBAL_MASTER_OLT_LIST = [
    { id: 'HEL-1',  sheetTab: 'HEL1',  type: 'nokia',       boards: 8,  circuitCol: 1,  energyCol: 0 },
    { id: 'HEL-2',  sheetTab: 'HEL2',  type: 'nokia',       boards: 8,  circuitCol: 3,  energyCol: 4 },
    { id: 'PQA-1',  sheetTab: 'PQA1',  type: 'nokia',       boards: 8,  circuitCol: 7,  energyCol: 8 },
    { id: 'PSV-1',  sheetTab: 'PSV1',  type: 'nokia',       boards: 8,  circuitCol: 9,  energyCol: 12 },
    { id: 'MGP',    sheetTab: 'MGP',   type: 'nokia',       boards: 8,  circuitCol: 5,  energyCol: 16 },
    { id: 'LTXV-1', sheetTab: 'LTXV1', type: 'furukawa-10', boards: 10, circuitCol: 31, energyCol: 20 }, 
    { id: 'LTXV-2', sheetTab: 'LTXV2', type: 'furukawa-2',  boards: 2,  circuitCol: 29, energyCol: 28 },
    { id: 'PQA-2',  sheetTab: 'PQA2',  type: 'furukawa-2',  boards: 2,  circuitCol: 25, energyCol: 32 },
    { id: 'PQA-3',  sheetTab: 'PQA3',  type: 'furukawa-2',  boards: 2,  circuitCol: 27, energyCol: 36 },
    { id: 'SB-1',   sheetTab: 'SB1',   type: 'furukawa-2',  boards: 2,  circuitCol: 19, energyCol: 40 },
    { id: 'SB-2',   sheetTab: 'SB2',   type: 'furukawa-2',  boards: 2,  circuitCol: 21, energyCol: 44 },
    { id: 'SB-3',   sheetTab: 'SB3',   type: 'furukawa-2',  boards: 2,  circuitCol: 23, energyCol: 48 },
    { id: 'PSV-7',  sheetTab: 'PSV7',  type: 'furukawa-2',  boards: 2,  circuitCol: 11, energyCol: 64 },
    { id: 'SBO-1',  sheetTab: 'SBO1',  type: 'furukawa-10', boards: 10, circuitCol: 33, energyCol: 24 },
    { id: 'SBO-2',  sheetTab: 'SBO2',  type: 'furukawa-2',  boards: 2,  circuitCol: 13, energyCol: 52 },
    { id: 'SBO-3',  sheetTab: 'SBO3',  type: 'furukawa-2',  boards: 2,  circuitCol: 15, energyCol: 56 },
    { id: 'SBO-4',  sheetTab: 'SBO4',  type: 'furukawa-2',  boards: 2,  circuitCol: 17, energyCol: 60 }
];