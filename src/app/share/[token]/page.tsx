import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPracticePlanByShareToken, getSystemSettings } from '@/lib/db';
import PlanCustomViewRenderer from '@/components/planner/PlanCustomViewRenderer';
import { BrandLogo } from '@/components/BrandingProvider';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SharedPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [plan, settings] = await Promise.all([
    getPracticePlanByShareToken(token),
    getSystemSettings(),
  ]);

  if (!plan) {
    notFound();
  }

  const branding = settings.brandingConfig;

  return (
    <div
      className="min-h-screen pb-16"
      style={{ backgroundColor: branding.backgroundColor }}
    >
      {/* Top Shared View Bar */}
      <header
        className="border-b border-black/15 shadow"
        style={{
          backgroundColor: branding.headerBgColor || '#0f172a',
          color: branding.headerTextColor || '#ffffff',
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {branding.showLogoInSharedView && (
              <BrandLogo size="sm" overrideBranding={branding} />
            )}
            <div className="min-w-0">
              <span className="text-sm font-bold">
                {branding.siteName} Shared Practice Plan
              </span>
              <span className="ml-2 hidden rounded bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-300 sm:inline-block">
                {branding.siteTagline || 'Image • Description • 0.5x / 1x / 2x Animation'}
              </span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Coach Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        <PlanCustomViewRenderer plan={plan} />
      </main>
    </div>
  );
}
