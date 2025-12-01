#!/bin/bash

echo "=================================================="
echo "  Script de Migração: Desenvolvimento → Produção"
echo "=================================================="
echo ""

# Verificar se PROD_DATABASE_URL está configurado
if [ -z "$PROD_DATABASE_URL" ]; then
  echo "❌ Erro: PROD_DATABASE_URL não está configurado"
  echo ""
  echo "📝 Configure a variável de ambiente PROD_DATABASE_URL antes de executar:"
  echo "   export PROD_DATABASE_URL='postgresql://user:pass@host:5432/database'"
  echo ""
  echo "Ou execute com a variável inline:"
  echo "   PROD_DATABASE_URL='sua-url' ./migrate-to-production.sh"
  echo ""
  exit 1
fi

echo "🔄 Executando migração..."
echo ""

cd server && npx tsx scripts/migrate-to-production.ts
