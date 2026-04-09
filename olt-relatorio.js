// ==============================================================================
// olt-relatorio.js - Gerador de Boletim Visual (PNG Off-screen) para OLTs
// ==============================================================================

window.gerarRelatorioOltOffscreen = function(event) {
    if (event) event.stopPropagation();

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        // Animação de ampulheta enquanto processa
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
    }

    // 1. Descobrir qual OLT está aberta
    const titleEl = document.getElementById('super-modal-title');
    let oltName = 'OLT_Desconhecida';
    if (titleEl) {
        oltName = titleEl.innerText.replace('dns', '').trim();
    }

    // 2. Filtrar apenas as portas com alarmes críticos
    const portasCriticas = [];
    const data = window.CURRENT_OLT_PORT_DATA || {}; // Puxa os dados que o olt-engine.js guardou na memória

    for (const placa in data) {
        const ports = data[placa];
        for (const porta in ports) {
            const pData = ports[porta];
            const total = pData.online + pData.offline;
            
            // Mesma regra de alarme do motor principal
            if (total >= 5) {
                const percOffline = pData.offline / total;
                if (percOffline === 1 || percOffline >= 0.5 || pData.offline >= 32) {
                    portasCriticas.push({
                        placa: placa,
                        porta: String(porta).padStart(2, '0'),
                        circuito: pData.info,
                        offline: pData.offline,
                        total: total,
                        status: percOffline === 1 ? 'DOWN TOTAL' : 'CRÍTICO'
                    });
                }
            }
        }
    }

    // 3. Criar a "Lona" (Div Invisível) onde o layout será desenhado
    const offscreenDiv = document.createElement('div');
    offscreenDiv.id = 'offscreen-report';
    offscreenDiv.style.position = 'absolute';
    offscreenDiv.style.left = '-9999px'; // Esconde longe da tela
    offscreenDiv.style.top = '0';
    offscreenDiv.style.width = '850px';
    offscreenDiv.style.backgroundColor = '#2f0e51'; // Fundo Padrão (M3 Surface)
    offscreenDiv.style.color = '#ffffff';
    offscreenDiv.style.padding = '30px';
    offscreenDiv.style.borderRadius = '16px';
    offscreenDiv.style.fontFamily = "'Montserrat', sans-serif";
    offscreenDiv.style.boxSizing = 'border-box';

    // 4. Montar o conteúdo do relatório
    let tableHtml = '';
    
    if (portasCriticas.length === 0) {
        tableHtml = `
            <div style="text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-top: 20px;">
                <span style="font-size: 48px; color: #4ade80; margin-bottom: 10px; display:block;">✔</span>
                <h2 style="margin: 0; color: #4ade80;">Rede Estável</h2>
                <p style="color: #CAC4D0; margin-top: 5px;">Nenhum alarme crítico ou queda total detectado nesta OLT no momento.</p>
            </div>
        `;
    } else {
        let rowsHtml = '';
        
        // Ordena por Placa e depois por Porta
        portasCriticas.sort((a, b) => parseInt(a.placa) - parseInt(b.placa) || parseInt(a.porta) - parseInt(b.porta));
        
        portasCriticas.forEach(p => {
            const statusColor = p.status === 'DOWN TOTAL' ? '#f87171' : '#fbbf24';
            const statusBg = p.status === 'DOWN TOTAL' ? 'rgba(248, 113, 113, 0.15)' : 'rgba(251, 191, 36, 0.15)';
            
            // As cores em HEX inline garantem que a foto do Canvas saia perfeita
            rowsHtml += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px 10px; font-weight: bold; text-align: center;">${p.placa}</td>
                    <td style="padding: 12px 10px; font-family: 'Roboto Mono', monospace; text-align: center;">${p.porta}</td>
                    <td style="padding: 12px 10px;">${p.circuito}</td>
                    <td style="padding: 12px 10px; text-align: center;">
                        <span style="font-family: 'Roboto Mono', monospace; font-size: 0.95rem; color: #f87171; font-weight: bold;">${p.offline}</span>
                        <span style="font-family: 'Roboto Mono', monospace; font-size: 0.8rem; color: rgba(255,255,255,0.5);">/${p.total}</span>
                    </td>
                    <td style="padding: 12px 10px; text-align: center;">
                        <span style="background: ${statusBg}; color: ${statusColor}; padding: 6px 12px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;">${p.status}</span>
                    </td>
                </tr>
            `;
        });

        tableHtml = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.95rem;">
                <thead>
                    <tr>
                        <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; border-radius: 8px 0 0 0;">PLACA</th>
                        <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center;">PORTA</th>
                        <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: left;">CIRCUITO</th>
                        <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center;">CLIENTES (OFF/TOTAL)</th>
                        <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; border-radius: 0 8px 0 0;">STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    }

    const dataHora = new Date().toLocaleString('pt-BR');

    // Estrutura principal do documento que será fotografado
    offscreenDiv.innerHTML = `
        <div style="border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <h2 style="margin: 0; font-size: 1.6rem; color: #ffffff; display: flex; align-items: center; gap: 10px;">
                    <span style="color: #f87171;">⚠</span> BOLETIM DE ALARMES CRÍTICOS
                </h2>
                <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; color: #fbbf24;">${oltName}</h3>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 0.85rem; color: #CAC4D0; font-family: 'Roboto Mono', monospace;">Gerado em: ${dataHora}</span>
            </div>
        </div>
        ${tableHtml}
        <div style="margin-top: 25px; text-align: center; font-size: 0.75rem; color: rgba(255,255,255,0.4);">
            Gerado automaticamente pelo NOC Dashboard
        </div>
    `;

    document.body.appendChild(offscreenDiv);

    // 5. Acionar o HTML2Canvas para tirar a foto da Div
    html2canvas(offscreenDiv, {
        backgroundColor: '#2f0e51', 
        scale: 2, 
        logging: false
    }).then(canvas => {
        // Criar Link de Download
        const link = document.createElement('a');
        link.download = `Boletim_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Limpar a memória removendo a Div invisível
        document.body.removeChild(offscreenDiv);
        
        // Restaurar botão original
        if (btn) btn.innerHTML = originalContent;
    }).catch(error => {
        console.error('Erro ao gerar relatório off-screen:', error);
        alert('Ocorreu um erro ao gerar o relatório.');
        document.body.removeChild(offscreenDiv);
        if (btn) btn.innerHTML = originalContent;
    });
};