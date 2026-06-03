#!/usr/bin/env python3
"""
Script para listar todos os arquivos do projeto para push via MCP GitHub
"""
import os
import json
from pathlib import Path

# Diretório base do projeto
BASE_DIR = Path("e:/clickhero-ads-analyzer")

# Arquivos/diretórios a ignorar
IGNORE = {
    'node_modules', '.git', 'dist', 'build', '.vscode', '.idea',
    'push_batches', 'push_batches_small', 'temp_types.txt',
    '__pycache__', '.pytest_cache', 'coverage'
}

# Extensões de arquivo para incluir
INCLUDE_EXT = {
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt',
    '.css',' .html', '.yml', '.yaml', '.toml', '.sql',
    '.gitignore', '.env.example', '.prettierrc', '.eslintrc'
}

def should_include(file_path: Path) -> bool:
    """Verifica se o arquivo deve ser incluído"""
    # Ignorar se está em diretório ignorado
    for part in file_path.parts:
        if part in IGNORE:
            return False
    
    # Incluir se tem extensão válida
    if file_path.suffix in INCLUDE_EXT or file_path.name.startswith('.'):
        return True
        
    return False

def list_all_files():
    """Lista todos os arquivos do projeto"""
    all_files = []
    
    for root, dirs, files in os.walk(BASE_DIR):
        # Remover diretórios ignorados
        dirs[:] = [d for d in dirs if d not in IGNORE]
        
        for file in files:
            file_path = Path(root) / file
            if should_include(file_path):
                rel_path = file_path.relative_to(BASE_DIR)
                all_files.append(str(rel_path))
    
    return sorted(all_files)

if __name__ == "__main__":
    files = list_all_files()
    
    print(f"Total de arquivos encontrados: {len(files)}\n")
    
    # Agrupar por diretório
    from collections import defaultdict
    by_dir = defaultdict(list)
    
    for f in files:
        dir_name = str(Path(f).parent)
        by_dir[dir_name].append(f)
    
    # Mostrar resumo
    for dir_name in sorted(by_dir.keys()):
        count = len(by_dir[dir_name])
        print(f"{dir_name}: {count} arquivos")
    
    # Salvar lista completa
    with open(BASE_DIR / "files_to_push.txt", "w", encoding="utf-8") as f:
        for file in files:
            f.write(f"{file}\n")
    
    print(f"\nLista salvand em files_to_push.txt")
