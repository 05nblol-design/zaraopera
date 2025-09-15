# Guia de Deploy - Sistema ZARA para Railway

## 📋 Pré-requisitos

- Conta no GitHub
- Conta no Railway (https://railway.app)
- Git instalado localmente
- Código já preparado e commitado localmente

## 🚀 Passo 1: Criar Repositório no GitHub

### 1.1 Via Interface Web (Recomendado)
1. Acesse https://github.com
2. Clique em "New repository" (botão verde)
3. Configure o repositório:
   - **Repository name:** `zara-operacao-system`
   - **Description:** `Sistema de Operação ZARA - Controle de Produção Industrial`
   - **Visibility:** Public ou Private (sua escolha)
   - **NÃO** marque "Initialize this repository with a README"
4. Clique em "Create repository"

### 1.2 Conectar Repositório Local
Após criar o repositório, execute no terminal:

```bash
# Adicionar remote origin
git remote add origin https://github.com/SEU_USUARIO/zara-operacao-system.git

# Push do código
git push -u origin main
```

## 🚂 Passo 2: Deploy no Railway

### 2.1 Configurar Projeto no Railway
1. Acesse https://railway.app
2. Faça login com sua conta
3. Clique em "New Project"
4. Selecione "Deploy from GitHub repo"
5. Conecte sua conta GitHub se necessário
6. Selecione o repositório `zara-operacao-system`

### 2.2 Configurar Banco PostgreSQL
1. No dashboard do projeto, clique em "+ New"
2. Selecione "Database" → "PostgreSQL"
3. Aguarde a criação do banco
4. Anote a variável `DATABASE_URL` gerada

### 2.3 Configurar Redis
1. No dashboard do projeto, clique em "+ New"
2. Selecione "Database" → "Redis"
3. Aguarde a criação do Redis
4. Anote a variável `REDIS_URL` gerada

### 2.4 Configurar Variáveis de Ambiente

#### Para o Backend (zara-backend):
```env
# Essenciais
NODE_ENV=production
PORT=$PORT
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=seu_refresh_secret_super_seguro_aqui
JWT_REFRESH_EXPIRES_IN=7d

# URLs (Railway irá preencher automaticamente)
FRONTEND_URL=https://$RAILWAY_STATIC_URL
CLIENT_URL=https://$RAILWAY_STATIC_URL
SERVER_URL=https://$RAILWAY_STATIC_URL

# Email (Configure com seus dados)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app
EMAIL_FROM=seu_email@gmail.com

# Firebase (Configure com seus dados)
FIREBASE_PROJECT_ID=seu_projeto_firebase
FIREBASE_PRIVATE_KEY=sua_chave_privada_firebase
FIREBASE_CLIENT_EMAIL=seu_email_firebase

# Sentry (Opcional)
SENTRY_DSN=sua_dsn_sentry

# Configurações Railway
RAILWAY_ENVIRONMENT=production
TZ=America/Sao_Paulo
```

#### Para o Frontend (zara-frontend):
```env
# Essenciais
NODE_ENV=production
PORT=$PORT

# Vite
VITE_API_URL=https://$RAILWAY_STATIC_URL/api
VITE_SOCKET_URL=https://$RAILWAY_STATIC_URL
VITE_BUILD_MODE=production
VITE_APP_TITLE=Sistema ZARA - Produção

# Firebase (mesmo do backend)
VITE_FIREBASE_API_KEY=sua_api_key_firebase
VITE_FIREBASE_AUTH_DOMAIN=seu_dominio_firebase
VITE_FIREBASE_PROJECT_ID=seu_projeto_firebase

# Sentry (Opcional)
VITE_SENTRY_DSN=sua_dsn_sentry

# Timezone
TZ=America/Sao_Paulo
```

### 2.5 Configurar Domínios Customizados (Opcional)
1. No dashboard do Railway, clique no serviço
2. Vá para a aba "Settings"
3. Em "Domains", clique em "Generate Domain" ou "Custom Domain"
4. Configure seu domínio personalizado se desejar

## 🔧 Passo 3: Monitoramento e Testes

### 3.1 Verificar Deploy
1. Aguarde o build e deploy completarem
2. Acesse as URLs geradas pelo Railway
3. Teste os health checks:
   - Backend: `https://seu-backend.railway.app/api/health`
   - Frontend: `https://seu-frontend.railway.app`

### 3.2 Verificar Logs
1. No dashboard do Railway, clique no serviço
2. Vá para a aba "Logs"
3. Monitore os logs para identificar possíveis erros

### 3.3 Testar Funcionalidades
1. Acesse o sistema via frontend
2. Teste login com usuário admin
3. Verifique se todas as funcionalidades estão operando
4. Teste conexões WebSocket
5. Verifique uploads de arquivos

## 🚨 Solução de Problemas

### Build Falha
- Verifique os logs de build no Railway
- Confirme se todas as dependências estão no package.json
- Verifique se os comandos de build estão corretos

### Erro de Conexão com Banco
- Verifique se a variável DATABASE_URL está configurada
- Confirme se o PostgreSQL está rodando
- Verifique as configurações de rede

### Frontend não Carrega
- Verifique se o build do frontend foi bem-sucedido
- Confirme se as variáveis VITE_* estão configuradas
- Verifique se a URL do backend está correta

### WebSocket não Funciona
- Verifique se o VITE_SOCKET_URL está correto
- Confirme se o servidor está aceitando conexões WebSocket
- Verifique logs do servidor para erros de Socket.IO

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no Railway
2. Consulte a documentação do Railway
3. Verifique se todas as variáveis de ambiente estão configuradas
4. Teste localmente primeiro para isolar problemas

## ✅ Checklist Final

- [ ] Repositório GitHub criado e código enviado
- [ ] Projeto Railway configurado
- [ ] PostgreSQL configurado
- [ ] Redis configurado
- [ ] Variáveis de ambiente configuradas
- [ ] Backend deployado com sucesso
- [ ] Frontend deployado com sucesso
- [ ] Health checks funcionando
- [ ] Sistema acessível via web
- [ ] Login funcionando
- [ ] Funcionalidades principais testadas
- [ ] Domínios configurados (se aplicável)

---

**🎉 Parabéns! Seu Sistema ZARA está agora rodando em produção no Railway!**