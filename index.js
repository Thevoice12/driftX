/**
 * index.js
 * Express + Socket.IO + Baileys example
 *
 * Run:
 * 1) npm install
 * 2) node index.js
 *
 * Visit http://localhost:3000 to scan the QR and see status.
 *
 * Notes:
 * - auth files are written to ./auth_info by useMultiFileAuthState
 * - add auth_info to .gitignore (provided)
 * - Do not commit auth_info to any public repo
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const qrcode = require('qrcode');
const pino = require('pino');

const baileys = require('@adiwajshing/baileys');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = baileys;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Simple endpoint to check status
app.get('/status', (req, res) => res.json({ ok: true }));

// Socket.IO - to send qr/status updates to the browser
io.on('connection', (socket) => {
  console.log('Web client connected:', socket.id);
  socket.on('clear-auth', async () => {
    // Optionally implement clearing auth_info files if you want a "log out" button
    socket.emit('log', 'Clear auth requested. Delete ./auth_info on server to fully reset.');
  });
});

// Start Bot + connection logic
async function startBot() {
  // Ensure auth_info directory exists
  const authDir = path.resolve('./auth_info');
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  // fetch WhatsApp web version
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 2307, 9] }));

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }), // set to 'info' for debug
    printQRInTerminal: false,
    auth: state,
    version,
  });

  // save credentials on update
  sock.ev.on('creds.update', saveCreds);

  // connection state updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const dataUrl = await qrcode.toDataURL(qr);
        io.emit('qr', dataUrl); // send QR image to all web clients
        io.emit('log', 'QR code generated. Scan it using WhatsApp -> Linked devices -> Link a device.');
      } catch (e) {
        io.emit('log', 'Failed to generate QR image: ' + e.message);
      }
    }

    if (connection === 'open') {
      io.emit('connected', true);
      io.emit('log', 'WhatsApp connected.');
      console.log('WhatsApp connection established');
    }

    if (connection === 'close') {
      io.emit('connected', false);
      const reason = lastDisconnect?.error;
      io.emit('log', 'Connection closed: ' + (reason?.message || JSON.stringify(reason)));
      console.log('connection closed', reason);

      // determine if we should reconnect
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        io.emit('log', 'Logged out. Remove auth_info directory and re-scan.');
        // do not auto-reconnect — session is gone
      } else {
        io.emit('log', 'Reconnecting in 2 seconds...');
        setTimeout(startBot, 2000);
      }
    }
  });

  // simple message handler: demonstrate commands and echo
  sock.ev.on('messages.upsert', async (upsert) => {
    try {
      if (!upsert.messages) return;
      for (const msg of upsert.messages) {
        if (!msg.message) continue;
        if (msg.key && msg.key.fromMe) continue;
        const jid = msg.key.remoteJid;
        const text =
          msg.message.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';
        if (!text) continue;

        console.log(`Incoming message from ${jid}: ${text}`);
        if (text.startsWith('!')) {
          const args = text.slice(1).trim().split(/\s+/);
          const cmd = args.shift().toLowerCase();
          if (cmd === 'ping') {
            await sock.sendMessage(jid, { text: 'Pong!' }, { quoted: msg });
          } else if (cmd === 'echo') {
            const reply = args.join(' ') || 'No text provided.';
            await sock.sendMessage(jid, { text: reply }, { quoted: msg });
          } else if (cmd === 'help') {
            await sock.sendMessage(
              jid,
              { text: 'Commands: !ping, !echo <text>, !help' },
              { quoted: msg }
            );
          } else {
            await sock.sendMessage(jid, { text: `Unknown command: ${cmd}` }, { quoted: msg });
          }
        } else {
          // non-command: don't auto-respond here (optional)
        }
      }
    } catch (err) {
      console.error('messages.upsert error:', err);
    }
  });

  return sock;
}

startBot().catch((err) => {
  console.error('Failed to start bot:', err);
});

// start http server
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});