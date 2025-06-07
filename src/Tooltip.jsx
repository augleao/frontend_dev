import React from 'react';
import './Tooltip.css'; // Importe o CSS

function Tooltip({ text, children }) {
  return (
    <div className="tooltip">
      {children}
      <span className="tooltiptext">{text}</span>
    </div>
  );
}

export default Tooltip;