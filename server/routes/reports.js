const express = require('express');
const { query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { requireLeader, requireManager, authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { setCache, getCache } = require('../config/redis');
const {
  calculateOEE,
  calculateCurrentShiftOEE,
  calculateMultipleOEE
} = require('../services/oeeService');

const router = express.Router();

// @desc    Métricas de qualidade para dashboard do gestor
// @route   GET /api/reports/quality-metrics
// @access  Private (Manager+)
router.get('/quality-metrics', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().isString().withMessage('ID da máquina inválido')
], authenticateToken, requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (machineId && machineId !== 'all') where.machineId = machineId;

  // Construir query SQL baseada nos filtros
  let whereClause = 'WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;

  if (startDate) {
    whereClause += ` AND qt."created_at" >= $${paramIndex}`;
    queryParams.push(new Date(startDate));
    paramIndex++;
  }
  if (endDate) {
    whereClause += ` AND qt."created_at" <= $${paramIndex}`;
    queryParams.push(new Date(endDate));
    paramIndex++;
  }
  if (machineId && machineId !== 'all') {
    whereClause += ` AND qt."machine_id" = $${paramIndex}`;
    queryParams.push(machineId);
    paramIndex++;
  }

  const testsQuery = `
    SELECT 
      qt.*,
      m.name as machine_name
    FROM "quality_tests" qt
    LEFT JOIN "machines" m ON qt."machine_id" = m.id
    ${whereClause}
    ORDER BY qt."created_at" DESC
  `;
  
  const testsResult = await pool.query(testsQuery, queryParams);
  const tests = testsResult.rows.map(row => ({
    id: row.id,
    approved: row.approved,
    createdAt: row.created_at,
    machineId: row.machine_id,
    machine: {
      name: row.machine_name
    }
  }));

  const approved = tests.filter(test => test.approved).length;
  const rejected = tests.filter(test => !test.approved).length;
  const total = tests.length;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Agrupar por data para gráfico
  const dailyData = {};
  tests.forEach((test, index) => {
    if (!test.createdAt) {
      console.warn(`Test ${index} tem createdAt undefined:`, test);
      return;
    }
    
    let date;
    try {
      date = new Date(test.createdAt).toISOString().split('T')[0];
    } catch (error) {
      console.warn(`Erro ao converter data do test ${index}:`, test.createdAt, error.message);
      return;
    }
    if (!dailyData[date]) {
      dailyData[date] = { approved: 0, rejected: 0 };
    }
    if (test.approved) {
      dailyData[date].approved++;
    } else {
      dailyData[date].rejected++;
    }
  });

  const labels = Object.keys(dailyData).sort();
  const approvedData = labels.map(date => dailyData[date].approved);
  const rejectedData = labels.map(date => dailyData[date].rejected);

  res.json({
    success: true,
    data: {
      approvalRate,
      total,
      approved,
      rejected,
      labels,
      approved: approvedData,
      rejected: rejectedData
    }
  });
}));

// @desc    Dados de produção para dashboard do gestor
// @route   GET /api/reports/production-data
// @access  Private (Manager+)
router.get('/production-data', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().isString().withMessage('ID da máquina inválido')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  // Construir query SQL para dados de produção
  let whereClause = 'WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;

  if (startDate) {
    whereClause += ` AND "created_at" >= $${paramIndex}`;
    queryParams.push(new Date(startDate));
    paramIndex++;
  }
  if (endDate) {
    whereClause += ` AND "created_at" <= $${paramIndex}`;
    queryParams.push(new Date(endDate));
    paramIndex++;
  }
  if (machineId && machineId !== 'all') {
    whereClause += ` AND "machine_id" = $${paramIndex}`;
    queryParams.push(machineId);
    paramIndex++;
  }

  const testsQuery = `
    SELECT "created_at", approved
    FROM "quality_tests"
    ${whereClause}
    ORDER BY "created_at" ASC
  `;
  
  const testsResult = await pool.query(testsQuery, queryParams);
  const tests = testsResult.rows;

  // Agrupar por data
  const dailyProduction = {};
  tests.forEach(test => {
    if (!test.created_at) return;
    const date = new Date(test.created_at).toISOString().split('T')[0];
    if (!dailyProduction[date]) {
      dailyProduction[date] = 0;
    }
    dailyProduction[date]++;
  });

  const labels = Object.keys(dailyProduction).sort();
  const daily = labels.map(date => dailyProduction[date]);
  const total = tests.length;

  res.json({
    success: true,
    data: {
      total,
      labels,
      daily
    }
  });
}));

// @desc    Performance das máquinas para dashboard do gestor
// @route   GET /api/reports/machine-performance
// @access  Private (Manager+)
router.get('/machine-performance', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().isString().withMessage('ID da máquina inválido')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  
  // Verificar se existem máquinas no banco usando PostgreSQL
  const machineCountQuery = 'SELECT COUNT(*) as count FROM "machines"';
  const machineCountResult = await pool.query(machineCountQuery);
  const machineCount = parseInt(machineCountResult.rows[0].count);
  
  if (machineCount === 0) {
    // Retornar dados vazios se não há máquinas
    return res.json({
      success: true,
      data: {
        machines: [],
        summary: {
          totalMachines: 0,
          activeMachines: 0,
          averageEfficiency: 0,
          totalProduction: 0
        }
      }
    });
  }
  
  // Construir query para buscar máquinas
  let machineWhereClause = 'WHERE 1=1';
  const machineParams = [];
  let paramIndex = 1;

  if (machineId && machineId !== 'all') {
    machineWhereClause += ` AND id = $${paramIndex}`;
    machineParams.push(machineId);
    paramIndex++;
  }

  const machinesQuery = `
    SELECT * FROM "machines"
    ${machineWhereClause}
    ORDER BY name
  `;
  
  const machinesResult = await pool.query(machinesQuery, machineParams);
  const machines = machinesResult.rows;
  
  // Para cada máquina, buscar dados de qualidade usando PostgreSQL
  const machinePerformance = [];
  
  for (const machine of machines) {
    let testWhereClause = 'WHERE "machine_id" = $1';
    const testParams = [machine.id];
    let testParamIndex = 2;
    
    if (startDate) {
      testWhereClause += ` AND "created_at" >= $${testParamIndex}`;
      testParams.push(new Date(startDate));
      testParamIndex++;
    }
    if (endDate) {
      testWhereClause += ` AND "created_at" <= $${testParamIndex}`;
      testParams.push(new Date(endDate));
      testParamIndex++;
    }
    
    const testsQuery = `
      SELECT * FROM "quality_tests"
      ${testWhereClause}
    `;
    
    const testsResult = await pool.query(testsQuery, testParams);
    const tests = testsResult.rows;
    const totalTests = tests.length;
    const passedTests = tests.filter(t => t.approved).length;
    
    machinePerformance.push({
      id: machine.id,
      name: machine.name || `Máquina ${machine.code}`,
      status: machine.status || 'UNKNOWN',
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
      lastMaintenance: machine.lastMaintenance
    });
  }
  
  // Calcular médias
  const avgEfficiency = machinePerformance.length > 0 
    ? machinePerformance.reduce((sum, m) => sum + m.passRate, 0) / machinePerformance.length 
    : 0;
  const avgDowntime = 2.1; // Valor padrão
  const avgUtilization = 94.2; // Valor padrão
  
  // Contar status das máquinas
  const statusCount = {
    operating: 0,
    maintenance: 0,
    stopped: 0,
    testing: 0
  };

  let totalTests = 0;
  machinePerformance.forEach(machine => {
    totalTests += machine.totalTests;
    switch (machine.status) {
      case 'RUNNING':
        statusCount.operating++;
        break;
      case 'MAINTENANCE':
        statusCount.maintenance++;
        break;
      case 'STOPPED':
        statusCount.stopped++;
        break;
      case 'ERROR':
        statusCount.testing++;
        break;
    }
  });

  res.json({
    success: true,
    data: {
      machines: machinePerformance,
      summary: {
        totalMachines: machines.length,
        totalTests,
        avgEfficiency,
        avgDowntime,
        avgUtilization,
        statusCount
      }
    }
  });
}));

// @desc    Relatório de testes de qualidade
// @route   GET /api/reports/quality-tests
// @access  Private (Leader+)
router.get('/quality-tests', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('userId').optional().isInt({ min: 1 }).withMessage('ID do usuário inválido'),
  query('approved').optional().isBoolean().withMessage('Approved deve ser boolean'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Formato deve ser json ou csv')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    startDate,
    endDate,
    machineId,
    userId,
    approved,
    format = 'json'
  } = req.query;

  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  // Outros filtros
  if (machineId && machineId !== 'all') where.machineId = machineId;
  if (userId) where.userId = userId;
  if (approved !== undefined) where.approved = approved === 'true';

  // Construir query SQL baseada nos filtros
  let whereClause = 'WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;

  if (startDate) {
    whereClause += ` AND qt."created_at" >= $${paramIndex}`;
    queryParams.push(new Date(startDate));
    paramIndex++;
  }
  if (endDate) {
    whereClause += ` AND qt."created_at" <= $${paramIndex}`;
    queryParams.push(new Date(endDate));
    paramIndex++;
  }
  if (machineId && machineId !== 'all') {
    whereClause += ` AND qt."machine_id" = $${paramIndex}`;
    queryParams.push(machineId);
    paramIndex++;
  }
  if (userId) {
    whereClause += ` AND qt."user_id" = $${paramIndex}`;
    queryParams.push(userId);
    paramIndex++;
  }
  if (approved !== undefined) {
    whereClause += ` AND qt.approved = $${paramIndex}`;
    queryParams.push(approved === 'true');
    paramIndex++;
  }

  const testsQuery = `
    SELECT 
      qt.*,
      m.name as machine_name,
      m.code as machine_code,
      m.location as machine_location,
      u.name as user_name,
      u.email as user_email
    FROM "quality_tests" qt
     LEFT JOIN "machines" m ON qt."machine_id" = m.id
    LEFT JOIN "users" u ON qt."user_id" = u.id
    ${whereClause}
    ORDER BY qt."created_at" DESC
  `;
  
  const testsResult = await pool.query(testsQuery, queryParams);
  const tests = testsResult.rows.map(row => ({
    id: row.id,
    approved: row.approved,
    createdAt: row.createdAt,
    product: row.product,
    batch: row.batch,
    boxNumber: row.boxNumber,
    packageSize: row.packageSize,
    packageWidth: row.packageWidth,
    bottomSize: row.bottomSize,
    sideSize: row.sideSize,
    zipperDistance: row.zipperDistance,
    facilitatorDistance: row.facilitatorDistance,
    rulerTest: row.rulerTest,
    hermeticityTest: row.hermeticityTest,
    observations: row.observations,
    machineId: row.machineId,
    userId: row.userId,
    machine: {
      name: row.machine_name,
      code: row.machine_code,
      location: row.machine_location
    },
    user: {
      name: row.user_name,
      email: row.user_email
    }
  }));

  // Estatísticas
  const stats = {
    total: tests.length,
    approved: tests.filter(t => t.approved).length,
    rejected: tests.filter(t => !t.approved).length,
    approvalRate: tests.length > 0 ? (tests.filter(t => t.approved).length / tests.length * 100).toFixed(2) : 0,
    byMachine: {},
    byUser: {},
    byDay: {}
  };

  // Agrupar por máquina
  tests.forEach(test => {
    const machineName = test.machine.name;
    if (!stats.byMachine[machineName]) {
      stats.byMachine[machineName] = { total: 0, approved: 0, rejected: 0 };
    }
    stats.byMachine[machineName].total++;
    if (test.approved) {
      stats.byMachine[machineName].approved++;
    } else {
      stats.byMachine[machineName].rejected++;
    }
  });

  // Agrupar por usuário
  tests.forEach(test => {
    const userName = test.user.name;
    if (!stats.byUser[userName]) {
      stats.byUser[userName] = { total: 0, approved: 0, rejected: 0 };
    }
    stats.byUser[userName].total++;
    if (test.approved) {
      stats.byUser[userName].approved++;
    } else {
      stats.byUser[userName].rejected++;
    }
  });

  // Agrupar por dia
  tests.forEach(test => {
    if (!test.createdAt) return;
    const day = new Date(test.createdAt).toISOString().split('T')[0];
    if (!stats.byDay[day]) {
      stats.byDay[day] = { total: 0, approved: 0, rejected: 0 };
    }
    stats.byDay[day].total++;
    if (test.approved) {
      stats.byDay[day].approved++;
    } else {
      stats.byDay[day].rejected++;
    }
  });

  if (format === 'csv') {
    // Gerar CSV
    const csvHeaders = [
      'Data/Hora',
      'Máquina',
      'Operador',
      'Produto',
      'Lote',
      'Número da Caixa',
      'Tamanho da Embalagem',
      'Largura da Embalagem',
      'Tamanho do Fundo',
      'Tamanho da Lateral',
      'Distância Zíper-Boca',
      'Distância Facilitador',
      'Teste Régua',
      'Teste Hermeticidade',
      'Status',
      'Observações'
    ];

    const csvRows = tests.map(test => [
      test.createdAt.toLocaleString('pt-BR'),
      test.machine.name,
      test.user.name,
      test.product,
      test.batch,
      test.boxNumber,
      test.packageSize,
      test.packageWidth,
      test.bottomSize,
      test.sideSize,
      test.zipperDistance,
      test.facilitatorDistance,
      test.rulerTest ? 'Sim' : 'Não',
      test.hermeticityTest ? 'Sim' : 'Não',
      test.approved ? 'Aprovado' : 'Reprovado',
      test.observations || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-testes-qualidade.csv"');
    return res.send('\uFEFF' + csvContent); // BOM para UTF-8
  }

  res.json({
    success: true,
    data: {
      tests,
      statistics: stats
    }
  });
}));

// @desc    Relatório de operações de máquinas
// @route   GET /api/reports/machine-operations
// @access  Private (Leader+)
router.get('/machine-operations', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('userId').optional().isInt({ min: 1 }).withMessage('ID do usuário inválido'),
  query('status').optional().isIn(['RUNNING', 'COMPLETED', 'PAUSED', 'STOPPED']).withMessage('Status inválido'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Formato deve ser json ou csv')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    startDate,
    endDate,
    machineId,
    userId,
    status,
    format = 'json'
  } = req.query;

  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  // Outros filtros
  if (machineId) where.machineId = machineId;
  if (userId) where.userId = userId;
  if (status) where.status = status;

  // Construir query SQL com filtros dinâmicos
  let whereClause = 'WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    whereClause += ` AND mo."start_time" >= $${paramIndex}`;
    params.push(new Date(startDate));
    paramIndex++;
  }
  if (endDate) {
    whereClause += ` AND mo."start_time" <= $${paramIndex}`;
    params.push(new Date(endDate));
    paramIndex++;
  }
  if (machineId) {
    whereClause += ` AND mo."machine_id" = $${paramIndex}`;
    params.push(machineId);
    paramIndex++;
  }
  if (userId) {
    whereClause += ` AND mo."user_id" = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }
  if (status) {
    whereClause += ` AND mo.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  const client = await pool.connect();
  try {
    const operationsResult = await client.query(`
      SELECT 
        mo.id,
        mo."machine_id",
        mo."user_id",
        mo."startTime",
        mo."end_time",
        mo.status,
        mo.observations,
        mo."created_at",
        mo."updatedAt",
        m.name as machine_name,
        m.code as machine_code,
        m.location as machine_location,
        u.name as user_name,
        u.email as user_email
      FROM "machine_operations" mo
       LEFT JOIN "machines" m ON mo."machine_id" = m.id
       LEFT JOIN "users" u ON mo."user_id" = u.id
      ${whereClause}
      ORDER BY mo."start_time" DESC
    `, params);

    // Buscar testes de qualidade para cada operação
    const operationIds = operationsResult.rows.map(row => row.id);
    let qualityTestsResult = { rows: [] };
    
    if (operationIds.length > 0) {
      const placeholders = operationIds.map((_, index) => `$${index + 1}`).join(',');
      qualityTestsResult = await client.query(`
        SELECT 
          id,
          "operationId",
          approved,
          "created_at"
        FROM "QualityTest"
        WHERE "operationId" IN (${placeholders})
      `, operationIds);
    }

    // Mapear resultados
    const operations = operationsResult.rows.map(row => ({
      id: row.id,
      machineId: row.machineId,
      userId: row.userId,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      observations: row.observations,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      machine: {
        name: row.machine_name,
        code: row.machine_code,
        location: row.machine_location
      },
      user: {
        name: row.user_name,
        email: row.user_email
      },
      qualityTests: qualityTestsResult.rows
        .filter(test => test.operationId === row.id)
        .map(test => ({
          id: test.id,
          approved: test.approved,
          createdAt: test.createdAt
        }))
    }));
  } finally {
    client.release();
  }

  // Calcular durações e estatísticas
  const operationsWithDuration = operations.map(op => {
    const duration = op.endTime ? 
      Math.round((op.endTime - op.startTime) / (1000 * 60)) : // em minutos
      Math.round((new Date() - op.startTime) / (1000 * 60));
    
    return {
      ...op,
      duration,
      hasQualityTest: op.qualityTests.length > 0,
      qualityTestsCount: op.qualityTests.length,
      approvedTests: op.qualityTests.filter(t => t.approved).length
    };
  });

  const stats = {
    total: operations.length,
    completed: operations.filter(op => op.status === 'COMPLETED').length,
    running: operations.filter(op => op.status === 'RUNNING').length,
    paused: operations.filter(op => op.status === 'PAUSED').length,
    stopped: operations.filter(op => op.status === 'STOPPED').length,
    withQualityTests: operationsWithDuration.filter(op => op.hasQualityTest).length,
    averageDuration: operationsWithDuration.length > 0 ? 
      Math.round(operationsWithDuration.reduce((sum, op) => sum + op.duration, 0) / operationsWithDuration.length) : 0,
    byMachine: {},
    byUser: {},
    byStatus: {}
  };

  // Agrupar estatísticas
  operationsWithDuration.forEach(op => {
    const machineName = op.machine.name;
    const userName = op.user.name;
    const status = op.status;

    // Por máquina
    if (!stats.byMachine[machineName]) {
      stats.byMachine[machineName] = { total: 0, totalDuration: 0, withTests: 0 };
    }
    stats.byMachine[machineName].total++;
    stats.byMachine[machineName].totalDuration += op.duration;
    if (op.hasQualityTest) stats.byMachine[machineName].withTests++;

    // Por usuário
    if (!stats.byUser[userName]) {
      stats.byUser[userName] = { total: 0, totalDuration: 0, withTests: 0 };
    }
    stats.byUser[userName].total++;
    stats.byUser[userName].totalDuration += op.duration;
    if (op.hasQualityTest) stats.byUser[userName].withTests++;

    // Por status
    if (!stats.byStatus[status]) {
      stats.byStatus[status] = { count: 0, totalDuration: 0 };
    }
    stats.byStatus[status].count++;
    stats.byStatus[status].totalDuration += op.duration;
  });

  if (format === 'csv') {
    const csvHeaders = [
      'Data/Hora Início',
      'Data/Hora Fim',
      'Duração (min)',
      'Máquina',
      'Operador',
      'Status',
      'Testes de Qualidade',
      'Testes Aprovados',
      'Observações'
    ];

    const csvRows = operationsWithDuration.map(op => [
      op.startTime.toLocaleString('pt-BR'),
      op.endTime ? op.endTime.toLocaleString('pt-BR') : 'Em andamento',
      op.duration,
      op.machine.name,
      op.user.name,
      op.status,
      op.qualityTestsCount,
      op.approvedTests,
      op.observations || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-operacoes-maquinas.csv"');
    return res.send('\uFEFF' + csvContent);
  }

  res.json({
    success: true,
    data: {
      operations: operationsWithDuration,
      statistics: stats
    }
  });
}));

// @desc    Relatório de trocas de teflon
// @route   GET /api/reports/teflon-changes
// @access  Private (Leader+)
router.get('/teflon-changes', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('expired').optional().isBoolean().withMessage('Expired deve ser boolean'),
  query('format').optional().isIn(['json', 'csv']).withMessage('Formato deve ser json ou csv')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    startDate,
    endDate,
    machineId,
    expired,
    format = 'json'
  } = req.query;

  const where = {};
  const now = new Date();

  // Filtros de data
  if (startDate || endDate) {
    where.changeDate = {};
    if (startDate) where.changeDate.gte = new Date(startDate);
    if (endDate) where.changeDate.lte = new Date(endDate);
  }

  // Outros filtros
  if (machineId && machineId !== 'all') where.machineId = machineId;
  if (expired === 'true') {
    where.expiryDate = { lt: now };
  } else if (expired === 'false') {
    where.expiryDate = { gte: now };
  }

  // Construir query SQL
  let sql = `
    SELECT 
      tc.*,
      m.name as machine_name,
      m.code as machine_code,
      m.location as machine_location,
      u.name as user_name,
      u.email as user_email
    FROM teflon_changes tc
    LEFT JOIN machines m ON tc.machine_id = m.id
    LEFT JOIN users u ON tc.user_id = u.id
    WHERE 1=1
  `;
  
  const params = [];
  let paramIndex = 1;
  
  // Filtros de data
  if (startDate) {
    sql += ` AND tc.change_date >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }
  if (endDate) {
    sql += ` AND tc.change_date <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }
  
  // Outros filtros
  if (machineId && machineId !== 'all') {
    sql += ` AND tc.machine_id = $${paramIndex}`;
    params.push(machineId);
    paramIndex++;
  }
  if (expired === 'true') {
    sql += ` AND tc.expiry_date < $${paramIndex}`;
    params.push(now);
    paramIndex++;
  } else if (expired === 'false') {
    sql += ` AND tc.expiry_date >= $${paramIndex}`;
    params.push(now);
    paramIndex++;
  }
  
  sql += ` ORDER BY tc.change_date DESC`;
  
  const result = await pool.query(sql, params);
  
  // Mapear resultados para o formato original
  const changes = result.rows.map(row => ({
    id: row.id,
    changeDate: row.change_date,
    expiryDate: row.expiry_date,
    teflonType: row.teflon_type,
    observations: row.observations,
    machineId: row.machine_id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    machine: {
      name: row.machine_name,
      code: row.machine_code,
      location: row.machine_location
    },
    user: {
      name: row.user_name,
      email: row.user_email
    }
  }));

  // Adicionar status e calcular estatísticas
  const changesWithStatus = changes.map(change => {
    const daysUntilExpiry = Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24));
    const isExpired = change.expiryDate < now;
    const isExpiringSoon = !isExpired && daysUntilExpiry <= 7;

    return {
      ...change,
      status: {
        expired: isExpired,
        expiringSoon: isExpiringSoon,
        daysUntilExpiry
      }
    };
  });

  const stats = {
    total: changes.length,
    expired: changesWithStatus.filter(c => c.status.expired).length,
    expiringSoon: changesWithStatus.filter(c => c.status.expiringSoon).length,
    valid: changesWithStatus.filter(c => !c.status.expired && !c.status.expiringSoon).length,
    byMachine: {},
    byUser: {},
    byMonth: {}
  };

  // Agrupar estatísticas
  changesWithStatus.forEach(change => {
    const machineName = change.machine.name;
    const userName = change.user.name;
    const month = change.changeDate ? new Date(change.changeDate).toISOString().substring(0, 7) : 'unknown'; // YYYY-MM

    // Por máquina
    if (!stats.byMachine[machineName]) {
      stats.byMachine[machineName] = { total: 0, expired: 0, expiringSoon: 0 };
    }
    stats.byMachine[machineName].total++;
    if (change.status.expired) stats.byMachine[machineName].expired++;
    if (change.status.expiringSoon) stats.byMachine[machineName].expiringSoon++;

    // Por usuário
    if (!stats.byUser[userName]) {
      stats.byUser[userName] = { total: 0, expired: 0, expiringSoon: 0 };
    }
    stats.byUser[userName].total++;
    if (change.status.expired) stats.byUser[userName].expired++;
    if (change.status.expiringSoon) stats.byUser[userName].expiringSoon++;

    // Por mês
    if (!stats.byMonth[month]) {
      stats.byMonth[month] = { total: 0 };
    }
    stats.byMonth[month].total++;
  });

  if (format === 'csv') {
    const csvHeaders = [
      'Data da Troca',
      'Data de Validade',
      'Máquina',
      'Operador',
      'Tipo de Teflon',
      'Status',
      'Dias até Vencimento',
      'Observações'
    ];

    const csvRows = changesWithStatus.map(change => [
      change.changeDate.toLocaleDateString('pt-BR'),
      change.expiryDate.toLocaleDateString('pt-BR'),
      change.machine.name,
      change.user.name,
      change.teflonType,
      change.status.expired ? 'Expirado' : change.status.expiringSoon ? 'Expirando' : 'Válido',
      change.status.daysUntilExpiry,
      change.observations || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="relatorio-trocas-teflon.csv"');
    return res.send('\uFEFF' + csvContent);
  }

  // Preparar dados para gráfico
  const monthlyData = {};
  changesWithStatus.forEach(change => {
    if (!change.changeDate) return;
    const month = new Date(change.changeDate).toISOString().substring(0, 7); // YYYY-MM
    if (!monthlyData[month]) {
      monthlyData[month] = 0;
    }
    monthlyData[month]++;
  });

  const labels = Object.keys(monthlyData).sort();
  const chartChanges = labels.map(month => monthlyData[month]);

  res.json({
    success: true,
    data: {
      changes: changesWithStatus,
      statistics: stats,
      total: changes.length,
      labels,
      changes: chartChanges
    }
  });
}));

// @desc    Dashboard executivo - Relatório consolidado
// @route   GET /api/reports/executive-dashboard
// @access  Private (Manager+)
router.get('/executive-dashboard', [
  query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Período inválido')
], requireManager, asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  // Calcular datas baseado no período
  const now = new Date();
  let startDate;
  
  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const cacheKey = `executive_dashboard:${period}`;
  let cachedData = await getCache(cacheKey);
  
  if (cachedData) {
    return res.json({
      success: true,
      data: JSON.parse(cachedData),
      cached: true
    });
  }

  // Buscar dados em paralelo usando PostgreSQL
  const client = await pool.connect();
  try {
    const [machinesResult, operationsResult, qualityTestsResult, teflonChangesResult, notificationsResult] = await Promise.all([
      // Máquinas com contagem de operações
      client.query(`
        SELECT 
          m.id,
          m.name,
          m.status,
          m.isActive,
          COUNT(mo.id) as operations_count
        FROM "machines" m
        LEFT JOIN "machine_operations" mo ON m.id = mo."machine_id" AND mo."start_time" >= $1
        GROUP BY m.id, m.name, m.status, m.isActive
      `, [startDate]),
      
      // Operações
      client.query(`
        SELECT 
          id,
          "startTime",
          "endTime",
          status,
          "machine_id",
          "userId"
        FROM "machine_operations"
        WHERE "startTime" >= $1
      `, [startDate]),
      
      // Testes de qualidade
      client.query(`
        SELECT 
          id,
          approved,
          "created_at",
          "machine_id",
          "userId"
        FROM "QualityTest"
        WHERE "created_at" >= $1
      `, [startDate]),
      
      // Trocas de teflon
      client.query(`
        SELECT 
          id,
          "changeDate",
          "expiryDate",
          "machine_id"
        FROM "teflon_changes"
      `),
      
      // Notificações
      client.query(`
        SELECT 
          id,
          type,
          priority,
          read,
          "created_at"
        FROM "notifications"
        WHERE "created_at" >= $1
      `, [startDate])
    ]);

    // Mapear resultados para o formato original
    const machines = machinesResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      isActive: row.isActive,
      _count: {
        operations: parseInt(row.operations_count)
      }
    }));

    const operations = operationsResult.rows.map(row => ({
      id: row.id,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      machineId: row.machineId,
      userId: row.userId
    }));

    const qualityTests = qualityTestsResult.rows.map(row => ({
      id: row.id,
      approved: row.approved,
      createdAt: row.createdAt,
      machineId: row.machineId,
      userId: row.userId
    }));

    const teflonChanges = teflonChangesResult.rows.map(row => ({
      id: row.id,
      changeDate: row.changeDate,
      expiryDate: row.expiryDate,
      machineId: row.machineId
    }));

    const notifications = notificationsResult.rows.map(row => ({
      id: row.id,
      type: row.type,
      priority: row.priority,
      read: row.read,
      createdAt: row.createdAt
    }));
  } finally {
    client.release();
  }

  // Calcular métricas
  const totalOperations = operations.length;
  const completedOperations = operations.filter(op => op.status === 'COMPLETED').length;
  const runningOperations = operations.filter(op => op.status === 'RUNNING').length;
  
  const totalQualityTests = qualityTests.length;
  const approvedTests = qualityTests.filter(test => test.approved).length;
  const approvalRate = totalQualityTests > 0 ? (approvedTests / totalQualityTests * 100).toFixed(1) : 0;
  
  const activeMachines = machines.filter(m => m.isActive).length;
  const runningMachines = machines.filter(m => m.status === 'RUNNING').length;
  
  const expiredTeflon = teflonChanges.filter(t => t.expiryDate < now).length;
  const expiringSoonTeflon = teflonChanges.filter(t => {
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return t.expiryDate >= now && t.expiryDate <= sevenDaysFromNow;
  }).length;
  
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const urgentNotifications = notifications.filter(n => n.priority === 'URGENT').length;

  // Dados para gráficos
  const dailyOperations = {};
  const dailyQualityTests = {};
  
  // Agrupar operações por dia
  operations.forEach(op => {
    if (!op.startTime) return;
    const day = new Date(op.startTime).toISOString().split('T')[0];
    dailyOperations[day] = (dailyOperations[day] || 0) + 1;
  });
  
  // Agrupar testes por dia
  qualityTests.forEach(test => {
    if (!test.createdAt) return;
    const day = new Date(test.createdAt).toISOString().split('T')[0];
    if (!dailyQualityTests[day]) {
      dailyQualityTests[day] = { total: 0, approved: 0, rejected: 0 };
    }
    dailyQualityTests[day].total++;
    if (test.approved) {
      dailyQualityTests[day].approved++;
    } else {
      dailyQualityTests[day].rejected++;
    }
  });

  const dashboardData = {
    period,
    summary: {
      machines: {
        total: machines.length,
        active: activeMachines,
        running: runningMachines,
        utilization: activeMachines > 0 ? (runningMachines / activeMachines * 100).toFixed(1) : 0
      },
      operations: {
        total: totalOperations,
        completed: completedOperations,
        running: runningOperations,
        completionRate: totalOperations > 0 ? (completedOperations / totalOperations * 100).toFixed(1) : 0
      },
      qualityTests: {
        total: totalQualityTests,
        approved: approvedTests,
        rejected: totalQualityTests - approvedTests,
        approvalRate: parseFloat(approvalRate)
      },
      teflon: {
        total: teflonChanges.length,
        expired: expiredTeflon,
        expiringSoon: expiringSoonTeflon,
        alertsNeeded: expiredTeflon + expiringSoonTeflon
      },
      notifications: {
        total: notifications.length,
        unread: unreadNotifications,
        urgent: urgentNotifications
      }
    },
    charts: {
      dailyOperations,
      dailyQualityTests,
      machineUtilization: machines.map(m => ({
        name: m.name,
        operations: m._count.operations,
        status: m.status
      }))
    },
    alerts: {
      expiredTeflon,
      expiringSoonTeflon,
      urgentNotifications,
      operationsWithoutTests: operations.filter(op => {
        return !qualityTests.some(test => test.machineId === op.machineId && 
          Math.abs(test.createdAt - op.startTime) < 30 * 60 * 1000); // 30 minutos
      }).length
    }
  };

  // Cache por 5 minutos
  await setCache(cacheKey, JSON.stringify(dashboardData), 300);

  res.json({
    success: true,
    data: dashboardData
  });
}));

// @desc    Relatório de produtividade por operador
// @route   GET /api/reports/operator-productivity
// @access  Private (Manager+)
router.get('/operator-productivity', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('userId').optional().isInt({ min: 1 }).withMessage('ID do usuário inválido')
], requireManager, asyncHandler(async (req, res) => {
  const { startDate, endDate, userId } = req.query;
  
  const dateFilter = {};
  if (startDate || endDate) {
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
  }

  const userFilter = userId ? { id: userId } : { role: 'OPERATOR' };

  // Construir filtros SQL
  let userWhereClause = 'WHERE 1=1';
  const userParams = [];
  let paramIndex = 1;

  if (userId) {
    userWhereClause += ` AND u.id = $${paramIndex}`;
    userParams.push(userId);
    paramIndex++;
  } else {
    userWhereClause += ` AND u.role = $${paramIndex}`;
    userParams.push('OPERATOR');
    paramIndex++;
  }

  const client = await pool.connect();
  try {
    // Buscar operadores
    const operatorsResult = await client.query(`
      SELECT 
        u.id,
        u.name,
        u.email
      FROM "users" u
      ${userWhereClause}
    `, userParams);

    const operators = [];
    
    for (const operator of operatorsResult.rows) {
      // Buscar operações do operador
      let operationsWhereClause = 'WHERE mo."user_id" = $1';
      const operationsParams = [operator.id];
      let opParamIndex = 2;

      if (startDate) {
        operationsWhereClause += ` AND mo."start_time" >= $${opParamIndex}`;
        operationsParams.push(new Date(startDate));
        opParamIndex++;
      }
      if (endDate) {
        operationsWhereClause += ` AND mo."start_time" <= $${opParamIndex}`;
        operationsParams.push(new Date(endDate));
        opParamIndex++;
      }

      const operationsResult = await client.query(`
        SELECT 
          mo.id,
          mo."start_time",
          mo."end_time",
          mo.status,
          m.name as machine_name
        FROM "MachineOperation" mo
        LEFT JOIN "machines" m ON mo."machine_id" = m.id
        ${operationsWhereClause}
      `, operationsParams);

      // Buscar testes de qualidade do operador
      let testsWhereClause = 'WHERE qt."user_id" = $1';
      const testsParams = [operator.id];
      let testParamIndex = 2;

      if (startDate) {
        testsWhereClause += ` AND qt."created_at" >= $${testParamIndex}`;
        testsParams.push(new Date(startDate));
        testParamIndex++;
      }
      if (endDate) {
        testsWhereClause += ` AND qt."created_at" <= $${testParamIndex}`;
        testsParams.push(new Date(endDate));
        testParamIndex++;
      }

      const testsResult = await client.query(`
        SELECT 
          qt.id,
          qt.approved,
          qt."created_at",
          m.name as machine_name
        FROM "quality_tests" qt
        LEFT JOIN "machines" m ON qt."machine_id" = m.id
        ${testsWhereClause}
      `, testsParams);

      // Buscar trocas de teflon do operador
      let changesWhereClause = 'WHERE tc."user_id" = $1';
      const changesParams = [operator.id];
      let changeParamIndex = 2;

      if (startDate) {
        changesWhereClause += ` AND tc."changeDate" >= $${changeParamIndex}`;
        changesParams.push(new Date(startDate));
        changeParamIndex++;
      }
      if (endDate) {
        changesWhereClause += ` AND tc."changeDate" <= $${changeParamIndex}`;
        changesParams.push(new Date(endDate));
        changeParamIndex++;
      }

      const changesResult = await client.query(`
        SELECT 
          tc.id,
          tc."changeDate",
          m.name as machine_name
        FROM "teflon_changes" tc
        LEFT JOIN "machines" m ON tc."machine_id" = m.id
        ${changesWhereClause}
      `, changesParams);

      // Mapear resultados
      operators.push({
        id: operator.id,
        name: operator.name,
        email: operator.email,
        machineOperations: operationsResult.rows.map(row => ({
          id: row.id,
          startTime: row.startTime,
          endTime: row.endTime,
          status: row.status,
          machine: { name: row.machine_name }
        })),
        qualityTests: testsResult.rows.map(row => ({
          id: row.id,
          approved: row.approved,
          createdAt: row.createdAt,
          machine: { name: row.machine_name }
        })),
        teflonChanges: changesResult.rows.map(row => ({
          id: row.id,
          changeDate: row.changeDate,
          machine: { name: row.machine_name }
        }))
      });
    }
  } finally {
    client.release();
  }

  const productivity = operators.map(operator => {
    const operations = operator.machineOperations;
    const qualityTests = operator.qualityTests;
    const teflonChanges = operator.teflonChanges;

    // Calcular tempo total de operação
    const totalOperationTime = operations.reduce((total, op) => {
      if (op.endTime) {
        return total + (op.endTime - op.startTime);
      }
      return total;
    }, 0);

    const totalOperationHours = totalOperationTime / (1000 * 60 * 60); // em horas

    return {
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email
      },
      metrics: {
        totalOperations: operations.length,
        completedOperations: operations.filter(op => op.status === 'COMPLETED').length,
        totalOperationHours: Math.round(totalOperationHours * 100) / 100,
        averageOperationTime: operations.length > 0 ? 
          Math.round(totalOperationTime / operations.length / (1000 * 60)) : 0, // em minutos
        totalQualityTests: qualityTests.length,
        approvedTests: qualityTests.filter(test => test.approved).length,
        approvalRate: qualityTests.length > 0 ? 
          (qualityTests.filter(test => test.approved).length / qualityTests.length * 100).toFixed(1) : 0,
        teflonChanges: teflonChanges.length,
        testsPerOperation: operations.length > 0 ? 
          (qualityTests.length / operations.length).toFixed(2) : 0
      },
      details: JSON.stringify({
        operations,
        qualityTests,
        teflonChanges
      })
    };
  });

  // Ordenar por produtividade (número de operações completadas)
  productivity.sort((a, b) => b.metrics.completedOperations - a.metrics.completedOperations);

  res.json({
    success: true,
    data: productivity
  });
}));

// @desc    Dados do dashboard principal
// @route   GET /api/reports/dashboard
// @access  Private
router.get('/dashboard', authenticateToken, asyncHandler(async (req, res) => {
  const { timeRange = 'today' } = req.query;
  
  try {
    // Buscar dados reais do banco de dados
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Buscar máquinas com operações ativas
    const machinesQuery = `
      SELECT m.*, 
             mo.id as operation_id, mo.status as operation_status,
             u.name as operator_name, u.id as operator_id
      FROM machines m
      LEFT JOIN machine_operations mo ON m.id = mo.machine_id AND mo.status = 'ACTIVE'
      LEFT JOIN users u ON mo.user_id = u.id
    `;
    const machinesResult = await pool.query(machinesQuery);
    const machines = machinesResult.rows;

    // Buscar testes de qualidade de hoje
    const todayTestsQuery = `
      SELECT qt.*, m.name as machine_name, u.name as user_name
      FROM quality_tests qt
      JOIN machines m ON qt.machine_id = m.id
      JOIN users u ON qt.user_id = u.id
      WHERE qt.test_date >= $1
    `;
    const todayTestsResult = await pool.query(todayTestsQuery, [startOfDay]);
    const todayTests = todayTestsResult.rows;

    // Buscar testes de qualidade da semana
    const weekTestsQuery = `
      SELECT * FROM quality_tests
      WHERE test_date >= $1
    `;
    const weekTestsResult = await pool.query(weekTestsQuery, [startOfWeek]);
    const weekTests = weekTestsResult.rows;

    // Calcular métricas de produção
    const totalProduction = todayTests.length;
    const targetProduction = machines.length * 20; // Meta: 20 testes por máquina por dia
    const weekProduction = weekTests.length;
    const lastWeekProduction = Math.max(weekProduction - totalProduction, 0);
    const productionChange = lastWeekProduction > 0 ? ((totalProduction - lastWeekProduction) / lastWeekProduction) * 100 : 0;

    // Calcular métricas de qualidade
    const approvedTests = todayTests.filter(t => t.approved).length;
    const passRate = todayTests.length > 0 ? (approvedTests / todayTests.length) * 100 : 0;
    const weekApproved = weekTests.filter(t => t.approved).length;
    const weekPassRate = weekTests.length > 0 ? (weekApproved / weekTests.length) * 100 : 0;
    const qualityChange = weekPassRate > 0 ? passRate - weekPassRate : 0;

    // Calcular eficiência geral
    const runningMachines = machines.filter(m => m.status === 'RUNNING');
    const overallEfficiency = machines.length > 0 ? (runningMachines.length / machines.length) * 100 : 0;
    // Calcular mudança de eficiência comparando com período anterior
    const previousWeekStart = new Date(startOfWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWeekTestsQuery = `
      SELECT * FROM quality_tests
      WHERE test_date >= $1 AND test_date < $2
    `;
    const previousWeekTestsResult = await pool.query(previousWeekTestsQuery, [previousWeekStart, startOfWeek]);
    const previousWeekTests = previousWeekTestsResult.rows;
    
    const previousWeekApproved = previousWeekTests.filter(test => test.approved).length;
    const previousWeekEfficiency = previousWeekTests.length > 0 ? (previousWeekApproved / previousWeekTests.length) * 100 : 0;
    const efficiencyChange = overallEfficiency - previousWeekEfficiency;

    // Estatísticas das máquinas
    const machineStats = {
      total: machines.length,
      running: machines.filter(m => m.status === 'RUNNING').length,
      stopped: machines.filter(m => m.status === 'STOPPED').length,
      maintenance: machines.filter(m => m.status === 'MAINTENANCE').length,
      error: machines.filter(m => m.status === 'ERROR').length
    };

    // Atividades recentes baseadas em testes reais
    const recentActivities = todayTests
      .slice(-10)
      .map(test => ({
        id: test.id.toString(),
        type: 'quality_test',
        message: `Teste de qualidade ${test.approved ? 'aprovado' : 'reprovado'} na ${test.machine_name}`,
        user: test.user_name,
        timestamp: test.test_date,
        status: test.approved ? 'success' : 'error'
      }))
      .reverse();

    const executiveData = {
      production: {
        total: totalProduction,
        target: targetProduction,
        change: Math.round(productionChange * 10) / 10,
        trend: productionChange >= 0 ? 'up' : 'down'
      },
      quality: {
        passRate: Math.round(passRate * 10) / 10,
        target: 95.0,
        change: Math.round(qualityChange * 10) / 10,
        trend: qualityChange >= 0 ? 'up' : 'down'
      },
      efficiency: {
        overall: Math.round(overallEfficiency * 10) / 10,
        target: 90.0,
        change: efficiencyChange,
        trend: 'up'
      },
      downtime: {
        total: machineStats.total - machineStats.running,
        target: Math.round(machineStats.total * 0.1), // Meta: máximo 10% de downtime
        change: Math.round((passRate - weekPassRate) * 10) / 10,
        trend: 'up'
      },
      machineStats,
      recentActivities
    };

    res.json({
      success: true,
      data: executiveData
    });
  } catch (error) {
    console.error('Erro no dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}));



// Endpoint para dados do dashboard do líder
router.get('/leader-dashboard', requireLeader, asyncHandler(async (req, res) => {
  const { timeRange = 'today' } = req.query;
  
  // Calcular período baseado no timeRange
  const now = new Date();
  let startDate, endDate = now;
  
  switch (timeRange) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // Buscar dados reais das máquinas
  const machinesQuery = `SELECT * FROM "machines"`;
  const machinesResult = await pool.query(machinesQuery);
  const machines = machinesResult.rows;
  
  // Buscar operações ativas com dados dos usuários
  const operationsQuery = `
    SELECT 
      mo.*,
      u.name as user_name,
      u.id as user_id,
      m.name as machine_name,
      m.code as machine_code
    FROM "machine_operations" mo
    JOIN "users" u ON mo."user_id" = u.id
    JOIN "machines" m ON mo."machine_id" = m.id
    WHERE mo."end_time" IS NULL
    ORDER BY mo."start_time" DESC
  `;
  const operationsResult = await pool.query(operationsQuery);
  const activeOperations = operationsResult.rows;
  
  // Buscar testes de qualidade reais do período
  const qualityTestsQuery = `
    SELECT 
      qt.*,
      u.name as user_name,
      m.name as machine_name
    FROM "quality_tests" qt
    JOIN "users" u ON qt."user_id" = u.id
    JOIN "machines" m ON qt."machine_id" = m.id
    WHERE qt."created_at" >= $1 AND qt."created_at" <= $2
    ORDER BY qt."created_at" DESC
  `;
  const qualityTestsResult = await pool.query(qualityTestsQuery, [startDate, endDate]);
  const qualityTests = qualityTestsResult.rows;
  
  // Calcular métricas reais baseadas nos dados
  const totalTests = qualityTests.length;
  const qualityScore = totalTests > 0 ? 85 : 0; // Placeholder até termos coluna approved
  
  // Calcular métricas da equipe baseadas em operações reais
  const totalOperators = activeOperations.length;
  const activeOperators = activeOperations.filter(op => {
    const machine = machines.find(m => m.id === op.machineId);
    return machine && machine.status === 'RUNNING';
  }).length;
  
  // Calcular eficiência média usando OEE service
  const runningMachines = machines.filter(m => m.status === 'RUNNING');
  let avgEfficiency = 0;
  if (runningMachines.length > 0) {
    // Calcular OEE para cada máquina em funcionamento
    const oeePromises = runningMachines.map(async (machine) => {
      try {
         const oeeData = await calculateCurrentShiftOEE(machine.id);
         return oeeData.oee; // OEE já vem em porcentagem
       } catch (error) {
         console.error(`Erro ao calcular OEE para máquina ${machine.id}:`, error);
         return 0;
       }
    });
    
    const oeeResults = await Promise.all(oeePromises);
    avgEfficiency = oeeResults.reduce((sum, oee) => sum + oee, 0) / oeeResults.length;
  }

  // Calcular produção atual baseada em testes reais
  const currentProduction = totalTests;
  const targetProduction = machines.length * 10; // Meta ajustada: 10 testes por máquina no período

    // Preparar dados da equipe baseados em operações reais
    const teamMembersPromises = activeOperations.map(async (operation, index) => {
      let efficiency = 0;
      try {
         const oeeData = await calculateCurrentShiftOEE(operation.machineId);
         efficiency = Math.round(oeeData.oee);
       } catch (error) {
         console.error(`Erro ao calcular OEE para máquina ${operation.machineId}:`, error);
         efficiency = 0;
       }
      
      const machine = machines.find(m => m.id === operation.machineId);
      
      return {
        id: `user_${operation.user_id}_machine_${operation.machineId}_${index}`,
        name: operation.user_name,
        role: 'Operador(a)',
        machine: operation.machine_code || operation.machine_name,
        status: machine && machine.status === 'RUNNING' ? 'active' : 'inactive',
        efficiency: efficiency,
        lastActivity: operation.startTime
      };
    });
    
    const teamMembers = await Promise.all(teamMembersPromises);

    // Preparar dados das máquinas supervisionadas com eficiência OEE
    const supervisedMachinesPromises = machines.map(async (m) => {
      let efficiency = 0;
      try {
         const oeeData = await calculateCurrentShiftOEE(m.id);
         efficiency = Math.round(oeeData.oee);
       } catch (error) {
         console.error(`Erro ao calcular OEE para máquina ${m.id}:`, error);
         efficiency = 0;
       }
      
      // Encontrar operação ativa para esta máquina
      const activeOperation = activeOperations.find(op => op.machineId === m.id);
      
      return {
        id: m.id,
        name: m.name,
        status: m.status,
        efficiency: efficiency,
        operator: activeOperation ? activeOperation.user_name : null
      };
    });
    
    const supervisedMachines = await Promise.all(supervisedMachinesPromises);

    // Buscar notificações reais do banco
    const recentNotificationsQuery = `
      SELECT 
        n.*
      FROM "notifications" n
      WHERE n."created_at" >= $1
      ORDER BY n."created_at" DESC
      LIMIT 10
    `;
    const recentNotificationsResult = await pool.query(recentNotificationsQuery, [new Date(Date.now() - 24 * 60 * 60 * 1000)]);
    const notifications = recentNotificationsResult.rows;
    
    // Converter notificações reais em alertas
    const recentAlerts = notifications.map((notification, index) => ({
      id: notification.id.toString(),
      type: 'notification',
      severity: 'medium',
      message: notification.message,
      machine: 'Sistema',
      timestamp: notification.createdAt,
      status: 'active'
    }));
    
    // Adicionar alertas baseados em condições reais das máquinas
    const problemMachines = machines.filter(m => m.status === 'ERROR' || m.status === 'MAINTENANCE');
    problemMachines.forEach((machine, index) => {
      const timestamp = new Date();
      recentAlerts.push({
        id: `machine_${machine.id}_${machine.status.toLowerCase()}_${timestamp.getTime()}_${index}`,
        type: machine.status === 'ERROR' ? 'error' : 'maintenance',
        severity: machine.status === 'ERROR' ? 'high' : 'medium',
        message: machine.status === 'ERROR' ? `Erro detectado na máquina ${machine.name}` : `Manutenção programada para ${machine.name}`,
        machine: machine.code || machine.name,
        timestamp: timestamp,
        status: 'active'
      });
    });
    
    // Adicionar alerta de eficiência baixa baseado em dados reais
    if (avgEfficiency > 0 && avgEfficiency < 70) {
      recentAlerts.push({
        id: 'efficiency_alert_real',
        type: 'efficiency',
        severity: 'medium',
        message: `Eficiência da equipe abaixo da meta (${Math.round(avgEfficiency)}%)`,
        machine: 'Geral',
        timestamp: new Date(),
        status: 'active'
      });
    }

    // Calcular tempo de parada baseado em dados reais
    const downtimeMachines = machines.filter(m => m.status === 'STOPPED' || m.status === 'ERROR' || m.status === 'MAINTENANCE');
    const downtimeMinutes = downtimeMachines.length * 30; // Estimativa baseada no número real de máquinas paradas

    // Calcular mudanças percentuais comparando com período anterior
    const previousPeriod = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
    const previousQualityTestsQuery = `
      SELECT * FROM "quality_tests"
      WHERE "created_at" >= $1 AND "created_at" < $2
    `;
    const previousQualityTestsResult = await pool.query(previousQualityTestsQuery, [previousPeriod, startDate]);
    const previousQualityTests = previousQualityTestsResult.rows;

    // Calcular mudanças baseadas em dados reais
    const previousProduction = previousQualityTests.length;
    const productionChange = previousProduction > 0 ? ((currentProduction - previousProduction) / previousProduction) * 100 : 0;
    const qualityChange = 0; // Placeholder até termos dados de aprovação reais
    const efficiencyChange = 0; // Placeholder para mudança de eficiência

    const leaderData = {
      realTimeMetrics: {
        teamProduction: currentProduction,
        teamEfficiency: Math.round(avgEfficiency),
        activeMachines: runningMachines.length,
        qualityRate: Math.round(qualityScore),
        downtimeMinutes: downtimeMinutes
      },
      teamPerformance: {
        totalOperators,
        activeOperators,
        efficiency: Math.round(avgEfficiency * 10) / 10,
        qualityScore: Math.round(qualityScore * 10) / 10,
        target: 90,
        change: Math.round(efficiencyChange * 10) / 10,
        trend: efficiencyChange >= 0 ? 'up' : 'down'
      },
      shiftMetrics: {
        production: {
          current: currentProduction,
          target: targetProduction,
          percentage: targetProduction > 0 ? Math.round((currentProduction / targetProduction) * 100 * 10) / 10 : 0,
          change: Math.round(productionChange * 10) / 10,
          trend: productionChange >= 0 ? 'up' : 'down'
        },
        quality: {
          passRate: Math.round(qualityScore * 10) / 10,
          target: 95.0,
          defects: Math.floor(totalTests * 0.15), // Estimativa de 15% de defeitos
          change: Math.round(qualityChange * 10) / 10,
          trend: qualityChange >= 0 ? 'up' : 'down'
        },
        downtime: {
          total: downtimeMachines.length,
          planned: machines.filter(m => m.status === 'MAINTENANCE').length,
          unplanned: machines.filter(m => m.status === 'ERROR').length,
          target: Math.round(machines.length * 0.1), // Meta: máximo 10% das máquinas em downtime
          change: 0, // Placeholder
          trend: 'down'
        }
      },
      alerts: {
        critical: recentAlerts.filter(a => a.severity === 'high').length,
        warning: recentAlerts.filter(a => a.severity === 'medium').length,
        info: recentAlerts.filter(a => a.severity === 'low').length
      },
      teamMembers,
      supervisedMachines,
      recentAlerts
    };

    res.json({
      success: true,
      data: leaderData
    });
}));

// @desc    Dados de manutenção para relatórios
// @route   GET /api/reports/maintenance-data
// @access  Manager
router.get('/maintenance-data', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().isString().withMessage('ID da máquina inválido')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (machineId && machineId !== 'all') where.machineId = machineId;

  // Construir filtros SQL
  let whereClause = 'WHERE n.type IN ($1, $2)';
  const params = ['MAINTENANCE', 'MACHINE_STATUS'];
  let paramIndex = 3;

  if (startDate) {
    whereClause += ` AND n."created_at" >= $${paramIndex}`;
    params.push(new Date(startDate));
    paramIndex++;
  }
  if (endDate) {
    whereClause += ` AND n."created_at" <= $${paramIndex}`;
    params.push(new Date(endDate));
    paramIndex++;
  }
  if (machineId && machineId !== 'all') {
    whereClause += ` AND n."machine_id" = $${paramIndex}`;
    params.push(machineId);
    paramIndex++;
  }

  const client = await pool.connect();
  try {
    // Buscar notificações de manutenção
    const notificationsResult = await client.query(`
      SELECT 
        n.id,
        n.message,
        n.type,
        n."created_at",
        n."machine_id",
        m.name as machine_name
      FROM "notifications" n
      LEFT JOIN "machines" m ON n."machine_id" = m.id
      ${whereClause}
      ORDER BY n."created_at" DESC
    `, params);

    const maintenanceNotifications = notificationsResult.rows.map(row => ({
      id: row.id,
      message: row.message,
      type: row.type,
      createdAt: row.createdAt,
      machineId: row.machineId,
      machine: { name: row.machine_name }
    }));

    // Buscar máquinas em manutenção
    const machinesResult = await client.query(`
      SELECT 
        id,
        name,
        status,
        "lastMaintenance"
      FROM "machines"
      WHERE status = 'MAINTENANCE'
    `);

    const machinesInMaintenance = machinesResult.rows;
  } finally {
    client.release();
  }

  // Calcular métricas
  const totalMaintenance = maintenanceNotifications.length;
  const preventive = maintenanceNotifications.filter(n => n.message.includes('preventiva')).length;
  const corrective = totalMaintenance - preventive;
  const avgDowntime = machinesInMaintenance.length > 0 ? 2.8 : 0; // Valor estimado
  const maintenanceCost = totalMaintenance * 2500; // Custo estimado por manutenção

  // Agrupar por máquina
  const maintenanceByMachine = {};
  maintenanceNotifications.forEach(notification => {
    const machineName = notification.machine?.name || 'Desconhecida';
    if (!maintenanceByMachine[machineName]) {
      maintenanceByMachine[machineName] = {
        machine: machineName,
        preventive: 0,
        corrective: 0,
        cost: 0
      };
    }
    if (notification.message.includes('preventiva')) {
      maintenanceByMachine[machineName].preventive++;
    } else {
      maintenanceByMachine[machineName].corrective++;
    }
    maintenanceByMachine[machineName].cost += 2500;
  });

  // Agrupar por data para tendência
  const dailyData = {};
  maintenanceNotifications.forEach(notification => {
    if (!notification.createdAt) return;
    const date = new Date(notification.createdAt).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = { downtime: 0, maintenance: 0 };
    }
    dailyData[date].maintenance++;
    dailyData[date].downtime += 2.1; // Tempo médio estimado
  });

  const labels = Object.keys(dailyData).sort();
  const downtimeTrend = labels.map(date => ({
    date,
    downtime: dailyData[date].downtime,
    maintenance: dailyData[date].maintenance
  }));

  res.json({
    success: true,
    data: {
      totalMaintenance,
      preventive,
      corrective,
      avgDowntime,
      maintenanceCost,
      plannedVsUnplanned: {
        planned: preventive > 0 ? Math.round((preventive / totalMaintenance) * 100) : 0,
        unplanned: corrective > 0 ? Math.round((corrective / totalMaintenance) * 100) : 0
      },
      maintenanceByMachine: Object.values(maintenanceByMachine),
      downtimeTrend
    }
  });
}));

// @desc    Relatório agregado de qualidade com estatísticas detalhadas
// @route   GET /api/reports/quality-summary
// @access  Private (Leader+)
router.get('/quality-summary', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineId } = req.query;
  const where = {};

  // Filtros de data
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  if (machineId && machineId !== 'all') where.machineId = machineId;

  // Construir query SQL baseada nos filtros
  let whereClause = 'WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;

  if (startDate) {
    whereClause += ` AND qt."created_at" >= $${paramIndex}`;
    queryParams.push(new Date(startDate));
    paramIndex++;
  }

  if (endDate) {
    whereClause += ` AND qt."created_at" <= $${paramIndex}`;
    queryParams.push(new Date(endDate));
    paramIndex++;
  }

  if (machineId && machineId !== 'all') {
    whereClause += ` AND qt."machine_id" = $${paramIndex}`;
    queryParams.push(parseInt(machineId));
    paramIndex++;
  }

  // Buscar todos os testes com informações das máquinas
  const testsResult = await pool.query(`
    SELECT 
      qt.*,
      m.id as machine_id, m.name as machine_name, m.code as machine_code, m.location as machine_location,
      u.id as user_id, u.name as user_name, u.email as user_email
    FROM "QualityTest" qt
    LEFT JOIN "machines" m ON qt."machine_id" = m.id
    LEFT JOIN users u ON qt."user_id" = u.id
    ${whereClause}
    ORDER BY qt."created_at" DESC
  `, queryParams);

  // Mapear resultados para estrutura esperada
  const tests = testsResult.rows.map(row => ({
    ...row,
    machine: row.machine_id ? {
      id: row.machine_id,
      name: row.machine_name,
      code: row.machine_code,
      location: row.machine_location
    } : null,
    user: row.user_id ? {
      id: row.user_id,
      name: row.user_name,
      email: row.user_email
    } : null
  }));

  // Remover campos duplicados
  tests.forEach(test => {
    delete test.machine_id;
    delete test.machine_name;
    delete test.machine_code;
    delete test.machine_location;
    delete test.user_id;
    delete test.user_name;
    delete test.user_email;
  });

  // Estatísticas gerais
  const totalTests = tests.length;
  const approvedTests = tests.filter(t => t.approved).length;
  const rejectedTests = tests.filter(t => !t.approved).length;
  const approvalRate = totalTests > 0 ? Math.round((approvedTests / totalTests) * 100) : 0;

  // Estatísticas por máquina
  const machineStats = {};
  tests.forEach(test => {
    const machineId = test.machine.id;
    if (!machineStats[machineId]) {
      machineStats[machineId] = {
        machine: test.machine,
        total: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0,
        lastTest: null
      };
    }
    
    machineStats[machineId].total++;
    if (test.approved) {
      machineStats[machineId].approved++;
    } else {
      machineStats[machineId].rejected++;
    }
    
    // Atualizar último teste
    if (!machineStats[machineId].lastTest || test.createdAt > machineStats[machineId].lastTest) {
      machineStats[machineId].lastTest = test.createdAt;
    }
  });

  // Calcular taxa de aprovação por máquina
  Object.keys(machineStats).forEach(machineId => {
    const stats = machineStats[machineId];
    stats.approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  });

  // Estatísticas por operador
  const operatorStats = {};
  tests.forEach(test => {
    const userId = test.user.id;
    if (!operatorStats[userId]) {
      operatorStats[userId] = {
        user: test.user,
        total: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0
      };
    }
    
    operatorStats[userId].total++;
    if (test.approved) {
      operatorStats[userId].approved++;
    } else {
      operatorStats[userId].rejected++;
    }
  });

  // Calcular taxa de aprovação por operador
  Object.keys(operatorStats).forEach(userId => {
    const stats = operatorStats[userId];
    stats.approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  });

  // Estatísticas por período (últimos 7 dias)
  const dailyStats = {};
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  
  tests
    .filter(test => test.createdAt >= last7Days)
    .forEach(test => {
      if (!test.createdAt) return;
      const date = new Date(test.createdAt).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          total: 0,
          approved: 0,
          rejected: 0,
          approvalRate: 0
        };
      }
      
      dailyStats[date].total++;
      if (test.approved) {
        dailyStats[date].approved++;
      } else {
        dailyStats[date].rejected++;
      }
    });

  // Calcular taxa de aprovação diária
  Object.keys(dailyStats).forEach(date => {
    const stats = dailyStats[date];
    stats.approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  });

  // Testes mais recentes
  const recentTests = tests.slice(0, 10).map(test => ({
    id: test.id,
    product: test.product,
    lot: test.lot,
    machine: test.machine.name,
    operator: test.user.name,
    approved: test.approved,
    testDate: test.testDate,
    createdAt: test.createdAt
  }));

  res.json({
    success: true,
    data: {
      summary: {
        totalTests,
        approvedTests,
        rejectedTests,
        approvalRate,
        period: {
          startDate: startDate || 'Início',
          endDate: endDate || 'Hoje'
        }
      },
      machineStats: Object.values(machineStats),
      operatorStats: Object.values(operatorStats),
      dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
      recentTests
    }
  });
}));

// @desc    Obter dados OEE agregados para dashboard
// @route   GET /api/reports/oee-summary
// @access  Private (Manager+)
router.get('/oee-summary', [
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('machineIds').optional().isString().withMessage('IDs das máquinas inválidos')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { startDate, endDate, machineIds } = req.query;
  
  try {
    let oeeData;
    
    if (machineIds && machineIds !== 'all') {
      // Calcular OEE para máquinas específicas
      const machineIdArray = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      oeeData = await calculateMultipleOEE(machineIdArray, startDate, endDate);
    } else {
      // Buscar todas as máquinas ativas
      const machinesQuery = `
        SELECT id 
        FROM machines 
        WHERE is_active = true
      `;
      const machinesResult = await pool.query(machinesQuery);
      const allMachineIds = machinesResult.rows.map(m => m.id);
      oeeData = await calculateMultipleOEE(allMachineIds, startDate, endDate);
    }
    
    // Calcular médias gerais
    const totalMachines = oeeData.length;
    const averageOEE = totalMachines > 0 
      ? oeeData.reduce((sum, machine) => sum + machine.oee, 0) / totalMachines 
      : 0;
    const averageAvailability = totalMachines > 0 
      ? oeeData.reduce((sum, machine) => sum + machine.availability, 0) / totalMachines 
      : 0;
    const averagePerformance = totalMachines > 0 
      ? oeeData.reduce((sum, machine) => sum + machine.performance, 0) / totalMachines 
      : 0;
    const averageQuality = totalMachines > 0 
      ? oeeData.reduce((sum, machine) => sum + machine.quality, 0) / totalMachines 
      : 0;
    
    res.json({
      success: true,
      data: {
        summary: {
          totalMachines,
          averageOEE: Math.round(averageOEE * 100) / 100,
          averageAvailability: Math.round(averageAvailability * 100) / 100,
          averagePerformance: Math.round(averagePerformance * 100) / 100,
          averageQuality: Math.round(averageQuality * 100) / 100
        },
        machines: oeeData
      }
    });
  } catch (error) {
    console.error('Erro ao calcular OEE summary:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao calcular OEE'
    });
  }
}));

// @desc    Obter eficiência atual do turno para dashboard
// @route   GET /api/reports/current-shift-efficiency
// @access  Private (Leader+)
router.get('/current-shift-efficiency', requireLeader, asyncHandler(async (req, res) => {
  try {
    // Buscar todas as máquinas ativas
    const machinesQuery = `
      SELECT id, name 
      FROM machines 
      WHERE is_active = true
    `;
    const machinesResult = await pool.query(machinesQuery);
    const machines = machinesResult.rows;
    
    const efficiencyData = [];
    
    for (const machine of machines) {
      try {
        const oeeData = await calculateCurrentShiftOEE(machine.id);
        efficiencyData.push({
          machineId: machine.id,
          machineName: machine.name,
          efficiency: Math.round(oeeData.oee), // OEE já vem em porcentagem
          availability: Math.round(oeeData.availability?.percentage || 0),
          performance: Math.round(oeeData.performance?.percentage || 0),
          quality: Math.round(oeeData.quality?.percentage || 0)
        });
      } catch (error) {
        console.error(`Erro ao calcular OEE para máquina ${machine.id}:`, error);
        // Adicionar dados padrão em caso de erro
        efficiencyData.push({
          machineId: machine.id,
          machineName: machine.name,
          efficiency: 0,
          availability: 0,
          performance: 0,
          quality: 0
        });
      }
    }
    
    // Calcular eficiência média
    const averageEfficiency = efficiencyData.length > 0 
      ? Math.round(efficiencyData.reduce((sum, machine) => sum + machine.efficiency, 0) / efficiencyData.length)
      : 0;
    
    res.json({
      success: true,
      data: {
        averageEfficiency,
        machines: efficiencyData
      }
    });
  } catch (error) {
    console.error('Erro ao obter eficiência do turno atual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao obter eficiência'
    });
  }
}));

// @desc    Obter dados de OEE do turno atual (agregado)
// @route   GET /api/reports/oee/current-shift
// @access  Private
router.get('/oee/current-shift', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Buscar todas as máquinas ativas
    const machinesQuery = `
      SELECT id, name 
      FROM machines 
      WHERE is_active = true
    `;
    const machinesResult = await pool.query(machinesQuery);
    const machines = machinesResult.rows;
    
    if (machines.length === 0) {
      return res.json({
        success: true,
        data: {
          oee: 0,
          availability: 0,
          performance: 0,
          quality: 0,
          shiftType: 'Atual',
          machineCount: 0
        }
      });
    }
    
    // Calcular OEE médio de todas as máquinas
    let totalOEE = 0;
    let totalAvailability = 0;
    let totalPerformance = 0;
    let totalQuality = 0;
    let validMachines = 0;
    
    for (const machine of machines) {
      try {
        const oeeData = await calculateCurrentShiftOEE(machine.id);
        if (oeeData && typeof oeeData.oee === 'number') {
          totalOEE += oeeData.oee;
          totalAvailability += oeeData.availability?.percentage || 0;
          totalPerformance += oeeData.performance?.percentage || 0;
          totalQuality += oeeData.quality?.percentage || 0;
          validMachines++;
        }
      } catch (error) {
        console.error(`Erro ao calcular OEE para máquina ${machine.id}:`, error);
      }
    }
    
    // Determinar tipo de turno atual
    const now = new Date();
    const hour = now.getHours();
    let shiftType = 'Noite';
    
    if (hour >= 6 && hour < 14) {
      shiftType = 'Manhã';
    } else if (hour >= 14 && hour < 22) {
      shiftType = 'Tarde';
    }
    
    const avgOEE = validMachines > 0 ? totalOEE / validMachines : 0;
    const avgAvailability = validMachines > 0 ? totalAvailability / validMachines : 0;
    const avgPerformance = validMachines > 0 ? totalPerformance / validMachines : 0;
    const avgQuality = validMachines > 0 ? totalQuality / validMachines : 0;
    
    res.json({
      success: true,
      data: {
        oee: Math.round(avgOEE * 100) / 100,
        availability: Math.round(avgAvailability * 100) / 100,
        performance: Math.round(avgPerformance * 100) / 100,
        quality: Math.round(avgQuality * 100) / 100,
        shiftType,
        machineCount: validMachines
      }
    });
  } catch (error) {
    console.error('Erro ao obter dados de OEE do turno atual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao obter dados de OEE'
    });
  }
}));

module.exports = router;