# HyperToken Playground

An interactive web-based demo that lets anyone experience HyperToken in 30 seconds - no install, no setup, just open a URL.

## Features

- **Three games to play**: Blackjack, Tic-Tac-Toe, and Prisoner's Dilemma
- **Manual play**: Play the games yourself against AI opponents
- **AI training visualization**: Watch AI agents learn in real-time
- **Training metrics**: Episode counter, average reward, win rate, and reward charts
- **Mobile responsive**: Works on desktop and mobile devices

## Quick Start

### Option 1: Using npx serve

```bash
npx serve playground/
```

Then open http://localhost:3000 in your browser.

### Option 2: Using Python

```bash
cd playground
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

### Option 3: Using Node.js http-server

```bash
npm install -g http-server
http-server playground/ -p 8080
```

Then open http://localhost:8080 in your browser.

## Games

### Blackjack

Classic casino blackjack where you play against the dealer:
- **Hit**: Draw another card
- **Stand**: Keep your current hand
- **New Hand**: Deal a new hand

Training uses a simple policy (hit if < 17) to demonstrate learning.

### Tic-Tac-Toe

Play X against an AI opponent (O):
- Click any empty cell to make your move
- AI uses a simple heuristic strategy (win/block/center/random)

Training pits two strategies against each other to demonstrate win rate tracking.

### Prisoner's Dilemma

Classic game theory scenario:
- **Cooperate**: Both cooperate = 3 points each
- **Defect**: You defect, opponent cooperates = 5 points for you, 0 for them
- Opponent uses Tit-for-Tat strategy

Training explores various strategies to show reward differential.

## Training

Click "Train AI (1000 episodes)" to run 1000 training episodes:
- Progress bar shows completion percentage
- Stats panel shows episode count, average reward, and win rate
- Chart displays episode rewards and moving average
- Console logs training progress

Click "Stop" to halt training at any time.

## File Structure

```
playground/
  index.html        # Main HTML page with styles
  playground.js     # Application logic (game management, training, charts)
  games/
    blackjack.js    # Blackjack game implementation
    tictactoe.js    # Tic-Tac-Toe game implementation
    prisoners.js    # Prisoner's Dilemma implementation
  README.md         # This file
```

## Deployment

### GitHub Pages

1. Push the `playground/` folder to a `gh-pages` branch
2. Enable GitHub Pages in repository settings
3. Access at `https://<username>.github.io/<repo>/playground/`

### Netlify / Vercel

Simply point to the `playground/` directory as the publish directory.

### Static Hosting

Copy the entire `playground/` folder to any static file server.

## Technical Notes

- Uses ES modules (requires a web server, won't work via `file://`)
- Chart.js loaded from CDN for reward visualization
- No build step required - vanilla JavaScript
- Fully client-side, no backend needed

## License

Apache 2.0 - See main repository LICENSE file.
