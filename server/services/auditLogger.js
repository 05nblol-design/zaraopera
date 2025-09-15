const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');
const { captureException } = require('../config/sentry');

class AuditLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.streams = new Map();
    
    // Configurações de log
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      rotateDaily: true,
      levels: {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3,
        TRACE: 4
      }
    };
    
    // Tipos de auditoria
    this.auditTypes = {
      AUTH: 'authentication',
      USER: 'user_management', 
      DATA: 'data_access',
      SYSTEM: 'system_events',
      SECURITY: 'security_events',
      API: 'api_requests'
    };
    
    this.initializeLogDirectory();
    this.setupRotation();
  }
  
  async initializeLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      console.log('📁 Diretório de logs de auditoria inicializado');
    } catch (error) {
      console.error('Erro ao criar diretório de logs:', error);
    }
  }
  
  /**
   * Obtém stream de log para um tipo específico
   */
  getLogStream(type) {
    if (!this.streams.has(type)) {
      const filename = `${type}-${this.getDateString()}.log`;
      const filepath = path.join(this.logDir, filename);
      const stream = createWriteStream(filepath, { flags: 'a' });
      this.streams.set(type, { stream, filepath, size: 0 });
    }
    return this.streams.get(type);
  }
  
  /**
   * Log de autenticação
   */
  async logAuth({
    action,
    userId = null,
    email = null,
    ip,
    userAgent,
    success,
    errorCode = null,
    requestId = null,
    sessionId = null,
    metadata = {}
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'AUTHENTICATION',
      action, // LOGIN, LOGOUT, REGISTER, PASSWORD_CHANGE, TOKEN_REFRESH
      userId,
      email,
      ip,
      userAgent,
      success,
      errorCode,
      requestId,
      sessionId,
      metadata,
      level: success ? 'INFO' : 'WARN'
    };
    
    await this.writeLog(this.auditTypes.AUTH, logEntry);
    return logEntry;
  }
  
  /**
   * Log de gerenciamento de usuários
   */
  async logUserManagement({
    action,
    performedBy,
    targetUserId = null,
    targetEmail = null,
    changes = {},
    ip,
    userAgent,
    requestId = null,
    metadata = {}
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'USER_MANAGEMENT',
      action, // CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE, ROLE_CHANGE
      performedBy,
      targetUserId,
      targetEmail,
      changes,
      ip,
      userAgent,
      requestId,
      metadata,
      level: 'INFO'
    };
    
    await this.writeLog(this.auditTypes.USER, logEntry);
    return logEntry;
  }
  
  /**
   * Log de acesso a dados
   */
  async logDataAccess({
    action,
    userId,
    resource,
    resourceId = null,
    method,
    endpoint,
    ip,
    userAgent,
    success,
    responseCode,
    requestId = null,
    queryParams = {},
    bodySize = 0,
    responseSize = 0,
    duration = 0,
    metadata = {}
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'DATA_ACCESS',
      action, // READ, CREATE, UPDATE, DELETE, EXPORT, IMPORT
      userId,
      resource,
      resourceId,
      method,
      endpoint,
      ip,
      userAgent,
      success,
      responseCode,
      requestId,
      queryParams,
      bodySize,
      responseSize,
      duration,
      metadata,
      level: success ? 'INFO' : 'WARN'
    };
    
    await this.writeLog(this.auditTypes.DATA, logEntry);
    return logEntry;
  }
  
  /**
   * Log de eventos do sistema
   */
  async logSystemEvent({
    event,
    component,
    level = 'INFO',
    message,
    error = null,
    metadata = {},
    requestId = null
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SYSTEM_EVENT',
      event, // STARTUP, SHUTDOWN, ERROR, CONFIG_CHANGE, MAINTENANCE
      component,
      level,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null,
      metadata,
      requestId
    };
    
    await this.writeLog(this.auditTypes.SYSTEM, logEntry);
    
    // Enviar erros críticos para Sentry
    if (level === 'ERROR' && error) {
      captureException(error, {
        extra: { logEntry }
      });
    }
    
    return logEntry;
  }
  
  /**
   * Log de eventos de segurança
   */
  async logSecurityEvent({
    event,
    severity = 'MEDIUM', // LOW, MEDIUM, HIGH, CRITICAL
    description,
    ip = null,
    userId = null,
    userAgent = null,
    requestId = null,
    evidence = {},
    metadata = {}
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_EVENT',
      event, // BRUTE_FORCE, SUSPICIOUS_ACTIVITY, UNAUTHORIZED_ACCESS, DATA_BREACH
      severity,
      description,
      ip,
      userId,
      userAgent,
      requestId,
      evidence,
      metadata,
      level: severity === 'CRITICAL' ? 'ERROR' : 'WARN'
    };
    
    await this.writeLog(this.auditTypes.SECURITY, logEntry);
    
    // Alertas para eventos críticos
    if (severity === 'CRITICAL') {
      await this.sendCriticalAlert(logEntry);
    }
    
    return logEntry;
  }
  
  /**
   * Log de requisições API
   */
  async logApiRequest({
    method,
    endpoint,
    userId = null,
    ip,
    userAgent,
    requestId,
    statusCode,
    duration,
    requestSize = 0,
    responseSize = 0,
    queryParams = {},
    headers = {},
    metadata = {}
  }) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'API_REQUEST',
      method,
      endpoint,
      userId,
      ip,
      userAgent,
      requestId,
      statusCode,
      duration,
      requestSize,
      responseSize,
      queryParams,
      headers: this.sanitizeHeaders(headers),
      metadata,
      level: statusCode >= 400 ? 'WARN' : 'INFO'
    };
    
    await this.writeLog(this.auditTypes.API, logEntry);
    return logEntry;
  }
  
  /**
   * Escreve log no arquivo apropriado
   */
  async writeLog(type, logEntry) {
    try {
      const logStream = this.getLogStream(type);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Verificar se o stream ainda está válido
      if (!logStream.stream || logStream.stream.destroyed) {
        console.warn(`Stream ${type} foi destruído, recriando...`);
        this.streams.delete(type);
        const newLogStream = this.getLogStream(type);
        newLogStream.stream.write(logLine);
        newLogStream.size += Buffer.byteLength(logLine, 'utf8');
      } else {
        logStream.stream.write(logLine);
        logStream.size += Buffer.byteLength(logLine, 'utf8');
      }
      
      // Verificar se precisa rotacionar (com proteção)
      try {
        if (logStream.size > this.config.maxFileSize) {
          await this.rotateLog(type);
        }
      } catch (rotateError) {
        console.warn('Erro na rotação de log, continuando:', rotateError.message);
      }
      
    } catch (error) {
      console.error('Erro ao escrever log de auditoria:', error.message);
      
      // Fallback 1: tentar escrever em arquivo de erro
      try {
        const errorLog = {
          timestamp: new Date().toISOString(),
          type: 'AUDIT_ERROR',
          error: error.message,
          originalLog: logEntry
        };
        
        const errorFile = path.join(this.logDir, 'audit-errors.log');
        await fs.appendFile(errorFile, JSON.stringify(errorLog) + '\n');
      } catch (fallbackError) {
        // Fallback 2: log apenas no console
        console.error('Sistema de auditoria com falha, log apenas no console:', {
          originalError: error.message,
          fallbackError: fallbackError.message,
          logEntry
        });
      }
    }
  }
  
  /**
   * Rotaciona arquivo de log
   */
  async rotateLog(type) {
    try {
      const currentStream = this.streams.get(type);
      if (currentStream) {
        currentStream.stream.end();
        
        // Renomear arquivo atual
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const oldPath = currentStream.filepath;
        const newPath = oldPath.replace('.log', `-${timestamp}.log`);
        
        await fs.rename(oldPath, newPath);
        
        // Remover stream antigo
        this.streams.delete(type);
        
        // Limpar arquivos antigos
        await this.cleanupOldLogs(type);
        
        console.log(`📋 Log rotacionado: ${type}`);
      }
    } catch (error) {
      console.error('Erro ao rotacionar log:', error);
    }
  }
  
  /**
   * Remove arquivos de log antigos
   */
  async cleanupOldLogs(type) {
    try {
      const files = await fs.readdir(this.logDir);
      const typeFiles = files
        .filter(file => file.startsWith(type) && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          stat: null
        }));
      
      // Obter estatísticas dos arquivos
      for (const file of typeFiles) {
        try {
          file.stat = await fs.stat(file.path);
        } catch (error) {
          console.warn('Erro ao obter estatísticas do arquivo:', file.name);
        }
      }
      
      // Ordenar por data de modificação (mais antigos primeiro)
      const sortedFiles = typeFiles
        .filter(file => file.stat)
        .sort((a, b) => a.stat.mtime - b.stat.mtime);
      
      // Remover arquivos excedentes
      if (sortedFiles.length > this.config.maxFiles) {
        const filesToRemove = sortedFiles.slice(0, sortedFiles.length - this.config.maxFiles);
        
        for (const file of filesToRemove) {
          await fs.unlink(file.path);
          console.log(`🗑️ Arquivo de log removido: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Erro na limpeza de logs antigos:', error);
    }
  }
  
  /**
   * Configura rotação automática
   */
  setupRotation() {
    if (this.config.rotateDaily) {
      // Rotacionar diariamente à meia-noite
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      setTimeout(() => {
        this.rotateAllLogs();
        
        // Configurar rotação diária
        setInterval(() => {
          this.rotateAllLogs();
        }, 24 * 60 * 60 * 1000); // 24 horas
        
      }, msUntilMidnight);
    }
  }
  
  /**
   * Rotaciona todos os logs
   */
  async rotateAllLogs() {
    console.log('🔄 Iniciando rotação diária de logs...');
    
    for (const type of Object.values(this.auditTypes)) {
      if (this.streams.has(type)) {
        await this.rotateLog(type);
      }
    }
    
    console.log('✅ Rotação diária de logs concluída');
  }
  
  /**
   * Sanitiza headers removendo informações sensíveis
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Envia alerta crítico
   */
  async sendCriticalAlert(logEntry) {
    console.error('🚨 ALERTA CRÍTICO DE SEGURANÇA:', JSON.stringify(logEntry, null, 2));
    
    // Enviar para Sentry
    captureException(new Error(`Critical Security Alert: ${logEntry.event}`), {
      level: 'error',
      extra: logEntry
    });
    
    // Em produção, integrar com:
    // - Sistema de notificações (email, SMS)
    // - Slack/Teams
    // - Sistema de tickets
    // - Dashboard de monitoramento
  }
  
  /**
   * Obtém string de data para nomeação de arquivos
   */
  getDateString() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }
  
  /**
   * Obtém estatísticas de auditoria
   */
  async getAuditStats(days = 7) {
    // Em produção, implementar consulta aos logs
    // Por enquanto, retorna estatísticas básicas
    return {
      period: `${days} days`,
      totalLogs: 0,
      byType: {},
      byLevel: {},
      topUsers: [],
      topIPs: [],
      securityEvents: 0
    };
  }
  
  /**
   * Fecha todos os streams de forma segura
   */
  async close() {
    try {
      console.log('📋 Fechando streams de auditoria de forma segura...');
      
      for (const [type, streamInfo] of this.streams.entries()) {
        try {
          if (streamInfo.stream && !streamInfo.stream.destroyed) {
            streamInfo.stream.end();
          }
        } catch (error) {
          console.error(`Erro ao fechar stream ${type}:`, error.message);
        }
      }
      
      this.streams.clear();
      console.log('📋 Sistema de auditoria fechado com segurança');
    } catch (error) {
      console.error('Erro durante fechamento do sistema de auditoria:', error.message);
      // Não relançar o erro para não causar crash
    }
  }
}

// Singleton instance
const auditLogger = new AuditLogger();

// Graceful shutdown removido - será gerenciado pelo gracefulShutdown.js
// para evitar encerramento prematuro do sistema de auditoria
/*
process.on('SIGINT', async () => {
  await auditLogger.close();
});

process.on('SIGTERM', async () => {
  await auditLogger.close();
});
*/

module.exports = auditLogger;