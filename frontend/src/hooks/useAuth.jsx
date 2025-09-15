import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { authService } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem('token');
    return storedToken && storedToken.trim() !== '' ? storedToken : null;
  });



  // Verificar token ao inicializar
  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      console.log('🔍 Verificando autenticação:', { hasToken: !!storedToken, hasUser: !!storedUser });
      
      if (storedToken && storedUser) {
        try {
          // Primeiro, definir o token no estado para que as requisições funcionem
          setToken(storedToken);
          
          // Verificar se o token ainda é válido
          const response = await authService.getProfile();
          
          if (isMounted && response.data.success) {
            // Para verificação, usar dados do localStorage ou da resposta
            const userData = response.data.data?.user || JSON.parse(storedUser);
            setUser(userData);
            setIsAuthenticated(true);
            console.log('✅ Autenticação válida:', userData.name);
          } else if (isMounted) {
            // Token inválido, limpar dados
            console.log('❌ Token inválido, limpando dados');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('❌ Erro ao verificar autenticação:', error);
          if (isMounted) {
            console.log('🧹 Limpando dados devido ao erro');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } else {
        console.log('📭 Nenhum token/usuário encontrado no localStorage');
      }
      
      if (isMounted) {
        setIsLoading(false);
      }
    };

    checkAuth();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Limpar dados anteriores antes de tentar login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      
      const response = await authService.login(credentials);

      const data = response.data;

      if (data.success) {
        const { accessToken: authToken, user: userData } = data.data || {};
        
        // Verificar se os dados estão presentes
        if (!authToken || !userData) {
          throw new Error('Dados de autenticação incompletos');
        }
        
        // Salvar no localStorage
        localStorage.setItem('token', authToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        // Atualizar estado
        setToken(authToken);
        setUser(userData);
        setIsAuthenticated(true);
        
        toast.success(`Bem-vindo, ${userData.name || 'Usuário'}!`);
        return { success: true };
      } else {
        // Garantir que o estado permaneça limpo em caso de erro
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        toast.error(data.message || 'Erro ao fazer login');
        return { success: false, error: data.message };
      }
    } catch (error) {
      console.error('Erro no login:', error);
      // Garantir que o estado permaneça limpo em caso de erro
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setError(error.message);
      toast.error('Erro de conexão. Tente novamente.');
      return { success: false, error: 'Erro de conexão' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Chamar endpoint de logout se necessário
      if (token) {
        await authService.logout();
      }
    } catch (error) {
      console.error('Erro ao fazer logout no servidor:', error);
    } finally {
      // Limpar dados locais PRIMEIRO
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Atualizar estado para forçar desconexão do socket
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      
      // Forçar reload da página para garantir limpeza completa
      setTimeout(() => {
        window.location.href = '/login';
      }, 100);
      
      toast.success('Logout realizado com sucesso');
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authService.updateProfile(profileData);

      const data = response.data;

      if (data.success) {
        const updatedUser = data.data;
        updateUser(updatedUser);
        return updatedUser;
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authService.changePassword({
        currentPassword,
        newPassword
      });

      const data = response.data;

      if (data.success) {
        toast.success('Senha alterada com sucesso!');
        return data;
      }
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      throw error;
    }
  };

  const hasRole = (role) => {
    return user?.role === role;
  };

  const hasPermission = (permission) => {
    const rolePermissions = {
      ADMIN: ['all'],
      MANAGER: ['view_reports', 'manage_users', 'view_quality_tests', 'create_quality_tests'],
      LEADER: ['view_reports', 'view_quality_tests', 'create_quality_tests', 'manage_machines'],
      OPERATOR: ['view_quality_tests', 'create_quality_tests', 'view_machines']
    };
    
    const userPermissions = rolePermissions[user?.role] || [];
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    token,
    login,
    logout,
    updateUser,
    updateProfile,
    changePassword,
    hasRole,
    hasPermission,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;