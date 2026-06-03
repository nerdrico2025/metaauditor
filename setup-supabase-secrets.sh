#!/bin/bash
# Script para configurar secrets do Supabase
# Execute: bash setup-supabase-secrets.sh

echo "🔐 Configurando Secrets do Supabase..."

# Verifica se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado!"
    echo "📦 Instale com: npm install -g supabase"
    exit 1
fi

# Configura secrets
echo "📝 Configurando META_APP_ID..."
supabase secrets set META_APP_ID=1314312457392291

echo "📝 Configurando META_APP_SECRET..."
supabase secrets set META_APP_SECRET=b3f97d9bb79ebc82b74af4a2db850216

echo "✅ Secrets configurados com sucesso!"
echo "🚀 Agora você pode testar o OAuth do Facebook!"
