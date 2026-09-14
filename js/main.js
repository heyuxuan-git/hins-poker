import { PokerGame } from './game.js';
import { cardDisplay } from './deck.js';

const SEAT_KEYS = ['bottom', 'right', 'top-right', 'top-left', 'left', 'bottom-left'];

const seatEls = Object.fromEntries(
  SEAT_KEYS.map((key) => [key, document.getElementById(`seat-${key}`)]),
);

const boardEl = document.getElementById('board');
const potAmountEl = document.getElementById('pot-amount');
const toastEl = document.getElementById('toast');
const actionsEl = document.getElementById('actions');
const raiseRow = document.getElementById('raise-row');
const raiseSlider = document.getElementById('raise-slider');
const raiseAmountEl = document.getElementById('raise-amount');
const handNumEl = document.getElementById('hand-num');
const winBannerSlot = document.getElementById('win-banner-slot');
const btnReset = document.getElementById('btn-reset');

let lastState = null;
let raiseTarget = 40;

/** Cached DOM per seat so we never wipe/rebuild on every action */
const seatCache = new Map();
const boardCache = [];
let actionsSignature = '';
let winBannerKey = '';

function formatChips(n) {
  return Number(n).toLocaleString('zh-CN');
}

function cardKey(card) {
  if (!card) return 'empty';
  if (card.hidden) return 'back';
  return card.id || `${card.rank}${card.suit}`;
}

function buildCardEl(card) {
  if (!card) return null;
  if (card.hidden) {
    const el = document.createElement('div');
    el.className = 'pcard back';
    el.setAttribute('aria-label', '暗牌');
    return el;
  }
  const d = cardDisplay(card);
  const el = document.createElement('div');
  el.className = `pcard${d.isRed ? ' red' : ''}`;
  el.setAttribute('aria-label', `${d.rank}${d.suit}`);
  el.innerHTML = `
    <div class="corner"><span>${d.rank}</span><span>${d.suit}</span></div>
    <div class="center">${d.suit}</div>
  `;
  return el;
}

function ensureSeatScaffold(el) {
  let cache = seatCache.get(el);
  if (cache) return cache;

  el.innerHTML = `
    <div class="seat-cards"></div>
    <div class="player-chip">
      <div class="player-name">
        <span class="dealer-btn" title="庄家" hidden>D</span>
        <span class="player-name-text"></span>
      </div>
      <div class="player-stack"></div>
      <div class="player-bet"></div>
      <div class="player-action"></div>
      <div class="hand-tag"></div>
    </div>
  `;

  cache = {
    cards: el.querySelector('.seat-cards'),
    name: el.querySelector('.player-name-text'),
    dealer: el.querySelector('.dealer-btn'),
    stack: el.querySelector('.player-stack'),
    bet: el.querySelector('.player-bet'),
    action: el.querySelector('.player-action'),
    hand: el.querySelector('.hand-tag'),
    cardEls: [],
    cardKeys: [],
  };
  seatCache.set(el, cache);
  return cache;
}

function syncCards(container, cache, cards) {
  const keys = (cards || []).map(cardKey);
  const same =
    keys.length === cache.cardKeys.length &&
    keys.every((k, i) => k === cache.cardKeys[i]);

  if (same) return;

  cache.cardKeys = keys;
  container.innerHTML = '';
  cache.cardEls = keys.map((_, i) => {
    const node = buildCardEl(cards[i]);
    container.appendChild(node);
    return node;
  });
}

function renderSeat(el, player, state) {
  if (!el) return;
  const cache = ensureSeatScaffold(el);
  const isWinner = (state.winners || []).some((w) => w.id === player.id);

  const layout = el.dataset.seat || '';
  const classes = ['seat'];
  if (layout) classes.push(layout);
  if (player.folded) classes.push('folded');
  if (player.isCurrent) classes.push('current');
  if (isWinner) classes.push('winner');
  if (player.isThinking) classes.push('thinking');
  const nextClass = classes.join(' ');
  if (el.className !== nextClass) el.className = nextClass;

  syncCards(cache.cards, cache, player.cards);

  if (cache.name.textContent !== player.name) cache.name.textContent = player.name;
  if (cache.dealer.hidden === !!player.isButton) cache.dealer.hidden = !player.isButton;

  const stackText = formatChips(player.stack);
  if (cache.stack.textContent !== stackText) cache.stack.textContent = stackText;

  const betText = player.bet > 0 ? `下注 ${formatChips(player.bet)}` : '';
  if (cache.bet.textContent !== betText) cache.bet.textContent = betText;

  const actionText = player.lastAction || '';
  if (cache.action.textContent !== actionText) cache.action.textContent = actionText;

  const handText = player.handName || '';
  if (cache.hand.textContent !== handText) cache.hand.textContent = handText;
}

function renderBoard(community) {
  for (let i = 0; i < 5; i++) {
    const card = community[i];
    const key = cardKey(card);
    const existing = boardCache[i];
    if (!existing || existing.key === key) continue;

    const node = card ? buildCardEl(card) : document.createElement('div');
    if (!card) node.className = 'card-slot';
    if (existing.node.parentNode === boardEl) {
      boardEl.replaceChild(node, existing.node);
    } else {
      boardEl.replaceChild(node, boardEl.children[i] || existing.node);
    }
    boardCache[i] = { key, node };
  }
}

function initBoardSlots() {
  boardEl.innerHTML = '';
  boardCache.length = 0;
  for (let i = 0; i < 5; i++) {
    const node = document.createElement('div');
    node.className = 'card-slot';
    boardEl.appendChild(node);
    boardCache[i] = { key: 'empty', node };
  }
}

function renderActions(state) {
  const hero = state.players[0];
  const toCall = state.toCall || 0;
  const signature = [
    state.phase,
    state.heroTurn ? 1 : 0,
    state.phase === 'idle' || state.phase === 'handover' ? 'start' : '',
    state.phase === 'showdown' ? 'showdown' : '',
    state.heroTurn ? (toCall === 0 ? 'check' : `call:${toCall}`) : '',
    state.heroTurn && state.players[0].stack ? `stack:${state.players[0].stack}` : '',
    state.heroTurn ? `min:${state.minRaiseTo}|max:${state.maxRaiseTo}|cbet:${state.currentBet}` : '',
  ].join('|');

  if (signature === actionsSignature) return;
  actionsSignature = signature;

  actionsEl.innerHTML = '';
  raiseRow.hidden = true;

  const idle = state.phase === 'idle';
  const handover = state.phase === 'handover';

  if (idle || handover) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn btn-start';
    btn.textContent = idle ? '发牌 · 开始新局' : '下一局';
    btn.addEventListener('click', () => game.startHand());
    actionsEl.appendChild(btn);
    return;
  }

  if (!state.heroTurn) {
    const wait = document.createElement('div');
    wait.className = 'waiting';
    const thinkingName = state.players.find((p) => p.isThinking)?.name;
    if (thinkingName) {
      wait.textContent = `${thinkingName} 思考中…`;
    } else {
      wait.textContent = state.phase === 'showdown' ? '摊牌中…' : '等待对手行动…';
    }
    actionsEl.appendChild(wait);
    return;
  }

  const canCheck = toCall === 0;

  const fold = document.createElement('button');
  fold.type = 'button';
  fold.className = 'action-btn btn-fold';
  fold.textContent = '弃牌';
  fold.addEventListener('click', () => game.actHero({ type: 'fold' }));
  actionsEl.appendChild(fold);

  const checkCall = document.createElement('button');
  checkCall.type = 'button';
  if (canCheck) {
    checkCall.className = 'action-btn btn-check';
    checkCall.textContent = '过牌';
    checkCall.addEventListener('click', () => game.actHero({ type: 'check' }));
  } else {
    checkCall.className = 'action-btn btn-call';
    const pay = Math.min(toCall, hero.stack);
    checkCall.textContent = `跟注 ${formatChips(pay)}`;
    checkCall.addEventListener('click', () => game.actHero({ type: 'call' }));
    if (hero.stack <= 0) checkCall.disabled = true;
  }
  actionsEl.appendChild(checkCall);

  const minTo = state.minRaiseTo || 0;
  const maxTo = state.maxRaiseTo || 0;
  const canRaise = maxTo > (state.currentBet || 0) && hero.stack > toCall;

  const raiseBtn = document.createElement('button');
  raiseBtn.type = 'button';
  raiseBtn.className = 'action-btn btn-raise';
  raiseBtn.textContent = canRaise ? '加注' : '加注（不可）';
  raiseBtn.disabled = !canRaise;

  if (canRaise) {
    const sliderMin = Math.min(minTo, maxTo);
    const sliderMax = maxTo;
    raiseSlider.min = String(sliderMin);
    raiseSlider.max = String(sliderMax);
    raiseTarget = Math.min(sliderMax, Math.max(sliderMin, sliderMin));
    raiseSlider.value = String(raiseTarget);
    raiseAmountEl.textContent = formatChips(raiseTarget);
    raiseRow.hidden = false;

    raiseBtn.addEventListener('click', () => {
      const amount = Number(raiseSlider.value);
      if (amount >= hero.stack + hero.bet) {
        game.actHero({ type: 'allin', amount: hero.stack });
      } else {
        game.actHero({ type: 'raise', amount });
      }
    });
  }

  actionsEl.appendChild(raiseBtn);

  if (hero.stack > 0 && hero.stack > toCall) {
    const allIn = document.createElement('button');
    allIn.type = 'button';
    allIn.className = 'action-btn btn-allin';
    allIn.textContent = `全下 ${formatChips(hero.stack)}`;
    allIn.addEventListener('click', () => game.actHero({ type: 'allin', amount: hero.stack }));
    actionsEl.appendChild(allIn);
  }
}

function renderWinBanner(state) {
  const key =
    state.phase === 'handover' && state.winners?.length
      ? `${state.winners[0].id}:${state.winners[0].amount}:${state.winners[0].handName || ''}`
      : '';

  if (key === winBannerKey) return;
  winBannerKey = key;
  winBannerSlot.innerHTML = '';
  if (!key) return;

  const w = state.winners[0];
  const label = w.handName
    ? `${w.name} · ${w.handName} +${formatChips(w.amount)}`
    : `${w.name} +${formatChips(w.amount)}`;
  const div = document.createElement('div');
  div.className = 'win-banner';
  div.textContent = label;
  winBannerSlot.appendChild(div);
}

function render(state) {
  lastState = state;

  const potText = formatChips(state.pot);
  if (potAmountEl.textContent !== potText) potAmountEl.textContent = potText;

  const handText = state.handNumber > 0 ? String(state.handNumber) : '—';
  if (handNumEl.textContent !== handText) handNumEl.textContent = handText;

  const msg = state.message || '';
  if (toastEl.textContent !== msg) toastEl.textContent = msg;

  renderBoard(state.community || []);

  for (const p of state.players) {
    renderSeat(seatEls[p.seat], p, state);
  }

  renderActions(state);
  renderWinBanner(state);
}

const game = new PokerGame(render);

raiseSlider.addEventListener('input', () => {
  raiseTarget = Number(raiseSlider.value);
  raiseAmountEl.textContent = formatChips(raiseTarget);
});

btnReset.addEventListener('click', () => {
  if (stateBusy()) return;
  actionsSignature = '';
  winBannerKey = '';
  game.resetTournament();
});

function stateBusy() {
  return lastState && !['idle', 'handover'].includes(lastState.phase);
}

document.addEventListener('keydown', (e) => {
  if (!lastState?.heroTurn) return;
  const k = e.key.toLowerCase();
  if (k === 'f') game.actHero({ type: 'fold' });
  if (k === 'c') {
    if (lastState.toCall === 0) game.actHero({ type: 'check' });
    else game.actHero({ type: 'call' });
  }
  if (k === 'r') {
    const btn = actionsEl.querySelector('.btn-raise');
    if (btn && !btn.disabled) btn.click();
  }
});

initBoardSlots();
game.emit();
