const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const productionService = require('../services/productionService');

// GET /api/machines/production/aggregate - Dados agregados de produção para Dashboard
router.get('/aggregate', async (req, res) => {
  try {
    // Buscar todas as máquinas ativas (versão simplificada para debug)
    const machinesQuery = `
      SELECT id, name, status, is_active
      FROM machines
      WHERE is_active = true
    `;
    
    const machinesResult = await pool.query(machinesQuery);
    const machines = machinesResult.rows;

    // Dados agregados básicos sem usar productionService por enquanto
    const aggregatedData = {
      totalProduction: 0,
      totalRunningTime: 0,
      averageEfficiency: 0,
      totalDowntime: 0,
      runningMachines: machines.filter(m => m.status === 'FUNCIONANDO').length,
      totalMachines: machines.length,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: aggregatedData
    });

  } catch (error) {
    console.error('Erro ao buscar dados agregados de produção:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET /api/reports/production-summary - Dados de produção para Reports
router.get('/reports/production-summary', authenticateToken, async (req, res) => {
  try {
    const { dateRange = 'TODAY', machineId, operatorId } = req.query;
    
    // Calcular período baseado no dateRange
    const now = new Date();
    let startDate = new Date();
    
    switch (dateRange) {
      case 'TODAY':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'WEEK':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'MONTH':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'QUARTER':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'YEAR':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    // Construir query com filtros
    let queryParams = [startDate, now];
    let paramIndex = 3;
    
    let machineFilter = '';
    if (machineId && machineId !== 'ALL') {
      machineFilter = ` AND m.id = $${paramIndex}`;
      queryParams.push(parseInt(machineId));
      paramIndex++;
    }
    
    let operatorFilter = '';
    if (operatorId && operatorId !== 'ALL') {
      operatorFilter = ` AND sd.operator_id = $${paramIndex}`;
      queryParams.push(parseInt(operatorId));
    }

    // Buscar máquinas com dados de shift no período
    const machinesQuery = `
      SELECT m.id, m.name, m.is_active,
             sd.id as shift_id, sd.total_production, sd.running_time, 
             sd.efficiency, sd.downtime, sd.shift_date, sd.operator_id,
             u.name as operator_name
      FROM machines m
      LEFT JOIN shift_data sd ON m.id = sd.machine_id 
        AND sd.shift_date >= $1 AND sd.shift_date <= $2 ${operatorFilter}
      LEFT JOIN users u ON sd.operator_id = u.id
      WHERE m.is_active = true ${machineFilter}
      ORDER BY m.id, sd.shift_date DESC
    `;
    
    const machinesResult = await pool.query(machinesQuery, queryParams);
    
    // Agrupar dados por máquina
    const machinesMap = new Map();
    machinesResult.rows.forEach(row => {
      if (!machinesMap.has(row.id)) {
        machinesMap.set(row.id, {
          id: row.id,
          name: row.name,
          isActive: row.is_active,
          shiftData: []
        });
      }
      
      if (row.shift_id) {
        machinesMap.get(row.id).shiftData.push({
          id: row.shift_id,
          totalProduction: row.total_production,
          runningTime: row.running_time,
          efficiency: row.efficiency,
          downtime: row.downtime,
          shiftDate: row.shift_date,
          operatorId: row.operator_id,
          operator: row.operator_name ? { name: row.operator_name } : null
        });
      }
    });
    
    const machines = Array.from(machinesMap.values());

    let totalProduction = 0;
    let totalRunningTime = 0;
    let totalEfficiency = 0;
    let totalDowntime = 0;
    let qualityTests = 0;
    let passedTests = 0;
    const machinePerformance = [];
    let shiftsWithData = 0;

    // Processar dados de cada máquina
    machines.forEach(machine => {
      let machineProduction = 0;
      let machineRunningTime = 0;
      let machineEfficiency = 0;
      let machineDowntime = 0;
      let machineShifts = 0;

      machine.shiftData.forEach(shift => {
        machineProduction += shift.totalProduction || 0;
        machineRunningTime += shift.runningTime || 0;
        machineDowntime += shift.downtime || 0;
        
        // Calcular eficiência do shift
        const shiftTotalTime = shift.runningTime + shift.downtime;
        if (shiftTotalTime > 0) {
          machineEfficiency += (shift.runningTime / shiftTotalTime) * 100;
          machineShifts++;
        }
        
        // Dados de qualidade (se disponíveis)
        if (shift.qualityTests) {
          qualityTests += shift.qualityTests;
          passedTests += shift.passedTests || 0;
        }
        
        shiftsWithData++;
      });

      totalProduction += machineProduction;
      totalRunningTime += machineRunningTime;
      totalDowntime += machineDowntime;
      
      if (machineShifts > 0) {
        totalEfficiency += machineEfficiency / machineShifts;
      }

      // Performance individual da máquina
      machinePerformance.push({
        machine: machine.name || `Máquina ${machine.code}`,
        production: machineProduction,
        efficiency: machineShifts > 0 ? Math.round((machineEfficiency / machineShifts) * 10) / 10 : 0,
        downtime: Math.round((machineDowntime / 60) * 10) / 10 // converter para horas
      });
    });

    const reportsData = {
      totalProduction: Math.round(totalProduction),
      totalRunningTime: Math.round(totalRunningTime),
      averageEfficiency: machines.length > 0 ? Math.round(totalEfficiency / machines.length) : 0,
      totalDowntime: Math.round(totalDowntime / 60), // em horas
      qualityRate: qualityTests > 0 ? Math.round((passedTests / qualityTests) * 100 * 10) / 10 : 95,
      machinePerformance,
      period: {
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        range: dateRange
      },
      summary: {
        totalMachines: machines.length,
        shiftsAnalyzed: shiftsWithData,
        qualityTests,
        passedTests
      }
    };

    res.json({
      success: true,
      data: reportsData
    });

  } catch (error) {
    console.error('Erro ao buscar dados de relatório de produção:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;