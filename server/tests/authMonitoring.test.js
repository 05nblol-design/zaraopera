const authMonitoring = require('../services/authMonitoring');
const auditLogger = require('../services/auditLogger');

// Mock dependencies
jest.mock('../services/auditLogger');

describe('Authentication Monitoring Tests', () => {
  const mockIP = '192.168.1.100';
  const mockUserAgent = 'Mozilla/5.0 Test Browser';
  const mockRequestId = 'test-request-123';

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear monitoring data
    authMonitoring.failedAttempts.clear();
    authMonitoring.blockedIPs.clear();
    authMonitoring.suspiciousActivity.clear();
  });

  describe('logFailedAttempt', () => {
    test('should log failed login attempt', () => {
      const attemptData = {
        ip: mockIP,
        userAgent: mockUserAgent,
        requestId: mockRequestId,
        email: 'test@example.com',
        reason: 'invalid_password'
      };

      authMonitoring.logFailedAttempt(attemptData);

      expect(auditLogger.log).toHaveBeenCalledWith(
        'AUTH_FAILURE',
        expect.objectContaining({
          ip: mockIP,
          userAgent: mockUserAgent,
          requestId: mockRequestId,
          email: 'test@example.com',
          reason: 'invalid_password',
          timestamp: expect.any(Date)
        })
      );
    });

    test('should track failed attempts by IP', () => {
      const attemptData = {
        ip: mockIP,
        userAgent: mockUserAgent,
        requestId: mockRequestId,
        reason: 'invalid_password'
      };

      authMonitoring.logFailedAttempt(attemptData);
      authMonitoring.logFailedAttempt(attemptData);
      authMonitoring.logFailedAttempt(attemptData);

      const ipData = authMonitoring.failedAttempts.get(mockIP);
      expect(ipData.count).toBe(3);
      expect(ipData.attempts).toHaveLength(3);
      expect(ipData.firstAttempt).toBeInstanceOf(Date);
      expect(ipData.lastAttempt).toBeInstanceOf(Date);
    });

    test('should block IP after maximum failed attempts', () => {
      const attemptData = {
        ip: mockIP,
        userAgent: mockUserAgent,
        requestId: mockRequestId,
        reason: 'invalid_password'
      };

      // Simulate 5 failed attempts (default threshold)
      for (let i = 0; i < 5; i++) {
        authMonitoring.logFailedAttempt(attemptData);
      }

      expect(authMonitoring.blockedIPs.has(mockIP)).toBe(true);
      expect(auditLogger.log).toHaveBeenCalledWith(
        'IP_BLOCKED',
        expect.objectContaining({
          ip: mockIP,
          reason: 'max_failed_attempts',
          failedAttempts: 5
        })
      );
    });

    test('should detect suspicious activity patterns', () => {
      const baseAttempt = {
        ip: mockIP,
        userAgent: mockUserAgent,
        requestId: mockRequestId
      };

      // Simulate rapid failed attempts (suspicious pattern)
      for (let i = 0; i < 10; i++) {
        authMonitoring.logFailedAttempt({
          ...baseAttempt,
          email: `user${i}@example.com`,
          reason: 'invalid_password'
        });
      }

      expect(authMonitoring.suspiciousActivity.has(mockIP)).toBe(true);
      expect(auditLogger.log).toHaveBeenCalledWith(
        'SUSPICIOUS_ACTIVITY',
        expect.objectContaining({
          ip: mockIP,
          pattern: 'rapid_failed_attempts',
          details: expect.objectContaining({
            attemptCount: 10,
            timeWindow: expect.any(Number)
          })
        })
      );
    });
  });

  describe('logSuccessfulLogin', () => {
    test('should log successful login and clear failed attempts', () => {
      const loginData = {
        ip: mockIP,
        userAgent: mockUserAgent,
        requestId: mockRequestId,
        userId: 1,
        email: 'test@example.com'
      };

      // First add some failed attempts
      authMonitoring.logFailedAttempt({
        ip: mockIP,
        userAgent: mockUserAgent,
        requestId: 'failed-request',
        reason: 'invalid_password'
      });

      expect(authMonitoring.failedAttempts.has(mockIP)).toBe(true);

      // Then log successful login
      authMonitoring.logSuccessfulLogin(loginData);

      expect(auditLogger.log).toHaveBeenCalledWith(
        'AUTH_SUCCESS',
        expect.objectContaining({
          ip: mockIP,
          userAgent: mockUserAgent,
          requestId: mockRequestId,
          userId: 1,
          email: 'test@example.com',
          timestamp: expect.any(Date)
        })
      );

      // Failed attempts should be cleared
      expect(authMonitoring.failedAttempts.has(mockIP)).toBe(false);
    });

    test('should detect unusual login patterns', () => {
      const loginData = {
        ip: '10.0.0.1', // Different IP
        userAgent: 'Different User Agent',
        requestId: mockRequestId,
        userId: 1,
        email: 'test@example.com'
      };

      // Log login from unusual location
      authMonitoring.logSuccessfulLogin(loginData);

      expect(auditLogger.log).toHaveBeenCalledWith(
        'UNUSUAL_LOGIN',
        expect.objectContaining({
          userId: 1,
          ip: '10.0.0.1',
          reason: 'new_location_or_device'
        })
      );
    });
  });

  describe('isIPBlocked', () => {
    test('should return false for non-blocked IP', () => {
      expect(authMonitoring.isIPBlocked(mockIP)).toBe(false);
    });

    test('should return true for blocked IP', () => {
      // Block the IP
      authMonitoring.blockedIPs.set(mockIP, {
        blockedAt: new Date(),
        reason: 'max_failed_attempts',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      });

      expect(authMonitoring.isIPBlocked(mockIP)).toBe(true);
    });

    test('should return false for expired block', () => {
      // Block the IP with past expiration
      authMonitoring.blockedIPs.set(mockIP, {
        blockedAt: new Date(Date.now() - 20 * 60 * 1000),
        reason: 'max_failed_attempts',
        expiresAt: new Date(Date.now() - 5 * 60 * 1000) // Expired 5 minutes ago
      });

      expect(authMonitoring.isIPBlocked(mockIP)).toBe(false);
      // Should also remove expired block
      expect(authMonitoring.blockedIPs.has(mockIP)).toBe(false);
    });
  });

  describe('unblockIP', () => {
    test('should unblock IP and log action', () => {
      // First block the IP
      authMonitoring.blockedIPs.set(mockIP, {
        blockedAt: new Date(),
        reason: 'max_failed_attempts',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });

      const result = authMonitoring.unblockIP(mockIP, 'admin_action');

      expect(result).toEqual({ success: true });
      expect(authMonitoring.blockedIPs.has(mockIP)).toBe(false);
      expect(auditLogger.log).toHaveBeenCalledWith(
        'IP_UNBLOCKED',
        expect.objectContaining({
          ip: mockIP,
          reason: 'admin_action'
        })
      );
    });

    test('should handle unblocking non-blocked IP', () => {
      const result = authMonitoring.unblockIP(mockIP, 'admin_action');

      expect(result).toEqual({ success: true, message: 'IP was not blocked' });
    });
  });

  describe('getSecurityStats', () => {
    test('should return comprehensive security statistics', () => {
      // Add some test data
      authMonitoring.failedAttempts.set('192.168.1.1', {
        count: 3,
        attempts: [new Date(), new Date(), new Date()],
        firstAttempt: new Date(),
        lastAttempt: new Date()
      });

      authMonitoring.blockedIPs.set('192.168.1.2', {
        blockedAt: new Date(),
        reason: 'max_failed_attempts',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });

      authMonitoring.suspiciousActivity.set('192.168.1.3', {
        detectedAt: new Date(),
        pattern: 'rapid_failed_attempts',
        severity: 'high'
      });

      const stats = authMonitoring.getSecurityStats();

      expect(stats).toMatchObject({
        failedAttempts: {
          totalIPs: 1,
          totalAttempts: 3,
          recentAttempts: expect.any(Number)
        },
        blockedIPs: {
          total: 1,
          active: 1,
          expired: 0
        },
        suspiciousActivity: {
          total: 1,
          highSeverity: 1,
          mediumSeverity: 0,
          lowSeverity: 0
        },
        summary: {
          securityLevel: expect.any(String),
          activeThreats: expect.any(Number),
          recommendedActions: expect.any(Array)
        }
      });
    });

    test('should return empty stats when no data exists', () => {
      const stats = authMonitoring.getSecurityStats();

      expect(stats.failedAttempts.totalIPs).toBe(0);
      expect(stats.blockedIPs.total).toBe(0);
      expect(stats.suspiciousActivity.total).toBe(0);
      expect(stats.summary.securityLevel).toBe('LOW');
    });
  });

  describe('cleanupExpiredData', () => {
    test('should remove expired blocks and old failed attempts', () => {
      const now = Date.now();
      
      // Add expired block
      authMonitoring.blockedIPs.set('expired-ip', {
        blockedAt: new Date(now - 20 * 60 * 1000),
        reason: 'max_failed_attempts',
        expiresAt: new Date(now - 5 * 60 * 1000) // Expired
      });

      // Add active block
      authMonitoring.blockedIPs.set('active-ip', {
        blockedAt: new Date(),
        reason: 'max_failed_attempts',
        expiresAt: new Date(now + 15 * 60 * 1000) // Active
      });

      // Add old failed attempts
      authMonitoring.failedAttempts.set('old-ip', {
        count: 2,
        attempts: [
          new Date(now - 25 * 60 * 1000), // 25 minutes ago
          new Date(now - 20 * 60 * 1000)  // 20 minutes ago
        ],
        firstAttempt: new Date(now - 25 * 60 * 1000),
        lastAttempt: new Date(now - 20 * 60 * 1000)
      });

      const result = authMonitoring.cleanupExpiredData();

      expect(result.expiredBlocks).toBe(1);
      expect(result.cleanedFailedAttempts).toBe(1);
      expect(authMonitoring.blockedIPs.has('expired-ip')).toBe(false);
      expect(authMonitoring.blockedIPs.has('active-ip')).toBe(true);
      expect(authMonitoring.failedAttempts.has('old-ip')).toBe(false);
    });
  });

  describe('Security Patterns Detection', () => {
    test('should detect brute force attacks', () => {
      const baseAttempt = {
        ip: mockIP,
        userAgent: mockUserAgent,
        requestId: mockRequestId,
        email: 'target@example.com'
      };

      // Simulate brute force attack (same email, many attempts)
      for (let i = 0; i < 20; i++) {
        authMonitoring.logFailedAttempt({
          ...baseAttempt,
          reason: 'invalid_password'
        });
      }

      expect(auditLogger.log).toHaveBeenCalledWith(
        'SUSPICIOUS_ACTIVITY',
        expect.objectContaining({
          pattern: 'brute_force_attack',
          details: expect.objectContaining({
            targetEmail: 'target@example.com'
          })
        })
      );
    });

    test('should detect credential stuffing', () => {
      const baseAttempt = {
        ip: mockIP,
        userAgent: mockUserAgent,
        requestId: mockRequestId,
        reason: 'invalid_password'
      };

      // Simulate credential stuffing (many different emails)
      for (let i = 0; i < 15; i++) {
        authMonitoring.logFailedAttempt({
          ...baseAttempt,
          email: `user${i}@example.com`
        });
      }

      expect(auditLogger.log).toHaveBeenCalledWith(
        'SUSPICIOUS_ACTIVITY',
        expect.objectContaining({
          pattern: 'credential_stuffing',
          details: expect.objectContaining({
            uniqueEmails: 15
          })
        })
      );
    });
  });

  describe('Performance Tests', () => {
    test('should handle high volume of failed attempts efficiently', () => {
      const startTime = Date.now();
      
      // Simulate 1000 failed attempts
      for (let i = 0; i < 1000; i++) {
        authMonitoring.logFailedAttempt({
          ip: `192.168.1.${i % 255}`,
          userAgent: mockUserAgent,
          requestId: `request-${i}`,
          email: `user${i}@example.com`,
          reason: 'invalid_password'
        });
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process 1000 attempts within 1 second
      expect(processingTime).toBeLessThan(1000);
    });

    test('should maintain reasonable memory usage', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Add many failed attempts
      for (let i = 0; i < 5000; i++) {
        authMonitoring.logFailedAttempt({
          ip: `10.0.${Math.floor(i / 255)}.${i % 255}`,
          userAgent: mockUserAgent,
          requestId: `request-${i}`,
          email: `user${i}@example.com`,
          reason: 'invalid_password'
        });
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not use more than 50MB for 5000 attempts
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed attempt data gracefully', () => {
      expect(() => {
        authMonitoring.logFailedAttempt(null);
      }).not.toThrow();

      expect(() => {
        authMonitoring.logFailedAttempt({});
      }).not.toThrow();

      expect(() => {
        authMonitoring.logFailedAttempt({ ip: null });
      }).not.toThrow();
    });

    test('should handle audit logger failures gracefully', () => {
      auditLogger.log.mockImplementation(() => {
        throw new Error('Audit logger failed');
      });

      expect(() => {
        authMonitoring.logFailedAttempt({
          ip: mockIP,
          userAgent: mockUserAgent,
          requestId: mockRequestId,
          reason: 'invalid_password'
        });
      }).not.toThrow();
    });
  });
});