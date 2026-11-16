import { RinkType, ViewConfig, Drill } from '@/types/planner';

export interface RinkPresetMetadata {
  id: RinkType;
  name: string;
  shortLabel: string;
  dimensionsLabel: string;
  description: string;
  /** SVG viewBox within the canonical 1000x500 full-rink coordinate system */
  viewBox: string;
  bounds: { minX: number; minY: number; width: number; height: number };
  defaultGoaliePos: { x: number; y: number; angle: number };
}

/**
 * Canonical full rink coordinate system is 1000 x 500 (representing 200ft x 85ft).
 * Left Goal Line: x = 75, Right Goal Line: x = 925.
 * Left Blue Line: x = 350, Center Red Line: x = 500, Right Blue Line: x = 650.
 * Center Y: y = 250.
 */
export const RINK_PRESETS: Record<RinkType, RinkPresetMetadata> = {
  full: {
    id: 'full',
    name: 'Full Rink',
    shortLabel: 'Full Ice (1/1)',
    dimensionsLabel: '200 ft × 85 ft',
    description: 'Complete end-to-end rink with both goal creases, neutral zone, and 5 faceoff circles.',
    viewBox: '0 0 1000 500',
    bounds: { minX: 0, minY: 0, width: 1000, height: 500 },
    defaultGoaliePos: { x: 95, y: 250, angle: 0 },
  },
  half: {
    id: 'half',
    name: 'Half Rink',
    shortLabel: 'Half Ice (1/2)',
    dimensionsLabel: '100 ft × 85 ft',
    description: 'From the center red line to the end boards — ideal for multi-station goalie & shooter drills.',
    viewBox: '0 0 520 500',
    bounds: { minX: 0, minY: 0, width: 520, height: 500 },
    defaultGoaliePos: { x: 95, y: 250, angle: 0 },
  },
  third: {
    id: 'third',
    name: '1/3 Rink (Attacking / Defending Zone)',
    shortLabel: '1/3 Rink (Zone)',
    dimensionsLabel: '64 ft × 85 ft',
    description: 'Inside the blue line (end zone) — focused on in-zone play, screen shots, and point deflections.',
    viewBox: '0 0 375 500',
    bounds: { minX: 0, minY: 0, width: 375, height: 500 },
    defaultGoaliePos: { x: 95, y: 250, angle: 0 },
  },
  crease: {
    id: 'crease',
    name: 'Section: Goal Crease & Slot',
    shortLabel: 'Crease & Slot',
    dimensionsLabel: '45 ft × 50 ft',
    description: 'Zoomed technical section of the crease, hashes, and royal road for goalie footwork, angles, and save selection.',
    viewBox: '25 90 270 320',
    bounds: { minX: 25, minY: 90, width: 270, height: 320 },
    defaultGoaliePos: { x: 95, y: 250, angle: 0 },
  },
  corner: {
    id: 'corner',
    name: 'Section: Corner & Below Goal Line',
    shortLabel: 'Corner / Trapezoid',
    dimensionsLabel: '45 ft × 45 ft',
    description: 'Behind the net, trapezoid, and low corner section for RVH transitions, wrap-arounds, and goalie rim/puck handling.',
    viewBox: '0 180 250 320',
    bounds: { minX: 0, minY: 180, width: 250, height: 320 },
    defaultGoaliePos: { x: 88, y: 268, angle: 45 },
  },
};

export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  layout: 'grid',
  columns: 2,
  showHeader: true,
  showRosterBar: true,
  defaultSpeed: 1,
  themeAccent: 'ice',
  blocks: [
    { id: 'animation_player', label: 'Interactive Animation (0.5x / 1x / 2x)', enabled: true, order: 1, span: 'half' },
    { id: 'static_image', label: 'Static Plan Diagram Image', enabled: true, order: 2, span: 'half' },
    { id: 'description', label: 'Drill Description & Goalie Coaching Points', enabled: true, order: 3, span: 'full' },
    { id: 'roster', label: 'Appointed Goalies, Players & Equipment', enabled: true, order: 4, span: 'full' },
  ],
};

/**
 * Creates a new drill with an empty ice surface so the coach can place
 * goalies, players, coaches, and pucks exactly where needed.
 */
export function createStarterDrill(
  rinkType: RinkType,
  goalieCount: number,
  playerCount: number,
  coachCount: number,
  index = 1
): Drill {
  return {
    id: `drill-${Date.now()}-${index}`,
    name: `Drill #${index}`,
    durationMinutes: 15,
    durationSec: 8,
    rinkType,
    description: '',
    coachingPoints: [],
    appointedGoalies: Math.max(1, goalieCount),
    appointedPlayers: Math.max(0, playerCount),
    appointedCoaches: Math.max(0, coachCount),
    entities: [],
    paths: [],
  };
}
