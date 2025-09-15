import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  BellIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  CogIcon,
  BeakerIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NotificationPopup = ({ notification, onClose, onAction }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(10); // 10 segundos para auto-close

  // Auto-close após 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleAction = (action) => {
    if (onAction) {
      onAction(action);
    }
    handleClose();
  };

  // Ícones por tipo de notificação
  const getIcon = () => {
    switch (notification.type) {
      case 'MACHINE_STATUS':
        return <CogIcon className="h-6 w-6" />;
      case 'QUALITY_TEST':
        return <BeakerIcon className="h-6 w-6" />;
      case 'TEFLON_CHANGE':
        return <WrenchScrewdriverIcon className="h-6 w-6" />;
      case 'SYSTEM':
        return <InformationCircleIcon className="h-6 w-6" />;
      default:
        return <BellIcon className="h-6 w-6" />;
    }
  };

  // Cores por prioridade
  const getPriorityColors = () => {
    switch (notification.priority) {
      case 'HIGH':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          icon: 'text-red-600 dark:text-red-400',
          title: 'text-red-900 dark:text-red-100',
          progress: 'bg-red-500'
        };
      case 'MEDIUM':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-200 dark:border-yellow-800',
          icon: 'text-yellow-600 dark:text-yellow-400',
          title: 'text-yellow-900 dark:text-yellow-100',
          progress: 'bg-yellow-500'
        };
      case 'LOW':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'text-blue-600 dark:text-blue-400',
          title: 'text-blue-900 dark:text-blue-100',
          progress: 'bg-blue-500'
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-900/20',
          border: 'border-gray-200 dark:border-gray-800',
          icon: 'text-gray-600 dark:text-gray-400',
          title: 'text-gray-900 dark:text-gray-100',
          progress: 'bg-gray-500'
        };
    }
  };

  const colors = getPriorityColors();
  const progressWidth = (timeLeft / 10) * 100;

  if (!notification) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 300, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 300, scale: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={cn(
            'fixed top-4 right-4 z-[9999] w-96 max-w-[calc(100vw-2rem)] rounded-lg shadow-2xl border-2',
            colors.bg,
            colors.border
          )}
        >
          {/* Barra de progresso */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden">
            <motion.div
              className={cn('h-full', colors.progress)}
              initial={{ width: '100%' }}
              animate={{ width: `${progressWidth}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>

          <div className="p-4 pt-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={cn('p-2 rounded-full bg-white dark:bg-gray-800 shadow-sm', colors.icon)}>
                  {getIcon()}
                </div>
                <div className="flex-1">
                  <h3 className={cn('font-semibold text-sm', colors.title)}>
                    {notification.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {(() => {
                      const date = new Date(notification.timestamp || notification.created_at);
                      return isNaN(date.getTime()) 
                        ? 'Data inválida'
                        : formatDistanceToNow(date, {
                            addSuffix: true,
                            locale: ptBR
                          });
                    })()}
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleClose}
                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {notification.message}
              </p>
              
              {/* Informações adicionais */}
              {notification.metadata && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {notification.metadata.machineName && (
                    <span className="inline-block bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded mr-2">
                      Máquina: {notification.metadata.machineName}
                    </span>
                  )}
                  {notification.metadata.operatorName && (
                    <span className="inline-block bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      Operador: {notification.metadata.operatorName}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                {notification.type === 'MACHINE_STATUS' && (
                  <button
                    onClick={() => handleAction('view_machine')}
                    className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    Ver Máquina
                  </button>
                )}
                
                {notification.type === 'QUALITY_TEST' && (
                  <button
                    onClick={() => handleAction('view_test')}
                    className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    Ver Teste
                  </button>
                )}
                
                {notification.type === 'TEFLON_CHANGE' && (
                  <button
                    onClick={() => handleAction('view_teflon')}
                    className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 rounded-md hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                  >
                    Ver Teflon
                  </button>
                )}
              </div>
              
              <span className="text-xs text-gray-500">
                {timeLeft}s
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationPopup;