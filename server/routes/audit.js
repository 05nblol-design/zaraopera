const express = require('express');
const router = express.Router();
const auditLogger = require('../services/auditLogger');
const fs = require('fs').promises;
const path = require('path');

// Endpoint para verificar status do sistema de auditoria
router.get('/status', async (req, res) => {
  try {
    const stats = await auditLogger.getAuditStats();
    
    // Verificar se os arquivos de log existem
    const logsDir = path.join(__dirname, '../logs');
    const today = new Date().toISOString().split('T')[0];
    
    const logFiles = {
      system: `system_events-${today}.log`,
      auth: `authentication-${today}.log`,
      data: `data_access-${today}.log`
    };
    
    const fileStatus = {};
    
    for (const [type, filename] of Object.entries(logFiles)) {
      try {
        const filePath = path.join(logsDir, filename);
        const stat = await fs.stat(filePath);
        fileStatus[type] = {
          exists: true,
          size: stat.size,
          lastModified: stat.mtime
        };
      } catch (error) {
        fileStatus[type] = {
          exists: false,
          size: 0,
          lastModified: null
        };
      }
    }
    
    res.json({
      status: 'active',
      message: 'Sistema de auditoria ativo',
      stats,
      logFiles: fileStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao verificar status da auditoria:', error);
    res.status(500).json({
      status: 'error',
      message: 'Erro ao verificar status do sistema de auditoria',
      error: error.message
    });
  }
});

// Endpoint para obter logs recentes
router.get('/logs/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 50 } = req.query;
    
    const today = new Date().toISOString().split('T')[0];
    let filename;
    
    switch (type) {
      case 'system':
        filename = `system_events-${today}.log`;
        break;
      case 'auth':
        filename = `authentication-${today}.log`;
        break;
      case 'data':
        filename = `data_access-${today}.log`;
        break;
      default:
        return res.status(400).json({ error: 'Tipo de log inválido' });
    }
    
    const filePath = path.join(__dirname, '../logs', filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const logs = lines.slice(-limit).map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return { raw: line, parseError: true };
        }
      });
      
      res.json({
        type,
        count: logs.length,
        logs
      });
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.json({
          type,
          count: 0,
          logs: [],
          message: 'Arquivo de log não encontrado'
        });
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('Erro ao obter logs:', error);
    res.status(500).json({
      error: 'Erro ao obter logs',
      message: error.message
    });
  }
});

module.exports = router;