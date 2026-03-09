/* ==========================================================================
   home-engine.js - Controlador Geral de Layout (Versão Limpa)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializa os componentes de layout globais da Home
    if (typeof loadHeader === 'function') {
        loadHeader({ title: "Dashboard Gerencial", exactTitle: true });
    }
    
    if (typeof loadFooter === 'function') {
        loadFooter();
    }
    
    // ==============================================================================
    // OBSERVAÇÃO DE ARQUITETURA:
    // A alimentação e renderização dos cards (Rede, Energia e Potência)
    // agora ocorre de forma 100% autônoma dentro de seus respectivos 
    // motores (olt-engine.js, energia-engine.js e potencia-engine.js).
    // ==============================================================================
});