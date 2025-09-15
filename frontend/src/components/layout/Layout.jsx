import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';

// Componentes do layout
import Sidebar from './Sidebar';
import Header from './Header';
import Breadcrumbs from './Breadcrumbs';
import Footer from './Footer';
import MobileMenu from './MobileMenu';
import NotificationPanel from './NotificationPanel';
import QuickActions from './QuickActions';
import NotificationCenter from '../NotificationCenter';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useSocket } from '@/hooks/useSocket';

// Utilitários
import { cn } from '@/lib/utils';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { isConnected } = useSocket();
  const location = useLocation();

  // Fechar sidebar mobile ao mudar de rota
  useEffect(() => {
    setSidebarOpen(false);
    setNotificationPanelOpen(false);
    setQuickActionsOpen(false);
    setNotificationCenterOpen(false);
  }, [location.pathname]);

  // Detectar tamanho da tela para sidebar
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        setSidebarCollapsed(false);
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Carregar preferência de sidebar colapsada
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('sidebarCollapsed');
    if (savedCollapsed !== null) {
      setSidebarCollapsed(JSON.parse(savedCollapsed));
    }
  }, []);

  // Salvar preferência de sidebar colapsada
  const handleSidebarCollapse = (collapsed) => {
    setSidebarCollapsed(collapsed);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(collapsed));
  };

  // Fechar painéis ao clicar fora
  const handleOverlayClick = () => {
    setSidebarOpen(false);
    setNotificationPanelOpen(false);
    setQuickActionsOpen(false);
    setNotificationCenterOpen(false);
  };

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd + K para abrir busca rápida
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setQuickActionsOpen(true);
      }
      
      // Ctrl/Cmd + B para alternar sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (window.innerWidth >= 1024) {
          handleSidebarCollapse(!sidebarCollapsed);
        } else {
          setSidebarOpen(!sidebarOpen);
        }
      }
      
      // Escape para fechar painéis
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setNotificationPanelOpen(false);
        setQuickActionsOpen(false);
        setNotificationCenterOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarCollapsed, sidebarOpen]);

  return (
    <>
      <Helmet>
        <body className={cn(
          'bg-gray-50 text-gray-900 transition-colors duration-200',
          isDark && 'dark:bg-gray-900 dark:text-gray-100'
        )} />
      </Helmet>

      <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
        {/* Sidebar Desktop */}
        <div className={cn(
          'hidden lg:flex lg:flex-shrink-0 transition-all duration-300 ease-in-out relative z-20',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
        )}>
          <Sidebar 
            collapsed={sidebarCollapsed}
            onCollapse={handleSidebarCollapse}
          />
        </div>

        {/* Sidebar Mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
                onClick={handleOverlayClick}
              />
              
              {/* Mobile Sidebar */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden"
              >
                <MobileMenu isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Conteúdo Principal */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <Header 
            onMenuClick={() => setSidebarOpen(true)}
            onNotificationClick={() => setNotificationPanelOpen(true)}
            onNotificationCenterClick={() => setNotificationCenterOpen(true)}
            onQuickActionsClick={() => setQuickActionsOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
          />

          {/* Breadcrumbs */}
          <div className="border-b border-gray-200 bg-white px-6 py-2 dark:border-gray-700 dark:bg-gray-800 lg:px-12 relative z-0">
            <Breadcrumbs />
          </div>

          {/* Área de Conteúdo */}
          <main className="flex-1 overflow-y-auto focus:outline-none relative z-0">
            <div className="relative min-h-full">
              {/* Indicador de conexão */}
              {!isConnected && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 dark:bg-yellow-900/20 dark:border-yellow-500">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700 dark:text-yellow-200">
                        Conexão em tempo real perdida. Algumas funcionalidades podem não funcionar corretamente.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Conteúdo da página */}
              <div className="px-6 py-8 sm:px-8 lg:px-12 pb-12">
                {children || <Outlet />}
              </div>
            </div>
          </main>

          {/* Footer */}
          <div className="relative z-1 mt-auto">
            <Footer />
          </div>
        </div>

        {/* Painel de Notificações */}
        <AnimatePresence>
          {notificationPanelOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-black bg-opacity-50"
                onClick={handleOverlayClick}
              />
              
              {/* Painel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.3 }}
                className="fixed inset-y-0 right-0 z-50 w-80 sm:w-96"
              >
                <NotificationPanel 
                  isOpen={notificationPanelOpen}
                  onClose={() => setNotificationPanelOpen(false)} 
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Ações Rápidas */}
        <QuickActions 
          isOpen={quickActionsOpen}
          onClose={() => setQuickActionsOpen(false)}
        />

        {/* Centro de Notificações */}
        <AnimatePresence>
          {notificationCenterOpen && (
            <>
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black bg-opacity-50"
                onClick={handleOverlayClick}
              />
              
              {/* Modal */}
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
                >
                  <NotificationCenter 
                    onClose={() => setNotificationCenterOpen(false)}
                  />
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Indicador de status de conexão (canto inferior direito) */}
      <div className="fixed bottom-4 right-4 z-30">
        <div className={cn(
          'flex items-center space-x-2 rounded-full px-3 py-1 text-xs font-medium shadow-lg transition-all duration-200',
          isConnected 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        )}>
          <div className={cn(
            'h-2 w-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500'
          )} />
          <span>
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Informações do usuário para desenvolvimento - OCULTO */}
      {/* {import.meta.env.DEV && (
        <div className="fixed bottom-4 left-4 z-30">
          <div className="rounded-lg bg-gray-800 px-3 py-2 text-xs text-white shadow-lg">
            <div>Usuário: {user?.name}</div>
            <div>Role: {user?.role}</div>
            <div>Socket: {isConnected ? 'Conectado' : 'Desconectado'}</div>
          </div>
        </div>
      )} */}
    </>
  );
};

export default Layout;