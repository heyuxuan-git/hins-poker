import { RANK_VALUES } from './deck.js';
import { evaluateHand } from './evaluator.js';

/** Rough preflop hand strength 0-1 */
function preflopStrength(hole) {
  const [a, b] = hole.map((c) => RANK_VALUES[c.rank]).sort((x, y) => y - x);
  const suited = hole[0].suit === hole[1].suit;
  const pair = a === b;

  if (pair) {
    return Math.min(0.96, 0.48 + (a - 2) * 0.042);
  }

  let score = 0;
  score += (a - 2) * 0.032;
  score += (b - 2) * 0.018;
  const gap = a - b;
  if (gap === 1) score += 0.09;
  else if (gap === 2) score += 0.05;
  else if (gap === 3) score += 0.02;
  else if (gap >= 5) score -= 0.08;
  if (suited) score += 0.09;
  if (a === 14) score += 0.07;
  if (a >= 12 && b >= 10) score += 0.1;
  if (a >= 10 && b >= 8 && gap <= 2) score += 0.04;
  return Math.max(0.04, Math.min(0.93, score + 0.12));
}

function estimateWinRate(hole, community, trials = 70) {
  if (community.length < 3) {
    return preflopStrength(hole);
  }

  const known = new Set([...hole, ...community].map((c) => c.id));
  const remaining = [];
  const suits = ['s', 'h', 'd', 'c'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  for (const s of suits) {
    for (const r of ranks) {
      const id = `${r}${s}`;
      if (!known.has(id)) remaining.push({ suit: s, rank: r, id });
    }
  }

  let wins = 0;
  let ties = 0;
  const board = community.slice();

  for (let t = 0; t < trials; t++) {
    const pool = remaining.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let idx = 0;
    const fullBoard = board.slice();
    while (fullBoard.length < 5) {
      fullBoard.push(pool[idx++]);
    }

    const myHand = evaluateHand([...hole, ...fullBoard]);
    const v1 = pool[idx++];
    const v2 = pool[idx++];
    const villain = evaluateHand([v1, v2, ...fullBoard]);

    if (myHand.rank > villain.rank) wins++;
    else if (myHand.rank === villain.rank) {
      const len = Math.max(myHand.kickers.length, villain.kickers.length);
      let cmp = 0;
      for (let i = 0; i < len; i++) {
        const a = myHand.kickers[i] || 0;
        const b = villain.kickers[i] || 0;
        if (a !== b) {
          cmp = a - b;
          break;
        }
      }
      if (cmp > 0) wins++;
      else if (cmp === 0) ties++;
    }
  }

  return (wins + ties * 0.5) / trials;
}

/** Cheap draw / made-hand texture helpers */
function hasFlushDraw(hole, community) {
  if (community.length < 3) return false;
  const counts = {};
  for (const c of [...hole, ...community]) {
    counts[c.suit] = (counts[c.suit] || 0) + 1;
  }
  return Object.values(counts).some((n) => n === 4);
}

function hasOpenEnded(hole, community) {
  if (community.length < 3) return false;
  const ranks = new Set([...hole, ...community].map((c) => RANK_VALUES[c.rank]));
  const arr = [...ranks].sort((a, b) => a - b);
  for (let i = 0; i + 3 < arr.length; i++) {
    if (arr[i + 3] - arr[i] === 3) return true;
  }
  return false;
}

function isPairedBoard(community) {
  const counts = {};
  for (const c of community) counts[c.rank] = (counts[c.rank] || 0) + 1;
  return Object.values(counts).some((n) => n >= 2);
}

const PROFILE = {
  tight: {
    vpip: 0.22,
    pfr: 0.14,
    bluff: 0.03,
    semiBluff: 0.08,
    callLoose: 0.04,
    raiseValue: 0.78,
    stab: 0.28,
    allin: 0.01,
  },
  balanced: {
    vpip: 0.34,
    pfr: 0.22,
    bluff: 0.07,
    semiBluff: 0.14,
    callLoose: 0.08,
    raiseValue: 0.74,
    stab: 0.4,
    allin: 0.02,
  },
  aggressive: {
    vpip: 0.44,
    pfr: 0.32,
    bluff: 0.13,
    semiBluff: 0.2,
    callLoose: 0.1,
    raiseValue: 0.7,
    stab: 0.55,
    allin: 0.03,
  },
  maniac: {
    vpip: 0.58,
    pfr: 0.4,
    bluff: 0.22,
    semiBluff: 0.26,
    callLoose: 0.16,
    raiseValue: 0.65,
    stab: 0.7,
    allin: 0.04,
  },
};

const CHIP_UNIT = 10;

function snap10(n) {
  return Math.round(n / CHIP_UNIT) * CHIP_UNIT;
}

function clampRaiseTo(amount, minRaise, stack, streetBet) {
  const maxTo = stack + streetBet;
  let target = snap10(Math.max(minRaise, amount));
  if (target < minRaise) target = Math.ceil(minRaise / CHIP_UNIT) * CHIP_UNIT;
  // Never return a non-10x raise-to; if it would eat the stack, signal all-in via max
  if (target > maxTo) return maxTo;
  return target;
}

function preferRaise(target, stack, streetBet) {
  const maxTo = stack + streetBet;
  let t = snap10(target);
  if (t >= maxTo) {
    return { type: 'allin', amount: stack };
  }
  const pay = t - streetBet;
  if (pay <= 0) return { type: 'call' };
  return { type: 'raise', amount: t };
}

/**
 * Decide AI action with personality-driven strategy.
 * Avoids random all-ins; values thin raises, careful calls, timed bluffs.
 */
export function decideAiAction(hole, ctx, personality = 'balanced') {
  const {
    toCall,
    minRaise,
    pot,
    stack,
    community,
    bigBlind,
    streetBet = 0,
    currentBet = 0,
  } = ctx;

  const p = PROFILE[personality] || PROFILE.balanced;
  const winRate = estimateWinRate(hole, community);
  const noise = (Math.random() - 0.5) * 0.1;
  const strength = Math.max(0, Math.min(1, winRate + noise));

  const flushDraw = hasFlushDraw(hole, community);
  const openEnd = hasOpenEnded(hole, community);
  const drawPower = flushDraw || openEnd;
  const pairedBoard = isPairedBoard(community);
  const spr = stack / Math.max(bigBlind, 1);

  // Effective "is this a strong hand" adjusted by texture
  let effective = strength;
  if (drawPower && community.length >= 3) effective += 0.08;
  if (pairedBoard && strength < 0.55) effective -= 0.04;

  const canShove = stack <= Math.max(bigBlind * 12, pot * 0.75);
  const toCallBb = toCall / bigBlind;

  // --- Checked to us ---
  if (toCall <= 0) {
    // Value bet / c-bet
    if (effective >= p.raiseValue) {
      const size = Math.round(pot * (0.5 + Math.random() * 0.35) + bigBlind);
      const target = clampRaiseTo(streetBet + Math.max(minRaise - currentBet, size), minRaise, stack, streetBet);
      // protect stack: don't overbet jam without nuts
      if (target - streetBet >= stack && effective < 0.92 && Math.random() > p.allin) {
        const half = clampRaiseTo(streetBet + Math.round(stack * 0.55), minRaise, stack, streetBet);
        return preferRaise(half, stack, streetBet);
      }
      return preferRaise(target, stack, streetBet);
    }

    // Small stab with draws or air when aggressive
    if (drawPower && Math.random() < p.semiBluff + 0.1) {
      const size = Math.round(pot * 0.45 + bigBlind);
      const target = clampRaiseTo(streetBet + size, minRaise, stack, streetBet);
      return preferRaise(target, stack, streetBet);
    }

    if (effective > 0.48 && Math.random() < p.stab) {
      const size = Math.round(pot * 0.4 + bigBlind);
      const target = clampRaiseTo(streetBet + size, minRaise, stack, streetBet);
      return preferRaise(target, stack, streetBet);
    }

    // Occasional pure bluff stab
    if (Math.random() < p.bluff * 0.45 && pot >= bigBlind * 4) {
      const size = Math.round(pot * 0.55 + bigBlind);
      const target = clampRaiseTo(streetBet + size, minRaise, stack, streetBet);
      return preferRaise(target, stack, streetBet);
    }

    return { type: 'check' };
  }

  // --- Facing a bet ---
  const potOdds = toCall / (pot + toCall);

  // Facing all-in / near all-in
  if (toCall >= stack - 1) {
    if (effective > potOdds + 0.12) return { type: 'allin', amount: stack };
    if (effective > potOdds + 0.05 && spr < 6 && Math.random() < 0.25) {
      return { type: 'allin', amount: stack };
    }
    // Draws can call small spr
    if (drawPower && spr < 3.5 && potOdds < 0.33) return { type: 'allin', amount: stack };
    return { type: 'fold' };
  }

  // Huge overbet pressure — fold medium hands more
  const betRatio = toCall / Math.max(pot, 1);
  if (betRatio > 0.85 && effective < 0.62 && !drawPower) {
    return { type: 'fold' };
  }

  // Premium raise for value
  if (effective >= p.raiseValue + 0.04) {
    // raise 2.2–2.8x bet, not auto-jam
    const raiseTo = currentBet + Math.round(toCall * (2.2 + Math.random() * 0.7) + pot * 0.1);
    const target = clampRaiseTo(Math.max(minRaise, raiseTo), minRaise, stack, streetBet);
    // Rare thin jam only with huge hand and short stack
    if (canShove && effective > 0.9 && Math.random() < p.allin * 8) {
      return { type: 'allin', amount: stack };
    }
    return preferRaise(target, stack, streetBet);
  }

  // Semi-bluff raises with draws
  if (drawPower && Math.random() < p.semiBluff && toCall < pot * 0.6) {
    const raiseTo = currentBet + Math.round(toCall * 2.4 + pot * 0.15);
    const target = clampRaiseTo(Math.max(minRaise, raiseTo), minRaise, stack, streetBet);
    return preferRaise(target, stack, streetBet);
  }

  // Timed pure bluffs — less on early streets, more when checked around
  const bluffChance = p.bluff * (community.length >= 3 ? 1.15 : 0.55);
  if (Math.random() < bluffChance && toCall <= pot * 0.45 && effective < 0.45) {
    const raiseTo = currentBet + Math.round(toCall * 2.6 + pot * 0.2);
    const target = clampRaiseTo(Math.max(minRaise, raiseTo), minRaise, stack, streetBet);
    // never convert bluff into suicide jam
    if (target - streetBet < stack * 0.85) {
      return preferRaise(target, stack, streetBet);
    }
  }

  // Thin value / protection raise
  if (effective > 0.68 && effective < p.raiseValue && Math.random() < 0.18 && toCall < pot * 0.5) {
    const raiseTo = currentBet + Math.round(toCall * 1.8 + pot * 0.1);
    const target = clampRaiseTo(Math.max(minRaise, raiseTo), minRaise, stack, streetBet);
    return preferRaise(target, stack, streetBet);
  }

  // Calls: pot odds + personality looseness
  const callThresh = Math.max(potOdds - p.callLoose, 0.08);
  if (effective >= callThresh) {
    // Don't call off too wide vs large bets
    if (toCallBb > 25 && effective < 0.7 && !drawPower) {
      if (Math.random() > 0.2) return { type: 'fold' };
    }
    return { type: 'call' };
  }

  // Cheap draw peels
  if (drawPower && potOdds < 0.28) return { type: 'call' };

  // Float / set-mine
  if (strength > 0.28 && toCallBb <= 3 && Math.random() < p.callLoose + 0.05) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}
