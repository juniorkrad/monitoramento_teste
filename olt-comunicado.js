// ==============================================================================
// olt-comunicado.js - Gerador de Imagem para Redes Sociais (Formato Stories 9:16)
// Tema: Material Design Light / Cores do Projeto (Roxo) / Fundo Branco
// Atualização: Texto alterado para "Aviso de Reparo".
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

        // 2. Extrair APENAS os Circuitos das portas 100% caídas
        const circuitosAfetadosSet = new Set();
        const data = window.CURRENT_OLT_PORT_DATA || {}; 

        for (const placa in data) {
            const ports = data[placa];
            for (const porta in ports) {
                const pData = ports[porta];
                const total = pData.online + pData.offline;
                
                // Critério de queda: total >= 5 clientes e 100% offline
                if (total >= 5 && (pData.offline / total) === 1) {
                    // Limpa traços extras e pega o nome do circuito
                    let nomeCircuito = pData.info.replace(/'/g, "").trim();
                    if (nomeCircuito && nomeCircuito !== "-") {
                        circuitosAfetadosSet.add(nomeCircuito);
                    }
                }
            }
        }

        // Converte o Set para um Array e ordena alfabeticamente
        const bairros = Array.from(circuitosAfetadosSet).sort();

        // 3. Paginação (Limite de bairros por "Story")
        const LIMITE_BAIRROS = 8;
        // Calculamos as páginas de lista
        const paginasDeLista = Math.ceil(bairros.length / LIMITE_BAIRROS);
        // Se houver bairros, adicionamos +1 página exclusiva para o encerramento
        const totalPaginas = bairros.length > 0 ? paginasDeLista + 1 : 1;
        
        // Paleta Material Design 3 Light com Roxo do Projeto
        const colorPrimaryPurple = '#67079f'; 
        const colorPrimaryContainer = '#f3edf7'; // Fundo suave para os cards
        const colorOnSurface = '#1c1b1f'; // Texto Principal
        const colorOnSurfaceVariant = '#49454f'; // Texto Secundário
        const colorBackground = '#ffffff'; // Fundo Total Branco

        for (let paginaAtual = 1; paginaAtual <= totalPaginas; paginaAtual++) {
            
            // Criar o Wrapper Transparente para evitar quinas brancas
            const wrapperDiv = document.createElement('div');
            wrapperDiv.id = `social-wrapper-pag-${paginaAtual}`;
            wrapperDiv.style.position = 'absolute';
            wrapperDiv.style.left = '-9999px'; 
            wrapperDiv.style.top = '0';
            wrapperDiv.style.backgroundColor = 'transparent'; 
            wrapperDiv.style.padding = '0';

            // A Lona do Story (Formato Vertical: 1080x1920)
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
            
            // Bordas arredondadas fortes 
            offscreenDiv.style.borderRadius = '48px'; 
            
            // Borda interna descolada da extremidade (A moldura elegante)
            const innerBorderHtml = `
                <div style="position: absolute; top: 35px; bottom: 35px; left: 35px; right: 35px; border: 8px solid ${colorPrimaryPurple}; border-radius: 36px; pointer-events: none; z-index: 999;"></div>
            `;

            // Conteúdo Condicional
            let conteudoCentralHtml = '';
            let isPaginaFinalMensagens = false;

            // Define se é a página final exclusiva de mensagens (só se houver bairros)
            if (bairros.length > 0 && paginaAtual === totalPaginas) {
                isPaginaFinalMensagens = true;
            }

            if (bairros.length === 0) {
                // Cenário Rede Estável (Mantido)
                conteudoCentralHtml = `
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px; text-align: center;">
                        <span style="font-family: 'Material Symbols Rounded'; font-size: 180px; color: #10b981; margin-bottom: 40px;">check_circle</span>
                        <h1 style="font-size: 80px; color: ${colorPrimaryPurple}; margin: 0 0 20px 0; font-weight: 800;">REDE ESTÁVEL</h1>
                        <p style="font-size: 40px; color: ${colorOnSurfaceVariant}; margin: 0; line-height: 1.4;">Nenhuma instabilidade identificada nesta região.</p>
                    </div>
                `;
            } else if (isPaginaFinalMensagens) {
                // --- PÁGINA FINAL EXCLUSIVA DE MENSAGENS ---
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
                // --- PÁGINAS DE LISTA (Etiquetas) ---
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

            // Cabeçalho (Área da Logo) - Zoom de 50% aplicado
            const headerHtml = `
                <div style="height: 450px; width: 100%; display: flex; align-items: center; justify-content: center; padding: 60px 0 20px 0; z-index: 10; box-sizing: border-box;">
                    <img id="social-logo-${paginaAtual}" src="logo-comunicado.png" style="max-height: 420px; max-width: 85%; object-fit: contain;" onerror="this.style.display='none';">
                </div>
            `;

            // Indicador de Página Material (Reposicionado para respeitar a nova borda)
            let indicadorHtml = '';
            if (totalPaginas > 1) {
                indicadorHtml = `
                    <div style="position: absolute; top: 60px; right: 60px; background-color: rgba(103, 7, 159, 0.15); color: ${colorPrimaryPurple}; font-size: 30px; font-weight: bold; padding: 15px 30px; border-radius: 40px; border: 1px solid rgba(103, 7, 159, 0.2); z-index: 20;">
                        ${paginaAtual}/${totalPaginas}
                    </div>
                `;
            }

            // Monta a estrutura do Story (Com a moldura interna em primeiro lugar)
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

            // Nome do arquivo
            let nomeArquivo = `Story_${oltName.replace(/[^a-zA-Z0-9-]/g, '_')}_${new Date().getTime()}`;
            if (totalPaginas > 1) nomeArquivo += `_Pag${paginaAtual}`;

            // Criar Link de Download
            const link = document.createElement('a');
            link.download = `${nomeArquivo}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            document.body.removeChild(wrapperDiv);
        }

    } catch (error) {
        console.error('Erro ao gerar comunicado off-screen:', error);
        alert('Ocorreu um erro ao gerar a imagem para redes sociais.');
    } finally {
        if (btn) btn.innerHTML = originalContent;
    }
};