// ==============================================================================
// olt-comunicado.js - Gerador de Imagem para Redes Sociais (Formato Stories 9:16)
// Tema: Material Design Light / Cores do Projeto (Roxo) / Fundo Branco
// Atualização: Recebimento Dinâmico de POP e Mapeamento Global via config.js
// ==============================================================================

window.gerarComunicadoSocialOffscreen = async function(event, directPopName) {
    if (event) event.stopPropagation();

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
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

        function buscarLocalidadeExata(rows, oltIdentifier, placa, porta) {
            if (!rows || rows.length === 0) return null;

            const cleanOlt = (oltIdentifier || "").toUpperCase().replace(/[^A-Z0-9]/g, '');

            const colMap = {
                'HEL1': { p: 0, l: 1 },
                'HEL2': { p: 2, l: 3 },
                'MGP': { p: 4, l: 5 },
                'PQA1': { p: 6, l: 7 },
                'PSV1': { p: 8, l: 9 },
                'PSV7': { p: 10, l: 11 },
                'SBO2': { p: 12, l: 13 },
                'SBO3': { p: 14, l: 15 },
                'SBO4': { p: 16, l: 17 },
                'SB1': { p: 18, l: 19 },
                'SB2': { p: 20, l: 21 },
                'SB3': { p: 22, l: 23 },
                'PQA2': { p: 24, l: 25 },
                'PQA3': { p: 26, l: 27 },
                'LTXV2': { p: 28, l: 29 },
                'LTXV1': { p: 30, l: 31 },
                'SBO1': { p: 32, l: 33 }
            };

            const map = colMap[cleanOlt];
            if (!map) return null;

            const targetPortStr = `${placa}/${porta}`; 

            for (let i = 0; i < rows.length; i++) {
                let rowPort = rows[i][map.p];
                if (!rowPort) continue;

                let s = String(rowPort).replace(/gpon/i, '').replace(/\\/g, '/').trim();
                s = s.replace(/[^0-9/]/g, ''); 

                let parts = s.split('/');
                if (parts.length >= 2) {
                    let sl = parseInt(parts[parts.length - 2], 10);
                    let pt = parseInt(parts[parts.length - 1], 10);
                    if (`${sl}/${pt}` === targetPortStr) {
                        return rows[i][map.l]; 
                    }
                } else if (s === targetPortStr) {
                    return rows[i][map.l];
                }
            }
            return null;
        }

        const localidadesAfetadasSet = new Set();
        const rowsLocalidades = window.GLOBAL_BAIRROS_DATA || (window.DATA_STORE && window.DATA_STORE.localidades) || [];

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
                    portDataMap[portKey] = { online: 0, offline: 0, placa: placaNum, porta: portaNum };
                }

                if (isOnline) portDataMap[portKey].online++;
                else portDataMap[portKey].offline++;
            });

            for (const pk in portDataMap) {
                const pData = portDataMap[pk];
                const total = pData.online + pData.offline;
                
                if (total >= 5 && (pData.offline / total) === 1) {
                    let nomeLocalidade = null;
                    
                    if (rowsLocalidades.length > 0) {
                        nomeLocalidade = buscarLocalidadeExata(rowsLocalidades, targetOltId, pData.placa, pData.porta);
                    }
                    
                    if (nomeLocalidade && String(nomeLocalidade).trim() !== "" && String(nomeLocalidade).trim() !== "-") {
                        
                        const partes = String(nomeLocalidade).split(/\s*,\s*|\s*\/\s*|\s+e\s+/gi);
                        
                        partes.forEach(parte => {
                            const bairroLimpo = parte.trim();
                            if (bairroLimpo && bairroLimpo !== "-") {
                                localidadesAfetadasSet.add(bairroLimpo); 
                            }
                        });
                    }
                }
            }
        });

        const bairros = Array.from(localidadesAfetadasSet).sort();

        const LIMITE_BAIRROS = 7;
        const paginasDeLista = Math.ceil(bairros.length / LIMITE_BAIRROS);
        const totalPaginas = bairros.length > 0 ? paginasDeLista + 1 : 1;
        
        const colorPrimaryPurple = '#67079f'; 
        const colorPrimaryContainer = '#f3edf7'; 
        const colorOnSurface = '#1c1b1f'; 
        const colorOnSurfaceVariant = '#49454f'; 
        const colorBackground = '#ffffff'; 

        for (let paginaAtual = 1; paginaAtual <= totalPaginas; paginaAtual++) {
            
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `social-wrapper-pag-${paginaAtual}`;
            wrapperDiv.style.position = 'absolute';
            wrapperDiv.style.left = '-9999px'; 
            wrapperDiv.style.top = '0';
            wrapperDiv.style.backgroundColor = 'transparent'; 
            wrapperDiv.style.padding = '0';

            const offscreenDiv = document.createElement('div');
            offscreenDiv.style.width = '1080px';
            offscreenDiv.style.height = '1920px';
            offscreenDiv.style.background = colorBackground; 
            offscreenDiv.style.fontFamily = "'Montserrat', sans-serif";
            offscreenDiv.style.display = 'flex';
            offscreenDiv.style.flexDirection = 'column';
            offscreenDiv.style.boxSizing = 'border-box';
            offscreenDiv.style.position = 'relative';
            offscreenDiv.style.overflow = 'hidden';
            
            offscreenDiv.style.borderRadius = '48px'; 
            
            const innerBorderHtml = `
                <div style="position: absolute; top: 35px; bottom: 35px; left: 35px; right: 35px; border: 8px solid ${colorPrimaryPurple}; border-radius: 36px; pointer-events: none; z-index: 999;"></div>
            `;

            let conteudoCentralHtml = '';
            let isPaginaFinalMensagens = false;

            if (bairros.length > 0 && paginaAtual === totalPaginas) {
                isPaginaFinalMensagens = true;
            }

            if (bairros.length === 0) {
                conteudoCentralHtml = `
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px; text-align: center;">
                        <span style="font-family: 'Material Symbols Rounded'; font-size: 180px; color: #10b981; margin-bottom: 40px;">check_circle</span>
                        <h1 style="font-size: 80px; color: ${colorPrimaryPurple}; margin: 0 0 20px 0; font-weight: 800;">REDE ESTÁVEL</h1>
                        <p style="font-size: 40px; color: ${colorOnSurfaceVariant}; margin: 0; line-height: 1.4;">Nenhuma instabilidade identificada nesta região.</p>
                    </div>
                `;
            } else if (isPaginaFinalMensagens) {
                conteudoCentralHtml = `
                    <div style="flex: 1; padding: 0 80px 40px 80px; display: flex; flex-direction: column;">
                        
                        <div style="padding: 0 0 50px 0;">
                            <div style="position: relative; display: flex; align-items: center; justify-content: center; background-color: rgba(103, 7, 159, 0.1); padding: 30px 40px; min-height: 160px; border-radius: 100px; border: 2px solid rgba(103, 7, 159, 0.15); margin-bottom: 30px; margin-top: 20px; box-sizing: border-box;">
                                <span style="font-family: 'Material Symbols Rounded'; font-size: 120px; color: ${colorPrimaryPurple}; position: absolute; left: 40px;">campaign</span>
                                <h1 style="font-size: 60px; color: ${colorPrimaryPurple}; margin: 0 0 0 80px; font-weight: 800; text-transform: uppercase; letter-spacing: -1px; text-align: center;">Aviso de Reparo</h1>
                            </div>
                        </div>
                        
                        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 80px; padding: 0 0 150px 0;">
                            
                            <div style="background-color: rgba(103, 7, 159, 0.03); border: 5px dashed rgba(103, 7, 159, 0.5); border-radius: 36px; padding: 70px; text-align: center; width: 100%; box-sizing: border-box; box-shadow: 0 15px 40px rgba(103, 7, 159, 0.05);">
                                <p style="font-size: 45px; color: ${colorPrimaryPurple}; margin: 0; line-height: 1.6; font-weight: 700;">Nossa equipe técnica já está trabalhando para normalizar os serviços o mais rápido possível.</p>
                            </div>

                            <p style="font-size: 55px; margin: 0; font-weight: 800; color: ${colorPrimaryPurple}; text-align: center; text-transform: uppercase; letter-spacing: 2px;">Agradecemos a compreensão.</p>

                        </div>
                        
                    </div>
                `;
            } else {
                let bairrosHtml = '';
                const startIndex = (paginaAtual - 1) * LIMITE_BAIRROS;
                const endIndex = startIndex + LIMITE_BAIRROS;
                const fatiaBairros = bairros.slice(startIndex, endIndex);

                fatiaBairros.forEach(bairro => {
                    bairrosHtml += `
                        <div style="background-color: ${colorPrimaryContainer}; border-left: 12px solid ${colorPrimaryPurple}; border-radius: 16px; padding: 30px 40px; margin-bottom: 25px; display: flex; align-items: center; gap: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
                            <span style="font-family: 'Material Symbols Rounded'; font-size: 48px; color: ${colorPrimaryPurple};">location_on</span>
                            <span style="font-size: 45px; font-weight: 700; color: ${colorOnSurface};">${bairro}</span>
                        </div>
                    `;
                });

                conteudoCentralHtml = `
                    <div style="flex: 1; padding: 0 80px 40px 80px; display: flex; flex-direction: column;">
                        
                        <div style="padding: 0 0 50px 0;">
                            <div style="position: relative; display: flex; align-items: center; justify-content: center; background-color: rgba(103, 7, 159, 0.1); padding: 30px 40px; min-height: 160px; border-radius: 100px; border: 2px solid rgba(103, 7, 159, 0.15); margin-bottom: 30px; margin-top: 20px; box-sizing: border-box;">
                                <span style="font-family: 'Material Symbols Rounded'; font-size: 120px; color: ${colorPrimaryPurple}; position: absolute; left: 40px;">campaign</span>
                                <h1 style="font-size: 60px; color: ${colorPrimaryPurple}; margin: 0 0 0 80px; font-weight: 800; text-transform: uppercase; letter-spacing: -1px; text-align: center;">Aviso de Reparo</h1>
                            </div>
                            <p style="text-align: center; font-size: 38px; color: ${colorOnSurfaceVariant}; margin: 0; line-height: 1.5; font-weight: 500;">Identificamos um ROMPIMENTO em nossa fibra que afeta a conexão nos seguintes locais:</p>
                        </div>
                        
                        <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start;">
                            ${bairrosHtml}
                        </div>
                        
                    </div>
                `;
            }

            const headerHtml = `
                <div style="height: 450px; width: 100%; display: flex; align-items: center; justify-content: center; padding: 60px 0 20px 0; z-index: 10; box-sizing: border-box;">
                    <img id="social-logo-${paginaAtual}" src="logo-comunicado.png" style="max-height: 420px; max-width: 85%; object-fit: contain;" onerror="this.style.display='none';">
                </div>
            `;

            let indicadorHtml = '';
            if (totalPaginas > 1) {
                indicadorHtml = `
                    <div style="position: absolute; top: 60px; right: 60px; background-color: rgba(103, 7, 159, 0.15); color: ${colorPrimaryPurple}; font-size: 30px; font-weight: bold; padding: 15px 30px; border-radius: 40px; border: 1px solid rgba(103, 7, 159, 0.2); z-index: 20;">
                        ${paginaAtual}/${totalPaginas}
                    </div>
                `;
            }

            offscreenDiv.innerHTML = `
                ${innerBorderHtml}
                ${headerHtml}
                ${indicadorHtml}
                ${conteudoCentralHtml}
            `;

            wrapperDiv.appendChild(offscreenDiv);
            document.body.appendChild(wrapperDiv);

            const imgEl = document.getElementById(`social-logo-${paginaAtual}`);
            if (imgEl && !imgEl.complete && imgEl.style.display !== 'none') {
                await new Promise((resolve) => {
                    imgEl.onload = resolve;
                    imgEl.onerror = resolve; 
                });
            }
            await new Promise(resolve => setTimeout(resolve, 200));

            const canvas = await html2canvas(wrapperDiv, {
                backgroundColor: null, 
                scale: 1, 
                logging: false,
                useCORS: true 
            });

            let nomeArquivo = `Story_${popName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}`;
            if (totalPaginas > 1) nomeArquivo += `_Pag${paginaAtual}`;

            const link = document.createElement('a');
            link.download = `${nomeArquivo}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            document.body.removeChild(wrapperDiv);

            if (paginaAtual < totalPaginas) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

    } catch (error) {
        console.error('Erro ao gerar comunicado off-screen:', error);
        alert('Ocorreu um erro ao gerar a imagem para redes sociais.');
    } finally {
        if (btn) btn.innerHTML = originalContent;
    }
};