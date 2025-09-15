import React, { useState, useEffect } from 'react';
import { Bell, Search, Filter, Eye, Trash2, CheckCircle, Clock, AlertTriangle, Info, Users, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { toast } from 'react-hot-toast';

const NotificationDashboard = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'ALL',
    priority: 'ALL',
    read: 'ALL',
    search: ''
  });
  const [stats, setStats] = useState({
    total: 0,
    unread: 0,
    high: 0,
    medium: 0,
    low: 0
  });
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Buscar notificações
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Aplicar filtros
  useEffect(() => {
    applyFilters();
  }, [notifications, filters]);

  // Escutar novas notificações
  useEffect(() => {
    if (socket) {
      socket.on('new-notification', (notification) => {
        setNotifications(prev => [notification, ...prev]);
        toast.success(`Nova notificação: ${notification.title}`);
      });

      return () => {
        socket.off('new-notification');
      };
    }
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        calculateStats(data.notifications || []);
      } else {
        toast.error('Erro ao carregar notificações');
      }
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      toast.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (notificationsList) => {
    const stats = {
      total: notificationsList.length,
      unread: notificationsList.filter(n => !n.read).length,
      high: notificationsList.filter(n => n.priority === 'HIGH').length,
      medium: notificationsList.filter(n => n.priority === 'MEDIUM').length,
      low: notificationsList.filter(n => n.priority === 'LOW').length
    };
    setStats(stats);
  };

  const applyFilters = () => {
    let filtered = [...notifications];

    // Filtro por tipo
    if (filters.type !== 'ALL') {
      filtered = filtered.filter(n => n.type === filters.type);
    }

    // Filtro por prioridade
    if (filters.priority !== 'ALL') {
      filtered = filtered.filter(n => n.priority === filters.priority);
    }

    // Filtro por status de leitura
    if (filters.read !== 'ALL') {
      filtered = filtered.filter(n => {
        if (filters.read === 'READ') return n.read;
        if (filters.read === 'unread') return !n.read;
        return true;
      });
    }

    // Filtro por busca
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(searchLower) ||
        n.message.toLowerCase().includes(searchLower)
      );
    }

    setFilteredNotifications(filtered);
    setCurrentPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => 
            n.id === notificationId ? { ...n, read: true } : n
          )
        );
        toast.success('Notificação marcada como lida');
      }
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
      toast.error('Erro ao marcar como lida');
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => ({ ...n, read: true }))
        );
        toast.success('Todas as notificações marcadas como lidas');
      }
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast.error('Erro ao marcar todas como lidas');
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta notificação?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        toast.success('Notificação excluída');
      }
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
      toast.error('Erro ao excluir notificação');
    }
  };

  const toggleSelectNotification = (notificationId) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const selectAllNotifications = () => {
    const currentPageNotifications = getCurrentPageNotifications();
    const allSelected = currentPageNotifications.every(n => selectedNotifications.includes(n.id));
    
    if (allSelected) {
      setSelectedNotifications(prev => 
        prev.filter(id => !currentPageNotifications.find(n => n.id === id))
      );
    } else {
      setSelectedNotifications(prev => [
        ...prev,
        ...currentPageNotifications.map(n => n.id).filter(id => !prev.includes(id))
      ]);
    }
  };

  const deleteSelectedNotifications = async () => {
    if (selectedNotifications.length === 0) return;
    
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedNotifications.length} notificações?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await Promise.all(
        selectedNotifications.map(id => 
          fetch(`/api/notifications/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        )
      );
      
      setNotifications(prev => 
        prev.filter(n => !selectedNotifications.includes(n.id))
      );
      setSelectedNotifications([]);
      toast.success(`${selectedNotifications.length} notificações excluídas`);
    } catch (error) {
      console.error('Erro ao excluir notificações:', error);
      toast.error('Erro ao excluir notificações');
    }
  };

  const getCurrentPageNotifications = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredNotifications.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'HIGH': return 'text-red-600 bg-red-100 border-red-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'LOW': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
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

  const getTypeLabel = (type) => {
    switch (type) {
      case 'SYSTEM': return 'Sistema';
      case 'MACHINE_STATUS': return 'Máquina';
      case 'QUALITY_TEST': return 'Qualidade';
      case 'TEFLON_CHANGE': return 'Teflon';
      case 'ALERT': return 'Alerta';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
              Dashboard de Notificações
            </h1>
            <p className="text-gray-600 mt-1">
              Visualize e gerencie todas as notificações do sistema
            </p>
          </div>
          <div className="flex gap-2">
            {selectedNotifications.length > 0 && (
              <button
                onClick={deleteSelectedNotifications}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Excluir ({selectedNotifications.length})
              </button>
            )}
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Marcar Todas como Lidas
            </button>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Bell className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Não Lidas</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.unread}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Alta</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.high}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <Info className="w-8 h-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Média</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.medium}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Baixa</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.low}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar notificações..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tipo */}
          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todos os tipos</option>
            <option value="SYSTEM">Sistema</option>
            <option value="MACHINE_STATUS">Máquina</option>
            <option value="QUALITY_TEST">Qualidade</option>
            <option value="TEFLON_CHANGE">Teflon</option>
            <option value="ALERT">Alerta</option>
          </select>

          {/* Prioridade */}
          <select
            value={filters.priority}
            onChange={(e) => handleFilterChange('priority', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todas as prioridades</option>
            <option value="HIGH">Alta</option>
            <option value="MEDIUM">Média</option>
            <option value="LOW">Baixa</option>
          </select>

          {/* Status */}
          <select
            value={filters.read}
            onChange={(e) => handleFilterChange('read', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todos os status</option>
            <option value="unread">Não lidas</option>
            <option value="read">Lidas</option>
          </select>
        </div>
      </div>

      {/* Lista de Notificações */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Notificações ({filteredNotifications.length})
            </h2>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={getCurrentPageNotifications().length > 0 && getCurrentPageNotifications().every(n => selectedNotifications.includes(n.id))}
                onChange={selectAllNotifications}
                className="rounded mr-2"
              />
              <span className="text-sm text-gray-600">Selecionar todos</span>
            </label>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {getCurrentPageNotifications().length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma notificação encontrada</p>
            </div>
          ) : (
            getCurrentPageNotifications().map((notification) => (
              <div
                key={notification.id}
                className={`p-6 hover:bg-gray-50 transition-colors ${
                  !notification.read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.id)}
                      onChange={() => toggleSelectNotification(notification.id)}
                      className="rounded mt-1"
                    />
                    <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-gray-600 mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                        </span>
                        <span>{getTypeLabel(notification.type)}</span>
                        <span>{new Date(notification.created_at).toLocaleString()}</span>
                        {notification.user_id ? (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Específica
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Geral
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        title="Marcar como lida"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Excluir notificação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredNotifications.length)} de {filteredNotifications.length} notificações
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Anterior
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 border rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationDashboard;