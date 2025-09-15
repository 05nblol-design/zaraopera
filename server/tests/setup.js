// Test setup file for Jest
// This file runs before each test suite

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.SENTRY_DSN = ''; // Disable Sentry in tests
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Mock console methods to reduce test output noise
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging test failures
});

afterAll(() => {
  // Restore original console methods
  Object.assign(console, originalConsole);
});

// Global test utilities
global.testUtils = {
  // Generate mock user data
  createMockUser: (overrides = {}) => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    active: true,
    ...overrides
  }),
  
  // Generate mock request data
  createMockRequest: (overrides = {}) => ({
    headers: {},
    ip: '127.0.0.1',
    get: jest.fn((header) => {
      const headers = {
        'user-agent': 'test-user-agent',
        'x-forwarded-for': '127.0.0.1',
        ...overrides.headers
      };
      return headers[header.toLowerCase()];
    }),
    ...overrides
  }),
  
  // Generate mock response data
  createMockResponse: () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis()
  }),
  
  // Generate mock socket data
  createMockSocket: (overrides = {}) => ({
    handshake: {
      auth: {},
      address: '127.0.0.1',
      headers: {
        'user-agent': 'test-socket-agent'
      },
      ...overrides.handshake
    },
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    ...overrides
  }),
  
  // Wait for async operations
  wait: (ms = 0) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate random test data
  randomString: (length = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  // Generate random email
  randomEmail: () => {
    const username = global.testUtils.randomString(8);
    const domain = global.testUtils.randomString(6);
    return `${username}@${domain}.com`;
  },
  
  // Generate random IP
  randomIP: () => {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }
};

// Mock external dependencies that are commonly used
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('{}'),
    mkdir: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue()
  },
  createWriteStream: jest.fn(() => ({
    write: jest.fn(),
    end: jest.fn()
  }))
}));

// Mock Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn()
}));

// Mock Winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
    DailyRotateFile: jest.fn()
  }
}));

// Global test hooks
beforeEach(() => {
  // Clear all timers before each test
  jest.clearAllTimers();
  
  // Reset Date.now mock if it exists
  if (Date.now.mockRestore) {
    Date.now.mockRestore();
  }
});

afterEach(() => {
  // Clean up any remaining timers
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Custom matchers
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = typeof received === 'string' && jwtRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false
      };
    }
  },
  
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = typeof received === 'string' && emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false
      };
    }
  },
  
  toBeValidIP(received) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const pass = typeof received === 'string' && ipRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid IP address`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid IP address`,
        pass: false
      };
    }
  }
});