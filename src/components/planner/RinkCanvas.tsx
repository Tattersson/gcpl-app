'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Drill,
  DrillEntity,
  DrawnPath,
  EntityType,
  GoalieStance,
  PathMovementType,
  Point2D,
  RinkType,
  ShotHeight,
} from '@/types/planner';
import { RINK_PRESETS } from '@/lib/rinkConfig';
import {
  GOAL_POSTS,
  GoalPost,
  adjustPathEndpoint,
  buildZigzagSvgPath,
  findNearestGoalPost,
  getActivePuckFlights,
  getEntityStateAtTime,
  getPhaseLineOpacity,
  moveEntityWithConnectedLines,
  resolveEntityPuckPossession,
} from '@/lib/animationEngine';
import {
  MousePointer,
  Shield,
  UserPlus,
  Disc,
  Triangle,
  Trash2,
  RotateCcw,
  Eye,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Target,
  Magnet,
  Spline,
  Minus,
  Undo2,
} from 'lucide-react';

interface RinkCanvasProps {
  drill: Drill;
  currentTimeSec: number;
  isPlaying: boolean;
  selectedEntityId: string | null;
  onSelectEntity: (id: string | null) => void;
  onChangeDrill?: (updated: Drill) => void;
  readOnly?: boolean;
}

export const MOVEMENT_STYLES: Record<
  PathMovementType,
  {
    label: string;
    shortTag: string;
    color: string;
    dash?: string;
    role: 'player' | 'goalie' | 'both';
    withPuck?: boolean;
  }
> = {
  skate: {
    label: 'Skate',
    shortTag: 'SKATE',
    color: '#dc2626',
    role: 'player',
  },
  'skate-puck': {
    label: 'Skate w/ Puck',
    shortTag: 'SKATE+PUCK',
    color: '#b91c1c',
    role: 'player',
    withPuck: true,
  },
  backward: {
    label: 'Backward Skate',
    shortTag: 'BACKWARD',
    color: '#7c3aed',
    dash: '6 3',
    role: 'player',
  },
  'backward-puck': {
    label: 'Backward w/ Puck',
    shortTag: 'BACK+PUCK',
    color: '#6d28d9',
    dash: '6 3',
    role: 'player',
    withPuck: true,
  },
  lateral: {
    label: 'Lateral Skate',
    shortTag: 'LATERAL',
    color: '#ea580c',
    dash: '2 4',
    role: 'player',
  },
  'lateral-puck': {
    label: 'Lateral w/ Puck',
    shortTag: 'LAT+PUCK',
    color: '#c2410c',
    dash: '2 4',
    role: 'player',
    withPuck: true,
  },
  pass: {
    label: 'Pass Puck',
    shortTag: 'PASS',
    color: '#2563eb',
    dash: '8 5',
    role: 'both',
  },
  shot: {
    label: 'Shoot on Goal',
    shortTag: 'SHOT',
    color: '#0f172a',
    role: 'player',
  },
  't-push': {
    label: 'T-Push',
    shortTag: 'T-PUSH',
    color: '#0284c7',
    dash: '4 3',
    role: 'goalie',
  },
  shuffle: {
    label: 'Shuffle',
    shortTag: 'SHUFFLE',
    color: '#0d9488',
    dash: '2 3',
    role: 'goalie',
  },
  'c-cut': {
    label: 'Goalie Skate / C-Cut',
    shortTag: 'C-CUT',
    color: '#0891b2',
    role: 'goalie',
  },
  'butterfly-slide': {
    label: 'Butterfly Slide',
    shortTag: 'BF-SLIDE',
    color: '#0369a1',
    dash: '9 3',
    role: 'goalie',
  },
};

const GOALIE_ACTIONS: { id: GoalieStance; label: string; badgeColor: string }[] = [
  { id: 'ready', label: 'Ready Stance', badgeColor: '#0284c7' },
  { id: 'rvh', label: 'RVH (Post)', badgeColor: '#7c3aed' },
  { id: 'vh', label: 'VH (Post)', badgeColor: '#6d28d9' },
  { id: 'overlap', label: 'Overlap Post', badgeColor: '#4f46e5' },
  { id: 'hug-post', label: 'Hug Post', badgeColor: '#9333ea' },
  { id: 'butterfly', label: 'Butterfly', badgeColor: '#0369a1' },
  { id: 'glove-save', label: 'Glove Save', badgeColor: '#059669' },
  { id: 'blocker-save', label: 'Blocker Save', badgeColor: '#d97706' },
];

const POST_PLAY_OPTIONS: {
  id: 'rvh' | 'vh' | 'overlap' | 'hug-post';
  label: string;
  desc: string;
}[] = [
  { id: 'rvh', label: 'RVH (Reverse-VH)', desc: 'Shin/pad sealed against post, skate blade on post/pipe' },
  { id: 'vh', label: 'VH (Vertical-Horizontal)', desc: 'Lead pad vertical against post, trail pad horizontal on ice' },
  { id: 'overlap', label: 'Overlap', desc: 'Behind-the-line overlap stance outside the post' },
  { id: 'hug-post', label: 'Hug Post', desc: 'Upright/active post hug sealing short-side jam' },
];

const PLAYER_MOVE_TOOLS: PathMovementType[] = [
  'skate',
  'skate-puck',
  'backward',
  'backward-puck',
  'lateral',
  'lateral-puck',
  'pass',
  'shot',
];

const GOALIE_MOVE_TOOLS: PathMovementType[] = [
  't-push',
  'shuffle',
  'c-cut',
  'butterfly-slide',
  'pass',
];

export default function RinkCanvas({
  drill,
  currentTimeSec,
  isPlaying,
  selectedEntityId,
  onSelectEntity,
  onChangeDrill,
  readOnly = false,
}: RinkCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [toolMode, setToolMode] = useState<'select' | 'draw' | 'place'>('select');
  const [PendingPlaceType, setPendingPlaceType] = useState<EntityType | null>(null);
  const [movementType, setMovementType] = useState<PathMovementType>('skate');
  // Default line drawing mode is freehand, with option for straight line
  const [lineShape, setLineShape] = useState<'freehand' | 'straight'>('freehand');
  const [shotHeight, setShotHeight] = useState<ShotHeight>('high');
  const [drawPhase, setDrawPhase] = useState<number>(1);
  const [moveStartStance, setMoveStartStance] = useState<GoalieStance>('ready');
  const [moveEndStance, setMoveEndStance] = useState<GoalieStance>('ready');
  const [passFromId, setPassFromId] = useState<string | 'free'>('free');
  const [passToId, setPassToId] = useState<string | 'free'>('free');
  const [draggingEntityId, setDraggingEntityId] = useState<string | null>(null);
  // Dragging start or end point of an existing line
  const [draggingLineEndpoint, setDraggingLineEndpoint] = useState<{
    pathId: string;
    which: 'start' | 'end';
  } | null>(null);
  const [activePathPoints, setActivePathPoints] = useState<Point2D[]>([]);
  const [showAngleLines, setShowAngleLines] = useState<boolean>(true);
  const [undoStack, setUndoStack] = useState<Drill[]>([]);
  const dragSnapshotCapturedRef = useRef<boolean>(false);

  // Reset undo history when switching to a different drill
  useEffect(() => {
    setUndoStack([]);
  }, [drill.id]);

  function pushUndoSnapshot(snapshot: Drill = drill) {
    const cloned: Drill = JSON.parse(JSON.stringify(snapshot));
    setUndoStack((prev) => [...prev.slice(-29), cloned]);
  }

  function handleUndo() {
    if (readOnly || !onChangeDrill || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setPostSnapPrompt(null);
    onChangeDrill(previous);
  }

  // Support Ctrl+Z / Cmd+Z keyboard shortcut for Undo
  useEffect(() => {
    if (readOnly || !onChangeDrill) return;
    function onKeyDown(ev: KeyboardEvent) {
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && !ev.shiftKey) {
        if (undoStack.length > 0) {
          ev.preventDefault();
          const previous = undoStack[undoStack.length - 1];
          setUndoStack((prev) => prev.slice(0, -1));
          setPostSnapPrompt(null);
          onChangeDrill?.(previous);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [readOnly, onChangeDrill, undoStack]);

  // Post Snap prompt state: opens when a goalie or goalie path snaps to a goal post
  const [postSnapPrompt, setPostSnapPrompt] = useState<{
    goalieId: string;
    goalieLabel: string;
    post: GoalPost;
    pathId?: string;
  } | null>(null);

  // Zoom & Pan state for fine goalie/player micro-adjustments
  const [zoom, setZoom] = useState<number>(1);
  const [panCenter, setPanCenter] = useState<Point2D | null>(null);
  const [panDragStart, setPanDragStart] = useState<{
    clientX: number;
    clientY: number;
    originCenter: Point2D;
  } | null>(null);

  const preset = RINK_PRESETS[drill.rinkType] || RINK_PRESETS.full;
  const selectedEntity = drill.entities.find((e) => e.id === selectedEntityId) || null;

  // Compute zoomed SVG viewBox
  const defaultCenter: Point2D = {
    x: preset.bounds.minX + preset.bounds.width / 2,
    y: preset.bounds.minY + preset.bounds.height / 2,
  };
  const effectiveCenter = panCenter || defaultCenter;
  const viewW = preset.bounds.width / zoom;
  const viewH = preset.bounds.height / zoom;
  const minX = Math.max(
    0,
    Math.min(1000 - viewW, effectiveCenter.x - viewW / 2)
  );
  const minY = Math.max(
    0,
    Math.min(500 - viewH, effectiveCenter.y - viewH / 2)
  );
  const computedViewBox =
    zoom === 1
      ? preset.viewBox
      : `${minX.toFixed(1)} ${minY.toFixed(1)} ${viewW.toFixed(1)} ${viewH.toFixed(1)}`;

  // Scale down players/goalies & strokes when zoomed in so lines and small crease moves are easy to see
  const entityScale = Number((1 / Math.pow(zoom, 0.72)).toFixed(3));
  const strokeScale = Number((1 / Math.pow(zoom, 0.55)).toFixed(3));

  /**
   * Uses native SVG screen CTM inverse so the mouse pointer stays 100% locked
   * to the player/goalie position across any screen aspect ratio or zoom level.
   */
  function clientToSvgPoint(clientX: number, clientY: number): Point2D {
    const svg = svgRef.current;
    if (!svg) return { x: 100, y: 250 };

    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse());
      return {
        x: Math.round(transformed.x * 10) / 10,
        y: Math.round(transformed.y * 10) / 10,
      };
    }

    const rect = svg.getBoundingClientRect();
    const normX = (clientX - rect.left) / Math.max(1, rect.width);
    const normY = (clientY - rect.top) / Math.max(1, rect.height);
    return {
      x: Math.round((minX + normX * viewW) * 10) / 10,
      y: Math.round((minY + normY * viewH) * 10) / 10,
    };
  }

  // Non-passive mouse wheel zoom support on the SVG rink
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || readOnly) return;

    function handleWheel(ev: WheelEvent) {
      ev.preventDefault();
      const pointerSvg = clientToSvgPoint(ev.clientX, ev.clientY);
      const step = ev.deltaY < 0 ? 0.25 : -0.25;

      setZoom((prevZoom) => {
        const nextZoom = Math.max(
          1,
          Math.min(4, Number((prevZoom + step).toFixed(2)))
        );
        if (nextZoom === 1) {
          setPanCenter(null);
        } else if (nextZoom !== prevZoom) {
          // Shift pan center gently toward the mouse pointer while zooming
          setPanCenter((prevCenter) => {
            const base = prevCenter || defaultCenter;
            const blend = 0.25;
            return {
              x: Math.max(0, Math.min(1000, base.x * (1 - blend) + pointerSvg.x * blend)),
              y: Math.max(0, Math.min(500, base.y * (1 - blend) + pointerSvg.y * blend)),
            };
          });
        }
        return nextZoom;
      });
    }

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [readOnly, defaultCenter.x, defaultCenter.y]);

  function createEntityAtPoint(type: EntityType, pt: Point2D): DrillEntity {
    const countOfSame = drill.entities.filter((e) => e.type === type).length + 1;
    const prefix =
      type === 'goalie'
        ? 'G'
        : type === 'player'
        ? 'P'
        : type === 'coach'
        ? 'C'
        : type === 'puck'
        ? 'PUCK'
        : 'CONE';
    const color =
      type === 'goalie'
        ? '#0284c7'
        : type === 'player'
        ? '#dc2626'
        : type === 'coach'
        ? '#0f172a'
        : type === 'puck'
        ? '#111827'
        : '#f59e0b';

    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: type === 'puck' ? `Pucks` : `${prefix}${countOfSame}`,
      color,
      x: pt.x,
      y: pt.y,
      angle: type === 'goalie' ? 0 : 180,
      stance: type === 'goalie' ? 'ready' : undefined,
      hasPuck: type === 'puck',
      animation: {
        delaySec: 0,
        durationSec: Math.max(4, drill.durationSec - 2),
        speedMultiplier: 1,
        useCustomKeyframes: false,
        keyframes: [
          {
            id: `kf-${Date.now()}-0`,
            t: 0,
            x: pt.x,
            y: pt.y,
            angle: type === 'goalie' ? 0 : 180,
            stance: type === 'goalie' ? 'ready' : undefined,
          },
        ],
      },
    };
  }

  function handleStartPlacement(type: EntityType) {
    setPendingPlaceType(type);
    setToolMode('place');
  }

  function handleSelectEntityAndSetupTools(ent: DrillEntity) {
    onSelectEntity(ent.id);
    if (toolMode === 'place') {
      setToolMode('select');
      setPendingPlaceType(null);
    }
    if (ent.type === 'goalie' || ent.type === 'player' || ent.type === 'coach') {
      setPassFromId(ent.id);
      const otherPlayer = drill.entities.find(
        (x) =>
          x.id !== ent.id &&
          (x.type === 'player' || x.type === 'coach' || x.type === 'goalie')
      );
      setPassToId(otherPlayer ? otherPlayer.id : 'free');
    }
    if (ent.type === 'goalie') {
      const phaseMove = drill.paths.find(
        (p) => p.entityId === ent.id && p.phase === drawPhase
      );
      setMoveStartStance(phaseMove?.startStance || ent.stance || 'ready');
      setMoveEndStance(phaseMove?.endStance || 'ready');
      if (MOVEMENT_STYLES[movementType]?.role === 'player') {
        setMovementType('t-push');
      }
    } else if (MOVEMENT_STYLES[movementType]?.role === 'goalie') {
      setMovementType('skate');
    }
  }

  function findNearestPassEntity(
    pt: Point2D,
    excludeId?: string
  ): DrillEntity | null {
    const maxDist = 24 / Math.sqrt(zoom);
    let best: DrillEntity | null = null;
    let bestDist = maxDist;
    for (const ent of drill.entities) {
      if (ent.id === excludeId) continue;
      if (ent.type !== 'player' && ent.type !== 'coach' && ent.type !== 'goalie') {
        continue;
      }
      const d = Math.hypot(pt.x - ent.x, pt.y - ent.y);
      if (d <= bestDist) {
        bestDist = d;
        best = ent;
      }
    }
    return best;
  }

  function handleQuickConnectPass() {
    if (readOnly || !onChangeDrill) return;
    const fromEnt =
      passFromId !== 'free'
        ? drill.entities.find((e) => e.id === passFromId)
        : null;
    const toEnt =
      passToId !== 'free'
        ? drill.entities.find((e) => e.id === passToId)
        : null;

    if (!fromEnt || !toEnt) return;
    pushUndoSnapshot();

    const startPt = getSnappedStartAnchor(fromEnt, { x: toEnt.x, y: toEnt.y });
    const endPt = getSnappedStartAnchor(toEnt, startPt);

    const newPass: DrawnPath = {
      id: `path-${Date.now()}`,
      entityId: fromEnt.id,
      movementType: 'pass',
      passFromId: fromEnt.id,
      passToId: toEnt.id,
      points: [startPt, endPt],
      color: MOVEMENT_STYLES.pass.color,
      phase: drawPhase,
    };

    const updatedEntities = drill.entities.map((ent) => {
      if (ent.id === fromEnt.id && drawPhase === 1) {
        return { ...ent, hasPuck: true };
      }
      return ent;
    });

    onChangeDrill({
      ...drill,
      entities: updatedEntities,
      paths: [...drill.paths, newPass],
    });
  }

  function handleUpdateGoalieMoveStances(
    nextStart: GoalieStance,
    nextEnd: GoalieStance
  ) {
    setMoveStartStance(nextStart);
    setMoveEndStance(nextEnd);
    if (readOnly || !onChangeDrill || !selectedEntity || selectedEntity.type !== 'goalie') {
      return;
    }
    pushUndoSnapshot();
    const updatedPaths = drill.paths.map((p) =>
      p.entityId === selectedEntity.id && p.phase === drawPhase
        ? { ...p, startStance: nextStart, endStance: nextEnd }
        : p
    );
    const updatedEntities =
      drawPhase === 1
        ? drill.entities.map((ent) =>
            ent.id === selectedEntity.id ? { ...ent, stance: nextStart } : ent
          )
        : drill.entities;
    onChangeDrill({
      ...drill,
      entities: updatedEntities,
      paths: updatedPaths,
    });
  }

  function handleGoalieActionSelect(
    stance: GoalieStance,
    targetGoalieId?: string,
    targetPathId?: string
  ) {
    if (readOnly || !onChangeDrill) return;
    const gId = targetGoalieId || selectedEntity?.id;
    if (!gId) return;
    pushUndoSnapshot();

    // If snapping the end of a drawn path to a post, set that path's endStance
    if (targetPathId) {
      setMoveEndStance(stance);
      const updatedPaths = drill.paths.map((p) =>
        p.id === targetPathId ? { ...p, endStance: stance } : p
      );
      onChangeDrill({ ...drill, paths: updatedPaths });
      setPostSnapPrompt(null);
      return;
    }

    setMoveStartStance(stance);
    const updatedEntities = drill.entities.map((ent) => {
      if (ent.id !== gId) return ent;
      const updatedKf = ent.animation.keyframes.map((kf, idx) =>
        idx === 0 ? { ...kf, stance } : kf
      );
      return {
        ...ent,
        stance,
        animation: {
          ...ent.animation,
          keyframes: updatedKf,
        },
      };
    });
    const updatedPaths = drill.paths.map((p) =>
      p.entityId === gId && p.phase === 1 ? { ...p, startStance: stance } : p
    );
    onChangeDrill({ ...drill, entities: updatedEntities, paths: updatedPaths });
    setPostSnapPrompt(null);
  }

  /**
   * Computes the exact snap anchor point on the player/goalie (or end of their last movement line)
   * when beginning a new movement, pass, or shot line.
   */
  function getSnappedStartAnchor(ent: DrillEntity, cursorPt: Point2D): Point2D {
    const prevMovePaths = drill.paths.filter(
      (p) =>
        p.entityId === ent.id &&
        p.movementType !== 'pass' &&
        p.movementType !== 'shot' &&
        p.points.length >= 2
    );
    if (prevMovePaths.length > 0) {
      const lastPath = prevMovePaths[prevMovePaths.length - 1];
      const endOfLastPath = lastPath.points[lastPath.points.length - 1];
      const distToEnd = Math.hypot(cursorPt.x - endOfLastPath.x, cursorPt.y - endOfLastPath.y);
      const distToOrigin = Math.hypot(cursorPt.x - ent.x, cursorPt.y - ent.y);
      if (
        movementType === 'shot' ||
        movementType === 'pass' ||
        drawPhase > lastPath.phase ||
        distToEnd <= distToOrigin
      ) {
        return { x: endOfLastPath.x, y: endOfLastPath.y };
      }
    }
    return { x: ent.x, y: ent.y };
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly || !onChangeDrill) return;

    const pt = clientToSvgPoint(e.clientX, e.clientY);
    const snapRadius = 15 / Math.sqrt(zoom);

    if (toolMode === 'place' && PendingPlaceType) {
      pushUndoSnapshot();
      let placePt = pt;
      let snappedPost: GoalPost | null = null;
      if (PendingPlaceType === 'goalie') {
        snappedPost = findNearestGoalPost(pt, snapRadius);
        if (snappedPost) {
          placePt = { x: snappedPost.x, y: snappedPost.y };
        }
      }

      const newEnt = createEntityAtPoint(PendingPlaceType, placePt);
      onChangeDrill({
        ...drill,
        appointedGoalies:
          drill.entities.filter((x) => x.type === 'goalie').length +
          (PendingPlaceType === 'goalie' ? 1 : 0),
        appointedPlayers:
          drill.entities.filter((x) => x.type === 'player').length +
          (PendingPlaceType === 'player' ? 1 : 0),
        appointedCoaches:
          drill.entities.filter((x) => x.type === 'coach').length +
          (PendingPlaceType === 'coach' ? 1 : 0),
        entities: [...drill.entities, newEnt],
      });
      onSelectEntity(newEnt.id);

      if (snappedPost && newEnt.type === 'goalie') {
        setPostSnapPrompt({
          goalieId: newEnt.id,
          goalieLabel: newEnt.label,
          post: snappedPost,
        });
      }

      if (
        PendingPlaceType === 'goalie' ||
        PendingPlaceType === 'player' ||
        PendingPlaceType === 'coach'
      ) {
        setToolMode('select');
        setPendingPlaceType(null);
        setMovementType(PendingPlaceType === 'goalie' ? 't-push' : 'skate');
      }
      return;
    }

    if (toolMode === 'draw' && selectedEntity) {
      e.currentTarget.setPointerCapture(e.pointerId);
      if (movementType === 'pass') {
        const fromEnt =
          passFromId !== 'free'
            ? drill.entities.find((x) => x.id === passFromId) || selectedEntity
            : null;
        const anchorPt = fromEnt ? getSnappedStartAnchor(fromEnt, pt) : pt;
        setActivePathPoints([anchorPt, pt]);
        return;
      }
      const anchorPt = getSnappedStartAnchor(selectedEntity, pt);
      setActivePathPoints([anchorPt, pt]);
      return;
    }

    // Clicking outside of a player/handle on the ice pans the canvas
    if (toolMode === 'select') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setPanDragStart({
        clientX: e.clientX,
        clientY: e.clientY,
        originCenter: effectiveCenter,
      });
    }
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (readOnly || !onChangeDrill) return;

    const pt = clientToSvgPoint(e.clientX, e.clientY);
    const snapRadius = 15 / Math.sqrt(zoom);

    // 1. Dragging a line's start or end control handle
    if (draggingLineEndpoint) {
      if (!dragSnapshotCapturedRef.current) {
        pushUndoSnapshot();
        dragSnapshotCapturedRef.current = true;
      }
      const targetPath = drill.paths.find((p) => p.id === draggingLineEndpoint.pathId);
      const ownerEnt = drill.entities.find((ent) => ent.id === targetPath?.entityId);
      let nextPt = pt;
      if (ownerEnt?.type === 'goalie') {
        const nearPost = findNearestGoalPost(pt, snapRadius);
        if (nearPost) {
          nextPt = { x: nearPost.x, y: nearPost.y };
        }
      }
      const updatedDrill = adjustPathEndpoint(
        drill,
        draggingLineEndpoint.pathId,
        draggingLineEndpoint.which,
        nextPt
      );
      onChangeDrill(updatedDrill);
      return;
    }

    // 2. Dragging a player/goalie (moves connected lines together)
    if (toolMode === 'select' && draggingEntityId) {
      if (!dragSnapshotCapturedRef.current) {
        pushUndoSnapshot();
        dragSnapshotCapturedRef.current = true;
      }
      const draggedEnt = drill.entities.find((ent) => ent.id === draggingEntityId);
      let nextPt = pt;
      if (draggedEnt?.type === 'goalie') {
        const nearPost = findNearestGoalPost(pt, snapRadius);
        if (nearPost) {
          nextPt = { x: nearPost.x, y: nearPost.y };
        }
      }
      const updatedDrill = moveEntityWithConnectedLines(
        drill,
        draggingEntityId,
        nextPt
      );
      onChangeDrill(updatedDrill);
      return;
    }

    // 3. Panning the canvas when clicking and dragging outside of a player
    if (toolMode === 'select' && panDragStart && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const dxSvg = ((e.clientX - panDragStart.clientX) / Math.max(1, rect.width)) * viewW;
      const dySvg = ((e.clientY - panDragStart.clientY) / Math.max(1, rect.height)) * viewH;
      setPanCenter({
        x: Math.max(0, Math.min(1000, panDragStart.originCenter.x - dxSvg)),
        y: Math.max(0, Math.min(500, panDragStart.originCenter.y - dySvg)),
      });
      return;
    }

    // 4. Drawing a movement / pass / shot line (Freehand vs Straight Line)
    if (toolMode === 'draw' && activePathPoints.length > 0) {
      let nextDrawPt = pt;
      if (selectedEntity?.type === 'goalie') {
        const nearPost = findNearestGoalPost(pt, snapRadius);
        if (nearPost) {
          nextDrawPt = { x: nearPost.x, y: nearPost.y };
        }
      }

      if (lineShape === 'straight') {
        setActivePathPoints([activePathPoints[0], nextDrawPt]);
      } else {
        const last = activePathPoints[activePathPoints.length - 1];
        const minStep = zoom >= 2 ? 2.0 : 4.5;
        if (Math.hypot(nextDrawPt.x - last.x, nextDrawPt.y - last.y) >= minStep) {
          setActivePathPoints([...activePathPoints, nextDrawPt]);
        }
      }
    }
  }

  function handlePointerUp() {
    if (readOnly || !onChangeDrill) return;
    const snapRadius = 15 / Math.sqrt(zoom);
    dragSnapshotCapturedRef.current = false;

    if (panDragStart) {
      setPanDragStart(null);
    }

    if (draggingLineEndpoint) {
      const targetPath = drill.paths.find((p) => p.id === draggingLineEndpoint.pathId);
      const ownerEnt = drill.entities.find((ent) => ent.id === targetPath?.entityId);
      if (targetPath && ownerEnt?.type === 'goalie' && draggingLineEndpoint.which === 'end') {
        const lastPt = targetPath.points[targetPath.points.length - 1];
        const snappedPost = findNearestGoalPost(lastPt, snapRadius);
        if (snappedPost) {
          setPostSnapPrompt({
            goalieId: ownerEnt.id,
            goalieLabel: ownerEnt.label,
            post: snappedPost,
            pathId: targetPath.id,
          });
        }
      }
      setDraggingLineEndpoint(null);
    }

    if (draggingEntityId) {
      const draggedEnt = drill.entities.find((ent) => ent.id === draggingEntityId);
      if (draggedEnt?.type === 'goalie') {
        const snappedPost = findNearestGoalPost(
          { x: draggedEnt.x, y: draggedEnt.y },
          snapRadius
        );
        if (snappedPost) {
          setPostSnapPrompt({
            goalieId: draggedEnt.id,
            goalieLabel: draggedEnt.label,
            post: snappedPost,
          });
        }
      }
      setDraggingEntityId(null);
    }

    if (toolMode === 'draw' && activePathPoints.length >= 2 && selectedEntity) {
      const finalPoints = [...activePathPoints];
      let endPostSnap: GoalPost | null = null;

      if (selectedEntity.type === 'goalie') {
        const lastPt = finalPoints[finalPoints.length - 1];
        endPostSnap = findNearestGoalPost(lastPt, snapRadius);
        if (endPostSnap) {
          finalPoints[finalPoints.length - 1] = {
            x: endPostSnap.x,
            y: endPostSnap.y,
          };
        }
      }

      const style = MOVEMENT_STYLES[movementType] || MOVEMENT_STYLES.skate;
      pushUndoSnapshot();

      let resolvedPassFrom: string | 'free' | undefined = undefined;
      let resolvedPassTo: string | 'free' | undefined = undefined;
      let ownerEntityId = selectedEntity.id;

      if (movementType === 'pass') {
        resolvedPassFrom = passFromId || selectedEntity.id;
        if (resolvedPassFrom !== 'free') {
          ownerEntityId = resolvedPassFrom;
        }
        const lastPt = finalPoints[finalPoints.length - 1];
        const nearReceiver = findNearestPassEntity(
          lastPt,
          resolvedPassFrom !== 'free' ? resolvedPassFrom : undefined
        );
        if (nearReceiver) {
          resolvedPassTo = nearReceiver.id;
          finalPoints[finalPoints.length - 1] = getSnappedStartAnchor(
            nearReceiver,
            finalPoints[0]
          );
          setPassToId(nearReceiver.id);
        } else {
          resolvedPassTo = passToId;
          if (resolvedPassTo && resolvedPassTo !== 'free') {
            const explicitTarget = drill.entities.find((x) => x.id === resolvedPassTo);
            if (explicitTarget && lineShape === 'straight') {
              // Keep user's drawn point unless they released near the target
              resolvedPassTo = 'free';
            }
          }
        }
      }

      const newPath: DrawnPath = {
        id: `path-${Date.now()}`,
        entityId: ownerEntityId,
        movementType,
        shotHeight: movementType === 'shot' ? shotHeight : undefined,
        startStance:
          selectedEntity.type === 'goalie' && movementType !== 'pass'
            ? moveStartStance
            : undefined,
        endStance:
          selectedEntity.type === 'goalie' && movementType !== 'pass'
            ? moveEndStance
            : undefined,
        passFromId: resolvedPassFrom,
        passToId: resolvedPassTo,
        points: finalPoints,
        color: style.color,
        phase: drawPhase,
      };

      const updatedEntities = drill.entities.map((ent) => {
        if (
          movementType === 'pass' &&
          resolvedPassFrom !== 'free' &&
          ent.id === resolvedPassFrom &&
          drawPhase === 1
        ) {
          return { ...ent, hasPuck: true };
        }
        if (
          movementType === 'pass' &&
          resolvedPassFrom === 'free' &&
          drawPhase === 1
        ) {
          return { ...ent, hasPuck: false };
        }
        if (ent.id !== selectedEntity.id) return ent;
        return {
          ...ent,
          hasPuck: style.withPuck ? true : ent.hasPuck,
          stance:
            ent.type === 'goalie' && drawPhase === 1 ? moveStartStance : ent.stance,
        };
      });

      onChangeDrill({
        ...drill,
        entities: updatedEntities,
        paths: [...drill.paths, newPath],
      });

      if (endPostSnap && selectedEntity.type === 'goalie') {
        setPostSnapPrompt({
          goalieId: selectedEntity.id,
          goalieLabel: selectedEntity.label,
          post: endPostSnap,
          pathId: newPath.id,
        });
      }

      setActivePathPoints([]);
    } else {
      setActivePathPoints([]);
    }
  }

  function handleDeleteSelectedEntity() {
    if (readOnly || !onChangeDrill || !selectedEntityId) return;
    pushUndoSnapshot();
    const remainingEntities = drill.entities.filter((e) => e.id !== selectedEntityId);
    const remainingPaths = drill.paths.filter((p) => p.entityId !== selectedEntityId);

    onChangeDrill({
      ...drill,
      appointedGoalies: Math.max(
        1,
        remainingEntities.filter((e) => e.type === 'goalie').length
      ),
      appointedPlayers: remainingEntities.filter((e) => e.type === 'player').length,
      appointedCoaches: remainingEntities.filter((e) => e.type === 'coach').length,
      entities: remainingEntities,
      paths: remainingPaths,
    });
    onSelectEntity(remainingEntities[0]?.id ?? null);
    setPostSnapPrompt(null);
  }

  function handleClearPathsForSelected() {
    if (readOnly || !onChangeDrill || !selectedEntityId) return;
    pushUndoSnapshot();
    onChangeDrill({
      ...drill,
      paths: drill.paths.filter((p) => p.entityId !== selectedEntityId),
    });
  }

  function handleStartFresh() {
    if (
      readOnly ||
      !onChangeDrill ||
      (drill.entities.length === 0 && drill.paths.length === 0)
    ) {
      return;
    }
    pushUndoSnapshot();
    setPostSnapPrompt(null);
    setActivePathPoints([]);
    onSelectEntity(null);
    onChangeDrill({
      ...drill,
      entities: [],
      paths: [],
    });
  }

  function handleZoomToSelected() {
    if (selectedEntity) {
      setPanCenter({ x: selectedEntity.x, y: selectedEntity.y });
      setZoom((z) => (z < 2.5 ? 2.5 : z));
    } else {
      setPanCenter({
        x: preset.defaultGoaliePos.x + 30,
        y: preset.defaultGoaliePos.y,
      });
      setZoom(2.5);
    }
  }

  const activePuckFlights = getActivePuckFlights(drill, currentTimeSec);

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Rink View Selector, Placement Palette & Fixed-Width Zoom Controls */}
      {!readOnly && onChangeDrill && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          {/* Rink Size Selector */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              Rink:
            </span>
            {(Object.keys(RINK_PRESETS) as RinkType[]).map((rKey) => {
              const r = RINK_PRESETS[rKey];
              const active = drill.rinkType === rKey;
              return (
                <button
                  key={rKey}
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPanCenter(null);
                    onChangeDrill({ ...drill, rinkType: rKey });
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    active
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {r.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Place Goalies, Players, Coaches, Pucks & Cones on Ice */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-0.5">
              Place on Ice:
            </span>
            <button
              type="button"
              onClick={() => handleStartPlacement('goalie')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                toolMode === 'place' && PendingPlaceType === 'goalie'
                  ? 'bg-sky-600 text-white border-sky-600 ring-2 ring-sky-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              + Goalie
            </button>
            <button
              type="button"
              onClick={() => handleStartPlacement('player')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                toolMode === 'place' && PendingPlaceType === 'player'
                  ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              + Player
            </button>
            <button
              type="button"
              onClick={() => handleStartPlacement('coach')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                toolMode === 'place' && PendingPlaceType === 'coach'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              + Coach
            </button>
            <button
              type="button"
              onClick={() => handleStartPlacement('puck')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border transition ${
                toolMode === 'place' && PendingPlaceType === 'puck'
                  ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-300'
                  : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
              }`}
              title="Click on the ice to specify where pucks are placed"
            >
              <Disc className="h-3.5 w-3.5" />
              + Place Pucks
            </button>
            <button
              type="button"
              onClick={() => handleStartPlacement('cone')}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold border transition ${
                toolMode === 'place' && PendingPlaceType === 'cone'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Triangle className="h-3.5 w-3.5" />
              + Cone
            </button>
            <button
              type="button"
              disabled={undoStack.length === 0}
              onClick={handleUndo}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-40"
              title="Undo last action (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo{undoStack.length > 0 ? ` (${undoStack.length})` : ''}
            </button>
            <button
              type="button"
              disabled={drill.entities.length === 0 && drill.paths.length === 0}
              onClick={handleStartFresh}
              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 shadow-sm hover:bg-rose-100 disabled:opacity-40"
              title="Delete all players, goalies, pucks, and moves on this drill (can be undone with Undo)"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Start Fresh
            </button>
          </div>

          {/* Rink Zoom Controls with Fixed Min-Widths so Buttons Never Shrink or Shift */}
          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
              className="flex h-7 min-w-[30px] shrink-0 items-center justify-center rounded bg-white text-slate-700 shadow-sm hover:bg-slate-100"
              title="Zoom Out (or scroll wheel down)"
            >
              <ZoomOut className="h-3.5 w-3.5 shrink-0" />
            </button>
            <span className="min-w-[48px] shrink-0 text-center font-mono text-xs font-bold tabular-nums text-slate-800">
              {zoom.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))))}
              className="flex h-7 min-w-[30px] shrink-0 items-center justify-center rounded bg-white text-slate-700 shadow-sm hover:bg-slate-100"
              title="Zoom In (or scroll wheel up)"
            >
              <ZoomIn className="h-3.5 w-3.5 shrink-0" />
            </button>
            <button
              type="button"
              onClick={handleZoomToSelected}
              className="flex h-7 shrink-0 items-center gap-1 rounded bg-white px-2 text-[11px] font-bold text-sky-700 shadow-sm hover:bg-sky-50"
              title="Zoom in on selected player/goalie"
            >
              <Crosshair className="h-3 w-3 shrink-0" />
              Focus
            </button>
            {zoom > 1 && (
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPanCenter(null);
                }}
                className="flex h-7 shrink-0 items-center rounded bg-white px-2 text-[11px] font-semibold text-slate-600 shadow-sm hover:text-slate-900"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAngleLines(!showAngleLines)}
              className={`ml-0.5 flex h-7 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold ${
                showAngleLines
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-white text-slate-500'
              }`}
              title="Toggle Crease Angle Guide Rays"
            >
              <Eye className="h-3 w-3 shrink-0" />
              Angles
            </button>
          </div>
        </div>
      )}

      {/* Goal Post Snap Prompt — Asks Coach How Goalie Should Take the Post (RVH, VH, Overlap, Hug Post) */}
      {!readOnly && postSnapPrompt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-purple-500 bg-purple-950 px-4 py-3 text-white shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white">
              <Magnet className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-purple-200">
                {postSnapPrompt.goalieLabel} Snapped to {postSnapPrompt.post.label}
              </div>
              <div className="text-xs text-purple-100">
                How should <strong>{postSnapPrompt.goalieLabel}</strong> take the post?
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {POST_PLAY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  handleGoalieActionSelect(
                    opt.id,
                    postSnapPrompt.goalieId,
                    postSnapPrompt.pathId
                  )
                }
                title={opt.desc}
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-extrabold text-white shadow hover:bg-purple-500 transition"
              >
                {opt.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPostSnapPrompt(null)}
              className="rounded-lg border border-purple-700 bg-purple-900/60 px-2.5 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-800"
            >
              Keep Current
            </button>
          </div>
        </div>
      )}

      {/* Row 2: Contextual Action Toolbar — Opens Automatically When a Player or Goalie is Selected */}
      {!readOnly && onChangeDrill && selectedEntity && (
        <div className="rounded-xl border-2 border-sky-500/30 bg-slate-900 p-3 text-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-extrabold text-white"
                style={{ backgroundColor: selectedEntity.color }}
              >
                {selectedEntity.label}
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                {selectedEntity.type === 'goalie'
                  ? `Goalie Action & Movement Tools (${selectedEntity.label})`
                  : selectedEntity.type === 'player' || selectedEntity.type === 'coach'
                  ? `Skater / Shooter Action Tools (${selectedEntity.label})`
                  : `Selected Item (${selectedEntity.label})`}
              </span>

              {(selectedEntity.type === 'goalie' ||
                selectedEntity.type === 'player' ||
                selectedEntity.type === 'coach') && (
                <>
                  {/* Line Shape Selector: Freehand (default) vs Straight Line */}
                  <div className="ml-1 inline-flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setLineShape('freehand')}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        lineShape === 'freehand'
                          ? 'bg-sky-500 text-white shadow'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title="Draw curved freehand movement paths (Default)"
                    >
                      <Spline className="h-3.5 w-3.5" />
                      Freehand
                    </button>
                    <button
                      type="button"
                      onClick={() => setLineShape('straight')}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                        lineShape === 'straight'
                          ? 'bg-sky-500 text-white shadow'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      title="Draw straight point-to-point movement/shot lines"
                    >
                      <Minus className="h-3.5 w-3.5" />
                      Straight Line
                    </button>
                  </div>

                  <select
                    value={drawPhase}
                    onChange={(e) => {
                      const nextPhase = Number(e.target.value);
                      setDrawPhase(nextPhase);
                      if (selectedEntity.type === 'goalie') {
                        const existingPhaseMove = drill.paths.find(
                          (p) =>
                            p.entityId === selectedEntity.id && p.phase === nextPhase
                        );
                        const prevPhaseMove = drill.paths.find(
                          (p) =>
                            p.entityId === selectedEntity.id &&
                            p.phase === nextPhase - 1
                        );
                        setMoveStartStance(
                          existingPhaseMove?.startStance ||
                            prevPhaseMove?.endStance ||
                            selectedEntity.stance ||
                            'ready'
                        );
                        setMoveEndStance(existingPhaseMove?.endStance || 'ready');
                      }
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-bold text-sky-300"
                  >
                    <option value={1}>Phase 1</option>
                    <option value={2}>Phase 2</option>
                    <option value={3}>Phase 3</option>
                    <option value={4}>Phase 4</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {(selectedEntity.type === 'player' || selectedEntity.type === 'coach') && (
                <label className="mr-2 flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedEntity.hasPuck)}
                    onChange={(e) => {
                      const updated = drill.entities.map((ent) =>
                        ent.id === selectedEntity.id
                          ? { ...ent, hasPuck: e.target.checked }
                          : ent
                      );
                      onChangeDrill({ ...drill, entities: updated });
                    }}
                    className="rounded border-slate-600 text-sky-500"
                  />
                  Starts w/ Puck
                </label>
              )}
              <button
                type="button"
                onClick={handleClearPathsForSelected}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear Moves
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedEntity}
                className="flex items-center gap-1 rounded-lg bg-rose-600/90 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selectedEntity.label}
              </button>
            </div>
          </div>

          {/* Tools specific to PLAYER / COACH */}
          {(selectedEntity.type === 'player' || selectedEntity.type === 'coach') && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setToolMode('select')}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  toolMode === 'select'
                    ? 'bg-sky-500 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <MousePointer className="h-3.5 w-3.5" />
                Move / Adjust Points
              </button>

              {PLAYER_MOVE_TOOLS.map((mType) => {
                const style = MOVEMENT_STYLES[mType];
                const isActive = toolMode === 'draw' && movementType === mType;
                return (
                  <button
                    key={mType}
                    type="button"
                    onClick={() => {
                      setToolMode('draw');
                      setMovementType(mType);
                    }}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                      isActive
                        ? 'bg-sky-500 text-white ring-2 ring-sky-300 shadow'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {style.label}
                  </button>
                );
              })}

              {/* Shot Type / Placement Selector (High, Medium, Ice) when Shoot is active */}
              {toolMode === 'draw' && movementType === 'shot' && (
                <div className="ml-auto flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-1">
                  <Target className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold text-amber-300 mr-1">
                    Shot Type:
                  </span>
                  {(['high', 'medium', 'ice'] as ShotHeight[]).map((sh) => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setShotHeight(sh)}
                      className={`rounded px-2 py-0.5 text-xs font-extrabold uppercase transition ${
                        shotHeight === sh
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-amber-200 hover:bg-amber-500/20'
                      }`}
                    >
                      {sh} Shot
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pass Routing Selector (From Who -> To Who, with "Free" Option) */}
          {toolMode === 'draw' && movementType === 'pass' && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-500/40 bg-sky-950/60 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
                  Pass Puck Routing:
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">
                    From (Has Puck):
                  </span>
                  <select
                    value={passFromId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPassFromId(val);
                      if (val === 'free' && onChangeDrill) {
                        // When "Free" is chosen as who has the puck, clear player puck possession for this phase
                        pushUndoSnapshot();
                        onChangeDrill({
                          ...drill,
                          entities: drill.entities.map((ent) => ({
                            ...ent,
                            hasPuck: false,
                          })),
                        });
                      } else if (val !== 'free' && onChangeDrill) {
                        pushUndoSnapshot();
                        onChangeDrill({
                          ...drill,
                          entities: drill.entities.map((ent) => ({
                            ...ent,
                            hasPuck: ent.id === val,
                          })),
                        });
                      }
                    }}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-bold text-white"
                  >
                    <option value="free">Free (No Player Marked w/ Puck)</option>
                    {drill.entities
                      .filter(
                        (e) =>
                          e.type === 'player' ||
                          e.type === 'coach' ||
                          e.type === 'goalie'
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label} ({e.type})
                        </option>
                      ))}
                  </select>
                </div>

                <span className="text-xs font-extrabold text-sky-400">→</span>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-300">
                    To (Receiver):
                  </span>
                  <select
                    value={passToId}
                    onChange={(e) => setPassToId(e.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-bold text-white"
                  >
                    <option value="free">Free (Open Ice / Area Pass)</option>
                    {drill.entities
                      .filter(
                        (e) =>
                          e.type === 'player' ||
                          e.type === 'coach' ||
                          e.type === 'goalie'
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label} ({e.type})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {passFromId !== 'free' &&
                passToId !== 'free' &&
                passFromId !== passToId && (
                  <button
                    type="button"
                    onClick={handleQuickConnectPass}
                    className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-extrabold text-white shadow hover:bg-sky-400 transition"
                  >
                    Connect Pass ({
                      drill.entities.find((e) => e.id === passFromId)?.label
                    }{' '}
                    →{' '}
                    {drill.entities.find((e) => e.id === passToId)?.label})
                  </button>
                )}
            </div>
          )}

          {/* Tools specific to GOALIE */}
          {selectedEntity.type === 'goalie' && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400 mr-1">
                  Crease Movement:
                </span>
                <button
                  type="button"
                  onClick={() => setToolMode('select')}
                  className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    toolMode === 'select'
                      ? 'bg-sky-500 text-white shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <MousePointer className="h-3.5 w-3.5" />
                  Move / Adjust Points
                </button>

                {GOALIE_MOVE_TOOLS.map((mType) => {
                  const style = MOVEMENT_STYLES[mType];
                  const isActive = toolMode === 'draw' && movementType === mType;
                  return (
                    <button
                      key={mType}
                      type="button"
                      onClick={() => {
                        setToolMode('draw');
                        setMovementType(mType);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        isActive
                          ? 'bg-sky-500 text-white ring-2 ring-sky-300 shadow'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {style.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase text-sky-300">
                    Phase {drawPhase} Start Stance:
                  </span>
                  <select
                    value={moveStartStance}
                    onChange={(e) =>
                      handleUpdateGoalieMoveStances(
                        e.target.value as GoalieStance,
                        moveEndStance
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-white"
                  >
                    {GOALIE_ACTIONS.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.label}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-xs font-extrabold text-sky-400">→</span>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase text-emerald-300">
                    Phase {drawPhase} End Stance:
                  </span>
                  <select
                    value={moveEndStance}
                    onChange={(e) =>
                      handleUpdateGoalieMoveStances(
                        moveStartStance,
                        e.target.value as GoalieStance
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-white"
                  >
                    {GOALIE_ACTIONS.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Placement Mode Instruction Banner */}
      {!readOnly && toolMode === 'place' && PendingPlaceType && (
        <div className="flex items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-900">
          <span>
            Click anywhere on the ice to place a{' '}
            <strong className="uppercase">{PendingPlaceType}</strong> at your mouse cursor
            {PendingPlaceType === 'goalie'
              ? ' (move near a goal post to auto-snap to the post).'
              : '.'}
          </span>
          <button
            type="button"
            onClick={() => {
              setToolMode('select');
              setPendingPlaceType(null);
            }}
            className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100"
          >
            Done Placing
          </button>
        </div>
      )}

      {/* Empty Ice Helper Banner when no entities are on the drill yet */}
      {!readOnly && drill.entities.length === 0 && toolMode !== 'place' && (
        <div className="rounded-xl border border-dashed border-sky-400 bg-sky-50/70 px-4 py-2.5 text-center text-xs font-semibold text-sky-900">
          The ice is empty for this new drill. Click <strong>+ Goalie</strong>, <strong>+ Player</strong>, or <strong>+ Place Pucks</strong> above and click on the rink to place them.
        </div>
      )}

      {/* SVG Ice Hockey Rink Surface */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-slate-800 bg-gradient-to-b from-sky-50/70 via-white to-sky-50/70 shadow-inner">
        <div className="pointer-events-none absolute left-3 top-2.5 z-10 flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <span>{preset.name}</span>
          <span className="text-sky-300">({preset.dimensionsLabel})</span>
          {zoom > 1 && (
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-950">
              ZOOM {zoom.toFixed(1)}x (Drag ice to pan)
            </span>
          )}
          {toolMode === 'draw' && !readOnly && selectedEntity && (
            <span className="ml-1 rounded bg-sky-500 px-1.5 py-0.5 text-[11px]">
              {lineShape === 'straight' ? 'Straight' : 'Freehand'}:{' '}
              {MOVEMENT_STYLES[movementType]?.label} ({selectedEntity.label})
            </span>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox={computedViewBox}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`w-full select-none touch-none ${
            readOnly
              ? 'cursor-default'
              : toolMode === 'draw' || toolMode === 'place'
              ? 'cursor-crosshair'
              : panDragStart
              ? 'cursor-grabbing'
              : 'cursor-grab'
          }`}
          style={{ maxHeight: '540px', minHeight: '340px' }}
        >
          <defs>
            <marker
              id="arrow-skate"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4.5"
              markerHeight="4.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#dc2626" />
            </marker>
            <marker
              id="arrow-goalie"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4.5"
              markerHeight="4.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284c7" />
            </marker>
            <marker
              id="arrow-shot"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f172a" />
            </marker>
          </defs>

          {/* Outer Rink Boards */}
          <rect
            x="4"
            y="4"
            width="992"
            height="492"
            rx="85"
            fill="#f8fafc"
            stroke="#1e293b"
            strokeWidth="6"
          />

          {/* Goalie Trapezoids Behind Goal Lines */}
          <polygon
            points="4,195 75,215 75,285 4,305"
            fill="#fee2e2"
            fillOpacity="0.35"
            stroke="#dc2626"
            strokeWidth="1.5"
          />
          <polygon
            points="996,195 925,215 925,285 996,305"
            fill="#fee2e2"
            fillOpacity="0.35"
            stroke="#dc2626"
            strokeWidth="1.5"
          />

          {/* Goal Lines */}
          <line x1="75" y1="12" x2="75" y2="488" stroke="#dc2626" strokeWidth="2.5" />
          <line x1="925" y1="12" x2="925" y2="488" stroke="#dc2626" strokeWidth="2.5" />

          {/* Blue Lines & Center Red Line */}
          <line x1="350" y1="4" x2="350" y2="496" stroke="#2563eb" strokeWidth="6" />
          <line
            x1="500"
            y1="4"
            x2="500"
            y2="496"
            stroke="#dc2626"
            strokeWidth="6"
            strokeDasharray="12 6"
          />
          <line x1="650" y1="4" x2="650" y2="496" stroke="#2563eb" strokeWidth="6" />

          {/* Goalie Angle Guide Rays */}
          {showAngleLines && (
            <g stroke="#0284c7" strokeOpacity="0.24" strokeWidth="1.5" strokeDasharray="4 4">
              <line x1="75" y1="250" x2="195" y2="135" />
              <line x1="75" y1="250" x2="195" y2="365" />
              <line x1="75" y1="250" x2="350" y2="250" />
            </g>
          )}

          {/* Left & Right Goal Creases */}
          <path
            d="M 75 218 A 32 32 0 0 1 107 250 A 32 32 0 0 1 75 282 Z"
            fill="#93c5fd"
            fillOpacity="0.65"
            stroke="#dc2626"
            strokeWidth="2.2"
          />
          <rect
            x="55"
            y="232"
            width="20"
            height="36"
            rx="4"
            fill="#e2e8f0"
            stroke="#dc2626"
            strokeWidth="2.5"
          />

          <path
            d="M 925 218 A 32 32 0 0 0 893 250 A 32 32 0 0 0 925 282 Z"
            fill="#93c5fd"
            fillOpacity="0.65"
            stroke="#dc2626"
            strokeWidth="2.2"
          />
          <rect
            x="925"
            y="232"
            width="20"
            height="36"
            rx="4"
            fill="#e2e8f0"
            stroke="#dc2626"
            strokeWidth="2.5"
          />

          {/* Snap-in-Place Goal Post Anchors */}
          {GOAL_POSTS.map((post) => {
            const isHighlighted = postSnapPrompt?.post.id === post.id;
            return (
              <g key={post.id} transform={`translate(${post.x}, ${post.y})`}>
                {isHighlighted && (
                  <circle
                    r={8 * strokeScale}
                    fill="#9333ea"
                    fillOpacity="0.3"
                    stroke="#9333ea"
                    strokeWidth={1.5 * strokeScale}
                  />
                )}
                <circle
                  r={3.2 * strokeScale}
                  fill="#b91c1c"
                  stroke="#ffffff"
                  strokeWidth={1 * strokeScale}
                />
              </g>
            );
          })}

          {/* Faceoff Circles & Dots */}
          <circle cx="500" cy="250" r="65" fill="none" stroke="#2563eb" strokeWidth="2.5" />
          <circle cx="500" cy="250" r="5" fill="#2563eb" />

          {[
            { cx: 195, cy: 135 },
            { cx: 195, cy: 365 },
            { cx: 805, cy: 135 },
            { cx: 805, cy: 365 },
          ].map((c, idx) => (
            <g key={idx}>
              <circle cx={c.cx} cy={c.cy} r="65" fill="none" stroke="#dc2626" strokeWidth="2.2" />
              <circle cx={c.cx} cy={c.cy} r="5" fill="#dc2626" />
            </g>
          ))}

          {/* Drawn Drill Paths with Interactive Start & End Control Points */}
          {drill.paths.map((p) => {
            if (p.points.length < 2) return null;
            const d =
              p.movementType === 'skate-puck'
                ? buildZigzagSvgPath(p.points, 8 * strokeScale, 4.2 * strokeScale)
                : p.points
                    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
                    .join(' ');
            const style = MOVEMENT_STYLES[p.movementType] || MOVEMENT_STYLES.skate;
            const first = p.points[0];
            const last = p.points[p.points.length - 1];
            const mid = p.points[Math.floor(p.points.length / 2)];
            const fromEntLabel =
              p.movementType === 'pass'
                ? p.passFromId === 'free'
                  ? 'FREE'
                  : drill.entities.find((e) => e.id === (p.passFromId || p.entityId))
                      ?.label || 'FREE'
                : '';
            const toEntLabel =
              p.movementType === 'pass'
                ? !p.passToId || p.passToId === 'free'
                  ? 'FREE'
                  : drill.entities.find((e) => e.id === p.passToId)?.label || 'FREE'
                : '';

            const tagText =
              p.movementType === 'shot' && p.shotHeight
                ? `#${p.phase} SHOT (${p.shotHeight.toUpperCase()})`
                : p.movementType === 'pass'
                ? `#${p.phase} PASS: ${fromEntLabel} → ${toEntLabel}`
                : p.startStance || p.endStance
                ? `#${p.phase} ${style.shortTag}: ${(p.startStance || 'ready').toUpperCase()} → ${(p.endStance || 'ready').toUpperCase()}`
                : `#${p.phase} ${style.shortTag}`;
            const badgeWidth =
              p.movementType === 'pass'
                ? 110
                : p.startStance || p.endStance
                ? 124
                : 68;

            const handleRadius = 4.6 * strokeScale;
            const lineOpacity =
              readOnly || isPlaying ? 1 : getPhaseLineOpacity(p.phase, drawPhase);

            return (
              <g key={p.id} opacity={lineOpacity}>
                <path
                  d={d}
                  fill="none"
                  stroke={p.color || style.color}
                  strokeWidth={(p.movementType === 'shot' ? 3.4 : 2.6) * strokeScale}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd={
                    p.movementType === 'shot'
                      ? 'url(#arrow-shot)'
                      : style.role === 'goalie'
                      ? 'url(#arrow-goalie)'
                      : 'url(#arrow-skate)'
                  }
                />

                {/* Draggable Start Point Handle */}
                {!readOnly && (
                  <circle
                    cx={first.x}
                    cy={first.y}
                    r={handleRadius}
                    fill="#ffffff"
                    stroke={p.color || style.color}
                    strokeWidth={2 * strokeScale}
                    className="cursor-pointer hover:fill-sky-200"
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      onSelectEntity(p.entityId);
                      setToolMode('select');
                      setDraggingLineEndpoint({ pathId: p.id, which: 'start' });
                    }}
                  >
                    <title>Drag to adjust line start point</title>
                  </circle>
                )}

                {/* Draggable End Point Handle */}
                {!readOnly ? (
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r={handleRadius * 1.15}
                    fill={p.color || style.color}
                    stroke="#ffffff"
                    strokeWidth={2 * strokeScale}
                    className="cursor-pointer hover:fill-sky-400"
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      onSelectEntity(p.entityId);
                      setToolMode('select');
                      setDraggingLineEndpoint({ pathId: p.id, which: 'end' });
                    }}
                  >
                    <title>Drag to adjust line end point</title>
                  </circle>
                ) : (
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r={3.2 * strokeScale}
                    fill={p.color || style.color}
                  />
                )}

                <g
                  transform={`translate(${mid.x}, ${
                    mid.y - 6 * strokeScale
                  }) scale(${entityScale})`}
                >
                  <rect
                    x={-badgeWidth / 2}
                    y="-8"
                    width={badgeWidth}
                    height="13"
                    rx="3.5"
                    fill="#0f172a"
                    fillOpacity="0.82"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="7"
                    fontWeight="bold"
                  >
                    {tagText}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Currently Active Drawn Path Preview (Freehand or Straight) */}
          {activePathPoints.length >= 2 && (
            <g>
              <path
                d={
                  movementType === 'skate-puck'
                    ? buildZigzagSvgPath(
                        activePathPoints,
                        8 * strokeScale,
                        4.2 * strokeScale
                      )
                    : activePathPoints
                        .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
                        .join(' ')
                }
                fill="none"
                stroke={MOVEMENT_STYLES[movementType]?.color || '#0284c7'}
                strokeWidth={2.8 * strokeScale}
                strokeDasharray={movementType === 'skate-puck' ? undefined : '4 4'}
              />
              <circle
                cx={activePathPoints[0].x}
                cy={activePathPoints[0].y}
                r={4 * strokeScale}
                fill="#ffffff"
                stroke={MOVEMENT_STYLES[movementType]?.color || '#0284c7'}
                strokeWidth={2 * strokeScale}
              />
              <circle
                cx={activePathPoints[activePathPoints.length - 1].x}
                cy={activePathPoints[activePathPoints.length - 1].y}
                r={4.5 * strokeScale}
                fill={MOVEMENT_STYLES[movementType]?.color || '#0284c7'}
                stroke="#ffffff"
                strokeWidth={2 * strokeScale}
              />
            </g>
          )}

          {/* Active Animated Puck Flights */}
          {activePuckFlights.map((flight) => (
            <g
              key={flight.id}
              transform={`translate(${flight.x}, ${flight.y}) scale(${entityScale})`}
            >
              <circle
                r={flight.type === 'shot' ? 6 : 5}
                fill="#0f172a"
                stroke="#facc15"
                strokeWidth="2"
              />
              {flight.type === 'shot' && flight.shotHeight && (
                <text
                  x="0"
                  y="-9"
                  textAnchor="middle"
                  fill="#0f172a"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {flight.shotHeight.toUpperCase()}
                </text>
              )}
            </g>
          ))}

          {/* Goalies, Players, Coaches, Pucks & Cones (Scaled smaller when zooming in!) */}
          {drill.entities.map((ent) => {
            const state =
              currentTimeSec > 0 || isPlaying
                ? getEntityStateAtTime(ent, drill.paths, currentTimeSec)
                : {
                    x: ent.x,
                    y: ent.y,
                    angle: ent.angle,
                    stance: ent.stance,
                    hasPuck: resolveEntityPuckPossession(ent, drill.paths, 0),
                    progress: 0,
                  };

            const isSelected = ent.id === selectedEntityId;

            return (
              <g
                key={ent.id}
                transform={`translate(${state.x}, ${state.y}) scale(${entityScale})`}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  handleSelectEntityAndSetupTools(ent);
                  if (!readOnly && toolMode === 'select') {
                    setDraggingEntityId(ent.id);
                  } else if (!readOnly && toolMode === 'draw') {
                    const anchor = getSnappedStartAnchor(ent, { x: ent.x, y: ent.y });
                    setActivePathPoints([anchor]);
                  }
                }}
                className="cursor-pointer"
              >
                {isSelected && !readOnly && (
                  <circle
                    r="21"
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="2.2"
                    strokeDasharray="4 2"
                  />
                )}

                {ent.type === 'goalie' ? (
                  <g>
                    <rect
                      x="-15"
                      y="-11"
                      width="30"
                      height="22"
                      rx="6"
                      fill={ent.color}
                      stroke="#ffffff"
                      strokeWidth="2.2"
                    />
                    <circle
                      cx="-15"
                      cy="0"
                      r="4"
                      fill={state.stance === 'blocker-save' ? '#f59e0b' : '#0369a1'}
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />
                    <circle
                      cx="15"
                      cy="0"
                      r="4.5"
                      fill={state.stance === 'glove-save' ? '#10b981' : '#0369a1'}
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {ent.label}
                    </text>
                    {state.stance && (
                      <g transform="translate(0, 19)">
                        <rect
                          x="-28"
                          y="-6"
                          width="56"
                          height="12"
                          rx="3.5"
                          fill={
                            state.stance === 'glove-save'
                              ? '#059669'
                              : state.stance === 'blocker-save'
                              ? '#d97706'
                              : state.stance === 'rvh' ||
                                state.stance === 'vh' ||
                                state.stance === 'overlap' ||
                                state.stance === 'hug-post'
                              ? '#7c3aed'
                              : '#0284c7'
                          }
                        />
                        <text
                          x="0"
                          y="2"
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="7"
                          fontWeight="bold"
                        >
                          {state.stance.toUpperCase()}
                        </text>
                      </g>
                    )}
                  </g>
                ) : ent.type === 'cone' ? (
                  <polygon
                    points="0,-10 9,8 -9,8"
                    fill="#f97316"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                  />
                ) : ent.type === 'puck' ? (
                  <g>
                    <circle r="5.5" cx="-4" cy="-2" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                    <circle r="5.5" cx="4" cy="-2" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                    <circle r="5.5" cx="0" cy="4" fill="#0f172a" stroke="#ffffff" strokeWidth="1" />
                    <text
                      x="0"
                      y="15"
                      textAnchor="middle"
                      fill="#0f172a"
                      fontSize="7.5"
                      fontWeight="bold"
                    >
                      PUCKS
                    </text>
                  </g>
                ) : (
                  <g>
                    <circle
                      r="13"
                      fill={ent.color}
                      stroke="#ffffff"
                      strokeWidth="2.2"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {ent.label}
                    </text>
                    {state.hasPuck && (
                      <circle
                        cx="11"
                        cy="9"
                        r="4.5"
                        fill="#0f172a"
                        stroke="#facc15"
                        strokeWidth="1.5"
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
