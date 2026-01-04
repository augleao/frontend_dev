ALTER TABLE public.onedrive_config
  ADD COLUMN IF NOT EXISTS drive_id TEXT;

CREATE INDEX IF NOT EXISTS idx_onedrive_config_drive_id
  ON public.onedrive_config (drive_id);
