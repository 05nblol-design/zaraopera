# 🚀 Guia de Deploy no Vercel - Sistema ZARA

Este guia explica como fazer o deploy do Sistema ZARA no Vercel usando PostgreSQL do Railway.

## 📋 Pré-requisitos

- [ ] Conta no [Vercel](https://vercel.com)
- [ ] Conta no [Railway](https://railway.app) 
- [ ] Repositório GitHub com o código
- [ ] PostgreSQL configurado no Railway

## 🗄️ 1. Configurar Banco de Dados no Railway

### 1.1 Criar Projeto no Railway
```bash
# Fazer login no Railway
railway login

# Criar novo projeto
railway init
```

### 1.2 Adicionar PostgreSQL
1. Acesse o dashboard do Railway
2. Clique em "+ New Service"
3. Selecione "Database" → "PostgreSQL"
4. Aguarde a criação do banco

### 1.3 Obter URL de Conexão
1. Clique no serviço PostgreSQL
2. Vá para a aba "Connect"
3. Copie a `DATABASE_URL`

## 🌐 2. Deploy no Vercel

### 2.1 Conectar Repositório
1. Acesse [vercel.com](https://vercel.com)
2. Clique em "New Project"
3. Conecte seu repositório GitHub
4. Selecione o repositório do Sistema ZARA

### 2.2 Configurar Build Settings
- **Framework Preset**: Other
- **Root Directory**: `./` (raiz do projeto)
- **Build Command**: `npm run build` (será configurado automaticamente pelo vercel.json)
- **Output Directory**: `dist` (será configurado automaticamente)

### 2.3 Configurar Variáveis de Ambiente

Na seção "Environment Variables" do Vercel, adicione:

#### 🔧 Variáveis Essenciais
```env
# Ambiente
NODE_ENV=production
PORT=3000

# Banco de Dados (Railway)
DATABASE_URL=postgresql://username:password@hostname:port/database

# Autenticação
JWT_SECRET=seu_jwt_secret_muito_seguro_aqui
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://seu-projeto.vercel.app

# Frontend (VITE)
VITE_API_URL=https://seu-projeto.vercel.app/api
VITE_SOCKET_URL=https://seu-projeto.vercel.app
VITE_APP_TITLE=Sistema ZARA - Operações
```

#### 📧 Email (Opcional)
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=sua_api_key_sendgrid
EMAIL_FROM=noreply@seu-dominio.com
```

#### 🔥 Firebase (Opcional)
```env
FIREBASE_PROJECT_ID=seu-projeto-firebase
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@seu-projeto.iam.gserviceaccount.com

VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
```

### 2.4 Deploy
1. Clique em "Deploy"
2. Aguarde o build e deploy
3. Acesse a URL fornecida pelo Vercel

## ⚙️ 3. Configurações Pós-Deploy

### 3.1 Configurar Domínio (Opcional)
1. Na dashboard do Vercel, vá para "Settings" → "Domains"
2. Adicione seu domínio personalizado
3. Configure os DNS conforme instruções

### 3.2 Atualizar CORS
Após obter a URL final do Vercel, atualize as variáveis:
```env
CORS_ORIGIN=https://sua-url-final.vercel.app
VITE_API_URL=https://sua-url-final.vercel.app/api
VITE_SOCKET_URL=https://sua-url-final.vercel.app
```

### 3.3 Testar Funcionalidades
- [ ] Login/Logout
- [ ] Conexão com banco de dados
- [ ] WebSocket (tempo real)
- [ ] Upload de arquivos
- [ ] Notificações

## 🔧 4. Estrutura de Arquivos Importantes

```
├── vercel.json              # Configuração do Vercel
├── .env.vercel.example      # Exemplo de variáveis
├── frontend/
│   ├── dist/               # Build do frontend (gerado)
│   └── package.json        # Dependências do frontend
├── server/
│   ├── index.js           # Servidor principal
│   └── config/
│       └── database.js    # Configuração do banco
└── package.json           # Dependências principais
```

## 🚨 5. Troubleshooting

### Erro de Build
```bash
# Testar build localmente
npm run build

# Verificar logs no Vercel
# Dashboard → Project → Functions → View Logs
```

### Erro de Conexão com Banco
1. Verificar `DATABASE_URL` no Railway
2. Confirmar variáveis no Vercel
3. Testar conexão local:
```bash
psql $DATABASE_URL
```

### Erro de CORS
1. Verificar `CORS_ORIGIN` nas variáveis
2. Confirmar domínio correto
3. Verificar logs do servidor

### WebSocket não funciona
1. Verificar `VITE_SOCKET_URL`
2. Confirmar configuração no `vercel.json`
3. Testar em ambiente local

## 📊 6. Monitoramento

### Logs do Vercel
- Dashboard → Project → Functions → View Logs
- Real-time logs durante desenvolvimento

### Métricas
- Dashboard → Project → Analytics
- Performance, errors, usage

### Railway Logs
- Dashboard Railway → PostgreSQL → Logs
- Monitorar conexões e queries

## 🔄 7. Atualizações

### Deploy Automático
O Vercel faz deploy automático a cada push na branch principal.

### Deploy Manual
```bash
# Via CLI do Vercel
npm i -g vercel
vercel --prod
```

### Rollback
1. Dashboard → Project → Deployments
2. Selecionar versão anterior
3. Clicar em "Promote to Production"

## 📝 8. Checklist Final

- [ ] ✅ Projeto criado no Vercel
- [ ] ✅ PostgreSQL configurado no Railway
- [ ] ✅ Variáveis de ambiente configuradas
- [ ] ✅ Build executado com sucesso
- [ ] ✅ Deploy realizado
- [ ] ✅ Aplicação acessível via URL
- [ ] ✅ Login funcionando
- [ ] ✅ Banco de dados conectado
- [ ] ✅ WebSocket funcionando
- [ ] ✅ CORS configurado corretamente

## 🆘 Suporte

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **PostgreSQL Docs**: https://www.postgresql.org/docs/

---

**Desenvolvido para Sistema ZARA v1.0.1**  
*Última atualização: Janeiro 2025*