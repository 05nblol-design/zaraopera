import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './useSocket';
import api from '../services/api';

/**
 * Hook para calcular produção em tempo real baseado no status da máquina
 * @param {Object} machine - Dados da máquina
 * @param {number} refreshInterval - Intervalo de atualização em ms (padrão: 1000ms)
 * @returns {Object} Dados de produção em tempo real
 */
export const useRealTimeProduction = (machine, refreshInterval = 1000) => {
  const { socket } = useSocket();
  const [realTimeData, setRealTimeData] = useState({
    currentProduction: 0,
    runningTime: 0,
    efficiency: 0,
    currentSpeed: 0,
    isRunning: false
  });
  
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastStatusRef = useRef(null);
  const accumulatedProductionRef = useRef(0);
  const accumulatedRunningTimeRef = useRef(0);
  const machineIdRef = useRef(null);
  const lastCalculatedProductionRef = useRef(0);
  const lastUpdateTimeRef = useRef(null);

  // Função para obter chave do localStorage
  const getStorageKey = (machineId) => `realtime_production_${machineId}`;

  // Função para salvar dados no localStorage
  const saveToStorage = (machineId, data) => {
    try {
      const storageData = {
        ...data,
        lastSaved: new Date().toISOString(),
        shiftStart: getShiftStartTime().toISOString(),
        lastCalculatedProduction: lastCalculatedProductionRef.current,
        lastUpdateTime: lastUpdateTimeRef.current ? lastUpdateTimeRef.current.toISOString() : null
      };
      localStorage.setItem(getStorageKey(machineId), JSON.stringify(storageData));
    } catch (error) {
      console.warn('Erro ao salvar dados de produção:', error);
    }
  };

  // Função para carregar dados do localStorage
  const loadFromStorage = (machineId) => {
    try {
      const stored = localStorage.getItem(getStorageKey(machineId));
      if (!stored) return null;
      
      const data = JSON.parse(stored);
      const currentShiftStart = getShiftStartTime();
      const storedShiftStart = new Date(data.shiftStart);
      
      // Verificar se ainda é o mesmo turno
      if (currentShiftStart.getTime() === storedShiftStart.getTime()) {
        return {
          accumulatedProduction: data.accumulatedProduction || 0,
          accumulatedRunningTime: data.accumulatedRunningTime || 0,
          startTime: data.startTime ? new Date(data.startTime) : null,
          lastStatus: data.lastStatus,
          lastCalculatedProduction: data.lastCalculatedProduction || 0,
          lastUpdateTime: data.lastUpdateTime ? new Date(data.lastUpdateTime) : null
        };
      } else {
        // Turno mudou, limpar dados antigos
        localStorage.removeItem(getStorageKey(machineId));
        return null;
      }
    } catch (error) {
      console.warn('Erro ao carregar dados de produção:', error);
      return null;
    }
  };

  // Função para calcular produção baseada no tempo decorrido
  const calculateProduction = (timeInMinutes, speed) => {
    // Retorna a produção calculada incrementalmente
    return Math.max(0, Math.floor(timeInMinutes * speed));
  };

  // Função para calcular produção incremental (apenas o período atual)
  const calculateIncrementalProduction = (elapsedMinutes, speed) => {
    // Calcular apenas o incremento do período atual
    return Math.max(0, Math.floor(elapsedMinutes * speed));
  };

  // Função para calcular produção de forma mais precisa (evita recálculos)
  const calculateProductionIncrement = (currentTime, speed) => {
    if (!lastUpdateTimeRef.current) {
      lastUpdateTimeRef.current = currentTime;
      return 0;
    }
    
    const timeDiff = (currentTime - lastUpdateTimeRef.current) / 1000; // em segundos
    
    // Só calcula incremento se passou tempo suficiente (pelo menos 1 segundo)
    if (timeDiff < 1) {
      return 0;
    }
    
    // Converter velocidade de batidas/minuto para batidas/segundo
    const speedPerSecond = speed / 60;
    const increment = timeDiff * speedPerSecond; // Incremento baseado em segundos
    
    // Sempre atualiza o tempo da última atualização
    lastUpdateTimeRef.current = currentTime;
    
    // Garantir que o incremento seja sempre positivo
    return Math.max(0, increment);
  };

  // Função para formatar tempo em horas e minutos
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Função para determinar se a máquina está funcionando
  const isMachineRunning = (status) => {
    return status === 'FUNCIONANDO' || status === 'RUNNING';
  };

  // Função para determinar se a máquina está fora de turno
  const isMachineOffShift = (status) => {
    return status === 'FORA_DE_TURNO' || status === 'OFF_SHIFT';
  };

  // Função para atualizar dados localmente (usado apenas como fallback)
  const updateRealTimeDataLocal = useCallback(() => {
    if (!machine || !machine.productionSpeed) {
      return;
    }
    
    const speed = machine.productionSpeed;

    const now = new Date();
    const isCurrentlyRunning = isMachineRunning(machine.status);
    const isCurrentlyOffShift = isMachineOffShift(machine.status);
    
    // Se o status mudou, precisamos ajustar os cálculos
    if (lastStatusRef.current !== machine.status) {
      if (lastStatusRef.current && startTimeRef.current) {
        // Calcular produção acumulada do período anterior
        const wasRunning = isMachineRunning(lastStatusRef.current);
        const wasOffShift = isMachineOffShift(lastStatusRef.current);
        
        // Só acumula tempo e produção se não estava fora de turno
        if (wasRunning && !wasOffShift) {
          const elapsedMinutes = (now - startTimeRef.current) / (1000 * 60);
          // Acumular apenas a produção do período que acabou de terminar
          const periodProduction = calculateIncrementalProduction(elapsedMinutes, speed);
          accumulatedProductionRef.current += periodProduction;
          // Garantir que a produção nunca diminua
          accumulatedProductionRef.current = Math.max(accumulatedProductionRef.current, lastCalculatedProductionRef.current || 0);
          lastCalculatedProductionRef.current = accumulatedProductionRef.current;
          accumulatedRunningTimeRef.current += elapsedMinutes;
        }
      }
      
      // Resetar tempo de início para o novo status
      startTimeRef.current = now;
      lastStatusRef.current = machine.status;
    }

    // Se não há tempo de início, definir agora
    if (!startTimeRef.current) {
      startTimeRef.current = now;
      lastStatusRef.current = machine.status;
    }

    // Calcular tempo decorrido desde a última mudança de status
    const elapsedMinutes = (now - startTimeRef.current) / (1000 * 60);
    
    // Calcular produção atual usando incremento preciso
    let currentProduction = accumulatedProductionRef.current;
    let totalRunningTime = accumulatedRunningTimeRef.current;
    
    // Só calcula produção e tempo se estiver funcionando e não estiver fora de turno
    if (isCurrentlyRunning && !isCurrentlyOffShift) {
      // Calcular incremento de produção desde a última atualização
      const productionIncrement = calculateProductionIncrement(now, speed);
      
      // Acumular o incremento de produção (sempre positivo)
      if (productionIncrement > 0) {
        accumulatedProductionRef.current += productionIncrement;
        // Garantir que a produção nunca diminua
        accumulatedProductionRef.current = Math.max(accumulatedProductionRef.current, lastCalculatedProductionRef.current || 0);
        lastCalculatedProductionRef.current = accumulatedProductionRef.current;
      }
      
      currentProduction = accumulatedProductionRef.current;
      totalRunningTime += elapsedMinutes;
    } else {
      // Se não está funcionando, resetar o tempo da última atualização mas manter produção
      lastUpdateTimeRef.current = null;
      // Manter a produção acumulada mesmo quando parada
      currentProduction = accumulatedProductionRef.current;
    }

    // Calcular eficiência baseada no tempo total do turno
    const shiftStartTime = getShiftStartTime();
    const totalShiftMinutes = (now - shiftStartTime) / (1000 * 60);
    const efficiency = totalShiftMinutes > 0 ? Math.round((totalRunningTime / totalShiftMinutes) * 100) : 0;

    // Calcular meta de produção para o turno (12 horas = 720 minutos)
    const shiftDurationMinutes = 720; // 12 horas de turno
    const targetProduction = speed * shiftDurationMinutes;

    const newData = {
      currentProduction: Math.max(0, currentProduction),
      runningTime: totalRunningTime,
      runningTimeFormatted: formatTime(totalRunningTime),
      efficiency: Math.min(100, Math.max(0, efficiency)),
      currentSpeed: isCurrentlyRunning ? speed : 0,
      isRunning: isCurrentlyRunning,
      targetProduction: targetProduction,
      lastUpdate: now
    };

    setRealTimeData(newData);

    // Salvar dados no localStorage
    if (machine?.id) {
      saveToStorage(machine.id, {
        accumulatedProduction: accumulatedProductionRef.current,
        accumulatedRunningTime: accumulatedRunningTimeRef.current,
        startTime: startTimeRef.current?.toISOString(),
        lastStatus: lastStatusRef.current
      });
    }
  }, [machine]);

  // Função para buscar dados de produção do servidor
  const fetchProductionData = useCallback(async () => {
    if (!machine?.id) {
      return;
    }

    try {
      const response = await api.get(`/machines/${machine.id}/production/current-shift`);
      
      if (response.data) {
        const result = response.data;
        if (result.success && result.data) {
          const productionData = result.data;
          
          // Usar dados reais da API (shiftData) ao invés de cálculos locais
          const newData = {
            currentProduction: Math.max(0, productionData.estimatedProduction || 0),
            runningTime: productionData.runningMinutes || 0,
            runningTimeFormatted: formatTime(productionData.runningMinutes || 0),
            efficiency: Math.min(100, Math.max(0, productionData.efficiency || 0)),
            currentSpeed: isMachineRunning(machine.status) ? machine.productionSpeed : 0,
            isRunning: isMachineRunning(machine.status),
            targetProduction: machine.productionSpeed * 720, // 12 horas de turno
            lastUpdate: new Date()
          };

          // Sincronizar dados locais com os dados da API (preservando valores maiores)
          const apiProduction = productionData.estimatedProduction || 0;
          const currentAccumulated = accumulatedProductionRef.current || 0;
          
          // Sempre usar o maior valor entre API e local para evitar regressão
          accumulatedProductionRef.current = Math.max(apiProduction, currentAccumulated);
          accumulatedRunningTimeRef.current = Math.max(productionData.runningMinutes || 0, accumulatedRunningTimeRef.current || 0);
          lastCalculatedProductionRef.current = Math.max(apiProduction, lastCalculatedProductionRef.current || 0);
          
          // Log para debug
          if (apiProduction !== accumulatedProductionRef.current) {
            console.log(`🔄 Produção preservada: API=${apiProduction}, Local=${currentAccumulated}, Final=${accumulatedProductionRef.current}`);
          }
          
          setRealTimeData(newData);
          
          // Salvar dados sincronizados no localStorage
          if (machine?.id) {
            saveToStorage(machine.id, {
              accumulatedProduction: accumulatedProductionRef.current,
              accumulatedRunningTime: accumulatedRunningTimeRef.current,
              startTime: startTimeRef.current?.toISOString(),
              lastStatus: lastStatusRef.current
            });
          }
          
          return; // Sucesso, não usar fallback
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados de produção:', error);
    }
    
    // Fallback para cálculo local apenas em caso de erro na API
    updateRealTimeDataLocal();
  }, [machine?.id, machine?.status, machine?.productionSpeed, updateRealTimeDataLocal]);



  // Função para obter o início do turno atual (alinhado com backend: 7h-19h)
  const getShiftStartTime = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hour = now.getHours();
    
    if (hour >= 7 && hour < 19) {
      // Turno manhã: 07:00 - 19:00
      return new Date(today.getTime() + 7 * 60 * 60 * 1000);
    } else {
      // Turno noite: 19:00 - 07:00
      if (hour >= 19) {
        return new Date(today.getTime() + 19 * 60 * 60 * 1000);
      } else {
        // Se for antes das 7h, é turno da noite que começou ontem às 19h
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return new Date(yesterday.getTime() + 19 * 60 * 60 * 1000);
      }
    }
  };

  // Função para resetar dados (útil quando muda de turno)
  const resetProduction = () => {
    const now = new Date();
    const hour = now.getHours();
    
    console.log(`🔄 Resetando produção às ${hour}:${now.getMinutes().toString().padStart(2, '0')}`);
    
    accumulatedProductionRef.current = 0;
    accumulatedRunningTimeRef.current = 0;
    startTimeRef.current = new Date();
    lastStatusRef.current = machine?.status;
    lastCalculatedProductionRef.current = 0;
    lastUpdateTimeRef.current = null;
    
    // Limpar dados do localStorage
    if (machine?.id) {
      localStorage.removeItem(getStorageKey(machine.id));
      console.log(`🗑️ Dados do localStorage limpos para máquina ${machine.id}`);
    }
    
    // Atualizar estado para refletir o reset
    setRealTimeData({
      currentProduction: 0,
      runningTime: 0,
      efficiency: 0,
      currentSpeed: 0,
      isRunning: false
    });
  };

  // Efeito para carregar dados salvos quando a máquina muda
  useEffect(() => {
    if (machine?.id && machine.id !== machineIdRef.current) {
      machineIdRef.current = machine.id;
      
      // Carregar dados salvos do localStorage
      const savedData = loadFromStorage(machine.id);
      if (savedData) {
        accumulatedProductionRef.current = savedData.accumulatedProduction;
        accumulatedRunningTimeRef.current = savedData.accumulatedRunningTime;
        startTimeRef.current = savedData.startTime;
        lastStatusRef.current = savedData.lastStatus;
        lastCalculatedProductionRef.current = savedData.lastCalculatedProduction || 0;
        lastUpdateTimeRef.current = savedData.lastUpdateTime;
      } else {
        // Resetar se não há dados salvos
        accumulatedProductionRef.current = 0;
        accumulatedRunningTimeRef.current = 0;
        startTimeRef.current = null;
        lastStatusRef.current = null;
        lastCalculatedProductionRef.current = 0;
        lastUpdateTimeRef.current = null;
      }
    }
  }, [machine?.id]);

  // Efeito para iniciar/parar o timer
  useEffect(() => {
    if (!machine?.id) {
      return;
    }
    
    if (machine && machine.hasOwnProperty('productionSpeed')) {
      // Buscar dados da API imediatamente
      fetchProductionData();
      
      // Configurar intervalo para buscar dados da API (a cada 30 segundos)
      // Reduzido para evitar sobrecarga já que priorizamos dados da API
      intervalRef.current = setInterval(() => {
        fetchProductionData();
      }, 30000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [machine, fetchProductionData]);

  // Efeito para detectar mudança de turno e resetar dados (alinhado com backend)
  useEffect(() => {
    const checkShiftChange = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Resetar apenas nos horários de mudança de turno do backend (7h e 19h)
      if ((hour === 7 || hour === 19) && minute >= 0 && minute <= 1) {
        console.log(`🔄 Mudança de turno detectada às ${hour}:${minute.toString().padStart(2, '0')} - Resetando produção`);
        resetProduction();
      }
    };

    const shiftCheckInterval = setInterval(checkShiftChange, 30000); // Verificar a cada 30 segundos
    
    return () => clearInterval(shiftCheckInterval);
  }, []);

  // useEffect para escutar eventos WebSocket de mudança de status da máquina
  useEffect(() => {
    if (!socket || !machine?.id) return;

    const handleMachineStatusChanged = (data) => {
      // Verificar se o evento é para a máquina atual
      if (data.machineId === machine.id) {
        console.log('🔄 Status da máquina alterado via WebSocket:', data);
        // Atualizar dados imediatamente quando o status mudar
        fetchProductionData();
      }
    };

    const handleProductionUpdate = (data) => {
      if (data.machineId === machine.id) {
        // Buscar dados atualizados da API quando houver atualização de produção
        // Isso garante sincronização em tempo real com os dados do backend
        fetchProductionData();
      }
    };

    const handleOperationStarted = (data) => {
      if (data.machineId === machine.id) {
        console.log('🚀 Operação iniciada - atualizando produção:', data);
        // Verificar se é realmente uma nova operação ou continuação
        // Só resetar se não há produção acumulada significativa
        const currentProduction = accumulatedProductionRef.current || 0;
        if (currentProduction < 5) { // Só resetar se produção for muito baixa
          console.log('🔄 Resetando produção para nova operação (produção baixa)');
          resetProduction();
        } else {
          console.log('⚠️ Mantendo produção existente (operação em andamento)');
        }
        // Buscar dados atualizados
        fetchProductionData();
      }
    };

    const handleOperationEnded = (data) => {
      if (data.machineId === machine.id) {
        console.log('🛑 Operação finalizada - preservando produção:', data);
        // Salvar produção atual antes de buscar dados finais
        const currentProduction = accumulatedProductionRef.current || 0;
        console.log(`💾 Produção antes do fim da operação: ${currentProduction}`);
        
        // Buscar dados finais da produção
        fetchProductionData().then(() => {
          // Garantir que a produção não foi perdida
          const finalProduction = accumulatedProductionRef.current || 0;
          if (finalProduction < currentProduction) {
            console.log(`⚠️ Produção perdida detectada! Restaurando de ${finalProduction} para ${currentProduction}`);
            accumulatedProductionRef.current = currentProduction;
            lastCalculatedProductionRef.current = currentProduction;
            
            // Atualizar o estado com a produção preservada
            setRealTimeData(prevData => ({
              ...prevData,
              currentProduction: currentProduction
            }));
            
            // Salvar no localStorage
            if (machine?.id) {
              saveToStorage(machine.id, {
                accumulatedProduction: accumulatedProductionRef.current,
                accumulatedRunningTime: accumulatedRunningTimeRef.current,
                startTime: startTimeRef.current?.toISOString(),
                lastStatus: lastStatusRef.current
              });
            }
          }
        });
      }
    };

    socket.on('machine:status:changed', handleMachineStatusChanged);
    socket.on('machine:operation-started', handleOperationStarted);
    socket.on('machine:operation-ended', handleOperationEnded);
    socket.on('production:update', handleProductionUpdate);

    return () => {
      socket.off('machine:status:changed', handleMachineStatusChanged);
      socket.off('machine:operation-started', handleOperationStarted);
      socket.off('machine:operation-ended', handleOperationEnded);
      socket.off('production:update', handleProductionUpdate);
    };
  }, [socket, machine?.id, fetchProductionData, updateRealTimeDataLocal]);

  return {
    ...realTimeData,
    resetProduction
  };
};

export default useRealTimeProduction;