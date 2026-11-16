import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import {
  getOffIcePracticeById,
  getSystemSettings,
  getUserCount,
} from '@/lib/db';
import Navbar from '@/components/Navbar';
import {
  ArrowLeft,
  Clock,
  Dumbbell,
  Edit3,
  Image as ImageIcon,
  Tag,
  Wrench,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OffIceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userCount = await getUserCount();
  if (userCount === 0) {
    redirect('/setup');
  }

  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const [practice, settings] = await Promise.all([
    getOffIcePracticeById(id),
    getSystemSettings(),
  ]);

  if (!practice) {
    notFound();
  }

  const branding = settings.brandingConfig;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: branding.backgroundColor }}
    >
      <Navbar user={session.user} authMode={settings.authMode} />

      <main className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-8 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/off-ice"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Off-Ice Practices</span>
          </Link>
          <Link
            href={`/off-ice?edit=${practice.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition"
          >
            <Edit3 className="h-4 w-4" />
            Edit Practice
          </Link>
        </div>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 p-4 text-white sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-300">
                <Dumbbell className="h-3.5 w-3.5" />
                Off-Ice Goalie Practice
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1 text-xs font-bold text-white">
                <Clock className="h-3.5 w-3.5 text-sky-300" />
                {practice.durationMinutes} min
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
              {practice.title}
            </h1>

            {practice.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {practice.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-sky-100"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
            {practice.equipment.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <Wrench className="h-4 w-4 text-sky-600" />
                  Required Equipment
                </h2>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {practice.equipment.map((item) => (
                    <span
                      key={item}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Moves, Sets / Reps &amp; Goalie Coaching Points
              </h2>
              <div className="mt-3 whitespace-pre-line text-sm sm:text-base leading-relaxed text-slate-800">
                {practice.description || 'No description provided.'}
              </div>
            </section>

            {practice.images.length > 0 && (
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <ImageIcon className="h-4 w-4 text-sky-600" />
                  Visual Guides &amp; Reference Images ({practice.images.length})
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {practice.images.map((src, idx) => (
                    <a
                      key={`${idx}-${src.slice(0, 32)}`}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition hover:shadow-md"
                      title="Open full-size image"
                    >
                      <img
                        src={src}
                        alt={`${practice.title} visual guide ${idx + 1}`}
                        className="max-h-96 w-full object-contain bg-white p-2 transition group-hover:scale-[1.01]"
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
