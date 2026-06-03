#!/usr/bin/env python3
"""
Script automatizado para enviar TODOS os arquivos restantes via MCP GitHub
Envia em lotes de 5 arquivos (máximo do MCP) sequencialmente
"""
import json
import os
import sys
from pathlib import Path

# Configuração
BASE_DIR = Path("e:/clickhero-ads-analyzer")
BATCH_INFO_FILE = BASE_DIR / "push_batches_info.json"
OWNER = "nerdrico2025"
REPO = "metaauditor"
BRANCH = "main"

def read_file_content(file_path):
    """Lê conteúdo do arquivo com encoding UTF-8"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        # Fallback para latin-1 se UTF-8 falhar
        with open(file_path, 'r', encoding='latin-1') as f:
            return f.read()
    except Exception as e:
        print(f"ERRO ao ler {file_path}: {e}", file=sys.stderr)
        return None

def create_file_payload(file_rel_path):
    """Cria payload para um arquivo"""
    file_path = BASE_DIR / file_rel_path
    
    if not file_path.exists():
        print(f"AVISO: Arquivo não encontrado: {file_path}", file=sys.stderr)
        return None
    
    content = read_file_content(file_path)
    if content is None:
        return None
    
    # Converter caminho do Windows para Unix (GitHub usa Unix paths)
    unix_path = file_rel_path.replace('\\', '/')
    
    return {
        "path": unix_path,
        "content": content
    }

def load_batches():
    """Carrega informação dos lotes"""
    with open(BATCH_INFO_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_push_batches(all_files, batch_size=5):
    """Divide arquivos em lotes de tamanho específico"""
    batches = []
    current_batch = []
    
    for file_rel in all_files:
        payload = create_file_payload(file_rel)
        if payload:
            current_batch.append(payload)
            
            if len(current_batch) >= batch_size:
                batches.append(current_batch)
                current_batch = []
    
    # Adicionar último lote se houver sobras
    if current_batch:
        batches.append(current_batch)
    
    return batches

def generate_mcp_commands():
    """Gera comandos MCP GitHub para todos os lotes"""
    batches = load_batches()
    
    # Combinar todos os arquivos mantendo prioridade
    priority_order = [
        'src_integrations',  # types.ts primeiro!
        'src_hooks',
        'src_lib_types',
        'src_components',
        'src_pages',
        'src_components_ui',
        'src_root',
        'supabase_functions',
        'project_root'
    ]
    
    all_files = []
    for category in priority_order:
        if category in batches:
            all_files.extend(batches[category])
    
    print(f"Total de arquivos a processar: {len(all_files)}\n")
    
    # Criar lotes de 5 arquivos
    push_batches = create_push_batches(all_files, batch_size=5)
    
    print(f"Divididos em {len(push_batches)} lotes\n")
    print("=" * 80)
    
    # Gerar comandos para cada lote
    for i, batch in enumerate(push_batches, 1):
        file_list = ', '.join([f['path'] for f in batch])
        print(f"\nLOTE {i}/{len(push_batches)} ({len(batch)} arquivos):")
        print(f"  Arquivos: {file_list}")
        
        # Gerar JSON do lote (para copiar/colar em mcp_github_push_files)
        batch_json = json.dumps(batch, ensure_ascii=False, indent=2)
        
        # Salvar lote individual
        batch_file = BASE_DIR / f"_auto_batch_{i:03d}.json"
        with open(batch_file, 'w', encoding='utf-8') as f:
            f.write(batch_json)
        
        print(f"  Salvo em: {batch_file}")
    
    print("\n" + "=" * 80)
    print(f"\n✅ {len(push_batches)} lotes prontos em arquivos _auto_batch_*.json")
    print(f"\nPara enviar via MCP GitHub, use o conteúdo de cada arquivo como")
    print(f"parâmetro 'files' da função mcp_github_push_files")

if __name__ == "__main__":
    generate_mcp_commands()
