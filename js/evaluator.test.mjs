import { evaluateHand, compareEval, HAND_RANKS } from './evaluator.js';
import { createDeck, shuffle } from './deck.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

const c = (rank, suit) => ({ rank, suit, id: `${rank}${suit}` });

// Royal flush
const royal = [c('A', 's'), c('K', 's'), c('Q', 's'), c('J', 's'), c('T', 's')];
const er = evaluateHand(royal);
assert(er.rank === HAND_RANKS.STRAIGHT_FLUSH, `royal = straight flush (${er.name})`);

// Wheel
const wheel = [c('A', 's'), c('2', 'h'), c('3', 'd'), c('4', 'c'), c('5', 's')];
const ew = evaluateHand(wheel);
assert(ew.rank === HAND_RANKS.STRAIGHT && ew.kickers[0] === 5, `wheel straight high 5 (${ew.name})`);

// Full house
const boat = [c('A', 's'), c('A', 'h'), c('A', 'd'), c('K', 's'), c('K', 'c')];
assert(evaluateHand(boat).rank === HAND_RANKS.FULL_HOUSE, 'full house');

// Two pair beats one pair
const twoPair = evaluateHand([c('A', 's'), c('A', 'h'), c('K', 'd'), c('K', 's'), c('2', 'c')]);
const onePair = evaluateHand([c('A', 's'), c('A', 'h'), c('Q', 'd'), c('J', 's'), c('2', 'c')]);
assert(compareEval(twoPair, onePair) > 0, 'two pair > one pair');

// 7-card picks best
const seven = [c('A', 's'), c('A', 'h'), c('A', 'd'), c('K', 's'), c('K', 'c'), c('2', 'h'), c('3', 'd')];
assert(evaluateHand(seven).rank === HAND_RANKS.FULL_HOUSE, '7-card full house');

// Deck integrity
const deck = shuffle(createDeck());
assert(deck.length === 52, 'deck has 52 cards');
assert(new Set(deck.map((x) => x.id)).size === 52, 'unique cards');

console.log('evaluator tests done');
