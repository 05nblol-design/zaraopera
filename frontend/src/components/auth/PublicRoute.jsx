import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// Hooks
import { useAuth } from '@/hooks/useAuth';

// Utilitários
import { ROUTES } from '@/config/routes';

// Componente de carregamento
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
    </div>
  </div>
);

const PublicRoute = ({ 
  children, 
  redirectTo = null,
  redirectIfAuthenticated = true,
  fallback = null
}) => {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return fallback || <LoadingSpinner />;
  }

  // Se o usuário está autenticado e deve ser redirecionado
  if (isAuthenticated && user && redirectIfAuthenticated) {
    // Verificar se há uma página de origem para redirecionar
    const from = location.state?.from;
    
    // Determinar para onde redirecionar
    let redirectPath;
    
    if (redirectTo) {
      redirectPath = redirectTo;
    } else if (from && from !== location.pathname) {
      // Redirecionar para a página que o usuário tentou acessar
      redirectPath = from;
    } else {
      // Redirecionar para dashboard por padrão
      redirectPath = ROUTES.DASHBOARD;
    }
    
    return <Navigate to={redirectPath} replace />;
  }

  // Renderizar o componente público
  return children;
};

// HOC para facilitar o uso
export const withPublicAccess = (Component, options = {}) => {
  return function PublicComponent(props) {
    return (
      <PublicRoute {...options}>
        <Component {...props} />
      </PublicRoute>
    );
  };
};

export default PublicRoute;