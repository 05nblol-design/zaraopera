const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const pool = require('../config/database');
const { requireOperator, requireLeader } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');
const notificationService = require('../services/notificationService');

const router = express.Router();

// @desc    Listar testes de qualidade
// @route   GET /api/quality-tests
// @access  Private (Operator+)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('approved').optional().isBoolean().withMessage('Approved deve ser boolean'),
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== Erros de validação ===');
    console.log('Errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const {
    page = 1,
    limit = 20,
    machineId,
    approved,
    startDate,
    endDate,
    product,
    lot
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  // Construir query SQL dinamicamente
  let whereConditions = [];
  let queryParams = [];
  let paramIndex = 1;
  
  if (machineId) {
    whereConditions.push(`qt.machine_id = $${paramIndex}`);
    queryParams.push(machineId);
    paramIndex++;
  }
  
  if (approved !== undefined) {
    whereConditions.push(`qt.approved = $${paramIndex}`);
    queryParams.push(approved === 'true');
    paramIndex++;
  }
  
  if (product) {
    whereConditions.push(`qt.product ILIKE $${paramIndex}`);
    queryParams.push(`%${product}%`);
    paramIndex++;
  }
  
  if (lot) {
    whereConditions.push(`qt.lot ILIKE $${paramIndex}`);
    queryParams.push(`%${lot}%`);
    paramIndex++;
  }
  
  if (startDate) {
    whereConditions.push(`qt.test_date >= $${paramIndex}`);
    queryParams.push(new Date(startDate));
    paramIndex++;
  }
  
  if (endDate) {
    whereConditions.push(`qt.test_date <= $${paramIndex}`);
    queryParams.push(new Date(endDate));
    paramIndex++;
  }
  
  // Se for operador, mostrar apenas seus testes
  if (req.user.role === 'OPERATOR') {
    whereConditions.push(`qt.user_id = $${paramIndex}`);
    queryParams.push(req.user.id);
    paramIndex++;
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // Query para buscar testes com JOIN
  const testsQuery = `
    SELECT 
      qt.*,
      m.name as machine_name,
      m.code as machine_code,
      u.name as user_name,
      u.email as user_email
    FROM quality_tests qt
    LEFT JOIN machines m ON qt.machine_id = m.id
    LEFT JOIN users u ON qt.user_id = u.id
    ${whereClause}
    ORDER BY qt.test_date DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  
  // Query para contar total
  const countQuery = `
    SELECT COUNT(*) as total
    FROM quality_tests qt
    ${whereClause}
  `;
  
  const [testsResult, countResult] = await Promise.all([
    pool.query(testsQuery, [...queryParams, parseInt(limit), offset]),
    pool.query(countQuery, queryParams)
  ]);
  
  // Mapear resultados para formato esperado
  const tests = testsResult.rows.map(row => ({
    ...row,
    machine: {
      name: row.machine_name,
      code: row.machine_code
    },
    user: {
      name: row.user_name,
      email: row.user_email
    }
  }));
  
  const total = parseInt(countResult.rows[0].total);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: tests,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    }
  });
}));

// @desc    Obter teste de qualidade por ID
// @route   GET /api/quality-tests/:id
// @access  Private (Operator+)
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID do teste inválido')
], requireOperator, asyncHandler(async (req, res) => {
  // Debug: Log received data
  console.log('=== GET /api/quality-tests/:id - Dados recebidos ===');
  console.log('req.params.id:', req.params.id);
  
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== Erros de validação ===');
    console.log('errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  
  // Construir query com condições
  let whereConditions = ['qt.id = $1'];
  let queryParams = [parseInt(id)];
  let paramIndex = 2;
  
  // Se for operador, só pode ver seus próprios testes
  if (req.user.role === 'OPERATOR') {
    whereConditions.push(`qt.user_id = $${paramIndex}`);
    queryParams.push(req.user.id);
    paramIndex++;
  }
  
  const testQuery = `
    SELECT 
      qt.*,
      m.name as machine_name,
      m.code as machine_code,
      m.location as machine_location,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role
    FROM quality_tests qt
    LEFT JOIN machines m ON qt.machine_id = m.id
    LEFT JOIN users u ON qt.user_id = u.id
    WHERE ${whereConditions.join(' AND ')}
    LIMIT 1
  `;
  
  const testResult = await pool.query(testQuery, queryParams);
  const testRow = testResult.rows[0];
  
  if (!testRow) {
    throw new AppError('Teste não encontrado', 404, 'TEST_NOT_FOUND');
  }
  
  // Mapear resultado para formato esperado
  const test = {
    ...testRow,
    machine: {
      name: testRow.machine_name,
      code: testRow.machine_code,
      location: testRow.machine_location
    },
    user: {
      name: testRow.user_name,
      email: testRow.user_email,
      role: testRow.user_role
    }
  };

  res.json({
    success: true,
    data: test
  });
}));

// @desc    Criar novo teste de qualidade
// @route   POST /api/quality-tests
// @access  Private (Operator+)
router.post('/', [
  // Log dos dados recebidos para debug
  (req, res, next) => {
    console.log('=== POST /api/quality-tests - Dados recebidos ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));
    next();
  },
  body('machineId')
    .notEmpty()
    .withMessage('ID da máquina é obrigatório')
    .custom((value) => {
      // Aceitar tanto IDs inteiros quanto ObjectIds
      if (typeof value === 'string' && value.trim() === '') {
        throw new Error('ID da máquina não pode estar vazio');
      }
      return true;
    }),
  body('product')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Produto é obrigatório'),
  body('lot')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Lote é obrigatório'),
  body('boxNumber')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Número da caixa é obrigatório'),
  body('packageSize')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Tamanho da embalagem é obrigatório'),
  body('packageWidth')
    .isFloat({ min: 0 })
    .withMessage('Largura da embalagem deve ser um número positivo'),
  body('bottomSize')
    .isFloat({ min: 0 })
    .withMessage('Tamanho do fundo deve ser um número positivo'),
  body('sideSize')
    .isFloat({ min: 0 })
    .withMessage('Tamanho da lateral deve ser um número positivo'),
  body('zipperDistance')
    .isFloat({ min: 0 })
    .withMessage('Distância do zíper deve ser um número positivo'),
  body('facilitatorDistance')
    .isFloat({ min: 0 })
    .withMessage('Distância do facilitador deve ser um número positivo'),
  body('rulerTestDone')
    .isBoolean()
    .withMessage('Teste da régua deve ser boolean'),
  body('hermeticityTestDone')
    .isBoolean()
    .withMessage('Teste de hermeticidade deve ser boolean'),
  // Validação dos novos campos de inspeção de qualidade
  body('visualInspection')
    .optional()
    .isBoolean()
    .withMessage('Inspeção visual deve ser boolean'),
  body('dimensionalCheck')
    .optional()
    .isBoolean()
    .withMessage('Verificação dimensional deve ser boolean'),
  body('colorConsistency')
    .optional()
    .isBoolean()
    .withMessage('Consistência de cor deve ser boolean'),
  body('surfaceQuality')
    .optional()
    .isBoolean()
    .withMessage('Qualidade da superfície deve ser boolean'),
  body('adhesionTest')
    .optional()
    .isBoolean()
    .withMessage('Teste de aderência deve ser boolean'),
  body('approved')
    .isBoolean()
    .withMessage('Aprovado deve ser boolean'),
  body('observations')
    .optional()
    .trim(),
  body('images')
    .isArray()
    .withMessage('Imagens deve ser um array')
    .custom((images) => {
      if (images.length === 0) {
        throw new Error('Pelo menos uma imagem é obrigatória');
      }
      return true;
    }),
  body('videos')
    .optional()
    .isArray()
    .withMessage('Vídeos deve ser um array')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('=== POST /api/quality-tests - Erros de validação ===');
    console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const testData = {
    ...req.body,
    userId: req.user.id,
    images: JSON.stringify(req.body.images || []),
    videos: JSON.stringify(req.body.videos || [])
  };

  // Verificar se máquina existe e está ativa
  const machineQuery = 'SELECT * FROM machines WHERE id = $1';
  const machineResult = await pool.query(machineQuery, [testData.machineId]);
  const machine = machineResult.rows[0];

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  if (!machine.is_active) {
    throw new AppError('Máquina inativa', 400, 'MACHINE_INACTIVE');
  }

  // Verificar se operador tem operação ativa nesta máquina
  const operationQuery = `
    SELECT * FROM machine_operations 
    WHERE machine_id = $1 AND user_id = $2 AND status = 'ACTIVE'
    LIMIT 1
  `;
  let operationResult = await pool.query(operationQuery, [testData.machineId, req.user.id]);
  let activeOperation = operationResult.rows[0];
  
  // Se não encontrou operação do usuário atual, verificar se é ADMIN/MANAGER e se existe alguma operação ativa na máquina
  if (!activeOperation && (req.user.role === 'ADMIN' || req.user.role === 'MANAGER')) {
    const adminOperationQuery = `
      SELECT * FROM machine_operations 
      WHERE machine_id = $1 AND status = 'ACTIVE'
      LIMIT 1
    `;
    operationResult = await pool.query(adminOperationQuery, [testData.machineId]);
    activeOperation = operationResult.rows[0];
  }

  if (!activeOperation) {
    throw new AppError('Operação ativa não encontrada nesta máquina', 400, 'NO_ACTIVE_OPERATION');
  }

  // Verificar se operação não passou de 20 minutos
  const operationTime = new Date() - new Date(activeOperation.start_time);
  const twentyMinutes = 20 * 60 * 1000;
  
  if (operationTime > twentyMinutes) {
    // Cancelar operação automaticamente
    const updateOperationQuery = `
      UPDATE machine_operations 
      SET status = 'CANCELLED', updated_at = NOW() 
      WHERE id = $1
    `;
    await pool.query(updateOperationQuery, [activeOperation.id]);
    
    throw new AppError('Tempo limite de 20 minutos excedido para esta operação', 400, 'OPERATION_TIMEOUT');
  }

  // Criar teste de qualidade
  const createTestQuery = `
    INSERT INTO quality_tests (
      machine_id, user_id, product, lot, box_number, package_size, package_width,
      bottom_size, side_size, zipper_distance, facilitator_distance, ruler_test_done,
      hermeticity_test_done, visual_inspection, dimensional_check, color_consistency,
      surface_quality, adhesion_test, approved, observations, images, videos,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW()
    ) RETURNING *
  `;
  
  const testResult = await pool.query(createTestQuery, [
    testData.machineId, testData.userId, testData.product, testData.lot, testData.boxNumber,
    testData.packageSize, testData.packageWidth, testData.bottomSize, testData.sideSize,
    testData.zipperDistance, testData.facilitatorDistance, testData.rulerTestDone,
    testData.hermeticityTestDone, testData.visualInspection, testData.dimensionalCheck,
    testData.colorConsistency, testData.surfaceQuality, testData.adhesionTest,
    testData.approved, testData.observations, testData.images, testData.videos
  ]);
  
  const test = {
    ...testResult.rows[0],
    machine: {
      name: machine.name,
      code: machine.code
    },
    user: {
      name: req.user.name,
      email: req.user.email
    }
  };

  // Reset do contador de produção após teste de qualidade
  const ProductionCountService = require('../services/productionCountService');
  await ProductionCountService.resetProductionCounter(testData.machineId);

  // Invalidar cache relacionado
  await deleteCache(`machine:${testData.machineId}`);

  // Notificar líderes e gestores via Socket.IO
  req.io.emit('quality-test:created', {
    test,
    machine: machine.name,
    operator: req.user.name,
    approved: test.approved
  });

  // Enviar notificações para líderes e gestores usando o notificationService
  try {
    // Buscar líderes e gestores
    const leadersQuery = `
      SELECT * FROM users 
      WHERE role IN ('LEADER', 'MANAGER', 'ADMIN') AND is_active = true
    `;
    const leadersResult = await pool.query(leadersQuery);
    const leaders = leadersResult.rows;

    // Criar notificação para cada líder/gestor usando o notificationService
    for (const leader of leaders) {
      await notificationService.saveNotification({
        type: 'QUALITY_TEST',
        title: 'Teste de Qualidade Realizado',
        message: `${req.user.name} realizou teste de qualidade na máquina ${machine.name} - ${test.approved ? 'Aprovado' : 'Reprovado'}`,
        userId: leader.id,
        machineId: machine.id,
        priority: test.approved ? 'MEDIUM' : 'HIGH',
        channels: ['SYSTEM', 'PUSH'],
        metadata: {
          testId: test.id,
          operatorId: req.user.id,
          operatorName: req.user.name,
          machineName: machine.name,
          approved: test.approved,
          product: test.product,
          lot: test.lot,
          action: 'quality_test_created'
        }
      });
    }
    
    console.log(`📢 Notificação de teste de qualidade criada para ${leaders.length} líderes/gestores`);

    // Se reprovado, enviar alerta específico via Socket.IO
    if (!test.approved) {
      req.io.emit('quality-test:failed', {
        test,
        machine: machine.name,
        operator: req.user.name
      });
    }
  } catch (notificationError) {
    console.error('Erro ao enviar notificação de teste de qualidade:', notificationError);
  }

  // Log da ação
  const logQuery = `
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `;
  
  await pool.query(logQuery, [
    'QUALITY_TEST_CREATED',
    req.user.id,
    JSON.stringify({
      testId: test.id,
      machineId: testData.machineId,
      approved: test.approved,
      product: test.product,
      lot: test.lot
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  res.status(201).json({
    success: true,
    message: 'Teste de qualidade criado com sucesso',
    data: test
  });
}));

// @desc    Atualizar teste de qualidade
// @route   PUT /api/quality-tests/:id
// @access  Private (Leader+)
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID do teste inválido'),
  body('approved').optional().isBoolean().withMessage('Aprovado deve ser boolean'),
  body('observations').optional().trim()
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const updateData = req.body;

  const testQuery = `
    SELECT qt.*, m.name as machine_name, u.name as user_name
    FROM quality_tests qt
    JOIN machines m ON qt.machine_id = m.id
    JOIN users u ON qt.user_id = u.id
    WHERE qt.id = $1
  `;
  const testResult = await pool.query(testQuery, [id]);
  const test = testResult.rows[0];
  
  if (test) {
    test.machine = { name: test.machine_name };
    test.user = { name: test.user_name };
  }

  if (!test) {
    throw new AppError('Teste não encontrado', 404, 'TEST_NOT_FOUND');
  }

  // Construir query de update dinamicamente
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;
  
  Object.keys(updateData).forEach(key => {
    updateFields.push(`${key} = $${paramIndex}`);
    updateValues.push(updateData[key]);
    paramIndex++;
  });
  
  updateFields.push(`updated_at = NOW()`);
  updateValues.push(id);
  
  const updateQuery = `
    UPDATE quality_tests 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  
  const updateResult = await pool.query(updateQuery, updateValues);
  const updatedTest = {
    ...updateResult.rows[0],
    machine: test.machine,
    user: test.user
  };

  // Notificar via Socket.IO
  req.io.emit('quality-test:updated', {
    test: updatedTest,
    changes: updateData,
    updatedBy: req.user.name
  });

  // Log da ação
  const logQuery = `
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `;
  
  await pool.query(logQuery, [
    'QUALITY_TEST_UPDATED',
    req.user.id,
    JSON.stringify({
      testId: id,
      changes: updateData
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  res.json({
    success: true,
    message: 'Teste atualizado com sucesso',
    data: updatedTest
  });
}));

// @desc    Obter estatísticas de testes
// @route   GET /api/quality-tests/stats
// @access  Private (Leader+)
router.get('/stats/summary', requireLeader, asyncHandler(async (req, res) => {
  const { startDate, endDate, machineId } = req.query;
  
  let whereClause = 'WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;
  
  if (startDate) {
    whereClause += ` AND test_date >= $${paramIndex}`;
    queryParams.push(new Date(startDate));
    paramIndex++;
  }
  
  if (endDate) {
    whereClause += ` AND test_date <= $${paramIndex}`;
    queryParams.push(new Date(endDate));
    paramIndex++;
  }
  
  if (machineId) {
    whereClause += ` AND machine_id = $${paramIndex}`;
    queryParams.push(machineId);
    paramIndex++;
  }

  const [totalResult, approvedResult, rejectedResult, byMachineResult, byOperatorResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) as count FROM quality_tests ${whereClause}`, queryParams),
    pool.query(`SELECT COUNT(*) as count FROM quality_tests ${whereClause} AND approved = true`, queryParams),
    pool.query(`SELECT COUNT(*) as count FROM quality_tests ${whereClause} AND approved = false`, queryParams),
    pool.query(`
      SELECT machine_id, COUNT(*) as total, SUM(CASE WHEN approved THEN 1 ELSE 0 END) as approved_count
      FROM quality_tests ${whereClause}
      GROUP BY machine_id
    `, queryParams),
    pool.query(`
      SELECT user_id, COUNT(*) as total, SUM(CASE WHEN approved THEN 1 ELSE 0 END) as approved_count
      FROM quality_tests ${whereClause}
      GROUP BY user_id
    `, queryParams)
  ]);
  
  const total = parseInt(totalResult.rows[0].count);
  const approved = parseInt(approvedResult.rows[0].count);
  const rejected = parseInt(rejectedResult.rows[0].count);
  const byMachine = byMachineResult.rows;
  const byOperator = byOperatorResult.rows;

  // Buscar nomes das máquinas e operadores
  const machineIds = byMachine.map(m => m.machine_id);
  const userIds = byOperator.map(o => o.user_id);

  let machines = [];
  let users = [];
  
  if (machineIds.length > 0) {
    const machineQuery = `
      SELECT id, name, code FROM machines 
      WHERE id = ANY($1)
    `;
    const machineResult = await pool.query(machineQuery, [machineIds]);
    machines = machineResult.rows;
  }
  
  if (userIds.length > 0) {
    const userQuery = `
      SELECT id, name, email FROM users 
      WHERE id = ANY($1)
    `;
    const userResult = await pool.query(userQuery, [userIds]);
    users = userResult.rows;
  }

  // Mapear dados com nomes
  const machineStats = byMachine.map(stat => {
    const machine = machines.find(m => m.id === stat.machine_id);
    return {
      machine,
      total: parseInt(stat.total),
      approved: parseInt(stat.approved_count) || 0,
      rejected: parseInt(stat.total) - (parseInt(stat.approved_count) || 0),
      approvalRate: parseInt(stat.total) > 0 ? ((parseInt(stat.approved_count) || 0) / parseInt(stat.total) * 100).toFixed(2) : 0
    };
  });

  const operatorStats = byOperator.map(stat => {
    const user = users.find(u => u.id === stat.user_id);
    return {
      operator: user,
      total: parseInt(stat.total),
      approved: parseInt(stat.approved_count) || 0,
      rejected: parseInt(stat.total) - (parseInt(stat.approved_count) || 0),
      approvalRate: parseInt(stat.total) > 0 ? ((parseInt(stat.approved_count) || 0) / parseInt(stat.total) * 100).toFixed(2) : 0
    };
  });

  const stats = {
    summary: {
      total,
      approved,
      rejected,
      approvalRate: total > 0 ? (approved / total * 100).toFixed(2) : 0
    },
    byMachine: machineStats,
    byOperator: operatorStats
  };

  res.json({
    success: true,
    data: stats
  });
}));

// @desc    Iniciar teste de qualidade diretamente do alerta de produção
// @route   POST /api/quality-tests/start-from-alert
// @access  Private (Operator+)
router.post('/start-from-alert', [
  body('machineId')
    .isInt({ min: 1 })
    .withMessage('ID da máquina inválido'),
  body('product')
    .trim()
    .notEmpty()
    .withMessage('Produto é obrigatório'),
  body('notes')
    .optional()
    .trim()
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { machineId, product, notes } = req.body;

  // Verificar se máquina existe e está ativa
  const machineQuery = 'SELECT * FROM machines WHERE id = $1';
  const machineResult = await pool.query(machineQuery, [parseInt(machineId)]);
  const machine = machineResult.rows[0];

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  if (!machine.is_active) {
    throw new AppError('Máquina inativa', 400, 'MACHINE_INACTIVE');
  }

  // Verificar se operador tem operação ativa nesta máquina
  const operationQuery = `
    SELECT * FROM machine_operations 
    WHERE machine_id = $1 AND user_id = $2 AND status = 'ACTIVE'
    LIMIT 1
  `;
  let operationResult = await pool.query(operationQuery, [parseInt(machineId), req.user.id]);
  let activeOperation = operationResult.rows[0];
  
  // Se não encontrou operação do usuário atual, verificar se é ADMIN/MANAGER
  if (!activeOperation && (req.user.role === 'ADMIN' || req.user.role === 'MANAGER')) {
    const adminOperationQuery = `
      SELECT * FROM machine_operations 
      WHERE machine_id = $1 AND status = 'ACTIVE'
      LIMIT 1
    `;
    operationResult = await pool.query(adminOperationQuery, [parseInt(machineId)]);
    activeOperation = operationResult.rows[0];
  }

  if (!activeOperation) {
    throw new AppError('Operação ativa não encontrada nesta máquina', 400, 'NO_ACTIVE_OPERATION');
  }

  // Criar teste de qualidade básico com dados mínimos
  const testData = {
    machineId: parseInt(machineId),
    userId: req.user.id,
    product: product,
    // Campos obrigatórios que estavam faltando
    lot: `LOT-${Date.now()}`,
    boxNumber: `BOX-${Date.now()}`,
    packageSize: 'Médio',
    packageWidth: 0.25,
    bottomSize: 10.0,
    sideSize: 15.0,
    // Valores padrão para campos obrigatórios
    zipperDistance: 0,
    facilitatorDistance: 0,
    rulerTestDone: false,
    hermeticityTestDone: false,
    approved: false, // Será definido após inspeção
    observations: notes || 'Teste iniciado automaticamente pelo alerta de produção',
    images: JSON.stringify([]), // Array vazio, será preenchido durante o teste
    videos: JSON.stringify([]),
    // Campos opcionais de inspeção
    visualInspection: false,
    dimensionalCheck: false,
    colorConsistency: false,
    surfaceQuality: false,
    adhesionTest: false
  };

  // Criar teste de qualidade
  const createTestQuery = `
    INSERT INTO quality_tests (
      machine_id, user_id, product, lot, box_number, package_size, package_width,
      bottom_size, side_size, zipper_distance, facilitator_distance, ruler_test_done,
      hermeticity_test_done, visual_inspection, dimensional_check, color_consistency,
      surface_quality, adhesion_test, approved, observations, images, videos,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW()
    ) RETURNING *
  `;
  
  const testResult = await pool.query(createTestQuery, [
    testData.machineId, testData.userId, testData.product, testData.lot, testData.boxNumber,
    testData.packageSize, testData.packageWidth, testData.bottomSize, testData.sideSize,
    testData.zipperDistance, testData.facilitatorDistance, testData.rulerTestDone,
    testData.hermeticityTestDone, testData.visualInspection, testData.dimensionalCheck,
    testData.colorConsistency, testData.surfaceQuality, testData.adhesionTest,
    testData.approved, testData.observations, testData.images, testData.videos
  ]);
  
  const test = {
    ...testResult.rows[0],
    machine: {
      name: machine.name,
      code: machine.code
    },
    user: {
      name: req.user.name,
      email: req.user.email
    }
  };

  // Invalidar cache relacionado
  await deleteCache(`machine:${machineId}`);

  // Notificar via Socket.IO
  req.io.emit('quality-test:started', {
    test,
    machine: machine.name,
    operator: req.user.name,
    startedFromAlert: true
  });

  res.status(201).json({
    success: true,
    message: 'Teste de qualidade iniciado com sucesso',
    data: {
      test,
      redirectUrl: `/quality/edit-test/${test.id}`
    }
  });
}));

// @desc    Obter IDs dos testes executados para uma máquina
// @route   GET /api/quality-tests/executed-ids/:machineId
// @access  Private (Operator+)
router.get('/executed-ids/:machineId', [
  param('machineId')
    .isInt({ min: 1 })
    .withMessage('ID da máquina inválido'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit deve ser entre 1 e 100')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const machineId = parseInt(req.params.machineId);
  const limit = parseInt(req.query.limit) || 50;

  // Verificar se máquina existe
  const machineQuery = 'SELECT id, name, code FROM machines WHERE id = $1';
  const machineResult = await pool.query(machineQuery, [machineId]);
  const machine = machineResult.rows[0];

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Buscar IDs dos testes executados para esta máquina
  const testsQuery = `
    SELECT qt.id, qt.test_date, qt.product, qt.lot, qt.approved, qt.is_required,
           u.name as user_name, u.email as user_email
    FROM quality_tests qt
    JOIN users u ON qt.user_id = u.id
    WHERE qt.machine_id = $1
    ORDER BY qt.test_date DESC
    LIMIT $2
  `;
  const testsResult = await pool.query(testsQuery, [machineId, limit]);
  const executedTests = testsResult.rows.map(test => ({
    id: test.id,
    testDate: test.test_date,
    product: test.product,
    lot: test.lot,
    approved: test.approved,
    isRequired: test.is_required,
    user: {
      name: test.user_name,
      email: test.user_email
    }
  }));

  // Contar total de testes para esta máquina
  const countQuery = 'SELECT COUNT(*) as count FROM quality_tests WHERE machine_id = $1';
  const countResult = await pool.query(countQuery, [machineId]);
  const totalTests = parseInt(countResult.rows[0].count);

  res.json({
    success: true,
    message: 'IDs dos testes executados obtidos com sucesso',
    data: {
      machine: {
        id: machine.id,
        name: machine.name,
        code: machine.code
      },
      executedTests,
      totalTests,
      limit
    }
  });
}));

module.exports = router;