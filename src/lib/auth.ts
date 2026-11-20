import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { AppUser, KeycloakConfig } from '@/types/planner';
import { getSystemSettings, getUserById } from '@/lib/db';

const SESSION_COOKIE = 'gcpl_session';
const DEFAULT_SECRET = 'gcpl-super-secret-jwt-key-change-in-production';

/**
 * Resolves the JWT signing key. In production a real AUTH_SECRET is mandatory:
 * the default value is public in this repo, so anyone could forge an ADMIN session.
 * Throwing here makes sign/verify fail closed (no session) instead of trusting the default.
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret === DEFAULT_SECRET)) {
    throw new Error('AUTH_SECRET must be set to a non-default value in production.');
  }
  return new TextEncoder().encode(secret || DEFAULT_SECRET);
}

export interface SessionPayload {
  user: AppUser;
  authMode: 'local' | 'keycloak';
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload || typeof payload !== 'object' || !('user' in payload)) {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Session for pages that are public but personalised; null when anonymous. */
export async function getOptionalSession(): Promise<SessionPayload | null> {
  return getServerSession();
}

export type AdminGuardResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

/**
 * Route-handler guard for admin-only writes.
 * The JWT role is only a hint: the user is re-read from the DB so that a demoted
 * or deactivated admin loses write access immediately, not after the 7-day token expires.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const session = await getServerSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }
  const current = await getUserById(session.user.id);
  if (!current || !current.active || current.role !== 'ADMIN') {
    return { ok: false, response: NextResponse.json({ error: 'Administrator access required.' }, { status: 403 }) };
  }
  return { ok: true, session };
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

/**
 * Normalizes a Keycloak issuer URL from Admin Settings.
 * Admins can enter either:
 * - Full realm URL: `https://sso.example.com/realms/gcpl`
 * - Base server URL + Realm field: `https://sso.example.com` + `gcpl`
 */
export function resolveKeycloakEndpoints(config: KeycloakConfig): {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  endSessionEndpoint: string;
  discoveryUrl: string;
} {
  const trimmedUrl = (config.issuerUrl || '').trim().replace(/\/+$/, '');
  const realm = (config.realm || 'master').trim();

  const issuer = trimmedUrl.includes('/realms/')
    ? trimmedUrl
    : `${trimmedUrl}/realms/${realm}`;

  return {
    issuer,
    authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`,
    tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
    userinfoEndpoint: `${issuer}/protocol/openid-connect/userinfo`,
    endSessionEndpoint: `${issuer}/protocol/openid-connect/logout`,
    discoveryUrl: `${issuer}/.well-known/openid-connect-configuration`,
  };
}

/**
 * Builds the dynamic Keycloak OIDC authorization redirect URL using settings stored in PostgreSQL.
 */
export async function buildKeycloakAuthRedirectUrl(state: string): Promise<string> {
  const settings = await getSystemSettings();
  const kc = settings.keycloakConfig;
  if (!kc.issuerUrl || !kc.clientId) {
    throw new Error('Keycloak is enabled, but Issuer URL or Client ID is missing in Admin Settings.');
  }

  const endpoints = resolveKeycloakEndpoints(kc);
  const origin = (kc.publicOrigin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
    /\/+$/,
    ''
  );
  const redirectUri = `${origin}/api/auth/callback/keycloak`;

  const params = new URLSearchParams({
    client_id: kc.clientId,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: redirectUri,
    state,
  });

  return `${endpoints.authorizationEndpoint}?${params.toString()}`;
}
