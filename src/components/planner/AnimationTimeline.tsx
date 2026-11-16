'use client';

import React from 'react';
import {
  Drill,
  DrillEntity,
  GoalieStance,
  Keyframe,
  PlaybackSpeed,
} from '@/types/planner';
import {
  generateKeyframesFromPaths,
  getEntityStateAtTime,
} from '@/lib/animationEngine';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Sparkles,
  Plus,
  Trash2,
  Sliders,
} from 'lucide-react';

interface AnimationTimelineProps {
  drill: Drill;
  currentTimeSec: number;
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  selectedEntityId: string | null;
  onTogglePlay: () => void;
  onReset: () => void;
  onScrub: (timeSec: number) => void;
  onChangePlaybackSpeed: (speed: PlaybackSpeed) => void;
  onSelectEntity: (id: string) => void;
  onChangeDrill?: (updated: Drill) => void;
  readOnly?: boolean;
}

const GOALIE_STANCES: GoalieStance[] = [
  'ready',
  'butterfly',
  'rvh',
  'vh',
  'overlap',
  'hug-post',
  'glove-save',
  'blocker-save',
  't-push',
  'shuffle',
  'butterfly-slide',
  'c-cut',
];

export default function AnimationTimeline({
  drill,
  currentTimeSec,
  isPlaying,
  playbackSpeed,
  selectedEntityId,
  onTogglePlay,
  onReset,
  onScrub,
  onChangePlaybackSpeed,
  onSelectEntity,
  onChangeDrill,
  readOnly = false,
}: AnimationTimelineProps) {
  const selectedEntity =
    drill.entities.find((e) => e.id === selectedEntityId) || drill.entities[0] || null;

  function updateSelectedEntity(updater: (ent: DrillEntity) => DrillEntity) {
    if (readOnly || !onChangeDrill || !selectedEntity) return;
    const updatedEntities = drill.entities.map((ent) =>
      ent.id === selectedEntity.id ? updater(ent) : ent
    );
    onChangeDrill({ ...drill, entities: updatedEntities });
  }

  function handleConvertPathsToKeyframes() {
    if (!selectedEntity) return;
    const generated = generateKeyframesFromPaths(selectedEntity, drill.paths, 4);
    updateSelectedEntity((ent) => ({
      ...ent,
      animation: {
        ...ent.animation,
        useCustomKeyframes: true,
        keyframes: generated,
      },
    }));
  }

  function handleAddKeyframeAtCurrentTime() {
    if (!selectedEntity) return;
    const interpolated = getEntityStateAtTime(
      selectedEntity,
      drill.paths,
      currentTimeSec
    );
    const newKf: Keyframe = {
      id: `kf-${Date.now()}`,
      t: Number(currentTimeSec.toFixed(1)),
      x: Math.round(interpolated.x * 10) / 10,
      y: Math.round(interpolated.y * 10) / 10,
      angle: Math.round(interpolated.angle),
      stance: interpolated.stance ?? selectedEntity.stance,
    };

    updateSelectedEntity((ent) => ({
      ...ent,
      animation: {
        ...ent.animation,
        useCustomKeyframes: true,
        keyframes: [...ent.animation.keyframes, newKf].sort((a, b) => a.t - b.t),
      },
    }));
  }

  function handleUpdateKeyframe(kfId: string, patch: Partial<Keyframe>) {
    updateSelectedEntity((ent) => ({
      ...ent,
      animation: {
        ...ent.animation,
        keyframes: ent.animation.keyframes
          .map((kf) => (kf.id === kfId ? { ...kf, ...patch } : kf))
          .sort((a, b) => a.t - b.t),
      },
    }));
  }

  function handleDeleteKeyframe(kfId: string) {
    updateSelectedEntity((ent) => ({
      ...ent,
      animation: {
        ...ent.animation,
        keyframes: ent.animation.keyframes.filter((kf) => kf.id !== kfId),
      },
    }));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Main Playback & Speed Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition"
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Play Drill
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <span className="ml-1 font-mono text-xs font-semibold text-slate-700">
            {currentTimeSec.toFixed(1)}s / {drill.durationSec.toFixed(1)}s
          </span>
        </div>

        {/* Scrubber Slider */}
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
          <input
            type="range"
            min={0}
            max={drill.durationSec}
            step={0.1}
            value={currentTimeSec}
            onChange={(e) => onScrub(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-sky-600"
          />
        </div>

        {/* Speed Variations: 0.5x (Half), 1x (Full), 2x (Double) */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <Gauge className="ml-1.5 h-3.5 w-3.5 text-slate-500" />
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Speed:</span>
          {([0.5, 1, 2] as PlaybackSpeed[]).map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => onChangePlaybackSpeed(spd)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                playbackSpeed === spd
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              {spd === 0.5 ? '0.5x (Half)' : spd === 1 ? '1x (Full)' : '2x (Quick)'}
            </button>
          ))}
        </div>
      </div>

      {/* Per-Player / Per-Goalie Animation Customization Drawer (Editable Mode Only) */}
      {!readOnly && onChangeDrill && selectedEntity && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-sky-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Per-Player / Goalie Timing & Keyframes ({selectedEntity.label})
              </h4>
            </div>

            {/* Entity Selector Pills */}
            <div className="flex flex-wrap items-center gap-1">
              {drill.entities.map((ent) => (
                <button
                  key={ent.id}
                  type="button"
                  onClick={() => onSelectEntity(ent.id)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                    ent.id === selectedEntity.id
                      ? 'bg-sky-600 text-white ring-2 ring-sky-200'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {ent.label} ({ent.type})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500">
                Label / Role
              </label>
              <input
                type="text"
                value={selectedEntity.label}
                onChange={(e) =>
                  updateSelectedEntity((ent) => ({ ...ent, label: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500">
                Start Delay (sec)
              </label>
              <input
                type="number"
                min={0}
                max={drill.durationSec}
                step={0.5}
                value={selectedEntity.animation.delaySec}
                onChange={(e) =>
                  updateSelectedEntity((ent) => ({
                    ...ent,
                    animation: {
                      ...ent.animation,
                      delaySec: Number(e.target.value),
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500">
                Individual Speed ({selectedEntity.animation.speedMultiplier}x)
              </label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.25}
                value={selectedEntity.animation.speedMultiplier}
                onChange={(e) =>
                  updateSelectedEntity((ent) => ({
                    ...ent,
                    animation: {
                      ...ent.animation,
                      speedMultiplier: Number(e.target.value),
                    },
                  }))
                }
                className="mt-2.5 w-full accent-sky-600"
              />
            </div>

            {selectedEntity.type === 'goalie' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500">
                  Goalie Action / Stance
                </label>
                <select
                  value={selectedEntity.stance || 'ready'}
                  onChange={(e) =>
                    updateSelectedEntity((ent) => ({
                      ...ent,
                      stance: e.target.value as GoalieStance,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                >
                  {GOALIE_STANCES.map((st) => (
                    <option key={st} value={st}>
                      {st.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col justify-end gap-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEntity.animation.useCustomKeyframes}
                  onChange={(e) =>
                    updateSelectedEntity((ent) => ({
                      ...ent,
                      animation: {
                        ...ent.animation,
                        useCustomKeyframes: e.target.checked,
                      },
                    }))
                  }
                  className="rounded border-slate-300 text-sky-600"
                />
                Manual Keyframe Mode
              </label>
              <button
                type="button"
                onClick={handleConvertPathsToKeyframes}
                className="flex items-center justify-center gap-1 rounded-lg bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800 hover:bg-sky-200 transition"
              >
                <Sparkles className="h-3 w-3" />
                Path → Keyframes
              </button>
            </div>
          </div>

          {/* Explicit Keyframe Editor Table when Manual Keyframe Mode is active */}
          {selectedEntity.animation.useCustomKeyframes && (
            <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-900">
                  Keyframes for {selectedEntity.label} ({selectedEntity.animation.keyframes.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddKeyframeAtCurrentTime}
                  className="flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Keyframe at {currentTimeSec.toFixed(1)}s
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                {selectedEntity.animation.keyframes.map((kf, idx) => (
                  <div
                    key={kf.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">
                        KF #{idx + 1}
                      </span>
                      {selectedEntity.animation.keyframes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteKeyframe(kf.id)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <span className="text-[10px] text-slate-400">Time(s)</span>
                        <input
                          type="number"
                          step={0.5}
                          min={0}
                          max={drill.durationSec}
                          value={kf.t}
                          onChange={(e) =>
                            handleUpdateKeyframe(kf.id, { t: Number(e.target.value) })
                          }
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">X</span>
                        <input
                          type="number"
                          step={0.5}
                          value={kf.x}
                          onChange={(e) =>
                            handleUpdateKeyframe(kf.id, { x: Number(e.target.value) })
                          }
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Y</span>
                        <input
                          type="number"
                          step={0.5}
                          value={kf.y}
                          onChange={(e) =>
                            handleUpdateKeyframe(kf.id, { y: Number(e.target.value) })
                          }
                          className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs"
                        />
                      </div>
                    </div>
                    {selectedEntity.type === 'goalie' && (
                      <select
                        value={kf.stance || 'ready'}
                        onChange={(e) =>
                          handleUpdateKeyframe(kf.id, {
                            stance: e.target.value as GoalieStance,
                          })
                        }
                        className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium"
                      >
                        {GOALIE_STANCES.map((st) => (
                          <option key={st} value={st}>
                            {st.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
