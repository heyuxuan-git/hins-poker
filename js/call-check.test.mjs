import { PokerGame } from './game.js';

globalThis.actionsSignatureReset = () => {};

const game = new PokerGame(() => {});
game.sleep = (ms) => Promise.resolve();
game.aiThinkMs = () => 1;

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

async function waitFor(pred, label, maxMs = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 5));
  }
  fail(`timeout waiting: ${label}`);
  return false;
}

// Play several hands: always call when facing a bet, check when free.
// After each hero action, the engine must leave hero-turn or advance the street —
// never remain on a dead "check" that actHero ignores.
let deadChecks = 0;
let hands = 0;

for (let h = 0; h < 12; h++) {
  hands++;
  const startP = game.startHand();
  let guard = 0;
  let sameTurnStreak = 0;
  let lastKey = '';

  while (game.phase !== 'handover' && game.phase !== 'idle' && guard++ < 600) {
    if (game.isHeroTurn()) {
      const s = game.snapshot();
      const key = `${s.phase}:${s.currentPlayer}:${s.toCall}:${s.pot}:${s.minRaiseTo}`;
      if (key === lastKey) sameTurnStreak++;
      else sameTurnStreak = 0;
      lastKey = key;

      // Same signature three times in a row after acting = stuck dead button
      if (sameTurnStreak >= 3) {
        deadChecks++;
        fail(`stuck on hero turn ${sameTurnStreak}x phase=${s.phase} toCall=${s.toCall} pot=${s.pot}`);
        break;
      }

      if (s.toCall > 0) game.actHero({ type: 'call' });
      else game.actHero({ type: 'check' });

      // After acting, either not hero turn, or state must change
      await new Promise((r) => setTimeout(r, 2));
      const s2 = game.snapshot();
      if (s2.heroTurn) {
        const key2 = `${s2.phase}:${s2.currentPlayer}:${s2.toCall}:${s2.pot}:${s2.minRaiseTo}`;
        if (key2 === key && s2.toCall === 0) {
          // allow one emit lag, but not a permanent same-state check loop
          await new Promise((r) => setTimeout(r, 30));
          const s3 = game.snapshot();
          const key3 = `${s3.phase}:${s3.currentPlayer}:${s3.toCall}:${s3.pot}:${s3.minRaiseTo}`;
          if (key3 === key) {
            deadChecks++;
            fail(`act did not progress state phase=${s3.phase} toCall=${s3.toCall}`);
            break;
          }
        }
      }
    } else {
      await new Promise((r) => setTimeout(r, 2));
    }
  }

  await startP.catch(() => {});
  if (game.phase !== 'handover' && game.phase !== 'idle') {
    fail(`hand ${h} did not finish phase=${game.phase} current=${game.currentPlayer}`);
    break;
  }

  const total = game.players.reduce((s, p) => s + p.stack, 0);
  if (total !== 12000) {
    fail(`chip leak on hand ${h}: ${total}`);
    break;
  }
}

if (!process.exitCode) {
  console.log(`OK call/check no-stuck regression passed (${hands} hands, deadChecks=${deadChecks})`);
}
