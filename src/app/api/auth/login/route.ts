import { NextRequest, NextResponse } from 'next/server';
import {
  findUserByEmailWithSecret,
  getSystemSettings,
} from '@/lib/db';
import {
  buildKeycloakAuthRedirectUrl,
  createSessionToken,
  getSessionCookieName,
  verifyPassword,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, emergencyLocalAdmin } = body;
    const settings = await getSystemSettings();

    // If Keycloak is configured and enabled, only allow Keycloak login unless emergency admin recovery is triggered
    if (settings.authMode === 'keycloak' && !emergencyLocalAdmin) {
      const redirectUrl = await buildKeycloakAuthRedirectUrl('kc_login');
      return NextResponse.json(
        {
          authMode: 'keycloak',
          redirectUrl,
          error: 'Keycloak authentication is active. Redirecting to Keycloak SSO...',
        },
        { status: 403 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const user = await findUserByEmailWithSecret(email);
    if (!user || !user.active || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    if (emergencyLocalAdmin && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Emergency local login is restricted to ADMIN accounts.' },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const { passwordHash: _ph, keycloakSub: _ks, ...publicUser } = user;
    const token = await createSessionToken({
      user: publicUser,
      authMode: 'local',
    });

    const res = NextResponse.json({ user: publicUser });
    res.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
