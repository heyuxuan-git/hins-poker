import { PokerGame } from './game.js';

// Faster simulation: stub sleep
const game = new PokerGame(() => {});
game.sleep = (ms) => Promise.resolve();

async function playHands(n) {
  for (let i = 0; i < n; i++) {
    // Auto-play hero if it's hero's turn: fold/check/call randomly
    const origStart = game.startHand.bind(game);
    let guard = 0;
    while (game.phase !== 'handover' && game.phase !== 'idle' && guard++ < 500) {
      if (game.isHeroTurn()) {
        const toCall = game.currentBet - game.players[0].bet;
        if (toCall === 0) game.actHero({ type: 'check' });
        else if (Math.random() < 0.7) game.actHero({ type: 'call' });
        else game.actHero({ type: 'fold' });
        // allow microtasks
        await Promise.resolve();
        await game.sleep(0);
      } else {
        await game.sleep(0);
        // break if waiting forever
        if (!game.currentPlayer && game.phase !== 'handover') break;
        // If betting is waiting on something else
        if (game.phase !== 'handover' && game.phase !== 'idle' && !game.isHeroTurn()) {
          // runBettingRound may have returned for hero; if not hero and no current AI progressing, kick
          if (game.currentPlayer !== null && !game.players[game.currentPlayer]?.isHero) {
            // AI path is async; wait
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }
      if (game.phase === 'handover') break;
    }
    const total = game.players.reduce((s, p) => s + p.stack, 0);
    console.log(`hand ${i + 1}: phase=${game.phase} pot=${game.pot} stacks=${game.players.map(p => p.stack).join(',')} total=${total} msg=${game.message}`);
    if (total !== 12000) {
      console.error('CHIP LEAK: total should be 12000, got', total);
      process.exitCode = 1;
      return;
    }
    if (game.phase !== 'handover') {
      console.error('Hand did not finish, phase=', game.phase);
      // don't fail hard — may be timing; report
    }
    // reset betting state for next
    await game.startHand();
  }
  console.log('simulation done');
}

// Kick first hand then loop
game.startHand().then(async () => {
  // startHand may wait on hero
  let guard = 0;
  while (game.phase !== 'handover' && guard++ < 800) {
    if (game.isHeroTurn()) {
      const toCall = game.currentBet - game.players[0].bet;
      if (toCall === 0) game.actHero({ type: 'check' });
      else game.actHero({ type: Math.random() < 0.75 ? 'call' : 'fold' });
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  const total = game.players.reduce((s, p) => s + p.stack, 0);
  console.log('first hand:', game.phase, 'total chips', total, game.message);
  if (total !== 12000) {
    console.error('CHIP LEAK on first hand');
    process.exitCode = 1;
  }
  if (game.phase === 'handover') {
    console.log('OK first hand completed');
    // run a few more
    for (let i = 0; i < 8; i++) {
      await game.startHand();
      guard = 0;
      while (game.phase !== 'handover' && guard++ < 800) {
        if (game.isHeroTurn()) {
          const toCall = game.currentBet - game.players[0].bet;
          if (toCall === 0) game.actHero({ type: 'check' });
          else game.actHero({ type: Math.random() < 0.8 ? 'call' : 'fold' });
        }
        await new Promise((r) => setTimeout(r, 5));
      }
      const t = game.players.reduce((s, p) => s + p.stack, 0);
      console.log(`hand ${i + 2}: ${game.phase} total=${t}`);
      if (t !== 12000) {
        console.error('CHIP LEAK', t);
        process.exitCode = 1;
        break;
      }
    }
  } else {
    console.error('First hand stuck at', game.phase, 'currentPlayer', game.currentPlayer);
    process.exitCode = 1;
  }
});
