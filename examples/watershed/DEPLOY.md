# Watershed Deployment Guide

## Architecture

```
Browser → nginx (port 80/443)
  ├── Static files (HTML/CSS/JS bundle)
  └── /ws → WebSocket proxy to relay server (localhost:3000)
                              └── UniversalRelayServer with room multiplexing
                                  (peers create/join rooms; broadcasts scoped per room)
```

The relay is still a **P2P relay**, not an authoritative server — every
client holds a full CRDT replica of the game state. The relay just routes
broadcasts between peers in the same room. The "Go Offline" demo still
works: a disconnected client keeps mutating its local replica and merges
back on reconnect.

## Prerequisites

- Node.js 18+ on the server
- nginx installed
- (Optional) certbot/Let's Encrypt for HTTPS

## Step 1: Build the bundle

On your local machine (or CI):

```bash
npm install
npm run watershed:build
```

This produces `examples/watershed/web/watershed.bundle.js` (3.8MB, includes
the Automerge WASM binary inlined as base64).

## Step 2: Copy files to the server

```bash
# Copy the web directory to the server
scp -r examples/watershed/web/ user@server:/var/www/watershed/

# Or use rsync for incremental updates
rsync -avz examples/watershed/web/ user@server:/var/www/watershed/
```

The files you need:
- `index.html`
- `styles.css`
- `watershed.bundle.js`
- `watershed.bundle.js.map` (optional, for debugging)

You do NOT need: `build.js`, `watershed-web.js` (source), `*-shim.js`, `wasm-stub.js`
(those are only used during the build step).

## Step 3: Deploy the relay server

The relay server is a Node.js WebSocket server. You need it running on the server.
The `UniversalRelayServer` now supports **room multiplexing** out of the box —
peers can create/join rooms, and broadcasts are scoped to the room. No separate
room service is needed. Rooms are auto-cleaned up when all peers disconnect.

The command is the same as before — no flags needed, rooms are enabled by default:

```bash
npx tsx cli/index.ts relay --port 3000
```

### Option A: Using pm2 (recommended)

```bash
# Install pm2 globally
npm install -g pm2

# Clone the repo on the server (or copy the needed files)
git clone https://git.carpocratian.org/sibyl/hypertoken.git
cd hypertoken
npm install

# Start the relay server
pm2 start "npx tsx cli/index.ts relay --port 3000" --name watershed-relay

# Save and enable auto-restart on reboot
pm2 save
pm2 startup
```

### Option B: Using systemd

Create `/etc/systemd/system/watershed-relay.service`:

```ini
[Unit]
Description=Watershed Relay Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/hypertoken
ExecStart=/usr/bin/npx tsx cli/index.ts relay --port 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable watershed-relay
sudo systemctl start watershed-relay
```

## Step 4: Configure nginx

Create `/etc/nginx/sites-available/watershed`:

```nginx
server {
    listen 80;
    server_name watershed.example.com;  # Replace with your domain

    # Static files
    root /var/www/watershed;
    index index.html;

    # Main page
    location / {
        try_files $uri $uri/ =404;
    }

    # WebSocket proxy for the relay server
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket-specific settings
        proxy_read_timeout 86400;  # 24h — keep connection alive
        proxy_send_timeout 86400;
    }

    # Cache static assets
    location ~* \.(js|css|woff2?|png|jpg|svg)$ {
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # Don't cache the HTML (so updates are picked up)
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/watershed /etc/nginx/sites-enabled/
sudo nginx -t          # Test config
sudo systemctl reload nginx
```

## Step 5: Add HTTPS (recommended)

```bash
sudo certbot --nginx -d watershed.example.com
```

This automatically configures TLS and redirects HTTP → HTTPS. The WebSocket
URL will automatically become `wss://watershed.example.com/ws` (the client
auto-detects from the page protocol).

## Step 6: Verify

1. Visit `https://watershed.example.com` — you should see the start screen
2. Enter a name, click Join Game — the lobby should appear with "Create Room"
   and "Join Room" options
3. Click "Create Room" — you should get a room code in `XXXX-XXXX` format and
   a shareable link like `https://watershed.example.com/?room=XXXX-XXXX`
4. Open the shareable link in a second browser (or incognito window), enter a
   different name, click Join Game — both players should see each other in the
   waiting room
5. Click "Start Game" — both players should see the battlefield simultaneously
6. Place tokens — they should appear on both screens in real-time
7. Try the "Go Offline" button — disconnect, place tokens, reconnect, watch CRDT merge

## Room Flow

The browser client has a lobby UI that drives the room protocol on the relay:

1. **Player visits the site**, enters a name, clicks **Join Game**.
2. The **lobby** appears with a **Create Room** button and a **Join Room** input
   (for entering a room code).
3. The **creator** clicks Create Room and receives:
   - A room code in `XXXX-XXXX` format
   - A shareable link: `https://watershed.example.com/?room=XXXX-XXXX`
4. The creator shares that link. **Other players** open it and auto-join the
   room (the `?room=` query param is read on page load).
5. Players who already have a code can paste it into the **Join Room** input
   instead.
6. Once everyone is in the waiting room, the **creator** clicks **Start Game** —
   the game begins for all players in the room simultaneously.

Room isolation is automatic: peers in different rooms cannot see each other's
broadcasts. When the last peer in a room disconnects, the relay cleans up the
room automatically.

## How the WebSocket URL auto-detection works

The client auto-detects the WebSocket URL from the page location:

- **Production** (port 80/443 behind nginx): `wss://yourdomain.com/ws`
- **Dev** (port 8080 via `npm run watershed:web`): `ws://localhost:8080/ws`
- **Local file** (opened directly): falls back to `ws://localhost:3000`

Users can still override the URL manually in the input field.

## Updating the deployment

When you make changes to the game:

```bash
# Rebuild
npm run watershed:build

# Copy updated files to server
rsync -avz examples/watershed/web/watershed.bundle.js \
  examples/watershed/web/index.html \
  examples/watershed/web/styles.css \
  user@server:/var/www/watershed/

# The relay server only needs restarting if you changed engine/network code
pm2 restart watershed-relay
```

## Troubleshooting

### WebSocket connection fails
- Check nginx config has `proxy_http_version 1.1` and `Upgrade`/`Connection` headers
- Check relay server is running: `pm2 status` or `systemctl status watershed-relay`
- Check firewall allows port 80/443: `sudo ufw status`

### Tokens don't sync between players
- Check browser console for errors
- Verify both players are connecting to the same relay
- Verify both players are in the same room (check the URL has the same
  `?room=XXXX-XXXX` param)
- Check the relay server logs: `pm2 logs watershed-relay`

### "Room not found" error when joining
- Check the room code was entered correctly (it's case-sensitive)
- Check the creator is still connected — rooms are cleaned up when the last
  peer disconnects, so a stale code from a closed tab will no longer exist
- If joining via a shared link, verify the `?room=` param in the URL matches
  the code the creator received

### Players can't see each other in the waiting room
- Verify both players are in the same room — check the URL has a `?room=` param
  and that it matches
- If one player used "Create Room" and the other typed a code into "Join Room",
  make sure the code was copied exactly (including the hyphen)
- Check the relay server logs for room membership: `pm2 logs watershed-relay`

### Bundle is large (3.8MB)
- This is expected — the Automerge WASM binary is inlined as base64 (~2.7MB)
- The bundle is cached by the browser after first load
- For production, enable gzip/brotli compression in nginx:

```nginx
gzip on;
gzip_types application/javascript text/css;
gzip_min_length 1000;
```
