-- Migration: create tracker_events table
-- Run this on your Postgres DB to create the events table used by the tracker

CREATE TABLE IF NOT EXISTS tracker_events (
  id BIGSERIAL PRIMARY KEY,
  hashed_uid TEXT NULL,
  event TEXT NOT NULL,
  path TEXT NULL,
  ts TIMESTAMPTZ NULL,
  data JSONB NULL,
  ip TEXT NULL,
  ua TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracker_hashed_uid ON tracker_events(hashed_uid);
