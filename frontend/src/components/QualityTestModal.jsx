import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';
import QualityTestForm from '../pages/QualityTestForm';

const QualityTestModal = ({ isOpen, onClose, machineId }) => {
  const [isClosing, setIsClosing] = useState(false);

  // Prevenir scroll do body quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  // Fechar modal ao pressionar ESC
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc, false);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc, false);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: isClosing ? 0.95 : 1, opacity: isClosing ? 0 : 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-6xl max-h-[95vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Registrar Teste de Qualidade
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Máquina ID: {machineId}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Fechar modal"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
              <div className="p-6 pb-8">
                {/* Wrapper customizado para o QualityTestForm */}
                <div className="quality-test-modal-content">
                  <QualityTestForm 
                    isModal={true}
                    machineId={machineId}
                    onSuccess={handleClose}
                    onCancel={handleClose}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QualityTestModal;

// Estilos CSS para customizar o formulário dentro do modal
const modalStyles = `
.quality-test-modal-content {
  /* Remove padding extra do formulário */
}

.quality-test-modal-content .helmet-async {
  display: none;
}
`;

// Adicionar estilos ao head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = modalStyles;
  document.head.appendChild(styleSheet);
}