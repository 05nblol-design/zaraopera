import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'blue', 
  text = null, 
  className = '',
  fullScreen = false 
}) => {
  const sizeClasses = {
    xs: 'h-4 w-4',
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const colorClasses = {
    blue: 'border-blue-600',
    gray: 'border-gray-600',
    green: 'border-green-600',
    red: 'border-red-600',
    yellow: 'border-yellow-600',
    purple: 'border-purple-600',
    indigo: 'border-indigo-600'
  };

  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  const spinnerClasses = `
    ${sizeClasses[size]} 
    ${colorClasses[color]} 
    border-2 border-t-transparent 
    rounded-full 
    animate-spin
    ${className}
  `;

  const containerClasses = fullScreen 
    ? 'fixed inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50'
    : 'flex items-center justify-center';

  const Spinner = () => (
    <motion.div
      className={spinnerClasses}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    />
  );

  const content = (
    <div className={`flex flex-col items-center gap-3 ${fullScreen ? 'p-8' : ''}`}>
      <Spinner />
      {text && (
        <motion.p 
          className={`text-gray-600 dark:text-gray-400 ${textSizeClasses[size]} font-medium`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );

  return (
    <div className={containerClasses}>
      {content}
    </div>
  );
};

// Componente de loading para páginas inteiras
export const PageLoader = ({ text = 'Carregando...' }) => (
  <LoadingSpinner 
    size="lg" 
    text={text} 
    fullScreen 
    className="border-blue-600" 
  />
);

// Componente de loading para botões
export const ButtonLoader = ({ size = 'sm', className = '' }) => (
  <LoadingSpinner 
    size={size} 
    className={`border-white ${className}`}
  />
);

// Componente de loading para cards/seções
export const SectionLoader = ({ text = 'Carregando dados...', size = 'md' }) => (
  <div className="flex items-center justify-center py-12">
    <LoadingSpinner size={size} text={text} />
  </div>
);

// Componente de loading inline
export const InlineLoader = ({ size = 'xs', className = '' }) => (
  <LoadingSpinner 
    size={size} 
    className={`inline-block ${className}`}
  />
);

// Skeleton loader para listas
export const SkeletonLoader = ({ lines = 3, className = '' }) => (
  <div className={`animate-pulse space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <div key={index} className="flex space-x-3">
        <div className="rounded-full bg-gray-300 dark:bg-gray-600 h-10 w-10"></div>
        <div className="flex-1 space-y-2 py-1">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
        </div>
      </div>
    ))}
  </div>
);

// Skeleton para cards
export const CardSkeleton = ({ className = '' }) => (
  <div className={`animate-pulse ${className}`}>
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="rounded-full bg-gray-300 dark:bg-gray-600 h-12 w-12"></div>
        <div className="flex-1">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-4/6"></div>
      </div>
    </div>
  </div>
);

export default LoadingSpinner;