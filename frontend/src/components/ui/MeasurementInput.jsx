import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ScaleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

const MeasurementInput = ({ 
  measurements = {}, 
  onMeasurementChange,
  specifications = {},
  className 
}) => {
  const [validationResults, setValidationResults] = useState({});
  const [showTolerances, setShowTolerances] = useState(false);

  // Configurações de medição
  const measurementConfig = [
    {
      key: 'thickness',
      label: 'Espessura',
      unit: 'mm',
      icon: ScaleIcon,
      step: 0.01,
      placeholder: '0.00',
      description: 'Espessura do material'
    },
    {
      key: 'width',
      label: 'Largura',
      unit: 'mm',
      icon: ScaleIcon,
      step: 0.01,
      placeholder: '0.00',
      description: 'Largura da peça'
    },
    {
      key: 'length',
      label: 'Comprimento',
      unit: 'mm',
      icon: ScaleIcon,
      step: 0.01,
      placeholder: '0.00',
      description: 'Comprimento da peça'
    },
    {
      key: 'weight',
      label: 'Peso',
      unit: 'g',
      icon: ScaleIcon,
      step: 0.1,
      placeholder: '0.0',
      description: 'Peso total da peça'
    },
    {
      key: 'diameter',
      label: 'Diâmetro',
      unit: 'mm',
      icon: ScaleIcon,
      step: 0.01,
      placeholder: '0.00',
      description: 'Diâmetro (se aplicável)'
    },
    {
      key: 'height',
      label: 'Altura',
      unit: 'mm',
      icon: ScaleIcon,
      step: 0.01,
      placeholder: '0.00',
      description: 'Altura da peça'
    }
  ];

  // Validar medições contra especificações
  useEffect(() => {
    const results = {};
    
    measurementConfig.forEach(config => {
      const value = parseFloat(measurements[config.key] || 0);
      const spec = specifications[config.key];
      
      if (spec && value > 0) {
        const { min, max, target, tolerance } = spec;
        
        let status = 'valid';
        let message = 'Dentro da especificação';
        
        if (min !== undefined && value < min) {
          status = 'invalid';
          message = `Abaixo do mínimo (${min}${config.unit})`;
        } else if (max !== undefined && value > max) {
          status = 'invalid';
          message = `Acima do máximo (${max}${config.unit})`;
        } else if (target !== undefined && tolerance !== undefined) {
          const deviation = Math.abs(value - target);
          if (deviation > tolerance) {
            status = 'warning';
            message = `Fora da tolerância (±${tolerance}${config.unit})`;
          } else if (deviation > tolerance * 0.8) {
            status = 'warning';
            message = `Próximo do limite de tolerância`;
          }
        }
        
        results[config.key] = { status, message, value, spec };
      }
    });
    
    setValidationResults(results);
  }, [measurements, specifications]);

  const getValidationIcon = (status) => {
    switch (status) {
      case 'valid': return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'warning': return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
      case 'invalid': return <XCircleIcon className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getInputBorderColor = (key) => {
    const validation = validationResults[key];
    if (!validation) return 'border-gray-300 dark:border-gray-600';
    
    switch (validation.status) {
      case 'valid': return 'border-green-500 dark:border-green-400';
      case 'warning': return 'border-yellow-500 dark:border-yellow-400';
      case 'invalid': return 'border-red-500 dark:border-red-400';
      default: return 'border-gray-300 dark:border-gray-600';
    }
  };

  const formatSpecification = (spec) => {
    if (!spec) return null;
    
    const { min, max, target, tolerance } = spec;
    
    if (target !== undefined && tolerance !== undefined) {
      return `${target} ±${tolerance}`;
    } else if (min !== undefined && max !== undefined) {
      return `${min} - ${max}`;
    } else if (min !== undefined) {
      return `≥ ${min}`;
    } else if (max !== undefined) {
      return `≤ ${max}`;
    }
    
    return null;
  };

  const MeasurementField = ({ config }) => {
    const { key, label, unit, icon: Icon, step, placeholder, description } = config;
    const value = measurements[key] || '';
    const validation = validationResults[key];
    const spec = specifications[key];
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </label>
          
          {validation && (
            <div className="flex items-center space-x-1">
              {getValidationIcon(validation.status)}
            </div>
          )}
        </div>
        
        <div className="relative">
          <input
            type="number"
            step={step}
            value={value}
            onChange={(e) => onMeasurementChange(key, e.target.value)}
            className={cn(
              'w-full px-3 py-2 pr-12 border rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors',
              getInputBorderColor(key)
            )}
            placeholder={placeholder}
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
          </div>
        </div>
        
        {/* Especificação */}
        {spec && showTolerances && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Especificação:</span> {formatSpecification(spec)} {unit}
          </div>
        )}
        
        {/* Mensagem de validação */}
        {validation && (
          <div className={cn(
            'text-xs px-2 py-1 rounded',
            validation.status === 'valid' && 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
            validation.status === 'warning' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
            validation.status === 'invalid' && 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
          )}>
            {validation.message}
          </div>
        )}
        
        {/* Descrição */}
        {description && (
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {description}
          </div>
        )}
      </motion.div>
    );
  };

  // Estatísticas de validação
  const validationStats = Object.values(validationResults).reduce(
    (acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    },
    { valid: 0, warning: 0, invalid: 0 }
  );

  const totalMeasurements = Object.values(validationResults).length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => setShowTolerances(!showTolerances)}
            className={cn(
              'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors',
              showTolerances
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            <InformationCircleIcon className="h-4 w-4 mr-1" />
            {showTolerances ? 'Ocultar' : 'Mostrar'} Tolerâncias
          </button>
        </div>
        
        {/* Estatísticas de validação */}
        {totalMeasurements > 0 && (
          <div className="flex items-center space-x-3 text-sm">
            {validationStats.valid > 0 && (
              <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                <CheckCircleIcon className="h-4 w-4" />
                <span>{validationStats.valid}</span>
              </div>
            )}
            {validationStats.warning > 0 && (
              <div className="flex items-center space-x-1 text-yellow-600 dark:text-yellow-400">
                <ExclamationTriangleIcon className="h-4 w-4" />
                <span>{validationStats.warning}</span>
              </div>
            )}
            {validationStats.invalid > 0 && (
              <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                <XCircleIcon className="h-4 w-4" />
                <span>{validationStats.invalid}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Grid de medições */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {measurementConfig.map(config => (
          <MeasurementField key={config.key} config={config} />
        ))}
      </div>
      
      {/* Resumo de validação */}
      {totalMeasurements > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            Resumo das Medições
          </h4>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {validationStats.invalid > 0 ? (
              <p className="text-red-600 dark:text-red-400">
                ⚠️ {validationStats.invalid} medição(ões) fora da especificação
              </p>
            ) : validationStats.warning > 0 ? (
              <p className="text-yellow-600 dark:text-yellow-400">
                ⚠️ {validationStats.warning} medição(ões) próxima(s) do limite
              </p>
            ) : (
              <p className="text-green-600 dark:text-green-400">
                ✅ Todas as medições dentro da especificação
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementInput;