# ==============================================================================
# SCRIPT DEDICADO: OLTs FURUKAWA - MODO LOCAL (JSON DINÂMICO + METADADOS)
# Atualizado: Gera arquivos por OLT (ex: dados_sbo1.json) com Data/Hora
# ==============================================================================

import pandas as pd
import re
import configparser
from netmiko import ConnectHandler
from datetime import datetime
import sys
import time
import os
import json
from tqdm import tqdm

# Função auxiliar com Barra de Progresso OTIMIZADA
def executar_comando_ssh(net_connect, comando):
    print(f"\n📡 Enviando comando: '{comando}'")
    net_connect.write_channel(f"{comando}\n")
    
    output_buffer = ""
    start_time_sem_dados = time.time() # Marcador de tempo para timeout
    TIMEOUT_LIMIT = 60 # Segundos limite para esperar dados
    
    print("⏳ Aguardando fluxo de dados...")
    
    # mininterval=0.1 garante que a barra atualize pelo menos 10x por segundo se houver dados
    with tqdm(desc="📥 Baixando", unit="B", unit_scale=True, 
              ncols=100, colour='cyan', leave=True, mininterval=0.1, file=sys.stdout) as barra:
        
        while True:
            try:
                # Tenta ler o que tem no canal AGORA
                if net_connect.remote_conn.recv_ready():
                    chunk = net_connect.read_channel()
                else:
                    chunk = ""
            except:
                chunk = ""

            if chunk:
                # Se chegou dado, reseta o timer de timeout
                start_time_sem_dados = time.time()
                
                # Atualiza a barra e o buffer
                barra.update(len(chunk))
                output_buffer += chunk
                
                # Lógica de Paginação (--More--)
                if "--More--" in chunk:
                    net_connect.write_channel(" ")
            
            # Se o prompt final aparecer (#), acabou
            if output_buffer.strip().endswith("#"):
                barra.set_description("✅ Concluído")
                break
            
            # Lógica de Timeout baseada em TEMPO REAL
            tempo_ocioso = time.time() - start_time_sem_dados
            if tempo_ocioso > TIMEOUT_LIMIT:
                barra.set_description("⚠️ Timeout (Sem resposta)")
                break
            
            # Pausa minúscula apenas para não fritar a CPU
            time.sleep(0.1)
            
    return output_buffer

def coletar_furukawa_manual(config_file):
    script_start_time = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    print(f"--- [FURUKAWA LOCAL] Iniciando: {config_file} [{script_start_time}] ---")
    
    config = configparser.ConfigParser()
    config.read(config_file)

    # Configuração da OLT
    olt_device = {
        'device_type': 'autodetect',
        'host':       config['OLT']['HOST'],
        'username':   config['OLT']['USER'],
        'password':   config['OLT']['PASSWORD'],
        'port':       config['OLT'].get('PORT', 22),
    }
    
    raw_info = ""
    raw_desc = ""
    
    try:
        print(f"🔌 Conectando à OLT {config['OLT']['HOST']}...")
        with ConnectHandler(**olt_device) as net_connect:
            print("✅ Conexão SSH estabelecida.")

            print("⚙️ Entrando em Modo Enable...")
            net_connect.enable()
            print("✅ Modo enable ativado.")
            
            # --- 1. COLETAR INFO ---
            raw_info = executar_comando_ssh(net_connect, "show onu info")
            
            # --- 2. COLETAR DESCRIPTION ---
            raw_desc = executar_comando_ssh(net_connect, "show onu description")
            
            print("\n✅ Todas as coletas finalizadas via SSH.")

    except Exception as e:
        print(f"\n❌ ERRO DE CONEXÃO: {e}")
        return

    # --- PROCESSAMENTO DE DADOS ---
    print("⚙️ Processando dados brutos...")
    
    if not raw_info:
        print("❌ ERRO: Nenhum dado de INFO retornado.")
        return

    dados_finais = []
    linhas_a_ignorar = ["----", "==", "Serial No.", "Press any key", "invalid token", "invalid input", "show onu info", "show onu description", "DESCRIPTION"]
    regex_universal = r"(?i)^(GPON\s*)?\d+(/\d+)+"
    
    # --- PROCESSAR DESCRIPTION ---
    print("⚙️ Cruzando dados de Descrição...")
    mapa_desc = {}
    
    for linha in raw_desc.splitlines():
        linha_limpa = linha.replace("--More--", "").strip()
        if not linha_limpa or any(filtro in linha_limpa for filtro in linhas_a_ignorar):
            continue
            
        cols = [c.strip() for c in linha_limpa.split('|')]
        
        if len(cols) >= 3 and re.match(regex_universal, cols[0]):
            interface = cols[0]
            onu_id = cols[1]
            descricao = cols[2]
            chave = f"{interface}-{onu_id}"
            mapa_desc[chave] = descricao

    # --- PROCESSAR INFO E UNIFICAR ---
    for linha in raw_info.splitlines():
        linha_limpa = linha.replace("--More--", "").strip()
        
        if not linha_limpa or any(filtro in linha_limpa for filtro in linhas_a_ignorar):
            continue
        
        colunas = [col.strip() for col in linha_limpa.split('|')]
        
        if len(colunas) >= 2 and re.match(regex_universal, colunas[0]):
            interface = colunas[0]
            onu_id = colunas[1]
            chave = f"{interface}-{onu_id}"
            descricao_encontrada = mapa_desc.get(chave, "")
            
            while len(colunas) < 7:
                colunas.append("")
            
            if len(colunas) > 7:
                colunas[7] = descricao_encontrada
            else:
                colunas.append(descricao_encontrada)
                
            dados_finais.append(colunas)

    if not dados_finais:
        print("⚠️ AVISO: Nenhuma linha válida encontrada.")
        return

    # --- SALVAR ARQUIVO JSON LOCAL (COM METADADOS) ---
    print(f"✅ {len(dados_finais)} registros processados.")
    
    try:
        # 1. Extrai o ID da OLT do nome do arquivo (ex: config-sbo1.ini -> sbo1)
        nome_arquivo_ini = os.path.basename(config_file)
        nome_olt = nome_arquivo_ini.replace('config-', '').replace('.ini', '').lower()
        
        # 2. Define o nome do arquivo JSON específico (ex: dados_sbo1.json)
        nome_json = f'dados_{nome_olt}.json'
        caminho_json = os.path.join(os.path.dirname(__file__), f'../{nome_json}')
        
        # 3. Cria a estrutura com Metadados + Dados
        pacote_final = {
            "meta": {
                "atualizado_em": script_start_time,
                "total_registros": len(dados_finais),
                "tipo_olt": "furukawa",
                "id_olt": nome_olt
            },
            "dados": dados_finais
        }
        
        # 4. Salva usando json.dump
        with open(caminho_json, 'w', encoding='utf-8') as f:
            json.dump(pacote_final, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Arquivo salvo com sucesso: {nome_json}")
        print(f"📂 Caminho completo: {os.path.abspath(caminho_json)}")
        print(f"🎉 SUCESSO! Dados de {nome_olt} atualizados.")

    except Exception as e:
        print(f"❌ ERRO ao salvar arquivo JSON: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ERRO: Forneça o arquivo .ini. Exemplo: python3 coletar_furukawa.py config-sbo1.ini")
    else:
        coletar_furukawa_manual(sys.argv[1])