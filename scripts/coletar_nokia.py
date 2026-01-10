# ==============================================================================
# SCRIPT DEDICADO: OLTs NOKIA - MODO LOCAL (JSON DINÂMICO + METADADOS)
# Atualizado: Gera arquivos por OLT (ex: dados_mgp.json) com Data/Hora
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
from tqdm import tqdm  # Biblioteca para a barra de progresso

def coletar_e_atualizar_nokia(config_file):
    script_start_time = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    print(f"--- [NOKIA LOCAL] Iniciando processo para: {config_file} [{script_start_time}] ---")
    
    config = configparser.ConfigParser()
    config.read(config_file)

    olt_device = {
        'device_type': 'autodetect',
        'host':       config['OLT']['HOST'],
        'username':   config['OLT']['USER'],
        'password':   config['OLT']['PASSWORD'],
        'port':       config['OLT'].get('PORT', 22)
    }
    
    output_total = ""
    try:
        print(f"🔌 Conectando à OLT {config['OLT']['HOST']}...")
        with ConnectHandler(**olt_device) as net_connect:
            print("✅ Conexão SSH estabelecida.")
            print("⚙️ Configurando ambiente da OLT Nokia...")
            net_connect.send_command("environment inhibit-alarms", expect_string=r'#')
            
            numero_de_placas = 8
            numero_de_portas = 16
            total_etapas = numero_de_placas * numero_de_portas
            
            print(f"📊 Iniciando varredura: {total_etapas} portas no total.")
            
            # --- BARRA DE PROGRESSO ---
            with tqdm(total=total_etapas, desc="🚀 Coletando", unit="portas", ncols=100, colour='green') as barra:
                for placa in range(1, numero_de_placas + 1):
                    for porta in range(1, numero_de_portas + 1):
                        
                        barra.set_description(f"🔍 Placa {placa} | Porta {porta}")
                        
                        comando_coleta = f"show equipment ont status pon 1/1/{placa}/{porta}"
                        
                        # Timeout ajustado para 60s por precaução
                        partial_output = net_connect.send_command(comando_coleta, expect_string=r'#', read_timeout=60)
                        output_total += partial_output
                        
                        barra.update(1)
                        time.sleep(0.01) 
            
            print("\n✅ Coleta em loop finalizada.")
            print("🔒 Sessão SSH com a OLT foi encerrada com sucesso.")
            
    except Exception as e:
        print(f"\n❌ ERRO na conexão ou execução de comandos SSH: {e}")
        return
        
    print("⚙️ Processando dados coletados...")
    if not output_total:
        print("❌ ERRO: Nenhum output recebido da OLT para processar.")
        return

    dados = []
    linhas_a_ignorar = ["----", "==", "Number of ONT", "pon count", "Admin State", "ONT-ID"]
    
    for linha in output_total.splitlines():
        linha_limpa = linha.strip().replace('|', '')
        
        if not linha_limpa or any(filtro in linha_limpa for filtro in linhas_a_ignorar):
            continue
        
        # Separa por UM ou mais espaços
        colunas = re.split(r'\s+', linha_limpa)
        
        # Verifica se a linha começa com o padrão da porta (ex: 1/1/1/1)
        if re.match(r"^\d+/\d+/\d+/\d+", colunas[0]):
            
            # --- CORREÇÃO: Limpeza do Serial na Coluna C (Index 2) ---
            if len(colunas) > 2:
                colunas[2] = colunas[2].replace(':', '')
            
            # Lógica de Status
            status = 'up'
            if 'down' in linha_limpa.lower(): 
                status = 'down'
            
            # Garante que a lista tenha colunas suficientes
            while len(colunas) < 10: 
                colunas.append('')
            
            # Força o status correto na coluna E (Index 4)
            colunas[4] = status
            
            # Adiciona apenas as 10 primeiras colunas
            dados.append(colunas[:10])
            
    if not dados:
        print("⚠️ AVISO: Nenhuma linha de dados válida foi extraída.")
        return

    # --- SALVAR ARQUIVO JSON ESPECÍFICO (COM METADADOS) ---
    print(f"✅ {len(dados)} registros processados.")
    
    try:
        # 1. Extrai o ID da OLT do nome do arquivo (ex: config-mgp.ini -> mgp)
        nome_arquivo_ini = os.path.basename(config_file)
        nome_olt = nome_arquivo_ini.replace('config-', '').replace('.ini', '').lower()
        
        # 2. Define o nome do arquivo JSON específico (ex: dados_mgp.json)
        # O arquivo será salvo um nível acima (pasta raiz do site)
        nome_json = f'dados_{nome_olt}.json'
        caminho_json = os.path.join(os.path.dirname(__file__), f'../{nome_json}')
        
        # 3. Cria a estrutura com Metadados + Dados
        pacote_final = {
            "meta": {
                "atualizado_em": script_start_time,
                "total_registros": len(dados),
                "tipo_olt": "nokia",
                "id_olt": nome_olt
            },
            "dados": dados
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
        print("ERRO: É necessário fornecer o nome do arquivo de configuração como argumento.")
        print("Exemplo: python3 coletar_nokia.py config-mgp.ini")
    else:
        coletar_e_atualizar_nokia(sys.argv[1])