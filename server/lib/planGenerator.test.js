'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePlan, resolveFieldSlots, findPositionAssignment } = require('./planGenerator');

const GK = 1;
const DEF = 2;
const FWD = 3;

const STANDARD_5V5 = [
  { position_id: GK, count: 1, drop_priority: null },
  { position_id: DEF, count: 2, drop_priority: 2 },
  { position_id: FWD, count: 2, drop_priority: 1 },
];

test('resolveFieldSlots keeps all slots when enough players are available', () => {
  const slots = resolveFieldSlots(STANDARD_5V5, 7);
  assert.equal(slots.length, 5);
});

test('resolveFieldSlots drops by ascending drop_priority, never dropping null-priority slots', () => {
  // 4 available: 1 field slot must be dropped -> lowest drop_priority (Forward, priority 1) goes first
  const slots4 = resolveFieldSlots(STANDARD_5V5, 4);
  assert.equal(slots4.length, 4);
  assert.equal(slots4.filter((p) => p === FWD).length, 1);
  assert.equal(slots4.filter((p) => p === DEF).length, 2);
  assert.equal(slots4.filter((p) => p === GK).length, 1);

  // 2 available: both forwards and one defender dropped, GK always kept
  const slots2 = resolveFieldSlots(STANDARD_5V5, 2);
  assert.equal(slots2.length, 2);
  assert.ok(slots2.includes(GK), 'goalkeeper slot should never be dropped while any players remain');
});

test('findPositionAssignment respects a hard eligibility restriction', () => {
  const players = [1, 2, 3];
  const slots = [GK, DEF, DEF];
  const eligibility = { 1: [DEF], 2: [DEF], 3: [GK] }; // only player 3 may play GK
  const assignment = findPositionAssignment(players, slots, eligibility, {});
  assert.ok(assignment);
  const gkAssignment = assignment.find((a) => a.position_id === GK);
  assert.equal(gkAssignment.player_id, 3);
});

test('findPositionAssignment returns null when no feasible assignment exists', () => {
  const players = [1, 2];
  const slots = [GK, GK]; // formation impossibly asks for 2 goalkeepers
  const eligibility = { 1: [DEF], 2: [DEF] }; // neither player is eligible for GK
  const assignment = findPositionAssignment(players, slots, eligibility, {});
  assert.equal(assignment, null);
});

test('generatePlan: every available player is either fielded or benched exactly once per quarter, no double-booking', () => {
  const availablePlayerIds = [1, 2, 3, 4, 5, 6, 7];
  const { quarters } = generatePlan({
    availablePlayerIds,
    formationSlots: STANDARD_5V5,
    numQuarters: 4,
  });

  assert.equal(quarters.length, 4);
  for (const quarter of quarters) {
    const fielded = quarter.assignments.map((a) => a.player_id);
    const accountedFor = new Set([...fielded, ...quarter.bench]);
    assert.equal(accountedFor.size, availablePlayerIds.length, 'every available player accounted for exactly once');
    assert.equal(fielded.length + quarter.bench.length, availablePlayerIds.length);
    assert.equal(new Set(fielded).size, fielded.length, 'no player double-booked in the same quarter');
    assert.equal(quarter.assignments.length, 5, 'formation calls for 5 field slots with 7 available');
    assert.equal(quarter.bench.length, 2);
  }
});

test('generatePlan drops slots by drop_priority when short-handed (4 available for a 5-slot formation)', () => {
  const availablePlayerIds = [1, 2, 3, 4];
  const { quarters } = generatePlan({
    availablePlayerIds,
    formationSlots: STANDARD_5V5,
    numQuarters: 1,
  });
  assert.equal(quarters[0].assignments.length, 4);
  assert.equal(quarters[0].bench.length, 0);
  const positionsUsed = quarters[0].assignments.map((a) => a.position_id);
  assert.ok(positionsUsed.includes(GK), 'goalkeeper should still be filled');
  assert.equal(positionsUsed.filter((p) => p === FWD).length, 1, 'one forward slot dropped first');
});

test('generatePlan balances playtime toward players who started with a deficit', () => {
  const availablePlayerIds = [1, 2, 3, 4, 5, 6];
  // player 1 already has a big playtime deficit from prior games; everyone else is fully caught up
  const priorStats = {
    1: { playedQuarters: 0, availableQuarters: 8, positionCounts: {} },
    2: { playedQuarters: 8, availableQuarters: 8, positionCounts: {} },
    3: { playedQuarters: 8, availableQuarters: 8, positionCounts: {} },
    4: { playedQuarters: 8, availableQuarters: 8, positionCounts: {} },
    5: { playedQuarters: 8, availableQuarters: 8, positionCounts: {} },
    6: { playedQuarters: 8, availableQuarters: 8, positionCounts: {} },
  };

  const { quarters } = generatePlan({
    availablePlayerIds,
    formationSlots: STANDARD_5V5,
    numQuarters: 1,
    priorStats,
  });

  const fielded = quarters[0].assignments.map((a) => a.player_id);
  assert.ok(fielded.includes(1), 'the player with the season-long deficit should be prioritized to play');
});

test('generatePlan respects eligibility across the whole game and falls back gracefully when infeasible', () => {
  const availablePlayerIds = [1, 2, 3, 4, 5];
  const eligibility = { 1: [GK] }; // only player 1 may ever play goalkeeper
  const { quarters } = generatePlan({
    availablePlayerIds,
    formationSlots: STANDARD_5V5,
    numQuarters: 3,
    eligibility,
  });

  for (const quarter of quarters) {
    const gk = quarter.assignments.find((a) => a.position_id === GK);
    if (gk) assert.equal(gk.player_id, 1);
  }
});
