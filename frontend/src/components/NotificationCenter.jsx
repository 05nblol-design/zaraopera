import React, { useState, useEffect } from 'react';
import { 
  BellIcon, 
  XMarkIcon, 
  Cog6ToothIcon, 
  CheckIcon, 
  ExclamationCircleIcon, 
  InformationCircleIcon, 
  CheckCircleIcon, 
  XCircleIcon 
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';

const NotificationCenter = ({ onClose }) => {
  const { user, token } = useAuth();

  const [isOpen, setIsOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true
  });
  const [showSettings, setShowSettings] = useState(false);

  // Buscar notificações
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications?limit=20');
      console.log('NotificationCenter - Response:', response.data);
      if (response.data.success) {
        // Corrigir acesso à estrutura de dados da API
        const data = response.data.data || {};
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buscar configurações
  const fetchSettings = async () => {
    try {
      const response = await api.get('/notifications/settings');
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      // Usar configurações padrão em caso de erro
      setSettings({
        emailNotifications: true,
        pushNotifications: true
      });
    }
  };

  // Marcar como lida
  const markAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, read: true, readAt: new Date() }
            : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  // Marcar todas como lidas
  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, read: true, readAt: new Date() }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  // Atualizar configurações
  const updateSettings = async (newSettings) => {
    try {
      const response = await api.patch('/notifications/settings', newSettings);
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
    }
  };

  // Ícone por tipo de notificação
  const getNotificationIcon = (type, priority) => {
    const iconClass = `w-5 h-5 ${
      priority === 'URGENT' ? 'text-red-500' :
      priority === 'HIGH' ? 'text-orange-500' :
      priority === 'MEDIUM' ? 'text-yellow-500' : 'text-blue-500'
    }`;

    switch (type) {
      case 'QUALITY_TEST_MISSING':
      case 'MACHINE_ALERT':
        return <ExclamationCircleIcon className={iconClass} />;
      case 'TEFLON_EXPIRING':
      case 'TEFLON_EXPIRED':
        return <XCircleIcon className={iconClass} />;
      case 'SYSTEM_ALERT':
        return <InformationCircleIcon className={iconClass} />;
      default:
        return <CheckCircleIcon className={iconClass} />;
    }
  };

  // Formatar data
  const formatDate = (date) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffInHours = (now - notifDate) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Agora há pouco';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h atrás`;
    } else {
      return notifDate.toLocaleDateString('pt-BR');
    }
  };

  useEffect(() => {
    if (user && token) {
      fetchNotifications();
      fetchSettings();
    }
  }, [user, token]);

  // Atualizar a cada 5 segundos para tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      if (user && token && !isOpen) {
        fetchNotifications();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, token, isOpen]);

  return (
    <div className="w-full max-w-4xl bg-white rounded-lg shadow-lg">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 className="text-xl font-semibold text-gray-900">Centro de Notificações</h3>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Marcar todas como lidas
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 rounded"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Configurações */}
      {showSettings && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Configurações de Notificação</h4>
          <div className="space-y-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => updateSettings({ 
                  ...settings, 
                  emailNotifications: e.target.checked 
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-gray-700">Receber notificações por email</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.pushNotifications}
                onChange={(e) => updateSettings({ 
                  ...settings, 
                  pushNotifications: e.target.checked 
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-3 text-sm text-gray-700">Receber notificações push</span>
            </label>
          </div>
        </div>
      )}

      {/* Lista de notificações */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            Carregando notificações...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <BellIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhuma notificação encontrada</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-6 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                !notification.read ? 'bg-blue-50' : ''
              }`}
              onClick={() => !notification.read && markAsRead(notification.id)}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type, notification.priority)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-base font-medium ${
                      !notification.read ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rodapé */}
      {notifications.length > 0 && (
        <div className="p-4 border-t border-gray-200 text-center bg-gray-50">
          <button
            onClick={() => {
              onClose();
              // Navegar para página de notificações se existir
            }}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Ver todas as notificações
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;