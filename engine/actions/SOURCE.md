# Source Actions

Operations on multi-stack containers (sources). Used for casino games and weighted randomness.

[← Back to Action Reference](../ACTIONS.md)

---

## Actions (7)

1. `source:draw` - Draw card from source
2. `source:shuffle` - Shuffle all stacks in source
3. `source:burn` - Burn N cards from source
4. `source:reset` - Reset source to original state
5. `source:addStack` - Add stack to source
6. `source:removeStack` - Remove stack from source
7. `source:inspect` - Get source information

---

## Quick Examples

```javascript
// Create 6-stack source (blackjack)
const source = new Source();
for (let i = 0; i < 6; i++) {
  source.addStack(createStandardStack());
}

engine.dispatch("source:shuffle");

// Deal cards
engine.dispatch("source:draw");
engine.dispatch("source:burn");  // Casino procedure
```

---

See [complete ACTIONS.md documentation](../ACTIONS-COMPLETE.md) for full details on all source actions.

[← Back to Action Reference](../ACTIONS.md)
