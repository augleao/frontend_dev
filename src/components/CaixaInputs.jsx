```jsx
<div style={{ marginBottom: '15px' }}>
  <label
    style={{
      display: 'block',
      marginBottom: '8px',
      fontWeight: '600',
      color: '#2c3e50'
    }}
  >
    Responsável:
  </label>
  <div
    style={{
      width: '100%',
      padding: '12px',
      borderRadius: '8px',
      border: '2px solid #e3f2fd',
      fontSize: '16px',
      backgroundColor: '#f8f9fa',
      color: '#2c3e50',
      fontWeight: '600'
    }}
  >
    {responsavel}
  </div>
</div>

<div style={{ marginBottom: '15px' }}>
  <label
    style={{
      display: 'block',
      marginBottom: '8px',
      fontWeight: '600',
      color: '#2c3e50'
    }}
  >
    ISS (%):
  </label>
  <input
    type="text"
    value={ISS}
    readOnly
    style={{
      width: '100%',
      padding: '12px',
      borderRadius: '8px',
      border: '2px solid #e3f2fd',
      fontSize: '16px',
      backgroundColor: '#f8f9fa',
      color: '#2c3e50',
      fontWeight: '600'
    }}
  />
</div>

<div style={{ marginBottom: '15px' }}>
  <label
    style={{
      display: 'block',
      marginBottom: '8px',
      fontWeight: '600',
      color: '#2c3e50'
    }}
  >
    Valor Final do Caixa:
  </label>
  <input
    type="text"
    value={valorFinalCaixa}
    readOnly
    style={{
      width: '100%',
      padding: '12px',
      borderRadius: '8px',
      border: '2px solid #e3f2fd',
      fontSize: '16px',
      backgroundColor: '#f8f9fa',
      color: '#2c3e50',
      fontWeight: '600'
    }}
  />
</div>
```