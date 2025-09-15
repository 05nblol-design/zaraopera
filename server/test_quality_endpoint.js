const http = require('http');

function testServer() {
  console.log('🔍 Testando conectividade com o servidor...');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const postData = JSON.stringify({
    email: 'admin@zara.com',
    password: 'admin123'
  });
  
  const req = http.request(options, (res) => {
    console.log(`✅ Servidor respondeu com status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
         const response = JSON.parse(data);
         if (response.data && response.data.accessToken) {
           console.log('✅ Login realizado com sucesso');
           testQualityEndpoint(response.data.accessToken);
         } else {
           console.log('❌ Falha no login:', response);
         }
      } catch (error) {
        console.error('❌ Erro ao processar resposta:', error.message);
        console.log('Resposta bruta:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Erro de conexão:', error.message);
  });
  
  req.write(postData);
  req.end();
}

function testQualityEndpoint(token) {
  console.log('🔍 Testando endpoint de configurações de qualidade...');
  
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
    console.log(`Status do endpoint: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('✅ Resposta do endpoint:');
        console.log(JSON.stringify(response, null, 2));
      } catch (error) {
        console.error('❌ Erro ao processar resposta:', error.message);
        console.log('Resposta bruta:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Erro ao testar endpoint:', error.message);
  });
  
  req.end();
}

testServer();