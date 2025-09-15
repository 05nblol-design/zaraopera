const express = require('express');
const router = express.Router();
const shiftService = require('../services/shiftService');
const ShiftRotationService = require('../services/shiftRotationService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const pool = require('../config/database');

// Instanciar serviço de rotação 3x3
const shiftRotationService = new ShiftRotationService();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * GET /api/shifts/current
 * Busca dados do turno atual para uma máquina e operador
 */
router.get('/current', async (req, res) => {
  try {
    const { machineId, operatorId } = req.query;
    const userId = req.user.id;
    
    // Se não especificado operador e usuário é operador, usar o próprio usuário
    const finalOperatorId = operatorId || (req.user.role === 'OPERATOR' ? userId : null);
    
    if (!machineId || !finalOperatorId) {
      return res.status(400).json({
        success: false,
        message: 'machineId e operatorId são obrigatórios'
      });
    }

    const shiftData = await shiftService.getCurrentShiftData(
      parseInt(machineId), 
      parseInt(finalOperatorId)
    );
    
    if (!shiftData) {
      // Criar novo turno se não existir
      const newShiftData = await shiftService.createOrUpdateShiftData(
        parseInt(machineId), 
        parseInt(finalOperatorId)
      );
      
      return res.json({
        success: true,
        data: newShiftData,
        message: 'Novo turno criado'
      });
    }
    
    res.json({
      success: true,
      data: shiftData
    });
  } catch (error) {
    console.error('Erro ao buscar turno atual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/update
 * Atualiza dados do turno atual
 */
router.post('/update', async (req, res) => {
  try {
    const { machineId, operatorId, productionData } = req.body;
    const userId = req.user.id;
    
    const finalOperatorId = operatorId || (req.user.role === 'OPERATOR' ? userId : null);
    
    if (!finalOperatorId) {
      return res.status(400).json({
        success: false,
        message: 'operatorId é obrigatório'
      });
    }

    const updatedShift = await shiftService.createOrUpdateShiftData(
      parseInt(machineId),
      parseInt(finalOperatorId),
      productionData
    );
    
    res.json({
      success: true,
      data: updatedShift,
      message: 'Dados do turno atualizados com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar turno:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/reset
 * Reseta dados do operador para novo turno
 */
router.post('/reset', async (req, res) => {
  try {
    const { machineId, operatorId } = req.body;
    const userId = req.user.id;
    
    const finalOperatorId = operatorId || (req.user.role === 'OPERATOR' ? userId : null);
    
    if (!finalOperatorId) {
      return res.status(400).json({
        success: false,
        message: 'operatorId é obrigatório'
      });
    }

    const newShiftData = await shiftService.resetOperatorData(
      parseInt(machineId),
      parseInt(finalOperatorId)
    );
    
    res.json({
      success: true,
      data: newShiftData,
      message: 'Dados do operador resetados para novo turno'
    });
  } catch (error) {
    console.error('Erro ao resetar dados do operador:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/history
 * Busca histórico de turnos
 */
router.get('/history', async (req, res) => {
  try {
    const { 
      machineId, 
      operatorId, 
      startDate, 
      endDate, 
      shiftType,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const where = {
      isArchived: false
    };
    
    if (machineId) where.machineId = parseInt(machineId);
    if (operatorId) where.operatorId = parseInt(operatorId);
    if (shiftType) where.shiftType = shiftType;
    
    if (startDate || endDate) {
      where.shiftDate = {};
      if (startDate) where.shiftDate.gte = new Date(startDate);
      if (endDate) where.shiftDate.lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build WHERE clause for SQL
    const whereConditions = ['is_archived = $1'];
    const queryParams = [false];
    let paramIndex = 2;
    
    if (machineId) {
      whereConditions.push(`machine_id = $${paramIndex}`);
      queryParams.push(parseInt(machineId));
      paramIndex++;
    }
    if (operatorId) {
      whereConditions.push(`operator_id = $${paramIndex}`);
      queryParams.push(parseInt(operatorId));
      paramIndex++;
    }
    if (shiftType) {
      whereConditions.push(`shift_type = $${paramIndex}`);
      queryParams.push(shiftType);
      paramIndex++;
    }
    if (startDate) {
      whereConditions.push(`shift_date >= $${paramIndex}`);
      queryParams.push(new Date(startDate));
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`shift_date <= $${paramIndex}`);
      queryParams.push(new Date(endDate));
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const [shiftsResult, totalResult] = await Promise.all([
      pool.query(`
        SELECT 
          sd.*,
          m.name as machine_name,
          m.code as machine_code,
          u.name as operator_name,
          u.email as operator_email
        FROM shift_data sd
        LEFT JOIN machines m ON sd.machine_id = m.id
        LEFT JOIN users u ON sd.operator_id = u.id
        WHERE ${whereClause}
        ORDER BY sd.shift_date DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, parseInt(limit), skip]),
      pool.query(`
        SELECT COUNT(*) as total
        FROM shift_data sd
        WHERE ${whereClause}
      `, queryParams)
    ]);
    
    const shifts = shiftsResult.rows.map(row => ({
      id: row.id,
      machineId: row.machine_id,
      operatorId: row.operator_id,
      shiftType: row.shift_type,
      shiftDate: row.shift_date,
      startTime: row.start_time,
      endTime: row.end_time,
      productionCount: row.production_count,
      targetProduction: row.target_production,
      efficiency: row.efficiency,
      qualityScore: row.quality_score,
      downtime: row.downtime,
      notes: row.notes,
      isArchived: row.is_archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      machine: row.machine_name ? {
        name: row.machine_name,
        code: row.machine_code
      } : null,
      operator: row.operator_name ? {
        name: row.operator_name,
        email: row.operator_email
      } : null
    }));
    
    const total = parseInt(totalResult.rows[0].total);
    
    res.json({
      success: true,
      data: shifts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de turnos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/archives
 * Busca dados arquivados
 */
router.get('/archives', async (req, res) => {
  try {
    const { 
      machineId, 
      operatorId, 
      startDate, 
      endDate,
      page = 1,
      limit = 20
    } = req.query;
    
    const filters = {};
    if (machineId) filters.machineId = parseInt(machineId);
    if (operatorId) filters.operatorId = parseInt(operatorId);
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const archives = await shiftService.getArchivedData(filters);
    
    // Paginação manual para dados arquivados
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedArchives = archives.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedArchives,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: archives.length,
        pages: Math.ceil(archives.length / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados arquivados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/archive/:id
 * Arquiva manualmente um turno específico
 */
router.post('/archive/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar permissões (apenas supervisores e administradores)
    if (!['SUPERVISOR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas supervisores e administradores podem arquivar turnos.'
      });
    }
    
    const archive = await shiftService.archiveShiftData(parseInt(id));
    
    res.json({
      success: true,
      data: archive,
      message: 'Turno arquivado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao arquivar turno:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/summary
 * Resumo de turnos por período
 */
router.get('/summary', async (req, res) => {
  try {
    const { 
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      machineId,
      operatorId
    } = req.query;
    
    const where = {
      shiftDate: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };
    
    if (machineId) where.machineId = parseInt(machineId);
    if (operatorId) where.operatorId = parseInt(operatorId);
    
    // Build WHERE clause for SQL
    const whereConditions = ['sd.shift_date >= $1 AND sd.shift_date <= $2'];
    const queryParams = [new Date(startDate), new Date(endDate)];
    let paramIndex = 3;
    
    if (machineId) {
      whereConditions.push(`sd.machine_id = $${paramIndex}`);
      queryParams.push(parseInt(machineId));
      paramIndex++;
    }
    if (operatorId) {
      whereConditions.push(`sd.operator_id = $${paramIndex}`);
      queryParams.push(parseInt(operatorId));
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const shiftsResult = await pool.query(`
      SELECT 
        sd.*,
        m.name as machine_name,
        u.name as operator_name
      FROM shift_data sd
      LEFT JOIN machines m ON sd.machine_id = m.id
      LEFT JOIN users u ON sd.operator_id = u.id
      WHERE ${whereClause}
    `, queryParams);
    
    const shifts = shiftsResult.rows.map(row => ({
      id: row.id,
      machineId: row.machine_id,
      operatorId: row.operator_id,
      shiftType: row.shift_type,
      shiftDate: row.shift_date,
      totalProduction: row.total_production,
      efficiency: row.efficiency,
      downtime: row.downtime,
      qualityTests: row.quality_tests,
      approvedTests: row.approved_tests,
      machine: { name: row.machine_name },
      operator: { name: row.operator_name }
    }));
    
    // Calcular resumo
    const summary = {
      totalShifts: shifts.length,
      totalProduction: shifts.reduce((sum, shift) => sum + (shift.totalProduction || 0), 0),
      averageEfficiency: shifts.length > 0 
        ? shifts.reduce((sum, shift) => sum + (shift.efficiency || 0), 0) / shifts.length 
        : 0,
      totalDowntime: shifts.reduce((sum, shift) => sum + (shift.downtime || 0), 0),
      totalQualityTests: shifts.reduce((sum, shift) => sum + (shift.qualityTests || 0), 0),
      totalApprovedTests: shifts.reduce((sum, shift) => sum + (shift.approvedTests || 0), 0),
      byShiftType: {
        MORNING: shifts.filter(s => s.shiftType === 'MORNING').length,
        NIGHT: shifts.filter(s => s.shiftType === 'NIGHT').length
      },
      byMachine: {},
      byOperator: {}
    };
    
    // Agrupar por máquina
    shifts.forEach(shift => {
      const machineName = shift.machine.name;
      if (!summary.byMachine[machineName]) {
        summary.byMachine[machineName] = {
          shifts: 0,
          production: 0,
          efficiency: 0
        };
      }
      summary.byMachine[machineName].shifts++;
      summary.byMachine[machineName].production += shift.totalProduction || 0;
      summary.byMachine[machineName].efficiency += shift.efficiency || 0;
    });
    
    // Calcular média de eficiência por máquina
    Object.keys(summary.byMachine).forEach(machine => {
      const machineData = summary.byMachine[machine];
      machineData.efficiency = machineData.shifts > 0 
        ? machineData.efficiency / machineData.shifts 
        : 0;
    });
    
    // Agrupar por operador
    shifts.forEach(shift => {
      const operatorName = shift.operator.name;
      if (!summary.byOperator[operatorName]) {
        summary.byOperator[operatorName] = {
          shifts: 0,
          production: 0,
          efficiency: 0
        };
      }
      summary.byOperator[operatorName].shifts++;
      summary.byOperator[operatorName].production += shift.totalProduction || 0;
      summary.byOperator[operatorName].efficiency += shift.efficiency || 0;
    });
    
    // Calcular média de eficiência por operador
    Object.keys(summary.byOperator).forEach(operator => {
      const operatorData = summary.byOperator[operator];
      operatorData.efficiency = operatorData.shifts > 0 
        ? operatorData.efficiency / operatorData.shifts 
        : 0;
    });
    
    res.json({
      success: true,
      data: summary,
      period: { startDate, endDate }
    });
  } catch (error) {
    console.error('Erro ao gerar resumo de turnos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/manual-archive
 * Força arquivamento de turnos completos (apenas para administradores)
 */
router.post('/manual-archive', async (req, res) => {
  try {
    // Verificar permissões de administrador
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem executar arquivamento manual.'
      });
    }
    
    const result = await shiftService.checkAndArchiveCompletedShifts();
    
    res.json({
      success: true,
      data: result,
      message: 'Arquivamento manual executado com sucesso'
    });
  } catch (error) {
    console.error('Erro no arquivamento manual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// ==================== ROTAS PARA SISTEMA 3x3 ====================

/**
 * POST /api/shifts/3x3/initialize-teams
 * Inicializa equipes para o sistema de rotação 3x3
 */
router.post('/3x3/initialize-teams', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem inicializar equipes.'
      });
    }

    const { teams } = req.body;
    
    if (!teams || !Array.isArray(teams)) {
      return res.status(400).json({
        success: false,
        message: 'Lista de equipes é obrigatória'
      });
    }

    const createdTeams = await shiftRotationService.initializeShiftTeams(teams);
    
    res.json({
      success: true,
      data: createdTeams,
      message: 'Equipes inicializadas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao inicializar equipes 3x3:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/3x3/current/:teamCode
 * Busca a escala atual de uma equipe específica
 */
router.get('/3x3/current/:teamCode', async (req, res) => {
  try {
    const { teamCode } = req.params;
    const { date } = req.query;
    
    const currentDate = date ? new Date(date) : new Date();
    const teamShift = await shiftRotationService.getTeamActiveShift(teamCode, currentDate);
    
    res.json({
      success: true,
      data: teamShift
    });
  } catch (error) {
    console.error('Erro ao buscar escala atual da equipe:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * POST /api/shifts/3x3/create
 * Cria dados de turno para o sistema 3x3
 */
router.post('/3x3/create', async (req, res) => {
  try {
    const { machineId, operatorId, teamCode, productionData } = req.body;
    const userId = req.user.id;
    
    const finalOperatorId = operatorId || (req.user.role === 'OPERATOR' ? userId : null);
    
    if (!machineId || !finalOperatorId || !teamCode) {
      return res.status(400).json({
        success: false,
        message: 'machineId, operatorId e teamCode são obrigatórios'
      });
    }

    const shiftData = await shiftRotationService.createShiftData3x3(
      parseInt(machineId),
      parseInt(finalOperatorId),
      teamCode,
      productionData
    );
    
    res.json({
      success: true,
      data: shiftData,
      message: 'Dados do turno 3x3 criados com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar turno 3x3:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/3x3/schedule/:teamCode
 * Obtém cronograma de rotação para uma equipe
 */
router.get('/3x3/schedule/:teamCode', async (req, res) => {
  try {
    const { teamCode } = req.params;
    const { days = 30 } = req.query;
    
    const schedule = await shiftRotationService.getRotationSchedule(
      teamCode, 
      parseInt(days)
    );
    
    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Erro ao obter cronograma de rotação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/3x3/teams
 * Lista todas as equipes do sistema 3x3
 */
router.get('/3x3/teams', async (req, res) => {
  try {
    const teamsResult = await pool.query(`
      SELECT 
        st.*,
        stm.id as member_id,
        stm.user_id,
        stm.is_active as member_is_active,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM shift_teams st
      LEFT JOIN shift_team_members stm ON st.id = stm.team_id AND stm.is_active = true
      LEFT JOIN users u ON stm.user_id = u.id
      ORDER BY st.id, stm.id
    `);
    
    // Group results by team
    const teamsMap = new Map();
    
    teamsResult.rows.forEach(row => {
      if (!teamsMap.has(row.id)) {
        teamsMap.set(row.id, {
          id: row.id,
          teamCode: row.team_code,
          name: row.name,
          description: row.description,
          isActive: row.is_active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          members: []
        });
      }
      
      if (row.member_id) {
        teamsMap.get(row.id).members.push({
          id: row.member_id,
          userId: row.user_id,
          isActive: row.member_is_active,
          user: {
            id: row.user_id,
            name: row.user_name,
            email: row.user_email,
            role: row.user_role
          }
        });
      }
    });
    
    const teams = Array.from(teamsMap.values());
    
    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Erro ao listar equipes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * GET /api/shifts/3x3/summary
 * Resumo de eficiência por escala no sistema 3x3
 */
router.get('/3x3/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {
      isActive: false, // Apenas turnos finalizados
      shiftType: {
        in: ['SHIFT_1', 'SHIFT_2', 'SHIFT_3', 'SHIFT_4']
      }
    };
    
    if (startDate || endDate) {
      where.shiftDate = {};
      if (startDate) where.shiftDate.gte = new Date(startDate);
      if (endDate) where.shiftDate.lte = new Date(endDate);
    }
    
    // Build WHERE clause for SQL
    const whereConditions = ['is_active = $1'];
    const queryParams = [false];
    let paramIndex = 2;
    
    // Add shift type filter
    whereConditions.push(`shift_type IN ($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`);
    queryParams.push('SHIFT_1', 'SHIFT_2', 'SHIFT_3', 'SHIFT_4');
    paramIndex += 4;
    
    if (startDate) {
      whereConditions.push(`shift_date >= $${paramIndex}`);
      queryParams.push(new Date(startDate));
      paramIndex++;
    }
    if (endDate) {
      whereConditions.push(`shift_date <= $${paramIndex}`);
      queryParams.push(new Date(endDate));
      paramIndex++;
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const shiftsResult = await pool.query(`
      SELECT 
        shift_type,
        efficiency,
        total_production,
        target_production,
        team_group
      FROM shift_data
      WHERE ${whereClause}
    `, queryParams);
    
    const shifts = shiftsResult.rows.map(row => ({
      shiftType: row.shift_type,
      efficiency: row.efficiency,
      totalProduction: row.total_production,
      targetProduction: row.target_production,
      teamGroup: row.team_group
    }));
    
    // Agrupar por tipo de escala
    const summary = {};
    shifts.forEach(shift => {
      if (!summary[shift.shiftType]) {
        summary[shift.shiftType] = {
          count: 0,
          totalEfficiency: 0,
          totalProduction: 0,
          totalTarget: 0
        };
      }
      
      summary[shift.shiftType].count++;
      summary[shift.shiftType].totalEfficiency += shift.efficiency || 0;
      summary[shift.shiftType].totalProduction += shift.totalProduction || 0;
      summary[shift.shiftType].totalTarget += shift.targetProduction || 0;
    });
    
    // Calcular médias
    const result = Object.keys(summary).map(shiftType => ({
      shiftType,
      averageEfficiency: summary[shiftType].count > 0 
        ? Math.round(summary[shiftType].totalEfficiency / summary[shiftType].count)
        : 0,
      totalProduction: summary[shiftType].totalProduction,
      totalTarget: summary[shiftType].totalTarget,
      shiftsCount: summary[shiftType].count
    }));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erro ao obter resumo 3x3:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;