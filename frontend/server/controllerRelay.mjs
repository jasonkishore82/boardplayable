// Phone-as-controller relay for the gyro games (Free Fly, Free Flight, Cricket nets). Development only (`vite` / `npm run dev`).
//
// Phones only share motion sensors with secure (https) pages, but the app itself runs on plain http, so the relay
// listens on two extra ports:
//
//   PHONE_PORT (https, self-signed)  the controller pages (/controller/<game>.html) and the phones' WebSocket
//   GAME_PORT  (http)                the games' WebSocket, plus /info and /qr for the QR code on the game's menu
//
//   phone --tilt/action--> relay --> game        game --state/haptic/calibrate--> relay --> phone
//
// Each game screen picks a 4-character room code; the QR code carries it, and the relay only connects a phone to the
// game showing the same code. A second phone joining a room takes over from the first.
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import selfsigned from 'selfsigned';
import { WebSocketServer } from 'ws';

export const PHONE_PORT = 5180;
export const GAME_PORT = 5181;
const WS_PATH = '/gyro-ws';
const ROOM_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
const GAMES = new Set(['free-fly', 'free-flight', 'cricket']);

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTROLLERS_DIR = path.join(here, '..', 'controllers');
const CERT_DIR = path.join(here, '..', '.cert');

function lanIPs() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.') && !/vEthernet|WSL|VirtualBox|VMware|Hyper-V/i.test(name)) {
        out.push(a.address);
      }
    }
  }
  // Home/office Wi-Fi ranges first (what a phone can reach); VPN ranges (e.g. Tailscale 100.64/10) last.
  const rank = (ip) => (/^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return out.sort((a, b) => rank(a) - rank(b));
}

// Self-signed certificate for this computer's addresses, regenerated when they change. Kept in .cert/ (git-ignored).
function getCert(ips) {
  const keyFile = path.join(CERT_DIR, 'key.pem');
  const certFile = path.join(CERT_DIR, 'cert.pem');
  const ipFile = path.join(CERT_DIR, 'ips.txt');
  const sig = ips.join(',');
  if (fs.existsSync(keyFile) && fs.existsSync(certFile) && fs.existsSync(ipFile) && fs.readFileSync(ipFile, 'utf8') === sig) {
    return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
  }
  const altNames = [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }, ...ips.map((ip) => ({ type: 7, ip }))];
  const pems = selfsigned.generate([{ name: 'commonName', value: 'boardplayable-controller.local' }], {
    days: 825,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames }],
  });
  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(keyFile, pems.private);
  fs.writeFileSync(certFile, pems.cert);
  fs.writeFileSync(ipFile, sig);
  return { key: pems.private, cert: pems.cert };
}

const phoneUrl = (ip, game, room) => `https://${ip}:${PHONE_PORT}/controller/${game}.html${room ? `?room=${room}` : ''}`;

/** The relay itself: one set of sockets shared by both servers, grouped by room code. */
function createRelay() {
  const wss = new WebSocketServer({ noServer: true });
  const inRoom = (room) => [...wss.clients].filter((c) => c.room === room && c.readyState === 1);
  const broadcastStatus = (room) => {
    if (!room) return;
    const members = inRoom(room);
    const msg = JSON.stringify({
      type: 'status',
      phones: members.filter((c) => c.role === 'phone').length,
      games: members.filter((c) => c.role === 'game').length,
    });
    for (const c of members) c.send(msg);
  };

  wss.on('connection', (ws, req, side) => {
    ws.role = 'unknown';
    ws.room = null;
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    const who = req.socket.remoteAddress;
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.type === 'hello') {
        const room = String(msg.room || '').toUpperCase();
        if (!ROOM_RE.test(room)) {
          ws.send(JSON.stringify({ type: 'error', reason: 'bad-code' }));
          return;
        }
        // A socket on the game port is always a game, one on the phone port always a phone.
        const role = side === 'game' ? 'game' : 'phone';
        if (role === 'phone') {
          for (const c of inRoom(room)) {
            if (c.role === 'phone' && c !== ws) {
              c.send(JSON.stringify({ type: 'kicked' }));
              c.role = 'unknown';
              c.room = null;
            }
          }
        }
        ws.role = role;
        ws.room = room;
        console.log(`  [controller] ${role} joined ${room} from ${who}`);
        ws.send(JSON.stringify({ type: 'joined', room, games: inRoom(room).filter((c) => c.role === 'game').length }));
        broadcastStatus(room);
        return;
      }
      const to = ws.role === 'phone' ? 'game' : ws.role === 'game' ? 'phone' : null;
      if (!to) return;
      const out = JSON.stringify(msg);
      for (const c of inRoom(ws.room)) if (c.role === to) c.send(out);
    });
    ws.on('close', () => {
      if (ws.role !== 'unknown') console.log(`  [controller] ${ws.role} left ${ws.room} (${who})`);
      broadcastStatus(ws.room);
    });
  });

  // Drop sockets that stopped answering (phone locked, tab closed, Wi-Fi lost), so a game never shows a phone that
  // isn't really there.
  const beat = setInterval(() => {
    for (const c of wss.clients) {
      if (!c.alive) { c.terminate(); continue; }
      c.alive = false;
      if (c.readyState === 1) c.ping();
    }
  }, 5000);

  const attach = (server, side) => {
    server.on('upgrade', (req, socket, head) => {
      if ((req.url || '').split('?')[0] !== WS_PATH) { socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, side));
    });
  };
  const close = () => { clearInterval(beat); for (const c of wss.clients) c.terminate(); wss.close(); };
  return { attach, close };
}

export default function controllerRelay() {
  let servers = [];
  let relay = null;

  return {
    name: 'boardplayable-controller-relay',
    apply: 'serve',
    configureServer(server) {
      // Vitest runs Vite in serve mode too; tests must not open ports (or clash with a running dev server).
      if (process.env.VITEST) return;
      const ips = lanIPs();
      const cert = getCert(ips);
      relay = createRelay();

      // Phones: controller pages + their WebSocket, over https.
      const phone = https.createServer(cert, (req, res) => {
        const url = new URL(req.url || '/', 'https://x');
        const m = url.pathname.match(/^\/controller\/([a-z-]+)\.html$/);
        if (m && GAMES.has(m[1])) {
          const file = path.join(CONTROLLERS_DIR, `${m[1]}.html`);
          fs.readFile(file, (err, data) => {
            if (err) { res.statusCode = 404; res.end('Not found'); return; }
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.setHeader('cache-control', 'no-store');
            res.end(data);
          });
          return;
        }
        res.statusCode = 404;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end('Board Playable phone controller. Scan the QR code on a game\'s menu to open one.');
      });

      // Games: their WebSocket, plus the info and QR code the menu shows. Plain http, like the app.
      const game = http.createServer((req, res) => {
        const url = new URL(req.url || '/', 'http://x');
        res.setHeader('access-control-allow-origin', '*');
        res.setHeader('cache-control', 'no-store');
        const gameId = url.searchParams.get('game') || '';
        const room = String(url.searchParams.get('room') || '').toUpperCase();
        if (url.pathname === '/info') {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ips, phonePort: PHONE_PORT }));
          return;
        }
        if (url.pathname === '/qr') {
          // Only ever encodes our own controller URL: a known game, a valid code and one of this computer's addresses.
          const ip = ips[Number(url.searchParams.get('i')) || 0];
          if (!ip || !GAMES.has(gameId) || !ROOM_RE.test(room)) { res.statusCode = 404; res.end(); return; }
          QRCode.toString(phoneUrl(ip, gameId, room), { type: 'svg', margin: 1, color: { dark: '#000000', light: '#ffffff' } })
            .then((svg) => { res.setHeader('content-type', 'image/svg+xml'); res.end(svg); })
            .catch(() => { res.statusCode = 500; res.end(); });
          return;
        }
        res.statusCode = 404;
        res.end();
      });

      relay.attach(phone, 'phone');
      relay.attach(game, 'game');
      // When Vite restarts (e.g. after a config change) the old relay may still hold the ports for a moment, so a busy
      // port is retried for a few seconds before giving up.
      const listen = (srv, port, label, tries = 20) => {
        srv.once('error', (err) => {
          if (err.code === 'EADDRINUSE' && tries > 0) {
            setTimeout(() => listen(srv, port, label, tries - 1), 300);
            return;
          }
          console.log(`  [controller] ${label} port ${port} unavailable (${err.code}); phone controllers are off.`);
        });
        srv.listen(port, '0.0.0.0');
      };
      listen(phone, PHONE_PORT, 'phone');
      listen(game, GAME_PORT, 'game');
      servers = [phone, game];

      server.httpServer?.once('listening', () => {
        setTimeout(() => {
          console.log('\n  Phone controllers (Free Fly, Free Flight, Cricket nets): scan the QR code on the game\'s menu.');
          for (const ip of ips) console.log(`  Controller pages:  https://${ip}:${PHONE_PORT}/controller/<game>.html`);
          console.log('  Self-signed certificate: on the phone choose "Advanced" / "Show Details" and continue.\n');
        }, 50);
      });
      server.httpServer?.once('close', () => {
        relay?.close();
        for (const s of servers) s.close();
      });
    },
  };
}
