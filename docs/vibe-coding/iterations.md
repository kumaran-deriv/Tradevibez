# Iterations Log — DerivEdge

Before/after evolution of features, components, and approaches. Shows how the app improved through AI-assisted iteration.

---

## Project Structure

### Iteration 1: Initial Brainstorm
We started with a generic "build a trading app" request. AI produced a monolithic plan that tried to cover everything at once.

### Iteration 2: Role-Based Approach
Split the AI into 3 roles with skills files (Full-Stack Engineer, Product Designer, AI Architect). Each role has strict boundaries and rules. This produced more focused, consistent output.

### Final: Phased Build Plan
7 phases, each building on the previous. Skills files enforce consistency. Vibe-coding docs maintained as a live artifact, not an afterthought.

**Takeaway:** Constraining the AI with role-specific rules produces better results than giving it unlimited freedom.

---

## PriceChart — Lightweight Charts v5 Migration

### Iteration 1: v4 API (AI's First Attempt)
AI generated chart code using `chart.addCandlestickSeries({...})` — the Lightweight Charts v4 pattern. This is what AI training data contained.

```typescript
// BEFORE (v4 API — failed to compile)
const series = chart.addCandlestickSeries({
  upColor: "#22c55e",
  downColor: "#ef4444",
});
```

Build error: `Property 'addCandlestickSeries' does not exist on type 'IChartApi'`.

### Iteration 2: Investigate v5 API
Grepped the installed package's `.d.ts` file to find the new API shape. v5 uses a series definition pattern:

```typescript
// AFTER (v5 API — compiles and works)
import { CandlestickSeries } from "lightweight-charts";
const series = chart.addSeries(CandlestickSeries, {
  upColor: "#22c55e",
  downColor: "#ef4444",
});
```

### Final: Clean build with v5 API
One import change + one method call change. The options object stayed identical.

**Takeaway:** AI generates code for the library version it was trained on, not the version you installed. When a build fails on a library API, grep the installed `.d.ts` files — the actual types are the source of truth.

---

## MarketSelector — TypeScript Strict Mode Catch

### Iteration 1: Narrow Type Inference
`MARKET_GROUPS` used `as const`, making each `key` a string literal union. `useState(MARKET_GROUPS[0].key)` inferred the state type as `"synthetic_index"` — too narrow for `setActiveMarket(group.key)` where `group.key` could be any of the union members.

### Final: Explicit Generic
```typescript
// Fix: widen the type explicitly
const [activeMarket, setActiveMarket] = useState<string>(MARKET_GROUPS[0].key);
```

**Takeaway:** `as const` + `useState` can create overly narrow types. When state needs to hold any value from a union, add an explicit generic.

---

*(More iterations will be documented as features are built)*
