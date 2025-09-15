import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { 
  PlusIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  ChartBarIcon,
  CogIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { formatDateTime, formatNumber } from '../utils';
import { cn } from '../lib/utils';
import api from '../services/api';

const Teflon = () => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [teflonChanges, setTeflonChanges] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('ALL');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [selectedChangeId, setSelectedChangeId] = useState(null);

  // Estados para nova troca
  const [newChange, setNewChange] = useState({
    machineId: '',
    teflonType: '',
    expiryDate: '',
    observations: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('teflonChange', handleTeflonUpdate);
      return () => socket.off('teflonChange', handleTeflonUpdate);
    }
  }, [socket]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [changesRes, machinesRes] = await Promise.all([
        api.get('/teflon'),
        api.get('/machines')
      ]);
      
      setTeflonChanges(Array.isArray(changesRes.data.data) ? changesRes.data.data : []);
      setMachines(Array.isArray(machinesRes.data.data) ? machinesRes.data.data : []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados do Teflon');
      setMachines([]);
      setTeflonChanges([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTeflonUpdate = (data) => {
    if (data.type === 'TEFLON_CHANGE') {
      loadData();
    }
  };

  const handleNewChange = async (e) => {
    e.preventDefault();
    try {
      await api.post('/teflon', newChange);
      setNewChange({ machineId: '', teflonType: '', expiryDate: '', observations: '' });
      setShowChangeModal(false);
      loadData();
    } catch (err) {
      console.error('Erro ao registrar troca:', err);
      setError('Erro ao registrar troca de Teflon');
    }
  };



  const getStatusConfig = (status) => {
    switch (status) {
      case 'ACTIVE':
        return {
          label: 'Ativo',
          color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          icon: CheckCircleIcon,
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case 'EXPIRING_SOON':
        return {
          label: 'Expirando',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          icon: ExclamationTriangleIcon,
          iconColor: 'text-yellow-600 dark:text-yellow-400'
        };
      case 'EXPIRED':
        return {
          label: 'Expirado',
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          icon: ClockIcon,
          iconColor: 'text-red-600 dark:text-red-400'
        };
      default:
        return {
          label: 'Desconhecido',
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
          icon: ClockIcon,
          iconColor: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  const getStatusColor = (status) => {
    return getStatusConfig(status).color;
  };

  const getStatusIcon = (status) => {
    const config = getStatusConfig(status);
    const IconComponent = config.icon;
    return <IconComponent className={`h-4 w-4 ${config.iconColor}`} />;
  };

  const getStatusText = (status) => {
    return getStatusConfig(status).label;
  };

  // Função para determinar o status baseado nos dados da troca
  const getStatusFromChange = (change) => {
    if (!change.expiryDate) return 'ACTIVE';
    
    const now = new Date();
    const expiryDate = new Date(change.expiryDate);
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 0) {
      return 'EXPIRED';
    } else if (daysUntilExpiry <= 7) {
      return 'EXPIRING_SOON';
    } else {
      return 'ACTIVE';
    }
  };



  // Filtrar e ordenar trocas de teflon
  const filteredChanges = (Array.isArray(teflonChanges) ? teflonChanges : [])
    .filter(change => {
      const machineNameSearch = change.machine?.name || '';
      const teflonTypeSearch = change.teflonType || '';
      const userNameSearch = change.user?.name || '';
      
      const matchesSearch = change.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
                           machineNameSearch.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           teflonTypeSearch.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           userNameSearch.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesMachine = machineFilter === 'ALL' || change.machineId === machineFilter;
      
      // Filtro de status
      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        const status = getStatusFromChange(change);
        matchesStatus = status === statusFilter;
      }
      
      // Filtro de data
      let matchesDate = true;
      if (dateRange !== 'ALL') {
        const now = new Date();
        const changeDate = new Date(change.changeDate || change.createdAt);
        
        switch (dateRange) {
          case 'TODAY':
            matchesDate = changeDate.toDateString() === now.toDateString();
            break;
          case 'WEEK':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = changeDate >= weekAgo;
            break;
          case 'MONTH':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = changeDate >= monthAgo;
            break;
        }
      }
      
      return matchesSearch && matchesMachine && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.changeDate || a.createdAt);
          bValue = new Date(b.changeDate || b.createdAt);
          break;
        case 'machine':
          aValue = a.machine?.name || '';
          bValue = b.machine?.name || '';
          break;
        case 'operator':
          aValue = a.user?.name || '';
          bValue = b.user?.name || '';
          break;
        case 'status':
          aValue = getStatusFromChange(a);
          bValue = getStatusFromChange(b);
          break;
        case 'type':
          aValue = a.teflonType || '';
          bValue = b.teflonType || '';
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Controle de Teflon - Zara Operação</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle de Teflon</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Gerencie as trocas de Teflon das máquinas
            </p>
          </div>
          
          {(user?.role === 'OPERATOR' || user?.role === 'LEADER' || user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/teflon/change')}
              className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              Nova Troca
            </motion.button>
          )}
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <CogIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Trocas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(teflonChanges.length)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ativos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(teflonChanges.filter(t => getStatusFromChange(t) === 'ACTIVE').length)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Expirando</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(teflonChanges.filter(t => getStatusFromChange(t) === 'EXPIRING_SOON').length)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <ClockIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Expirados</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatNumber(teflonChanges.filter(t => getStatusFromChange(t) === 'EXPIRED').length)}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Filtros e Busca */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                {/* Busca */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar trocas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                {/* Filtros */}
                <div className="flex items-center space-x-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ALL">Todos os Status</option>
                    <option value="ACTIVE">Ativos</option>
                    <option value="EXPIRING_SOON">Expirando</option>
                    <option value="EXPIRED">Expirados</option>
                  </select>
                  
                  <select
                    value={machineFilter}
                    onChange={(e) => setMachineFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ALL">Todas as Máquinas</option>
                    {machines.map(machine => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name}
                      </option>
                    ))}
                  </select>
                  
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="TODAY">Hoje</option>
                    <option value="WEEK">Esta Semana</option>
                    <option value="MONTH">Este Mês</option>
                    <option value="ALL">Todos os Períodos</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredChanges.length} trocas
                </span>
                
                {/* Status de conexão */}
                <div className={cn(
                  'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium',
                  isConnected 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                )}>
                  <div className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  )} />
                  <span>{isConnected ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
            
            {/* Ordenação */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Ordenar por:</span>
              <div className="flex items-center space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="timestamp">Data</option>
                  <option value="machine">Máquina</option>
                  <option value="operator">Operador</option>
                  <option value="status">Status</option>
                  <option value="type">Tipo de Teflon</option>
                </select>
                
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <ArrowsUpDownIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Trocas */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        {filteredChanges.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-12 text-center">
            <CogIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nenhuma troca encontrada</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm || statusFilter !== 'ALL' || machineFilter !== 'ALL' || dateRange !== 'ALL'
                ? 'Tente ajustar os filtros para ver mais resultados.'
                : 'Comece registrando uma nova troca de Teflon.'}
            </p>
            {(user?.role === 'OPERATOR' || user?.role === 'LEADER' || user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
              <div className="mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/teflon/change')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 transition-colors"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  Nova Troca
                </motion.button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
            {filteredChanges.map((change, index) => {
                const status = getStatusFromChange(change);
                const statusConfig = getStatusConfig(status);
                const StatusIcon = statusConfig.icon;
                
              return (
                <motion.div
                  key={change.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    // Apenas líderes e gerentes podem ver detalhes
                    if (user?.role === 'LEADER' || user?.role === 'MANAGER' || user?.role === 'ADMIN') {
                      navigate(`/teflon/${change.id}`);
                    }
                  }}
                >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            'flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium',
                            statusConfig.color
                          )}>
                            <StatusIcon className="h-4 w-4" />
                            <span>{statusConfig.label}</span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {change.machine?.name || 'Máquina não encontrada'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              Tipo: {change.teflonType || 'Não especificado'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-3 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-6">
                          <div className="flex items-center space-x-1">
                            <CalendarIcon className="h-4 w-4" />
                            <span>Troca: {formatDateTime(change.changeDate || change.createdAt)}</span>
                          </div>
                          
                          {change.expiryDate && (
                            <div className="flex items-center space-x-1">
                              <ClockIcon className="h-4 w-4" />
                              <span>Expira: {formatDateTime(change.expiryDate)}</span>
                            </div>
                          )}
                          
                          {change.user?.name && (
                            <div className="flex items-center space-x-1">
                              <span>Por: {change.user.name}</span>
                            </div>
                          )}
                          
                          {change.status?.daysUntilExpiry !== undefined && (
                            <div className="flex items-center space-x-1">
                              <span className={cn(
                                'font-medium',
                                change.status.daysUntilExpiry <= 0 ? 'text-red-600 dark:text-red-400' :
                                change.status.daysUntilExpiry <= 7 ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-green-600 dark:text-green-400'
                              )}>
                                {change.status.daysUntilExpiry <= 0 
                                  ? `Expirado há ${Math.abs(change.status.daysUntilExpiry)} dias`
                                  : `${change.status.daysUntilExpiry} dias restantes`}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {change.observations && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                              "{change.observations}"
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Indicador de acesso para líderes */}
                      {(user?.role === 'LEADER' || user?.role === 'MANAGER' || user?.role === 'ADMIN') && (
                        <div className="ml-4 flex-shrink-0">
                          <div className="text-gray-400 dark:text-gray-500">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Modal Nova Troca */}
        {showChangeModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Registrar Nova Troca de Teflon
                </h3>
                
                <form onSubmit={handleNewChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Máquina
                    </label>
                    <select
                      value={newChange.machineId}
                      onChange={(e) => setNewChange({...newChange, machineId: e.target.value})}
                      required
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Selecione uma máquina</option>
                      {machines.map(machine => (
                        <option key={machine.id} value={machine.id}>
                          {machine.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Teflon
                    </label>
                    <select
                      value={newChange.teflonType}
                      onChange={(e) => setNewChange({...newChange, teflonType: e.target.value})}
                      required
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="">Selecione o tipo</option>
                      <option value="PTFE Standard">PTFE Standard</option>
                      <option value="PTFE Reforçado">PTFE Reforçado</option>
                      <option value="PTFE Alta Temperatura">PTFE Alta Temperatura</option>
                      <option value="PTFE Antiaderente">PTFE Antiaderente</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data de Validade
                    </label>
                    <input
                      type="datetime-local"
                      value={newChange.expiryDate}
                      onChange={(e) => setNewChange({...newChange, expiryDate: e.target.value})}
                      required
                      min={new Date().toISOString().slice(0, 16)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <textarea
                      value={newChange.observations}
                      onChange={(e) => setNewChange({...newChange, observations: e.target.value})}
                      rows={3}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Observações adicionais (opcional)"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowChangeModal(false);
                        setNewChange({ machineId: '', teflonType: '', expiryDate: '', observations: '' });
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                    >
                      Registrar Troca
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Teflon;