import React, { useState, useEffect } from 'react';
import { AlertTriangle, Package, Clock, CheckCircle, X, Play, BarChart3, Zap, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import soundService from '../../services/soundService';

const ProductionTestPopup = ({ 
  isOpen, 
  onClose, 
  machineId, 
  machineName, 
  machineLocation,
  productionCount, 
  productsPerTest, 
  configId,
  onStartTest 
}) => {
  const [isStartingTest, setIsStartingTest] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Efeito para reproduzir som quando o popup aparece
  useEffect(() => {
    if (isOpen) {
      // Reproduzir som de alerta baseado na severidade
      const exceedBy = productionCount - productsPerTest;
      if (exceedBy > 0) {
        soundService.playCriticalAlert();
      } else {
        soundService.playQualityAlert();
      }
    }
  }, [isOpen, productionCount, productsPerTest]);

  // Calcular porcentagem de progresso
  const progressPercentage = Math.min((productionCount / productsPerTest) * 100, 100);
  const exceedBy = productionCount - productsPerTest;

  const handleStartTest = async () => {
    setIsStartingTest(true);
    try {
      // Reproduzir som de confirmação
      soundService.playSuccess();
      
      if (onStartTest) {
        await onStartTest({
          machineId,
          configId,
          productionCount,
          productsPerTest
        });
      } else {
        // Redirecionar para página de teste
        const params = new URLSearchParams({
          machineId: machineId,
          configId: configId,
          isRequired: 'true',
          productionCount: productionCount
        });
        window.location.href = `/quality/new-test?${params.toString()}`;
      }
      
      toast.success('Redirecionando para teste de qualidade...');
      onClose();
    } catch (error) {
      console.error('Erro ao iniciar teste:', error);
      toast.error('Erro ao iniciar teste de qualidade');
    } finally {
      setIsStartingTest(false);
    }
  };

  const handlePostpone = () => {
    // Reproduzir som de notificação
    soundService.playNotification();
    
    toast.success('Lembrete adiado por 15 minutos');
    onClose();
    // Aqui poderia implementar lógica para adiar o alerta
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with animation */}
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-fadeIn">
        {/* Modal with enhanced animations */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform animate-slideInUp">
          {/* Header with pulsing effect */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-t-2xl p-6 text-white relative overflow-hidden">
            {/* Animated background pattern */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 animate-shimmer"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white bg-opacity-10 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className="bg-white bg-opacity-25 p-2 rounded-xl backdrop-blur-sm animate-pulse">
                    <AlertTriangle className="h-6 w-6 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold drop-shadow-sm">🚨 Teste de Qualidade Necessário</h3>
                    <p className="text-orange-100 text-sm font-medium">{machineName}</p>
                    {machineLocation && (
                      <p className="text-orange-200 text-xs">Setor: {machineLocation}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:bg-white hover:bg-opacity-25 p-2 rounded-xl transition-all duration-200 hover:scale-110 hover:rotate-90"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Production Status */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-white">Produção Atual</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {productionCount}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    de {productsPerTest} produtos
                  </div>
                </div>
              </div>
              
              {/* Enhanced Progress Bar with animations */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-2 overflow-hidden relative">
                <div 
                  className={`h-4 rounded-full transition-all duration-1000 ease-out relative ${
                    progressPercentage >= 100 
                      ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-700 animate-pulse' 
                      : progressPercentage >= 80 
                      ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-yellow-500'
                      : 'bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600'
                  }`}
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                >
                  {/* Animated shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
                </div>
                
                {/* Pulsing indicator for critical levels */}
                {progressPercentage >= 100 && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>0</span>
                <span className="font-medium">{Math.round(progressPercentage)}%</span>
                <span>{productsPerTest}</span>
              </div>
              
              {exceedBy > 0 && (
                <div className="mt-3 p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 border-2 border-red-300 dark:border-red-600 rounded-xl animate-slideInLeft">
                  <div className="flex items-center space-x-3">
                    <div className="p-1 bg-red-100 dark:bg-red-800 rounded-full">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-red-800 dark:text-red-200 block">
                        ⚠️ Limite Crítico Excedido!
                      </span>
                      <span className="text-xs text-red-700 dark:text-red-300">
                        +{exceedBy} produtos além do limite configurado
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Enhanced Message with icons and animations */}
            <div className="mb-6 p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-xl animate-slideInRight">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-xl">
                  <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-pulse" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                      🎯 Controle de Qualidade Ativo
                    </p>
                  </div>
                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                    A meta de produção foi atingida! Para manter os padrões de excelência, 
                    é necessário realizar um teste de qualidade imediatamente.
                  </p>
                  <div className="mt-3 flex items-center space-x-2 text-xs text-blue-600 dark:text-blue-400">
                    <Zap className="h-3 w-3" />
                    <span className="font-medium">Ação requerida para continuar produção</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Details Toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors mb-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {showDetails ? 'Ocultar detalhes' : 'Ver detalhes'}
                </span>
                <div className={`transform transition-transform ${showDetails ? 'rotate-180' : ''}`}>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </button>

            {showDetails && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Configuração ID:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{configId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Máquina ID:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{machineId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Horário:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date().toLocaleTimeString('pt-BR')}
                  </span>
                </div>
              </div>
            )}

            {/* Enhanced Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handlePostpone}
                className="flex-1 px-5 py-3 text-gray-700 dark:text-gray-300 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 hover:from-gray-200 hover:to-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-500 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center border-2 border-gray-300 dark:border-gray-500 hover:border-gray-400 dark:hover:border-gray-400 transform hover:scale-105 hover:shadow-lg group"
              >
                <Clock className="h-5 w-5 mr-2 group-hover:animate-spin" />
                <span>Adiar por 30min</span>
              </button>
              
              <button
                onClick={handleStartTest}
                disabled={isStartingTest}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-green-500 via-emerald-600 to-teal-600 hover:from-green-600 hover:via-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-bold transition-all duration-300 flex items-center justify-center shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                {/* Button shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 transform -skew-x-12 group-hover:animate-shimmer"></div>
                
                {isStartingTest ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-3 border-white border-t-transparent mr-3" />
                    <span>Iniciando Teste...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-3 group-hover:animate-pulse" />
                    <span>🚀 Iniciar Teste Agora</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductionTestPopup;