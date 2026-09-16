import { PokerGame } from './game.js';
import { cardDisplay } from './deck.js';
import { NetClient, buildSeatPlan, defaultWsUrl } from './net.js';

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
const actionTimerEl = document.getElementById('action-timer');
const actionTimerNum = document.getElementById('action-timer-num');
const actionTimerFill = document.getElementById('action-timer-fill');
const quickRaisesEl = document.getElementById('quick-raises');

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

/** Display all amounts as big blinds, e.g. 12.5bb */
function formatBb(n, bb) {
  const unit = Number(bb) || 20;
  const v = Number(n) / unit;
  if (!Number.isFinite(v)) return formatChips(n);
  if (Number.isInteger(v)) return `${v}bb`;
  return `${v.toFixed(1)}bb`;
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

  const stackText = formatBb(player.stack, state.bigBlind);
  if (cache.stack.textContent !== stackText) cache.stack.textContent = stackText;

  const hasBet = player.bet > 0;
  if (cache.betRow.hidden === hasBet) cache.betRow.hidden = !hasBet;
  if (hasBet) {
    const betText = formatBb(player.bet, state.bigBlind);
    if (cache.bet.textContent !== betText) cache.bet.textContent = betText;
    const chips = Math.min(4, Math.max(1, Math.ceil(player.bet / 50)));
    cache.chipStack.dataset.tier = String(chips);
  }

  const actionText = (player.lastAction || '').replace(/\s+\d+(\.\d+)?$/, (m) => {
    // convert trailing chip number in action labels to bb when possible
    const n = Number(m.trim());
    if (!Number.isFinite(n) || n <= 0) return m;
    return ` ${formatBb(n, state.bigBlind)}`;
  });
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
  const viewerSeat = state.viewerSeat ?? 0;
  const hero =
    state.players.find((p) => p.isHero) ||
    state.players.find((p) => p.id === viewerSeat) ||
    state.players[0];
  const toCall = state.toCall || 0;
  const isHost = mode !== 'guest';
  const signature = [
    mode,
    state.phase,
    state.heroTurn ? 1 : 0,
    state.phase === 'idle' || state.phase === 'handover' ? (isHost ? 'start' : 'wait') : '',
    state.phase === 'showdown' ? 'showdown' : '',
    state.heroTurn ? (toCall === 0 ? 'check' : `call:${toCall}`) : '',
    state.heroTurn && hero?.stack ? `stack:${hero.stack}` : '',
    state.heroTurn ? `min:${state.minRaiseTo}|max:${state.maxRaiseTo}|cbet:${state.currentBet}` : '',
  ].join('|');

  if (signature === actionsSignature) return;
  actionsSignature = signature;

  actionsEl.innerHTML = '';
  raiseRow.hidden = true;
  actionTimerEl.hidden = true;
  quickRaisesEl.hidden = true;

  const idle = state.phase === 'idle';
  const handover = state.phase === 'handover';

  if (idle || handover) {
    if (!isHost) {
      const wait = document.createElement('div');
      wait.className = 'waiting';
      wait.textContent = idle ? '等待房主发牌…' : '等待房主开始下一局…';
      actionsEl.appendChild(wait);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn btn-start';
    btn.textContent = idle ? '发牌 · 开始新局' : '下一局';
    btn.addEventListener('click', () => doStart());
    actionsEl.appendChild(btn);
    return;
  }

  if (!state.heroTurn) {
    actionTimerEl.hidden = true;
    quickRaisesEl.hidden = true;
    quickRaisesEl.innerHTML = '';
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
  const bb = state.bigBlind || 20;

  const fold = document.createElement('button');
  fold.type = 'button';
  fold.className = 'action-btn btn-fold';
  fold.textContent = '弃牌';
  fold.addEventListener('click', () => doAction({ type: 'fold' }));
  actionsEl.appendChild(fold);

  const checkCall = document.createElement('button');
  checkCall.type = 'button';
  if (canCheck) {
    checkCall.className = 'action-btn btn-check';
    checkCall.textContent = '过牌';
    checkCall.addEventListener('click', () => doAction({ type: 'check' }));
  } else {
    checkCall.className = 'action-btn btn-call';
    const pay = Math.min(toCall, hero.stack);
    checkCall.textContent = `跟注 ${formatBb(pay, bb)}`;
    checkCall.addEventListener('click', () => doAction({ type: 'call' }));
    if (hero.stack <= 0) checkCall.disabled = true;
  }
  actionsEl.appendChild(checkCall);

  const minTo = state.minRaiseTo || 0;
  const maxTo = state.maxRaiseTo || 0;
  const canRaise = maxTo > (state.currentBet || 0) && hero.stack > toCall;

  const raiseBtn = document.createElement('button');
  raiseBtn.type = 'button';
  raiseBtn.className = 'action-btn btn-raise';
  raiseBtn.textContent = canRaise ? `加注 ${formatBb(raiseTarget || minTo, bb)}` : '加注（不可）';
  raiseBtn.disabled = !canRaise;

  if (canRaise) {
    const sliderMin = Math.ceil(Math.min(minTo, maxTo) / CHIP_UNIT) * CHIP_UNIT;
    const sliderMax = Math.floor(maxTo / CHIP_UNIT) * CHIP_UNIT;
    raiseSlider.min = String(sliderMin);
    raiseSlider.max = String(Math.max(sliderMin, sliderMax));
    raiseSlider.step = String(CHIP_UNIT);
    raiseAmountEl.min = String(sliderMin);
    raiseAmountEl.max = String(Math.max(sliderMin, sliderMax));
    raiseAmountEl.step = String(CHIP_UNIT);
    raiseTarget = Math.min(Math.max(sliderMin, sliderMax), sliderMin);
    raiseSlider.value = String(raiseTarget);
    raiseAmountEl.value = String(raiseTarget);
    raiseRow.hidden = false;

    // Quick presets: ½ pot / ⅔ pot / pot / 3bb / min
    const pot = state.pot || 0;
    const presets = [
      { label: '最小加注', amount: minTo },
      { label: '½ pot', amount: state.currentBet + Math.round(pot * 0.5) },
      { label: '⅔ pot', amount: state.currentBet + Math.round(pot * 0.67) },
      { label: '底池', amount: state.currentBet + pot },
      { label: '3bb', amount: state.currentBet + bb * 3 },
      { label: '4bb', amount: state.currentBet + bb * 4 },
    ];
    quickRaisesEl.hidden = false;
    quickRaisesEl.innerHTML = '';
    for (const p of presets) {
      const amount = clampRaise(p.amount);
      if (amount < sliderMin && amount !== sliderMin) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'quick-btn';
      b.textContent = `${p.label} · ${formatBb(amount, bb)}`;
      b.addEventListener('click', () => {
        raiseTarget = clampRaise(amount);
        raiseSlider.value = String(raiseTarget);
        raiseAmountEl.value = String(raiseTarget);
        raiseBtn.textContent = `加注 ${formatBb(raiseTarget, bb)}`;
      });
      quickRaisesEl.appendChild(b);
    }

    raiseBtn.addEventListener('click', () => {
      const amount = clampRaise(Number(raiseAmountEl.value));
      if (amount >= hero.stack + hero.bet) {
        doAction({ type: 'allin', amount: hero.stack });
      } else {
        doAction({ type: 'raise', amount });
      }
    });
  } else {
    quickRaisesEl.hidden = true;
    quickRaisesEl.innerHTML = '';
  }

  actionsEl.appendChild(raiseBtn);

  if (hero.stack > 0 && hero.stack > toCall) {
    const allIn = document.createElement('button');
    allIn.type = 'button';
    allIn.className = 'action-btn btn-allin';
    allIn.textContent = `全下 ${formatBb(hero.stack, bb)}`;
    allIn.addEventListener('click', () => doAction({ type: 'allin', amount: hero.stack }));
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
    ? `${primary.name} · ${primary.handName} +${formatBb(primary.amount, state.bigBlind)}`
    : `${primary.name} +${formatBb(primary.amount, state.bigBlind)}`;
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

function updateActionTimer(state) {
  if (!state.heroTurn || !state.actionDeadline) {
    actionTimerEl.hidden = true;
    return;
  }
  actionTimerEl.hidden = false;
  const left = Math.max(0, state.actionDeadline - Date.now());
  const secs = Math.ceil(left / 1000);
  if (actionTimerNum.textContent !== String(secs)) {
    actionTimerNum.textContent = String(secs);
  }
  const ratio = left / 30000;
  actionTimerFill.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  const urgent = secs <= 8;
  actionTimerNum.classList.toggle('urgent', urgent);
  actionTimerFill.classList.toggle('urgent', urgent);
}

function render(state) {
  lastState = state;

  const potText = formatBb(state.pot, state.bigBlind);
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
  updateActionTimer(state);
}

// Smooth countdown between state emits
setInterval(() => {
  if (lastState) updateActionTimer(lastState);
}, 200);

/* ===== Modes: solo | host | guest ===== */
let mode = 'solo';
let net = null;
let mySeat = 0;
let roomCode = null;
let humanSeats = new Set([0]);
let remoteState = null;

const game = new PokerGame((state) => {
  if (mode === 'guest') {
    // Guests only render host-synced state
    return;
  }
  render(state);
  if (mode === 'host') {
    // Fan-out personalized snapshots to each human
    for (const seat of humanSeats) {
      net?.send({ type: 'state', code: roomCode, state: game.snapshot(seat), toSeat: seat });
    }
    // Host still shows own view via render above
  }
});

function applyRemoteState(state) {
  remoteState = state;
  render(state);
}

function showGame() {
  document.getElementById('lobby').hidden = true;
  document.getElementById('game-app').hidden = false;
}

function showLobby() {
  document.getElementById('lobby').hidden = false;
  document.getElementById('game-app').hidden = true;
  const badge = document.getElementById('room-badge');
  if (badge) badge.hidden = true;
}

function setRoomBadge(code) {
  const badge = document.getElementById('room-badge');
  const el = document.getElementById('room-code');
  if (!badge || !el) return;
  if (!code) {
    badge.hidden = true;
    return;
  }
  badge.hidden = false;
  el.textContent = code;
  el.title = `复制邀请链接（${currentWsUrl()}）`;
}

function doAction(action) {
  if (mode === 'guest') {
    net?.sendAction(action);
    return;
  }
  game.actHero(action);
}

document.getElementById('room-code').addEventListener('click', async () => {
  if (!roomCode) return;
  const url = buildInviteUrl(roomCode);
  try {
    await navigator.clipboard.writeText(url);
    const el = document.getElementById('brand-sub');
    if (el) {
      const prev = el.textContent;
      el.textContent = '邀请链接已复制';
      setTimeout(() => {
        el.textContent = prev;
      }, 1600);
    }
  } catch {
    window.prompt('复制这条邀请链接发给朋友：', url);
  }
});

function doStart() {
  if (mode === 'guest') return; // only host starts
  if (mode === 'host') net?.send({ type: 'start', code: roomCode });
  game.startHand();
}

function enterSolo() {
  mode = 'solo';
  net?.close();
  net = null;
  roomCode = null;
  mySeat = 0;
  humanSeats = new Set([0]);
  game.heroSeat = 0;
  setRoomBadge(null);
  document.getElementById('brand-sub').textContent = "No-Limit Hold'em";
  showGame();
  game.emit();
}

function applySeatPlan(roster) {
  const plan = buildSeatPlan(roster, mySeat);
  humanSeats = new Set(plan.filter((p) => p.kind === 'human').map((p) => p.id));
  const desc = plan.map((p) => ({
    name: p.name,
    isAI: p.kind === 'ai',
    personality: p.personality || null,
    avatar: p.avatar,
  }));
  game.setPlayers(desc, mySeat);
  actionsSignature = '';
  winBannerKey = '';
  game.emit();
}

const CHIP_UNIT = 10;

function clampRaise(n) {
  const min = Number(raiseSlider.min) || 0;
  const max = Number(raiseSlider.max) || 0;
  if (!Number.isFinite(n)) return min;
  // Snap to chip unit (10), then clamp
  const snapped = Math.round(n / CHIP_UNIT) * CHIP_UNIT;
  return Math.min(max, Math.max(min, snapped));
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
  if (mode === 'guest') return;
  actionsSignature = '';
  winBannerKey = '';
  if (mode === 'host') net?.send({ type: 'reset', code: roomCode });
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
  if (k === 'f') doAction({ type: 'fold' });
  if (k === 'c') {
    if (lastState.toCall === 0) doAction({ type: 'check' });
    else doAction({ type: 'call' });
  }
  if (k === 'r') {
    const btn = actionsEl.querySelector('.btn-raise');
    if (btn && !btn.disabled) btn.click();
  }
});

/* ===== Lobby ===== */
const lobbyName = document.getElementById('lobby-name');
const lobbyCodeInput = document.getElementById('lobby-code');
const lobbyWs = document.getElementById('lobby-ws');
const lobbyError = document.getElementById('lobby-error');
const lobbyHint = document.getElementById('lobby-hint');
const lobbyStatus = document.getElementById('lobby-status');
const lobbyInvite = document.getElementById('lobby-invite');
const inviteLinkEl = document.getElementById('invite-link');
const btnLeave = document.getElementById('btn-leave');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const btnSolo = document.getElementById('btn-solo');

let connecting = false;

function lobbyNameVal() {
  return (lobbyName.value || '').trim().slice(0, 12) || null;
}

function saveName(n) {
  try {
    if (n) localStorage.setItem('hins_poker_name', n);
  } catch {
    /* ignore */
  }
}

function currentWsUrl() {
  const raw = ((lobbyWs && lobbyWs.value) || '').trim() || defaultWsUrl();
  let u = raw.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  if (!/\/ws$/i.test(u) && !/localhost|127\.0\.0\.1/.test(u) && /^wss?:\/\/[^/]+$/i.test(u)) {
    u = `${u}/ws`;
  }
  return u;
}

function saveWsUrl(u) {
  try {
    localStorage.setItem('hins_poker_ws', u);
  } catch {
    /* ignore */
  }
}

function showLobbyError(msg) {
  if (!msg) {
    lobbyError.hidden = true;
    lobbyError.textContent = '';
    return;
  }
  lobbyError.hidden = false;
  lobbyError.textContent = msg;
}

function setLobbyStatus(msg) {
  if (!msg) {
    lobbyStatus.hidden = true;
    lobbyStatus.textContent = '';
    return;
  }
  lobbyStatus.hidden = false;
  lobbyStatus.textContent = msg;
}

function setBusy(busy, status) {
  connecting = busy;
  btnCreate.disabled = busy;
  btnJoin.disabled = busy;
  btnSolo.disabled = busy;
  if (busy) setLobbyStatus(status || '连接中…');
  else setLobbyStatus('');
}

/** Accept 6-char code, or paste a full invite URL and extract ws + room */
function parseJoinInput(raw) {
  const s = (raw || '').trim();
  if (!s) return { code: null, ws: null };

  // Full URL invite
  try {
    if (/^https?:\/\//i.test(s) || s.includes('?ws=') || s.includes('#room=')) {
      const url = new URL(s, location.href);
      const ws = url.searchParams.get('ws');
      const m = (url.hash || '').match(/room=([A-Z0-9]{4,8})/i);
      const code = m ? m[1].toUpperCase() : null;
      return { code, ws: ws || null };
    }
  } catch {
    /* fall through */
  }

  // Bare code (allow spaces/dashes)
  const cleaned = s.replace(/[\s-]/g, '').toUpperCase();
  if (/^[A-Z0-9]{4,8}$/.test(cleaned)) {
    return { code: cleaned, ws: null };
  }
  return { code: null, ws: null };
}

function buildInviteUrl(code) {
  const origin = location.origin + location.pathname;
  return `${origin}?ws=${encodeURIComponent(currentWsUrl())}#room=${code}`;
}

function showInvite(code) {
  const url = buildInviteUrl(code);
  lobbyInvite.hidden = false;
  inviteLinkEl.value = url;
  lobbyHint.textContent = `房间 ${code}。把整条链接发给朋友即可自动填好服务器和房间码。`;
}

document.getElementById('btn-copy-invite').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(inviteLinkEl.value);
    lobbyHint.textContent = '邀请链接已复制';
  } catch {
    inviteLinkEl.select();
    lobbyHint.textContent = '请手动全选复制';
  }
});

// Prefill from URL / storage
let autoJoinCode = null;
(() => {
  const q = new URLSearchParams(location.search).get('ws');
  let savedWs = null;
  let savedName = null;
  try {
    savedWs = localStorage.getItem('hins_poker_ws');
    savedName = localStorage.getItem('hins_poker_name');
  } catch {
    /* ignore */
  }
  if (lobbyWs) lobbyWs.value = q || savedWs || defaultWsUrl();
  if (lobbyName && savedName) lobbyName.value = savedName;

  const hash = location.hash || '';
  const m = hash.match(/room=([A-Z0-9]{4,8})/i);
  if (m) {
    autoJoinCode = m[1].toUpperCase();
    if (lobbyCodeInput) lobbyCodeInput.value = autoJoinCode;
  }

  // If user pastes an invite link into the code box, extract parts
  lobbyCodeInput?.addEventListener('change', () => {
    const parsed = parseJoinInput(lobbyCodeInput.value);
    if (parsed.ws && lobbyWs) lobbyWs.value = parsed.ws;
    if (parsed.code) lobbyCodeInput.value = parsed.code;
  });

  lobbyName?.addEventListener('change', () => saveName(lobbyNameVal()));
})();

async function connectAs(role, code) {
  const url = currentWsUrl();
  saveWsUrl(url);
  saveName(lobbyNameVal());
  net = new NetClient({
    onMessage: handleNetMessage,
    onStatus: () => {},
  });
  await net.connect(url);
  mode = role;
  if (role === 'host') net.create(lobbyNameVal() || '房主');
  else net.join(code, lobbyNameVal() || '玩家');
}

btnSolo.addEventListener('click', () => enterSolo());

btnCreate.addEventListener('click', async () => {
  showLobbyError('');
  if (connecting) return;
  setBusy(true, '正在创建房间…');
  try {
    await connectAs('host');
  } catch (err) {
    setBusy(false);
    showLobbyError(err.message || '无法连接联机服务器，请检查服务器地址');
    net = null;
  }
});

btnJoin.addEventListener('click', async () => {
  showLobbyError('');
  if (connecting) return;

  const parsed = parseJoinInput(lobbyCodeInput?.value || '');
  if (parsed.ws && lobbyWs) lobbyWs.value = parsed.ws;
  const code = parsed.code || autoJoinCode;
  if (!code) {
    showLobbyError('请输入 6 位房间码，或粘贴朋友发来的邀请链接');
    lobbyCodeInput?.focus();
    return;
  }
  if (lobbyCodeInput) lobbyCodeInput.value = code;

  setBusy(true, `正在加入房间 ${code}…`);
  try {
    await connectAs('guest', code);
  } catch (err) {
    setBusy(false);
    showLobbyError(err.message || '无法连接联机服务器，请检查服务器地址');
    net = null;
  }
});

// Enter key = join (or create if focused on create fields)
lobbyCodeInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnJoin.click();
  }
});

// Invite link: auto-join
if (autoJoinCode) {
  setLobbyStatus(`检测到邀请，正在加入房间 ${autoJoinCode}…`);
  setTimeout(() => {
    if (mode === 'solo' && !net && !connecting) {
      btnJoin.click();
    }
  }, 250);
}

btnLeave.addEventListener('click', () => {
  net?.close();
  net = null;
  mode = 'solo';
  roomCode = null;
  showLobby();
});

function handleNetMessage(msg) {
  if (msg.type === 'created') {
    setBusy(false);
    roomCode = msg.code;
    mySeat = msg.seat;
    mode = 'host';
    setRoomBadge(roomCode);
    showInvite(roomCode);
    document.getElementById('brand-sub').textContent = `联机 · 房间 ${roomCode}`;
    applySeatPlan(msg.roster);
    showGame();
    return;
  }

  if (msg.type === 'joined') {
    setBusy(false);
    roomCode = msg.code;
    mySeat = msg.seat;
    mode = 'guest';
    setRoomBadge(roomCode);
    document.getElementById('brand-sub').textContent = `联机 · 房间 ${roomCode}`;
    applySeatPlan(msg.roster);
    showGame();
    return;
  }

  if (msg.type === 'player_join' || msg.type === 'player_leave') {
    if (mode === 'host' && (game.phase === 'idle' || game.phase === 'handover')) {
      applySeatPlan(msg.roster);
    }
    return;
  }

  if (msg.type === 'need_sync' && mode === 'host') {
    net?.send({
      type: 'state',
      code: roomCode,
      state: game.snapshot(msg.seat),
      toSeat: msg.seat,
    });
    return;
  }

  if (msg.type === 'state') {
    if (mode === 'guest' && (msg.toSeat == null || msg.toSeat === mySeat)) {
      applyRemoteState(msg.state);
    }
    return;
  }

  if (msg.type === 'action' && mode === 'host') {
    game.actRemote(msg.seat, msg.action);
    return;
  }

  if (msg.type === 'start' && mode === 'guest') {
    // Host will stream state; nothing to run
    return;
  }

  if (msg.type === 'error') {
    setBusy(false);
    // Stay on lobby so user can fix code/server
    if (document.getElementById('game-app')?.hidden === false && mode === 'guest') {
      showLobby();
    }
    showLobbyError(msg.message || '出错了');
    return;
  }

  if (msg.type === 'disconnected' || msg.type === 'room_closed') {
    setBusy(false);
    showLobbyError('连接已断开');
    net = null;
    mode = 'solo';
    showLobby();
  }
}

initBoardSlots();
showLobby();
