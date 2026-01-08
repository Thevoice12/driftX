```markdown
# WhatsApp Bot Starter (Web QR)

This is a minimal starter that runs a WhatsApp bot (Baileys) and exposes a small web page to display the QR code so you can scan from a browser.

Features
- Display QR code in browser (Socket.IO)
- Persistent session (auth_info directory)
- Basic command handling (!ping, !echo, !help)
- Example code is kept minimal for learning and extension.

Quick start
1. Clone (or create an empty repo) and copy files.
2. Install:
   ```
   npm install
   ```
3. Run:
   ```
   node index.js
   ```
4. Open http://localhost:3000 and scan the QR shown there with WhatsApp -> Linked devices -> Link a device.

Important
- Do not commit `auth_info` to public repositories.
- If you are logged out, delete `auth_info` and re-run to re-scan.
- Follow WhatsApp usage policies.

Extending
- Use sharp/webp to create stickers from images.
- Add DB (SQLite/Mongo) for persistence.
- Add admin-only commands and group checks.

```