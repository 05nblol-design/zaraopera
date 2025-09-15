import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';

const useNotificationPopups = () => {
  const [popups, setPopups] = useState([]);
  const [maxPopups] = useState(3); // Máximo de 3 pop-ups simultâneos
  const socket = useSocket();

  // Tipos de notificação que devem aparecer como pop-up
  const popupTypes = [
    'MACHINE_STATUS',
    'QUALITY_TEST', 
    'TEFLON_CHANGE',
    'SYSTEM'
  ];

  // Prioridades que devem aparecer como pop-up
  const popupPriorities = ['HIGH', 'MEDIUM', 'LOW'];

  // Função para determinar se uma notificação deve aparecer como pop-up
  const shouldShowPopup = useCallback((notification) => {
    // Verificar se é um tipo que deve aparecer como pop-up
    if (!popupTypes.includes(notification.type)) {
      return false;
    }

    // Verificar se é uma prioridade que deve aparecer como pop-up
    if (!popupPriorities.includes(notification.priority)) {
      return false;
    }

    // Verificar se a notificação tem canais que incluem 'popup'
    if (notification.channels && Array.isArray(notification.channels)) {
      return notification.channels.includes('popup');
    }

    // Por padrão, mostrar pop-up para notificações de alta prioridade
    return notification.priority === 'HIGH';
  }, []);

  // Adicionar nova notificação pop-up
  const addPopup = useCallback((notification) => {
    if (!shouldShowPopup(notification)) {
      return;
    }

    const popupId = `popup-${notification.id || Date.now()}-${Math.random()}`;
    const newPopup = {
      ...notification,
      popupId,
      timestamp: notification.timestamp || notification.created_at || new Date().toISOString()
    };

    setPopups(current => {
      // Se já temos o máximo de pop-ups, remover o mais antigo
      const updatedPopups = current.length >= maxPopups 
        ? current.slice(1) 
        : current;
      
      // Verificar se já existe um pop-up para esta notificação (verificação mais rigorosa)
      const exists = updatedPopups.some(popup => {
        // Verificar por ID se existir
        if (notification.id && popup.id === notification.id) {
          return true;
        }
        // Verificar por conteúdo e timestamp próximo (dentro de 5 segundos)
        if (popup.title === notification.title && popup.message === notification.message) {
          const popupTime = new Date(popup.timestamp).getTime();
          const notificationTime = new Date(notification.timestamp || notification.created_at || new Date()).getTime();
          const timeDiff = Math.abs(popupTime - notificationTime);
          return timeDiff < 5000; // 5 segundos
        }
        return false;
      });
      
      if (exists) {
        return updatedPopups;
      }
      
      return [...updatedPopups, newPopup];
    });
  }, [shouldShowPopup, maxPopups]);

  // Remover pop-up
  const removePopup = useCallback((popupId) => {
    setPopups(current => current.filter(popup => popup.popupId !== popupId));
  }, []);

  // Limpar todos os pop-ups
  const clearAllPopups = useCallback(() => {
    setPopups([]);
  }, []);

  // Lidar com ações do pop-up
  const handlePopupAction = useCallback((action, notification) => {
    switch (action) {
      case 'view_machine':
        if (notification.metadata?.machineId) {
          // Navegar para a página da máquina
          window.location.href = `/machines/${notification.metadata.machineId}`;
        }
        break;
        
      case 'view_test':
        if (notification.metadata?.testId) {
          // Navegar para a página do teste
          window.location.href = `/quality-tests/${notification.metadata.testId}`;
        }
        break;
        
      case 'view_teflon':
        if (notification.metadata?.teflonId) {
          // Navegar para a página do teflon
          window.location.href = `/teflon/${notification.metadata.teflonId}`;
        }
        break;
        
      default:
        console.log('Ação não reconhecida:', action);
    }
  }, []);

  // Escutar eventos do socket
  useEffect(() => {
    if (!socket) return;

    // Escutar novas notificações
    const handleNewNotification = (notification) => {
      console.log('Nova notificação recebida:', notification);
      addPopup(notification);
    };

    // Escutar notificações específicas que sempre devem aparecer como pop-up
    const handleMachineAlert = (data) => {
      addPopup({
        id: `machine-${Date.now()}`,
        type: 'MACHINE_STATUS',
        priority: 'HIGH',
        title: 'Alerta de Máquina',
        message: data.message || 'Status da máquina alterado',
        metadata: {
          machineId: data.machineId,
          machineName: data.machineName,
          status: data.status
        },
        channels: ['popup', 'database'],
        timestamp: new Date().toISOString()
      });
    };

    const handleQualityAlert = (data) => {
      addPopup({
        id: `quality-${Date.now()}`,
        type: 'QUALITY_TEST',
        priority: data.approved ? 'MEDIUM' : 'HIGH',
        title: data.approved ? 'Teste de Qualidade Aprovado' : 'Teste de Qualidade Reprovado',
        message: data.message || `Teste ${data.approved ? 'aprovado' : 'reprovado'}`,
        metadata: {
          testId: data.testId,
          operatorName: data.operatorName,
          approved: data.approved
        },
        channels: ['popup', 'database'],
        timestamp: new Date().toISOString()
      });
    };

    const handleTeflonAlert = (data) => {
      addPopup({
        id: `teflon-${Date.now()}`,
        type: 'TEFLON_CHANGE',
        priority: 'HIGH',
        title: 'Alerta de Teflon',
        message: data.message || 'Teflon próximo do vencimento',
        metadata: {
          teflonId: data.teflonId,
          machineName: data.machineName,
          expiryDate: data.expiryDate
        },
        channels: ['popup', 'database'],
        timestamp: new Date().toISOString()
      });
    };

    // Registrar listeners (removido 'new-notification' para evitar duplicação)
    socket.on('machine:status:changed', handleMachineAlert);
    socket.on('quality-test:failed', handleQualityAlert);
    socket.on('quality-test:created', handleQualityAlert);
    socket.on('teflon:expiring:alert', handleTeflonAlert);

    // Cleanup
    return () => {
      socket.off('machine:status:changed', handleMachineAlert);
      socket.off('quality-test:failed', handleQualityAlert);
      socket.off('quality-test:created', handleQualityAlert);
      socket.off('teflon:expiring:alert', handleTeflonAlert);
    };
  }, [socket, addPopup]);

  return {
    popups,
    addPopup,
    removePopup,
    clearAllPopups,
    handlePopupAction
  };
};

export default useNotificationPopups;