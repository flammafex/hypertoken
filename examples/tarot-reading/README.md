# 🔮 Tarot Reading System

A philosophical and interpretive divination system built on the HyperToken framework. This system provides structured tarot readings with multiple spreads, detailed interpretations, and a command-line interface.

## Overview

The Tarot Reading System transforms the ancient practice of tarot divination into a modern, programmatic interface while preserving the depth and symbolism of traditional readings. It includes:

- **Complete 78-card Rider-Waite-Smith deck** with full Major and Minor Arcana
- **8 classic tarot spreads** from simple single-card readings to comprehensive layouts
- **Interpretive engine** that generates insights based on card positions and patterns
- **Interactive CLI** for conducting readings
- **Reading history and export** capabilities

## Philosophy

The tarot is a symbolic language that speaks to archetypal patterns in human experience. This system treats each card as a **token** carrying semantic meaning, with **spreads** as structured patterns that create narrative and insight through their relationships.

The system does not claim to predict a fixed future, but rather to illuminate present energies and potentials, serving as a mirror for contemplation and self-inquiry.

## Features

### The Deck

**Major Arcana (22 cards)**: The Fool's Journey through life's great initiations
- 0. The Fool → XXI. The World
- Each card represents a universal archetype and life lesson

**Minor Arcana (56 cards)**: The four suits of everyday experience

- **Wands (Fire)** - Creativity, passion, willpower, action
- **Cups (Water)** - Emotions, relationships, intuition, connection  
- **Swords (Air)** - Thoughts, communication, truth, challenge
- **Pentacles (Earth)** - Material matters, work, manifestation, security

Each suit contains: Ace, 2-10, Page, Knight, Queen, King

### Spreads

1. **Single Card** - Quick daily guidance or focused insight
2. **Three Card** - Past, Present, Future - Classic temporal reading
3. **Celtic Cross** - Comprehensive 10-card reading covering all aspects
4. **Relationship** - 5 cards exploring interpersonal dynamics
5. **Career** - Professional path and guidance
6. **Decision** - 6 cards to illuminate choices and their consequences
7. **Year Ahead** - 12 cards, one for each month
8. **Chakra Alignment** - 7 cards for spiritual energy assessment

### Interpretation Engine

The system generates multi-layered interpretations:

- **Position-specific meanings** - Each card's significance in its placement
- **Upright vs. Reversed** - Different meanings based on orientation (optional)
- **Elemental analysis** - Balance of fire, water, air, and earth energies
- **Major Arcana emphasis** - Detection of significant life themes
- **Pattern recognition** - Identification of recurring themes and keywords
- **Synthesized guidance** - Holistic advice based on the entire reading

## Installation

```bash
# Ensure you have the HyperToken framework
# Place these files in your HyperToken directory:
# - tarot-deck.json
# - tarot-reader.js
# - tarot-cli.js

# Make the CLI executable
chmod +x tarot-cli.js

# Run the interactive CLI
node tarot-cli.js
```

## Usage

### Interactive CLI

```bash
node tarot-cli.js
```

The CLI provides:
- Menu-driven spread selection
- Question/intention prompting
- Option to enable/disable reversed cards
- Formatted reading display
- Reading history
- Export to JSON

### Programmatic Usage

```javascript
import { TarotReader } from './tarot-reader.js';

// Initialize the reader
const reader = new TarotReader('./tarot-deck.json');
await reader.initialize();

// Perform a reading
const reading = reader.performReading('three-card', 'What do I need to know today?', {
  allowReversed: true
});

// Display the reading
console.log(reader.formatReading(reading));

// Export to JSON
const json = reader.exportReading(reading);

// View available spreads
const spreads = reader.getAvailableSpreads();

// Access reading history
const history = reader.getHistory();
```

### Example Reading Output

```
======================================================================
  🔮 TAROT READING - THREE-CARD
======================================================================

Question: What do I need to know about my current path?
Date: 11/15/2025

Reading for: "What do I need to know about my current path?"

This reading is dominated by Major Arcana, suggesting powerful forces 
and significant life themes at play.

Elemental Balance:
- FIRE: 1 cards (33%)
- WATER: 1 cards (33%)
- AIR: 1 cards (33%)

──────────────────────────────────────────────────────────────────────

1. PAST
   Card: VIII. Strength
   Meaning: Strength, courage, persuasion, influence, compassion, inner power
   True strength lies in gentle influence and inner fortitude.

2. PRESENT
   Card: Ace of Cups
   Meaning: Love, new relationships, compassion, creativity, emotional abundance
   The Ace of Cups overflows with emotional and spiritual abundance.

3. FUTURE
   Card: Knight of Swords
   Meaning: Ambitious, action-oriented, driven to succeed, fast-thinking
   Charging forward with intellectual intensity.

──────────────────────────────────────────────────────────────────────

SYNTHESIS
Key Themes: strength, courage, compassion, love, creativity, ambition, action

The reading shows a balance across elements, suggesting a holistic 
approach to your path.

──────────────────────────────────────────────────────────────────────

ADVICE
Reflect on the patterns revealed in this reading. Trust your intuition 
to guide you forward.

======================================================================
```

## Card Structure

Each card is defined with rich metadata:

```json
{
  "id": "major-08-strength",
  "group": "major-arcana",
  "label": "VIII. Strength",
  "text": "Strength, courage, persuasion, influence, compassion...",
  "meta": {
    "arcana": "major",
    "number": 8,
    "element": "fire",
    "astrological": "leo",
    "keywords": ["strength", "courage", "patience", "compassion"],
    "upright": "Strength, courage, persuasion, influence, compassion",
    "reversed": "Inner strength, self-doubt, low energy, raw emotion"
  },
  "char": "🦁",
  "kind": "tarot"
}
```

## Spread Definitions

Spreads are defined as coordinate-based layouts:

```javascript
table.defineSpread('three-card', [
  { id: 'past', x: -150, y: 0, label: 'Past' },
  { id: 'present', x: 0, y: 0, label: 'Present' },
  { id: 'future', x: 150, y: 0, label: 'Future' }
]);
```

## API Reference

### TarotReader Class

**Constructor**
```javascript
new TarotReader(deckPath = './tarot-deck.json')
```

**Methods**

- `async initialize()` - Load and initialize the tarot deck
- `performReading(spreadName, question, options)` - Conduct a reading
  - `spreadName`: String - Name of the spread to use
  - `question`: String|null - Optional question or intention
  - `options`: Object - `{ allowReversed: boolean, shuffle: boolean }`
- `formatReading(reading)` - Format reading as human-readable text
- `exportReading(reading)` - Export reading as JSON string
- `getAvailableSpreads()` - Get list of available spreads with descriptions
- `interpretCard(card, position, reversed)` - Get interpretation for a single card
- `getHistory()` - Retrieve all readings from this session
- `clearHistory()` - Clear reading history

## Philosophical Framework

### The Hermetic Principle

"As above, so below; as within, so without."

The tarot operates on the principle of synchronicity—meaningful coincidence. When you draw cards, you're not accessing supernatural knowledge, but rather using randomness as a focusing lens for your own intuition and subconscious wisdom.

### The Archetypal Language

Each card is an **archetype**—a universal pattern of human experience:

- **The Fool** - Innocent potential, new beginnings, the leap of faith
- **The Magician** - Willpower, manifestation, skill and mastery
- **The High Priestess** - Intuition, mystery, the unconscious
- **Death** - Transformation, endings that enable new beginnings
- **The Tower** - Sudden change, the collapse of false structures
- **The Star** - Hope, healing, renewed faith

### Divination as Contemplation

This system views tarot not as fortune-telling but as a **contemplative practice**:

1. **Focus** - The question or intention focuses the mind
2. **Randomness** - Card selection introduces unpredictability
3. **Interpretation** - Meaning emerges from the intersection of symbol and circumstance
4. **Insight** - The process reveals patterns not consciously accessible

The cards do not tell you what will happen. They tell you what **is**—the energies, patterns, and potentials already present in your situation.

## Advanced Usage

### Custom Spreads

```javascript
// Define your own spread
table.defineSpread('custom-spread', [
  { id: 'pos1', x: 0, y: 0, label: 'Core Issue' },
  { id: 'pos2', x: -100, y: 100, label: 'Hidden Factor' },
  { id: 'pos3', x: 100, y: 100, label: 'Path Forward' }
]);

// Use it
const reading = reader.performReading('custom-spread', 'My question');
```

### Extend the Interpretation Engine

```javascript
// Add custom interpretation logic
class CustomTarotReader extends TarotReader {
  generateAdvice(cards, spreadName) {
    // Your custom logic here
    return "Custom advice based on your own system";
  }
}
```

### Integration with Other Systems

The tarot reader is built on HyperToken's modular architecture and can be integrated with:

- **Game engines** - Use tarot draws to influence game narratives
- **AI agents** - Let AI interpret readings or generate card-inspired content
- **Web interfaces** - Build a web UI using the programmatic API
- **Journal systems** - Automatically log daily card draws

## Technical Details

### Dependencies

- HyperToken framework components:
  - `Table.js` - Card layout and spread management
  - `Deck.js` - Card collection and shuffling
  - `EventBus.js` - Event-driven architecture
  - `tokenSetLoader.js` - JSON token set loading

### Token Schema Compliance

All cards comply with the `token-set.schema.json`:

```json
{
  "id": "unique-identifier",
  "group": "major-arcana | wands | cups | swords | pentacles",
  "label": "Card Name",
  "text": "Description and meaning",
  "meta": { /* Rich metadata */ },
  "char": "🔮",
  "kind": "tarot"
}
```

## Future Enhancements

Potential additions to the system:

- [ ] Multiple deck support (Thoth, Marseille, custom decks)
- [ ] Visualization/rendering of spreads
- [ ] Journal and reading tracker
- [ ] Statistical analysis of reading history
- [ ] AI-powered interpretation expansion
- [ ] Meditation timer and ritual guidance
- [ ] Community sharing of custom spreads
- [ ] Integration with astrological data

## Credits

Built on the **HyperToken** framework by:
- **The Carpocratian Church of Commonality and Equality, Inc.**
- **Marcellina II (she/her)**

Tarot interpretations based on the Rider-Waite-Smith tradition.

## License

Copyright © 2025 The Carpocratian Church of Commonality and Equality, Inc.
Licensed under the Apache License, Version 2.0

## Resources

### Further Reading on Tarot

- *The Pictorial Key to the Tarot* by Arthur Edward Waite
- *Seventy-Eight Degrees of Wisdom* by Rachel Pollack  
- *The Tarot: History, Symbolism, and Divination* by Robert M. Place
- *Jung and Tarot: An Archetypal Journey* by Sallie Nichols

### On Divination and Synchronicity

- *Synchronicity: An Acausal Connecting Principle* by Carl Jung
- *The I Ching or Book of Changes* (Wilhelm/Baynes translation)
- *The Kybalion* - Hermetic Philosophy

---

*"The cards do not lie. They are a mirror of the soul, reflecting back what we already know but may not yet see."*

🔮