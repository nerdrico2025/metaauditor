
#!/bin/bash

echo "🔄 Reorganizando estrutura do projeto..."

# Criar diretórios
mkdir -p apps/client/src
mkdir -p apps/server/src
mkdir -p packages/database
mkdir -p packages/services
mkdir -p packages/shared
mkdir -p scripts

# Mover CLIENT
echo "📦 Movendo arquivos do cliente..."
mv client/src/* apps/client/src/ 2>/dev/null || true
mv client/index.html apps/client/ 2>/dev/null || true

# Mover SERVER
echo "⚙️ Movendo arquivos do servidor..."
mv server/*.ts apps/server/src/ 2>/dev/null || true
mv server/services/* packages/services/ 2>/dev/null || true

# Mover SHARED
echo "🔗 Movendo código compartilhado..."
mv shared/* packages/shared/ 2>/dev/null || true

# Mover DATABASE
echo "🗄️ Movendo arquivos de banco..."
cp -r migrations packages/database/ 2>/dev/null || true

# Mover SCRIPTS
echo "🔧 Movendo scripts..."
mv server/createSuperAdmin.ts scripts/ 2>/dev/null || true
mv server/resetUserPassword.ts scripts/ 2>/dev/null || true

# Limpar diretórios vazios
echo "🧹 Limpando diretórios antigos..."
rm -rf client/src server/services shared 2>/dev/null || true

echo "✅ Reorganização concluída!"
echo ""
echo "📝 Próximos passos:"
echo "1. Atualize os imports nos arquivos"
echo "2. Atualize vite.config.ts para apontar para apps/client"
echo "3. Teste a aplicação: npm run dev"
