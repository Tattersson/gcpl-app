import { DEFAULT_OFF_ICE_TAGS, OffIcePractice } from '@/types/planner';

export function normalizeStringList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
}

export function normalizeImageList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (
      !trimmed.startsWith('data:image/') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('http://')
    ) {
      continue;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

export function getAvailableOffIceTags(practices: OffIcePractice[]): string[] {
  return normalizeStringList([
    ...DEFAULT_OFF_ICE_TAGS,
    ...practices.flatMap((p) => p.tags || []),
  ]);
}

export function filterOffIcePractices(
  practices: OffIcePractice[],
  selectedTags: string[],
  searchQuery: string
): OffIcePractice[] {
  const activeTagSet = new Set(selectedTags.map((t) => t.toLowerCase()));
  const q = searchQuery.trim().toLowerCase();

  return practices.filter((practice) => {
    if (activeTagSet.size > 0) {
      const practiceTagSet = new Set((practice.tags || []).map((t) => t.toLowerCase()));
      for (const reqTag of activeTagSet) {
        if (!practiceTagSet.has(reqTag)) return false;
      }
    }

    if (!q) return true;

    const haystack = [
      practice.title,
      practice.description,
      ...(practice.tags || []),
      ...(practice.equipment || []),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export const STARTER_OFF_ICE_PRACTICES: Array<{
  title: string;
  description: string;
  durationMinutes: number;
  equipment: string[];
  tags: string[];
}> = [
  {
    title: 'Lateral Skater Jumps & Butterfly Hip Flow',
    description:
      '3 × 8 lateral single-leg skater bounds with 2-second stick landings, paired with 90/90 internal hip rotations and Maria Mountain butterfly flares. Builds explosive crease push power while protecting hip labrums.',
    durationMinutes: 20,
    equipment: ['Exercise Mat', 'Mini Resistance Band'],
    tags: ['Lower Body', 'Balance', 'Mobility & Hips'],
  },
  {
    title: 'Wall Tennis Ball Reaction & Glove Tracking',
    description:
      'Stand in athletic goalie ready stance 6 ft from a wall. Alternate single-hand catches and 2-ball juggling off the wall while calling out colors/numbers. Keep hands out in front of the body plane and track ball all the way into the palm.',
    durationMinutes: 15,
    equipment: ['Tennis Balls', 'Reaction Ball'],
    tags: ['Hand-Eye Coordination', 'Reaction Speed', 'Upper Body'],
  },
  {
    title: 'BOSU Ready-Stance Perturbation & Med-Ball Press',
    description:
      'Hold a low goalie stance on a BOSU or balance board while pressing a light medicine ball out to blocker/glove positions and resisting partner taps. Train quiet upper-body posture under lower-body instability.',
    durationMinutes: 15,
    equipment: ['BOSU Ball', 'Medicine Ball'],
    tags: ['Balance', 'Core & Stability', 'Upper Body', 'Lower Body'],
  },
];
