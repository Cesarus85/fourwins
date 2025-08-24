# FourWins Multiplayer Server

## Schnellstart

### Option 1: Mit Reverse Proxy (empfohlen für HTTPS)

1. Node.js Server auf Port 3000 starten:
```bash
cd server
npm install
npm start
```

2. Nginx/Apache als Reverse Proxy konfigurieren (siehe `nginx-proxy.conf`)

### Option 2: Direkter HTTPS-Server

1. SSL-Zertifikate in `server/ssl/` ablegen:
   - `cert.pem` (Zertifikat)
   - `key.pem` (Private Key)

2. Server mit HTTPS starten:
```bash
cd server
npm install
USE_HTTPS=true SSL_CERT=./ssl/cert.pem SSL_KEY=./ssl/key.pem npm start
```

### Option 3: Development (HTTP)

```bash
cd server
npm install
npm run dev
```

## Umgebungsvariablen

- `NODE_ENV`: production/development
- `PORT`: Server Port (Standard: 443 in production, 3000 in development)
- `USE_HTTPS`: 'true' für HTTPS
- `SSL_CERT`: Pfad zum SSL-Zertifikat
- `SSL_KEY`: Pfad zum SSL-Key

## Deployment

Für sportaktivfitness.de:
1. Node.js Server auf internem Port starten (z.B. 3000)
2. Webserver (Nginx/Apache) als Reverse Proxy für HTTPS
3. Statische Dateien (HTML/CSS/JS) vom Webserver servieren
4. API (`/room`) und WebSocket (`/ws`) an Node.js weiterleiten