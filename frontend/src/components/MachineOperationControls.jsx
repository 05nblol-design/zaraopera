import React, { useState, useEffect } from 'react';
import { PlayIcon, StopIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMachinePermissions } from '../hooks/useMachinePermissions';
import useMachineStatus from '../hooks/useMachineStatus';
import { cn } from '../lib/utils';

const MachineOperationControls = ({ machine, onOperationChange }) => {
  const { user } = useAuth();
  const { hasPermissionForMachine } = useMachinePermissions();
  const { machines } = useMachineStatus();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [showStartNotes, setShowStartNotes] = useState(false);
  const [showStopNotes, setShowStopNotes] = useState(false);

  // Buscar dados atualizados da máquina do hook useMachineStatus
  const currentMachine = machines.find(m => m.id === machine.id) || machine;

  // Verificar se o usuário pode operar esta máquina
  const canOperate = hasPermissionForMachine(currentMachine.id, 'canOperate');
  
  // Verificar se a máquina tem operação ativa
  const hasActiveOperation = currentMachine.currentOperation && 
    (currentMachine.currentOperation.status === 'ACTIVE' || currentMachine.currentOperation.status === 'FUNCIONANDO');
  
  // Verificar se o usuário atual é o operador da máquina
  const isCurrentOperator = hasActiveOperation && currentMachine.currentOperation.userId === user?.id;
  
  // Verificar se pode iniciar operação (máquina parada e usuário tem permissão)
  const canStartOperation = canOperate && !hasActiveOperation && ['STOPPED', 'PARADA', 'FORA_DE_TURNO'].includes(currentMachine.status);
  
  // Verificar se pode parar operação (usuário é o operador atual ou é admin/manager)
  const canStopOperation = hasActiveOperation && (isCurrentOperator || ['ADMIN', 'MANAGER'].includes(user?.role));

  const handleStartOperation = async () => {
    if (!canStartOperation) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/machines/${currentMachine.id}/start-operation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: notes.trim() || undefined })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erro ao iniciar operação');
      }

      // Notificar o componente pai sobre a mudança
      if (onOperationChange) {
        onOperationChange({
          ...machine,
          status: 'FUNCIONANDO',
          currentOperation: data.data,
          operator: user.name
        });
      }

      setNotes('');
      setShowStartNotes(false);
      
      // Mostrar mensagem de sucesso (você pode implementar um toast aqui)
      console.log('Operação iniciada com sucesso');
      
      // Redirecionar para a página de produção/operação
      navigate(`/machines/${currentMachine.id}/operation`);
      
    } catch (error) {
      console.error('Erro ao iniciar operação:', error);
      alert(error.message || 'Erro ao iniciar operação');
    } finally {
      setLoading(false);
    }
  };

  const handleStopOperation = async () => {
    if (!canStopOperation) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/machines/${currentMachine.id}/end-operation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notes: notes.trim() || undefined })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erro ao finalizar operação');
      }

      // Notificar o componente pai sobre a mudança
      if (onOperationChange) {
        onOperationChange({
          ...machine,
          status: 'STOPPED',
          currentOperation: null,
          operator: 'Não atribuído'
        });
      }

      setNotes('');
      setShowStopNotes(false);
      
      // Mostrar mensagem de sucesso
      console.log('Operação finalizada com sucesso');
      
    } catch (error) {
      console.error('Erro ao finalizar operação:', error);
      alert(error.message || 'Erro ao finalizar operação');
    } finally {
      setLoading(false);
    }
  };

  // Se o usuário não tem permissão para operar, não mostrar controles
  if (!canOperate) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Controle de Operação
      </h3>
      
      <div className="space-y-4">
        {/* Status atual */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Status atual:
          </span>
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-medium',
            hasActiveOperation 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
          )}>
            {hasActiveOperation ? 'Em Operação' : 'Parada'}
          </span>
        </div>

        {/* Operador atual */}
        {hasActiveOperation && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Operador:
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {(() => {
                const userName = currentMachine.currentOperation?.user?.name;
                if (!userName || userName === 'div' || typeof userName !== 'string') {
                  return 'Desconhecido';
                }
                return userName;
              })()}
            </span>
          </div>
        )}

        {/* Campo de observações */}
        {(showStartNotes || showStopNotes) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Digite observações sobre a operação..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Botões de controle */}
        <div className="flex space-x-3">
          {canStartOperation && (
            <>
              {!showStartNotes ? (
                <button
                  onClick={() => setShowStartNotes(true)}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Iniciar Operação
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleStartOperation}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <PlayIcon className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Início
                  </button>
                  <button
                    onClick={() => {
                      setShowStartNotes(false);
                      setNotes('');
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </>
          )}

          {canStopOperation && (
            <>
              {!showStopNotes ? (
                <button
                  onClick={() => setShowStopNotes(true)}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <StopIcon className="h-4 w-4 mr-2" />
                  Finalizar Operação
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleStopOperation}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    ) : (
                      <StopIcon className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Finalização
                  </button>
                  <button
                    onClick={() => {
                      setShowStopNotes(false);
                      setNotes('');
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Informações adicionais */}
        {!canStartOperation && !canStopOperation && (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            {hasActiveOperation && !isCurrentOperator
              ? 'Máquina em operação por outro usuário'
              : 'Máquina não disponível para operação'
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default MachineOperationControls;