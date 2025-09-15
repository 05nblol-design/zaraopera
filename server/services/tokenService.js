const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');

class TokenService {
  constructor() {
    // Tokens sem limite de tempo conforme solicitado
    this.accessTokenExpiry = null; // Sem expiração
    this.refreshTokenExpiry = null; // Sem expiração
    this.refreshTokens = new Map(); // Em produção, usar Redis
  }

  /**
   * Gerar par de tokens (access + refresh)
   */
  async generateTokenPair(user) {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    try {
      console.log(`🔑 [${requestId}] Gerando par de tokens para usuário:`, {
        id: user.id,
        email: user.email,
        role: user.role
      });

      // Payload do access token
      const accessPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
        requestId
      };

      // Gerar access token (sem expiração)
      const accessToken = jwt.sign(
        accessPayload,
        process.env.JWT_SECRET,
        { 
          // Removido expiresIn para token sem limite de tempo
          issuer: 'zara-system',
          audience: 'zara-client'
        }
      );

      // Gerar refresh token
      const refreshTokenId = crypto.randomBytes(32).toString('hex');
      const refreshPayload = {
        id: user.id,
        tokenId: refreshTokenId,
        type: 'refresh',
        requestId
      };

      const refreshToken = jwt.sign(
        refreshPayload,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { 
          // Removido expiresIn para token sem limite de tempo
          issuer: 'zara-system',
          audience: 'zara-client'
        }
      );

      // Armazenar refresh token no banco/cache
      await this.storeRefreshToken(user.id, refreshTokenId, refreshToken);

      // Log de auditoria
      console.log(`🔑 [${requestId}] ✅ Tokens gerados com sucesso (sem expiração):`, {
        userId: user.id,
        noExpiration: true,
        refreshTokenId: refreshTokenId.substring(0, 8) + '...',
        timestamp: new Date().toISOString()
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: null, // Sem expiração
        tokenType: 'Bearer'
      };

    } catch (error) {
      console.error(`🔑 [${requestId}] ❌ Erro ao gerar tokens:`, {
        error: error.message,
        userId: user.id,
        stack: error.stack?.split('\n')[0]
      });
      throw new Error('Erro ao gerar tokens de autenticação');
    }
  }

  /**
   * Renovar access token usando refresh token
   */
  async refreshAccessToken(refreshToken) {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    try {
      console.log(`🔄 [${requestId}] Renovando access token...`);

      // Verificar refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );

      if (decoded.type !== 'refresh') {
        throw new Error('Token inválido para renovação');
      }

      // Verificar se refresh token existe no armazenamento
      const storedToken = await this.getRefreshToken(decoded.id, decoded.tokenId);
      if (!storedToken) {
        console.log(`🔄 [${requestId}] ❌ Refresh token não encontrado no armazenamento`);
        throw new Error('Refresh token inválido ou expirado');
      }

      // Buscar dados atualizados do usuário
      const userResult = await pool.query(
        'SELECT id, name, email, role, "is_active" FROM users WHERE id = $1',
        [decoded.id]
      );
      
      const user = userResult.rows[0];
      if (!user || !user.is_active) {
        console.log(`🔄 [${requestId}] ❌ Usuário inativo ou não encontrado`);
        throw new Error('Usuário inativo');
      }

      // Converter is_active para isActive para compatibilidade
      user.isActive = user.is_active;

      // Gerar novo access token
      const accessPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        type: 'access',
        requestId
      };

      const newAccessToken = jwt.sign(
        accessPayload,
        process.env.JWT_SECRET,
        { 
          // Removido expiresIn para token sem limite de tempo
          issuer: 'zara-system',
          audience: 'zara-client'
        }
      );

      console.log(`🔄 [${requestId}] ✅ Access token renovado (sem expiração):`, {
        userId: user.id,
        email: user.email,
        noExpiration: true
      });

      return {
        accessToken: newAccessToken,
        expiresIn: null, // Sem expiração
        tokenType: 'Bearer'
      };

    } catch (error) {
      console.error(`🔄 [${requestId}] ❌ Erro ao renovar token:`, {
        error: error.message,
        name: error.name,
        stack: error.stack?.split('\n')[0]
      });
      
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Refresh token malformado');
      }
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expirado');
      }
      
      throw error;
    }
  }

  /**
   * Invalidar refresh token (logout)
   */
  async revokeRefreshToken(refreshToken) {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    try {
      console.log(`🚪 [${requestId}] Revogando refresh token...`);

      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { ignoreExpiration: true } // Permitir revogar tokens expirados
      );

      await this.removeRefreshToken(decoded.id, decoded.tokenId);
      
      console.log(`🚪 [${requestId}] ✅ Refresh token revogado:`, {
        userId: decoded.id,
        tokenId: decoded.tokenId?.substring(0, 8) + '...'
      });

      return true;
    } catch (error) {
      console.error(`🚪 [${requestId}] ❌ Erro ao revogar token:`, error.message);
      return false;
    }
  }

  /**
   * Invalidar todos os refresh tokens de um usuário
   */
  async revokeAllUserTokens(userId) {
    const requestId = Math.random().toString(36).substr(2, 9);
    
    try {
      console.log(`🚪 [${requestId}] Revogando todos os tokens do usuário:`, userId);
      
      // Remover do cache/mapa
      for (const [key, value] of this.refreshTokens.entries()) {
        if (value.userId === userId) {
          this.refreshTokens.delete(key);
        }
      }
      
      // Em produção, remover do Redis/banco
      // await redis.del(`refresh_tokens:${userId}:*`);
      
      console.log(`🚪 [${requestId}] ✅ Todos os tokens revogados para usuário:`, userId);
      return true;
    } catch (error) {
      console.error(`🚪 [${requestId}] ❌ Erro ao revogar todos os tokens:`, error.message);
      return false;
    }
  }

  /**
   * Armazenar refresh token
   */
  async storeRefreshToken(userId, tokenId, token) {
    const key = `${userId}:${tokenId}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    
    this.refreshTokens.set(key, {
      userId,
      tokenId,
      token,
      createdAt: new Date(),
      expiresAt
    });
    
    // Em produção, usar Redis:
    // await redis.setex(`refresh_token:${key}`, 7 * 24 * 60 * 60, token);
  }

  /**
   * Recuperar refresh token
   */
  async getRefreshToken(userId, tokenId) {
    const key = `${userId}:${tokenId}`;
    const stored = this.refreshTokens.get(key);
    
    if (!stored) return null;
    
    // Verificar expiração
    if (stored.expiresAt < new Date()) {
      this.refreshTokens.delete(key);
      return null;
    }
    
    return stored;
  }

  /**
   * Remover refresh token
   */
  async removeRefreshToken(userId, tokenId) {
    const key = `${userId}:${tokenId}`;
    this.refreshTokens.delete(key);
    
    // Em produção, usar Redis:
    // await redis.del(`refresh_token:${key}`);
  }

  /**
   * Limpar tokens expirados (executar periodicamente)
   */
  async cleanupExpiredTokens() {
    const now = new Date();
    let cleaned = 0;
    
    for (const [key, value] of this.refreshTokens.entries()) {
      if (value.expiresAt < now) {
        this.refreshTokens.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Limpeza de tokens: ${cleaned} tokens expirados removidos`);
    }
    
    return cleaned;
  }

  /**
   * Verificar se access token está próximo do vencimento
   */
  isTokenNearExpiry(token, thresholdMinutes = 5) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return false;
      
      const expirationTime = decoded.exp * 1000;
      const thresholdTime = Date.now() + (thresholdMinutes * 60 * 1000);
      
      return expirationTime <= thresholdTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obter informações do token sem verificar assinatura
   */
  getTokenInfo(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }
}

// Instância singleton
const tokenService = new TokenService();

// Limpeza automática de tokens expirados a cada hora
setInterval(() => {
  tokenService.cleanupExpiredTokens();
}, 60 * 60 * 1000);

module.exports = tokenService;