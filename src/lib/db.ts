import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AppUser,
  OffIcePractice,
  PracticePlan,
  SystemSettings,
  UserRole,
} from '@/types/planner';
import { DEFAULT_VIEW_CONFIG, createStarterDrill } from '@/lib/rinkConfig';
import { renderDrillStaticSvgDataUrl } from '@/lib/snapshotSvg';
import {
  DEFAULT_BRANDING_CONFIG,
  normalizeBrandingConfig,
} from '@/lib/branding';
import {
  STARTER_OFF_ICE_PRACTICES,
  normalizeImageList,
  normalizeStringList,
} from '@/lib/offIce';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://gcpl:gcpl_secret@localhost:5432/gcpl_db';

let pool: Pool | null = null;
let schemaInitialized = false;
let useFallbackStore = false;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 2500,
    });
  }
  return pool;
}

interface StoredUser extends AppUser {
  passwordHash: string | null;
  keycloakSub: string | null;
}

interface FallbackState {
  users: StoredUser[];
  settings: SystemSettings;
  plans: PracticePlan[];
  offIcePractices: OffIcePractice[];
}

const FALLBACK_FILE = path.join(process.cwd(), '.local-gcpl-store.json');

function buildStarterOffIcePractices(ownerId: string | null = null): OffIcePractice[] {
  const now = new Date().toISOString();
  return STARTER_OFF_ICE_PRACTICES.map((item) => ({
    id: crypto.randomUUID(),
    ownerId,
    title: item.title,
    description: item.description,
    durationMinutes: item.durationMinutes,
    equipment: [...item.equipment],
    tags: [...item.tags],
    images: [],
    createdAt: now,
    updatedAt: now,
  }));
}

// shortcut: single-file JSON fallback when Postgres is offline in local non-Docker dev, use Postgres via docker/docker-compose.yml in production
function readFallback(): FallbackState {
  try {
    if (fs.existsSync(FALLBACK_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FALLBACK_FILE, 'utf-8')) as FallbackState;
      parsed.settings = {
        ...parsed.settings,
        brandingConfig: normalizeBrandingConfig(parsed.settings?.brandingConfig),
      };
      if (!Array.isArray(parsed.offIcePractices)) {
        parsed.offIcePractices = buildStarterOffIcePractices(parsed.users?.[0]?.id ?? null);
        writeFallback(parsed);
      } else {
        parsed.offIcePractices = parsed.offIcePractices.map((p) => ({
          ...p,
          images: normalizeImageList(p.images),
        }));
      }
      return parsed;
    }
  } catch {
    // Ignore parse error and initialize fresh state
  }
  const initial: FallbackState = {
    users: [],
    settings: {
      authMode: 'local',
      keycloakConfig: {
        issuerUrl: '',
        realm: 'gcpl',
        clientId: 'gcpl-web',
        clientSecret: '',
        publicOrigin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      brandingConfig: { ...DEFAULT_BRANDING_CONFIG },
      updatedAt: new Date().toISOString(),
    },
    plans: [],
    offIcePractices: buildStarterOffIcePractices(null),
  };
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  } catch {
    // Ignore read-only fs errors
  }
  return initial;
}

function writeFallback(state: FallbackState): void {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignore write error
  }
}

export async function ensureDatabaseReady(): Promise<{ backend: 'postgres' | 'fallback' }> {
  if (schemaInitialized) {
    return { backend: useFallbackStore ? 'fallback' : 'postgres' };
  }

  try {
    const client = await getPool().connect();
    try {
      const initSqlPath = path.join(process.cwd(), 'docker', 'postgres', 'init.sql');
      if (fs.existsSync(initSqlPath)) {
        const sql = fs.readFileSync(initSqlPath, 'utf-8');
        await client.query(sql);
      }
      const offIceCountRes = await client.query(
        `SELECT COUNT(*)::int AS count FROM off_ice_practices`
      );
      if ((offIceCountRes.rows[0]?.count ?? 0) === 0) {
        for (const item of STARTER_OFF_ICE_PRACTICES) {
          await client.query(
            `INSERT INTO off_ice_practices (title, description, duration_minutes, equipment, tags, images)
             VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, '[]'::jsonb)`,
            [
              item.title,
              item.description,
              item.durationMinutes,
              JSON.stringify(item.equipment),
              JSON.stringify(item.tags),
            ]
          );
        }
      }
      schemaInitialized = true;
      useFallbackStore = false;
      return { backend: 'postgres' };
    } finally {
      client.release();
    }
  } catch {
    schemaInitialized = true;
    useFallbackStore = true;
    readFallback();
    return { backend: 'fallback' };
  }
}

// ============================================================================
// System Settings (Local NextAuth/Auth.js vs Dynamic DB-Driven Keycloak)
// ============================================================================

export async function getSystemSettings(): Promise<SystemSettings & { dbBackend: 'postgres' | 'fallback' }> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    return {
      ...state.settings,
      brandingConfig: normalizeBrandingConfig(state.settings.brandingConfig),
      dbBackend: 'fallback',
    };
  }

  const res = await getPool().query(
    `SELECT auth_mode, keycloak_config, branding_config, updated_at FROM system_settings WHERE id = 1`
  );
  if (res.rows.length === 0) {
    return {
      authMode: 'local',
      keycloakConfig: {
        issuerUrl: '',
        realm: 'gcpl',
        clientId: 'gcpl-web',
        clientSecret: '',
        publicOrigin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      brandingConfig: { ...DEFAULT_BRANDING_CONFIG },
      dbBackend: 'postgres',
    };
  }
  const row = res.rows[0];
  return {
    authMode: row.auth_mode,
    keycloakConfig: row.keycloak_config,
    brandingConfig: normalizeBrandingConfig(row.branding_config),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    dbBackend: 'postgres',
  };
}

export async function updateSystemSettings(
  settings: Partial<SystemSettings>
): Promise<SystemSettings> {
  const current = await getSystemSettings();
  const nextAuthMode = settings.authMode ?? current.authMode;
  const nextKeycloakConfig = {
    ...current.keycloakConfig,
    ...(settings.keycloakConfig ?? {}),
  };
  const nextBrandingConfig = normalizeBrandingConfig({
    ...current.brandingConfig,
    ...(settings.brandingConfig ?? {}),
  });

  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    state.settings = {
      authMode: nextAuthMode,
      keycloakConfig: nextKeycloakConfig,
      brandingConfig: nextBrandingConfig,
      updatedAt: new Date().toISOString(),
    };
    writeFallback(state);
    return state.settings;
  }

  await getPool().query(
    `INSERT INTO system_settings (id, auth_mode, keycloak_config, branding_config, updated_at)
     VALUES (1, $1, $2::jsonb, $3::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE
     SET auth_mode = EXCLUDED.auth_mode,
         keycloak_config = EXCLUDED.keycloak_config,
         branding_config = EXCLUDED.branding_config,
         updated_at = NOW()`,
    [
      nextAuthMode,
      JSON.stringify(nextKeycloakConfig),
      JSON.stringify(nextBrandingConfig),
    ]
  );

  return {
    authMode: nextAuthMode,
    keycloakConfig: nextKeycloakConfig,
    brandingConfig: nextBrandingConfig,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// User Management
// ============================================================================

export async function getUserCount(): Promise<number> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    return readFallback().users.length;
  }
  const res = await getPool().query(`SELECT COUNT(*)::int AS count FROM users`);
  return res.rows[0]?.count ?? 0;
}

export async function listUsers(): Promise<AppUser[]> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    return readFallback().users.map(({ passwordHash: _ph, keycloakSub: _ks, ...u }) => u);
  }
  const res = await getPool().query(
    `SELECT id, email, name, role, auth_provider, active, created_at
     FROM users ORDER BY created_at ASC`
  );
  return res.rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role as UserRole,
    authProvider: r.auth_provider,
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function findUserByEmailWithSecret(email: string): Promise<StoredUser | null> {
  const normalized = email.trim().toLowerCase();
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    return readFallback().users.find((u) => u.email.toLowerCase() === normalized) ?? null;
  }
  const res = await getPool().query(
    `SELECT id, email, name, password_hash, role, auth_provider, keycloak_sub, active, created_at
     FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [normalized]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.password_hash,
    role: r.role,
    authProvider: r.auth_provider,
    keycloakSub: r.keycloak_sub,
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordHash?: string | null;
  role?: UserRole;
  authProvider?: 'local' | 'keycloak';
  keycloakSub?: string | null;
}): Promise<AppUser> {
  const email = input.email.trim().toLowerCase();
  const role: UserRole = input.role ?? 'COACH';
  const authProvider = input.authProvider ?? 'local';
  const { backend } = await ensureDatabaseReady();

  if (backend === 'fallback') {
    const state = readFallback();
    if (state.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('A user with that email already exists');
    }
    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      email,
      name: input.name.trim(),
      passwordHash: input.passwordHash ?? null,
      role,
      authProvider,
      keycloakSub: input.keycloakSub ?? null,
      active: true,
      createdAt: new Date().toISOString(),
    };
    state.users.push(newUser);
    writeFallback(state);

    // Seed a starter practice plan if this is the very first user
    if (state.plans.length === 0) {
      await createPracticePlan({
        ownerId: newUser.id,
        title: 'Pro Goalie Crease Mastery & Post Integration',
        description: 'High-tempo morning goalie ice session focusing on T-pushes, RVH post seal, and royal-road pass tracking.',
        practiceDate: new Date().toISOString().slice(0, 10),
        durationMinutes: 60,
        defaultRinkType: 'crease',
        rosterConfig: {
          goalies: 2,
          skaters: 4,
          coaches: 2,
          goalieLabels: ['G1', 'G2'],
          equipment: ['Pucks', 'Cones', 'Deflection Board'],
        },
      });
    }
    const { passwordHash: _ph, keycloakSub: _ks, ...publicUser } = newUser;
    return publicUser;
  }

  const res = await getPool().query(
    `INSERT INTO users (email, name, password_hash, role, auth_provider, keycloak_sub, active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING id, email, name, role, auth_provider, active, created_at`,
    [
      email,
      input.name.trim(),
      input.passwordHash ?? null,
      role,
      authProvider,
      input.keycloakSub ?? null,
    ]
  );
  const r = res.rows[0];
  const created: AppUser = {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    authProvider: r.auth_provider,
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
  };

  // Seed a sample practice plan if none exist yet
  const planCheck = await getPool().query(`SELECT COUNT(*)::int AS count FROM practice_plans`);
  if ((planCheck.rows[0]?.count ?? 0) === 0) {
    await createPracticePlan({
      ownerId: created.id,
      title: 'Pro Goalie Crease Mastery & Post Integration',
      description: 'High-tempo morning goalie ice session focusing on T-pushes, RVH post seal, and royal-road pass tracking.',
      practiceDate: new Date().toISOString().slice(0, 10),
      durationMinutes: 60,
      defaultRinkType: 'crease',
      rosterConfig: {
        goalies: 2,
        skaters: 4,
        coaches: 2,
        goalieLabels: ['G1', 'G2'],
        equipment: ['Pucks', 'Cones', 'Deflection Board'],
      },
    });
  }

  return created;
}

export async function updateUserById(
  userId: string,
  updates: { role?: UserRole; active?: boolean; name?: string }
): Promise<AppUser | null> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    const u = state.users.find((item) => item.id === userId);
    if (!u) return null;
    if (updates.role) u.role = updates.role;
    if (typeof updates.active === 'boolean') u.active = updates.active;
    if (updates.name) u.name = updates.name.trim();
    writeFallback(state);
    const { passwordHash: _ph, keycloakSub: _ks, ...pub } = u;
    return pub;
  }

  const res = await getPool().query(
    `UPDATE users
     SET role = COALESCE($2, role),
         active = COALESCE($3, active),
         name = COALESCE($4, name),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, role, auth_provider, active, created_at`,
    [userId, updates.role ?? null, updates.active ?? null, updates.name ?? null]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    authProvider: r.auth_provider,
    active: r.active,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function upsertKeycloakUser(profile: {
  sub: string;
  email: string;
  name: string;
  roles?: string[];
}): Promise<AppUser> {
  const existing = await findUserByEmailWithSecret(profile.email);
  const resolvedRole: UserRole =
    profile.roles?.some((r) => r.toUpperCase() === 'ADMIN')
      ? 'ADMIN'
      : existing?.role ?? 'COACH';

  if (existing) {
    const updated = await updateUserById(existing.id, {
      role: resolvedRole,
      name: profile.name || existing.name,
    });
    return updated!;
  }

  return createUser({
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
    role: resolvedRole,
    authProvider: 'keycloak',
    keycloakSub: profile.sub,
  });
}

// ============================================================================
// Practice Plans CRUD & Sharing
// ============================================================================

function mapRowToPlan(r: Record<string, any>): PracticePlan {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    description: r.description ?? '',
    practiceDate:
      typeof r.practice_date === 'string'
        ? r.practice_date.slice(0, 10)
        : new Date(r.practice_date).toISOString().slice(0, 10),
    durationMinutes: r.duration_minutes,
    defaultRinkType: r.default_rink_type,
    rosterConfig: r.roster_config,
    drills: r.drills,
    viewConfig: r.view_config,
    shareToken: r.share_token,
    isShared: r.is_shared,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listPracticePlans(): Promise<PracticePlan[]> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    return readFallback().plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  const res = await getPool().query(
    `SELECT * FROM practice_plans ORDER BY updated_at DESC`
  );
  return res.rows.map(mapRowToPlan);
}

export async function getPracticePlanById(id: string): Promise<PracticePlan | null> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    return readFallback().plans.find((p) => p.id === id) ?? null;
  }
  const res = await getPool().query(`SELECT * FROM practice_plans WHERE id = $1 LIMIT 1`, [id]);
  if (res.rows.length === 0) return null;
  return mapRowToPlan(res.rows[0]);
}

export async function getPracticePlanByShareToken(token: string): Promise<PracticePlan | null> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    return (
      readFallback().plans.find((p) => p.shareToken === token && p.isShared) ?? null
    );
  }
  const res = await getPool().query(
    `SELECT * FROM practice_plans WHERE share_token = $1 AND is_shared = TRUE LIMIT 1`,
    [token]
  );
  if (res.rows.length === 0) return null;
  return mapRowToPlan(res.rows[0]);
}

export async function createPracticePlan(input: {
  ownerId: string | null;
  title: string;
  description?: string;
  practiceDate?: string;
  durationMinutes?: number;
  defaultRinkType?: PracticePlan['defaultRinkType'];
  rosterConfig?: PracticePlan['rosterConfig'];
  viewConfig?: Partial<PracticePlan['viewConfig']>;
  drills?: PracticePlan['drills'];
}): Promise<PracticePlan> {
  const defaultRinkType = input.defaultRinkType ?? 'full';
  const rosterConfig: PracticePlan['rosterConfig'] = input.rosterConfig ?? {
    goalies: 2,
    skaters: 6,
    coaches: 2,
    goalieLabels: ['G1', 'G2'],
    equipment: ['Pucks', 'Cones'],
  };

  const starterDrill = createStarterDrill(
    defaultRinkType,
    rosterConfig.goalies,
    rosterConfig.skaters,
    rosterConfig.coaches,
    1
  );
  starterDrill.snapshotDataUrl = renderDrillStaticSvgDataUrl(starterDrill);

  const drills = (input.drills && input.drills.length > 0 ? input.drills : [starterDrill]).map(
    (d) => ({
      ...d,
      snapshotDataUrl: d.snapshotDataUrl || renderDrillStaticSvgDataUrl(d),
    })
  );

  const viewConfig: PracticePlan['viewConfig'] = {
    ...DEFAULT_VIEW_CONFIG,
    ...(input.viewConfig ?? {}),
  };

  const shareToken = crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  const practiceDate = input.practiceDate || now.slice(0, 10);

  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    const newPlan: PracticePlan = {
      id: crypto.randomUUID(),
      ownerId: input.ownerId,
      title: input.title.trim() || 'Untitled Goalie Practice',
      description: input.description?.trim() ?? '',
      practiceDate,
      durationMinutes: input.durationMinutes ?? 60,
      defaultRinkType,
      rosterConfig,
      drills,
      viewConfig,
      shareToken,
      isShared: true,
      createdAt: now,
      updatedAt: now,
    };
    state.plans.push(newPlan);
    writeFallback(state);
    return newPlan;
  }

  const res = await getPool().query(
    `INSERT INTO practice_plans (
      owner_id, title, description, practice_date, duration_minutes,
      default_rink_type, roster_config, drills, view_config, share_token, is_shared
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, TRUE)
    RETURNING *`,
    [
      input.ownerId,
      input.title.trim() || 'Untitled Goalie Practice',
      input.description?.trim() ?? '',
      practiceDate,
      input.durationMinutes ?? 60,
      defaultRinkType,
      JSON.stringify(rosterConfig),
      JSON.stringify(drills),
      JSON.stringify(viewConfig),
      shareToken,
    ]
  );

  return mapRowToPlan(res.rows[0]);
}

export async function updatePracticePlan(
  id: string,
  updates: Partial<
    Pick<
      PracticePlan,
      | 'title'
      | 'description'
      | 'practiceDate'
      | 'durationMinutes'
      | 'defaultRinkType'
      | 'rosterConfig'
      | 'drills'
      | 'viewConfig'
      | 'isShared'
    >
  >
): Promise<PracticePlan | null> {
  const existing = await getPracticePlanById(id);
  if (!existing) return null;

  const updatedDrills = (updates.drills ?? existing.drills).map((d) => ({
    ...d,
    snapshotDataUrl: renderDrillStaticSvgDataUrl(d),
  }));

  const next: PracticePlan = {
    ...existing,
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    practiceDate: updates.practiceDate ?? existing.practiceDate,
    durationMinutes: updates.durationMinutes ?? existing.durationMinutes,
    defaultRinkType: updates.defaultRinkType ?? existing.defaultRinkType,
    rosterConfig: updates.rosterConfig ?? existing.rosterConfig,
    drills: updatedDrills,
    viewConfig: updates.viewConfig ?? existing.viewConfig,
    isShared: typeof updates.isShared === 'boolean' ? updates.isShared : existing.isShared,
    updatedAt: new Date().toISOString(),
  };

  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    const idx = state.plans.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    state.plans[idx] = next;
    writeFallback(state);
    return next;
  }

  const res = await getPool().query(
    `UPDATE practice_plans
     SET title = $2,
         description = $3,
         practice_date = $4,
         duration_minutes = $5,
         default_rink_type = $6,
         roster_config = $7::jsonb,
         drills = $8::jsonb,
         view_config = $9::jsonb,
         is_shared = $10,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      next.title,
      next.description,
      next.practiceDate,
      next.durationMinutes,
      next.defaultRinkType,
      JSON.stringify(next.rosterConfig),
      JSON.stringify(next.drills),
      JSON.stringify(next.viewConfig),
      next.isShared,
    ]
  );

  if (res.rows.length === 0) return null;
  return mapRowToPlan(res.rows[0]);
}

export async function deletePracticePlan(id: string): Promise<boolean> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    const before = state.plans.length;
    state.plans = state.plans.filter((p) => p.id !== id);
    writeFallback(state);
    return state.plans.length < before;
  }
  const res = await getPool().query(`DELETE FROM practice_plans WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

// ============================================================================
// Off-Ice Practices CRUD
// ============================================================================

function mapRowToOffIcePractice(r: Record<string, any>): OffIcePractice {
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    description: r.description ?? '',
    durationMinutes: Number(r.duration_minutes) || 20,
    equipment: normalizeStringList(r.equipment),
    tags: normalizeStringList(r.tags),
    images: normalizeImageList(r.images),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listOffIcePractices(): Promise<OffIcePractice[]> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    return [...(readFallback().offIcePractices || [])].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }
  const res = await getPool().query(
    `SELECT * FROM off_ice_practices ORDER BY updated_at DESC`
  );
  return res.rows.map(mapRowToOffIcePractice);
}

export async function getOffIcePracticeById(id: string): Promise<OffIcePractice | null> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    return readFallback().offIcePractices.find((p) => p.id === id) ?? null;
  }
  const res = await getPool().query(
    `SELECT * FROM off_ice_practices WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (res.rows.length === 0) return null;
  return mapRowToOffIcePractice(res.rows[0]);
}

export async function createOffIcePractice(input: {
  ownerId: string | null;
  title: string;
  description?: string;
  durationMinutes?: number;
  equipment?: string[];
  tags?: string[];
  images?: string[];
}): Promise<OffIcePractice> {
  const title = input.title?.trim();
  if (!title) {
    throw new Error('Title is required');
  }
  const description = input.description?.trim() ?? '';
  const durationMinutes = Math.max(1, Math.round(Number(input.durationMinutes) || 20));
  const equipment = normalizeStringList(input.equipment);
  const tags = normalizeStringList(input.tags);
  const images = normalizeImageList(input.images);
  const now = new Date().toISOString();

  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    const created: OffIcePractice = {
      id: crypto.randomUUID(),
      ownerId: input.ownerId,
      title,
      description,
      durationMinutes,
      equipment,
      tags,
      images,
      createdAt: now,
      updatedAt: now,
    };
    state.offIcePractices.push(created);
    writeFallback(state);
    return created;
  }

  const res = await getPool().query(
    `INSERT INTO off_ice_practices (
      owner_id, title, description, duration_minutes, equipment, tags, images
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
    RETURNING *`,
    [
      input.ownerId,
      title,
      description,
      durationMinutes,
      JSON.stringify(equipment),
      JSON.stringify(tags),
      JSON.stringify(images),
    ]
  );
  return mapRowToOffIcePractice(res.rows[0]);
}

export async function updateOffIcePractice(
  id: string,
  updates: Partial<
    Pick<
      OffIcePractice,
      'title' | 'description' | 'durationMinutes' | 'equipment' | 'tags' | 'images'
    >
  >
): Promise<OffIcePractice | null> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    const idx = state.offIcePractices.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const existing = state.offIcePractices[idx];
    const nextTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
    if (!nextTitle) throw new Error('Title is required');
    const next: OffIcePractice = {
      ...existing,
      title: nextTitle,
      description:
        updates.description !== undefined ? updates.description.trim() : existing.description,
      durationMinutes:
        updates.durationMinutes !== undefined
          ? Math.max(1, Math.round(Number(updates.durationMinutes) || 20))
          : existing.durationMinutes,
      equipment:
        updates.equipment !== undefined
          ? normalizeStringList(updates.equipment)
          : existing.equipment,
      tags:
        updates.tags !== undefined ? normalizeStringList(updates.tags) : existing.tags,
      images:
        updates.images !== undefined
          ? normalizeImageList(updates.images)
          : normalizeImageList(existing.images),
      updatedAt: new Date().toISOString(),
    };
    state.offIcePractices[idx] = next;
    writeFallback(state);
    return next;
  }

  const existing = await getOffIcePracticeById(id);
  if (!existing) return null;
  const nextTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
  if (!nextTitle) throw new Error('Title is required');

  const res = await getPool().query(
    `UPDATE off_ice_practices
     SET title = $2,
         description = $3,
         duration_minutes = $4,
         equipment = $5::jsonb,
         tags = $6::jsonb,
         images = $7::jsonb,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      nextTitle,
      updates.description !== undefined ? updates.description.trim() : existing.description,
      updates.durationMinutes !== undefined
        ? Math.max(1, Math.round(Number(updates.durationMinutes) || 20))
        : existing.durationMinutes,
      JSON.stringify(
        updates.equipment !== undefined
          ? normalizeStringList(updates.equipment)
          : existing.equipment
      ),
      JSON.stringify(
        updates.tags !== undefined ? normalizeStringList(updates.tags) : existing.tags
      ),
      JSON.stringify(
        updates.images !== undefined
          ? normalizeImageList(updates.images)
          : existing.images
      ),
    ]
  );
  if (res.rows.length === 0) return null;
  return mapRowToOffIcePractice(res.rows[0]);
}

export async function deleteOffIcePractice(id: string): Promise<boolean> {
  const { backend } = await ensureDatabaseReady();
  if (backend === 'fallback') {
    const state = readFallback();
    const before = state.offIcePractices.length;
    state.offIcePractices = state.offIcePractices.filter((p) => p.id !== id);
    writeFallback(state);
    return state.offIcePractices.length < before;
  }
  const res = await getPool().query(`DELETE FROM off_ice_practices WHERE id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
