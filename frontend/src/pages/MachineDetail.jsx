import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  DocumentTextIcon,
  PlayIcon,
  StopIcon,
  PauseIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '../hooks/useAuth';
import useMachineStatus from '../hooks/useMachineStatus';
import { useMachinePermissions } from '../hooks/useMachinePermissions';

// Componentes
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ProductionSpeedControl from '../components/ProductionSpeedControl';
import ProductionMetrics from '../components/ProductionMetrics';
import MachineOperationControls from '../components/MachineOperationControls';
import ProductionPopupManager from '../components/ProductionPopupManager';
import { cn } from '../lib/utils';
import { machineService } from '../services/api';

const MachineDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermissionForMachine, loading: permissionsLoading } = useMachinePermissions();
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [hasAccess, setHasAccess] = useState(false);
  
  // Estados do popup removidos - agora será um card separado

  // Função para atualizar dados da máquina
  const handleMachineUpdate = (updatedMachine) => {
    setMachine(updatedMachine);
  };

  // Função checkActivePopups removida - agora será um card separado

  // Buscar dados reais da API
  useEffect(() => {
    const fetchMachineData = async () => {
      try {
        setLoading(true);
        
        // Aguardar carregamento das permissões antes de verificar
        if (permissionsLoading) {
          return;
        }
        
        // Verificar permissões primeiro
        const canView = hasPermissionForMachine(parseInt(id), 'canView');
        if (!canView) {
          setHasAccess(false);
          setError('Você não tem permissão para visualizar esta máquina');
          setLoading(false);
          return;
        }
        
        setHasAccess(true);
        
        const response = await machineService.getById(id);
        
        if (response.data.success) {
          const data = response.data;
          // Extrair nome do operador de forma mais robusta
          let operatorName = 'Não atribuído';
          if (data.data.operations && data.data.operations.length > 0) {
            const operation = data.data.operations[0];
            if (operation.user && operation.user.name) {
              operatorName = String(operation.user.name);
            }
          }
          
          // Transformar dados da API para o formato esperado pelo componente
          const machineData = {
            ...data.data,
            // Mapear campos específicos se necessário
            recentTests: data.data.qualityTests || [],
            maintenanceHistory: data.data.teflonChanges || [],
            currentOperation: data.data.operations?.[0] || null,
            operator: operatorName,
            // Dados padrão para campos que podem não existir na API
            specifications: {
              maxCapacity: 2000,
              powerConsumption: '15 kW',
              operatingTemp: '180-220°C',
              pressure: '2.5 bar',
              dimensions: '2.5m x 1.8m x 2.2m',
              weight: '1500 kg'
            },
            production: {
              current: 0, // Será calculado baseado nos dados reais
              target: 2000,
              shift: 'Turno 1'
            },
            efficiency: 0, // Será calculado baseado nos dados reais
            alerts: [] // Será implementado quando houver sistema de alertas
          };
          
          setMachine(machineData);
        } else {
          throw new Error(data.message || 'Erro ao carregar dados da máquina');
        }
      } catch (err) {
        setError('Erro ao carregar dados da máquina');
      } finally {
        setLoading(false);
      }
    };

    if (id && user && !permissionsLoading) {
      fetchMachineData();
    }
  }, [id, user, hasPermissionForMachine, permissionsLoading]);

  // useEffect hooks do popup removidos - agora será um card separado

  const getStatusConfig = (status) => {
    const configs = {
      FUNCIONANDO: {
        label: 'Em Operação',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        icon: PlayIcon,
        iconColor: 'text-green-600 dark:text-green-400'
      },
      RUNNING: {
        label: 'Em Operação',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        icon: PlayIcon,
        iconColor: 'text-green-600 dark:text-green-400'
      },
      PARADA: {
        label: 'Parada',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        icon: StopIcon,
        iconColor: 'text-gray-600 dark:text-gray-400'
      },
      STOPPED: {
        label: 'Parada',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        icon: StopIcon,
        iconColor: 'text-gray-600 dark:text-gray-400'
      },
      MANUTENCAO: {
        label: 'Manutenção',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        icon: WrenchScrewdriverIcon,
        iconColor: 'text-yellow-600 dark:text-yellow-400'
      },
      MAINTENANCE: {
        label: 'Manutenção',
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        icon: WrenchScrewdriverIcon,
        iconColor: 'text-yellow-600 dark:text-yellow-400'
      },
      ERROR: {
        label: 'Erro',
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: ExclamationTriangleIcon,
        iconColor: 'text-red-600 dark:text-red-400'
      },
      FORA_DE_TURNO: {
        label: 'Fora de Turno',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        icon: ClockIcon,
        iconColor: 'text-blue-600 dark:text-blue-400'
      },
      OFF_SHIFT: {
        label: 'Fora de Turno',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        icon: ClockIcon,
        iconColor: 'text-blue-600 dark:text-blue-400'
      }
    };
    return configs[status] || {
      label: 'Desconhecido',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      icon: ClockIcon,
      iconColor: 'text-gray-600 dark:text-gray-400'
    };
  };

  const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 95) return 'text-green-600 dark:text-green-400';
    if (efficiency >= 85) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {error || 'Máquina não encontrada'}
          </h3>
          {!hasAccess && error?.includes('permissão') && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Entre em contato com o gestor para solicitar acesso a esta máquina.
            </p>
          )}
          <Link
            to="/machines"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar às Máquinas
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(machine.status);
  const StatusIcon = statusConfig.icon;

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: ChartBarIcon },
    { id: 'tests', label: 'Testes de Qualidade', icon: DocumentTextIcon },
    { id: 'maintenance', label: 'Manutenção', icon: WrenchScrewdriverIcon },
    { id: 'settings', label: 'Configurações', icon: Cog6ToothIcon }
  ];

  return (
    <>
      <Helmet>
        <title>{machine.name} - Detalhes da Máquina - Sistema ZARA</title>
        <meta name="description" content={`Detalhes e monitoramento da ${machine.name}`} />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/machines')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {machine.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {machine.id} • {machine.model} • {machine.location}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className={cn(
              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
              statusConfig.color
            )}>
              <StatusIcon className={cn('h-4 w-4 mr-2', statusConfig.iconColor)} />
              {statusConfig.label}
            </span>
            
            {machine.alerts && machine.alerts.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                {machine.alerts.length} alerta{machine.alerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Sistema de Alertas de Teste de Qualidade removido - usando apenas popupThreshold */}

        {/* Métricas principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Eficiência</p>
                <p className={cn('text-2xl font-bold', getEfficiencyColor(machine.efficiency))}>
                  {Math.round(machine.efficiency)}%
                </p>
              </div>
              <ChartBarIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Produção Atual</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {machine.production ? (machine.production.current || 0).toLocaleString() : '0'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Meta: {machine.production.target.toLocaleString()}
                </p>
              </div>
              <PlayIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Operador</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {(() => {
                    const operator = machine.operator;
                    if (!operator || operator === 'div' || typeof operator !== 'string') {
                      return 'Não atribuído';
                    }
                    return operator;
                  })()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {machine.production.shift}
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {(() => {
                    const operator = machine.operator;
                    if (!operator || operator === 'div' || typeof operator !== 'string') {
                      return 'NA';
                    }
                    return operator.split(' ').map(n => n[0]).join('').toUpperCase();
                  })()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Próxima Manutenção</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {Math.ceil((machine.nextMaintenance - new Date()) / (1000 * 60 * 60 * 24))} dias
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDateTime(machine.nextMaintenance).split(' ')[0]}
                </p>
              </div>
              <ClockIcon className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Alertas */}
        {machine.alerts && machine.alerts.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
                  Alertas Ativos ({machine.alerts.length})
                </h3>
                <div className="space-y-2">
                  {machine.alerts.map((alert) => (
                    <div key={alert.id} className="text-sm text-red-700 dark:text-red-300">
                      <span className="font-medium">{alert.message}</span>
                      <span className="text-red-500 dark:text-red-400 ml-2">
                        • {formatDateTime(alert.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    )}
                  >
                    <TabIcon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Controles de Operação */}
                <MachineOperationControls 
                  machine={machine} 
                  onOperationChange={setMachine}
                />

                {/* Controle de Velocidade de Produção */}
                <ProductionSpeedControl 
                  machine={machine} 
                  onSpeedUpdate={handleMachineUpdate}
                />

                {/* Métricas de Produção */}
                <ProductionMetrics 
                  machineId={machine.id}
                  machine={machine}
                  refreshTrigger={machine.updatedAt}
                />
              </div>
            )}

            {activeTab === 'tests' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Testes de Qualidade Recentes
                  </h3>
                  <Link
                    to="/quality/new-test"
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    Novo Teste
                  </Link>
                </div>
                
                <div className="space-y-3">
                  {machine.recentTests.map((test) => (
                    <div key={test.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Teste {test.id}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDateTime(test.date)} • {test.operator}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={cn(
                            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                            test.result === 'APPROVED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          )}>
                            {test.result === 'APPROVED' ? (
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                            ) : (
                              <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                            )}
                            {test.result === 'APPROVED' ? 'Aprovado' : 'Reprovado'}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {test.defects} defeito{test.defects !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'maintenance' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Histórico de Manutenção
                </h3>
                
                <div className="space-y-3">
                  {machine.maintenanceHistory.map((maintenance) => (
                    <div key={maintenance.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {maintenance.type}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                            {maintenance.description}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            {formatDateTime(maintenance.date)} • {maintenance.technician} • {maintenance.duration}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configurações da Máquina
                </h3>
                
                {(user?.role === 'ADMIN' || user?.role === 'MANAGER') ? (
                  <div className="text-center py-8">
                    <Cog6ToothIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Configurações avançadas em desenvolvimento
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Você não tem permissão para acessar as configurações desta máquina.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Popup de Produção baseado em popupThreshold */}
        <ProductionPopupManager 
          machineId={machine?.id}
        />
    </>
  );
};

export default MachineDetail;