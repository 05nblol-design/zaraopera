import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { notificationService } from '../services/api';
import soundService from '../services/soundService';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications deve ser usado dentro de NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const { token, user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Buscar notificações iniciais
  useEffect(() => {
    // Aguardar a autenticação ser verificada antes de buscar notificações
    if (authLoading) {
      console.log('⏳ Aguardando verificação de autenticação...');
      return;
    }
    
    if (isAuthenticated && token && user) {
      console.log('🔔 Buscando notificações iniciais para usuário:', user.name);
      fetchNotifications();
    } else {
      // Se não há usuário logado, definir estado inicial sem erro
      console.log('👤 Usuário não autenticado, limpando notificações');
      setLoading(false);
      setNotifications([]);
      setError(null);
    }
  }, [isAuthenticated, token, user, authLoading]);

  // Escutar novas notificações em tempo real (apenas uma vez)
  useEffect(() => {
    if (socket && isConnected) {
      console.log('🔔 Configurando listeners de notificação...');
      
      const handleNewNotification = (notification) => {
        console.log('📨 Nova notificação recebida:', notification);
        
        // Verificar se já existe esta notificação para evitar duplicatas
        setNotifications(prev => {
          const exists = prev.some(existing => {
            // Verificar por ID se existir
            if (notification.id && existing.id === notification.id) {
              return true;
            }
            // Verificar por conteúdo e timestamp próximo (dentro de 5 segundos)
            if (existing.title === notification.title && existing.message === notification.message) {
              const existingTime = new Date(existing.timestamp || existing.created_at || existing.createdAt).getTime();
              const notificationTime = new Date(notification.timestamp || notification.created_at || notification.createdAt || new Date()).getTime();
              const timeDiff = Math.abs(existingTime - notificationTime);
              return timeDiff < 5000; // 5 segundos
            }
            return false;
          });
          
          if (exists) {
            console.log('🚫 Notificação duplicada ignorada:', notification);
            return prev;
          }
          
          return [notification, ...prev];
        });
        
        // Reproduzir som baseado no tipo e prioridade da notificação
        soundService.playAlertByType(notification.type || 'info', notification.priority || 'medium');
        
        // Mostrar toast apenas para notificações azuis (LOW priority)
        if (notification.priority === 'LOW') {
          toast(notification.message, {
            duration: 4000,
            icon: getNotificationIcon(notification.type),
            style: {
              background: '#dbeafe',
              color: '#1e40af',
              border: '1px solid #93c5fd'
            }
          });
        }
        // Remover toasts para HIGH e MEDIUM para evitar duplicação
        // As notificações ainda aparecem nos popups via useNotificationPopups
      };

      const handleNotificationUpdate = (updatedNotification) => {
        console.log('🔄 Notificação atualizada:', updatedNotification);
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === updatedNotification.id 
              ? { ...notification, ...updatedNotification }
              : notification
          )
        );
      };

      const handleBulkUpdate = (updatedNotifications) => {
        console.log('📦 Atualização em lote de notificações:', updatedNotifications.length);
        setNotifications(updatedNotifications);
      };

      socket.on('new-notification', handleNewNotification);
      socket.on('notification-updated', handleNotificationUpdate);
      socket.on('notifications-bulk-update', handleBulkUpdate);

      return () => {
        console.log('🧹 Removendo listeners de notificação...');
        socket.off('new-notification', handleNewNotification);
        socket.off('notification-updated', handleNotificationUpdate);
        socket.off('notifications-bulk-update', handleBulkUpdate);
      };
    }
  }, [socket, isConnected]);

  // Calcular notificações não lidas
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  const fetchNotifications = async (page = 1, limit = 50) => {
    try {
      setLoading(true);
      setError(null);

      const response = await notificationService.getAll({ page, limit });
      const responseData = response.data;

      if (responseData.success) {
        // Corrigir acesso à estrutura de dados da API
        const data = responseData.data || {};
        if (page === 1) {
          setNotifications(data.notifications || []);
        } else {
          setNotifications(prev => [...prev, ...(data.notifications || [])]);
        }
      } else {
        throw new Error('Erro ao buscar notificações');
      }
    } catch (err) {
      console.error('Erro ao buscar notificações:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      QUALITY_TEST: '🔬',
      MACHINE_STATUS: '🏭',
      PRODUCTION: '📊',
      MAINTENANCE: '🔧',
      ALERT: '⚠️',
      INFO: 'ℹ️',
      SUCCESS: '✅',
      WARNING: '⚠️',
      ERROR: '❌'
    };
    return icons[type] || '🔔';
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await notificationService.markAsRead(notificationId);
      const data = response.data;

      if (data.success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true, readAt: new Date().toISOString() }
              : notification
          )
        );
        return { success: true };
      } else {
        throw new Error('Erro ao marcar notificação como lida');
      }
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
      return { success: false, error: err.message };
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await notificationService.markAllAsRead();
      const data = response.data;

      if (data.success) {
        setNotifications(prev => 
          prev.map(notification => ({
            ...notification,
            read: true,
            readAt: new Date().toISOString()
          }))
        );
        return { success: true };
      } else {
        throw new Error('Erro ao marcar todas as notificações como lidas');
      }
    } catch (err) {
      console.error('Erro ao marcar todas como lidas:', err);
      return { success: false, error: err.message };
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await notificationService.delete(notificationId);
      const data = response.data;

      if (data.success) {
        setNotifications(prev => 
          prev.filter(notification => notification.id !== notificationId)
        );
        return { success: true };
      } else {
        throw new Error('Erro ao excluir notificação');
      }
    } catch (err) {
      console.error('Erro ao excluir notificação:', err);
      return { success: false, error: err.message };
    }
  };

  const clearAllNotifications = async () => {
    try {
      const response = await notificationService.deleteAll();
      const data = response.data;

      if (data.success) {
        setNotifications([]);
        return { success: true };
      } else {
        throw new Error('Erro ao limpar todas as notificações');
      }
    } catch (err) {
      console.error('Erro ao limpar notificações:', err);
      return { success: false, error: err.message };
    }
  };

  const getNotificationsByType = (type) => {
    return notifications.filter(notification => notification.type === type);
  };

  const getNotificationsByPriority = (priority) => {
    return notifications.filter(notification => notification.priority === priority);
  };

  const getUnreadNotifications = () => {
    return notifications.filter(notification => !notification.read);
  };

  const getRecentNotifications = (hours = 24) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return notifications.filter(notification => 
      new Date(notification.createdAt) > cutoff
    );
  };

  const refreshNotifications = () => {
    fetchNotifications();
  };

  const value = {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    getNotificationsByType,
    getNotificationsByPriority,
    getUnreadNotifications,
    getRecentNotifications,
    refreshNotifications,
    fetchMore: (page) => fetchNotifications(page)
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};