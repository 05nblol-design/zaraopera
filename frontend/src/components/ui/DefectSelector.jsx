import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  XCircleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

const DefectSelector = ({ 
  defects = [], 
  selectedDefects = [], 
  onDefectToggle,
  defectTypes = [],
  className 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showDetails, setShowDetails] = useState(null);

  // Categorias de defeitos
  const categories = [
    { id: 'all', name: 'Todos', color: 'gray' },
    { id: 'dimensional', name: 'Dimensional', color: 'blue' },
    { id: 'surface', name: 'Superfície', color: 'green' },
    { id: 'material', name: 'Material', color: 'yellow' },
    { id: 'assembly', name: 'Montagem', color: 'purple' },
    { id: 'functional', name: 'Funcional', color: 'red' }
  ];

  // Filtrar defeitos
  const filteredDefects = defectTypes.filter(defect => {
    const matchesSearch = defect.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         defect.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || defect.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'major': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
      case 'minor': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return <XCircleIcon className="h-4 w-4" />;
      case 'major': return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'minor': return <CheckCircleIcon className="h-4 w-4" />;
      default: return <CheckCircleIcon className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 'gray';
    
    const colors = {
      gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      green: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      red: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
    };
    
    return colors[category.color] || colors.gray;
  };

  const DefectCard = ({ defect }) => {
    const isSelected = selectedDefects.includes(defect.id);
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          'relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200',
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
        )}
        onClick={() => onDefectToggle(defect.id)}
      >
        {/* Checkbox */}
        <div className="absolute top-3 right-3">
          <div className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            isSelected
              ? 'bg-blue-500 border-blue-500'
              : 'border-gray-300 dark:border-gray-600'
          )}>
            {isSelected && (
              <CheckCircleIcon className="h-3 w-3 text-white" />
            )}
          </div>
        </div>

        {/* Conteúdo do card */}
        <div className="pr-8">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-gray-900 dark:text-white">
              {defect.name}
            </h4>
          </div>
          
          {defect.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {defect.description}
            </p>
          )}
          
          <div className="flex items-center space-x-2">
            {/* Severidade */}
            <span className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              getSeverityColor(defect.severity)
            )}>
              {getSeverityIcon(defect.severity)}
              <span className="ml-1 capitalize">{defect.severity}</span>
            </span>
            
            {/* Categoria */}
            <span className={cn(
              'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
              getCategoryColor(defect.category)
            )}>
              {categories.find(c => c.id === defect.category)?.name || defect.category}
            </span>
          </div>
          
          {/* Botão de detalhes */}
          {defect.details && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(defect);
              }}
              className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ver detalhes
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Controles de filtro */}
      <div className="space-y-3">
        {/* Busca */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar defeitos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        {/* Filtros de categoria */}
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium transition-colors',
                selectedCategory === category.id
                  ? getCategoryColor(category.id)
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Contador de selecionados */}
      {selectedDefects.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {selectedDefects.length} defeito{selectedDefects.length !== 1 ? 's' : ''} selecionado{selectedDefects.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Grid de defeitos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredDefects.map(defect => (
            <DefectCard key={defect.id} defect={defect} />
          ))}
        </AnimatePresence>
      </div>

      {/* Mensagem quando não há resultados */}
      {filteredDefects.length === 0 && (
        <div className="text-center py-8">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Nenhum defeito encontrado
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tente ajustar os filtros ou termo de busca.
          </p>
        </div>
      )}

      {/* Modal de detalhes */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetails(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {showDetails.name}
                </h3>
                <button
                  onClick={() => setShowDetails(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {showDetails.description}
                </p>
                
                {showDetails.details && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Detalhes:
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {showDetails.details}
                    </p>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <span className={cn(
                    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                    getSeverityColor(showDetails.severity)
                  )}>
                    {getSeverityIcon(showDetails.severity)}
                    <span className="ml-1 capitalize">{showDetails.severity}</span>
                  </span>
                  
                  <span className={cn(
                    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                    getCategoryColor(showDetails.category)
                  )}>
                    {categories.find(c => c.id === showDetails.category)?.name || showDetails.category}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DefectSelector;