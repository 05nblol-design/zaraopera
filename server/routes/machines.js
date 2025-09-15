const express = require('express');
const { body, validationResult, param } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, requireLeader, requireOperator, requireMachinePermission } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');
const ShiftMiddleware = require('../middleware/shiftMiddleware');
const {
  calculateProduction,
  calculateCurrentShiftProduction,
  calculateDailyProduction
} = require('../services/productionService');
const {
  calculateOEE,
  calculateCurrentShiftOEE,
  calculateMultipleOEE
} = require('../services/oeeService');
const notificationService = require('../services/notificationService');
const { requireQualityTestsForProduction, getQualityTestStatus } = require('../middleware/qualityTestMiddleware');
const { checkProductionAlerts } = require('../middleware/productionAlertMiddleware');

const router = express.Router();

// @desc    Listar todas as máquinas
// @route   GET /api/machines
// @access  Private (Operator+)
router.get('/', requireOperator, asyncHandler(async (req, res) => {
  const { status, active } = req.query;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  // Para operadores, incluir o userId no cache key para cache específico por usuário
  const cacheKey = userRole === 'OPERATOR' 
    ? `machines:${status || 'all'}:${active || 'all'}:user:${userId}`
    : `machines:${status || 'all'}:${active || 'all'}`;

  // Tentar buscar do cache
  let machines = await getCache(cacheKey);
  
  if (!machines) {
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    // Para operadores, filtrar apenas máquinas com permissão
    if (userRole === 'OPERATOR') {
      // Buscar IDs das máquinas que o operador tem permissão
      const userPermissionsResult = await pool.query(
        'SELECT machine_id FROM machine_permissions WHERE user_id = $1 AND can_view = true',
        [userId]
      );

      const allowedMachineIds = userPermissionsResult.rows.map(p => p.machine_id);
      
      // Se não tem permissão para nenhuma máquina, retornar array vazio
      if (allowedMachineIds.length === 0) {
        machines = [];
      } else {
        where.allowedIds = allowedMachineIds;
      }
    }

    // Buscar máquinas apenas se não for operador sem permissões
    if (userRole !== 'OPERATOR' || where.allowedIds) {
      let query = `
        SELECT 
          m.*,
          mo.id as operation_id,
          mo.user_id as operation_user_id,
          mo.start_time as operation_start_time,
          mo.status as operation_status,
          mo.notes as operation_notes,
          u.name as operator_name,
          u.email as operator_email,
          (
            SELECT COUNT(*) FROM quality_tests qt WHERE qt.machine_id = m.id
          ) as quality_tests_count,
          (
            SELECT COUNT(*) FROM teflon_changes tc WHERE tc.machine_id = m.id
          ) as teflon_changes_count,
          (
            SELECT COUNT(*) FROM machine_operations mo2 WHERE mo2.machine_id = m.id
          ) as operations_count
        FROM machines m
        LEFT JOIN machine_operations mo ON m.id = mo.machine_id AND mo.status = 'ACTIVE'
        LEFT JOIN users u ON mo.user_id = u.id
        WHERE 1=1
      `;
      
      const queryParams = [];
      let paramIndex = 1;
      
      if (status) {
        query += ` AND m.status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }
      
      if (active !== undefined) {
        query += ` AND m.is_active = $${paramIndex}`;
        queryParams.push(active === 'true');
        paramIndex++;
      }
      
      if (where.allowedIds && where.allowedIds.length > 0) {
        const placeholders = where.allowedIds.map((_, index) => `$${paramIndex + index}`).join(',');
        query += ` AND m.id IN (${placeholders})`;
        queryParams.push(...where.allowedIds);
      }
      
      query += ' ORDER BY m.name ASC';
      
      const result = await pool.query(query, queryParams);
      
      // Processar resultados para formato esperado
      const machineMap = new Map();
      
      result.rows.forEach(row => {
        const machineId = row.id;
        
        if (!machineMap.has(machineId)) {
          machineMap.set(machineId, {
            id: row.id,
            name: row.name,
            code: row.code,
            status: row.status,
            location: row.location,
            model: row.model,
            description: row.description,
            isActive: row.is_active,
            productionSpeed: row.production_speed,
            targetProduction: row.target_production,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            operations: [],
            _count: {
              qualityTests: parseInt(row.quality_tests_count),
              teflonChanges: parseInt(row.teflon_changes_count),
              operations: parseInt(row.operations_count)
            }
          });
        }
        
        const machine = machineMap.get(machineId);
        
        if (row.operation_id) {
          machine.operations.push({
            id: row.operation_id,
            userId: row.operation_user_id,
            startTime: row.operation_start_time,
            status: row.operation_status,
            notes: row.operation_notes,
            user: {
              name: row.operator_name,
              email: row.operator_email
            }
          });
        }
      });
      
      machines = Array.from(machineMap.values());
      
      // Adicionar informação do operador atual e currentOperation para cada máquina
      machines = machines.map(machine => ({
        ...machine,
        operator: machine.operations?.[0]?.user?.name || 'Não atribuído',
        currentOperation: machine.operations && machine.operations.length > 0 ? machine.operations[0] : null
      }));
    }

    // Cache por 5 minutos (menor para operadores para refletir mudanças de permissão)
    const cacheTime = userRole === 'OPERATOR' ? 180 : 300;
    await setCache(cacheKey, machines || [], cacheTime);
  }

  res.json({
    success: true,
    data: machines || [],
    count: (machines || []).length
  });
}));

// @desc    Obter máquina por ID ou código
// @route   GET /api/machines/:id
// @access  Private (Operator+) with machine permission
router.get('/:id', requireOperator, requireMachinePermission('canView'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `machine:${id}`;

  // Tentar buscar do cache
  let machine = await getCache(cacheKey);
  
  if (!machine) {
    // Tentar buscar por ID numérico primeiro, depois por código
    const isNumericId = /^\d+$/.test(id);
    
    // Buscar máquina principal
    let machineResult;
    if (isNumericId) {
      machineResult = await pool.query(
        'SELECT * FROM machines WHERE id = $1',
        [parseInt(id)]
      );
    } else {
      machineResult = await pool.query(
        'SELECT * FROM machines WHERE code = $1',
        [id]
      );
    }
    
    if (machineResult.rows.length === 0) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }
    
    machine = machineResult.rows[0];
    
    // Converter snake_case para camelCase
    machine.isActive = machine.is_active;
    machine.productionSpeed = machine.production_speed;
    machine.targetProduction = machine.target_production;
    machine.createdAt = machine.created_at;
    machine.updatedAt = machine.updated_at;
    delete machine.is_active;
    delete machine.production_speed;
    delete machine.target_production;
    delete machine.created_at;
    delete machine.updated_at;
    
    // Buscar testes de qualidade
    const qualityTestsResult = await pool.query(
      `SELECT qt.*, u.name as user_name, u.email as user_email 
       FROM quality_tests qt 
       LEFT JOIN users u ON qt.user_id = u.id 
       WHERE qt.machine_id = $1 
       ORDER BY qt.created_at DESC 
       LIMIT 10`,
      [machine.id]
    );
    
    machine.qualityTests = qualityTestsResult.rows.map(row => ({
      ...row,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      testDate: row.test_date,
      machineId: row.machine_id,
      userId: row.user_id,
      configId: row.config_id,
      operatorId: row.operator_id,
      isRequired: row.is_required,
      packageSize: row.package_size,
      packageWidth: row.package_width,
      bottomSize: row.bottom_size,
      sideSize: row.side_size,
      zipperDistance: row.zipper_distance,
      facilitatorDistance: row.facilitator_distance,
      rulerTestDone: row.ruler_test_done,
      hermeticityTestDone: row.hermeticity_test_done,
      visualInspection: row.visual_inspection,
      dimensionalCheck: row.dimensional_check,
      colorConsistency: row.color_consistency,
      surfaceQuality: row.surface_quality,
      adhesionTest: row.adhesion_test,
      boxNumber: row.box_number,
      user: {
        name: row.user_name,
        email: row.user_email
      }
    }));
    
    // Buscar mudanças de teflon
    const teflonChangesResult = await pool.query(
      `SELECT tc.*, u.name as user_name, u.email as user_email 
       FROM teflon_changes tc 
       LEFT JOIN users u ON tc.user_id = u.id 
       WHERE tc.machine_id = $1 
       ORDER BY tc.change_date DESC 
       LIMIT 5`,
      [machine.id]
    );
    
    machine.teflonChanges = teflonChangesResult.rows.map(row => ({
      ...row,
      machineId: row.machine_id,
      userId: row.user_id,
      changeDate: row.change_date,
      expiryDate: row.expiry_date,
      teflonType: row.teflon_type,
      alertSent: row.alert_sent,
      notificationSent: row.notification_sent,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: {
        name: row.user_name,
        email: row.user_email
      }
    }));
    
    // Buscar operações ativas
    const operationsResult = await pool.query(
      `SELECT mo.*, u.name as user_name, u.email as user_email 
       FROM machine_operations mo 
       LEFT JOIN users u ON mo.user_id = u.id 
       WHERE mo.machine_id = $1 AND mo.status = 'ACTIVE'`,
      [machine.id]
    );
    
    machine.operations = operationsResult.rows.map(row => ({
      ...row,
      machineId: row.machine_id,
      userId: row.user_id,
      startTime: row.start_time,
      endTime: row.end_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: {
        name: row.user_name,
        email: row.user_email
      }
    }));
    
    // Buscar contadores
    const countsResult = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM quality_tests WHERE machine_id = $1) as quality_tests_count,
        (SELECT COUNT(*) FROM teflon_changes WHERE machine_id = $1) as teflon_changes_count,
        (SELECT COUNT(*) FROM machine_operations WHERE machine_id = $1) as operations_count`,
      [machine.id]
    );
    
    machine._count = {
      qualityTests: parseInt(countsResult.rows[0].quality_tests_count),
      teflonChanges: parseInt(countsResult.rows[0].teflon_changes_count),
      operations: parseInt(countsResult.rows[0].operations_count)
    };

    // Buscar configurações de produção da máquina
    const configResult = await pool.query(
      'SELECT * FROM machine_configs WHERE machine_id = $1',
      [machine.id]
    );
    
    if (configResult.rows.length > 0) {
      const config = configResult.rows[0];
      machine.productionConfig = {
        ...JSON.parse(config.production || '{}'),
        qualityConfig: JSON.parse(config.quality || '{}'),
        maintenanceConfig: JSON.parse(config.maintenance || '{}')
      };
    } else {
      machine.productionConfig = {
        enablePopups: false,
        popupThreshold: null,
        enableAlerts: false,
        alertThreshold: null
      };
    }

    // Adicionar currentOperation baseado na primeira operação ativa
    machine.currentOperation = machine.operations && machine.operations.length > 0 ? machine.operations[0] : null;

    // Cache por 2 minutos
    await setCache(cacheKey, machine, 120);
  }

  res.json({
    success: true,
    data: machine
  });
}));

// @desc    Criar nova máquina
// @route   POST /api/machines
// @access  Private (Leader+)
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nome da máquina deve ter pelo menos 2 caracteres'),
  body('code')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Código da máquina deve ter pelo menos 2 caracteres'),
  body('location')
    .optional()
    .trim(),
  body('description')
    .optional()
    .trim()
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { name, code, location, description } = req.body;

  // Verificar se código já existe
  const existingMachineResult = await pool.query(
    'SELECT * FROM machines WHERE code = $1',
    [code]
  );

  if (existingMachineResult.rows.length > 0) {
    throw new AppError('Código da máquina já existe', 400, 'MACHINE_CODE_EXISTS');
  }

  const machineResult = await pool.query(
    `INSERT INTO machines (name, code, location, description, status, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'STOPPED', true, NOW(), NOW())
     RETURNING *`,
    [name, code, location, description]
  );
  const machine = machineResult.rows[0];

  // Invalidar cache
  await deleteCache('machines:all:all');

  // Notificar via Socket.IO
  req.io.emit('machine:created', {
    machine,
    user: req.user.name
  });

  // Log da ação
  await pool.query(
    `INSERT INTO system_logs (action, user_id, details, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      'MACHINE_CREATED',
      req.user.id,
      JSON.stringify({ machineId: machine.id, name, code }),
      req.ip,
      req.get('User-Agent')
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Máquina criada com sucesso',
    data: machine
  });
}));

// @desc    Atualizar máquina
// @route   PUT /api/machines/:id
// @access  Private (Leader+)
router.put('/:id', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nome da máquina deve ter pelo menos 2 caracteres'),
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Código da máquina deve ter pelo menos 2 caracteres'),
  body('status')
    .optional()
    .isIn(['STOPPED', 'RUNNING', 'MAINTENANCE', 'ERROR', 'FORA_DE_TURNO', 'OFF_SHIFT'])
    .withMessage('Status inválido'),
  body('location')
    .optional()
    .trim(),
  body('description')
    .optional()
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser boolean')
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

  // Verificar se máquina existe - buscar por ObjectId ou código
  const isNumericId = /^\d+$/.test(id);
  let existingMachine;
  
  if (isNumericId) {
    const result = await pool.query(
      'SELECT * FROM machines WHERE id = $1',
      [parseInt(id)]
    );
    existingMachine = result.rows[0];
  } else {
    const result = await pool.query(
      'SELECT * FROM machines WHERE code = $1',
      [id]
    );
    existingMachine = result.rows[0];
  }

  if (!existingMachine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Se alterando código, verificar duplicação
  if (updateData.code && updateData.code !== existingMachine.code) {
    const codeExistsResult = await pool.query(
      'SELECT id FROM machines WHERE code = $1',
      [updateData.code]
    );

    if (codeExistsResult.rows.length > 0) {
      throw new AppError('Código da máquina já existe', 400, 'MACHINE_CODE_EXISTS');
    }
  }

  // Construir query de atualização dinamicamente
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;

  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = $${paramIndex}`);
      updateValues.push(updateData[key]);
      paramIndex++;
    }
  });

  updateValues.push(existingMachine.id);
  const updateQuery = `
    UPDATE machines 
    SET ${updateFields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const machineResult = await pool.query(updateQuery, updateValues);
  const machine = machineResult.rows[0];

  // Invalidar cache
  await deleteCache(`machine:${existingMachine.id}`);
  await deleteCache(`machine:${id}`);
  await deleteCache('machines:all:all');

  // Notificar via Socket.IO
  req.io.emit('machine:updated', {
    machine,
    changes: updateData,
    user: req.user.name
  });

  // Log da ação
  await pool.query(
    `INSERT INTO system_logs (action, user_id, details, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      'MACHINE_UPDATED',
      req.user.id,
      JSON.stringify({ machineId: id, changes: updateData }),
      req.ip,
      req.get('User-Agent')
    ]
  );

  res.json({
    success: true,
    message: 'Máquina atualizada com sucesso',
    data: machine
  });
}));

// @desc    Iniciar operação em máquina
// @route   POST /api/machines/:id/start-operation
// @access  Private (Operator+)
router.post('/:id/start-operation', [
  body('notes').optional().trim()
], requireOperator, 
  requireQualityTestsForProduction,
  ShiftMiddleware.checkShiftChange,
  ShiftMiddleware.validateOperationTime,
  ShiftMiddleware.trackMachineOperation,
  ShiftMiddleware.updateShiftData,
  checkProductionAlerts,
  asyncHandler(async (req, res) => {
  console.log('🚀 INÍCIO DO ENDPOINT START-OPERATION');
  console.log('   Params:', req.params);
  console.log('   Body:', req.body);
  console.log('   User:', req.user ? { id: req.user.id, role: req.user.role } : 'não autenticado');
  console.log('📋 Parâmetros recebidos:', req.params);
  console.log('📋 Body recebido:', req.body);
  console.log('👤 Usuário completo:', JSON.stringify(req.user, null, 2));
  console.log('👤 Nome do usuário:', req.user?.name);
  console.log('👤 ID do usuário:', req.user?.id);
  
  const { id } = req.params;
  const { notes } = req.body;

  // Verificar se máquina existe e está disponível - buscar por ID numérico ou código
  const isNumericId = /^\d+$/.test(id);
  let machine;
  
  console.log(`🔍 Buscando máquina - ID: ${id}, É numérico: ${isNumericId}`);
  
  if (isNumericId) {
    const numericId = parseInt(id);
    console.log(`🔍 Buscando por ID numérico: ${numericId}`);
    const machineResult = await pool.query(
      'SELECT * FROM machines WHERE id = $1',
      [numericId]
    );
    machine = machineResult.rows[0];
    
    if (machine) {
      const operationsResult = await pool.query(
        'SELECT * FROM machine_operations WHERE machine_id = $1 AND status = $2',
        [numericId, 'ACTIVE']
      );
      machine.operations = operationsResult.rows;
    }
  } else {
    console.log(`🔍 Buscando por código: ${id}`);
    const machineResult = await pool.query(
        'SELECT * FROM machines WHERE code = $1',
        [id]
      );
    machine = machineResult.rows[0];
    
    if (machine) {
      const operationsResult = await pool.query(
          'SELECT * FROM machine_operations WHERE machine_id = $1 AND status = $2',
          [machine.id, 'ACTIVE']
        );
      machine.operations = operationsResult.rows;
    }
  }

  console.log(`🔍 Máquina encontrada:`, machine ? `Sim - ${machine.name}` : 'Não');
  if (machine) {
    console.log(`📊 Dados completos da máquina:`, JSON.stringify(machine, null, 2));
    console.log(`📊 Nome da máquina: ${machine.name}`);
    console.log(`📊 Status da máquina: ${machine.status}`);
    console.log(`📊 isActive: ${machine.isActive}`);
    console.log(`📊 Operações ativas: ${machine.operations.length}`);
  }

  if (!machine) {
    console.log(`❌ Máquina não encontrada - ID: ${id}, isNumericId: ${isNumericId}`);
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Continuar verificações de disponibilidade
  console.log('🔍 Verificando se máquina está ativa...');
  const isActive = machine.isActive || machine.is_active;
  if (!isActive) {
    console.log('❌ Máquina inativa');
    throw new AppError('Máquina inativa', 400, 'MACHINE_INACTIVE');
  }

  console.log('🔍 Verificando se máquina já está em operação...');
  if (machine.operations.length > 0) {
    console.log('❌ Máquina já está em operação');
    throw new AppError('Máquina já está em operação', 400, 'MACHINE_IN_USE');
  }

  // Verificar se operador já tem operação ativa
  const activeOperationResult = await pool.query(
    'SELECT * FROM machine_operations WHERE user_id = $1 AND status = $2 LIMIT 1',
    [req.user.id, 'ACTIVE']
  );

  if (activeOperationResult.rows.length > 0) {
    throw new AppError('Operador já possui operação ativa', 400, 'OPERATOR_BUSY');
  }

  // Criar operação
  const operationResult = await pool.query(
    `INSERT INTO machine_operations (machine_id, user_id, notes, status, start_time, created_at, updated_at)
     VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW(), NOW())
     RETURNING *`,
    [machine.id, req.user.id, notes]
  );
  const operation = operationResult.rows[0];

  // Buscar dados completos da operação com máquina e usuário
  const operationWithDetailsResult = await pool.query(
    `SELECT 
       mo.*,
       m.name as machine_name, m.code as machine_code,
       u.name as user_name, u.email as user_email
     FROM machine_operations mo
     JOIN machines m ON mo.machine_id = m.id
     JOIN users u ON mo.user_id = u.id
     WHERE mo.id = $1`,
    [operation.id]
  );
  const operationWithDetails = operationWithDetailsResult.rows[0];
  
  // Estruturar dados como esperado pelo código
  operation.machine = {
    id: machine.id,
    name: operationWithDetails.machine_name,
    code: operationWithDetails.machine_code
  };
  operation.user = {
    name: operationWithDetails.user_name,
    email: operationWithDetails.user_email
  };

  // Atualizar status da máquina
  await pool.query(
    'UPDATE machines SET status = $1, updated_at = NOW() WHERE id = $2',
    ['FUNCIONANDO', machine.id]
  );

  // Inicializar dados de produção do turno
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Determinar tipo de turno atual
    const now = new Date();
    const currentHour = now.getHours();
    const shiftType = (currentHour >= 7 && currentHour < 19) ? 'DAY' : 'NIGHT';
    
    // Calcular horários do turno
    const shiftStartTime = new Date(today);
    const shiftEndTime = new Date(today);
    
    if (shiftType === 'DAY') {
      shiftStartTime.setHours(7, 0, 0, 0);
      shiftEndTime.setHours(19, 0, 0, 0);
    } else {
      shiftStartTime.setHours(19, 0, 0, 0);
      shiftEndTime.setDate(shiftEndTime.getDate() + 1);
      shiftEndTime.setHours(7, 0, 0, 0);
    }
    
    // Verificar se já existe registro de turno para hoje
    const existingShiftDataResult = await pool.query(
      `SELECT * FROM shift_data 
       WHERE machine_id = $1 AND operator_id = $2 AND shift_date = $3`,
      [machine.id, req.user.id, today]
    );
    const existingShiftData = existingShiftDataResult.rows[0];
    
    if (!existingShiftData) {
      // Criar registro inicial de dados de turno
      await pool.query(
        `INSERT INTO shift_data (
           machine_id, operator_id, shift_date, shift_type, start_time, end_time,
           total_production, target_production, efficiency, downtime, quality_score,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [
          machine.id,
          req.user.id,
          today,
          shiftType,
          shiftStartTime,
          shiftEndTime,
          0,
          machine.target_production || 0,
          0,
          0,
          100
        ]
      );
      
      console.log(`✅ Dados de turno inicializados - Máquina: ${machine.name}, Operador: ${req.user.name}, Turno: ${shiftType}`);
    } else {
      console.log(`ℹ️ Dados de turno já existem para hoje - Máquina: ${machine.name}, Operador: ${req.user.name}`);
    }
  } catch (shiftError) {
    console.error('Erro ao inicializar dados de turno:', shiftError);
    // Não falhar a operação por causa disso
  }

  // Invalidar cache
  await deleteCache(`machine:${machine.id}`);
  await deleteCache(`machine:${id}`);

  // Notificar via Socket.IO
  const eventData = {
    machineId: machine.id,
    machineName: machine.name,
    operatorId: req.user.id,
    operatorName: req.user.name,
    operation,
    timestamp: new Date()
  };
  
  console.log('🚀 Enviando evento machine:operation-started:', eventData);
  req.io.emit('machine:operation-started', eventData);
  
  // Emitir evento de mudança de status da máquina
  const statusChangeData = {
    machineId: machine.id,
    machineName: machine.name,
    newStatus: 'FUNCIONANDO',
    status: 'FUNCIONANDO',
    user: {
      id: req.user.id,
      name: req.user.name
    },
    timestamp: new Date()
  };
  
  console.log('🔄 Enviando evento machine:status:changed:', statusChangeData);
  req.io.emit('machine:status:changed', statusChangeData);
  
  // Emitir evento de atualização de produção para sincronização em tempo real
  req.io.emit('production:update', {
    machineId: machine.id,
    status: 'FUNCIONANDO',
    timestamp: new Date()
  });

  // Notificação de início de operação removida conforme solicitado

  res.status(201).json({
    success: true,
    message: 'Operação iniciada com sucesso',
    data: operation
  });
}));

// @desc    Finalizar operação em máquina
// @route   POST /api/machines/:id/end-operation
// @access  Private (Operator+)
router.post('/:id/end-operation', [
  body('notes').optional().trim()
], requireOperator,
  ShiftMiddleware.trackMachineOperation,
  ShiftMiddleware.updateShiftData,
  asyncHandler(async (req, res) => {
  console.log('🛑 INÍCIO DO ENDPOINT END-OPERATION');
  console.log('📋 Parâmetros recebidos:', req.params);
  console.log('📋 Body recebido:', req.body);
  console.log('👤 Usuário completo:', JSON.stringify(req.user, null, 2));
  console.log('👤 Nome do usuário:', req.user?.name);
  console.log('👤 ID do usuário:', req.user?.id);
  
  const { id } = req.params;
  const { notes } = req.body;

  // Verificar se máquina existe e está disponível - buscar por ID numérico ou código
  const isNumericId = /^\d+$/.test(id);
  let machine;
  
  console.log(`🔍 Finalizando operação - ID: ${id}, É numérico: ${isNumericId}`);
  
  if (isNumericId) {
    const numericId = parseInt(id);
    console.log(`🔍 Buscando por ID numérico: ${numericId}`);
    const machineResult = await pool.query(
      'SELECT * FROM machines WHERE id = $1',
      [numericId]
    );
    machine = machineResult.rows[0];
  } else {
    console.log(`🔍 Buscando por código: ${id}`);
    const machineResult = await pool.query(
      'SELECT * FROM machines WHERE code = $1',
      [id]
    );
    machine = machineResult.rows[0];
  }
  
  // Buscar operações ativas se a máquina foi encontrada
  if (machine) {
    const operationsResult = await pool.query(
      'SELECT * FROM machine_operations WHERE machine_id = $1 AND status = $2',
      [machine.id, 'ACTIVE']
    );
    machine.operations = operationsResult.rows;
  }

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Buscar operação ativa nesta máquina
  // Managers podem finalizar operações de qualquer usuário
  let operationQuery = `
    SELECT 
      mo.*,
      m.name as machine_name, m.code as machine_code,
      u.name as user_name, u.email as user_email
    FROM machine_operations mo
    JOIN machines m ON mo.machine_id = m.id
    JOIN users u ON mo.user_id = u.id
    WHERE mo.machine_id = $1 AND mo.status = $2`;
  
  let queryParams = [machine.id, 'ACTIVE'];
  
  // Se não for manager, só pode finalizar suas próprias operações
  if (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN') {
    operationQuery += ' AND mo.user_id = $3';
    queryParams.push(req.user.id);
  }
  
  const operationResult = await pool.query(operationQuery, queryParams);
  const operation = operationResult.rows[0];
  
  // Estruturar dados como esperado pelo código
  if (operation) {
    operation.machine = {
      id: machine.id,
      name: operation.machine_name,
      code: operation.machine_code
    };
    operation.user = {
      name: operation.user_name,
      email: operation.user_email
    };
  }

  if (!operation) {
    throw new AppError('Operação ativa não encontrada', 404, 'OPERATION_NOT_FOUND');
  }

  // Finalizar operação
  await pool.query(
    `UPDATE machine_operations 
     SET status = $1, end_time = NOW(), notes = $2, updated_at = NOW()
     WHERE id = $3`,
    ['COMPLETED', notes || operation.notes, operation.id]
  );
  
  // Buscar operação atualizada com dados completos
  const updatedOperationResult = await pool.query(
    `SELECT 
       mo.*,
       m.name as machine_name, m.code as machine_code,
       u.name as user_name, u.email as user_email
     FROM machine_operations mo
     JOIN machines m ON mo.machine_id = m.id
     JOIN users u ON mo.user_id = u.id
     WHERE mo.id = $1`,
    [operation.id]
  );
  const updatedOperation = updatedOperationResult.rows[0];
  
  // Estruturar dados como esperado pelo código
  updatedOperation.machine = {
    id: machine.id,
    name: updatedOperation.machine_name,
    code: updatedOperation.machine_code
  };
  updatedOperation.user = {
    name: updatedOperation.user_name,
    email: updatedOperation.user_email
  };

  // Atualizar status da máquina
  await pool.query(
    'UPDATE machines SET status = $1, updated_at = NOW() WHERE id = $2',
    ['STOPPED', machine.id]
  );

  // Invalidar cache
  await deleteCache(`machine:${id}`);

  // Notificar via Socket.IO
  const eventData = {
    machineId: machine.id,
    machineName: machine.name,
    operatorId: req.user.id,
    operatorName: req.user.name,
    operation: updatedOperation,
    timestamp: new Date()
  };
  
  console.log('🛑 Enviando evento machine:operation-ended:', eventData);
  req.io.emit('machine:operation-ended', eventData);
  
  // Emitir evento de mudança de status da máquina
  const statusChangeData = {
    machineId: machine.id,
    machineName: machine.name,
    newStatus: 'PARADA',
    status: 'PARADA',
    user: {
      id: req.user.id,
      name: req.user.name
    },
    timestamp: new Date()
  };
  
  console.log('🔄 Enviando evento machine:status:changed:', statusChangeData);
  req.io.emit('machine:status:changed', statusChangeData);

  // Notificação de fim de operação removida conforme solicitado

  res.json({
    success: true,
    message: 'Operação finalizada com sucesso',
    data: updatedOperation
  });
}));

// @desc    Obter configurações da máquina
// @route   GET /api/machines/:id/config
// @access  Private (Manager+)
router.get('/:id/config', requireLeader, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = `machine-config:${id}`;

  // Tentar buscar do cache
  let config = await getCache(cacheKey);
  
  if (!config) {
    // Tentar buscar por ID numérico primeiro, depois por código
    const isNumericId = /^\d+$/.test(id);
    let machine;
    
    if (isNumericId) {
      const machineResult = await pool.query(
        'SELECT * FROM machines WHERE id = $1',
        [parseInt(id)]
      );
      machine = machineResult.rows[0];
    } else {
      const machineResult = await pool.query(
        'SELECT * FROM machines WHERE code = $1',
        [id]
      );
      machine = machineResult.rows[0];
    }
    
    // Buscar configuração se a máquina foi encontrada
    if (machine) {
      const configResult = await pool.query(
        'SELECT * FROM machine_configs WHERE machine_id = $1',
        [machine.id]
      );
      machine.config = configResult.rows[0];
    }

    if (!machine) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }

    // Buscar configuração da máquina
    config = machine.config;

    // Se não há configuração, criar uma padrão
    if (!config) {
      const defaultConfigData = {
        general: JSON.stringify({
          name: machine.name,
          model: machine.model || '',
          location: machine.location || '',
          capacity: '',
          description: machine.description || ''
        }),
        operational: JSON.stringify({
          maxTemperature: null, // Será configurado pelo administrador
          minTemperature: null,
          maxPressure: null,
          minPressure: null,
          cycleTime: null,
          maintenanceInterval: null,
          qualityCheckInterval: null
        }),
        alerts: JSON.stringify({
          temperatureAlert: true,
          pressureAlert: true,
          maintenanceAlert: true,
          qualityAlert: true,
          teflonAlert: true,
          emailNotifications: true,
          smsNotifications: false
        }),
        quality: JSON.stringify({
          defectThreshold: null, // Será configurado pelo administrador
          autoReject: false,
          requirePhotos: true,
          minSampleSize: null
        }),
        maintenance: JSON.stringify({
          preventiveEnabled: true,
          predictiveEnabled: false,
          autoSchedule: false,
          reminderDays: null
        })
      };
      
      // Criar configuração usando PostgreSQL
      const configResult = await pool.query(
        `INSERT INTO machine_configs (
           machine_id, general, operational, alerts, quality, maintenance, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          machine.id,
          JSON.stringify(defaultConfigData.general),
          JSON.stringify(defaultConfigData.operational),
          JSON.stringify(defaultConfigData.alerts),
          JSON.stringify(defaultConfigData.quality),
          JSON.stringify(defaultConfigData.maintenance)
        ]
      );
      config = configResult.rows[0];
      
      // Converter strings JSON de volta para objetos
      config.general = JSON.parse(config.general);
      config.operational = JSON.parse(config.operational);
      config.alerts = JSON.parse(config.alerts);
      config.quality = JSON.parse(config.quality);
      config.maintenance = JSON.parse(config.maintenance);
      config.production = JSON.parse(config.production || '{}');
    } else {
      // Converter strings JSON para objetos se a configuração já existe
      if (typeof config.general === 'string') config.general = JSON.parse(config.general);
      if (typeof config.operational === 'string') config.operational = JSON.parse(config.operational);
      if (typeof config.alerts === 'string') config.alerts = JSON.parse(config.alerts);
      if (typeof config.quality === 'string') config.quality = JSON.parse(config.quality);
      if (typeof config.maintenance === 'string') config.maintenance = JSON.parse(config.maintenance);
      if (typeof config.production === 'string') config.production = JSON.parse(config.production);
      else if (!config.production) config.production = { popupThreshold: 50, alertThreshold: 100, enablePopup: true, enableAlert: true, autoStop: false };
    }
  }

  // Cache por 10 minutos
  await setCache(cacheKey, config, 600);

  res.json({
    success: true,
    data: {
      machine: {
        id: id,
        name: config.general?.name || 'Máquina',
        model: config.general?.model || '',
        location: config.general?.location || ''
      },
      config: {
        general: config.general || {},
        operational: config.operational || {},
        alerts: config.alerts || {},
        quality: config.quality || {},
        maintenance: config.maintenance || {},
        production: config.production || {}
      }
    }
  });
}));

// @desc    Atualizar configurações da máquina
// @route   PUT /api/machines/:id/config
// @access  Private (Manager+)
router.put('/:id/config', [
  body('general').optional().isObject().withMessage('Configurações gerais devem ser um objeto'),
  body('operational').optional().isObject().withMessage('Configurações operacionais devem ser um objeto'),
  body('alerts').optional().isObject().withMessage('Configurações de alertas devem ser um objeto'),
  body('quality').optional().isObject().withMessage('Configurações de qualidade devem ser um objeto'),
  body('production').optional().isObject().withMessage('Configurações de produção devem ser um objeto'),
  body('maintenance').optional().isObject().withMessage('Configurações de manutenção devem ser um objeto')
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
  const { general, operational, alerts, quality, production, maintenance } = req.body;

  // Verificar se máquina existe - buscar por ID numérico ou código
  const isNumericId = /^\d+$/.test(id);
  let machine;
  
  if (isNumericId) {
    const machineResult = await pool.query(
      'SELECT * FROM machines WHERE id = $1',
      [parseInt(id)]
    );
    machine = machineResult.rows[0];
  } else {
    const machineResult = await pool.query(
      'SELECT * FROM machines WHERE code = $1',
      [id]
    );
    machine = machineResult.rows[0];
  }
  
  // Buscar configuração se a máquina foi encontrada
  if (machine) {
    const configResult = await pool.query(
      'SELECT * FROM machine_configs WHERE machine_id = $1',
      [machine.id]
    );
    machine.config = configResult.rows[0];
  }

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  // Preparar dados de atualização
  const updateData = {};
  if (general) updateData.general = general;
  if (operational) updateData.operational = operational;
  if (alerts) updateData.alerts = alerts;
  if (quality) updateData.quality = quality;
  if (production) updateData.production = production;
  if (maintenance) updateData.maintenance = maintenance;

  // Converter strings JSON para objetos se necessário
  const configData = {};
  if (general) configData.general = JSON.stringify(general);
  if (operational) configData.operational = JSON.stringify(operational);
  if (alerts) configData.alerts = JSON.stringify(alerts);
  if (quality) configData.quality = JSON.stringify(quality);
  if (production) configData.production = JSON.stringify(production);
  if (maintenance) configData.maintenance = JSON.stringify(maintenance);

  let config;
  if (machine.config) {
    // Atualizar configuração existente
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (configData.general) {
      updateFields.push(`general = $${paramIndex}`);
      updateValues.push(configData.general);
      paramIndex++;
    }
    if (configData.operational) {
      updateFields.push(`operational = $${paramIndex}`);
      updateValues.push(configData.operational);
      paramIndex++;
    }
    if (configData.alerts) {
      updateFields.push(`alerts = $${paramIndex}`);
      updateValues.push(configData.alerts);
      paramIndex++;
    }
    if (configData.quality) {
      updateFields.push(`quality = $${paramIndex}`);
      updateValues.push(configData.quality);
      paramIndex++;
    }
    if (configData.production) {
      updateFields.push(`production = $${paramIndex}`);
      updateValues.push(configData.production);
      paramIndex++;
    }
    if (configData.maintenance) {
      updateFields.push(`maintenance = $${paramIndex}`);
      updateValues.push(configData.maintenance);
      paramIndex++;
    }
    
    updateFields.push(`updated_at = NOW()`);
    updateValues.push(machine.id);
    
    const configResult = await pool.query(
      `UPDATE machine_configs SET ${updateFields.join(', ')} WHERE machine_id = $${paramIndex} RETURNING *`,
      updateValues
    );
    config = configResult.rows[0];
  } else {
    // Criar nova configuração
    const configResult = await pool.query(
      `INSERT INTO machine_configs (
         machine_id, general, operational, alerts, quality, production, maintenance, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        machine.id,
        configData.general || '{}',
        configData.operational || '{}',
        configData.alerts || '{}',
        configData.quality || '{}',
        configData.production || '{}',
        configData.maintenance || '{}'
      ]
    );
    config = configResult.rows[0];
  }

  // Atualizar dados básicos da máquina se fornecidos
  if (general) {
    const machineUpdateData = {};
    if (general.name) machineUpdateData.name = general.name;
    if (general.model) machineUpdateData.model = general.model;
    if (general.location) machineUpdateData.location = general.location;
    if (general.description) machineUpdateData.description = general.description;

    if (Object.keys(machineUpdateData).length > 0) {
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      Object.keys(machineUpdateData).forEach(key => {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(machineUpdateData[key]);
        paramIndex++;
      });
      
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(machine.id);
      
      await pool.query(
        `UPDATE machines SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );
    }
  }

  // Log da ação
  try {
    await pool.query(
      `INSERT INTO system_logs (action, user_id, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        'MACHINE_CONFIG_UPDATED',
        req.user.id,
        JSON.stringify({ machineId: id, changes: updateData }),
        req.ip,
        req.get('User-Agent')
      ]
    );
  } catch (logError) {
    console.error('Erro ao criar log:', logError);
    // Não falhar a operação por causa do log
  }

  // Invalidar cache
  await deleteCache(`machine-config:${machine.id}`);
  await deleteCache(`machine-config:${id}`);
  await deleteCache(`machine:${machine.id}`);
  await deleteCache(`machine:${id}`);
  await deleteCache('machines:all:all');

  // Notificar via Socket.IO
  req.io.emit('machine:config-updated', {
    machineId: machine.id,
    config,
    user: req.user.name
  });

  // Converter strings JSON de volta para objetos na resposta
  if (config.general && typeof config.general === 'string') config.general = JSON.parse(config.general);
  if (config.operational && typeof config.operational === 'string') config.operational = JSON.parse(config.operational);
  if (config.alerts && typeof config.alerts === 'string') config.alerts = JSON.parse(config.alerts);
  if (config.quality && typeof config.quality === 'string') config.quality = JSON.parse(config.quality);

  if (config.maintenance && typeof config.maintenance === 'string') config.maintenance = JSON.parse(config.maintenance);

  res.json({
    success: true,
    message: 'Configurações atualizadas com sucesso',
    data: config
  });
}));

// @desc    Alterar status da máquina
// @route   PUT /api/machines/:id/status
// @access  Private (Operator+)
router.put('/:id/status', [
  requireOperator,
  param('id').isInt().withMessage('ID da máquina deve ser um número'),
  body('status').isIn(['FUNCIONANDO', 'PARADA', 'MANUTENCAO', 'FORA_DE_TURNO']).withMessage('Status deve ser FUNCIONANDO, PARADA, MANUTENCAO ou FORA_DE_TURNO'),
  body('reason').optional().isString().withMessage('Motivo deve ser uma string'),
  body('notes').optional().isString().withMessage('Observações devem ser uma string')
], 
  ShiftMiddleware.checkShiftChange,
  ShiftMiddleware.trackMachineOperation,
  ShiftMiddleware.updateShiftData,
  asyncHandler(async (req, res) => {
  console.log('🚀 Iniciando PUT /:id/status - req.user:', req.user);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Dados inválidos', 400, errors.array());
  }

  const { id } = req.params;
  const { status, reason, notes } = req.body;
  
  // Mapear IDs de teste para números inteiros válidos
  const testUserIdMap = {
    '507f1f77bcf86cd799439011': 1, // Operador
    '507f1f77bcf86cd799439012': 2, // Líder
    '507f1f77bcf86cd799439013': 3, // Gestor
    '507f1f77bcf86cd799439014': 4  // Admin
  };
  
  let userId = req.user.id;
  console.log('🔍 Debug - userId original:', req.user.id, 'tipo:', typeof req.user.id);
  console.log('🔍 Debug - testUserIdMap[userId]:', testUserIdMap[userId]);
  
  if (typeof userId === 'string' && testUserIdMap[userId]) {
    userId = testUserIdMap[userId];
    console.log('🔍 Debug - userId mapeado para:', userId);
  } else if (typeof userId === 'string') {
    userId = parseInt(userId);
    console.log('🔍 Debug - userId convertido com parseInt:', userId);
  }
  
  console.log('🔍 Debug - userId final:', userId, 'tipo:', typeof userId);

  // Verificar se a máquina existe
  const machineResult = await pool.query(
    'SELECT * FROM machines WHERE id = $1',
    [parseInt(id)]
  );
  const machine = machineResult.rows[0];

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404);
  }

  const previousStatus = machine.status;

  // Se mudando para FORA_DE_TURNO, finalizar operações ativas automaticamente
  let finalizadas = [];
  if (status === 'FORA_DE_TURNO') {
    console.log('🛑 Máquina mudando para FORA_DE_TURNO - verificando operações ativas...');
    
    const activeOperationsResult = await pool.query(
      `SELECT mo.*, u.id as user_id, u.name as user_name, u.email as user_email
       FROM machine_operations mo
       JOIN users u ON mo.user_id = u.id
       WHERE mo.machine_id = $1 AND mo.status = 'ACTIVE'`,
      [parseInt(id)]
    );
    const activeOperations = activeOperationsResult.rows.map(row => ({
      id: row.id,
      startTime: row.start_time,
      notes: row.notes,
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email
      }
    }));
    
    if (activeOperations.length > 0) {
      console.log(`🔄 Finalizando ${activeOperations.length} operação(ões) ativa(s)...`);
      
      for (const operation of activeOperations) {
        const duration = Math.round((new Date() - new Date(operation.startTime)) / 1000 / 60);
        console.log(`   - Finalizando operação de ${operation.user.name} (${duration} min)`);
        
        const updatedNotes = operation.notes 
          ? `${operation.notes} - Finalizada automaticamente (máquina fora de turno)`
          : 'Finalizada automaticamente - máquina fora de turno';
        
        await pool.query(
          `UPDATE machine_operations 
           SET status = 'COMPLETED', end_time = NOW(), notes = $1, updated_at = NOW()
           WHERE id = $2`,
          [updatedNotes, operation.id]
        );
        
        finalizadas.push({
          id: operation.id,
          operatorName: operation.user.name,
          duration
        });
        
        console.log(`   ✅ Operação ${operation.id} finalizada`);
      }
      
      console.log(`✅ ${finalizadas.length} operação(ões) finalizada(s) automaticamente`);
    }
  }

  // Atualizar status da máquina
  const updatedMachineResult = await pool.query(
    'UPDATE machines SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, parseInt(id)]
  );
  const updatedMachine = updatedMachineResult.rows[0];

  // Registrar histórico de mudança de status
  try {
    await pool.query(
      `INSERT INTO machine_status_history (
         machine_id, user_id, previous_status, new_status, reason, notes, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [parseInt(id), userId, machine.status, status, reason, notes]
    );
    console.log(`✅ Histórico de status registrado: ${machine.status} → ${status}`);
  } catch (historyError) {
    console.error('Erro ao registrar histórico de status:', historyError);
    // Não falhar a operação por causa do histórico
  }

  // Invalidar cache
  await deleteCache(`machine:${id}`);
  await deleteCache('machines:all:all');
  await deleteCache(`machine-production-current-shift:${id}`);
  await deleteCache(`machine-production-current-shift:${id}`);
  await deleteCache(`machine-production:${id}`);
  await deleteCache(`machine-production-daily:${id}`);
  await deleteCache(`machines:${status}:all`);
  if (previousStatus) {
    await deleteCache(`machines:${previousStatus}:all`);
  }

  // Notificar via Socket.IO
  req.io.emit('machine:status:changed', {
    machineId: parseInt(id),
    machineName: machine.name,
    previousStatus,
    newStatus: status,
    user: req.user.name,
    reason,
    notes,
    operacoesFinalizadas: finalizadas
  });
  
  // Se operações foram finalizadas automaticamente, enviar evento específico
  if (finalizadas.length > 0) {
    req.io.emit('machine:operations-auto-completed', {
      machineId: parseInt(id),
      machineName: machine.name,
      operacoesFinalizadas: finalizadas,
      motivo: 'Máquina mudou para FORA_DE_TURNO',
      timestamp: new Date()
    });
  }

  // Enviar notificação para líderes e gestores
  console.log('🔔 Iniciando envio de notificação de status...');
  console.log('📋 Parâmetros:', { id: parseInt(id), status, previousStatus, operatorName: req.user.name, reason, notes });
  
  try {
    console.log('🚀 Chamando sendMachineStatusNotification...');
    const result = await notificationService.sendMachineStatusNotification(
      parseInt(id),
      status,
      previousStatus,
      req.user.name,
      reason,
      notes
    );
    console.log('✅ Resultado da notificação:', result);
  } catch (notificationError) {
    console.error('❌ Erro ao enviar notificação de status:', notificationError);
    console.error('❌ Stack trace:', notificationError.stack);
    // Não falhar a operação por causa da notificação
  }
  
  console.log('🏁 Finalizando processamento de notificação...');

  // Preparar mensagem de resposta
  let message = 'Status da máquina alterado com sucesso';
  if (finalizadas.length > 0) {
    message += ` e ${finalizadas.length} operação(ões) finalizada(s) automaticamente`;
  }

  res.json({
    success: true,
    message,
    data: {
      machine: updatedMachine,
      previousStatus,
      newStatus: status,
      operacoesFinalizadas: finalizadas
    }
  });
}));

// @desc    Configurar velocidade de produção da máquina
// @route   PUT /api/machines/:id/production-speed
// @access  Private (Operator+)
router.put('/:id/production-speed', [
  requireOperator,
  param('id').isInt().withMessage('ID da máquina deve ser um número'),
  body('productionSpeed').isFloat({ min: 0 }).withMessage('Velocidade de produção deve ser um número positivo'),
  body('targetProduction').optional().isFloat({ min: 0 }).withMessage('Meta de produção deve ser um número positivo')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Dados inválidos', 400, errors.array());
  }

  const { id } = req.params;
  const { productionSpeed, targetProduction } = req.body;

  // Verificar se a máquina existe
  const machineResult = await pool.query(
    'SELECT * FROM machines WHERE id = $1',
    [parseInt(id)]
  );
  const machine = machineResult.rows[0];

  if (!machine) {
    throw new AppError('Máquina não encontrada', 404);
  }

  // Atualizar velocidade de produção
  const updateFields = ['production_speed = $1', 'updated_at = NOW()'];
  const updateValues = [productionSpeed];
  let paramIndex = 2;
  
  if (targetProduction !== undefined) {
    updateFields.splice(-1, 0, `target_production = $${paramIndex}`);
    updateValues.push(targetProduction);
    paramIndex++;
  }
  
  updateValues.push(parseInt(id));
  
  const updatedMachineResult = await pool.query(
    `UPDATE machines SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    updateValues
  );
  const updatedMachine = updatedMachineResult.rows[0];

  // Invalidar cache
  await deleteCache(`machine:${id}`);
  await deleteCache('machines:all:all');

  // Notificar via Socket.IO
  req.io.emit('machine:production-speed-updated', {
    machineId: parseInt(id),
    productionSpeed,
    targetProduction,
    user: req.user.name
  });

  res.json({
    success: true,
    message: 'Velocidade de produção configurada com sucesso',
    data: updatedMachine
  });
}));

// @desc    Obter histórico de status da máquina
// @route   GET /api/machines/:id/status-history
// @access  Private (Operator+)
router.get('/:id/status-history', [
  requireOperator,
  param('id').isInt().withMessage('ID da máquina deve ser um número')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError('Dados inválidos', 400, errors.array());
  }

  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const cacheKey = `machine-status-history:${id}:${page}:${limit}`;
  let history = await getCache(cacheKey);

  if (!history) {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [statusHistoryResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT msh.*, u.id as user_id, u.name as user_name, u.email as user_email
         FROM machine_status_history msh
         JOIN users u ON msh.user_id = u.id
         WHERE msh.machine_id = $1
         ORDER BY msh.created_at DESC
         LIMIT $2 OFFSET $3`,
        [parseInt(id), parseInt(limit), skip]
      ),
      pool.query(
        'SELECT COUNT(*) FROM machine_status_history WHERE machine_id = $1',
        [parseInt(id)]
      )
    ]);
    
    const statusHistory = statusHistoryResult.rows.map(row => ({
      id: row.id,
      machineId: row.machine_id,
      userId: row.user_id,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      reason: row.reason,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email
      }
    }));
    
    const total = parseInt(totalResult.rows[0].count);

    history = {
      data: statusHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    // Cache por 2 minutos
    await setCache(cacheKey, history, 120);
  }

  res.json({
    success: true,
    message: 'Histórico de status obtido com sucesso',
    ...history
  });
}));

// Endpoint para calcular produção de uma máquina em período específico
router.get('/:id/production', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startTime, endTime } = req.query;

  if (!startTime || !endTime) {
    throw new AppError('Parâmetros startTime e endTime são obrigatórios', 400);
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AppError('Formato de data inválido', 400);
  }

  if (start >= end) {
    throw new AppError('Data de início deve ser anterior à data de fim', 400);
  }

  const machineId = parseInt(id);
  if (isNaN(machineId)) {
    throw new AppError('ID da máquina inválido', 400);
  }

  const production = await calculateProduction(machineId, start, end);

  res.json({
    success: true,
    message: 'Produção calculada com sucesso',
    data: production
  });
}));

// Endpoint para obter status de testes de qualidade obrigatórios
router.get('/:id/quality-test-status', authenticateToken, getQualityTestStatus);

// @desc    Obter status de alertas de produção para testes
// @route   GET /api/machines/:id/production-alert-status
// @access  Private
router.get('/:id/production-alert-status', authenticateToken, asyncHandler(async (req, res) => {
  const machineId = parseInt(req.params.id);
  
  try {
    // Buscar máquina com configuração
    const machineResult = await pool.query(
      'SELECT * FROM machines WHERE id = $1',
      [machineId]
    );
    const machine = machineResult.rows[0];
    
    // Buscar configuração da máquina se ela existir
    if (machine) {
      const configResult = await pool.query(
        'SELECT * FROM machine_configs WHERE machine_id = $1',
        [machine.id]
      );
      machine.config = configResult.rows[0];
    }
    
    // Buscar operação ativa da máquina
    const activeOperationResult = await pool.query(
      `SELECT mo.*, u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role
       FROM machine_operations mo
       JOIN users u ON mo.user_id = u.id
       WHERE mo.machine_id = $1 AND mo.status = $2`,
      [machineId, 'ACTIVE']
    );
    
    const activeOperation = activeOperationResult.rows[0];
    if (activeOperation) {
      activeOperation.user = {
        id: activeOperation.user_id,
        name: activeOperation.user_name,
        email: activeOperation.user_email,
        role: activeOperation.user_role
      };
    }
    
    if (!machine) {
      return res.status(404).json({ error: 'Máquina não encontrada' });
    }
    
    // Buscar configurações ativas de teste de qualidade
    const activeConfigsResult = await pool.query(
      `SELECT id, test_name, products_per_test, test_frequency, is_required
       FROM quality_test_configs
       WHERE machine_id = $1 AND is_active = true`,
      [machineId]
    );
    
    const activeConfigs = activeConfigsResult.rows.map(row => ({
      id: row.id,
      testName: row.test_name,
      productsPerTest: row.products_per_test,
      testFrequency: row.test_frequency,
      isRequired: row.is_required
    }));
    
    // Obter configuração de produtos por teste da máquina
    let machineProductsPerTest = 1; // valor padrão
    if (machine && machine.config) {
      try {
        let qualityConfig = null;
        if (typeof machine.config.quality === 'string') {
          qualityConfig = JSON.parse(machine.config.quality);
        } else if (machine.config.quality && typeof machine.config.quality === 'object') {
          qualityConfig = machine.config.quality;
        }
        
        if (qualityConfig && qualityConfig.productsPerTest) {
          machineProductsPerTest = parseInt(qualityConfig.productsPerTest) || 1;
        }
      } catch (error) {
        console.error('Erro ao parsear configuração de qualidade da máquina:', error);
        machineProductsPerTest = 1;
      }
    }
    
    if (activeConfigs.length === 0) {
      return res.json({
        machineId: machine.id,
        machineName: machine.name,
        requiresTest: false,
        configs: []
      });
    }
    
    const configsWithStatus = [];
    let requiresTest = false;
    
    for (const config of activeConfigs) {
      // Buscar último teste para esta configuração
      const lastTestResult = await pool.query(
        `SELECT * FROM quality_tests
         WHERE machine_id = $1 AND config_id = $2
         ORDER BY test_date DESC
         LIMIT 1`,
        [machineId, config.id]
      );
      
      const lastTest = lastTestResult.rows[0];
      const lastTestDate = lastTest ? lastTest.test_date : new Date(0);
      
      // Contar produção desde o último teste usando shiftData
      const shiftDataResult = await pool.query(
        `SELECT * FROM shift_data
         WHERE machine_id = $1 AND created_at > $2`,
        [machineId, lastTestDate]
      );
      
      const productionCount = shiftDataResult.rows.reduce((total, shift) => total + (shift.total_production || 0), 0);
      
      // Usar configuração da máquina em vez da configuração do teste
      const effectiveProductsPerTest = machineProductsPerTest;
      
      // Verificar se precisa de teste
      const needsTest = productionCount >= effectiveProductsPerTest;
      
      if (needsTest) {
        requiresTest = true;
      }
      
      configsWithStatus.push({
        configId: config.id,
        testName: config.testName,
        productsPerTest: effectiveProductsPerTest,
        productionCount: productionCount,
        needsTest: needsTest,
        lastTestDate: lastTestDate,
        exceedBy: Math.max(0, productionCount - effectiveProductsPerTest)
      });
    }
    
    res.json({
      machineId: machine.id,
      machineName: machine.name,
      machineLocation: machine.location,
      machineStatus: machine.status,
      currentOperator: activeOperation ? {
        id: activeOperation.user.id,
        name: activeOperation.user.name,
        email: activeOperation.user.email,
        role: activeOperation.user.role
      } : null,
      requiresTest: requiresTest,
      configs: configsWithStatus.filter(c => c.needsTest), // Retornar apenas configs que precisam de teste
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao verificar alertas de produção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}));

// Endpoint para calcular produção do turno atual
router.get('/:id/production/current-shift', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const machineId = parseInt(id);
  
  if (isNaN(machineId)) {
    throw new AppError('ID da máquina inválido', 400);
  }

  // Cache com TTL de 5 segundos para dados de produção em tempo real
  const cacheKey = `machine-production-current-shift:${machineId}`;
  let production = await getCache(cacheKey);

  if (!production) {
    production = await calculateCurrentShiftProduction(machineId);
    // Cache por 5 segundos para dados mais atualizados
    await setCache(cacheKey, production, 5);
  }

  res.json({
    success: true,
    message: 'Produção do turno atual calculada com sucesso',
    data: production
  });
}));

// Endpoint para calcular produção diária
router.get('/:id/production/daily', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;
  
  const machineId = parseInt(id);
  if (isNaN(machineId)) {
    throw new AppError('ID da máquina inválido', 400);
  }

  let targetDate = new Date();
  if (date) {
    targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new AppError('Formato de data inválido', 400);
    }
  }

  const production = await calculateDailyProduction(machineId, targetDate);

  res.json({
    success: true,
    message: 'Produção diária calculada com sucesso',
    data: production
  });
}));

// @desc    Calcular OEE de uma máquina específica
// @route   GET /api/machines/:id/oee
// @access  Private
router.get('/:id/oee', authenticateToken, asyncHandler(async (req, res) => {
  const machineId = parseInt(req.params.id);
  const { startDate, endDate } = req.query;
  
  if (isNaN(machineId)) {
    throw new AppError('ID da máquina inválido', 400);
  }

  const oeeData = await calculateOEE(machineId, startDate, endDate);
  
  res.json({
    success: true,
    data: oeeData
  });
}));

// @desc    Calcular OEE do turno atual de uma máquina
// @route   GET /api/machines/:id/oee/current-shift
// @access  Private
router.get('/:id/oee/current-shift', authenticateToken, asyncHandler(async (req, res) => {
  const machineId = parseInt(req.params.id);
  
  if (isNaN(machineId)) {
    throw new AppError('ID da máquina inválido', 400);
  }

  const oeeData = await calculateCurrentShiftOEE(machineId);
  
  res.json({
    success: true,
    data: oeeData
  });
}));

// @desc    Calcular OEE de múltiplas máquinas
// @route   GET /api/machines/oee/multiple
// @access  Private
router.get('/oee/multiple', authenticateToken, asyncHandler(async (req, res) => {
  const { machineIds, startDate, endDate } = req.query;
  
  if (!machineIds) {
    throw new AppError('IDs das máquinas são obrigatórios', 400);
  }

  const machineIdArray = machineIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  
  if (machineIdArray.length === 0) {
    throw new AppError('Nenhum ID de máquina válido fornecido', 400);
  }

  const oeeData = await calculateMultipleOEE(machineIdArray, startDate, endDate);
  
  res.json({
    success: true,
    data: oeeData
  });
}));

// @desc    Incrementar contagem de produtos
// @route   POST /api/machines/:id/production/increment
// @access  Private (Operator+)
router.post('/:id/production/increment', [
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantidade deve ser um número inteiro positivo')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { quantity = 1 } = req.body;
  const ProductionCountService = require('../services/productionCountService');

  // Verificar se máquina existe
  const isNumericId = /^\d+$/.test(id);
  let machineId;
  
  if (isNumericId) {
    const machineResult = await pool.query(
      'SELECT id FROM machines WHERE id = $1',
      [parseInt(id)]
    );
    if (machineResult.rows.length === 0) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }
    machineId = machineResult.rows[0].id;
  } else {
    const machineResult = await pool.query(
      'SELECT id FROM machines WHERE code = $1',
      [id]
    );
    if (machineResult.rows.length === 0) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }
    machineId = machineResult.rows[0].id;
  }

  // Incrementar contagem e verificar limites
  const result = await ProductionCountService.incrementProductCount(machineId, quantity);
  
  res.json({
    success: true,
    message: 'Contagem de produtos incrementada com sucesso',
    data: {
      machineId,
      currentCount: result.currentCount,
      quantity
    }
  });
}));

// @desc    Buscar popups ativos para uma máquina
// @route   GET /api/machines/:id/production/popups
// @access  Private (Operator+)
router.get('/:id/production/popups', requireOperator, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Verificar se máquina existe e obter ID
  const isNumericId = /^\d+$/.test(id);
  let machineId;
  
  if (isNumericId) {
    const machineResult = await pool.query(
      'SELECT id FROM machines WHERE id = $1',
      [parseInt(id)]
    );
    if (machineResult.rows.length === 0) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }
    machineId = machineResult.rows[0].id;
  } else {
    const machineResult = await pool.query(
      'SELECT id FROM machines WHERE code = $1',
      [id]
    );
    if (machineResult.rows.length === 0) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }
    machineId = machineResult.rows[0].id;
  }

  // Buscar popups ativos
  const popupsQuery = `
    SELECT * FROM production_popups 
    WHERE machine_id = $1 AND is_active = true
    ORDER BY created_at DESC
  `;
  const popupsResult = await pool.query(popupsQuery, [machineId]);
  
  res.json({
    success: true,
    data: popupsResult.rows
  });
}));

// @desc    Reconhecer popup de produção
// @route   PUT /api/machines/:id/production/popups/:popupId/acknowledge
// @access  Private (Operator+)
router.put('/:id/production/popups/:popupId/acknowledge', requireOperator, asyncHandler(async (req, res) => {
  const { id, popupId } = req.params;
  const userId = req.user.id;
  
  // Verificar se máquina existe
  const isNumericId = /^\d+$/.test(id);
  let machineId;
  
  if (isNumericId) {
    const machineResult = await pool.query(
      'SELECT id FROM machines WHERE id = $1',
      [parseInt(id)]
    );
    if (machineResult.rows.length === 0) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }
    machineId = machineResult.rows[0].id;
  } else {
    const machineResult = await pool.query(
      'SELECT id FROM machines WHERE code = $1',
      [id]
    );
    if (machineResult.rows.length === 0) {
      throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
    }
    machineId = machineResult.rows[0].id;
  }

  // Reconhecer popup
  const updateResult = await pool.query(
    `UPDATE production_popups 
     SET is_active = false, acknowledged_at = NOW(), acknowledged_by = $1, updated_at = NOW()
     WHERE id = $2 AND machine_id = $3 AND is_active = true
     RETURNING *`,
    [userId, parseInt(popupId), machineId]
  );
  
  if (updateResult.rows.length === 0) {
    throw new AppError('Popup não encontrado ou já foi reconhecido', 404, 'POPUP_NOT_FOUND');
  }
  
  res.json({
    success: true,
    message: 'Popup reconhecido com sucesso',
    data: updateResult.rows[0]
  });
}));

module.exports = router;