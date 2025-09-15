import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { machineService } from '../services/api';

/**
 * Hook para gerenciar popups de produção baseados em popupThreshold
 * Este é o sistema correto que usa production_popups, não o antigo ProductionTestPopup
 */
export const useProductionPopups = (machineId) => {
  const [popups, setPopups] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentPopup, setCurrentPopup] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const intervalRef = useRef(null);
  const lastPopupRef = useRef(null);

  const checkProductionPopups = useCallback(async () => {
    if (!machineId || !user) return;
    
    try {
      setLoading(true);
      const response = await machineService.getProductionPopups(machineId);
      
      if (response.data && response.data.popups && response.data.popups.length > 0) {
        const activePopups = response.data.popups.filter(popup => popup.is_active);
        setPopups(activePopups);
        
        // Mostrar o popup mais recente se houver
        if (activePopups.length > 0) {
          const latestPopup = activePopups[0]; // Assumindo que vem ordenado por data
          
          // Evitar mostrar o mesmo popup repetidamente
          const popupKey = `${machineId}-${latestPopup.id}-${latestPopup.production_count}`;
          if (lastPopupRef.current !== popupKey) {
            setCurrentPopup({
              id: latestPopup.id,
              machineId: machineId,
              productionCount: latestPopup.production_count,
              threshold: latestPopup.threshold,
              message: latestPopup.message,
              createdAt: latestPopup.created_at
            });
            
            setShowPopup(true);
            lastPopupRef.current = popupKey;
            
            // Tocar som de alerta
            if (window.Audio) {
              try {
                const audio = new Audio('/sounds/alert.mp3');
                audio.volume = 0.5;
                audio.play().catch(e => console.log('Não foi possível tocar o som:', e));
              } catch (error) {
                console.log('Erro ao tocar som de alerta:', error);
              }
            }
          }
        } else {
          setShowPopup(false);
          setCurrentPopup(null);
        }
      } else {
        setPopups([]);
        setShowPopup(false);
        setCurrentPopup(null);
      }
    } catch (error) {
      console.error('Erro ao verificar popups de produção:', error);
      setPopups([]);
      setShowPopup(false);
      setCurrentPopup(null);
    } finally {
      setLoading(false);
    }
  }, [machineId, user]);

  const acknowledgePopup = useCallback(async (popupId) => {
    if (!machineId || !popupId) return;
    
    try {
      await machineService.acknowledgePopup(machineId, popupId);
      
      // Atualizar estado local
      setPopups(prev => prev.filter(popup => popup.id !== popupId));
      
      if (currentPopup && currentPopup.id === popupId) {
        setShowPopup(false);
        setCurrentPopup(null);
      }
      
      // Verificar se há outros popups
      await checkProductionPopups();
    } catch (error) {
      console.error('Erro ao confirmar popup:', error);
    }
  }, [machineId, currentPopup, checkProductionPopups]);

  const closePopup = useCallback(() => {
    setShowPopup(false);
    // Não limpar currentPopup para permitir reabrir se necessário
  }, []);

  // Verificar popups periodicamente
  useEffect(() => {
    if (machineId && user) {
      // Verificação inicial
      checkProductionPopups();
      
      // Verificação periódica a cada 30 segundos
      intervalRef.current = setInterval(checkProductionPopups, 30000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [machineId, user, checkProductionPopups]);

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    popups,
    showPopup,
    currentPopup,
    loading,
    checkProductionPopups,
    acknowledgePopup,
    closePopup
  };
};

export default useProductionPopups;