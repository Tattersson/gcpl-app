import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  RINK_PRESETS,
  createStarterDrill,
} from './rinkConfig';
import {
  samplePolylineAtProgress,
  generateKeyframesFromPaths,
  getEntityStateAtTime,
  getActivePuckFlights,
  findNearestGoalPost,
  moveEntityWithConnectedLines,
  adjustPathEndpoint,
  resolveEntityPuckPossession,
  buildZigzagSvgPath,
  getPhaseLineOpacity,
} from './animationEngine';
import { renderDrillStaticSvgDataUrl } from './snapshotSvg';
import { resolveKeycloakEndpoints } from './auth';
import {
  DEFAULT_BRANDING_CONFIG,
  MATERIAL_THEME_PRESETS,
  buildBrandingCssVariables,
  generateTonalPalette,
  normalizeBrandingConfig,
  resolveEffectiveFavicon,
} from './branding';
import { DrillEntity, DrawnPath } from '@/types/planner';

describe('GCPL Rink Presets & Starter Drill', () => {
  it('defines all 5 required rink sizes (full, half, third, crease, corner)', () => {
    const keys = Object.keys(RINK_PRESETS);
    assert.deepEqual(keys, ['full', 'half', 'third', 'crease', 'corner']);
    for (const k of keys) {
      const preset = RINK_PRESETS[k as keyof typeof RINK_PRESETS];
      assert.ok(preset.viewBox.split(' ').length === 4);
      assert.ok(preset.bounds.width > 0 && preset.bounds.height > 0);
    }
  });

  it('starts a new drill with an empty ice surface so the coach places goalies, players, and pucks', () => {
    const drill = createStarterDrill('crease', 2, 4, 1, 1);
    assert.equal(drill.rinkType, 'crease');
    assert.equal(drill.appointedGoalies, 2);
    assert.equal(drill.appointedPlayers, 4);
    assert.equal(drill.appointedCoaches, 1);
    assert.equal(drill.entities.length, 0);
    assert.equal(drill.paths.length, 0);
  });
});

describe('GCPL Hybrid Path & Keyframe Animation Engine', () => {
  it('interpolates polyline positions accurately from 0 to 1', () => {
    const pts = [
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ];
    const start = samplePolylineAtProgress(pts, 0);
    const mid = samplePolylineAtProgress(pts, 0.5);
    const end = samplePolylineAtProgress(pts, 1);

    assert.equal(start.x, 100);
    assert.equal(mid.x, 150);
    assert.equal(end.x, 200);
  });

  it('supports player lateral/backward/with-puck moves and goalie saves (rvh, vh, glove-save, blocker-save)', () => {
    const goalie: DrillEntity = {
      id: 'g1',
      type: 'goalie',
      label: 'G1',
      color: '#0284c7',
      x: 95,
      y: 250,
      angle: 0,
      stance: 'glove-save',
      animation: {
        delaySec: 0,
        durationSec: 6,
        speedMultiplier: 1,
        useCustomKeyframes: false,
        keyframes: [{ id: 'k0', t: 0, x: 95, y: 250, angle: 0, stance: 'ready' }],
      },
    };

    const player: DrillEntity = {
      id: 'p1',
      type: 'player',
      label: 'P1',
      color: '#dc2626',
      x: 200,
      y: 180,
      angle: 180,
      hasPuck: false,
      animation: {
        delaySec: 0,
        durationSec: 6,
        speedMultiplier: 1,
        useCustomKeyframes: false,
        keyframes: [{ id: 'kp0', t: 0, x: 200, y: 180, angle: 180 }],
      },
    };

    const paths: DrawnPath[] = [
      {
        id: 'path-g1',
        entityId: 'g1',
        movementType: 't-push',
        startStance: 'hug-post',
        endStance: 'ready',
        color: '#0284c7',
        phase: 1,
        points: [
          { x: 75, y: 232 },
          { x: 105, y: 250 },
        ],
      },
      {
        id: 'path-p1-lat',
        entityId: 'p1',
        movementType: 'lateral-puck',
        color: '#c2410c',
        phase: 1,
        points: [
          { x: 200, y: 180 },
          { x: 180, y: 240 },
        ],
      },
    ];

    const pState = getEntityStateAtTime(player, paths, 3);
    assert.equal(pState.hasPuck, true);
    assert.equal(pState.activeMovementType, 'lateral-puck');

    // At start of Phase 1 (t=0s), goalie starts in 'hug-post'
    const gStart = getEntityStateAtTime(goalie, paths, 0);
    assert.equal(gStart.stance, 'hug-post');

    // Mid-movement (t=3s), goalie is executing 't-push'
    const gMid = getEntityStateAtTime(goalie, paths, 3);
    assert.equal(gMid.stance, 't-push');

    // At end of Phase 1 movement (t=6s), goalie finishes in 'ready'
    const gEnd = getEntityStateAtTime(goalie, paths, 6);
    assert.equal(gEnd.stance, 'ready');

    const kfs = generateKeyframesFromPaths(goalie, paths, 4);
    assert.equal(kfs.length, 5);
    assert.equal(kfs[0].stance, 'hug-post');
    assert.equal(kfs[kfs.length - 1].stance, 'ready');
  });

  it('computes active puck flights with shotHeight (high, medium, ice)', () => {
    const drill = createStarterDrill('third', 1, 2, 1, 1);
    drill.paths.push({
      id: 'shot-1',
      entityId: 'p1',
      movementType: 'shot',
      shotHeight: 'high',
      color: '#0f172a',
      phase: 1,
      points: [
        { x: 180, y: 240 },
        { x: 95, y: 250 },
      ],
    });
    const flights = getActivePuckFlights(drill, 1.6);
    assert.equal(flights.length, 1);
    assert.equal(flights[0].shotHeight, 'high');

    const url = renderDrillStaticSvgDataUrl(drill);
    assert.ok(url.startsWith('data:image/svg+xml;base64,'));
  });

  it('moves connected movement and shooting lines together when moving a player and snaps goalie to goal posts', () => {
    const drill = createStarterDrill('crease', 1, 1, 0, 1);
    drill.entities.push({
      id: 'p1',
      type: 'player',
      label: 'P1',
      color: '#dc2626',
      x: 200,
      y: 200,
      angle: 180,
      animation: {
        delaySec: 0,
        durationSec: 6,
        speedMultiplier: 1,
        useCustomKeyframes: false,
        keyframes: [{ id: 'kf1', t: 0, x: 200, y: 200, angle: 180 }],
      },
    });
    drill.paths.push(
      {
        id: 'move-1',
        entityId: 'p1',
        movementType: 'skate-puck',
        color: '#b91c1c',
        phase: 1,
        points: [
          { x: 200, y: 200 },
          { x: 150, y: 220 },
        ],
      },
      {
        id: 'shot-1',
        entityId: 'p1',
        movementType: 'shot',
        shotHeight: 'ice',
        color: '#0f172a',
        phase: 2,
        points: [
          { x: 150, y: 220 },
          { x: 80, y: 250 },
        ],
      }
    );

    // Move player P1 by (+25, +15) -> (225, 215)
    const moved = moveEntityWithConnectedLines(drill, 'p1', { x: 225, y: 215 });
    const movedPlayer = moved.entities.find((e) => e.id === 'p1')!;
    assert.equal(movedPlayer.x, 225);
    assert.equal(movedPlayer.y, 215);

    const movedSkatingPath = moved.paths.find((p) => p.id === 'move-1')!;
    assert.deepEqual(movedSkatingPath.points, [
      { x: 225, y: 215 },
      { x: 175, y: 235 },
    ]);

    const movedShotPath = moved.paths.find((p) => p.id === 'shot-1')!;
    assert.deepEqual(movedShotPath.points, [
      { x: 175, y: 235 },
      { x: 105, y: 265 },
    ]);

    // Verify Goal Post snapping near Left Top Post (75, 232)
    const nearPost = findNearestGoalPost({ x: 81, y: 235 }, 15);
    assert.ok(nearPost);
    assert.equal(nearPost.id, 'left-top');
    assert.equal(nearPost.x, 75);
    assert.equal(nearPost.y, 232);

    // Verify adjusting start and end points of a drawn path
    const adjustedEnd = adjustPathEndpoint(moved, 'move-1', 'end', {
      x: 190,
      y: 250,
    });
    const pathAfterEndDrag = adjustedEnd.paths.find((p) => p.id === 'move-1')!;
    assert.deepEqual(pathAfterEndDrag.points, [
      { x: 225, y: 215 },
      { x: 190, y: 250 },
    ]);

    const adjustedStart = adjustPathEndpoint(adjustedEnd, 'move-1', 'start', {
      x: 230,
      y: 210,
    });
    const pathAfterStartDrag = adjustedStart.paths.find((p) => p.id === 'move-1')!;
    assert.deepEqual(pathAfterStartDrag.points, [
      { x: 230, y: 210 },
      { x: 190, y: 250 },
    ]);
  });

  it('tracks who has the puck across P1 -> P2 passes and supports "free" pass origins/targets', () => {
    const p1: DrillEntity = {
      id: 'p1',
      type: 'player',
      label: 'P1',
      color: '#dc2626',
      x: 220,
      y: 160,
      angle: 180,
      hasPuck: false,
      animation: {
        delaySec: 0,
        durationSec: 6,
        speedMultiplier: 1,
        useCustomKeyframes: false,
        keyframes: [],
      },
    };
    const p2: DrillEntity = {
      id: 'p2',
      type: 'player',
      label: 'P2',
      color: '#dc2626',
      x: 180,
      y: 320,
      angle: 180,
      hasPuck: false,
      animation: {
        delaySec: 0,
        durationSec: 6,
        speedMultiplier: 1,
        useCustomKeyframes: false,
        keyframes: [],
      },
    };

    const passP1ToP2: DrawnPath[] = [
      {
        id: 'pass-1',
        entityId: 'p1',
        movementType: 'pass',
        passFromId: 'p1',
        passToId: 'p2',
        color: '#2563eb',
        phase: 1,
        points: [
          { x: 220, y: 160 },
          { x: 180, y: 320 },
        ],
      },
      {
        id: 'p2-move-phase2',
        entityId: 'p2',
        movementType: 'skate-puck',
        color: '#b91c1c',
        phase: 2,
        points: [
          { x: 180, y: 320 },
          { x: 130, y: 260 },
        ],
      },
    ];

    // Phase 1 runs [0s..3s], Phase 2 runs [3s..6s]
    // During Phase 1 pass flight (t = 1.5s): neither holds the puck (puck is in flight)
    assert.equal(resolveEntityPuckPossession(p1, passP1ToP2, 1.5), false);
    assert.equal(resolveEntityPuckPossession(p2, passP1ToP2, 1.5), false);

    // P2's Phase 2 movement must NOT start while Phase 1 is still running (at t = 2.0s)
    const p2DuringPhase1 = getEntityStateAtTime(p2, passP1ToP2, 2.0);
    assert.equal(p2DuringPhase1.x, 180);
    assert.equal(p2DuringPhase1.y, 320);

    // After Phase 1 completes (t = 4.5s, halfway through Phase 2): P2 has the puck and is halfway through its Phase 2 move
    assert.equal(resolveEntityPuckPossession(p1, passP1ToP2, 4.5), false);
    assert.equal(resolveEntityPuckPossession(p2, passP1ToP2, 4.5), true);
    const p2DuringPhase2 = getEntityStateAtTime(p2, passP1ToP2, 4.5);
    assert.equal(p2DuringPhase2.x, 155);
    assert.equal(p2DuringPhase2.y, 290);

    // When pass is from "free" (no player marked with puck) to "free" (area pass)
    const freePass: DrawnPath[] = [
      {
        id: 'pass-free',
        entityId: 'p1',
        movementType: 'pass',
        passFromId: 'free',
        passToId: 'free',
        color: '#2563eb',
        phase: 1,
        points: [
          { x: 250, y: 200 },
          { x: 140, y: 250 },
        ],
      },
    ];
    assert.equal(resolveEntityPuckPossession(p1, freePass, 0.5), false);
    assert.equal(resolveEntityPuckPossession(p2, freePass, 3.5), false);

    // Verify "Skate with Puck" zigzag SVG path generation
    const zigzag = buildZigzagSvgPath([
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ]);
    assert.ok(zigzag.startsWith('M 100 200 L '));
    assert.ok(zigzag.endsWith('L 200 200'));
    assert.ok(zigzag.split('L').length > 5);

    // Verify phase line opacity (100% current, 50% 1 phase back, 20% 2+ phases back)
    assert.equal(getPhaseLineOpacity(1, 1), 1);
    assert.equal(getPhaseLineOpacity(1, 2), 0.5);
    assert.equal(getPhaseLineOpacity(2, 3), 0.5);
    assert.equal(getPhaseLineOpacity(1, 3), 0.2);
  });
});

describe('Dynamic Keycloak Endpoint Resolution & Route Verification', () => {
  it('resolves OIDC endpoints from either base server URL or full realm URL', () => {
    const fromBase = resolveKeycloakEndpoints({
      issuerUrl: 'http://localhost:8080',
      realm: 'gcpl',
      clientId: 'gcpl-web',
      clientSecret: 'secret',
      publicOrigin: 'http://localhost:3000',
    });
    assert.equal(fromBase.issuer, 'http://localhost:8080/realms/gcpl');
    assert.equal(
      fromBase.discoveryUrl,
      'http://localhost:8080/realms/gcpl/.well-known/openid-connect-configuration'
    );

    const fromFull = resolveKeycloakEndpoints({
      issuerUrl: 'https://sso.club.fi/realms/goalies/',
      realm: 'ignored',
      clientId: 'gcpl-web',
      clientSecret: '',
      publicOrigin: 'https://planner.club.fi',
    });
    assert.equal(fromFull.issuer, 'https://sso.club.fi/realms/goalies');
  });

  it('has unencoded Next.js dynamic route directories for [id] and [token]', () => {
    const root = process.cwd();
    const staleDirs = [
      path.join(root, 'src/app/plans/%5Bid%5D'),
      path.join(root, 'src/app/api/plans/%5Bid%5D'),
      path.join(root, 'src/app/share/%5Btoken%5D'),
      path.join(root, 'src/app/api/share/%5Btoken%5D'),
    ];
    for (const d of staleDirs) {
      if (fs.existsSync(d)) {
        fs.rmSync(d, { recursive: true, force: true });
      }
      assert.equal(fs.existsSync(d), false);
    }

    const requiredRoutes = [
      path.join(root, 'src/app/plans/[id]/page.tsx'),
      path.join(root, 'src/app/api/plans/[id]/route.ts'),
      path.join(root, 'src/app/share/[token]/page.tsx'),
      path.join(root, 'src/app/api/share/[token]/route.ts'),
    ];
    for (const f of requiredRoutes) {
      assert.equal(fs.existsSync(f), true, `Missing dynamic route: ${f}`);
    }
  });
});

describe('Instance Design & Branding Engine (Material UI)', () => {
  it('normalizes branding config with defaults and sanitizes colors and image data URLs', () => {
    const fallback = normalizeBrandingConfig(undefined);
    assert.deepEqual(fallback, DEFAULT_BRANDING_CONFIG);

    const custom = normalizeBrandingConfig({
      siteName: '  Nordic Goalie Academy  ',
      siteTagline: 'Elite Crease Training',
      primaryColor: '#1A73E8',
      secondaryColor: '#abc', // 3-digit shorthand hex
      accentColor: 'not-a-color', // invalid hex falls back to default
      logoDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
      faviconDataUrl: 'javascript:alert(1)', // rejected unsafe URI
      useLogoAsFavicon: true,
      shapePreset: 'pill',
      fontPreset: 'roboto',
    });

    assert.equal(custom.siteName, 'Nordic Goalie Academy');
    assert.equal(custom.siteTagline, 'Elite Crease Training');
    assert.equal(custom.primaryColor, '#1a73e8');
    assert.equal(custom.secondaryColor, '#aabbcc');
    assert.equal(custom.accentColor, DEFAULT_BRANDING_CONFIG.accentColor);
    assert.equal(
      custom.logoDataUrl,
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'
    );
    assert.equal(custom.faviconDataUrl, '');
    assert.equal(custom.shapePreset, 'pill');
  });

  it('resolves uploaded logo as browser favicon when useLogoAsFavicon is enabled or uses dedicated favicon', () => {
    const logoUrl = 'data:image/svg+xml;base64,PHN2Zy8+';
    const favUrl = 'data:image/png;base64,iVBORw0KGgo=';

    const sharedIconConfig = normalizeBrandingConfig({
      logoDataUrl: logoUrl,
      faviconDataUrl: favUrl,
      useLogoAsFavicon: true,
    });
    assert.equal(resolveEffectiveFavicon(sharedIconConfig), logoUrl);

    const separateIconConfig = normalizeBrandingConfig({
      logoDataUrl: logoUrl,
      faviconDataUrl: favUrl,
      useLogoAsFavicon: false,
    });
    assert.equal(resolveEffectiveFavicon(separateIconConfig), favUrl);

    const emptyIconConfig = normalizeBrandingConfig({
      logoDataUrl: '',
      faviconDataUrl: '',
    });
    assert.equal(resolveEffectiveFavicon(emptyIconConfig), null);
  });

  it('generates full 50..950 Material tonal palettes and CSS variables for primary, secondary, and alternative colors', () => {
    const palette = generateTonalPalette('#dc2626');
    const stops = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;
    for (const s of stops) {
      assert.ok(palette[s].hex.startsWith('#'));
      assert.equal(palette[s].rgbChannels.split(' ').length, 3);
    }
    assert.equal(palette['600'].hex, '#dc2626');

    const vars = buildBrandingCssVariables({
      primaryColor: '#1a73e8',
      secondaryColor: '#1e3a8a',
      accentColor: '#7c3aed',
      shapePreset: 'sharp',
    });

    assert.equal(vars['--brand-primary'], '#1a73e8');
    assert.equal(vars['--brand-secondary'], '#1e3a8a');
    assert.equal(vars['--brand-accent'], '#7c3aed');
    assert.equal(vars['--brand-radius'], '4px');
    assert.ok(vars['--brand-primary-500-rgb']);
    assert.ok(vars['--brand-accent-100']);
    assert.ok(MATERIAL_THEME_PRESETS.length >= 6);
  });
});
