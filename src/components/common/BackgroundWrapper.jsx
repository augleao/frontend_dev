import React from 'react';

export default function BackgroundWrapper({ children, padding = 24, containerProps = {} }) {
  const wrapperStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#0b1324',
    background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 30%), radial-gradient(circle at 80% 0%, rgba(92,169,255,0.1), transparent 35%), linear-gradient(135deg, #0a1630 0%, #0e2145 50%, #0b1d3a 100%)",
    position: 'relative',
    overflow: 'hidden',
    padding
  };

  const watermarkStyle = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    backgroundImage: 'linear-gradient(135deg, rgba(201,166,70,0.05) 0 20%, transparent 20% 100%), radial-gradient(circle at 30% 40%, rgba(255,255,255,0.06), transparent 50%), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 12px)',
    opacity: 0.6,
    zIndex: 0
  };

  const innerContainerDefault = {
    position: 'relative',
    zIndex: 1,
    width: '100%'
  };

  const innerContainerStyle = { ...innerContainerDefault, ...(containerProps.style || {}) };

  return (
    <div style={wrapperStyle}>
      <div style={watermarkStyle} />
      <div {...containerProps} style={innerContainerStyle}>
        {children}
      </div>
    </div>
  );
}
