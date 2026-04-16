# Iterations Log — TradeVibez

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

## App Naming — Three Tries to Find a Unique Name

### Iteration 1: DerivEdge
Original name from initial planning. Clean, professional. User decided to change direction during deployment.

### Iteration 2: VibeTrader
User's choice. Renamed across all files. But: Netlify auto-assigned `vibetrader-f6a3f783` (name taken), and Deriv app registration also blocked the name.

### Iteration 3: TradeVibez
AI presented 4 alternatives (VibeTradex, TradeVibe, VibeTraderX, PulseTrader). User picked TradeVibez. Available on both Netlify and Deriv.

**Takeaway:** Check name availability across ALL platforms before committing. For hackathons, pick something unique enough to avoid collisions — append a distinguishing word or creative spelling.

---

## Deployment — From Vercel to Netlify CLI

### Iteration 1: Vercel (Planned)
Original plan assumed Vercel deployment with GitHub integration.

### Iteration 2: GitHub Pages?
User asked about GitHub Pages since repo is under an org. Rejected — static-only, can't run API routes.

### Iteration 3: Netlify + GitHub
Chosen, but org GitHub permissions made connecting the repo difficult.

### Iteration 4: Netlify CLI Direct Deploy
Final approach. Deploy from local machine, no GitHub integration needed. `npx netlify deploy --prod` builds locally and uploads.

### Final: Working Pipeline
```
Edit code → npx netlify deploy --prod → Live in ~2 min
```

**Takeaway:** Don't fight org permissions during a hackathon. CLI-based deployment removes the GitHub middleman entirely. The trade-off (manual deploys) is fine for a competition.

---

## OAuth Flow — Localhost to HTTPS

### Iteration 1: Localhost Redirect URI
Tried `http://localhost:3000/api/auth/callback` in Deriv app registration. Rejected: "Localhost URLs are not allowed in production."

### Iteration 2: Deploy First, Auth Second
Deployed to Netlify first to get HTTPS URL. Registered `https://tradevibez.netlify.app/api/auth/callback` as redirect URI. OAuth worked on first try.

**Takeaway:** For OAuth-dependent apps, deploy early — even before the app is ready. You need the HTTPS URL to register redirect URIs. Don't waste time trying to make localhost work with OAuth providers that require HTTPS.

---

## useProposal — From Global Listener to Scoped Subscriptions

### Iteration 1: Global msg_type Handler
Initial implementation used `ws.subscribe("proposal", handler)` — a single global listener. When two hook instances existed (CALL + PUT), both received each other's updates, and the API errored with "You are already subscribed to proposal."

### Iteration 2: req_id + Subscription ID Filtering
Split into two handler patterns:
1. **Initial response:** `ws.send(message, callback)` — handled via `req_id`, unique per request
2. **Subscription updates:** `ws.subscribe("proposal", handler)` with `subscription.id` filtering — each hook only processes its own subscription's updates

**Takeaway:** Global WebSocket message handlers break when multiple components subscribe to the same message type. Always scope handlers using unique IDs (req_id for request-response, subscription ID for streaming).

---

## WebSocket — From Public-Only to Dual Connection

### Iteration 1: Single Public WS
All WebSocket operations (market data + trading) went through the public endpoint. Trading operations returned "please login" errors.

### Iteration 2: Dual Public + Authenticated WS
`WebSocketContext` now manages two connections:
- `ws` — public, always connected (market data, proposals, ticks)
- `authWs` — authenticated via OTP, connects when user logs in (buy, sell, portfolio, balance)

Provider order swapped: `AuthProvider` → `WebSocketProvider` → app (so WS context can read auth state).

**Takeaway:** When an API has separate endpoints for public vs authenticated operations, model that split in your connection management. Don't try to multiplex auth + public on the same connection.

---

## TradePanel — Adding Barrier Support

### Iteration 1: No Barriers
All contract types used the same proposal params (amount, basis, duration, symbol). HIGHER/LOWER and ONETOUCH/NOTOUCH returned "invalid barrier" errors.

### Iteration 2: Conditional Barrier Input
Added `needsBarrier` flag to contract pair definitions. When selected contract needs a barrier:
- Shows barrier input field with offset presets (+0.1, +0.5, +1.0, -0.1)
- Passes barrier to `useProposal` params
- Hidden for contract types that don't need it (Rise/Fall, Even/Odd)

**Takeaway:** Not all contract types have the same parameter shape. Read the API docs for each contract type's required fields before building the UI.

---

---

## Landing Page — Professional Kept, Games Teaser Added

### Iteration 1: Premature Full Pivot
AI rewrote the landing page entirely to make "trading as games" the main pitch — new hero, new sections, removed all professional copy. User said "Wait" and stopped execution.

### Iteration 2: Plan-First Alignment
After planning session, the correct approach became clear: keep the professional hero, add games as a secondary feature. The original landing page had been polished across 3 slices — throwing it away would lose that work.

### Final: Additive Approach
Original hero restored ("Execute Trades. Manage Risk. Grow Capital."). New `GamesTeaserSection` inserted between FeatureGrid and HowItWorks. Section uses a 2-col layout: left copy ("Options trading, gamified") + right: 2 game preview cards with hover glow effects. "Games" anchor added to navbar.

**Takeaway:** When a feature is "on top of" existing functionality — not a replacement — the correct implementation is additive. One planning conversation saved a full page rewrite from being discarded.

---

## Games Feature — 4-State Machine Architecture

### Iteration 1: Consider All 4 Games
Initial brief listed 4 games: Rise/Fall, Touch/No Touch, Digits, Higher/Lower. Building all 4 would spread implementation thin.

### Iteration 2: 2-Game Focus
Scoped to Rise/Fall + Digits. These two have the most distinct game mechanics:
- Rise/Fall: direction prediction + countdown timer (visual tension)
- Digits: last-digit focus + tick-by-tick feed (instant feedback loop)

### Final: State Machine Per Game
Each game implements its own typed state machine:

**RiseFallGame:** `"idle" | "confirming" | "live" | "result"`
- idle: full configuration UI with live price preview
- confirming: buy in flight (prevents double-clicks)
- live: circular countdown SVG, live price updates
- result: GameResult shared component

**DigitsGame:** `"idle" | "live" | "result"` (no confirming — ticks start immediately)
- idle: mode selector (Even/Odd vs Match), digit picker, live last-digit preview
- live: scrolling tick feed with each tick's last digit highlighted
- result: GameResult shared component

**Takeaway:** State machines make game UI flows predictable and bug-resistant. Each state renders completely different UI — no conditional spaghetti. The `confirming` state (while buy WS call is in flight) prevents users from clicking twice.

---

## Hooks Reuse — Zero New WebSocket Code

### Before
Assumption: new feature = new hooks needed.

### After
The games feature reused `useTicks`, `useProposal`, `useWs`, and `useAuth` without modification. The existing subscription lifecycle (cleanup on unmount, subscription ID scoping, auth WS routing) worked correctly for the game context.

**Takeaway:** When hooks are written to be general-purpose (params-driven, not component-specific), they compose cleanly into new features. The `useProposal` hook especially — takes params, returns a live quote, works identically for TradePanel and RiseFallGame.

---

---

## Markets Page — Bloomberg Terminal Redesign

### Before
- 3 stat cards + basic grid layout
- Single candlestick chart only
- MarketSelector as a collapsible panel, no search
- Hardcoded dark grays, no CSS variable usage
- Sidebar collapse didn't affect Header or main content (hardcoded `left-60` / `ml-60`)

### After
- Full 2-panel layout: 256px symbol panel (left) + flex chart panel (right), full viewport height
- 5 chart types: Candlestick, Line, Area, Bar, Baseline — underline tab switcher
- Symbol panel: search, market filter tabs, dense rows with live tick prices + status dots
- Bloomberg aesthetic: monospace prices, hair-thin borders, underline active states, depth-layered
- Login banner: dismissable teal strip for unauthenticated users
- Sidebar collapse now synced across Header + main via `SidebarContext`

**Key pattern:** `SidebarProvider` wraps `DashboardLayoutInner` inside `DashboardLayout`. Both `Sidebar` and `Header` read from `useSidebar()`. This fixed the long-standing collapse bug with a single new context file.

---

## Space View — Hero Animation

### Before
Static `ChartMockup` — decorative candlestick bars, no interactivity, no live data.

### After
Live animated orbital system driven by `requestAnimationFrame`:
- Planets = live trading symbols from `useActiveSymbols()`
- Size = proportional to `trade_count` (volume proxy)
- Orbit speed = ring position (inner = faster, outer = slower)
- Color = market type (5 colors)
- Perspective: y-axis compressed by 0.3 → elliptical orbits, 3D feel
- Depth layering: behind-sun pass (dim/small) → sun → front pass (bright/full size)
- Pause on hover: all planets freeze, tooltip shows symbol + name + "Click to open chart"
- Click: routes to `/dashboard?symbol=CODE`

**Key pattern:** Pause/resume without losing position uses `pauseOffsetRef` to accumulate total paused milliseconds, subtracted from raw elapsed. `hoveredRef` keeps the RAF loop closure in sync with React state without re-creating the effect.

---

## Theme System

### Before
`ThemeContext` and `ThemeToggle` existed but were never connected to the app UI. `layout.tsx` hardcoded `data-theme="dark"`. `PriceChart` used hardcoded dark colors. `Header` used hardcoded dark background.

### After
- `ThemeToggle` added to `Header` (icon button, always visible)
- `layout.tsx`: removed `data-theme="dark"`, added inline `<script>` for flash-free init (reads `localStorage` or `prefers-color-scheme` before first paint)
- `PriceChart`: `getChartOpts(isDark)` function, `chart.applyOptions()` called on theme change
- `Header`: `var(--bg-glass)` replaces hardcoded `rgba(8,13,24,0.85)`

**Key pattern:** Flash prevention requires a synchronous inline script before the React hydration — `useEffect` fires too late (after first paint). The script is a one-liner that reads localStorage and sets `data-theme` directly on `<html>`.

---

## Deployment — Netlify → Vercel

### Before
Netlify CLI deploys: 15 credits per production deploy. 11 deploys = 165 credits consumed, ~6 remaining.

### After
Vercel CLI deploys: free tier, no credit system, unlimited deploys. `npx vercel --prod` — auto-detects Next.js, handles all API routes and serverless functions, HTTPS out of the box.

**Deploy command:** `npx vercel --prod`
**Fallback (if rate-limited):** `npx vercel redeploy <deployment-id>`

---

## Trade Page — Terminal Layout Redesign

### Before
- Simple 3-column grid: chart (2 cols) + TradePanel (1 col) + OpenPositions below
- Collapsible symbol picker as a Card overlay
- TradePanel: hardcoded `bg-gray-800`, `border-gray-700`, `text-gray-500` throughout
- OpenPositions: vertical card list with manual refresh
- Critical bug: `useProposal` sent `underlying_symbol` in request (should be `symbol`) — all proposals failed

### After
- Full terminal layout: `noPadding` DashboardLayout, `height: calc(100vh - 64px)`
- Symbol header bar (48px): live tick price, open/closed badge, chart type underline tabs, toggleable symbol panel
- Slide-in left panel (256px): MarketSelector embedded inline
- Chart: `flex-1 min-w-0`, fills all remaining center space
- TradePanel (320px fixed right): CSS variables, sectioned layout with Bloomberg-style 10px uppercase headers
- OpenPositions: horizontal scrollable card strip at the bottom (200px max height)
- `ProposalCard` sub-component handles buy/sell proposal display + execution
- Fixed: `useProposal.ts` — `underlying_symbol` → `symbol` (critical API bug)

**Takeaway:** Separate request and response field naming caused a silent bug that blocked all trading. The terminal layout (symbol panel + chart + trade panel + positions strip) is the industry-standard layout for good reason — everything needed is visible simultaneously.

*(More iterations will be documented as features are built)*

---

## Bear vs Bull — Multiplayer Storage: 3 Approaches, 1 Winner

### Iteration 1: Upstash Redis (Planned)
Initial plan used Upstash Redis REST API for room state — free tier, no SDK, just `fetch`. Configuration looked clean until we realised: user has no Upstash account, and creating one mid-session during a hackathon adds friction and a new credential to manage.

### Iteration 2: In-Memory Map (Module-Level)
Switched to a module-level `Map<string, GameRoom>` in a Next.js API route. Works in development and on a single warm serverless instance. But this raised the question: "What if players hit different server instances?" On Vercel, cold starts and multiple concurrent instances can exist — two rooms could exist in separate processes, invisible to each other.

### Iteration 3: SQLite (User's Suggestion)
User asked "can we use SQLite?" Possible in development, but serverless filesystems are either ephemeral (Vercel), read-only, or not shared across instances. A SQLite DB file on Vercel would work for one instance only — same problem as the Map.

### Final: URL-Based Epoch Sync (Zero Server State)
**Insight:** Deriv tick streams are already a synchronized data source. Both players subscribing to `R_100` receive the same ticks at the same epoch timestamps — deterministically. The only coordination needed is "when to start."

Solution: embed all game settings + a future `startAt` Unix timestamp in a base64 URL param. Host generates `/games?duel=<encoded>`. Guest opens it. Both count down to the same timestamp. Both subscribe to the same symbol. Same fight, zero server state.

**Result:** 100% reliable, zero external services, works across any number of Vercel instances because there IS no server state to share.

**Takeaway:** Before reaching for a database, ask "does this data actually need a server?" Shared clocks + deterministic computation can replace shared state entirely.

---

## Bear vs Bull — 3D Game: Architecture Choices

### Iteration 1: CSS Animations Only
Initially considered just CSS transitions for fight animations (transform, scale). Quick to implement but limited — can't do 3D depth, spatial positioning, sparkle effects, or smooth organic movement.

### Iteration 2: React Three Fiber
`@react-three/fiber` wraps Three.js in React's component model. Characters are procedural geometry (no GLTF files to manage). `MeshToonMaterial` gives the cel-shaded cartoon look with one line. `<Sparkles>` from `@react-three/drei` handles impact effects without custom particle code.

**Key constraint:** Three.js requires `window` and `WebGL` — must be dynamically imported with `ssr: false` in Next.js. `BearVsBullCanvas` is wrapped in `dynamic(() => import(...), { ssr: false })` inside `BearVsBullGame`.

### Animation System
`useImperativeHandle` exposes `triggerTick`, `triggerKO`, `triggerVictory` from the canvas to the parent game logic. This avoids prop drilling tick events down into the R3F tree. The parent calls `canvasRef.current.triggerTick(event)` and the canvas handles the animation internally.

`useFrame` reads from refs (not state) to avoid stale closure problems at 60fps. Animation state (`idle | attack | hit | ko | victory`) is tracked in refs per character.

---

## Bear vs Bull — Duel Mode: Settings Flow

### Iteration 1: Pass Full DuelConfig to BearVsBullGame
For solo mode, `BearVsBullGame` shows full settings (market, ticks, side, stake). For duel mode, market/ticks/side come from the lobby config — only stake is player-chosen.

### Final: Optional `duelConfig` Prop
`BearVsBullGame({ duelConfig?: DuelConfig })` detects duel mode via the optional prop:
- If `duelConfig` is present → show a compact locked-settings screen (market/ticks/side displayed as read-only, stake picker active)
- If absent → show the full solo settings screen

URL auto-detection in `games/page.tsx`: if `window.location.search.includes("duel=")`, auto-opens the group game lobby. Guests who click the share link land directly in the join flow without any extra navigation.

---

## Bear vs Bull — GLTF Character Calibration

### Problem
After switching to real GLB models (Bull.glb + Black bear.glb), three visual issues appeared:
- Arena too dark — `ambientLight intensity={0.5}` insufficient for dark-material GLTF models
- Bull too large — `scale={1.8}` on a model with geometry in ~0.01 unit space was enormous
- Characters facing outward — rotation signs were inverted; each model faced away from the other

### Root Cause: Default Model Orientation
GLB models have their own facing direction baked in at export time. The bull faces +Z by default. Rotating by `-Math.PI/2` turns it -90° to face -X (away from the bear at +X). The correct rotation to face +X is `+Math.PI/2`. The bear had the same problem in reverse.

### Final Values
- Bull: `scale={0.58}`, `rotation={[0, Math.PI/2, 0]}`
- Bear: `scale={0.22}`, `rotation={[0, -Math.PI/2, 0]}`
- Ambient: `intensity={2.0}` + `hemisphereLight` for fill

**Lesson:** When a GLB character faces the wrong direction, don't guess rotations — think about the model's local +Z axis and which world axis it needs to face. Rotation is `π/2 * sign`.

---

## Bear vs Bull — Sound + Tick Transparency

### Sounds: Web Audio API over External Files
External audio files (MP3/OGG) would need hosting, CORS handling, and load time. Web Audio API oscillators are synthesized in-process with zero dependencies. For a game with 5 distinct sound types, the oscillator approach is faster to build and ship.

Pattern used — each sound is a one-shot oscillator:
```typescript
const osc = ctx.createOscillator(), gain = ctx.createGain();
osc.connect(gain); gain.connect(ctx.destination);
osc.frequency.setValueAtTime(startHz, ctx.currentTime);
osc.frequency.exponentialRampToValueAtTime(endHz, ctx.currentTime + duration);
gain.gain.setValueAtTime(volume, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
```

### Tick Feed: Proof of Fairness
The tick feed overlay answers the question "is this real?" — players can see the exact Deriv prices driving the fight in real time. This is critical for a trading game: it establishes trust that the outcome isn't random, it's the market.

Design: 8-row scrolling list, newest at top, older rows fade out. Color matches the fight (green = bull attack, red = bear attack). Disappears on result to let the outcome card dominate.

---

## Hex Color Filler — Canvas Initialization Timing Bug

### Iteration 1: Synchronous reset() in click handler
Called `canvasRef.current?.reset(playerSide)` in `handleLaunch()`. Canvas is conditionally rendered — it only mounts after `setGameState("live")` triggers a re-render. So `canvasRef.current` is always `null` at the time of the call. `neutralKeys` stays empty. `claimHex()` returns immediately on every tick. No hexes fill.

### Iteration 2 (Fix): Mount useEffect + gameState useEffect
Two-part fix:
1. `HexColorFillerCanvas` calls `rebuild()` in a mount `useEffect` — populates `hexMapRef` and `neutralKeys` the moment the canvas mounts, regardless of whether `reset` was called
2. `HexColorFillerGame` calls `canvasRef.current?.reset(playerSideRef.current)` in a `useEffect` watching `gameState` — fires after React commits the new render (canvas is mounted by then)

```typescript
// Canvas
useEffect(() => { rebuild(); }, []);

// Game
useEffect(() => {
  if (gameState === "live") canvasRef.current?.reset(playerSideRef.current);
}, [gameState]);
```

**Takeaway:** Any time you conditionally render a canvas/ref component and need to call an imperative method on it right after mount, the click handler is too early — use a `useEffect` in the parent that watches the state that triggered the render.

---

## Multiplayer Room Code — URL → 6-char Code

### Iteration 1: Full URL sharing
Host generated `{origin}/games?duel={base64json}`. Guest pasted the full URL. Problems: URL is ~80 chars, awkward to type, breaks if origin changes.

### Iteration 2: 6-char base36 code
Bit-pack `symbolIdx (2 bits) + ticksIdx (2 bits) + secondsSinceEpoch (26 bits)` = 30 bits. `.toString(36).toUpperCase().padStart(6,'0')`. Display as `B8H VNK` (3+3 split). Max encodable value = ~738M, well within 36^6 = 2.18B.

Benefits: memorable, easy to read aloud, no URL dependency, decodes deterministically on any client. Kept legacy base64 URL decode as fallback for back-compat.
