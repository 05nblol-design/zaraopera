const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body, param, query } = require('express-validator');
const { setCache, getCache, deleteCache } = require('../config/redis');

const router = express.Router();
const CACHE_TTL = 300; // Cache por 5 minutos

// Middleware para verificar se o usuário pode gerenciar permissões
const canManagePermissions = (req, res, next) => {
  if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Acesso negado. Apenas gestores e administradores podem gerenciar permissões.'
    });
  }
  next();
};

// GET /api/permissions - Listar todas as permissões
router.get('/', 
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
    query('userId').optional().isInt().withMessage('ID do usuário deve ser um número'),
    query('machineId').optional().isInt().withMessage('ID da máquina deve ser um número'),
    query('search').optional().isString().withMessage('Busca deve ser uma string')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { page = 1, limit = 10, userId, machineId, search } = req.query;
      const skip = (page - 1) * limit;

      // Verificar permissões de acesso
      if (req.user.role === 'OPERATOR') {
        // Operadores só podem ver suas próprias permissões
        if (userId && parseInt(userId) !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: 'Operadores só podem visualizar suas próprias permissões'
          });
        }
        // Se não especificou userId, forçar para o próprio usuário
        if (!userId) {
          const userPermissionsResult = await pool.query(
            `SELECT mp.*, m.id as machine_id, m.name as machine_name, m.code as machine_code, 
                    m.status as machine_status, m.location as machine_location
             FROM machine_permissions mp
             JOIN machines m ON mp.machine_id = m.id
             WHERE mp.user_id = $1
             ORDER BY mp.created_at DESC`,
            [req.user.id]
          );
          
          const userPermissions = userPermissionsResult.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            machineId: row.machine_id,
            canView: row.can_view,
            canOperate: row.can_operate,
            canEdit: row.can_edit,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            machine: {
              id: row.machine_id,
              name: row.machine_name,
              code: row.machine_code,
              status: row.machine_status,
              location: row.machine_location
            }
          }));
          
          return res.json({
            success: true,
            data: userPermissions
          });
        }
      } else if (!['MANAGER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado. Apenas gestores e administradores podem gerenciar permissões.'
        });
      }

      // Construir filtros SQL
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (userId) {
        conditions.push(`mp.user_id = $${paramIndex++}`);
        params.push(parseInt(userId));
      }
      if (machineId) {
        conditions.push(`mp.machine_id = $${paramIndex++}`);
        params.push(parseInt(machineId));
      }
      
      // Filtro de busca por nome do usuário ou máquina
      if (search) {
        conditions.push(`(u.name ILIKE $${paramIndex} OR m.name ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Consulta para buscar permissões com paginação
      const permissionsQuery = `
        SELECT mp.*, 
               u.id as user_id, u.name as user_name, u.email as user_email, 
               u.role as user_role, u.badge_number as user_badge_number,
               m.id as machine_id, m.name as machine_name, m.code as machine_code,
               m.status as machine_status, m.location as machine_location
        FROM machine_permissions mp
        JOIN users u ON mp.user_id = u.id
        JOIN machines m ON mp.machine_id = m.id
        ${whereClause}
        ORDER BY mp.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      // Consulta para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM machine_permissions mp
        JOIN users u ON mp.user_id = u.id
        JOIN machines m ON mp.machine_id = m.id
        ${whereClause}
      `;
      
      const [permissionsResult, totalResult] = await Promise.all([
        pool.query(permissionsQuery, [...params, parseInt(limit), parseInt(skip)]),
        pool.query(countQuery, params)
      ]);
      
      const permissions = permissionsResult.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        machineId: row.machine_id,
        canView: row.can_view,
        canOperate: row.can_operate,
        canEdit: row.can_edit,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        user: {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          role: row.user_role,
          badgeNumber: row.user_badge_number
        },
        machine: {
          id: row.machine_id,
          name: row.machine_name,
          code: row.machine_code,
          status: row.machine_status,
          location: row.machine_location
        }
      }));
      
      const total = parseInt(totalResult.rows[0].total);

      res.json({
        success: true,
        data: permissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/permissions/user/:userId - Obter permissões de um usuário específico
router.get('/user/:userId',
  authenticateToken,
  canManagePermissions,
  [
    param('userId').isInt().withMessage('ID do usuário deve ser um número')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const cacheKey = `user_permissions_${userId}`;
      
      // Verificar cache
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: cached
        });
      }

      // Verificar se o usuário existe
      const userResult = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [parseInt(userId)]
      );
      const user = userResult.rows[0];

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      const permissionsResult = await pool.query(
        `SELECT mp.*, m.id as machine_id, m.name as machine_name, m.code as machine_code,
                m.status as machine_status, m.location as machine_location
         FROM machine_permissions mp
         JOIN machines m ON mp.machine_id = m.id
         WHERE mp.user_id = $1
         ORDER BY m.name ASC`,
        [parseInt(userId)]
      );
      
      const permissions = permissionsResult.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        machineId: row.machine_id,
        canView: row.can_view,
        canOperate: row.can_operate,
        canEdit: row.can_edit,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        machine: {
          id: row.machine_id,
          name: row.machine_name,
          code: row.machine_code,
          status: row.machine_status,
          location: row.machine_location
        }
      }));

      const result = {
        user,
        permissions
      };

      // Salvar no cache
      await setCache(cacheKey, result, CACHE_TTL);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Erro ao buscar permissões do usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/permissions - Criar nova permissão
router.post('/',
  authenticateToken,
  canManagePermissions,
  [
    body('userId').isInt().withMessage('ID do usuário é obrigatório'),
    body('machineId').isInt().withMessage('ID da máquina é obrigatório'),
    body('canView').optional().isBoolean().withMessage('canView deve ser um boolean'),
    body('canOperate').optional().isBoolean().withMessage('canOperate deve ser um boolean'),
    body('canEdit').optional().isBoolean().withMessage('canEdit deve ser um boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId, machineId, canView = true, canOperate = false, canEdit = false } = req.body;

      // Verificar se o usuário existe
      const userResult = await pool.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar se a máquina existe
      const machineResult = await pool.query(
        'SELECT id FROM machines WHERE id = $1',
        [machineId]
      );

      if (machineResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Máquina não encontrada'
        });
      }

      // Verificar se a permissão já existe
      const existingPermissionResult = await pool.query(
        'SELECT id FROM machine_permissions WHERE user_id = $1 AND machine_id = $2',
        [userId, machineId]
      );

      if (existingPermissionResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Permissão já existe para este usuário e máquina'
        });
      }

      // Criar a permissão
      const permissionResult = await pool.query(
        `INSERT INTO machine_permissions (user_id, machine_id, can_view, can_operate, can_edit, granted_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, user_id, machine_id, can_view, can_operate, can_edit, granted_by, created_at, updated_at`,
        [userId, machineId, canView, canOperate, canEdit, req.user.id]
      );

      // Buscar dados completos da permissão criada
      const fullPermissionResult = await pool.query(
        `SELECT 
           mp.id, mp.user_id, mp.machine_id, mp.can_view, mp.can_operate, mp.can_edit, mp.granted_by, mp.created_at, mp.updated_at,
           u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role,
           m.id as machine_id, m.name as machine_name, m.code as machine_code, m.status as machine_status
         FROM machine_permissions mp
         JOIN users u ON mp.user_id = u.id
         JOIN machines m ON mp.machine_id = m.id
         WHERE mp.id = $1`,
        [permissionResult.rows[0].id]
      );

      const permission = {
        id: fullPermissionResult.rows[0].id,
        userId: fullPermissionResult.rows[0].user_id,
        machineId: fullPermissionResult.rows[0].machine_id,
        canView: fullPermissionResult.rows[0].can_view,
        canOperate: fullPermissionResult.rows[0].can_operate,
        canEdit: fullPermissionResult.rows[0].can_edit,
        grantedBy: fullPermissionResult.rows[0].granted_by,
        createdAt: fullPermissionResult.rows[0].created_at,
        updatedAt: fullPermissionResult.rows[0].updated_at,
        user: {
          id: fullPermissionResult.rows[0].user_id,
          name: fullPermissionResult.rows[0].user_name,
          email: fullPermissionResult.rows[0].user_email,
          role: fullPermissionResult.rows[0].user_role
        },
        machine: {
          id: fullPermissionResult.rows[0].machine_id,
          name: fullPermissionResult.rows[0].machine_name,
          code: fullPermissionResult.rows[0].machine_code,
          status: fullPermissionResult.rows[0].machine_status
        }
      };

      // Limpar cache relacionado
      await deleteCache(`user_permissions_${userId}`);
      await deleteCache(`machine_permissions_${machineId}`);

      res.status(201).json({
        success: true,
        data: permission,
        message: 'Permissão criada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao criar permissão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// PUT /api/permissions/:id - Atualizar permissão
router.put('/:id',
  authenticateToken,
  canManagePermissions,
  [
    param('id').isInt().withMessage('ID da permissão deve ser um número'),
    body('canView').optional().isBoolean().withMessage('canView deve ser um boolean'),
    body('canOperate').optional().isBoolean().withMessage('canOperate deve ser um boolean'),
    body('canEdit').optional().isBoolean().withMessage('canEdit deve ser um boolean')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { canView, canOperate, canEdit } = req.body;

      // Verificar se a permissão existe
      const existingPermissionResult = await pool.query(
        `SELECT mp.id, mp.user_id, mp.machine_id, mp.can_view, mp.can_operate, mp.can_edit,
                u.name as user_name, m.name as machine_name
         FROM machine_permissions mp
         JOIN users u ON mp.user_id = u.id
         JOIN machines m ON mp.machine_id = m.id
         WHERE mp.id = $1`,
        [parseInt(id)]
      );

      if (existingPermissionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Permissão não encontrada'
        });
      }

      const existingPermission = existingPermissionResult.rows[0];

      // Preparar campos para atualização
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (canView !== undefined) {
        updateFields.push(`can_view = $${paramIndex}`);
        updateValues.push(canView);
        paramIndex++;
      }
      if (canOperate !== undefined) {
        updateFields.push(`can_operate = $${paramIndex}`);
        updateValues.push(canOperate);
        paramIndex++;
      }
      if (canEdit !== undefined) {
        updateFields.push(`can_edit = $${paramIndex}`);
        updateValues.push(canEdit);
        paramIndex++;
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(parseInt(id));

      // Atualizar a permissão
      await pool.query(
        `UPDATE machine_permissions SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );

      // Buscar dados completos da permissão atualizada
      const updatedPermissionResult = await pool.query(
        `SELECT 
           mp.id, mp.user_id, mp.machine_id, mp.can_view, mp.can_operate, mp.can_edit, mp.granted_by, mp.created_at, mp.updated_at,
           u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role,
           m.id as machine_id, m.name as machine_name, m.code as machine_code, m.status as machine_status
         FROM machine_permissions mp
         JOIN users u ON mp.user_id = u.id
         JOIN machines m ON mp.machine_id = m.id
         WHERE mp.id = $1`,
        [parseInt(id)]
      );

      const updatedPermission = {
        id: updatedPermissionResult.rows[0].id,
        userId: updatedPermissionResult.rows[0].user_id,
        machineId: updatedPermissionResult.rows[0].machine_id,
        canView: updatedPermissionResult.rows[0].can_view,
        canOperate: updatedPermissionResult.rows[0].can_operate,
        canEdit: updatedPermissionResult.rows[0].can_edit,
        grantedBy: updatedPermissionResult.rows[0].granted_by,
        createdAt: updatedPermissionResult.rows[0].created_at,
        updatedAt: updatedPermissionResult.rows[0].updated_at,
        user: {
          id: updatedPermissionResult.rows[0].user_id,
          name: updatedPermissionResult.rows[0].user_name,
          email: updatedPermissionResult.rows[0].user_email,
          role: updatedPermissionResult.rows[0].user_role
        },
        machine: {
          id: updatedPermissionResult.rows[0].machine_id,
          name: updatedPermissionResult.rows[0].machine_name,
          code: updatedPermissionResult.rows[0].machine_code,
          status: updatedPermissionResult.rows[0].machine_status
        }
      };

      // Limpar cache relacionado
      await deleteCache(`user_permissions_${existingPermission.user_id}`);
      await deleteCache(`machine_permissions_${existingPermission.machine_id}`);

      res.json({
        success: true,
        data: updatedPermission,
        message: 'Permissão atualizada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// DELETE /api/permissions/:id - Remover permissão
router.delete('/:id',
  authenticateToken,
  canManagePermissions,
  [
    param('id').isInt().withMessage('ID da permissão deve ser um número')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar se a permissão existe
      const existingPermissionResult = await pool.query(
        'SELECT id, user_id, machine_id FROM machine_permissions WHERE id = $1',
        [parseInt(id)]
      );

      if (existingPermissionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Permissão não encontrada'
        });
      }

      const existingPermission = existingPermissionResult.rows[0];

      // Remover a permissão
      await pool.query(
        'DELETE FROM machine_permissions WHERE id = $1',
        [parseInt(id)]
      );

      // Limpar cache relacionado
      await deleteCache(`user_permissions_${existingPermission.user_id}`);
      await deleteCache(`machine_permissions_${existingPermission.machineId}`);

      res.json({
        success: true,
        message: 'Permissão removida com sucesso'
      });
    } catch (error) {
      console.error('Erro ao remover permissão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// POST /api/permissions/bulk - Criar múltiplas permissões
router.post('/bulk',
  authenticateToken,
  canManagePermissions,
  [
    body('permissions').isArray().withMessage('Permissões devem ser um array'),
    body('permissions.*.userId').isInt().withMessage('ID do usuário é obrigatório'),
    body('permissions.*.machineId').isInt().withMessage('ID da máquina é obrigatório'),
    body('permissions.*.canView').optional().isBoolean(),
    body('permissions.*.canOperate').optional().isBoolean(),
    body('permissions.*.canEdit').optional().isBoolean()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { permissions } = req.body;

      // Validar se todos os usuários e máquinas existem
      const userIds = [...new Set(permissions.map(p => p.userId))];
      const machineIds = [...new Set(permissions.map(p => p.machineId))];

      const [usersResult, machinesResult] = await Promise.all([
        pool.query(
          `SELECT id FROM users WHERE id = ANY($1)`,
          [userIds]
        ),
        pool.query(
          `SELECT id FROM machines WHERE id = ANY($1)`,
          [machineIds]
        )
      ]);

      const existingUserIds = usersResult.rows.map(u => u.id);
      const existingMachineIds = machinesResult.rows.map(m => m.id);

      // Verificar se todos os IDs existem
      const invalidUserIds = userIds.filter(id => !existingUserIds.includes(id));
      const invalidMachineIds = machineIds.filter(id => !existingMachineIds.includes(id));

      if (invalidUserIds.length > 0 || invalidMachineIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs inválidos encontrados',
          details: {
            invalidUserIds,
            invalidMachineIds
          }
        });
      }

      // Criar as permissões usando transação
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const createdPermissions = [];
        
        for (const permission of permissions) {
          const { userId, machineId, canView = true, canOperate = false, canEdit = false } = permission;
          
          // Verificar se a permissão já existe
          const existingResult = await client.query(
            'SELECT id FROM machine_permissions WHERE user_id = $1 AND machine_id = $2',
            [userId, machineId]
          );
          
          let permissionResult;
          
          if (existingResult.rows.length > 0) {
            // Atualizar permissão existente
            permissionResult = await client.query(
              `UPDATE machine_permissions 
               SET can_view = $1, can_operate = $2, can_edit = $3, granted_by = $4, updated_at = NOW()
               WHERE user_id = $5 AND machine_id = $6
               RETURNING id, user_id, machine_id, can_view, can_operate, can_edit, granted_by, created_at, updated_at`,
              [canView, canOperate, canEdit, req.user.id, userId, machineId]
            );
          } else {
            // Criar nova permissão
            permissionResult = await client.query(
              `INSERT INTO machine_permissions (user_id, machine_id, can_view, can_operate, can_edit, granted_by, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
               RETURNING id, user_id, machine_id, can_view, can_operate, can_edit, granted_by, created_at, updated_at`,
              [userId, machineId, canView, canOperate, canEdit, req.user.id]
            );
          }
          
          createdPermissions.push({
            id: permissionResult.rows[0].id,
            userId: permissionResult.rows[0].user_id,
            machineId: permissionResult.rows[0].machine_id,
            canView: permissionResult.rows[0].can_view,
            canOperate: permissionResult.rows[0].can_operate,
            canEdit: permissionResult.rows[0].can_edit,
            grantedBy: permissionResult.rows[0].granted_by,
            createdAt: permissionResult.rows[0].created_at,
            updatedAt: permissionResult.rows[0].updated_at
          });
        }
        
        await client.query('COMMIT');
         
         // Limpar cache relacionado
         for (const userId of userIds) {
        await deleteCache(`user_permissions_${userId}`);
      }
      for (const machineId of machineIds) {
        await deleteCache(`machine_permissions_${machineId}`);
      }

         res.status(201).json({
           success: true,
           data: createdPermissions,
           message: `${createdPermissions.length} permissões processadas com sucesso`
         });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao criar permissões em lote:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/permissions/operators - Listar operadores para seleção
router.get('/operators',
  authenticateToken,
  canManagePermissions,
  async (req, res) => {
    try {
      const operatorsResult = await pool.query(
        `SELECT 
           u.id, u.name, u.email, u.badge_number,
           COUNT(mp.id) as machine_permissions_count
         FROM users u
         LEFT JOIN machine_permissions mp ON u.id = mp.user_id
         WHERE u.role = 'OPERATOR' AND u.is_active = true
         GROUP BY u.id, u.name, u.email, u.badge_number
         ORDER BY u.name ASC`
      );

      const operators = operatorsResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        email: row.email,
        badgeNumber: row.badge_number,
        _count: {
          machinePermissions: parseInt(row.machine_permissions_count)
        }
      }));

      res.json({
        success: true,
        data: operators
      });
    } catch (error) {
      console.error('Erro ao buscar operadores:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

// GET /api/permissions/machines - Listar máquinas para seleção
router.get('/machines',
  authenticateToken,
  canManagePermissions,
  async (req, res) => {
    try {
      const machinesResult = await pool.query(
        `SELECT 
           m.id, m.name, m.code, m.location, m.status,
           COUNT(mp.id) as permissions_count
         FROM machines m
         LEFT JOIN machine_permissions mp ON m.id = mp.machine_id
         WHERE m.is_active = true
         GROUP BY m.id, m.name, m.code, m.location, m.status
         ORDER BY m.name ASC`
      );

      const machines = machinesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        location: row.location,
        status: row.status,
        _count: {
          permissions: parseInt(row.permissions_count)
        }
      }));

      res.json({
        success: true,
        data: machines
      });
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
);

module.exports = router;