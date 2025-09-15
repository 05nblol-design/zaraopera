import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  ChartBarIcon,
  CogIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useMachinePermissions } from '../hooks/useMachinePermissions';
import { useSocket } from '../hooks/useSocket';
import useMachineStatus from '../hooks/useMachineStatus';
import { useNotifications } from '../contexts/NotificationContext';
import { useRealTimeProduction } from '../hooks/useRealTimeProduction';

// Utilitários
import { cn, formatNumber, formatDateTime } from '../lib/utils';
import { ROUTES } from '../config/routes';
import api from '../services/api';

// Componentes
// ProductionPopup removido - agora aparece apenas na página de detalhes das máquinas
// ProductionTestAlertManager removido - usando apenas popupThreshold

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState('today'); // today, week, month
  const [selectedMetric, setSelectedMetric] = useState('production');
  // Estados do popup removidos - agora gerenciados na página de detalhes das máquinas
  
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const { machines, stats } = useMachineStatus();
  const { notifications } = useNotifications();
  const { filterMachinesByPermissions } = useMachinePermissions();

  // Redirecionar operadores para o menu específico
  if (user?.role === 'OPERATOR') {
    return <Navigate to={ROUTES.OPERATOR_MENU} replace />;
  }

  // Função checkActivePopups removida - agora gerenciada na página de detalhes das máquinas

  // useEffect hooks para popup removidos - agora gerenciados na página de detalhes das máquinas

  // Usar dados agregados da API ao invés de cálculos locais
  const [aggregatedData, setAggregatedData] = useState({
    totalProduction: 0,
    totalRunningTime: 0,
    averageEfficiency: 0,
    totalDowntime: 0
  });

  // Buscar dados agregados de produção da API
  const fetchAggregatedProduction = async () => {
    try {
      const response = await api.get('/machines/production/aggregate');
      if (response.data.success) {
        setAggregatedData(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar dados agregados:', error);
      // Fallback: usar dados básicos das máquinas
      if (machines && machines.length > 0) {
        const filteredMachines = filterMachinesByPermissions(machines, 'canView');
        const runningMachines = filteredMachines.filter(m => 
          m.status === 'FUNCIONANDO' || m.status === 'RUNNING'
        );
        
        setAggregatedData({
          totalProduction: runningMachines.length * 100, // Estimativa básica
          totalRunningTime: runningMachines.length * 60,
          averageEfficiency: runningMachines.length > 0 ? 85 : 0,
          totalDowntime: (filteredMachines.length - runningMachines.length) * 30
        });
      }
    }
  };

  // Atualizar dados agregados periodicamente
  useEffect(() => {
    fetchAggregatedProduction();
    const interval = setInterval(fetchAggregatedProduction, 30000); // A cada 30 segundos
    return () => clearInterval(interval);
  }, [machines]);

  const realTimeData = aggregatedData;

  // Estados para dados do dashboard
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [shiftEfficiency, setShiftEfficiency] = useState([]);

  // Estatísticas das máquinas
  const machineStats = {
    total: stats?.total || 0,
    running: stats?.running || 0,
    stopped: stats?.stopped || 0,
    maintenance: stats?.maintenance || 0,
    error: stats?.error || 0
  };

  // Notificações recentes
  const recentNotifications = (notifications || []).slice(0, 5);

  // Função para buscar dados de eficiência por turno usando OEE
  const fetchShiftEfficiency = async () => {
    try {
      const response = await api.get('/reports/oee/current-shift');
      if (response.data.success && response.data.data) {
        const oeeData = response.data.data;
        
        // Criar dados de eficiência baseados no OEE atual
        const shiftData = [];
        
        if (oeeData.oee !== undefined) {
          shiftData.push({
            name: `Turno ${oeeData.shiftType || 'Atual'}`,
            value: Math.round(oeeData.oee),
            color: oeeData.oee >= 90 ? 'bg-green-500' : oeeData.oee >= 80 ? 'bg-yellow-500' : 'bg-red-500'
          });
        }
        
        // Adicionar dados de disponibilidade e qualidade se disponíveis
        if (oeeData.availability !== undefined) {
          shiftData.push({
            name: 'Disponibilidade',
            value: Math.round(oeeData.availability),
            color: oeeData.availability >= 90 ? 'bg-green-500' : oeeData.availability >= 80 ? 'bg-yellow-500' : 'bg-red-500'
          });
        }
        
        if (oeeData.quality !== undefined) {
          shiftData.push({
            name: 'Qualidade',
            value: Math.round(oeeData.quality),
            color: oeeData.quality >= 95 ? 'bg-green-500' : oeeData.quality >= 90 ? 'bg-yellow-500' : 'bg-red-500'
          });
        }
        
        setShiftEfficiency(shiftData);
      } else {
        // Fallback para dados vazios se não houver dados reais
        setShiftEfficiency([]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de OEE do turno:', error);
      // Fallback para dados vazios em caso de erro
      setShiftEfficiency([]);
    }
  };

  // Função para buscar dados do dashboard
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar dados do dashboard e OEE em paralelo
      const [dashboardResponse, oeeResponse] = await Promise.all([
        api.get(`/reports/dashboard?timeRange=${timeRange}`),
        api.get('/reports/current-shift-efficiency')
      ]);
      
      if (dashboardResponse.data.success) {
        const data = dashboardResponse.data.data;
        let averageEfficiency = data.summary?.averageEfficiency || 0;
        
        // Usar dados OEE se disponíveis
        if (oeeResponse.data.success && oeeResponse.data.data) {
          averageEfficiency = oeeResponse.data.data.averageEfficiency || averageEfficiency;
        }
        
        setDashboardData({
          ...data,
          summary: {
            ...data.summary,
            averageEfficiency: averageEfficiency
          }
        });
        setRecentActivities(data.recentActivities || []);
      } else {
        throw new Error(dashboardResponse.data.message || 'Erro ao carregar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar dados do dashboard:', err);
      setError(err.response?.data?.message || err.message || 'Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  // Buscar dados quando o componente montar ou timeRange mudar
  useEffect(() => {
    fetchDashboardData();
    fetchShiftEfficiency();
  }, [timeRange]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'quality_test':
        return BeakerIcon;
      case 'machine_stop':
      case 'teflon_change':
        return WrenchScrewdriverIcon;
      case 'quality_alert':
        return ExclamationTriangleIcon;
      default:
        return ClockIcon;
    }
  };

  const getActivityColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'error':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  const MetricCard = ({ title, value, target, change, trend, icon: Icon, unit = '', format = 'number' }) => {
    const isPositiveTrend = trend === 'up';
    const TrendIcon = isPositiveTrend ? ArrowTrendingUpIcon : ArrowTrendingDownIcon;
    
    const formatValue = (val) => {
      switch (format) {
        case 'percentage':
          return `${val}%`;
        case 'time':
          return `${val}min`;
        default:
          return formatNumber(val) + unit;
      }
    };

    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-900/10 rounded-2xl shadow-md">
              <Icon className="h-7 w-7 text-blue-600 dark:text-blue-400 drop-shadow-sm" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 tracking-wide">
                {title}
              </p>
              <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent dark:from-white dark:to-gray-200">
                {formatValue(value)}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className={cn(
              'flex items-center space-x-1 text-sm font-semibold px-2 py-1 rounded-lg',
              change > 0 
                ? 'text-green-700 bg-green-100/80 dark:text-green-400 dark:bg-green-900/20'
                : 'text-red-700 bg-red-100/80 dark:text-red-400 dark:bg-red-900/20'
            )}>
              <TrendIcon className="h-4 w-4" />
              <span>{Math.abs(change)}%</span>
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-2">
              Meta: {formatValue(target)}
            </p>
          </div>
        </div>
        
        {/* Barra de progresso */}
        <div className="mt-6">
          <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            <span>Progresso</span>
            <span>{Math.round((value / target) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 shadow-inner">
            <div 
              className={cn(
                'h-3 rounded-full transition-all duration-300',
                value >= target 
                  ? 'bg-green-500'
                  : value >= target * 0.8
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              )}
              style={{ width: `${Math.min(Math.round((value / target) * 100), 100)}%` }}
            />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - Sistema ZARA</title>
        <meta name="description" content="Dashboard principal do Sistema ZARA" />
      </Helmet>
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Bem-vindo de volta, {user?.name}! Aqui está um resumo das operações.
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            {/* Seletor de período */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="today">Hoje</option>
              <option value="week">Esta Semana</option>
              <option value="month">Este Mês</option>
            </select>
            
            {/* Status de conexão */}
            <div className={cn(
              'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium',
              isConnected 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            )}>
              <div className={cn(
                'h-2 w-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span>{isConnected ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* Sistema de popups de produção removido - usando apenas popupThreshold */}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Carregando dados...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-red-800 dark:text-red-400">Erro ao carregar dados: {error}</p>
            </div>
          </div>
        )}

        {/* Métricas principais - Dados Reais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Produção Total"
            value={realTimeData.totalProduction}
            target={dashboardData?.production?.target || 10000}
            change={dashboardData?.production?.change || 5}
            trend={realTimeData.totalProduction > (dashboardData?.production?.target || 10000) * 0.8 ? 'up' : 'down'}
            icon={ChartBarIcon}
            unit=" pcs"
          />
          
          <MetricCard
            title="Taxa de Qualidade"
            value={dashboardData?.quality?.passRate || 95}
            target={dashboardData?.quality?.target || 98}
            change={dashboardData?.quality?.change || 2}
            trend={dashboardData?.quality?.trend || 'up'}
            icon={BeakerIcon}
            format="percentage"
          />
          
          <MetricCard
            title="Eficiência Geral"
            value={Math.round(realTimeData.averageEfficiency)}
            target={dashboardData?.efficiency?.target || 90}
            change={dashboardData?.efficiency?.change || 3}
            trend={realTimeData.averageEfficiency >= 80 ? 'up' : 'down'}
            icon={CogIcon}
            format="percentage"
          />
          
          <MetricCard
            title="Tempo de Parada"
            value={Math.round(realTimeData.totalDowntime)}
            target={dashboardData?.downtime?.target || 120}
            change={dashboardData?.downtime?.change || -10}
            trend={realTimeData.totalDowntime < 120 ? 'up' : 'down'}
            icon={ClockIcon}
            format="time"
          />
        </div>

        {/* Seções adicionais */}
        {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status das Máquinas */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Status das Máquinas
                </h3>
                <Link
                  to={ROUTES.MACHINES}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                >
                  <span>Ver todas</span>
                  <EyeIcon className="h-4 w-4" />
                </Link>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {machineStats.running}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">
                    Funcionando
                  </div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                    {machineStats.stopped}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Paradas
                  </div>
                </div>
                
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                    {machineStats.maintenance}
                  </div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">
                    Manutenção
                  </div>
                </div>
                
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {machineStats.error}
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    Fora de turno
                  </div>
                </div>
              </div>
              
              {/* Gráfico de barras simples */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Eficiência por Turno</span>
                </div>
                <div className="space-y-2">
                  {shiftEfficiency.length > 0 ? shiftEfficiency.map((shift) => (
                    <div key={shift.name} className="flex items-center space-x-3">
                      <div className="w-16 text-sm text-gray-600 dark:text-gray-400">
                        {shift.name}
                      </div>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className={cn('h-2 rounded-full', shift.color)}
                          style={{ width: `${shift.value}%` }}
                        />
                      </div>
                      <div className="w-12 text-sm font-medium text-gray-900 dark:text-white">
                        {shift.value}%
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      Nenhum dado de eficiência por turno disponível
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Atividades Recentes */}
          <div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Atividades Recentes
                </h3>
                <Link
                  to="/activities"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Ver todas
                </Link>
              </div>
              
              <div className="space-y-4">
                {recentActivities.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className={cn(
                        'flex-shrink-0 p-2 rounded-lg',
                        getActivityColor(activity.status)
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white">
                          {activity.message}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {activity.user}
                          </p>
                          <span className="text-xs text-gray-400">•</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDateTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Ações rápidas */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Ações Rápidas
                </h4>
                <div className="space-y-2">
                  <Link
                    to={ROUTES.QUALITY_NEW}
                    className="flex items-center space-x-2 p-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Novo Teste de Qualidade</span>
                  </Link>
                  
                  {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                    <Link
                      to={ROUTES.REPORTS}
                      className="flex items-center space-x-2 p-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                    >
                      <ChartBarIcon className="h-4 w-4" />
                      <span>Ver Relatórios</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
      
      {/* ProductionPopup removido - agora aparece apenas na página de detalhes das máquinas */}
    </>
  );
};

export default Dashboard;