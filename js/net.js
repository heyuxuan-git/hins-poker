/**
 * Multiplayer client — host-authoritative over WebSocket.
 * Host runs PokerGame; empty seats auto-filled with AI.
 */

const AI_NAMES = ['阿凯', '林姐', '老周', '小美', '陈哥'];
const AI_AVATARS = ['kai', 'lin', 'zhou', 'mei', 'chen'];
const AI_PERSONAS = ['aggressive', 'tight', 'balanced', 'maniac', 'tight'];
const AI_AVATARS_POOL = ['kai', 'lin', 'zhou', 'mei', 'chen', 'hero'];

export function defaultWsUrl() {
  const q = new URLSearchParams(location.search).get('ws');
  if (q) return q;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Prefer same-origin /ws when reverse-proxied; else local server
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return `${proto}//${location.hostname}:8787`;
  }
  return `${proto}//${location.host}/ws`;
}

export class NetClient {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage || (() => {});
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.code = null;
    this.seat = null;
    this.isHost = false;
    this.roster = [];
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }
      const t = setTimeout(() => reject(new Error('连接超时')), 8000);
      this.ws.onopen = () => {
        clearTimeout(t);
        this.onStatus('connected');
        resolve();
      };
      this.ws.onerror = () => {
        clearTimeout(t);
        reject(new Error('无法连接联机服务器'));
      };
      this.ws.onclose = () => {
        this.onStatus('closed');
        this.onMessage({ type: 'disconnected' });
      };
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.roster) this.roster = msg.roster;
          if (msg.type === 'created') {
            this.code = msg.code;
            this.seat = msg.seat;
            this.isHost = true;
          }
          if (msg.type === 'joined') {
            this.code = msg.code;
            this.seat = msg.seat;
            this.isHost = false;
          }
          this.onMessage(msg);
        } catch {
          /* ignore */
        }
      };
    });
  }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  create(name, avatar) {
    this.send({ type: 'create', name, avatar });
  }

  join(code, name, avatar) {
    this.send({ type: 'join', code: String(code || '').toUpperCase(), name, avatar });
  }

  sendAction(action) {
    if (!this.code) return;
    this.send({ type: 'action', code: this.code, action });
  }

  sendState(state) {
    if (!this.code || !this.isHost) return;
    this.send({ type: 'state', state, code: this.code });
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.code = null;
    this.seat = null;
    this.isHost = false;
  }
}

/**
 * Build a 6-seat roster: humans from room; empty seats stay empty
 * until startHand fills them with AI.
 */
export function buildSeatPlan(roster, mySeat) {
  const bySeat = new Map();
  for (const r of roster || []) bySeat.set(r.seat, r);

  const seats = [];
  for (let i = 0; i < 6; i++) {
    const human = bySeat.get(i);
    if (human) {
      seats.push({
        kind: 'human',
        id: i,
        name: human.name || (i === mySeat ? '你' : `玩家${i + 1}`),
        isHero: i === mySeat,
        avatar: human.avatar || (i === mySeat ? 'hero' : AI_AVATARS_POOL[i % AI_AVATARS_POOL.length]),
        empty: false,
      });
    } else {
      seats.push({
        kind: 'empty',
        id: i,
        name: '空位',
        isHero: false,
        avatar: null,
        empty: true,
      });
    }
  }
  return seats;
}

export const AVATAR_CHOICES = [
  { id: 'hero', label: '我' },
  { id: 'chen', label: '陈哥' },
  { id: 'mei', label: '小美' },
  { id: 'zhou', label: '老周' },
  { id: 'lin', label: '林姐' },
  { id: 'kai', label: '阿凯' },
];
