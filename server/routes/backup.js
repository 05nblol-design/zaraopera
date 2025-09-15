const express = require('express');
const router = express.Router();
const backupService = require('../services/backupService');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Middleware de autenticação para todas as rotas de backup
router.use(authenticateToken);
router.use(requireRole(['admin'])); // Apenas administradores podem gerenciar backups

// GET /api/backup/status - Obter status do serviço de backup
router.get('/status', async (req, res) => {
  try {
    const status = backupService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('❌ Erro ao obter status do backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao obter status do backup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/backup/list - Listar backups disponíveis
router.get('/list', async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json({
      success: true,
      data: {
        backups,
        count: backups.length
      }
    });
  } catch (error) {
    console.error('❌ Erro ao listar backups:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao listar backups',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/backup/create - Criar backup manual
router.post('/create', async (req, res) => {
  try {
    const result = await backupService.createBackup();
    res.json({
      success: true,
      message: 'Backup criado com sucesso',
      data: result
    });
  } catch (error) {
    console.error('❌ Erro ao criar backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao criar backup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/backup/restore - Restaurar backup
router.post('/restore', async (req, res) => {
  try {
    const { fileName } = req.body;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'Nome do arquivo de backup é obrigatório'
      });
    }
    
    // Validar nome do arquivo
    if (!fileName.startsWith('backup_') || !fileName.endsWith('.sql')) {
      return res.status(400).json({
        success: false,
        message: 'Nome do arquivo de backup inválido'
      });
    }
    
    const result = await backupService.restoreBackup(fileName);
    res.json({
      success: true,
      message: 'Backup restaurado com sucesso',
      data: result
    });
  } catch (error) {
    console.error('❌ Erro ao restaurar backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao restaurar backup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/backup/start - Iniciar serviço de backup automático
router.post('/start', async (req, res) => {
  try {
    backupService.start();
    res.json({
      success: true,
      message: 'Serviço de backup automático iniciado'
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar serviço de backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao iniciar serviço de backup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/backup/stop - Parar serviço de backup automático
router.post('/stop', async (req, res) => {
  try {
    backupService.stop();
    res.json({
      success: true,
      message: 'Serviço de backup automático parado'
    });
  } catch (error) {
    console.error('❌ Erro ao parar serviço de backup:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao parar serviço de backup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;