import { RANK_VALUES } from './deck.js';
import { evaluateHand, HAND_RANKS } from './evaluator.js';

/** Rough preflop hand strength 0-1 */
function preflopStrength(hole) {
  const [a, b] = hole.map((c) => RANK_VALUES[c.rank]).sort((x, y) => y - x);
  const suited = hole[0].suit === hole[1].suit;
  const pair = a === b;

  if (pair) {
    return Math.min(0.95, 0.45 + (a - 2) * 0.045);
  }

  let score = 0;
  score += (a - 2) * 0.035;
  score += (b - 2) * 0.02;
  const gap = a - b;
  if (gap === 1) score += 0.08;
  else if (gap === 2) score += 0.04;
  else if (gap >= 5) score -= 0.06;
  if (suited) score += 0.08;
  if (a === 14) score += 0.06;
  if (a >= 12 && b >= 10) score += 0.08;
  return Math.max(0.05, Math.min(0.92, score + 0.15));
}

function estimateWinRate(hole, community, trials = 80) {
  if (community.length < 3) {
    return preflopStrength(hole);
  }

  // Monte Carlo approximation against random ranges
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
    // complete board
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

    // one random villain
    const v1 = pool[idx++];
    const v2 = pool[idx++];
    const villain = evaluateHand([v1, v2, ...fullBoard]);

    if (myHand.rank > villain.rank) wins++;
    else if (myHand.rank === villain.rank) {
      // rough kicker compare
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

/**
 * Decide AI action.
 * ctx: { toCall, minRaise, maxRaise, pot, stack, community, betThisStreet, bigBlind }
 * returns { type: 'fold'|'check'|'call'|'raise'|'allin', amount? }
 */
export function decideAiAction(hole, ctx, personality = 'balanced') {
  const { toCall, minRaise, pot, stack, community, bigBlind } = ctx;
  const winRate = estimateWinRate(hole, community);
  const aggression =
    personality === 'aggressive' ? 1.25 :
    personality === 'tight' ? 0.85 :
    personality === 'maniac' ? 1.55 : 1.0;

  // Effective strength with personality noise
  const noise = (Math.random() - 0.5) * 0.12;
  const strength = Math.max(0, Math.min(1, winRate * aggression + noise));

  // Nobody to call
  if (toCall <= 0) {
    if (strength > 0.72 && Math.random() < 0.55) {
      const raiseSize = Math.max(minRaise, Math.round(pot * (0.4 + Math.random() * 0.4)));
      const amount = Math.min(stack, Math.max(minRaise, raiseSize));
      if (amount >= stack) return { type: 'allin', amount: stack };
      return { type: 'raise', amount };
    }
    if (strength > 0.55 && Math.random() < 0.25) {
      const amount = Math.min(stack, Math.max(minRaise, Math.round(bigBlind * (2 + Math.random() * 2))));
      if (amount >= stack) return { type: 'allin', amount: stack };
      return { type: 'raise', amount };
    }
    return { type: 'check' };
  }

  // Facing a bet
  const potOdds = toCall / (pot + toCall);

  if (toCall >= stack) {
    // Facing all-in
    if (strength > potOdds + 0.08) return { type: 'allin', amount: stack };
    if (strength > potOdds && Math.random() < 0.35) return { type: 'allin', amount: stack };
    return { type: 'fold' };
  }

  const isBluff = Math.random() < (personality === 'maniac' ? 0.18 : personality === 'aggressive' ? 0.1 : 0.04);
  const isSemiBluff = community.length >= 3 && strength > 0.4 && strength < 0.6 && Math.random() < 0.12;

  if (strength > 0.78 || isSemiBluff) {
    const raiseSize = Math.max(minRaise, Math.round(toCall * 2.2 + pot * 0.25));
    const amount = Math.min(stack, raiseSize);
    if (amount >= stack) return { type: 'allin', amount: stack };
    return { type: 'raise', amount };
  }

  if (isBluff && Math.random() < 0.5) {
    const amount = Math.min(stack, Math.max(minRaise, Math.round(toCall * 2.5)));
    if (amount >= stack) return { type: 'allin', amount: stack };
    return { type: 'raise', amount };
  }

  if (strength >= potOdds - 0.05 || (toCall <= bigBlind * 1.5 && strength > 0.25)) {
    return { type: 'call' };
  }

  // Occasional float
  if (Math.random() < 0.08 && toCall <= bigBlind * 2) {
    return { type: 'call' };
  }

  return { type: 'fold' };
}
