import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const TestLogin = () => {
  const [email, setEmail] = useState('admin@zara.com');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      console.log('🔐 Tentando fazer login com:', { email, password });
      const result = await login({ email, password });
      console.log('📋 Resultado do login:', result);
      
      // Verificar localStorage após login
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      console.log('💾 Token no localStorage:', token ? 'Presente' : 'Ausente');
      console.log('👤 User no localStorage:', user ? 'Presente' : 'Ausente');
      
      console.log('✅ Login bem-sucedido:', result);
      toast.success('Login realizado com sucesso!');
      
      // Aguardar um pouco antes de redirecionar
      setTimeout(() => {
        console.log('🔄 Redirecionando para dashboard...');
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('❌ Erro no login:', error);
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const testUsers = [
    { email: 'admin@zara.com', password: '123456', role: 'ADMIN' },
    { email: 'manager@zara.com', password: '123456', role: 'MANAGER' },
    { email: 'leader@zara.com', password: '123456', role: 'LEADER' },
    { email: 'operator@zara.com', password: '123456', role: 'OPERATOR' },
    { email: 'teste@zara.com', password: '123456', role: 'OPERATOR' }
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Teste de Login</h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Fazendo login...' : 'Entrar'}
          </button>
        </form>
        
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Usuários de Teste:</h3>
          <div className="space-y-2">
            {testUsers.map((user, index) => (
              <button
                key={index}
                onClick={() => {
                  setEmail(user.email);
                  setPassword(user.password);
                }}
                className="w-full text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded border"
              >
                <div className="font-medium">{user.email}</div>
                <div className="text-gray-500">{user.role} - Senha: {user.password}</div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Voltar para Login Normal
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestLogin;