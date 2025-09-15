import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ShareIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
  UserGroupIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import Modal from '@/components/ui/Modal';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';

const ReportsPopup = ({ isOpen, onClose }) => {
  const [selectedReport, setSelectedReport] = useState('production');
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [loading, setLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  const { user } = useAuth();
  const { isConnected } = useSocket();

  // Tipos de relatórios disponíveis
  const reportTypes = [
    {
      id: 'production',
      title: 'Relatório de Produção',
      description: 'Dados de produção, eficiência e metas',
      icon: ChartBarIcon,
      color: 'blue',
      estimatedTime: '2-3 min'
    },
    {
      id: 'quality',
      title: 'Relatório de Qualidade',
      description: 'Testes realizados, aprovações e rejeições',
      icon: CheckCircleIcon,
      color: 'green',
      estimatedTime: '1-2 min'
    },
    {
      id: 'maintenance',
      title: 'Relatório de Manutenção',
      description: 'Histórico de manutenções e paradas',
      icon: CogIcon,
      color: 'orange',
      estimatedTime: '3-4 min'
    },
    {
      id: 'operators',
      title: 'Relatório de Operadores',
      description: 'Performance e atividades da equipe',
      icon: UserGroupIcon,
      color: 'purple',
      estimatedTime: '2-3 min',
      requiresPermission: true
    }
  ];

  // Períodos disponíveis
  const periods = [
    { id: 'today', label: 'Hoje', description: 'Turno atual' },
    { id: 'yesterday', label: 'Ontem', description: 'Último turno completo' },
    { id: 'week', label: 'Esta Semana', description: 'Últimos 7 dias' },
    { id: 'month', label: 'Este Mês', description: 'Mês atual' },
    { id: 'custom', label: 'Período Personalizado', description: 'Selecionar datas' }
  ];

  // Dados simulados do relatório
  const [reportData, setReportData] = useState({
    production: {
      totalProduced: 2847,
      target: 3000,
      efficiency: 94.9,
      downtime: 45,
      shifts: 3,
      avgCycleTime: 45.2
    },
    quality: {
      testsPerformed: 156,
      approved: 153,
      rejected: 3,
      approvalRate: 98.1,
      defectTypes: ['Dimensional', 'Visual', 'Funcional']
    },
    maintenance: {
      scheduledMaintenance: 2,
      unscheduledMaintenance: 1,
      totalDowntime: 120,
      partsReplaced: 5,
      cost: 2450
    },
    operators: {
      activeOperators: 8,
      totalHours: 64,
      avgEfficiency: 96.2,
      trainingHours: 4
    }
  });

  // Filtrar relatórios baseado nas permissões
  const availableReports = reportTypes.filter(report => {
    if (report.requiresPermission) {
      return user?.role === 'ADMIN' || user?.role === 'MANAGER';
    }
    return true;
  });

  // Gerar relatório
  const handleGenerateReport = async (format = 'pdf') => {
    setGeneratingReport(true);
    
    try {
      // Simular geração do relatório
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Aqui seria feita a chamada real para a API
      console.log(`Gerando relatório ${selectedReport} em formato ${format} para o período ${selectedPeriod}`);
      
      // Simular download
      const reportName = `relatorio_${selectedReport}_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.${format}`;
      
      // Criar um link de download simulado
      const link = document.createElement('a');
      link.href = '#';
      link.download = reportName;
      link.click();
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const ReportCard = ({ report, isSelected, onClick }) => {
    const Icon = report.icon;
    const colorClasses = {
      blue: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
      green: 'border-green-500 bg-green-50 dark:bg-green-900/20',
      orange: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
      purple: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
    };

    return (
      <motion.button
        onClick={onClick}
        className={cn(
          'p-4 rounded-lg border-2 text-left transition-all duration-200 w-full',
          isSelected
            ? colorClasses[report.color]
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-start space-x-3">
          <div className={cn(
            'p-2 rounded-lg',
            isSelected
              ? `bg-${report.color}-100 dark:bg-${report.color}-900/40`
              : 'bg-gray-100 dark:bg-gray-700'
          )}>
            <Icon className={cn(
              'h-5 w-5',
              isSelected
                ? `text-${report.color}-600 dark:text-${report.color}-400`
                : 'text-gray-600 dark:text-gray-400'
            )} />
          </div>
          <div className="flex-1">
            <h3 className={cn(
              'font-medium mb-1',
              isSelected
                ? `text-${report.color}-900 dark:text-${report.color}-100`
                : 'text-gray-900 dark:text-white'
            )}>
              {report.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {report.description}
            </p>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
              <ClockIcon className="h-3 w-3" />
              <span>{report.estimatedTime}</span>
            </div>
          </div>
        </div>
      </motion.button>
    );
  };

  const ReportPreview = () => {
    const currentReport = availableReports.find(r => r.id === selectedReport);
    const data = reportData[selectedReport];
    
    if (!currentReport || !data) return null;

    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
        <div className="flex items-center space-x-2 mb-4">
          <EyeIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Prévia do Relatório
          </span>
        </div>
        
        <div className="space-y-3">
          {selectedReport === 'production' && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Produzido:</span>
                <span className="font-medium">{formatNumber(data.totalProduced)} unidades</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Eficiência:</span>
                <span className="font-medium">{Math.round(data.efficiency)}%</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tempo de Parada:</span>
                <span className="font-medium">{data.downtime} min</span>
              </div>
            </>
          )}
          
          {selectedReport === 'quality' && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Testes Realizados:</span>
                <span className="font-medium">{data.testsPerformed}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Taxa de Aprovação:</span>
                <span className="font-medium text-green-600">{data.approvalRate}%</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Rejeitados:</span>
                <span className="font-medium text-red-600">{data.rejected}</span>
              </div>
            </>
          )}
          
          {selectedReport === 'maintenance' && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Manutenções Programadas:</span>
                <span className="font-medium">{data.scheduledMaintenance}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Custo Total:</span>
                <span className="font-medium">R$ {formatNumber(data.cost)}</span>
              </div>
            </>
          )}
          
          {selectedReport === 'operators' && (
            <>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Operadores Ativos:</span>
                <span className="font-medium">{data.activeOperators}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Eficiência Média:</span>
                <span className="font-medium">{Math.round(data.avgEfficiency)}%</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gerador de Relatórios"
      size="lg"
    >
      <div className="space-y-6">
        {/* Seleção de Relatório */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Selecione o Tipo de Relatório
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isSelected={selectedReport === report.id}
                onClick={() => setSelectedReport(report.id)}
              />
            ))}
          </div>
        </div>

        {/* Seleção de Período */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Período do Relatório
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {periods.map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedPeriod(period.id)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-colors',
                  selectedPeriod === period.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <div className="font-medium text-gray-900 dark:text-white">
                  {period.label}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {period.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Prévia do Relatório */}
        <ReportPreview />

        {/* Ações */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <div className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )} />
            <span>{isConnected ? 'Dados atualizados' : 'Dados em cache'}</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleGenerateReport('excel')}
              disabled={generatingReport}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2 inline" />
              Excel
            </button>
            
            <button
              onClick={() => handleGenerateReport('pdf')}
              disabled={generatingReport}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
            >
              {generatingReport ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Gerando...
                </>
              ) : (
                <>
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Gerar PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ReportsPopup;