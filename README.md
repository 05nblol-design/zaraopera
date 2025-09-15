# Sistema ZARA - Gestão Operacional

Sistema completo de gestão operacional com React frontend e Node.js backend.

## 🚀 Deploy no Railway

Este projeto está configurado para deploy automático no Railway.

### Pré-requisitos

1. Conta no [Railway](https://railway.app)
2. Repositório no GitHub
3. Banco de dados PostgreSQL (Railway fornece automaticamente)

### Passos para Deploy

#### 1. **Preparar o Repositório GitHub**
```bash
# Execute o script de deploy (recomendado)
./deploy.sh

# OU manualmente:
git init
git add .
git commit -m "Initial commit - Sistema ZARA"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/zara-operacao-system.git
git push -u origin main
```

#### 2. **Configurar Railway**
1. Acesse [Railway](https://railway.app) e faça login
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha o repositório `zara-operacao-system`
5. Railway detectará automaticamente o `railway.toml`

#### 3. **Adicionar Serviços de Banco de Dados**
1. No dashboard do projeto, clique em **"+ New"**
2. Adicione **PostgreSQL** (para o banco principal)
3. Adicione **Redis** (para cache e sessões)

#### 4. **Configurar Variáveis de Ambiente**
No Railway, vá em Settings > Variables e adicione:

**Variáveis Obrigatórias:**
```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=sua_chave_jwt_muito_segura_aqui
REDIS_URL=${{Redis.REDIS_URL}}
```

**Variáveis Opcionais (para funcionalidades completas):**
```env
SENDGRID_API_KEY=sua_api_key_sendgrid
FIREBASE_PROJECT_ID=seu_projeto_firebase
FIREBASE_PRIVATE_KEY=sua_chave_privada_firebase
FIREBASE_CLIENT_EMAIL=seu_email_firebase
SENTRY_DSN=sua_dsn_sentry
```

#### 5. **Deploy Automático**
- O Railway fará deploy automático de ambos os serviços
- Backend: `server/` (Node.js + Express)
- Frontend: `frontend/` (React + Vite)
- Aguarde alguns minutos para o build completar

#### 6. **Acessar a Aplicação**
- Backend: `https://seu-backend.railway.app`
- Frontend: `https://seu-frontend.railway.app`
- URLs serão fornecidas no dashboard do Railway

## 📁 Estrutura do Projeto

```
├── frontend/          # React + Vite + Tailwind CSS
├── server/           # Node.js + Express + PostgreSQL
├── railway.toml      # Configuração do Railway
└── README.md
```

## 🛠️ Tecnologias

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Query
- React Hook Form

### Backend
- Node.js
- Express
- PostgreSQL
- Redis
- JWT Authentication
- Socket.io

## 🔧 Desenvolvimento Local

### Backend
```bash
cd server
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📝 Licença

Este projeto é privado e proprietário.