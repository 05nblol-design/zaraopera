const { Pool } = require('pg');

// Configuração específica para testes de integração
const testDbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME_TEST || 'zara_test',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const testPool = new Pool(testDbConfig);

// Função para criar usuário de teste
async function createTestUser() {
  const hashedPassword = 'testpassword123';
  
  const result = await testPool.query(
    `INSERT INTO users (email, password, name, role, created_at, updated_at) 
     VALUES ($1, $2, $3, $4, NOW(), NOW()) 
     ON CONFLICT (email) DO UPDATE SET 
       password = EXCLUDED.password,
       updated_at = NOW()
     RETURNING *`,
    ['test@empresa.com', hashedPassword, 'Usuário Teste Empresarial', 'USER']
  );
  
  return result.rows[0];
}

// Função para limpar dados de teste
async function cleanupTestData() {
  try {
    // Limpar logs de auditoria de teste
    await testPool.query(
      "DELETE FROM auth_logs WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%test%')"
    );
    
    // Limpar usuários de teste
    await testPool.query(
      "DELETE FROM users WHERE email LIKE '%test%' OR email LIKE '%empresa%'"
    );
    
    console.log('🧹 Dados de teste limpos com sucesso');
  } catch (error) {
    console.error('❌ Erro ao limpar dados de teste:', error.message);
  }
}

// Função para verificar conexão com banco de teste
async function testDatabaseConnection() {
  try {
    const result = await testPool.query('SELECT NOW() as current_time');
    console.log('✅ Conexão com banco de teste estabelecida:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão com banco de teste:', error.message);
    return false;
  }
}

// Função para criar tabelas necessárias se não existirem
async function ensureTestTables() {
  try {
    // Criar tabela de usuários se não existir
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'USER',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Criar tabela de logs de auditoria se não existir
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS auth_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        success BOOLEAN NOT NULL,
        ip_address INET,
        user_agent TEXT,
        error_message TEXT,
        processing_time INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Criar índices para performance
    await testPool.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_auth_logs_success ON auth_logs(success);
    `);
    
    console.log('📋 Tabelas de teste verificadas/criadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao criar tabelas de teste:', error.message);
    throw error;
  }
}

// Função para setup completo do ambiente de teste
async function setupTestEnvironment() {
  console.log('🚀 Configurando ambiente de teste empresarial...');
  
  const isConnected = await testDatabaseConnection();
  if (!isConnected) {
    throw new Error('Não foi possível conectar ao banco de dados de teste');
  }
  
  await ensureTestTables();
  await cleanupTestData();
  
  console.log('✅ Ambiente de teste configurado com sucesso');
}

// Função para teardown do ambiente de teste
async function teardownTestEnvironment() {
  console.log('🧹 Limpando ambiente de teste...');
  
  await cleanupTestData();
  await testPool.end();
  
  console.log('✅ Ambiente de teste limpo com sucesso');
}

module.exports = {
  testPool,
  createTestUser,
  cleanupTestData,
  testDatabaseConnection,
  ensureTestTables,
  setupTestEnvironment,
  teardownTestEnvironment
};