import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Package, CheckCircle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const QualityTestAlert = ({ machineId, onTestRequired, className = '' }) => {
  const [testStatus, setTestStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (machineId) {
      checkQualityTestStatus();
    }
  }, [machineId]);

  const checkQualityTestStatus = async () => {
    if (!machineId) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/machines/${machineId}/quality-test-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTestStatus(data);
        
        // Notificar componente pai se há testes pendentes
        if (onTestRequired && data.overallStatus === 'PENDING') {
          onTestRequired(data);
        }
      } else {
        console.error('Erro ao verificar status de testes:', response.statusText);
      }
    } catch (error) {
      console.error('Erro ao verificar status de testes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTest = () => {
    // Redirecionar para criação de teste com dados pré-preenchidos
    const pendingConfig = testStatus?.configs?.find(c => c.status === 'PENDING');
    if (pendingConfig) {
      const params = new URLSearchParams({
        machineId: machineId,
        configId: pendingConfig.configId,
        isRequired: 'true'
      });
      window.location.href = `/quality/new-test?${params.toString()}`;
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} dia(s) atrás`;
    } else if (diffHours > 0) {
      return `${diffHours} hora(s) atrás`;
    } else {
      return 'Menos de 1 hora atrás';
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Verificando testes obrigatórios...</span>
        </div>
      </div>
    );
  }

  if (!testStatus || testStatus.overallStatus === 'OK') {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-green-800">
            Todos os testes de qualidade estão em dia
          </span>
        </div>
      </div>
    );
  }

  const pendingConfigs = testStatus.configs.filter(c => c.status === 'PENDING');

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-800">
              Testes de Qualidade Obrigatórios Pendentes
            </h4>
            <p className="text-sm text-yellow-700 mt-1">
              {pendingConfigs.length} teste(s) obrigatório(s) pendente(s) para {testStatus.machineName}
            </p>
            
            {showDetails && (
              <div className="mt-3 space-y-2">
                {pendingConfigs.map((config, index) => (
                  <div key={config.configId} className="bg-white rounded-md p-3 border border-yellow-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {config.description || `Configuração ${config.configId}`}
                      </span>
                      {config.blockProduction && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Bloqueia Produção
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      {config.pendingTests.map((test, testIndex) => (
                        <div key={testIndex} className="flex items-center space-x-2 text-xs text-gray-600">
                          {test.type === 'FREQUENCY' ? (
                            <Clock className="h-3 w-3" />
                          ) : (
                            <Package className="h-3 w-3" />
                          )}
                          <span>{test.reason}</span>
                        </div>
                      ))}
                    </div>
                    
                    {config.testFrequency > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        Frequência: A cada {config.testFrequency} horas
                      </div>
                    )}
                    
                    {config.productionQuantity > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Quantidade: A cada {config.productionQuantity} produtos
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-yellow-600 hover:text-yellow-800 p-1"
        >
          {showDetails ? <X className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </button>
      </div>
      
      <div className="mt-4 flex space-x-2">
        <button
          onClick={handleCreateTest}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        >
          Realizar Teste Agora
        </button>
        
        <button
          onClick={checkQualityTestStatus}
          className="inline-flex items-center px-3 py-2 border border-yellow-300 text-sm leading-4 font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        >
          Verificar Novamente
        </button>
        
        {!showDetails && (
          <button
            onClick={() => setShowDetails(true)}
            className="inline-flex items-center px-3 py-2 border border-yellow-300 text-sm leading-4 font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
          >
            Ver Detalhes
          </button>
        )}
      </div>
    </div>
  );
};

export default QualityTestAlert;