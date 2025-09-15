import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  EyeIcon,
  DocumentTextIcon,
  BeakerIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  PhotoIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';

// Utilitários
import { cn, formatDateTime, formatNumber } from '../lib/utils';
import { ROUTES } from '../config/routes';

const QualityTests = () => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [machineFilter, setMachineFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('TODAY'); // TODAY, WEEK, MONTH, ALL
  const [sortBy, setSortBy] = useState('timestamp'); // timestamp, machine, operator, result
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedTest, setSelectedTest] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const { user } = useAuth();
  const { isConnected } = useSocket();
  
  // Mensagem de sucesso do estado da navegação
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  // Estados para dados dos testes
  const [tests, setTests] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Carregar dados dos testes e máquinas da API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [testsResponse, machinesResponse] = await Promise.all([
          fetch('/api/quality-tests', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }),
          fetch('/api/machines', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          })
        ]);
        
        if (!testsResponse.ok || !machinesResponse.ok) {
          throw new Error('Erro ao carregar dados');
        }
        
        const [testsData, machinesData] = await Promise.all([
          testsResponse.json(),
          machinesResponse.json()
        ]);
        
        if (testsData.success) {
          setTests(testsData.data || []);
        }
        
        if (machinesData.success) {
          setMachines(machinesData.data || []);
        }
      } catch (err) {
        setError('Erro ao carregar dados');
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  

  
  // Filtrar testes
  const filteredTests = tests
    .filter(test => {
      const machineNameSearch = test.machine?.name || '';
      const userNameSearch = test.user?.name || '';
      const productSearch = test.product || '';
      const lotSearch = test.lot || '';
      
      const matchesSearch = test.id.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
                           machineNameSearch.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           userNameSearch.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           productSearch.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           lotSearch.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || (test.approved ? 'PASS' : 'FAIL') === statusFilter;
      const matchesMachine = machineFilter === 'ALL' || test.machineId === machineFilter;
      
      // Filtro de data
      let matchesDate = true;
      if (dateRange !== 'ALL') {
        const now = new Date();
        const testDate = new Date(test.testDate || test.createdAt);
        
        switch (dateRange) {
          case 'TODAY':
            matchesDate = testDate.toDateString() === now.toDateString();
            break;
          case 'WEEK':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = testDate >= weekAgo;
            break;
          case 'MONTH':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            matchesDate = testDate >= monthAgo;
            break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesMachine && matchesDate;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(a.testDate || a.createdAt);
          bValue = new Date(b.testDate || b.createdAt);
          break;
        case 'machine':
          aValue = a.machine?.name || '';
          bValue = b.machine?.name || '';
          break;
        case 'operator':
          aValue = a.user?.name || '';
          bValue = b.user?.name || '';
          break;
        case 'result':
          aValue = a.overallResult;
          bValue = b.overallResult;
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
  
  const getResultConfig = (result) => {
    switch (result) {
      case 'PASS':
        return {
          label: 'Aprovado',
          color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
          icon: CheckCircleIcon,
          iconColor: 'text-green-600 dark:text-green-400'
        };
      case 'FAIL':
        return {
          label: 'Reprovado',
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
          icon: XCircleIcon,
          iconColor: 'text-red-600 dark:text-red-400'
        };
      default:
        return {
          label: 'Pendente',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
          icon: ClockIcon,
          iconColor: 'text-yellow-600 dark:text-yellow-400'
        };
    }
  };
  
  const getTestTypeLabel = (type) => {
    switch (type) {
      case 'ROUTINE':
        return 'Rotina';
      case 'SPECIAL':
        return 'Especial';
      case 'COMPLAINT':
        return 'Reclamação';
      default:
        return type;
    }
  };
  
  const getShiftLabel = (shift) => {
    switch (shift) {
      case 'TURNO_1':
        return 'Turno 1';
      case 'TURNO_2':
        return 'Turno 2';
      case 'TURNO_3':
        return 'Turno 3';
      default:
        return shift;
    }
  };
  
  const TestCard = ({ test }) => {
    const resultConfig = getResultConfig(test.approved ? 'PASS' : 'FAIL');
    const ResultIcon = resultConfig.icon;
    
    const testResults = test.testResults || {};
    const passedTests = Object.values(testResults).filter(result => result === 'PASS').length;
    const totalTests = Object.values(testResults).filter(result => result !== null).length;
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={cn(
              'p-2 rounded-lg',
              test.approved ? 'bg-green-100 dark:bg-green-900/20' :
                      !test.approved ? 'bg-red-100 dark:bg-red-900/20' :
              'bg-yellow-100 dark:bg-yellow-900/20'
            )}>
              <ResultIcon className={cn('h-6 w-6', resultConfig.iconColor)} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {test.id}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {test.machine?.name || 'N/A'} • {test.machine?.location || ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              resultConfig.color
            )}>
              {resultConfig.label}
            </span>
            
            {test.defects && test.defects.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                {test.defects.length} defeitos
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Operador</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {test.user?.name || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Produto</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {test.product || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Lote</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {test.lot || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Caixa</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {test.boxNumber || 'N/A'}
            </p>
          </div>
        </div>
        
        {/* Progresso dos testes */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Testes Realizados</span>
            <span>{passedTests}/{totalTests} aprovados</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                passedTests === totalTests ? 'bg-green-500' :
                passedTests >= totalTests * 0.8 ? 'bg-yellow-500' :
                'bg-red-500'
              )}
              style={{ width: `${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%` }}
            />
          </div>
        </div>
        
        {/* Observações (resumo) */}
        {test.observations && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {test.observations}
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center space-x-4">
            <span>{formatDateTime(test.testDate || test.createdAt)}</span>
            {test.images && test.images.length > 0 && (
              <div className="flex items-center space-x-1">
                <PhotoIcon className="h-3 w-3" />
                <span>{test.images.length} fotos</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link
              to={`/quality/tests/${test.id}`}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <EyeIcon className="h-4 w-4 mr-1" />
              Detalhes
            </Link>
            
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'LEADER') && (
              <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <DocumentTextIcon className="h-4 w-4 mr-1" />
                Relatório
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <ChartBarIcon className="h-4 w-4" />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };
  
  return (
    <>
      <Helmet>
        <title>Testes de Qualidade - Sistema ZARA</title>
        <meta name="description" content="Histórico de testes de qualidade do Sistema ZARA" />
      </Helmet>
      
      <div className="space-y-6">
        {/* Mensagem de Sucesso */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4"
            >
              <div className="flex">
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {successMessage}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Testes de Qualidade
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Histórico e resultados dos testes de qualidade
            </p>
          </div>
        </div>
        
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Carregando testes...</span>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Content - only show when not loading */}
        {!loading && !error && (
          <>
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div></div>
            <div className="mt-4 sm:mt-0">
              <Link
                to={ROUTES.QUALITY_NEW}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Novo Teste
              </Link>
            </div>
          </div>
        
        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <BeakerIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total de Testes</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{tests.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aprovados</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {tests.filter(t => t.overallResult === 'PASS').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Reprovados</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {tests.filter(t => t.overallResult === 'FAIL').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Taxa de Aprovação</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {tests.length > 0 ? Math.round((tests.filter(t => t.overallResult === 'PASS').length / tests.length) * 100) : 0}%
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
                    placeholder="Buscar testes..."
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
                    <option value="ALL">Todos os Resultados</option>
                    <option value="PASS">Aprovados</option>
                    <option value="FAIL">Reprovados</option>
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
                  {filteredTests.length} testes
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
                  <option value="timestamp">Data/Hora</option>
                  <option value="machine">Máquina</option>
                  <option value="operator">Operador</option>
                  <option value="result">Resultado</option>
                </select>
                
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Lista de Testes */}
        <AnimatePresence>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredTests.map((test) => (
              <TestCard key={test.id} test={test} />
            ))}
          </div>
        </AnimatePresence>
        
        {filteredTests.length === 0 && (
          <div className="text-center py-12">
            <BeakerIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              Nenhum teste encontrado
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tente ajustar os filtros de busca ou criar um novo teste.
            </p>
            <div className="mt-6">
              <Link
                to={ROUTES.QUALITY_NEW}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Novo Teste
              </Link>
            </div>
          </div>
        )}
        
        </>
        )}
      </div>
    </>
  );
};

export default QualityTests;