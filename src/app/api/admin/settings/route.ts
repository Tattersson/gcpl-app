import { NextRequest, NextResponse } from 'next/server';
import { getSystemSettings, updateSystemSettings } from '@/lib/db';
import { getOptionalSession, requireAdmin, resolveKeycloakEndpoints } from '@/lib/auth';

export async function GET() {
  const session = await getOptionalSession();
  const settings = await getSystemSettings();

  // Unauthenticated or non-admin callers receive public auth mode and instance branding (no Keycloak secrets)
  if (session?.user.role !== 'ADMIN') {
    return NextResponse.json({
      authMode: settings.authMode,
      dbBackend: settings.dbBackend,
      brandingConfig: settings.brandingConfig,
      keycloakConfigured: Boolean(
        settings.keycloakConfig.issuerUrl && settings.keycloakConfig.clientId
      ),
    });
  }

  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const { authMode, keycloakConfig, brandingConfig } = body;

    if (authMode === 'keycloak') {
      const targetIssuer =
        keycloakConfig?.issuerUrl ??
        (await getSystemSettings()).keycloakConfig.issuerUrl;
      const targetClientId =
        keycloakConfig?.clientId ??
        (await getSystemSettings()).keycloakConfig.clientId;
      if (!targetIssuer || !targetClientId) {
        return NextResponse.json(
          { error: 'Keycloak Server/Issuer URL and Client ID are required to enable Keycloak mode.' },
          { status: 400 }
        );
      }
    }

    const updated = await updateSystemSettings({
      authMode,
      keycloakConfig,
      brandingConfig,
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update system settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Test Keycloak OIDC Discovery Connection before or after saving
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const endpoints = resolveKeycloakEndpoints(body.keycloakConfig || {});
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    try {
      const res = await fetch(endpoints.discoveryUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return NextResponse.json(
          {
            reachable: false,
            discoveryUrl: endpoints.discoveryUrl,
            message: `Keycloak returned HTTP ${res.status} at ${endpoints.discoveryUrl}`,
          },
          { status: 200 }
        );
      }
      const data = await res.json();
      return NextResponse.json({
        reachable: true,
        discoveryUrl: endpoints.discoveryUrl,
        issuer: data.issuer || endpoints.issuer,
        message: `Connected to Keycloak realm (${data.issuer || endpoints.issuer})`,
      });
    } catch (fetchErr: any) {
      clearTimeout(timer);
      return NextResponse.json({
        reachable: false,
        discoveryUrl: endpoints.discoveryUrl,
        message: `Could not reach ${endpoints.discoveryUrl}: ${fetchErr?.message || 'Network error'}`,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to test Keycloak connection' },
      { status: 500 }
    );
  }
}
