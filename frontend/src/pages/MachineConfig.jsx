import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import {
  ArrowLeftIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  ChartBarIcon,
  BellIcon,
  ShieldCheckIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useMachinePermissions } from '@/hooks/useMachinePermissions';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { machineService } from '@/services/api';
import ProductionTestAlertManager from '@/components/ProductionTestAlertManager';

function MachineConfig() {
  console.log('MachineConfig component loaded!');
  
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermissionForMachine } = useMachinePermissions();
  
  console.log('👤 Usuário atual:', user);
  console.log('🆔 ID da máquina:', id);
  
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [machine, setMachine] = useState(null);
  const [activeTab, setActiveTab] = useState('general');

  const [config, setConfig] = useState({
    general: {
      name: '',
      model: '',
      location: '',
      capacity: '',
      description: ''
    },
    operational: {
      maxTemperature: 200,
      minTemperature: 150,
      maxPressure: 10,
      minPressure: 5,
      cycleTime: 30,
      maintenanceInterval: 168, // horas
      qualityCheckInterval: 50 // peças
    },
    alerts: {
      temperatureAlert: true,
      pressureAlert: true,
      maintenanceAlert: true,
      qualityAlert: true,
      teflonAlert: true,
      emailNotifications: true,
      smsNotifications: false
    },
    quality: {
      defectThreshold: 5, // %
      autoReject: true,
      requirePhotos: true,
      minSampleSize: 10
    },
    production: {
      popupThreshold: 50, // quantidade de produtos para gerar popup
      alertThreshold: 100, // quantidade de produtos para gerar alerta para gestores
      enablePopups: true,
      enableAlerts: true
    },
    maintenance: {
      preventiveEnabled: true,
      predictiveEnabled: false,
      autoSchedule: true,
      reminderDays: 7
    }
  });

  useEffect(() => {
    fetchMachineConfig();
  }, [id]);



  // Configuração de status
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

  const fetchMachineConfig = async () => {
    try {
      setLoading(true);
      
      // Verificar permissões primeiro
      const canEdit = hasPermissionForMachine(parseInt(id), 'canEdit');
      if (!canEdit) {
        setHasAccess(false);
        toast.error('Você não tem permissão para configurar esta máquina');
        setLoading(false);
        return;
      }
      
      setHasAccess(true);
      
      const response = await machineService.getConfig(id);
      const data = response.data;
      
      if (data.success) {
        setMachine(data.data.machine);
        // Verificar se config existe, senão manter o padrão
        if (data.data.config) {
          // Garantir que valores null sejam convertidos para strings vazias
          const sanitizedConfig = {
            ...data.data.config,
            general: {
              name: data.data.config.general?.name || '',
              model: data.data.config.general?.model || '',
              location: data.data.config.general?.location || '',
              capacity: data.data.config.general?.capacity || '',
              description: data.data.config.general?.description || ''
            },
            operational: {
              ...data.data.config.operational,
              maxTemperature: data.data.config.operational?.maxTemperature || 200,
              minTemperature: data.data.config.operational?.minTemperature || 150,
              maxPressure: data.data.config.operational?.maxPressure || 10,
              minPressure: data.data.config.operational?.minPressure || 5,
              cycleTime: data.data.config.operational?.cycleTime || 30,
              maintenanceInterval: data.data.config.operational?.maintenanceInterval || 168
            },
            alerts: {
              ...data.data.config.alerts,
              temperatureAlert: data.data.config.alerts?.temperatureAlert ?? true,
              pressureAlert: data.data.config.alerts?.pressureAlert ?? true,
              maintenanceAlert: data.data.config.alerts?.maintenanceAlert ?? true,
              qualityAlert: data.data.config.alerts?.qualityAlert ?? true,
              teflonAlert: data.data.config.alerts?.teflonAlert ?? true,
              emailNotifications: data.data.config.alerts?.emailNotifications ?? true,
              smsNotifications: data.data.config.alerts?.smsNotifications ?? false
            },
            quality: {
              ...data.data.config.quality,
              defectThreshold: data.data.config.quality?.defectThreshold || 5,
              autoReject: data.data.config.quality?.autoReject ?? true,
              requirePhotos: data.data.config.quality?.requirePhotos ?? true,
              minSampleSize: data.data.config.quality?.minSampleSize || 10
            },
            production: {
              ...data.data.config.production,
              popupThreshold: data.data.config.production?.popupThreshold || 50,
              alertThreshold: data.data.config.production?.alertThreshold || 100,
              enablePopups: data.data.config.production?.enablePopups ?? true,
              enableAlerts: data.data.config.production?.enableAlerts ?? true
            },
            maintenance: {
              ...data.data.config.maintenance,
              preventiveEnabled: data.data.config.maintenance?.preventiveEnabled ?? true,
              predictiveEnabled: data.data.config.maintenance?.predictiveEnabled ?? false,
              autoSchedule: data.data.config.maintenance?.autoSchedule ?? true,
              reminderDays: data.data.config.maintenance?.reminderDays || 7
            }
          };
          setConfig(sanitizedConfig);
        }
      } else {
        throw new Error(data.message || 'Erro ao carregar configurações');
      }
      
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      toast.error('Erro ao carregar configurações da máquina');
    } finally {
      setLoading(false);
    }
  };

  // Função auxiliar para converter valores numéricos com validação
  const parseNumericValue = (value, defaultValue = 0) => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  const handleConfigChange = (section, field, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const response = await machineService.updateConfig(id, config);
      
      if (response.data.success) {
        toast.success('Configurações salvas com sucesso!');
      } else {
        toast.error('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Máquina não encontrada
          </h3>
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

  // Verificar permissões
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Acesso Negado
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Você não tem permissão para configurar esta máquina.
          </p>
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

  const tabs = [
    { id: 'general', label: 'Geral', icon: Cog6ToothIcon },
    { id: 'operational', label: 'Operacional', icon: ChartBarIcon },
    { id: 'alerts', label: 'Alertas', icon: BellIcon },
    { id: 'quality', label: 'Qualidade', icon: CheckCircleIcon },
    { id: 'production', label: 'Produção', icon: ClockIcon },
    { id: 'maintenance', label: 'Manutenção', icon: WrenchScrewdriverIcon }
  ];

  return (
    <>
      <Helmet>
        <title>{machine.name} - Configurações - Sistema ZARA</title>
        <meta name="description" content={`Configurações da ${machine.name}`} />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/machines"
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Configurações - {machine.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {machine.model} • {machine.location}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {machine.status && (() => {
              const statusConfig = getStatusConfig(machine.status);
              const StatusIcon = statusConfig.icon;
              return (
                <span className={cn(
                  'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                  statusConfig.color
                )}>
                  <StatusIcon className={cn('h-4 w-4 mr-2', statusConfig.iconColor)} />
                  {statusConfig.label}
                </span>
              );
            })()}
            
            {machine.alerts && machine.alerts.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                {machine.alerts.length} alerta{machine.alerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </button>
        </div>

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
            {/* Aba Geral */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Informações Gerais
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nome da Máquina
                    </label>
                    <input
                      type="text"
                      value={config.general.name}
                      onChange={(e) => handleConfigChange('general', 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Modelo
                    </label>
                    <input
                      type="text"
                      value={config.general.model}
                      onChange={(e) => handleConfigChange('general', 'model', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Localização
                    </label>
                    <input
                      type="text"
                      value={config.general.location}
                      onChange={(e) => handleConfigChange('general', 'location', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Capacidade
                    </label>
                    <input
                      type="text"
                      value={config.general.capacity}
                      onChange={(e) => handleConfigChange('general', 'capacity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={config.general.description}
                    onChange={(e) => handleConfigChange('general', 'description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Aba Operacional */}
            {activeTab === 'operational' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Parâmetros Operacionais
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Temperatura Máxima (°C)
                    </label>
                    <input
                      type="number"
                      value={config.operational.maxTemperature}
                      onChange={(e) => handleConfigChange('operational', 'maxTemperature', parseNumericValue(e.target.value, 200))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Temperatura Mínima (°C)
                    </label>
                    <input
                      type="number"
                      value={config.operational.minTemperature}
                      onChange={(e) => handleConfigChange('operational', 'minTemperature', parseNumericValue(e.target.value, 150))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pressão Máxima (bar)
                    </label>
                    <input
                      type="number"
                      value={config.operational.maxPressure}
                      onChange={(e) => handleConfigChange('operational', 'maxPressure', parseNumericValue(e.target.value, 10))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pressão Mínima (bar)
                    </label>
                    <input
                      type="number"
                      value={config.operational.minPressure}
                      onChange={(e) => handleConfigChange('operational', 'minPressure', parseNumericValue(e.target.value, 5))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tempo de Ciclo (min)
                    </label>
                    <input
                      type="number"
                      value={config.operational.cycleTime}
                      onChange={(e) => handleConfigChange('operational', 'cycleTime', parseNumericValue(e.target.value, 30))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Intervalo de Manutenção (horas)
                    </label>
                    <input
                      type="number"
                      value={config.operational.maintenanceInterval}
                      onChange={(e) => handleConfigChange('operational', 'maintenanceInterval', parseNumericValue(e.target.value, 168))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Aba Alertas */}
            {activeTab === 'alerts' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configurações de Alertas
                </h3>
                
                <div className="space-y-4">
                  {[
                    { key: 'temperatureAlert', label: 'Alertas de Temperatura' },
                    { key: 'pressureAlert', label: 'Alertas de Pressão' },
                    { key: 'maintenanceAlert', label: 'Alertas de Manutenção' },
                    { key: 'qualityAlert', label: 'Alertas de Qualidade' },
                    { key: 'teflonAlert', label: 'Alertas de Teflon' },
                    { key: 'emailNotifications', label: 'Notificações por Email' },
                    { key: 'smsNotifications', label: 'Notificações por SMS' }
                  ].map((alert) => (
                    <div key={alert.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {alert.label}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.alerts[alert.key]}
                          onChange={(e) => handleConfigChange('alerts', alert.key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aba Qualidade */}
            {activeTab === 'quality' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configurações de Qualidade
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Limite de Defeitos (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={config.quality.defectThreshold}
                      onChange={(e) => handleConfigChange('quality', 'defectThreshold', parseNumericValue(e.target.value, 5))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tamanho Mínimo da Amostra
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={config.quality.minSampleSize}
                      onChange={(e) => handleConfigChange('quality', 'minSampleSize', parseNumericValue(e.target.value, 10))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  

                </div>
                
                <div className="space-y-4">
                  {[
                    { key: 'autoReject', label: 'Rejeição Automática', description: 'Rejeitar automaticamente peças com defeitos' },
                    { key: 'requirePhotos', label: 'Fotos Obrigatórias', description: 'Exigir fotos nos testes de qualidade' }
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {setting.label}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {setting.description}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.quality[setting.key]}
                          onChange={(e) => handleConfigChange('quality', setting.key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aba Produção */}
            {activeTab === 'production' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configurações de Produção
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quantidade para Pop-up de Teste
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={config.production.popupThreshold}
                      onChange={(e) => handleConfigChange('production', 'popupThreshold', parseNumericValue(e.target.value, 50))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 50"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Configuração ATIVA: Quantidade de produtos para gerar pop-up de teste de qualidade no sistema
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Quantidade para Alerta de Gestores
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={config.production.alertThreshold}
                      onChange={(e) => handleConfigChange('production', 'alertThreshold', parseNumericValue(e.target.value, 100))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: 100"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Configuração ATIVA: Quantidade de produtos para gerar alerta específico para líderes e gestores
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {[
                    { key: 'enablePopups', label: 'Ativar Pop-ups de Teste', description: 'Exibir pop-ups quando atingir a quantidade configurada' },
                    { key: 'enableAlerts', label: 'Ativar Alertas para Gestores', description: 'Enviar alertas para líderes e gestores quando necessário' }
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {setting.label}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {setting.description}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.production[setting.key]}
                          onChange={(e) => handleConfigChange('production', setting.key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aba Manutenção */}
            {activeTab === 'maintenance' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Configurações de Manutenção
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Dias de Antecedência para Lembrete
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={config.maintenance.reminderDays}
                      onChange={(e) => handleConfigChange('maintenance', 'reminderDays', parseNumericValue(e.target.value, 7))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  {[
                    { key: 'preventiveEnabled', label: 'Manutenção Preventiva', description: 'Ativar manutenção preventiva programada' },
                    { key: 'predictiveEnabled', label: 'Manutenção Preditiva', description: 'Ativar manutenção baseada em sensores' },
                    { key: 'autoSchedule', label: 'Agendamento Automático', description: 'Agendar automaticamente manutenções' }
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {setting.label}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {setting.description}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.maintenance[setting.key]}
                          onChange={(e) => handleConfigChange('maintenance', setting.key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Production Test Alert Manager */}
      <ProductionTestAlertManager 
        machineId={id} 
        isOperating={true}
      />
    </>
  );
}

export default MachineConfig;