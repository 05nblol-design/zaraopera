import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { machineService } from '../services/api';
import { Clock, Package, AlertTriangle, CheckCircle, Camera, Video, FileText, Lock, Play, Pause, Target, Unlock, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import ProductionSpeedControl from '../components/ProductionSpeedControl';
import QualityTestModal from '../components/QualityTestModal';

const ProductionOperationPage = () => {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const intervalRef = useRef(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  
  // Estados principais
  const [machineInfo, setMachineInfo] = useState(null);
  const [productionData, setProductionData] = useState({
    currentCount: 0,
    testThreshold: 100,
    productsUntilTest: 100,
    isLocked: false,
    isOverdue: false,
    overdueCount: 0
  });
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [notificationSent, setNotificationSent] = useState(false);
  const [lastNotificationTime, setLastNotificationTime] = useState(null);
  const [qualityConfigs, setQualityConfigs] = useState([]);
  const [timer, setTimer] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [testHistory, setTestHistory] = useState([]);
  const [testForm, setTestForm] = useState({
    photos: [],
    videos: [],
    observations: '',
    result: 'approved'
  });
  const [loading, setLoading] = useState(true);
  const [machineSpeed, setMachineSpeed] = useState({
    currentSpeed: 0,
    targetSpeed: 0,
    unit: 'RPM'
  });
  const [machineConfig, setMachineConfig] = useState({
    production: {
      popupThreshold: 50,
      alertThreshold: 100,
      enablePopups: true,
      enableAlerts: true
    }
  });
  const [showQualityTestModal, setShowQualityTestModal] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    // Validar se machineId existe e é válido
    if (!machineId || isNaN(parseInt(machineId))) {
      console.error('machineId inválido ou não encontrado:', machineId);
      toast.error('ID da máquina inválido');
      navigate('/machines');
      return;
    }
    
    loadMachineData();
    loadQualityConfigs();
    loadMachineConfig();
    loadTestHistory();
    setupWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [machineId, navigate]);
  
  // Efeito para verificar bloqueio de operação e notificações
  useEffect(() => {
    checkOperationLock();
    
    // Verificar bloqueio baseado em produtos em atraso
    if (productionData.overdueCount > 0) {
      setIsBlocked(true);
      setBlockReason(`Teste de qualidade em atraso! ${productionData.overdueCount} produtos aguardando teste.`);
      
      // Enviar notificação se ainda não foi enviada ou se passou mais de 30 minutos
      const shouldNotify = !notificationSent || 
                          (lastNotificationTime && 
                           (new Date() - lastNotificationTime) > 30 * 60 * 1000); // 30 minutos
      
      if (shouldNotify) {
        sendManagerNotification('overdue_test', {
          overdueCount: productionData.overdueCount,
          message: `${productionData.overdueCount} produtos em atraso precisam de teste de qualidade`
        });
      }
    } else if (productionData.productsUntilTest <= 0 && qualityConfigs.length > 0) {
      setIsBlocked(true);
      setBlockReason('Limite de produção atingido! Realize o teste de qualidade para continuar.');
      
      // Enviar notificação se ainda não foi enviada
      if (!notificationSent) {
        sendManagerNotification('test_required', {
          currentCount: productionData.currentCount,
          message: 'Limite de produção atingido - teste obrigatório'
        });
      }
    } else {
      setIsBlocked(false);
      setBlockReason('');
      // Reset notification status when no longer blocked
      if (notificationSent) {
        setNotificationSent(false);
        setLastNotificationTime(null);
      }
    }
  }, [productionData.currentCount, productionData.overdueCount, productionData.productsUntilTest, qualityConfigs, notificationSent, lastNotificationTime]);

  // Atualizar contagem regressiva quando dados de produção ou configurações mudarem
  useEffect(() => {
    if ((qualityConfigs.length > 0 || machineConfig.production.popupThreshold) && productionData.currentCount >= 0) {
      checkOperationLock();
    }
  }, [productionData.currentCount, qualityConfigs, testHistory, machineConfig.production]);

  // Funções de carregamento de dados
  const loadMachineData = async () => {
    if (!machineId || isNaN(parseInt(machineId))) {
      console.error('loadMachineData: machineId inválido:', machineId);
      return;
    }
    
    try {
      const response = await machineService.getById(machineId);
      setMachineInfo(response.data);
      
      // Verificar se há operação ativa e definir isRunning
      if (response.data.currentOperation && response.data.currentOperation.status === 'ACTIVE') {
        setIsRunning(true);
        // Se há operação ativa, definir o tempo de início
        if (response.data.currentOperation.startTime) {
          startTimeRef.current = new Date(response.data.currentOperation.startTime).getTime();
        }
      } else {
        setIsRunning(false);
      }
      
      // Buscar dados de produção atual
      await fetchProductionData();
      
      // Carregar dados de velocidade da máquina
      if (response.data.speed) {
        setMachineSpeed({
          currentSpeed: response.data.speed.current || 0,
          targetSpeed: response.data.speed.target || 0,
          unit: response.data.speed.unit || 'RPM'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados da máquina:', error);
      toast.error('Erro ao carregar dados da máquina');
    }
  };
  
  const loadQualityConfigs = async () => {
    if (!machineId || isNaN(parseInt(machineId))) {
      console.error('loadQualityConfigs: machineId inválido:', machineId);
      return;
    }
    
    try {
      const response = await api.get(`/quality-test-config/machine/${machineId}/required-tests`);
      if (response.data.success && response.data.data.hasRequiredTests) {
        // Se há testes pendentes, usar eles; senão buscar configurações ativas
        if (response.data.data.hasPendingTests && response.data.data.pendingTests.length > 0) {
          setQualityConfigs(response.data.data.pendingTests);
        } else {
          // Buscar configurações ativas da máquina
          const configsResponse = await api.get(`/quality-test-config?machineId=${machineId}&isActive=true`);
          if (configsResponse.data.success && configsResponse.data.data.length > 0) {
            // Converter formato para compatibilidade
            const activeConfigs = configsResponse.data.data.map(config => ({
              configId: config.id,
              testName: config.testType,
              testDescription: config.testType,
              testFrequency: config.frequency,
              productsPerTest: config.frequency,
              testsRequired: 0,
              testsCompleted: 0,
              testsPending: 0
            }));
            setQualityConfigs(activeConfigs);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de qualidade:', error);
    }
  };

  const loadMachineConfig = async () => {
    if (!machineId || isNaN(parseInt(machineId))) {
      console.error('loadMachineConfig: machineId inválido:', machineId);
      return;
    }
    
    try {
      const response = await machineService.getConfig(machineId);
      if (response.data.success && response.data.data.config) {
        const config = response.data.data.config;
        if (config.production) {
          setMachineConfig(prev => ({
            ...prev,
            production: {
              popupThreshold: config.production.popupThreshold || 50,
              alertThreshold: config.production.alertThreshold || 100,
              enablePopups: config.production.enablePopups ?? true,
              enableAlerts: config.production.enableAlerts ?? true
            }
          }));
          console.log('Configurações de produção carregadas:', config.production);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações da máquina:', error);
    }
  };
  
  const setupWebSocket = () => {
    // Configurar WebSocket para atualizações em tempo real - prioriza ngrok
    const getWsUrl = () => {
      if (import.meta.env.VITE_SOCKET_URL && import.meta.env.VITE_SOCKET_URL.includes('ngrok')) {
        return import.meta.env.VITE_SOCKET_URL.replace('https://', 'wss://').replace('http://', 'ws://');
      }
      return 'ws://localhost:3001';
    };
    
    const wsUrl = getWsUrl();
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'production:realtime-update' && data.machineId === parseInt(machineId)) {
        setProductionData(prev => ({ ...prev, currentCount: data.totalProduction }));
      }
    };
  };
  
  const checkOperationLock = () => {
    // Usar popupThreshold das configurações de produção da máquina como prioridade
    let productsPerTest = machineConfig.production.popupThreshold || 50;
    
    // Se não há configuração de produção, usar qualityConfigs como fallback
    if (qualityConfigs.length > 0) {
      const mainConfig = qualityConfigs[0];
      // Se popupThreshold não está definido, usar configuração de qualidade
      if (!machineConfig.production.popupThreshold) {
        productsPerTest = mainConfig.productsPerTest || mainConfig.testFrequency || 100;
      }
    }
    
    console.log('Usando threshold de produção:', productsPerTest, 'da configuração:', machineConfig.production);
    
    if (productsPerTest) {
      // Calcular quantos produtos foram produzidos desde o último teste
      const testsCompleted = testHistory.length;
      const expectedProduction = testsCompleted * productsPerTest;
      const currentProduction = productionData.currentCount;
      
      // Produtos produzidos no ciclo atual (desde o último teste)
      const productsInCurrentCycle = Math.max(0, currentProduction - expectedProduction);
      
      // Produtos restantes até o próximo teste
      const remaining = Math.max(0, productsPerTest - productsInCurrentCycle);
      
      // Verificar se está em atraso (produziu mais que deveria sem fazer teste)
      const isOverdue = productsInCurrentCycle >= productsPerTest;
      const overdueCount = Math.max(0, productsInCurrentCycle - productsPerTest);
      
      // Verificar se deve gerar alerta automático
      const alertThreshold = machineConfig.production.alertThreshold || 100;
      const shouldAlert = currentProduction >= alertThreshold;
      
      console.log('Cálculo de próximo teste:', {
        currentProduction,
        testsCompleted,
        expectedProduction,
        productsInCurrentCycle,
        productsPerTest,
        remaining,
        alertThreshold,
        shouldAlert
      });
      
      setProductionData(prev => ({
        ...prev,
        productsUntilTest: remaining,
        testThreshold: productsPerTest,
        isOverdue: isOverdue,
        overdueCount: overdueCount,
        isLocked: isOverdue,
        shouldAlert: shouldAlert
      }));
      
      // Parar produção se estiver em atraso
      if (isOverdue && isRunning) {
        setIsRunning(false);
      }
      
      // Gerar alerta automático se atingiu o threshold
      if (shouldAlert && !notificationSent) {
        sendManagerNotification(
          `Alerta automático: Máquina ${machineId} atingiu ${currentProduction} produtos (limite: ${alertThreshold})`
        );
      }
    }
  };
  
  // Buscar dados de produção
  const fetchProductionData = async () => {
    if (!machineId || isNaN(parseInt(machineId))) {
      console.error('fetchProductionData: machineId inválido:', machineId);
      return;
    }
    
    try {
      const response = await machineService.getProductionCount(machineId);
      const currentCount = response.data.data.estimatedProduction || 0;
      
      setProductionData(prev => ({
        ...prev,
        currentCount
      }));
    } catch (error) {
      console.error('Erro ao buscar dados de produção:', error);
    }
  };

  const loadTestHistory = async () => {
    if (!machineId || isNaN(parseInt(machineId))) {
      console.error('loadTestHistory: machineId inválido:', machineId);
      return;
    }
    
    try {
      const response = await api.get(`/quality-tests/executed-ids/${machineId}?limit=10`);
      if (response.data.success) {
        setTestHistory(response.data.data.executedTests || []);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de testes:', error);
      // Mock data por enquanto
      setTestHistory([
        {
          id: 1,
          timestamp: new Date().toISOString(),
          operator: user?.name || 'Operador',
          result: 'approved',
          observations: 'Teste realizado conforme padrão',
          photos: 1,
          videos: 0
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Timer de produção
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTimeRef.current) / 1000);
        
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        
        setTimer({ hours, minutes, seconds });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  // Iniciar operação
  const startOperation = async () => {
    if (isBlocked) {
      toast.error(blockReason);
      return;
    }
    
    try {
      await api.post(`/machines/${machineId}/start-operation`);
      setIsRunning(true);
      startTimeRef.current = Date.now();
      toast.success('Operação iniciada');
    } catch (error) {
      console.error('Erro ao iniciar operação:', error);
      toast.error('Erro ao iniciar operação');
    }
  };

  // Pausar operação
  const pauseOperation = async () => {
    try {
      await api.post(`/machines/${machineId}/end-operation`);
      setIsRunning(false);
      toast.success('Operação pausada');
    } catch (error) {
      console.error('Erro ao pausar operação:', error);
      toast.error('Erro ao pausar operação');
    }
  };

  // Atualizar velocidade da máquina
  const handleSpeedUpdate = async (newSpeed) => {
    try {
      await api.put(`/machines/${machineId}/speed`, {
        speed: newSpeed
      });
      
      setMachineSpeed(prev => ({
        ...prev,
        currentSpeed: newSpeed
      }));
      
      toast.success('Velocidade atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar velocidade:', error);
      toast.error('Erro ao atualizar velocidade');
      throw error;
    }
  };

  // Calcular cor da barra de progresso
  const getProgressColor = () => {
    const threshold = productionData.testThreshold || qualityConfigs[0]?.productsPerTest || qualityConfigs[0]?.testFrequency || 100;
    const remaining = productionData.productsUntilTest || 0;
    const percentage = threshold > 0 ? ((threshold - remaining) / threshold) * 100 : 0;
    
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Abrir formulário de teste
  const openTestForm = () => {
    if (productionData.isLocked || productionData.isOverdue) {
      setShowTestForm(true);
    }
  };

  // Enviar notificação aos gestores
  const sendManagerNotification = async (type, data) => {
    try {
      const notificationData = {
        type,
        machineId,
        machineName: machineInfo?.machine_name || 'Máquina Desconhecida',
        operator: user.name,
        timestamp: new Date().toISOString(),
        ...data
      };

      await api.post('/api/notifications/managers', notificationData);
      
      setNotificationSent(true);
      setLastNotificationTime(new Date());
      
      toast.success('Gestores notificados sobre o atraso no teste');
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
      toast.error('Erro ao notificar gestores');
    }
  };

  // Submeter teste
  const submitTest = async () => {
    try {
      const formData = new FormData();
      formData.append('machineId', machineId);
      formData.append('observations', testForm.observations);
      formData.append('approved', testForm.result === 'approved');
      formData.append('isRequired', true);
      
      // Adicionar fotos e vídeos
      testForm.photos.forEach((photo) => {
        formData.append(`photos`, photo);
      });
      testForm.videos.forEach((video) => {
        formData.append(`videos`, video);
      });
      
      await api.post('/quality-tests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Teste registrado com sucesso');
      
      // Resetar contagem e destravar operação
      setProductionData(prev => ({
        ...prev,
        productsUntilTest: qualityConfigs[0]?.productsPerTest || 100,
        isLocked: false,
        isOverdue: false,
        overdueCount: 0
      }));
      
      // Resetar formulário e notificações
      setTestForm({
        photos: [],
        videos: [],
        observations: '',
        result: 'approved'
      });
      
      setShowTestForm(false);
      setNotificationSent(false);
      setLastNotificationTime(null);
      
      // Recarregar dados
      loadTestHistory();
      loadQualityConfigs();
      setIsRunning(true);
      
    } catch (error) {
      console.error('Erro ao submeter teste:', error);
      toast.error('Erro ao registrar teste');
    }
  };

  // Formatação de tempo
  const formatTime = (time) => {
    return `${time.hours.toString().padStart(2, '0')}:${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados da operação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{machineInfo?.machine_name || 'Carregando...'}</h1>
            <p className="text-gray-600">{machineInfo?.location || ''}</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Voltar ao Dashboard
            </button>
            {!isRunning ? (
              <button
                onClick={startOperation}
                disabled={isBlocked}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-colors ${
                  isBlocked
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Play className="w-5 h-5" />
                <span>{isBlocked ? 'Operação Bloqueada' : 'Iniciar Operação'}</span>
              </button>
            ) : (
              <button
                onClick={pauseOperation}
                className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Pause className="w-5 h-5" />
                <span>Pausar Operação</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alerta de Bloqueio da Operação */}
      {isBlocked && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6"
        >
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-500 mr-3 animate-pulse" />
            <div className="flex-1">
              <h3 className="text-red-800 font-bold text-lg">⚠️ OPERAÇÃO BLOQUEADA</h3>
              <p className="text-red-700 font-medium">{blockReason}</p>
              {notificationSent && (
                <div className="flex items-center mt-2 text-sm text-red-600">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  <span>Gestores notificados às {lastNotificationTime?.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
            {productionData.productsUntilTest <= 0 && (
              <div className="ml-4 flex flex-col space-y-2">
                <button
                  onClick={() => setShowTestForm(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  Realizar Teste
                </button>
                {!notificationSent && (
                  <button
                    onClick={() => sendManagerNotification('manual_alert', {
                      message: 'Notificação manual enviada pelo operador',
                      reason: blockReason
                    })}
                    className="bg-orange-500 text-white px-4 py-1 rounded text-sm hover:bg-orange-600 transition-colors"
                  >
                    Notificar Gestores
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
      
      {/* Alerta de Produtos em Atraso (quando não bloqueado) */}
      {!isBlocked && productionData.overdueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"
        >
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
            <div>
              <h3 className="text-yellow-800 font-semibold">Atenção: Teste Pendente</h3>
              <p className="text-yellow-600">
                {productionData.overdueCount} produtos aguardando teste de qualidade
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
        {/* Produção Atual */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Produção Atual</p>
              <p className="text-3xl font-bold text-blue-600">{productionData.currentCount.toLocaleString()}</p>
            </div>
            <Package className="w-12 h-12 text-blue-600" />
          </div>
          
          {/* Métricas Adicionais */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {productionData.shiftTarget ? 
                  Math.round((productionData.currentCount / productionData.shiftTarget) * 100) : 0}%
              </div>
              <p className="text-xs text-gray-500">Meta do Turno</p>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">
                {productionData.hourlyRate || 0}
              </div>
              <p className="text-xs text-gray-500">Peças/Hora</p>
            </div>
          </div>
          
          {/* Barra de Progresso da Meta */}
          {productionData.shiftTarget && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Meta: {productionData.shiftTarget}</span>
                <span>{productionData.shiftTarget - productionData.currentCount} restantes</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min((productionData.currentCount / productionData.shiftTarget) * 100, 100)}%` 
                  }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Contagem Regressiva */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Próximo Teste</p>
              {qualityConfigs.length > 0 ? (
                <p className={`text-3xl font-bold transition-colors duration-300 ${
                  productionData.isOverdue ? 'text-red-600 animate-pulse' : 
                  productionData.productsUntilTest <= 5 ? 'text-red-600' :
                  productionData.productsUntilTest <= 15 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {productionData.isOverdue ? `Atrasado: ${productionData.overdueCount}` : productionData.productsUntilTest}
                </p>
              ) : (
                <p className="text-xl text-gray-500">Sem configuração</p>
              )}
            </div>
            <Target className={`w-12 h-12 ${
              productionData.isOverdue ? 'text-red-600' : 
              productionData.productsUntilTest <= 5 ? 'text-red-600' :
              productionData.productsUntilTest <= 15 ? 'text-yellow-600' : 'text-green-600'
            }`} />
          </div>
          
          {/* Barra de Progresso Visual */}
          {qualityConfigs.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progresso para Próximo Teste</span>
                <span>{productionData.testThreshold || qualityConfigs[0]?.productsPerTest || qualityConfigs[0]?.testFrequency || 100} produtos por teste</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ${
                    productionData.isOverdue ? 'bg-red-600 animate-pulse' :
                    productionData.productsUntilTest <= 5 ? 'bg-red-500' :
                    productionData.productsUntilTest <= 15 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ 
                    width: `${(() => {
                      const threshold = productionData.testThreshold || qualityConfigs[0]?.productsPerTest || qualityConfigs[0]?.testFrequency || 100;
                      const testsCompleted = testHistory.length;
                      const expectedProduction = testsCompleted * threshold;
                      const currentProduction = productionData.currentCount;
                      const productsInCurrentCycle = Math.max(0, currentProduction - expectedProduction);
                      const progress = threshold > 0 ? Math.min(100, (productsInCurrentCycle / threshold) * 100) : 0;
                      return Math.max(5, progress);
                    })()}%` 
                  }}
                ></div>
              </div>
              
              {/* Informações detalhadas do progresso */}
              <div className="flex justify-between mt-2 text-xs text-gray-600">
                <span>Produzidos: {(() => {
                  const threshold = productionData.testThreshold || qualityConfigs[0]?.productsPerTest || qualityConfigs[0]?.testFrequency || 100;
                  const testsCompleted = testHistory.length;
                  const expectedProduction = testsCompleted * threshold;
                  return Math.max(0, productionData.currentCount - expectedProduction);
                })()}</span>
                <span>Meta: {productionData.testThreshold || qualityConfigs[0]?.productsPerTest || qualityConfigs[0]?.testFrequency || 100}</span>
              </div>
              
              {/* Indicadores de Zona */}
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-green-600">● Seguro (&gt;15)</span>
                <span className="text-yellow-600">● Atenção (6-15)</span>
                <span className="text-red-600">● Crítico (&le;5)</span>
              </div>
            </div>
          )}
        </div>

        {/* Cronômetro */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Tempo de Produção</p>
              <p className={`text-2xl font-mono font-bold transition-colors ${
                isRunning ? 'text-green-600' : 'text-purple-600'
              }`}>{formatTime(timer)}</p>
            </div>
            <Clock className={`w-12 h-12 transition-colors ${
              isRunning ? 'text-green-600 animate-pulse' : 'text-purple-600'
            }`} />
          </div>
          
          {/* Status e Métricas */}
          <div className="space-y-3">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isRunning 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              {isRunning ? 'Em Produção' : 'Parado'}
            </div>
            
            {/* Métricas de Produtividade */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">
                  {productionData.currentCount > 0 && (timer.hours * 3600 + timer.minutes * 60 + timer.seconds) > 0
                    ? Math.round(productionData.currentCount / ((timer.hours * 3600 + timer.minutes * 60 + timer.seconds) / 60))
                    : 0
                  }
                </div>
                <p className="text-xs text-gray-500">Peças/Min</p>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-indigo-600">
                  {productionData.currentCount > 0 && (timer.hours * 3600 + timer.minutes * 60 + timer.seconds) > 0
                    ? (((timer.hours * 3600 + timer.minutes * 60 + timer.seconds) / 60) / productionData.currentCount).toFixed(1)
                    : '0.0'
                  }
                </div>
                <p className="text-xs text-gray-500">Min/Peça</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status da Operação */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p className={`text-lg font-bold ${
                productionData.isLocked ? 'text-red-600' : 
                isRunning ? 'text-green-600' : 'text-gray-600'
              }`}>
                {productionData.isLocked ? 'Bloqueado' : isRunning ? 'Operando' : 'Parado'}
              </p>
            </div>
            {productionData.isLocked ? (
              <Lock className="w-12 h-12 text-red-600" />
            ) : (
              <CheckCircle className={`w-12 h-12 ${isRunning ? 'text-green-600' : 'text-gray-600'}`} />
            )}
          </div>
        </div>

        {/* Velocidade da Máquina */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <ProductionSpeedControl
            machineId={machineId}
            currentSpeed={machineSpeed.currentSpeed}
            targetSpeed={machineSpeed.targetSpeed}
            unit={machineSpeed.unit}
            onSpeedUpdate={handleSpeedUpdate}
            isRunning={isRunning}
          />
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Progresso até Próximo Teste</h2>
          {qualityConfigs.length > 0 && (
            <span className="text-sm text-gray-600">
              {(() => {
                const threshold = qualityConfigs[0]?.productsPerTest || qualityConfigs[0]?.testFrequency || productionData.testThreshold || 100;
                const remaining = productionData.productsUntilTest || 0;
                const progress = threshold > 0 ? ((threshold - remaining) / threshold) * 100 : 0;
                return Math.round(Math.max(0, Math.min(100, progress))) + '%';
              })()}
            </span>
          )}
        </div>
        {qualityConfigs.length > 0 ? (
          <>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div 
                className={`h-6 rounded-full transition-all duration-500 ${getProgressColor()}`}
                style={{ 
                  width: `${(() => {
                    const threshold = qualityConfigs[0]?.productsPerTest || qualityConfigs[0]?.testFrequency || productionData.testThreshold || 100;
                    const remaining = productionData.productsUntilTest || 0;
                    const progress = threshold > 0 ? ((threshold - remaining) / threshold) * 100 : 0;
                    return Math.max(0, Math.min(100, progress));
                  })()}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-2">
              <span>0</span>
              <span>{qualityConfigs[0]?.productsPerTest || qualityConfigs[0]?.testFrequency || productionData.testThreshold || 100}</span>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhuma configuração de teste ativa</p>
          </div>
        )}
      </div>

      {/* Botão de Teste */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="text-center">
          {productionData.isLocked ? (
            <div className="mb-4">
              <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-2" />
              <p className="text-red-600 font-semibold text-lg">Operação Bloqueada - Teste Obrigatório</p>
              <p className="text-gray-600">A produção foi interrompida. Registre o teste para continuar.</p>
            </div>
          ) : (
            <div className="mb-4">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-2" />
              <p className="text-green-600 font-semibold text-lg">Operação Normal</p>
              <p className="text-gray-600">Próximo teste em {productionData.productsUntilTest || 0} produtos</p>
            </div>
          )}
          
          <button
            onClick={() => setShowQualityTestModal(true)}
            className={`flex items-center space-x-2 px-8 py-4 rounded-lg font-semibold text-lg transition-colors ${
              productionData.isLocked || productionData.isOverdue
                ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <FileText className="w-6 h-6" />
            <span>
              {productionData.isOverdue ? 'TESTE OBRIGATÓRIO - ATRASADO' : 
               productionData.isLocked ? 'TESTE OBRIGATÓRIO' : 
               'Registrar Teste de Qualidade'}
            </span>
          </button>
        </div>
        {isBlocked && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
            <p className="text-red-700 text-sm font-medium">
              💡 <strong>Dica:</strong> Para continuar a operação, realize o teste de qualidade pendente.
            </p>
          </div>
        )}
      </div>

      {/* Histórico de Testes */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-green-600" />
            Histórico de Testes do Turno
          </h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Total: <span className="font-semibold">{testHistory.length}</span> testes
            </div>
            <div className="flex space-x-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
                <span className="text-xs text-gray-600">
                  {testHistory.filter(t => t.result === 'approved').length} Aprovados
                </span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
                <span className="text-xs text-gray-600">
                  {testHistory.filter(t => t.result === 'rejected').length} Reprovados
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {testHistory.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhum teste realizado neste turno</p>
            <p className="text-gray-400 text-sm mt-2">Os testes aparecerão aqui conforme forem registrados</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {testHistory.map((test, index) => (
              <motion.div 
                key={test.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                      test.result === 'approved' ? 'bg-green-100 text-green-800' :
                      test.result === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {test.result === 'approved' ? '✓ Aprovado' :
                       test.result === 'rejected' ? '✗ Reprovado' : '⏳ Pendente'}
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                      Teste #{testHistory.length - index}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">{new Date(test.timestamp).toLocaleTimeString()}</div>
                    <div className="text-xs text-gray-400">por {test.operator || 'Operador'}</div>
                  </div>
                </div>
                
                {test.observations && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-600 mb-1">Observações:</p>
                    <p className="text-gray-700 bg-gray-50 p-2 rounded text-sm">{test.observations}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <div className="flex space-x-4">
                    {test.photos && test.photos > 0 && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Camera className="w-4 h-4 mr-1" />
                        {test.photos} foto(s)
                      </div>
                    )}
                    {test.videos && test.videos > 0 && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Video className="w-4 h-4 mr-1" />
                        {test.videos} vídeo(s)
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    ID: {test.id || `TEST-${Date.now()}-${index}`}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Formulário de Teste */}
      <AnimatePresence>
        {showTestForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Registrar Teste de Qualidade</h2>
                  <button
                    onClick={() => setShowTestForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Resultado do Teste */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Resultado do Teste</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="approved"
                          checked={testForm.result === 'approved'}
                          onChange={(e) => setTestForm(prev => ({ ...prev, result: e.target.value }))}
                          className="mr-2"
                        />
                        <span className="text-green-600 font-semibold">Aprovado</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="rejected"
                          checked={testForm.result === 'rejected'}
                          onChange={(e) => setTestForm(prev => ({ ...prev, result: e.target.value }))}
                          className="mr-2"
                        />
                        <span className="text-red-600 font-semibold">Reprovado</span>
                      </label>
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                    <textarea
                      value={testForm.observations}
                      onChange={(e) => setTestForm(prev => ({ ...prev, observations: e.target.value }))}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Descreva os detalhes do teste..."
                    />
                  </div>

                  {/* Upload de Fotos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fotos</label>
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('photo-input').click()}
                    >
                      <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">Clique para adicionar fotos</p>
                      <p className="text-xs text-gray-500 mt-1">Formatos aceitos: JPG, PNG, GIF (máx. 5MB cada)</p>
                      <input
                        id="photo-input"
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          const validFiles = files.filter(file => {
                            if (file.size > 5 * 1024 * 1024) {
                              toast.error(`Arquivo ${file.name} é muito grande (máx. 5MB)`);
                              return false;
                            }
                            return true;
                          });
                          setTestForm(prev => ({ ...prev, photos: [...prev.photos, ...validFiles] }));
                        }}
                      />
                    </div>
                    {testForm.photos.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600 mb-2">{testForm.photos.length} foto(s) selecionada(s)</p>
                        <div className="grid grid-cols-3 gap-2">
                          {testForm.photos.map((photo, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={URL.createObjectURL(photo)}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-20 object-cover rounded border"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTestForm(prev => ({
                                    ...prev,
                                    photos: prev.photos.filter((_, i) => i !== index)
                                  }));
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Upload de Vídeos */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Vídeos</label>
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('video-input').click()}
                    >
                      <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600">Clique para adicionar vídeos</p>
                      <p className="text-xs text-gray-500 mt-1">Formatos aceitos: MP4, AVI, MOV (máx. 50MB cada)</p>
                      <input
                        id="video-input"
                        type="file"
                        multiple
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files);
                          const validFiles = files.filter(file => {
                            if (file.size > 50 * 1024 * 1024) {
                              toast.error(`Arquivo ${file.name} é muito grande (máx. 50MB)`);
                              return false;
                            }
                            return true;
                          });
                          setTestForm(prev => ({ ...prev, videos: [...prev.videos, ...validFiles] }));
                        }}
                      />
                    </div>
                    {testForm.videos.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600 mb-2">{testForm.videos.length} vídeo(s) selecionado(s)</p>
                        <div className="space-y-2">
                          {testForm.videos.map((video, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded border">
                              <div className="flex items-center">
                                <Video className="w-5 h-5 text-gray-500 mr-2" />
                                <div>
                                  <p className="text-sm font-medium text-gray-700">{video.name}</p>
                                  <p className="text-xs text-gray-500">{(video.size / (1024 * 1024)).toFixed(1)} MB</p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setTestForm(prev => ({
                                    ...prev,
                                    videos: prev.videos.filter((_, i) => i !== index)
                                  }));
                                }}
                                className="text-red-500 hover:text-red-700 transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-4 mt-8">
                  <button
                    onClick={() => {
                      setShowTestForm(false);
                      setTestForm({
                        photos: [],
                        videos: [],
                        observations: '',
                        result: 'approved'
                      });
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submitTest}
                    disabled={!testForm.observations.trim()}
                    className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                      testForm.observations.trim()
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Registrar Teste
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Modal de Teste de Qualidade */}
      <QualityTestModal
        isOpen={showQualityTestModal}
        onClose={() => setShowQualityTestModal(false)}
        machineId={machineId}
        onSuccess={() => {
          setShowQualityTestModal(false);
          toast.success('Teste de qualidade registrado com sucesso!');
          // Recarregar dados da produção
          fetchProductionData();
          loadTestHistory();
        }}
      />
    </div>
  );
};

export default ProductionOperationPage;