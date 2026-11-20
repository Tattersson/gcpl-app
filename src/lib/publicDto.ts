import type { PracticePlan } from '@/types/planner';

/**
 * Shape of a practice plan returned to anonymous viewers.
 * Strips the owner reference and the share token: the library is public,
 * but internal identifiers and per-plan share secrets are not.
 */
export function toPublicPlan(plan: PracticePlan): Omit<PracticePlan, 'ownerId' | 'shareToken'> {
  const { ownerId: _ownerId, shareToken: _shareToken, ...rest } = plan;
  return rest;
}
