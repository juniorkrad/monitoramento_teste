// ==============================================================================
// olt-comunicado.js - Gerador de Imagem para Redes Sociais (Formato Stories 9:16)
// Tema: Material Design Light / Cores do Projeto (Roxo) / Fundo Branco
// Atualização: Paginação ajustada de 8 para 7 bairros por página para melhor layout vertical.
// ==============================================================================

window.gerarComunicadoSocialOffscreen = async function(event) {
    if (event) event.stopPropagation();

    const btn = event ? event.currentTarget : null;
    let originalContent = '';
    if (btn) {
        originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-rounded">hourglass_empty</span>`;
    }

    try {
        // 1. Descobrir qual OLT está aberta
        const titleEl = document.getElementById('super-modal-title');
        let oltName = 'OLT_Desconhecida';
        if (titleEl) {
            oltName = titleEl.innerText.replace('dns', '').trim();
        }

        // NOVO: Função interna de PROCV (Busca linha por linha)
        function buscarLocalidadeExata(rows, oltIdentifier, placa, porta) {
            if (!rows || rows.length === 0) return null;

            const cleanOlt = (oltIdentifier || "").toUpperCase().replace(/[^A-Z0-9]/g, '');

            // Mapeamento das colunas da aba LOCALIDADE (p = Porta, l = Localidade)
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

            const targetPortStr = `${placa}/${porta}`; // Ex: "2/1"

            // Varre a planilha linha por linha buscando a porta exata
            for (let i = 0; i < rows.length; i++) {
                let rowPort = rows[i][map.p];
                if (!rowPort) continue;

                // Limpa a string da planilha (remove GPON, espaços, etc)
                let s = String(rowPort).replace(/gpon/i, '').replace(/\\/g, '/').trim();
                s = s.replace(/[^0-9/]/g, ''); 

                // Algumas OLTs tem formato 1/1/1/2, pegamos sempre Placa/Porta final
                let parts = s.split('/');
                if (parts.length >= 2) {
                    let sl = parseInt(parts[parts.length - 2], 10);
                    let pt = parseInt(parts[parts.length - 1], 10);
                    if (`${sl}/${pt}` === targetPortStr) {
                        return rows[i][map.l]; // Achou! Retorna a localidade.
                    }
                } else if (s === targetPortStr) {
                    return rows[i][map.l];
                }
            }
            return null; // Se não achar na coluna inteira, retorna nulo
        }


        // 2. Extrair EXCLUSIVAMENTE as Localidades (Bairros) das portas 100% caídas
        const localidadesAfetadasSet = new Set();
        const data = window.CURRENT_OLT_PORT_DATA || {}; 

        for (const placa in data) {
            const ports = data[placa];
            for (const porta in ports) {
                const pData = ports[porta];
                const total = pData.online + pData.offline;
                
                // Critério de queda: total >= 5 clientes e 100% offline
                if (total >= 5 && (pData.offline / total) === 1) {
                    let nomeLocalidade = null;
                    
                    // Cruza os dados EXCLUSIVAMENTE usando o novo PROCV
                    if (window.GLOBAL_BAIRROS_DATA) {
                        nomeLocalidade = buscarLocalidadeExata(window.GLOBAL_BAIRROS_DATA, oltName, placa, porta);
                    }
                    
                    // Se achou uma localidade válida (NÃO usa mais circuito como fallback)
                    if (nomeLocalidade && nomeLocalidade.trim() !== "" && nomeLocalidade.trim() !== "-") {
                        
                        // Fatiador Inteligente
                        const partes = nomeLocalidade.split(/\s*,\s*|\s*\/\s*|\s+e\s+/gi);
                        
                        partes.forEach(parte => {
                            const bairroLimpo = parte.trim();
                            if (bairroLimpo && bairroLimpo !== "-") {
                                localidadesAfetadasSet.add(bairroLimpo); // O Set elimina duplicatas
                            }
                        });
                    }
                }
            }
        }

        // Converte o Set para um Array e ordena alfabeticamente
        const bairros = Array.from(localidadesAfetadasSet).sort();

        // 3. Paginação (Limite de bairros por "Story")
        // AJUSTE: Redução do limite de bairros por página de 8 para 7 para garantir espaçamento vertical e evitar que os itens toquem a borda inferior. Isso resultará em mais páginas, mas com um layout melhor.
        const LIMITE_BAIRROS = 7;
        const paginasDeLista = Math.ceil(bairros.length / LIMITE_BAIRROS);
        const totalPaginas = bairros.length > 0 ? paginasDeLista + 1 : 1;
        
        // Paleta Material Design 3 Light com Roxo do Projeto
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
                // Cenário Rede Estável
                conteudoCentralHtml = `
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px; text-align: center;">
                        <span style="font-family: 'Material Symbols Rounded'; font-size: 180px; color: #10b981; margin-bottom: 40px;">check_circle</span>
                        <h1 style="font-size: 80px; color: ${colorPrimaryPurple}; margin: 0 0 20px 0; font-weight: 800;">REDE ESTÁVEL</h1>
                        <p style="font-size: 40px; color: ${colorOnSurfaceVariant}; margin: 0; line-height: 1.4;">Nenhuma instabilidade identificada nesta região.</p>
                    </div>
                `;
            } else if (isPaginaFinalMensagens) {
                // Página Final Exclusiva de Mensagens
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
                // Páginas de Lista (Bairros)
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

            // Cabeçalho (Área da Logo)
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

            // Montagem Final do Lado de Fora
            offscreenDiv.innerHTML = `
                ${innerBorderHtml}
                ${headerHtml}
                ${indicadorHtml}
                ${conteudoCentralHtml}
            `;

            wrapperDiv.appendChild(offscreenDiv);
            document.body.appendChild(wrapperDiv);

            // Trava de segurança para carregar imagem
            const imgEl = document.getElementById(`social-logo-${paginaAtual}`);
            if (imgEl && !imgEl.complete && imgEl.style.display !== 'none') {
                await new Promise((resolve) => {
                    imgEl.onload = resolve;
                    imgEl.onerror = resolve; 
                });
            }
            await new Promise(resolve => setTimeout(resolve, 200));

            // 4. Gerar a imagem com HTML2Canvas
            const canvas = await html2canvas(wrapperDiv, {
                backgroundColor: null, 
                scale: 1, 
                logging: false,
                useCORS: true 
            });

            let nomeArquivo = `Story_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}`;
            if (totalPaginas > 1) nomeArquivo += `_Pag${paginaAtual}`;

            // Criar Link de Download
            const link = document.createElement('a');
            link.download = `${nomeArquivo}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link); // Anexa ao DOM
            link.click();
            document.body.removeChild(link); // Limpa o DOM
            
            document.body.removeChild(wrapperDiv);

            // TRAVA ANTI-BLOQUEIO DO NAVEGADOR
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