const express = require('express');
const request = require('supertest');

jest.mock('../middlewares/auth', () => ({
  ensureAuth: (req, res, next) => next(),
}));

jest.mock('../services/onedriveConfigService', () => ({
  getConfig: jest.fn(),
  createConfig: jest.fn(),
  updateConfig: jest.fn(),
  deleteConfig: jest.fn(),
}));

const service = require('../services/onedriveConfigService');
const router = require('../routes/onedrive-config');
const { baseRow, basePayload } = require('./fixtures/onedriveConfig');

describe('OneDrive config routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/onedrive-config', router);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/onedrive-config returns 404 when config is missing', async () => {
    service.getConfig.mockResolvedValueOnce(null);

    await request(app)
      .get('/api/onedrive-config')
      .expect(404);
  });

  test('GET /api/onedrive-config exposes driveId and alias', async () => {
    service.getConfig.mockResolvedValueOnce({ ...baseRow });

    const res = await request(app)
      .get('/api/onedrive-config')
      .expect(200);

    expect(res.body).toMatchObject({
      id: baseRow.id,
      driveId: baseRow.drive_id,
      sharepointDriveId: baseRow.drive_id,
    });
  });

  test('POST /api/onedrive-config rejects missing driveId', async () => {
    service.getConfig.mockResolvedValueOnce(null);

    const { driveId, ...withoutDriveId } = basePayload;

    const res = await request(app)
      .post('/api/onedrive-config')
      .send(withoutDriveId)
      .expect(400);

    expect(res.body.message).toMatch(/driveId/i);
    expect(service.createConfig).not.toHaveBeenCalled();
  });

  test('POST /api/onedrive-config accepts sharepointDriveId alias', async () => {
    service.getConfig.mockResolvedValueOnce(null);
    service.createConfig.mockResolvedValueOnce({ ...baseRow });

    const payload = {
      ...basePayload,
      driveId: undefined,
      sharepointDriveId: baseRow.drive_id,
    };

    const res = await request(app)
      .post('/api/onedrive-config')
      .send(payload)
      .expect(201);

    expect(service.createConfig).toHaveBeenCalledWith(
      expect.objectContaining({ driveId: baseRow.drive_id })
    );
    expect(res.body.config).toMatchObject({ driveId: baseRow.drive_id });
  });

  test('PUT /api/onedrive-config/:id normalizes sharepointDriveId input', async () => {
    const updatedDriveId = 'drive-updated';
    service.updateConfig.mockResolvedValueOnce({ ...baseRow, drive_id: updatedDriveId });

    const res = await request(app)
      .put(`/api/onedrive-config/${baseRow.id}`)
      .send({ sharepointDriveId: ` ${updatedDriveId} ` })
      .expect(200);

    expect(service.updateConfig).toHaveBeenCalledWith(baseRow.id, {
      drive_id: updatedDriveId,
    });
    expect(res.body.config.driveId).toBe(updatedDriveId);
  });
});
