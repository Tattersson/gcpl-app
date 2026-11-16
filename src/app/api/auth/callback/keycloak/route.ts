import { NextRequest, NextResponse } from 'next/server';
import { getSystemSettings, upsertKeycloakUser } from '@/lib/db';
import {
  createSessionToken,
  getSessionCookieName,
  resolveKeycloakEndpoints,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  const settings = await getSystemSettings();
  const kc = settings.keycloakConfig;
  const origin = (
    kc.publicOrigin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin
  ).replace(/\/+$/, '');

  const code = req.nextUrl.searchParams.get('code');
  const errorParam = req.nextUrl.searchParams.get('error_description') || req.nextUrl.searchParams.get('error');

  if (errorParam || !code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorParam || 'Missing authorization code from Keycloak')}`
    );
  }

  try {
    const endpoints = resolveKeycloakEndpoints(kc);
    const redirectUri = `${origin}/api/auth/callback/keycloak`;

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: kc.clientId,
      code,
      redirect_uri: redirectUri,
    });
    if (kc.clientSecret) {
      tokenParams.set('client_secret', kc.clientSecret);
    }

    const tokenRes = await fetch(endpoints.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`Keycloak token exchange failed (${tokenRes.status}): ${text.slice(0, 160)}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string;

    const userRes = await fetch(endpoints.userinfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      throw new Error(`Keycloak userinfo fetch failed (${userRes.status})`);
    }

    const profile = await userRes.json();
    const roles: string[] =
      profile?.realm_access?.roles ||
      profile?.roles ||
      [];

    const appUser = await upsertKeycloakUser({
      sub: profile.sub,
      email: profile.email || `${profile.preferred_username || 'user'}@keycloak.local`,
      name: profile.name || profile.preferred_username || 'Keycloak Coach',
      roles,
    });

    const sessionToken = await createSessionToken({
      user: appUser,
      authMode: 'keycloak',
    });

    const res = NextResponse.redirect(`${origin}/dashboard`);
    res.cookies.set(getSessionCookieName(), sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: any) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(err?.message || 'Keycloak callback failed')}`
    );
  }
}
