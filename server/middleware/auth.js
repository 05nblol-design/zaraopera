const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { captureException } = require('../config/sentry');
const auditLogger = require('../services/auditLogger');

// Middleware de autenticação para WebSocket
const authenticateSocket = async (socket, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    console.log(`🔐 [${requestId}] AuthenticateSocket middleware iniciado`);
    
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    // Log detalhado da autenticação
    console.log(`🔐 [${requestId}] Autenticação WebSocket:`, {
      tokenPresent: !!token,
      tokenLength: token ? token.length : 0,
      userAgent: socket.handshake.headers['user-agent'],
      origin: socket.handshake.headers.origin,
      timestamp: new Date().toISOString()
    });
    
    // Verificar se o token está presente
    if (!token) {
      const errorMsg = 'Token não fornecido para conexão WebSocket';
      console.error(`❌ [${requestId}] ${errorMsg}`);
      
      // Log de auditoria para falha de autenticação
      try {
        await auditLogger.logAuth({
          action: 'WEBSOCKET_CONNECTION',
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          success: false,
          errorCode: 'NO_TOKEN',
          requestId,
          metadata: {
            origin: socket.handshake.headers.origin,
            transport: socket.conn.transport.name
          }
        });
      } catch (auditError) {
        console.error('Erro no log de auditoria:', auditError);
      }
      
      socket.emit('auth_error', {
        message: 'Token inválido',
        code: 'NO_TOKEN',
        timestamp: new Date().toISOString(),
        requestId
      });
      
      return next(new Error('Token inválido'));
    }

    // Verificar token
    console.log(`🔐 [${requestId}] Verificando token JWT WebSocket...`);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log(`✅ [${requestId}] Usuário autenticado com sucesso:`, {
      userId: decoded.id,
      timestamp: new Date().toISOString()
    });
    
    // Log de auditoria para autenticação bem-sucedida
    try {
      await auditLogger.logAuth({
        action: 'WEBSOCKET_CONNECTION',
        userId: decoded.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        success: true,
        requestId,
        metadata: {
          origin: socket.handshake.headers.origin,
          transport: socket.conn.transport.name
        }
      });
    } catch (auditError) {
      console.error('Erro no log de auditoria:', auditError);
    }
    
    // Adicionar informações do usuário ao socket
    socket.userId = decoded.id;
    socket.requestId = requestId;
    
    next();

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
      console.error(`❌ [${requestId}] Erro na verificação do token:`, {
        error: error.name,
        message: error.message,
        tokenLength: token ? token.length : 0,
        timestamp: new Date().toISOString()
      });
      
      let errorMessage = 'Token inválido';
      let errorCode = 'INVALID_TOKEN';
      
      if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Token malformado';
        errorCode = 'MALFORMED_TOKEN';
      } else if (error.name === 'TokenExpiredError') {
        errorMessage = 'Token expirado';
        errorCode = 'EXPIRED_TOKEN';
      } else if (error.name === 'NotBeforeError') {
        errorMessage = 'Token ainda não é válido';
        errorCode = 'TOKEN_NOT_ACTIVE';
      }
      
      // Log de auditoria para falha de verificação de token
      try {
        await auditLogger.logAuth({
          action: 'WEBSOCKET_CONNECTION',
          userId: null,
          ip: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          success: false,
          errorCode,
          requestId,
          metadata: {
            origin: socket.handshake.headers.origin,
            transport: socket.conn.transport.name,
            jwtError: error.name
          }
        });
      } catch (auditError) {
        console.error('Erro no log de auditoria:', auditError);
      }
      
      socket.emit('auth_error', {
        message: errorMessage,
        code: errorCode,
        timestamp: new Date().toISOString(),
        requestId
      });
      
      return next(new Error(errorMessage));
    }
    
    // Erro inesperado
    console.error(`🚨 [${requestId}] ERRO CRÍTICO DE AUTENTICAÇÃO WEBSOCKET:`, {
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`
    });

    captureException(error, { context: 'authenticateSocket' });
    
    socket.emit('auth_error', {
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    });
    
    return next(new Error('Erro interno do servidor'));
  }
};

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    console.log(`🔐 [${requestId}] AuthenticateToken middleware iniciado`);
    console.log(`🔐 [${requestId}] ${req.method} ${req.originalUrl}`);
    console.log(`🔐 [${requestId}] IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`🔐 [${requestId}] User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    console.log(`🔐 [${requestId}] AuthHeader: ${authHeader ? 'Presente' : 'Ausente'}`);
    console.log(`🔐 [${requestId}] Token: ${token ? 'Presente' : 'Ausente'}`);

    if (!token) {
      console.log(`🔐 [${requestId}] ❌ Token não fornecido`);
      
      // Log de auditoria para falha de autenticação
      await auditLogger.logAuth({
        action: 'LOGIN_FAILED',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        success: false,
        errorCode: 'NO_TOKEN',
        requestId,
        metadata: {
          endpoint: `${req.method} ${req.originalUrl}`
        }
      });
      
      return res.status(401).json({ 
        message: 'Token de acesso requerido',
        code: 'NO_TOKEN',
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    // Validar formato do token
    if (!token.includes('.') || token.split('.').length !== 3) {
      console.log(`🔐 [${requestId}] ❌ Token com formato inválido`);
      return res.status(401).json({ 
        message: 'Token com formato inválido',
        code: 'INVALID_TOKEN_FORMAT',
        timestamp: new Date().toISOString(),
        requestId
      });
    }

    // Verificar token
    console.log(`🔐 [${requestId}] Verificando token JWT...`);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`🔐 [${requestId}] Token decodificado:`, { 
      id: decoded.id, 
      exp: decoded.exp,
      iat: decoded.iat,
      timeToExpire: decoded.exp - Math.floor(Date.now() / 1000)
    });
    
    // Verificar se é um dos usuários de teste
    const testUsers = {
      '507f1f77bcf86cd799439011': {
        id: '507f1f77bcf86cd799439011',
        email: 'operador@zara.com',
        name: 'Operador Teste',
        role: 'OPERATOR',
        isActive: true
      },
      '507f1f77bcf86cd799439012': {
        id: '507f1f77bcf86cd799439012',
        email: 'leader@zara.com',
        name: 'Líder Teste',
        role: 'LEADER',
        isActive: true
      },
      '507f1f77bcf86cd799439013': {
        id: '507f1f77bcf86cd799439013',
        email: 'manager@zara.com',
        name: 'Gestor Teste',
        role: 'MANAGER',
        isActive: true
      },
      '507f1f77bcf86cd799439014': {
        id: '507f1f77bcf86cd799439014',
        email: 'admin@zara.com',
        name: 'Admin Teste',
        role: 'ADMIN',
        isActive: true
      }
    };
    
    let user = testUsers[decoded.id];
    
    console.log('🔐 Usuário de teste encontrado:', user ? 'Sim' : 'Não');
    
    if (!user) {
      // Buscar usuário no banco se não for usuário de teste
      // Converter para número se for string numérica
      const userId = typeof decoded.id === 'string' && !isNaN(decoded.id) 
        ? parseInt(decoded.id) 
        : decoded.id;
        
      const userQuery = `
        SELECT id, email, name, avatar, role
        FROM users 
        WHERE id = $1
      `;
      
      console.log('🔐 Executando consulta para userId:', userId);
      
      try {
        const result = await pool.query(userQuery, [userId]);
        console.log('🔐 Resultado da consulta:', result.rows);
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          user = {
            id: row.id,
            email: row.email,
            name: row.name,
            avatar: row.avatar,
            role: row.role
          };
        }
      } catch (dbError) {
        console.error('🔐 ❌ Erro na consulta do banco:', dbError.message);
        // Se falhar a consulta do banco, retornar erro
        return res.status(500).json({ 
          message: 'Erro de conexão com banco de dados',
          code: 'DATABASE_ERROR'
        });
      }
    }

    if (!user) {
      return res.status(401).json({ 
        message: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verificação de usuário ativo removida temporariamente

    // Log de auditoria para acesso autorizado
    const processingTime = Date.now() - startTime;
    console.log(`🔐 [${requestId}] ✅ Autenticação bem-sucedida para:`, {
      email: user.email,
      id: user.id,
      role: user.role,
      processingTime: `${processingTime}ms`
    });
    
    // Log de auditoria para autenticação bem-sucedida
    await auditLogger.logAuth({
      action: 'LOGIN_SUCCESS',
      userId: user.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      success: true,
      requestId,
      metadata: {
        email: user.email,
        role: user.role,
        processingTime: `${processingTime}ms`,
        endpoint: `${req.method} ${req.originalUrl}`
      }
    });
    
    // Adicionar informações extras ao req.user para auditoria
    req.user = {
      ...user,
      requestId,
      authenticatedAt: new Date().toISOString()
    };
    
    next();

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`🔐 [${requestId}] ❌ Erro na autenticação:`, {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n')[0],
      processingTime: `${processingTime}ms`
    });
    
    // Log de auditoria para falha de autenticação
    await auditLogger.logAuth({
      action: 'LOGIN_FAILED',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      success: false,
      errorCode: error.name,
      requestId,
      metadata: {
        endpoint: `${req.method} ${req.originalUrl}`,
        errorMessage: error.message
      }
    });
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Token JWT malformado',
        code: 'INVALID_TOKEN',
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString(),
        requestId,
        expiredAt: new Date(error.expiredAt).toISOString()
      });
    }
    
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({ 
        message: 'Token ainda não é válido',
        code: 'TOKEN_NOT_ACTIVE',
        timestamp: new Date().toISOString(),
        requestId
      });
    }
    
    // Log crítico para erros inesperados
    console.error(`🚨 [${requestId}] ERRO CRÍTICO DE AUTENTICAÇÃO:`, {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    captureException(error, { context: 'authenticateToken' });
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId
    });
  }
};

// Middleware para verificar permissões por role
const requireRole = (roles) => {
  return (req, res, next) => {
    console.log('RequireRole middleware - req.user:', req.user);
    console.log('RequireRole middleware - required roles:', roles);
    
    if (!req.user) {
      console.log('RequireRole middleware - Usuário não autenticado');
      return res.status(401).json({ 
        message: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    console.log('RequireRole middleware - userRole:', userRole, 'allowedRoles:', allowedRoles);

    if (!allowedRoles.includes(userRole)) {
      console.log('RequireRole middleware - Acesso negado');
      return res.status(403).json({ 
        message: 'Acesso negado - permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION',
        required: allowedRoles,
        current: userRole
      });
    }

    console.log('RequireRole middleware - Acesso permitido');
    next();
  };
};

// Middleware específicos por role
const requireOperator = requireRole(['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']);
const requireLeader = requireRole(['LEADER', 'MANAGER', 'ADMIN']);
const requireManager = requireRole(['MANAGER', 'ADMIN']);
const requireAdmin = requireRole(['ADMIN']);

// Função para gerar token JWT (sem expiração)
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET
    // Removido expiresIn para token sem limite de tempo
  );
};

// Middleware para verificar permissões específicas de máquina
const requireMachinePermission = (permissionType = 'canView') => {
  return async (req, res, next) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    try {
      console.log(`🔐 [${requestId}] RequireMachinePermission iniciado:`, {
        permissionType,
        machineId: req.params.id,
        userId: req.user?.id,
        userRole: req.user?.role
      });
      
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        console.log(`❌ [${requestId}] Usuário não autenticado`);
        return res.status(401).json({ 
          message: 'Usuário não autenticado',
          code: 'NOT_AUTHENTICATED'
        });
      }

      // Admins e Managers têm acesso total
      if (['ADMIN', 'MANAGER'].includes(user.role)) {
        console.log(`✅ [${requestId}] Acesso liberado para ${user.role}`);
        return next();
      }

      // Para operadores e líderes, verificar permissões específicas
      if (user.role === 'OPERATOR') {
        let machineId = parseInt(id) || null;
        console.log(`🔍 [${requestId}] Verificando permissões para operador, machineId inicial:`, machineId);
        
        if (!machineId) {
          console.log(`🔍 [${requestId}] Buscando máquina por código:`, id);
          // Se não conseguir converter para número, tentar buscar por código
          const machineResult = await pool.query('SELECT id FROM machines WHERE code = $1', [id]);
          const machine = machineResult.rows[0] || null;
          
          if (!machine) {
            console.log(`❌ [${requestId}] Máquina não encontrada por código:`, id);
            return res.status(404).json({
              success: false,
              message: 'Máquina não encontrada',
              code: 'MACHINE_NOT_FOUND'
            });
          }
          
          machineId = machine.id;
          console.log(`✅ [${requestId}] Máquina encontrada por código, ID:`, machineId);
        }

        console.log(`🔍 [${requestId}] Consultando permissões: userId=${user.id}, machineId=${machineId}`);        
        
        // Converter userId para integer se for string numérica
        let userIdForQuery = user.id;
        if (typeof user.id === 'string' && !isNaN(user.id)) {
          userIdForQuery = parseInt(user.id);
        } else if (typeof user.id === 'string') {
          // Para usuários de teste com IDs string, vamos pular a verificação de permissão
          console.log(`🔍 [${requestId}] Usuário de teste detectado, pulando verificação de permissão`);
          req.user = user;
          return next();
        }
        
        // Verificar se o operador tem permissão para esta máquina
        const permissionResult = await pool.query(
          'SELECT * FROM machine_permissions WHERE user_id = $1 AND machine_id = $2',
          [userIdForQuery, machineId]
        );
        const permission = permissionResult.rows[0] || null;
        
        console.log(`🔍 [${requestId}] Resultado da consulta de permissões:`, permission);

        // Mapear permissionType para o nome correto da coluna
        const columnMap = {
          'canView': 'can_view',
          'canOperate': 'can_operate', 
          'canEdit': 'can_edit'
        };
        
        const columnName = columnMap[permissionType] || 'can_view';
        console.log(`🔍 [${requestId}] Verificando permissão '${permissionType}' -> coluna '${columnName}'`);
        
        if (!permission) {
          console.log(`❌ [${requestId}] Nenhuma permissão encontrada`);
          return res.status(403).json({
            success: false,
            message: 'Você não tem permissão para visualizar esta máquina',
            code: 'MACHINE_ACCESS_DENIED'
          });
        }
        
        if (!permission[columnName]) {
          console.log(`❌ [${requestId}] Permissão '${columnName}' negada:`, permission[columnName]);
          return res.status(403).json({
            success: false,
            message: 'Você não tem permissão para visualizar esta máquina',
            code: 'MACHINE_ACCESS_DENIED'
          });
        }
        
        console.log(`✅ [${requestId}] Permissão '${columnName}' concedida`);
      }

      console.log(`✅ [${requestId}] RequireMachinePermission concluído com sucesso`);
      next();
    } catch (error) {
      console.error(`❌ [${requestId}] Erro no middleware de permissão de máquina:`, {
        error: error.message,
        stack: error.stack,
        permissionType,
        machineId: req.params.id,
        userId: req.user?.id
      });
      captureException(error, { context: 'requireMachinePermission' });
      return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

// Função para verificar se token é válido (sem middleware)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  requireAuth: authenticateToken, // Alias para compatibilidade
  requireRole,
  requireOperator,
  requireLeader,
  requireManager,
  requireAdmin,
  requireMachinePermission,
  generateToken,
  verifyToken
};