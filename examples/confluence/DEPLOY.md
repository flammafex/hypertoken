# Confluence Deployment Guide

## Architecture

```
Browser → nginx (port 80/443)
  ├── Static files (HTML/CSS/JS bundle)
  └── /ws → WebSocket proxy to relay server (localhost:3000)
```

## Prerequisites

- Node.js 18+ on the server
- nginx installed
- (Optional) certbot/Let's Encrypt for HTTPS

## Step 1: Build the bundle

On your local machine (or CI):

```bash
npm install
npm run confluence:build
```

This produces `examples/confluence/web/confluence.bundle.js` (3.8MB, includes
the Automerge WASM binary inlined as base64).

## Step 2: Copy files to the server

```bash
# Copy the web directory to the server
scp -r examples/confluence/web/ user@server:/var/www/confluence/

# Or use rsync for incremental updates
rsync -avz examples/confluence/web/ user@server:/var/www/confluence/
```

The files you need:
- `index.html`
- `styles.css`
- `confluence.bundle.js`
- `confluence.bundle.js.map` (optional, for debugging)

You do NOT need: `build.js`, `confluence-web.js` (source), `*-shim.js`, `wasm-stub.js`
(those are only used during the build step).

## Step 3: Deploy the relay server

The relay server is a Node.js WebSocket server. You need it running on the server.

### Option A: Using pm2 (recommended)

```bash
# Install pm2 globally
npm install -g pm2

# Clone the repo on the server (or copy the needed files)
git clone https://git.carpocratian.org/sibyl/hypertoken.git
cd hypertoken
npm install

# Start the relay server
pm2 start "npx tsx cli/index.ts relay --port 3000" --name confluence-relay

# Save and enable auto-restart on reboot
pm2 save
pm2 startup
```

### Option B: Using systemd

Create `/etc/systemd/system/confluence-relay.service`:

```ini
[Unit]
Description=Confluence Relay Server
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
sudo systemctl enable confluence-relay
sudo systemctl start confluence-relay
```

## Step 4: Configure nginx

Create `/etc/nginx/sites-available/confluence`:

```nginx
server {
    listen 80;
    server_name confluence.example.com;  # Replace with your domain

    # Static files
    root /var/www/confluence;
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
sudo ln -s /etc/nginx/sites-available/confluence /etc/nginx/sites-enabled/
sudo nginx -t          # Test config
sudo systemctl reload nginx
```

## Step 5: Add HTTPS (recommended)

```bash
sudo certbot --nginx -d confluence.example.com
```

This automatically configures TLS and redirects HTTP → HTTPS. The WebSocket
URL will automatically become `wss://confluence.example.com/ws` (the client
auto-detects from the page protocol).

## Step 6: Verify

1. Visit `https://confluence.example.com` — you should see the start screen
2. Enter a name, click Join — you should see the waiting room
3. Open a second browser/tab, enter a different name, click Join
4. Click "Start Game" — both players should see the battlefield simultaneously
5. Place tokens — they should appear on both screens in real-time
6. Try the "Go Offline" button — disconnect, place tokens, reconnect, watch CRDT merge

## How the WebSocket URL auto-detection works

The client auto-detects the WebSocket URL from the page location:

- **Production** (port 80/443 behind nginx): `wss://yourdomain.com/ws`
- **Dev** (port 8080 via `npm run confluence:web`): `ws://localhost:8080/ws`
- **Local file** (opened directly): falls back to `ws://localhost:3000`

Users can still override the URL manually in the input field.

## Updating the deployment

When you make changes to the game:

```bash
# Rebuild
npm run confluence:build

# Copy updated files to server
rsync -avz examples/confluence/web/confluence.bundle.js \
  examples/confluence/web/index.html \
  examples/confluence/web/styles.css \
  user@server:/var/www/confluence/

# The relay server only needs restarting if you changed engine/network code
pm2 restart confluence-relay
```

## Troubleshooting

### WebSocket connection fails
- Check nginx config has `proxy_http_version 1.1` and `Upgrade`/`Connection` headers
- Check relay server is running: `pm2 status` or `systemctl status confluence-relay`
- Check firewall allows port 80/443: `sudo ufw status`

### Tokens don't sync between players
- Check browser console for errors
- Verify both players are connecting to the same relay
- Check the relay server logs: `pm2 logs confluence-relay`

### Bundle is large (3.8MB)
- This is expected — the Automerge WASM binary is inlined as base64 (~2.7MB)
- The bundle is cached by the browser after first load
- For production, enable gzip/brotli compression in nginx:

```nginx
gzip on;
gzip_types application/javascript text/css;
gzip_min_length 1000;
```
