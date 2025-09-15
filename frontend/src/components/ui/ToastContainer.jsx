import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import Toast from './Toast';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/hooks/useAuth';
import { useSoundSettings } from '@/hooks/useSoundSettings';

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);
  const { socket } = useSocket();
  const { user } = useAuth();
  const { playNotificationSound, shouldPlaySound } = useSoundSettings();

  // Adicionar toast
  const addToast = useCallback((toastData) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      ...toastData,
      timestamp: new Date()
    };

    setToasts(prev => {
      // Limitar a 5 toasts simultâneos
      const updated = [newToast, ...prev].slice(0, 5);
      return updated;
    });

    // Reproduzir som baseado nas configurações do usuário
    if (shouldPlaySound(toastData.priority)) {
      playNotificationSound(toastData.priority);
    }

    return id;
  }, [shouldPlaySound, playNotificationSound]);

  // Remover toast
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Limpar todos os toasts
  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Escutar notificações via Socket.IO
  useEffect(() => {
    if (!socket || !user) return;

    const handleNotification = (notification) => {
      console.log('Nova notificação recebida:', notification);
      
      // Mapear tipo de notificação para prioridade do toast
      const getPriority = (type, priority) => {
        if (priority === 'critical') return 'critical';
        if (priority === 'warning') return 'warning';
        if (type === 'success' || type === 'completed') return 'success';
        return 'info';
      };

      // Criar botão de ação baseado no tipo
      const getActionButton = (type, data) => {
        switch (type) {
          case 'quality_test_missing':
            return (
              <button
                onClick={() => {
                  // Navegar para formulário de teste
                  window.location.href = `/quality-test/new?machine=${data.machineId}`;
                }}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                Registrar Teste
              </button>
            );
          case 'teflon_change_due':
            return (
              <button
                onClick={() => {
                  // Navegar para troca de teflon
                  window.location.href = `/teflon/change?machine=${data.machineId}`;
                }}
                className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors"
              >
                Trocar Teflon
              </button>
            );
          case 'machine_stopped':
            return (
              <button
                onClick={() => {
                  // Navegar para detalhes da máquina
                  window.location.href = `/machines/${data.machineId}`;
                }}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                Ver Máquina
              </button>
            );
          default:
            return null;
        }
      };

      addToast({
        type: notification.type,
        priority: getPriority(notification.type, notification.priority),
        title: notification.title,
        message: notification.message,
        duration: notification.priority === 'critical' ? 0 : 8000, // Críticos não fecham automaticamente
        actionButton: getActionButton(notification.type, notification.data)
      });
    };

    // Removido listeners de notificação para evitar duplicação
    // As notificações agora são tratadas apenas pelo NotificationContext.jsx
    // que já inclui som e toasts apropriados
    
    return () => {
      // Cleanup removido pois não há mais listeners
    };
  }, [socket, user, addToast]);

  // Expor funções globalmente para uso em outros componentes
  useEffect(() => {
    window.showToast = addToast;
    window.clearToasts = clearAllToasts;
    
    return () => {
      delete window.showToast;
      delete window.clearToasts;
    };
  }, [addToast, clearAllToasts]);

  // Função helper para mostrar toasts programaticamente
  const showSuccess = (message, title = 'Sucesso') => {
    addToast({ type: 'success', priority: 'success', title, message });
  };

  const showError = (message, title = 'Erro') => {
    addToast({ type: 'error', priority: 'critical', title, message, duration: 0 });
  };

  const showWarning = (message, title = 'Atenção') => {
    addToast({ type: 'warning', priority: 'warning', title, message });
  };

  const showInfo = (message, title = 'Informação') => {
    addToast({ type: 'info', priority: 'info', title, message });
  };

  // Expor funções helper
  useEffect(() => {
    window.toast = {
      success: showSuccess,
      error: showError,
      warning: showWarning,
      info: showInfo
    };

    return () => {
      delete window.toast;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {/* Botão para limpar todos (se houver mais de 2 toasts) */}
      {toasts.length > 2 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={clearAllToasts}
            className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition-colors"
          >
            Limpar Todos ({toasts.length})
          </button>
        </div>
      )}

      {/* Lista de toasts */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          priority={toast.priority}
          title={toast.title}
          message={toast.message}
          duration={toast.duration}
          onClose={removeToast}
          actionButton={toast.actionButton}
        />
      ))}
    </div>
  );
};

export default ToastContainer;