import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  BellIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../hooks/useAuth';

// Utilitários
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NotificationPanel = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  
  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { user } = useAuth();

  // Filtrar notificações
  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.read;
      case 'read':
        return notification.read;
      default:
        return true;
    }
  });

  // Contar notificações não lidas
  const unreadCount = notifications.filter(n => !n.read).length;

  // Fechar menu de ações ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'error':
      case 'alert':
        return ExclamationTriangleIcon;
      case 'success':
        return CheckCircleIcon;
      case 'info':
      default:
        return InformationCircleIcon;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'error':
      case 'alert':
        return 'text-red-500';
      case 'success':
        return 'text-green-500';
      case 'info':
      default:
        return 'text-blue-500';
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Navegar para a página relacionada se houver
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const handleSelectNotification = (notificationId) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const handleBulkAction = async (action) => {
    switch (action) {
      case 'markRead':
        for (const id of selectedNotifications) {
          await markAsRead(id);
        }
        break;
      case 'delete':
        for (const id of selectedNotifications) {
          await deleteNotification(id);
        }
        break;
    }
    setSelectedNotifications([]);
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
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-25 z-30 lg:hidden"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-xl z-40 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <BellIcon className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notificações
                </h2>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              
              <button
                onClick={onClose}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Filtros */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex space-x-1">
                {[
                  { key: 'all', label: 'Todas' },
                  { key: 'unread', label: 'Não lidas' },
                  { key: 'read', label: 'Lidas' }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      'px-3 py-1 text-sm rounded-md transition-colors',
                      filter === key
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {/* Ações em lote */}
            {selectedNotifications.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {selectedNotifications.length} selecionada(s)
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleBulkAction('markRead')}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Marcar como lida
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}

            {/* Lista de notificações */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <BellIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Nenhuma notificação
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {filter === 'unread' 
                      ? 'Você não tem notificações não lidas'
                      : filter === 'read'
                      ? 'Você não tem notificações lidas'
                      : 'Você não tem notificações'
                    }
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNotifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const isSelected = selectedNotifications.includes(notification.id);
                    
                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          'relative p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors',
                          !notification.read && 'bg-blue-50/50 dark:bg-blue-900/10',
                          isSelected && 'bg-blue-100 dark:bg-blue-900/20'
                        )}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectNotification(notification.id)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />

                          {/* Ícone */}
                          <div className={cn(
                            'flex-shrink-0 mt-0.5',
                            getNotificationColor(notification.type)
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>

                          {/* Conteúdo */}
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className={cn(
                                  'text-sm font-medium',
                                  notification.read 
                                    ? 'text-gray-700 dark:text-gray-300'
                                    : 'text-gray-900 dark:text-white'
                                )}>
                                  {notification.title}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  {notification.message}
                                </p>
                                
                                {/* Metadados */}
                                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                                  <div className="flex items-center space-x-1">
                                    <ClockIcon className="h-3 w-3" />
                                    <span>
                                      {(() => {
                                        const date = new Date(notification.createdAt);
                                        return isNaN(date.getTime()) 
                                          ? 'Data inválida'
                                          : formatDistanceToNow(date, {
                                              addSuffix: true,
                                              locale: ptBR
                                            });
                                      })()}
                                    </span>
                                  </div>
                                  
                                  {notification.machineId && (
                                    <span>Máquina: {notification.machineId}</span>
                                  )}
                                  
                                  {notification.userId && notification.userId !== user?.id && (
                                    <span>De: {notification.userName || 'Sistema'}</span>
                                  )}
                                </div>
                              </div>

                              {/* Menu de ações */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpen(
                                      actionMenuOpen === notification.id ? null : notification.id
                                    );
                                  }}
                                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-600"
                                >
                                  <EllipsisVerticalIcon className="h-4 w-4" />
                                </button>

                                {actionMenuOpen === notification.id && (
                                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                                    <div className="py-1">
                                      {!notification.read && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            markAsRead(notification.id);
                                            setActionMenuOpen(null);
                                          }}
                                          className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                                        >
                                          <EyeIcon className="h-4 w-4 mr-3" />
                                          Marcar como lida
                                        </button>
                                      )}
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteNotification(notification.id);
                                          setActionMenuOpen(null);
                                        }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                      >
                                        <TrashIcon className="h-4 w-4 mr-3" />
                                        Excluir
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Indicador de não lida */}
                        {!notification.read && (
                          <div className="absolute left-2 top-1/2 transform -translate-y-1/2 h-2 w-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  // Navegar para página de notificações completa
                  window.location.href = '/notifications';
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Ver todas as notificações
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;