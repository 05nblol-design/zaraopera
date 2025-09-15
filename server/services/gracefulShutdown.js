const LoggerService = require('./loggerService');
const pool = require('../config/database');
const { getRedisClient } = require('../config/redis');
const auditLogger = require('./auditLogger');

class GracefulShutdown {
  constructor() {
    this.isShuttingDown = false;
    this.shutdownTimeout = 30000; // 30 segundos
    this.activeConnections = new Set();
    this.server = null;
    this.io = null;
  }

  /**
   * Configura o servidor e socket.io para shutdown graceful
   */
  setup(server, io) {
    this.server = server;
    this.io = io;

    // Rastrear conexões ativas
    server.on('connection', (socket) => {
      this.activeConnections.add(socket);
      socket.on('close', () => {
        this.activeConnections.delete(socket);
      });
    });

    // Configurar handlers de sinais
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGUSR2', () => this.handleShutdown('SIGUSR2')); // Para nodemon

    LoggerService.info('Graceful shutdown configurado', { component: 'GRACEFUL_SHUTDOWN' });
  }

  /**
   * Manipula o processo de shutdown
   */
  async handleShutdown(signal) {
    if (this.isShuttingDown) {
      LoggerService.warn(`Sinal ${signal} recebido durante shutdown em andamento`, {
        component: 'GRACEFUL_SHUTDOWN'
      });
      return;
    }

    this.isShuttingDown = true;
    LoggerService.info(`Iniciando shutdown graceful devido ao sinal ${signal}`, {
      component: 'GRACEFUL_SHUTDOWN',
      signal,
      activeConnections: this.activeConnections.size
    });

    // Log de auditoria do shutdown
    try {
      await auditLogger.logSystemEvent({
        event: 'SHUTDOWN_INITIATED',
        component: 'SERVER',
        level: 'INFO',
        message: `Shutdown graceful iniciado por ${signal}`,
        metadata: {
          signal,
          timestamp: new Date().toISOString(),
          activeConnections: this.activeConnections.size
        }
      });
    } catch (error) {
      LoggerService.error('Erro ao registrar evento de shutdown', error, {
        component: 'GRACEFUL_SHUTDOWN'
      });
    }

    // Configurar timeout de emergência
    const forceExitTimer = setTimeout(() => {
      LoggerService.error('Timeout de shutdown atingido, forçando saída', null, {
        component: 'GRACEFUL_SHUTDOWN',
        timeout: this.shutdownTimeout
      });
      process.exit(1);
    }, this.shutdownTimeout);

    try {
      // 1. Parar de aceitar novas conexões
      await this.stopAcceptingConnections();

      // 2. Fechar conexões WebSocket
      await this.closeWebSocketConnections();

      // 3. Aguardar requisições ativas terminarem
      await this.waitForActiveRequests();

      // 4. Fechar conexões de banco de dados
      await this.closeDatabaseConnections();

      // 5. Fechar conexão Redis
      await this.closeRedisConnection();

      // 6. Fechar sistema de auditoria
      await this.closeAuditSystem();

      // 7. Fechar servidor HTTP
      await this.closeHttpServer();

      clearTimeout(forceExitTimer);
      LoggerService.info('Shutdown graceful concluído com sucesso', {
        component: 'GRACEFUL_SHUTDOWN'
      });
      
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      LoggerService.error('Erro durante shutdown graceful', error, {
        component: 'GRACEFUL_SHUTDOWN'
      });
      process.exit(1);
    }
  }

  /**
   * Para de aceitar novas conexões
   */
  async stopAcceptingConnections() {
    return new Promise((resolve) => {
      if (this.server && this.server.listening) {
        this.server.close(() => {
          LoggerService.info('Servidor parou de aceitar novas conexões', {
            component: 'GRACEFUL_SHUTDOWN'
          });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Fecha conexões WebSocket
   */
  async closeWebSocketConnections() {
    if (this.io) {
      LoggerService.info('Fechando conexões WebSocket', {
        component: 'GRACEFUL_SHUTDOWN',
        connectedSockets: this.io.engine.clientsCount
      });

      // Notificar clientes sobre o shutdown
      this.io.emit('server_shutdown', {
        message: 'Servidor entrando em manutenção',
        timestamp: new Date().toISOString()
      });

      // Aguardar um pouco para a mensagem ser enviada
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Fechar todas as conexões
      this.io.close();
      LoggerService.info('Conexões WebSocket fechadas', {
        component: 'GRACEFUL_SHUTDOWN'
      });
    }
  }

  /**
   * Aguarda requisições ativas terminarem
   */
  async waitForActiveRequests() {
    const maxWait = 10000; // 10 segundos
    const startTime = Date.now();

    while (this.activeConnections.size > 0 && (Date.now() - startTime) < maxWait) {
      LoggerService.info(`Aguardando ${this.activeConnections.size} conexões ativas terminarem`, {
        component: 'GRACEFUL_SHUTDOWN'
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (this.activeConnections.size > 0) {
      LoggerService.warn(`Forçando fechamento de ${this.activeConnections.size} conexões restantes`, {
        component: 'GRACEFUL_SHUTDOWN'
      });
      
      // Forçar fechamento das conexões restantes
      this.activeConnections.forEach(socket => {
        socket.destroy();
      });
    }
  }

  /**
   * Fecha conexões do banco de dados
   */
  async closeDatabaseConnections() {
    try {
      if (pool) {
        LoggerService.info('Fechando pool de conexões do banco de dados', {
          component: 'GRACEFUL_SHUTDOWN'
        });
        await pool.end();
        LoggerService.info('Pool de conexões do banco fechado', {
          component: 'GRACEFUL_SHUTDOWN'
        });
      }
    } catch (error) {
      LoggerService.error('Erro ao fechar conexões do banco', error, {
        component: 'GRACEFUL_SHUTDOWN'
      });
      throw error;
    }
  }

  /**
   * Fecha conexão Redis
   */
  async closeRedisConnection() {
    try {
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isOpen) {
        LoggerService.info('Fechando conexão Redis', {
          component: 'GRACEFUL_SHUTDOWN'
        });
        await redisClient.quit();
        LoggerService.info('Conexão Redis fechada', {
          component: 'GRACEFUL_SHUTDOWN'
        });
      }
    } catch (error) {
      LoggerService.error('Erro ao fechar conexão Redis', error, {
        component: 'GRACEFUL_SHUTDOWN'
      });
      throw error;
    }
  }

  /**
   * Fecha sistema de auditoria
   */
  async closeAuditSystem() {
    try {
      LoggerService.info('Fechando sistema de auditoria', {
        component: 'GRACEFUL_SHUTDOWN'
      });
      await auditLogger.close();
      LoggerService.info('Sistema de auditoria fechado', {
        component: 'GRACEFUL_SHUTDOWN'
      });
    } catch (error) {
      LoggerService.error('Erro ao fechar sistema de auditoria', error, {
        component: 'GRACEFUL_SHUTDOWN'
      });
      // Não relançar o erro para não impedir o shutdown
    }
  }

  /**
   * Fecha servidor HTTP
   */
  async closeHttpServer() {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((error) => {
          if (error) {
            LoggerService.error('Erro ao fechar servidor HTTP', error, {
              component: 'GRACEFUL_SHUTDOWN'
            });
            reject(error);
          } else {
            LoggerService.info('Servidor HTTP fechado', {
              component: 'GRACEFUL_SHUTDOWN'
            });
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Verifica se o shutdown está em andamento
   */
  isShutdownInProgress() {
    return this.isShuttingDown;
  }

  /**
   * Middleware para rejeitar novas requisições durante shutdown
   */
  getShutdownMiddleware() {
    return (req, res, next) => {
      if (this.isShuttingDown) {
        res.status(503).json({
          success: false,
          message: 'Servidor em processo de shutdown',
          code: 'SERVER_SHUTTING_DOWN',
          timestamp: new Date().toISOString()
        });
        return;
      }
      next();
    };
  }
}

module.exports = new GracefulShutdown();