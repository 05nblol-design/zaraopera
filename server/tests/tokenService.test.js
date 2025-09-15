const tokenService = require('../services/tokenService');
const jwt = require('jsonwebtoken');
const auditLogger = require('../services/auditLogger');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../services/auditLogger');

describe('Token Service Tests', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    role: 'USER',
    name: 'Test User'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the refresh tokens storage
    tokenService.refreshTokens.clear();
  });

  describe('generateTokenPair', () => {
    test('should generate access and refresh tokens', () => {
      jwt.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      const result = tokenService.generateTokenPair(mockUser);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: '15m'
      });

      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(jwt.sign).toHaveBeenNthCalledWith(1, mockUser, process.env.JWT_SECRET, { expiresIn: '15m' });
      expect(jwt.sign).toHaveBeenNthCalledWith(2, { userId: mockUser.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    });

    test('should store refresh token with expiration', () => {
      jwt.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      tokenService.generateTokenPair(mockUser);

      expect(tokenService.refreshTokens.has('mock-refresh-token')).toBe(true);
      const storedData = tokenService.refreshTokens.get('mock-refresh-token');
      expect(storedData).toMatchObject({
        userId: mockUser.id,
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date)
      });
    });

    test('should log token generation', () => {
      jwt.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      tokenService.generateTokenPair(mockUser);

      expect(auditLogger.log).toHaveBeenCalledWith(
        'TOKEN_GENERATED',
        expect.objectContaining({
          userId: mockUser.id,
          tokenType: 'refresh',
          expiresIn: '7d'
        })
      );
    });
  });

  describe('refreshAccessToken', () => {
    test('should refresh access token with valid refresh token', () => {
      const refreshToken = 'valid-refresh-token';
      
      // Setup stored refresh token
      tokenService.refreshTokens.set(refreshToken, {
        userId: mockUser.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      });

      jwt.verify.mockReturnValue({ userId: mockUser.id });
      jwt.sign.mockReturnValue('new-access-token');

      const result = tokenService.refreshAccessToken(refreshToken, mockUser);

      expect(result).toEqual({
        success: true,
        accessToken: 'new-access-token',
        expiresIn: '15m'
      });

      expect(jwt.verify).toHaveBeenCalledWith(refreshToken, process.env.JWT_REFRESH_SECRET);
      expect(jwt.sign).toHaveBeenCalledWith(mockUser, process.env.JWT_SECRET, { expiresIn: '15m' });
    });

    test('should reject invalid refresh token', () => {
      jwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('invalid token');
      });

      const result = tokenService.refreshAccessToken('invalid-token', mockUser);

      expect(result).toEqual({
        success: false,
        error: 'Token de refresh inválido'
      });

      expect(auditLogger.log).toHaveBeenCalledWith(
        'TOKEN_REFRESH_FAILED',
        expect.objectContaining({
          reason: 'invalid_token'
        })
      );
    });

    test('should reject expired refresh token', () => {
      jwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired', new Date());
      });

      const result = tokenService.refreshAccessToken('expired-token', mockUser);

      expect(result).toEqual({
        success: false,
        error: 'Token de refresh expirado'
      });
    });

    test('should reject refresh token not in storage', () => {
      jwt.verify.mockReturnValue({ userId: mockUser.id });

      const result = tokenService.refreshAccessToken('not-stored-token', mockUser);

      expect(result).toEqual({
        success: false,
        error: 'Token de refresh não encontrado'
      });
    });

    test('should reject refresh token with mismatched user ID', () => {
      const refreshToken = 'valid-refresh-token';
      
      tokenService.refreshTokens.set(refreshToken, {
        userId: 999, // Different user ID
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      jwt.verify.mockReturnValue({ userId: 999 });

      const result = tokenService.refreshAccessToken(refreshToken, mockUser);

      expect(result).toEqual({
        success: false,
        error: 'Token de refresh não pertence ao usuário'
      });
    });

    test('should reject expired stored refresh token', () => {
      const refreshToken = 'expired-stored-token';
      
      tokenService.refreshTokens.set(refreshToken, {
        userId: mockUser.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      });

      jwt.verify.mockReturnValue({ userId: mockUser.id });

      const result = tokenService.refreshAccessToken(refreshToken, mockUser);

      expect(result).toEqual({
        success: false,
        error: 'Token de refresh expirado'
      });

      // Should remove expired token from storage
      expect(tokenService.refreshTokens.has(refreshToken)).toBe(false);
    });
  });

  describe('revokeRefreshToken', () => {
    test('should revoke existing refresh token', () => {
      const refreshToken = 'token-to-revoke';
      
      tokenService.refreshTokens.set(refreshToken, {
        userId: mockUser.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const result = tokenService.revokeRefreshToken(refreshToken);

      expect(result).toEqual({ success: true });
      expect(tokenService.refreshTokens.has(refreshToken)).toBe(false);
      expect(auditLogger.log).toHaveBeenCalledWith(
        'TOKEN_REVOKED',
        expect.objectContaining({
          tokenType: 'refresh'
        })
      );
    });

    test('should handle revoking non-existent token', () => {
      const result = tokenService.revokeRefreshToken('non-existent-token');

      expect(result).toEqual({ success: true }); // Should not fail
    });
  });

  describe('revokeAllUserTokens', () => {
    test('should revoke all tokens for a user', () => {
      const userId = mockUser.id;
      
      // Add multiple tokens for the user
      tokenService.refreshTokens.set('token1', {
        userId: userId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      
      tokenService.refreshTokens.set('token2', {
        userId: userId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      
      // Add token for different user
      tokenService.refreshTokens.set('token3', {
        userId: 999,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      const result = tokenService.revokeAllUserTokens(userId);

      expect(result).toEqual({ success: true, revokedCount: 2 });
      expect(tokenService.refreshTokens.has('token1')).toBe(false);
      expect(tokenService.refreshTokens.has('token2')).toBe(false);
      expect(tokenService.refreshTokens.has('token3')).toBe(true); // Different user's token should remain
    });

    test('should handle user with no tokens', () => {
      const result = tokenService.revokeAllUserTokens(999);

      expect(result).toEqual({ success: true, revokedCount: 0 });
    });
  });

  describe('cleanupExpiredTokens', () => {
    test('should remove expired tokens', () => {
      const now = Date.now();
      
      // Add expired token
      tokenService.refreshTokens.set('expired-token', {
        userId: 1,
        createdAt: new Date(now - 8 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(now - 1000) // Expired 1 second ago
      });
      
      // Add valid token
      tokenService.refreshTokens.set('valid-token', {
        userId: 2,
        createdAt: new Date(),
        expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000) // Expires in 7 days
      });

      const result = tokenService.cleanupExpiredTokens();

      expect(result).toEqual({ removedCount: 1 });
      expect(tokenService.refreshTokens.has('expired-token')).toBe(false);
      expect(tokenService.refreshTokens.has('valid-token')).toBe(true);
    });

    test('should handle cleanup with no expired tokens', () => {
      const now = Date.now();
      
      tokenService.refreshTokens.set('valid-token', {
        userId: 1,
        createdAt: new Date(),
        expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000)
      });

      const result = tokenService.cleanupExpiredTokens();

      expect(result).toEqual({ removedCount: 0 });
      expect(tokenService.refreshTokens.has('valid-token')).toBe(true);
    });
  });

  describe('getTokenStats', () => {
    test('should return token statistics', () => {
      const now = Date.now();
      
      // Add various tokens
      tokenService.refreshTokens.set('token1', {
        userId: 1,
        createdAt: new Date(now - 1000),
        expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000)
      });
      
      tokenService.refreshTokens.set('token2', {
        userId: 2,
        createdAt: new Date(now - 2000),
        expiresAt: new Date(now - 1000) // Expired
      });

      const stats = tokenService.getTokenStats();

      expect(stats).toMatchObject({
        totalTokens: 2,
        activeTokens: 1,
        expiredTokens: 1,
        uniqueUsers: 2
      });
    });

    test('should return empty stats when no tokens exist', () => {
      const stats = tokenService.getTokenStats();

      expect(stats).toEqual({
        totalTokens: 0,
        activeTokens: 0,
        expiredTokens: 0,
        uniqueUsers: 0
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle JWT signing errors gracefully', () => {
      jwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      expect(() => {
        tokenService.generateTokenPair(mockUser);
      }).toThrow('JWT signing failed');
    });

    test('should handle malformed user data', () => {
      const invalidUser = { id: null };
      
      jwt.sign
        .mockReturnValueOnce('mock-access-token')
        .mockReturnValueOnce('mock-refresh-token');

      expect(() => {
        tokenService.generateTokenPair(invalidUser);
      }).not.toThrow(); // Should handle gracefully
    });
  });

  describe('Memory Management', () => {
    test('should not exceed memory limits with many tokens', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many tokens
      for (let i = 0; i < 1000; i++) {
        tokenService.refreshTokens.set(`token-${i}`, {
          userId: i,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not use more than 10MB for 1000 tokens
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      
      // Cleanup
      tokenService.refreshTokens.clear();
    });
  });
});