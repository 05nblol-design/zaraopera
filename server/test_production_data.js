const http = require('http');

// Função para fazer login e obter token
function testServer() {
  const loginData = JSON.stringify({
    email: 'admin@admin.com',
    password: 'admin123'
  });

  const loginOptions = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };

  const loginReq = http.request(loginOptions, (res) => {
    console.log(`✅ Servidor respondeu com status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('📊 Resposta do login:', JSON.stringify(response, null, 2));
        
        if (response.success && response.data && response.data.accessToken) {
          console.log('✅ Login realizado com sucesso!');
          testProductionData(response.data.accessToken);
        } else {
          console.log('❌ Falha no login');
        }
      } catch (error) {
        console.error('❌ Erro ao processar resposta do login:', error.message);
      }
    });
  });

  loginReq.on('error', (error) => {
    console.error('❌ Erro de conexão:', error.message);
  });

  loginReq.write(loginData);
  loginReq.end();
}

// Função para testar dados de produção
function testProductionData(token) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/machines/1/production-count',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`\n📊 Status da resposta de produção: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('📊 Dados de produção:', JSON.stringify(response, null, 2));
      } catch (error) {
        console.error('❌ Erro ao processar resposta de produção:', error.message);
        console.log('📄 Resposta bruta:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Erro ao testar dados de produção:', error.message);
  });

  req.end();
}

console.log('🔍 Testando dados de produção...');
testServer();