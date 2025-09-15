import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  XMarkIcon,
  HomeIcon,
  BeakerIcon,
  ChartBarIcon,
  CogIcon,
  UserIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  UsersIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import useMachinePermissions from '../../hooks/useMachinePermissions';
import { getNavigationItems } from '../../config/routes';
import { cn } from '../../lib/utils';

const iconMap = {
  HomeIcon,
  CogIcon: WrenchScrewdriverIcon,
  CheckCircleIcon: BeakerIcon,
  ShieldCheckIcon,
  ChartBarIcon: DocumentTextIcon,
  BellIcon,
  UsersIcon,
  UserIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  DocumentTextIcon
};

const MobileMenu = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { hasAnyMachinePermission } = useMachinePermissions();

  // Menu específico para mobile - operadores usam tablet com itens individuais
  const navigationItems = useMemo(() => {
    if (user?.role === 'OPERATOR') {
      const operatorMobileItems = [
        { name: 'Dashboard', path: '/', icon: 'HomeIcon' },
        { name: 'Qualidade', path: '/quality', icon: 'CheckCircleIcon' },
        { name: 'Teflon', path: '/teflon', icon: 'ShieldCheckIcon' },
        { name: 'Configuração', path: '/settings', icon: 'CogIcon' }
      ];
      
      // Adicionar Máquina apenas se o operador tiver permissões
      if (hasAnyMachinePermission()) {
        operatorMobileItems.splice(3, 0, { name: 'Máquina', path: '/machines', icon: 'Cog6ToothIcon' });
      }
      
      return operatorMobileItems;
    }
    
    // Para outros papéis, usar a lógica padrão do desktop
    return getNavigationItems(user?.role || 'OPERATOR');
  }, [user?.role, hasAnyMachinePermission]);

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onClose}
          />
          
          {/* Menu */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 left-0 bottom-0 w-80 bg-white dark:bg-gray-800 shadow-xl z-50 lg:hidden"
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">Z</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Zara Operação
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Sistema de Qualidade
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* User Info */}
              {user && (
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                      <UserIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {user.role === 'OPERATOR' && 'Operador'}
                        {user.role === 'LEADER' && 'Líder'}
                        {user.role === 'MANAGER' && 'Gestor'}
                        {user.role === 'ADMIN' && 'Administrador'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                {navigationItems.map((item) => {
                  const Icon = iconMap[item.icon] || HomeIcon;
                  const isActive = location.pathname === item.path;
                  
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={onClose}
                      className={cn(
                        'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileMenu;