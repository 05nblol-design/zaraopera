# Script de Deploy Automatizado para Railway
# Sistema ZARA - Operação Industrial

Write-Host "🚀 Iniciando processo de deploy para Railway..." -ForegroundColor Green
Write-Host "" 

# Função para verificar se um comando existe
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Verificar pré-requisitos
Write-Host "📋 Verificando pré-requisitos..." -ForegroundColor Yellow

if (-not (Test-Command "git")) {
    Write-Host "❌ Git não encontrado. Instale o Git primeiro." -ForegroundColor Red
    exit 1
}

if (-not (Test-Command "node")) {
    Write-Host "❌ Node.js não encontrado. Instale o Node.js primeiro." -ForegroundColor Red
    exit 1
}

if (-not (Test-Command "npm")) {
    Write-Host "❌ NPM não encontrado. Instale o NPM primeiro." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Pré-requisitos verificados com sucesso!" -ForegroundColor Green
Write-Host ""

# Verificar se estamos no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Arquivo package.json não encontrado. Execute este script na raiz do projeto." -ForegroundColor Red
    exit 1
}

# Verificar status do Git
Write-Host "📦 Verificando status do repositório Git..." -ForegroundColor Yellow

$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️ Existem alterações não commitadas:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    $commit = Read-Host "Deseja fazer commit das alterações? (s/N)"
    if ($commit -eq "s" -or $commit -eq "S") {
        $message = Read-Host "Digite a mensagem do commit"
        if (-not $message) {
            $message = "Deploy: Atualizações para produção"
        }
        git add .
        git commit -m $message
        Write-Host "✅ Commit realizado com sucesso!" -ForegroundColor Green
    }
}

# Verificar se existe remote origin
$remoteOrigin = git remote get-url origin 2>$null
if (-not $remoteOrigin) {
    Write-Host "⚠️ Remote 'origin' não configurado." -ForegroundColor Yellow
    Write-Host "📋 Siga estas etapas para configurar o GitHub:" -ForegroundColor Cyan
    Write-Host "1. Crie um repositório no GitHub: https://github.com/new" -ForegroundColor White
    Write-Host "2. Nome sugerido: zara-operacao-system" -ForegroundColor White
    Write-Host "3. NÃO inicialize com README" -ForegroundColor White
    Write-Host ""
    $repoUrl = Read-Host "Cole a URL do repositório GitHub (ex: https://github.com/usuario/repo.git)"
    if ($repoUrl) {
        git remote add origin $repoUrl
        Write-Host "✅ Remote origin configurado!" -ForegroundColor Green
    } else {
        Write-Host "❌ URL não fornecida. Configure manualmente depois." -ForegroundColor Red
    }
}

# Push para GitHub
if ($remoteOrigin -or $repoUrl) {
    Write-Host "📤 Enviando código para GitHub..." -ForegroundColor Yellow
    try {
        git push -u origin main
        Write-Host "✅ Código enviado para GitHub com sucesso!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Erro ao enviar para GitHub. Verifique suas credenciais." -ForegroundColor Yellow
        Write-Host "Você pode fazer o push manualmente depois." -ForegroundColor White
    }
}

Write-Host ""
Write-Host "🚂 Próximos passos para Railway:" -ForegroundColor Cyan
Write-Host "1. Acesse: https://railway.app" -ForegroundColor White
Write-Host "2. Clique em 'New Project'" -ForegroundColor White
Write-Host "3. Selecione 'Deploy from GitHub repo'" -ForegroundColor White
Write-Host "4. Escolha seu repositório: zara-operacao-system" -ForegroundColor White
Write-Host "5. Adicione PostgreSQL: + New → Database → PostgreSQL" -ForegroundColor White
Write-Host "6. Adicione Redis: + New → Database → Redis" -ForegroundColor White
Write-Host ""

Write-Host "📋 Variáveis de ambiente essenciais:" -ForegroundColor Cyan
Write-Host "Backend (zara-backend):" -ForegroundColor White
Write-Host "- NODE_ENV=production" -ForegroundColor Gray
Write-Host "- JWT_SECRET=seu_jwt_secret_aqui" -ForegroundColor Gray
Write-Host "- EMAIL_HOST, EMAIL_USER, EMAIL_PASS" -ForegroundColor Gray
Write-Host "- FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL" -ForegroundColor Gray
Write-Host ""
Write-Host "Frontend (zara-frontend):" -ForegroundColor White
Write-Host "- NODE_ENV=production" -ForegroundColor Gray
Write-Host "- VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN" -ForegroundColor Gray
Write-Host ""

# Verificar arquivos de configuração
Write-Host "🔍 Verificando arquivos de configuração..." -ForegroundColor Yellow

$configFiles = @(
    "railway.toml",
    "server/.env.production",
    "frontend/.env.production",
    "DEPLOY_GUIDE.md"
)

foreach ($file in $configFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file (faltando)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📖 Para instruções detalhadas, consulte: DEPLOY_GUIDE.md" -ForegroundColor Cyan
Write-Host ""

# Testar build local (opcional)
$testBuild = Read-Host "Deseja testar o build localmente antes do deploy? (s/N)"
if ($testBuild -eq "s" -or $testBuild -eq "S") {
    Write-Host "🔨 Testando build do backend..." -ForegroundColor Yellow
    Set-Location server
    npm install --production
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build do backend OK" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no build do backend" -ForegroundColor Red
    }
    Set-Location ..
    
    Write-Host "🔨 Testando build do frontend..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    npm run build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Build do frontend OK" -ForegroundColor Green
    } else {
        Write-Host "❌ Erro no build do frontend" -ForegroundColor Red
    }
    Set-Location ..
}

Write-Host ""
Write-Host "🎉 Preparação concluída!" -ForegroundColor Green
Write-Host "Agora siga as instruções no Railway para completar o deploy." -ForegroundColor White
Write-Host ""
Write-Host "📞 Em caso de problemas:" -ForegroundColor Cyan
Write-Host "1. Verifique os logs no Railway" -ForegroundColor White
Write-Host "2. Consulte DEPLOY_GUIDE.md" -ForegroundColor White
Write-Host "3. Teste localmente primeiro" -ForegroundColor White
Write-Host ""

Pause