import { useState, useEffect } from 'react';
import { useSocket } from './useSocket';
import { useAuth } from './useAuth';
import { machineService } from '../services/api';

export const useMachineStatus = () => {
  const { socket, isConnected } = useSocket();
  const { token, user } = useAuth();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    stopped: 0,
    maintenance: 0,
    error: 0
  });

  // Buscar dados iniciais das máquinas
  useEffect(() => {
    if (token && user) {
      fetchMachines();
    } else {
      // Se não há usuário logado, definir estado inicial sem erro
      setLoading(false);
      setMachines([]);
      setError(null);
    }
  }, [token, user]);

  // Escutar atualizações em tempo real
  useEffect(() => {
    if (socket && isConnected) {
      // Eventos corretos que o servidor emite
      socket.on('machine:status:changed', handleMachineStatusChanged);
      socket.on('machine:operation-started', handleOperationStarted);
      socket.on('machine:operation-ended', handleOperationEnded);
      socket.on('machine-status-update', handleMachineUpdate);
      socket.on('machine-data-update', handleMachineDataUpdate);
      socket.on('machines-bulk-update', handleBulkUpdate);

      return () => {
        socket.off('machine:status:changed', handleMachineStatusChanged);
        socket.off('machine:operation-started', handleOperationStarted);
        socket.off('machine:operation-ended', handleOperationEnded);
        socket.off('machine-status-update', handleMachineUpdate);
        socket.off('machine-data-update', handleMachineDataUpdate);
        socket.off('machines-bulk-update', handleBulkUpdate);
      };
    }
  }, [socket, isConnected]);

  // Calcular estatísticas quando as máquinas mudarem
  useEffect(() => {
    calculateStats();
  }, [machines]);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await machineService.getAll();
      const data = response.data;

      if (data.success) {
        setMachines(data.data || []);
      } else {
        throw new Error('Erro ao buscar máquinas');
      }
    } catch (err) {
      console.error('Erro ao buscar máquinas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMachineUpdate = (updatedMachine) => {
    setMachines(prev => 
      prev.map(machine => 
        machine.id === updatedMachine.id 
          ? { ...machine, ...updatedMachine }
          : machine
      )
    );
  };

  // Handler para eventos do servidor (machine:status:changed)
  const handleMachineStatusChanged = (data) => {
    console.log('🔄 Status de máquina alterado via WebSocket:', data);
    const { machineId, newStatus, status, machineName, user } = data;
    const finalStatus = newStatus || status;
    
    setMachines(prev => 
      prev.map(machine => 
        machine.id === machineId 
          ? { ...machine, status: finalStatus, lastUpdatedBy: user }
          : machine
      )
    );
  };

  // Handler para início de operação
  const handleOperationStarted = (data) => {
    console.log('🚀 Operação iniciada via WebSocket:', data);
    const { machineId, operatorName, operatorId, notes, operation } = data;
    
    setMachines(prev => 
      prev.map(machine => 
        machine.id === machineId 
          ? { 
              ...machine, 
              status: 'FUNCIONANDO',
              currentOperator: operatorName,
              operationNotes: notes,
              operations: [{
                id: operation?.id,
                status: 'ACTIVE',
                userId: operatorId,
                startTime: new Date().toISOString(),
                notes: notes,
                user: {
                  name: operatorName
                }
              }],
              currentOperation: {
                id: operation?.id,
                status: 'ACTIVE',
                userId: operatorId,
                startTime: new Date().toISOString(),
                notes: notes,
                user: {
                  name: operatorName
                }
              },
              operator: operatorName,
              lastUpdated: new Date().toISOString()
            }
          : machine
      )
    );
  };

  // Handler para finalização de operação
  const handleOperationEnded = (data) => {
    console.log('🛑 Operação finalizada via WebSocket:', data);
    const { machineId } = data;
    
    setMachines(prev => 
      prev.map(machine => 
        machine.id === machineId 
          ? { 
              ...machine, 
              status: 'PARADA',
              currentOperator: null,
              operationNotes: null,
              operations: [], // Limpar operações ativas
              currentOperation: null, // Limpar operação atual
              operator: 'Não atribuído',
              lastUpdated: new Date().toISOString()
              // IMPORTANTE: Preservar dados de produção (currentProduction, runningTime, etc.)
              // Estes dados são gerenciados pelo useRealTimeProduction e não devem ser zerados aqui
            }
          : machine
      )
    );
  };

  const handleMachineDataUpdate = (data) => {
    const { machineId, ...updateData } = data;
    setMachines(prev => 
      prev.map(machine => 
        machine.id === machineId 
          ? { ...machine, ...updateData }
          : machine
      )
    );
  };

  const handleBulkUpdate = (updatedMachines) => {
    setMachines(updatedMachines);
  };

  const calculateStats = () => {
    const newStats = machines.reduce((acc, machine) => {
      acc.total++;
      
      // Mapear status para as categorias corretas
      const status = machine.status?.toUpperCase();
      if (status === 'FUNCIONANDO' || status === 'RUNNING') {
        acc.running++;
      } else if (status === 'PARADA' || status === 'STOPPED') {
        acc.stopped++;
      } else if (status === 'MANUTENCAO' || status === 'MAINTENANCE') {
        acc.maintenance++;
      } else if (status === 'FORA_DE_TURNO' || status === 'OFF_SHIFT' || status === 'ERROR') {
        acc.error++;
      }
      
      return acc;
    }, {
      total: 0,
      running: 0,
      stopped: 0,
      maintenance: 0,
      error: 0
    });

    setStats(newStats);
  };

  const getMachineById = (id) => {
    return machines.find(machine => machine.id === id);
  };

  const getMachinesByStatus = (status) => {
    return machines.filter(machine => machine.status?.toLowerCase() === status.toLowerCase());
  };

  const getMachinesByLine = (line) => {
    return machines.filter(machine => machine.line === line);
  };

  const getAverageEfficiency = () => {
    if (machines.length === 0) return 0;
    const total = machines.reduce((sum, machine) => sum + (machine.efficiency || 0), 0);
    return Math.round(total / machines.length);
  };

  const getProductionToday = () => {
    return machines.reduce((sum, machine) => sum + (machine.productionToday || 0), 0);
  };

  const getAlertsCount = () => {
    return machines.reduce((sum, machine) => sum + (machine.alerts?.length || 0), 0);
  };

  const updateMachineStatus = async (machineId, status) => {
    try {
      const response = await machineService.updateStatus(machineId, { status });
      const data = response.data;

      if (data.success) {
        handleMachineUpdate(data.data);
        return { success: true };
      } else {
        throw new Error('Erro ao atualizar status da máquina');
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      return { success: false, error: err.message };
    }
  };

  const refreshMachines = () => {
    fetchMachines();
  };

  return {
    machines,
    loading,
    error,
    stats,
    getMachineById,
    getMachinesByStatus,
    getMachinesByLine,
    getAverageEfficiency,
    getProductionToday,
    getAlertsCount,
    updateMachineStatus,
    refreshMachines
  };
};

export default useMachineStatus;