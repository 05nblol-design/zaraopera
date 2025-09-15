import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { useAuth } from './useAuth';

const SocketContext = createContext({});

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de um SocketProvider');
  }
  
  // console.log('🚀 useSocket hook executado:', {
  //   hasSocket: !!context.socket,
  //   isConnected: context.isConnected,
  //   onlineUsersCount: context.onlineUsers?.length || 0
  // });
  
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  console.log('🏗️ SocketProvider renderizado:', {
    isAuthenticated,
    hasToken: !!token,
    hasUser: !!user,
    userId: user?.id,
    userRole: user?.role
  });

  const connectSocket = () => {
    console.log('🔍 connectSocket chamado:', {
      socketExists: !!socket,
      hasToken: !!token,
      hasUser: !!user,
      isAuthenticated
    });
    
    // Se já existe um socket conectado, não criar outro
    if (socket && socket.connected) {
      console.log('✅ Socket já conectado');
      return;
    }
    
    // Verificar se temos token, usuário e estamos autenticados
    if (!token || !user || !isAuthenticated) {
      console.log('❌ Token, usuário ou autenticação não disponível');
      return;
    }

    // Detectar automaticamente a URL do socket - prioriza ngrok se configurado
    const getSocketUrl = () => {
      // Se VITE_SOCKET_URL está configurado (ngrok), usar sempre
      if (import.meta.env.VITE_SOCKET_URL && import.meta.env.VITE_SOCKET_URL.includes('ngrok')) {
        return import.meta.env.VITE_SOCKET_URL;
      }
      
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return import.meta.env.VITE_SOCKET_URL_LOCAL || 'http://localhost:3001';
      } else {
        return import.meta.env.VITE_SOCKET_URL || `http://${hostname}:3001`;
      }
    };

    const socketUrl = getSocketUrl();
    console.log('🌐 Socket URL:', socketUrl);
    console.log('🔑 Token para auth:', token ? 'presente' : 'ausente');
    console.log('👤 User ID:', user?.id);

    console.log('🚀 Criando novo socket...');
    const newSocket = io(socketUrl, {
      auth: {
        token: token,
        userId: user?.id
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
    
    console.log('📡 Socket criado:', newSocket);

    // Eventos de conexão
    newSocket.on('connect', () => {
      console.log('✅ Socket conectado:', newSocket.id);
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      toast.success('Conectado ao servidor');
      
      // Entrar na sala do usuário
      newSocket.emit('join-user-room', user.id);
      
      // Entrar na sala baseada no papel do usuário
      if (user.role) {
        newSocket.emit('join-role-room', user.role);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket desconectado:', reason);
      setIsConnected(false);
      setOnlineUsers([]);
      
      // Tentar reconectar apenas se não foi uma desconexão intencional
      // e se ainda estamos autenticados
      if (reason !== 'io client disconnect' && 
          reason !== 'io server disconnect' && 
          isAuthenticated && token && user) {
        console.log('🔄 Tentando reconectar em 3 segundos...');
        setTimeout(() => {
          if (isAuthenticated && token && user) {
            connectSocket();
          } else {
            console.log('❌ Não reconectando - usuário não autenticado');
          }
        }, 3000);
      } else {
         console.log('🚫 Não tentando reconectar:', { reason, isAuthenticated, hasToken: !!token, hasUser: !!user });
       }
     });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Erro de conexão:', error);
      setConnectionError(error.message);
      setIsConnected(false);
      
      // Se o erro for de token inválido, desconectar completamente
      if (error.message && (error.message.includes('Token inválido') || error.message.includes('Token não fornecido'))) {
        console.log('🔒 Token inválido detectado, desconectando socket');
        // Desconectar o socket imediatamente
        newSocket.disconnect();
        setSocket(null);
        // Não limpar localStorage aqui, deixar o AuthContext gerenciar
        return;
      }
      
      toast.error(`Erro de conexão: ${error.message}`);
      
      // Tentar reconectar com backoff exponencial apenas se não for erro de token
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.pow(2, reconnectAttempts.current) * 1000;
        setTimeout(() => {
          reconnectAttempts.current++;
          newSocket.connect();
        }, delay);
      } else {
        toast.error('Não foi possível conectar ao servidor. Verifique sua conexão.');
      }
    });

    // Eventos de usuários online
    newSocket.on('users-online', (users) => {
      setOnlineUsers(users);
    });

    newSocket.on('user-joined', (userData) => {
      setOnlineUsers(prev => [...prev.filter(u => u.id !== userData.id), userData]);
    });

    newSocket.on('user-left', (userId) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== userId));
    });

    // Eventos de notificações
    newSocket.on('notification', (notification) => {
      toast.success(notification.message, {
        duration: 5000,
        icon: '🔔'
      });
    });

    newSocket.on('alert', (alert) => {
      toast.error(alert.message, {
        duration: 8000,
        icon: '⚠️'
      });
    });

    // Eventos de máquinas
    newSocket.on('machine:status:changed', (data) => {
      console.log('🔄 Dados recebidos do WebSocket:', data);
      const machineName = data.machineName || 'Desconhecida';
      const status = data.newStatus || data.status || 'Status desconhecido';
      toast(`Máquina ${machineName}: ${status}`, {
        duration: 4000,
        icon: '🏭'
      });
    });

    // Eventos de operações - Removido toasts duplicados (notificações já são enviadas via 'new-notification')
    newSocket.on('machine:operation-started', (data) => {
      console.log('🚀 Operação iniciada via WebSocket:', data);
      // Toast removido para evitar duplicação com notificações
    });

    newSocket.on('machine:operation-ended', (data) => {
      console.log('🛑 Operação finalizada via WebSocket:', data);
      // Toast removido para evitar duplicação com notificações
    });

    // Eventos de testes de qualidade
    newSocket.on('quality-test-created', (data) => {
      if (user.role === 'LEADER' || user.role === 'MANAGER' || user.role === 'ADMIN') {
        toast.success(`Novo teste de qualidade criado por ${data.operatorName}`, {
          duration: 5000,
          icon: '✅'
        });
      }
    });

    newSocket.on('quality-test-failed', (data) => {
      if (user.role === 'LEADER' || user.role === 'MANAGER' || user.role === 'ADMIN') {
        const machineName = data.machineName || 'Desconhecida';
        toast.error(`Teste de qualidade reprovado - Máquina ${machineName}`, {
          duration: 8000,
          icon: '❌'
        });
      }
    });

    console.log('🔧 Definindo socket no estado...');
    setSocket(newSocket);
    console.log('✅ Socket definido no estado');
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
    }
  };

  // Conectar automaticamente quando o usuário estiver autenticado
  useEffect(() => {
    console.log('🔄 useSocket: Estado de autenticação mudou:', { isAuthenticated, hasToken: !!token, hasUser: !!user });
    
    if (isAuthenticated && token && user) {
      console.log('✅ Conectando socket - usuário autenticado');
      connectSocket();
    } else {
      console.log('❌ Desconectando socket - usuário não autenticado');
      disconnectSocket();
    }
  }, [isAuthenticated, token, user]);

  // Funções para emitir eventos
  const emit = (event, data) => {
    if (socket?.connected) {
      socket.emit(event, data);
    } else {
      console.warn('Socket não conectado. Evento não enviado:', event);
    }
  };

  const on = (event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  // Função para entrar em uma sala específica
  const joinRoom = (room) => {
    emit('join-room', room);
  };

  // Função para sair de uma sala específica
  const leaveRoom = (room) => {
    emit('leave-room', room);
  };

  // Função para enviar mensagem para uma sala
  const sendToRoom = (room, event, data) => {
    emit('room-message', { room, event, data });
  };

  const value = {
    socket,
    isConnected,
    connectionError,
    onlineUsers,
    emit,
    on,
    off,
    joinRoom,
    leaveRoom,
    sendToRoom,
    reconnect: connectSocket
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketProvider;