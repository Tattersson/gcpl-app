import test from 'node:test';
import assert from 'node:assert/strict';
import { toPublicPlan } from './publicDto';
import type { PracticePlan } from '@/types/planner';

const plan: PracticePlan = {
  id: 'plan-1',
  ownerId: 'admin-user-id',
  ownerName: 'Head Coach',
  title: 'Crease work',
  description: '',
  practiceDate: '2026-11-20',
  durationMinutes: 60,
  defaultRinkType: 'crease',
  rosterConfig: { goalies: 2, skaters: 4, coaches: 1, goalieLabels: ['G1', 'G2'], equipment: [] },
  drills: [],
  viewConfig: { layout: 'crease' } as PracticePlan['viewConfig'],
  shareToken: 'secret-share-token',
  isShared: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
};

test('public plan view drops owner and share token', () => {
  const pub = toPublicPlan(plan) as Record<string, unknown>;
  assert.equal('ownerId' in pub, false);
  assert.equal('shareToken' in pub, false);
});

test('public plan view keeps the content needed to render a practice', () => {
  const pub = toPublicPlan(plan);
  assert.equal(pub.id, plan.id);
  assert.equal(pub.title, plan.title);
  assert.deepEqual(pub.rosterConfig, plan.rosterConfig);
  assert.deepEqual(pub.viewConfig, plan.viewConfig);
});

test('public plan view does not mutate the source record', () => {
  toPublicPlan(plan);
  assert.equal(plan.shareToken, 'secret-share-token');
  assert.equal(plan.ownerId, 'admin-user-id');
});
