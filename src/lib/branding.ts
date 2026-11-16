import {
  BrandingConfig,
  MaterialFontPreset,
  MaterialShapePreset,
} from '@/types/planner';

export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  siteName: 'GCPL',
  siteTagline: 'Goalie Coach Practice Planner',
  logoDataUrl: '',
  faviconDataUrl: '',
  useLogoAsFavicon: true,
  showLogoInSharedView: true,
  primaryColor: '#0284c7',
  secondaryColor: '#1e293b',
  accentColor: '#0d9488',
  headerBgColor: '#0f172a',
  headerTextColor: '#ffffff',
  backgroundColor: '#f1f5f9',
  surfaceColor: '#ffffff',
  shapePreset: 'rounded',
  fontPreset: 'roboto',
};

export interface MaterialThemePreset {
  id: string;
  name: string;
  description: string;
  colors: Pick<
    BrandingConfig,
    | 'primaryColor'
    | 'secondaryColor'
    | 'accentColor'
    | 'headerBgColor'
    | 'headerTextColor'
    | 'backgroundColor'
    | 'surfaceColor'
  >;
}

export const MATERIAL_THEME_PRESETS: MaterialThemePreset[] = [
  {
    id: 'material-ice',
    name: 'Material Ice Blue (Default)',
    description: 'Classic goalie crease sky-blue primary with deep slate navy header.',
    colors: {
      primaryColor: '#0284c7',
      secondaryColor: '#1e293b',
      accentColor: '#0d9488',
      headerBgColor: '#0f172a',
      headerTextColor: '#ffffff',
      backgroundColor: '#f1f5f9',
      surfaceColor: '#ffffff',
    },
  },
  {
    id: 'google-royal',
    name: 'Google Material Indigo',
    description: 'Google Material 3 cobalt blue primary with indigo & violet accents.',
    colors: {
      primaryColor: '#1a73e8',
      secondaryColor: '#1e3a8a',
      accentColor: '#7c3aed',
      headerBgColor: '#0f172a',
      headerTextColor: '#ffffff',
      backgroundColor: '#f8fafc',
      surfaceColor: '#ffffff',
    },
  },
  {
    id: 'crimson-arena',
    name: 'Crimson Goal Line',
    description: 'Championship arena red primary with charcoal secondary and amber highlights.',
    colors: {
      primaryColor: '#dc2626',
      secondaryColor: '#18181b',
      accentColor: '#d97706',
      headerBgColor: '#18181b',
      headerTextColor: '#ffffff',
      backgroundColor: '#f4f4f5',
      surfaceColor: '#ffffff',
    },
  },
  {
    id: 'emerald-rink',
    name: 'Emerald Pro Club',
    description: 'Forest emerald primary with deep slate-green header and cyan alternatives.',
    colors: {
      primaryColor: '#059669',
      secondaryColor: '#064e3b',
      accentColor: '#0284c7',
      headerBgColor: '#022c22',
      headerTextColor: '#ffffff',
      backgroundColor: '#f0fdf4',
      surfaceColor: '#ffffff',
    },
  },
  {
    id: 'midnight-gold',
    name: 'Midnight & Gold',
    description: 'Championship gold/amber primary with obsidian navy surfaces.',
    colors: {
      primaryColor: '#d97706',
      secondaryColor: '#1e293b',
      accentColor: '#2563eb',
      headerBgColor: '#090d16',
      headerTextColor: '#ffffff',
      backgroundColor: '#f8fafc',
      surfaceColor: '#ffffff',
    },
  },
  {
    id: 'royal-purple',
    name: 'Royal Violet',
    description: 'Material 3 deep purple primary with magenta/teal alternative accents.',
    colors: {
      primaryColor: '#6d28d9',
      secondaryColor: '#312e81',
      accentColor: '#db2777',
      headerBgColor: '#1e1b4b',
      headerTextColor: '#ffffff',
      backgroundColor: '#f5f3ff',
      surfaceColor: '#ffffff',
    },
  },
];

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_REGEX.test(value.trim());
}

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (!isValidHexColor(value)) return fallback;
  const raw = value.trim().toLowerCase();
  if (raw.length === 4) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return raw;
}

export function sanitizeImageDataUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  // Allow data:image/* base64 or utf8 data URLs, or valid http(s)/relative image paths
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return '';
}

export function normalizeBrandingConfig(
  input?: Partial<BrandingConfig> | null
): BrandingConfig {
  const src = input ?? {};
  const validShapes: MaterialShapePreset[] = ['sharp', 'rounded', 'pill'];
  const validFonts: MaterialFontPreset[] = ['roboto', 'inter', 'system'];

  const siteName =
    typeof src.siteName === 'string' && src.siteName.trim().length > 0
      ? src.siteName.trim().slice(0, 60)
      : DEFAULT_BRANDING_CONFIG.siteName;

  const siteTagline =
    typeof src.siteTagline === 'string'
      ? src.siteTagline.trim().slice(0, 120)
      : DEFAULT_BRANDING_CONFIG.siteTagline;

  return {
    siteName,
    siteTagline,
    logoDataUrl: sanitizeImageDataUrl(src.logoDataUrl),
    faviconDataUrl: sanitizeImageDataUrl(src.faviconDataUrl),
    useLogoAsFavicon:
      typeof src.useLogoAsFavicon === 'boolean'
        ? src.useLogoAsFavicon
        : DEFAULT_BRANDING_CONFIG.useLogoAsFavicon,
    showLogoInSharedView:
      typeof src.showLogoInSharedView === 'boolean'
        ? src.showLogoInSharedView
        : DEFAULT_BRANDING_CONFIG.showLogoInSharedView,
    primaryColor: normalizeHexColor(
      src.primaryColor,
      DEFAULT_BRANDING_CONFIG.primaryColor
    ),
    secondaryColor: normalizeHexColor(
      src.secondaryColor,
      DEFAULT_BRANDING_CONFIG.secondaryColor
    ),
    accentColor: normalizeHexColor(
      src.accentColor,
      DEFAULT_BRANDING_CONFIG.accentColor
    ),
    headerBgColor: normalizeHexColor(
      src.headerBgColor,
      DEFAULT_BRANDING_CONFIG.headerBgColor
    ),
    headerTextColor: normalizeHexColor(
      src.headerTextColor,
      DEFAULT_BRANDING_CONFIG.headerTextColor
    ),
    backgroundColor: normalizeHexColor(
      src.backgroundColor,
      DEFAULT_BRANDING_CONFIG.backgroundColor
    ),
    surfaceColor: normalizeHexColor(
      src.surfaceColor,
      DEFAULT_BRANDING_CONFIG.surfaceColor
    ),
    shapePreset:
      src.shapePreset && validShapes.includes(src.shapePreset)
        ? src.shapePreset
        : DEFAULT_BRANDING_CONFIG.shapePreset,
    fontPreset:
      src.fontPreset && validFonts.includes(src.fontPreset)
        ? src.fontPreset
        : DEFAULT_BRANDING_CONFIG.fontPreset,
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = normalizeHexColor(hex, '#0284c7').slice(1);
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

function mixColors(
  base: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  weight: number
): { r: number; g: number; b: number } {
  return {
    r: Math.round(base.r * (1 - weight) + target.r * weight),
    g: Math.round(base.g * (1 - weight) + target.g * weight),
    b: Math.round(base.b * (1 - weight) + target.b * weight),
  };
}

export type TonalStop =
  | '50'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | '950';

export interface TonalShade {
  hex: string;
  rgbChannels: string; // e.g., "2 132 199" for Tailwind rgb(var(--...) / <alpha-value>)
}

/**
 * Generates a full 50..950 Material-style tonal palette from a single base hex color.
 * The base color anchors around stop 600, with lighter tints mixed toward white
 * and darker shades mixed toward deep obsidian.
 */
export function generateTonalPalette(
  baseHex: string
): Record<TonalStop, TonalShade> {
  const base = hexToRgb(baseHex);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 10, g: 15, b: 28 };

  const rawMap: Record<TonalStop, { r: number; g: number; b: number }> = {
    '50': mixColors(base, white, 0.92),
    '100': mixColors(base, white, 0.84),
    '200': mixColors(base, white, 0.68),
    '300': mixColors(base, white, 0.48),
    '400': mixColors(base, white, 0.26),
    '500': mixColors(base, white, 0.1),
    '600': base,
    '700': mixColors(base, black, 0.18),
    '800': mixColors(base, black, 0.36),
    '900': mixColors(base, black, 0.54),
    '950': mixColors(base, black, 0.72),
  };

  const result = {} as Record<TonalStop, TonalShade>;
  for (const stop of Object.keys(rawMap) as TonalStop[]) {
    const { r, g, b } = rawMap[stop];
    result[stop] = {
      hex: rgbToHex(r, g, b),
      rgbChannels: `${r} ${g} ${b}`,
    };
  }
  return result;
}

export function getContrastText(hex: string): '#ffffff' | '#0f172a' {
  const { r, g, b } = hexToRgb(hex);
  // Relative luminance perception
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#0f172a' : '#ffffff';
}

export function resolveEffectiveFavicon(config: BrandingConfig): string | null {
  if (config.useLogoAsFavicon && config.logoDataUrl) {
    return config.logoDataUrl;
  }
  if (config.faviconDataUrl) {
    return config.faviconDataUrl;
  }
  if (config.logoDataUrl) {
    return config.logoDataUrl;
  }
  return null;
}

export function buildBrandingCssVariables(
  rawConfig?: Partial<BrandingConfig> | null
): Record<string, string> {
  const config = normalizeBrandingConfig(rawConfig);
  const primaryPalette = generateTonalPalette(config.primaryColor);
  const secondaryPalette = generateTonalPalette(config.secondaryColor);
  const accentPalette = generateTonalPalette(config.accentColor);

  const vars: Record<string, string> = {
    '--brand-primary': config.primaryColor,
    '--brand-primary-contrast': getContrastText(config.primaryColor),
    '--brand-secondary': config.secondaryColor,
    '--brand-secondary-contrast': getContrastText(config.secondaryColor),
    '--brand-accent': config.accentColor,
    '--brand-accent-contrast': getContrastText(config.accentColor),
    '--brand-header-bg': config.headerBgColor,
    '--brand-header-text': config.headerTextColor,
    '--brand-bg': config.backgroundColor,
    '--brand-surface': config.surfaceColor,
    '--brand-radius':
      config.shapePreset === 'sharp'
        ? '4px'
        : config.shapePreset === 'pill'
        ? '20px'
        : '12px',
    '--brand-font':
      config.fontPreset === 'inter'
        ? '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif'
        : config.fontPreset === 'system'
        ? 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        : '"Roboto", "Segoe UI", ui-sans-serif, system-ui, -apple-system, sans-serif',
  };

  for (const [stop, shade] of Object.entries(primaryPalette)) {
    vars[`--brand-primary-${stop}`] = shade.hex;
    vars[`--brand-primary-${stop}-rgb`] = shade.rgbChannels;
  }
  for (const [stop, shade] of Object.entries(secondaryPalette)) {
    vars[`--brand-secondary-${stop}`] = shade.hex;
    vars[`--brand-secondary-${stop}-rgb`] = shade.rgbChannels;
  }
  for (const [stop, shade] of Object.entries(accentPalette)) {
    vars[`--brand-accent-${stop}`] = shade.hex;
    vars[`--brand-accent-${stop}-rgb`] = shade.rgbChannels;
  }

  return vars;
}
