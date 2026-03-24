# Playground Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 35 issues identified in the code review and frontend design review of the HyperToken playground.

**Architecture:** Fixes are grouped by priority (security > bugs > frontend > quality > a11y > perf > minor) and by file proximity. Each task targets 1-3 files. No new test framework -- the playground is a browser-only UI with no existing test harness. Verification is manual (load in browser).

**Tech Stack:** Vanilla JS (Preact + HTM via CDN), CSS, HTML

---

## Task 1: XSS -- Add `escapeHtml` helper, sanitize all DOM string interpolations

**Files:**
- Create: `playground/utils/escapeHtml.js`
- Modify: `playground/games/hanabi.js:439-458`
- Modify: `playground/games/coup.js:536-549`
- Modify: `playground/games/cuttle.js:765-810`

The games build HTML strings by directly interpolating game-state values (card.role, card.knownColor, card.knownNumber, rank, suit symbols) into DOM element content properties without escaping. While current data is from fixed constants, the pattern is fragile -- especially hanabi where hint state is populated by user-triggered actions.

- [ ] **Step 1: Create shared `escapeHtml` utility**

```js
// playground/utils/escapeHtml.js
export function escapeHtml(str) {
  if (typeof str !== 'string') str = String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

- [ ] **Step 2: Fix hanabi.js** -- Import `escapeHtml` and wrap every interpolated card value in `updateDisplay()` around lines 439-458. Wrap `COLOR_SYMBOLS[card.knownColor]`, `card.knownNumber`, and `hints.join(' ')`.

- [ ] **Step 3: Fix coup.js** -- Import `escapeHtml` and wrap `card.role`, `symbol`, and `color` in `updateDisplay()` around lines 536-549.

- [ ] **Step 4: Fix cuttle.js** -- Import `escapeHtml` and wrap `card.rank` and `SUIT_SYMBOLS[card.suit]` in all three render methods: `renderHand()` line 773, `renderField()` lines 797 and 807.

- [ ] **Step 5: Verify in browser** -- Load each game, check cards render correctly.

- [ ] **Step 6: Commit** -- `fix(playground): sanitize DOM string interpolations to prevent XSS`

---

## Task 2: Security -- Validate rules loaded from localStorage

**Files:**
- Modify: `playground/rules/RuleManager.js:682-694`

Rules loaded from `_loadFromStorage()` bypass `validateRule()` and `validateCustomCode()`, defeating the DANGEROUS_PATTERNS blocklist.

- [ ] **Step 1: Add validation in `_loadFromStorage()`**

Replace the forEach that directly sets rules into the Map. Instead, call `validateRule()` on each rule and only add sanitized rules. Log warnings for rejected rules.

- [ ] **Step 2: Verify** -- Add a rule, reload page, confirm it loads. Check console for no validation errors on clean rules.

- [ ] **Step 3: Commit** -- `fix(playground): validate rules loaded from localStorage against dangerous patterns`

---

## Task 3: Bug -- Fix config spread clobbering defaults in TrainingSession

**Files:**
- Modify: `playground/training/TrainingSession.js:101-113`

The `...config` spread at line 112 unconditionally overwrites all the defaults computed above it. Also, `||` is used where `??` should be (e.g., `exploration: 0` gets coerced to default).

- [ ] **Step 1: Replace broken config merge**

Remove the trailing `...config` spread. Replace all `||` with `??` for proper falsy-value handling.

- [ ] **Step 2: Verify** -- Start a training session with `{ exploration: 0 }`, confirm it uses 0 (greedy) not 0.1.

- [ ] **Step 3: Commit** -- `fix(playground): use nullish coalescing for TrainingSession config defaults`

---

## Task 4: Bug -- Fix Prisoners Dilemma reset for Gym interface

**Files:**
- Modify: `playground/games/prisoners.js:72,75-80,221-224`

`TrainingSession.runEpisode()` duck-types `reset()` for Gym interface. Prisoners has a UI-touching `reset()` (line 75) and a headless `resetGame()` (line 221). Training calls the UI one, firing DOM mutations every episode.

- [ ] **Step 1: Rename methods**

Rename `reset()` at line 75 to `resetUI()`. Update the button handler at line 72. Rename `resetGame()` at line 221 to `reset()` (the Gym interface).

- [ ] **Step 2: Verify** -- Click reset button (calls resetUI). Run training (calls headless reset without DOM side effects).

- [ ] **Step 3: Commit** -- `fix(playground): separate Prisoners UI reset from headless Gym reset interface`

---

## Task 5: Bug -- Fix leaked setInterval in MockNetworkManager

**Files:**
- Modify: `playground/network/MockNetworkManager.js:316-348,354-363`

A `setInterval` created inside a `setTimeout` callback at line 317 is never stored, so `_stopSimulation()` and `destroy()` can't clear it.

- [ ] **Step 1: Store the inner interval and timeout, clear both on stop**

Assign `this._peerEventTimeout` for the outer setTimeout. Assign `this._peerEventInterval` for the inner setInterval. Add both to `_stopSimulation()`.

- [ ] **Step 2: Commit** -- `fix(playground): track and clear leaked setInterval in MockNetworkManager`

---

## Task 6: Bug -- Fix tooltip positioning in Action Timeline

**Files:**
- Modify: `playground/components/action-timeline.js:140-141,310,485-489`

`tooltipPos` is initialized to `{x: 0, y: 0}` and never updated with mouse coordinates. Tooltip always renders at origin.

- [ ] **Step 1: Update hover handler to accept and store mouse position**

Update `handleHover` callback to accept an event parameter and call `setTooltipPos({ x: event.clientX + 10, y: event.clientY - 30 })`.

- [ ] **Step 2: Update ActionNode** to pass mouse event via `onMouseEnter` and `onMouseMove`.

- [ ] **Step 3: Commit** -- `fix(playground): pass mouse coordinates to action timeline tooltip`

---

## Task 7: Bug -- Fix DSL Parser discarding AND/OR prefix

**Files:**
- Modify: `playground/rules/DSLParser.js:198-204,253-263`

The `prefix` field (AND/OR) is captured in the condition buffer but `parseConditions()` at line 253 discards it entirely.

- [ ] **Step 1: Propagate prefix into condition objects**

In `parseConditions()`, after parsing each condition, set `condition.prefix = item.prefix`.

- [ ] **Step 2: Add warning for mixed AND/OR**

Before line 199, detect if both AND and OR prefixes exist. If so, push a warning about mixed operators.

- [ ] **Step 3: Commit** -- `fix(playground): preserve AND/OR prefix on parsed conditions, warn on mixed operators`

---

## Task 8: Bug -- Fix DSL Generator exists/isEmpty inversion

**Files:**
- Modify: `playground/rules/DSLGenerator.js:111-116`

`exists` maps to `isEmpty` and vice versa. Semantically backwards.

- [ ] **Step 1: Fix the unary operator mapping**

Replace the ternary with a direct map: `{ exists: 'exists', notExists: 'not exists', isEmpty: 'isEmpty', isNotEmpty: 'isNotEmpty' }`.

- [ ] **Step 2: Commit** -- `fix(playground): correct DSL Generator unary operator mapping for exists/isEmpty`

---

## Task 9: Bug -- Fix efficientClone returning live reference on failure

**Files:**
- Modify: `playground/playground.js:98-109`
- Modify: `playground/components/action-timeline.js:79-85`

On failure, both clone functions return the original object reference, silently corrupting timeline history.

- [ ] **Step 1: Fix fallback chain**

Try `structuredClone` first. On failure, try `JSON.parse(JSON.stringify())`. On double failure, log a warning and return a shallow copy (`{ ...obj }`) instead of the live reference.

- [ ] **Step 2: Apply same fix to `deepClone` in action-timeline.js**

- [ ] **Step 3: Commit** -- `fix(playground): efficientClone/deepClone fallback returns copy instead of live reference`

---

## Task 10: Feature -- Add timeline wrapping for poker, coup, hanabi, liars-dice

**Files:**
- Modify: `playground/playground.js:344-510` (add 4 new game wrapping blocks)

4 of 7 games are never wrapped by `wrapGameMethods()`, making Action Timeline and State Inspector non-functional for them.

- [ ] **Step 1: Add poker wrapping** -- Wrap `action()` and `resetGame()`.

- [ ] **Step 2: Add coup wrapping** -- Wrap `doIncome`, `doForeignAid`, `doTax`, `doCoup`, `doSteal`, `doAssassinate`, and `resetGame()`.

- [ ] **Step 3: Add hanabi wrapping** -- Wrap `playCard()`, `discardCard()`, `giveHint()`, and `resetGame()`.

- [ ] **Step 4: Add liars-dice wrapping** -- Wrap `makeBid()`, `callLiar()`, and `resetGame()`.

- [ ] **Step 5: Commit** -- `feat(playground): add action timeline wrapping for poker, coup, hanabi, liars-dice`

---

## Task 11: Bug -- Scope keyboard handler to avoid capturing from select/button

**Files:**
- Modify: `playground/components/action-timeline.js:431-435`

Global arrow-key handler only skips INPUT and TEXTAREA, stealing keys from SELECT, BUTTON, and other focusable elements.

- [ ] **Step 1: Expand the focus guard**

Add `SELECT` and `BUTTON` to the tag check. Also skip if `containerRef.current` exists and doesn't contain `document.activeElement` (unless body is focused).

- [ ] **Step 2: Commit** -- `fix(playground): scope timeline keyboard handler to avoid stealing keys from other elements`

---

## Task 12: Frontend -- Remove unused Chart.js, add CSS custom properties

**Files:**
- Modify: `playground/index.html:7` (remove Chart.js)
- Modify: `playground/index.html:9-16` (add `:root` custom properties)

Chart.js is loaded (~200KB render-blocking) but all charts use Canvas 2D API directly. Colors are hardcoded hundreds of times.

- [ ] **Step 1: Remove Chart.js script tag** -- Delete line 7.

- [ ] **Step 2: Add CSS custom properties** -- Add `:root` block with `--surface-base`, `--surface-deep`, `--surface-overlay`, `--border-subtle`, `--border-default`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-red`, `--accent-green`, `--accent-blue`, `--accent-purple`, `--btn-primary-bg`, `--btn-primary-hover`, `--btn-disabled-bg`, `--font-ui`, `--font-mono`, `--panel-padding`, `--panel-radius`.

- [ ] **Step 3: Apply custom properties** to `body`, `.header`, `.btn-primary`, `.btn-secondary`, and other core styles.

- [ ] **Step 4: Commit** -- `refactor(playground): remove unused Chart.js, add CSS custom properties design system`

---

## Task 13: Frontend -- Namespace component CSS to fix collisions

**Files:**
- Modify: `playground/components/rule-composer.js` (prefix button/modal classes)

`.btn-primary` is red in index.html but blue in rule-composer.js. Multiple other class collisions exist.

- [ ] **Step 1: Namespace rule-composer styles**

Prefix all colliding classes with `rc-`: `.rc-btn-primary`, `.rc-btn-secondary`, `.rc-btn-icon`, `.rc-modal-overlay`, `.rc-modal`, `.rc-modal-header`, `.rc-modal-body`, `.rc-modal-footer`. Update HTML templates.

- [ ] **Step 2: Verify** -- Game buttons stay red, rule composer buttons stay blue.

- [ ] **Step 3: Commit** -- `fix(playground): namespace rule-composer CSS to prevent class collisions`

---

## Task 14: Code Quality -- Extract SeededRandom into shared module

**Files:**
- Create: `playground/utils/SeededRandom.js`
- Modify: `playground/games/coup.js`, `hanabi.js`, `liars-dice.js`, `cuttle.js`, `poker.js`

Identical `SeededRandom` class copy-pasted in 5 game files.

- [ ] **Step 1: Create shared module** with `SeededRandom` class including `next()`, `shuffle()`, and `rollDie()` methods.

- [ ] **Step 2: Replace in all 5 game files** -- Delete local class, add import.

- [ ] **Step 3: Commit** -- `refactor(playground): extract SeededRandom into shared utils module`

---

## Task 15: Accessibility -- Add modal focus management

**Files:**
- Create: `playground/utils/focusTrap.js`
- Modify: `playground/components/training-dashboard.js` (ConfigModal, EpisodeDetailModal)
- Modify: `playground/components/rule-composer.js` (modal)
- Modify: `playground/components/token-canvas.js` (modals)

No modals trap focus, return focus, or have dialog ARIA roles. WCAG 2.1 Level A failure.

- [ ] **Step 1: Create focus trap utility** -- `trapFocus(modalElement)` returns a cleanup function. Handles Tab/Shift+Tab wrapping and focus restoration.

- [ ] **Step 2: Add `role="dialog"` and `aria-modal="true"`** to all modal overlays.

- [ ] **Step 3: Wire up focus trap** in each modal's mount/unmount lifecycle via `useEffect` + `useRef`.

- [ ] **Step 4: Commit** -- `feat(playground): add focus trap and ARIA attributes to all modals`

---

## Task 16: Accessibility -- Add ARIA attributes to key components

**Files:**
- Modify: `playground/index.html:1492` (label for game select)
- Modify: `playground/components/state-inspector.js` (tree roles, search label)
- Modify: `playground/components/action-timeline.js` (search label)
- Modify: `playground/components/peer-monitor.js` (collapsible aria-expanded)

Zero ARIA attributes across the entire application.

- [ ] **Step 1: Add `aria-label` for game select** and `.sr-only` CSS class.

- [ ] **Step 2: Add `aria-label` to search inputs** in state-inspector and action-timeline.

- [ ] **Step 3: Add `aria-expanded` to collapsible panels**.

- [ ] **Step 4: Add `aria-live="polite"` and `role="log"` to console output**.

- [ ] **Step 5: Commit** -- `feat(playground): add ARIA attributes for accessibility across IDE panels`

---

## Task 17: Performance -- Reduce polling frequency and optimize state comparison

**Files:**
- Modify: `playground/components/state-inspector.js:282-314`
- Modify: `playground/components/token-canvas.js:913-927`

Both components JSON.stringify entire state every 100ms.

- [ ] **Step 1: Increase poll interval to 500ms** in both files.

- [ ] **Step 2: Eliminate double serialization** in token-canvas.js -- serialize once, compare the string, store for next comparison.

- [ ] **Step 3: Commit** -- `perf(playground): reduce polling frequency and eliminate double serialization`

---

## Task 18: Frontend -- Add `prefers-reduced-motion` and fix font stacks

**Files:**
- Modify: `playground/index.html` (add media query)
- Modify: component JS files (standardize font-family)

Multiple pulse/highlight animations with no motion opt-out. Inconsistent font stacks across components.

- [ ] **Step 1: Add reduced motion query** at end of index.html CSS.

- [ ] **Step 2: Standardize font-family** in component CSS to use `var(--font-mono)`.

- [ ] **Step 3: Commit** -- `feat(playground): add prefers-reduced-motion support and standardize font stacks`

---

## Task 19: Frontend -- Add touch support to resize handles

**Files:**
- Modify: `playground/components/state-inspector.js:480`
- Modify: `playground/components/peer-monitor.js:435`
- Modify: `playground/components/action-timeline.js:257`

All resize handles use only mouse events. Touch devices can't resize panels.

- [ ] **Step 1: Add touchstart/touchmove/touchend** alongside mouse handlers in all three components. Map `e.touches[0]` to the same coordinate format.

- [ ] **Step 2: Commit** -- `feat(playground): add touch support to resize handles for mobile devices`

---

## Task 20: Frontend -- Add loading states and input labels

**Files:**
- Modify: `playground/playground.js:564` (loading state)
- Modify: `playground/components/state-inspector.js` (search label)
- Modify: `playground/components/action-timeline.js` (search label)

No loading indicator when switching games. Search inputs lack labels.

- [ ] **Step 1: Add loading indicator** in `loadGame()` before game creation.

- [ ] **Step 2: Add `aria-label` attributes** to search inputs.

- [ ] **Step 3: Commit** -- `feat(playground): add input labels and loading state for game switching`
