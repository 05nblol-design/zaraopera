import React, { useState, useEffect } from 'react';
import {
  FunnelIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';

const NotificationHistory = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    machineId: '',
    type: '',
    priority: '',
    dateFrom: '',
    dateTo: '',
    lote: '',
    caixa: ''
  });
  const [machines, setMachines] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    byPriority: {},
    byType: {},
    recent: 0
  });

  // Configurações de prioridade
  const priorityConfig = {
    info: {
      label: 'Informação',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      icon: InformationCircleIcon
    },
    warning: {
      label: 'Aviso',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      icon: ExclamationTriangleIcon
    },
    critical: {
      label: 'Crítico',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      icon: XCircleIcon
    },
    success: {
      label: 'Sucesso',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: CheckCircleIcon
    }
  };

  // Tipos de alerta
  const alertTypes = {
    quality_test: 'Teste de Qualidade',
    teflon_change: 'Troca de Teflon',
    machine_status: 'Status da Máquina',
    system: 'Sistema',
    production: 'Produção'
  };

  // Buscar alertas
  const fetchAlerts = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      });

      const response = await api.get(`/alerts?${params}`);
      if (response.data.success) {
        setAlerts(response.data.data.alerts || []);
        setPagination(prev => ({
          ...prev,
          page,
          total: response.data.data.total || 0,
          totalPages: response.data.data.totalPages || 0
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
      setAlerts([]);
      setPagination(prev => ({
        ...prev,
        total: 0,
        totalPages: 0
      }));
      window.toast?.error('Erro ao carregar histórico de notificações');
    } finally {
      setLoading(false);
    }
  };

  // Buscar estatísticas
  const fetchStats = async () => {
    try {
      const response = await api.get('/alerts/stats');
      if (response.data.success) {
        const data = response.data.data;
        
        // Processar dados para o formato esperado pelo frontend
        const processedStats = {
          total: data.summary?.reduce((acc, item) => acc + parseInt(item.total), 0) || 0,
          byPriority: {
            critical: data.summary?.find(item => item.priority === 'CRITICAL')?.total || 0,
            warning: data.summary?.find(item => item.priority === 'WARNING')?.total || 0,
            info: data.summary?.find(item => item.priority === 'INFO')?.total || 0
          },
          recent: data.details?.filter(item => {
            const itemDate = new Date(item.date);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return itemDate >= yesterday;
          }).reduce((acc, item) => acc + parseInt(item.count), 0) || 0
        };
        
        setStats(processedStats);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      // Definir valores padrão em caso de erro
      setStats({
        total: 0,
        byPriority: { critical: 0, warning: 0, info: 0 },
        recent: 0
      });
    }
  };

  // Buscar máquinas
  const fetchMachines = async () => {
    try {
      const response = await api.get('/machines');
      if (response.data.success) {
        setMachines(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
    }
  };

  // Aplicar filtros
  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchAlerts(1);
  };

  // Limpar filtros
  const clearFilters = () => {
    setFilters({
      search: '',
      machineId: '',
      type: '',
      priority: '',
      dateFrom: '',
      dateTo: '',
      lote: '',
      caixa: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchAlerts(1);
  };

  // Formatar data
  const formatDate = (date) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obter ícone de prioridade
  const getPriorityIcon = (priority) => {
    const config = priorityConfig[priority] || priorityConfig.info;
    const IconComponent = config.icon;
    return <IconComponent className={`w-5 h-5 ${config.color}`} />;
  };

  useEffect(() => {
    fetchMachines();
    fetchStats();
    fetchAlerts();
  }, []);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Notificações</h1>
          <p className="text-gray-600 mt-1">Visualize e filtre todas as notificações do sistema</p>
        </div>
        <button
          onClick={() => fetchAlerts(pagination.page)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Atualizar
        </button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <InformationCircleIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Críticos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.byPriority?.critical || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Avisos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.byPriority?.warning || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CalendarDaysIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Últimas 24h</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center text-gray-700 hover:text-gray-900"
          >
            <FunnelIcon className="w-5 h-5 mr-2" />
            Filtros
            <ChevronDownIcon className={`w-4 h-4 ml-2 transform transition-transform ${
              showFilters ? 'rotate-180' : ''
            }`} />
          </button>
        </div>

        {showFilters && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Busca */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar
                </label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    placeholder="Buscar na mensagem..."
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Máquina */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máquina
                </label>
                <select
                  value={filters.machineId}
                  onChange={(e) => setFilters(prev => ({ ...prev, machineId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todas as máquinas</option>
                  {machines.map(machine => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todos os tipos</option>
                  {Object.entries(alertTypes).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Prioridade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade
                </label>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todas as prioridades</option>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>

              {/* Data inicial */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Data final */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data final
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Lote */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lote
                </label>
                <input
                  type="text"
                  value={filters.lote}
                  onChange={(e) => setFilters(prev => ({ ...prev, lote: e.target.value }))}
                  placeholder="Número do lote"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Caixa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caixa
                </label>
                <input
                  type="text"
                  value={filters.caixa}
                  onChange={(e) => setFilters(prev => ({ ...prev, caixa: e.target.value }))}
                  placeholder="Número da caixa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Aplicar Filtros
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de alertas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando notificações...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <InformationCircleIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhuma notificação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prioridade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mensagem
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Máquina
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lote/Caixa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alerts.map((alert) => {
                  const config = priorityConfig[alert.priority] || priorityConfig.info;
                  return (
                    <tr key={alert.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                          {getPriorityIcon(alert.priority)}
                          <span className="ml-1">{config.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {alertTypes[alert.type] || alert.type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate" title={alert.message}>
                          {alert.message}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {alert.machine?.name || `Máquina ${alert.machine_id}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {alert.lote && alert.caixa ? `${alert.lote}/${alert.caixa}` : alert.lote || alert.caixa || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(alert.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} resultados
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchAlerts(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-700">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchAlerts(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationHistory;