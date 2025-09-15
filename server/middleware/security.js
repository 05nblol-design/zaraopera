const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

// Rate limiting para diferentes endpoints
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      console.log(`🚨 Rate limit excedido:`, {
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
      
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString(),
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Rate limits específicos
// Rate limiting para autenticação - TEMPORARIAMENTE DESABILITADO
const authRateLimit = (req, res, next) => next(); // Desabilitado
/*
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // 5 tentativas em produção, 100 em desenvolvimento
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚨 Rate limit excedido para IP: ${req.ip} na rota de autenticação`);
    res.status(429).json({
      success: false,
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      retryAfter: 15 * 60
    });
  },
  skip: (req) => {
    // Pular rate limiting em desenvolvimento para IPs locais
    if (process.env.NODE_ENV === 'development' && 
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.startsWith('192.168.'))) {
      console.log('⚠️ Auth Rate limiting pulado para desenvolvimento');
      return true;
    }
    return false;
  }
});
*/

// const authRateLimit = createRateLimit(
//   15 * 60 * 1000, // 15 minutos
//   10, // máximo 10 tentativas (aumentado para desenvolvimento)
//   'Muitas tentativas de login. Tente novamente em 15 minutos.',
//   true // não contar requests bem-sucedidos
// );

// Rate limiting para API geral - TEMPORARIAMENTE DESABILITADO
const apiRateLimit = (req, res, next) => next(); // Desabilitado
/*
const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 100 requests em produção, 1000 em desenvolvimento
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em alguns minutos.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚨 Rate limit excedido para IP: ${req.ip} na API`);
    res.status(429).json({
      success: false,
      message: 'Muitas requisições. Tente novamente em alguns minutos.',
      retryAfter: 15 * 60
    });
  },
  skip: (req) => {
    // Pular rate limiting em desenvolvimento para IPs locais
    if (process.env.NODE_ENV === 'development' && 
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.startsWith('192.168.'))) {
      return true;
    }
    return false;
  }
});
*/

// Rate limiting rigoroso para operações sensíveis - TEMPORARIAMENTE DESABILITADO
const strictRateLimit = (req, res, next) => next(); // Desabilitado
/*
const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === 'production' ? 10 : 50, // 10 requests em produção, 50 em desenvolvimento
  message: {
    success: false,
    message: 'Limite de requisições excedido para operações sensíveis.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`🚨 Strict rate limit excedido para IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Limite de requisições excedido para operações sensíveis.',
      retryAfter: 15 * 60
    });
  },
  skip: (req) => {
    // Pular rate limiting em desenvolvimento para IPs locais
    if (process.env.NODE_ENV === 'development' && 
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.startsWith('192.168.'))) {
      return true;
    }
    return false;
  }
});
*/

// Configuração CORS empresarial
const corsOptions = {
  origin: function (origin, callback) {
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://ecf9e2254007.ngrok-free.app', // URL do ngrok
      'https://understanding-sequence-prep-laden.trycloudflare.com',
      'https://hanging-personality-counts-obtain.trycloudflare.com',
      process.env.CLIENT_URL,
      process.env.FRONTEND_URL,
      process.env.CORS_ORIGIN,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
    ].filter(Boolean);

    // Em desenvolvimento, permitir qualquer origem
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Permitir requisições sem origin (ex: mobile apps, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Verificar se a origem está na lista permitida ou se é um domínio Vercel
    if (allowedOrigins.includes(origin) || (origin && origin.includes('.vercel.app'))) {
      callback(null, true);
    } else {
      console.log(`🚨 Origem CORS rejeitada: ${origin}`);
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Request-ID'
  ],
  exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
  maxAge: 86400 // 24 horas
};

// Headers de segurança empresarial
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false, // Pode causar problemas com WebSockets
  hsts: {
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true
  }
});

// Middleware para adicionar headers customizados
const customSecurityHeaders = (req, res, next) => {
  // Request ID para rastreamento
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9);
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Headers de segurança adicionais
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remover headers que expõem informações do servidor
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

// Middleware para log de segurança
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log da requisição
  console.log(`🔒 [${req.requestId}] ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']?.substring(0, 100),
    referer: req.headers.referer,
    timestamp: new Date().toISOString()
  });
  
  // Interceptar a resposta para log
  const originalSend = res.send;
  res.send = function(data) {
    const processingTime = Date.now() - startTime;
    
    // Log apenas se for erro ou request sensível
    if (res.statusCode >= 400 || req.originalUrl.includes('/auth/')) {
      console.log(`🔒 [${req.requestId}] Response:`, {
        status: res.statusCode,
        processingTime: `${processingTime}ms`,
        contentLength: data?.length || 0
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Middleware para detectar ataques comuns
const attackDetection = (req, res, next) => {
  const suspiciousPatterns = [
    /(<script[^>]*>.*?<\/script>)/gi, // XSS
    /(union.*select|select.*from|insert.*into|delete.*from)/gi, // SQL Injection
    /(\.\.[\/\\])/g, // Path Traversal
    /(eval\(|setTimeout\(|setInterval\()/gi, // Code Injection
  ];
  
  const checkString = JSON.stringify({
    url: req.originalUrl,
    query: req.query,
    body: req.body,
    params: req.params
  });
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      console.log(`🚨 ATAQUE DETECTADO [${req.requestId}]:`, {
        pattern: pattern.toString(),
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
      
      return res.status(400).json({
        error: 'Requisição suspeita detectada',
        code: 'SUSPICIOUS_REQUEST',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    }
  }
  
  next();
};

module.exports = {
  authRateLimit,
  apiRateLimit,
  strictRateLimit,
  corsOptions,
  securityHeaders,
  customSecurityHeaders,
  securityLogger,
  attackDetection
};