const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { requireLeader, requireManager, authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { setCache, getCache, deleteCache } = require('../config/redis');

const router = express.Router();

// @desc    Listar usuários
// @route   GET /api/users
// @access  Private (Leader+)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser entre 1 e 100'),
  query('role').optional().isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']).withMessage('Role inválido'),
  query('active').optional().isBoolean().withMessage('Active deve ser boolean'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Busca deve ter pelo menos 1 caractere')
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
    page = 1,
    limit = 20,
    role,
    active,
    search
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  // Construir query SQL dinamicamente
  let query = `
    SELECT 
      u.id, u.name, u.email, u.badge_number, u.role, u.is_active, u.created_at, u.updated_at,
      (
        SELECT COUNT(*) FROM machine_operations mo WHERE mo.user_id = u.id
      ) as machine_operations_count,
      (
        SELECT COUNT(*) FROM quality_tests qt WHERE qt.user_id = u.id
      ) as quality_tests_count,
      (
        SELECT COUNT(*) FROM teflon_changes tc WHERE tc.user_id = u.id
      ) as teflon_changes_count
    FROM users u
    WHERE 1=1
  `;
  
  let countQuery = 'SELECT COUNT(*) FROM users u WHERE 1=1';
  const queryParams = [];
  let paramIndex = 1;
  
  // Filtros
  if (role) {
    query += ` AND u.role = $${paramIndex}`;
    countQuery += ` AND u.role = $${paramIndex}`;
    queryParams.push(role);
    paramIndex++;
  }
  
  if (active !== undefined) {
    query += ` AND u.is_active = $${paramIndex}`;
    countQuery += ` AND u.is_active = $${paramIndex}`;
    queryParams.push(active === 'true');
    paramIndex++;
  }
  
  if (search) {
    query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
    countQuery += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }
  
  query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(parseInt(limit), skip);
  
  const [usersResult, totalResult] = await Promise.all([
    pool.query(query, queryParams),
    pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit e offset do count
  ]);
  
  const users = usersResult.rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    badgeNumber: row.badge_number,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    _count: {
      machineOperations: parseInt(row.machine_operations_count),
      qualityTests: parseInt(row.quality_tests_count),
      teflonChanges: parseInt(row.teflon_changes_count)
    }
  }));
  
  const total = parseInt(totalResult.rows[0].count);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: users,
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

// @desc    Obter usuário por ID
// @route   GET /api/users/:id
// @access  Private (Leader+)
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo')
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

  const userQuery = `
    SELECT 
      u.id, u.name, u.email, u.avatar, u.badge_number, u.role, u.is_active, u.created_at, u.updated_at,
      (
        SELECT COUNT(*) FROM machine_operations mo WHERE mo.user_id = u.id
      ) as machine_operations_count,
      (
        SELECT COUNT(*) FROM quality_tests qt WHERE qt.user_id = u.id
      ) as quality_tests_count,
      (
        SELECT COUNT(*) FROM teflon_changes tc WHERE tc.user_id = u.id
      ) as teflon_changes_count,
      (
        SELECT COUNT(*) FROM notifications n WHERE n.user_id = u.id
      ) as notifications_count
    FROM users u
    WHERE u.id = $1
  `;
  
  const result = await pool.query(userQuery, [parseInt(id)]);
  
  if (result.rows.length === 0) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }
  
  const row = result.rows[0];
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    badgeNumber: row.badge_number,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    _count: {
      machineOperations: parseInt(row.machine_operations_count),
      qualityTests: parseInt(row.quality_tests_count),
      teflonChanges: parseInt(row.teflon_changes_count),
      notifications: parseInt(row.notifications_count)
    }
  };



  res.json({
    success: true,
    data: user
  });
}));

// @desc    Criar novo usuário
// @route   POST /api/users
// @access  Private (Manager+)
router.post('/', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('badgeNumber')
    .optional()
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('Número do crachá deve ter entre 1 e 20 caracteres'),
  body('role')
    .isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'])
    .withMessage('Role inválido'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser boolean')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { name, email, password, badgeNumber, role, isActive = true } = req.body;

  // Verificar se email já existe
  const emailCheckResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  
  if (emailCheckResult.rows.length > 0) {
    throw new AppError('Email já está em uso', 400, 'EMAIL_ALREADY_EXISTS');
  }

  // Verificar se número do crachá já existe (se fornecido)
  if (badgeNumber) {
    const badgeCheckResult = await pool.query('SELECT id FROM users WHERE badge_number = $1', [badgeNumber]);
    
    if (badgeCheckResult.rows.length > 0) {
      throw new AppError('Número do crachá já está em uso', 400, 'BADGE_NUMBER_ALREADY_EXISTS');
    }
  }

  // Verificar permissões para criar usuário com role específico
  if (req.user.role === 'MANAGER' && ['ADMIN'].includes(role)) {
    throw new AppError('Sem permissão para criar usuário com este role', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  // Hash da senha
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const createUserQuery = `
    INSERT INTO users (name, email, password, badge_number, role, is_active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, name, email, badge_number, role, is_active, created_at
  `;
  
  const createResult = await pool.query(createUserQuery, [
    name,
    email,
    hashedPassword,
    badgeNumber,
    role,
    isActive
  ]);
  
  const row = createResult.rows[0];
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    badgeNumber: row.badge_number,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at
  };

  // Log da ação
  await pool.query(`
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'USER_CREATED',
    req.user.id,
    JSON.stringify({
      createdUserId: user.id,
      createdUserEmail: user.email,
      createdUserRole: user.role
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  res.status(201).json({
    success: true,
    message: 'Usuário criado com sucesso',
    data: user
  });
}));

// @desc    Atualizar perfil do usuário logado
// @route   PUT /api/users/profile
// @access  Private (Qualquer usuário autenticado)
router.put('/profile', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { name, email } = req.body;
  const userId = req.user.id;

  // Verificar se email já existe (se fornecido)
  if (email) {
    const emailCheckResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, userId]
    );

    if (emailCheckResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email já está em uso por outro usuário',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }
  }

  // Atualizar dados do usuário
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;
  
  if (name) {
    updateFields.push(`name = $${paramIndex}`);
    updateValues.push(name);
    paramIndex++;
  }
  
  if (email) {
    updateFields.push(`email = $${paramIndex}`);
    updateValues.push(email);
    paramIndex++;
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Nenhum campo para atualizar'
    });
  }
  
  updateValues.push(userId);
  
  const updateQuery = `
    UPDATE users 
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramIndex}
    RETURNING id, name, email, badge_number, role, is_active, created_at, updated_at
  `;
  
  const updateResult = await pool.query(updateQuery, updateValues);
  const row = updateResult.rows[0];
  
  const updatedUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    badgeNumber: row.badge_number,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  // Log da ação
  await pool.query(`
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'PROFILE_UPDATED',
    req.user.id,
    JSON.stringify({
      updatedFields: Object.keys(req.body)
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  res.json({
    success: true,
    message: 'Perfil atualizado com sucesso',
    data: updatedUser
  });
}));

// @desc    Atualizar usuário
// @route   PUT /api/users/:id
// @access  Private (Manager+)
router.put('/:id', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('role')
    .optional()
    .isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'])
    .withMessage('Role inválido'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser boolean')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { name, email, phone, role, badgeNumber, isActive, password } = req.body;
  
  // Construir objeto de atualização apenas com campos válidos e não nulos
  const updateData = {};
  
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined && phone !== null) updateData.phone = phone;
  if (role !== undefined) updateData.role = role;
  if (badgeNumber !== undefined && badgeNumber !== null) updateData.badgeNumber = badgeNumber;
  if (isActive !== undefined) updateData.isActive = isActive;
  
  // Adicionar senha apenas se foi fornecida
  if (password) {
    updateData.password = password;
  }

  // Verificar se usuário existe
  const existingUserResult = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(id)]);
  
  if (existingUserResult.rows.length === 0) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }
  
  const existingUser = existingUserResult.rows[0];

  // Verificar se não está tentando atualizar próprio usuário para inativo
  if (parseInt(id) === req.user.id && isActive === false) {
    throw new AppError('Não é possível desativar sua própria conta', 400, 'CANNOT_DEACTIVATE_SELF');
  }

  // Verificar permissões para alterar role
  if (role) {
    if (req.user.role === 'MANAGER' && ['ADMIN'].includes(role)) {
      throw new AppError('Sem permissão para alterar para este role', 403, 'INSUFFICIENT_PERMISSIONS');
    }
    if (req.user.role === 'MANAGER' && existingUser.role === 'ADMIN') {
      throw new AppError('Sem permissão para alterar usuário ADMIN', 403, 'INSUFFICIENT_PERMISSIONS');
    }
  }

  // Verificar se email já existe (se estiver sendo alterado)
  if (email && email !== existingUser.email) {
    const emailCheckResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, parseInt(id)]
    );

    if (emailCheckResult.rows.length > 0) {
      throw new AppError('Email já está em uso', 400, 'EMAIL_ALREADY_EXISTS');
    }
  }

  // Verificar se número do crachá já existe (se estiver sendo alterado)
  if (badgeNumber && badgeNumber !== existingUser.badge_number) {
    const badgeCheckResult = await pool.query(
      'SELECT id FROM users WHERE badge_number = $1 AND id != $2',
      [badgeNumber, parseInt(id)]
    );

    if (badgeCheckResult.rows.length > 0) {
      throw new AppError('Número do crachá já está em uso', 400, 'BADGE_NUMBER_ALREADY_EXISTS');
    }
  }

  // Construir query de atualização dinamicamente
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;
  
  if (name !== undefined) {
    updateFields.push(`name = $${paramIndex}`);
    updateValues.push(name);
    paramIndex++;
  }
  
  if (email !== undefined) {
    updateFields.push(`email = $${paramIndex}`);
    updateValues.push(email);
    paramIndex++;
  }
  
  if (phone !== undefined) {
    updateFields.push(`phone = $${paramIndex}`);
    updateValues.push(phone);
    paramIndex++;
  }
  
  if (role !== undefined) {
    updateFields.push(`role = $${paramIndex}`);
    updateValues.push(role);
    paramIndex++;
  }
  
  if (badgeNumber !== undefined) {
    updateFields.push(`badge_number = $${paramIndex}`);
    updateValues.push(badgeNumber);
    paramIndex++;
  }
  
  if (isActive !== undefined) {
    updateFields.push(`is_active = $${paramIndex}`);
    updateValues.push(isActive);
    paramIndex++;
  }
  
  if (password) {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    updateFields.push(`password = $${paramIndex}`);
    updateValues.push(hashedPassword);
    paramIndex++;
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Nenhum campo para atualizar'
    });
  }
  
  updateValues.push(parseInt(id));
  
  const updateQuery = `
    UPDATE users 
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramIndex}
    RETURNING id, name, email, avatar, badge_number, role, is_active, created_at, updated_at
  `;
  
  const updateResult = await pool.query(updateQuery, updateValues);
  const row = updateResult.rows[0];
  
  const updatedUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    badgeNumber: row.badge_number,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  // Log da ação
  await pool.query(`
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'USER_UPDATED',
    req.user.id,
    JSON.stringify({
      updatedUserId: id,
      changes: req.body
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  res.json({
    success: true,
    message: 'Usuário atualizado com sucesso',
    data: updatedUser
  });
}));

// @desc    Alterar senha do usuário
// @route   PATCH /api/users/:id/password
// @access  Private (Manager+ ou próprio usuário)
router.patch('/:id/password', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo'),
  body('currentPassword')
    .if((value, { req }) => req.user.id === req.params.id)
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Verificar permissões
  const isOwnAccount = req.user.id === parseInt(id);
  const hasManagerPermission = ['MANAGER', 'ADMIN'].includes(req.user.role);

  if (!isOwnAccount && !hasManagerPermission) {
    throw new AppError('Sem permissão para alterar senha deste usuário', 403, 'INSUFFICIENT_PERMISSIONS');
  }

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(id)]);
  
  if (userResult.rows.length === 0) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }
  
  const user = userResult.rows[0];

  // Se for própria conta, verificar senha atual
  if (isOwnAccount) {
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError('Senha atual incorreta', 400, 'INVALID_CURRENT_PASSWORD');
    }
  }

  // Hash da nova senha
  const salt = await bcrypt.genSalt(12);
  const hashedNewPassword = await bcrypt.hash(newPassword, salt);

  await pool.query(
    'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [hashedNewPassword, parseInt(id)]
  );

  // Log da ação
  await pool.query(`
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'PASSWORD_CHANGED',
    req.user.id,
    JSON.stringify({
      targetUserId: id,
      changedByOwner: isOwnAccount
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  res.json({
    success: true,
    message: 'Senha alterada com sucesso'
  });
}));

// @desc    Desativar usuário
// @route   PATCH /api/users/:id/deactivate
// @access  Private (Manager+)
router.patch('/:id/deactivate', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    throw new AppError('Não é possível desativar sua própria conta', 400, 'CANNOT_DEACTIVATE_SELF');
  }

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(id)]);
  
  if (userResult.rows.length === 0) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }
  
  const user = userResult.rows[0];

  if (!user.is_active) {
    return res.json({
      success: true,
      message: 'Usuário já estava desativado'
    });
  }

  await pool.query(
    'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [parseInt(id)]
  );

  // Log da ação
  await pool.query(`
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'USER_DEACTIVATED',
    req.user.id,
    JSON.stringify({
      deactivatedUserId: id,
      deactivatedUserEmail: user.email
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  res.json({
    success: true,
    message: 'Usuário desativado com sucesso'
  });
}));

// @desc    Reativar usuário
// @route   PATCH /api/users/:id/activate
// @access  Private (Manager+)
router.patch('/:id/activate', [
  param('id').isInt({ min: 1 }).withMessage('ID do usuário deve ser um número positivo')
], requireManager, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { id } = req.params;

  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(id)]);
  
  if (userResult.rows.length === 0) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }
  
  const user = userResult.rows[0];

  if (user.is_active) {
    return res.json({
      success: true,
      message: 'Usuário já estava ativo'
    });
  }

  await pool.query(
    'UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [parseInt(id)]
  );

  // Log da ação
  await pool.query(`
    INSERT INTO system_logs (action, user_id, details, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'USER_ACTIVATED',
    req.user.id,
    JSON.stringify({
      activatedUserId: id,
      activatedUserEmail: user.email
    }),
    req.ip,
    req.get('User-Agent')
  ]);

  res.json({
    success: true,
    message: 'Usuário reativado com sucesso'
  });
}));

// @desc    Atualizar perfil do usuário logado
// @route   PUT /api/users/profile
// @access  Private (Qualquer usuário autenticado)
router.put('/profile', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido')
], asyncHandler(async (req, res) => {
  console.log('PUT /profile - req.body:', req.body);
  console.log('PUT /profile - req.user:', req.user);
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('PUT /profile - Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const userId = req.user.id;
  // Filtrar apenas os campos que existem no modelo User
  const { name, email } = req.body;
  const updateData = {};
  
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;

  // Verificar se email já existe (se estiver sendo alterado)
  if (updateData.email) {
    const emailCheckResult = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [updateData.email, userId]
    );

    if (emailCheckResult.rows.length > 0) {
      throw new AppError('Email já está em uso', 400, 'EMAIL_ALREADY_EXISTS');
    }
  }

  // Construir query de atualização dinamicamente
  const updateFields = [];
  const updateValues = [];
  let paramIndex = 1;
  
  if (updateData.name !== undefined) {
    updateFields.push(`name = $${paramIndex}`);
    updateValues.push(updateData.name);
    paramIndex++;
  }
  
  if (updateData.email !== undefined) {
    updateFields.push(`email = $${paramIndex}`);
    updateValues.push(updateData.email);
    paramIndex++;
  }
  
  if (updateFields.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Nenhum campo para atualizar'
    });
  }
  
  updateValues.push(userId);
  
  const updateQuery = `
    UPDATE users 
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramIndex}
    RETURNING id, name, email, badge_number, role, is_active, created_at, updated_at
  `;
  
  const updateResult = await pool.query(updateQuery, updateValues);
  const row = updateResult.rows[0];
  
  const updatedUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    badgeNumber: row.badge_number,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  res.json({
    success: true,
    message: 'Perfil atualizado com sucesso',
    data: updatedUser
  });
}));

// @desc    Obter estatísticas de usuários
// @route   GET /api/users/stats/summary
// @access  Private (Manager+)
router.get('/stats/summary', requireManager, asyncHandler(async (req, res) => {
  const [totalUsersResult, activeUsersResult, byRoleResult] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM users'),
    pool.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
    pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC')
  ]);
  
  const totalUsers = parseInt(totalUsersResult.rows[0].count);
  const activeUsers = parseInt(activeUsersResult.rows[0].count);
  const byRole = byRoleResult.rows.map(row => ({
    role: row.role,
    count: parseInt(row.count)
  }));
  const recentLogins = 0; // lastLogin field doesn't exist in schema

  const stats = {
    summary: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      recentLogins
    },
    byRole
  };

  res.json({
    success: true,
    data: stats
  });
}));

module.exports = router;