// Configuração centralizada de rotas da aplicação

// Definição das rotas principais
export const ROUTES = {
  // Rotas públicas
  LOGIN: '/login',
  
  // Rotas protegidas
  HOME: '/',
  DASHBOARD: '/dashboard',
  OPERATOR_MENU: '/operator-menu',
  LEADER_DASHBOARD: '/leader-dashboard',
  MANAGER_DASHBOARD: '/manager-dashboard',
  
  // Máquinas
  MACHINES: '/machines',
  MACHINE_NEW: '/machines/new',
  MACHINE_DETAIL: '/machines/:id',
  MACHINE_CONFIG: '/machines/:id/config',
  MACHINE_PRODUCTION_OPERATION: '/machines/:machineId/operation',
  

  
  // Testes de Qualidade
  QUALITY: '/quality',
  QUALITY_NEW: '/quality/new-test',
  QUALITY_EDIT: '/quality/:id/edit',
  QUALITY_DETAIL: '/quality/:id',
  QUALITY_TEST: '/quality/test/:machineId',
  
  // Controle de Teflon
  TEFLON: '/teflon',
  TEFLON_CHANGE: '/teflon/change',
  TEFLON_HISTORY: '/teflon/history',
  
  // Relatórios
  REPORTS: '/reports',
  REPORTS_QUALITY: '/reports/quality',
  REPORTS_PRODUCTION: '/reports/production',
  REPORTS_TEFLON: '/reports/teflon',
  
  // Notificações
  NOTIFICATIONS: '/notifications',
  NOTIFICATIONS_ADMIN: '/notifications/admin',
  NOTIFICATIONS_DASHBOARD: '/notifications/dashboard',
  
  // Usuários
  USERS: '/users',
  USER_DETAIL: '/users/:id',
  USER_NEW: '/users/new',
  USER_EDIT: '/users/:id/edit',
  
  // Permissões
  PERMISSIONS: '/permissions',
  OPERATOR_ASSIGNMENT: '/operator-assignment',
  
  // Sistema de Turnos 3x3
  SHIFTS_3X3: '/shifts-3x3',
  
  // Perfil
  PROFILE: '/profile',
  PROFILE_EDIT: '/profile/edit',
  
  // Configurações
  SETTINGS: '/settings',
  SETTINGS_PERSONAL: '/settings/personal',
  SETTINGS_SYSTEM: '/settings/system',
  SETTINGS_NOTIFICATIONS: '/settings/notifications',
  SETTINGS_BACKUP: '/settings/backup',
  
  // Páginas de erro
  NOT_FOUND: '/404',
  UNAUTHORIZED: '/401',
  SERVER_ERROR: '/500'
};

// Função para gerar URLs com parâmetros
export const generatePath = (route, params = {}) => {
  let path = route;
  
  Object.keys(params).forEach(key => {
    path = path.replace(`:${key}`, params[key]);
  });
  
  return path;
};

// Configuração de permissões por rota
export const ROUTE_PERMISSIONS = {
  [ROUTES.DASHBOARD]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.LEADER_DASHBOARD]: ['LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.MANAGER_DASHBOARD]: ['MANAGER', 'ADMIN'],
  [ROUTES.MACHINES]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],

  [ROUTES.QUALITY]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.QUALITY_NEW]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.QUALITY_EDIT]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.TEFLON]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.REPORTS]: ['LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.NOTIFICATIONS]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.NOTIFICATIONS_ADMIN]: ['ADMIN'],
  [ROUTES.NOTIFICATIONS_DASHBOARD]: ['LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.USERS]: ['MANAGER', 'ADMIN'],
  [ROUTES.PERMISSIONS]: ['MANAGER', 'ADMIN'],
  [ROUTES.PROFILE]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.SETTINGS]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.SETTINGS_PERSONAL]: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
  [ROUTES.SETTINGS_SYSTEM]: ['ADMIN']
};

// Hierarquia de roles
export const ROLE_HIERARCHY = {
  'ADMIN': 4,
  'MANAGER': 3,
  'LEADER': 2,
  'OPERATOR': 1
};

// Função para verificar se o usuário tem permissão para acessar uma rota
export const hasRoutePermission = (userRole, route) => {
  const allowedRoles = ROUTE_PERMISSIONS[route];
  
  if (!allowedRoles) {
    return true; // Se não há restrição definida, permite acesso
  }
  
  return allowedRoles.includes(userRole);
};

// Função para verificar hierarquia de roles
export const hasRolePermission = (userRole, requiredRole) => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

// Configuração de navegação principal
export const NAVIGATION_ITEMS = [
  {
    name: 'Dashboard',
    path: ROUTES.DASHBOARD,
    icon: 'HomeIcon',
    roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
  },
  {
    name: 'Dashboard Líder',
    path: ROUTES.LEADER_DASHBOARD,
    icon: 'UserGroupIcon',
    roles: ['LEADER', 'MANAGER', 'ADMIN']
  },
  {
    name: 'Painel Gestor',
    path: ROUTES.MANAGER_DASHBOARD,
    icon: 'ChartBarIcon',
    roles: ['MANAGER', 'ADMIN']
  },
  {
    name: 'Máquinas',
    path: ROUTES.MACHINES,
    icon: 'WrenchScrewdriverIcon',
    roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
    children: []
  },
  {
    name: 'Qualidade',
    path: ROUTES.QUALITY,
    icon: 'BeakerIcon',
    roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
    children: [
      {
        name: 'Testes',
        path: ROUTES.QUALITY,
        roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
      },
      {
        name: 'Novo Teste',
        path: ROUTES.QUALITY_NEW,
        roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
      }
    ]
  },
  {
    name: 'Teflon',
    path: ROUTES.TEFLON,
    icon: 'ShieldCheckIcon',
    roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
  },
  {
    name: 'Relatórios',
    path: ROUTES.REPORTS,
    icon: 'DocumentTextIcon',
    roles: ['LEADER', 'MANAGER', 'ADMIN']
  },
  {
    name: 'Notificações',
    path: ROUTES.NOTIFICATIONS,
    icon: 'BellIcon',
    roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'],
    children: [
      {
        name: 'Centro de Notificações',
        path: ROUTES.NOTIFICATIONS,
        roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
      },
      {
        name: 'Dashboard',
        path: ROUTES.NOTIFICATIONS_DASHBOARD,
        roles: ['LEADER', 'MANAGER', 'ADMIN']
      },
      {
        name: 'Administração',
        path: ROUTES.NOTIFICATIONS_ADMIN,
        roles: ['ADMIN']
      }
    ]
  },
  {
    name: 'Usuários',
    path: ROUTES.USERS,
    icon: 'UsersIcon',
    roles: ['MANAGER', 'ADMIN']
  },
  {
      name: 'Permissões',
      path: ROUTES.PERMISSIONS,
      icon: 'ShieldCheckIcon',
      roles: ['MANAGER', 'ADMIN']
    },
  {
      name: 'Atribuição de Operadores',
      path: ROUTES.OPERATOR_ASSIGNMENT,
      icon: 'UserGroupIcon',
      roles: ['MANAGER', 'ADMIN']
    },
  {
    name: 'Turnos 3x3',
    path: ROUTES.SHIFTS_3X3,
    icon: 'ClockIcon',
    roles: ['MANAGER', 'ADMIN']
  }
];

// Função para filtrar itens de navegação baseado no role do usuário
export const getNavigationItems = (userRole) => {
  return NAVIGATION_ITEMS.filter(item => 
    item.roles.includes(userRole)
  ).map(item => {
    const filteredItem = { ...item };
    if (item.children) {
      const filteredChildren = item.children.filter(child => 
        child.roles.includes(userRole)
      );
      if (filteredChildren.length > 0) {
        filteredItem.children = filteredChildren;
      } else {
        delete filteredItem.children;
      }
    }
    return filteredItem;
  });
};

// Configuração de breadcrumbs
export const BREADCRUMB_NAMES = {
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.LEADER_DASHBOARD]: 'Dashboard do Líder',
  [ROUTES.MACHINES]: 'Máquinas',
  [ROUTES.MACHINE_PRODUCTION_OPERATION]: 'Operação da Máquina',
  [ROUTES.MACHINE_CONFIG]: 'Configurações da Máquina',
  [ROUTES.QUALITY]: 'Testes de Qualidade',
  [ROUTES.QUALITY_NEW]: 'Novo Teste',
  [ROUTES.QUALITY_EDIT]: 'Editar Teste',

  [ROUTES.TEFLON]: 'Controle de Teflon',
  [ROUTES.REPORTS]: 'Relatórios',
  [ROUTES.NOTIFICATIONS]: 'Notificações',
  [ROUTES.NOTIFICATIONS_ADMIN]: 'Administração de Notificações',
  [ROUTES.NOTIFICATIONS_DASHBOARD]: 'Dashboard de Notificações',
  [ROUTES.USERS]: 'Usuários',
  [ROUTES.PERMISSIONS]: 'Permissões',
  [ROUTES.OPERATOR_ASSIGNMENT]: 'Atribuição de Operadores',
  [ROUTES.PROFILE]: 'Perfil',
  [ROUTES.SETTINGS]: 'Configurações'
};

// Função para gerar breadcrumbs baseado na rota atual
export const generateBreadcrumbs = (pathname) => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [{ name: 'Início', path: ROUTES.DASHBOARD }];
  
  let currentPath = '';
  
  segments.forEach(segment => {
    currentPath += `/${segment}`;
    const name = BREADCRUMB_NAMES[currentPath] || segment;
    breadcrumbs.push({ name, path: currentPath });
  });
  
  return breadcrumbs;
};

export default ROUTES;