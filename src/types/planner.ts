export type RinkType = 'full' | 'half' | 'third' | 'crease' | 'corner';

export type EntityType = 'goalie' | 'player' | 'coach' | 'puck' | 'cone' | 'net' | 'bumper';

export type GoalieStance =
  | 'ready'
  | 'butterfly'
  | 'rvh'
  | 'vh'
  | 'overlap'
  | 'hug-post'
  | 'glove-save'
  | 'blocker-save'
  | 't-push'
  | 'shuffle'
  | 'c-cut'
  | 'butterfly-slide';

export type PathMovementType =
  | 'skate'
  | 'skate-puck'
  | 'backward'
  | 'backward-puck'
  | 'lateral'
  | 'lateral-puck'
  | 'pass'
  | 'shot'
  | 't-push'
  | 'shuffle'
  | 'butterfly-slide'
  | 'c-cut';

export type ShotHeight = 'high' | 'medium' | 'ice';

export type PlaybackSpeed = 0.5 | 1 | 2;

export interface Point2D {
  x: number; // Normalized 0..1000 coordinate space
  y: number; // Normalized 0..500 coordinate space
}

export interface Keyframe {
  id: string;
  t: number; // Time in seconds (0 .. drill.durationSec)
  x: number;
  y: number;
  angle: number; // Degrees
  stance?: GoalieStance;
  label?: string;
}

export interface EntityAnimationConfig {
  delaySec: number;
  durationSec: number;
  speedMultiplier: number; // Per-player speed tweak (e.g., 0.5x .. 2x)
  useCustomKeyframes: boolean;
  keyframes: Keyframe[];
}

export interface DrillEntity {
  id: string;
  type: EntityType;
  label: string; // e.g., "G1", "G2", "P1", "F1", "C1"
  color: string;
  x: number; // Initial x in 0..1000
  y: number; // Initial y in 0..500
  angle: number;
  stance?: GoalieStance;
  hasPuck?: boolean;
  animation: EntityAnimationConfig;
}

export interface DrawnPath {
  id: string;
  entityId: string; // Associated goalie/player/puck
  movementType: PathMovementType;
  shotHeight?: ShotHeight; // Assigned when movementType === 'shot' (high, medium, ice)
  startStance?: GoalieStance; // Goalie stance at start of this phase/move (e.g. 'hug-post')
  endStance?: GoalieStance; // Goalie stance at end of this phase/move (e.g. 'ready')
  passFromId?: string | 'free'; // Who passes the puck (entity id or 'free' when no player holds puck)
  passToId?: string | 'free'; // Who receives the puck (entity id or 'free' for pass to open ice)
  points: Point2D[];
  color: string;
  phase: number; // Step sequence number (1, 2, 3...)
}

export interface Drill {
  id: string;
  name: string;
  durationMinutes: number;
  durationSec: number; // Animation timeline length in seconds (default 8s)
  rinkType: RinkType;
  description: string;
  coachingPoints: string[];
  appointedGoalies: number;
  appointedPlayers: number;
  appointedCoaches: number;
  entities: DrillEntity[];
  paths: DrawnPath[];
  snapshotDataUrl?: string; // Rendered static SVG/PNG data URL of the drill diagram
}

export interface RosterConfig {
  goalies: number;
  skaters: number;
  coaches: number;
  goalieLabels: string[];
  equipment: string[];
}

export type ViewLayoutPreset = 'grid' | 'split' | 'timeline' | 'focus';

export type ViewBlockType = 'animation_player' | 'static_image' | 'description' | 'roster';

export interface ViewBlockConfig {
  id: ViewBlockType;
  label: string;
  enabled: boolean;
  order: number;
  span: 'full' | 'half';
}

export interface ViewConfig {
  layout: ViewLayoutPreset;
  columns: 1 | 2 | 3;
  showHeader: boolean;
  showRosterBar: boolean;
  defaultSpeed: PlaybackSpeed;
  themeAccent: 'ice' | 'slate' | 'emerald';
  blocks: ViewBlockConfig[];
}

export interface PracticePlan {
  id: string;
  ownerId: string | null;
  ownerName?: string;
  title: string;
  description: string;
  practiceDate: string;
  durationMinutes: number;
  defaultRinkType: RinkType;
  rosterConfig: RosterConfig;
  drills: Drill[];
  viewConfig: ViewConfig;
  shareToken: string;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'ADMIN' | 'COACH';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authProvider: 'local' | 'keycloak';
  active: boolean;
  createdAt: string;
}

export interface KeycloakConfig {
  issuerUrl: string; // e.g., http://localhost:8080/realms/gcpl or base URL
  realm: string;
  clientId: string;
  clientSecret: string;
  publicOrigin: string; // e.g., http://localhost:3000
}

export type MaterialShapePreset = 'sharp' | 'rounded' | 'pill';
export type MaterialFontPreset = 'roboto' | 'inter' | 'system';

export interface BrandingConfig {
  siteName: string; // e.g., "GCPL"
  siteTagline: string; // e.g., "Goalie Coach Practice Planner"
  logoDataUrl: string; // Base64 Data URL for uploaded logo
  faviconDataUrl: string; // Base64 Data URL for dedicated favicon (optional)
  useLogoAsFavicon: boolean; // When true, logoDataUrl is also used as favicon
  showLogoInSharedView: boolean; // Show custom logo & brand on /share/[token]
  primaryColor: string; // Main brand color (default #0284c7)
  secondaryColor: string; // Secondary / supporting color (default #1e293b)
  accentColor: string; // Alternative / tertiary highlight color (default #0d9488)
  headerBgColor: string; // Top App Bar background (default #0f172a)
  headerTextColor: string; // Top App Bar text color (default #ffffff)
  backgroundColor: string; // Page canvas background (default #f1f5f9)
  surfaceColor: string; // Material card / paper surface (default #ffffff)
  shapePreset: MaterialShapePreset;
  fontPreset: MaterialFontPreset;
}

export interface SystemSettings {
  authMode: 'local' | 'keycloak';
  keycloakConfig: KeycloakConfig;
  brandingConfig: BrandingConfig;
  updatedAt?: string;
}

export const DEFAULT_OFF_ICE_TAGS = [
  'Lower Body',
  'Upper Body',
  'Balance',
  'Hand-Eye Coordination',
  'Mobility & Hips',
  'Core & Stability',
  'Reaction Speed',
] as const;

export interface OffIcePractice {
  id: string;
  ownerId: string | null;
  title: string;
  description: string;
  durationMinutes: number;
  equipment: string[];
  tags: string[];
  images: string[];
  createdAt: string;
  updatedAt: string;
}
