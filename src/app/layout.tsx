import type { Metadata } from 'next';
import './globals.css';
import { getSystemSettings } from '@/lib/db';
import {
  DEFAULT_BRANDING_CONFIG,
  buildBrandingCssVariables,
  normalizeBrandingConfig,
  resolveEffectiveFavicon,
} from '@/lib/branding';
import { BrandingProvider } from '@/components/BrandingProvider';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSystemSettings();
    const branding = normalizeBrandingConfig(settings.brandingConfig);
    const faviconUrl = resolveEffectiveFavicon(branding);

    const title = branding.siteTagline
      ? `${branding.siteName} — ${branding.siteTagline}`
      : branding.siteName;

    return {
      title,
      description:
        'Plan, animate, customize, and share ice hockey goalie practice sessions with multi-rink views and Keycloak authentication.',
      ...(faviconUrl
        ? {
            icons: {
              icon: faviconUrl,
              shortcut: faviconUrl,
              apple: faviconUrl,
            },
          }
        : {}),
    };
  } catch {
    return {
      title: 'GCPL — Ice Hockey Goalie Practice Planner',
      description:
        'Plan, animate, customize, and share ice hockey goalie practice sessions with multi-rink views and Keycloak authentication.',
    };
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let branding = DEFAULT_BRANDING_CONFIG;
  try {
    const settings = await getSystemSettings();
    branding = normalizeBrandingConfig(settings.brandingConfig);
  } catch {
    // Fallback to defaults if DB not yet initialized
  }

  const cssVars = buildBrandingCssVariables(branding);

  return (
    <html lang="en" style={cssVars as React.CSSProperties}>
      <body
        className="min-h-screen text-slate-900 antialiased"
        style={{
          backgroundColor: 'var(--brand-bg, #f1f5f9)',
          fontFamily: 'var(--brand-font)',
        }}
      >
        <BrandingProvider initialBranding={branding}>
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
