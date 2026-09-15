import { PokerGame } from './game.js';

const game = new PokerGame(() => {});
game.sleep = async () => {};

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

// Force a bust: leave only 2 players with chips
game.players[0].stack = 2000; // hero
game.players[1].stack = 2000; // 陈哥
game.players[2].stack = 0;
game.players[3].stack = 0;
game.players[4].stack = 0;
game.players[5].stack = 0;
game.button = 0;

// Defer betting by stubbing runBettingRound after deal
let dealt = null;
const origRun = game.runBettingRound.bind(game);
game.runBettingRound = async function () {
  dealt = game.players.map((p) => ({
    id: p.id,
    name: p.name,
    stack: p.stack,
    cards: p.cards.length,
    folded: p.folded,
  }));
  this.phase = 'handover';
};

await game.startHand();

const withCards = dealt.filter((p) => p.cards > 0);
const busted = dealt.filter((p) => p.id >= 2);
const active = dealt.filter((p) => p.id < 2);

console.log(JSON.stringify(dealt, null, 2));

if (busted.some((p) => p.cards !== 0)) {
  fail('busted players received cards');
}
if (active.some((p) => p.cards !== 2)) {
  fail('active players should each get exactly 2 cards');
}
if (withCards.length !== 2) {
  fail(`expected 2 players with cards, got ${withCards.length}`);
}

// Unique card count total should be 4
const totalCards = dealt.reduce((s, p) => s + p.cards, 0);
if (totalCards !== 4) {
  fail(`total dealt cards should be 4, got ${totalCards}`);
}

if (process.exitCode !== 1) {
  console.log('OK deal-after-bust test passed');
}
