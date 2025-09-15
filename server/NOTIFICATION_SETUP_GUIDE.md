# 🔔 Guia de Configuração de Notificações - Sistema ZARA

## 📋 Status Atual

❌ **Email**: Não configurado  
❌ **Push**: Não configurado  
⚠️ **Sistema funcionando apenas com notificações internas**

## 📧 Configuração de Email (Nodemailer)

### Opção 1: Gmail (Recomendado)

1. **Ativar autenticação de 2 fatores** na sua conta Google
2. **Gerar senha de app**:
   - Acesse: https://myaccount.google.com/security
   - Vá em "Senhas de app"
   - Selecione "Email" e "Outro (nome personalizado)"
   - Digite "Sistema ZARA" e gere a senha

3. **Adicionar no arquivo .env**:
```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_de_app_gerada
EMAIL_FROM=noreply@zara-operacao.com
```

### Opção 2: Outros provedores

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=seu_email@outlook.com
SMTP_PASS=sua_senha
```

**Yahoo:**
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=seu_email@yahoo.com
SMTP_PASS=sua_senha_de_app
```

## 📱 Configuração de Push Notifications (Firebase)

### 1. Criar projeto Firebase

1. Acesse: https://console.firebase.google.com/
2. Clique em "Adicionar projeto"
3. Digite "zara-operacao" como nome
4. Desabilite Google Analytics (opcional)
5. Clique em "Criar projeto"

### 2. Configurar Cloud Messaging

1. No console Firebase, vá em "Project Settings" (⚙️)
2. Aba "Cloud Messaging"
3. Anote o **Server Key** (será usado depois)

### 3. Gerar credenciais de serviço

1. Vá em "Project Settings" > "Service accounts"
2. Clique em "Generate new private key"
3. Baixe o arquivo JSON
4. Abra o arquivo e copie as informações

### 4. Adicionar no arquivo .env

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=zara-operacao-xxxxx
FIREBASE_PRIVATE_KEY_ID=sua_private_key_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_PRIVADA_COMPLETA_AQUI\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@zara-operacao-xxxxx.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=sua_client_id
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40zara-operacao-xxxxx.iam.gserviceaccount.com
```

## 🔧 Configurações Adicionais

### Habilitar notificações no .env

```env
# Notification Settings
NOTIFICATIONS_ENABLED=true
EMAIL_NOTIFICATIONS=true
PUSH_NOTIFICATIONS=true

# URLs
FRONTEND_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:3001
```

### Configurar agendador de tarefas

```env
# Scheduler
SCHEDULER_ENABLED=true
DAILY_REPORT_TIME=18:00
TEFLON_CHECK_INTERVAL=6
```

## 🧪 Testar Configurações

Após configurar, execute:

```bash
# Verificar configurações
node check-notification-config.js

# Testar sistema de notificações
node test-notifications.js
```

## 📊 Tipos de Notificações Disponíveis

### 📧 Email
- ✅ Mudanças de status de máquina
- ✅ Relatórios diários
- ✅ Alertas de vencimento de teflon
- ✅ Testes de qualidade reprovados
- ✅ Alertas de manutenção

### 📱 Push (Navegador)
- ✅ Notificações em tempo real
- ✅ Alertas críticos
- ✅ Status de máquinas
- ✅ Lembretes de tarefas

### 🔔 Sistema (Interno)
- ✅ Notificações na interface
- ✅ Centro de notificações
- ✅ Histórico de alertas

## 🚨 Solução de Problemas

### Email não funciona
1. Verifique se a senha de app está correta
2. Confirme se a autenticação de 2 fatores está ativa
3. Teste com outro provedor de email
4. Verifique logs do servidor para erros específicos

### Push não funciona
1. Verifique se todas as credenciais Firebase estão corretas
2. Confirme se o projeto Firebase tem Cloud Messaging habilitado
3. Teste se o navegador permite notificações
4. Verifique se o service worker está registrado

### Logs úteis
```bash
# Ver logs do servidor
pm2 logs zara-server

# Ver logs em tempo real
tail -f logs/app.log
```

## 📝 Exemplo de .env Completo

```env
# Servidor
NODE_ENV=development
PORT=3001

# Banco de dados
MONGODB_URI=mongodb://localhost:27017/zara-operacao
DATABASE_URL=mongodb://localhost:27017/zara-operacao

# JWT
JWT_SECRET=zara-jwt-secret-key-2024
JWT_EXPIRES_IN=7d

# URLs
CLIENT_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173
SERVER_URL=http://localhost:3001

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_de_app
EMAIL_FROM=noreply@zara-operacao.com

# Firebase
FIREBASE_PROJECT_ID=zara-operacao-xxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@projeto.iam.gserviceaccount.com

# Notificações
NOTIFICATIONS_ENABLED=true
EMAIL_NOTIFICATIONS=true
PUSH_NOTIFICATIONS=true

# Agendador
SCHEDULER_ENABLED=true
DAILY_REPORT_TIME=18:00
TEFLON_CHECK_INTERVAL=6

# Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# Sentry (opcional)
SENTRY_DSN=
```

---

**📞 Suporte**: Para dúvidas sobre configuração, consulte a documentação do projeto ou entre em contato com a equipe de desenvolvimento.