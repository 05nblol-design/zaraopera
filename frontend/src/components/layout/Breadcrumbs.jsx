import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Mapeamento de rotas para nomes amigáveis
  const routeNames = {
    dashboard: 'Dashboard',
    machines: 'Máquinas',
    'quality-tests': 'Testes de Qualidade',
    'quality-test': 'Teste de Qualidade',
    reports: 'Relatórios',
    settings: 'Configurações',
    profile: 'Perfil',
    users: 'Usuários',
    notifications: 'Notificações',
    teflon: 'Teflon',
    new: 'Novo',
    edit: 'Editar'
  };

  const getBreadcrumbName = (pathname, index) => {
    // Se for um ID (número), mostrar como "Detalhes"
    if (/^\d+$/.test(pathname)) {
      return 'Detalhes';
    }
    return routeNames[pathname] || pathname.charAt(0).toUpperCase() + pathname.slice(1);
  };

  if (pathnames.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-3 ml-4">
      <Link
        to="/dashboard"
        className="flex items-center hover:text-blue-600 transition-colors"
      >
        <Home className="h-4 w-4" />
        <span className="ml-1">Início</span>
      </Link>
      
      {pathnames.map((pathname, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const breadcrumbName = getBreadcrumbName(pathname, index);

        return (
          <React.Fragment key={routeTo}>
            <ChevronRight className="h-4 w-4 text-gray-400" />
            {isLast ? (
              <span className="text-gray-900 font-medium">
                {breadcrumbName}
              </span>
            ) : (
              <Link
                to={routeTo}
                className="hover:text-blue-600 transition-colors"
              >
                {breadcrumbName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumbs;