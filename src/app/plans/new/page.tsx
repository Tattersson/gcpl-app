'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PlaybackSpeed,
  RinkType,
  ViewLayoutPreset,
} from '@/types/planner';
import { RINK_PRESETS, DEFAULT_VIEW_CONFIG } from '@/lib/rinkConfig';
import { BrandLogo, useBranding } from '@/components/BrandingProvider';
import {
  Shield,
  Users,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Layout,
  Maximize2,
} from 'lucide-react';

export default function NewPlanWizardPage() {
  const router = useRouter();
  const { branding } = useBranding();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Basics
  const [title, setTitle] = useState('Goalie Crease Footwork & High-Traffic Tracking');
  const [practiceDate, setPracticeDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [description, setDescription] = useState(
    'Dedicated goalie ice focusing on crisp T-pushes, royal-road pass tracking, RVH post integration, and controlled low-pad rebound placement.'
  );

  // Step 2: Rink Selection
  const [defaultRinkType, setDefaultRinkType] = useState<RinkType>('crease');

  // Step 3: Appointed Goalies & Players
  const [goalies, setGoalies] = useState(2);
  const [skaters, setSkaters] = useState(4);
  const [coaches, setCoaches] = useState(2);
  const [equipmentText, setEquipmentText] = useState('Pucks, Cones, Deflection Board');

  // Step 4: View Layout Template
  const [layoutPreset, setLayoutPreset] = useState<ViewLayoutPreset>('grid');
  const [defaultSpeed, setDefaultSpeed] = useState<PlaybackSpeed>(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleFinishWizard() {
    setSubmitting(true);
    setError('');
    try {
      const goalieLabels = Array.from({ length: Math.max(1, goalies) }, (_, i) => `G${i + 1}`);
      const equipment = equipmentText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          practiceDate,
          durationMinutes,
          defaultRinkType,
          rosterConfig: {
            goalies: Math.max(1, goalies),
            skaters: Math.max(0, skaters),
            coaches: Math.max(0, coaches),
            goalieLabels,
            equipment,
          },
          viewConfig: {
            ...DEFAULT_VIEW_CONFIG,
            layout: layoutPreset,
            defaultSpeed,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create practice plan');
        setSubmitting(false);
        return;
      }

      // Forward the coach directly to the Practice Planner application
      router.push(`/plans/${data.plan.id}`);
    } catch (err: any) {
      setError(err?.message || 'Error creating plan');
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen py-10 px-4 text-slate-900"
      style={{
        background: `linear-gradient(135deg, ${branding.headerBgColor} 0%, ${branding.secondaryColor} 70%, ${branding.primaryColor} 100%)`,
      }}
    >
      <div className="mx-auto max-w-4xl">
        {/* Wizard Header */}
        <div className="mb-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <div>
              <h1 className="text-xl font-extrabold">
                {branding.siteName} — Practice Plan Setup Wizard
              </h1>
              <p className="text-xs text-slate-300">
                Configure your session parameters, rink dimensions, and appointed roster before entering the planner.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-white/25 bg-black/25 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/40"
          >
            Cancel
          </Link>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="mb-6 grid grid-cols-4 gap-2">
          {[
            { num: 1, label: '1. Session Basics' },
            { num: 2, label: '2. Rink Size & Section' },
            { num: 3, label: '3. Goalies & Players' },
            { num: 4, label: '4. View Template' },
          ].map((item) => (
            <button
              key={item.num}
              type="button"
              onClick={() => setStep(item.num as 1 | 2 | 3 | 4)}
              className={`rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${
                step === item.num
                  ? 'bg-sky-500 text-white shadow-md'
                  : step > item.num
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-black/30 text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Wizard Card Body */}
        <div className="mui-card-elevated border border-slate-700/30 p-6 shadow-2xl sm:p-8">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Step 1: Practice Session Details
                </h2>
                <p className="text-xs text-slate-500">
                  Name your goalie practice session and set the date, duration, and primary coaching focus.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Practice Plan Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Practice Date
                  </label>
                  <input
                    type="date"
                    value={practiceDate}
                    onChange={(e) => setPracticeDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Total Ice Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    step={5}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Practice Overview & Coaching Objectives
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Step 2: Select Default Rink Size / Section
                </h2>
                <p className="text-xs text-slate-500">
                  Choose the primary ice surface for your practice. You can also switch rink sizes per individual drill inside the planner.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(Object.keys(RINK_PRESETS) as RinkType[]).map((rKey) => {
                  const preset = RINK_PRESETS[rKey];
                  const active = defaultRinkType === rKey;
                  return (
                    <button
                      key={rKey}
                      type="button"
                      onClick={() => setDefaultRinkType(rKey)}
                      className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-200'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-extrabold text-slate-900">
                          {preset.name}
                        </span>
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-sky-300">
                          {preset.dimensionsLabel}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Step 3: Appoint Goalies, Players & Coaches
                </h2>
                <p className="text-xs text-slate-500">
                  Appoint how many Goalies, Skaters/Players, and Coaches are needed on the ice to run this practice. They will be automatically placed on your starter rink canvas.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                  <div className="flex items-center gap-2 text-sky-800">
                    <Shield className="h-5 w-5" />
                    <span className="text-xs font-extrabold uppercase">
                      Appointed Goalies
                    </span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={goalies}
                    onChange={(e) => setGoalies(Math.max(1, Number(e.target.value)))}
                    className="mt-2 w-full rounded-xl border border-sky-300 bg-white px-3 py-2 text-lg font-extrabold text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-sky-700">
                    At least 1 goalie required (G1..G{goalies})
                  </p>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
                  <div className="flex items-center gap-2 text-rose-800">
                    <Users className="h-5 w-5" />
                    <span className="text-xs font-extrabold uppercase">
                      Appointed Players / Shooters
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={skaters}
                    onChange={(e) => setSkaters(Math.max(0, Number(e.target.value)))}
                    className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-lg font-extrabold text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-rose-700">
                    Skaters / shooters needed (P1..P{skaters})
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-slate-800">
                    <Maximize2 className="h-5 w-5" />
                    <span className="text-xs font-extrabold uppercase">
                      Coaches on Ice
                    </span>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={coaches}
                    onChange={(e) => setCoaches(Math.max(0, Number(e.target.value)))}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-lg font-extrabold text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-600">
                    Goalie coaches feeding pucks (C1..C{coaches})
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Required On-Ice Equipment (comma separated)
                </label>
                <input
                  type="text"
                  value={equipmentText}
                  onChange={(e) => setEquipmentText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Step 4: Initial Presentation & Sharing View Template
                </h2>
                <p className="text-xs text-slate-500">
                  Pick how the practice plan view is structured by default. You can further customize blocks in the Planner&apos;s &ldquo;Design the View&rdquo; builder.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    id: 'grid' as const,
                    title: 'Multi-Column Grid View',
                    desc: 'Side-by-side cards showing both interactive animation and static diagram.',
                  },
                  {
                    id: 'split' as const,
                    title: 'Split Rink + Coaching Notes',
                    desc: 'Full-width horizontal split pairing the animated drill with detailed goalie notes.',
                  },
                  {
                    id: 'timeline' as const,
                    title: 'Sequential Practice Sheet',
                    desc: 'Top-to-bottom chronological sequence of drills and roster counts.',
                  },
                  {
                    id: 'focus' as const,
                    title: 'Single-Drill Focus Carousel',
                    desc: 'Step through one drill at a time on a tablet or locker-room screen.',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLayoutPreset(opt.id)}
                    className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                      layoutPreset === opt.id
                        ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-200'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layout className="h-4 w-4 text-sky-600" />
                      <span className="text-sm font-bold text-slate-900">
                        {opt.title}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Default Animation Run-Down Speed
                </label>
                <div className="mt-2 flex gap-2">
                  {([0.5, 1, 2] as PlaybackSpeed[]).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setDefaultSpeed(spd)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                        defaultSpeed === spd
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {spd === 0.5
                        ? '0.5x (Half Speed Technical)'
                        : spd === 1
                        ? '1x (Real-Time Speed)'
                        : '2x (Double Speed Quick Run-Down)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Wizard Navigation Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-sky-500"
              >
                Next Step
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinishWizard}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitting
                  ? 'Creating Plan & Opening Planner...'
                  : 'Create Plan & Open Practice Planner'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
