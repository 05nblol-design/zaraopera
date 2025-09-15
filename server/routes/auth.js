const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { generateToken, verifyToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { captureException } = require('../config/sentry');
const tokenService = require('../services/tokenService');
const authMonitoring = require('../services/authMonitoring');

const router = express.Router();

// @desc    Registrar novo usuário
// @route   POST /api/auth/register
// @access  Public (apenas para desenvolvimento/admin)
router.post('/register', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email válido é obrigatório'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('role')
    .optional()
    .isIn(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'])
    .withMessage('Role inválido')
], asyncHandler(async (req, res) => {
  // Verificar erros de validação
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { email, password, name, role = 'OPERATOR' } = req.body;

  try {
    // Verificar se usuário já existe
    const existingUserResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    const existingUser = existingUserResult.rows[0];

    if (existingUser) {
      throw new AppError('Usuário já existe com este email', 400, 'USER_EXISTS');
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Criar usuário
    const userResult = await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, is_active, created_at',
      [email, hashedPassword, name, role]
    );
    const createdUser = userResult.rows[0];
    
    // Converter snake_case para camelCase para compatibilidade
    delete createdUser.created_at;

    // Gerar tokens
    const { accessToken, refreshToken } = await tokenService.generateTokenPair(createdUser.id);

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: createdUser,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    if (error.code === '23505') { // PostgreSQL unique violation
      throw new AppError('Email já está em uso', 400, 'EMAIL_IN_USE');
    }
    throw error;
  }
}));

// @desc    Login do usuário
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email válido é obrigatório'),
  body('password')
    .notEmpty()
    .withMessage('Senha é obrigatória')
], asyncHandler(async (req, res) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  // Verificar se IP está bloqueado
  if (authMonitoring.isIpBlocked(clientIp)) {
    await authMonitoring.logLoginAttempt({
      email: req.body.email,
      ip: clientIp,
      userAgent,
      success: false,
      errorCode: 'IP_BLOCKED',
      requestId
    });
    
    throw new AppError('IP temporariamente bloqueado devido a muitas tentativas falhadas', 429, 'IP_BLOCKED');
  }
  
  // Verificar erros de validação
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    await authMonitoring.logLoginAttempt({
      email: req.body.email,
      ip: clientIp,
      userAgent,
      success: false,
      errorCode: 'VALIDATION_ERROR',
      requestId
    });
    
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  let user;

  // Buscar usuário no banco PostgreSQL
  console.log('🔍 Debug - Iniciando busca no banco para:', email);
  try {
    console.log('🔍 Debug - Executando query PostgreSQL...');
    const userResult = await pool.query(
      'SELECT id, email, name, role, password, is_active FROM users WHERE email = $1',
      [email]
    );
    console.log('🔍 Debug - Query executada com sucesso, rows:', userResult.rows.length);
    user = userResult.rows[0];
    
    // Converter snake_case para camelCase
    if (user) {
      console.log('🔍 Debug - Usuário encontrado, convertendo campos...');
      user.isActive = user.is_active;
      delete user.is_active;
      console.log('🔍 Debug - Campos convertidos com sucesso');
    } else {
      console.log('🔍 Debug - Nenhum usuário encontrado');
    }
  } catch (dbError) {
    console.error('❌ Erro detalhado no PostgreSQL:', {
      message: dbError.message,
      code: dbError.code,
      detail: dbError.detail,
      hint: dbError.hint,
      severity: dbError.severity,
      stack: dbError.stack
    });
    console.log('⚠️ PostgreSQL não disponível para login');
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      code: 'DATABASE_ERROR'
    });
  }

  console.log('🔍 Debug - Usuário encontrado:', user ? 'SIM' : 'NÃO');
  if (user) {
    console.log('🔍 Debug - Email:', user.email);
    console.log('🔍 Debug - isActive:', user.isActive);
  }

  if (!user) {
    await authMonitoring.logLoginAttempt({
      email,
      ip: clientIp,
      userAgent,
      success: false,
      errorCode: 'USER_NOT_FOUND',
      requestId
    });
    
    throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    await authMonitoring.logLoginAttempt({
      email,
      ip: clientIp,
      userAgent,
      success: false,
      errorCode: 'USER_INACTIVE',
      userId: user.id,
      requestId
    });
    
    throw new AppError('Usuário inativo', 401, 'USER_INACTIVE');
  }

  // Verificar senha
  console.log('🔍 Debug - Verificando senha para:', email);
  console.log('🔍 Debug - Senha fornecida:', password);
  console.log('🔍 Debug - Hash no banco:', user.password);
  
  // Para usuários do banco, usar bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password);
  console.log('🔍 Debug - Comparação bcrypt:', isPasswordValid);
  
  console.log('🔍 Debug - Senha válida?', isPasswordValid);

  if (!isPasswordValid) {
    await authMonitoring.logLoginAttempt({
      email,
      ip: clientIp,
      userAgent,
      success: false,
      errorCode: 'INVALID_PASSWORD',
      userId: user.id,
      requestId
    });
    
    throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
  }

  // Gerar tokens
  const { accessToken, refreshToken } = await tokenService.generateTokenPair(user);
  
  // Log de login bem-sucedido
  await authMonitoring.logLoginAttempt({
    email,
    ip: clientIp,
    userAgent,
    success: true,
    userId: user.id,
    requestId
  });

  res.json({
    success: true,
    message: 'Login realizado com sucesso',
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive
      },
      accessToken,
      refreshToken
    }
  });
}));

// @desc    Verificar token
// @route   GET /api/auth/verify
// @access  Public
router.get('/verify', asyncHandler(async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token não fornecido',
      code: 'NO_TOKEN'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }

  let user;

  // Buscar usuário no banco PostgreSQL
  try {
    const userResult = await pool.query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );
    user = userResult.rows[0];
    
    // Converter is_active para isActive para compatibilidade
    if (user) {
      user.isActive = user.is_active;
    }
  } catch (dbError) {
    console.log('⚠️ PostgreSQL não disponível, usando usuários de teste');
    // Fallback para usuários de teste
    const testUsers = {
      1: { id: 1, email: 'admin@zara.com', name: 'Admin', role: 'ADMIN', isActive: true },
      2: { id: 2, email: 'manager@zara.com', name: 'Manager', role: 'MANAGER', isActive: true },
      3: { id: 3, email: 'leader@zara.com', name: 'Leader', role: 'LEADER', isActive: true },
      4: { id: 4, email: 'operator@zara.com', name: 'Operator', role: 'OPERATOR', isActive: true }
    };
    user = testUsers[decoded.id];
  }

  if (!user || !user.isActive) {
    return res.status(401).json({
      success: false,
      message: 'Usuário não encontrado ou inativo',
      code: 'USER_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    message: 'Token válido',
    data: { user }
  });
}));

// @desc    Renovar access token usando refresh token
// @route   POST /api/auth/refresh
// @access  Public
router.post('/refresh', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token é obrigatório')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { refreshToken } = req.body;

  try {
    const newAccessToken = tokenService.refreshAccessToken(refreshToken);
    
    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    throw new AppError('Refresh token inválido ou expirado', 401, 'INVALID_REFRESH_TOKEN');
  }
}));

// @desc    Logout do usuário
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', [
  body('refreshToken')
    .optional()
    .isString()
    .withMessage('Refresh token deve ser uma string')
], asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  // Revogar refresh token se fornecido
  if (refreshToken) {
    try {
      tokenService.revokeRefreshToken(refreshToken);
    } catch (error) {
      // Log do erro mas não falha o logout
      console.warn('Erro ao revogar refresh token:', error.message);
    }
  }
  
  res.json({
    success: true,
    message: 'Logout realizado com sucesso'
  });
}));

// @desc    Revogar refresh token
// @route   POST /api/auth/revoke
// @access  Private
router.post('/revoke', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token é obrigatório')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { refreshToken } = req.body;

  try {
    tokenService.revokeRefreshToken(refreshToken);
    
    res.json({
      success: true,
      message: 'Refresh token revogado com sucesso'
    });
  } catch (error) {
    throw new AppError('Refresh token inválido', 400, 'INVALID_REFRESH_TOKEN');
  }
}));

// @desc    Alterar senha
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', [
  body('currentPassword')
    .notEmpty()
    .withMessage('Senha atual é obrigatória'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nova senha deve ter pelo menos 6 caracteres')
], asyncHandler(async (req, res) => {
  // Verificar token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    throw new AppError('Token não fornecido', 401, 'NO_TOKEN');
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    throw new AppError('Token inválido', 401, 'INVALID_TOKEN');
  }

  // Verificar erros de validação
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados inválidos',
      errors: errors.array()
    });
  }

  const { currentPassword, newPassword } = req.body;

  // Buscar usuário
  const userResult = await pool.query(
    'SELECT id, password FROM users WHERE id = $1',
    [decoded.id]
  );
  const user = userResult.rows[0];

  if (!user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  // Verificar senha atual
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new AppError('Senha atual incorreta', 400, 'INVALID_CURRENT_PASSWORD');
  }

  // Hash da nova senha
  const salt = await bcrypt.genSalt(12);
  const hashedNewPassword = await bcrypt.hash(newPassword, salt);

  // Atualizar senha
  await pool.query(
    'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [hashedNewPassword, user.id]
  );

  // Log da alteração
  await pool.query(
    'INSERT INTO system_logs (action, user_id, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
    [
      'PASSWORD_CHANGE',
      user.id,
      req.ip,
      req.get('User-Agent')
    ]
  );

  res.json({
    success: true,
    message: 'Senha alterada com sucesso'
  });
}));

// @desc    Obter estatísticas de segurança
// @route   GET /api/auth/security-stats
// @access  Private (Admin only)
router.get('/security-stats', asyncHandler(async (req, res) => {
  // Verificar token
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    throw new AppError('Token não fornecido', 401, 'NO_TOKEN');
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    throw new AppError('Token inválido', 401, 'INVALID_TOKEN');
  }

  // Buscar usuário para verificar role
  let user;
  try {
    const userResult = await pool.query(
      'SELECT id, role FROM users WHERE id = $1',
      [decoded.id]
    );
    user = userResult.rows[0];
  } catch (dbError) {
    // Fallback para usuários de teste
    const testUsers = {
      1: { role: 'ADMIN' },
      2: { role: 'MANAGER' },
      3: { role: 'LEADER' },
      4: { role: 'OPERATOR' }
    };
    user = testUsers[decoded.id];
  }

  if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
    throw new AppError('Acesso negado - privilégios insuficientes', 403, 'INSUFFICIENT_PRIVILEGES');
  }

  const stats = authMonitoring.getSecurityStats();
  
  res.json({
    success: true,
    message: 'Estatísticas de segurança obtidas com sucesso',
    data: stats
  });
}));

module.exports = router;