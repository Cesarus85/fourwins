#!/usr/bin/env node

// Einfacher Starter für den Multiplayer-Server
// Unterstützt sowohl HTTP als auch HTTPS je nach Umgebung

const path = require('path');
const fs = require('fs');

// Umgebungsvariablen setzen falls nicht vorhanden
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Port automatisch erkennen
if (!process.env.PORT) {
  if (process.env.NODE_ENV === 'production') {
    // In Production: Standard HTTPS Port oder von Hosting-Provider gesetzt
    process.env.PORT = process.env.PORT || '443';
  } else {
    // Development: Port 3000
    process.env.PORT = '3000';
  }
}

console.log(`Starting FourWins Multiplayer Server...`);
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Port: ${process.env.PORT}`);

// SSL-Zertifikate prüfen (optional)
const sslCert = process.env.SSL_CERT || './ssl/cert.pem';
const sslKey = process.env.SSL_KEY || './ssl/key.pem';

if (fs.existsSync(sslCert) && fs.existsSync(sslKey)) {
  process.env.USE_HTTPS = 'true';
  process.env.SSL_CERT = sslCert;
  process.env.SSL_KEY = sslKey;
  console.log('SSL certificates found - enabling HTTPS');
} else {
  console.log('No SSL certificates found - using HTTP');
  console.log('For HTTPS: set SSL_CERT and SSL_KEY environment variables');
}

// Server starten
require('./index.js');