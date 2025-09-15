const sgMail = require('@sendgrid/mail');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.initializeSendGrid();
  }

  initializeSendGrid() {
    try {
      if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        console.log('📧 SendGrid configurado com sucesso');
      } else {
        console.warn('⚠️ SENDGRID_API_KEY não encontrada nas variáveis de ambiente');
      }
    } catch (error) {
      console.error('❌ Erro ao configurar SendGrid:', error.message);
    }
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      const msg = {
        to: Array.isArray(to) ? to : [to],
        from: {
          email: process.env.EMAIL_FROM,
          name: process.env.EMAIL_FROM_NAME || 'Zara Operação'
        },
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '') // Remove HTML tags for text version
      };

      const result = await sgMail.send(msg);
      console.log('📧 Email enviado com sucesso via SendGrid');
      return { success: true, messageId: result[0].headers['x-message-id'] };
    } catch (error) {
      console.error('❌ Erro ao enviar email via SendGrid:', error);
      return { success: false, error: error.message };
    }
  }

  async sendQualityTestAlert(testData, recipients) {
    try {
      const subject = `🚨 Alerta de Qualidade - ${testData.result === 'APPROVED' ? 'Aprovado' : 'Reprovado'}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - Alerta de Qualidade</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: ${testData.result === 'APPROVED' ? '#28a745' : '#dc3545'};">Teste ${testData.result === 'APPROVED' ? 'Aprovado' : 'Reprovado'}</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p><strong>Máquina:</strong> ${testData.machine?.name || 'N/A'}</p>
              <p><strong>Operador:</strong> ${testData.user?.name || 'N/A'}</p>
              <p><strong>Data/Hora:</strong> ${new Date(testData.createdAt).toLocaleString('pt-BR')}</p>
              <p><strong>Resultado:</strong> <span style="color: ${testData.result === 'APPROVED' ? '#28a745' : '#dc3545'}; font-weight: bold;">${testData.result === 'APPROVED' ? 'APROVADO' : 'REPROVADO'}</span></p>
              ${testData.observations ? `<p><strong>Observações:</strong> ${testData.observations}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Dashboard</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      return await this.sendEmail(recipients, subject, htmlContent);
    } catch (error) {
      console.error('❌ Erro ao enviar email de alerta:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTeflonChangeReminder(changeData, recipients) {
    try {
      const daysUntilExpiry = Math.ceil((new Date(changeData.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilExpiry <= 0;
      
      const subject = isExpired 
        ? `🚨 URGENTE: Teflon Vencido - ${changeData.machine?.name}`
        : `⚠️ Lembrete: Troca de Teflon em ${daysUntilExpiry} dias - ${changeData.machine?.name}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${isExpired ? '#dc3545' : '#ffc107'}; color: ${isExpired ? 'white' : '#212529'}; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - ${isExpired ? 'Teflon Vencido' : 'Lembrete de Troca'}</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: ${isExpired ? '#dc3545' : '#ffc107'};">Atenção Necessária</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p><strong>Máquina:</strong> ${changeData.machine?.name || 'N/A'}</p>
              <p><strong>Data da Última Troca:</strong> ${new Date(changeData.changeDate).toLocaleDateString('pt-BR')}</p>
              <p><strong>Data de Vencimento:</strong> ${new Date(changeData.expiryDate).toLocaleDateString('pt-BR')}</p>
              <p><strong>Status:</strong> <span style="color: ${isExpired ? '#dc3545' : '#ffc107'}; font-weight: bold;">${isExpired ? 'VENCIDO' : `${daysUntilExpiry} DIAS RESTANTES`}</span></p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/teflon" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Gerenciar Teflon</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      return await this.sendEmail(recipients, subject, htmlContent);
    } catch (error) {
      console.error('❌ Erro ao enviar lembrete de teflon:', error);
      return { success: false, error: error.message };
    }
  }

  async sendProductionAlert(alertData, recipients) {
    try {
      const subject = `🚨 Alerta de Produção - ${alertData.machine?.name}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - Alerta de Produção</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #dc3545;">Problema Detectado</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p><strong>Máquina:</strong> ${alertData.machine?.name || 'N/A'}</p>
              <p><strong>Tipo de Alerta:</strong> ${alertData.type || 'N/A'}</p>
              <p><strong>Prioridade:</strong> <span style="color: #dc3545; font-weight: bold;">${alertData.priority || 'N/A'}</span></p>
              <p><strong>Data/Hora:</strong> ${new Date(alertData.createdAt).toLocaleString('pt-BR')}</p>
              ${alertData.description ? `<p><strong>Descrição:</strong> ${alertData.description}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/alerts" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Alertas</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      return await this.sendEmail(recipients, subject, htmlContent);
    } catch (error) {
      console.error('❌ Erro ao enviar alerta de produção:', error);
      return { success: false, error: error.message };
    }
  }

  async sendDailyReport(reportData, recipients) {
    try {
      const subject = `📊 Relatório Diário - ${new Date().toLocaleDateString('pt-BR')}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - Relatório Diário</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #007bff;">Resumo do Dia</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
              <p><strong>Total de Testes:</strong> ${reportData.totalTests || 0}</p>
              <p><strong>Testes Aprovados:</strong> ${reportData.approvedTests || 0}</p>
              <p><strong>Testes Reprovados:</strong> ${reportData.rejectedTests || 0}</p>
              <p><strong>Taxa de Aprovação:</strong> ${reportData.approvalRate || '0'}%</p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/reports" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Relatórios</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      return await this.sendEmail(recipients, subject, htmlContent);
    } catch (error) {
      console.error('❌ Erro ao enviar relatório diário:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTestEmail(recipient) {
    try {
      const subject = '✅ Teste de Configuração SendGrid - Sistema ZARA';
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - Teste de Email</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #28a745;">Configuração Bem-sucedida!</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p>Parabéns! O SendGrid foi configurado corretamente no Sistema ZARA.</p>
              <p><strong>Data/Hora do Teste:</strong> ${new Date().toLocaleString('pt-BR')}</p>
              <p><strong>Provedor:</strong> SendGrid</p>
              <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">FUNCIONANDO</span></p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar Sistema</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      return await this.sendEmail(recipient, subject, htmlContent);
    } catch (error) {
      console.error('❌ Erro ao enviar email de teste:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();