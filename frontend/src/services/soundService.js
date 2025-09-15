/**
 * Sound Service - Sistema de notificações sonoras
 * Gerencia reprodução de sons para diferentes tipos de alertas
 */

class SoundService {
  constructor() {
    this.sounds = new Map();
    this.isEnabled = true;
    this.volume = 0.5;
    this.loadSounds();
    
    // Verificar se áudio está disponível
    this.audioSupported = typeof Audio !== 'undefined';
    
    if (!this.audioSupported) {
      console.warn('🔇 Audio não suportado neste navegador');
    }
  }

  /**
   * Carrega os sons do sistema
   */
  loadSounds() {
    const soundFiles = {
      // Alertas críticos
      critical: {
        url: '/sounds/priority-high.mp3',
        volume: 0.8
      },
      // Alertas de qualidade
      quality: {
        url: '/sounds/warning.mp3',
        volume: 0.6
      },
      // Alertas de manutenção
      maintenance: {
        url: '/sounds/priority-medium.mp3',
        volume: 0.5
      },
      // Notificações gerais
      notification: {
        url: '/sounds/info.mp3',
        volume: 0.4
      },
      // Som de sucesso
      success: {
        url: '/sounds/success.mp3',
        volume: 0.3
      }
    };

    // Carregar cada som
    Object.entries(soundFiles).forEach(([key, config]) => {
      if (this.audioSupported) {
        try {
          const audio = new Audio(config.url);
          audio.volume = config.volume * this.volume;
          audio.preload = 'auto';
          this.sounds.set(key, audio);
        } catch (error) {
          console.warn(`🔇 Erro ao carregar som ${key}:`, error);
        }
      }
    });
  }

  /**
   * Reproduz um som específico
   * @param {string} soundType - Tipo do som (critical, quality, maintenance, notification, success)
   * @param {Object} options - Opções adicionais
   */
  async playSound(soundType, options = {}) {
    if (!this.isEnabled || !this.audioSupported) {
      return;
    }

    const sound = this.sounds.get(soundType);
    if (!sound) {
      console.warn(`🔇 Som '${soundType}' não encontrado`);
      return;
    }

    try {
      // Resetar o som para permitir reprodução múltipla
      sound.currentTime = 0;
      
      // Aplicar volume personalizado se fornecido
      if (options.volume !== undefined) {
        sound.volume = Math.min(1, Math.max(0, options.volume));
      }

      // Reproduzir o som
      await sound.play();
      
      console.log(`🔊 Som '${soundType}' reproduzido`);
    } catch (error) {
      console.warn(`🔇 Erro ao reproduzir som '${soundType}':`, error);
    }
  }

  /**
   * Reproduz som para alerta crítico
   */
  async playCriticalAlert() {
    await this.playSound('critical');
  }

  /**
   * Reproduz som para alerta de qualidade
   */
  async playQualityAlert() {
    await this.playSound('quality');
  }

  /**
   * Reproduz som para alerta de manutenção
   */
  async playMaintenanceAlert() {
    await this.playSound('maintenance');
  }

  /**
   * Reproduz som para notificação geral
   */
  async playNotification() {
    await this.playSound('notification');
  }

  /**
   * Reproduz som de sucesso
   */
  async playSuccess() {
    await this.playSound('success');
  }

  /**
   * Reproduz som baseado no tipo de alerta
   * @param {string} alertType - Tipo do alerta
   * @param {string} priority - Prioridade do alerta (high, medium, low)
   */
  async playAlertByType(alertType, priority = 'medium') {
    const soundMap = {
      'quality': 'quality',
      'maintenance': 'maintenance',
      'production': priority === 'high' ? 'critical' : 'notification',
      'system': 'notification',
      'error': 'critical',
      'warning': 'maintenance',
      'info': 'notification',
      'success': 'success'
    };

    const soundType = soundMap[alertType] || 'notification';
    await this.playSound(soundType);
  }

  /**
   * Reproduz sequência de sons para alertas críticos
   */
  async playCriticalSequence() {
    if (!this.isEnabled || !this.audioSupported) {
      return;
    }

    try {
      // Reproduzir 3 vezes com intervalo
      for (let i = 0; i < 3; i++) {
        await this.playSound('critical');
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.warn('🔇 Erro ao reproduzir sequência crítica:', error);
    }
  }

  /**
   * Habilita/desabilita sons
   * @param {boolean} enabled - Se os sons devem estar habilitados
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`🔊 Sons ${enabled ? 'habilitados' : 'desabilitados'}`);
  }

  /**
   * Define o volume geral
   * @param {number} volume - Volume de 0 a 1
   */
  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume));
    
    // Atualizar volume de todos os sons carregados
    this.sounds.forEach((sound, key) => {
      const soundConfig = {
        critical: 0.8,
        quality: 0.6,
        maintenance: 0.5,
        notification: 0.4,
        success: 0.3
      };
      
      sound.volume = (soundConfig[key] || 0.5) * this.volume;
    });
    
    console.log(`🔊 Volume definido para ${Math.round(this.volume * 100)}%`);
  }

  /**
   * Verifica se os sons estão habilitados
   */
  isAudioEnabled() {
    return this.isEnabled && this.audioSupported;
  }

  /**
   * Obtém configurações atuais
   */
  getSettings() {
    return {
      enabled: this.isEnabled,
      volume: this.volume,
      supported: this.audioSupported,
      soundsLoaded: this.sounds.size
    };
  }

  /**
   * Testa todos os sons
   */
  async testAllSounds() {
    if (!this.isEnabled || !this.audioSupported) {
      console.warn('🔇 Sons desabilitados ou não suportados');
      return;
    }

    const soundTypes = ['notification', 'success', 'maintenance', 'quality', 'critical'];
    
    for (const soundType of soundTypes) {
      console.log(`🔊 Testando som: ${soundType}`);
      await this.playSound(soundType);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Criar instância singleton
const soundService = new SoundService();

// Carregar configurações do localStorage
const savedSettings = localStorage.getItem('soundSettings');
if (savedSettings) {
  try {
    const settings = JSON.parse(savedSettings);
    soundService.setEnabled(settings.enabled !== false);
    soundService.setVolume(settings.volume || 0.5);
  } catch (error) {
    console.warn('🔇 Erro ao carregar configurações de som:', error);
  }
}

// Salvar configurações quando alteradas
const originalSetEnabled = soundService.setEnabled.bind(soundService);
const originalSetVolume = soundService.setVolume.bind(soundService);

soundService.setEnabled = function(enabled) {
  originalSetEnabled(enabled);
  this.saveSettings();
};

soundService.setVolume = function(volume) {
  originalSetVolume(volume);
  this.saveSettings();
};

soundService.saveSettings = function() {
  const settings = {
    enabled: this.isEnabled,
    volume: this.volume
  };
  localStorage.setItem('soundSettings', JSON.stringify(settings));
};

export default soundService;