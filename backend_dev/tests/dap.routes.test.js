const express = require('express');
const request = require('supertest');

jest.mock('../middlewares/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, nome: 'Test User' };
    return next();
  },
}));

jest.mock('../services/dapService', () => ({
  createDapFromPdf: jest.fn(),
  createDapFromStructured: jest.fn(),
  listDaps: jest.fn(),
  getDapById: jest.fn(),
  updateDap: jest.fn(),
  softDeleteDap: jest.fn(),
}));

const router = require('../routes/dap');
const service = require('../services/dapService');

describe('DAP routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/dap', router);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/dap/upload processa PDF e retorna 201', async () => {
    service.createDapFromPdf.mockResolvedValueOnce({ cabecalho: { id: 10 }, periodos: [] });

    const res = await request(app)
      .post('/api/dap/upload')
      .attach('file', Buffer.from('%PDF-1.4'), 'dap.pdf')
      .expect(201);

    expect(service.createDapFromPdf).toHaveBeenCalled();
    expect(res.body.message).toMatch(/processada com sucesso/i);
  });

  test('POST /api/dap/upload valida ausência de arquivo', async () => {
    const res = await request(app)
      .post('/api/dap/upload')
      .expect(400);
    expect(res.body.message).toMatch(/arquivo pdf/i);
  });

  test('POST /api/dap cria registro a partir de JSON', async () => {
    service.createDapFromStructured.mockResolvedValueOnce({ cabecalho: { id: 42, ano: 2025 }, periodos: [] });
    const payload = {
      cabecalho: { ano: 2025, mes: 10, tipo: 'ORIGINAL' },
      periodos: [],
    };

    const res = await request(app)
      .post('/api/dap')
      .send(payload)
      .expect(201);

    expect(service.createDapFromStructured).toHaveBeenCalledWith(expect.objectContaining(payload), expect.any(Object));
    expect(res.body.cabecalho.id).toBe(42);
  });

  test('GET /api/dap lista registros com filtros', async () => {
    service.listDaps.mockResolvedValueOnce({ page: 1, pageSize: 20, registros: [{ id: 1 }] });

    const res = await request(app)
      .get('/api/dap')
      .query({ ano: 2025, tipo: 'ORIGINAL' })
      .expect(200);

    expect(service.listDaps).toHaveBeenCalledWith(expect.objectContaining({ ano: '2025', tipo: 'ORIGINAL' }), expect.any(Object));
    expect(res.body.registros).toHaveLength(1);
  });

  test('GET /api/dap/:id retorna 404 quando não existe', async () => {
    service.getDapById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/dap/999')
      .expect(404);

    expect(res.body.message).toMatch(/não encontrada/i);
  });

  test('PUT /api/dap/:id atualiza e retorna mensagem', async () => {
    service.updateDap.mockResolvedValueOnce({ cabecalho: { id: 5, status: 'ATIVA' } });

    const res = await request(app)
      .put('/api/dap/5')
      .send({ status: 'ATIVA' })
      .expect(200);

    expect(service.updateDap).toHaveBeenCalledWith(5, expect.objectContaining({ status: 'ATIVA' }));
    expect(res.body.message).toMatch(/atualizada com sucesso/i);
  });

  test('DELETE /api/dap/:id realiza soft delete', async () => {
    service.softDeleteDap.mockResolvedValueOnce({ cabecalho: { id: 7, status: 'REMOVIDA' } });

    const res = await request(app)
      .delete('/api/dap/7')
      .expect(200);

    expect(service.softDeleteDap).toHaveBeenCalledWith(7);
    expect(res.body.cabecalho.status).toBe('REMOVIDA');
  });
});
