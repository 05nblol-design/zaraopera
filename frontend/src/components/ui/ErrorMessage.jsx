import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const ErrorMessage = ({ 
  message = 'Ocorreu um erro inesperado', 
  onRetry = null,
  className = '',
  variant = 'default' // 'default', 'compact', 'inline'
}) => {
  const baseClasses = {
    default: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4',
    compact: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3',
    inline: 'text-red-600 dark:text-red-400 text-sm'
  };

  const iconClasses = {
    default: 'h-5 w-5 text-red-400 dark:text-red-500',
    compact: 'h-4 w-4 text-red-400 dark:text-red-500',
    inline: 'h-4 w-4 text-red-400 dark:text-red-500 inline mr-1'
  };

  const textClasses = {
    default: 'text-red-800 dark:text-red-200',
    compact: 'text-red-700 dark:text-red-300 text-sm',
    inline: 'text-red-600 dark:text-red-400'
  };

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <ExclamationTriangleIcon className={iconClasses[variant]} />
        <span className={textClasses[variant]}>{message}</span>
      </span>
    );
  }

  return (
    <div className={`${baseClasses[variant]} ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className={iconClasses[variant]} />
        </div>
        <div className="ml-3 flex-1">
          <p className={textClasses[variant]}>
            {message}
          </p>
          {onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className="bg-red-100 dark:bg-red-800/30 hover:bg-red-200 dark:hover:bg-red-800/50 text-red-800 dark:text-red-200 px-3 py-1 rounded text-sm font-medium transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;