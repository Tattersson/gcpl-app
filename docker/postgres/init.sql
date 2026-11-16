-- Ice Hockey Goalie Practice Planner (GCPL) PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'COACH' CHECK (role IN ('ADMIN', 'COACH')),
  auth_provider TEXT NOT NULL DEFAULT 'local' CHECK (auth_provider IN ('local', 'keycloak')),
  keycloak_sub TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auth_mode TEXT NOT NULL DEFAULT 'local' CHECK (auth_mode IN ('local', 'keycloak')),
  keycloak_config JSONB NOT NULL DEFAULT '{
    "issuerUrl": "",
    "realm": "",
    "clientId": "",
    "clientSecret": "",
    "publicOrigin": ""
  }'::jsonb,
  branding_config JSONB NOT NULL DEFAULT '{
    "siteName": "GCPL",
    "siteTagline": "Goalie Coach Practice Planner",
    "logoDataUrl": "",
    "faviconDataUrl": "",
    "useLogoAsFavicon": true,
    "showLogoInSharedView": true,
    "primaryColor": "#0284c7",
    "secondaryColor": "#1e293b",
    "accentColor": "#0d9488",
    "headerBgColor": "#0f172a",
    "headerTextColor": "#ffffff",
    "backgroundColor": "#f1f5f9",
    "surfaceColor": "#ffffff",
    "shapePreset": "rounded",
    "fontPreset": "roboto"
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS branding_config JSONB NOT NULL DEFAULT '{
    "siteName": "GCPL",
    "siteTagline": "Goalie Coach Practice Planner",
    "logoDataUrl": "",
    "faviconDataUrl": "",
    "useLogoAsFavicon": true,
    "showLogoInSharedView": true,
    "primaryColor": "#0284c7",
    "secondaryColor": "#1e293b",
    "accentColor": "#0d9488",
    "headerBgColor": "#0f172a",
    "headerTextColor": "#ffffff",
    "backgroundColor": "#f1f5f9",
    "surfaceColor": "#ffffff",
    "shapePreset": "rounded",
    "fontPreset": "roboto"
  }'::jsonb;

INSERT INTO system_settings (id, auth_mode)
VALUES (1, 'local')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS practice_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  practice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INT NOT NULL DEFAULT 60,
  default_rink_type TEXT NOT NULL DEFAULT 'full' CHECK (default_rink_type IN ('full', 'half', 'third', 'crease', 'corner')),
  roster_config JSONB NOT NULL DEFAULT '{
    "goalies": 2,
    "skaters": 6,
    "coaches": 2,
    "goalieLabels": ["G1", "G2"],
    "equipment": ["Pucks", "Cones"]
  }'::jsonb,
  drills JSONB NOT NULL DEFAULT '[]'::jsonb,
  view_config JSONB NOT NULL DEFAULT '{
    "layout": "grid",
    "columns": 2,
    "showHeader": true,
    "showRosterBar": true,
    "defaultSpeed": 1,
    "blocks": [
      { "id": "animation_player", "label": "Animated Rink Player", "enabled": true, "order": 1, "span": "half" },
      { "id": "static_image", "label": "Static Plan Diagram", "enabled": true, "order": 2, "span": "half" },
      { "id": "description", "label": "Drill Description & Goalie Coaching Points", "enabled": true, "order": 3, "span": "full" },
      { "id": "roster", "label": "Appointed Goalies, Players & Equipment", "enabled": true, "order": 4, "span": "full" }
    ]
  }'::jsonb,
  share_token TEXT UNIQUE NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_plans_owner ON practice_plans(owner_id);
CREATE INDEX IF NOT EXISTS idx_practice_plans_share_token ON practice_plans(share_token);

CREATE TABLE IF NOT EXISTS off_ice_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 20,
  equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE off_ice_practices
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_off_ice_practices_owner ON off_ice_practices(owner_id);
