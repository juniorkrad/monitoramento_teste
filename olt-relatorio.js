// ==============================================================================
// olt-relatorio.js - Gerador de Boletim Visual (PNG Off-screen) e TXT para OLTs
// Atualização: Escopo Unificado por POP e Recebimento Dinâmico de Parâmetros
// ==============================================================================

window.gerarRelatorioOltOffscreen = async function(event, directPopName) {
    if (event) event.stopPropagation();

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 30px;">hourglass_empty</span>`;
    }

    try {
        let popName = directPopName;
        
        if (!popName && btn && btn.dataset.pop) {
            popName = btn.dataset.pop;
        }

        if (!popName) {
            const titleEl = document.getElementById('super-modal-title');
            let oltName = 'OLT_Desconhecida';
            if (titleEl) {
                oltName = titleEl.innerText.replace('dns', '').trim();
            }
            popName = (typeof POP_MAP !== 'undefined' && POP_MAP[oltName]) ? POP_MAP[oltName] : oltName;
        }

        let targetOlts = [];
        if (typeof POP_MAP !== 'undefined') {
            targetOlts = Object.keys(POP_MAP).filter(key => POP_MAP[key] === popName);
        }
        
        if (targetOlts.length === 0) targetOlts.push(popName);

        const portasCriticas = [];
        const rowsCircuitos = (window.DATA_STORE && window.DATA_STORE.circuitos) ? window.DATA_STORE.circuitos : [];
        const rowsLocalidades = window.DATA_STORE.localidades || [];

        targetOlts.forEach(targetOltId => {
            const oltConfig = typeof GLOBAL_MASTER_OLT_LIST !== 'undefined' ? GLOBAL_MASTER_OLT_LIST.find(o => o.id === targetOltId) : null;
            if (!oltConfig) return;

            const values = window.DATA_STORE.olts[targetOltId] || [];
            const rows = values.slice(1);
            const portDataMap = {};

            rows.forEach(columns => {
                if (columns.length === 0) return;
                
                const isOnline = DataMapper.isOnline(columns[oltConfig.type === 'nokia' ? 4 : 2], oltConfig.type);
                const portInfo = DataMapper.extractPort(columns[0], oltConfig.type);
                if (!portInfo) return;

                const { placa, porta } = portInfo;
                const placaNum = parseInt(placa);
                const portaNum = parseInt(porta);
                const portKey = `${placaNum}/${portaNum}`;

                if (!portDataMap[portKey]) {
                    const infoExtra = DataMapper.getCircuitInfo(rowsCircuitos, oltConfig, placa, porta);
                    const bairroExtra = DataMapper.getBairroInfo(rowsLocalidades, targetOltId, placa, porta, oltConfig.type);
                    portDataMap[portKey] = { 
                        online: 0, offline: 0, 
                        info: infoExtra, bairro: bairroExtra, 
                        placa: placaNum, porta: portaNum 
                    };
                }

                if (isOnline) portDataMap[portKey].online++;
                else portDataMap[portKey].offline++;
            });

            for (const pk in portDataMap) {
                const pData = portDataMap[pk];
                const total = pData.online + pData.offline;
                
                if (total >= 5) {
                    const percOffline = pData.offline / total;
                    if (percOffline === 1) { 
                        portasCriticas.push({
                            olt: targetOltId,
                            placa: pData.placa,
                            porta: String(pData.porta).padStart(2, '0'),
                            circuito: pData.info,
                            bairro: pData.bairro && pData.bairro !== '-' ? pData.bairro : 'N/A',
                            perc: Math.round(percOffline * 100) + '%',
                            status: 'CRÍTICO'
                        });
                    }
                }
            }
        });

        let tituloBoletim = "REDE ESTÁVEL";
        if (portasCriticas.length > 1) {
            tituloBoletim = "ROMPIMENTO BACKBONE";
        } else if (portasCriticas.length === 1) {
            tituloBoletim = "ROMPIMENTO CIRCUITO";
        }

        portasCriticas.sort((a, b) => a.olt.localeCompare(b.olt) || parseInt(a.placa) - parseInt(b.placa) || parseInt(a.porta) - parseInt(b.porta));

        const LIMITE_LINHAS = 12;
        const totalPaginas = Math.max(1, Math.ceil(portasCriticas.length / LIMITE_LINHAS));
        const dataHora = new Date().toLocaleString('pt-BR');

        for (let paginaAtual = 1; paginaAtual <= totalPaginas; paginaAtual++) {
            
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `offscreen-wrapper-pag-${paginaAtual}`;
            wrapperDiv.style.position = 'absolute';
            wrapperDiv.style.left = '-9999px'; 
            wrapperDiv.style.top = '0';
            wrapperDiv.style.backgroundColor = 'transparent'; 
            wrapperDiv.style.padding = '0';

            const offscreenDiv = document.createElement('div');
            offscreenDiv.style.width = '1000px'; 
            offscreenDiv.style.height = '750px'; 
            offscreenDiv.style.backgroundColor = '#2f0e51'; 
            offscreenDiv.style.color = '#ffffff';
            offscreenDiv.style.padding = '30px';
            offscreenDiv.style.borderRadius = '24px'; 
            offscreenDiv.style.overflow = 'hidden'; 
            offscreenDiv.style.fontFamily = "'Montserrat', sans-serif";
            offscreenDiv.style.boxSizing = 'border-box';
            offscreenDiv.style.display = 'flex'; 
            offscreenDiv.style.flexDirection = 'column';
            offscreenDiv.style.justifyContent = 'flex-start';

            let tableHtml = '';
            
            if (portasCriticas.length === 0) {
                tableHtml = `
                    <div style="text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-top: 20px; flex: 1; display: flex; flex-direction: column; justify-content: center;">
                        <span style="font-family: 'Material Symbols Rounded'; font-size: 64px; color: #4ade80; margin-bottom: 15px; display:block;">check_circle</span>
                        <h2 style="margin: 0; color: #4ade80; font-size: 2rem;">Rede Estável</h2>
                        <p style="color: #CAC4D0; margin-top: 10px; font-size: 1.1rem;">Nenhum alarme crítico de queda total (100%) detectado no ${popName} no momento.</p>
                    </div>
                `;
            } else {
                let rowsHtml = '';
                
                const startIndex = (paginaAtual - 1) * LIMITE_LINHAS;
                const endIndex = startIndex + LIMITE_LINHAS;
                const fatiaCriticas = portasCriticas.slice(startIndex, endIndex);
                
                fatiaCriticas.forEach(p => {
                    const statusColor = '#f87171';
                    const statusBg = 'rgba(248, 113, 113, 0.15)';
                    
                    rowsHtml += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 12px 10px; font-weight: bold; text-align: center; width: 12%; color: #fbbf24;">${p.olt}</td>
                            <td style="padding: 12px 10px; font-family: 'Roboto Mono', monospace; text-align: center; width: 14%;">${p.placa}/${p.porta}</td>
                            
                            <td style="padding: 12px 10px; text-align: center; width: 20%;">
                                <span style="border: 1px solid rgba(255,255,255,0.2); background-color: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px; font-family: 'Roboto Mono', monospace; font-size: 0.9rem;">${p.circuito}</span>
                            </td>
                            
                            <td style="padding: 12px 10px; text-align: center; font-size: 0.85rem; color: #CAC4D0; width: 28%; word-break: break-word;">${p.bairro}</td>
                            
                            <td style="padding: 12px 10px; text-align: center; font-family: 'Roboto Mono', monospace; font-size: 0.95rem; font-weight: bold; width: 12%; border-left: 1px solid rgba(255,255,255,0.1); background-color: rgba(248, 113, 113, 0.04);">${p.perc}</td>
                            <td style="padding: 12px 10px; text-align: center; width: 14%; background-color: rgba(248, 113, 113, 0.04);">
                                <span style="background: ${statusBg}; color: ${statusColor}; padding: 6px 12px; border-radius: 12px; font-weight: bold; font-size: 0.85rem;">${p.status}</span>
                            </td>
                        </tr>
                    `;
                });

                tableHtml = `
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 0.95rem;">
                        <thead>
                            <tr>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; border-radius: 8px 0 0 0; width: 12%; color: #fbbf24;">OLT</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; width: 14%;">PLACA/PORTA</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; width: 20%;">CIRCUITO</th>
                                <th style="padding: 12px 10px; background: rgba(0,0,0,0.2); text-align: center; width: 28%;">BAIRRO</th>
                                <th style="padding: 12px 10px; background: rgba(248, 113, 113, 0.1); text-align: center; border-left: 1px solid rgba(255,255,255,0.1); width: 12%;">IMPACTO</th>
                                <th style="padding: 12px 10px; background: rgba(248, 113, 113, 0.1); text-align: center; border-radius: 0 8px 0 0; width: 14%;">STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                `;
            }

            let indicadorPaginaHtml = '';
            if (totalPaginas > 1) {
                indicadorPaginaHtml = `
                    <div style="font-size: 0.85rem; color: #fbbf24; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
                        Página ${paginaAtual} de ${totalPaginas}
                    </div>
                `;
            }

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
                            <h3 style="margin: 5px 0 0 0; font-size: 1.3rem; color: #ffffff; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
                                <span style="font-family: 'Material Symbols Rounded'; font-weight: normal; font-size: 24px;">domain</span> ${popName}
                            </h3>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.85rem; color: #CAC4D0; font-family: 'Roboto Mono', monospace;">Gerado em: ${dataHora}</span>
                    </div>
                </div>
                ${tableHtml}
            `;

            wrapperDiv.appendChild(offscreenDiv);
            document.body.appendChild(wrapperDiv);

            const canvas = await html2canvas(wrapperDiv, {
                backgroundColor: null, 
                scale: 2, 
                logging: false
            });

            let nomeArquivo = `Boletim_${popName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}`;
            if (totalPaginas > 1) nomeArquivo += `_Pag${paginaAtual}`;

            const link = document.createElement('a');
            link.download = `${nomeArquivo}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            document.body.removeChild(wrapperDiv);
        }

    } catch (error) {
        console.error('Erro ao gerar relatório off-screen:', error);
        alert('Ocorreu um erro ao gerar o relatório.');
    } finally {
        if (btn) btn.innerHTML = originalContent;
    }
};


window.gerarRelatorioTxtOffscreen = function(event, directPopName) {
    if (event) event.stopPropagation();

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded" style="font-size: 30px;">hourglass_empty</span>`;
    }

    try {
        let popName = directPopName;
        
        if (!popName && btn && btn.dataset.pop) {
            popName = btn.dataset.pop;
        }

        if (!popName) {
            const titleEl = document.getElementById('super-modal-title');
            let oltName = 'OLT_Desconhecida';
            if (titleEl) {
                oltName = titleEl.innerText.replace('dns', '').trim();
            }
            popName = (typeof POP_MAP !== 'undefined' && POP_MAP[oltName]) ? POP_MAP[oltName] : oltName;
        }

        let targetOlts = [];
        if (typeof POP_MAP !== 'undefined') {
            targetOlts = Object.keys(POP_MAP).filter(key => POP_MAP[key] === popName);
        }
        
        if (targetOlts.length === 0) targetOlts.push(popName);

        const portasCriticas = [];
        const rowsCircuitos = (window.DATA_STORE && window.DATA_STORE.circuitos) ? window.DATA_STORE.circuitos : [];
        const rowsLocalidades = window.DATA_STORE.localidades || [];

        targetOlts.forEach(targetOltId => {
            const oltConfig = typeof GLOBAL_MASTER_OLT_LIST !== 'undefined' ? GLOBAL_MASTER_OLT_LIST.find(o => o.id === targetOltId) : null;
            if (!oltConfig) return;

            const values = window.DATA_STORE.olts[targetOltId] || [];
            const rows = values.slice(1);
            const portDataMap = {};

            rows.forEach(columns => {
                if (columns.length === 0) return;
                
                const isOnline = DataMapper.isOnline(columns[oltConfig.type === 'nokia' ? 4 : 2], oltConfig.type);
                const portInfo = DataMapper.extractPort(columns[0], oltConfig.type);
                if (!portInfo) return;

                const { placa, porta } = portInfo;
                const placaNum = parseInt(placa);
                const portaNum = parseInt(porta);
                const portKey = `${placaNum}/${portaNum}`;

                if (!portDataMap[portKey]) {
                    const infoExtra = DataMapper.getCircuitInfo(rowsCircuitos, oltConfig, placa, porta);
                    const bairroExtra = DataMapper.getBairroInfo(rowsLocalidades, targetOltId, placa, porta, oltConfig.type);
                    portDataMap[portKey] = { 
                        online: 0, offline: 0, 
                        info: infoExtra, bairro: bairroExtra, 
                        placa: placaNum, porta: portaNum 
                    };
                }

                if (isOnline) portDataMap[portKey].online++;
                else portDataMap[portKey].offline++;
            });

            for (const pk in portDataMap) {
                const pData = portDataMap[pk];
                const total = pData.online + pData.offline;
                
                if (total >= 5) {
                    const percOffline = pData.offline / total;
                    if (percOffline === 1) { 
                        portasCriticas.push({
                            olt: targetOltId,
                            placa: pData.placa,
                            porta: String(pData.porta).padStart(2, '0'),
                            circuito: pData.info,
                            bairro: pData.bairro && pData.bairro !== '-' ? pData.bairro : 'N/A'
                        });
                    }
                }
            }
        });

        let tituloBoletim = "REDE ESTÁVEL";
        if (portasCriticas.length > 1) {
            tituloBoletim = "ROMPIMENTO BACKBONE";
        } else if (portasCriticas.length === 1) {
            tituloBoletim = "ROMPIMENTO CIRCUITO";
        }

        portasCriticas.sort((a, b) => a.olt.localeCompare(b.olt) || parseInt(a.placa) - parseInt(b.placa) || parseInt(a.porta) - parseInt(b.porta));

        let txtContent = `=================================================\n`;
        txtContent += `   BOLETIM DE ALARMES - ${popName.toUpperCase()}\n`;
        txtContent += `   Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
        txtContent += `   Status Geral: ${tituloBoletim}\n`;
        txtContent += `=================================================\n\n`;

        if (portasCriticas.length === 0) {
            txtContent += `   Nenhum alarme crítico (100% offline) detectado.\n   A rede encontra-se estável neste POP.\n`;
        } else {
            txtContent += `   PORTAS AFETADAS:\n\n`;
            portasCriticas.forEach(p => {
                txtContent += `   • OLT: ${p.olt.padEnd(8, ' ')} | Placa/Porta: ${p.placa}/${p.porta}\n`;
                txtContent += `     Circuito: ${p.circuito}\n`;
                txtContent += `     Bairro: ${p.bairro}\n`;
                txtContent += `     Impacto: 100% OFFLINE (CRÍTICO)\n\n`;
            });
        }

        txtContent += `=================================================\n`;

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Relatorio_Geral_${popName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Erro ao gerar relatório TXT off-screen:', error);
        alert('Ocorreu um erro ao gerar o relatório TXT.');
    } finally {
        if (btn) btn.innerHTML = originalContent;
    }
};