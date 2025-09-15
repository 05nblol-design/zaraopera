import React from 'react';
import ProductionTestPopup from './popups/ProductionTestPopup';
import useProductionTestAlert from '../hooks/useProductionTestAlert';

const ProductionTestAlert = ({ machineId, isOperating }) => {
  const {
    alertData,
    showPopup,
    closePopup,
    startTest
  } = useProductionTestAlert(machineId, isOperating);

  if (!showPopup || !alertData) {
    return null;
  }

  return (
    <ProductionTestPopup
      isOpen={showPopup}
      onClose={closePopup}
      machineId={alertData.machineId}
      machineName={alertData.machineName}
      machineLocation={alertData.machineLocation}
      productionCount={alertData.productionCount}
      productsPerTest={alertData.productsPerTest}
      configId={alertData.configId}
      onStartTest={startTest}
    />
  );
};

export default ProductionTestAlert;