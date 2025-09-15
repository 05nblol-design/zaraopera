import React from 'react';
import ProductionTestPopup from './popups/ProductionTestPopup';
import useProductionTestAlert from '../hooks/useProductionTestAlert';

const ProductionTestAlertManager = ({ 
  machineId, 
  isOperating = false, 
  className = '' 
}) => {
  const {
    alertData,
    showPopup,
    isChecking,
    closePopup,
    postponeAlert,
    startTest,
    manualCheck
  } = useProductionTestAlert(machineId, isOperating);

  // Não renderizar nada se não há dados de alerta
  if (!alertData) {
    return null;
  }

  return (
    <>
      {/* Indicador visual opcional quando há alertas pendentes */}
      {alertData && !showPopup && (
        <div className={`fixed bottom-4 right-4 z-40 ${className}`}>
          <button
            onClick={() => manualCheck()}
            className="bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-full shadow-lg transition-all duration-200 animate-pulse"
            title="Verificar alertas de produção"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </button>
        </div>
      )}

      {/* Popup de alerta */}
      <ProductionTestPopup
        isOpen={showPopup}
        onClose={closePopup}
        machineId={alertData?.machineId}
        machineName={alertData?.machineName}
        machineLocation={alertData?.machineLocation}
        productionCount={alertData?.productionCount}
        productsPerTest={alertData?.productsPerTest}
        configId={alertData?.configId}
        onStartTest={startTest}
      />
    </>
  );
};

export default ProductionTestAlertManager;