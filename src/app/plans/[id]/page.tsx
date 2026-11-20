import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOptionalSession } from '@/lib/auth';
import { getPracticePlanById, getSystemSettings } from '@/lib/db';
import { toPublicPlan } from '@/lib/publicDto';
import PlanCustomViewRenderer from '@/components/planner/PlanCustomViewRenderer';
import { BrandLogo } from '@/components/BrandingProvider';
import { ArrowLeft, Edit3 } from 'lucide-react';

export const dynamic = 'force-dynamic';

// Public read-only view of a practice plan. Editing lives at /plans/[id]/edit (administrators only).
export default async function PlanViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [plan, settings, session] = await Promise.all([
    getPracticePlanById(id),
    getSystemSettings(),
    getOptionalSession(),
  ]);

  if (!plan) {
    notFound();
  }

  const isAdmin = session?.user.role === 'ADMIN';
  const branding = settings.brandingConfig;

  return (
    <div
      className="min-h-screen pb-16"
      style={{ backgroundColor: branding.backgroundColor }}
    >
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
              <span className="text-sm font-bold">{plan.title}</span>
              <span className="ml-2 hidden rounded bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-300 sm:inline-block">
                {branding.siteName} Practice Library
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <Link
                href={`/plans/${plan.id}/edit`}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Plan
              </Link>
            )}
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Practice Library
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        <PlanCustomViewRenderer plan={toPublicPlan(plan)} />
      </main>
    </div>
  );
}
