const nodemailer = require('nodemailer');
const twilio = require('twilio');
const axios = require('axios');
const auditLogger = require('./auditLogger');

class ExternalNotificationService {
  constructor() {
    // Configuração do Email (Gmail/SMTP)
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Configuração do Twilio (SMS)
    this.twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
      ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      : null;

    // Configuração do WhatsApp Business API
    this.whatsappConfig = {
      apiUrl: process.env.WHATSAPP_API_URL,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
    };
  }

  /**
   * Envia notificação por email
   */
  async sendEmail(to, subject, message, priority = 'MEDIUM') {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('Email credentials not configured');
        return { success: false, error: 'Email not configured' };
      }

      const priorityColors = {
        URGENT: '#dc2626',
        HIGH: '#ea580c',
        MEDIUM: '#2563eb',
        LOW: '#6b7280'
      };

      const priorityLabels = {
        URGENT: 'URGENTE',
        HIGH: 'ALTA',
        MEDIUM: 'MÉDIA',
        LOW: 'BAIXA'
      };

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: ${priorityColors[priority]}; color: white; padding: 20px; text-align: center; }
            .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
            .content { padding: 30px; }
            .message { line-height: 1.6; color: #333; margin-bottom: 20px; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
            .timestamp { color: #888; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="priority-badge" style="background: rgba(255,255,255,0.2);">
                PRIORIDADE ${priorityLabels[priority]}
              </div>
              <h1 style="margin: 0; font-size: 24px;">${subject}</h1>
            </div>
            <div class="content">
              <div class="message">${message.replace(/\n/g, '<br>')}</div>
              <div class="timestamp">
                Enviado em: ${new Date().toLocaleString('pt-BR')}
              </div>
            </div>
            <div class="footer">
              <p>Sistema ZARA - Notificações Automáticas</p>
              <p>Este é um email automático, não responda.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Sistema ZARA" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: `[${priorityLabels[priority]}] ${subject}`,
        html: htmlContent,
        text: `${subject}\n\n${message}\n\nPrioridade: ${priorityLabels[priority]}\nEnviado em: ${new Date().toLocaleString('pt-BR')}`
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      
      console.log(`Email sent successfully to ${to}`, { messageId: result.messageId });
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia SMS via Twilio
   */
  async sendSMS(to, message, priority = 'MEDIUM') {
    try {
      if (!this.twilioClient) {
        console.warn('Twilio credentials not configured');
        return { success: false, error: 'SMS not configured' };
      }

      const priorityLabels = {
        URGENT: '🚨 URGENTE',
        HIGH: '⚠️ ALTA',
        MEDIUM: 'ℹ️ MÉDIA',
        LOW: '📝 BAIXA'
      };

      const formattedMessage = `${priorityLabels[priority]}\n\n${message}\n\n- Sistema ZARA\n${new Date().toLocaleString('pt-BR')}`;

      const result = await this.twilioClient.messages.create({
        body: formattedMessage,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      console.log(`SMS sent successfully to ${to}`, { sid: result.sid });
      return { success: true, sid: result.sid };

    } catch (error) {
      console.error('Failed to send SMS:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia mensagem via WhatsApp Business API
   */
  async sendWhatsApp(to, message, priority = 'MEDIUM') {
    try {
      if (!this.whatsappConfig.apiUrl || !this.whatsappConfig.accessToken) {
        console.warn('WhatsApp API not configured');
        return { success: false, error: 'WhatsApp not configured' };
      }

      const priorityEmojis = {
        URGENT: '🚨',
        HIGH: '⚠️',
        MEDIUM: 'ℹ️',
        LOW: '📝'
      };

      const priorityLabels = {
        URGENT: 'URGENTE',
        HIGH: 'ALTA',
        MEDIUM: 'MÉDIA',
        LOW: 'BAIXA'
      };

      const formattedMessage = `${priorityEmojis[priority]} *SISTEMA ZARA*\n\n*Prioridade:* ${priorityLabels[priority]}\n\n${message}\n\n_Enviado em: ${new Date().toLocaleString('pt-BR')}_`;

      const payload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''), // Remove caracteres não numéricos
        type: 'text',
        text: {
          body: formattedMessage
        }
      };

      const response = await axios.post(
        `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.whatsappConfig.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`WhatsApp message sent successfully to ${to}`, { messageId: response.data.messages[0].id });
      return { success: true, messageId: response.data.messages[0].id };

    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      return { success: false, error: error.response?.data?.error?.message || error.message };
    }
  }

  /**
   * Envia notificação para múltiplos canais baseado nas preferências do usuário
   */
  async sendMultiChannelNotification(userPreferences, notification) {
    const results = {
      email: null,
      sms: null,
      whatsapp: null
    };

    const { title, message, priority = 'MEDIUM' } = notification;
    const { email, phone, whatsapp, preferences } = userPreferences;

    // Verificar se a prioridade atende aos critérios do usuário
    const priorityLevels = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };
    const notificationLevel = priorityLevels[priority];
    const userMinLevel = priorityLevels[preferences?.minPriority || 'LOW'];

    if (notificationLevel < userMinLevel) {
      console.log(`Notification priority ${priority} below user minimum ${preferences?.minPriority}`);
      return results;
    }

    // Enviar por email se habilitado
    if (preferences?.enableEmail && email) {
      results.email = await this.sendEmail(email, title, message, priority);
    }

    // Enviar SMS se habilitado e prioridade for alta o suficiente
    if (preferences?.enableSMS && phone && notificationLevel >= priorityLevels.HIGH) {
      results.sms = await this.sendSMS(phone, `${title}\n\n${message}`, priority);
    }

    // Enviar WhatsApp se habilitado
    if (preferences?.enableWhatsApp && whatsapp) {
      results.whatsapp = await this.sendWhatsApp(whatsapp, `*${title}*\n\n${message}`, priority);
    }

    return results;
  }

  /**
   * Testa a conectividade dos serviços externos
   */
  async testConnections() {
    const results = {
      email: false,
      sms: false,
      whatsapp: false
    };

    // Testar email
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
        await this.emailTransporter.verify();
        results.email = true;
      }
    } catch (error) {
      console.error('Email connection test failed:', error);
    }

    // Testar SMS
    try {
      if (this.twilioClient) {
        await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        results.sms = true;
      }
    } catch (error) {
      console.error('SMS connection test failed:', error);
    }

    // Testar WhatsApp
    try {
      if (this.whatsappConfig.apiUrl && this.whatsappConfig.accessToken) {
        const response = await axios.get(
          `${this.whatsappConfig.apiUrl}/${this.whatsappConfig.phoneNumberId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.whatsappConfig.accessToken}`
            }
          }
        );
        results.whatsapp = response.status === 200;
      }
    } catch (error) {
      console.error('WhatsApp connection test failed:', error);
    }

    return results;
  }
}

module.exports = new ExternalNotificationService();