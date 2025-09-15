const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { publishEvent } = require('../config/redis');
const notificationService = require('../services/notificationService');

// Armazenar conexões ativas
const activeConnections = new Map();
const userSockets = new Map(); // userId -> Set of socket IDs

// Middleware de autenticação para Socket.IO
const authenticateSocket = async (socket, next) => {
  try {
    console.log('🔐 [WebSocket] Iniciando autenticação do socket:', socket.id);
    console.log('🔐 [WebSocket] Headers disponíveis:', Object.keys(socket.handshake.headers));
    console.log('🔐 [WebSocket] Auth disponível:', Object.keys(socket.handshake.auth || {}));
    
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    console.log('🔐 [WebSocket] Token extraído:', token ? 'Presente' : 'Ausente');
    
    if (!token) {
      console.log('❌ [WebSocket] Token não fornecido');
      return next(new Error('Token não fornecido'));
    }

    console.log('🔐 [WebSocket] Verificando token JWT...');
    console.log('🔐 [WebSocket] JWT_SECRET disponível:', process.env.JWT_SECRET ? 'Sim' : 'Não');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔐 [WebSocket] Token decodificado com sucesso:', { id: decoded.id, exp: decoded.exp });
    
    // Buscar usuário no banco
    const userResult = await pool.query(
      'SELECT id, name, email, role, "is_active" FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = userResult.rows[0];

    if (!user || !user.is_active) {
      return next(new Error('Usuário não encontrado ou inativo'));
    }

    // Converter is_active para isActive para compatibilidade
    user.isActive = user.is_active;

    socket.user = user;
    console.log('✅ [WebSocket] Usuário autenticado:', { id: user.id, name: user.name, role: user.role });
    next();
  } catch (error) {
    console.error('❌ [WebSocket] Erro de autenticação:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n')[0]
    });
    
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Token JWT malformado'));
    } else if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expirado'));
    } else if (error.name === 'NotBeforeError') {
      return next(new Error('Token ainda não é válido'));
    } else {
      return next(new Error(`Erro de autenticação: ${error.message}`));
    }
  }
};

// Gerenciar salas baseadas em roles
const joinRoleRooms = (socket) => {
  const { role } = socket.user;
  
  // Todos os usuários entram na sala geral
  socket.join('general');
  
  // Salas específicas por role
  socket.join(`role:${role}`);
  
  // Operadores entram na sala de operadores
  if (role === 'OPERATOR') {
    socket.join('operators');
  }
  
  // Líderes e superiores entram na sala de liderança
  if (['LEADER', 'MANAGER', 'ADMIN'].includes(role)) {
    socket.join('leadership');
  }
  
  // Gestores e admins entram na sala de gestão
  if (['MANAGER', 'ADMIN'].includes(role)) {
    socket.join('management');
  }
  
  // Sala pessoal do usuário
  socket.join(`user:${socket.user.id}`);
};

// Atualizar status de usuário online
const updateUserStatus = async (userId, isOnline) => {
  try {
    // Não atualizar usuários de teste
    const testUserIds = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'];
    if (testUserIds.includes(userId)) {
      return;
    }
    
    // Validar se o userId é válido
    const userIdInt = parseInt(userId);
    if (!userId || isNaN(userIdInt) || userIdInt <= 0) {
      console.warn('ID de usuário inválido:', userId);
      return;
    }
    
    // Note: lastSeen field doesn't exist in schema - removed Prisma reference
  } catch (error) {
    console.error('Erro ao atualizar status do usuário:', error);
  }
};

// Handler principal do Socket.IO
const socketHandler = (io) => {
  // Middleware de autenticação
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { user } = socket;
    console.log(`Usuário conectado: ${user.name} (${user.email}) - Socket: ${socket.id}`);

    // Armazenar conexão
    activeConnections.set(socket.id, {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      connectedAt: new Date()
    });

    // Mapear usuário para sockets
    if (!userSockets.has(user.id)) {
      userSockets.set(user.id, new Set());
    }
    userSockets.get(user.id).add(socket.id);

    // Entrar nas salas apropriadas
    joinRoleRooms(socket);

    // Atualizar status online
    updateUserStatus(user.id, true);

    // Notificar outros usuários sobre conexão (apenas para liderança)
    socket.to('leadership').emit('user:connected', {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      timestamp: new Date()
    });

    // Enviar dados iniciais
    socket.emit('connection:established', {
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      },
      timestamp: new Date()
    });

    // === EVENTOS DE MÁQUINAS ===
    
    // Atualização de status de máquina
    socket.on('machine:status:update', async (data) => {
      try {
        const { machineId, status } = data;
        
        // Verificar permissões
        if (!['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'].includes(user.role)) {
          socket.emit('error', { message: 'Sem permissão para atualizar status de máquina' });
          return;
        }

        // Atualizar no banco
        await pool.query(
          'UPDATE "Machine" SET status = $1 WHERE id = $2',
          [status, machineId]
        );
        
        // Buscar máquina atualizada com operações
        const machineResult = await pool.query(
          `SELECT m.*, 
                  json_agg(
                    json_build_object(
                      'id', mo.id,
                      'status', mo.status,
                      'user', json_build_object('name', u.name)
                    )
                  ) FILTER (WHERE mo.id IS NOT NULL) as operations
           FROM "Machine" m
           LEFT JOIN "MachineOperation" mo ON m.id = mo."machineId" AND mo.status = 'RUNNING'
           LEFT JOIN users u ON mo."userId" = u.id
           WHERE m.id = $1
           GROUP BY m.id`,
          [machineId]
        );
        const machine = machineResult.rows[0];
        machine.operations = machine.operations || [];

        // Notificar todos os usuários
        io.emit('machine:status:changed', {
          machineId,
          machineName: machine.name,
          status,
          updatedBy: user.name,
          timestamp: new Date(),
          currentOperation: machine.operations[0] || null
        });

        // Publicar no Redis para outros serviços
        await publishEvent('machine:status:changed', {
          machineId,
          status,
          updatedBy: user.id,
          timestamp: new Date()
        });

        // Broadcast atualização de produção em tempo real
        if (status === 'FUNCIONANDO' || status === 'PARADA' || status === 'MANUTENCAO') {
          io.emit('production:update', {
            machineId,
            status,
            timestamp: new Date()
          });
        }

      } catch (error) {
        socket.emit('error', { message: 'Erro ao atualizar status da máquina' });
      }
    });

    // === EVENTOS DE OPERAÇÕES ===
    
    // Início de operação
    socket.on('operation:start', async (data) => {
      try {
        const { machineId } = data;
        
        if (user.role !== 'OPERATOR') {
          socket.emit('error', { message: 'Apenas operadores podem iniciar operações' });
          return;
        }

        // Buscar máquina
        const machineResult = await pool.query(
          'SELECT * FROM "Machine" WHERE id = $1',
          [machineId]
        );
        const machine = machineResult.rows[0];

        if (!machine) {
          socket.emit('error', { message: 'Máquina não encontrada' });
          return;
        }

        // Atualizar status da máquina para FUNCIONANDO
        await pool.query(
          'UPDATE "Machine" SET status = $1 WHERE id = $2',
          ['FUNCIONANDO', machineId]
        );

        // Notificar todos sobre mudança de status
        io.emit('machine:status:changed', {
          machineId,
          machineName: machine.name,
          status: 'FUNCIONANDO',
          updatedBy: user.name,
          timestamp: new Date()
        });

        // Emitir evento de atualização de produção
        io.emit('production:update', {
          machineId,
          status: 'FUNCIONANDO',
          timestamp: new Date()
        });

        // Notificar liderança sobre operação iniciada
        socket.to('leadership').emit('operation:started', {
          machineId,
          machineName: machine.name,
          operatorId: user.id,
          operatorName: user.name,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Erro ao processar início de operação' });
      }
    });

    // === EVENTOS DE TESTES DE QUALIDADE ===
    
    // Teste de qualidade criado
    socket.on('quality-test:created', async (data) => {
      try {
        const { testId, machineId, approved } = data;
        
        // Buscar dados completos
        const testResult = await pool.query(
          `SELECT qt.*, m.name as machine_name, u.name as user_name
           FROM "QualityTest" qt
           LEFT JOIN "Machine" m ON qt."machineId" = m.id
           LEFT JOIN users u ON qt."userId" = u.id
           WHERE qt.id = $1`,
          [testId]
        );
        const test = testResult.rows[0];
        if (test) {
          test.machine = { name: test.machine_name };
          test.user = { name: test.user_name };
          delete test.machine_name;
          delete test.user_name;
        }

        if (!test) return;

        // Buscar líderes e gestores para notificar
        const leadersResult = await pool.query(
          `SELECT * FROM users 
           WHERE role IN ('LEADER', 'MANAGER', 'ADMIN') AND is_active = true`
        );
        const leaders = leadersResult.rows;

        // Criar notificação para cada líder/gestor
        for (const leader of leaders) {
          await notificationService.saveNotification({
            type: 'QUALITY_TEST',
            title: approved ? 'Teste de Qualidade Aprovado' : 'Teste de Qualidade Reprovado',
            message: `${test.user.name} ${approved ? 'aprovou' : 'reprovou'} teste de qualidade na máquina ${test.machine.name}`,
            userId: leader.id,
            machineId: machineId,
            priority: approved ? 'LOW' : 'HIGH',
            channels: ['SYSTEM', 'PUSH'],
            metadata: {
              testId: testId,
              operatorId: test.userId,
              operatorName: test.user.name,
              machineName: test.machine.name,
              approved: approved,
              action: 'quality_test_result'
            }
          });
        }

        console.log(`📢 Notificação de teste de qualidade ${approved ? 'aprovado' : 'reprovado'} criada para ${leaders.length} líderes/gestores`);

      } catch (error) {
        console.error('Erro ao processar teste de qualidade:', error);
      }
    });

    // === EVENTOS DE TEFLON ===
    
    // Alerta de teflon expirando
    socket.on('teflon:expiring:check', async () => {
      try {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const expiringTeflonResult = await pool.query(
          `SELECT tc.*, m.name as machine_name
           FROM "TeflonChange" tc
           LEFT JOIN "Machine" m ON tc."machineId" = m.id
           WHERE tc."expiryDate" >= $1 AND tc."expiryDate" <= $2 AND tc."alertSent" = false`,
          [now, sevenDaysFromNow]
        );
        const expiringTeflon = expiringTeflonResult.rows.map(row => ({
          ...row,
          machine: { name: row.machine_name }
        }));
        expiringTeflon.forEach(item => delete item.machine_name);

        if (expiringTeflon.length > 0) {
          // Buscar operadores, líderes e gestores para notificar
          const usersResult = await pool.query(
            `SELECT * FROM users 
             WHERE role IN ('OPERATOR', 'LEADER', 'MANAGER', 'ADMIN') AND is_active = true`
          );
          const users = usersResult.rows;

          // Criar notificação para cada usuário sobre teflon expirando
          for (const teflonItem of expiringTeflon) {
            const daysLeft = Math.ceil((teflonItem.expiryDate - now) / (1000 * 60 * 60 * 24));
            
            for (const targetUser of users) {
              await notificationService.saveNotification({
                type: 'TEFLON_CHANGE',
                title: 'Teflon Expirando',
                message: `Teflon da máquina ${teflonItem.machine.name} expira em ${daysLeft} dias`,
                userId: targetUser.id,
                machineId: teflonItem.machineId,
                priority: daysLeft <= 2 ? 'HIGH' : 'MEDIUM',
                channels: ['SYSTEM', 'PUSH'],
                metadata: {
                  teflonChangeId: teflonItem.id,
                  machineName: teflonItem.machine.name,
                  expiryDate: teflonItem.expiryDate,
                  daysLeft: daysLeft,
                  action: 'teflon_expiring'
                }
              });
            }
          }

          console.log(`📢 Notificações de teflon expirando criadas para ${users.length} usuários sobre ${expiringTeflon.length} máquinas`);
        }

      } catch (error) {
        console.error('Erro ao verificar teflon expirando:', error);
      }
    });

    // === EVENTOS DE NOTIFICAÇÕES ===
    
    // Marcar notificação como lida
    socket.on('notification:read', async (data) => {
      try {
        const { notificationId } = data;
        
        await pool.query(
          'UPDATE "Notification" SET read = $1, "readAt" = $2 WHERE id = $3 AND "userId" = $4',
          [true, new Date(), notificationId, user.id]
        );

        socket.emit('notification:read:confirmed', { notificationId });

      } catch (error) {
        socket.emit('error', { message: 'Erro ao marcar notificação como lida' });
      }
    });

    // === EVENTOS DE CHAT/COMUNICAÇÃO ===
    
    // Mensagem para sala específica
    socket.on('message:send', async (data) => {
      try {
        const { room, message, type = 'text' } = data;
        
        // Validar permissões para a sala
        const allowedRooms = {
          'general': ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
          'operators': ['OPERATOR'],
          'leadership': ['LEADER', 'MANAGER', 'ADMIN'],
          'management': ['MANAGER', 'ADMIN']
        };

        if (!allowedRooms[room] || !allowedRooms[room].includes(user.role)) {
          socket.emit('error', { message: 'Sem permissão para enviar mensagem nesta sala' });
          return;
        }

        const messageData = {
          id: Date.now().toString(),
          room,
          message,
          type,
          sender: {
            id: user.id,
            name: user.name,
            role: user.role
          },
          timestamp: new Date()
        };

        // Enviar para a sala
        socket.to(room).emit('message:received', messageData);
        
        // Confirmar envio
        socket.emit('message:sent', messageData);

      } catch (error) {
        socket.emit('error', { message: 'Erro ao enviar mensagem' });
      }
    });

    // === EVENTOS DE SISTEMA ===
    
    // Ping/Pong para manter conexão
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Solicitar estatísticas em tempo real
    socket.on('stats:request', async () => {
      try {
        if (!['LEADER', 'MANAGER', 'ADMIN'].includes(user.role)) {
          socket.emit('error', { message: 'Sem permissão para acessar estatísticas' });
          return;
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [activeMachinesResult, runningOperationsResult, todayTestsResult, pendingNotificationsResult] = await Promise.all([
          pool.query('SELECT COUNT(*) FROM machines WHERE is_active = true'),
          pool.query('SELECT COUNT(*) FROM machine_operations WHERE status = $1', ['RUNNING']),
          pool.query('SELECT COUNT(*) FROM quality_tests WHERE "createdAt" >= $1', [today]),
          pool.query('SELECT COUNT(*) FROM notifications WHERE read = false')
        ]);

        const activeMachines = parseInt(activeMachinesResult.rows[0].count);
        const runningOperations = parseInt(runningOperationsResult.rows[0].count);
        const todayTests = parseInt(todayTestsResult.rows[0].count);
        const pendingNotifications = parseInt(pendingNotificationsResult.rows[0].count);

        socket.emit('stats:update', {
          activeMachines,
          runningOperations,
          todayTests,
          pendingNotifications,
          onlineUsers: activeConnections.size,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: 'Erro ao buscar estatísticas' });
      }
    });

    // === EVENTOS DE DESCONEXÃO ===
    
    socket.on('disconnect', (reason) => {
      console.log(`Usuário desconectado: ${user.name} - Motivo: ${reason}`);
      
      // Remover da lista de conexões ativas
      activeConnections.delete(socket.id);
      
      // Remover do mapeamento de usuário
      if (userSockets.has(user.id)) {
        userSockets.get(user.id).delete(socket.id);
        if (userSockets.get(user.id).size === 0) {
          userSockets.delete(user.id);
          // Atualizar status offline apenas se não há outras conexões
          updateUserStatus(user.id, false);
        }
      }

      // Notificar liderança sobre desconexão
      socket.to('leadership').emit('user:disconnected', {
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        reason,
        timestamp: new Date()
      });
    });

    // === EVENTOS DE TESTE ===
    
    // Handler para testar emissão para salas específicas
    socket.on('test-emit-to-room', (data) => {
      const { room, event, data: eventData } = data;
      console.log(`🧪 Teste: Emitindo evento '${event}' para sala '${room}'`);
      io.to(room).emit(event, eventData);
    });
    
    // Handler para testar broadcast
    socket.on('test-emit-broadcast', (data) => {
      const { event, data: eventData } = data;
      console.log(`🧪 Teste: Emitindo broadcast '${event}'`);
      io.emit(event, eventData);
    });
    
    // Tratamento de erros
    socket.on('error', (error) => {
      console.error(`Erro no socket ${socket.id}:`, error);
    });
  });

  // Função para enviar notificação para usuário específico
  io.sendToUser = (userId, event, data) => {
    if (userSockets.has(userId)) {
      userSockets.get(userId).forEach(socketId => {
        io.to(socketId).emit(event, data);
      });
    }
  };

  // Função para enviar para role específico
  io.sendToRole = (role, event, data) => {
    io.to(`role:${role}`).emit(event, data);
  };

  // Função para obter estatísticas de conexões
  io.getConnectionStats = () => {
    const stats = {
      totalConnections: activeConnections.size,
      uniqueUsers: userSockets.size,
      byRole: {}
    };

    activeConnections.forEach(conn => {
      if (!stats.byRole[conn.userRole]) {
        stats.byRole[conn.userRole] = 0;
      }
      stats.byRole[conn.userRole]++;
    });

    return stats;
  };

  return io;
};

module.exports = socketHandler;