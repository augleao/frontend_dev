const baseRow = {
  id: '11111111-2222-4333-8444-555555555555',
  client_id: 'client-123',
  client_secret: 'secret-xyz',
  redirect_uri: 'https://app.example.com/auth/callback',
  tenant: 'consumers',
  refresh_token: 'refresh-abc',
  folder_path: 'Averbacoes',
  drive_id: 'drive-987654321',
};

const basePayload = {
  clientId: baseRow.client_id,
  clientSecret: baseRow.client_secret,
  redirectUri: baseRow.redirect_uri,
  tenant: baseRow.tenant,
  refreshToken: baseRow.refresh_token,
  folderPath: baseRow.folder_path,
  driveId: baseRow.drive_id,
};

module.exports = { baseRow, basePayload };
