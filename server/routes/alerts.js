const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const externalNotificationService = require('../services/externalNotifications');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');

/**
 * @route POST /api/alerts
 * @desc Criar um novo alerta
 * @access Private
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { machine_id, lote, caixa, type, priority, message, userIds } = req.body;
    
    // Validação dos dados obrigatórios
    if (!machine_id || !type || !priority || !message) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios: machine_id, type, priority, message'
      });
    }
    
    // Validar prioridade
    const validPriorities = ['info', 'warning', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Prioridade deve ser: info, warning ou critical'
      });
    }
    
    const alertData = {
      machine_id,
      lote: lote || null,
      caixa: caixa || null,
      type,
      priority,
      message
    };
    
    const result = await notificationService.createAlert(alertData, userIds || []);
    
    if (result.success) {
      // Enviar notificações externas para usuários com configurações habilitadas
      try {
        if (result.notifiedUsers && result.notifiedUsers.length > 0) {
          const externalResults = [];
          
          for (const user of result.notifiedUsers) {
            if (user.alertConfig) {
              const userPreferences = {
                email: user.email,
                phone: user.phone,
                whatsapp: user.whatsapp,
                preferences: {
                  enableEmail: user.alertConfig.email,
                  enableSMS: user.alertConfig.sms,
                  enableWhatsApp: user.alertConfig.whatsapp,
                  minPriority: user.alertConfig.min_priority || 'LOW'
                }
              };
              
              const notification = {
                title: `Alerta ${type.toUpperCase()} - Máquina ${machine_id}`,
                message: message,
                priority: priority.toUpperCase()
              };
              
              const externalResult = await externalNotificationService.sendMultiChannelNotification(
                userPreferences,
                notification
              );
              
              externalResults.push({
                userId: user.id,
                email: externalResult.email,
                sms: externalResult.sms,
                whatsapp: externalResult.whatsapp
              });
            }
          }
          
          console.log('📧 Notificações externas enviadas:', externalResults);
        }
      } catch (externalError) {
        console.error('⚠️ Erro ao enviar notificações externas:', externalError);
        // Não falha a criação do alerta se as notificações externas falharem
      }
      
      res.status(201).json({
        success: true,
        message: 'Alerta criado e enviado com sucesso',
        data: {
          alert: result.alert,
          notifiedUsers: result.notifiedUsers
        }
      });
    } else {
      res.status(409).json({
        success: false,
        message: result.reason === 'duplicate' ? 'Alerta duplicado detectado' : 'Erro ao criar alerta',
        reason: result.reason
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar alerta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/alerts
 * @desc Buscar alertas com filtros
 * @access Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      machine_id,
      lote,
      type,
      priority,
      start_date,
      end_date,
      limit = 50,
      offset = 0
    } = req.query;
    
    const filters = {
      machine_id: machine_id ? parseInt(machine_id) : undefined,
      lote,
      type,
      priority,
      start_date,
      end_date,
      limit: Math.min(parseInt(limit) || 50, 100), // Máximo 100
      offset: parseInt(offset) || 0
    };
    
    const alerts = await notificationService.getAlerts(filters);
    
    res.json({
      success: true,
      data: alerts,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: alerts.length
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar alertas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/alerts/config
 * @desc Buscar configurações de alerta do usuário
 * @access Private
 */
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const config = await notificationService.getUserAlertConfig(userId);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configurações de alerta não encontradas para este usuário'
      });
    }
    
    res.json({
      success: true,
      data: {
        user_id: config.user_id,
        email: config.email,
        sms: config.sms,
        whatsapp: config.whatsapp,
        sound: config.sound,
        min_priority: config.min_priority,
        created_at: config.created_at,
        updated_at: config.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route PUT /api/alerts/config
 * @desc Atualizar configurações de alerta do usuário
 * @access Private
 */
router.put('/config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, sms, whatsapp, sound, min_priority } = req.body;
    
    // Validar min_priority
    const validPriorities = ['info', 'warning', 'critical'];
    if (min_priority && !validPriorities.includes(min_priority)) {
      return res.status(400).json({
        success: false,
        message: 'min_priority deve ser: info, warning ou critical'
      });
    }
    
    const config = {
      email: email !== undefined ? Boolean(email) : undefined,
      sms: sms !== undefined ? Boolean(sms) : undefined,
      whatsapp: whatsapp !== undefined ? Boolean(whatsapp) : undefined,
      sound: sound !== undefined ? Boolean(sound) : undefined,
      min_priority: min_priority || undefined
    };
    
    // Remover campos undefined
    Object.keys(config).forEach(key => {
      if (config[key] === undefined) {
        delete config[key];
      }
    });
    
    if (Object.keys(config).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nenhuma configuração fornecida para atualizar'
      });
    }
    
    const updatedConfig = await notificationService.updateUserAlertConfig(userId, config);
    
    if (!updatedConfig) {
      return res.status(404).json({
        success: false,
        message: 'Configurações de alerta não encontradas para este usuário'
      });
    }
    
    res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      data: {
        user_id: updatedConfig.user_id,
        email: updatedConfig.email,
        sms: updatedConfig.sms,
        whatsapp: updatedConfig.whatsapp,
        sound: updatedConfig.sound,
        min_priority: updatedConfig.min_priority,
        updated_at: updatedConfig.updated_at
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar configurações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/alerts/priorities
 * @desc Buscar configurações de prioridades disponíveis
 * @access Private
 */
router.get('/priorities', authenticateToken, async (req, res) => {
  try {
    const priorities = {
      info: {
        label: 'Informativo',
        color: '#10B981',
        icon: 'info',
        sound: 'info.mp3',
        description: 'Informações gerais do sistema'
      },
      warning: {
        label: 'Aviso',
        color: '#F59E0B',
        icon: 'warning',
        sound: 'warning.mp3',
        description: 'Situações que requerem atenção'
      },
      critical: {
        label: 'Crítico',
        color: '#EF4444',
        icon: 'error',
        sound: 'critical.mp3',
        description: 'Situações urgentes que requerem ação imediata'
      }
    };
    
    res.json({
      success: true,
      data: priorities
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar prioridades:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

/**
 * @route POST /api/alerts/test
 * @desc Enviar alerta de teste
 * @access Private
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { priority = 'info' } = req.body;
    const userId = req.user.id;
    
    const alertData = {
      machine_id: 999, // ID fictício para teste
      lote: 'TESTE',
      caixa: 'TESTE',
      type: 'teste',
      priority,
      message: `Alerta de teste enviado por ${req.user.name || 'usuário'} em ${new Date().toLocaleString('pt-BR')}`
    };
    
    const result = await notificationService.createAlert(alertData, [userId]);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Alerta de teste enviado com sucesso',
        data: result.alert
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Erro ao enviar alerta de teste',
        reason: result.reason
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao enviar alerta de teste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/alerts/stats
 * @desc Buscar estatísticas de alertas
 * @access Private
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let interval;
    switch (period) {
      case '24h':
        interval = '24 hours';
        break;
      case '7d':
        interval = '7 days';
        break;
      case '30d':
        interval = '30 days';
        break;
      default:
        interval = '7 days';
    }
    
    const stats = await pool.query(`
      SELECT 
        priority,
        type,
        COUNT(*) as count,
        DATE_TRUNC('day', created_at) as date
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY priority, type, DATE_TRUNC('day', created_at)
      ORDER BY date DESC, priority, type
    `);
    
    const summary = await pool.query(`
      SELECT 
        priority,
        COUNT(*) as total
      FROM alerts 
      WHERE created_at > NOW() - INTERVAL '${interval}'
      GROUP BY priority
    `);
    
    res.json({
      success: true,
      data: {
        period,
        interval,
        details: stats.rows,
        summary: summary.rows
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route GET /api/alerts/test-external
 * @desc Testar conectividade dos canais externos
 * @access Private (Admin only)
 */
router.get('/test-external', authenticateToken, async (req, res) => {
  try {
    // Verificar se o usuário tem permissão de admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem testar canais externos.'
      });
    }

    const connections = await externalNotificationService.testConnections();
    
    res.json({
      success: true,
      message: 'Teste de conectividade concluído',
      data: {
        email: {
          connected: connections.email,
          status: connections.email ? 'Conectado' : 'Desconectado',
          service: 'Gmail/SMTP'
        },
        sms: {
          connected: connections.sms,
          status: connections.sms ? 'Conectado' : 'Desconectado',
          service: 'Twilio'
        },
        whatsapp: {
          connected: connections.whatsapp,
          status: connections.whatsapp ? 'Conectado' : 'Desconectado',
          service: 'WhatsApp Business API'
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao testar canais externos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route POST /api/alerts/test-send
 * @desc Enviar notificação de teste
 * @access Private (Admin only)
 */
router.post('/test-send', authenticateToken, async (req, res) => {
  try {
    // Verificar se o usuário tem permissão de admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Apenas administradores podem enviar testes.'
      });
    }

    const { email, phone, whatsapp, channels = ['email'] } = req.body;
    
    if (!email && !phone && !whatsapp) {
      return res.status(400).json({
        success: false,
        message: 'Pelo menos um canal de contato deve ser fornecido'
      });
    }

    const userPreferences = {
      email,
      phone,
      whatsapp,
      preferences: {
        enableEmail: channels.includes('email'),
        enableSMS: channels.includes('sms'),
        enableWhatsApp: channels.includes('whatsapp'),
        minPriority: 'LOW'
      }
    };
    
    const notification = {
      title: 'Teste de Notificação - Sistema ZARA',
      message: 'Esta é uma notificação de teste para verificar a conectividade dos canais externos. Se você recebeu esta mensagem, o sistema está funcionando corretamente.',
      priority: 'MEDIUM'
    };
    
    const results = await externalNotificationService.sendMultiChannelNotification(
      userPreferences,
      notification
    );
    
    res.json({
      success: true,
      message: 'Notificação de teste enviada',
      data: {
        email: results.email,
        sms: results.sms,
        whatsapp: results.whatsapp
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao enviar notificação de teste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;