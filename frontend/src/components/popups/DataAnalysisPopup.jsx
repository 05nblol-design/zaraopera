import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import Modal from '@/components/ui/Modal';
import { cn, formatNumber, formatDateTime } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';
import useMachineStatus from '@/hooks/useMachineStatus';

const DataAnalysisPopup = ({ isOpen, onClose }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedMetric, setSelectedMetric] = useState('production');
  const [loading, setLoading] = useState(false);
  
  const { isConnected } = useSocket();
  const { machines } = useMachineStatus();

  // Dados simulados para análise
  const [analysisData, setAnalysisData] = useState({
    production: {
      current: 2847,
      target: 3000,
      change: '+12.5%',
      trend: 'up',
      efficiency: 94.9
    },
    quality: {
      approvalRate: 98.2,
      defectRate: 1.8,
      change: '+0.3%',
      trend: 'up',
      testsPerformed: 156
    },
    performance: {
      uptime: 96.7,
      downtime: 3.3,
      change: '-0.8%',
      trend: 'up',
      avgCycleTime: 45.2
    },
    hourlyData: [
      { hour: '06:00', production: 180, target: 200, efficiency: 90 },
      { hour: '07:00', production: 195, target: 200, efficiency: 97.5 },
      { hour: '08:00', production: 205, target: 200, efficiency: 102.5 },
      { hour: '09:00', production: 198, target: 200, efficiency: 99 },
      { hour: '10:00', production: 210, target: 200, efficiency: 105 },
      { hour: '11:00', production: 188, target: 200, efficiency: 94 },
      { hour: '12:00', production: 175, target: 200, efficiency: 87.5 },
      { hour: '13:00', production: 192, target: 200, efficiency: 96 }
    ]
  });

  // Atualizar dados quando o período mudar
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      // Simular carregamento de dados
      setTimeout(() => {
        setLoading(false);
      }, 800);
    }
  }, [selectedPeriod, isOpen]);

  const periods = [
    { id: 'today', label: 'Hoje', icon: ClockIcon },
    { id: 'week', label: 'Esta Semana', icon: CalendarDaysIcon },
    { id: 'month', label: 'Este Mês', icon: CalendarDaysIcon }
  ];

  const metrics = [
    { id: 'production', label: 'Produção', color: 'blue' },
    { id: 'quality', label: 'Qualidade', color: 'green' },
    { id: 'performance', label: 'Performance', color: 'purple' }
  ];

  const MetricCard = ({ title, value, change, trend, subtitle, color = 'blue' }) => {
    const colorClasses = {
      blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
      green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
      purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
      red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
    };

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h4>
          <div className={cn('p-1 rounded', colorClasses[color])}>
            {trend === 'up' ? (
              <ArrowTrendingUpIcon className="h-4 w-4" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4" />
            )}
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
          <span className={cn(
            'text-sm font-medium',
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          )}>
            {change}
          </span>
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
    );
  };

  const SimpleChart = ({ data }) => {
    const maxValue = Math.max(...data.map(d => Math.max(d.production, d.target)));
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Produção por Hora</span>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Real</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-300 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Meta</span>
            </div>
          </div>
        </div>
        
        <div className="h-48 flex items-end space-x-2">
          {data.map((item, index) => {
            const productionHeight = Math.round((item.production / maxValue) * 100);
            const targetHeight = Math.round((item.target / maxValue) * 100);
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center space-y-1">
                <div className="w-full relative" style={{ height: '160px' }}>
                  {/* Barra da meta */}
                  <div 
                    className="absolute bottom-0 w-full bg-gray-200 dark:bg-gray-600 rounded-t opacity-50"
                    style={{ height: `${targetHeight}%` }}
                  />
                  {/* Barra da produção */}
                  <div 
                    className="absolute bottom-0 w-full bg-blue-500 rounded-t transition-all duration-500"
                    style={{ height: `${productionHeight}%` }}
                  />
                  {/* Valor */}
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {item.production}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {item.hour}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Análise de Dados em Tempo Real"
      size="xl"
    >
      <div className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</span>
            <div className="flex space-x-1">
              {periods.map((period) => {
                const Icon = period.icon;
                return (
                  <button
                    key={period.id}
                    onClick={() => setSelectedPeriod(period.id)}
                    className={cn(
                      'px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center space-x-1',
                      selectedPeriod === period.id
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{period.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Status de conexão */}
          <div className={cn(
            'flex items-center space-x-2 px-2 py-1 rounded-full text-xs',
            isConnected 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          )}>
            <div className={cn(
              'h-1.5 w-1.5 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )} />
            <span>{isConnected ? 'Dados em tempo real' : 'Offline'}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Produção Total"
                value={formatNumber(analysisData.production.current)}
                change={analysisData.production.change}
                trend={analysisData.production.trend}
                subtitle={`Meta: ${formatNumber(analysisData.production.target)}`}
                color="blue"
              />
              <MetricCard
                title="Taxa de Aprovação"
                value={`${analysisData.quality.approvalRate}%`}
                change={analysisData.quality.change}
                trend={analysisData.quality.trend}
                subtitle={`${analysisData.quality.testsPerformed} testes realizados`}
                color="green"
              />
              <MetricCard
                title="Tempo Ativo"
                value={`${analysisData.performance.uptime}%`}
                change={analysisData.performance.change}
                trend={analysisData.performance.trend}
                subtitle={`Ciclo médio: ${analysisData.performance.avgCycleTime}s`}
                color="purple"
              />
            </div>

            {/* Gráfico de Produção */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
              <SimpleChart data={analysisData.hourlyData} />
            </div>

            {/* Resumo e Insights */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <ChartBarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Insights da Análise
                  </h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Produção 12.5% acima da média do período anterior</li>
                    <li>• Pico de eficiência às 10:00 com 105% da meta</li>
                    <li>• Queda na produção durante o horário de almoço (12:00-13:00)</li>
                    <li>• Taxa de qualidade mantida acima de 98%</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default DataAnalysisPopup;