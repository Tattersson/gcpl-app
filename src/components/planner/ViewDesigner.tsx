'use client';

import React from 'react';
import {
  PlaybackSpeed,
  PracticePlan,
  ViewBlockConfig,
  ViewConfig,
  ViewLayoutPreset,
} from '@/types/planner';
import PlanCustomViewRenderer from '@/components/planner/PlanCustomViewRenderer';
import {
  LayoutGrid,
  Columns,
  ListOrdered,
  Maximize2,
  ArrowUp,
  ArrowDown,
  Eye,
} from 'lucide-react';

interface ViewDesignerProps {
  plan: PracticePlan;
  onChangeViewConfig: (nextConfig: ViewConfig) => void;
}

const LAYOUT_PRESETS: {
  id: ViewLayoutPreset;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'grid',
    label: 'Multi-Column Grid',
    desc: 'Side-by-side drill cards for tablet or widescreen rink monitors.',
    icon: LayoutGrid,
  },
  {
    id: 'split',
    label: 'Split Rink + Notes',
    desc: 'Full-width cards with interactive animation paired next to static diagram.',
    icon: Columns,
  },
  {
    id: 'timeline',
    label: 'Sequential Practice Sheet',
    desc: 'Top-to-bottom chronological flow ideal for coaching clipboards.',
    icon: ListOrdered,
  },
  {
    id: 'focus',
    label: 'Single-Drill Focus Carousel',
    desc: 'Step through one drill at a time on a locker-room display.',
    icon: Maximize2,
  },
];

export default function ViewDesigner({
  plan,
  onChangeViewConfig,
}: ViewDesignerProps) {
  const { viewConfig } = plan;

  function updateConfig(patch: Partial<ViewConfig>) {
    onChangeViewConfig({
      ...viewConfig,
      ...patch,
    });
  }

  function toggleBlock(blockId: ViewBlockConfig['id']) {
    const updated = viewConfig.blocks.map((b) =>
      b.id === blockId ? { ...b, enabled: !b.enabled } : b
    );
    updateConfig({ blocks: updated });
  }

  function toggleBlockSpan(blockId: ViewBlockConfig['id']) {
    const updated = viewConfig.blocks.map((b) =>
      b.id === blockId
        ? { ...b, span: b.span === 'full' ? ('half' as const) : ('full' as const) }
        : b
    );
    updateConfig({ blocks: updated });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const sorted = [...viewConfig.blocks].sort((a, b) => a.order - b.order);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const temp = sorted[index];
    sorted[index] = sorted[targetIndex];
    sorted[targetIndex] = temp;
    const reordered = sorted.map((b, idx) => ({ ...b, order: idx + 1 }));
    updateConfig({ blocks: reordered });
  }

  const orderedBlocks = [...viewConfig.blocks].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* View Designer Controls Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">
            Design the Practice Plan View
          </h2>
          <p className="text-xs text-slate-500">
            Customize how drills, static diagrams, descriptions, and multi-speed animations appear to coaches and goalies on the shared view.
          </p>
        </div>

        {/* 1. Layout Preset Picker */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LAYOUT_PRESETS.map((preset) => {
            const Icon = preset.icon;
            const active = viewConfig.layout === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  updateConfig({
                    layout: preset.id,
                    columns: preset.id === 'grid' ? 2 : 1,
                  })
                }
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  active
                    ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-200'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`h-4 w-4 ${
                      active ? 'text-sky-600' : 'text-slate-600'
                    }`}
                  />
                  <span className="text-xs font-bold text-slate-900">
                    {preset.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{preset.desc}</p>
              </button>
            );
          })}
        </div>

        {/* 2. Options & Default Animation Speed */}
        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Default Shared Animation Speed
            </label>
            <div className="mt-1.5 flex items-center gap-1.5">
              {([0.5, 1, 2] as PlaybackSpeed[]).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => updateConfig({ defaultSpeed: spd })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    viewConfig.defaultSpeed === spd
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {spd === 0.5 ? '0.5x (Half)' : spd === 1 ? '1x (Full)' : '2x (Double)'}
                </button>
              ))}
            </div>
          </div>

          {viewConfig.layout === 'grid' && (
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Grid Columns
              </label>
              <div className="mt-1.5 flex items-center gap-1.5">
                {([1, 2, 3] as const).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => updateConfig({ columns: col })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      viewConfig.columns === col
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {col} {col === 1 ? 'Column' : 'Columns'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col justify-center gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={viewConfig.showHeader}
                onChange={(e) => updateConfig({ showHeader: e.target.checked })}
                className="rounded border-slate-300 text-sky-600"
              />
              Show Practice Session Banner
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={viewConfig.showRosterBar}
                onChange={(e) => updateConfig({ showRosterBar: e.target.checked })}
                className="rounded border-slate-300 text-sky-600"
              />
              Show Appointed Goalies & Players Roster Bar
            </label>
          </div>
        </div>

        {/* 3. Reorder & Configure Drill View Blocks */}
        <div className="mt-5 border-t border-slate-100 pt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Drill Card Blocks (Reorder, Show/Hide & Width Span)
          </h3>
          <div className="space-y-2">
            {orderedBlocks.map((block, idx) => (
              <div
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={block.enabled}
                    onChange={() => toggleBlock(block.id)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                  />
                  <span
                    className={`text-xs font-bold ${
                      block.enabled ? 'text-slate-900' : 'text-slate-400 line-through'
                    }`}
                  >
                    {idx + 1}. {block.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleBlockSpan(block.id)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Width: {block.span === 'full' ? 'Full Card (100%)' : 'Half Card (50%)'}
                  </button>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveBlock(idx, -1)}
                    className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    title="Move Up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === orderedBlocks.length - 1}
                    onClick={() => moveBlock(idx, 1)}
                    className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    title="Move Down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Preview of the Designed View */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Eye className="h-4 w-4 text-sky-600" />
          Live Preview of Custom Designed View (Shared Output)
        </div>
        <PlanCustomViewRenderer plan={plan} />
      </div>
    </div>
  );
}
