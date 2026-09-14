import { PokerGame } from './game.js';
import { cardDisplay } from './deck.js';

const seatIds = {
  bottom: document.getElementById('seat-bottom'),
  left: document.getElementById('seat-left'),
  top: document.getElementById('seat-top'),
  right: document.getElementById('seat-right'),
};

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

function formatChips(n) {
  return Number(n).toLocaleString('zh-CN');
}

function renderCard(card, { small = false } = {}) {
  if (!card) return '';
  if (card.hidden) {
    return '<div class="pcard back" aria-label="暗牌"></div>';
  }
  const d = cardDisplay(card);
  return `
    <div class="pcard ${d.isRed ? 'red' : ''}" aria-label="${d.rank}${d.suit}">
      <div class="corner"><span>${d.rank}</span><span>${d.suit}</span></div>
      <div class="center">${d.suit}</div>
    </div>
  `;
}

function renderBoard(community) {
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const c = community[i];
    if (c) {
      slots.push(renderCard(c));
    } else {
      slots.push('<div class="card-slot"></div>');
    }
  }
  boardEl.innerHTML = slots.join('');
}

function renderSeat(el, player, state) {
  if (!el) return;
  const cardsHtml = (player.cards || []).map((c) => renderCard(c)).join('');
  const isWinner = (state.winners || []).some((w) => w.id === player.id);
  const classes = ['seat'];
  // keep layout class from DOM
  const layout = el.dataset.seat;
  if (layout) classes.push(layout);
  if (player.folded) classes.push('folded');
  if (player.isCurrent) classes.push('current');
  if (isWinner) classes.push('winner');

  el.className = classes.join(' ');
  el.innerHTML = `
    <div class="seat-cards">${cardsHtml}</div>
    <div class="player-chip">
      <div class="player-name">
        ${player.isButton ? '<span class="dealer-btn" title="庄家">D</span>' : ''}
        <span>${player.name}</span>
      </div>
      <div class="player-stack">${formatChips(player.stack)}</div>
      <div class="player-bet">${player.bet > 0 ? `下注 ${formatChips(player.bet)}` : ''}</div>
      <div class="player-action">${player.lastAction || ''}</div>
      ${player.handName ? `<div class="hand-tag">${player.handName}</div>` : ''}
    </div>
  `;
}

function renderActions(state) {
  actionsEl.innerHTML = '';
  raiseRow.hidden = true;

  const idle = state.phase === 'idle';
  const handover = state.phase === 'handover';

  if (idle) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn btn-start';
    btn.textContent = '发牌 · 开始新局';
    btn.addEventListener('click', () => game.startHand());
    actionsEl.appendChild(btn);
    return;
  }

  if (handover) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-btn btn-start';
    btn.textContent = '下一局';
    btn.addEventListener('click', () => game.startHand());
    actionsEl.appendChild(btn);
    return;
  }

  if (!state.heroTurn) {
    const wait = document.createElement('div');
    wait.className = 'waiting';
    wait.textContent =
      state.phase === 'showdown' ? '摊牌中…' : '等待对手行动…';
    actionsEl.appendChild(wait);
    return;
  }

  const toCall = state.toCall || 0;
  const hero = state.players[0];
  const canCheck = toCall === 0;

  // Fold
  const fold = document.createElement('button');
  fold.type = 'button';
  fold.className = 'action-btn btn-fold';
  fold.textContent = '弃牌';
  fold.addEventListener('click', () => game.actHero({ type: 'fold' }));
  actionsEl.appendChild(fold);

  // Check / Call
  const checkCall = document.createElement('button');
  checkCall.type = 'button';
  checkCall.className = 'action-btn btn-check';
  if (canCheck) {
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

  // Raise
  const minTo = state.minRaiseTo || 0;
  const maxTo = state.maxRaiseTo || 0;
  const canRaise = maxTo > (state.currentBet || 0) && hero.stack > toCall;

  const raiseBtn = document.createElement('button');
  raiseBtn.type = 'button';
  raiseBtn.className = 'action-btn btn-raise';
  raiseBtn.textContent = canRaise ? '加注' : '加注（不可）';
  raiseBtn.disabled = !canRaise;

  if (canRaise) {
    const min = Math.max(minTo, toCall + hero.bet + game.bigBlind);
    // minRaiseTo is absolute bet-to amount including already posted
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

  // All-in quick button if stack is the interesting move
  if (hero.stack > 0 && hero.stack > toCall) {
    const allIn = document.createElement('button');
    allIn.type = 'button';
    allIn.className = 'action-btn btn-fold';
    allIn.style.background = 'linear-gradient(180deg, #5a2a1c, #3a1810)';
    allIn.style.borderColor = 'rgba(255,120,80,0.35)';
    allIn.style.color = '#ffd0c0';
    allIn.textContent = `全下 ${formatChips(hero.stack)}`;
    allIn.addEventListener('click', () => game.actHero({ type: 'allin', amount: hero.stack }));
    actionsEl.appendChild(allIn);
  }
}

function renderWinBanner(state) {
  winBannerSlot.innerHTML = '';
  if (state.phase !== 'handover' || !state.winners?.length) return;
  const w = state.winners[0];
  const label = w.handName ? `${w.name} · ${w.handName} +${formatChips(w.amount)}` : `${w.name} +${formatChips(w.amount)}`;
  const div = document.createElement('div');
  div.className = 'win-banner';
  div.textContent = label;
  winBannerSlot.appendChild(div);
}

function render(state) {
  lastState = state;
  potAmountEl.textContent = formatChips(state.pot);
  handNumEl.textContent = state.handNumber > 0 ? String(state.handNumber) : '—';
  toastEl.textContent = state.message || '';

  renderBoard(state.community || []);

  for (const p of state.players) {
    renderSeat(seatIds[p.seat], p, state);
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
  game.resetTournament();
});

function stateBusy() {
  return lastState && !['idle', 'handover'].includes(lastState.phase);
}

// Keyboard shortcuts
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

game.emit();
