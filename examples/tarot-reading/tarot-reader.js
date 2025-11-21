/*
 * Copyright 2025 The Carpocratian Church of Commonality and Equality, Inc.
 *
 * Tarot Reading System - A philosophical and interpretive token system
 * Built on the HyperToken framework
 */

import { Space } from '../../core/Space.js';
import { Stack } from '../../core/Stack.js';
import { EventBus } from '../../core/EventBus.js';
import { parseTokenSetObject } from '../../core/loaders/tokenSetLoader.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 * Tarot Reading System
 * Provides structured tarot readings with multiple spreads and interpretive guidance
 */
export class TarotReader {
  constructor(stackPath = './tarot-stack.json') {
    this.events = new EventBus();
    this.space = new Space(this.events);
    this.stack = null;
    this.stackPath = stackPath;
    this.readingHistory = [];
    this.currentReading = null;
  }

  /**
   * Initialize the tarot stack
   */
  async initialize() {
    // Convert relative path to absolute path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const absolutePath = resolve(__dirname, this.stackPath);
    
    // Read and parse the JSON file
    const jsonData = await readFile(absolutePath, 'utf-8');
    const tokenSet = parseTokenSetObject(JSON.parse(jsonData));
    
    this.stack = new Stack(tokenSet.tokens, { kind: 'tarot' });
    this.stack.shuffle();
    
    // Define standard spreads
    this.defineSpreads();
    
    this.events.emit('tarot:initialized', { stackSize: this.stack.size });
    return this;
  }

  /**
   * Define classic tarot spreads
   */
  defineSpreads() {
    // Single Card - Quick Insight
    this.space.defineSpread('single-card', [
      { id: 'card', x: 0, y: 0, label: 'Your Card' }
    ]);

    // Three Card - Past, Present, Future
    this.space.defineSpread('three-card', [
      { id: 'past', x: -150, y: 0, label: 'Past' },
      { id: 'present', x: 0, y: 0, label: 'Present' },
      { id: 'future', x: 150, y: 0, label: 'Future' }
    ]);

    // Celtic Cross - Comprehensive Reading
    this.space.defineSpread('celtic-cross', [
      { id: 'present', x: 0, y: 0, label: '1. Present Situation' },
      { id: 'challenge', x: 0, y: 0, label: '2. Challenge/Crossing' },
      { id: 'foundation', x: 0, y: 100, label: '3. Foundation/Past' },
      { id: 'recent-past', x: -100, y: 0, label: '4. Recent Past' },
      { id: 'crown', x: 0, y: -100, label: '5. Crown/Possible Future' },
      { id: 'near-future', x: 100, y: 0, label: '6. Near Future' },
      { id: 'self', x: 200, y: 100, label: '7. Self/Attitude' },
      { id: 'environment', x: 200, y: 50, label: '8. External Influences' },
      { id: 'hopes-fears', x: 200, y: 0, label: '9. Hopes and Fears' },
      { id: 'outcome', x: 200, y: -50, label: '10. Outcome' }
    ]);

    // Relationship Spread
    this.space.defineSpread('relationship', [
      { id: 'you', x: -100, y: 0, label: 'You' },
      { id: 'them', x: 100, y: 0, label: 'Them' },
      { id: 'connection', x: 0, y: -80, label: 'Connection' },
      { id: 'challenge', x: 0, y: 80, label: 'Challenge' },
      { id: 'advice', x: 0, y: 160, label: 'Advice' }
    ]);

    // Career Path Spread
    this.space.defineSpread('career', [
      { id: 'current', x: 0, y: 0, label: 'Current Position' },
      { id: 'strengths', x: -100, y: -80, label: 'Your Strengths' },
      { id: 'obstacles', x: 100, y: -80, label: 'Obstacles' },
      { id: 'advice', x: -100, y: 80, label: 'Advice' },
      { id: 'outcome', x: 100, y: 80, label: 'Potential Outcome' }
    ]);

    // Decision Making Spread
    this.space.defineSpread('decision', [
      { id: 'situation', x: 0, y: -100, label: 'The Situation' },
      { id: 'option-a', x: -120, y: 0, label: 'Option A' },
      { id: 'option-b', x: 120, y: 0, label: 'Option B' },
      { id: 'advice-a', x: -120, y: 100, label: 'If You Choose A' },
      { id: 'advice-b', x: 120, y: 100, label: 'If You Choose B' },
      { id: 'guidance', x: 0, y: 200, label: 'Overall Guidance' }
    ]);

    // Year Ahead Spread (12 months)
    const yearSpread = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 - 90) * Math.PI / 180;
      const radius = 150;
      yearSpread.push({
        id: `month-${i + 1}`,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        label: this.getMonthName(i + 1)
      });
    }
    this.space.defineSpread('year-ahead', yearSpread);

    // Chakra Alignment Spread
    this.space.defineSpread('chakra', [
      { id: 'root', x: 0, y: 180, label: 'Root - Foundation' },
      { id: 'sacral', x: 0, y: 150, label: 'Sacral - Creativity' },
      { id: 'solar', x: 0, y: 120, label: 'Solar Plexus - Power' },
      { id: 'heart', x: 0, y: 90, label: 'Heart - Love' },
      { id: 'throat', x: 0, y: 60, label: 'Throat - Communication' },
      { id: 'third-eye', x: 0, y: 30, label: 'Third Eye - Intuition' },
      { id: 'crown', x: 0, y: 0, label: 'Crown - Spirit' }
    ]);
  }

  /**
   * Perform a tarot reading with a specific spread
   */
  performReading(spreadName, question = null, options = {}) {
    if (!this.stack) {
      throw new Error('Tarot stack not initialized. Call initialize() first.');
    }

    const spread = this.space.spreads[spreadName];
    if (!spread) {
      throw new Error(`Unknown spread: ${spreadName}`);
    }

    // Shuffle if requested
    if (options.shuffle !== false) {
      this.stack.shuffle();
    }

    // Clear previous reading
    spread.forEach(position => {
      this.space.zones.set(position.id, []);
    });

    // Deal cards into the spread
    const cards = [];
    for (const position of spread) {
      const card = this.stack.draw();
      if (!card) break;

      // Randomly determine if card is reversed (if enabled)
      const isReversed = options.allowReversed !== false && Math.random() < 0.3;
      
      const placement = this.space.place(position.id, card, {
        x: position.x,
        y: position.y,
        faceUp: true,
        label: position.label,
        reversed: isReversed
      });

      cards.push({
        position: position.label,
        positionId: position.id,
        card: card,
        reversed: isReversed,
        placement: placement
      });
    }

    // Create reading record
    this.currentReading = {
      id: `reading-${Date.now()}`,
      timestamp: new Date(),
      spread: spreadName,
      question: question,
      cards: cards,
      interpretation: this.generateInterpretation(cards, spreadName, question)
    };

    this.readingHistory.push(this.currentReading);
    this.events.emit('tarot:reading-complete', this.currentReading);

    return this.currentReading;
  }

  /**
   * Generate interpretation for a reading
   */
  generateInterpretation(cards, spreadName, question) {
    const interpretation = {
      overview: '',
      positions: [],
      synthesis: '',
      advice: ''
    };

    // Generate position-by-position interpretation
    cards.forEach(({ position, card, reversed }) => {
      const meaning = reversed ? card.meta.reversed : card.meta.upright;
      const text = card.text;
      
      interpretation.positions.push({
        position,
        card: card.label,
        reversed,
        meaning,
        keywords: card.meta.keywords,
        description: text
      });
    });

    // Generate overview based on spread type
    interpretation.overview = this.generateOverview(cards, spreadName, question);
    
    // Generate synthesis - find patterns and themes
    interpretation.synthesis = this.generateSynthesis(cards);
    
    // Generate advice
    interpretation.advice = this.generateAdvice(cards, spreadName);

    return interpretation;
  }

  /**
   * Generate overview based on the reading
   */
  generateOverview(cards, spreadName, question) {
    const majorCount = cards.filter(c => c.card.meta.arcana === 'major').length;
    const courtCount = cards.filter(c => c.card.meta.court).length;
    const reversedCount = cards.filter(c => c.reversed).length;

    let overview = question 
      ? `Reading for: "${question}"\n\n`
      : `${spreadName.toUpperCase()} READING\n\n`;

    // Add energetic assessment
    if (majorCount > cards.length / 2) {
      overview += 'This reading is dominated by Major Arcana, suggesting powerful forces and significant life themes at play. ';
    }

    if (courtCount > 2) {
      overview += 'Multiple court cards indicate various people or personality aspects influencing the situation. ';
    }

    if (reversedCount > cards.length / 2) {
      overview += 'With many reversed cards, there may be internal blocks or energies that need to be released. ';
    }

    // Analyze elemental balance
    const elements = cards.reduce((acc, { card }) => {
      const element = card.meta.element;
      if (element) {
        acc[element] = (acc[element] || 0) + 1;
      }
      return acc;
    }, {});

    overview += '\n\nElemental Balance:\n';
    Object.entries(elements).forEach(([element, count]) => {
      const percentage = Math.round((count / cards.length) * 100);
      overview += `- ${element.toUpperCase()}: ${count} cards (${percentage}%)\n`;
    });

    return overview;
  }

  /**
   * Generate synthesis - find patterns and deeper meaning
   */
  generateSynthesis(cards) {
    const themes = new Set();
    const suits = {};
    
    cards.forEach(({ card }) => {
      // Collect keywords
      if (card.meta.keywords) {
        card.meta.keywords.forEach(kw => themes.add(kw));
      }
      
      // Count suits
      if (card.meta.suit) {
        suits[card.meta.suit] = (suits[card.meta.suit] || 0) + 1;
      }
    });

    let synthesis = 'Key Themes: ' + Array.from(themes).slice(0, 8).join(', ') + '\n\n';

    // Suit dominance interpretation
    const dominantSuit = Object.entries(suits).sort((a, b) => b[1] - a[1])[0];
    if (dominantSuit) {
      const suitMeanings = {
        wands: 'creative action, passion, and willpower',
        cups: 'emotions, relationships, and intuition',
        swords: 'thoughts, communication, and mental challenges',
        pentacles: 'material matters, work, and physical manifestation'
      };
      synthesis += `The emphasis on ${dominantSuit[0]} suggests a focus on ${suitMeanings[dominantSuit[0]]}.`;
    }

    return synthesis;
  }

  /**
   * Generate practical advice based on the reading
   */
  generateAdvice(cards, spreadName) {
    // Extract advice from key positions depending on spread type
    const adviceCards = cards.filter(({ position }) => 
      position.toLowerCase().includes('advice') || 
      position.toLowerCase().includes('guidance') ||
      position.toLowerCase().includes('outcome')
    );

    if (adviceCards.length > 0) {
      return adviceCards.map(({ card, reversed, position }) => {
        const meaning = reversed ? card.meta.reversed : card.meta.upright;
        return `${position}: ${meaning}`;
      }).join('\n\n');
    }

    // General advice based on the overall energy
    return 'Reflect on the patterns revealed in this reading. Trust your intuition to guide you forward.';
  }

  /**
   * Get a card's full interpretation
   */
  interpretCard(card, position = null, reversed = false) {
    const meaning = reversed ? card.meta.reversed : card.meta.upright;
    const keywords = card.meta.keywords?.join(', ') || '';
    
    return {
      card: card.label,
      position,
      reversed,
      meaning,
      keywords,
      description: card.text,
      element: card.meta.element,
      astrological: card.meta.astrological
    };
  }

  /**
   * Format reading as human-readable text
   */
  formatReading(reading = null) {
    const r = reading || this.currentReading;
    if (!r) return 'No reading available.';

    let output = '\n' + '='.repeat(70) + '\n';
    output += `  🔮 TAROT READING - ${r.spread.toUpperCase()}\n`;
    output += '='.repeat(70) + '\n\n';

    if (r.question) {
      output += `Question: ${r.question}\n`;
      output += `Date: ${r.timestamp.toLocaleDateString()}\n\n`;
    }

    output += r.interpretation.overview + '\n\n';
    output += '─'.repeat(70) + '\n\n';

    // Card interpretations
    r.interpretation.positions.forEach((pos, idx) => {
      output += `${idx + 1}. ${pos.position.toUpperCase()}\n`;
      output += `   Card: ${pos.card}${pos.reversed ? ' (Reversed)' : ''}\n`;
      output += `   Meaning: ${pos.meaning}\n`;
      output += `   ${pos.description}\n\n`;
    });

    output += '─'.repeat(70) + '\n\n';
    output += 'SYNTHESIS\n';
    output += r.interpretation.synthesis + '\n\n';
    output += '─'.repeat(70) + '\n\n';
    output += 'ADVICE\n';
    output += r.interpretation.advice + '\n';
    output += '\n' + '='.repeat(70) + '\n';

    return output;
  }

  /**
   * Export reading to JSON
   */
  exportReading(reading = null) {
    return JSON.stringify(reading || this.currentReading, null, 2);
  }

  /**
   * Get available spreads
   */
  getAvailableSpreads() {
    return {
      'single-card': 'Quick insight or daily guidance',
      'three-card': 'Past, Present, Future - Simple yet profound',
      'celtic-cross': 'Comprehensive 10-card reading',
      'relationship': 'Explore relationship dynamics',
      'career': 'Career path and professional guidance',
      'decision': 'Help with important decisions',
      'year-ahead': '12-month forecast',
      'chakra': 'Spiritual alignment and energy centers'
    };
  }

  /**
   * Helper: Get month name
   */
  getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
  }

  /**
   * Get reading history
   */
  getHistory() {
    return this.readingHistory;
  }

  /**
   * Clear reading history
   */
  clearHistory() {
    this.readingHistory = [];
    this.currentReading = null;
  }
}

export default TarotReader;