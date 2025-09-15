import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

// Utilitários
import { cn, isValidEmail } from '../lib/utils';
import { ROUTES } from '../config/routes';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const { login, error: authError, clearError = () => {} } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Página de destino após login
  const from = location.state?.from || ROUTES.DASHBOARD;
  
  // Limpar erros quando o componente monta
  useEffect(() => {
    clearError();
  }, [clearError]);
  
  // Carregar dados salvos se "Lembrar-me" estava ativo
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  const validateForm = () => {
    const newErrors = {};
    
    // Validar email
    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    
    // Validar senha
    if (!formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Senha deve ter pelo menos 6 caracteres';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      await login({ email: formData.email, password: formData.password });
      
      // Salvar email se "Lembrar-me" estiver ativo
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', formData.email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      // Redirecionar para a página de destino
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Erro no login:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const demoCredentials = [
    { role: 'Administrador', email: 'admin@zara.com', password: 'admin123' },
    { role: 'Gestor', email: 'manager@zara.com', password: 'admin123' },
    { role: 'Líder', email: 'leader@zara.com', password: 'admin123' },
    { role: 'Operador', email: 'lucas@zara.com', password: '123456' }
  ];

  const fillDemoCredentials = (email, password) => {
    setFormData({ email, password });
    setErrors({});
  };

  return (
    <>
      <Helmet>
        <title>Login - Sistema ZARA</title>
        <meta name="description" content="Faça login no Sistema ZARA para gerenciar operações industriais" />
      </Helmet>
      
      <div className="min-h-screen flex">
        {/* Lado esquerdo - Formulário */}
        <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Logo e título - Design Zaraplast */}
              <div className="text-center mb-8">
                <div className="mx-auto h-16 w-16 rounded-lg flex items-center justify-center mb-4 shadow-lg">
                  <img 
                    src="/src/assets/logo.svg" 
                    alt="Logo Zaraplast" 
                    className="h-16 w-16 object-contain rounded-lg"
                  />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Sistema ZARAPLAST
                </h2>
                <p className="mt-2 text-sm text-primary-600 dark:text-primary-400 font-medium">
                  Controle de Qualidade Industrial
                </p>

              </div>

              {/* Erro de autenticação */}
              {authError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
                >
                  <div className="flex items-center">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-2" />
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {authError}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={cn(
                        'appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors',
                        'dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400',
                        errors.email
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                      placeholder="seu@email.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Senha
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className={cn(
                        'appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors',
                        'dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400',
                        errors.password
                          ? 'border-red-300 dark:border-red-600'
                          : 'border-gray-300 dark:border-gray-600'
                      )}
                      placeholder="Sua senha"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.password}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lembrar-me e Esqueci a senha */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                      Lembrar-me
                    </label>
                  </div>

                  <div className="text-sm">
                    <Link
                      to="/forgot-password"
                      className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
                    >
                      Esqueceu a senha?
                    </Link>
                  </div>
                </div>

                {/* Botão de login */}
                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      'group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white transition-colors shadow-lg',
                      isSubmitting
                        ? 'bg-primary-400 cursor-not-allowed'
                        : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 hover:shadow-xl'
                    )}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Entrando...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        Entrar
                        <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </button>
                </div>
              </form>

              {/* Credenciais de demonstração */}
              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                      Credenciais de demonstração
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  {demoCredentials.map((cred, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => fillDemoCredentials(cred.email, cred.password)}
                      className="text-left p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {cred.role}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {cred.email}
                          </p>
                        </div>
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Lado direito - Branding Zaraplast */}
        <div className="hidden lg:block relative w-0 flex-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800">
            <div className="absolute inset-0 bg-black bg-opacity-10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  <h1 className="text-6xl font-bold mb-4 text-white">ZARAPAST</h1>
                  <p className="text-xl mb-2 text-gray-200">
                    Sistema de Gestão Industrial
                  </p>

                  <div className="space-y-4 text-left max-w-md">
                    <div className="flex items-center space-x-3">
                      <CheckCircleIcon className="h-6 w-6 text-green-400" />
                      <span>Controle de Qualidade</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircleIcon className="h-6 w-6 text-green-400" />
                      <span>Monitoramento de Máquinas</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircleIcon className="h-6 w-6 text-green-400" />
                      <span>Relatórios em Tempo Real</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <CheckCircleIcon className="h-6 w-6 text-green-400" />
                      <span>Gestão de Equipes</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;