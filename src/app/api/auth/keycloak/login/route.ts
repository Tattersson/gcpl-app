import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { buildKeycloakAuthRedirectUrl } from '@/lib/auth';

export async function GET() {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUrl = await buildKeycloakAuthRedirectUrl(state);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set('gcpl_kc_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return res;
  } catch (err: any) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(err?.message || 'Keycloak redirect failed')}`,
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      )
    );
  }
}
