const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Configuração HTTPS para produção
 * Certifique-se de ter os certificados SSL válidos
 */
class HTTPSConfig {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.httpsEnabled = process.env.HTTPS_ENABLED === 'true';
    this.certPath = process.env.SSL_CERT_PATH || './certs/cert.pem';
    this.keyPath = process.env.SSL_KEY_PATH || './certs/key.pem';
    this.caPath = process.env.SSL_CA_PATH || './certs/ca.pem';
  }

  /**
   * Verifica se os certificados SSL existem
   */
  validateCertificates() {
    if (!this.httpsEnabled) {
      console.log('📝 HTTPS desabilitado via configuração');
      return false;
    }

    try {
      if (!fs.existsSync(this.certPath)) {
        console.error('❌ Certificado SSL não encontrado:', this.certPath);
        return false;
      }

      if (!fs.existsSync(this.keyPath)) {
        console.error('❌ Chave privada SSL não encontrada:', this.keyPath);
        return false;
      }

      console.log('✅ Certificados SSL encontrados');
      return true;
    } catch (error) {
      console.error('❌ Erro ao validar certificados SSL:', error.message);
      return false;
    }
  }

  /**
   * Obtém as opções HTTPS
   */
  getHTTPSOptions() {
    if (!this.validateCertificates()) {
      return null;
    }

    try {
      const options = {
        key: fs.readFileSync(this.keyPath),
        cert: fs.readFileSync(this.certPath)
      };

      // Adicionar CA se existir (para certificados intermediários)
      if (fs.existsSync(this.caPath)) {
        options.ca = fs.readFileSync(this.caPath);
      }

      return options;
    } catch (error) {
      console.error('❌ Erro ao carregar certificados SSL:', error.message);
      return null;
    }
  }

  /**
   * Cria servidor HTTPS
   */
  createHTTPSServer(app) {
    const httpsOptions = this.getHTTPSOptions();
    
    if (!httpsOptions) {
      console.log('⚠️ Usando HTTP em vez de HTTPS (certificados não disponíveis)');
      return null;
    }

    console.log('🔒 Criando servidor HTTPS...');
    return https.createServer(httpsOptions, app);
  }

  /**
   * Middleware para redirecionar HTTP para HTTPS
   */
  redirectToHTTPS() {
    return (req, res, next) => {
      if (this.isProduction && this.httpsEnabled && !req.secure && req.get('x-forwarded-proto') !== 'https') {
        const httpsUrl = `https://${req.get('host')}${req.url}`;
        console.log(`🔄 Redirecionando para HTTPS: ${httpsUrl}`);
        return res.redirect(301, httpsUrl);
      }
      next();
    };
  }

  /**
   * Headers de segurança HTTPS
   */
  getSecurityHeaders() {
    return {
      // Força HTTPS por 1 ano
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      // Previne ataques de downgrade
      'Upgrade-Insecure-Requests': '1',
      // Política de referrer segura
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
  }
}

module.exports = HTTPSConfig;