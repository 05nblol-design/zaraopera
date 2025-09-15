const os = require('os');
const process = require('process');
const { performance } = require('perf_hooks');
const { getCache, setCache } = require('../config/redis');

class MetricsService {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.responseTimeHistory = [];
    this.maxHistorySize = 1000;
    
    // Iniciar coleta de métricas
    this.startMetricsCollection();
  }

  // Iniciar coleta automática de métricas
  startMetricsCollection() {
    // Coletar métricas a cada 30 segundos
    setInterval(() => {
      this.collectAndStoreMetrics();
    }, 30000);
  }

  // Coletar métricas do sistema
  async collectSystemMetrics() {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    const loadAverage = os.loadavg();
    const uptime = process.uptime();
    
    return {
      timestamp: new Date().toISOString(),
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        loadAverage: loadAverage
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        usage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        memoryUsage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        uptime: uptime,
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length
      }
    };
  }

  // Coletar métricas da aplicação
  getApplicationMetrics() {
    const avgResponseTime = this.responseTimeHistory.length > 0 
      ? this.responseTimeHistory.reduce((a, b) => a + b, 0) / this.responseTimeHistory.length 
      : 0;

    return {
      timestamp: new Date().toISOString(),
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        successRate: this.requestCount > 0 ? ((this.requestCount - this.errorCount) / this.requestCount) * 100 : 100
      },
      performance: {
        averageResponseTime: avgResponseTime,
        uptime: Date.now() - this.startTime,
        responseTimeHistory: this.responseTimeHistory.slice(-10) // Últimos 10 tempos
      }
    };
  }

  // Registrar uma requisição
  recordRequest(responseTime, isError = false) {
    this.requestCount++;
    if (isError) {
      this.errorCount++;
    }
    
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory.shift();
    }
  }

  // Coletar e armazenar métricas no Redis
  async collectAndStoreMetrics() {
    try {
      const systemMetrics = await this.collectSystemMetrics();
      const appMetrics = this.getApplicationMetrics();
      
      const metrics = {
        system: systemMetrics,
        application: appMetrics,
        timestamp: new Date().toISOString()
      };

      // Armazenar no Redis com TTL de 1 hora
      const key = `metrics:${Date.now()}`;
      await setCache(key, JSON.stringify(metrics), 3600);
      
      // Manter apenas as últimas 24 horas de métricas
      await this.cleanOldMetrics();
      
      console.log('📊 Métricas coletadas e armazenadas:', {
        memoryUsage: `${systemMetrics.memory.usage.toFixed(2)}%`,
        systemMemory: `${systemMetrics.system.memoryUsage.toFixed(2)}%`,
        requests: appMetrics.requests.total,
        avgResponseTime: `${appMetrics.performance.averageResponseTime.toFixed(2)}ms`
      });
      
    } catch (error) {
      console.error('❌ Erro ao coletar métricas:', error);
    }
  }

  // Limpar métricas antigas (mais de 24 horas)
  async cleanOldMetrics() {
    try {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      // Esta implementação seria mais complexa com Redis, 
      // por simplicidade, vamos manter o TTL automático
    } catch (error) {
      console.error('❌ Erro ao limpar métricas antigas:', error);
    }
  }

  // Obter métricas atuais
  async getCurrentMetrics() {
    const systemMetrics = await this.collectSystemMetrics();
    const appMetrics = this.getApplicationMetrics();
    
    return {
      system: systemMetrics,
      application: appMetrics,
      timestamp: new Date().toISOString()
    };
  }

  // Middleware para monitorar requisições
  getRequestMonitoringMiddleware() {
    return (req, res, next) => {
      const startTime = performance.now();
      
      res.on('finish', () => {
        const responseTime = performance.now() - startTime;
        const isError = res.statusCode >= 400;
        this.recordRequest(responseTime, isError);
      });
      
      next();
    };
  }

  // Verificar alertas de performance
  async checkPerformanceAlerts() {
    const metrics = await this.getCurrentMetrics();
    const alerts = [];
    
    // Alerta de uso de memória
    if (metrics.system.memory.usage > 85) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        level: 'WARNING',
        message: `Uso de memória heap alto: ${metrics.system.memory.usage.toFixed(2)}%`,
        value: metrics.system.memory.usage
      });
    }
    
    // Alerta de uso de memória do sistema
    if (metrics.system.system.memoryUsage > 90) {
      alerts.push({
        type: 'HIGH_SYSTEM_MEMORY',
        level: 'CRITICAL',
        message: `Uso de memória do sistema crítico: ${metrics.system.system.memoryUsage.toFixed(2)}%`,
        value: metrics.system.system.memoryUsage
      });
    }
    
    // Alerta de tempo de resposta
    if (metrics.application.performance.averageResponseTime > 1000) {
      alerts.push({
        type: 'HIGH_RESPONSE_TIME',
        level: 'WARNING',
        message: `Tempo de resposta alto: ${metrics.application.performance.averageResponseTime.toFixed(2)}ms`,
        value: metrics.application.performance.averageResponseTime
      });
    }
    
    // Alerta de taxa de erro
    if (metrics.application.requests.successRate < 95) {
      alerts.push({
        type: 'HIGH_ERROR_RATE',
        level: 'CRITICAL',
        message: `Taxa de sucesso baixa: ${metrics.application.requests.successRate.toFixed(2)}%`,
        value: metrics.application.requests.successRate
      });
    }
    
    return alerts;
  }
}

module.exports = new MetricsService();