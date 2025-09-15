// Configuração específica para ambiente de testes empresariais
// Desabilita timers e processos em background durante os testes

// Mock dos serviços que criam timers
const originalSetInterval = global.setInterval;
const originalSetTimeout = global.setTimeout;
const activeTimers = new Set();

// Override setInterval para rastrear timers
global.setInterval = function(callback, delay, ...args) {
  // Durante testes, não criar timers de longa duração
  if (process.env.NODE_ENV === 'test') {
    const timerId = originalSetInterval(() => {
      // Timer vazio para não executar callbacks em testes
    }, delay, ...args);
    activeTimers.add(timerId);
    return timerId;
  }
  return originalSetInterval(callback, delay, ...args);
};

// Override setTimeout para rastrear timeouts
global.setTimeout = function(callback, delay, ...args) {
  if (process.env.NODE_ENV === 'test' && delay > 1000) {
    // Para timeouts longos em testes, usar delay menor
    const timerId = originalSetTimeout(() => {
      // Timeout vazio para não executar callbacks em testes
    }, 100, ...args);
    activeTimers.add(timerId);
    return timerId;
  }
  return originalSetTimeout(callback, delay, ...args);
};

// Função para limpar todos os timers ativos
function clearAllTimers() {
  activeTimers.forEach(timerId => {
    try {
      clearInterval(timerId);
      clearTimeout(timerId);
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });
  activeTimers.clear();
}

// Configuração para Jest
if (process.env.NODE_ENV === 'test') {
  // Desabilitar console.log durante testes para output mais limpo
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    // Permitir apenas logs importantes (com emojis)
    if (args.some(arg => typeof arg === 'string' && /[🏢✅❌🧹🚀📋🛡️🔒🚫⚡📊📈]/u.test(arg))) {
      originalConsoleLog(...args);
    }
  };
  
  // Configurar timeouts menores para testes
  jest.setTimeout(30000); // 30 segundos máximo por teste
}

module.exports = {
  clearAllTimers,
  activeTimers
};