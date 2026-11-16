import {
  Drill,
  DrillEntity,
  DrawnPath,
  GoalieStance,
  Keyframe,
  Point2D,
  ShotHeight,
} from '@/types/planner';

export interface InterpolatedEntityState {
  entityId: string;
  x: number;
  y: number;
  angle: number;
  stance?: GoalieStance;
  hasPuck?: boolean;
  progress: number; // 0..1
  activeMovementType?: string;
}

export interface InterpolatedPuckFlight {
  id: string;
  x: number;
  y: number;
  type: 'pass' | 'shot';
  shotHeight?: ShotHeight;
  progress: number;
}

export interface GoalPost {
  id: 'left-top' | 'left-bottom' | 'right-top' | 'right-bottom';
  x: number;
  y: number;
  label: string;
}

export const GOAL_POSTS: GoalPost[] = [
  { id: 'left-top', x: 75, y: 232, label: 'Left Net — Top Post' },
  { id: 'left-bottom', x: 75, y: 268, label: 'Left Net — Bottom Post' },
  { id: 'right-top', x: 925, y: 232, label: 'Right Net — Top Post' },
  { id: 'right-bottom', x: 925, y: 268, label: 'Right Net — Bottom Post' },
];

/**
 * Checks if `pt` is within `snapRadius` of any of the 4 goal posts.
 * Returns the nearest GoalPost if within range, otherwise null.
 */
export function findNearestGoalPost(
  pt: Point2D,
  snapRadius = 15
): GoalPost | null {
  let closest: GoalPost | null = null;
  let bestDist = snapRadius;
  for (const post of GOAL_POSTS) {
    const d = Math.hypot(pt.x - post.x, pt.y - post.y);
    if (d <= bestDist) {
      bestDist = d;
      closest = post;
    }
  }
  return closest;
}

/**
 * Moves an entity to `newPt` and translates + snaps all connected lines (movement, pass, shot)
 * and keyframes belonging to that entity by the exact delta so lines stay attached.
 */
export function moveEntityWithConnectedLines(
  drill: Drill,
  entityId: string,
  newPt: Point2D
): Drill {
  const target = drill.entities.find((e) => e.id === entityId);
  if (!target) return drill;

  const dx = Math.round((newPt.x - target.x) * 10) / 10;
  const dy = Math.round((newPt.y - target.y) * 10) / 10;

  const updatedEntities = drill.entities.map((ent) => {
    if (ent.id !== entityId) return ent;
    const updatedKeyframes = ent.animation.keyframes.map((kf, idx) => ({
      ...kf,
      x: idx === 0 ? newPt.x : Math.round((kf.x + dx) * 10) / 10,
      y: idx === 0 ? newPt.y : Math.round((kf.y + dy) * 10) / 10,
    }));
    return {
      ...ent,
      x: newPt.x,
      y: newPt.y,
      animation: {
        ...ent.animation,
        keyframes: updatedKeyframes,
      },
    };
  });

  // Translate all paths belonging to this entity and snap the first path start point to newPt
  // Also keep incoming passes (passToId === entityId) snapped to this receiver!
  let firstMoveAnchored = false;
  const updatedPaths = drill.paths.map((path) => {
    if (path.entityId === entityId) {
      const translatedPoints = path.points.map((pt, idx) => {
        if (!firstMoveAnchored && idx === 0) {
          firstMoveAnchored = true;
          return { x: newPt.x, y: newPt.y };
        }
        if (
          path.movementType === 'pass' &&
          path.passToId &&
          path.passToId !== 'free' &&
          path.passToId !== entityId &&
          idx === path.points.length - 1
        ) {
          // Keep the receiver end anchored to the receiver entity
          return pt;
        }
        return {
          x: Math.round((pt.x + dx) * 10) / 10,
          y: Math.round((pt.y + dy) * 10) / 10,
        };
      });
      return {
        ...path,
        points: translatedPoints,
      };
    }

    if (path.movementType === 'pass' && path.passToId === entityId && path.points.length >= 2) {
      const nextPts = [...path.points];
      nextPts[nextPts.length - 1] = { x: newPt.x, y: newPt.y };
      return {
        ...path,
        points: nextPts,
      };
    }

    return path;
  });

  return {
    ...drill,
    entities: updatedEntities,
    paths: updatedPaths,
  };
}

/**
 * Adjusts the start or end control point of a drawn path (`pathId`).
 * Preserves smooth intermediate freehand curvature by linearly weighting the delta
 * from the opposite anchored endpoint.
 */
export function adjustPathEndpoint(
  drill: Drill,
  pathId: string,
  which: 'start' | 'end',
  newPt: Point2D
): Drill {
  const updatedPaths = drill.paths.map((p) => {
    if (p.id !== pathId || p.points.length < 2) return p;
    const n = p.points.length;
    const oldAnchor = which === 'start' ? p.points[0] : p.points[n - 1];
    const dx = newPt.x - oldAnchor.x;
    const dy = newPt.y - oldAnchor.y;

    const nextPoints = p.points.map((pt, i) => {
      if (which === 'start') {
        if (i === 0) return { x: newPt.x, y: newPt.y };
        const weight = 1 - i / (n - 1);
        return {
          x: Math.round((pt.x + dx * weight) * 10) / 10,
          y: Math.round((pt.y + dy * weight) * 10) / 10,
        };
      } else {
        if (i === n - 1) return { x: newPt.x, y: newPt.y };
        const weight = i / (n - 1);
        return {
          x: Math.round((pt.x + dx * weight) * 10) / 10,
          y: Math.round((pt.y + dy * weight) * 10) / 10,
        };
      }
    });

    return {
      ...p,
      points: nextPoints,
    };
  });

  return {
    ...drill,
    paths: updatedPaths,
  };
}

/**
 * Calculates cumulative arc-length distances along a polyline.
 */
export function getPolylineLength(points: Point2D[]): {
  totalLength: number;
  segmentLengths: number[];
} {
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.hypot(dx, dy);
    segmentLengths.push(len);
    totalLength += len;
  }
  return { totalLength, segmentLengths };
}

/**
 * Samples a point and tangent angle at normalized progress u in [0, 1] along a polyline.
 */
export function samplePolylineAtProgress(
  points: Point2D[],
  u: number
): { x: number; y: number; angle: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, angle: 0 };
  }
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, angle: 0 };
  }

  const clampedU = Math.max(0, Math.min(1, u));
  const { totalLength, segmentLengths } = getPolylineLength(points);
  if (totalLength < 0.001) {
    return { x: points[0].x, y: points[0].y, angle: 0 };
  }

  const targetDist = clampedU * totalLength;
  let accumulated = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= targetDist || i === segmentLengths.length - 1) {
      const localU = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      const p0 = points[i];
      const p1 = points[i + 1];
      const x = p0.x + (p1.x - p0.x) * localU;
      const y = p0.y + (p1.y - p0.y) * localU;
      const angle = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;
      return { x, y, angle };
    }
    accumulated += segLen;
  }

  const last = points[points.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

/**
 * Generates an SVG path string (`M ... L ...`) with a classic hockey coaching
 * zigzag wave along the polyline for "Skate with Puck" (`skate-puck`),
 * keeping a short straight tip at the end so the arrowhead points cleanly along the path.
 */
export function buildZigzagSvgPath(
  points: Point2D[],
  stepLength = 8,
  amplitude = 4.2
): string {
  if (points.length < 2) return '';
  const { totalLength } = getPolylineLength(points);
  if (totalLength < stepLength * 1.5) {
    return points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  }

  const endLeadOut = Math.min(8, totalLength * 0.15);
  const usableLength = Math.max(stepLength, totalLength - endLeadOut);
  const steps = Math.max(2, Math.floor(usableLength / stepLength));

  const commands: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < steps; i++) {
    const dist = (i / steps) * usableLength;
    const u = dist / totalLength;
    const sample = samplePolylineAtProgress(points, u);
    const rad = (sample.angle * Math.PI) / 180;
    const nx = -Math.sin(rad);
    const ny = Math.cos(rad);
    const sign = i % 2 === 1 ? 1 : -1;
    const zx = Math.round((sample.x + nx * amplitude * sign) * 10) / 10;
    const zy = Math.round((sample.y + ny * amplitude * sign) * 10) / 10;
    commands.push(`L ${zx} ${zy}`);
  }

  const preEndSample = samplePolylineAtProgress(points, usableLength / totalLength);
  commands.push(
    `L ${Math.round(preEndSample.x * 10) / 10} ${Math.round(preEndSample.y * 10) / 10}`
  );
  const last = points[points.length - 1];
  commands.push(`L ${last.x} ${last.y}`);
  return commands.join(' ');
}

/**
 * Returns the visual opacity for a drawn line in `pathPhase` when the coach is
 * editing `activePhase`:
 * - Same phase: 1.0 (100%)
 * - 1 phase away (e.g. Phase 1 when in Phase 2): 0.5 (50%)
 * - 2+ phases away (e.g. Phase 1 when in Phase 3): 0.2 (20%)
 */
export function getPhaseLineOpacity(
  pathPhase: number,
  activePhase: number
): number {
  const diff = Math.abs(activePhase - pathPhase);
  if (diff === 0) return 1;
  if (diff === 1) return 0.5;
  return 0.2;
}

export interface PhaseWindow {
  phase: number;
  startSec: number;
  endSec: number;
  durationSec: number;
}

/**
 * Computes sequential, non-overlapping time windows for every phase present in `paths`.
 * Phase k+1 strictly starts at Phase k's `endSec` so a phase never begins until
 * the previous phase is 100% complete.
 */
export function getPhaseWindows(
  paths: DrawnPath[],
  totalDurationSec = 6,
  baseDelaySec = 0
): PhaseWindow[] {
  const distinctPhases = Array.from(
    new Set(paths.map((p) => p.phase || 1))
  ).sort((a, b) => a - b);

  if (distinctPhases.length === 0) {
    return [
      {
        phase: 1,
        startSec: baseDelaySec,
        endSec: baseDelaySec + totalDurationSec,
        durationSec: totalDurationSec,
      },
    ];
  }

  const slotDuration = Math.max(0.5, totalDurationSec) / distinctPhases.length;
  return distinctPhases.map((phase, idx) => {
    const startSec = Number((baseDelaySec + idx * slotDuration).toFixed(3));
    const endSec = Number((startSec + slotDuration).toFixed(3));
    return {
      phase,
      startSec,
      endSec,
      durationSec: slotDuration,
    };
  });
}

function isPlayerOrGoalieMovementPath(p: DrawnPath): boolean {
  return p.movementType !== 'pass' && p.movementType !== 'shot';
}

function isWithPuckMovement(moveType?: string): boolean {
  return (
    moveType === 'skate-puck' ||
    moveType === 'backward-puck' ||
    moveType === 'lateral-puck'
  );
}

/**
 * Converts a drawn movement path into explicit keyframes on the entity's timeline
 * so the coach can switch between path-driven motion and manual keyframe editing seamlessly.
 */
export function generateKeyframesFromPaths(
  entity: DrillEntity,
  paths: DrawnPath[],
  sampleCount = 4
): Keyframe[] {
  const movementPaths = paths
    .filter((p) => p.entityId === entity.id && isPlayerOrGoalieMovementPath(p) && p.points.length >= 2)
    .sort((a, b) => a.phase - b.phase);

  if (movementPaths.length === 0) {
    return [
      {
        id: `kf-${entity.id}-0`,
        t: 0,
        x: entity.x,
        y: entity.y,
        angle: entity.angle,
        stance: entity.stance,
      },
    ];
  }

  const combinedPoints: Point2D[] = [];
  movementPaths.forEach((p, idx) => {
    if (idx === 0) {
      combinedPoints.push(...p.points);
    } else {
      combinedPoints.push(...p.points.slice(1));
    }
  });

  const startDelay = entity.animation.delaySec || 0;
  const duration = Math.max(1, entity.animation.durationSec || 6);
  const phaseWindows = getPhaseWindows(paths, duration, startDelay);
  const keyframes: Keyframe[] = [];

  for (const win of phaseWindows) {
    const phasePaths = movementPaths.filter((p) => (p.phase || 1) === win.phase);
    if (phasePaths.length === 0) continue;

    const pts: Point2D[] = [];
    phasePaths.forEach((p, idx) => {
      if (idx === 0) pts.push(...p.points);
      else pts.push(...p.points.slice(1));
    });

    const firstPath = phasePaths[0];
    const lastPath = phasePaths[phasePaths.length - 1];
    const stepsPerPhase = Math.max(2, Math.round(sampleCount / phaseWindows.length));

    for (let i = 0; i <= stepsPerPhase; i++) {
      const u = i / stepsPerPhase;
      const t = Number((win.startSec + u * win.durationSec).toFixed(2));
      const sampled = samplePolylineAtProgress(pts, u);
      const lastMove = lastPath.movementType;
      let stance: GoalieStance | undefined = undefined;
      if (entity.type === 'goalie') {
        if (i === 0 && firstPath.startStance) {
          stance = firstPath.startStance;
        } else if (i === stepsPerPhase && lastPath.endStance) {
          stance = lastPath.endStance;
        } else if (
          lastMove === 't-push' ||
          lastMove === 'shuffle' ||
          lastMove === 'butterfly-slide' ||
          lastMove === 'c-cut'
        ) {
          stance = lastMove as GoalieStance;
        } else {
          stance = lastPath.endStance ?? firstPath.startStance ?? entity.stance;
        }
      }

      keyframes.push({
        id: `kf-${entity.id}-p${win.phase}-${i}`,
        t,
        x: Math.round(sampled.x * 10) / 10,
        y: Math.round(sampled.y * 10) / 10,
        angle: Math.round(sampled.angle),
        stance,
      });
    }
  }

  return keyframes;
}

function getPassFlightWindow(
  path: DrawnPath,
  allPaths: DrawnPath[],
  baseDelay = 0,
  drillDurationSec = 6
): {
  flightStart: number;
  flightEnd: number;
} {
  const windows = getPhaseWindows(allPaths, drillDurationSec, baseDelay);
  const win =
    windows.find((w) => w.phase === (path.phase || 1)) || windows[0];
  // Check if any movement also occurs in the same phase
  const hasMovementInSamePhase = allPaths.some(
    (p) =>
      (p.phase || 1) === (path.phase || 1) &&
      p.movementType !== 'pass' &&
      p.movementType !== 'shot' &&
      p.points.length >= 2
  );
  if (hasMovementInSamePhase) {
    // Pass/shot happens in the final 40% of this phase window, still completing before the phase ends
    return {
      flightStart: win.startSec + win.durationSec * 0.55,
      flightEnd: win.endSec,
    };
  }
  return {
    flightStart: win.startSec,
    flightEnd: win.endSec,
  };
}

/**
 * Determines whether `entity` currently holds the puck at `timeSec` based on
 * initial puck possession, with-puck skating moves, and `From -> To` pass transfers.
 */
export function resolveEntityPuckPossession(
  entity: DrillEntity,
  paths: DrawnPath[],
  timeSec: number,
  activeMove?: string
): boolean {
  const passPaths = paths
    .filter((p) => p.movementType === 'pass' && p.points.length >= 2)
    .sort((a, b) => a.phase - b.phase);

  // Baseline possession before any pass fires
  const isInitialPasser = passPaths.some(
    (p, idx) => idx === 0 && (p.passFromId === entity.id || (!p.passFromId && p.entityId === entity.id))
  );
  let hasPuck = Boolean(
    entity.hasPuck || isWithPuckMovement(activeMove) || isInitialPasser
  );

  for (const pass of passPaths) {
    const fromId = pass.passFromId ?? pass.entityId;
    const toId = pass.passToId ?? 'free';
    const { flightStart, flightEnd } = getPassFlightWindow(
      pass,
      paths,
      entity.animation.delaySec || 0,
      entity.animation.durationSec || 6
    );

    if (timeSec < flightStart) {
      // Before this pass is released, if this entity only gets the puck via this pass, they don't have it yet
      if (toId === entity.id && fromId !== entity.id && !isInitialPasser) {
        hasPuck = false;
      }
    } else if (timeSec >= flightStart && timeSec <= flightEnd) {
      // Puck is currently in flight for this pass
      if (fromId === entity.id || toId === entity.id) {
        hasPuck = false;
      }
    } else if (timeSec > flightEnd) {
      // Pass has completed: transfer possession from `fromId` to `toId` (or 'free')
      if (fromId === entity.id) {
        hasPuck = false;
      }
      if (toId === entity.id) {
        hasPuck = true;
      }
    }
  }

  return hasPuck;
}

/**
 * Computes the interpolated state of a single entity at `timeSec` on the drill timeline.
 * Supports BOTH:
 * 1. Explicit per-player custom keyframes (`entity.animation.useCustomKeyframes === true`)
 * 2. Drawn movement paths with per-player speed multiplier and start delay
 */
export function getEntityStateAtTime(
  entity: DrillEntity,
  paths: DrawnPath[],
  timeSec: number
): InterpolatedEntityState {
  const { delaySec = 0, durationSec = 6, speedMultiplier = 1, useCustomKeyframes, keyframes } =
    entity.animation;
  const currentHasPuck = resolveEntityPuckPossession(entity, paths, timeSec);

  // 1. Explicit Keyframe interpolation mode
  if (useCustomKeyframes && keyframes && keyframes.length > 0) {
    const sorted = [...keyframes].sort((a, b) => a.t - b.t);
    const effectiveTime = Math.max(0, (timeSec - delaySec) * speedMultiplier + delaySec);

    if (effectiveTime <= sorted[0].t) {
      return {
        entityId: entity.id,
        x: sorted[0].x,
        y: sorted[0].y,
        angle: sorted[0].angle,
        stance: sorted[0].stance ?? entity.stance,
        hasPuck: currentHasPuck,
        progress: 0,
      };
    }

    const last = sorted[sorted.length - 1];
    if (effectiveTime >= last.t) {
      return {
        entityId: entity.id,
        x: last.x,
        y: last.y,
        angle: last.angle,
        stance: last.stance ?? entity.stance,
        hasPuck: currentHasPuck,
        progress: 1,
      };
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      const k0 = sorted[i];
      const k1 = sorted[i + 1];
      if (effectiveTime >= k0.t && effectiveTime <= k1.t) {
        const span = k1.t - k0.t;
        const localU = span > 0 ? (effectiveTime - k0.t) / span : 0;
        return {
          entityId: entity.id,
          x: k0.x + (k1.x - k0.x) * localU,
          y: k0.y + (k1.y - k0.y) * localU,
          angle: k0.angle + (k1.angle - k0.angle) * localU,
          stance: localU > 0.5 ? k1.stance ?? k0.stance : k0.stance ?? entity.stance,
          hasPuck: currentHasPuck,
          progress: (effectiveTime - sorted[0].t) / Math.max(0.1, last.t - sorted[0].t),
        };
      }
    }
  }

  // 2. Drawn Path interpolation mode
  const movementPaths = paths
    .filter((p) => p.entityId === entity.id && isPlayerOrGoalieMovementPath(p) && p.points.length >= 2)
    .sort((a, b) => a.phase - b.phase);

  if (movementPaths.length === 0) {
    return {
      entityId: entity.id,
      x: entity.x,
      y: entity.y,
      angle: entity.angle,
      stance: entity.stance,
      hasPuck: currentHasPuck,
      progress: 0,
    };
  }

  // 2. Drawn Path interpolation mode — strictly sequential phase-by-phase execution!
  const phaseWindows = getPhaseWindows(paths, durationSec, delaySec);
  let currentX = entity.x;
  let currentY = entity.y;
  let currentAngle = entity.angle;
  let currentStance: GoalieStance | undefined =
    movementPaths[0]?.startStance ?? entity.stance;
  let activeMove: string | undefined = undefined;
  let overallProgress = 0;

  for (let wIdx = 0; wIdx < phaseWindows.length; wIdx++) {
    const win = phaseWindows[wIdx];
    const phaseMoves = movementPaths.filter((p) => (p.phase || 1) === win.phase);

    if (timeSec < win.startSec) {
      // Wait for prior phase to finish before starting this phase
      break;
    }

    if (phaseMoves.length === 0) {
      // Entity has no movement in this phase — waits in current position/stance until phase completes
      if (timeSec <= win.endSec) {
        overallProgress = (wIdx + (timeSec - win.startSec) / win.durationSec) / phaseWindows.length;
        break;
      }
      continue;
    }

    // Build combined polyline for this specific phase
    const phasePoints: Point2D[] = [{ x: currentX, y: currentY }];
    phaseMoves.forEach((p) => {
      const startPt = p.points[0];
      const prevPt = phasePoints[phasePoints.length - 1];
      if (Math.hypot(startPt.x - prevPt.x, startPt.y - prevPt.y) > 4) {
        phasePoints.push(startPt);
      }
      phasePoints.push(...p.points.slice(1));
    });

    const firstMoveInPhase = phaseMoves[0];
    const lastMoveInPhase = phaseMoves[phaseMoves.length - 1];

    if (timeSec >= win.endSec) {
      // This phase has completed; advance state to the end of this phase and proceed to next phase
      const endPoint = phasePoints[phasePoints.length - 1];
      currentX = endPoint.x;
      currentY = endPoint.y;
      const sampledEnd = samplePolylineAtProgress(phasePoints, 1);
      currentAngle = sampledEnd.angle;
      if (entity.type === 'goalie') {
        currentStance =
          lastMoveInPhase.endStance ??
          firstMoveInPhase.startStance ??
          currentStance;
      }
      activeMove = lastMoveInPhase.movementType;
      overallProgress = (wIdx + 1) / phaseWindows.length;
      continue;
    }

    // Currently inside this phase's time window [win.startSec, win.endSec]
    const phaseElapsed = timeSec - win.startSec;
    const effectivePhaseDuration = Math.max(
      0.2,
      win.durationSec / Math.max(0.25, speedMultiplier)
    );
    const phaseU = Math.max(0, Math.min(1, phaseElapsed / effectivePhaseDuration));
    const sampled = samplePolylineAtProgress(phasePoints, phaseU);

    currentX = sampled.x;
    currentY = sampled.y;
    currentAngle = sampled.angle;
    activeMove = lastMoveInPhase.movementType;
    overallProgress = (wIdx + phaseU) / phaseWindows.length;

    if (entity.type === 'goalie') {
      if (phaseU <= 0.2 && firstMoveInPhase.startStance) {
        currentStance = firstMoveInPhase.startStance;
      } else if (phaseU >= 0.85 && lastMoveInPhase.endStance) {
        currentStance = lastMoveInPhase.endStance;
      } else if (
        activeMove === 't-push' ||
        activeMove === 'shuffle' ||
        activeMove === 'butterfly-slide' ||
        activeMove === 'c-cut'
      ) {
        currentStance = activeMove as GoalieStance;
      } else {
        currentStance =
          lastMoveInPhase.endStance ??
          firstMoveInPhase.startStance ??
          currentStance;
      }
    }
    break;
  }

  return {
    entityId: entity.id,
    x: currentX,
    y: currentY,
    angle: currentAngle,
    stance: currentStance,
    hasPuck: resolveEntityPuckPossession(entity, paths, timeSec, activeMove),
    progress: overallProgress,
    activeMovementType: activeMove,
  };
}

/**
 * Computes active puck flights (passes and shots) at `timeSec`.
 */
export function getActivePuckFlights(
  drill: Drill,
  timeSec: number
): InterpolatedPuckFlight[] {
  const puckPaths = drill.paths.filter(
    (p) => (p.movementType === 'pass' || p.movementType === 'shot') && p.points.length >= 2
  );
  const flights: InterpolatedPuckFlight[] = [];

  for (const path of puckPaths) {
    const owner = drill.entities.find((e) => e.id === path.entityId);
    const baseDelay = owner?.animation.delaySec ?? 0;
    const baseDuration = owner?.animation.durationSec ?? Math.max(4, drill.durationSec - 2);
    const { flightStart, flightEnd } = getPassFlightWindow(
      path,
      drill.paths,
      baseDelay,
      baseDuration
    );
    const flightDuration = Math.max(0.2, flightEnd - flightStart);

    if (timeSec >= flightStart && timeSec <= flightEnd) {
      const u = (timeSec - flightStart) / flightDuration;
      const pos = samplePolylineAtProgress(path.points, u);
      flights.push({
        id: path.id,
        x: pos.x,
        y: pos.y,
        type: path.movementType as 'pass' | 'shot',
        shotHeight: path.shotHeight,
        progress: u,
      });
    }
  }

  return flights;
}
