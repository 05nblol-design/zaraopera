const express = require('express');
// Force restart
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

// Importar configurações
const { connectDB, getConnectionStatus: getDBStatus } = require('./config/database');
const { connectRedis, getRedisStatus } = require('./config/redis');
const { initSentry } = require('./config/sentry');
const HTTPSConfig = require('./config/https');

// Importar rotas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const machineRoutes = require('./routes/machines');
const productionRoutes = require('./routes/production');
const qualityTestRoutes = require('./routes/qualityTests');
const qualityTestConfigRoutes = require('./routes/qualityTestConfig');
const teflonRoutes = require('./routes/teflon');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const uploadRoutes = require('./routes/upload');
const permissionRoutes = require('./routes/permissions');
const specificCasesRoutes = require('./routes/specificCases');
const advancedProductionRoutes = require('./routes/advancedProduction');

// Importar middlewares
const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const {
  authRateLimit,
  apiRateLimit,
  strictRateLimit,
  corsOptions,
  securityHeaders,
  customSecurityHeaders,
  securityLogger,
  attackDetection
} = require('./middleware/security');

// Importar socket handlers
const socketHandler = require('./socket/socketHandler');

// Importar serviços de notificação
const NotificationService = require('./services/notificationService');
const SchedulerService = require('./services/schedulerService');
const RealTimeProductionService = require('./services/realTimeProductionService');
const specificCasesScheduler = require('./services/specificCasesScheduler');
const auditLogger = require('./services/auditLogger');
const metricsService = require('./services/metricsService');
const backupService = require('./services/backupService');
const LoggerService = require('./services/loggerService');
const gracefulShutdown = require('./services/gracefulShutdown');
const globalErrorHandler = require('./middleware/globalErrorHandler');

const app = express();

// Configurar HTTPS
const httpsConfig = new HTTPSConfig();
const httpsServer = httpsConfig.createHTTPSServer(app);
const server = httpsServer || createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || 'http://localhost:5173', 
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173', 
      'http://localhost:5174',
      'https://ecf9e2254007.ngrok-free.app', // URL do ngrok
      'https://understanding-sequence-prep-laden.trycloudflare.com',
      'https://hanging-personality-counts-obtain.trycloudflare.com'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Inicializar Sentry
initSentry(app);

// Inicializar Global Error Handler
globalErrorHandler.initialize();

// Os handlers de erros não capturados são gerenciados pelo globalErrorHandler

// Configurar trust proxy para resolver problemas com X-Forwarded-For
app.set('trust proxy', 1);

// Middleware de redirecionamento HTTPS
app.use(httpsConfig.redirectToHTTPS());

// Rate limiting empresarial já configurado no middleware de segurança

// Middlewares de segurança empresarial
app.use(securityHeaders);
app.use(customSecurityHeaders);
app.use(securityLogger);
app.use(compression());
// Substituir morgan pelo LoggerService
app.use(LoggerService.getRequestLogger());
app.use(cors(corsOptions));
app.use(attackDetection);
app.use('/api', apiRateLimit); // Rate limit geral para todas as rotas
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  abortOnLimit: true,
  createParentPath: true
}));

// Servir arquivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de monitoramento de métricas
app.use(metricsService.getRequestMonitoringMiddleware());

// Conectar ao banco de dados
connectDB();

// Conectar ao Redis para cache distribuído (não bloqueante)
try {
  connectRedis().catch(error => {
    console.warn('⚠️ Redis não disponível, sistema continuará com cache em memória:', error.message);
  });
} catch (error) {
  console.warn('⚠️ Erro ao inicializar Redis, sistema continuará com cache em memória:', error.message);
}

// Configurar Socket.IO
socketHandler(io);

// Configurar Socket.IO no NotificationService para notificações em tempo real
NotificationService.setSocketIO(io);

// Inicializar sistema de auditoria
auditLogger.logSystemEvent({
  event: 'STARTUP',
  component: 'SERVER',
  level: 'INFO',
  message: 'Servidor ZARA iniciado',
  metadata: {
    port: process.env.PORT || 3001,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  }
}).then(() => {
  LoggerService.info('Sistema de auditoria inicializado', { component: 'AUDIT' });
}).catch(error => {
  LoggerService.error('Erro ao inicializar sistema de auditoria', error, { component: 'AUDIT' });
});

// Inicializar serviços de notificação
if (process.env.NOTIFICATIONS_ENABLED === 'true') {
  LoggerService.info('Serviços de notificação habilitados', { component: 'NOTIFICATIONS' });
}

// Inicializar agendador de tarefas
if (process.env.SCHEDULER_ENABLED === 'true') {
  LoggerService.info('Agendador de tarefas habilitado', { component: 'SCHEDULER' });
}

// Inicializar serviço de produção em tempo real
const productionService = new RealTimeProductionService(io);
productionService.start();
LoggerService.info('Serviço de produção em tempo real iniciado', { component: 'PRODUCTION_SERVICE' });

// Inicializar agendador de casos específicos
if (process.env.SPECIFIC_CASES_SCHEDULER_ENABLED !== 'false') {
  specificCasesScheduler.start();
  LoggerService.info('Agendador de casos específicos iniciado', { component: 'SPECIFIC_CASES_SCHEDULER' });
}

// Inicializar serviço de backup automático
if (process.env.BACKUP_ENABLED !== 'false') {
  backupService.start();
  LoggerService.info('Serviço de backup automático iniciado', { component: 'BACKUP_SERVICE' });
}

// Middleware para adicionar io ao req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rotas públicas com rate limiting específico para autenticação
app.use('/api/auth', authRateLimit, authRoutes);

// Rotas protegidas com autenticação robusta
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/machines', authenticateToken, machineRoutes);
app.use('/api/machines/production', authenticateToken, productionRoutes);
app.use('/api/quality-tests', authenticateToken, qualityTestRoutes);
app.use('/api/quality-test-config', authenticateToken, qualityTestConfigRoutes);
app.use('/api/teflon', authenticateToken, teflonRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);
app.use('/api/upload', strictRateLimit, authenticateToken, uploadRoutes); // Rate limit rigoroso para uploads
app.use('/api/permissions', authenticateToken, permissionRoutes);
app.use('/api/specific-cases', authenticateToken, specificCasesRoutes);
app.use('/api/advanced-production', authenticateToken, advancedProductionRoutes);
app.use('/api/shifts', authenticateToken, require('./routes/shifts'));
app.use('/api/alerts', authenticateToken, require('./routes/alerts'));
app.use('/api/audit', authenticateToken, require('./routes/audit'));
app.use('/api/metrics', authenticateToken, require('./routes/metrics'));
app.use('/api/backup', authenticateToken, require('./routes/backup'));

// Rota de health check expandida
app.get('/api/health', (req, res) => {
  const stats = globalErrorHandler.getStats();
  const dbStatus = getDBStatus();
  const redisStatus = getRedisStatus();
  
  const healthStatus = {
    status: stats.isCircuitOpen ? 'DEGRADED' : 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.1',
    environment: process.env.NODE_ENV,
    uptime: stats.uptime,
    connections: {
      database: {
        status: dbStatus.isConnected ? 'connected' : 'disconnected',
        ...dbStatus
      },
      redis: {
        status: redisStatus.isConnected ? 'connected' : 'disconnected',
        ...redisStatus
      }
    },
    performance: {
      errorCount: stats.errorCount,
      lastErrorTime: stats.lastErrorTime,
      circuitBreakerOpen: stats.isCircuitOpen,
      memoryUsage: {
        rss: `${Math.round(stats.memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(stats.memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(stats.memoryUsage.heapTotal / 1024 / 1024)}MB`
      }
    }
  };
  
  const statusCode = healthStatus.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Rota 404 para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

// Middleware de monitoramento global
app.use(globalErrorHandler.getMonitoringHeadersMiddleware());
app.use(globalErrorHandler.getTimeoutMiddleware(30000));
app.use(globalErrorHandler.getHealthCheckMiddleware());

// Middleware de shutdown graceful (deve vir antes do errorHandler)
app.use(gracefulShutdown.getShutdownMiddleware());

// Middleware de tratamento de erros
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', async () => {
  // Configurar shutdown graceful
  gracefulShutdown.setup(server, io);
  
  LoggerService.info(`Servidor ZARA rodando na porta ${PORT}`, {
    component: 'SERVER',
    port: PORT,
    environment: process.env.NODE_ENV,
    healthCheck: `http://0.0.0.0:${PORT}/api/health`
  });
  LoggerService.info('Servidor acessível publicamente em todas as interfaces de rede', { component: 'SERVER' });
  
  // Inicializar status correto das máquinas após inicialização
  try {
    const { fixMachineStatusInitialization } = require('./scripts/fix-machine-status-initialization');
    LoggerService.info('Inicializando status das máquinas...', { component: 'MACHINE_STATUS' });
    await fixMachineStatusInitialization();
    LoggerService.info('Status das máquinas inicializado com sucesso', { component: 'MACHINE_STATUS' });
  } catch (error) {
    LoggerService.error('Erro ao inicializar status das máquinas', error, { component: 'MACHINE_STATUS' });
    // Não falhar a inicialização do servidor por causa disso
  }
});

// Os handlers de shutdown graceful são configurados automaticamente pelo gracefulShutdown.setup()

module.exports = { app, server, io };