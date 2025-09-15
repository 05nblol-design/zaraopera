import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  ChartBarIcon,
  DocumentChartBarIcon,
  CalendarDaysIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  EyeIcon,
  ChartPieIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CogIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '../hooks/useAuth';
import { useMachinePermissions } from '../hooks/useMachinePermissions';
import { useSocket } from '../hooks/useSocket';
import { useRealTimeProduction } from '../hooks/useRealTimeProduction';
import useMachineStatus from '../hooks/useMachineStatus';

// Utilitários
import { cn, formatDateTime, formatNumber, formatCurrency } from '../lib/utils';

// Popups
import DataAnalysisPopup from '../components/popups/DataAnalysisPopup';
import ReportsPopup from '../components/popups/ReportsPopup';

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState('production');
  const [dateRange, setDateRange] = useState('MONTH'); // TODAY, WEEK, MONTH, QUARTER, YEAR
  const [selectedMachine, setSelectedMachine] = useState('ALL');
  const [selectedOperator, setSelectedOperator] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [showDataAnalysisPopup, setShowDataAnalysisPopup] = useState(false);
  const [showReportsPopup, setShowReportsPopup] = useState(false);
  

  

  
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const { machines } = useMachineStatus();
  const { filterMachinesByPermissions } = useMachinePermissions();
  
  // Estados para dados de relatórios da API
  const [reportsRealTimeData, setReportsRealTimeData] = useState({
    totalProduction: 0,
    totalRunningTime: 0,
    averageEfficiency: 0,
    totalDowntime: 0,
    qualityRate: 0,
    machinePerformance: []
  });
  
  // Estados para controle de loading e erros
  const [loadingData, setLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Buscar dados reais de produção para relatórios da API usando OEE
  const fetchReportsProductionData = async () => {
    try {
      setLoadingData(true);
      setErrorMessage(null);
      // Buscar dados de produção e OEE em paralelo
      const [productionResponse, oeeResponse] = await Promise.all([
        fetch('/api/reports/production-summary', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/reports/current-shift-efficiency', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
      ]);
      
      if (productionResponse.ok) {
        const productionData = await productionResponse.json();
        let reportData = productionData.success ? productionData.data : {};
        
        // Usar dados OEE se disponíveis
        if (oeeResponse.ok) {
          const oeeData = await oeeResponse.json();
          if (oeeData.success && oeeData.data) {
            reportData.averageEfficiency = oeeData.data.averageEfficiency || reportData.averageEfficiency || 0;
          }
        }
        
        setReportsRealTimeData(reportData);
        return;
      }
      
      // Fallback: usar dados básicos das máquinas sem cálculos aleatórios
      if (machines && machines.length > 0) {
        const filteredMachines = filterMachinesByPermissions(machines, 'canView');
        const runningMachines = filteredMachines.filter(m => 
          m.status === 'FUNCIONANDO' || m.status === 'RUNNING'
        );
        
        setReportsRealTimeData({
          totalProduction: runningMachines.length * 150, // Estimativa conservadora
          totalRunningTime: runningMachines.length * 60,
          averageEfficiency: 0, // Usar 0 em caso de erro ao invés de valor fixo
          totalDowntime: (filteredMachines.length - runningMachines.length) * 2,
          qualityRate: 95, // Valor padrão conservador
          machinePerformance: filteredMachines.map(machine => ({
            machine: machine.name || `Máquina ${machine.code}`,
            production: (machine.status === 'FUNCIONANDO' || machine.status === 'RUNNING') ? 150 : 0,
            efficiency: (machine.status === 'FUNCIONANDO' || machine.status === 'RUNNING') ? 80 : 0,
            downtime: (machine.status === 'FUNCIONANDO' || machine.status === 'RUNNING') ? 0 : 2
          }))
        });
      }
    } catch (error) {
      console.error('Erro ao buscar dados de produção para relatórios:', error);
      setErrorMessage('Erro ao carregar dados de produção. Tente novamente.');
    } finally {
      setLoadingData(false);
    }
  };

  // Atualizar dados de relatórios periodicamente
  useEffect(() => {
    fetchReportsProductionData();
    const interval = setInterval(fetchReportsProductionData, 60000); // A cada 1 minuto
    return () => clearInterval(interval);
  }, [machines, dateRange, selectedMachine]);
  
  // Função para buscar dados dos relatórios
  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      // Buscar dados de produção
      const productionResponse = await fetch('/api/reports/production-data', { headers });
      const productionData = await productionResponse.json();
      
      // Buscar métricas de qualidade
      const qualityResponse = await fetch('/api/reports/quality-metrics', { headers });
      const qualityData = await qualityResponse.json();
      
      // Buscar performance das máquinas
      const machineResponse = await fetch('/api/reports/machine-performance', { headers });
      const machineData = await machineResponse.json();
      
      // Buscar dados de manutenção
      const maintenanceResponse = await fetch('/api/reports/maintenance-data', { headers });
      const maintenanceData = await maintenanceResponse.json();
      
      // Buscar dados de produtividade de operadores
      const operatorResponse = await fetch('/api/reports/operator-productivity', { headers });
      const operatorData = await operatorResponse.json();
      
      // Atualizar estado com dados reais
      if (productionData.success && qualityData.success && machineData.success && maintenanceData.success && operatorData.success) {
        setReportData(prevData => ({
          ...prevData,
          production: {
            totalProduction: productionData.data.total || reportsRealTimeData.totalProduction || 0,
            targetProduction: 16000, // Meta padrão
            efficiency: machineData.data.avgEfficiency || reportsRealTimeData.averageEfficiency || 0,
            downtime: machineData.data.avgDowntime || reportsRealTimeData.totalDowntime || 0,
            qualityRate: qualityData.data.approvalRate || reportsRealTimeData.qualityRate || 0,
            defectRate: 100 - (qualityData.data.approvalRate || reportsRealTimeData.qualityRate || 0),
            machineUtilization: machineData.data.avgUtilization || reportsRealTimeData.averageEfficiency || 0,
            energyConsumption: 1250.5, // Valor padrão
            dailyProduction: productionData.data.daily?.map((value, index) => ({
              date: productionData.data.labels?.[index] || new Date().toISOString().split('T')[0],
              production: value,
              target: 550,
              efficiency: Math.round((value / 550) * 100)
            })) || [],
            machinePerformance: machineData.data.machines?.length > 0 ? machineData.data.machines : (reportsRealTimeData.machinePerformance || [])
          },
          quality: {
            totalTests: qualityData.data.total || 0,
            passedTests: qualityData.data.approved || 0,
            failedTests: qualityData.data.rejected || 0,
            passRate: qualityData.data.approvalRate || 0,
            avgTestTime: qualityData.data.avgTestTime || 12.5,
            criticalDefects: qualityData.data.criticalDefects || 0,
            minorDefects: qualityData.data.minorDefects || 0,
            testsByType: qualityData.data.testsByType || prevData.quality?.testsByType || [],
            defectsByCategory: qualityData.data.defectsByCategory || prevData.quality?.defectsByCategory || [],
            qualityTrend: qualityData.data.labels?.map((date, index) => ({
              date,
              passRate: qualityData.data.approved?.[index] && qualityData.data.total > 0 
                ? Math.round((qualityData.data.approved[index] / (qualityData.data.approved[index] + qualityData.data.rejected[index])) * 100)
                : 0,
              tests: (qualityData.data.approved?.[index] || 0) + (qualityData.data.rejected?.[index] || 0)
            })) || prevData.quality?.qualityTrend || []
          },
          maintenance: {
            totalMaintenance: maintenanceData.data.totalMaintenance || 0,
            preventive: maintenanceData.data.preventive || 0,
            corrective: maintenanceData.data.corrective || 0,
            avgDowntime: maintenanceData.data.avgDowntime || 0,
            maintenanceCost: maintenanceData.data.maintenanceCost || 0,
            plannedVsUnplanned: maintenanceData.data.plannedVsUnplanned || { planned: 0, unplanned: 0 },
            maintenanceByMachine: maintenanceData.data.maintenanceByMachine || [],
            downtimeTrend: maintenanceData.data.downtimeTrend || []
          },
          operators: {
            totalOperators: operatorData.data.length || 0,
            activeOperators: operatorData.data.filter(op => op.metrics.totalOperations > 0).length || 0,
            avgProductivity: operatorData.data.length > 0 
              ? Math.round(operatorData.data.reduce((sum, op) => sum + parseFloat(op.metrics.approvalRate || 0), 0) / operatorData.data.length)
              : 0,
            totalHours: Math.round(operatorData.data.reduce((sum, op) => sum + (op.metrics.totalOperationHours || 0), 0)),
            overtimeHours: 0, // Não disponível na API atual
            operatorPerformance: operatorData.data.slice(0, 5).map(op => ({
              name: op.operator.name,
              shift: 'Turno 1', // Valor padrão - não disponível na API
              productivity: parseFloat(op.metrics.approvalRate || 0),
              hours: Math.round(op.metrics.totalOperationHours || 0),
              tests: op.metrics.totalQualityTests || 0
            })),
            shiftPerformance: [
              { shift: 'Turno 1', operators: Math.ceil(operatorData.data.length / 3), avgProductivity: 97.2, production: 5420 },
              { shift: 'Turno 2', operators: Math.ceil(operatorData.data.length / 3), avgProductivity: 94.8, production: 4890 },
              { shift: 'Turno 3', operators: Math.floor(operatorData.data.length / 3), avgProductivity: 91.5, production: 3110 }
            ]
          }
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar dados dos relatórios:', error);
      // Manter dados padrão em caso de erro
    } finally {
      setLoading(false);
    }
  };
  
  // Buscar dados quando o componente montar ou filtros mudarem
  useEffect(() => {
    fetchReportData();
  }, [selectedReport, dateRange, selectedMachine, selectedOperator]);
  
  // Dados dos relatórios vindos da API
  const [reportData, setReportData] = useState({
    production: {
      totalProduction: 0,
      targetProduction: 0,
      efficiency: 0,
      downtime: 0,
      qualityRate: 0,
      defectRate: 0,
      machineUtilization: 0,
      energyConsumption: 0,
      dailyProduction: [],
      machinePerformance: []
    },
    quality: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      passRate: 0,
      avgTestTime: 0,
      criticalDefects: 0,
      minorDefects: 0,
      testsByType: [],
      defectsByCategory: [],
      qualityTrend: []
    },
    maintenance: {
      totalMaintenance: 0,
      preventive: 0,
      corrective: 0,
      avgDowntime: 0,
      maintenanceCost: 0,
      plannedVsUnplanned: {
        planned: 0,
        unplanned: 0
      },
      maintenanceByMachine: [],
      downtimeTrend: []
    },
    operators: {
      totalOperators: 0,
      activeOperators: 0,
      avgProductivity: 0,
      totalHours: 0,
      overtimeHours: 0,
      operatorPerformance: [],
      shiftPerformance: []
    }
  });

  // Função para buscar dados de produção
  const fetchProductionData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/production/reports/production-summary?' + new URLSearchParams({
        dateRange: dateRange,
        machineId: selectedMachine || 'ALL',
        operatorId: selectedOperator || 'ALL'
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.data || {};
      }
    } catch (error) {
      console.error('Erro ao buscar dados de produção:', error);
    }
    return null;
  };

  // Função para buscar dados de qualidade
  const fetchQualityData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/reports/quality-metrics?' + new URLSearchParams({
        startDate: getDateRangeStart(dateRange),
        endDate: new Date().toISOString(),
        machineId: selectedMachine || 'all'
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.data || {};
      }
    } catch (error) {
      console.error('Erro ao buscar dados de qualidade:', error);
    }
    return null;
  };

  // Função para buscar dados de operadores
  const fetchOperatorsData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users?' + new URLSearchParams({
        role: 'OPERATOR',
        active: 'true',
        limit: '100'
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.data || {};
      }
    } catch (error) {
      console.error('Erro ao buscar dados de operadores:', error);
    }
    return null;
  };

  // Função auxiliar para calcular data de início baseada no range
  const getDateRangeStart = (range) => {
    const now = new Date();
    const start = new Date();
    
    switch (range) {
      case 'TODAY':
        start.setHours(0, 0, 0, 0);
        break;
      case 'WEEK':
        start.setDate(now.getDate() - 7);
        break;
      case 'MONTH':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'QUARTER':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'YEAR':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setHours(0, 0, 0, 0);
    }
    
    return start.toISOString();
  };

  // Função para carregar todos os dados dos relatórios
  const loadReportsData = async () => {
    setLoading(true);
    setErrorMessage(null);
    
    try {
      const [productionData, qualityData, operatorsData] = await Promise.all([
        fetchProductionData(),
        fetchQualityData(),
        fetchOperatorsData()
      ]);
      
      setReportData(prevData => ({
        production: {
          ...prevData.production,
          totalProduction: productionData?.totalProduction || 0,
          targetProduction: productionData?.targetProduction || 0,
          efficiency: productionData?.efficiency || 0,
          downtime: productionData?.downtime || 0,
          qualityRate: productionData?.qualityRate || 0,
          defectRate: productionData?.defectRate || 0,
          machineUtilization: productionData?.machineUtilization || 0,
          energyConsumption: productionData?.energyConsumption || 0,
          dailyProduction: productionData?.dailyProduction || [],
          machinePerformance: productionData?.machinePerformance || []
        },
        quality: {
          ...prevData.quality,
          totalTests: qualityData?.totalTests || 0,
          passedTests: qualityData?.passedTests || 0,
          failedTests: qualityData?.failedTests || 0,
          passRate: qualityData?.passRate || 0,
          avgTestTime: qualityData?.avgTestTime || 0,
          criticalDefects: qualityData?.criticalDefects || 0,
          minorDefects: qualityData?.minorDefects || 0,
          testsByType: qualityData?.testsByType || [],
          defectsByCategory: qualityData?.defectsByCategory || [],
          qualityTrend: qualityData?.qualityTrend || []
        },
        maintenance: {
          ...prevData.maintenance,
          totalMaintenance: productionData?.totalMaintenance || 0,
          preventive: productionData?.preventive || 0,
          corrective: productionData?.corrective || 0,
          avgDowntime: productionData?.avgDowntime || 0,
          maintenanceCost: productionData?.maintenanceCost || 0,
          plannedVsUnplanned: productionData?.plannedVsUnplanned || { planned: 0, unplanned: 0 },
          maintenanceByMachine: productionData?.maintenanceByMachine || [],
          downtimeTrend: productionData?.downtimeTrend || []
        },
        operators: {
          ...prevData.operators,
          totalOperators: operatorsData?.users?.length || 0,
          activeOperators: operatorsData?.users?.filter(u => u.isActive)?.length || 0,
          avgProductivity: operatorsData?.avgProductivity || 0,
          totalHours: operatorsData?.totalHours || 0,
          overtimeHours: operatorsData?.overtimeHours || 0,
          operatorPerformance: operatorsData?.operatorPerformance || [],
          shiftPerformance: operatorsData?.shiftPerformance || []
        }
      }));
      
    } catch (error) {
      console.error('Erro ao carregar dados dos relatórios:', error);
      setErrorMessage('Erro ao carregar dados dos relatórios. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar dados quando os filtros mudarem
  useEffect(() => {
    loadReportsData();
  }, [selectedReport, dateRange, selectedMachine, selectedOperator]);
  
  const reportTypes = [
    {
      id: 'production',
      name: 'Produção',
      icon: ChartBarIcon,
      description: 'Métricas de produção, eficiência e utilização'
    },
    {
      id: 'quality',
      name: 'Qualidade',
      icon: BeakerIcon,
      description: 'Testes de qualidade, defeitos e aprovações'
    },
    {
      id: 'maintenance',
      name: 'Manutenção',
      icon: Cog6ToothIcon,
      description: 'Manutenções preventivas, corretivas e custos'
    },
    {
      id: 'operators',
      name: 'Operadores',
      icon: UserGroupIcon,
      description: 'Performance dos operadores e turnos'
    }
  ];
  
  // Estados para operadores vindos da API
  const [operators, setOperators] = useState([]);



  // Função para buscar operadores
  const fetchOperators = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users?role=OPERATOR&active=true&limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOperators(data.data?.users || []);
      }
    } catch (error) {
      console.error('Erro ao buscar operadores:', error);
    }
  };

  // Carregar operadores na inicialização
  useEffect(() => {
    fetchOperators();
  }, []);
  
  const handleExport = (format) => {
    console.log(`Exportar relatório em ${format}`);
    // Implementar exportação
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const MetricCard = ({ title, value, change, changeType, icon: Icon, color = 'blue', onClick }) => {
    const colorClasses = {
      blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
      green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
      red: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
      yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
    };
    
    return (
      <div 
        className={cn(
          "bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200",
          onClick && "cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {value}
            </p>
            {change && (
              <div className="flex items-center mt-1">
                {changeType === 'increase' ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
                )}
                <span className={cn(
                  'text-sm font-medium',
                  changeType === 'increase' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}>
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', colorClasses[color])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </div>
    );
  };
  
  const ProductionReport = () => {
    const data = reportData.production;
    
    return (
      <div className="space-y-6">
        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Produção Total"
            value={formatNumber(data.totalProduction)}
            change="+5.2%"
            changeType="increase"
            icon={ChartBarIcon}
            color="blue"
            onClick={() => setShowDataAnalysisPopup(true)}
          />
          <MetricCard
            title="Eficiência"
            value={`${Math.round(data.efficiency)}%`}
            change="+2.1%"
            changeType="increase"
            icon={ArrowTrendingUpIcon}
            color="green"
          />
          <MetricCard
            title="Tempo de Parada"
            value={`${data.downtime}h`}
            change="-0.8h"
            changeType="increase"
            icon={ClockIcon}
            color="red"
          />
          <MetricCard
            title="Taxa de Qualidade"
            value={`${data.qualityRate}%`}
            change="+0.3%"
            changeType="increase"
            icon={CheckCircleIcon}
            color="green"
          />
        </div>
        
        {/* Gráfico de Produção Diária */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Produção Diária
          </h3>
          <div className="h-64 flex items-end space-x-2">
            {data.dailyProduction.map((day, index) => {
              const height = Math.round((day.production / Math.max(...data.dailyProduction.map(d => d.production))) * 100);
            const targetHeight = Math.round((day.target / Math.max(...data.dailyProduction.map(d => d.production))) * 100);
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full relative mb-2" style={{ height: '200px' }}>
                    {/* Linha da meta */}
                    <div 
                      className="absolute w-full border-t-2 border-dashed border-gray-400"
                      style={{ bottom: `${targetHeight * 2}px` }}
                    />
                    {/* Barra de produção */}
                    <div 
                      className={cn(
                        'absolute bottom-0 w-full rounded-t transition-all duration-300',
                        day.production >= day.target ? 'bg-green-500' : 'bg-red-500'
                      )}
                      style={{ height: `${height * 2}px` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                      {day.production}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(day.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center mt-4 space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Meta Atingida</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Abaixo da Meta</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-0.5 bg-gray-400 border-dashed" />
              <span className="text-gray-600 dark:text-gray-400">Meta</span>
            </div>
          </div>
        </div>
        
        {/* Performance por Máquina */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance por Máquina
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Máquina
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Produção
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Eficiência
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tempo de Parada
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.machinePerformance.map((machine, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {machine.machine}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatNumber(machine.production)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                          <div 
                            className={cn(
                              'h-2 rounded-full',
                              machine.efficiency >= 95 ? 'bg-green-500' :
                              machine.efficiency >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                            )}
                            style={{ width: `${Math.round(machine.efficiency)}%` }}
                          />
                        </div>
                        <span>{Math.round(machine.efficiency)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {machine.downtime}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        machine.efficiency >= 95 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : machine.efficiency >= 90
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      )}>
                        {machine.efficiency >= 95 ? 'Excelente' :
                         machine.efficiency >= 90 ? 'Bom' : 'Atenção'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  
  const QualityReport = () => {
    const data = reportData.quality;
    
    return (
      <div className="space-y-6">
        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total de Testes"
            value={formatNumber(data.totalTests)}
            change="+12"
            changeType="increase"
            icon={BeakerIcon}
            color="blue"
          />
          <MetricCard
            title="Taxa de Aprovação"
            value={`${data.passRate}%`}
            change="+0.3%"
            changeType="increase"
            icon={CheckCircleIcon}
            color="green"
          />
          <MetricCard
            title="Defeitos Críticos"
            value={data.criticalDefects}
            change="-2"
            changeType="increase"
            icon={ExclamationTriangleIcon}
            color="red"
          />
          <MetricCard
            title="Tempo Médio"
            value={`${data.avgTestTime}min`}
            change="-1.2min"
            changeType="increase"
            icon={ClockIcon}
            color="yellow"
          />
        </div>
        
        {/* Testes por Tipo */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Testes por Tipo
          </h3>
          <div className="space-y-4">
            {data.testsByType.map((type, index) => {
              const passRate = Math.round((type.passed / type.count) * 100);
              
              return (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {type.type}
                      </h4>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {type.count} testes
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${passRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{type.passed} aprovados</span>
                      <span>{type.failed} reprovados</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Defeitos por Categoria */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Defeitos por Categoria
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {data.defectsByCategory.map((defect, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      'w-3 h-3 rounded-full',
                      index === 0 ? 'bg-red-500' :
                      index === 1 ? 'bg-orange-500' :
                      index === 2 ? 'bg-yellow-500' : 'bg-blue-500'
                    )} />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {defect.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {defect.count}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                      ({defect.percentage}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 rounded-full border-8 border-gray-200 dark:border-gray-700" />
                {/* Simulação de gráfico de pizza */}
                <div className="absolute inset-0 rounded-full border-8 border-red-500" 
                     style={{ 
                       clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%)' 
                     }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {data.failedTests}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Total
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  const MaintenanceReport = () => {
    const data = reportData.maintenance;
    
    return (
      <div className="space-y-6">
        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total de Manutenções"
            value={data.totalMaintenance}
            change="+3"
            changeType="increase"
            icon={Cog6ToothIcon}
            color="blue"
          />
          <MetricCard
            title="Preventivas"
            value={data.preventive}
            change="+2"
            changeType="increase"
            icon={CheckCircleIcon}
            color="green"
          />
          <MetricCard
            title="Corretivas"
            value={data.corrective}
            change="+1"
            changeType="decrease"
            icon={ExclamationTriangleIcon}
            color="red"
          />
          <MetricCard
            title="Custo Total"
            value={formatCurrency(data.maintenanceCost)}
            change="-R$ 5.2k"
            changeType="increase"
            icon={DocumentChartBarIcon}
            color="yellow"
            onClick={() => setShowReportsPopup(true)}
          />
        </div>
        
        {/* Planejadas vs Não Planejadas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Manutenções Planejadas vs Não Planejadas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Planejadas</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {data.plannedVsUnplanned.planned}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${data.plannedVsUnplanned.planned}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Não Planejadas</span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {data.plannedVsUnplanned.unplanned}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className="bg-red-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${data.plannedVsUnplanned.unplanned}%` }}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {data.avgDowntime}h
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Tempo médio de parada
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Manutenção por Máquina */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Manutenção por Máquina
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Máquina
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Preventivas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Corretivas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Custo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.maintenanceByMachine.map((machine, index) => {
                  const ratio = machine.preventive / (machine.preventive + machine.corrective);
                  
                  return (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {machine.machine}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {machine.preventive}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {machine.corrective}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(machine.cost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          ratio >= 0.8 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : ratio >= 0.6
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        )}>
                          {ratio >= 0.8 ? 'Excelente' :
                           ratio >= 0.6 ? 'Bom' : 'Atenção'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  
  const OperatorsReport = () => {
    const data = reportData.operators;
    
    return (
      <div className="space-y-6">
        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total de Operadores"
            value={data.totalOperators}
            change="+2"
            changeType="increase"
            icon={UserGroupIcon}
            color="blue"
          />
          <MetricCard
            title="Operadores Ativos"
            value={data.activeOperators}
            change="+1"
            changeType="increase"
            icon={CheckCircleIcon}
            color="green"
          />
          <MetricCard
            title="Produtividade Média"
            value={`${data.avgProductivity}%`}
            change="+1.2%"
            changeType="increase"
            icon={ArrowTrendingUpIcon}
            color="green"
          />
          <MetricCard
            title="Horas Extras"
            value={`${data.overtimeHours}h`}
            change="-12h"
            changeType="increase"
            icon={ClockIcon}
            color="yellow"
          />
        </div>
        
        {/* Performance por Turno */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Performance por Turno
          </h3>
          <div className="space-y-4">
            {data.shiftPerformance.map((shift, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {shift.shift}
                    </h4>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {shift.operators} operadores
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Produtividade: </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {shift.avgProductivity}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Produção: </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatNumber(shift.production)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Top Operadores */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top Operadores
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Operador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Turno
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Produtividade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Horas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Testes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {data.operatorPerformance.map((operator, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {operator.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {operator.shift}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                          <div 
                            className={cn(
                              'h-2 rounded-full',
                              operator.productivity >= 97 ? 'bg-green-500' :
                              operator.productivity >= 94 ? 'bg-yellow-500' : 'bg-red-500'
                            )}
                            style={{ width: `${operator.productivity}%` }}
                          />
                        </div>
                        <span>{operator.productivity}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {operator.hours}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {operator.tests}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  
  const renderReport = () => {
    switch (selectedReport) {
      case 'production':
        return <ProductionReport />;
      case 'quality':
        return <QualityReport />;
      case 'maintenance':
        return <MaintenanceReport />;
      case 'operators':
        return <OperatorsReport />;
      default:
        return <ProductionReport />;
    }
  };
  
  // Mostrar loading se estiver carregando dados
  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando dados dos relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Relatórios - Sistema ZARA</title>
        <meta name="description" content="Relatórios e análises do Sistema ZARA" />
      </Helmet>
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Relatórios
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Análises e métricas de performance do sistema
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-2">

            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              Imprimir
            </button>
            
            <div className="relative">
              <select
                onChange={(e) => handleExport(e.target.value)}
                className="appearance-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 py-2 px-4 pr-8 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Exportar</option>
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
                <option value="csv">CSV</option>
              </select>
              <ArrowDownTrayIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
        
        {/* Mensagem de erro */}
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-red-700 dark:text-red-400">{errorMessage}</p>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  fetchReportsProductionData();
                }}
                className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}
        
        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="TODAY">Hoje</option>
                  <option value="WEEK">Esta Semana</option>
                  <option value="MONTH">Este Mês</option>
                  <option value="QUARTER">Este Trimestre</option>
                  <option value="YEAR">Este Ano</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <CogIcon className="h-4 w-4 text-gray-400" />
                <select
                  value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ALL">Todas as Máquinas</option>
                  {machines.map(machine => (
                    <option key={machine.id} value={machine.id}>
                    {machine.name}
                  </option>
                  ))}
                </select>
              </div>
              
              {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                <div className="flex items-center space-x-2">
                  <UserGroupIcon className="h-4 w-4 text-gray-400" />
                  <select
                    value={selectedOperator}
                    onChange={(e) => setSelectedOperator(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ALL">Todos os Operadores</option>
                    {operators.map(operator => (
                      <option key={operator.id} value={operator.id}>
                        {operator.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
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
        
        {/* Seletor de Relatórios */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            const isSelected = selectedReport === report.id;
            
            return (
              <motion.button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={cn(
                  'p-4 rounded-lg border-2 text-left transition-all duration-200',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'bg-gray-100 dark:bg-gray-700'
                  )}>
                    <Icon className={cn(
                      'h-6 w-6',
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    )} />
                  </div>
                  <div>
                    <h3 className={cn(
                      'font-medium',
                      isSelected
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    )}>
                      {report.name}
                    </h3>
                    <p className={cn(
                      'text-sm',
                      isSelected
                        ? 'text-blue-600 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'
                    )}>
                      {report.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
        
        {/* Conteúdo do Relatório */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedReport}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              renderReport()
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Popups */}
      <DataAnalysisPopup
          isOpen={showDataAnalysisPopup}
          onClose={() => setShowDataAnalysisPopup(false)}
        />
      <ReportsPopup
          isOpen={showReportsPopup}
          onClose={() => setShowReportsPopup(false)}
        />
    </>
  );
};

export default Reports;