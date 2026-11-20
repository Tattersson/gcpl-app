import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  completeInitialSetup,
  getSystemSettings,
  isSetupComplete,
} from '@/lib/db';
import {
  createSessionToken,
  getSessionCookieName,
  hashPassword,
} from '@/lib/auth';

// Once setup has completed this endpoint behaves as if it does not exist.
const LOCKED = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

/** Constant-time comparison for the optional SETUP_TOKEN gate. */
function tokenMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET() {
  if (await isSetupComplete()) return LOCKED();

  const settings = await getSystemSettings();
  return NextResponse.json({
    needsSetup: true,
    authMode: settings.authMode,
    dbBackend: settings.dbBackend,
    brandingConfig: settings.brandingConfig,
  });
}

export async function POST(req: NextRequest) {
  try {
    if (await isSetupComplete()) return LOCKED();

    const body = await req.json();
    const { name, email, password, enableKeycloak, keycloakConfig, setupToken } = body;

    // Optional: when SETUP_TOKEN is configured, first-run setup requires it.
    // Stops the first visitor of a fresh deployment from claiming the instance.
    const requiredToken = process.env.SETUP_TOKEN;
    if (requiredToken && !tokenMatches(setupToken, requiredToken)) {
      return NextResponse.json({ error: 'A valid setup token is required.' }, { status: 403 });
    }

    if (!name || !email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Name, email, and a password of at least 6 characters are required.' },
        { status: 400 }
      );
    }

    const currentSettings = await getSystemSettings();
    const useKeycloak = Boolean(enableKeycloak && keycloakConfig?.issuerUrl && keycloakConfig?.clientId);
    const authMode = useKeycloak ? 'keycloak' : 'local';
    const mergedKeycloakConfig = useKeycloak
      ? { ...currentSettings.keycloakConfig, ...keycloakConfig }
      : currentSettings.keycloakConfig;

    const passwordHash = await hashPassword(password);
    const adminUser = await completeInitialSetup({
      name,
      email,
      passwordHash,
      authMode,
      keycloakConfig: mergedKeycloakConfig,
    });
    // Null means another request completed setup first.
    if (!adminUser) return LOCKED();

    const token = await createSessionToken({
      user: adminUser,
      authMode,
    });

    const res = NextResponse.json({ user: adminUser });
    res.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Failed to complete setup' }, { status: 500 });
  }
}
