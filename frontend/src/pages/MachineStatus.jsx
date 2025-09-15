import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

const MachineStatus = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [machine, setMachine] = useState(null);
  
  // Mapear status do backend para o frontend
  const statusMap = {
    'FUNCIONANDO': 'Funcionando',
    'PARADA': 'Parada',
    'MANUTENCAO': 'Manutenção',
    'FORA_DE_TURNO': 'Fora de Turno',
    'OFF_SHIFT': 'Fora de Turno'
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusHistory, setStatusHistory] = useState([]);

  useEffect(() => {
    fetchMachineData();
    fetchStatusHistory();
  }, [id]);

  // Escutar eventos WebSocket para atualizações em tempo real
  useEffect(() => {
    if (!socket) return;

    const handleMachineStatusChanged = (data) => {
      console.log('🔄 Status alterado via WebSocket na página:', data);
      if (data.machineId === parseInt(id)) {
        setMachine(prev => prev ? {
          ...prev,
          status: data.newStatus || data.status,
          lastUpdatedBy: data.user,
          updatedAt: new Date().toISOString()
        } : prev);
        // Atualizar histórico também
        fetchStatusHistory();
      }
    };

    const handleOperationStarted = (data) => {
      if (data.machineId === parseInt(id)) {
        console.log('🚀 Operação iniciada via WebSocket:', data);
        fetchMachineData();
        fetchStatusHistory();
      }
    };

    const handleOperationEnded = (data) => {
      if (data.machineId === parseInt(id)) {
        console.log('🛑 Operação finalizada via WebSocket:', data);
        fetchMachineData();
        fetchStatusHistory();
      }
    };

    socket.on('machine:status:changed', handleMachineStatusChanged);
    socket.on('machine:operation-started', handleOperationStarted);
    socket.on('machine:operation-ended', handleOperationEnded);

    return () => {
      socket.off('machine:status:changed', handleMachineStatusChanged);
      socket.off('machine:operation-started', handleOperationStarted);
      socket.off('machine:operation-ended', handleOperationEnded);
    };
  }, [socket, id]);

  const fetchMachineData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/machines/${id}`);
      setMachine(response.data);
      setNewStatus(response.data.status);
    } catch (err) {
      console.error('Erro ao carregar dados da máquina:', err);
      setError('Erro ao carregar dados da máquina');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusHistory = async () => {
    try {
      const response = await api.get(`/machines/${id}/status-history`);
      setStatusHistory(response.data);
    } catch (err) {
      console.error('Erro ao carregar histórico de status:', err);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!newStatus) return;

    // Mapear status do frontend para o backend
    const statusMap = {
      'Funcionando': 'FUNCIONANDO',
      'Parada': 'PARADA',
      'Manutenção': 'MANUTENCAO',
      'Fora de Turno': 'FORA_DE_TURNO'
    };

    setIsUpdatingStatus(true);
    try {
      await api.put(`/machines/${id}/status`, {
        status: statusMap[newStatus] || newStatus,
        reason: statusReason,
        notes: statusNotes,
      });

      // Atualizar dados da máquina
      await fetchMachineData();
      await fetchStatusHistory();
      
      // Limpar campos
      setStatusReason('');
      setStatusNotes('');
      
      // Mostrar mensagem de sucesso
      toast.success('Status atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      setError('Erro ao atualizar status da máquina');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusConfig = (status) => {
    const normalizedStatus = statusMap[status] || status;
    
    const configs = {
      'Funcionando': {
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
        icon: CheckCircleIcon,
      },
      'Parada': {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        icon: XCircleIcon,
      },
      'Manutenção': {
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        icon: WrenchScrewdriverIcon,
      },
    };
    return configs[normalizedStatus] || {
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-700',
      borderColor: 'border-gray-200 dark:border-gray-600',
      icon: ExclamationTriangleIcon,
    };
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Não disponível';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => navigate('/machines')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Voltar para Máquinas
          </button>
        </div>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-400">Máquina não encontrada</p>
      </div>
    );
  }

  const statusConfig = getStatusConfig(machine.status);
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <Helmet>
        <title>{machine ? `Status - ${machine.name} - Sistema ZARA` : 'Status da Máquina - Sistema ZARA'}</title>
        <meta name="description" content={machine ? `Controle de status da máquina ${machine.name}` : 'Controle de status da máquina'} />
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/machines')}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 rounded-lg"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Controle de Status - {machine.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Gerencie o status operacional da máquina
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Atual */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Status Atual
            </h2>
            
            <div className={`flex items-center space-x-3 p-4 rounded-lg ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
              <StatusIcon className={`h-8 w-8 ${statusConfig.color}`} />
              <div>
                <p className={`text-lg font-semibold ${statusConfig.color}`}>
                  {statusMap[machine.status] || machine.status}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Última atualização: {machine.updatedAt ? formatDateTime(machine.updatedAt) : 'Não disponível'}
                </p>
              </div>
            </div>

            {/* Informações da Máquina */}
            <div className="mt-6 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Localização:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{machine.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tipo:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{machine.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Operador:</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {machine.currentOperator || 'Não atribuído'}
                </span>
              </div>
            </div>

            {/* Alertas */}
            {machine.alerts && machine.alerts.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Alertas Ativos ({machine.alerts.length})
                </h3>
                <div className="space-y-2">
                  {machine.alerts.map((alert, index) => (
                    <div key={index} className="flex items-start space-x-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      <ExclamationTriangleIcon className="h-4 w-4 text-red-500 mt-0.5" />
                      <p className="text-sm text-red-700 dark:text-red-300">{alert.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Alterar Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Alterar Status
            </h2>

            <form onSubmit={handleStatusUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Novo Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="Funcionando">Funcionando</option>
                  <option value="Parada">Parada</option>
                  <option value="Manutenção">Manutenção</option>
                  <option value="Fora de Turno">Fora de Turno</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Motivo da Alteração
                </label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Ex: Manutenção preventiva, falha no equipamento..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Observações Adicionais
                </label>
                <textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Informações adicionais sobre a alteração de status..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingStatus || !newStatus}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isUpdatingStatus ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Atualizando...
                  </>
                ) : (
                  'Atualizar Status'
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Histórico de Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Histórico de Status
          </h2>

          {statusHistory.length > 0 ? (
            <div className="space-y-3">
              {statusHistory.map((entry, index) => {
                const entryStatusConfig = getStatusConfig(entry.status);
                const EntryStatusIcon = entryStatusConfig.icon;
                
                return (
                  <div key={index} className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <EntryStatusIcon className={`h-5 w-5 ${entryStatusConfig.color} mt-0.5`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${entryStatusConfig.color}`}>
                          {statusMap[entry.status] || entry.status}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                      {entry.reason && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Motivo: {entry.reason}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Observações: {entry.notes}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Por: {entry.changedBy || 'Sistema'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              Nenhum histórico de status disponível
            </p>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default MachineStatus;