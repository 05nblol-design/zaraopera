import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CogIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';

const ProductionSpeedControl = ({ machine, machineId, currentSpeed, targetSpeed, unit, onSpeedUpdate, isRunning }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  // Suporte para ambas as interfaces: objeto machine ou propriedades individuais
  const machineData = machine || { id: machineId, productionSpeed: currentSpeed };
  const displaySpeed = machine?.productionSpeed || currentSpeed || 0;
  const displayTargetSpeed = machine?.targetProductionSpeed || targetSpeed || 0;
  const speedUnit = machine?.speedUnit || unit || 'RPM';
  
  const [speed, setSpeed] = useState(displaySpeed);
  const [isUpdating, setIsUpdating] = useState(false);

  // Verificar se o usuário tem permissão para alterar velocidade
  // OPERATOR, LEADER, MANAGER e ADMIN podem alterar velocidade de produção
  const canEditSpeed = ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN'].includes(user?.role);

  const handleSave = async () => {
    if (!speed || speed <= 0) {
      toast.error('Velocidade inválida');
      return;
    }

    if (!machineData || !machineData.id) {
      toast.error('Máquina não encontrada');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/machines/${machineData.id}/production-speed`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ productionSpeed: parseInt(speed) })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 403) {
          toast.error('Sem permissão');
          throw new Error('INSUFFICIENT_PERMISSION');
        }
        
        toast.error('Erro');
        throw new Error(errorData.message || 'Erro ao atualizar velocidade');
      }

      const data = await response.json();
      toast.success('Salvo');
      setIsEditing(false);
      
      if (onSpeedUpdate) {
        onSpeedUpdate(data.machine);
      }
    } catch (error) {
      console.error('Erro ao atualizar velocidade:', error);
      
      // Verificar se é erro de permissão
      if (error.message && error.message.includes('403')) {
        toast.error('Sem permissão');
      } else if (error.message && error.message.includes('INSUFFICIENT_PERMISSION')) {
        toast.error('Sem permissão');
      } else {
        toast.error('Erro');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setSpeed(displaySpeed);
    setIsEditing(false);
  };

  if (!canEditSpeed) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center">
          <CogIcon className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Velocidade de Produção
          </h3>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {displaySpeed} <span className="text-sm font-normal text-gray-500">{speedUnit}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <CogIcon className="h-5 w-5 text-blue-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Velocidade de Produção
          </h3>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Editar
          </button>
        )}
      </div>

      <div className="mt-4">
        {isEditing ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="speed" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Velocidade ({speedUnit})
              </label>
              <input
                type="number"
                id="speed"
                min="1"
                max="1000"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: 120"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Velocidade atual: {displaySpeed} {speedUnit}
              </p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                disabled={isUpdating || !speed || speed <= 0}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                {isUpdating ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isUpdating}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Cancelar
              </button>
            </div>
          </motion.div>
        ) : (
          <div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {displaySpeed}
              <span className="text-lg font-normal text-gray-500 ml-2">{speedUnit}</span>
            </p>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              <p>Produção estimada por hora: <span className="font-medium">{(displaySpeed * 60).toLocaleString()}</span> unidades</p>
              <p>Produção estimada por turno (12h): <span className="font-medium">{(displaySpeed * 60 * 12).toLocaleString()}</span> unidades</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductionSpeedControl;