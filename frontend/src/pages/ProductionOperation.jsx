import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/alert';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Play, Pause, Square, AlertTriangle, CheckCircle } from 'lucide-react';

const ProductionOperation = () => {
  const { id: machineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [machine, setMachine] = useState(null);
  const [operation, setOperation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [operationStatus, setOperationStatus] = useState('idle');
  const [currentOperator, setCurrentOperator] = useState(null);
  const [productionData, setProductionData] = useState({
    piecesProduced: 0,
    targetPieces: 0,
    efficiency: 0,
    startTime: null,
    elapsedTime: 0
  });

  useEffect(() => {
    if (!machineId) {
      navigate('/machines');
      return;
    }
    
    fetchMachineAndOperation();
  }, [machineId]);

  useEffect(() => {
    if (socket) {
      socket.on('operation-updated', handleOperationUpdate);
      socket.on('production-data-updated', handleProductionDataUpdate);
      
      return () => {
        socket.off('operation-updated', handleOperationUpdate);
        socket.off('production-data-updated', handleProductionDataUpdate);
      };
    }
  }, [socket]);

  const fetchMachineAndOperation = async () => {
    try {
      setLoading(true);
      
      // Buscar dados da máquina
      const machineResponse = await fetch(`/api/machines/${machineId}`);
      if (!machineResponse.ok) {
        throw new Error('Máquina não encontrada');
      }
      const machineData = await machineResponse.json();
      setMachine(machineData);
      
      // Buscar operação ativa para esta máquina
      const operationResponse = await fetch(`/api/operations/active/${machineId}`);
      if (operationResponse.ok) {
        const operationData = await operationResponse.json();
        setOperation(operationData);
        setOperationStatus(operationData.status);
        setCurrentOperator(operationData.operator);
        
        // Verificar se o operador atual tem permissão para esta operação
        if (operationData.operator.id !== user.id && user.role !== 'MANAGER') {
          setError('Você não tem permissão para acessar esta operação. Apenas o operador responsável ou um gerente podem acessar.');
          return;
        }
        
        // Buscar dados de produção
        fetchProductionData(operationData.id);
      } else {
        // Não há operação ativa para esta máquina
        setError('Não há operação ativa para esta máquina.');
      }
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados da operação');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductionData = async (operationId) => {
    try {
      const response = await fetch(`/api/operations/${operationId}/production-data`);
      if (response.ok) {
        const data = await response.json();
        setProductionData(data);
      }
    } catch (err) {
      console.error('Erro ao buscar dados de produção:', err);
    }
  };

  const handleOperationUpdate = (data) => {
    if (data.machineId === parseInt(machineId)) {
      setOperation(data.operation);
      setOperationStatus(data.operation?.status || 'idle');
      setCurrentOperator(data.operation?.operator);
    }
  };

  const handleProductionDataUpdate = (data) => {
    if (data.machineId === parseInt(machineId)) {
      setProductionData(data.productionData);
    }
  };

  const handleOperationControl = async (action) => {
    try {
      const response = await fetch(`/api/operations/${operation.id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao ${action} operação`);
      }
      
      const updatedOperation = await response.json();
      setOperation(updatedOperation);
      setOperationStatus(updatedOperation.status);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'running': { variant: 'success', icon: CheckCircle, text: 'Em Execução' },
      'paused': { variant: 'warning', icon: Pause, text: 'Pausada' },
      'stopped': { variant: 'destructive', icon: Square, text: 'Parada' },
      'idle': { variant: 'secondary', icon: AlertTriangle, text: 'Inativa' }
    };
    
    const config = statusConfig[status] || statusConfig.idle;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <ErrorMessage 
          message={error}
          onRetry={() => {
            setError(null);
            fetchMachineAndOperation();
          }}
        />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <div>
            <h3 className="font-semibold">Nenhuma operação ativa</h3>
            <p>Não há operação ativa para a máquina {machine?.name}.</p>
            <Button 
              className="mt-2" 
              onClick={() => navigate('/machines')}
            >
              Voltar para Máquinas
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Operação - {machine?.name}
          </h1>
          <p className="text-gray-600">
            Operador: {currentOperator?.name} | Produto: {operation?.product?.name}
          </p>
        </div>
        {getStatusBadge(operationStatus)}
      </div>

      {/* Controles de Operação */}
      <Card>
        <CardHeader>
          <CardTitle>Controles de Operação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {operationStatus === 'idle' || operationStatus === 'paused' ? (
              <Button 
                onClick={() => handleOperationControl('start')}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Iniciar
              </Button>
            ) : null}
            
            {operationStatus === 'running' ? (
              <Button 
                variant="outline"
                onClick={() => handleOperationControl('pause')}
                className="flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Pausar
              </Button>
            ) : null}
            
            {operationStatus !== 'idle' ? (
              <Button 
                variant="destructive"
                onClick={() => handleOperationControl('stop')}
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Parar
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Dados de Produção */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Peças Produzidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {productionData.piecesProduced}
            </div>
            <p className="text-xs text-gray-500">
              Meta: {productionData.targetPieces}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Eficiência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {productionData.efficiency}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tempo Decorrido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatTime(productionData.elapsedTime)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Início da Operação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {productionData.startTime ? 
                new Date(productionData.startTime).toLocaleString('pt-BR') : 
                'Não iniciada'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informações da Operação */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes da Operação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-700">Máquina</h4>
              <p>{machine?.name} - {machine?.model}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700">Produto</h4>
              <p>{operation?.product?.name}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700">Operador Responsável</h4>
              <p>{currentOperator?.name}</p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700">Turno</h4>
              <p>{operation?.shift || 'Não definido'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductionOperation;