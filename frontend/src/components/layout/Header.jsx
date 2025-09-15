import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useSocket } from '../../hooks/useSocket';
import { useNotifications } from '../../contexts/NotificationContext';

// Utilitários
import { cn } from '../../lib/utils';

// Constantes
import { THEMES } from '../../constants';

const Header = ({ 
  onMenuClick, 
  onNotificationClick,
  onNotificationCenterClick, 
  onQuickActionsClick,
  sidebarCollapsed 
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const userMenuRef = useRef(null);
  const themeMenuRef = useRef(null);
  const searchRef = useRef(null);
  
  const { user, logout } = useAuth();
  const { theme, isDark, changeTheme } = useTheme();
  const { isConnected } = useSocket();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  // Fechar menus ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setThemeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + K para focar na busca
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implementar lógica de busca
      console.log('Buscar:', searchQuery);
      onQuickActionsClick();
    }
  };

  const themeOptions = [
    {
      value: THEMES.LIGHT,
      label: 'Claro',
      icon: SunIcon
    },
    {
      value: THEMES.DARK,
      label: 'Escuro',
      icon: MoonIcon
    },
    {
      value: THEMES.SYSTEM,
      label: 'Sistema',
      icon: ComputerDesktopIcon
    }
  ];

  const currentThemeOption = themeOptions.find(option => option.value === theme);

  return (
    <header className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg relative z-10">
      <div className="flex items-center px-6 py-2 lg:px-8">
        {/* Lado esquerdo */}
        <div className="flex items-center space-x-4 flex-shrink-0">
          {/* Botão do menu mobile */}
          <button
            onClick={onMenuClick}
            className="p-3 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 dark:hover:text-gray-300 dark:hover:bg-gray-700/80 lg:hidden transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="Abrir menu"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          {/* Título da página (apenas em desktop quando sidebar colapsada) */}
          {sidebarCollapsed && (
            <div className="hidden lg:block">
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent dark:from-primary-400 dark:to-primary-600">
                ZARAPLAST
              </h1>
              <p className="text-xs font-medium text-primary-600/80 dark:text-primary-400/80 tracking-wide">
                Sistema de Controle
              </p>
            </div>
          )}
        </div>

        {/* Centro - Barra de busca */}
        <div className="flex-1 flex justify-center px-4">
          <div className="hidden sm:block w-full max-w-md">
            <form onSubmit={handleSearch} className="relative">
              <div className={cn(
                'relative flex items-center transition-all duration-200 w-full',
                searchFocused ? 'transform scale-105' : ''
              )}>
                <MagnifyingGlassIcon className="absolute left-4 h-5 w-5 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Buscar... (Ctrl+K)"
                  className={cn(
                    'w-full pl-12 pr-4 py-3.5 text-sm border border-gray-200 rounded-2xl font-medium',
                    'focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                    'dark:bg-gray-700/50 dark:border-gray-600 dark:text-white dark:placeholder-gray-400',
                    'bg-white/90 backdrop-blur-sm shadow-md',
                    'transition-all duration-300 hover:shadow-lg focus:shadow-xl focus:bg-white dark:focus:bg-gray-700/70'
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg font-bold"
                  >
                    ×
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Lado direito */}
        <div className="flex items-center space-x-2">
          {/* Indicador de conexão aprimorado */}
          <div className={cn(
            'hidden sm:flex items-center space-x-3 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-lg backdrop-blur-md border-2 transition-all duration-300 hover:scale-105 hover:shadow-xl',
            isConnected 
              ? 'bg-gradient-to-r from-green-50/90 to-emerald-50/90 text-green-700 dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-300 border-green-300/60 dark:border-green-600/40'
              : 'bg-gradient-to-r from-red-50/90 to-rose-50/90 text-red-700 dark:from-red-900/40 dark:to-rose-900/40 dark:text-red-300 border-red-300/60 dark:border-red-600/40'
          )}>
            <div className="relative flex items-center">
              <div className={cn(
                'h-3 w-3 rounded-full shadow-md relative',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )}>
                {isConnected && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                    <div className="absolute inset-0 rounded-full bg-green-500 animate-pulse" />
                  </>
                )}
              </div>
              {isConnected && (
                <div className="absolute -inset-1 rounded-full bg-green-400/20 animate-pulse" />
              )}
            </div>
            <div className="flex flex-col items-start">
              <span className="hidden md:inline font-bold tracking-wide">
                {isConnected ? 'Sistema Online' : 'Sistema Offline'}
              </span>
              <span className="hidden lg:inline text-[10px] opacity-75 font-medium">
                {isConnected ? 'Conectado e sincronizado' : 'Verificando conexão...'}
              </span>
            </div>
          </div>

          {/* Busca mobile */}
          <button
            onClick={onQuickActionsClick}
            className="p-3 rounded-2xl text-gray-500 hover:text-primary-600 hover:bg-primary-50/80 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 sm:hidden transition-all duration-300 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg group"
            aria-label="Buscar"
          >
            <MagnifyingGlassIcon className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
          </button>

          {/* Seletor de tema */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className="p-3 rounded-2xl text-gray-500 hover:text-primary-600 hover:bg-primary-50/80 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 transition-all duration-300 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg group"
              aria-label="Alterar tema"
            >
              {currentThemeOption && (
                <currentThemeOption.icon className="h-6 w-6 transition-transform duration-300 group-hover:rotate-180" />
              )}
            </button>

            <AnimatePresence>
              {themeMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 mt-3 w-52 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 z-[1100] border border-gray-200/50 dark:border-gray-700/50"
                >
                  <div className="py-2">
                    {themeOptions.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => {
                            changeTheme(option.value);
                            setThemeMenuOpen(false);
                          }}
                          className={cn(
                            'flex items-center w-full px-4 py-3 text-sm text-left transition-all duration-200 rounded-xl mx-2 font-medium',
                            theme === option.value
                              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 shadow-sm'
                              : 'text-gray-700 hover:bg-gray-100/80 dark:text-gray-300 dark:hover:bg-gray-700/80 hover:scale-[1.02]'
                          )}
                        >
                          <Icon className="h-4 w-4 mr-3" />
                          {option.label}
                          {theme === option.value && (
                            <div className="ml-auto h-2 w-2 bg-primary-500 rounded-full shadow-sm animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notificações */}
          <button
            onClick={onNotificationClick}
            className="relative p-3 rounded-2xl text-gray-500 hover:text-primary-600 hover:bg-primary-50/80 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 transition-all duration-300 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg group"
            aria-label="Notificações"
          >
            <BellIcon className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-6 w-6 bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-xl animate-bounce border-2 border-white dark:border-gray-800 ring-2 ring-red-200 dark:ring-red-800">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Centro de Notificações */}
          <button
            onClick={onNotificationCenterClick}
            className="p-3 rounded-2xl text-gray-500 hover:text-primary-600 hover:bg-primary-50/80 dark:hover:text-primary-400 dark:hover:bg-primary-900/20 transition-all duration-300 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg group"
            aria-label="Centro de Notificações"
            title="Centro de Notificações"
          >
            <svg className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c0 .621-.504 1.125-1.125 1.125H18a2.25 2.25 0 01-2.25-2.25M8.25 8.25h8.25" />
            </svg>
          </button>

          {/* Menu do usuário */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-3 p-3 rounded-xl text-gray-700 hover:bg-gray-100/80 dark:text-gray-300 dark:hover:bg-gray-700/80 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
              aria-label="Menu do usuário"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 rounded-full flex items-center justify-center shadow-md">
                <UserIcon className="h-4 w-4 text-white" />
              </div>
              <span className="hidden sm:block text-sm font-semibold truncate max-w-32">
                {user?.name || 'Usuário'}
              </span>
              <ChevronDownIcon className="hidden sm:block h-4 w-4" />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[1100]"
                >
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.name || 'Usuário'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.email || 'usuario@exemplo.com'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Role: {user?.role || 'OPERATOR'}
                    </p>
                  </div>
                  
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                      <UserIcon className="h-4 w-4 mr-3" />
                      Meu Perfil
                    </Link>
                    
                    <Link
                      to={user?.role === 'ADMIN' ? '/settings/system' : '/settings/personal'}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-3" />
                      Configurações
                    </Link>
                  </div>
                  
                  <div className="border-t border-gray-200 dark:border-gray-700 py-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                      Sair
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;