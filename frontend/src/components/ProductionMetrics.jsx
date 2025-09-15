import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  ClockIcon,
  CogIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useRealTimeProduction } from '@/hooks/useRealTimeProduction';
import { toast } from 'react-hot-toast';

const ProductionMetrics = ({ machineId, machine, refreshTrigger = 0 }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentShift, setCurrentShift] = useState(null);
  const [dailyProduction, setDailyProduction] = useState(null);
  const [error, setError] = useState(null);
  
  // Hook para produção em tempo real
  const realTimeProduction = useRealTimeProduction(machine, 1000);

  const fetchProductionData = async () => {
    if (!machineId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Buscar produção do turno atual
      const shiftResponse = await fetch(
        `/api/machines/${machineId}/production/current-shift`,
        { headers }
      );
      
      if (!shiftResponse.ok) {
        throw new Error('Erro ao buscar produção do turno');
      }
      
      const shiftData = await shiftResponse.json();
      setCurrentShift(shiftData.data);

      // Buscar produção diária
      const dailyResponse = await fetch(
        `/api/machines/${machineId}/production/daily`,
        { headers }
      );
      
      if (!dailyResponse.ok) {
        throw new Error('Erro ao buscar produção diária');
      }
      
      const dailyData = await dailyResponse.json();
      setDailyProduction(dailyData.data);
      
    } catch (err) {
      console.error('Erro ao buscar dados de produção:', err);
      setError(err.message);
      toast.error('Erro ao carregar dados de produção');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductionData();
  }, [machineId, refreshTrigger]);

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 80) return 'text-green-600';
    if (efficiency >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEfficiencyBgColor = (efficiency) => {
    if (efficiency >= 80) return 'bg-green-100';
    if (efficiency >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <ArrowPathIcon className="h-8 w-8 text-gray-400 animate-spin" />
          <span className="ml-2 text-gray-500">Carregando métricas...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32 text-red-500">
          <ExclamationTriangleIcon className="h-8 w-8" />
          <span className="ml-2">Erro ao carregar métricas</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Produção do Turno Atual */}
      {currentShift && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-blue-500" />
              Turno Atual
            </h3>
            <button
              onClick={fetchProductionData}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Atualizar dados"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Produção Atual</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {realTimeProduction.currentProduction}
                  </p>
                  <p className="text-xs text-gray-500">peças produzidas</p>
                </div>
                <ChartBarIcon className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Eficiência</p>
                  <p className={`text-2xl font-bold ${
                    getEfficiencyColor(realTimeProduction.efficiency)
                  }`}>
                    {Math.round(realTimeProduction.efficiency)}%
                  </p>
                  <p className="text-xs text-gray-500">tempo real</p>
                </div>
                <CogIcon className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tempo Funcionando</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {realTimeProduction.runningTimeFormatted || '0h 0m'}
                  </p>
                  <p className="text-xs text-gray-500">turno atual</p>
                </div>
                <ClockIcon className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Velocidade Atual</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {realTimeProduction.currentSpeed} pç/min
                  </p>
                  <p className={`text-xs ${
                    realTimeProduction.isRunning ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {realTimeProduction.isRunning ? 'Funcionando' : 'Parada'}
                  </p>
                </div>
                <ArrowPathIcon className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Breakdown de Status */}
          {currentShift.statusBreakdown && currentShift.statusBreakdown.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Distribuição do Tempo</h4>
              <div className="flex rounded-lg overflow-hidden h-3 bg-gray-200">
                {currentShift.statusBreakdown.map((status, index) => {
                  let bgColor = 'bg-gray-400';
                  if (status.status === 'FUNCIONANDO') bgColor = 'bg-green-500';
                  else if (status.status === 'PARADA') bgColor = 'bg-red-500';
                  else if (status.status === 'MANUTENCAO') bgColor = 'bg-yellow-500';
                  
                  return (
                    <div
                      key={index}
                      className={`${bgColor}`}
                      style={{ width: `${status.percentage}%` }}
                      title={`${status.status}: ${formatTime(status.minutes)} (${status.percentage}%)`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                {currentShift.statusBreakdown.map((status, index) => (
                  <span key={index}>
                    {status.status}: {status.percentage}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Produção Diária - Dados Reais */}
      {realTimeProduction && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2 text-green-500" />
              Produção Diária
            </h3>
            <div className="text-sm text-gray-500">
              {new Date().toLocaleDateString('pt-BR')} - Dados em Tempo Real
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {Math.floor(realTimeProduction.currentProduction).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total de Peças</div>
              <div className="text-xs text-green-600 mt-1">
                {realTimeProduction.isRunning ? `+${realTimeProduction.currentSpeed}/min` : 'Parada'}
              </div>
            </div>
            
            <div className="text-center">
              <div className={`text-3xl font-bold ${getEfficiencyColor(realTimeProduction.efficiency)}`}>
                {Math.round(realTimeProduction.efficiency)}%
              </div>
              <div className="text-sm text-gray-500">Eficiência Atual</div>
              <div className={`text-xs mt-1 ${getEfficiencyColor(realTimeProduction.efficiency)}`}>
                {realTimeProduction.efficiency >= 80 ? 'Excelente' : 
                 realTimeProduction.efficiency >= 60 ? 'Boa' : 'Baixa'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {realTimeProduction.runningTimeFormatted || formatTime(realTimeProduction.runningTime)}
              </div>
              <div className="text-sm text-gray-500">Tempo Ativo</div>
              <div className="text-xs text-blue-600 mt-1">
                {realTimeProduction.isRunning ? 'Em funcionamento' : 'Parada'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {machine?.productionSpeed || 0}/min
              </div>
              <div className="text-sm text-gray-500">Velocidade Atual</div>
              <div className="text-xs text-orange-600 mt-1">
                Configurada: {machine?.productionSpeed || 0} peças/min
              </div>
            </div>
          </div>

          {/* Gráfico de Eficiência */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Eficiência em Tempo Real</span>
              <span className={`text-sm font-semibold ${getEfficiencyColor(realTimeProduction.efficiency)}`}>
                {Math.round(realTimeProduction.efficiency)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  realTimeProduction.efficiency >= 80 ? 'bg-green-500' :
                  realTimeProduction.efficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(realTimeProduction.efficiency, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-2">
              <span>0%</span>
              <span className="text-gray-700">Meta: 80%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Indicador de Status */}
          <div className="mt-4 p-3 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  realTimeProduction.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}></div>
                <span className="text-sm font-medium text-gray-700">
                  Status: {realTimeProduction.isRunning ? 'Funcionando' : 'Parada'}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Última atualização: {realTimeProduction.lastUpdate ? 
                  new Date(realTimeProduction.lastUpdate).toLocaleTimeString('pt-BR') : 'N/A'}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProductionMetrics;