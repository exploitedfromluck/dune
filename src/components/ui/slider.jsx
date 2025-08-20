
import React from 'react';

const Slider = ({ 
  value = [0], 
  onValueChange, 
  max = 100, 
  min = 0, 
  step = 1, 
  className = "",
  ...props 
}) => {
  const handleChange = (e) => {
    const newValue = [parseFloat(e.target.value)];
    if (onValueChange) onValueChange(newValue);
  };
  
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={handleChange}
      className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider ${className}`}
      {...props}
    />
  );
};

export { Slider };
