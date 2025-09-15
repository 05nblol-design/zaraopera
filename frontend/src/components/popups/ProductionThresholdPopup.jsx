import React from 'react';
import { X, AlertTriangle, Package, CheckCircle } from 'lucide-react';

/**
 * Popup de produção baseado em popupThreshold
 * Este é o sistema correto que substitui o antigo ProductionTestPopup
 */
const ProductionThresholdPopup = ({ isOpen, onClose, onAcknowledge, popup }) => {
  if (!isOpen || !popup) return null;

  const handleAcknowledge = () => {
    onAcknowledge();
    onClose();
  };

  const exceedBy = popup.productionCount - popup.threshold;
  const progressPercentage = Math.min((popup.productionCount / popup.threshold) * 100, 100);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-pulse-slow">
        {/* Header */}
        <div className="bg-orange-500 text-white p-4 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Alerta de Produção</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Message */}
          <div className="mb-4">
            <p className="text-gray-800 text-center font-medium">
              {popup.message}
            </p>
          </div>

          {/* Production Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">Produção Atual</span>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {popup.productionCount}
              </span>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">Limite Configurado</span>
              <span className="text-sm font-medium text-gray-800">
                {popup.threshold}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  progressPercentage >= 100 ? 'bg-red-500' : 'bg-orange-500'
                }`}
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              ></div>
            </div>
            
            {exceedBy > 0 && (
              <div className="text-center">
                <span className="text-sm text-red-600 font-medium">
                  Excedeu em {exceedBy} produtos
                </span>
              </div>
            )}
          </div>

          {/* Action Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800 text-center">
              <strong>Ação Necessária:</strong> Realize o teste de qualidade antes de continuar a produção.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleAcknowledge}
              className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center space-x-2"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Confirmar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionThresholdPopup;