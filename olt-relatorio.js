// ==============================================================================
// olt-relatorio.js - Gerador de Boletim Visual (PNG Off-screen) para OLTs
// Atualização: Imagem com tamanho fixo ajustado (850x750) para melhor proporção
// ==============================================================================

window.gerarRelatorioOltOffscreen = async function(event) {
    if (event) event.stopPropagation();

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        // Animação de ampulheta enquanto processa
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
    }

    try {
        // 1. Descobrir qual OLT está aberta
        const titleEl = document.getElementById('super-modal-title');
        let oltName = 'OLT_Desconhecida';
        if (titleEl) {
            oltName = titleEl.innerText.replace('dns', '').trim();
        }

        // 2. Filtrar apenas as portas com alarmes críticos (100% DOWN)
        const portasCriticas = [];
        const data = window.CURRENT_OLT_PORT_DATA || {}; 

        for (const placa in data) {
            const ports = data[placa];
            for (const porta in ports) {
                const pData = ports[porta];
                const total = pData.online + pData.offline;
                
                // Focado exclusivamente em situação de 100% da porta down
                if (total >= 5) {
                    const percOffline = pData.offline / total;
                    if (percOffline === 1) { 
                        portasCriticas.push({
                            placa: placa,
                            porta: String(porta).padStart(2, '0'),
                            circuito: pData.info,
                            perc: Math.round(percOffline * 100) + '%',
                            status: 'CRÍTICO'
                        });
                    }
                }
            }
        }

        // Título inteligente baseado na quantidade de portas caídas
        let tituloBoletim = "REDE ESTÁVEL";
        if (portasCriticas.length > 1) {
            tituloBoletim = "ROMPIMENTO BACKBONE";
        } else if (portasCriticas.length === 1) {
            tituloBoletim = "ROMPIMENTO CIRCUITO";
        }

        // Ordena por Placa e depois por Porta
        portasCriticas.sort((a, b) => parseInt(a.placa) - parseInt(b.placa) || parseInt(a.porta) - parseInt(b.porta));

        // Lógica de Paginação (Limite Seguro: 12)
        const LIMITE_LINHAS = 12;
        const totalPaginas = Math.max(1, Math.ceil(portasCriticas.length / LIMITE_LINHAS));
        const dataHora = new Date().toLocaleString('pt-BR');

        // Loop assíncrono para gerar cada página sequencialmente
        for (let paginaAtual = 1; paginaAtual <= totalPaginas; paginaAtual++) {
            
            // 3. O TRUQUE: Criar um Wrapper Transparente para evitar quinas brancas
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `offscreen-wrapper-pag-${paginaAtual}`;
            wrapperDiv.style.position = 'absolute';
            wrapperDiv.style.left = '-9999px'; 
            wrapperDiv.style.top = '0';
            wrapperDiv.style.backgroundColor = 'transparent'; // Transparência total na raiz
            wrapperDiv.style.padding = '0';

            // A Lona Real onde o layout será desenhado
            const offscreenDiv = document.createElement('div');
            offscreenDiv.style.width = '850px';
            offscreenDiv.style.height = '750px'; // Tamanho FIXO otimizado (Redução de ~25%)
            offscreenDiv.style.backgroundColor = '#2f0e51'; // Fundo Padrão (M3 Surface)
            offscreenDiv.style.color = '#ffffff';
            offscreenDiv.style.padding = '30px';
            offscreenDiv.style.borderRadius = '24px'; // Bordas arredondadas fortes
            offscreenDiv.style.overflow = 'hidden'; // Garante que o conteúdo não vaze as bordas
            offscreenDiv.style.fontFamily = "'Montserrat', sans-serif";
            offscreenDiv.style.boxSizing = 'border-box';
            offscreenDiv.style.display = 'flex'; // Aplicação de flex para controle de fluxo
            offscreenDiv.style.flexDirection = 'column';
            offscreenDiv.style.justifyContent = 'flex-start';

            let tableHtml = '';
            
            if (portasCriticas.length === 0) {
                tableHtml = `
                    <div style="text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-top: 20px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <span style="font-family: 'Material Symbols Rounded'; font-size: 64px; color: #4ade80; margin-bottom: 15px; display:block;">check_circle</span>
                        <h2 style="margin: 0; color: #4ade80; font-size: 2rem;">Rede Estável</h2>
                        <p style="color: #CAC4D0; margin-top: 10px; font-size: 1.1rem;">Nenhum alarme crítico de queda total (100%) detectado nesta OLT no momento.</p>
                    </div>
                `;
            } else {
                let rowsHtml = '';
                
                // Fatiamento Inteligente do Array
                const startIndex = (paginaAtual - 1) * LIMITE_LINHAS;
                const endIndex = startIndex + LIMITE_LINHAS;
                const fatiaCriticas = portasCriticas.slice(startIndex, endIndex);
                
                fatiaCriticas.forEach(p => {
                    const statusColor = '#f87171';
                    const statusBg = 'rgba(248, 113, 113, 0.15)';
                    
                    rowsHtml += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 12px 10px; font-weight: bold; text-align: center; width: 20%;">${p.placa}</td>
                            <td style="padding: 12px 10px; font-family: 'Roboto Mono', monospace; text-align: center; width: 20%;">${p.porta}</td>
                            
                            <td style="padding: 12px 10px; text-align: center; width: 20%;">
                                <span style="border: 1px solid rgba(255,255,255,0.2); background-color: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px; font-family: 'Roboto Mono', monospace; font-size: 0.9rem;">${p.circuito}</span>
                            </td>
                            
                            <td style="padding: 12px 10px; text-align: center; font-family: 'Roboto Mono', monospace; font-size: 0.95rem; font-weight: bold; width: 20%; border-left: 1px solid rgba(255,255,255,0.1); background-color: rgba(248, 113, 113, 0.04);">${p.perc}</td>
                            <td style="padding: 12px 10px; text-align: center; width: 20%; background-color: rgba(248, 113, 113, 0.04);">
                                <span style="background: ${statusBg}; color: ${statusColor}; padding: 6px 12px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;">${p.status}</span>
                            </td>
                        </tr>
                    `;
                });

                tableHtml = `
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.95rem;">
                        <thead>
                            <tr>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; border-radius: 8px 0 0 0; width: 20%;">PLACA</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; width: 20%;">PORTA</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; width: 20%;">CIRCUITO</th>
                                <th style="padding: 12px 10px; background: rgba(248, 113, 113, 0.1); text-align: center; border-left: 1px solid rgba(255,255,255,0.1); width: 20%;">IMPACTO</th>
                                <th style="padding: 12px 10px; background: rgba(248, 113, 113, 0.1); text-align: center; border-radius: 0 8px 0 0; width: 20%;">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                `;
            }

            // Indicador de Página (Oculto se houver apenas 1 página)
            let indicadorPaginaHtml = '';
            if (totalPaginas > 1) {
                indicadorPaginaHtml = `
                    <div style="font-size: 0.85rem; color: #fbbf24; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                        Página ${paginaAtual} de ${totalPaginas}
                    </div>
                `;
            }

            // Estrutura principal
            offscreenDiv.innerHTML = `
                <div style="border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="logo-relatorio.png" style="max-height: 60px; width: auto; object-fit: contain;" onerror="this.style.display='none'">
                        <div>
                            ${indicadorPaginaHtml}
                            <h2 style="margin: 0; font-size: 1.6rem; color: #f87171; display: flex; align-items: center; gap: 10px;">
                                ${portasCriticas.length > 0 ? `<span style="font-family: 'Material Symbols Rounded'; font-weight: normal; font-size: 28px;">warning</span>` : ''}
                                ${tituloBoletim}
                            </h2>
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; color: #ffffff; display: flex; align-items: center; gap: 8px;">
                                <span style="font-family: 'Material Symbols Rounded'; font-weight: normal; font-size: 24px;">dns</span> ${oltName}
                            </h3>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.85rem; color: #CAC4D0; font-family: 'Roboto Mono', monospace;">Gerado em: ${dataHora}</span>
                    </div>
                </div>
                ${tableHtml}
            `;

            // Adiciona a Lona Colorida para dentro do Wrapper Transparente
            wrapperDiv.appendChild(offscreenDiv);
            document.body.appendChild(wrapperDiv);

            // 5. Acionar o HTML2Canvas NA CAIXA MÃE (Aguardando o render concluir)
            const canvas = await html2canvas(wrapperDiv, {
                backgroundColor: null, // Assegura que o canvas baseia-se no wrapper transparente
                scale: 2, 
                logging: false
            });

            // Nome do arquivo dinâmico
            let nomeArquivo = `Boletim_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}`;
            if (totalPaginas > 1) nomeArquivo += `_Pag${paginaAtual}`;

            // Criar Link de Download
            const link = document.createElement('a');
            link.download = `${nomeArquivo}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // Limpar a memória removendo o Wrapper Invisível inteiro
            document.body.removeChild(wrapperDiv);
        }

    } catch (error) {
        console.error('Erro ao gerar relatório off-screen:', error);
        alert('Ocorreu um erro ao gerar o relatório.');
    } finally {
        // Restaurar botão original independentemente de sucesso ou falha
        if (btn) btn.innerHTML = originalContent;
    }
};