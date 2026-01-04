const pool = require('../db');

function applyConfigEnv(row) {
  if (!row) return;
  if (row.client_id) {
    process.env.AZURE_CLIENT_ID = row.client_id;
  }
  if (row.client_secret) {
    process.env.AZURE_CLIENT_SECRET = row.client_secret;
  }
  if (row.tenant) {
    process.env.AZURE_TENANT_ID = row.tenant;
  }
  if (row.refresh_token) {
    process.env.SHAREPOINT_REFRESH_TOKEN = row.refresh_token;
  }
  if (row.drive_id) {
    process.env.SHAREPOINT_DRIVE_ID = row.drive_id;
  }
}

async function getConfig() {
  const result = await pool.query('SELECT * FROM public.onedrive_config LIMIT 1');
  const row = result.rowCount ? result.rows[0] : null;
  if (row) applyConfigEnv(row);
  return row;
}

async function createConfig({ clientId, clientSecret, redirectUri, tenant, refreshToken, folderPath, driveId }) {
  const res = await pool.query(
    `INSERT INTO public.onedrive_config (client_id, client_secret, redirect_uri, tenant, refresh_token, folder_path, drive_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [clientId, clientSecret, redirectUri, tenant || 'consumers', refreshToken, folderPath, driveId]
  );
  const row = res.rows[0];
  applyConfigEnv(row);
  return row;
}

async function updateConfig(id, updates) {
  const allowed = ['client_id','client_secret','redirect_uri','tenant','refresh_token','folder_path','drive_id'];
  const sets = [];
  const values = [];
  let idx = 1;
  for (const [k,v] of Object.entries(updates)){
    if (!allowed.includes(k)) continue;
    sets.push(`${k} = $${idx}`);
    values.push(v);
    idx++;
  }
  if (!sets.length) return null;
  values.push(id);
  const q = `UPDATE public.onedrive_config SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
  const res = await pool.query(q, values);
  if (!res.rowCount) return null;
  const row = res.rows[0];
  applyConfigEnv(row);
  return row;
}

async function deleteConfig(id) {
  const res = await pool.query('DELETE FROM public.onedrive_config WHERE id = $1', [id]);
  return res.rowCount;
}

async function backfillFolderPath() {
  await pool.query("UPDATE public.onedrive_config SET folder_path = 'Averbacoes' WHERE folder_path IS NULL OR trim(folder_path) = ''");
}

async function ensureSharepointDriveId() {
  if (process.env.SHAREPOINT_DRIVE_ID) {
    return process.env.SHAREPOINT_DRIVE_ID;
  }
  const config = await getConfig();
  return config && config.drive_id ? config.drive_id : null;
}

module.exports = {
  getConfig,
  createConfig,
  updateConfig,
  deleteConfig,
  backfillFolderPath,
  ensureSharepointDriveId,
};
