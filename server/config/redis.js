const redis = require('redis');

let redisClient;
let isRedisConnected = false;
let reconnectAttempts = 0;
const MAX_REDIS_RECONNECT_ATTEMPTS = 3;
const REDIS_RECONNECT_DELAY = 3000;
let fallbackCache = new Map(); // Cache em memória como fallback

const connectRedis = async () => {
  try {
    // Verificar se já existe uma conexão ativa
    if (redisClient && redisClient.isReady) {
      console.log('✅ Redis já conectado');
      return;
    }

    console.log('🔗 Tentando conectar ao Redis...');
    
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 3000, // Timeout mais curto
        lazyConnect: true,
        reconnectStrategy: (retries) => {
          if (retries > MAX_REDIS_RECONNECT_ATTEMPTS) {
            console.warn('❌ Redis: Máximo de tentativas excedido, usando fallback');
            return false; // Para as tentativas
          }
          return Math.min(retries * 100, 1000); // Delay progressivo
        }
      },
      // Configurações para ser mais tolerante a falhas
      retry_unfulfilled_commands: true,
      enable_offline_queue: false
    });

    // Configurar eventos de forma mais robusta
    redisClient.on('error', (err) => {
      console.warn('⚠️ Redis erro (não crítico):', err.message);
      isRedisConnected = false;
      // Não tentar reconectar aqui, deixar o Redis lidar com isso
    });

    redisClient.on('connect', () => {
      console.log('🔗 Conectando ao Redis...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis conectado e pronto');
      isRedisConnected = true;
      reconnectAttempts = 0;
    });

    redisClient.on('end', () => {
      console.log('⚠️ Conexão Redis encerrada, usando fallback');
      isRedisConnected = false;
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis reconectando...');
    });

    // Tentar conectar com timeout
    const connectPromise = redisClient.connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout de conexão Redis')), 5000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    
  } catch (error) {
    console.warn('⚠️ Redis não disponível, sistema continuará com cache em memória:', error.message);
    isRedisConnected = false;
    // Não lançar erro, permitir que o sistema continue
  }
};

const getRedisClient = () => {
  return redisClient;
};

// Funções utilitárias para cache com fallback
const setCache = async (key, value, expireInSeconds = 3600) => {
  try {
    if (redisClient && redisClient.isReady && isRedisConnected) {
      await redisClient.setEx(key, expireInSeconds, JSON.stringify(value));
      return true;
    } else {
      // Fallback para cache em memória
      fallbackCache.set(key, {
        value: JSON.stringify(value),
        expiry: Date.now() + (expireInSeconds * 1000)
      });
      
      // Limpar cache expirado periodicamente
      cleanExpiredFallbackCache();
      return true;
    }
  } catch (error) {
    console.error('❌ Erro ao definir cache Redis, usando fallback:', error.message);
    
    // Fallback para cache em memória
    try {
      fallbackCache.set(key, {
        value: JSON.stringify(value),
        expiry: Date.now() + (expireInSeconds * 1000)
      });
      return true;
    } catch (fallbackError) {
      console.error('❌ Erro no cache fallback:', fallbackError.message);
      return false;
    }
  }
};

const getCache = async (key) => {
  try {
    if (redisClient && redisClient.isReady && isRedisConnected) {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } else {
      // Fallback para cache em memória
      const cached = fallbackCache.get(key);
      if (cached) {
        if (Date.now() < cached.expiry) {
          return JSON.parse(cached.value);
        } else {
          fallbackCache.delete(key);
        }
      }
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao obter cache Redis, tentando fallback:', error.message);
    
    // Fallback para cache em memória
    try {
      const cached = fallbackCache.get(key);
      if (cached) {
        if (Date.now() < cached.expiry) {
          return JSON.parse(cached.value);
        } else {
          fallbackCache.delete(key);
        }
      }
      return null;
    } catch (fallbackError) {
      console.error('❌ Erro no cache fallback:', fallbackError.message);
      return null;
    }
  }
};

const deleteCache = async (key) => {
  try {
    if (redisClient && redisClient.isReady && isRedisConnected) {
      await redisClient.del(key);
    }
    // Sempre tentar deletar do fallback também
    fallbackCache.delete(key);
  } catch (error) {
    console.error('❌ Erro ao deletar cache Redis:', error.message);
    // Tentar deletar do fallback
    try {
      fallbackCache.delete(key);
    } catch (fallbackError) {
      console.error('❌ Erro ao deletar cache fallback:', fallbackError.message);
    }
  }
};

// Função para limpar cache expirado do fallback
const cleanExpiredFallbackCache = () => {
  try {
    const now = Date.now();
    for (const [key, cached] of fallbackCache.entries()) {
      if (now >= cached.expiry) {
        fallbackCache.delete(key);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao limpar cache fallback:', error.message);
  }
};

// Limpar cache expirado a cada 5 minutos
setInterval(cleanExpiredFallbackCache, 5 * 60 * 1000);

// Função para obter status do Redis
const getRedisStatus = () => {
  return {
    isConnected: isRedisConnected,
    clientReady: redisClient ? redisClient.isReady : false,
    fallbackCacheSize: fallbackCache.size,
    reconnectAttempts
  };
};

// Função para publicar eventos em tempo real
const publishEvent = async (channel, data) => {
  try {
    if (redisClient && redisClient.isReady) {
      await redisClient.publish(channel, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Erro ao publicar evento:', error);
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
  publishEvent,
  getRedisStatus,
  isConnected: () => isRedisConnected,
  cleanExpiredFallbackCache
};