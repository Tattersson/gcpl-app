'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Shield } from 'lucide-react';
import { BrandingConfig } from '@/types/planner';
import {
  DEFAULT_BRANDING_CONFIG,
  buildBrandingCssVariables,
  normalizeBrandingConfig,
  resolveEffectiveFavicon,
} from '@/lib/branding';

interface BrandingContextValue {
  branding: BrandingConfig;
  setBrandingPreview: (next: Partial<BrandingConfig>) => void;
  replaceBranding: (next: BrandingConfig) => void;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING_CONFIG,
  setBrandingPreview: () => {},
  replaceBranding: () => {},
  refreshBranding: async () => {},
});

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}

const DEFAULT_SVG_FAVICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#0284c7"/>
      <path d="M32 10 L50 18 V32 C50 44 42 52 32 56 C22 52 14 44 14 32 V18 Z" fill="#ffffff"/>
    </svg>`
  );

export function BrandingProvider({
  initialBranding,
  children,
}: {
  initialBranding: BrandingConfig;
  children: React.ReactNode;
}) {
  const [branding, setBranding] = useState<BrandingConfig>(() =>
    normalizeBrandingConfig(initialBranding)
  );

  // Sync when server-rendered initialBranding updates
  useEffect(() => {
    setBranding(normalizeBrandingConfig(initialBranding));
  }, [initialBranding]);

  // Apply CSS variables, document title, and favicon dynamically in browser
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const vars = buildBrandingCssVariables(branding);
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
    }

    // Update page title with siteName & siteTagline
    const desiredTitle = branding.siteTagline
      ? `${branding.siteName} — ${branding.siteTagline}`
      : branding.siteName;
    if (desiredTitle && document.title !== desiredTitle) {
      document.title = desiredTitle;
    }

    // Update favicon link elements dynamically
    const effectiveFavicon =
      resolveEffectiveFavicon(branding) || DEFAULT_SVG_FAVICON;

    const relTypes = ['icon', 'shortcut icon', 'apple-touch-icon'];
    for (const rel of relTypes) {
      let link = document.querySelector(
        `link[rel="${rel}"]`
      ) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = rel;
        document.head.appendChild(link);
      }
      if (link.href !== effectiveFavicon) {
        link.href = effectiveFavicon;
      }
    }
  }, [branding]);

  const setBrandingPreview = useCallback((next: Partial<BrandingConfig>) => {
    setBranding((prev) => normalizeBrandingConfig({ ...prev, ...next }));
  }, []);

  const replaceBranding = useCallback((next: BrandingConfig) => {
    setBranding(normalizeBrandingConfig(next));
  }, []);

  const refreshBranding = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.brandingConfig) {
          setBranding(normalizeBrandingConfig(data.brandingConfig));
        }
      }
    } catch {
      // Ignore network errors
    }
  }, []);

  const value = useMemo(
    () => ({
      branding,
      setBrandingPreview,
      replaceBranding,
      refreshBranding,
    }),
    [branding, setBrandingPreview, replaceBranding, refreshBranding]
  );

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  overrideBranding?: Partial<BrandingConfig>;
  className?: string;
}

export function BrandLogo({
  size = 'md',
  overrideBranding,
  className = '',
}: BrandLogoProps) {
  const { branding: contextBranding } = useBranding();
  const active = overrideBranding
    ? normalizeBrandingConfig({ ...contextBranding, ...overrideBranding })
    : contextBranding;

  const sizeClasses =
    size === 'sm'
      ? 'h-8 w-8 rounded-lg'
      : size === 'lg'
      ? 'h-12 w-12 rounded-xl'
      : 'h-9 w-9 rounded-lg';

  const iconClasses =
    size === 'sm'
      ? 'h-4 w-4'
      : size === 'lg'
      ? 'h-7 w-7'
      : 'h-5 w-5';

  if (active.logoDataUrl) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden bg-white/95 p-0.5 shadow-sm ring-1 ring-black/10 ${sizeClasses} ${className}`}
        style={{ borderRadius: 'var(--brand-radius, 10px)' }}
      >
        <img
          src={active.logoDataUrl}
          alt={`${active.siteName} logo`}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center font-bold shadow-sm ${sizeClasses} ${className}`}
      style={{
        backgroundColor: active.primaryColor,
        color: '#ffffff',
        borderRadius: 'var(--brand-radius, 10px)',
      }}
    >
      <Shield className={iconClasses} />
    </div>
  );
}
