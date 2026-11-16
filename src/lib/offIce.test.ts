import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterOffIcePractices,
  getAvailableOffIceTags,
  normalizeImageList,
  normalizeStringList,
} from './offIce';
import { OffIcePractice } from '@/types/planner';

test('normalizeStringList trims, drops empties, and deduplicates case-insensitively', () => {
  const out = normalizeStringList([
    ' Lower Body ',
    'lower body',
    '',
    '  ',
    'Hand-Eye Coordination',
    'Juggling',
    'juggling',
  ]);
  assert.deepEqual(out, ['Lower Body', 'Hand-Eye Coordination', 'Juggling']);
});

test('getAvailableOffIceTags merges preset tags with custom practice tags', () => {
  const sample: OffIcePractice[] = [
    {
      id: '1',
      ownerId: null,
      title: 'Wall Ball Juggling',
      description: 'Catching drill',
      durationMinutes: 15,
      equipment: ['Tennis Balls'],
      tags: ['Hand-Eye Coordination', 'Juggling', 'Pre-Game Warmup'],
      images: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const tags = getAvailableOffIceTags(sample);
  assert.ok(tags.includes('Lower Body'));
  assert.ok(tags.includes('Upper Body'));
  assert.ok(tags.includes('Balance'));
  assert.ok(tags.includes('Hand-Eye Coordination'));
  assert.ok(tags.includes('Juggling'));
  assert.ok(tags.includes('Pre-Game Warmup'));
});

test('filterOffIcePractices filters by multiple tags and search query', () => {
  const practices: OffIcePractice[] = [
    {
      id: '1',
      ownerId: null,
      title: 'Lateral Skater Bounds',
      description: 'Explosive lower body push',
      durationMinutes: 20,
      equipment: ['Mini Band'],
      tags: ['Lower Body', 'Balance'],
      images: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '2',
      ownerId: null,
      title: 'Tennis Ball Wall Reaction',
      description: 'Glove tracking and catching',
      durationMinutes: 15,
      equipment: ['Tennis Balls'],
      tags: ['Hand-Eye Coordination', 'Upper Body', 'Juggling'],
      images: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  // Single tag filter
  const lower = filterOffIcePractices(practices, ['Lower Body'], '');
  assert.equal(lower.length, 1);
  assert.equal(lower[0].id, '1');

  // Custom tag filter (case-insensitive)
  const juggling = filterOffIcePractices(practices, ['juggling'], '');
  assert.equal(juggling.length, 1);
  assert.equal(juggling[0].id, '2');

  // Multi-tag AND filter
  const both = filterOffIcePractices(practices, ['Lower Body', 'Balance'], '');
  assert.equal(both.length, 1);

  const mismatch = filterOffIcePractices(practices, ['Lower Body', 'Juggling'], '');
  assert.equal(mismatch.length, 0);

  // Search query filter
  const bySearch = filterOffIcePractices(practices, [], 'glove');
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].id, '2');
});

test('normalizeImageList keeps valid image data URLs and http(s) URLs and deduplicates', () => {
  const out = normalizeImageList([
    'data:image/png;base64,abc',
    'data:image/png;base64,abc',
    'javascript:alert(1)',
    'https://example.com/stance.jpg',
    '',
  ]);
  assert.deepEqual(out, [
    'data:image/png;base64,abc',
    'https://example.com/stance.jpg',
  ]);
});
