const express = require('express');
const pool = require('../config/database');
const auth = require('../middleware/auth');
const { body, validationResult, param } = require('express-validator');

const router = express.Router();

/**
 * GET /api/quality-test-config
 * Listar todas as configurações de teste de qualidade
 */
router.get('/', auth.requireAuth, async (req, res) => {
  try {
    const { machineId, isActive } = req.query;
    
    const where = {};
    if (machineId) where.machineId = parseInt(machineId);
    if (isActive !== undefined) where.isActive = isActive === 'true';

    // Construir query com filtros
    let queryParams = [];
    let whereConditions = [];
    let paramIndex = 1;
    
    if (machineId) {
      whereConditions.push(`qtc.machine_id = $${paramIndex}`);
      queryParams.push(parseInt(machineId));
      paramIndex++;
    }
    
    if (isActive !== undefined) {
      whereConditions.push(`qtc.is_active = $${paramIndex}`);
      queryParams.push(isActive === 'true');
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const configsQuery = `
      SELECT qtc.*, m.id as machine_id, m.name as machine_name, m.code as machine_code
      FROM quality_test_configs qtc
      LEFT JOIN machines m ON qtc.machine_id = m.id
      ${whereClause}
      ORDER BY qtc.id DESC
    `;
    
    const configsResult = await pool.query(configsQuery, queryParams);
    const configs = configsResult.rows.map(row => ({
      id: row.id,
      machineId: row.machine_id,
      testType: row.test_type,
      minValue: row.min_value,
      maxValue: row.max_value,
      unit: row.unit,
      frequency: row.frequency,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      machine: {
        id: row.machine_id,
        name: row.machine_name,
        code: row.machine_code
      }
    }));

    // Buscar dados adicionais para cada configuração
    for (let config of configs) {
      // Buscar usuário que criou
      if (config.createdBy) {
        const userQuery = 'SELECT id, name, email FROM users WHERE id = $1';
        const userResult = await pool.query(userQuery, [config.createdBy]);
        config.createdByUser = userResult.rows[0] || null;
      }
      
      // Contar testes dos últimos 30 dias
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const countQuery = 'SELECT COUNT(*) as count FROM quality_tests WHERE config_id = $1 AND test_date >= $2';
      const countResult = await pool.query(countQuery, [config.id, thirtyDaysAgo]);
      config._count = {
        qualityTests: parseInt(countResult.rows[0].count)
      };
    }

    // Calcular estatísticas para cada configuração
    const configsWithStats = await Promise.all(
      configs.map(async (config) => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const testsCountQuery = 'SELECT COUNT(*) as count FROM quality_tests WHERE config_id = $1 AND test_date >= $2';
        const testsCountResult = await pool.query(testsCountQuery, [config.id, thirtyDaysAgo]);
        const testsLast30Days = parseInt(testsCountResult.rows[0].count);

        const passedTestsQuery = 'SELECT COUNT(*) as count FROM quality_tests WHERE config_id = $1 AND approved = true AND test_date >= $2';
        const passedTestsResult = await pool.query(passedTestsQuery, [config.id, thirtyDaysAgo]);
        const passedTestsLast30Days = parseInt(passedTestsResult.rows[0].count);

        const passRate = testsLast30Days > 0 
          ? Math.round((passedTestsLast30Days / testsLast30Days) * 100 * 100) / 100
          : 0;

        return {
          ...config,
          stats: {
            testsLast30Days,
            passedTestsLast30Days,
            passRate,
            isPassRateAcceptable: passRate >= (config.minPassRate || 80)
          }
        };
      })
    );

    res.json({
      success: true,
      data: configsWithStats
    });

  } catch (error) {
    console.error('Erro ao buscar configurações de teste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/quality-test-config/:id
 * Buscar configuração específica por ID
 */
router.get('/:id', auth.requireAuth, param('id').isInt(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const configId = parseInt(req.params.id);
    
    const configResult = await pool.query(`
      SELECT 
        qtc.*,
        m.id as machine_id, m.name as machine_name, m.code as machine_code, m."productionSpeed" as machine_production_speed,
        u.id as created_by_id, u.name as created_by_name, u.email as created_by_email
      FROM "quality_test_configs" qtc
      LEFT JOIN "machines" m ON qtc."machineId" = m.id
      LEFT JOIN "users" u ON qtc."createdBy" = u.id
      WHERE qtc.id = $1
    `, [configId]);

    if (configResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada'
      });
    }

    const row = configResult.rows[0];
    const config = {
      id: row.id,
      machineId: row.machineId,
      testName: row.testName,
      testDescription: row.testDescription,
      testFrequency: row.testFrequency,
      productsPerTest: row.productsPerTest,
      isRequired: row.isRequired,
      isActive: row.isActive,
      minPassRate: row.minPassRate,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      machine: row.machine_id ? {
        id: row.machine_id,
        name: row.machine_name,
        code: row.machine_code,
        productionSpeed: row.machine_production_speed
      } : null,
      createdByUser: row.created_by_id ? {
        id: row.created_by_id,
        name: row.created_by_name,
        email: row.created_by_email
      } : null
    };

    // Buscar testes de qualidade dos últimos 7 dias
    const testsResult = await pool.query(`
      SELECT * FROM "quality_tests" 
      WHERE "configId" = $1 AND "testDate" >= $2
      ORDER BY "testDate" DESC
      LIMIT 50
    `, [configId, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]);

    config.qualityTests = testsResult.rows;

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada'
      });
    }

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/quality-test-config
 * Criar nova configuração de teste de qualidade
 */
router.post('/', 
  auth.requireAuth,
  [
    body('machineId').isInt({ min: 1 }).withMessage('ID da máquina é obrigatório'),
    body('testName').trim().isLength({ min: 3, max: 255 }).withMessage('Nome do teste deve ter entre 3 e 255 caracteres'),
    body('testDescription').optional().trim().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
    body('testFrequency').isInt({ min: 1, max: 10000 }).withMessage('Frequência deve ser entre 1 e 10000 peças'),
    body('productsPerTest').isInt({ min: 1, max: 100 }).withMessage('Quantidade de produtos por teste deve ser entre 1 e 100'),
    body('isRequired').isBoolean().withMessage('Campo obrigatório deve ser verdadeiro ou falso'),
    body('minPassRate').isFloat({ min: 0, max: 100 }).withMessage('Taxa mínima deve ser entre 0 e 100%')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      // Verificar se o usuário tem permissão de gestor
      if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Apenas gestores podem criar configurações de teste'
        });
      }

      const { machineId, testName, testDescription, testFrequency, productsPerTest, isRequired, minPassRate } = req.body;

      // Verificar se a máquina existe
      const machineResult = await pool.query(
        'SELECT id, name, code FROM "machines" WHERE id = $1',
        [machineId]
      );

      if (machineResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Máquina não encontrada'
        });
      }

      const machine = machineResult.rows[0];

      // Verificar se já existe configuração ativa para esta máquina
      const existingConfigResult = await pool.query(
        'SELECT id FROM "quality_test_configs" WHERE "machine_id" = $1 AND "is_active" = true AND "test_name" = $2',
        [machineId, testName]
      );

      if (existingConfigResult.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Já existe uma configuração ativa com este nome para esta máquina'
        });
      }

      // Criar configuração
      const configResult = await pool.query(`
        INSERT INTO "quality_test_configs" (
          "machine_id", "test_name", "test_description", "test_frequency", 
          "products_per_test", "is_required", "min_pass_rate", "created_by", 
          "created_at", "updated_at", "is_active"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), true)
        RETURNING *
      `, [
        machineId,
        testName,
        testDescription || '',
        testFrequency,
        productsPerTest || 1,
        isRequired,
        minPassRate,
        req.user.id
      ]);

      // Buscar dados do usuário criador
      const userResult = await pool.query(
        'SELECT id, name, email FROM "users" WHERE id = $1',
        [req.user.id]
      );

      const config = {
        ...configResult.rows[0],
        machine: {
          id: machine.id,
          name: machine.name,
          code: machine.code
        },
        createdByUser: {
          id: userResult.rows[0].id,
          name: userResult.rows[0].name,
          email: userResult.rows[0].email
        }
      };

      // Registrar no histórico
      await pool.query(`
        INSERT INTO "quality_test_config_history" ("config_id", "field_changed", "new_value", "changed_by", "reason", "changed_at")
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        config.id,
        'CREATED',
        JSON.stringify({
          testName,
          testFrequency,
          productsPerTest,
          isRequired,
          minPassRate
        }),
        req.user.id,
        'Configuração criada',
        new Date()
      ]);

      res.status(201).json({
        success: true,
        message: 'Configuração de teste criada com sucesso',
        data: config
      });

    } catch (error) {
      console.error('Erro ao criar configuração:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * PUT /api/quality-test-config/:id
 * Atualizar configuração existente
 */
router.put('/:id',
  auth.requireAuth,
  [
    param('id').isInt(),
    body('testName').optional().trim().isLength({ min: 3, max: 255 }),
    body('testDescription').optional().trim().isLength({ max: 1000 }),
    body('testFrequency').optional().isInt({ min: 1, max: 10000 }),
    body('isRequired').optional().isBoolean(),
    body('isActive').optional().isBoolean(),
    body('minPassRate').optional().isFloat({ min: 0, max: 100 }),
    body('reason').optional().trim().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: errors.array()
        });
      }

      // Verificar permissão
      if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
        return res.status(403).json({
          success: false,
          message: 'Apenas gestores podem alterar configurações de teste'
        });
      }

      const configId = parseInt(req.params.id);
      const { reason, ...updateData } = req.body;

      // Buscar configuração atual
      const currentConfigResult = await pool.query(
        'SELECT * FROM "quality_test_configs" WHERE id = $1',
        [configId]
      );

      if (currentConfigResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Configuração não encontrada'
        });
      }

      const currentConfig = currentConfigResult.rows[0];

      // Preparar campos para atualização
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      Object.keys(updateData).forEach(key => {
        updateFields.push(`"${key}" = $${paramIndex}`);
        updateValues.push(updateData[key]);
        paramIndex++;
      });

      updateFields.push(`"updated_at" = $${paramIndex}`);
      updateValues.push(new Date());
      updateValues.push(configId);

      // Atualizar configuração
      await pool.query(`
        UPDATE "quality_test_configs" 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex + 1}
      `, updateValues);

      // Buscar configuração atualizada com dados relacionados
      const updatedConfigResult = await pool.query(`
        SELECT 
          qtc.id, qtc.machine_id, qtc.test_name, qtc.test_description, qtc.test_frequency, 
          qtc.products_per_test, qtc.is_required, qtc.is_active, qtc.min_pass_rate, 
          qtc.created_by, qtc.created_at, qtc.updated_at,
          m.id as machine_id, m.name as machine_name, m.code as machine_code, m."production_speed" as machine_production_speed,
          u.id as created_by_id, u.name as created_by_name, u.email as created_by_email
        FROM "quality_test_configs" qtc
        LEFT JOIN "machines" m ON qtc."machine_id" = m.id
        LEFT JOIN "users" u ON qtc."created_by" = u.id
        WHERE qtc.id = $1
      `, [configId]);

      const row = updatedConfigResult.rows[0];
      const updatedConfig = {
        ...row,
        machine: row.machine_id ? {
          id: row.machine_id,
          name: row.machine_name,
          code: row.machine_code,
          productionSpeed: row.machine_production_speed
        } : null,
        createdByUser: row.created_by_id ? {
          id: row.created_by_id,
          name: row.created_by_name,
          email: row.created_by_email
        } : null
      };

      // Remover campos duplicados
      delete updatedConfig.machine_id;
      delete updatedConfig.machine_name;
      delete updatedConfig.machine_code;
      delete updatedConfig.machine_production_speed;
      delete updatedConfig.created_by_id;
      delete updatedConfig.created_by_name;
      delete updatedConfig.created_by_email;


      // Registrar alterações no histórico
      for (const [field, newValue] of Object.entries(updateData)) {
        const oldValue = currentConfig[field];
        if (oldValue !== newValue) {
          await pool.query(`
            INSERT INTO "quality_test_config_history" ("config_id", "field_changed", "old_value", "new_value", "changed_by", "reason", "changed_at")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            configId,
            field.toUpperCase(),
            String(oldValue),
            String(newValue),
            req.user.id,
            reason || 'Alteração via API',
            new Date()
          ]);
        }
      }

      res.json({
        success: true,
        message: 'Configuração atualizada com sucesso',
        data: updatedConfig
      });

    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/quality-test-config/:id
 * Desativar configuração (soft delete)
 */
router.delete('/:id', auth.requireAuth, param('id').isInt(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    // Verificar permissão
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        message: 'Apenas gestores podem desativar configurações de teste'
      });
    }

    const configId = parseInt(req.params.id);
    const { reason } = req.body;

    // Verificar se a configuração existe
    const configResult = await pool.query(
      'SELECT id FROM quality_test_configs WHERE id = $1',
      [configId]
    );

    if (configResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Configuração não encontrada'
      });
    }

    // Desativar ao invés de deletar
    await pool.query(
      'UPDATE quality_test_configs SET is_active = false, updated_at = NOW() WHERE id = $1',
      [configId]
    );

    // Registrar no histórico
    await pool.query(`
      INSERT INTO "quality_test_config_history" (
        "config_id", "field_changed", "old_value", "new_value", 
        "changed_by", "reason", "changed_at"
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      configId,
      'DEACTIVATED',
      'true',
      'false',
      req.user.id,
      reason || 'Configuração desativada'
    ]);

    res.json({
      success: true,
      message: 'Configuração desativada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao desativar configuração:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/quality-test-config/machine/:machineId/required-tests
 * Verificar testes obrigatórios pendentes para uma máquina
 */
router.get('/machine/:machineId/required-tests', auth.requireAuth, param('machineId').isInt(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
    }

    const machineId = parseInt(req.params.machineId);
    
    // Buscar configurações ativas e obrigatórias para a máquina
    const configsResult = await pool.query(`
      SELECT * FROM quality_test_configs 
      WHERE machine_id = $1 AND is_active = true AND is_required = true
    `, [machineId]);
    
    const configs = configsResult.rows;

    if (configs.length === 0) {
      return res.json({
        success: true,
        data: {
          hasRequiredTests: false,
          pendingTests: [],
          message: 'Nenhum teste obrigatório configurado para esta máquina'
        }
      });
    }

    // Buscar produção atual da máquina
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const shiftDataResult = await pool.query(`
      SELECT * FROM shift_data 
      WHERE machine_id = $1 AND shift_date = $2
      LIMIT 1
    `, [machineId, today]);

    const shiftData = shiftDataResult.rows[0];
    const currentProduction = shiftData ? shiftData.totalProduction : 0;
    
    // Verificar testes pendentes para cada configuração
    const pendingTests = [];
    
    for (const config of configs) {
      const testsRequired = Math.ceil(currentProduction / config.testFrequency);
      
      const testsCompletedResult = await pool.query(
        'SELECT COUNT(*) FROM quality_tests WHERE config_id = $1 AND test_date >= $2',
        [config.id, today]
      );
      const testsCompleted = parseInt(testsCompletedResult.rows[0].count);
      
      const testsPending = Math.max(0, testsRequired - testsCompleted);
      
      if (testsPending > 0) {
        pendingTests.push({
          configId: config.id,
          testName: config.testName,
          testDescription: config.testDescription,
          testFrequency: config.testFrequency,
          testsRequired,
          testsCompleted,
          testsPending,
          currentProduction,
          nextTestAt: testsCompleted * config.testFrequency
        });
      }
    }

    res.json({
      success: true,
      data: {
        hasRequiredTests: true,
        hasPendingTests: pendingTests.length > 0,
        pendingTests,
        currentProduction,
        totalConfigs: configs.length
      }
    });

  } catch (error) {
    console.error('Erro ao verificar testes obrigatórios:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;