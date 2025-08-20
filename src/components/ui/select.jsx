
import React, { useState } from 'react';

const Select = ({ children, value, onValueChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      {React.Children.map(children, child => 
        React.cloneElement(child, { 
          value, 
          onValueChange, 
          isOpen, 
          setIsOpen 
        })
      )}
    </div>
  );
};

const SelectTrigger = ({ children, className = "", value, isOpen, setIsOpen, ...props }) => {
  return (
    <button
      className={`flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ${className}`}
      onClick={() => setIsOpen(!isOpen)}
      {...props}
    >
      {children}
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
};

const SelectValue = ({ placeholder, value }) => {
  return <span>{value || placeholder}</span>;
};

const SelectContent = ({ children, className = "", isOpen, ...props }) => {
  if (!isOpen) return null;
  
  return (
    <div 
      className={`absolute z-50 top-full mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

const SelectItem = ({ children, value, onValueChange, setIsOpen, ...props }) => {
  const handleSelect = () => {
    if (onValueChange) onValueChange(value);
    if (setIsOpen) setIsOpen(false);
  };
  
  return (
    <div
      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm hover:bg-gray-100"
      onClick={handleSelect}
      {...props}
    >
      {children}
    </div>
  );
};

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
