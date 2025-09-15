import axios from 'axios';
import toast from 'react-hot-toast';

// Configuração base da API - prioriza ngrok se configurado
const getApiBaseUrl = () => {
  // Se VITE_API_URL está configurado (ngrok), usar sempre
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.includes('ngrok')) {
    return import.meta.env.VITE_API_URL;
  }
  
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3001/api';
  } else {
    // Para túneis públicos, usar sempre a variável de ambiente configurada
    return import.meta.env.VITE_API_URL || 'https://zara-backend.loca.lt/api';
  }
};

const API_BASE_URL = getApiBaseUrl();

// Instância do axios
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar respostas e erros
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;
    
    // Tratar diferentes tipos de erro
    if (response) {
      const { status, data } = response;
      
      switch (status) {
        case 401:
          console.log('🔒 Erro 401 detectado, limpando autenticação');
          
          // Token expirado ou inválido
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Mostrar toast apenas se não estivermos na página de login
          if (!window.location.pathname.includes('/login')) {
            toast.error('Sessão expirada. Faça login novamente.');
            
            // Redirecionar para login após um pequeno delay
            setTimeout(() => {
              window.location.href = '/login';
            }, 1500);
          }
          break;
          
        case 403:
          toast.error('Você não tem permissão para realizar esta ação.');
          break;
          
        case 404:
          toast.error('Recurso não encontrado.');
          break;
          
        case 422:
          // Erros de validação
          if (data.errors && Array.isArray(data.errors)) {
            data.errors.forEach(err => toast.error(err.message));
          } else if (data.message) {
            toast.error(data.message);
          }
          break;
          
        case 429:
          toast.error('Muitas tentativas. Tente novamente em alguns minutos.');
          break;
          
        case 500:
          toast.error('Erro interno do servidor. Tente novamente mais tarde.');
          break;
          
        default:
          if (data.message) {
            toast.error(data.message);
          } else {
            toast.error('Ocorreu um erro inesperado.');
          }
      }
    } else if (error.request) {
      // Erro de rede
      toast.error('Erro de conexão. Verifique sua internet.');
    } else {
      // Outros erros
      toast.error('Ocorreu um erro inesperado.');
    }
    
    return Promise.reject(error);
  }
);

// Serviços de autenticação
export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  getProfile: () => api.get('/auth/verify'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Serviços de máquinas
export const machineService = {
  getAll: () => api.get('/machines'),
  getById: (id) => api.get(`/machines/${id}`),
  create: (data) => api.post('/machines', data),
  update: (id, data) => api.put(`/machines/${id}`, data),
  delete: (id) => api.delete(`/machines/${id}`),
  updateStatus: (id, status) => api.patch(`/machines/${id}/status`, { status }),
  getHistory: (id, params) => api.get(`/machines/${id}/history`, { params }),
  getStats: () => api.get('/machines/stats'),
  getConfig: (id) => api.get(`/machines/${id}/config`),
  updateConfig: (id, data) => api.put(`/machines/${id}/config`, data),
  startOperation: (id, notes = '') => api.post(`/machines/${id}/start-operation`, { notes }),
  stopOperation: (id) => api.post(`/machines/${id}/stop-operation`),
  // Métodos de produção
  incrementProduction: (id) => api.post(`/machines/${id}/production/increment`),
  getProductionCount: (id) => api.get(`/machines/${id}/production/current-shift`),
  getProductionPopups: (id) => api.get(`/machines/${id}/production/popups`),
  acknowledgePopup: (id, popupId) => api.put(`/machines/${id}/production/popups/${popupId}/acknowledge`),
};

// Serviços de testes de qualidade
export const qualityTestService = {
  getAll: (params) => api.get('/quality-tests', { params }),
  getById: (id) => api.get(`/quality-tests/${id}`),
  create: (data) => api.post('/quality-tests', data),
  update: (id, data) => api.put(`/quality-tests/${id}`, data),
  delete: (id) => api.delete(`/quality-tests/${id}`),
  approve: (id, data) => api.patch(`/quality-tests/${id}/approve`, data),
  reject: (id, data) => api.patch(`/quality-tests/${id}/reject`, data),
  getStats: (params) => api.get('/quality-tests/stats', { params }),
  exportReport: (params) => api.get('/quality-tests/export', { 
    params, 
    responseType: 'blob' 
  }),
};

// Serviços de upload
export const uploadService = {
  uploadFile: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },
  uploadMultiple: (files, onProgress) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    return api.post('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },
  deleteFile: (filename) => api.delete(`/upload/${filename}`),
};

// Serviços de notificações
export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

// Serviços de relatórios
export const reportService = {
  getDashboardStats: (params) => api.get('/reports/dashboard', { params }),
  getProductionReport: (params) => api.get('/reports/production', { params }),
  getQualityReport: (params) => api.get('/reports/quality', { params }),
  getMachineReport: (params) => api.get('/reports/machines', { params }),
  exportReport: (type, params) => api.get(`/reports/${type}/export`, {
    params,
    responseType: 'blob'
  }),
};

// Serviços de configurações
export const settingsService = {
  getAll: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  getByCategory: (category) => api.get(`/settings/${category}`),
  updateByCategory: (category, data) => api.put(`/settings/${category}`, data),
};

// Utilitários
export const createFormData = (data) => {
  const formData = new FormData();
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    
    if (value instanceof File) {
      formData.append(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item instanceof File) {
          formData.append(`${key}[${index}]`, item);
        } else {
          formData.append(`${key}[${index}]`, JSON.stringify(item));
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, value);
    }
  });
  
  return formData;
};

export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default api;