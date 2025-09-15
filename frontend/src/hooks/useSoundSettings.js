import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook para gerenciar configurações de som das notificações
 */
export const useSoundSettings = () => {
  const { user } = useAuth();
  const [soundSettings, setSoundSettings] = useState({
    enabled: true,
    volume: 0.5,
    priorityLevels: {
      LOW: false,
      MEDIUM: true,
      HIGH: true,
      URGENT: true
    },
    soundThemes: {
      LOW: 'soft',
      MEDIUM: 'normal', 
      HIGH: 'alert',
      URGENT: 'critical'
    }
  });
  const [loading, setLoading] = useState(true);

  // Carregar configurações do localStorage ou API
  const loadSoundSettings = useCallback(async () => {
    try {
      setLoading(true);
      
      // Primeiro, tentar carregar do localStorage
      const localSettings = localStorage.getItem(`soundSettings_${user?.id}`);
      if (localSettings) {
        const parsed = JSON.parse(localSettings);
        setSoundSettings(prev => ({ ...prev, ...parsed }));
      }
      
      // Se houver usuário logado, carregar da API
      if (user?.id) {
        try {
          const response = await fetch('/api/users/sound-settings', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (response.ok) {
            const apiSettings = await response.json();
            setSoundSettings(prev => ({ ...prev, ...apiSettings.data }));
            
            // Salvar no localStorage
            localStorage.setItem(`soundSettings_${user.id}`, JSON.stringify(apiSettings.data));
          }
        } catch (apiError) {
          console.warn('Erro ao carregar configurações de som da API:', apiError);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de som:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Salvar configurações
  const saveSoundSettings = useCallback(async (newSettings) => {
    try {
      const updatedSettings = { ...soundSettings, ...newSettings };
      setSoundSettings(updatedSettings);
      
      // Salvar no localStorage
      if (user?.id) {
        localStorage.setItem(`soundSettings_${user.id}`, JSON.stringify(updatedSettings));
        
        // Salvar na API
        try {
          await fetch('/api/users/sound-settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(updatedSettings)
          });
        } catch (apiError) {
          console.warn('Erro ao salvar configurações de som na API:', apiError);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao salvar configurações de som:', error);
      return false;
    }
  }, [soundSettings, user?.id]);

  // Verificar se deve reproduzir som para uma prioridade específica
  const shouldPlaySound = useCallback((priority) => {
    if (!soundSettings.enabled) return false;
    return soundSettings.priorityLevels[priority] || false;
  }, [soundSettings]);

  // Obter arquivo de som baseado na prioridade e tema
  const getSoundFile = useCallback((priority) => {
    const theme = soundSettings.soundThemes[priority] || 'normal';
    
    const soundMap = {
      soft: '/sounds/info.mp3',
      normal: '/sounds/info.mp3',
      alert: '/sounds/warning.mp3',
      critical: '/sounds/critical.mp3'
    };
    
    return soundMap[theme] || '/sounds/info.mp3';
  }, [soundSettings]);

  // Reproduzir som de teste
  const playTestSound = useCallback((priority = 'MEDIUM') => {
    if (!shouldPlaySound(priority)) return;
    
    try {
      const soundFile = getSoundFile(priority);
      const audio = new Audio(soundFile);
      audio.volume = soundSettings.volume;
      audio.play().catch(console.error);
    } catch (error) {
      console.error('Erro ao reproduzir som de teste:', error);
    }
  }, [shouldPlaySound, getSoundFile, soundSettings.volume]);

  // Reproduzir som de notificação
  const playNotificationSound = useCallback((priority = 'MEDIUM') => {
    if (!shouldPlaySound(priority)) return;
    
    try {
      const soundFile = getSoundFile(priority);
      const audio = new Audio(soundFile);
      audio.volume = soundSettings.volume;
      
      // Ajustar volume baseado na prioridade
      if (priority === 'URGENT') {
        audio.volume = Math.min(soundSettings.volume * 1.2, 1.0);
      } else if (priority === 'LOW') {
        audio.volume = soundSettings.volume * 0.7;
      }
      
      audio.play().catch(console.error);
    } catch (error) {
      console.error('Erro ao reproduzir som de notificação:', error);
    }
  }, [shouldPlaySound, getSoundFile, soundSettings.volume]);

  // Alternar som geral
  const toggleSound = useCallback(() => {
    saveSoundSettings({ enabled: !soundSettings.enabled });
  }, [soundSettings.enabled, saveSoundSettings]);

  // Alterar volume
  const setVolume = useCallback((volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    saveSoundSettings({ volume: clampedVolume });
  }, [saveSoundSettings]);

  // Alternar som para prioridade específica
  const togglePrioritySound = useCallback((priority) => {
    const newPriorityLevels = {
      ...soundSettings.priorityLevels,
      [priority]: !soundSettings.priorityLevels[priority]
    };
    saveSoundSettings({ priorityLevels: newPriorityLevels });
  }, [soundSettings.priorityLevels, saveSoundSettings]);

  // Alterar tema de som para prioridade
  const setSoundTheme = useCallback((priority, theme) => {
    const newSoundThemes = {
      ...soundSettings.soundThemes,
      [priority]: theme
    };
    saveSoundSettings({ soundThemes: newSoundThemes });
  }, [soundSettings.soundThemes, saveSoundSettings]);

  // Carregar configurações quando o componente monta ou usuário muda
  useEffect(() => {
    loadSoundSettings();
  }, [loadSoundSettings]);

  return {
    soundSettings,
    loading,
    shouldPlaySound,
    getSoundFile,
    playTestSound,
    playNotificationSound,
    toggleSound,
    setVolume,
    togglePrioritySound,
    setSoundTheme,
    saveSoundSettings,
    loadSoundSettings
  };
};

export default useSoundSettings;