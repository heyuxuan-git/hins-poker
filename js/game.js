import { createDeck, shuffle } from './deck.js';
import { evaluateHand, compareEval } from './evaluator.js';
import { decideAiAction } from './ai.js';
import { playCheck, playChips, playAllIn } from './audio.js';

const STARTING_STACK = 2000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const CHIP_UNIT = 10;
const AI_THINK_MIN = 1400;
const AI_THINK_VAR = 1200;

const PERSONALITIES = ['balanced', 'aggressive', 'tight', 'maniac', 'tight', 'aggressive'];

export class PokerGame {
  constructor(onUpdate) {
    this.onUpdate = onUpdate || (() => {});
    this.heroSeat = 0;
    this.players = [
      { id: 0, name: '你', stack: STARTING_STACK, isHero: true, isAI: false, cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, acted: false, seat: 'bottom-right', avatar: 'hero' },
      { id: 1, name: '陈哥', stack: STARTING_STACK, isHero: false, isAI: true, cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, acted: false, seat: 'bottom-left', personality: 'tight', avatar: 'chen' },
      { id: 2, name: '小美', stack: STARTING_STACK, isHero: false, isAI: true, cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, acted: false, seat: 'left', personality: 'maniac', avatar: 'mei' },
      { id: 3, name: '老周', stack: STARTING_STACK, isHero: false, isAI: true, cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, acted: false, seat: 'top-left', personality: 'balanced', avatar: 'zhou' },
      { id: 4, name: '林姐', stack: STARTING_STACK, isHero: false, isAI: true, cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, acted: false, seat: 'top-right', personality: 'tight', avatar: 'lin' },
      { id: 5, name: '阿凯', stack: STARTING_STACK, isHero: false, isAI: true, cards: [], bet: 0, totalBet: 0, folded: false, allIn: false, acted: false, seat: 'right', personality: 'aggressive', avatar: 'kai' },
    ];
    this.handNumber = 0;
    this.button = 0;
    this.phase = 'idle';
    this.deck = [];
    this.community = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;
    this.currentPlayer = null;
    this.lastAction = null;
    this.winners = [];
    this.handResults = [];
    this.message = '准备开始新一局';
    this.showdownReveal = false;
  }

  /** Rebind seats for multiplayer (humans + AI fillers). */
  setPlayers(descriptors, heroSeat = 0) {
    const SEAT_KEYS = ['bottom-right', 'bottom-left', 'left', 'top-left', 'top-right', 'right'];
    this.heroSeat = heroSeat;
    this.players = descriptors.map((d, i) => ({
      id: i,
      name: d.name,
      stack: STARTING_STACK,
      isHero: i === heroSeat,
      isAI: !!d.isAI,
      cards: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      acted: false,
      seat: SEAT_KEYS[i] || `seat-${i}`,
      personality: d.personality || null,
      avatar: d.avatar || 'hero',
      isHuman: !d.isAI,
    }));
    this.handNumber = 0;
    this.button = 0;
    this.phase = 'idle';
    this.community = [];
    this.pot = 0;
    this.currentPlayer = null;
    this.winners = [];
    this.showdownReveal = false;
    this.message = '准备开始新一局';
  }

  get bigBlind() {
    return BIG_BLIND;
  }

  hero() {
    return this.players[this.heroSeat] || this.players[0];
  }

  isHeroTurn() {
    const h = this.hero();
    return this.phase !== 'idle' &&
      this.phase !== 'showdown' &&
      this.phase !== 'handover' &&
      this.currentPlayer === this.heroSeat &&
      !h.folded &&
      !h.allIn &&
      h.stack > 0;
  }

  activePlayers() {
    return this.players.filter((p) => !p.folded);
  }

  playersCanAct() {
    return this.players.filter((p) => !p.folded && !p.allIn && p.stack > 0);
  }

  emit() {
    this.onUpdate(this.snapshot(this.heroSeat));
  }

  snapshot(viewerSeat = this.heroSeat) {
    const viewer = this.players[viewerSeat] || this.players[0];
    const heroTurn =
      this.phase !== 'idle' &&
      this.phase !== 'showdown' &&
      this.phase !== 'handover' &&
      this.currentPlayer === viewerSeat &&
      !viewer.folded &&
      !viewer.allIn &&
      viewer.stack > 0;

    return {
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        stack: p.stack,
        isHero: p.id === viewerSeat,
        isAI: !!p.isAI,
        cards: p.id === viewerSeat || this.phase === 'showdown' || this.showdownReveal
          ? p.cards
          : p.folded
            ? []
            : p.cards.map(() => ({ hidden: true })),
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        isButton: p.id === this.button,
        isCurrent: p.id === this.currentPlayer,
        isThinking: !!p.isThinking,
        seat: p.seat,
        avatar: p.avatar || null,
        lastAction: p.lastAction || null,
        handName: p.handName || null,
      })),
      community: this.community,
      pot: this.pot,
      phase: this.phase,
      message: this.message,
      handNumber: this.handNumber,
      smallBlind: SMALL_BLIND,
      bigBlind: BIG_BLIND,
      currentPlayer: this.currentPlayer,
      heroTurn,
      lastAction: this.lastAction,
      winners: this.winners,
      showdownReveal: this.showdownReveal || this.phase === 'showdown',
      canCheck: heroTurn && viewer.bet === this.currentBet,
      toCall: heroTurn ? Math.max(0, this.currentBet - viewer.bet) : 0,
      minRaiseTo: heroTurn
        ? Math.min(viewer.stack + viewer.bet, this.currentBet + this.minRaise)
        : 0,
      maxRaiseTo: heroTurn ? viewer.stack + viewer.bet : 0,
      heroStack: viewer.stack,
      bigBlind: BIG_BLIND,
      viewerSeat,
    };
  }

  async startHand() {
    const withChips = this.players.filter((p) => p.stack > 0);
    if (withChips.length < 2) {
      // Too few players — rebuy everyone
      for (const p of this.players) p.stack = STARTING_STACK;
      this.handNumber = 0;
      this.button = 0;
      this.message = '可玩人数不足，筹码已重置';
    }

    // Move button to next seated player
    do {
      this.button = (this.button + 1) % this.players.length;
    } while (this.players[this.button].stack <= 0);

    this.handNumber += 1;
    this.community = [];
    this.pot = 0;
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;
    this.winners = [];
    this.handResults = [];
    this.showdownReveal = false;
    this.phase = 'preflop';
    this.deck = shuffle(createDeck());

    for (const p of this.players) {
      p.cards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = p.stack <= 0;
      p.allIn = false;
      p.acted = false;
      p.lastAction = null;
      p.handName = null;
      p.isThinking = false;
    }

    // Seated order clockwise from button — busts are excluded once
    const seated = [];
    let cursor = this.button;
    for (let n = 0; n < this.players.length; n++) {
      cursor = (cursor + 1) % this.players.length;
      if (this.players[cursor].stack > 0) {
        seated.push(cursor);
      }
    }
    if (seated.length < 2) {
      this.phase = 'idle';
      this.message = '可玩人数不足，请重置筹码';
      this.emit();
      return;
    }

    // Blinds: first two seated after button
    const sbIndex = seated[0];
    const bbIndex = seated[1];
    this.postBlind(this.players[sbIndex], SMALL_BLIND, '小盲');
    this.postBlind(this.players[bbIndex], BIG_BLIND, '大盲');
    this.currentBet = Math.max(SMALL_BLIND, BIG_BLIND, this.players[sbIndex].bet, this.players[bbIndex].bet);
    this.minRaise = BIG_BLIND;

    // Deal 2 cards to each seated player — slow, elegant cascade
    for (let round = 0; round < 2; round++) {
      for (const seat of seated) {
        this.players[seat].cards.push(this.deck.pop());
        this.emit();
        await this.sleep(160);
      }
      await this.sleep(120);
    }

    this.message = `第 ${this.handNumber} 局 · ${this.players[sbIndex].name} 小盲 ${SMALL_BLIND} / ${this.players[bbIndex].name} 大盲 ${BIG_BLIND}`;
    this.emit();
    await this.sleep(650);

    // Preflop action starts after BB
    this.currentPlayer = this.nextOccupied(bbIndex);
    this.beginBettingRound();
    this.emit();
    await this.runBettingRound();
  }

  beginBettingRound() {
    for (const p of this.players) {
      if (!p.folded && !p.allIn) p.acted = false;
    }
  }

  postBlind(player, amount, label) {
    const post = Math.min(amount, player.stack);
    player.stack -= post;
    player.bet += post;
    player.totalBet += post;
    player.lastAction = label;
    if (player.stack === 0) player.allIn = true;
    this.pot += post;
  }

  nextOccupied(from) {
    for (let n = 1; n <= this.players.length; n++) {
      const i = (from + n) % this.players.length;
      if (this.players[i].stack > 0) return i;
    }
    return (from + 1) % this.players.length;
  }

  nextToAct(from) {
    for (let n = 1; n <= this.players.length; n++) {
      const i = (from + n) % this.players.length;
      const p = this.players[i];
      if (!p.folded && !p.allIn && p.stack > 0) return i;
    }
    return null;
  }

  sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async runBettingRound() {
    const actors = this.playersCanAct();
    if (actors.length === 0) {
      await this.advanceStreet();
      return;
    }

    let safety = 0;
    while (safety++ < 200) {
      const canAct = this.playersCanAct();
      if (canAct.length <= 1 && this.activePlayers().length <= 1) break;

      // Check if betting round complete
      if (this.isBettingComplete()) break;

      if (this.currentPlayer == null) {
        this.currentPlayer = this.nextToAct(this.button);
        if (this.currentPlayer == null) break;
      }

      const player = this.players[this.currentPlayer];
      if (player.folded || player.allIn || player.stack === 0) {
        this.currentPlayer = this.nextToAct(this.currentPlayer);
        continue;
      }

      this.emit();

      // Local hero or remote human — wait for their action
      if (!player.isAI) {
        return;
      }

      // AI turn — show a short "thinking" beat before acting
      player.isThinking = true;
      this.emit();
      await this.sleep(AI_THINK_MIN + Math.random() * AI_THINK_VAR);
      player.isThinking = false;
      const toCall = this.currentBet - player.bet;
      const action = decideAiAction(player.cards, {
        toCall,
        minRaise: this.currentBet + this.minRaise,
        pot: this.pot,
        stack: player.stack,
        community: this.community,
        betThisStreet: player.bet,
        streetBet: player.bet,
        currentBet: this.currentBet,
        bigBlind: BIG_BLIND,
      }, player.personality || PERSONALITIES[player.id % PERSONALITIES.length]);

      this.applyAction(player, action);
      this.emit();

      if (this.activePlayers().length === 1) {
        await this.finishHand();
        return;
      }

      this.currentPlayer = this.nextToAct(this.currentPlayer);
      // If we wrapped and everyone acted, next check will break
      if (this.currentPlayer == null) break;
    }

    if (this.phase === 'idle' || this.phase === 'showdown' || this.phase === 'handover') return;
    await this.advanceStreet();
  }

  isBettingComplete() {
    const canAct = this.playersCanAct();
    if (canAct.length === 0) return true;
    if (canAct.length === 1 && this.activePlayers().length === 1) return true;

    // Everyone who can act has acted, and all bets equal (or all-in)
    for (const p of canAct) {
      if (!p.acted) return false;
      if (p.bet !== this.currentBet) return false;
    }
    return true;
  }

  applyAction(player, action) {
    if (action.type === 'fold') {
      player.folded = true;
      player.acted = true;
      player.lastAction = '弃牌';
      this.lastAction = { player: player.name, type: 'fold' };
      return;
    }

    if (action.type === 'check') {
      player.acted = true;
      player.lastAction = '过牌';
      this.lastAction = { player: player.name, type: 'check' };
      if (player.isHero) playCheck();
      return;
    }

    if (action.type === 'call') {
      const need = this.currentBet - player.bet;
      const pay = Math.min(need, player.stack);
      player.stack -= pay;
      player.bet += pay;
      player.totalBet += pay;
      this.pot += pay;
      if (player.stack === 0) player.allIn = true;
      player.acted = true;
      player.lastAction = pay === 0 ? '过牌' : `跟注 ${pay}`;
      this.lastAction = { player: player.name, type: 'call', amount: pay };
      if (player.isHero) {
        if (pay === 0) playCheck();
        else playChips(0.7);
      }
      return;
    }

    if (action.type === 'raise' || action.type === 'allin') {
      const maxTo = player.bet + player.stack;
      const minLegal = Math.max(this.currentBet + this.minRaise, this.currentBet + CHIP_UNIT);
      let target;

      if (action.type === 'allin') {
        target = maxTo;
      } else {
        // Snap raise-to to 10; only exact-stack all-in may be off-unit
        let raw = Math.max(action.amount, minLegal);
        target = Math.round(raw / CHIP_UNIT) * CHIP_UNIT;
        if (target < minLegal) {
          target = Math.ceil(minLegal / CHIP_UNIT) * CHIP_UNIT;
        }
        if (target >= maxTo) {
          target = maxTo;
          action = { type: 'allin', amount: player.stack };
        }
      }

      const pay = target - player.bet;
      if (pay <= 0) {
        this.applyAction(player, { type: 'call' });
        return;
      }

      const raiseBy = target - this.currentBet;
      player.stack -= pay;
      player.bet = target;
      player.totalBet += pay;
      this.pot += pay;
      if (player.stack === 0) player.allIn = true;

      if (raiseBy >= this.minRaise || player.allIn) {
        this.minRaise = Math.max(this.minRaise, raiseBy);
        this.currentBet = target;
        for (const p of this.players) {
          if (p.id !== player.id && !p.folded && !p.allIn) p.acted = false;
        }
      } else if (target > this.currentBet) {
        this.currentBet = target;
      }

      player.acted = true;
      player.lastAction = player.allIn ? `全下 ${target}` : `加注到 ${target}`;
      this.lastAction = { player: player.name, type: 'raise', amount: target };
      // Crowd gasp on any all-in; chip sfx only for the local player
      if (player.allIn) playAllIn();
      else if (player.isHero) playChips(1.2);
      return;
    }
  }

  /** Called when local hero clicks an action button */
  actHero(action) {
    if (!this.isHeroTurn()) return;
    const hero = this.hero();
    this.applyAction(hero, action);
    this.emit();

    if (this.activePlayers().length === 1) {
      this.finishHand();
      return;
    }

    this.currentPlayer = this.nextToAct(this.heroSeat);
    setTimeout(() => {
      this.runBettingRound();
    }, 100);
  }

  /** Host receives a remote human action */
  actRemote(seat, action) {
    if (this.currentPlayer !== seat) return;
    const player = this.players[seat];
    if (!player || player.isAI || player.folded || player.allIn) return;
    this.applyAction(player, action);
    this.emit();

    if (this.activePlayers().length === 1) {
      this.finishHand();
      return;
    }

    this.currentPlayer = this.nextToAct(seat);
    setTimeout(() => {
      this.runBettingRound();
    }, 100);
  }

  async advanceStreet() {
    // Collect bets already in pot; reset street bets
    for (const p of this.players) {
      p.bet = 0;
      p.acted = false;
      p.lastAction = p.folded ? p.lastAction : null;
    }
    this.currentBet = 0;
    this.minRaise = BIG_BLIND;

    const stillStanding = this.activePlayers();
    if (stillStanding.length <= 1) {
      await this.finishHand();
      return;
    }

    // If only all-in players remain besides maybe one who already matched, run out board
    const canContinue = this.playersCanAct();

    if (this.phase === 'preflop') {
      this.phase = 'flop';
      this.message = `翻牌 · 底池 ${this.pot}`;
      this.emit();
      await this.sleep(420);
      for (let i = 0; i < 3; i++) {
        this.community.push(this.deck.pop());
        this.emit();
        await this.sleep(320);
      }
      await this.sleep(500);
    } else if (this.phase === 'flop') {
      this.phase = 'turn';
      this.message = `转牌 · 底池 ${this.pot}`;
      this.emit();
      await this.sleep(420);
      this.community.push(this.deck.pop());
      this.emit();
      await this.sleep(650);
    } else if (this.phase === 'turn') {
      this.phase = 'river';
      this.message = `河牌 · 底池 ${this.pot}`;
      this.emit();
      await this.sleep(420);
      this.community.push(this.deck.pop());
      this.emit();
      await this.sleep(650);
    } else if (this.phase === 'river') {
      await this.showdown();
      return;
    }

    // No more betting if fewer than 2 can act
    if (canContinue.length < 2) {
      // Burn remaining cards to river then showdown
      while (this.community.length < 5) {
        this.community.push(this.deck.pop());
        this.emit();
        await this.sleep(400);
      }
      this.phase = 'river';
      await this.showdown();
      return;
    }

    // First to act postflop: next after button
    this.currentPlayer = this.nextToAct(this.button);
    if (this.currentPlayer == null) {
      await this.advanceStreet();
      return;
    }

    this.beginBettingRound();
    this.emit();
    await this.runBettingRound();
  }

  async showdown() {
    this.phase = 'showdown';
    this.showdownReveal = true;
    this.message = '摊牌';
    this.currentPlayer = null;

    for (const p of this.activePlayers()) {
      const evalResult = evaluateHand([...p.cards, ...this.community]);
      p.handName = evalResult.name;
      p.evalResult = evalResult;
    }

    this.emit();
    await this.sleep(1200);
    await this.finishHand();
  }

  async finishHand() {
    this.phase = 'showdown';
    this.showdownReveal = true;
    this.currentPlayer = null;

    const contenders = this.activePlayers();

    if (contenders.length === 1) {
      const winner = contenders[0];
      // Uncalled portion returns - simple: award full pot
      winner.stack += this.pot;
      this.winners = [{ id: winner.id, name: winner.name, amount: this.pot, handName: null }];
      this.message = `${winner.name} 赢得底池 ${this.pot}（其余弃牌）`;
      this.phase = 'handover';
      this.emit();
      return;
    }

    // Evaluate all contenders
    for (const p of contenders) {
      p.evalResult = evaluateHand([...p.cards, ...this.community]);
      p.handName = p.evalResult.name;
    }

    // Sort by hand strength
    const ranked = contenders
      .map((p) => ({ p, ev: p.evalResult }))
      .sort((a, b) => compareEval(b.ev, a.ev));

    // Simple pot award (handle ties). Side pots simplified by totalBet.
    this.awardWithSidePots(contenders);

    this.phase = 'handover';
    this.emit();
  }

  awardWithSidePots(contenders) {
    // Build pots from totalBet levels
    const levels = [...new Set(this.players.filter((p) => p.totalBet > 0).map((p) => p.totalBet))].sort((a, b) => a - b);

    if (levels.length === 0) {
      const best = contenders.reduce((a, b) => (compareEval(b.evalResult, a.evalResult) > 0 ? b : a));
      best.stack += this.pot;
      this.winners = [{
        id: best.id,
        name: best.name,
        amount: this.pot,
        handName: best.handName,
        bestCards: best.evalResult?.bestCards || [],
      }];
      this.message = `${best.name} 以 ${best.handName} 赢得 ${this.pot}`;
      return;
    }

    let prev = 0;
    let awarded = 0;
    const winCounts = new Map();

    for (const level of levels) {
      let potAmount = 0;
      for (const p of this.players) {
        const contrib = Math.min(p.totalBet, level) - Math.min(p.totalBet, prev);
        if (contrib > 0) potAmount += contrib;
      }
      prev = level;

      // Eligible contenders who contributed at least `level`
      const eligible = contenders.filter((p) => p.totalBet >= level);
      if (eligible.length === 0 || potAmount <= 0) continue;

      let best = eligible[0];
      for (const p of eligible) {
        if (compareEval(p.evalResult, best.evalResult) > 0) best = p;
      }
      const tied = eligible.filter((p) => compareEval(p.evalResult, best.evalResult) === 0);
      const share = Math.floor(potAmount / tied.length);
      let remainder = potAmount - share * tied.length;

      for (const w of tied) {
        const amt = share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        w.stack += amt;
        awarded += amt;
        winCounts.set(w.id, (winCounts.get(w.id) || 0) + amt);
      }
    }

    // Any leftover chips (shouldn't happen often)
    const leftover = this.pot - awarded;
    if (leftover > 0 && contenders.length > 0) {
      const best = contenders.reduce((a, b) => (compareEval(b.evalResult, a.evalResult) > 0 ? b : a));
      best.stack += leftover;
      winCounts.set(best.id, (winCounts.get(best.id) || 0) + leftover);
    }

    this.winners = [...winCounts.entries()].map(([id, amount]) => {
      const p = this.players.find((x) => x.id === id);
      return {
        id,
        name: p.name,
        amount,
        handName: p.handName,
        bestCards: p.evalResult?.bestCards || [],
      };
    });

    const main = this.winners.slice().sort((a, b) => b.amount - a.amount)[0];
    if (main) {
      this.message = `${main.name} 以 ${main.handName || '大牌'} 赢得 ${main.amount}`;
    }
  }

  resetTournament() {
    for (const p of this.players) {
      p.stack = STARTING_STACK;
      p.cards = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = false;
      p.allIn = false;
      p.acted = false;
      p.lastAction = null;
      p.handName = null;
    }
    this.handNumber = 0;
    this.button = 0;
    this.community = [];
    this.pot = 0;
    this.phase = 'idle';
    this.winners = [];
    this.showdownReveal = false;
    this.message = '筹码已重置';
    this.currentPlayer = null;
    this.emit();
  }
}
