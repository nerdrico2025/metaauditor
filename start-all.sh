#!/bin/bash

# Script para iniciar Backend, Frontend e Landing em paralelo
# Cada um em seu próprio processo com output separado

echo "🚀 Iniciando Click Auditor (3 projetos em paralelo)..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Iniciar Backend na porta 5000
echo -e "${GREEN}[BACKEND]${NC} Iniciando servidor Express na porta 5000..."
npm run dev &
BACKEND_PID=$!

# Aguardar um pouco para o backend iniciar
sleep 3

# Iniciar Frontend na porta 5173
echo -e "${BLUE}[FRONTEND]${NC} Iniciando React Vite na porta 5173..."
cd client && npm run dev &
FRONTEND_PID=$!
cd ..

# Aguardar um pouco
sleep 3

# Iniciar Landing na porta 3000
echo -e "${MAGENTA}[LANDING]${NC} Iniciando Next.js na porta 3000..."
cd landing && npm run dev &
LANDING_PID=$!
cd ..

echo ""
echo "✅ Todos os projetos iniciados!"
echo ""
echo "📍 URLs disponíveis:"
echo -e "  ${GREEN}Backend:${NC}   http://localhost:5000"
echo -e "  ${BLUE}Frontend:${NC}  http://localhost:5173"
echo -e "  ${MAGENTA}Landing:${NC}    http://localhost:3000"
echo ""
echo "📋 PIDs: Backend=$BACKEND_PID, Frontend=$FRONTEND_PID, Landing=$LANDING_PID"
echo ""
echo "Para parar, pressione Ctrl+C"
echo ""

# Aguardar todos os processos
wait
