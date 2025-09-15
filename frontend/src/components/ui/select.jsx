import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

// Simple utility function to combine class names
const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};

const Select = ({ children, value, onValueChange, ...props }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState('');
  const selectRef = React.useRef(null);
  
  // Encontrar o label correspondente ao valor atual
  const findLabelForValue = React.useCallback((currentValue) => {
    if (!currentValue) return '';
    
    let foundLabel = '';
    
    const searchInChildren = (childrenToSearch) => {
      React.Children.forEach(childrenToSearch, child => {
        if (React.isValidElement(child)) {
          if (child.props?.value === currentValue) {
            foundLabel = typeof child.props.children === 'string' ? child.props.children : String(child.props.children || '');
          } else if (child.props?.children) {
            searchInChildren(child.props.children);
          }
        }
      });
    };
    
    searchInChildren(children);
    return foundLabel;
  }, [children]);
  
  // Atualizar label quando o valor muda
  React.useEffect(() => {
    const label = findLabelForValue(value);
    setSelectedLabel(label);
  }, [value, findLabelForValue]);
  
  // Fechar dropdown quando clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);
  
  const handleValueChange = (newValue, label) => {
    console.log('Select handleValueChange:', { newValue, label });
    setSelectedLabel(label);
    setIsOpen(false);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };
  
  return (
    <div ref={selectRef} className="relative" {...props}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            isOpen,
            setIsOpen,
            selectedValue: value,
            selectedLabel,
            onValueChange: handleValueChange
          });
        }
        return child;
      })}
    </div>
  );
};

const SelectTrigger = React.forwardRef(({ className, children, isOpen, setIsOpen, selectedValue, selectedLabel, onValueChange, ...props }, ref) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('SelectTrigger clicked, current isOpen:', isOpen);
    if (setIsOpen) {
      setIsOpen(!isOpen);
    }
  };
  
  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className={cn('h-4 w-4 opacity-50 transition-transform', isOpen && 'rotate-180')} />
    </button>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

const SelectValue = ({ placeholder, selectedLabel, selectedValue }) => {
  console.log('SelectValue render:', { placeholder, selectedLabel, selectedValue });
  return (
    <span className={cn('block truncate', !selectedValue && 'text-muted-foreground')}>
      {selectedValue ? selectedLabel : placeholder}
    </span>
  );
};

const SelectContent = ({ className, children, isOpen, onValueChange, selectedValue, selectedLabel, setIsOpen, ...props }) => {
  if (!isOpen) return null;
  
  return (
    <div
      className={cn(
        'absolute top-full left-0 z-[1100] w-full mt-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xl border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden max-h-60 overflow-y-auto',
        className
      )}
      style={{ zIndex: 99999 }}
      {...props}
    >
      <div className="p-1">
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, { onValueChange });
          }
          return child;
        })}
      </div>
    </div>
  );
};
SelectContent.displayName = 'SelectContent';

const SelectItem = React.forwardRef(({ className, children, value, onValueChange, ...props }, ref) => {
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('SelectItem clicked:', { value, children });
    if (onValueChange) {
      const label = typeof children === 'string' ? children : String(children || '');
      onValueChange(value, label);
    }
  };
  
  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SelectItem.displayName = 'SelectItem';

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };