# hypertoken-quickstart

Interactive quickstart CLI for HyperToken - Get started in 5 minutes!

## What is this?

This package provides an interactive CLI that helps you get started with HyperToken, the distributed simulation engine.

## Usage

### Quick Start

```bash
npx hypertoken-quickstart
```

This launches an interactive menu with three options:

### 🎮 Play & Learn

Experience serverless multiplayer in 30 seconds!

- Runs a live multiplayer demo
- Shows CRDT synchronization in action
- Demonstrates the "wow moments" of HyperToken
- Perfect for first-time users

```bash
# Host a game
npx hypertoken-quickstart

# Join from another terminal
npx hypertoken-quickstart --join
```

### 🏗️ Create New Game

Scaffold a new HyperToken project with templates:

- **Card Game** - Like Blackjack, Poker, or custom card games
- **Board Game** - Like Tic-Tac-Toe, Chess, or grid-based games
- **Resource Game** - Trading, economy simulation, resource management
- **Custom** - Start from scratch with minimal boilerplate

Generates a complete project structure with:
- TypeScript configuration
- Demo CLI
- Token definitions
- Game logic template
- README with next steps

### 📚 Explore Examples

Tour the existing HyperToken examples:

- 🃏 **Blackjack** - Casino-grade with AI and betting
- ❌ **Tic-Tac-Toe** - Network multiplayer demo
- 🤝 **Prisoner's Dilemma** - Game theory tournament
- 🔮 **Tarot Reading** - Divination with traditional spreads
- 🎴 **Accordion** - "Impossible" solitaire

## Features

- ✅ **Zero configuration** - Just run and go
- ✅ **Interactive prompts** - User-friendly CLI
- ✅ **Live demos** - See it work before you build
- ✅ **Multiple templates** - Start with what you need
- ✅ **Production-ready scaffolding** - Best practices built-in

## Development

To work on this package locally:

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally
node dist/cli.js

# Or watch for changes
npm run dev
```

## Project Structure

```
quickstart/
├── src/
│   ├── cli.ts              # Main entry point
│   ├── play-and-learn.ts   # Demo experience
│   ├── create-game.ts      # Project scaffolding
│   └── explore-examples.ts # Example browser
├── templates/              # Project templates
├── dist/                   # Compiled JavaScript
└── package.json
```

## Publishing

This package is designed to be published to npm as `hypertoken-quickstart`.

```bash
npm publish
```

Then users can run:

```bash
npx hypertoken-quickstart
```

## License

Apache 2.0

---

**HyperToken**: Where relationships create meaning, and meaning creates worlds. 🌍✨
