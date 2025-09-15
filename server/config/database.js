const { Pool } = require('pg');

// Configuração do pool PostgreSQL com tratamento de erros
let pool;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

const createPool = () => {
  try {
    // Configuração para Railway (usando DATABASE_URL) ou desenvolvimento local
    const config = process.env.DATABASE_URL ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    } : {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'zara_operacao',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 5432,
      ssl: false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
    
    pool = new Pool(config);
    return pool;
  } catch (error) {
    console.error('❌ Erro ao criar pool PostgreSQL:', error.message);
    throw error;
  }
};

// Inicializar pool
try {
  pool = createPool();
} catch (error) {
  console.error('❌ Falha crítica ao inicializar PostgreSQL:', error.message);
  process.exit(1);
}

// Event listeners para monitoramento e recuperação
pool.on('connect', (client) => {
  console.log('📊 PostgreSQL conectado');
  isConnected = true;
  reconnectAttempts = 0;
});

pool.on('error', async (err, client) => {
  console.error('❌ Erro na conexão PostgreSQL:', err.message);
  isConnected = false;
  
  // Tentar reconectar automaticamente
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
    
    setTimeout(async () => {
      try {
        await testConnection();
      } catch (error) {
        console.error('❌ Falha na reconexão:', error.message);
      }
    }, RECONNECT_DELAY);
  } else {
    console.error('❌ Máximo de tentativas de reconexão atingido');
  }
});

pool.on('end', () => {
  console.log('⚠️ Pool PostgreSQL encerrado');
  isConnected = false;
});

// Função para testar conexão com retry
const testConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ Teste de conexão PostgreSQL bem-sucedido');
      client.release();
      isConnected = true;
      return true;
    } catch (error) {
      console.error(`❌ Erro ao testar conexão PostgreSQL (tentativa ${i + 1}/${retries}):`, error.message);
      isConnected = false;
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  return false;
};

// Função para executar query com fallback
const executeQuery = async (text, params = []) => {
  if (!isConnected) {
    const reconnected = await testConnection();
    if (!reconnected) {
      throw new Error('Banco de dados indisponível');
    }
  }
  
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Erro ao executar query:', error.message);
    
    // Tentar reconectar e executar novamente
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      console.log('🔄 Tentando reconectar e executar query novamente...');
      const reconnected = await testConnection();
      if (reconnected) {
        return await pool.query(text, params);
      }
    }
    
    throw error;
  }
};

// Função para obter status da conexão
const getConnectionStatus = () => {
  return {
    isConnected,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
};

// Função para conectar (compatibilidade com código existente)
const connectDB = async () => {
  await testConnection();
};

module.exports = pool;
module.exports.connectDB = connectDB;
module.exports.executeQuery = executeQuery;
module.exports.testConnection = testConnection;
module.exports.getConnectionStatus = getConnectionStatus;
module.exports.isConnected = () => isConnected;