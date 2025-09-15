import React, { useState } from 'react';
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PlayIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { useSoundSettings } from '@/hooks/useSoundSettings';
import { cn } from '@/lib/utils';

const SoundSettings = () => {
  const {
    soundSettings,
    loading,
    toggleSound,
    setVolume,
    togglePrioritySound,
    setSoundTheme,
    playTestSound
  } = useSoundSettings();
  
  const [testingPriority, setTestingPriority] = useState(null);

  const priorities = [
    { key: 'LOW', label: 'Baixa', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    { key: 'MEDIUM', label: 'Média', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { key: 'HIGH', label: 'Alta', color: 'text-orange-600', bgColor: 'bg-orange-100' },
    { key: 'URGENT', label: 'Urgente', color: 'text-red-600', bgColor: 'bg-red-100' }
  ];

  const soundThemes = [
    { key: 'soft', label: 'Suave', description: 'Som discreto e suave' },
    { key: 'normal', label: 'Normal', description: 'Som padrão do sistema' },
    { key: 'alert', label: 'Alerta', description: 'Som de atenção moderado' },
    { key: 'critical', label: 'Crítico', description: 'Som de alerta intenso' }
  ];

  const handleTestSound = async (priority) => {
    setTestingPriority(priority);
    playTestSound(priority);
    
    // Reset após 1 segundo
    setTimeout(() => {
      setTestingPriority(null);
    }, 1000);
  };

  const handleVolumeChange = (e) => {
    const volume = parseFloat(e.target.value);
    setVolume(volume);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
          <SpeakerWaveIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Configurações de Som
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Personalize os sons das notificações
          </p>
        </div>
      </div>

      {/* Controle Geral */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {soundSettings.enabled ? (
              <SpeakerWaveIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <SpeakerXMarkIcon className="h-5 w-5 text-gray-400" />
            )}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Sons de Notificação
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {soundSettings.enabled ? 'Ativado' : 'Desativado'}
              </p>
            </div>
          </div>
          
          <button
            onClick={toggleSound}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              soundSettings.enabled
                ? 'bg-blue-600'
                : 'bg-gray-200 dark:bg-gray-600'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                soundSettings.enabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        {/* Controle de Volume */}
        {soundSettings.enabled && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Volume: {Math.round(soundSettings.volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={soundSettings.volume}
              onChange={handleVolumeChange}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        )}
      </div>

      {/* Configurações por Prioridade */}
      {soundSettings.enabled && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
            Sons por Prioridade
          </h4>
          
          <div className="space-y-4">
            {priorities.map((priority) => (
              <div key={priority.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    priority.bgColor,
                    priority.color
                  )}>
                    {priority.label}
                  </span>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => togglePrioritySound(priority.key)}
                      className={cn(
                        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                        soundSettings.priorityLevels[priority.key]
                          ? 'bg-blue-600'
                          : 'bg-gray-200 dark:bg-gray-600'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                          soundSettings.priorityLevels[priority.key] ? 'translate-x-5' : 'translate-x-1'
                        )}
                      />
                    </button>
                    
                    {soundSettings.priorityLevels[priority.key] && (
                      <select
                        value={soundSettings.soundThemes[priority.key]}
                        onChange={(e) => setSoundTheme(priority.key, e.target.value)}
                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        {soundThemes.map((theme) => (
                          <option key={theme.key} value={theme.key}>
                            {theme.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                
                {soundSettings.priorityLevels[priority.key] && (
                  <button
                    onClick={() => handleTestSound(priority.key)}
                    disabled={testingPriority === priority.key}
                    className={cn(
                      'inline-flex items-center px-2 py-1 text-xs font-medium rounded transition-colors',
                      testingPriority === priority.key
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40'
                    )}
                  >
                    <PlayIcon className="h-3 w-3 mr-1" />
                    {testingPriority === priority.key ? 'Tocando...' : 'Testar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Informações sobre os Temas */}
      {soundSettings.enabled && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Cog6ToothIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div>
              <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Sobre os Temas de Som
              </h5>
              <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                {soundThemes.map((theme) => (
                  <div key={theme.key}>
                    <strong>{theme.label}:</strong> {theme.description}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoundSettings;