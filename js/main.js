import { PokerGame } from './game.js';
import { cardDisplay } from './deck.js';

const SEAT_KEYS = ['bottom-right', 'bottom-left', 'left', 'top-left', 'top-right', 'right'];

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

function buildCardEl(card, { board = false } = {}) {
  if (!card) return null;
  if (card.hidden) {
    const el = document.createElement('div');
    el.className = 'pcard back deal-in';
    el.setAttribute('aria-label', '暗牌');
    return el;
  }
  const d = cardDisplay(card);
  const el = document.createElement('div');
  el.className = `pcard ${board ? 'board-in' : 'deal-in'}${d.isRed ? ' red' : ''}`;
  el.setAttribute('aria-label', `${d.rank}${d.suit}`);
  el.innerHTML = `
    <div class="corner"><span>${d.rank}</span></div>
    <div class="center">${d.suit}</div>
  `;
  return el;
}

function ensureSeatScaffold(el) {
  let cache = seatCache.get(el);
  if (cache) return cache;

  el.innerHTML = `
    <div class="seat-cards"></div>
    <div class="seat-body">
      <div class="avatar-wrap">
        <div class="avatar-glow"></div>
        <img class="avatar" alt="" width="72" height="72" draggable="false" />
        <span class="dealer-btn" title="庄家" hidden>D</span>
      </div>
      <div class="plate">
        <div class="player-name">
          <span class="player-name-text"></span>
        </div>
        <div class="player-stack"></div>
        <div class="bet-row" hidden>
          <span class="chip-stack" aria-hidden="true">
            <i></i><i></i><i></i><i></i>
          </span>
          <span class="player-bet"></span>
        </div>
        <div class="player-action"></div>
        <div class="hand-tag"></div>
      </div>
    </div>
  `;

  cache = {
    cards: el.querySelector('.seat-cards'),
    avatar: el.querySelector('.avatar'),
    name: el.querySelector('.player-name-text'),
    dealer: el.querySelector('.dealer-btn'),
    stack: el.querySelector('.player-stack'),
    betRow: el.querySelector('.bet-row'),
    bet: el.querySelector('.player-bet'),
    chipStack: el.querySelector('.chip-stack'),
    action: el.querySelector('.player-action'),
    hand: el.querySelector('.hand-tag'),
    cardEls: [],
    cardKeys: [],
    avatarKey: '',
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
  if (player.isHero) classes.push('is-hero');
  const nextClass = classes.join(' ');
  if (el.className !== nextClass) el.className = nextClass;

  syncCards(cache.cards, cache, player.cards);

  const avatarKey = player.avatar || 'hero';
  if (cache.avatarKey !== avatarKey) {
    cache.avatarKey = avatarKey;
    cache.avatar.src = `assets/avatar-${avatarKey}.png`;
  }

  if (cache.name.textContent !== player.name) cache.name.textContent = player.name;
  if (cache.dealer.hidden === !!player.isButton) cache.dealer.hidden = !player.isButton;

  const stackText = formatChips(player.stack);
  if (cache.stack.textContent !== stackText) cache.stack.textContent = stackText;

  const hasBet = player.bet > 0;
  if (cache.betRow.hidden === hasBet) cache.betRow.hidden = !hasBet;
  if (hasBet) {
    const betText = formatChips(player.bet);
    if (cache.bet.textContent !== betText) cache.bet.textContent = betText;
    const chips = Math.min(4, Math.max(1, Math.ceil(player.bet / 50)));
    cache.chipStack.dataset.tier = String(chips);
  }

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

    const node = card ? buildCardEl(card, { board: true }) : document.createElement('div');
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
    raiseAmountEl.min = String(sliderMin);
    raiseAmountEl.max = String(sliderMax);
    raiseTarget = Math.min(sliderMax, Math.max(sliderMin, sliderMin));
    raiseSlider.value = String(raiseTarget);
    raiseAmountEl.value = String(raiseTarget);
    raiseRow.hidden = false;

    raiseBtn.addEventListener('click', () => {
      const amount = clampRaise(Number(raiseAmountEl.value));
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
  const primary = state.phase === 'handover' && state.winners?.length ? state.winners[0] : null;
  const cardsKey = primary?.bestCards?.map((c) => c.id).join(',') || '';
  const key = primary
    ? `${primary.id}:${primary.amount}:${primary.handName || ''}:${cardsKey}`
    : '';

  if (key === winBannerKey) return;
  winBannerKey = key;
  winBannerSlot.innerHTML = '';
  if (!primary) return;

  const wrap = document.createElement('div');
  wrap.className = 'win-panel';

  const label = primary.handName
    ? `${primary.name} · ${primary.handName} +${formatChips(primary.amount)}`
    : `${primary.name} +${formatChips(primary.amount)}`;
  const title = document.createElement('div');
  title.className = 'win-banner';
  title.textContent = label;
  wrap.appendChild(title);

  const best = primary.bestCards || [];
  if (best.length >= 5) {
    const row = document.createElement('div');
    row.className = 'win-cards';
    row.setAttribute('aria-label', '获胜五张牌');
    for (const c of best) {
      row.appendChild(buildCardEl(c, { board: false }));
    }
    wrap.appendChild(row);
  }

  winBannerSlot.appendChild(wrap);
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

function clampRaise(n) {
  const min = Number(raiseSlider.min) || 0;
  const max = Number(raiseSlider.max) || 0;
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function syncRaiseFromSlider() {
  raiseTarget = clampRaise(Number(raiseSlider.value));
  raiseSlider.value = String(raiseTarget);
  raiseAmountEl.value = String(raiseTarget);
}

function syncRaiseFromInput() {
  raiseTarget = clampRaise(Number(raiseAmountEl.value));
  raiseSlider.value = String(raiseTarget);
  raiseAmountEl.value = String(raiseTarget);
}

raiseSlider.addEventListener('input', syncRaiseFromSlider);

raiseAmountEl.addEventListener('input', () => {
  // live-clamp typed value without fighting the caret too hard
  const raw = Number(raiseAmountEl.value);
  if (raiseAmountEl.value === '' || Number.isNaN(raw)) return;
  raiseTarget = clampRaise(raw);
  raiseSlider.value = String(raiseTarget);
});

raiseAmountEl.addEventListener('change', syncRaiseFromInput);
raiseAmountEl.addEventListener('blur', syncRaiseFromInput);

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
  // Don't steal keys while typing a raise amount
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
    return;
  }
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
