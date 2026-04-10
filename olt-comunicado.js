// ==============================================================================
// olt-comunicado.js - Gerador de Imagem para Redes Sociais (Formato Stories 9:16)
// Extrai os circuitos afetados (bairros) e gera um layout limpo para o cliente final.
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

        // 2. Extrair APENAS os Circuitos (Bairros) das portas 100% caídas
        const circuitosAfetadosSet = new Set();
        const data = window.CURRENT_OLT_PORT_DATA || {}; 

        for (const placa in data) {
            const ports = data[placa];
            for (const porta in ports) {
                const pData = ports[porta];
                const total = pData.online + pData.offline;
                
                // Critério de queda: total >= 5 clientes e 100% offline
                if (total >= 5 && (pData.offline / total) === 1) {
                    // Limpa traços extras e pega o nome do circuito/bairro
                    let nomeCircuito = pData.info.replace(/'/g, "").trim();
                    if (nomeCircuito && nomeCircuito !== "-") {
                        circuitosAfetadosSet.add(nomeCircuito);
                    }
                }
            }
        }

        // Converte o Set para um Array e ordena alfabeticamente
        const bairros = Array.from(circuitosAfetadosSet).sort();

        // 3. Paginação (Limite de bairros por "Story" para não ficar pequeno)
        const LIMITE_BAIRROS = 8;
        const totalPaginas = Math.max(1, Math.ceil(bairros.length / LIMITE_BAIRROS));

        for (let paginaAtual = 1; paginaAtual <= totalPaginas; paginaAtual++) {
            
            // Criar o Wrapper Transparente
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
            // Fundo claro e amigável: Gradiente de branco para um cinza/azulado bem leve
            offscreenDiv.style.background = 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)'; 
            offscreenDiv.style.fontFamily = "'Montserrat', sans-serif";
            offscreenDiv.style.display = 'flex';
            offscreenDiv.style.flexDirection = 'column';
            offscreenDiv.style.boxSizing = 'border-box';
            offscreenDiv.style.position = 'relative';
            offscreenDiv.style.overflow = 'hidden';

            // Conteúdo Condicional
            let conteudoCentralHtml = '';

            if (bairros.length === 0) {
                conteudoCentralHtml = `
                    <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 80px; text-align: center;">
                        <span style="font-family: 'Material Symbols Rounded'; font-size: 180px; color: #10b981; margin-bottom: 40px;">check_circle</span>
                        <h1 style="font-size: 80px; color: #0f172a; margin: 0 0 20px 0; font-weight: 800;">REDE ESTÁVEL</h1>
                        <p style="font-size: 40px; color: #475569; margin: 0; line-height: 1.4;">Nenhuma instabilidade identificada nesta região.</p>
                    </div>
                `;
            } else {
                let bairrosHtml = '';
                const startIndex = (paginaAtual - 1) * LIMITE_BAIRROS;
                const endIndex = startIndex + LIMITE_BAIRROS;
                const fatiaBairros = bairros.slice(startIndex, endIndex);

                fatiaBairros.forEach(bairro => {
                    bairrosHtml += `
                        <div style="background-color: #ffffff; border-left: 12px solid #ef4444; border-radius: 16px; padding: 30px 40px; margin-bottom: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 30px;">
                            <span style="font-family: 'Material Symbols Rounded'; font-size: 48px; color: #ef4444;">location_on</span>
                            <span style="font-size: 45px; font-weight: 700; color: #1e293b;">${bairro}</span>
                        </div>
                    `;
                });

                conteudoCentralHtml = `
                    <div style="flex: 1; padding: 60px 80px; display: flex; flex-direction: column;">
                        
                        <div style="text-align: center; margin-bottom: 70px; margin-top: 20px;">
                            <div style="display: inline-flex; align-items: center; justify-content: center; background-color: #fee2e2; border-radius: 50%; width: 150px; height: 150px; margin-bottom: 30px;">
                                <span style="font-family: 'Material Symbols Rounded'; font-size: 80px; color: #ef4444;">campaign</span>
                            </div>
                            <h1 style="font-size: 75px; color: #0f172a; margin: 0 0 20px 0; font-weight: 800; text-transform: uppercase; letter-spacing: -1px;">Aviso de Manutenção</h1>
                            <p style="font-size: 38px; color: #475569; margin: 0; line-height: 1.5; font-weight: 500;">Identificamos uma instabilidade que afeta a conexão nos seguintes locais:</p>
                        </div>
                        
                        <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start;">
                            ${bairrosHtml}
                        </div>
                        
                        <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 20px; padding: 40px; text-align: center; margin-top: 40px;">
                            <p style="font-size: 34px; color: #475569; margin: 0; line-height: 1.5; font-weight: 500;">Nossa equipe técnica já está trabalhando para normalizar os serviços o mais rápido possível.</p>
                        </div>
                    </div>
                `;
            }

            // Cabeçalho Branco (Para a Logo)
            const headerHtml = `
                <div style="background-color: #ffffff; height: 280px; width: 100%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.03); z-index: 10;">
                    <img src="logo-comunicado.png" style="max-height: 160px; max-width: 80%; object-fit: contain;" onerror="this.style.display='none'; this.parentNode.innerHTML='<h2 style=\\'font-size:60px; color:#0f172a; margin:0;\\'>COMUNICADO</h2>';">
                </div>
            `;

            // Indicador de Página (Se houver mais de uma)
            let indicadorHtml = '';
            if (totalPaginas > 1) {
                indicadorHtml = `
                    <div style="position: absolute; top: 310px; right: 50px; background-color: rgba(15, 23, 42, 0.1); color: #0f172a; font-size: 30px; font-weight: bold; padding: 15px 30px; border-radius: 40px;">
                        ${paginaAtual}/${totalPaginas}
                    </div>
                `;
            }

            // Rodapé
            const footerHtml = `
                <div style="background-color: #0f172a; color: #ffffff; padding: 40px; text-align: center;">
                    <p style="font-size: 30px; margin: 0; font-weight: 500; opacity: 0.9;">Agradecemos a compreensão.</p>
                </div>
            `;

            // Monta a estrutura do Story
            offscreenDiv.innerHTML = `
                ${headerHtml}
                ${indicadorHtml}
                ${conteudoCentralHtml}
                ${footerHtml}
            `;

            wrapperDiv.appendChild(offscreenDiv);
            document.body.appendChild(wrapperDiv);

            // 4. Gerar a imagem com HTML2Canvas
            const canvas = await html2canvas(wrapperDiv, {
                backgroundColor: null, 
                scale: 1, // Escala 1 é suficiente pois a base já é enorme (1080x1920)
                logging: false
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