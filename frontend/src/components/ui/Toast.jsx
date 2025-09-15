import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/outline';

const Toast = ({ 
  id,
  type = 'info', 
  priority = 'info', 
  title, 
  message, 
  duration = 5000, 
  onClose,
  showSound = true,
  actionButton = null
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [progress, setProgress] = useState(100);

  // Configurações por prioridade
  const priorityConfig = {
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-500',
      progressColor: 'bg-blue-500',
      icon: InformationCircleIcon,
      sound: '/sounds/info.mp3'
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-500',
      progressColor: 'bg-yellow-500',
      icon: ExclamationTriangleIcon,
      sound: '/sounds/warning.mp3'
    },
    critical: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-500',
      progressColor: 'bg-red-500',
      icon: XCircleIcon,
      sound: '/sounds/critical.mp3'
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
      iconColor: 'text-green-500',
      progressColor: 'bg-green-500',
      icon: CheckCircleIcon,
      sound: '/sounds/success.mp3'
    }
  };

  const config = priorityConfig[priority] || priorityConfig.info;
  const IconComponent = config.icon;

  // Configuração de sons por prioridade
  const soundFiles = {
    LOW: '/sounds/info.mp3',
    MEDIUM: '/sounds/info.mp3', 
    HIGH: '/sounds/warning.mp3',
    URGENT: '/sounds/critical.mp3',
    // Tipos específicos
    info: '/sounds/info.mp3',
    warning: '/sounds/warning.mp3',
    critical: '/sounds/critical.mp3',
    success: '/sounds/success.mp3'
  };

  // Reproduzir som
  const playSound = () => {
    if (soundEnabled && showSound) {
      try {
        const soundFile = soundFiles[priority] || config.sound;
        const audio = new Audio(soundFile);
        audio.volume = priority === 'critical' ? 0.8 : 0.5;
        audio.play().catch(console.error);
      } catch (error) {
        console.error('Erro ao reproduzir som:', error);
      }
    }
  };

  // Fechar toast
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  // Auto close
  useEffect(() => {
    setIsVisible(true);
    playSound();

    if (duration > 0) {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (duration / 100));
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 100);

      const closeTimer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => {
        clearTimeout(closeTimer);
        clearInterval(progressInterval);
      };
    }
  }, []);

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        max-w-sm w-full ${config.bgColor} ${config.borderColor} border-l-4 rounded-lg shadow-lg overflow-hidden
      `}
    >
      {/* Barra de progresso */}
      {duration > 0 && (
        <div className="h-1 bg-gray-200">
          <div 
            className={`h-full ${config.progressColor} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start">
          {/* Ícone */}
          <div className="flex-shrink-0">
            <IconComponent className={`h-6 w-6 ${config.iconColor}`} />
          </div>

          {/* Conteúdo */}
          <div className="ml-3 flex-1">
            {title && (
              <h4 className={`text-sm font-semibold ${config.textColor} mb-1`}>
                {title}
              </h4>
            )}
            <p className={`text-sm ${config.textColor} opacity-90`}>
              {message}
            </p>

            {/* Botão de ação */}
            {actionButton && (
              <div className="mt-3">
                {actionButton}
              </div>
            )}
          </div>

          {/* Controles */}
          <div className="flex items-center space-x-2 ml-3">
            {/* Toggle de som */}
            {showSound && (
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-1 rounded hover:bg-gray-200 transition-colors ${config.textColor} opacity-60 hover:opacity-100`}
                title={soundEnabled ? 'Desativar som' : 'Ativar som'}
              >
                {soundEnabled ? (
                  <SpeakerWaveIcon className="h-4 w-4" />
                ) : (
                  <SpeakerXMarkIcon className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Botão fechar */}
            <button
              onClick={handleClose}
              className={`p-1 rounded hover:bg-gray-200 transition-colors ${config.textColor} opacity-60 hover:opacity-100`}
              title="Fechar"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;