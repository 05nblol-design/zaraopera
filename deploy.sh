#!/bin/bash

# Script de Deploy para Railway
# Execute este script para preparar e fazer deploy do projeto

echo "🚀 Iniciando deploy do Sistema ZARA no Railway..."

# Verificar se git está inicializado
if [ ! -d ".git" ]; then
    echo "📦 Inicializando repositório Git..."
    git init
    git add .
    git commit -m "Initial commit - Sistema ZARA"
    git branch -M main
    echo "✅ Repositório Git inicializado"
else
    echo "📦 Atualizando repositório Git..."
    git add .
    git commit -m "Update for Railway deployment"
    echo "✅ Repositório Git atualizado"
fi

# Instruções para o usuário
echo ""
echo "📋 Próximos passos:"
echo "1. Crie um repositório no GitHub (se ainda não criou)"
echo "2. Adicione o remote origin:"
echo "   git remote add origin https://github.com/SEU_USUARIO/zara-operacao-system.git"
echo "3. Faça push do código:"
echo "   git push -u origin main"
echo ""
echo "4. Acesse Railway.app e:"
echo "   - Clique em 'New Project'"
echo "   - Selecione 'Deploy from GitHub repo'"
echo "   - Escolha o repositório criado"
echo "   - Railway detectará automaticamente o railway.toml"
echo ""
echo "5. Configure as variáveis de ambiente no Railway:"
echo "   NODE_ENV=production"
echo "   DATABASE_URL=\${{Postgres.DATABASE_URL}}"
echo "   JWT_SECRET=sua_chave_jwt_secreta"
echo "   SENDGRID_API_KEY=sua_api_key_sendgrid"
echo "   REDIS_URL=\${{Redis.REDIS_URL}}"
echo ""
echo "🎉 Deploy configurado! Siga as instruções acima para completar."