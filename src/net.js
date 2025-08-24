import { SERVER_HOST } from './config.js';

let ws = null;
const handlers = [];
let pingTimer = null;

function emit(msg) { for (const h of handlers) { try { h(msg); } catch {} } }

export function connect(code) {
  const url = `${SERVER_HOST.replace(/^http/, 'ws')}/ws?code=${code}`;
  ws = new WebSocket(url);
  ws.onopen = () => {
    startPing();
    emit({ type: 'open' });
  };
  ws.onmessage = ev => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    emit(data);
  };
  ws.onclose = () => {
    stopPing();
    emit({ type: 'disconnect' });
    alert('Verbindung getrennt');
  };
  ws.onerror = () => {};
}

function startPing() {
  stopPing();
  pingTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 15000);
}

function stopPing() {
  if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
}

export function sendMove(col) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'move', col }));
  }
}

export function sendReset() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'reset' }));
  }
}

export function sendReady(player) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ready', player }));
  }
}

export function onMessage(fn) { if (typeof fn === 'function') handlers.push(fn); }
