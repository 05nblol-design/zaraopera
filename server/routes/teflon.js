const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const pool = require('../config/database');
const { requireOperator, requireLeader } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');

const router = express.Router();

// @desc    Listar trocas de teflon
// @route   GET /api/teflon
// @access  Private (Operator+)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
  query('machineId').optional().custom(value => {
    if (value === 'all') return true;
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('ID da máquina inválido'),
  query('expired').optional().isBoolean().withMessage('Expired deve ser boolean'),
  query('expiringSoon').optional().isBoolean().withMessage('ExpiringSoon deve ser boolean')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
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
    expired,
    expiringSoon
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {};
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Filtros
  if (machineId) where.machineId = machineId;
  
  if (expired === 'true') {
    where.expiryDate = { lt: now };
  }
  
  if (expiringSoon === 'true') {
    where.expiryDate = {
      gte: now,
      lte: sevenDaysFromNow
    };
  }

  // Se for operador, mostrar apenas suas trocas
  if (req.user.role === 'OPERATOR') {
    where.userId = req.user.id;
  }

  // Build WHERE clause for SQL
  const whereConditions = [];
  const queryParams = [];
  let paramIndex = 1;
  
  if (machineId) {
    whereConditions.push(`tc.machine_id = $${paramIndex}`);
    queryParams.push(parseInt(machineId));
    paramIndex++;
  }
  
  if (expired === 'true') {
    whereConditions.push(`tc.expiry_date < NOW()`);
  } else if (expired === 'false') {
    whereConditions.push(`tc.expiry_date >= NOW()`);
  }
  
  if (expiringSoon === 'true') {
    whereConditions.push(`tc.expiry_date >= NOW() AND tc.expiry_date <= NOW() + INTERVAL '7 days'`);
  }
  
  if (req.user.role === 'OPERATOR') {
    whereConditions.push(`tc.user_id = $${paramIndex}`);
    queryParams.push(req.user.id);
    paramIndex++;
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  const [changesResult, totalResult] = await Promise.all([
    pool.query(`
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
      ${whereClause}
      ORDER BY tc.change_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, parseInt(limit), skip]),
    pool.query(`
      SELECT COUNT(*) as total
      FROM teflon_changes tc
      ${whereClause}
    `, queryParams)
  ]);
  
  const changes = changesResult.rows.map(row => ({
    id: row.id,
    machineId: row.machine_id,
    userId: row.user_id,
    changeDate: row.change_date,
    expiryDate: row.expiry_date,
    teflonType: row.teflon_type,
    observations: row.observations,
    photos: row.photos,
    alertSent: row.alert_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    machine: row.machine_name ? {
      name: row.machine_name,
      code: row.machine_code,
      location: row.machine_location
    } : null,
    user: row.user_name ? {
      name: row.user_name,
      email: row.user_email
    } : null
  }));
  
  const total = parseInt(totalResult.rows[0].total);

  // Adicionar status de expiração e parse do campo photos
  const changesWithStatus = changes.map(change => ({
    ...change,
    photos: change.photos ? JSON.parse(change.photos) : [],
    status: {
      expired: change.expiryDate < now,
      expiringSoon: change.expiryDate >= now && change.expiryDate <= sevenDaysFromNow,
      daysUntilExpiry: Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24))
    }
  }));

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: changesWithStatus,
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

// @desc    Obter troca de teflon por ID
// @route   GET /api/teflon/:id
// @access  Private (Operator+)
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID da troca inválido')
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
  const where = { id: parseInt(id, 10) };

  // Se for operador, só pode ver suas próprias trocas
  if (req.user.role === 'OPERATOR') {
    where.userId = req.user.id;
  }

  // Build WHERE clause for SQL
  const whereConditions = ['tc.id = $1'];
  const queryParams = [parseInt(id, 10)];
  let paramIndex = 2;
  
  // Se for operador, só pode ver suas próprias trocas
  if (req.user.role === 'OPERATOR') {
    whereConditions.push(`tc.user_id = $${paramIndex}`);
    queryParams.push(req.user.id);
    paramIndex++;
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  const changeResult = await pool.query(`
    SELECT 
      tc.*,
      m.name as machine_name,
      m.code as machine_code,
      m.location as machine_location,
      u.name as user_name,
      u.email as user_email,
      u.role as user_role
    FROM teflon_changes tc
    LEFT JOIN machines m ON tc.machine_id = m.id
    LEFT JOIN users u ON tc.user_id = u.id
    WHERE ${whereClause}
  `, queryParams);
  
  if (changeResult.rows.length === 0) {
    throw new AppError('Troca de teflon não encontrada', 404, 'TEFLON_CHANGE_NOT_FOUND');
  }
  
  const row = changeResult.rows[0];
  const change = {
    id: row.id,
    machineId: row.machine_id,
    userId: row.user_id,
    changeDate: row.change_date,
    expiryDate: row.expiry_date,
    teflonType: row.teflon_type,
    observations: row.observations,
    photos: row.photos,
    alertSent: row.alert_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    machine: row.machine_name ? {
      name: row.machine_name,
      code: row.machine_code,
      location: row.machine_location
    } : null,
    user: row.user_name ? {
      name: row.user_name,
      email: row.user_email,
      role: row.user_role
    } : null
  };

  if (!change) {
    throw new AppError('Troca de teflon não encontrada', 404, 'TEFLON_CHANGE_NOT_FOUND');
  }

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const changeWithStatus = {
    ...change,
    photos: change.photos ? JSON.parse(change.photos) : [],
    status: {
      expired: change.expiryDate < now,
      expiringSoon: change.expiryDate >= now && change.expiryDate <= sevenDaysFromNow,
      daysUntilExpiry: Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24))
    }
  };

  res.json({
    success: true,
    data: changeWithStatus
  });
}));

// @desc    Registrar nova troca de teflon
// @route   POST /api/teflon
// @access  Private (Operator+)
router.post('/', [
  body('machineId')
    .isInt({ min: 1 })
    .withMessage('ID da máquina inválido'),
  body('expiryDate')
    .isISO8601()
    .withMessage('Data de validade inválida')
    .custom((value) => {
      const expiryDate = new Date(value);
      const now = new Date();
      if (expiryDate <= now) {
        throw new Error('Data de validade deve ser futura');
      }
      return true;
    }),
  body('teflonType')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Tipo de teflon é obrigatório'),
  body('observations')
    .optional()
    .trim(),
  body('photos').isArray().withMessage('Fotos devem ser um array').custom((photos) => {
    if (photos.length === 0) {
      throw new Error('Pelo menos uma foto é obrigatória');
    }
    return true;
  })
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { machineId, expiryDate, teflonType, observations, photos } = req.body;
  
  const changeData = {
    machineId: parseInt(machineId),
    expiryDate: new Date(expiryDate),
    teflonType,
    observations,
    photos: JSON.stringify(photos),
    userId: req.user.id
  };

  // Verificar se máquina existe e está ativa
  const machineResult = await pool.query(
    'SELECT id, name, code, is_active FROM machines WHERE id = $1',
    [changeData.machineId]
  );

  if (machineResult.rows.length === 0) {
    throw new AppError('Máquina não encontrada', 404, 'MACHINE_NOT_FOUND');
  }

  const machine = machineResult.rows[0];
  if (!machine.is_active) {
    throw new AppError('Máquina inativa', 400, 'MACHINE_INACTIVE');
  }

  // Criar registro de troca
  const changeResult = await pool.query(`
    INSERT INTO teflon_changes (
      machine_id, user_id, change_date, expiry_date, teflon_type, observations, photos
    ) VALUES ($1, $2, NOW(), $3, $4, $5, $6)
    RETURNING *
  `, [
    changeData.machineId,
    changeData.userId,
    changeData.expiryDate,
    changeData.teflonType,
    changeData.observations,
    changeData.photos
  ]);

  const changeRow = changeResult.rows[0];
  const change = {
    id: changeRow.id,
    machineId: changeRow.machine_id,
    userId: changeRow.user_id,
    changeDate: changeRow.change_date,
    expiryDate: changeRow.expiry_date,
    teflonType: changeRow.teflon_type,
    observations: changeRow.observations,
    photos: changeRow.photos,
    alertSent: changeRow.alert_sent,
    createdAt: changeRow.created_at,
    updatedAt: changeRow.updated_at,
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
  await deleteCache(`machine:${changeData.machineId}`);

  // Notificar via Socket.IO
  req.io.emit('teflon:changed', {
    change,
    machine: machine.name,
    operator: req.user.name
  });

  // Log da ação
  await pool.query(`
    INSERT INTO system_logs (
      action, user_id, details, ip_address, user_agent, created_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
  `, [
    'TEFLON_CHANGED',
    req.user.id,
    JSON.stringify({
      changeId: change.id,
      machineId: changeData.machineId,
      teflonType: change.teflonType,
      expiryDate: change.expiryDate
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  const changeWithParsedPhotos = {
    ...change,
    photos: change.photos ? JSON.parse(change.photos) : []
  };

  res.status(201).json({
    success: true,
    message: 'Troca de teflon registrada com sucesso',
    data: changeWithParsedPhotos
  });
}));

// @desc    Atualizar troca de teflon
// @route   PUT /api/teflon/:id
// @access  Private (Leader+)
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID da troca inválido'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Data de validade inválida'),
  body('teflonType')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Tipo de teflon não pode estar vazio'),
  body('observations')
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

  const { id } = req.params;
  const updateData = req.body;
  const teflonId = parseInt(id, 10);

  if (updateData.expiryDate) {
    updateData.expiryDate = new Date(updateData.expiryDate);
    
    // Verificar se data é futura
    if (updateData.expiryDate <= new Date()) {
      throw new AppError('Data de validade deve ser futura', 400, 'INVALID_EXPIRY_DATE');
    }
  }

  // Verificar se a troca existe
  const checkResult = await pool.query(
    'SELECT tc.*, m.name as machine_name FROM teflon_changes tc JOIN machines m ON tc.machine_id = m.id WHERE tc.id = $1',
    [teflonId]
  );

  if (checkResult.rows.length === 0) {
    throw new AppError('Troca de teflon não encontrada', 404, 'TEFLON_CHANGE_NOT_FOUND');
  }

  const change = checkResult.rows[0];

  // Construir query de atualização dinamicamente
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;

  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = $${paramIndex}`);
      updateValues.push(updateData[key]);
      paramIndex++;
    }
  });

  if (updateFields.length === 0) {
    throw new AppError('Nenhum campo para atualizar', 400, 'NO_UPDATE_FIELDS');
  }

  updateValues.push(teflonId);
  const updateQuery = `
    UPDATE teflon_changes 
    SET ${updateFields.join(', ')}, updated_at = NOW() 
    WHERE id = $${paramIndex} 
    RETURNING *
  `;

  const updateResult = await pool.query(updateQuery, updateValues);

  // Buscar dados completos com joins
  const fullDataResult = await pool.query(`
    SELECT 
      tc.*,
      m.name as machine_name,
      m.code as machine_code,
      u.name as user_name,
      u.email as user_email
    FROM teflon_changes tc
    JOIN machines m ON tc.machine_id = m.id
    JOIN users u ON tc.user_id = u.id
    WHERE tc.id = $1
  `, [teflonId]);

  const updatedChange = {
    ...fullDataResult.rows[0],
    machine: {
      name: fullDataResult.rows[0].machine_name,
      code: fullDataResult.rows[0].machine_code
    },
    user: {
      name: fullDataResult.rows[0].user_name,
      email: fullDataResult.rows[0].user_email
    }
  };

  // Invalidar cache
  await deleteCache(`machine:${change.machineId}`);

  // Notificar via Socket.IO
  req.io.emit('teflon:updated', {
    change: updatedChange,
    changes: updateData,
    updatedBy: req.user.name
  });

  // Log da ação
  await pool.query(`
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `, [
    'TEFLON_UPDATED',
    req.user.id,
    JSON.stringify({
      changeId: id,
      changes: updateData
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  // Parse do campo photos antes de retornar
  const changeWithParsedPhotos = {
    ...updatedChange,
    photos: updatedChange.photos ? JSON.parse(updatedChange.photos) : []
  };

  res.json({
    success: true,
    message: 'Troca de teflon atualizada com sucesso',
    data: changeWithParsedPhotos
  });
}));

// @desc    Obter trocas expirando em breve
// @route   GET /api/teflon/expiring-soon
// @access  Private (Operator+)
router.get('/alerts/expiring-soon', requireOperator, asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result = await pool.query(`
    SELECT 
      tc.*,
      m.name as machine_name,
      m.code as machine_code,
      m.location as machine_location,
      u.name as user_name,
      u.email as user_email
    FROM teflon_changes tc
    JOIN machines m ON tc.machine_id = m.id
    JOIN users u ON tc.user_id = u.id
    WHERE tc.expiry_date >= $1 
      AND tc.expiry_date <= $2 
      AND tc.alert_sent = false
    ORDER BY tc.expiry_date ASC
  `, [now, sevenDaysFromNow]);

  const expiringChanges = result.rows.map(row => ({
    ...row,
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

  // Adicionar dias restantes e parse do campo photos
  const changesWithDays = expiringChanges.map(change => ({
    ...change,
    photos: change.photos ? JSON.parse(change.photos) : [],
    daysUntilExpiry: Math.ceil((change.expiryDate - now) / (1000 * 60 * 60 * 24))
  }));

  res.json({
    success: true,
    data: changesWithDays,
    count: changesWithDays.length
  });
}));

// @desc    Obter trocas expiradas
// @route   GET /api/teflon/expired
// @access  Private (Leader+)
router.get('/alerts/expired', requireLeader, asyncHandler(async (req, res) => {
  const now = new Date();

  const result = await pool.query(`
    SELECT 
      tc.*,
      m.name as machine_name,
      m.code as machine_code,
      m.location as machine_location,
      u.name as user_name,
      u.email as user_email
    FROM teflon_changes tc
    JOIN machines m ON tc.machine_id = m.id
    JOIN users u ON tc.user_id = u.id
    WHERE tc.expiry_date < $1
    ORDER BY tc.expiry_date DESC
  `, [now]);

  const expiredChanges = result.rows.map(row => ({
    ...row,
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

  // Adicionar dias de atraso e parse do campo photos
  const changesWithDelay = expiredChanges.map(change => ({
    ...change,
    photos: change.photos ? JSON.parse(change.photos) : [],
    daysOverdue: Math.ceil((now - change.expiryDate) / (1000 * 60 * 60 * 24))
  }));

  res.json({
    success: true,
    data: changesWithDelay,
    count: changesWithDelay.length
  });
}));

// @desc    Marcar alerta como enviado
// @route   PATCH /api/teflon/:id/alert-sent
// @access  Private (System)
router.patch('/:id/alert-sent', [
  param('id').isInt({ min: 1 }).withMessage('ID da troca inválido')
], requireOperator, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teflonId = parseInt(id, 10);

  const result = await pool.query(
    'UPDATE teflon_changes SET alert_sent = true, updated_at = NOW() WHERE id = $1 RETURNING *',
    [teflonId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Troca de teflon não encontrada', 404, 'TEFLON_CHANGE_NOT_FOUND');
  }

  const change = result.rows[0];

  res.json({
    success: true,
    message: 'Alerta marcado como enviado',
    data: change
  });
}));

// @desc    Obter estatísticas de teflon
// @route   GET /api/teflon/stats/summary
// @access  Private (Leader+)
router.get('/stats/summary', requireLeader, asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalResult, expiredResult, expiringSoonResult, recentChangesResult, byMachineResult] = await Promise.all([
    pool.query('SELECT COUNT(*) as count FROM teflon_changes'),
    pool.query('SELECT COUNT(*) as count FROM teflon_changes WHERE expiry_date < $1', [now]),
    pool.query('SELECT COUNT(*) as count FROM teflon_changes WHERE expiry_date >= $1 AND expiry_date <= $2', [now, sevenDaysFromNow]),
    pool.query('SELECT COUNT(*) as count FROM teflon_changes WHERE change_date >= $1', [thirtyDaysAgo]),
    pool.query(`
      SELECT machine_id, COUNT(*) as count
      FROM teflon_changes 
      GROUP BY machine_id 
      ORDER BY COUNT(*) DESC 
      LIMIT 10
    `)
  ]);

  const total = parseInt(totalResult.rows[0].count);
  const expired = parseInt(expiredResult.rows[0].count);
  const expiringSoon = parseInt(expiringSoonResult.rows[0].count);
  const recentChanges = parseInt(recentChangesResult.rows[0].count);
  const byMachine = byMachineResult.rows.map(row => ({
    machineId: row.machine_id,
    _count: { _all: parseInt(row.count) }
  }));

  // Buscar nomes das máquinas
  const machineIds = byMachine.map(m => m.machineId);
  let machines = [];
  
  if (machineIds.length > 0) {
    const placeholders = machineIds.map((_, index) => `$${index + 1}`).join(',');
    const machinesResult = await pool.query(
      `SELECT id, name, code FROM machines WHERE id IN (${placeholders})`,
      machineIds
    );
    machines = machinesResult.rows;
  }

  const machineStats = byMachine.map(stat => {
    const machine = machines.find(m => m.id === stat.machineId);
    return {
      machine,
      totalChanges: stat._count._all
    };
  });

  const stats = {
    summary: {
      total,
      expired,
      expiringSoon,
      recentChanges,
      alertsNeeded: expired + expiringSoon
    },
    topMachines: machineStats
  };

  res.json({
    success: true,
    data: stats
  });
}));

module.exports = router;