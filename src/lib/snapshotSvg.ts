import { Drill } from '@/types/planner';
import { RINK_PRESETS } from '@/lib/rinkConfig';
import { buildZigzagSvgPath } from '@/lib/animationEngine';

/**
 * Generates a self-contained static SVG data URL for a drill diagram.
 * Used for the static image block in "Design the View" and downloadable plan images on the Share page.
 */
export function renderDrillStaticSvgDataUrl(drill: Drill): string {
  const preset = RINK_PRESETS[drill.rinkType] || RINK_PRESETS.full;

  const pathsSvg = drill.paths
    .map((p) => {
      if (p.points.length < 2) return '';
      const d =
        p.movementType === 'skate-puck'
          ? buildZigzagSvgPath(p.points)
          : p.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
      const dash =
        p.movementType === 'pass'
          ? 'stroke-dasharray="8 6"'
          : p.movementType === 'backward' || p.movementType === 'backward-puck'
          ? 'stroke-dasharray="5 3"'
          : p.movementType === 'lateral' || p.movementType === 'lateral-puck'
          ? 'stroke-dasharray="2 4"'
          : p.movementType === 't-push' || p.movementType === 'shuffle'
          ? 'stroke-dasharray="4 4"'
          : '';
      const width = p.movementType === 'shot' ? 4 : 3;
      const last = p.points[p.points.length - 1];
      const mid = p.points[Math.floor(p.points.length / 2)];
      const fromLabel =
        p.movementType === 'pass'
          ? p.passFromId === 'free'
            ? 'FREE'
            : drill.entities.find((e) => e.id === (p.passFromId || p.entityId))?.label || 'FREE'
          : '';
      const toLabel =
        p.movementType === 'pass'
          ? !p.passToId || p.passToId === 'free'
            ? 'FREE'
            : drill.entities.find((e) => e.id === p.passToId)?.label || 'FREE'
          : '';
      const shotBadge =
        p.movementType === 'shot' && p.shotHeight
          ? `<text x="${mid.x}" y="${mid.y - 6}" text-anchor="middle" fill="#0f172a" font-family="sans-serif" font-size="9" font-weight="bold">SHOT: ${p.shotHeight.toUpperCase()}</text>`
          : p.movementType === 'pass'
          ? `<text x="${mid.x}" y="${mid.y - 6}" text-anchor="middle" fill="#2563eb" font-family="sans-serif" font-size="8.5" font-weight="bold">#${p.phase} PASS: ${fromLabel} → ${toLabel}</text>`
          : p.startStance || p.endStance
          ? `<text x="${mid.x}" y="${mid.y - 6}" text-anchor="middle" fill="#0284c7" font-family="sans-serif" font-size="8.5" font-weight="bold">#${p.phase} ${(p.startStance || 'ready').toUpperCase()} → ${(p.endStance || 'ready').toUpperCase()}</text>`
          : '';
      return `
        <path d="${d}" fill="none" stroke="${p.color}" stroke-width="${width}" ${dash} stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${last.x}" cy="${last.y}" r="4.5" fill="${p.color}" />
        ${shotBadge}
      `;
    })
    .join('\n');

  const entitiesSvg = drill.entities
    .map((e) => {
      const radius = e.type === 'goalie' ? 16 : e.type === 'puck' ? 6 : 14;
      const shape =
        e.type === 'goalie'
          ? `<rect x="${e.x - 16}" y="${e.y - 12}" width="32" height="24" rx="6" fill="${e.color}" stroke="#ffffff" stroke-width="2.5" />`
          : `<circle cx="${e.x}" cy="${e.y}" r="${radius}" fill="${e.color}" stroke="#ffffff" stroke-width="2.5" />`;
      const stanceBadge =
        e.type === 'goalie' && e.stance
          ? `<text x="${e.x}" y="${e.y + 22}" text-anchor="middle" fill="#0284c7" font-family="sans-serif" font-size="8" font-weight="bold">${e.stance.toUpperCase()}</text>`
          : '';
      return `
        <g>
          ${shape}
          <text x="${e.x}" y="${e.y + 4}" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="bold">${e.label}</text>
          ${stanceBadge}
        </g>
      `;
    })
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${preset.viewBox}" width="800" height="420">
    <rect x="0" y="0" width="1000" height="500" rx="85" fill="#f8fafc" stroke="#1e293b" stroke-width="6"/>
    <!-- Goal Lines -->
    <line x1="75" y1="12" x2="75" y2="488" stroke="#dc2626" stroke-width="2.5"/>
    <line x1="925" y1="12" x2="925" y2="488" stroke="#dc2626" stroke-width="2.5"/>
    <!-- Blue Lines & Center Red Line -->
    <line x1="350" y1="4" x2="350" y2="496" stroke="#2563eb" stroke-width="5"/>
    <line x1="500" y1="4" x2="500" y2="496" stroke="#dc2626" stroke-width="5" stroke-dasharray="10 6"/>
    <line x1="650" y1="4" x2="650" y2="496" stroke="#2563eb" stroke-width="5"/>
    <!-- Left & Right Goal Creases -->
    <path d="M 75 220 A 30 30 0 0 1 105 250 A 30 30 0 0 1 75 280 Z" fill="#93c5fd" fill-opacity="0.55" stroke="#dc2626" stroke-width="2"/>
    <path d="M 925 220 A 30 30 0 0 0 895 250 A 30 30 0 0 0 925 280 Z" fill="#93c5fd" fill-opacity="0.55" stroke="#dc2626" stroke-width="2"/>
    <!-- Faceoff Circles -->
    <circle cx="500" cy="250" r="65" fill="none" stroke="#2563eb" stroke-width="2"/>
    <circle cx="195" cy="135" r="65" fill="none" stroke="#dc2626" stroke-width="2"/>
    <circle cx="195" cy="365" r="65" fill="none" stroke="#dc2626" stroke-width="2"/>
    <circle cx="805" cy="135" r="65" fill="none" stroke="#dc2626" stroke-width="2"/>
    <circle cx="805" cy="365" r="65" fill="none" stroke="#dc2626" stroke-width="2"/>
    ${pathsSvg}
    ${entitiesSvg}
  </svg>`;

  const base64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(svg, 'utf-8').toString('base64')
      : btoa(unescape(encodeURIComponent(svg)));

  return `data:image/svg+xml;base64,${base64}`;
}
