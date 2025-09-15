import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina classes CSS de forma inteligente
 * Usa clsx para concatenar e tailwind-merge para resolver conflitos
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formata números para exibição
 */
export const formatNumber = (number, options = {}) => {
  const {
    locale = 'pt-BR',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    ...restOptions
  } = options;

  if (number === null || number === undefined || isNaN(number)) {
    return '-';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
    ...restOptions
  }).format(number);
};

/**
 * Formata valores monetários
 */
export const formatCurrency = (value, currency = 'BRL', locale = 'pt-BR') => {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(value);
};

/**
 * Formata porcentagens
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }

  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Formata datas
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '-';

  const {
    locale = 'pt-BR',
    dateStyle = 'short',
    timeStyle = null,
    ...restOptions
  } = options;

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return '-';
  }

  const formatOptions = {
    ...restOptions
  };

  if (dateStyle) formatOptions.dateStyle = dateStyle;
  if (timeStyle) formatOptions.timeStyle = timeStyle;

  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
};

/**
 * Formata data e hora
 */
export const formatDateTime = (date, locale = 'pt-BR') => {
  return formatDate(date, { 
    locale,
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

/**
 * Formata apenas a hora
 */
export const formatTime = (date, locale = 'pt-BR') => {
  return formatDate(date, { 
    locale,
    timeStyle: 'short'
  });
};

/**
 * Trunca texto com reticências
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
};

/**
 * Capitaliza primeira letra
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Capitaliza primeira letra de cada palavra
 */
export const capitalizeWords = (str) => {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

/**
 * Remove acentos de uma string
 */
export const removeAccents = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

/**
 * Gera um ID único
 */
export const generateId = (prefix = '') => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${prefix}${prefix ? '_' : ''}${timestamp}_${randomStr}`;
};

/**
 * Debounce function
 */
export const debounce = (func, wait, immediate = false) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Valida email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida CPF
 */
export const isValidCPF = (cpf) => {
  if (!cpf) return false;
  
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  
  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
  
  return true;
};

/**
 * Formata CPF
 */
export const formatCPF = (cpf) => {
  if (!cpf) return '';
  const cleanCPF = cpf.replace(/\D/g, '');
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

/**
 * Formata telefone
 */
export const formatPhone = (phone) => {
  if (!phone) return '';
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length === 10) {
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
};

/**
 * Converte bytes para formato legível
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Calcula diferença entre datas em dias
 */
export const daysBetween = (date1, date2) => {
  const oneDay = 24 * 60 * 60 * 1000;
  const firstDate = new Date(date1);
  const secondDate = new Date(date2);
  
  return Math.round(Math.abs((firstDate - secondDate) / oneDay));
};

/**
 * Verifica se uma data está no passado
 */
export const isPastDate = (date) => {
  return new Date(date) < new Date();
};

/**
 * Verifica se uma data está no futuro
 */
export const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Ordena array de objetos por propriedade
 */
export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = key.split('.').reduce((obj, k) => obj?.[k], a);
    const bVal = key.split('.').reduce((obj, k) => obj?.[k], b);
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Agrupa array por propriedade
 */
export const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = key.split('.').reduce((obj, k) => obj?.[k], item);
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
};

/**
 * Remove duplicatas de array
 */
export const unique = (array, key = null) => {
  if (!key) {
    return [...new Set(array)];
  }
  
  const seen = new Set();
  return array.filter(item => {
    const value = key.split('.').reduce((obj, k) => obj?.[k], item);
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

/**
 * Cria range de números
 */
export const range = (start, end, step = 1) => {
  const result = [];
  for (let i = start; i <= end; i += step) {
    result.push(i);
  }
  return result;
};

/**
 * Converte objeto para query string
 */
export const objectToQueryString = (obj) => {
  const params = new URLSearchParams();
  
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => params.append(key, v));
      } else {
        params.append(key, value);
      }
    }
  });
  
  return params.toString();
};

/**
 * Converte query string para objeto
 */
export const queryStringToObject = (queryString) => {
  const params = new URLSearchParams(queryString);
  const result = {};
  
  for (const [key, value] of params.entries()) {
    if (result[key]) {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
};

/**
 * Copia texto para clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback para navegadores mais antigos
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};

/**
 * Detecta se é dispositivo móvel
 */
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Detecta se é dispositivo touch
 */
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * Scroll suave para elemento
 */
export const scrollToElement = (elementId, offset = 0) => {
  const element = document.getElementById(elementId);
  if (element) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
};

/**
 * Gera cor baseada em string (para avatars, etc)
 */
export const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

/**
 * Obtém iniciais do nome
 */
export const getInitials = (name) => {
  if (!name) return '';
  
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

/**
 * Valida se string é JSON válido
 */
export const isValidJSON = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Converte RGB para HEX
 */
export const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

/**
 * Converte HEX para RGB
 */
export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

export default {
  cn,
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDate,
  formatDateTime,
  formatTime,
  truncateText,
  capitalize,
  capitalizeWords,
  removeAccents,
  generateId,
  debounce,
  throttle,
  isValidEmail,
  isValidCPF,
  formatCPF,
  formatPhone,
  formatBytes,
  daysBetween,
  isPastDate,
  isFutureDate,
  sortBy,
  groupBy,
  unique,
  range,
  objectToQueryString,
  queryStringToObject,
  copyToClipboard,
  isMobile,
  isTouchDevice,
  scrollToElement,
  stringToColor,
  getInitials,
  isValidJSON,
  rgbToHex,
  hexToRgb
};