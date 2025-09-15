import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { 
  ChartBarIcon, 
  DocumentChartBarIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  EyeIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useMachinePermissions } from '../hooks/useMachinePermissions';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const ManagerDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedMachine, setSelectedMachine] = useState('all');
  const [dashboardData, setDashboardData] = useState({
    qualityMetrics: {},
    productionData: {},
    machinePerformance: {},
    teflonChanges: {},
    alerts: []
  });
  const [machines, setMachines] = useState([]);
  const { filterMachinesByPermissions } = useMachinePermissions();

  useEffect(() => {
    fetchDashboardData();
    fetchMachines();
  }, [dateRange, selectedMachine]);

  const fetchMachines = async () => {
    try {
      const response = await api.get('/machines');
      const allMachines = response.data.data || [];
      // Aplicar filtro de permissões
      const filteredMachines = filterMachinesByPermissions(allMachines, 'canView');
      setMachines(filteredMachines);
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
      setMachines([]);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [qualityRes, productionRes, performanceRes, teflonRes, alertsRes] = await Promise.all([
        api.get(`/reports/quality-metrics?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&machineId=${selectedMachine}`),
        api.get(`/reports/production-data?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&machineId=${selectedMachine}`),
        api.get(`/reports/machine-performance?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&machineId=${selectedMachine}`),
        api.get(`/reports/teflon-changes?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&machineId=${selectedMachine}`),
        api.get('/notifications?limit=10')
      ]);

      setDashboardData({
        qualityMetrics: qualityRes.data.data || {},
        productionData: productionRes.data.data || {},
        machinePerformance: performanceRes.data.data || {},
        teflonChanges: teflonRes.data.data || {},
        alerts: alertsRes.data.data || []
      });
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Configurações dos gráficos
  const qualityChartData = {
    labels: dashboardData.qualityMetrics.labels || [],
    datasets: [
      {
        label: 'Testes Aprovados',
        data: dashboardData.qualityMetrics.approved || [],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 2
      },
      {
        label: 'Testes Reprovados',
        data: dashboardData.qualityMetrics.rejected || [],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 2
      }
    ]
  };

  const productionLineData = {
    labels: dashboardData.productionData.labels || [],
    datasets: [
      {
        label: 'Produção Diária',
        data: dashboardData.productionData.daily || [],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const machinePerformancePieData = {
    labels: ['Operando', 'Manutenção', 'Parada', 'Teste'],
    datasets: [
      {
        data: [
          dashboardData.machinePerformance.operating || 0,
          dashboardData.machinePerformance.maintenance || 0,
          dashboardData.machinePerformance.stopped || 0,
          dashboardData.machinePerformance.testing || 0
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(147, 51, 234, 0.8)'
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(147, 51, 234, 1)'
        ],
        borderWidth: 2
      }
    ]
  };

  const teflonChangesData = {
    labels: dashboardData.teflonChanges.labels || [],
    datasets: [
      {
        label: 'Trocas de Teflon',
        data: dashboardData.teflonChanges.changes || [],
        backgroundColor: 'rgba(168, 85, 247, 0.8)',
        borderColor: 'rgba(168, 85, 247, 1)',
        borderWidth: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  const exportToPDF = async () => {
    try {
      const element = document.getElementById('dashboard-content');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgWidth = 297;
      const pageHeight = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio-gestor-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar relatório');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Painel do Gestor
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Relatórios avançados e análises de performance
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
            <button
              onClick={exportToPDF}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Máquina
            </label>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas as Máquinas</option>
              {machines.map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div id="dashboard-content">
        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Taxa de Aprovação</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {dashboardData.qualityMetrics.approvalRate || '0'}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <DocumentChartBarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Produção Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {dashboardData.productionData.total || '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Trocas de Teflon</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {dashboardData.teflonChanges.total || '0'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <FunnelIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Eficiência Média</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(dashboardData.machinePerformance.efficiency) || '0'}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Gráfico de Qualidade */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Análise de Qualidade
            </h3>
            <div className="h-80">
              <Bar data={qualityChartData} options={chartOptions} />
            </div>
          </div>

          {/* Gráfico de Produção */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Tendência de Produção
            </h3>
            <div className="h-80">
              <Line data={productionLineData} options={chartOptions} />
            </div>
          </div>

          {/* Performance das Máquinas */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Status das Máquinas
            </h3>
            <div className="h-80">
              <Pie data={machinePerformancePieData} options={pieOptions} />
            </div>
          </div>

          {/* Trocas de Teflon */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Histórico de Trocas de Teflon
            </h3>
            <div className="h-80">
              <Bar data={teflonChangesData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Alertas Recentes */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Alertas Recentes
          </h3>
          <div className="space-y-3">
            {dashboardData.alerts.length > 0 ? (
              dashboardData.alerts.map((alert, index) => (
                <div key={index} className="flex items-center p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex-shrink-0">
                    <EyeIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      {alert.title}
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {alert.message}
                    </p>
                  </div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">
                    {format(new Date(alert.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Nenhum alerta recente
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;