#!/usr/bin/env python3
"""
Script para criar lotes otimizados para push massivo via MCP GitHub
"""
import os
import json
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path("e:/clickhero-ads-analyzer")

# Arquivos já enviados (não precisam ser reenviados)
ALREADY_PUSHED = {
    'package.json', '.gitignore', 'README.md', 'index.html',
    'vite.config.ts', 'tsconfig.json', 'tailwind.config.ts',
    'postcss.config.js', 'eslint.config.js', 'tsconfig.app.json',
    'tsconfig.node.json', 'vitest.config.ts', 'components.json',
    'public/robots.txt', 'src/main.tsx', 'src/App.tsx', 'src/App.css',
    'src/index.css', 'src/lib/utils.ts', 'src/vite-env.d.ts',
    'src/integrations/supabase/client.ts', 'src/contexts/AuthContext.tsx',
    'src/hooks/useCampaigns.ts', 'src/hooks/useCreatives.ts', 'src/hooks/use-toast.ts'
}

def read_file_safe(file_path):
    """Lê arquivo com encoding UTF-8"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        # Se falhar UTF-8, tenta latin-1
        try:
            with open(file_path, 'r', encoding='latin-1') as f:
                return f.read()
        except Exception as e:
            print(f"ERRO lendo {file_path}: {e}")
            return None

def create_push_batches():
    """Cria lotes de arquivos para push"""
    
    # Ler lista de arquivos
    with open(BASE_DIR / "files_to_push.txt", "r", encoding="utf-8") as f:
        all_files = [line.strip() for line in f if line.strip()]
    
    # Filtrar já enviados
    files_to_push = [f for f in all_files if f.replace('\\', '/') not in ALREADY_PUSHED]
    
    print(f"Total de arquivos: {len(all_files)}")
    print(f"Já enviados: {len(ALREADY_PUSHED)}")
    print(f"A enviar: {len(files_to_push)}\n")
    
    # Agrupar por categoria
    batches = defaultdict(list)
    
    for file_rel in files_to_push:
        file_path = BASE_DIR / file_rel
        
        if not file_path.exists():
            continue
            
        # Determinar categoria
        path_parts = Path(file_rel).parts
        
        if 'supabase' in path_parts and 'functions' in path_parts:
            category = 'supabase_functions'
        elif 'src' in path_parts:
            if 'components' in path_parts:
                if 'ui' in path_parts:
                    category = 'src_components_ui'
                else:
                    category = 'src_components'
            elif 'pages' in path_parts:
                category = 'src_pages'
            elif 'hooks' in path_parts:
                category = 'src_hooks'
            elif 'types' in path_parts or 'lib' in path_parts:
                category = 'src_lib_types'
            elif 'integrations' in path_parts:
                category = 'src_integrations'
            else:
                category = 'src_root'
        else:
            category = 'project_root'
        
        batches[category].append(file_rel)
    
    # Mostrar resumo
    print("Lotes criados:")
    for category, files in sorted(batches.items()):
        print(f"  {category}: {len(files)} arquivos")
    
    return batches

if __name__ == "__main__":
    batches = create_push_batches()
    
    # Salvar informação dos lotes
    with open(BASE_DIR / "push_batches_info.json", "w", encoding="utf-8") as f:
        json.dump({k: list(v) for k, v in batches.items()}, f, indent=2)
    
    print(f"\nInformação dos lotes salva em push_batches_info.json")
