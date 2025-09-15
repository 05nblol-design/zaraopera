import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  StopIcon,
  PlayIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useMachineStatus } from '@/hooks/useMachineStatus';
import { useSocket } from '@/hooks/useSocket';
import useMachinePermissions from '@/hooks/useMachinePermissions';

// Componentes
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Serviços
import { machineService } from '@/services/api';

// Utilitários
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MachineOperation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { machines, loading, error } = useMachineStatus();
  const { socket } = useSocket();
  const { hasPermissionForMachine } = useMachinePermissions();
  const [stoppingMachines, setStoppingMachines] = useState(new Set());
  const [showStopNotes, setShowStopNotes] = useState({});
  const [stopNotes, setStopNotes] = useState({});

  // Filtrar máquinas com operação ativa do usuário atual
  const activeMachines = machines.filter(machine => 
    machine.currentOperation && 
    (machine.currentOperation.status === 'ACTIVE' || machine.currentOperation.status === 'FUNCIONANDO') &&
    machine.currentOperation.userId === user?.id
  );

  // Se não há operações ativas, redirecionar para página de máquinas
  useEffect(() => {
    if (!loading && activeMachines.length === 0) {
      navigate('/machines');
    }
  }, [loading, activeMachines.length, navigate]);

  const handleStopOperation = async (machineId) => {
    try {
      setStoppingMachines(prev => new Set([...prev, machineId]));
      
      const notes = stopNotes[machineId] || '';
      
      await machineService.endOperation(machineId, { notes });
      
      // Emitir evento via WebSocket
      if (socket) {
        socket.emit('operation:end', {
          machineId,
          notes,
          userId: user.id
        });
      }
      
      // Limpar notas e fechar modal
      setStopNotes(prev => ({ ...prev, [machineId]: '' }));
      setShowStopNotes(prev => ({ ...prev, [machineId]: false }));
      
    } catch (error) {
      console.error('Erro ao parar operação:', error);
      alert('Erro ao parar operação: ' + (error.response?.data?.message || error.message));
    } finally {
      setStoppingMachines(prev => {
        const newSet = new Set(prev);
        newSet.delete(machineId);
        return newSet;
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'FUNCIONANDO':
      case 'RUNNING':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PARADA':
      case 'STOPPED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MANUTENCAO':
      case 'MAINTENANCE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'FORA_DE_TURNO':
      case 'OFF_SHIFT':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOperationDuration = (startTime) => {
    if (!startTime) return 'N/A';
    try {
      return formatDistanceToNow(new Date(startTime), {
        addSuffix: true,
        locale: ptBR
      });
    } catch {
      return 'N/A';
    }
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
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (activeMachines.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            Nenhuma operação ativa encontrada. Redirecionando...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Operações Ativas
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Gerencie suas operações de máquinas em andamento
        </p>
      </div>

      {/* Grid de Máquinas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeMachines.map((machine) => {
          const isStoppingMachine = stoppingMachines.has(machine.id);
          const showNotes = showStopNotes[machine.id];
          
          return (
            <motion.div
              key={machine.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {machine.name}
                    </CardTitle>
                    <Badge className={cn('text-xs', getStatusColor(machine.status))}>
                      {machine.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {machine.location}
                  </p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Informações da Operação */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <ClockIcon className="h-4 w-4 mr-2" />
                      <span>
                        Iniciada {getOperationDuration(machine.currentOperation?.startTime)}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <UserIcon className="h-4 w-4 mr-2" />
                      <span>Operador: {user?.name}</span>
                    </div>
                    
                    {machine.currentProduction && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <CogIcon className="h-4 w-4 mr-2" />
                        <span>Produção: {machine.currentProduction} unidades</span>
                      </div>
                    )}
                  </div>

                  {/* Notas de Parada */}
                  {showNotes && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Observações (opcional):
                      </label>
                      <textarea
                        value={stopNotes[machine.id] || ''}
                        onChange={(e) => setStopNotes(prev => ({
                          ...prev,
                          [machine.id]: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        rows={3}
                        placeholder="Digite observações sobre a parada da operação..."
                      />
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="flex gap-2">
                    {!showNotes ? (
                      <Button
                        onClick={() => setShowStopNotes(prev => ({
                          ...prev,
                          [machine.id]: true
                        }))}
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        disabled={isStoppingMachine}
                      >
                        <StopIcon className="h-4 w-4 mr-2" />
                        Parar Operação
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleStopOperation(machine.id)}
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          disabled={isStoppingMachine}
                        >
                          {isStoppingMachine ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                          ) : (
                            <StopIcon className="h-4 w-4 mr-2" />
                          )}
                          Confirmar Parada
                        </Button>
                        
                        <Button
                          onClick={() => {
                            setShowStopNotes(prev => ({
                              ...prev,
                              [machine.id]: false
                            }));
                            setStopNotes(prev => ({ ...prev, [machine.id]: '' }));
                          }}
                          variant="outline"
                          size="sm"
                          disabled={isStoppingMachine}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Botão para voltar */}
      <div className="mt-8 flex justify-center">
        <Button
          onClick={() => navigate('/machines')}
          variant="outline"
          className="px-6"
        >
          Voltar para Máquinas
        </Button>
      </div>
    </div>
  );
};

export default MachineOperation;