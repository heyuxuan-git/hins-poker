/**
 * hin's poker — realtime room server (host-authoritative relay)
 * Run: node server/index.js
 * Env: PORT (default 8787)
 */
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = Number(process.env.PORT || 8787);

/** code -> { host: ws|null, members: Map<ws, {name, seat, isHost}> } */
const rooms = new Map();

function code() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function freeSeat(room) {
  const used = new Set();
  for (const m of room.members.values()) used.add(m.seat);
  for (let i = 0; i < 6; i++) if (!used.has(i)) return i;
  return -1;
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, except) {
  for (const ws of room.members.keys()) {
    if (ws !== except) send(ws, msg);
  }
}

function roster(room) {
  return [...room.members.values()].map((m) => ({
    name: m.name,
    seat: m.seat,
    isHost: m.isHost,
  }));
}

function cleanup(ws) {
  for (const [codeKey, room] of rooms) {
    if (!room.members.has(ws)) continue;
    const meta = room.members.get(ws);
    room.members.delete(ws);
    broadcast(room, { type: 'player_leave', seat: meta.seat, roster: roster(room) });
    if (meta.isHost || room.members.size === 0) {
      rooms.delete(codeKey);
      broadcast(room, { type: 'room_closed' });
    }
    break;
  }
}

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('hin poker ws server\n');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (msg.type === 'create') {
      let roomCode = code();
      while (rooms.has(roomCode)) roomCode = code();
      const room = { host: ws, members: new Map() };
      room.members.set(ws, { name: msg.name || '房主', seat: 0, isHost: true });
      rooms.set(roomCode, room);
      send(ws, {
        type: 'created',
        code: roomCode,
        seat: 0,
        isHost: true,
        roster: roster(room),
      });
      return;
    }

    if (msg.type === 'join') {
      const room = rooms.get(msg.code);
      if (!room) {
        send(ws, { type: 'error', message: '房间不存在或已结束' });
        return;
      }
      if (room.members.size >= 6) {
        send(ws, { type: 'error', message: '房间已满' });
        return;
      }
      const seat = freeSeat(room);
      if (seat < 0) {
        send(ws, { type: 'error', message: '没有空位' });
        return;
      }
      room.members.set(ws, { name: msg.name || `玩家${seat + 1}`, seat, isHost: false });
      send(ws, {
        type: 'joined',
        code: msg.code,
        seat,
        isHost: false,
        roster: roster(room),
      });
      broadcast(room, { type: 'player_join', seat, name: msg.name, roster: roster(room) }, ws);
      // Ask host to sync current state to the new player
      send(room.host, { type: 'need_sync', seat });
      return;
    }

    if (msg.type === 'state') {
      // host -> server -> target guest(s)
      const room = rooms.get(msg.code);
      if (!room || room.host !== ws) return;
      if (msg.toSeat != null) {
        for (const [sock, m] of room.members) {
          if (m.seat === msg.toSeat && !m.isHost) {
            send(sock, { type: 'state', state: msg.state, toSeat: msg.toSeat });
          }
        }
      } else {
        broadcast(room, { type: 'state', state: msg.state }, ws);
      }
      return;
    }

    if (msg.type === 'action') {
      // guest -> host
      const room = rooms.get(msg.code);
      if (!room) return;
      const meta = room.members.get(ws);
      if (!meta) return;
      send(room.host, { type: 'action', seat: meta.seat, action: msg.action });
      return;
    }

    if (msg.type === 'start' || msg.type === 'reset') {
      const room = rooms.get(msg.code);
      if (!room || room.host !== ws) return;
      broadcast(room, { type: msg.type });
      return;
    }

    if (msg.type === 'kick_ai') {
      const room = rooms.get(msg.code);
      if (!room || room.host !== ws) return;
      broadcast(room, { type: 'kick_ai', seat: msg.seat });
      return;
    }
  });

  ws.on('close', () => cleanup(ws));
  ws.on('error', () => cleanup(ws));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

httpServer.listen(PORT, () => {
  console.log(`hin poker ws listening on :${PORT}`);
});
