import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import {
  getSystemSettings,
   getUserCount,
  listPracticePlans,
} from '@/lib/db';
import { RINK_PRESETS } from '@/lib/rinkConfig';
import Navbar from '@/components/Navbar';
import {
  PlusCircle,
  Calendar,
  Clock,
  Shield,
  Users,
  Share2,
  Edit3,
  Layers,
  Settings,
  Dumbbell,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const userCount = await getUserCount();
  if (userCount === 0) {
    redirect('/setup');
  }

  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const [plans, settings] = await Promise.all([
    listPracticePlans(),
    getSystemSettings(),
  ]);
  const branding = settings.brandingConfig;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: branding.backgroundColor }}
    >
      <Navbar user={session.user} authMode={settings.authMode} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Hero / Quick Action Bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 p-6 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${branding.headerBgColor} 0%, ${branding.secondaryColor} 55%, ${branding.primaryColor} 100%)`,
            borderRadius: 'var(--brand-radius, 16px)',
          }}
        >
          <div>
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-200">
              {branding.siteName} • {branding.siteTagline || 'Goalie Coach Workspace'}
            </span>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Ice Hockey Goalie Practice Plans
            </h1>
            <p className="mt-1 text-xs text-slate-200 sm:text-sm">
              Design multi-drill goalie sessions across Full, Half, 1/3, Crease, and Corner rink views with per-player animated paths &amp; keyframes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {session.user.role === 'ADMIN' && (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-xl border border-white/25 bg-black/25 px-4 py-2.5 text-xs font-bold text-white hover:bg-black/40 transition"
              >
                <Settings className="h-4 w-4 text-sky-300" />
                Admin, Branding &amp; Keycloak
              </Link>
            )}
            <Link
              href="/off-ice"
              className="flex items-center gap-2 rounded-xl border border-white/25 bg-black/25 px-4 py-2.5 text-xs font-bold text-white hover:bg-black/40 transition"
            >
              <Dumbbell className="h-4 w-4 text-sky-300" />
              Off-Ice Practices
            </Link>
            <Link
              href="/plans/new"
              className="mui-btn-contained flex items-center gap-2 px-5 py-2.5 text-sm shadow-md"
            >
              <PlusCircle className="h-4 w-4" />
              Launch New Practice Wizard
            </Link>
          </div>
        </div>

        {/* Practice Plans Grid */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Saved Practice Plans ({plans.length})
            </h2>
          </div>

          {plans.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
              <Shield className="mx-auto h-10 w-10 text-sky-600" />
              <h3 className="mt-3 text-base font-bold text-slate-900">
                No Practice Plans Yet
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Use the Practice Setup Wizard to appoint your goalies & players, pick your rink size, and start drawing animated drills.
              </p>
              <Link
                href="/plans/new"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-500"
              >
                <PlusCircle className="h-4 w-4" />
                Create First Practice Plan
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const preset =
                  RINK_PRESETS[plan.defaultRinkType] || RINK_PRESETS.full;
                const firstDrill = plan.drills[0];

                return (
                  <div
                    key={plan.id}
                    className="mui-card-elevated flex flex-col justify-between overflow-hidden transition hover:shadow-md"
                  >
                    <div>
                      {/* Static Diagram Thumbnail Preview */}
                      {firstDrill?.snapshotDataUrl && (
                        <div className="relative border-b border-slate-100 bg-slate-50 p-3">
                          <img
                            src={firstDrill.snapshotDataUrl}
                            alt={plan.title}
                            className="h-40 w-full object-contain"
                          />
                          <span className="absolute right-3 top-3 rounded-md bg-slate-900/80 px-2.5 py-0.5 text-[11px] font-bold text-white">
                            {preset.shortLabel}
                          </span>
                        </div>
                      )}

                      <div className="p-5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-sky-600" />
                            {plan.practiceDate}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-sky-600" />
                            {plan.durationMinutes} min
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Layers className="h-3.5 w-3.5 text-sky-600" />
                            {plan.drills.length} {plan.drills.length === 1 ? 'Drill' : 'Drills'}
                          </span>
                        </div>

                        <h3 className="mt-2 text-lg font-bold text-slate-900 line-clamp-1">
                          {plan.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                          {plan.description || 'No session description provided.'}
                        </p>

                        {/* Appointed Roster Badges */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 border border-sky-200">
                            <Shield className="h-3 w-3" />
                            {plan.rosterConfig.goalies} Goalies
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                            <Users className="h-3 w-3" />
                            {plan.rosterConfig.skaters} Players
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            View: {plan.viewConfig.layout.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                      <Link
                        href={`/plans/${plan.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-500 transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Open Planner
                      </Link>

                      <Link
                        href={`/share/${plan.shareToken}`}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <Share2 className="h-3.5 w-3.5 text-sky-600" />
                        Shared View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
