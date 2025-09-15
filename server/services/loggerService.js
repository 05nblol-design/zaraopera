const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configuração de formatos personalizados
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Adicionar metadados se existirem
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Configuração do logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: {
    service: 'zara-operacao',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Arquivo para todos os logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Arquivo apenas para erros
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Arquivo para auditoria
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 20,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
  
  // Tratamento de exceções não capturadas
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ],
  
  // Tratamento de rejeições não capturadas
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

// Adicionar console transport apenas em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Logger específico para performance
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Logger específico para segurança
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 15
    })
  ]
});

// Funções utilitárias para logging estruturado
class LoggerService {
  static info(message, meta = {}) {
    logger.info(message, meta);
  }
  
  static error(message, error = null, meta = {}) {
    const logData = { ...meta };
    
    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
        code: error.code || null
      };
    }
    
    logger.error(message, logData);
  }
  
  static warn(message, meta = {}) {
    logger.warn(message, meta);
  }
  
  static debug(message, meta = {}) {
    logger.debug(message, meta);
  }
  
  // Log de auditoria
  static audit(action, userId, details = {}) {
    logger.info('AUDIT', {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
  
  // Log de performance
  static performance(operation, duration, meta = {}) {
    performanceLogger.info('PERFORMANCE', {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }
  
  // Log de segurança
  static security(event, level = 'info', meta = {}) {
    securityLogger.log(level, 'SECURITY', {
      event,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }
  
  // Log de database operations
  static database(operation, query, duration, meta = {}) {
    logger.info('DATABASE', {
      operation,
      query: query.substring(0, 200), // Limitar tamanho da query
      duration,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }
  
  // Log de API requests
  static apiRequest(method, url, statusCode, duration, userId = null, meta = {}) {
    logger.info('API_REQUEST', {
      method,
      url,
      statusCode,
      duration,
      userId,
      timestamp: new Date().toISOString(),
      ...meta
    });
  }
  
  // Log de erros críticos
  static critical(message, error = null, meta = {}) {
    const logData = { 
      level: 'CRITICAL',
      ...meta 
    };
    
    if (error) {
      logData.error = {
        message: error.message,
        stack: error.stack,
        code: error.code || null
      };
    }
    
    logger.error(message, logData);
    
    // Enviar notificação para administradores em produção
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implementar notificação (email, Slack, etc.)
    }
  }
  
  // Middleware para Express
  static getRequestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      
      // Log da requisição
      this.info('REQUEST_START', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || null
      });
      
      // Interceptar o final da resposta
      const originalSend = res.send;
      res.send = function(data) {
        const duration = Date.now() - start;
        
        LoggerService.apiRequest(
          req.method,
          req.url,
          res.statusCode,
          duration,
          req.user?.id || null,
          {
            ip: req.ip,
            responseSize: data ? data.length : 0
          }
        );
        
        return originalSend.call(this, data);
      };
      
      next();
    };
  }
  
  // Obter estatísticas dos logs
  static getLogStats() {
    return {
      logsDirectory: logsDir,
      logLevel: logger.level,
      transports: logger.transports.length,
      environment: process.env.NODE_ENV || 'development'
    };
  }
}

module.exports = LoggerService;