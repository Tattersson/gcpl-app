import { NextRequest, NextResponse } from 'next/server';
import {
  createUser,
  getSystemSettings,
  getUserCount,
  updateSystemSettings,
} from '@/lib/db';
import {
  createSessionToken,
  getSessionCookieName,
  hashPassword,
} from '@/lib/auth';

export async function GET() {
  const userCount = await getUserCount();
  const settings = await getSystemSettings();
  return NextResponse.json({
    needsSetup: userCount === 0,
    authMode: settings.authMode,
    dbBackend: settings.dbBackend,
    brandingConfig: settings.brandingConfig,
  });
}

export async function POST(req: NextRequest) {
  try {
    const userCount = await getUserCount();
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Initial setup has already been completed.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, email, password, enableKeycloak, keycloakConfig } = body;

    if (!name || !email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Name, email, and a password of at least 6 characters are required.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const adminUser = await createUser({
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      authProvider: 'local',
    });

    if (enableKeycloak && keycloakConfig?.issuerUrl && keycloakConfig?.clientId) {
      await updateSystemSettings({
        authMode: 'keycloak',
        keycloakConfig,
      });
    }

    const token = await createSessionToken({
      user: adminUser,
      authMode: enableKeycloak ? 'keycloak' : 'local',
    });

    const res = NextResponse.json({ user: adminUser });
    res.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to complete setup' },
      { status: 500 }
    );
  }
}
