const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Middleware de autenticação para todas as rotas de métricas
router.use(authenticateToken);
router.use(requireRole(['admin', 'supervisor']));

// GET /api/metrics - Obter métricas atuais
router.get('/', async (req, res) => {
  try {
    const metrics = await metricsService.getCurrentMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('❌ Erro ao obter métricas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao obter métricas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/metrics/alerts - Verificar alertas de performance
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await metricsService.checkPerformanceAlerts();
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        hasAlerts: alerts.length > 0
      }
    });
  } catch (error) {
    console.error('❌ Erro ao verificar alertas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao verificar alertas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/metrics/system - Obter apenas métricas do sistema
router.get('/system', async (req, res) => {
  try {
    const metrics = await metricsService.getCurrentMetrics();
    res.json({
      success: true,
      data: metrics.system
    });
  } catch (error) {
    console.error('❌ Erro ao obter métricas do sistema:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao obter métricas do sistema',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/metrics/application - Obter apenas métricas da aplicação
router.get('/application', async (req, res) => {
  try {
    const metrics = await metricsService.getCurrentMetrics();
    res.json({
      success: true,
      data: metrics.application
    });
  } catch (error) {
    console.error('❌ Erro ao obter métricas da aplicação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao obter métricas da aplicação',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/metrics/health - Health check com métricas básicas
router.get('/health', async (req, res) => {
  try {
    const metrics = await metricsService.getCurrentMetrics();
    const alerts = await metricsService.checkPerformanceAlerts();
    
    const criticalAlerts = alerts.filter(alert => alert.level === 'CRITICAL');
    const isHealthy = criticalAlerts.length === 0;
    
    res.status(isHealthy ? 200 : 503).json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: metrics.application.performance.uptime,
        memoryUsage: metrics.system.memory.usage,
        systemMemoryUsage: metrics.system.system.memoryUsage,
        requestCount: metrics.application.requests.total,
        errorCount: metrics.application.requests.errors,
        successRate: metrics.application.requests.successRate,
        averageResponseTime: metrics.application.performance.averageResponseTime,
        alerts: {
          total: alerts.length,
          critical: criticalAlerts.length,
          warning: alerts.filter(alert => alert.level === 'WARNING').length
        }
      }
    });
  } catch (error) {
    console.error('❌ Erro no health check:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      message: 'Erro interno do servidor no health check',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;