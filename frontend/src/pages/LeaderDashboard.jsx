import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  ChartBarIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  BellIcon,
  CogIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import useMachineStatus from '../hooks/useMachineStatus';
import { useNotifications } from '../contexts/NotificationContext';
import { useRealTimeProduction } from '../hooks/useRealTimeProduction';

// Utilitários
import { cn, formatNumber, formatDateTime } from '../lib/utils';
import { ROUTES } from '../config/routes';
import api from '../services/api';

const LeaderDashboard = () => {
  const [timeRange, setTimeRange] = useState('today');
  const [selectedShift, setSelectedShift] = useState('current');
  
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const { machines, stats } = useMachineStatus();
  const { notifications } = useNotifications();

  // Estados para dados da API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaderData, setLeaderData] = useState(null);

  // Calcular dados reais de produção para o dashboard do líder
  const calculateLeaderRealTimeData = () => {
    // Se temos dados da API, usar eles
    if (leaderData && leaderData.realTimeMetrics) {
      return {
        teamProduction: leaderData.realTimeMetrics.teamProduction || 0,
        teamEfficiency: leaderData.realTimeMetrics.teamEfficiency || 0,
        activeMachines: leaderData.realTimeMetrics.activeMachines || 0,
        qualityRate: leaderData.realTimeMetrics.qualityRate || 0,
        downtimeMinutes: leaderData.realTimeMetrics.downtimeMinutes || 0
      };
    }

    if (!machines || machines.length === 0) {
      return {
        teamProduction: 0,
        teamEfficiency: 0,
        activeMachines: 0,
        qualityRate: 0,
        downtimeMinutes: 0
      };
    }

    let totalProduction = 0;
    let totalOEE = 0;
    let activeMachines = 0;
    let totalDowntime = 0;
    let runningMachines = 0;
    let totalQualityTests = 0;
    let passedQualityTests = 0;

    machines.forEach(machine => {
      const isRunning = machine.status === 'FUNCIONANDO' || machine.status === 'RUNNING';
      const isOffShift = machine.status === 'FORA_DE_TURNO' || machine.status === 'OFF_SHIFT';
      
      if (isRunning && machine.productionSpeed) {
        const production = machine.currentProduction || 0;
        const runningTime = machine.runningTime || 0;
        const plannedTime = machine.plannedTime || 720; // 12 horas padrão
        const speed = machine.productionSpeed;
        
        // Calcular OEE usando fórmula padrão
        const availability = plannedTime > 0 ? Math.min((runningTime / plannedTime) * 100, 100) : 0;
        const performance = (runningTime > 0 && speed > 0) ? Math.min((production / (runningTime * speed)) * 100, 100) : 0;
        
        // Calcular qualidade baseada nos dados da máquina
        let quality = 100; // Padrão se não há dados de qualidade
        if (machine.qualityTests && machine.qualityTests.total > 0) {
          quality = (machine.qualityTests.passed / machine.qualityTests.total) * 100;
          totalQualityTests += machine.qualityTests.total;
          passedQualityTests += machine.qualityTests.passed;
        }
        
        const oee = (availability * performance * quality) / 10000; // Dividir por 10000 pois são 3 percentuais
        
        totalProduction += production;
        totalOEE += oee;
        activeMachines++;
        runningMachines++;
      } else if (!isOffShift) {
        totalDowntime += machine.downtimeMinutes || 0;
      }
    });

    const qualityRate = totalQualityTests > 0 ? Math.round((passedQualityTests / totalQualityTests) * 100) : 100;

    return {
      teamProduction: totalProduction,
      teamEfficiency: runningMachines > 0 ? Math.round(totalOEE / runningMachines) : 0,
      activeMachines,
      qualityRate,
      downtimeMinutes: totalDowntime
    };
  };

  const leaderRealTimeData = calculateLeaderRealTimeData();
  const [teamMembers, setTeamMembers] = useState([]);
  const [supervisedMachines, setSupervisedMachines] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);

  // Função para buscar dados da API
  const fetchLeaderData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar dados do dashboard do líder e dados OEE em paralelo
      const [leaderResponse, oeeResponse] = await Promise.all([
        api.get(`/reports/leader-dashboard?timeRange=${timeRange}`),
        api.get('/reports/current-shift-efficiency').catch(() => ({ data: { success: false } }))
      ]);
      
      if (leaderResponse.data.success) {
        const leaderDataFromAPI = leaderResponse.data.data;
        
        // Se temos dados OEE, usar para complementar a eficiência da equipe
        if (oeeResponse.data.success && oeeResponse.data.data.oeeData) {
          const oeeData = oeeResponse.data.data.oeeData;
          leaderDataFromAPI.realTimeMetrics = {
            ...leaderDataFromAPI.realTimeMetrics,
            teamEfficiency: Math.round(oeeData.oee || leaderDataFromAPI.realTimeMetrics?.teamEfficiency || 0)
          };
        }
        
        setLeaderData(leaderDataFromAPI);
        setTeamMembers(leaderDataFromAPI.teamMembers || []);
        setSupervisedMachines(leaderDataFromAPI.supervisedMachines || []);
        setRecentAlerts(leaderDataFromAPI.recentAlerts || []);
      } else {
        throw new Error(leaderResponse.data.message || 'Erro ao carregar dados');
      }
    } catch (err) {
      console.error('Erro ao buscar dados do líder:', err);
      setError(err.response?.data?.message || err.message || 'Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados quando o componente montar ou timeRange mudar
  useEffect(() => {
    fetchLeaderData();
  }, [timeRange]);

  // Atualização periódica dos dados (a cada 30 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeaderData();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [timeRange]);

  // Componente de Card de Métrica
  const MetricCard = ({ title, value, target, change, trend, icon: Icon, format = 'number', unit = '' }) => {
    const percentage = target ? (value / target) * 100 : 0;
    const isPositiveTrend = trend === 'up';
    
    const formatValue = (val) => {
      if (format === 'percentage') return `${val}%`;
      if (format === 'time') return `${val}min`;
      return `${formatNumber(val)}${unit}`;
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatValue(value)}
              </p>
            </div>
          </div>
          
          {change !== undefined && (
            <div className={cn(
              'flex items-center space-x-1 text-sm font-medium',
              isPositiveTrend ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}>
              {isPositiveTrend ? (
                <ArrowTrendingUpIcon className="h-4 w-4" />
              ) : (
                <ArrowTrendingDownIcon className="h-4 w-4" />
              )}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        
        {target && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Meta: {formatValue(target)}</span>
              <span>{Math.round(percentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  percentage >= 100 ? 'bg-green-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // Componente de Status da Máquina
  const MachineStatusCard = ({ machine }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'FUNCIONANDO':
        case 'RUNNING': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
        case 'PARADA':
        case 'STOPPED': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
        case 'MANUTENCAO':
        case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
        case 'ERROR': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
        case 'FORA_DE_TURNO':
        case 'OFF_SHIFT': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
        default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case 'FUNCIONANDO':
        case 'RUNNING': return 'Funcionando';
        case 'PARADA':
        case 'STOPPED': return 'Parada';
        case 'MANUTENCAO':
        case 'MAINTENANCE': return 'Manutenção';
        case 'ERROR': return 'Erro';
        case 'FORA_DE_TURNO':
        case 'OFF_SHIFT': return 'Fora de Turno';
        default: return 'Desconhecido';
      }
    };

    // Buscar dados reais da máquina do hook useMachineStatus
    const realMachine = machines?.find(m => m.id === machine.id || m.name === machine.name);
    
    // Calcular OEE baseado no status e produção real
    const calculateRealEfficiency = () => {
      if (!realMachine) return machine.efficiency || 0;
      
      const status = realMachine.status;
      const isRunning = status === 'FUNCIONANDO' || status === 'RUNNING';
      const isStopped = status === 'PARADA' || status === 'STOPPED';
      const isOffShift = status === 'FORA_DE_TURNO' || status === 'OFF_SHIFT';
      const isMaintenance = status === 'MANUTENCAO' || status === 'MAINTENANCE';
      
      if (isOffShift || isMaintenance) {
        // Fora de turno ou manutenção: OEE não é calculado
        return 0;
      } else if (isRunning) {
        // Funcionando: calcular OEE usando fórmula padrão
        const speed = realMachine.productionSpeed || 0;
        const runningTime = realMachine.runningTime || 0; // em minutos
        const plannedTime = realMachine.plannedTime || 720; // 12 horas padrão
        const currentProduction = realMachine.currentProduction || 0;
        
        if (speed > 0 && plannedTime > 0) {
          // Disponibilidade: tempo de funcionamento / tempo planejado
          const availability = Math.min((runningTime / plannedTime) * 100, 100);
          
          // Performance: produção real / produção esperada
          const expectedProduction = runningTime * speed;
          const performance = expectedProduction > 0 ? Math.min((currentProduction / expectedProduction) * 100, 100) : 0;
          
          // Qualidade: produtos bons / produtos totais
          let quality = 100; // Padrão se não há dados de qualidade
          if (realMachine.qualityTests && realMachine.qualityTests.total > 0) {
            quality = (realMachine.qualityTests.passed / realMachine.qualityTests.total) * 100;
          }
          
          // OEE = Disponibilidade × Performance × Qualidade
          const oee = (availability * performance * quality) / 10000; // Dividir por 10000 pois são 3 percentuais
          return Math.round(oee);
        }
        return 0;
      } else if (isStopped) {
        // Parada: OEE zerado
        return 0;
      }
      
      return 0;
    };
    
    const realEfficiency = calculateRealEfficiency();

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900 dark:text-white">{machine.name}</h4>
          <span className={cn('px-2 py-1 text-xs font-medium rounded-full', getStatusColor(realMachine?.status || machine.status))}>
            {getStatusText(realMachine?.status || machine.status)}
          </span>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Eficiência:</span>
            <span className="font-medium text-gray-900 dark:text-white">{realEfficiency}%</span>
          </div>
          
          {machine.operator && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Operador:</span>
              <span className="font-medium text-gray-900 dark:text-white">{machine.operator}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>Dashboard do Líder - Sistema ZARA</title>
        <meta name="description" content="Dashboard de liderança do Sistema ZARA" />
      </Helmet>
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard do Líder
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Bem-vindo, {user?.name}! Monitore sua equipe e operações.
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            {/* Seletor de turno */}
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="current">Turno Atual</option>
              <option value="morning">Turno Manhã</option>
              <option value="afternoon">Turno Tarde</option>
              <option value="night">Turno Noite</option>
            </select>
            
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

        {/* Métricas principais - Dados da API */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Produção da Equipe"
            value={leaderData?.realTimeMetrics?.teamProduction || leaderRealTimeData.teamProduction}
            target={leaderData?.shiftMetrics?.production?.target || 500}
            change={leaderData?.shiftMetrics?.production?.change || 0}
            trend={leaderData?.shiftMetrics?.production?.trend || "up"}
            icon={ChartBarIcon}
            unit=" pcs"
          />
          
          <MetricCard
            title="Taxa de Qualidade"
            value={leaderData?.realTimeMetrics?.qualityRate || leaderRealTimeData.qualityRate}
            target={leaderData?.shiftMetrics?.quality?.target || 98}
            change={leaderData?.shiftMetrics?.quality?.change || 0}
            trend={leaderData?.shiftMetrics?.quality?.trend || "up"}
            icon={BeakerIcon}
            format="percentage"
          />
          
          <MetricCard
            title="Eficiência da Equipe"
            value={leaderData?.realTimeMetrics?.teamEfficiency || leaderRealTimeData.teamEfficiency}
            target={leaderData?.teamPerformance?.target || 90}
            change={leaderData?.teamPerformance?.change || 0}
            trend={leaderData?.teamPerformance?.trend || "up"}
            icon={UserGroupIcon}
            format="percentage"
          />
          
          <MetricCard
            title="Tempo de Parada"
            value={leaderData?.realTimeMetrics?.downtimeMinutes || leaderRealTimeData.downtimeMinutes}
            target={leaderData?.shiftMetrics?.downtime?.target || 30}
            change={leaderData?.shiftMetrics?.downtime?.change || 0}
            trend={leaderData?.shiftMetrics?.downtime?.trend || "up"}
            icon={ClockIcon}
            format="time"
          />
        </div>

        {/* Seções adicionais */}
        {!loading && !error && leaderData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status das Máquinas Supervisionadas */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Máquinas Supervisionadas
                </h3>
                <Link
                  to={ROUTES.MACHINES}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                >
                  <span>Ver todas</span>
                  <EyeIcon className="h-4 w-4" />
                </Link>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supervisedMachines.map((machine) => (
                  <MachineStatusCard key={machine.id} machine={machine} />
                ))}
              </div>
            </div>
          </div>

          {/* Alertas e Notificações */}
          <div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Alertas Recentes
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-xs font-medium px-2 py-1 rounded-full">
                    {leaderData.alerts.critical} críticos
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                {recentAlerts.map((alert) => {
                  const getSeverityColor = (severity) => {
                    switch (severity) {
                      case 'high': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
                      case 'medium': return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
                      case 'low': return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
                      default: return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800';
                    }
                  };

                  return (
                    <div key={alert.id} className={cn(
                      'p-4 rounded-lg border',
                      getSeverityColor(alert.severity)
                    )}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {alert.message}
                          </p>
                          <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{alert.machine}</span>
                            <span>•</span>
                            <span>{formatDateTime(alert.timestamp)}</span>
                          </div>
                        </div>
                        <span className={cn(
                          'ml-2 px-2 py-1 text-xs font-medium rounded-full',
                          alert.status === 'active' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                          alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                          'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        )}>
                          {alert.status === 'active' ? 'Ativo' :
                           alert.status === 'acknowledged' ? 'Reconhecido' : 'Resolvido'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  to={ROUTES.NOTIFICATIONS}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                >
                  <BellIcon className="h-4 w-4" />
                  <span>Ver todas as notificações</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Equipe e Relatórios */}
        {!loading && !error && leaderData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status da Equipe */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Status da Equipe
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {leaderData.teamPerformance.activeOperators}/{leaderData.teamPerformance.totalOperators} ativos
              </div>
            </div>
            
            <div className="space-y-4">
              {teamMembers.map((member) => {
                const getStatusColor = (status) => {
                  switch (status) {
                    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
                    case 'break': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
                    case 'offline': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
                    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
                  }
                };

                const getStatusText = (status) => {
                  switch (status) {
                    case 'active': return 'Ativo';
                    case 'break': return 'Pausa';
                    case 'offline': return 'Offline';
                    default: return 'Desconhecido';
                  }
                };

                return (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {member.machine} • Eficiência: {member.efficiency}%
                        </p>
                      </div>
                    </div>
                    <span className={cn('px-2 py-1 text-xs font-medium rounded-full', getStatusColor(member.status))}>
                      {getStatusText(member.status)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Ações Rápidas
            </h3>
            
            <div className="space-y-3">
              <Link
                to={ROUTES.QUALITY_NEW}
                className="flex items-center space-x-3 p-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <BeakerIcon className="h-5 w-5" />
                <span>Novo Teste de Qualidade</span>
              </Link>
              
              <Link
                to={ROUTES.REPORTS}
                className="flex items-center space-x-3 p-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <DocumentTextIcon className="h-5 w-5" />
                <span>Relatórios de Turno</span>
              </Link>
              
              <Link
                to={ROUTES.MACHINES}
                className="flex items-center space-x-3 p-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <WrenchScrewdriverIcon className="h-5 w-5" />
                <span>Gerenciar Máquinas</span>
              </Link>
              
              <Link
                to={ROUTES.USERS}
                className="flex items-center space-x-3 p-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <UserGroupIcon className="h-5 w-5" />
                <span>Gerenciar Equipe</span>
              </Link>
              
              <button className="flex items-center space-x-3 p-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors w-full text-left">
                <CalendarDaysIcon className="h-5 w-5" />
                <span>Agendar Manutenção</span>
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </>
  );
};

export default LeaderDashboard;