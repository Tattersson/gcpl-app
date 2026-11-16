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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            {branding.showLogoInSharedView && (
              <BrandLogo size="sm" overrideBranding={branding} />
            )}
            <div>
              <span className="text-sm font-bold">
                {branding.siteName} Shared Practice Plan
              </span>
              <span className="ml-2 rounded bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                {branding.siteTagline || 'Image • Description • 0.5x / 1x / 2x Animation'}
              </span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Coach Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <PlanCustomViewRenderer plan={plan} />
      </main>
    </div>
  );
}
