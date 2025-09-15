import React from 'react';
import { useProductionPopups } from '../hooks/useProductionPopups';
import ProductionThresholdPopup from './popups/ProductionThresholdPopup';

/**
 * Gerenciador de popups de produção baseado em popupThreshold
 * Este é o sistema correto que substitui o antigo ProductionTestPopup
 */
const ProductionPopupManager = ({ machineId }) => {
  const {
    showPopup,
    currentPopup,
    loading,
    acknowledgePopup,
    closePopup
  } = useProductionPopups(machineId);

  if (!machineId || loading) {
    return null;
  }

  return (
    <>
      {showPopup && currentPopup && (
        <ProductionThresholdPopup
          isOpen={showPopup}
          onClose={closePopup}
          onAcknowledge={() => acknowledgePopup(currentPopup.id)}
          popup={currentPopup}
        />
      )}
    </>
  );
};

export default ProductionPopupManager;