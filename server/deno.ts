/**
 * hin's poker room server — Deno Deploy / Deno runtime
 * Deploy: https://dash.deno.com  (free, no credit card)
 * Local:  deno run --allow-net server/deno.ts
 */
type Member = {
  name: string;
  seat: number;
  isHost: boolean;
  socket: WebSocket;
};

type Room = {
  host: WebSocket | null;
  members: Map<WebSocket, Member>;
};

const rooms = new Map<string, Room>();

function roomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function freeSeat(room: Room): number {
  const used = new Set<number>();
  for (const m of room.members.values()) used.add(m.seat);
  for (let i = 0; i < 6; i++) if (!used.has(i)) return i;
  return -1;
}

function send(ws: WebSocket, msg: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room: Room, msg: unknown, except?: WebSocket) {
  for (const ws of room.members.keys()) {
    if (ws !== except) send(ws, msg);
  }
}

function roster(room: Room) {
  return [...room.members.values()].map((m) => ({
    name: m.name,
    seat: m.seat,
    isHost: m.isHost,
  }));
}

function cleanup(ws: WebSocket) {
  for (const [code, room] of rooms) {
    if (!room.members.has(ws)) continue;
    const meta = room.members.get(ws)!;
    room.members.delete(ws);
    broadcast(room, { type: 'player_leave', seat: meta.seat, roster: roster(room) });
    if (meta.isHost || room.members.size === 0) {
      rooms.delete(code);
      broadcast(room, { type: 'room_closed' });
    }
    break;
  }
}

function handle(ws: WebSocket) {
  ws.addEventListener('message', (ev) => {
    let msg: any;
    try {
      msg = JSON.parse(String(ev.data));
    } catch {
      return;
    }

    if (msg.type === 'create') {
      let code = roomCode();
      while (rooms.has(code)) code = roomCode();
      const room: Room = { host: ws, members: new Map() };
      room.members.set(ws, { name: msg.name || '房主', seat: 0, isHost: true, socket: ws });
      rooms.set(code, room);
      send(ws, {
        type: 'created',
        code,
        seat: 0,
        isHost: true,
        roster: roster(room),
      });
      return;
    }

    if (msg.type === 'join') {
      const room = rooms.get(String(msg.code || '').toUpperCase());
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
      room.members.set(ws, {
        name: msg.name || `玩家${seat + 1}`,
        seat,
        isHost: false,
        socket: ws,
      });
      send(ws, {
        type: 'joined',
        code: msg.code,
        seat,
        isHost: false,
        roster: roster(room),
      });
      broadcast(room, { type: 'player_join', seat, name: msg.name, roster: roster(room) }, ws);
      if (room.host) send(room.host, { type: 'need_sync', seat });
      return;
    }

    if (msg.type === 'state') {
      const room = rooms.get(msg.code);
      if (!room || room.host !== ws) return;
      if (msg.toSeat != null) {
        for (const m of room.members.values()) {
          if (m.seat === msg.toSeat && !m.isHost) {
            send(m.socket, { type: 'state', state: msg.state, toSeat: msg.toSeat });
          }
        }
      } else {
        broadcast(room, { type: 'state', state: msg.state }, ws);
      }
      return;
    }

    if (msg.type === 'action') {
      const room = rooms.get(msg.code);
      if (!room) return;
      const meta = room.members.get(ws);
      if (!meta) return;
      if (room.host) {
        send(room.host, { type: 'action', seat: meta.seat, action: msg.action });
      }
      return;
    }

    if (msg.type === 'start' || msg.type === 'reset') {
      const room = rooms.get(msg.code);
      if (!room || room.host !== ws) return;
      broadcast(room, { type: msg.type });
      return;
    }
  });

  ws.addEventListener('close', () => cleanup(ws));
  ws.addEventListener('error', () => cleanup(ws));
}

Deno.serve((req) => {
  const url = new URL(req.url);
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({ ok: true, rooms: rooms.size }), {
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }
  if (url.pathname === '/ws' || req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
    const { socket, response } = Deno.upgradeWebSocket(req);
    handle(socket);
    return response;
  }
  return new Response('hin poker ws (deno)\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
});
