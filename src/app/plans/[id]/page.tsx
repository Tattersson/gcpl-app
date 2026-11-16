'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Drill,
  PlaybackSpeed,
  PracticePlan,
  ViewConfig,
} from '@/types/planner';
import { createStarterDrill, RINK_PRESETS } from '@/lib/rinkConfig';
import { renderDrillStaticSvgDataUrl } from '@/lib/snapshotSvg';
import RinkCanvas from '@/components/planner/RinkCanvas';
import AnimationTimeline from '@/components/planner/AnimationTimeline';
import ViewDesigner from '@/components/planner/ViewDesigner';
import { BrandLogo, useBranding } from '@/components/BrandingProvider';
import {
  Save,
  Share2,
  Plus,
  Trash2,
  Copy,
  Check,
  Layout,
  PenTool,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';

export default function PracticePlannerWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const planId = params?.id;
  const { branding } = useBranding();

  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState('');

  const [activeTab, setActiveTab] = useState<'editor' | 'view' | 'share'>('editor');
  const [activeDrillIndex, setActiveDrillIndex] = useState(0);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Animation playback state
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch(`/api/plans/${planId}`);
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        if (!res.ok) {
          router.replace('/dashboard');
          return;
        }
        const data = await res.json();
        setPlan(data.plan);
        const firstEntity = data.plan?.drills?.[0]?.entities?.[0]?.id ?? null;
        setSelectedEntityId(firstEntity);
        if (data.plan?.viewConfig?.defaultSpeed) {
          setPlaybackSpeed(data.plan.viewConfig.defaultSpeed);
        }
      } catch {
        // Ignore error
      } finally {
        setLoading(false);
      }
    }
    if (planId) fetchPlan();
  }, [planId, router]);

  const activeDrill: Drill | null =
    plan && plan.drills[activeDrillIndex] ? plan.drills[activeDrillIndex] : null;

  // Animation loop supporting 0.5x, 1x, and 2x speed
  useEffect(() => {
    if (!isPlaying || !activeDrill) return;
    let lastTick = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = ((now - lastTick) / 1000) * playbackSpeed;
      lastTick = now;
      setCurrentTimeSec((prev) => {
        if (prev + dt >= activeDrill.durationSec) {
          return 0;
        }
        return prev + dt;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, activeDrill]);

  function handleUpdateActiveDrill(updatedDrill: Drill) {
    if (!plan) return;
    const withSnapshot: Drill = {
      ...updatedDrill,
      snapshotDataUrl: renderDrillStaticSvgDataUrl(updatedDrill),
    };
    const nextDrills = plan.drills.map((d, idx) =>
      idx === activeDrillIndex ? withSnapshot : d
    );
    setPlan({ ...plan, drills: nextDrills });
  }

  function handleAddNewDrill() {
    if (!plan) return;
    const newDrill = createStarterDrill(
      plan.defaultRinkType,
      plan.rosterConfig.goalies,
      plan.rosterConfig.skaters,
      plan.rosterConfig.coaches,
      plan.drills.length + 1
    );
    newDrill.snapshotDataUrl = renderDrillStaticSvgDataUrl(newDrill);
    const nextDrills = [...plan.drills, newDrill];
    setPlan({ ...plan, drills: nextDrills });
    setActiveDrillIndex(nextDrills.length - 1);
    setSelectedEntityId(newDrill.entities[0]?.id ?? null);
    setCurrentTimeSec(0);
  }

  function handleDeleteDrill(idx: number) {
    if (!plan || plan.drills.length <= 1) return;
    const nextDrills = plan.drills.filter((_, i) => i !== idx);
    setPlan({ ...plan, drills: nextDrills });
    setActiveDrillIndex(Math.max(0, activeDrillIndex - 1));
  }

  function handleUpdateViewConfig(nextViewConfig: ViewConfig) {
    if (!plan) return;
    setPlan({ ...plan, viewConfig: nextViewConfig });
  }

  async function handleSavePlan() {
    if (!plan) return;
    setSaving(true);
    setSaveBanner('');
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: plan.title,
          description: plan.description,
          practiceDate: plan.practiceDate,
          durationMinutes: plan.durationMinutes,
          defaultRinkType: plan.defaultRinkType,
          rosterConfig: plan.rosterConfig,
          drills: plan.drills,
          viewConfig: plan.viewConfig,
          isShared: plan.isShared,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
        setSaveBanner('Practice plan saved to database!');
        setTimeout(() => setSaveBanner(''), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCopyShareUrl() {
    if (!plan) return;
    const url = `${window.location.origin}/share/${plan.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  }

  if (loading || !plan || !activeDrill) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-sm font-bold text-slate-300">
          Loading Goalie Practice Planner Workspace...
        </div>
      </div>
    );
  }

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/share/${plan.shareToken}`
      : `/share/${plan.shareToken}`;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: branding.backgroundColor }}
    >
      {/* Top Planner Header Bar */}
      <header
        className="sticky top-0 z-30 border-b border-black/15 shadow-md"
        style={{
          backgroundColor: branding.headerBgColor || '#0f172a',
          color: branding.headerTextColor || '#ffffff',
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <BrandLogo size="sm" />
              <input
                type="text"
                value={plan.title}
                onChange={(e) => setPlan({ ...plan, title: e.target.value })}
                className="rounded-lg border border-transparent bg-transparent px-2 py-0.5 text-base font-extrabold hover:border-white/25 focus:border-sky-500 focus:bg-black/25 focus:outline-none"
                style={{ color: branding.headerTextColor || '#ffffff' }}
              />
            </div>
          </div>

          {/* Workspace Mode Switcher */}
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'editor'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <PenTool className="h-3.5 w-3.5" />
              Drill & Animation Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('view')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'view'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layout className="h-3.5 w-3.5" />
              Design the View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('share')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'share'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share Plan
            </button>
          </div>

          <div className="flex items-center gap-2">
            {saveBanner && (
              <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">
                {saveBanner}
              </span>
            )}
            <button
              type="button"
              onClick={handleSavePlan}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'editor' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Sidebar: Practice Roster Appointment & Multi-Drill List */}
            <div className="space-y-4 lg:col-span-3">
              {/* Appointed Goalies & Players Summary Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Appointed Practice Roster
                </h3>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-sky-50 p-2 border border-sky-200">
                    <span className="block text-[10px] font-bold text-sky-700">
                      GOALIES
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={plan.rosterConfig.goalies}
                      onChange={(e) =>
                        setPlan({
                          ...plan,
                          rosterConfig: {
                            ...plan.rosterConfig,
                            goalies: Math.max(1, Number(e.target.value)),
                          },
                        })
                      }
                      className="mt-1 w-full rounded border border-sky-200 bg-white text-center text-sm font-extrabold text-slate-900"
                    />
                  </div>
                  <div className="rounded-xl bg-rose-50 p-2 border border-rose-200">
                    <span className="block text-[10px] font-bold text-rose-700">
                      PLAYERS
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={25}
                      value={plan.rosterConfig.skaters}
                      onChange={(e) =>
                        setPlan({
                          ...plan,
                          rosterConfig: {
                            ...plan.rosterConfig,
                            skaters: Math.max(0, Number(e.target.value)),
                          },
                        })
                      }
                      className="mt-1 w-full rounded border border-rose-200 bg-white text-center text-sm font-extrabold text-slate-900"
                    />
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2 border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-600">
                      COACHES
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={plan.rosterConfig.coaches}
                      onChange={(e) =>
                        setPlan({
                          ...plan,
                          rosterConfig: {
                            ...plan.rosterConfig,
                            coaches: Math.max(0, Number(e.target.value)),
                          },
                        })
                      }
                      className="mt-1 w-full rounded border border-slate-200 bg-white text-center text-sm font-extrabold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Drills List */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Session Drills ({plan.drills.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddNewDrill}
                    className="flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-sky-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Drill
                  </button>
                </div>

                <div className="space-y-2">
                  {plan.drills.map((d, idx) => {
                    const isCurrent = idx === activeDrillIndex;
                    const preset = RINK_PRESETS[d.rinkType] || RINK_PRESETS.full;
                    return (
                      <div
                        key={d.id}
                        onClick={() => {
                          setActiveDrillIndex(idx);
                          setSelectedEntityId(d.entities[0]?.id ?? null);
                          setCurrentTimeSec(0);
                          setIsPlaying(false);
                        }}
                        className={`cursor-pointer rounded-xl border p-3 transition ${
                          isCurrent
                            ? 'border-sky-600 bg-sky-50/80 ring-2 ring-sky-100'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900">
                            #{idx + 1} {d.name}
                          </span>
                          {plan.drills.length > 1 && (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                handleDeleteDrill(idx);
                              }}
                              className="text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-slate-500">
                          <span>{preset.shortLabel}</span>
                          <span>•</span>
                          <span>{d.durationMinutes} min</span>
                          <span>•</span>
                          <span>
                            {d.appointedGoalies}G / {d.appointedPlayers}P
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Drill Metadata & Description Editor */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Drill #{activeDrillIndex + 1} Details & Description
                </h3>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Drill Name
                  </label>
                  <input
                    type="text"
                    value={activeDrill.name}
                    onChange={(e) =>
                      handleUpdateActiveDrill({
                        ...activeDrill,
                        name: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600">
                      Drill Mins
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={activeDrill.durationMinutes}
                      onChange={(e) =>
                        handleUpdateActiveDrill({
                          ...activeDrill,
                          durationMinutes: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600">
                      Anim Length (s)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={30}
                      value={activeDrill.durationSec}
                      onChange={(e) =>
                        handleUpdateActiveDrill({
                          ...activeDrill,
                          durationSec: Math.max(3, Number(e.target.value)),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Drill Description
                  </label>
                  <textarea
                    rows={3}
                    value={activeDrill.description}
                    onChange={(e) =>
                      handleUpdateActiveDrill({
                        ...activeDrill,
                        description: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Goalie Coaching Points (one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={(activeDrill.coachingPoints || []).join('\n')}
                    onChange={(e) =>
                      handleUpdateActiveDrill({
                        ...activeDrill,
                        coachingPoints: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Right Main Column: Rink Canvas + Animation Timeline */}
            <div className="space-y-4 lg:col-span-9">
              <RinkCanvas
                drill={activeDrill}
                currentTimeSec={currentTimeSec}
                isPlaying={isPlaying}
                selectedEntityId={selectedEntityId}
                onSelectEntity={setSelectedEntityId}
                onChangeDrill={handleUpdateActiveDrill}
              />

              <AnimationTimeline
                drill={activeDrill}
                currentTimeSec={currentTimeSec}
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                selectedEntityId={selectedEntityId}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onReset={() => {
                  setIsPlaying(false);
                  setCurrentTimeSec(0);
                }}
                onScrub={(t) => {
                  setIsPlaying(false);
                  setCurrentTimeSec(t);
                }}
                onChangePlaybackSpeed={setPlaybackSpeed}
                onSelectEntity={setSelectedEntityId}
                onChangeDrill={handleUpdateActiveDrill}
              />
            </div>
          </div>
        )}

        {activeTab === 'view' && (
          <ViewDesigner
            plan={plan}
            onChangeViewConfig={handleUpdateViewConfig}
          />
        )}

        {activeTab === 'share' && (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Share Practice Plan Image, Description & Multi-Speed Animations
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Anyone with the share link can view the static diagram image, read the drill descriptions, and play the interactive drill animations at <strong>0.5x (Half)</strong>, <strong>1x (Full)</strong>, or <strong>2x (Double)</strong> speed.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent font-mono text-xs font-semibold text-slate-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyShareUrl}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-500"
                >
                  {copiedShareLink ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied Link!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Share Link
                    </>
                  )}
                </button>
                <Link
                  href={`/share/${plan.shareToken}`}
                  target="_blank"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Shared View
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="text-xs font-bold text-slate-900">
                    1. Static Plan Image
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    High-contrast SVG/PNG rink diagram for every drill with one-click download.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="text-xs font-bold text-slate-900">
                    2. Practice & Drill Descriptions
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Full coaching points, appointed Goalie/Player counts ({plan.rosterConfig.goalies}G, {plan.rosterConfig.skaters}P), and equipment list.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3.5">
                  <div className="text-xs font-bold text-slate-900">
                    3. 0.5x / 1x / 2x Animations
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Interactive player supporting Half (0.5x), Full (1x), and Double (2x) quick run-down speeds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
