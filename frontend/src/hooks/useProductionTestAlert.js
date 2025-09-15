import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from './useAuth';

// Helper para obter URL da API - prioriza ngrok se configurado
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.includes('ngrok')) {
    return import.meta.env.VITE_API_URL;
  }
  return import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3001/api';
};

const useProductionTestAlert = (machineId, isOperating = false) => {
  const { user } = useAuth();
  const [alertData, setAlertData] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef(null);
  const lastAlertRef = useRef(null);

  // Verificar status de produção e alertas
  const checkProductionAlert = useCallback(async () => {
    if (isChecking || !machineId || !isOperating) {
      return;
    }

    setIsChecking(true);
    
    try {
      const token = localStorage.getItem('token');
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/machines/${machineId}/production-alert-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Verificar se o usuário atual é o operador da máquina
        const isCurrentOperator = data.currentOperator && user && data.currentOperator.id === user.id;
        
        // Só mostrar alerta se há alertas pendentes E o usuário é o operador atual
        if (data.requiresTest && data.configs && data.configs.length > 0 && isCurrentOperator) {
          const config = data.configs[0]; // Pegar primeira configuração pendente
          
          // Evitar mostrar o mesmo alerta repetidamente
          const alertKey = `${machineId}-${config.configId}-${config.productionCount}`;
          if (lastAlertRef.current !== alertKey) {
            setAlertData({
              machineId: data.machineId,
              machineName: data.machineName,
              machineLocation: data.machineLocation,
              productionCount: config.productionCount,
              productsPerTest: config.productsPerTest,
              configId: config.configId,
              testName: config.testName,
              exceedBy: config.productionCount - config.productsPerTest,
              severity: config.productionCount >= config.productsPerTest ? 'high' : 'medium'
            });
            
            setShowPopup(true);
            lastAlertRef.current = alertKey;
            
            // Tocar som de alerta (opcional)
            if (window.Audio) {
              try {
                const audio = new Audio('/sounds/alert.mp3');
                audio.volume = 0.3;
                audio.play().catch(() => {});
              } catch (error) {
                // Ignorar erro de áudio
              }
            }
          }
        } else {
          // Limpar alerta se não há mais necessidade
          if (showPopup) {
            setShowPopup(false);
            setAlertData(null);
            lastAlertRef.current = null;
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar alertas de produção:', error);
    } finally {
      setIsChecking(false);
    }
  }, [machineId, isOperating, showPopup]);

  // Configurar verificação automática
  useEffect(() => {
    if (machineId && isOperating) {
      // Verificação inicial
      checkProductionAlert();
      
      // Configurar intervalo de verificação (a cada 30 segundos)
      intervalRef.current = setInterval(checkProductionAlert, 30000);
    } else {
      // Limpar intervalo se máquina não está operando
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Limpar alertas
      setShowPopup(false);
      setAlertData(null);
      lastAlertRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [machineId, isOperating, checkProductionAlert]);

  // Função para fechar popup
  const closePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  // Função para adiar alerta
  const postponeAlert = useCallback(() => {
    setShowPopup(false);
    
    // Reagendar verificação em 15 minutos
    setTimeout(() => {
      if (machineId && isOperating) {
        checkProductionAlert();
      }
    }, 15 * 60 * 1000); // 15 minutos
    
    toast.success('Alerta adiado por 15 minutos');
  }, [machineId, isOperating, checkProductionAlert]);

  // Função para iniciar teste
  const startTest = useCallback(async (testData) => {
    try {
      if (!testData) {
        toast.error('Dados do alerta não disponíveis');
        return;
      }
      
      // Iniciar teste diretamente via API
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/quality-tests/start-from-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          machineId: testData.machineId,
          configId: testData.configId,
          product: testData.testName || 'Produto padrão',
          notes: `Teste iniciado automaticamente - ${testData.productionCount}/${testData.productsPerTest} produtos produzidos`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Teste de qualidade iniciado com sucesso!');
        
        // Fechar o popup
        setShowPopup(false);
        
        // Redirecionar para a página de edição do teste
        setTimeout(() => {
          window.location.href = data.data.redirectUrl;
        }, 1000);
        
      } else {
        throw new Error(data.message || 'Erro ao iniciar teste');
      }
      
    } catch (error) {
      console.error('Erro ao iniciar teste:', error);
      toast.error(error.message || 'Erro ao iniciar teste de qualidade');
      throw error;
    }
  }, []);

  // Função para verificação manual
  const manualCheck = useCallback(() => {
    checkProductionAlert();
  }, [checkProductionAlert]);

  return {
    alertData,
    showPopup,
    isChecking,
    closePopup,
    postponeAlert,
    startTest,
    manualCheck
  };
};

export default useProductionTestAlert;