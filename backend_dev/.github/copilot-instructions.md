# Copilot Instructions for Bibliofilia Backend

## Project Overview

This is a Node.js/Express backend for a Brazilian legal document management system ("Bibliofilia"). The application processes DAP (Demonstrativo de Arrecadação e Pagamento) tax declaration PDFs from Brazilian notary offices and manages related financial records.

## Architecture Patterns

### Modular Route Initializers

Routes are organized as initializer functions that accept dependencies and return configured routers:

```javascript
// Pattern in routes/*.js
function initDapRoutes(pool) {
  const router = express.Router();
  router.post('/api/dap/upload', ensureAuth, upload.single('file'), async (req, res) => {
    // implementation
  });
  return router;
}
module.exports = initDapRoutes;

// Usage in server.js
const initDapRoutes = require('./routes/dap');
app.use(initDapRoutes(pool));
```

**Benefits:**
- Dependency injection for database pool and services
- Easier testing and mocking
- Clear initialization order in server.js

### Transaction Management

Database operations use a reusable transaction wrapper:

```javascript
await withTransaction(pool, async (client) => {
  await client.query('INSERT INTO ...', values);
  await client.query('UPDATE ...', values);
  // Auto-commit on success, auto-rollback on error
});
```

### Authentication Middleware

Protected routes use `ensureAuth` middleware:
- Validates JWT tokens
- Sets `req.user` with authenticated user data
- Returns 401 for unauthenticated requests

## DAP PDF Processing

### Two-Phase Parser Architecture

**Phase 1: `parseDapText(text)`**
- Receives raw PDF text from pdf-parse library
- Extracts structured data using regex and line-by-line parsing
- Returns generic representation: `{ header, periods, metadata }`

**Phase 2: `parseDapPdf(input)`**
- Entry point accepting `{ buffer, metadata }` from multer upload
- Calls pdf-parse → parseDapText
- Maps generic representation to database schema shape
- Merges extracted data with optional metadata from frontend
- Returns `{ header, periodosDap }` matching persistDap expectations

**Why two phases?**
- Separation of extraction (parseDapText) from API contract (parseDapPdf)
- Allows testing extraction logic independently
- Frontend can override extracted fields via metadata parameter

### Brazilian Currency Formatting

PDFs contain monetary values like **"R$ 18.857,25"**:
- Period (.) = thousands separator
- Comma (,) = decimal separator

Conversion handled by `toNumber()` helper:
```javascript
toNumber('R$ 18.857,25') // → 18857.25
```

### PDF Text Extraction Challenges

- pdf-parse provides unstructured text with inconsistent line breaks
- Field labels may span multiple lines (e.g., "Taxa de Fiscalização\nJudiciária Apurada: R$ 3.649,73")
- Solution: `extractFieldFromLines(lines, labels)` searches for multiple label variants and extracts value from same or next line
- Common patterns:
  - `Label:\n Value` (value on next line)
  - `Label: Value` (inline)
  - `Label Value` (no colon separator)

### Key Parser Functions

```javascript
// Extract value after label across line breaks
extractFieldFromLines(lines, ['Label Variant 1', 'Label Variant 2'])

// Convert Brazilian currency to float
toNumber('R$ 1.234,56') // 1234.56

// Convert date from DD/MM/YYYY to YYYY-MM-DD
normalizeDate('25/01/2025') // '2025-01-25'

// Clean serventia codes (format: XXX.XXXXXXXX-XX)
sanitizeCodigoServentia('000 01090701-27') // '000.01090701-27'
```

## Database Schema

### Key Tables

**`dap` table:**
- **Primary key:** `id` (serial)
- **Unique constraint:** `(codigo_serventia, mes_referencia, ano_referencia)`
- **Monetary fields (numeric(15,2)):** 
  - emolumento_apurado
  - taxa_fiscalizacao_judiciaria_apurada
  - taxa_fiscalizacao_judiciaria_paga
  - recompe_apurado
  - recompe_depositado
  - valores_recebidos_recompe
  - valores_recebidos_ferrfis
  - issqn_recebido_usuarios
  - repasses_responsaveis_anteriores
  - saldo_deposito_previo
  - total_despesas_mes
- **Integer field:** estoque_selos_eletronicos_transmissao
- **Temporal fields:** data_transmissao (timestamp), data_deposito_recompe (date)

**`periodos_dap` table:**
- Links to dap via `dap_id` (foreign key)
- Contains `ordem` (period number) and aggregate totals per period

**`atos_praticados` table:**
- Links to periodos_dap via `periodo_id` (foreign key)
- Stores individual line items: codigo, tributacao, quantidade, tfj_valor

## File Structure

### Critical Files

- **`server.js`**: Main entry point, initializes routes with `initXxxRoutes(pool)` pattern
- **`db.js`**: PostgreSQL connection pool and `withTransaction` wrapper
- **`services/dapParser.js`**: PDF parsing logic (parseDapText, parseDapPdf, extractHeader, extractFieldFromLines)
- **`routes/dap.js`**: DAP CRUD endpoints, upload handler with multer
- **`routes/auth.js`**: Authentication endpoints (login, register)
- **`middlewares/auth.js`**: ensureAuth JWT validation middleware

### Utilities

- **`utils/pdfUtils.js`**: PDF manipulation helpers
- **`utils/imagePreprocess.js`**: Image processing for OCR (not currently used)

## Error Handling

### Custom Error: DapParseError

```javascript
const err = new Error('Informações da serventia ausentes');
err.name = 'DapParseError';
throw err;
```

**Handling in routes:**
```javascript
catch (error) {
  if (error.name === 'DapParseError') {
    return res.status(400).json({ error: error.message });
  }
  // Generic 500 for other errors
}
```

## Common Patterns

### Normalizers

Before persisting to database, data is normalized:
```javascript
// routes/dap.js
const normalizedHeader = normalizeHeader(parsed.header);
const normalizedPeriodos = normalizePeriodos(parsed.periodosDap);
await persistDap(pool, normalizedHeader, normalizedPeriodos);
```

**Purpose:**
- Ensure numeric fields are valid numbers (default to 0)
- Convert string IDs to integers
- Validate required fields

### Sanitizers

```javascript
sanitizeMonetary(value) // Remove non-numeric except decimal separator
toNumber(value)         // Convert Brazilian currency to float
toInteger(value)        // Convert to integer, default 0
```

## Testing Files

- **`teste_*.js`**: Manual test scripts for specific features
- Run with: `node teste_qtd_atos_completo.js`

## Common Issues

### 1. Monetary Fields Saving as 0.00

**Symptom:** PDF contains values but database shows 0.00

**Causes:**
- Field labels not matching extraction patterns
- Currency format not handled by toNumber
- Field not mapped in parseDapPdf → headerOut

**Fix:**
1. Add label variant to extractFieldFromLines call in extractHeader
2. Ensure toNumber handles the value format
3. Map extracted field to headerOut in parseDapPdf

### 2. "Informações da serventia ausentes"

**Symptom:** Parser throws DapParseError despite PDF containing serventia info

**Causes:**
- serventiaNome or codigoServentia not extracted
- Field label differs from expected patterns

**Fix:**
1. Add more label variants to extractFieldFromLines
2. Check PDF text structure with console.log(text) in parseDapText
3. Verify codigo_serventia format matches sanitizeCodigoServentia

### 3. PDF Parse "Invalid parameter object"

**Symptom:** pdf-parse throws error about missing .data/.range/.url

**Cause:** pdf-parse expects raw Buffer, but received multer file object

**Fix:** parseDapPdf already handles this with buffer extraction:
```javascript
const buf = Buffer.isBuffer(input) ? input : input.buffer;
```

## Development Guidelines

### When Adding New Routes

1. Create `routes/newFeature.js` with initializer:
   ```javascript
   function initNewFeatureRoutes(pool) {
     const router = express.Router();
     // define routes
     return router;
   }
   module.exports = initNewFeatureRoutes;
   ```

2. Register in `server.js`:
   ```javascript
   const initNewFeatureRoutes = require('./routes/newFeature');
   app.use(initNewFeatureRoutes(pool));
   ```

### When Adding PDF Extraction Fields

1. **Add extraction in `extractHeader()` (dapParser.js):**
   ```javascript
   const newField = extractFieldFromLines(lines, ['Label 1', 'Label 2']);
   if (newField) header.newField = toNumber(newField);
   ```

2. **Map to output in `parseDapPdf()`:**
   ```javascript
   newField: metadata.newField ?? headerIn.newField ?? null,
   ```

3. **Add column to database if needed:**
   ```sql
   ALTER TABLE dap ADD COLUMN new_field numeric(15,2);
   ```

4. **Update normalizeHeader in `routes/dap.js`:**
   ```javascript
   newField: toNumber(header.newField) || 0,
   ```

## Environment Variables

Not currently documented in .env.example. Key configs in code:
- **Port:** 5000 (hardcoded in server.js)
- **Database:** Connection string in db.js
- **JWT Secret:** Required for auth middleware

## External Dependencies

### Production
- **express**: Web framework
- **pg**: PostgreSQL client
- **pdf-parse**: PDF text extraction
- **multer**: File upload handling
- **jsonwebtoken**: JWT authentication
- **bcryptjs**: Password hashing
- **cors**: CORS middleware
- **dotenv**: Environment variables

### Key Versions
- Node.js: Not pinned (use LTS recommended)
- PostgreSQL: 12+ (uses UPSERT syntax)

## Useful Commands

```powershell
# Start server
node server.js

# Run specific test
node teste_qtd_atos_completo.js

# Database query via psql
psql -U <user> -d <database> -c "SELECT * FROM dap ORDER BY id DESC LIMIT 5;"
```

## Notes for AI Agents

- **Always check existing patterns** before creating new abstractions
- **Preserve the initializer pattern** for routes (don't switch to direct app.use)
- **Use withTransaction** for multi-query operations
- **Brazilian date/currency formats** require special handling (DD/MM/YYYY, R$ X.XXX,XX)
- **PDF text is messy** - regex patterns must be flexible with whitespace/line breaks
- **Test with real PDFs** - sample extraction logic works differently than production PDFs
- **Database schema constraints** - unique on (codigo_serventia, mes_referencia, ano_referencia) means uploads fail if duplicate
