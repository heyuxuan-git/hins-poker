import { RANK_VALUES } from './deck.js';

export const HAND_RANKS = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
};

export const HAND_NAMES = {
  1: '高牌',
  2: '一对',
  3: '两对',
  4: '三条',
  5: '顺子',
  6: '同花',
  7: '葫芦',
  8: '四条',
  9: '同花顺',
};

const COMBOS_5 = (() => {
  const result = [];
  const n = 7;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            result.push([a, b, c, d, e]);
          }
        }
      }
    }
  }
  return result;
})();

function isStraight(ranks) {
  // ranks: sorted unique desc
  if (ranks.length !== 5) return null;
  const unique = [...new Set(ranks)];
  if (unique.length !== 5) return null;

  // Wheel: A-2-3-4-5
  if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
    return 5; // high card of straight
  }

  if (unique[0] - unique[4] === 4) {
    return unique[0];
  }
  return null;
}

function evaluateFive(cards) {
  const ranks = cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const countMap = new Map();
  for (const r of ranks) {
    countMap.set(r, (countMap.get(r) || 0) + 1);
  }
  const groups = [...countMap.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const straightHigh = isStraight(ranks);

  if (isFlush && straightHigh) {
    return { rank: HAND_RANKS.STRAIGHT_FLUSH, kickers: [straightHigh] };
  }
  if (groups[0][1] === 4) {
    return { rank: HAND_RANKS.FOUR_OF_A_KIND, kickers: [groups[0][0], groups[1][0]] };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { rank: HAND_RANKS.FULL_HOUSE, kickers: [groups[0][0], groups[1][0]] };
  }
  if (isFlush) {
    return { rank: HAND_RANKS.FLUSH, kickers: ranks };
  }
  if (straightHigh) {
    return { rank: HAND_RANKS.STRAIGHT, kickers: [straightHigh] };
  }
  if (groups[0][1] === 3) {
    const kickers = groups.filter((g) => g[1] === 1).map((g) => g[0]);
    return { rank: HAND_RANKS.THREE_OF_A_KIND, kickers: [groups[0][0], ...kickers] };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups.find((g) => g[1] === 1)[0];
    return { rank: HAND_RANKS.TWO_PAIR, kickers: [highPair, lowPair, kicker] };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.filter((g) => g[1] === 1).map((g) => g[0]);
    return { rank: HAND_RANKS.PAIR, kickers: [groups[0][0], ...kickers] };
  }
  return { rank: HAND_RANKS.HIGH_CARD, kickers: ranks };
}

/** Evaluate best 5-card hand from 5-7 cards. Also returns the actual best 5 cards. */
export function evaluateHand(cards) {
  if (cards.length < 5) {
    return {
      rank: HAND_RANKS.HIGH_CARD,
      kickers: cards.map((c) => RANK_VALUES[c.rank]).sort((a, b) => b - a),
      name: '高牌',
      bestCards: cards.slice(),
    };
  }

  if (cards.length === 5) {
    const evalResult = evaluateFive(cards);
    return { ...evalResult, name: HAND_NAMES[evalResult.rank], bestCards: cards.slice() };
  }

  let best = null;
  let bestFive = null;
  for (const combo of COMBOS_5) {
    const five = combo.map((i) => cards[i]);
    const evalResult = evaluateFive(five);
    if (!best || compareEval(evalResult, best) > 0) {
      best = evalResult;
      bestFive = five;
    }
  }
  return { ...best, name: HAND_NAMES[best.rank], bestCards: bestFive };
}

/** Positive if a > b, negative if a < b, 0 if tie */
export function compareEval(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < len; i++) {
    const av = a.kickers[i] || 0;
    const bv = b.kickers[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** Compare two players given their hole + community cards. Returns >0 if a wins */
export function compareHands(aCards, bCards) {
  const a = evaluateHand(aCards);
  const b = evaluateHand(bCards);
  return compareEval(a, b);
}
