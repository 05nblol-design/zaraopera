const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const pool = require('../config/database');
const { requireOperator, requireLeader, requireRole } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');
const NotificationService = require('../services/notificationService');

const router = express.Router();

// @desc    Listar notificações do usuário
// @route   GET /api/notifications
// @access  Private (Operator+)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
  query('read').optional().isBoolean().withMessage('Read deve ser boolean'),
  query('type').optional().isIn(['QUALITY_TEST_MISSING', 'TEFLON_EXPIRING', 'TEFLON_EXPIRED', 'MACHINE_ALERT', 'MACHINE_STATUS', 'SYSTEM_ALERT']).withMessage('Tipo de notificação inválido'),
  query('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Prioridade inválida')
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
    read,
    type,
    priority
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  // Garantir que userId seja um número
  const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
  
  const where = {
    userId
  };

  // Filtros
  if (read !== undefined) where.read = read === 'true';
  if (type) where.type = type;
  if (priority) where.priority = priority;

  // Buscar notificações do usuário
  try {
    const userId = req.user.id;
    
    // Buscar notificações do usuário
    const notificationsQuery = `
      SELECT * FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN read = false THEN 1 END) as unread
      FROM notifications 
      WHERE user_id = $1
    `;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const [notificationsResult, countResult] = await Promise.all([
      pool.query(notificationsQuery, [userId, parseInt(limit), offset]),
      pool.query(countQuery, [userId])
    ]);
    
    const notifications = notificationsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const unreadCount = parseInt(countResult.rows[0].unread);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
}));

// @desc    Obter configurações de notificação do usuário
// @route   GET /api/notifications/settings
// @access  Private (Operator+)
router.get('/settings', requireOperator, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Configurações de notificação obtidas com sucesso',
    data: {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },
      emailNotifications: true, // Configuração padrão
      pushNotifications: true   // Configuração padrão
    }
  });
}));

// @desc    Teste simples
// @route   GET /api/notifications/test-simple
// @access  Private (Operator+)
router.get('/test-simple', requireOperator, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Teste funcionando',
    user: req.user
  });
}));

// @desc    Obter notificação por ID
// @route   GET /api/notifications/:id
// @access  Private (Operator+)
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID da notificação inválido')
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
  const notificationId = parseInt(id);
  const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;

  const result = await pool.query(
    'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );

  const notification = result.rows.length > 0 ? result.rows[0] : null;

  if (!notification) {
    throw new AppError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
  }

  res.json({
    success: true,
    data: notification
  });
}));

// @desc    Criar nova notificação
// @route   POST /api/notifications
// @access  Private (Leader+)
router.post('/', [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('ID do usuário inválido'),
  body('type')
    .isIn(['QUALITY_TEST_MISSING', 'TEFLON_EXPIRING', 'TEFLON_EXPIRED', 'MACHINE_ALERT', 'SYSTEM_ALERT'])
    .withMessage('Tipo de notificação inválido'),
  body('priority')
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Prioridade inválida'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Título deve ter entre 1 e 200 caracteres'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Mensagem deve ter entre 1 e 1000 caracteres'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata deve ser um objeto')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const notificationData = {
    ...req.body,
    createdBy: req.user.id
  };

  // Verificar se usuário existe
  const userResult = await pool.query(
    'SELECT id, name, email FROM users WHERE id = $1',
    [notificationData.userId]
  );

  const user = userResult.rows.length > 0 ? userResult.rows[0] : null;

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  const notificationResult = await pool.query(
    `INSERT INTO notifications (user_id, type, priority, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      notificationData.userId,
      notificationData.type,
      notificationData.priority,
      notificationData.title,
      notificationData.message,
      JSON.stringify(notificationData.metadata || {})
    ]
  );

  const notification = notificationResult.rows[0];

  // Notificar via Socket.IO
  req.io.to(`user:${notificationData.userId}`).emit('new-notification', {
    ...notification,
    userId: notification.user_id,
    timestamp: notification.created_at
  });

  // Log da ação
  await pool.query(
    `INSERT INTO system_logs (action, user_id, details, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      'NOTIFICATION_CREATED',
      req.user.id,
      JSON.stringify({
        notificationId: notification.id,
        targetUserId: notificationData.userId,
        type: notification.type,
        priority: notification.priority
      }),
      req.ip,
      req.get('User-Agent')
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Notificação criada com sucesso',
    data: notification
  });
}));

// @desc    Marcar notificação como lida
// @route   PATCH /api/notifications/:id/read
// @access  Private (Operator+)
router.patch('/:id/read', [
  param('id').isInt({ min: 1 }).withMessage('ID da notificação inválido')
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
  const notificationId = parseInt(id);

  const result = await pool.query(
    'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
    [notificationId, req.user.id]
  );

  const notification = result.rows.length > 0 ? result.rows[0] : null;

  if (!notification) {
    throw new AppError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
  }

  if (notification.read) {
    return res.json({
      success: true,
      message: 'Notificação já estava marcada como lida',
      data: notification
    });
  }

  const updateResult = await pool.query(
    `UPDATE notifications 
     SET read = true, read_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, req.user.id]
  );

  const updatedNotification = updateResult.rows[0];

  // Notificar via Socket.IO
  req.io.to(`user:${req.user.id}`).emit('notification:read', {
    notificationId: id
  });

  res.json({
    success: true,
    message: 'Notificação marcada como lida',
    data: updatedNotification
  });
}));

// @desc    Marcar todas as notificações como lidas
// @route   PATCH /api/notifications/read-all
// @access  Private (Operator+)
router.patch('/read-all', requireOperator, asyncHandler(async (req, res) => {
  const userId = typeof req.user.id === 'string' ? parseInt(req.user.id) : req.user.id;
  
  const result = await pool.query(
    `UPDATE notifications 
     SET read = true, read_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND read = false`,
    [userId]
  );

  const count = result.rowCount;

  // Notificar via Socket.IO
  req.io.to(`user:${req.user.id}`).emit('notification:read-all');

  res.json({
    success: true,
    message: `${count} notificações marcadas como lidas`,
    count: count
  });
}));

// @desc    Deletar notificação
// @route   DELETE /api/notifications/:id
// @access  Private (Operator+)
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID da notificação inválido')
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
  const notificationId = parseInt(id);

  const result = await pool.query(
    'SELECT * FROM notifications WHERE id = $1 AND user_id = $2',
    [notificationId, req.user.id]
  );

  const notification = result.rows.length > 0 ? result.rows[0] : null;

  if (!notification) {
    throw new AppError('Notificação não encontrada', 404, 'NOTIFICATION_NOT_FOUND');
  }

  await pool.query(
    'DELETE FROM notifications WHERE id = $1',
    [notificationId]
  );

  // Notificar via Socket.IO
  req.io.to(`user:${req.user.id}`).emit('notification:deleted', {
    notificationId: id
  });

  res.json({
    success: true,
    message: 'Notificação deletada com sucesso'
  });
}));

// @desc    Obter contagem de notificações não lidas
// @route   GET /api/notifications/unread/count
// @access  Private (Operator+)
router.get('/unread/count', requireOperator, asyncHandler(async (req, res) => {
  const cacheKey = `unread_notifications:${req.user.id}`;
  let count = await getCache(cacheKey);

  if (count === null) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = false',
      [req.user.id]
    );
    
    count = parseInt(result.rows[0].count);

    // Cache por 1 minuto
    await setCache(cacheKey, count, 60);
  }

  res.json({
    success: true,
    data: { count: parseInt(count) }
  });
}));

// @desc    Obter notificações por tipo
// @route   GET /api/notifications/type/:type
// @access  Private (Operator+)
router.get('/type/:type', [
  param('type').isIn(['QUALITY_TEST_MISSING', 'TEFLON_EXPIRING', 'TEFLON_EXPIRED', 'MACHINE_ALERT', 'SYSTEM_ALERT']).withMessage('Tipo de notificação inválido'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { type } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notificationsResult, totalResult] = await Promise.all([
    pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 AND type = $2
       ORDER BY 
         CASE priority 
           WHEN 'URGENT' THEN 4
           WHEN 'HIGH' THEN 3
           WHEN 'MEDIUM' THEN 2
           WHEN 'LOW' THEN 1
         END DESC,
         created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.id, type, parseInt(limit), skip]
    ),
    pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND type = $2',
      [req.user.id, type]
    )
  ]);

  const notifications = notificationsResult.rows;
  const total = parseInt(totalResult.rows[0].count);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: notifications,
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

// @desc    Obter estatísticas de notificações
// @route   GET /api/notifications/stats/summary
// @access  Private (Leader+)
router.get('/stats/summary', requireLeader, asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalResult, unreadResult, recentResult, byTypeResult, byPriorityResult] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM notifications'),
    pool.query('SELECT COUNT(*) FROM notifications WHERE read = false'),
    pool.query('SELECT COUNT(*) FROM notifications WHERE created_at >= $1', [sevenDaysAgo]),
    pool.query(
      `SELECT type, COUNT(*) as count 
       FROM notifications 
       GROUP BY type 
       ORDER BY count DESC`
    ),
    pool.query(
      `SELECT priority, COUNT(*) as count 
       FROM notifications 
       GROUP BY priority 
       ORDER BY count DESC`
    )
  ]);

  const totalNotifications = parseInt(totalResult.rows[0].count);
  const unreadNotifications = parseInt(unreadResult.rows[0].count);
  const recentNotifications = parseInt(recentResult.rows[0].count);
  const byType = byTypeResult.rows;
  const byPriority = byPriorityResult.rows;

  const stats = {
    summary: {
      total: totalNotifications,
      unread: unreadNotifications,
      recent: recentNotifications,
      readRate: totalNotifications > 0 ? ((totalNotifications - unreadNotifications) / totalNotifications * 100).toFixed(1) : 0
    },
    byType: byType.map(item => ({
      type: item.type,
      count: parseInt(item.count)
    })),
    byPriority: byPriority.map(item => ({
      priority: item.priority,
      count: parseInt(item.count)
    }))
  };

  res.json({
    success: true,
    data: stats
  });
}));

// @desc    Criar notificação em lote
// @route   POST /api/notifications/batch
// @access  Private (Leader+)
router.post('/batch', [
  body('userIds')
    .isArray({ min: 1 })
    .withMessage('Lista de usuários deve ter pelo menos 1 item'),
  body('userIds.*')
    .isInt({ min: 1 })
    .withMessage('ID de usuário inválido'),
  body('type')
    .isIn(['QUALITY_TEST_MISSING', 'TEFLON_EXPIRING', 'TEFLON_EXPIRED', 'MACHINE_ALERT', 'SYSTEM_ALERT'])
    .withMessage('Tipo de notificação inválido'),
  body('priority')
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Prioridade inválida'),
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Título deve ter entre 1 e 200 caracteres'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Mensagem deve ter entre 1 e 1000 caracteres')
], requireLeader, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { userIds, type, priority, title, message, metadata } = req.body;

  // Verificar se todos os usuários existem
  const usersResult = await pool.query(
    'SELECT id, name FROM users WHERE id = ANY($1)',
    [userIds]
  );
  const users = usersResult.rows;

  if (users.length !== userIds.length) {
    throw new AppError('Alguns usuários não foram encontrados', 400, 'USERS_NOT_FOUND');
  }

  // Criar notificações em lote
  const placeholders = userIds.map((_, index) => {
    const base = index * 7;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  }).join(', ');
  
  const values = [];
  userIds.forEach(userId => {
    values.push(userId, type, priority, title, message, JSON.stringify(metadata || {}), req.user.id);
  });

  const notificationsResult = await pool.query(
    `INSERT INTO notifications (user_id, type, priority, title, message, metadata, created_by) 
     VALUES ${placeholders} 
     RETURNING id`,
    values
  );
  const notifications = { count: notificationsResult.rowCount };

  // Notificar via Socket.IO
  userIds.forEach(userId => {
    req.io.to(`user:${userId}`).emit('new-notification', {
      type,
      priority,
      title,
      message,
      userId,
      timestamp: new Date()
    });
  });

  // Log da ação
  await pool.query(
    `INSERT INTO system_logs (action, user_id, details, ip_address, user_agent, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      'NOTIFICATIONS_BATCH_CREATED',
      req.user.id,
      JSON.stringify({
        count: notifications.count,
        userIds,
        type,
        priority
      }),
      req.ip,
      req.get('User-Agent')
    ]
  );

  res.status(201).json({
    success: true,
    message: `${notifications.count} notificações criadas com sucesso`,
    count: notifications.count
  });
}));

// @desc    Registrar token de dispositivo para push notifications
// @route   POST /api/notifications/device-token
// @access  Private (Operator+)
router.post('/device-token', [
  body('token').notEmpty().withMessage('Token do dispositivo é obrigatório'),
  body('deviceType').optional().isIn(['web', 'android', 'ios']).withMessage('Tipo de dispositivo inválido')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { token, deviceType = 'web' } = req.body;
  const userId = req.user.id;

  // Verificar se o token já existe
  const existingDeviceResult = await pool.query(
    'SELECT id FROM user_devices WHERE token = $1 AND user_id = $2',
    [token, userId]
  );
  const existingDevice = existingDeviceResult.rows[0];

  if (existingDevice) {
    // Atualizar último acesso
    await pool.query(
      'UPDATE user_devices SET last_used = NOW() WHERE id = $1',
      [existingDevice.id]
    );
  } else {
    // Criar novo registro
    await pool.query(
      `INSERT INTO user_devices (user_id, token, device_type, is_active, last_used, created_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [userId, token, deviceType, true]
    );
  }

  res.json({
    success: true,
    message: 'Token registrado com sucesso'
  });
}));

// @desc    Enviar notificação de teste
// @route   POST /api/notifications/test
// @access  Private (Admin)
router.post('/test', [
  body('title').notEmpty().withMessage('Título é obrigatório'),
  body('message').notEmpty().withMessage('Mensagem é obrigatória'),
  body('type').optional().isIn(['INFO', 'WARNING', 'ERROR', 'SUCCESS']).withMessage('Tipo inválido'),
  body('targetUserId').optional().isInt().withMessage('ID do usuário deve ser um número'),
  body('targetRole').optional().isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']).withMessage('Papel inválido')
], requireRole(['ADMIN']), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { type, title, message, targetUserId, targetRole } = req.body;

  const notificationData = {
    type: type || 'INFO',
    title,
    message,
    priority: 'MEDIUM',
    channels: ['EMAIL', 'PUSH', 'IN_APP']
  };

  if (targetUserId) {
    await NotificationService.sendToUser(targetUserId, notificationData);
  } else if (targetRole) {
    await NotificationService.sendToRole(targetRole, notificationData);
  } else {
    return res.status(400).json({
      success: false,
      message: 'Especifique um usuário ou papel de destino'
    });
  }

  res.json({
    success: true,
    message: 'Notificação de teste enviada com sucesso'
  });
}));



// @desc    Atualizar configurações de notificação
// @route   PATCH /api/notifications/settings
// @access  Private (Operator+)
// @desc    Enviar notificação para gestores
// @route   POST /api/notifications/managers
// @access  Private (Operator+)
router.post('/managers', [
  body('type').notEmpty().withMessage('Tipo é obrigatório'),
  body('machineId').isInt({ min: 1 }).withMessage('ID da máquina inválido'),
  body('machineName').notEmpty().withMessage('Nome da máquina é obrigatório'),
  body('operator').notEmpty().withMessage('Nome do operador é obrigatório'),
  body('timestamp').isISO8601().withMessage('Timestamp inválido')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros inválidos',
      errors: errors.array()
    });
  }

  const { type, machineId, machineName, operator, timestamp, ...additionalData } = req.body;

  try {
    // Buscar todos os usuários com papel de MANAGER ou LEADER
    const managersQuery = `
      SELECT id, name, email FROM users 
      WHERE role IN ('MANAGER', 'LEADER') AND active = true
    `;
    const managersResult = await pool.query(managersQuery);
    const managers = managersResult.rows;

    if (managers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nenhum gestor encontrado'
      });
    }

    // Criar título e mensagem baseados no tipo
    let title, message, priority;
    switch (type) {
      case 'overdue_test':
        title = `Teste de Qualidade em Atraso - ${machineName}`;
        message = `O operador ${operator} está com teste de qualidade em atraso na máquina ${machineName}.`;
        priority = 'HIGH';
        break;
      case 'test_required':
        title = `Teste de Qualidade Necessário - ${machineName}`;
        message = `É necessário realizar teste de qualidade na máquina ${machineName} (Operador: ${operator}).`;
        priority = 'MEDIUM';
        break;
      case 'manual_alert':
        title = `Alerta Manual - ${machineName}`;
        message = `O operador ${operator} enviou um alerta manual da máquina ${machineName}.`;
        priority = 'URGENT';
        break;
      default:
        title = `Alerta da Máquina - ${machineName}`;
        message = `Alerta recebido da máquina ${machineName} (Operador: ${operator}).`;
        priority = 'MEDIUM';
    }

    // Criar notificações para todos os gestores
    const notificationPromises = managers.map(manager => {
      const notificationData = {
        user_id: manager.id,
        type: 'MACHINE_ALERT',
        priority,
        title,
        message,
        metadata: {
          machineId,
          machineName,
          operator,
          alertType: type,
          timestamp,
          ...additionalData
        },
        created_by: req.user.id
      };

      return pool.query(
        `INSERT INTO notifications (user_id, type, priority, title, message, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [notificationData.user_id, notificationData.type, notificationData.priority, 
         notificationData.title, notificationData.message, JSON.stringify(notificationData.metadata), 
         notificationData.created_by]
      );
    });

    const results = await Promise.all(notificationPromises);
    const notificationIds = results.map(result => result.rows[0].id);

    // Tentar enviar notificações via NotificationService se disponível
    try {
      for (const manager of managers) {
        await NotificationService.sendToUser(manager.id, {
          type: 'MACHINE_ALERT',
          priority,
          title,
          message,
          metadata: {
            machineId,
            machineName,
            operator,
            alertType: type,
            timestamp,
            ...additionalData
          }
        });
      }
    } catch (serviceError) {
      console.warn('Erro ao enviar via NotificationService:', serviceError.message);
      // Continua mesmo se o serviço de notificação falhar
    }

    res.status(201).json({
      success: true,
      message: `Notificação enviada para ${managers.length} gestor(es)`,
      data: {
        notificationIds,
        managersNotified: managers.length,
        managers: managers.map(m => ({ id: m.id, name: m.name }))
      }
    });

  } catch (error) {
    console.error('Erro ao enviar notificação para gestores:', error);
    throw new AppError('Erro interno do servidor ao enviar notificação', 500);
  }
}));

router.patch('/settings', [
  body('emailNotifications').optional().isBoolean().withMessage('emailNotifications deve ser boolean'),
  body('pushNotifications').optional().isBoolean().withMessage('pushNotifications deve ser boolean')
], requireOperator, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  const { emailNotifications, pushNotifications } = req.body;

  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;

  if (emailNotifications !== undefined) {
    updateFields.push(`email_notifications = $${paramIndex++}`);
    updateValues.push(emailNotifications);
  }
  if (pushNotifications !== undefined) {
    updateFields.push(`push_notifications = $${paramIndex++}`);
    updateValues.push(pushNotifications);
  }

  updateValues.push(userId);

  const updatedUserResult = await pool.query(
    `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() 
     WHERE id = $${paramIndex} 
     RETURNING email_notifications, push_notifications`,
    updateValues
  );
  const updatedUser = updatedUserResult.rows[0];

  res.json({
    success: true,
    data: updatedUser
  });
}));

module.exports = router;