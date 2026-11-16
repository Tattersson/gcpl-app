import type { Config } from 'tailwindcss';

const primaryStops = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;

function buildCssVarScale(prefix: string) {
  const scale: Record<string, string> = {};
  for (const stop of primaryStops) {
    scale[stop] = `rgb(var(--${prefix}-${stop}-rgb) / <alpha-value>)`;
  }
  return scale;
}

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic instance-wide Primary brand palette mapped to `sky-*` and `brand-primary-*`
        sky: buildCssVarScale('brand-primary'),
        'brand-primary': buildCssVarScale('brand-primary'),
        'brand-secondary': buildCssVarScale('brand-secondary'),
        'brand-accent': buildCssVarScale('brand-accent'),
        teal: buildCssVarScale('brand-accent'),
        ice: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          500: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        rink: {
          red: '#dc2626',
          blue: '#2563eb',
          crease: '#93c5fd',
        },
      },
    },
  },
  plugins: [],
};

export default config;
