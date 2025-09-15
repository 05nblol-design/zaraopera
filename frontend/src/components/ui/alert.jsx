import React from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

const Alert = ({ children, variant = 'default', className = '' }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'success':
        return 'border-green-200 bg-green-50 text-green-800';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      default:
        return 'border-blue-200 bg-blue-50 text-blue-800';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <AlertTriangle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className={`relative w-full rounded-lg border p-4 ${getVariantStyles()} ${className}`}>
      <div className="flex items-start space-x-2">
        {getIcon()}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

const AlertDescription = ({ children, className = '' }) => {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  );
};

export { Alert, AlertDescription };