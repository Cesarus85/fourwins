const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const rooms = {};
const ROOM_TTL_MS = 1000 * 60 * 30; // 30 minutes

function createBoardState(rows = 6, cols = 7) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function generateCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[code]);
  return code;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.post('/room', (_req, res) => {
  const code = generateCode();
  rooms[code] = {
    players: [],
    boardState: createBoardState(),
    timeout: setTimeout(() => delete rooms[code], ROOM_TTL_MS)
  };
  res.json({ code });
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }
  const code = url.searchParams.get('code');
  const room = rooms[code];
  if (!room) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit('connection', ws, room, code);
  });
});

wss.on('connection', (ws, room, code) => {
  if (room.players.length >= 2) {
    ws.close();
    return;
  }
  room.players.push(ws);
  const playerNum = room.players.length;
  ws.send(JSON.stringify({ type: 'join', player: playerNum }));

  if (room.players.length === 2) {
    room.players.forEach(p => {
      if (p.readyState === p.OPEN) p.send(JSON.stringify({ type: 'start' }));
    });
  }

  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }
    if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }
    room.players.forEach(p => {
      if (p !== ws && p.readyState === p.OPEN) p.send(msg);
    });
  });

  ws.on('close', () => {
    room.players = room.players.filter(p => p !== ws);
    if (room.players.length === 0) {
      clearTimeout(room.timeout);
      delete rooms[code];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
