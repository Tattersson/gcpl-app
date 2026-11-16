'use client';

import React, { useEffect, useState } from 'react';
import {
  Drill,
  PlaybackSpeed,
  PracticePlan,
  ViewBlockConfig,
} from '@/types/planner';
import { RINK_PRESETS } from '@/lib/rinkConfig';
import { renderDrillStaticSvgDataUrl } from '@/lib/snapshotSvg';
import RinkCanvas from '@/components/planner/RinkCanvas';
import { BrandLogo, useBranding } from '@/components/BrandingProvider';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Users,
  Clock,
  Calendar,
  Shield,
  Gauge,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface PlanCustomViewRendererProps {
  plan: PracticePlan;
}

function DrillInteractiveCard({
  drill,
  index,
  blocks,
  defaultSpeed,
}: {
  drill: Drill;
  index: number;
  blocks: ViewBlockConfig[];
  defaultSpeed: PlaybackSpeed;
}) {
  const [timeSec, setTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(defaultSpeed || 1);

  useEffect(() => {
    setSpeed(defaultSpeed || 1);
  }, [defaultSpeed]);

  useEffect(() => {
    if (!isPlaying) return;
    let lastTick = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const dt = ((now - lastTick) / 1000) * speed;
      lastTick = now;
      setTimeSec((prev) => {
        if (prev + dt >= drill.durationSec) {
          return 0; // Loop smoothly for quick run down
        }
        return prev + dt;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, speed, drill.durationSec]);

  const staticUrl = drill.snapshotDataUrl || renderDrillStaticSvgDataUrl(drill);
  const preset = RINK_PRESETS[drill.rinkType] || RINK_PRESETS.full;
  const enabledBlocks = [...blocks]
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="mui-card-elevated flex flex-col p-5">
      {/* Drill Card Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-sky-600 px-2 py-0.5 text-xs font-bold text-white">
              Drill #{index + 1}
            </span>
            <h3 className="text-lg font-bold text-slate-900">{drill.name}</h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {preset.name} ({preset.dimensionsLabel}) • {drill.durationMinutes} mins
          </p>
        </div>

        {/* Speed Selector Pills (0.5x, 1x, 2x) */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <Gauge className="ml-1.5 h-3.5 w-3.5 text-slate-500" />
          {([0.5, 1, 2] as PlaybackSpeed[]).map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => setSpeed(spd)}
              className={`rounded px-2 py-0.5 text-xs font-bold transition ${
                speed === spd
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Render Custom Ordered & Sized Blocks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {enabledBlocks.map((block) => {
          const colSpanClass =
            block.span === 'full' ? 'lg:col-span-2' : 'lg:col-span-1';

          if (block.id === 'animation_player') {
            return (
              <div
                key={block.id}
                className={`${colSpanClass} flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
                    Interactive Drill Animation ({speed}x Speed)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1 text-xs font-bold text-white hover:bg-sky-500"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" /> Play ({speed}x)
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPlaying(false);
                        setTimeSec(0);
                      }}
                      className="rounded-lg border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100"
                      title="Reset Animation"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <RinkCanvas
                  drill={drill}
                  currentTimeSec={timeSec}
                  isPlaying={isPlaying}
                  selectedEntityId={null}
                  onSelectEntity={() => {}}
                  readOnly
                />

                <div className="flex items-center gap-2 px-1">
                  <input
                    type="range"
                    min={0}
                    max={drill.durationSec}
                    step={0.1}
                    value={timeSec}
                    onChange={(e) => setTimeSec(Number(e.target.value))}
                    className="h-1.5 w-full accent-sky-600"
                  />
                  <span className="font-mono text-[11px] font-semibold text-slate-600">
                    {timeSec.toFixed(1)}s
                  </span>
                </div>
              </div>
            );
          }

          if (block.id === 'static_image') {
            return (
              <div
                key={block.id}
                className={`${colSpanClass} flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Static Plan Diagram
                  </span>
                  <a
                    href={staticUrl}
                    download={`${drill.name.toLowerCase().replace(/\s+/g, '-')}-diagram.svg`}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Image
                  </a>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                  <img
                    src={staticUrl}
                    alt={`${drill.name} static diagram`}
                    className="mx-auto max-h-[360px] w-full object-contain"
                  />
                </div>
              </div>
            );
          }

          if (block.id === 'description') {
            return (
              <div
                key={block.id}
                className={`${colSpanClass} rounded-xl border border-slate-200 bg-slate-50/60 p-4`}
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Drill Description & Goalie Coaching Points
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
                  {drill.description || 'No description provided for this drill.'}
                </p>
                {drill.coachingPoints && drill.coachingPoints.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {drill.coachingPoints.map((pt, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs font-medium text-slate-700"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          if (block.id === 'roster') {
            return (
              <div
                key={block.id}
                className={`${colSpanClass} flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3.5`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1 text-xs font-bold text-white">
                    <Shield className="h-3.5 w-3.5" />
                    Appointed Goalies: {drill.appointedGoalies}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white">
                    <Users className="h-3.5 w-3.5" />
                    Appointed Players: {drill.appointedPlayers}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-white">
                    Coaches: {drill.appointedCoaches}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  Rink Section: {preset.name}
                </span>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

export default function PlanCustomViewRenderer({ plan }: PlanCustomViewRendererProps) {
  const { viewConfig, rosterConfig, drills } = plan;
  const { branding } = useBranding();
  const [globalSpeed, setGlobalSpeed] = useState<PlaybackSpeed>(
    viewConfig.defaultSpeed || 1
  );
  const [focusDrillIndex, setFocusDrillIndex] = useState<number>(0);

  const layoutGridClass =
    viewConfig.layout === 'grid'
      ? viewConfig.columns === 1
        ? 'grid-cols-1'
        : viewConfig.columns === 3
        ? 'grid-cols-1 xl:grid-cols-3'
        : 'grid-cols-1 lg:grid-cols-2'
      : 'grid-cols-1';

  return (
    <div className="space-y-6">
      {/* Practice Plan Header */}
      {viewConfig.showHeader && (
        <div
          className="border border-slate-200/30 p-6 text-white shadow-md"
          style={{
            background: `linear-gradient(135deg, ${branding.headerBgColor} 0%, ${branding.secondaryColor} 55%, ${branding.primaryColor} 100%)`,
            borderRadius: 'var(--brand-radius, 16px)',
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              {branding.showLogoInSharedView && <BrandLogo size="lg" />}
              <div>
                <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-200">
                  {branding.siteName} • Goalie Practice Plan
                </span>
                <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {plan.title}
                </h1>
                {plan.description && (
                  <p className="mt-1.5 max-w-3xl text-sm text-slate-200">
                    {plan.description}
                  </p>
                )}
              </div>
            </div>

            {/* Global Run-Down Speed Switcher (0.5x, 1x, 2x) */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/90 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Global Animation Run-Down Speed
              </div>
              <div className="flex items-center gap-1.5">
                {([0.5, 1, 2] as PlaybackSpeed[]).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setGlobalSpeed(spd)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                      globalSpeed === spd
                        ? 'bg-sky-500 text-white shadow'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {spd === 0.5 ? '0.5x Half' : spd === 1 ? '1x Full' : '2x Double'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {viewConfig.showRosterBar && (
            <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-700/80 pt-4 text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-sky-400" />
                Date: {plan.practiceDate}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-sky-400" />
                Total Duration: {plan.durationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-sky-400" />
                Appointed Goalies: {rosterConfig.goalies} ({rosterConfig.goalieLabels.join(', ')})
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-rose-400" />
                Appointed Skaters/Players: {rosterConfig.skaters}
              </span>
              <span>Coaches: {rosterConfig.coaches}</span>
            </div>
          )}
        </div>
      )}

      {/* Focus Carousel Mode vs Grid/Split/Timeline Modes */}
      {viewConfig.layout === 'focus' && drills.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <button
              type="button"
              disabled={focusDrillIndex === 0}
              onClick={() => setFocusDrillIndex((i) => Math.max(0, i - 1))}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous Drill
            </button>
            <span className="text-xs font-bold text-slate-700">
              Showing Drill {focusDrillIndex + 1} of {drills.length}
            </span>
            <button
              type="button"
              disabled={focusDrillIndex >= drills.length - 1}
              onClick={() =>
                setFocusDrillIndex((i) => Math.min(drills.length - 1, i + 1))
              }
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"
            >
              Next Drill <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <DrillInteractiveCard
            drill={drills[focusDrillIndex]}
            index={focusDrillIndex}
            blocks={viewConfig.blocks}
            defaultSpeed={globalSpeed}
          />
        </div>
      ) : (
        <div className={`grid gap-6 ${layoutGridClass}`}>
          {drills.map((drill, idx) => (
            <DrillInteractiveCard
              key={drill.id}
              drill={drill}
              index={idx}
              blocks={viewConfig.blocks}
              defaultSpeed={globalSpeed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
