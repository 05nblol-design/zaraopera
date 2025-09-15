const express = require('express');
const router = express.Router();
const specificCasesService = require('../services/specificCasesService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Executar verificação de todos os casos específicos
router.post('/check-all', requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const results = await specificCasesService.runAllChecks();
    
    res.json({
      success: true,
      message: 'Verificação de casos específicos executada com sucesso',
      data: results,
      summary: {
        qualityTests: results.qualityTests.length,
        teflonChanges: results.teflonChanges.length,
        validityChecks: results.validityChecks.length,
        total: results.qualityTests.length + results.teflonChanges.length + results.validityChecks.length
      }
    });
  } catch (error) {
    console.error('Erro ao executar verificação de casos específicos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verificar apenas testes de qualidade
router.post('/check-quality-tests', requireRole(['admin', 'supervisor', 'quality_manager']), async (req, res) => {
  try {
    const results = await specificCasesService.checkQualityTests();
    
    res.json({
      success: true,
      message: 'Verificação de testes de qualidade executada com sucesso',
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Erro ao verificar testes de qualidade:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verificar apenas trocas de teflon
router.post('/check-teflon-changes', requireRole(['admin', 'supervisor', 'maintenance']), async (req, res) => {
  try {
    const results = await specificCasesService.checkTeflonChanges();
    
    res.json({
      success: true,
      message: 'Verificação de trocas de teflon executada com sucesso',
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Erro ao verificar trocas de teflon:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Verificar apenas validades
router.post('/check-validity-dates', requireRole(['admin', 'supervisor', 'inventory_manager']), async (req, res) => {
  try {
    const results = await specificCasesService.checkValidityDates();
    
    res.json({
      success: true,
      message: 'Verificação de validades executada com sucesso',
      data: results,
      count: results.length
    });
  } catch (error) {
    console.error('Erro ao verificar validades:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obter estatísticas dos casos específicos
router.get('/stats', requireRole(['admin', 'supervisor']), async (req, res) => {
  try {
    const pool = require('../config/database');
    
    // Estatísticas de testes de qualidade
    const qualityStats = await pool.query(`
      SELECT 
        status,
        priority,
        COUNT(*) as count
      FROM quality_tests 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY status, priority
      ORDER BY status, priority
    `);
    
    // Estatísticas de teflon
    const teflonStats = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(usage_hours) as avg_usage_hours,
        AVG(EXTRACT(DAYS FROM (NOW() - last_change_date))) as avg_days_since_change
      FROM teflon_tracking 
      GROUP BY status
      ORDER BY status
    `);
    
    // Estatísticas de validade
    const validityStats = await pool.query(`
      SELECT 
        item_type,
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN expiry_date <= NOW() + INTERVAL '7 days' THEN 1 END) as expiring_soon
      FROM validity_tracking 
      GROUP BY item_type, status
      ORDER BY item_type, status
    `);
    
    res.json({
      success: true,
      data: {
        qualityTests: qualityStats.rows,
        teflonTracking: teflonStats.rows,
        validityTracking: validityStats.rows
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Listar testes de qualidade pendentes
router.get('/quality-tests/pending', requireRole(['admin', 'supervisor', 'quality_manager']), async (req, res) => {
  try {
    const pool = require('../config/database');
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await pool.query(`
      SELECT 
        qt.*,
        EXTRACT(HOURS FROM (NOW() - qt.scheduled_date)) as hours_overdue
      FROM quality_tests qt
      WHERE qt.status = 'pending'
      ORDER BY 
        CASE qt.priority
          WHEN 'URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END,
        qt.scheduled_date ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM quality_tests WHERE status = \'pending\''
    );
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar testes de qualidade pendentes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Listar teflon que precisa de troca
router.get('/teflon/needs-change', requireRole(['admin', 'supervisor', 'maintenance']), async (req, res) => {
  try {
    const pool = require('../config/database');
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await pool.query(`
      SELECT 
        t.*,
        ROUND((t.usage_hours::DECIMAL / t.max_usage_hours) * 100, 2) as usage_percentage,
        EXTRACT(DAYS FROM (NOW() - t.last_change_date)) as days_since_change
      FROM teflon_tracking t
      WHERE (
        (t.usage_hours >= t.max_usage_hours - 100) OR
        (EXTRACT(DAYS FROM (NOW() - t.last_change_date)) >= t.max_days - 7)
      )
      AND t.status = 'active'
      ORDER BY 
        CASE 
          WHEN t.usage_hours >= t.max_usage_hours THEN 1
          WHEN EXTRACT(DAYS FROM (NOW() - t.last_change_date)) >= t.max_days THEN 2
          ELSE 3
        END,
        t.usage_hours DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar teflon que precisa de troca:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Listar itens próximos do vencimento
router.get('/validity/expiring-soon', requireRole(['admin', 'supervisor', 'inventory_manager']), async (req, res) => {
  try {
    const pool = require('../config/database');
    const { page = 1, limit = 10, days = 7 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await pool.query(`
      SELECT 
        v.*,
        EXTRACT(DAYS FROM (v.expiry_date - NOW())) as days_until_expiry
      FROM validity_tracking v
      WHERE v.expiry_date <= NOW() + INTERVAL '${days} days'
        AND v.status = 'active'
      ORDER BY 
        CASE 
          WHEN v.expiry_date <= NOW() THEN 1
          WHEN v.expiry_date <= NOW() + INTERVAL '1 day' THEN 2
          WHEN v.expiry_date <= NOW() + INTERVAL '3 days' THEN 3
          ELSE 4
        END,
        v.expiry_date ASC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar itens próximos do vencimento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;