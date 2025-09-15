import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  LockClosedIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';

// Utilitários
import { ROUTES } from '@/config/routes';
import { hasPermission } from '@/utils';
import { cn } from '@/lib/utils';

// Componente de carregamento
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Verificando permissões...</p>
    </div>
  </div>
);

// Componente de acesso negado
const AccessDenied = ({ requiredRole, userRole, onBack }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center"
    >
      <div className="mb-6">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20">
          <LockClosedIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
      </div>
      
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Acesso Negado
      </h1>
      
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Você não tem permissão para acessar esta página.
        {requiredRole && (
          <>
            <br />
            <span className="text-sm mt-2 block">
              Permissão necessária: <span className="font-semibold">{requiredRole}</span>
              <br />
              Sua permissão atual: <span className="font-semibold">{userRole || 'Nenhuma'}</span>
            </span>
          </>
        )}
      </p>
      
      <div className="space-y-3">
        <button
          onClick={onBack}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Voltar
        </button>
        
        <button
          onClick={() => window.location.href = ROUTES.DASHBOARD}
          className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          Ir para Dashboard
        </button>
      </div>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
        Se você acredita que deveria ter acesso a esta página, entre em contato com o administrador do sistema.
      </p>
    </motion.div>
  </div>
);

// Componente de erro de autenticação
const AuthError = ({ error, onRetry }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center"
    >
      <div className="mb-6">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
          <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
        </div>
      </div>
      
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Erro de Autenticação
      </h1>
      
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Ocorreu um erro ao verificar suas credenciais.
        {error && (
          <span className="text-sm block mt-2 text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </p>
      
      <div className="space-y-3">
        <button
          onClick={onRetry}
          className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          Tentar Novamente
        </button>
        
        <button
          onClick={() => window.location.href = ROUTES.LOGIN}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          Fazer Login Novamente
        </button>
      </div>
    </motion.div>
  </div>
);

const ProtectedRoute = ({ 
  children, 
  requiredRole = null,
  requiredPermissions = [],
  fallback = null,
  redirectTo = null
}) => {
  const { user, isLoading, isAuthenticated, error, checkAuth } = useAuth();
  const location = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return fallback || <LoadingSpinner />;
  }

  // Mostrar erro se houver problema na autenticação
  if (error) {
    return (
      <AuthError 
        error={error} 
        onRetry={checkAuth}
      />
    );
  }

  // Redirecionar para login se não autenticado
  if (!isAuthenticated || !user) {
    const redirectPath = redirectTo || ROUTES.LOGIN;
    return (
      <Navigate 
        to={redirectPath} 
        state={{ from: location.pathname }}
        replace 
      />
    );
  }

  // Verificar permissões de role
  if (requiredRole) {
    if (!hasPermission(user.role, requiredRole)) {
      return (
        <AccessDenied 
          requiredRole={requiredRole}
          userRole={user.role}
          onBack={() => window.history.back()}
        />
      );
    }
  }

  // Verificar permissões específicas
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => 
      hasPermission(user.role, permission)
    );
    
    if (!hasAllPermissions) {
      return (
        <AccessDenied 
          requiredRole={requiredPermissions.join(', ')}
          userRole={user.role}
          onBack={() => window.history.back()}
        />
      );
    }
  }

  // Verificar se o usuário está ativo
  if (user.status && user.status !== 'ACTIVE') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center"
        >
          <div className="mb-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Conta Inativa
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Sua conta está {user.status === 'SUSPENDED' ? 'suspensa' : 'inativa'}.
            Entre em contato com o administrador do sistema para reativar sua conta.
          </p>
          
          <button
            onClick={() => window.location.href = ROUTES.LOGIN}
            className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Voltar ao Login
          </button>
        </motion.div>
      </div>
    );
  }

  // Renderizar o componente protegido
  return children;
};

// HOC para facilitar o uso
export const withAuth = (Component, options = {}) => {
  return function AuthenticatedComponent(props) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
};

// Hook para verificar permissões em componentes
export const usePermissions = () => {
  const { user } = useAuth();
  
  return {
    hasRole: (role) => hasPermission(user?.role, role),
    hasAnyRole: (roles) => roles.some(role => hasPermission(user?.role, role)),
    hasAllRoles: (roles) => roles.every(role => hasPermission(user?.role, role)),
    canAccess: (requiredRole) => hasPermission(user?.role, requiredRole),
    isAdmin: () => user?.role === 'ADMIN',
    isManager: () => user?.role === 'MANAGER' || user?.role === 'ADMIN',
    isLeader: () => ['LEADER', 'MANAGER', 'ADMIN'].includes(user?.role),
    isOperator: () => user?.role === 'OPERATOR'
  };
};

export default ProtectedRoute;