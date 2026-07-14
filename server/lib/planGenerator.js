'use strict';

const DEFAULT_WEIGHTS = { benchDeficit: 10, benchStreak: 3, pairing: 2, positionRepeat: 1 };
const MAX_EXHAUSTIVE_CANDIDATES = 200000;

function combinations(items, k) {
  const results = [];
  const combo = [];
  function backtrack(start) {
    if (combo.length === k) {
      results.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return results;
}

function binomialCoefficient(n, k) {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1);
    if (result > MAX_EXHAUSTIVE_CANDIDATES) return Infinity;
  }
  return result;
}

function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function playRate(playerStats) {
  if (!playerStats || !playerStats.availableQuarters) return 0;
  return playerStats.playedQuarters / playerStats.availableQuarters;
}

function shuffleInPlace(arr, start, end) {
  for (let i = end - 1; i > start; i--) {
    const j = start + Math.floor(Math.random() * (i - start + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// Resolves which position slots are actually fillable this quarter, dropping
// slots (lowest drop_priority first; null/undefined priority is never dropped)
// when fewer players are available than the formation calls for.
function resolveFieldSlots(formationSlots, availableCount) {
  const tokens = [];
  for (const slot of formationSlots) {
    for (let i = 0; i < slot.count; i++) {
      tokens.push({ position_id: slot.position_id, drop_priority: slot.drop_priority });
    }
  }

  const droppable = tokens
    .filter((t) => t.drop_priority !== null && t.drop_priority !== undefined)
    .sort((a, b) => a.drop_priority - b.drop_priority);
  const undroppable = tokens.filter((t) => t.drop_priority === null || t.drop_priority === undefined);
  const dropOrder = [...droppable, ...undroppable];

  const remaining = tokens.slice();
  let dropIdx = 0;
  while (remaining.length > availableCount && dropIdx < dropOrder.length) {
    const idx = remaining.indexOf(dropOrder[dropIdx]);
    if (idx !== -1) remaining.splice(idx, 1);
    dropIdx++;
  }
  return remaining.map((t) => t.position_id);
}

function isEligible(playerId, positionId, eligibility) {
  const allowed = eligibility[playerId];
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(positionId);
}

// Ranks candidate (bench, play) splits by cost, cheapest first, shuffling
// within near-tie cost bands so the same player isn't always benched at the
// same point in every game. Pairing cost only depends on who plays together,
// not what position they play, so this can be scored independent of the
// (separate) position assignment step.
function rankBenchCandidates(availablePlayerIds, benchCount, stats, pairCounts, benchStreaks, weights) {
  if (benchCount <= 0) {
    return [{ bench: [], play: availablePlayerIds.slice(), cost: 0 }];
  }
  if (benchCount >= availablePlayerIds.length) {
    return [{ bench: availablePlayerIds.slice(), play: [], cost: 0 }];
  }

  const playCount = availablePlayerIds.length - benchCount;
  const enumerateBenchDirectly = benchCount <= playCount;
  const k = enumerateBenchDirectly ? benchCount : playCount;

  if (binomialCoefficient(availablePlayerIds.length, k) === Infinity) {
    return greedyBenchCandidate(availablePlayerIds, benchCount, stats, benchStreaks);
  }

  const combos = combinations(availablePlayerIds, k);

  const candidates = combos.map((combo) => {
    const comboSet = new Set(combo);
    const benchSet = enumerateBenchDirectly ? combo : availablePlayerIds.filter((p) => !comboSet.has(p));
    const playSet = enumerateBenchDirectly ? availablePlayerIds.filter((p) => !comboSet.has(p)) : combo;

    let cost = 0;
    for (const p of benchSet) {
      const deficit = 1 - playRate(stats[p]);
      cost += weights.benchDeficit * deficit * deficit;
      cost += weights.benchStreak * (benchStreaks[p] || 0);
    }
    for (let i = 0; i < playSet.length; i++) {
      for (let j = i + 1; j < playSet.length; j++) {
        cost += weights.pairing * (pairCounts[pairKey(playSet[i], playSet[j])] || 0);
      }
    }
    return { bench: benchSet, play: playSet, cost };
  });

  candidates.sort((a, b) => a.cost - b.cost);

  const EPS = 1e-6;
  let i = 0;
  while (i < candidates.length) {
    let j = i + 1;
    while (j < candidates.length && candidates[j].cost - candidates[i].cost <= EPS) j++;
    shuffleInPlace(candidates, i, j);
    i = j;
  }

  return candidates;
}

// Fallback for rosters too large to enumerate exhaustively: bench whoever
// currently has the highest play rate (least deficit), tie-broken by who has
// sat out least recently.
function greedyBenchCandidate(availablePlayerIds, benchCount, stats, benchStreaks) {
  const sorted = availablePlayerIds.slice().sort((a, b) => {
    const rateDiff = playRate(stats[b]) - playRate(stats[a]);
    if (Math.abs(rateDiff) > 1e-9) return rateDiff;
    return (benchStreaks[a] || 0) - (benchStreaks[b] || 0);
  });
  const bench = sorted.slice(0, benchCount);
  const benchSet = new Set(bench);
  const play = availablePlayerIds.filter((p) => !benchSet.has(p));
  return [{ bench, play, cost: 0 }];
}

// Backtracking assignment of players to position slots: at each slot, tries
// eligible players in ascending order of how often they've already played
// that position, falling back to the next candidate if a choice leads to a
// dead end later. Slots with the fewest eligible players are placed first to
// prune quickly.
function findPositionAssignment(playerIds, slotPositionIds, eligibility, positionCountsByPlayer) {
  if (slotPositionIds.length === 0) return [];

  const slotOrder = slotPositionIds
    .map((positionId, idx) => idx)
    .sort((a, b) => {
      const countA = playerIds.filter((p) => isEligible(p, slotPositionIds[a], eligibility)).length;
      const countB = playerIds.filter((p) => isEligible(p, slotPositionIds[b], eligibility)).length;
      return countA - countB;
    });

  const used = new Array(playerIds.length).fill(false);
  const assignment = new Array(slotPositionIds.length).fill(null);

  function backtrack(orderIdx) {
    if (orderIdx === slotOrder.length) return true;
    const slotIdx = slotOrder[orderIdx];
    const positionId = slotPositionIds[slotIdx];

    const candidates = playerIds
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => !used[i] && isEligible(p, positionId, eligibility))
      .sort((a, b) => {
        const countsA = positionCountsByPlayer[a.p] || {};
        const countsB = positionCountsByPlayer[b.p] || {};
        return (countsA[positionId] || 0) - (countsB[positionId] || 0);
      });

    for (const { p, i } of candidates) {
      used[i] = true;
      assignment[slotIdx] = { player_id: p, position_id: positionId };
      if (backtrack(orderIdx + 1)) return true;
      used[i] = false;
      assignment[slotIdx] = null;
    }
    return false;
  }

  return backtrack(0) ? assignment : null;
}

function findBestEffortAssignment(playerIds, slotPositionIds, eligibility, positionCountsByPlayer) {
  const strict = findPositionAssignment(playerIds, slotPositionIds, eligibility, positionCountsByPlayer);
  if (strict) return strict;
  // Every bench split was infeasible under eligibility restrictions (e.g. no
  // eligible goalkeeper showed up) - relax restrictions as a last resort so a
  // usable lineup is still produced rather than leaving slots empty.
  return findPositionAssignment(playerIds, slotPositionIds, {}, positionCountsByPlayer) || [];
}

function planQuarter({ availablePlayerIds, fieldSlotPositionIds, benchCount, stats, pairCounts, benchStreaks, eligibility, weights }) {
  const candidates = rankBenchCandidates(availablePlayerIds, benchCount, stats, pairCounts, benchStreaks, weights);

  const positionCountsByPlayer = {};
  for (const p of availablePlayerIds) positionCountsByPlayer[p] = stats[p].positionCounts;

  for (const candidate of candidates) {
    const assignment = findPositionAssignment(candidate.play, fieldSlotPositionIds, eligibility, positionCountsByPlayer);
    if (assignment) {
      return { bench: candidate.bench, play: candidate.play, assignment };
    }
  }

  const fallback = candidates[0];
  const assignment = findBestEffortAssignment(fallback.play, fieldSlotPositionIds, eligibility, positionCountsByPlayer);
  return { bench: fallback.bench, play: fallback.play, assignment };
}

/**
 * @param {object} input
 * @param {number[]} input.availablePlayerIds
 * @param {{position_id:number, count:number, drop_priority:?number}[]} input.formationSlots
 * @param {number} input.numQuarters
 * @param {Object<number, number[]>} [input.eligibility] - player_id -> allowed position_ids (absent/empty = unrestricted)
 * @param {Object<number, {playedQuarters:number, availableQuarters:number, positionCounts:Object<number,number>}>} [input.priorStats]
 * @param {Object<string, number>} [input.priorPairCounts] - "a:b" (a<b) -> quarters paired
 * @param {Object<number, number>} [input.priorBenchStreaks] - player_id -> consecutive quarters currently on the bench
 * @param {object} [input.weights]
 */
function generatePlan(input) {
  const {
    availablePlayerIds,
    formationSlots,
    numQuarters,
    eligibility = {},
    priorStats = {},
    priorPairCounts = {},
    priorBenchStreaks = {},
    weights = DEFAULT_WEIGHTS,
  } = input;

  const stats = {};
  for (const p of availablePlayerIds) {
    const s = priorStats[p] || {};
    stats[p] = {
      playedQuarters: s.playedQuarters || 0,
      availableQuarters: s.availableQuarters || 0,
      positionCounts: { ...(s.positionCounts || {}) },
    };
  }
  const pairCounts = { ...priorPairCounts };
  const benchStreaks = {};
  for (const p of availablePlayerIds) benchStreaks[p] = priorBenchStreaks[p] || 0;

  const quarters = [];

  for (let q = 1; q <= numQuarters; q++) {
    for (const p of availablePlayerIds) stats[p].availableQuarters += 1;

    const fieldSlotPositionIds = resolveFieldSlots(formationSlots, availablePlayerIds.length);
    const benchCount = availablePlayerIds.length - fieldSlotPositionIds.length;

    const { bench, play, assignment } = planQuarter({
      availablePlayerIds,
      fieldSlotPositionIds,
      benchCount,
      stats,
      pairCounts,
      benchStreaks,
      eligibility,
      weights,
    });

    for (const p of play) {
      stats[p].playedQuarters += 1;
      benchStreaks[p] = 0;
    }
    for (const p of bench) {
      benchStreaks[p] = (benchStreaks[p] || 0) + 1;
    }
    for (const { player_id, position_id } of assignment) {
      stats[player_id].positionCounts[position_id] = (stats[player_id].positionCounts[position_id] || 0) + 1;
    }
    for (let i = 0; i < play.length; i++) {
      for (let j = i + 1; j < play.length; j++) {
        const key = pairKey(play[i], play[j]);
        pairCounts[key] = (pairCounts[key] || 0) + 1;
      }
    }

    quarters.push({ quarter_number: q, assignments: assignment, bench });
  }

  return { quarters };
}

module.exports = {
  generatePlan,
  resolveFieldSlots,
  findPositionAssignment,
  DEFAULT_WEIGHTS,
};
