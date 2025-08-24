const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();

// WICHTIG: Nur HTTP-Server, HTTPS macht Apache!
const server = http.createServer(app);
console.log('Using HTTP server for local connection');

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

// WICHTIG: Statische Dateien werden von Apache serviert, nicht von Node!
// Entferne diese Zeile oder kommentiere sie aus:
// app.use(express.static(path.join(__dirname, '..')));

// CORS-Header für API-Calls (wichtig!)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://www.sportaktivfitness.de');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.post('/room', (_req, res) => {
    const code = generateCode();
    rooms[code] = {
        players: [],
        ready: [],
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
    room.ready[playerNum - 1] = false;

    ws.send(JSON.stringify({ type: 'join', player: playerNum }));

    ws.on('message', msg => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
        }

        if (data.type === 'ready') {
            const idx = room.players.indexOf(ws);
            room.ready[idx] = true;
            // notify both players who is ready
            room.players.forEach((p, i) => {
                if (p.readyState === p.OPEN) {
                    p.send(JSON.stringify({ type: 'ready', player: idx + 1 }));
                }
            });
            if (room.players.length === 2 && room.ready[0] && room.ready[1]) {
                room.players.forEach(p => {
                    if (p.readyState === p.OPEN) {
                        p.send(JSON.stringify({ type: 'start' }));
                    }
                });
            }
            return;
        }

        room.players.forEach(p => {
            if (p !== ws && p.readyState === p.OPEN) {
                p.send(msg);
            }
        });
    });

    ws.on('close', () => {
        const idx = room.players.indexOf(ws);
        if (idx !== -1) {
            room.players.splice(idx, 1);
            room.ready.splice(idx, 1);
        }
        if (room.players.length === 0) {
            clearTimeout(room.timeout);
            delete rooms[code];
        }
    });
});

// WICHTIG: Immer Port 3000 verwenden, egal ob Production oder nicht!
const PORT = 3000;
server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on port ${PORT} (local only)`);
});