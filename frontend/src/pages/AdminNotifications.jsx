import React, { useState, useEffect } from 'react';
import { Bell, Send, Users, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { toast } from 'react-hot-toast';

const AdminNotifications = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [formData, setFormData] = useState({
    type: 'SYSTEM',
    title: '',
    message: '',
    priority: 'MEDIUM',
    targetType: 'ALL', // ALL, ROLE, USER
    targetRole: 'OPERATOR',
    targetUserId: '',
    channels: ['SYSTEM']
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testMode, setTestMode] = useState(false);

  // Buscar usuários para seleção
  useEffect(() => {
    fetchUsers();
  }, []);

  // Escutar notificações em tempo real
  useEffect(() => {
    if (socket) {
      socket.on('new-notification', (notification) => {
        setNotifications(prev => [notification, ...prev.slice(0, 9)]);
        toast.success(`Nova notificação: ${notification.title}`);
      });

      return () => {
        socket.off('new-notification');
      };
    }
  }, [socket]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleChannelChange = (channel) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel]
    }));
  };

  const sendNotification = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        metadata: {
          source: 'admin-panel',
          testMode,
          timestamp: new Date().toISOString(),
          adminId: user.id,
          adminName: user.name
        }
      };

      // Remover campos desnecessários baseado no tipo de alvo
      if (formData.targetType === 'ALL') {
        delete payload.targetRole;
        delete payload.targetUserId;
      } else if (formData.targetType === 'ROLE') {
        delete payload.targetUserId;
      } else if (formData.targetType === 'USER') {
        delete payload.targetRole;
      }

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Notificação enviada com sucesso!');
        
        // Resetar formulário
        setFormData({
          type: 'SYSTEM',
          title: '',
          message: '',
          priority: 'MEDIUM',
          targetType: 'ALL',
          targetRole: 'OPERATOR',
          targetUserId: '',
          channels: ['SYSTEM']
        });
      } else {
        const error = await response.json();
        toast.error(error.message || 'Erro ao enviar notificação');
      }
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      toast.error('Erro ao enviar notificação');
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotifications = async () => {
    const testNotifications = [
      {
        type: 'SYSTEM',
        title: 'Teste de Sistema',
        message: 'Esta é uma notificação de teste do sistema',
        priority: 'HIGH',
        targetType: 'ALL',
        channels: ['SYSTEM', 'EMAIL']
      },
      {
        type: 'MACHINE_STATUS',
        title: 'Teste de Máquina',
        message: 'Máquina 1 mudou para status de teste',
        priority: 'MEDIUM',
        targetType: 'ROLE',
        targetRole: 'OPERATOR',
        channels: ['SYSTEM']
      },
      {
        type: 'QUALITY_TEST',
        title: 'Teste de Qualidade',
        message: 'Novo teste de qualidade disponível',
        priority: 'LOW',
        targetType: 'ROLE',
        targetRole: 'ADMIN',
        channels: ['SYSTEM']
      }
    ];

    for (const notification of testNotifications) {
      try {
        const token = localStorage.getItem('token');
        await fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...notification,
            metadata: {
              source: 'admin-test-batch',
              timestamp: new Date().toISOString()
            }
          })
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Erro ao enviar notificação de teste:', error);
      }
    }
    
    toast.success('Notificações de teste enviadas!');
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'SYSTEM': return <Info className="w-4 h-4" />;
      case 'MACHINE_STATUS': return <AlertTriangle className="w-4 h-4" />;
      case 'QUALITY_TEST': return <CheckCircle className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-8 h-8 text-blue-600" />
              Painel de Notificações
            </h1>
            <p className="text-gray-600 mt-1">
              Gerencie e envie notificações para usuários do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={sendTestNotifications}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Enviar Testes
            </button>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600">Modo Teste</span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de Notificação */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Nova Notificação</h2>
          
          <form onSubmit={sendNotification} className="space-y-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SYSTEM">Sistema</option>
                <option value="MACHINE_STATUS">Status da Máquina</option>
                <option value="QUALITY_TEST">Teste de Qualidade</option>
                <option value="TEFLON_CHANGE">Troca de Teflon</option>
                <option value="ALERT">Alerta</option>
              </select>
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite o título da notificação"
              />
            </div>

            {/* Mensagem */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mensagem
              </label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                required
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite a mensagem da notificação"
              />
            </div>

            {/* Prioridade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridade
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
              </select>
            </div>

            {/* Alvo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enviar para
              </label>
              <select
                name="targetType"
                value={formData.targetType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Todos os usuários</option>
                <option value="ROLE">Por função</option>
                <option value="USER">Usuário específico</option>
              </select>
            </div>

            {/* Função específica */}
            {formData.targetType === 'ROLE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Função
                </label>
                <select
                  name="targetRole"
                  value={formData.targetRole}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="OPERATOR">Operadores</option>
                  <option value="SUPERVISOR">Supervisores</option>
                  <option value="ADMIN">Administradores</option>
                </select>
              </div>
            )}

            {/* Usuário específico */}
            {formData.targetType === 'USER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuário
                </label>
                <select
                  name="targetUserId"
                  value={formData.targetUserId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um usuário</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Canais */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Canais de Notificação
              </label>
              <div className="space-y-2">
                {['SYSTEM', 'EMAIL', 'PUSH'].map(channel => (
                  <label key={channel} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.channels.includes(channel)}
                      onChange={() => handleChannelChange(channel)}
                      className="rounded mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      {channel === 'SYSTEM' ? 'Sistema' : 
                       channel === 'EMAIL' ? 'Email' : 'Push'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Botão de envio */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {loading ? 'Enviando...' : 'Enviar Notificação'}
            </button>
          </form>
        </div>

        {/* Notificações Recentes */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notificações Recentes</h2>
          
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Nenhuma notificação recente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <div className={`p-1 rounded ${getPriorityColor(notification.priority)}`}>
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {notification.title}
                        </h4>
                        <p className="text-gray-600 text-xs mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(notification.created_at || Date.now()).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminNotifications;