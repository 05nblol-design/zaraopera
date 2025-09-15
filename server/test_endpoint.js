const http = require('http');

// Fazer login primeiro para obter um token válido
function login() {
  return new Promise((resolve, reject) => {
    const loginData = JSON.stringify({
      email: 'admin@zara.com',
    password: 'admin123'
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('📋 Resposta do login:', response);
           if (response.success && response.data && response.data.accessToken) {
             console.log('✅ Login realizado com sucesso!');
             resolve(response.data.accessToken);
          } else {
            console.log('❌ Erro: Login falhou:', response);
            reject(new Error('Login falhou: ' + JSON.stringify(response)));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(loginData);
    req.end();
  });
}

// Testar endpoint de configurações de qualidade
function testQualityEndpoint(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/quality-test-config/machine/1/required-tests',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log('Resposta:', data);
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Executar teste
async function runTest() {
  try {
    console.log('🔐 Fazendo login...');
    const token = await login();
    console.log('✅ Login realizado com sucesso');
    
    console.log('🔍 Testando endpoint de configurações de qualidade...');
    await testQualityEndpoint(token);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

runTest();