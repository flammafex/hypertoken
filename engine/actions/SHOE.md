# Shoe Actions

Operations on multi-deck containers (shoes). Used for casino games and weighted randomness.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (7)

1. `shoe:draw` - Draw card from shoe
2. `shoe:shuffle` - Shuffle all decks in shoe
3. `shoe:burn` - Burn N cards from shoe
4. `shoe:reset` - Reset shoe to original state
5. `shoe:addDeck` - Add deck to shoe
6. `shoe:removeDeck` - Remove deck from shoe
7. `shoe:inspect` - Get shoe information

---

## Quick Examples

```javascript
// Create 6-deck shoe (blackjack)
const shoe = new Shoe();
for (let i = 0; i < 6; i++) {
  shoe.addDeck(createStandardDeck());
}

engine.dispatch("shoe:shuffle");

// Deal cards
engine.dispatch("shoe:draw");
engine.dispatch("shoe:burn");  // Casino procedure
```

---

See [complete ACTIONS.md documentation](../ACTIONS-COMPLETE.md) for full details on all shoe actions.

[← Back to Action Reference](../ACTIONS.md)