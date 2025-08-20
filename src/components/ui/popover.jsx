
import React, { useState, useRef, useEffect } from 'react';

const Popover = ({ children, open, onOpenChange }) => {
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={popoverRef}>
      {React.Children.map(children, child => 
        React.cloneElement(child, { open, onOpenChange })
      )}
    </div>
  );
};

const PopoverTrigger = ({ children, asChild, open, onOpenChange, ...props }) => {
  return React.cloneElement(children, {
    ...props,
    onClick: () => onOpenChange(!open)
  });
};

const PopoverContent = ({ children, className = "", open, sideOffset = 0, onOpenChange, ...props }) => {
  if (!open) return null;
  
  return (
    <div 
      className={`absolute z-50 bottom-full mb-2 right-0 min-w-max ${className}`}
      style={{ marginBottom: sideOffset }}
      {...props}
    >
      {children}
    </div>
  );
};

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
};
