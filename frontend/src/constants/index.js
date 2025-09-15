// Roles do sistema
export const ROLES = {
  OPERATOR: 'operator',
  LEADER: 'leader',
  MANAGER: 'manager',
  ADMIN: 'admin'
};

// Status das máquinas
export const MACHINE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  MAINTENANCE: 'maintenance',
  ERROR: 'error'
};

// Status dos testes de qualidade
export const QUALITY_TEST_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

// Tipos de teste de qualidade
export const QUALITY_TEST_TYPES = {
  VISUAL: 'visual',
  DIMENSIONAL: 'dimensional',
  FUNCTIONAL: 'functional',
  MATERIAL: 'material'
};

// Prioridades
export const PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Tipos de notificação
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
  MACHINE_STATUS: 'machine_status',
  QUALITY_TEST: 'quality_test',
  SYSTEM: 'system'
};

// Status de notificação
export const NOTIFICATION_STATUS = {
  UNREAD: 'unread',
  READ: 'read'
};

// Tipos de arquivo permitidos
export const ALLOWED_FILE_TYPES = {
  IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  VIDEOS: ['video/mp4', 'video/webm', 'video/ogg'],
  DOCUMENTS: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
};

// Tamanhos máximos de arquivo (em bytes)
export const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  VIDEO: 50 * 1024 * 1024, // 50MB
  DOCUMENT: 10 * 1024 * 1024 // 10MB
};

// Configurações de paginação
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  MAX_PAGE_SIZE: 100
};

// Configurações de tema
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Configurações de socket
export const SOCKET_EVENTS = {
  // Eventos de conexão
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  
  // Eventos de autenticação
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  UNAUTHORIZED: 'unauthorized',
  
  // Eventos de sala
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  
  // Eventos de máquina
  MACHINE_STATUS_CHANGED: 'machine_status_changed',
  MACHINE_UPDATED: 'machine_updated',
  
  // Eventos de teste de qualidade
  QUALITY_TEST_CREATED: 'quality_test_created',
  QUALITY_TEST_UPDATED: 'quality_test_updated',
  QUALITY_TEST_APPROVED: 'quality_test_approved',
  QUALITY_TEST_REJECTED: 'quality_test_rejected',
  
  // Eventos de notificação
  NOTIFICATION: 'notification',
  ALERT: 'alert',
  
  // Eventos de usuário
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  USERS_ONLINE: 'users_online'
};

// Salas do socket
export const SOCKET_ROOMS = {
  OPERATORS: 'operators',
  LEADERS: 'leaders',
  MANAGERS: 'managers',
  ADMINS: 'admins',
  ALL_USERS: 'all_users'
};

// Configurações de API
export const API_CONFIG = {
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

// Configurações de cache
export const CACHE_CONFIG = {
  STALE_TIME: 5 * 60 * 1000, // 5 minutos
  CACHE_TIME: 10 * 60 * 1000, // 10 minutos
  REFETCH_INTERVAL: 30 * 1000 // 30 segundos
};

// Rotas da aplicação
export const ROUTES = {
  // Públicas
  LOGIN: '/login',
  
  // Dashboard
  DASHBOARD: '/',
  
  // Máquinas
  MACHINES: '/machines',
  MACHINE_DETAIL: '/machines/:id',
  
  // Testes de qualidade
  QUALITY_TESTS: '/quality/tests',
  QUALITY_TEST_DETAIL: '/quality/tests/:id',
  QUALITY_TEST_NEW: '/quality/new-test',
  
  // Relatórios
  REPORTS: '/reports',
  
  // Configurações
  SETTINGS: '/settings',
  
  // Erro 404
  NOT_FOUND: '*'
};

// Mensagens do sistema
export const MESSAGES = {
  // Sucesso
  SUCCESS: {
    LOGIN: 'Login realizado com sucesso!',
    LOGOUT: 'Logout realizado com sucesso!',
    SAVE: 'Dados salvos com sucesso!',
    UPDATE: 'Dados atualizados com sucesso!',
    DELETE: 'Item excluído com sucesso!',
    UPLOAD: 'Arquivo enviado com sucesso!',
    QUALITY_TEST_CREATED: 'Teste de qualidade criado com sucesso!',
    QUALITY_TEST_APPROVED: 'Teste de qualidade aprovado!',
    QUALITY_TEST_REJECTED: 'Teste de qualidade rejeitado!'
  },
  
  // Erro
  ERROR: {
    GENERIC: 'Ocorreu um erro inesperado.',
    NETWORK: 'Erro de conexão. Verifique sua internet.',
    UNAUTHORIZED: 'Você não tem permissão para realizar esta ação.',
    SESSION_EXPIRED: 'Sessão expirada. Faça login novamente.',
    VALIDATION: 'Por favor, verifique os dados informados.',
    FILE_TOO_LARGE: 'Arquivo muito grande.',
    FILE_TYPE_NOT_ALLOWED: 'Tipo de arquivo não permitido.',
    REQUIRED_FIELD: 'Este campo é obrigatório.',
    INVALID_EMAIL: 'Email inválido.',
    INVALID_PASSWORD: 'Senha deve ter pelo menos 6 caracteres.',
    PASSWORD_MISMATCH: 'As senhas não coincidem.'
  },
  
  // Confirmação
  CONFIRM: {
    DELETE: 'Tem certeza que deseja excluir este item?',
    LOGOUT: 'Tem certeza que deseja sair?',
    CANCEL: 'Tem certeza que deseja cancelar?',
    APPROVE: 'Tem certeza que deseja aprovar este teste?',
    REJECT: 'Tem certeza que deseja rejeitar este teste?'
  },
  
  // Loading
  LOADING: {
    DEFAULT: 'Carregando...',
    SAVING: 'Salvando...',
    UPLOADING: 'Enviando arquivo...',
    PROCESSING: 'Processando...',
    AUTHENTICATING: 'Autenticando...'
  }
};

// Configurações de validação
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 50,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  COMMENT_MAX_LENGTH: 1000
};

// Configurações de formatação
export const FORMAT = {
  DATE: 'dd/MM/yyyy',
  DATETIME: 'dd/MM/yyyy HH:mm',
  TIME: 'HH:mm',
  CURRENCY: 'pt-BR',
  NUMBER: 'pt-BR'
};

// Cores do sistema
export const COLORS = {
  PRIMARY: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a'
  },
  
  SUCCESS: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d'
  },
  
  WARNING: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f'
  },
  
  ERROR: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d'
  }
};

// Breakpoints responsivos
export const BREAKPOINTS = {
  SM: '640px',
  MD: '768px',
  LG: '1024px',
  XL: '1280px',
  '2XL': '1536px'
};

// Configurações de animação
export const ANIMATIONS = {
  DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500
  },
  
  EASING: {
    EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
    EASE_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
    EASE_IN_OUT: 'cubic-bezier(0.4, 0, 0.2, 1)'
  }
};

// Configurações de localStorage
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  THEME: 'theme',
  LANGUAGE: 'language',
  SIDEBAR_COLLAPSED: 'sidebar_collapsed',
  DASHBOARD_LAYOUT: 'dashboard_layout'
};

// Configurações de meta tags
export const META = {
  TITLE: 'Zara Operação',
  DESCRIPTION: 'Sistema de gestão operacional da Zara',
  KEYWORDS: 'zara, operação, gestão, qualidade, máquinas',
  AUTHOR: 'Zara Team',
  VIEWPORT: 'width=device-width, initial-scale=1.0'
};