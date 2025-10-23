import React from 'react';

export default function Toast({ message, type = 'success', position = 'bottom-right', onClose }) {
  if (!message) return null;

  const positions = {
    'bottom-right': { bottom: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'top-right': { top: 16, right: 16 },
    'top-left': { top: 16, left: 16 },
  };

  const palette = {
    success: { bg: '#2e7d32', icon: '✅' },
    error: { bg: '#c62828', icon: '⚠️' },
    info: { bg: '#1565c0', icon: 'ℹ️' },
  }[type] || { bg: '#2e7d32', icon: '✅' };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        zIndex: 2147483000,
        ...positions[position],
        maxWidth: 420,
        minWidth: 260,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        borderRadius: 10,
        overflow: 'hidden',
        background: palette.bg,
        color: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{palette.icon}</span>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{message}</div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fechar"
            title="Fechar"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              width: 28,
              height: 28,
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
