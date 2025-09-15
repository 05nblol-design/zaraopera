const fs = require('fs').promises;
const path = require('path');
const { captureException } = require('../config/sentry');

class AuthMonitoringService {
  constructor() {
    this.failedAttempts = new Map(); // IP -> { count, lastAttempt, blocked }
    this.suspiciousActivities = [];
    this.logFile = path.join(__dirname, '../logs/auth-monitoring.log');
    
    // Configurações de segurança
    this.config = {
      maxFailedAttempts: 5,
      blockDuration: 15 * 60 * 1000, // 15 minutos
      suspiciousThreshold: 10, // tentativas por minuto
      cleanupInterval: 60 * 60 * 1000, // 1 hora
      alertThreshold: 20 // falhas por hora para alerta
    };
    
    // Iniciar limpeza automática
    this.startCleanupTimer();
    
    // Garantir que o diretório de logs existe
    this.ensureLogDirectory();
  }
  
  async ensureLogDirectory() {
    try {
      const logDir = path.dirname(this.logFile);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Erro ao criar diretório de logs:', error);
    }
  }
  
  /**
   * Registra tentativa de login
   */
  async logLoginAttempt({
    email,
    ip,
    userAgent,
    success,
    errorCode = null,
    userId = null,
    requestId = null
  }) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type: 'LOGIN_ATTEMPT',
      email,
      ip,
      userAgent,
      success,
      errorCode,
      userId,
      requestId
    };
    
    // Log estruturado
    await this.writeLog(logEntry);
    
    if (!success) {
      await this.handleFailedLogin(ip, email, errorCode);
    } else {
      // Reset contador de falhas em caso de sucesso
      this.resetFailedAttempts(ip);
    }
    
    return logEntry;
  }
  
  /**
   * Trata tentativas de login falhadas
   */
  async handleFailedLogin(ip, email, errorCode) {
    const now = Date.now();
    const attempts = this.failedAttempts.get(ip) || {
      count: 0,
      lastAttempt: now,
      blocked: false,
      emails: new Set()
    };
    
    attempts.count++;
    attempts.lastAttempt = now;
    attempts.emails.add(email);
    
    // Verificar se deve bloquear IP
    if (attempts.count >= this.config.maxFailedAttempts) {
      attempts.blocked = true;
      attempts.blockedUntil = now + this.config.blockDuration;
      
      await this.logSecurityEvent({
        type: 'IP_BLOCKED',
        ip,
        reason: 'EXCESSIVE_FAILED_LOGINS',
        attemptCount: attempts.count,
        emails: Array.from(attempts.emails),
        blockedUntil: new Date(attempts.blockedUntil).toISOString()
      });
    }
    
    this.failedAttempts.set(ip, attempts);
    
    // Detectar atividade suspeita
    await this.detectSuspiciousActivity(ip, email, errorCode);
  }
  
  /**
   * Verifica se IP está bloqueado
   */
  isIpBlocked(ip) {
    const attempts = this.failedAttempts.get(ip);
    if (!attempts || !attempts.blocked) {
      return false;
    }
    
    const now = Date.now();
    if (now > attempts.blockedUntil) {
      // Desbloquear IP
      attempts.blocked = false;
      attempts.blockedUntil = null;
      this.failedAttempts.set(ip, attempts);
      return false;
    }
    
    return true;
  }
  
  /**
   * Detecta atividade suspeita
   */
  async detectSuspiciousActivity(ip, email, errorCode) {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // Contar tentativas na última hora
    const recentAttempts = this.suspiciousActivities.filter(
      activity => activity.timestamp > oneMinuteAgo && activity.ip === ip
    ).length;
    
    if (recentAttempts >= this.config.suspiciousThreshold) {
      await this.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        ip,
        email,
        reason: 'HIGH_FREQUENCY_ATTEMPTS',
        attemptsPerMinute: recentAttempts,
        errorCode
      });
      
      // Enviar alerta crítico
      await this.sendSecurityAlert({
        level: 'HIGH',
        type: 'BRUTE_FORCE_DETECTED',
        ip,
        email,
        attemptsPerMinute: recentAttempts
      });
    }
    
    // Adicionar à lista de atividades suspeitas
    this.suspiciousActivities.push({
      timestamp: now,
      ip,
      email,
      errorCode
    });
    
    // Limpar atividades antigas (mais de 1 hora)
    const oneHourAgo = now - 60 * 60 * 1000;
    this.suspiciousActivities = this.suspiciousActivities.filter(
      activity => activity.timestamp > oneHourAgo
    );
  }
  
  /**
   * Log de eventos de segurança
   */
  async logSecurityEvent(event) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_EVENT',
      ...event
    };
    
    await this.writeLog(logEntry);
    
    // Enviar para Sentry se crítico
    if (['IP_BLOCKED', 'SUSPICIOUS_ACTIVITY'].includes(event.type)) {
      captureException(new Error(`Security Event: ${event.type}`), {
        extra: logEntry
      });
    }
  }
  
  /**
   * Envia alertas de segurança
   */
  async sendSecurityAlert(alert) {
    const alertEntry = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY_ALERT',
      ...alert
    };
    
    await this.writeLog(alertEntry);
    
    // Em produção, integrar com sistema de notificações
    // (email, Slack, SMS, etc.)
    console.warn('🚨 ALERTA DE SEGURANÇA:', JSON.stringify(alertEntry, null, 2));
    
    // Enviar para Sentry
    captureException(new Error(`Security Alert: ${alert.type}`), {
      level: alert.level.toLowerCase(),
      extra: alertEntry
    });
  }
  
  /**
   * Escreve log no arquivo
   */
  async writeLog(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logFile, logLine, 'utf8');
    } catch (error) {
      console.error('Erro ao escrever log de autenticação:', error);
    }
  }
  
  /**
   * Reset contador de falhas para IP
   */
  resetFailedAttempts(ip) {
    if (this.failedAttempts.has(ip)) {
      const attempts = this.failedAttempts.get(ip);
      attempts.count = 0;
      attempts.blocked = false;
      attempts.blockedUntil = null;
      this.failedAttempts.set(ip, attempts);
    }
  }
  
  /**
   * Obtém estatísticas de segurança
   */
  getSecurityStats() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const blockedIps = Array.from(this.failedAttempts.entries())
      .filter(([ip, data]) => data.blocked)
      .map(([ip, data]) => ({
        ip,
        count: data.count,
        blockedUntil: new Date(data.blockedUntil).toISOString(),
        emails: Array.from(data.emails)
      }));
    
    const recentSuspiciousActivities = this.suspiciousActivities
      .filter(activity => activity.timestamp > oneHourAgo)
      .length;
    
    return {
      timestamp: new Date().toISOString(),
      blockedIps,
      recentSuspiciousActivities,
      totalFailedAttempts: Array.from(this.failedAttempts.values())
        .reduce((sum, data) => sum + data.count, 0)
    };
  }
  
  /**
   * Inicia timer de limpeza automática
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
  
  /**
   * Limpeza de dados antigos
   */
  cleanup() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    // Limpar tentativas antigas
    for (const [ip, data] of this.failedAttempts.entries()) {
      if (data.lastAttempt < oneHourAgo && !data.blocked) {
        this.failedAttempts.delete(ip);
      }
    }
    
    // Limpar atividades suspeitas antigas
    this.suspiciousActivities = this.suspiciousActivities.filter(
      activity => activity.timestamp > oneHourAgo
    );
    
    console.log('🧹 Limpeza de dados de monitoramento concluída');
  }
}

// Singleton instance
const authMonitoring = new AuthMonitoringService();

module.exports = authMonitoring;