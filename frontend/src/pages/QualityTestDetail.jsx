import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  BeakerIcon,
  DocumentTextIcon,
  PhotoIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ShareIcon,
  PencilIcon,
  TrashIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  ExclamationCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';

// Utilitários
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import { ROUTES } from '@/config/routes';

const QualityTestDetail = () => {
  const { id: testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
  const { user } = useAuth();
  const { isConnected } = useSocket();
  
  useEffect(() => {
    // Carregar dados reais do teste da API
    const loadTestData = async () => {
      try {
        setLoading(true);
        
        const response = await fetch(`/api/quality-tests/${testId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Erro ao carregar dados do teste');
        }
        
        const data = await response.json();
        
        if (data.success) {
           setTest(data.data);
         } else {
            throw new Error(data.message || 'Erro ao carregar dados do teste');
          }
      } catch (err) {
        setError('Erro ao carregar dados do teste');
        console.error('Erro ao carregar teste:', err);
      } finally {
        setLoading(false);
      }
    };
    
    if (testId) {
      loadTestData();
    }
  }, [testId]);
  
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
        return 'Turno 1 (06:00-14:00)';
      case 'TURNO_2':
        return 'Turno 2 (14:00-22:00)';
      case 'TURNO_3':
        return 'Turno 3 (22:00-06:00)';
      default:
        return shift;
    }
  };
  
  const getDefectSeverityConfig = (severity) => {
    switch (severity) {
      case 'HIGH':
        return {
          label: 'Alta',
          color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        };
      case 'MEDIUM':
        return {
          label: 'Média',
          color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
        };
      case 'LOW':
        return {
          label: 'Baixa',
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
        };
      default:
        return {
          label: severity,
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
        };
    }
  };
  
  const handleImageClick = (image) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };
  
  const handlePrint = () => {
    window.print();
  };
  
  const handleExport = () => {
    // Implementar exportação para PDF
    console.log('Exportar relatório');
  };
  
  const handleEdit = () => {
    navigate(`/quality/${testId}/edit`);
  };
  
  const handleDelete = () => {
    if (window.confirm('Tem certeza que deseja excluir este teste?')) {
      // Implementar exclusão
      console.log('Excluir teste');
      navigate('/quality');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error || !test) {
    return (
      <div className="text-center py-12">
        <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {error || 'Teste não encontrado'}
        </h3>
        <div className="mt-6">
          <Link
            to="/quality"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar aos Testes
          </Link>
        </div>
      </div>
    );
  }
  
  const resultConfig = getResultConfig(test.overallResult);
  const ResultIcon = resultConfig.icon;
  
  // Criar testResults baseado nos dados reais do teste
  const testResults = {
    visualInspection: test.visualInspection !== null ? (test.visualInspection ? 'PASS' : 'FAIL') : null,
    dimensionalCheck: test.dimensionalCheck !== null ? (test.dimensionalCheck ? 'PASS' : 'FAIL') : null,
    colorConsistency: test.colorConsistency !== null ? (test.colorConsistency ? 'PASS' : 'FAIL') : null,
    surfaceQuality: test.surfaceQuality !== null ? (test.surfaceQuality ? 'PASS' : 'FAIL') : null,
    adhesionTest: test.adhesionTest !== null ? (test.adhesionTest ? 'PASS' : 'FAIL') : null
  };
  
  const passedTests = Object.values(testResults).filter(result => result === 'PASS').length;
  const totalTests = Object.values(testResults).filter(result => result !== null).length;
  
  return (
    <>
      <Helmet>
        <title>{test?.id ? `Teste ${test.id} - Sistema ZARA` : 'Teste de Qualidade - Sistema ZARA'}</title>
        <meta name="description" content={`Detalhes do teste de qualidade ${test?.id || ''}`} />
      </Helmet>
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/quality')}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Teste {test.id}
                </h1>
                <span className={cn(
                  'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                  resultConfig.color
                )}>
                  <ResultIcon className={cn('h-4 w-4 mr-1', resultConfig.iconColor)} />
                  {resultConfig.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {test.machine?.name || 'N/A'} • {getTestTypeLabel(test.testType) || 'Teste de Qualidade'} • {formatDateTime(test.testDate || test.createdAt)}
              </p>
            </div>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <PrinterIcon className="h-4 w-4 mr-2" />
              Imprimir
            </button>
            
            <button
              onClick={handleExport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Exportar
            </button>
            
            {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || 
              (user?.role === 'LEADER' && test.createdBy.id === user.id)) && (
              <>
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Editar
                </button>
                
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-3 py-2 border border-red-300 dark:border-red-600 text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Excluir
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informações Básicas */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Informações Básicas
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CogIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Máquina</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {test.machine?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                     {test.machine?.location || 'Local não informado'}
                   </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                   <div className="flex items-center space-x-2 mb-2">
                     <UserIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                     <p className="text-sm font-medium text-gray-900 dark:text-white">Operador</p>
                   </div>
                   <p className="text-lg font-semibold text-gray-900 dark:text-white">
                     {test.user?.name || 'N/A'}
                   </p>
                 </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <BeakerIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Produto</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {test.product || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Lote: {test.lot || 'N/A'}
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <ClockIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Data do Teste</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDateTime(test.testDate || test.createdAt)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {getShiftLabel(test.shift) || 'Turno não informado'}
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <DocumentTextIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Detalhes</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    Caixa #{test.boxNumber || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tamanho: {test.packageSize || 'N/A'}
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Status</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium',
                      test.approved ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    )}>
                      {test.approved ? 'Aprovado' : 'Reprovado'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {getTestTypeLabel(test.testType) || 'Teste de Qualidade'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Resultados dos Testes */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Resultados dos Testes
              </h2>
              
              <div className="space-y-4">
                {Object.entries(testResults).map(([testName, result]) => {
                  if (result === null) return null;
                  
                  const testConfig = getResultConfig(result);
                  const TestIcon = testConfig.icon;
                  
                  const testLabels = {
                    visualInspection: 'Inspeção Visual',
                    dimensionalCheck: 'Verificação Dimensional',
                    colorConsistency: 'Consistência de Cor',
                    surfaceQuality: 'Qualidade da Superfície',
                    adhesionTest: 'Teste de Aderência'
                  };
                  
                  return (
                    <div key={testName} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <TestIcon className={cn('h-5 w-5', testConfig.iconColor)} />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {testLabels[testName] || testName}
                        </span>
                      </div>
                      <span className={cn(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        testConfig.color
                      )}>
                        {testConfig.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Progresso Geral */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span>Progresso Geral</span>
                  <span>{passedTests}/{totalTests} testes aprovados</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div 
                    className={cn(
                      'h-3 rounded-full transition-all duration-300',
                      passedTests === totalTests ? 'bg-green-500' :
                      passedTests >= totalTests * 0.8 ? 'bg-yellow-500' :
                      'bg-red-500'
                    )}
                    style={{ width: `${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Medições */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-6">
                <ChartBarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Medições e Especificações
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  const measurements = {};
                  
                  if (test.packageWidth) {
                    measurements.packageWidth = {
                      value: test.packageWidth,
                      unit: 'mm',
                      spec: 'Conforme especificação',
                      status: test.approved ? 'PASS' : 'FAIL'
                    };
                  }
                  
                  if (test.bottomSize) {
                    measurements.bottomSize = {
                      value: test.bottomSize,
                      unit: 'mm',
                      spec: 'Conforme especificação',
                      status: test.approved ? 'PASS' : 'FAIL'
                    };
                  }
                  
                  if (test.sideSize) {
                    measurements.sideSize = {
                      value: test.sideSize,
                      unit: 'mm',
                      spec: 'Conforme especificação',
                      status: test.approved ? 'PASS' : 'FAIL'
                    };
                  }
                  
                  if (test.zipperDistance) {
                    measurements.zipperDistance = {
                      value: test.zipperDistance,
                      unit: 'mm',
                      spec: 'Conforme especificação',
                      status: test.approved ? 'PASS' : 'FAIL'
                    };
                  }
                  
                  if (test.facilitatorDistance) {
                    measurements.facilitatorDistance = {
                      value: test.facilitatorDistance,
                      unit: 'mm',
                      spec: 'Conforme especificação',
                      status: test.approved ? 'PASS' : 'FAIL'
                    };
                  }
                  
                  const measurementLabels = {
                    packageWidth: 'Largura da Embalagem',
                    bottomSize: 'Tamanho do Fundo',
                    sideSize: 'Tamanho da Lateral',
                    zipperDistance: 'Distância do Zíper',
                    facilitatorDistance: 'Distância do Facilitador'
                  };
                  
                  return Object.entries(measurements).map(([measurement, data]) => {
                    const statusConfig = getResultConfig(data.status);
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <div key={measurement} className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {measurementLabels[measurement] || measurement}
                          </h3>
                          <StatusIcon className={cn('h-5 w-5', statusConfig.iconColor)} />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-baseline space-x-1">
                            <span className={cn(
                              'text-2xl font-bold',
                              data.status === 'PASS' ? 'text-green-600 dark:text-green-400' :
                              'text-red-600 dark:text-red-400'
                            )}>
                              {data.value}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {data.unit}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {data.spec}
                            </p>
                            <span className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                              statusConfig.color
                            )}>
                              {statusConfig.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
                
                {!test.packageWidth && !test.bottomSize && !test.sideSize && !test.zipperDistance && !test.facilitatorDistance && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <DocumentTextIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">Nenhuma medição registrada</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Defeitos */}
            {test.defects && test.defects.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-6">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Defeitos Identificados
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {test.defects.length} {test.defects.length === 1 ? 'defeito' : 'defeitos'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {test.defects.map((defect) => {
                    const severityConfig = getDefectSeverityConfig(defect.severity);
                    
                    return (
                      <div key={defect.id} className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-900/10 dark:to-red-800/5 border border-red-200 dark:border-red-800 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 bg-red-100 dark:bg-red-900/20 rounded-full">
                              <ExclamationTriangleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </div>
                            <span className={cn(
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                              severityConfig.color
                            )}>
                              {severityConfig.label}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-red-900 dark:text-red-100">
                            {defect.description}
                          </h3>
                          
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                              <span className="text-xs text-red-700 dark:text-red-300">
                                <strong>Local:</strong> {defect.location}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                              <span className="text-xs text-red-700 dark:text-red-300">
                                <strong>Medição:</strong> {defect.measurement}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Observações */}
            {test.observations && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <ClipboardDocumentListIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Observações do Teste
                  </h2>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-900 dark:text-blue-100 leading-relaxed">
                      {test.observations}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Imagens Anexadas */}
            {test.images && (() => {
              try {
                const images = JSON.parse(test.images);
                if (images && images.length > 0) {
                  return (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-2">
                          <PhotoIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Imagens Anexadas
                          </h2>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                            {images.length} {images.length === 1 ? 'imagem' : 'imagens'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((imageName, index) => (
                          <div 
                            key={index} 
                            className="group relative bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/10 dark:to-purple-800/5 border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden aspect-square cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
                            onClick={() => handleImageClick({ name: imageName, timestamp: test.testDate || test.createdAt })}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                                <PhotoIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                              </div>
                            </div>
                            
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white p-3">
                              <p className="text-xs font-medium truncate" title={imageName}>
                                {imageName}
                              </p>
                              <p className="text-xs text-gray-300 mt-1">
                                Imagem #{index + 1}
                              </p>
                            </div>
                            
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full p-2 shadow-lg">
                                <EyeIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                            </div>
                            
                            <div className="absolute inset-0 bg-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {images.length} imagem{images.length !== 1 ? 's' : ''} anexada{images.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  );
                }
              } catch (e) {
                console.error('Erro ao parsear imagens:', e);
              }
              return null;
            })()}
            
            {/* Ações Corretivas */}
            {test.corrective_actions && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Ações Corretivas
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {test.corrective_actions}
                </p>
              </div>
            )}
            
            {/* Próximas Ações */}
            {test.nextActions && test.nextActions.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Próximas Ações
                </h2>
                <ul className="space-y-2">
                  {test.nextActions.map((action, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <div className="h-1.5 w-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {action}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status e Aprovações */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Status e Aprovações
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Criado por
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {test.createdBy?.name || 'N/A'}
                    </p>
                  </div>
                </div>
                
                {test.reviewedBy && (
                  <div className="flex items-center space-x-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Revisado por
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {test.reviewedBy?.name || 'N/A'} • {formatDateTime(test.reviewedBy?.timestamp)}
                      </p>
                    </div>
                  </div>
                )}
                
                {test.approvedBy ? (
                  <div className="flex items-center space-x-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Aprovado por
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {test.approvedBy?.name || 'N/A'} • {formatDateTime(test.approvedBy?.timestamp)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <ClockIcon className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Aguardando aprovação
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Pendente
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Mídia */}
            {test.media && test.media.length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Fotos e Documentos
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {test.media.map((item) => (
                    <div key={item.id} className="relative group">
                      <div 
                        className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity"
                        onClick={() => handleImageClick(item)}
                      >
                        <div className="flex items-center justify-center h-full">
                          <PhotoIcon className="h-8 w-8 text-gray-400" />
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <EyeIcon className="h-6 w-6 text-white" />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                        {item?.name || 'Sem nome'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Ações Rápidas */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Ações Rápidas
              </h3>
              
              <div className="space-y-2">
                <Link
                  to={`/machines/${test.machineId}`}
                  className="w-full inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <CogIcon className="h-4 w-4 mr-2" />
                  Ver Máquina
                </Link>
                
                <Link
                  to={`/quality?machine=${test.machineId}`}
                  className="w-full inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <BeakerIcon className="h-4 w-4 mr-2" />
                  Outros Testes
                </Link>
                
                <Link
                  to={`/reports/quality?batch=${test.productBatch}`}
                  className="w-full inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  Relatório do Lote
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de Imagem */}
      <AnimatePresence>
        {showImageModal && selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setShowImageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-4xl max-h-full overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedImage?.name || 'Imagem'}
                </h3>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
              
              <div className="mb-4">
                <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <PhotoIcon className="h-16 w-16 text-gray-400" />
                  <p className="ml-4 text-gray-500 dark:text-gray-400">
                    Imagem: {selectedImage?.name || 'Sem nome'}
                  </p>
                </div>
              </div>
              
              {selectedImage.description && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedImage.description}
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDateTime(selectedImage.timestamp)}</span>
                <button className="text-blue-600 dark:text-blue-400 hover:underline">
                  Download
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QualityTestDetail;