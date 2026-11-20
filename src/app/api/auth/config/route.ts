import { NextResponse } from 'next/server';
import { getSystemSettings, isSetupComplete } from '@/lib/db';

/**
 * Public, non-secret login configuration: which sign-in mode to show and instance branding.
 * Kept separate from /api/setup, which disappears once first-time setup is locked.
 */
export async function GET() {
  const [settings, setupComplete] = await Promise.all([getSystemSettings(), isSetupComplete()]);
  return NextResponse.json({
    setupRequired: !setupComplete,
    authMode: settings.authMode,
    brandingConfig: settings.brandingConfig,
    keycloakConfigured: Boolean(settings.keycloakConfig.issuerUrl && settings.keycloakConfig.clientId),
    // Tells the setup form to ask for the SETUP_TOKEN; the secret itself is never sent.
    setupTokenRequired: Boolean(process.env.SETUP_TOKEN),
  });
}
