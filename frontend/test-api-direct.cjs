// Teste direto da API sem usar o frontend
const axios = require('axios');

const testLogin = async () => {
  try {
    console.log('🔍 Testando login direto na API...');
    
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@zara.com',
      password: '123456'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Login bem-sucedido!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    const token = response.data.data.accessToken;
    console.log('\n🔑 Token recebido:', token.substring(0, 50) + '...');
    
    // Testar endpoint protegido
    console.log('\n🔍 Testando endpoint protegido /api/machines...');
    const machinesResponse = await axios.get('http://localhost:3001/api/machines', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Endpoint protegido funcionando!');
    console.log('Máquinas encontradas:', machinesResponse.data.data?.length || 0);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
};

testLogin();