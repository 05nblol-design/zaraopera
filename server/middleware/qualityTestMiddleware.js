const pool = require('../config/database');

/**
 * Validar configurações críticas de qualidade
 * Gera notificação crítica se configurações essenciais estão ausentes
 */
const validateCriticalQualityConfig = async (req, res, next) => {
  try {
    const { machineId } = req.body;
    
    if (!machineId) {
      return next();
    }

    // Buscar configurações ativas para a máquina
    const configQuery = `
      SELECT * FROM quality_test_configs 
      WHERE machine_id = $1 AND is_active = true AND is_required = true
    `;
    const configResult = await pool.query(configQuery, [parseInt(machineId)]);
    const activeConfigs = configResult.rows;

    const criticalIssues = [];

    for (const config of activeConfigs) {
      // Verificar se productsPerTest está configurado adequadamente
      if (!config.products_per_test || config.products_per_test < 1) {
        criticalIssues.push({
          type: 'MISSING_PRODUCTS_PER_TEST',
          configId: config.id,
          testName: config.test_name,
          message: `Configuração '${config.test_name}' não possui quantidade de produtos por teste definida`,
          severity: 'CRITICAL'
        });
      }

      // Verificar se testFrequency está configurado
      if (!config.test_frequency || config.test_frequency < 1) {
        criticalIssues.push({
          type: 'MISSING_TEST_FREQUENCY',
          configId: config.id,
          testName: config.test_name,
          message: `Configuração '${config.test_name}' não possui frequência de teste definida`,
          severity: 'CRITICAL'
        });
      }
    }

    // Se há problemas críticos, bloquear operação
    if (criticalIssues.length > 0) {
      return res.status(400).json({
        error: 'CRITICAL_QUALITY_CONFIG_MISSING',
        message: 'Configurações críticas de qualidade estão ausentes ou inválidas',
        criticalIssues,
        severity: 'CRITICAL',
        action: 'BLOCKED'
      });
    }

    next();
  } catch (error) {
    console.error('Erro ao validar configurações críticas:', error);
    next();
  }
};


/**
 * Middleware para verificar testes de qualidade obrigatórios
 * Verifica se há testes pendentes baseados na configuração do gestor
 */
const checkRequiredQualityTests = async (req, res, next) => {
  try {
    const { machineId } = req.body;
    
    if (!machineId) {
      return next();
    }

    // Buscar configurações ativas para a máquina
    const configQuery = `
      SELECT * FROM quality_test_configs 
      WHERE machine_id = $1 AND is_active = true
    `;
    const configResult = await pool.query(configQuery, [parseInt(machineId)]);
    const activeConfigs = configResult.rows;

    if (activeConfigs.length === 0) {
      return next();
    }

    // Verificar cada configuração
    for (const config of activeConfigs) {
      const pendingTests = await checkPendingTests(machineId, config);
      
      if (pendingTests.length > 0) {
        return res.status(400).json({
          error: 'REQUIRED_QUALITY_TESTS_PENDING',
          message: `Existem ${pendingTests.length} teste(s) de qualidade obrigatório(s) pendente(s) para esta máquina.`,
          pendingTests,
          config: {
            id: config.id,
            testFrequency: config.test_frequency,
            description: config.description
          }
        });
      }
    }

    next();
  } catch (error) {
    console.error('Erro ao verificar testes obrigatórios:', error);
    next();
  }
};

/**
 * Verifica testes pendentes baseados na configuração
 */
const checkPendingTests = async (machineId, config) => {
  const now = new Date();
  const pendingTests = [];

  // Verificar por frequência de tempo
  if (config.test_frequency > 0) {
    const testQuery = `
      SELECT * FROM quality_tests 
      WHERE machine_id = $1 AND config_id = $2 AND is_required = true 
      ORDER BY test_date DESC LIMIT 1
    `;
    const testResult = await pool.query(testQuery, [parseInt(machineId), config.id]);
    const lastTest = testResult.rows[0] || null;

    if (!lastTest) {
      pendingTests.push({
        type: 'FREQUENCY',
        reason: 'Nenhum teste realizado ainda',
        configId: config.id
      });
    } else {
      const timeDiff = now - lastTest.test_date;
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff >= config.test_frequency) {
        pendingTests.push({
          type: 'FREQUENCY',
          reason: `Último teste há ${Math.round(hoursDiff)} horas`,
          configId: config.id,
          lastTestDate: lastTest.testDate
        });
      }
    }
  }

  // Verificar por quantidade de produção baseado em productsPerTest
  if (config.products_per_test > 0) {
    const testQuery = `
      SELECT * FROM quality_tests 
      WHERE machine_id = $1 AND config_id = $2 AND is_required = true 
      ORDER BY test_date DESC LIMIT 1
    `;
    const testResult = await pool.query(testQuery, [parseInt(machineId), config.id]);
    const lastTest = testResult.rows[0] || null;

    const lastTestDate = lastTest ? lastTest.test_date : new Date(0);
    
    // Contar produção desde o último teste usando shiftData
    const shiftQuery = `
      SELECT * FROM shift_data 
      WHERE machine_id = $1 AND created_at > $2
    `;
    const shiftResult = await pool.query(shiftQuery, [parseInt(machineId), lastTestDate]);
    const shiftData = shiftResult.rows;

    const productionCount = shiftData.reduce((total, shift) => total + (shift.total_production || 0), 0);

    // CORREÇÃO: Gerar alerta quando a produção atinge ou ultrapassa o limite configurado
    if (productionCount >= config.products_per_test) {
      pendingTests.push({
        type: 'PRODUCTS_PER_TEST',
        reason: `${productionCount} produtos produzidos desde o último teste. Limite configurado: ${config.products_per_test} produtos.`,
        configId: config.id,
        productionCount,
        productsPerTest: config.products_per_test,
        alertType: 'PRODUCTION_LIMIT_REACHED',
        severity: 'HIGH',
        targetRoles: ['MANAGER', 'LEADER', 'OPERATOR']
      });
    }
  }

  return pendingTests;
};

/**
 * Middleware para operações de produção
 * Bloqueia operações se há testes obrigatórios pendentes
 */
const requireQualityTestsForProduction = async (req, res, next) => {
  try {
    const { machineId } = req.body;
    
    if (!machineId) {
      return next();
    }

    // Buscar configurações que bloqueiam produção
    const blockingQuery = `
      SELECT * FROM quality_test_configs 
      WHERE machine_id = $1 AND is_active = true AND block_production = true
    `;
    const blockingResult = await pool.query(blockingQuery, [parseInt(machineId)]);
    const blockingConfigs = blockingResult.rows;

    if (blockingConfigs.length === 0) {
      return next();
    }

    // Verificar se há testes pendentes que bloqueiam produção
    for (const config of blockingConfigs) {
      const pendingTests = await checkPendingTests(machineId, config);
      
      if (pendingTests.length > 0) {
        return res.status(403).json({
          error: 'PRODUCTION_BLOCKED_BY_QUALITY_TESTS',
          message: 'Produção bloqueada por testes de qualidade obrigatórios pendentes.',
          pendingTests,
          config: {
            id: config.id,
            description: config.description,
            testFrequency: config.test_frequency,
            productionQuantity: config.production_quantity
          }
        });
      }
    }

    next();
  } catch (error) {
    console.error('Erro ao verificar bloqueio de produção:', error);
    next();
  }
};

/**
 * Obter status de testes obrigatórios para uma máquina
 */
const getQualityTestStatus = async (req, res) => {
  try {
    const { machineId } = req.params;
    
    const configsResult = await pool.query(`
      SELECT qtc.*, m.name as machine_name
      FROM quality_test_configs qtc
      JOIN machines m ON qtc.machine_id = m.id
      WHERE qtc.machine_id = $1 AND qtc.is_active = true
    `, [parseInt(machineId)]);
    
    const configs = configsResult.rows;

    const status = [];
    
    for (const config of configs) {
      const pendingTests = await checkPendingTests(machineId, config);
      
      status.push({
        configId: config.id,
        description: config.description,
        testFrequency: config.testFrequency,
        productionQuantity: config.productionQuantity,
        blockProduction: config.blockProduction,
        isRequired: config.isRequired,
        pendingTests,
        status: pendingTests.length > 0 ? 'PENDING' : 'OK'
      });
    }

    res.json({
      machineId: parseInt(machineId),
      machineName: configs[0]?.machine?.name || 'Máquina não encontrada',
      configs: status,
      overallStatus: status.some(s => s.status === 'PENDING') ? 'PENDING' : 'OK'
    });
  } catch (error) {
    console.error('Erro ao obter status de testes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  validateCriticalQualityConfig,
  checkRequiredQualityTests,
  requireQualityTestsForProduction,
  getQualityTestStatus,
  checkPendingTests
};