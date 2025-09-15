const LoggerService = require('../services/loggerService');
const { getConnectionStatus: getDBStatus } = require('../config/database');
const { getRedisStatus } = require('../config/redis');
const gracefulShutdown = require('../services/gracefulShutdown');

/**
 * Middleware global para capturar erros não tratados e implementar fallbacks
 */
class GlobalErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.lastErrorTime = null;
    this.maxErrorsPerMinute = 50;
    this.circuitBreakerThreshold = 10;
    this.circuitBreakerTimeout = 60000; // 1 minuto
    this.isCircuitOpen = false;
    this.lastCircuitOpenTime = null;
  }

  /**
   * Inicializa os handlers globais de erro
   */
  initialize() {
    // Handler para exceções não capturadas
    process.on('uncaughtException', (error) => {
      this.handleCriticalError('UNCAUGHT_EXCEPTION', error);
    });

    // Handler para promises rejeitadas não tratadas
    process.on('unhandledRejection', (reason, promise) => {
      this.handleCriticalError('UNHANDLED_REJECTION', reason, { promise });
    });

    // Handler para avisos
    process.on('warning', (warning) => {
      LoggerService.warn('Node.js warning detectado', {
        component: 'GLOBAL_ERROR_HANDLER',
        warning: {
          name: warning.name,
          message: warning.message,
          stack: warning.stack
        }
      });
    });

    LoggerService.info('Global Error Handler inicializado', {
      component: 'GLOBAL_ERROR_HANDLER'
    });
  }

  /**
   * Manipula erros críticos do sistema
   */
  handleCriticalError(type, error, metadata = {}) {
    const errorInfo = {
      type,
      message: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...metadata
    };

    LoggerService.critical(`Erro crítico detectado: ${type}`, error, {
      component: 'GLOBAL_ERROR_HANDLER',
      errorType: type,
      ...metadata
    });

    // Verificar circuit breaker
    this.updateErrorCount();
    
    if (this.shouldTriggerCircuitBreaker()) {
      this.openCircuitBreaker();
    }

    // Para exceções não capturadas, tentar shutdown graceful
    if (type === 'UNCAUGHT_EXCEPTION') {
      LoggerService.critical('Iniciando shutdown de emergência devido a exceção não capturada', error, {
        component: 'GLOBAL_ERROR_HANDLER'
      });
      
      // Dar um tempo para logs serem escritos
      setTimeout(() => {
        if (!gracefulShutdown.isShutdownInProgress()) {
          process.exit(1);
        }
      }, 1000);
    }
  }

  /**
   * Middleware para monitorar saúde das conexões
   */
  getHealthCheckMiddleware() {
    return async (req, res, next) => {
      // Verificar se o circuit breaker está aberto
      if (this.isCircuitBreakerOpen()) {
        return res.status(503).json({
          success: false,
          message: 'Serviço temporariamente indisponível - Circuit Breaker ativo',
          code: 'CIRCUIT_BREAKER_OPEN',
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil((this.circuitBreakerTimeout - (Date.now() - this.lastCircuitOpenTime)) / 1000)
        });
      }

      // Verificar status das conexões críticas
      const dbStatus = getDBStatus();
      const redisStatus = getRedisStatus();

      // Se banco estiver offline, implementar fallback
      if (!dbStatus.connected) {
        LoggerService.warn('Banco de dados offline - implementando fallback', {
          component: 'GLOBAL_ERROR_HANDLER',
          url: req.url,
          method: req.method
        });

        // Adicionar flag para indicar modo fallback
        req.fallbackMode = {
          database: true,
          reason: 'Database connection lost'
        };
      }

      // Se Redis estiver offline, continuar sem cache (não crítico)
      if (!redisStatus.connected) {
        LoggerService.info('Redis offline - operando com cache em memória', {
          component: 'GLOBAL_ERROR_HANDLER',
          url: req.url,
          method: req.method,
          fallbackCacheSize: redisStatus.fallbackCacheSize || 0
        });

        req.fallbackMode = req.fallbackMode || {};
        req.fallbackMode.redis = true;
      }

      next();
    };
  }

  /**
   * Middleware de timeout removido - sistema sem limites de tempo por usuário
   * As requisições podem levar o tempo necessário para serem processadas
   */
  getTimeoutMiddleware() {
    return (req, res, next) => {
      // Middleware vazio - sem timeout
      next();
    };
  }

  /**
   * Atualiza contador de erros
   */
  updateErrorCount() {
    const now = Date.now();
    
    // Reset contador se passou mais de 1 minuto
    if (!this.lastErrorTime || (now - this.lastErrorTime) > 60000) {
      this.errorCount = 0;
    }
    
    this.errorCount++;
    this.lastErrorTime = now;
  }

  /**
   * Verifica se deve ativar circuit breaker
   */
  shouldTriggerCircuitBreaker() {
    return this.errorCount >= this.circuitBreakerThreshold;
  }

  /**
   * Abre o circuit breaker
   */
  openCircuitBreaker() {
    this.isCircuitOpen = true;
    this.lastCircuitOpenTime = Date.now();
    
    LoggerService.critical('Circuit Breaker ativado devido a muitos erros', null, {
      component: 'GLOBAL_ERROR_HANDLER',
      errorCount: this.errorCount,
      threshold: this.circuitBreakerThreshold
    });

    // Fechar circuit breaker automaticamente após timeout
    setTimeout(() => {
      this.closeCircuitBreaker();
    }, this.circuitBreakerTimeout);
  }

  /**
   * Fecha o circuit breaker
   */
  closeCircuitBreaker() {
    this.isCircuitOpen = false;
    this.errorCount = 0;
    
    LoggerService.info('Circuit Breaker desativado - serviço restaurado', {
      component: 'GLOBAL_ERROR_HANDLER'
    });
  }

  /**
   * Verifica se circuit breaker está aberto
   */
  isCircuitBreakerOpen() {
    if (!this.isCircuitOpen) return false;
    
    // Verificar se timeout expirou
    if (Date.now() - this.lastCircuitOpenTime > this.circuitBreakerTimeout) {
      this.closeCircuitBreaker();
      return false;
    }
    
    return true;
  }

  /**
   * Middleware para adicionar headers de monitoramento
   */
  getMonitoringHeadersMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Log de performance para requests lentos
        if (duration > 5000) {
          LoggerService.warn('Request lento detectado', {
            component: 'GLOBAL_ERROR_HANDLER',
            url: req.url,
            method: req.method,
            duration,
            statusCode: res.statusCode
          });
        }
        
        // Adicionar headers de monitoramento
        res.set({
          'X-Response-Time': `${duration}ms`,
          'X-Request-ID': req.id || req.headers['x-request-id'] || 'unknown',
          'X-Server-Status': this.isCircuitBreakerOpen() ? 'degraded' : 'healthy'
        });
      });
      
      next();
    };
  }

  /**
   * Obtém estatísticas do error handler
   */
  getStats() {
    return {
      errorCount: this.errorCount,
      lastErrorTime: this.lastErrorTime,
      isCircuitOpen: this.isCircuitOpen,
      lastCircuitOpenTime: this.lastCircuitOpenTime,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      connections: {
        database: getDBStatus(),
        redis: getRedisStatus()
      }
    };
  }
}

module.exports = new GlobalErrorHandler();