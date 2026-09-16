import { PokerGame } from './game.js';

const game = new PokerGame(() => {});
game.sleep = async () => {};

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

game.setPlayers(
  [
    { name: '你', isAI: false, avatar: 'hero' },
    { name: 'AI1', isAI: true, avatar: 'kai', personality: 'tight' },
    { name: 'AI2', isAI: true, avatar: 'lin', personality: 'tight' },
  ],
  0,
);

game.phase = 'handover';
game.players[0].stack = 0;
const ok = game.rebuySeat(0);
if (!ok) fail('rebuy should succeed when busted between hands');
if (game.players[0].stack !== 2000) fail(`rebuy stack expected 2000 got ${game.players[0].stack}`);

const ok2 = game.rebuySeat(0);
if (ok2) fail('rebuy should fail when stack > 0');
if (game.players[0].stack !== 2000) fail('stack should stay 2000');

game.phase = 'flop';
game.players[0].stack = 0;
const ok3 = game.rebuySeat(0);
if (ok3) fail('rebuy should fail mid-hand');

if (process.exitCode !== 1) console.log('OK rebuy test passed');
