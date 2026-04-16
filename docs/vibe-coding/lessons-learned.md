# Lessons Learned — TradeVibez

Mistakes, surprises, and tips from building a trading app with AI as co-pilot.

---

## Lesson 1: Plan Before You Prompt

**What happened:** We could have jumped straight into "write me a trading app" and gotten code immediately. Instead, we spent the first session planning architecture, defining roles, and documenting decisions.

**Why it matters:** The planning session surfaced critical insights — like the dual WebSocket strategy — that would have been expensive to retrofit later. AI is great at generating code fast, but bad code generated fast is still bad code.

**Tip:** Invest 20% of your time in planning. The AI will generate the remaining 80% faster AND better with clear constraints.

---

## Lesson 2: Skills Files Are Guardrails

**What happened:** Without explicit rules, AI tends to over-engineer — adding state management libraries, theme toggles, error boundaries for impossible scenarios. Skills files with "What NOT To Do" sections prevent this.

**Why it matters:** Constraints make AI more productive, not less. "Don't use external state management" eliminates a category of decisions and keeps the codebase simple.

**Tip:** Write your AI rules as "always do X" AND "never do Y". The negative constraints are equally important.

---

## Lesson 3: API Docs as Context = Massive Time Savings

**What happened:** AI fetched, parsed, and synthesized the entire Deriv API V2 documentation into a single reference file in under 2 minutes. Manually reading through 28 endpoint pages would have taken hours.

**Why it matters:** AI excels at information synthesis. Use it to condense large documentation into actionable references before writing any code.

**Tip:** Always have AI read the API docs first. The insights it extracts (e.g., "public WS needs no auth") directly shape architecture.

---

## Lesson 4: Deploy Early, Even If Incomplete

**What happened:** We couldn't test authentication locally because Deriv requires HTTPS redirect URIs. We had to deploy to Netlify first — with an incomplete app — just to get a public URL for OAuth.

**Why it matters:** Many APIs (not just Deriv) require HTTPS callbacks. If you wait until the app is "ready" to deploy, you'll hit this blocker late in the timeline. Deploy on day 1, test the auth flow, then iterate.

**Tip:** For hackathons, deploy your scaffolding immediately. A live URL with a landing page is better than a perfect local app you can't test.

---

## Lesson 5: AI Code Targets Training Data Versions

**What happened:** AI generated TradingView Lightweight Charts code using the v4 API (`chart.addCandlestickSeries()`). We installed v5, which uses a completely different pattern (`chart.addSeries(CandlestickSeries)`). Build failed.

**Why it matters:** AI models are trained on code from a specific point in time. Libraries evolve. The AI doesn't know which version you installed — it generates what it learned.

**Tip:** When AI-generated code fails on a library call, grep the installed package's `.d.ts` files. The actual TypeScript definitions are the source of truth, not AI's memory.

---

## Lesson 6: Name Collisions Are Inevitable

**What happened:** We renamed the app 3 times. "VibeTrader" was taken on both Netlify and Deriv's app registry. We ended up with "TradeVibez" after AI presented alternatives.

**Why it matters:** Common word combinations (Vibe + Trader, Trade + Hub, etc.) are almost always taken. You'll waste time if you commit to a name across files before checking availability.

**Tip:** Before renaming anything in code, check the name on: Netlify/Vercel, npm, GitHub, and your API provider's app registry. Only rename files after confirming availability everywhere.

---

## Lesson 7: CLI Deploys Bypass Permission Issues

**What happened:** The repo was under a GitHub org (kumaran-deriv). Connecting it to Netlify/Vercel would have required org admin approval. Instead, we used `npx netlify deploy --prod` to deploy directly from the local machine.

**Why it matters:** Org repos often have restricted GitHub App permissions. During a hackathon, you don't have time to wait for admin approval.

**Tip:** Know your deployment alternatives. Netlify CLI, Vercel CLI, and Cloudflare Wrangler all support direct deploys without GitHub integration.

---

## Lesson 8: WebSocket Subscription Cross-talk

**What happened:** Two `useProposal` hooks (CALL + PUT) both listened to the global "proposal" message type. Each hook received the other's updates, and the API errored with "You are already subscribed to proposal."

**Why it matters:** In WebSocket-heavy apps, multiple components often subscribe to the same message type. Without scoping (via req_id or subscription ID), handlers bleed across instances. This is especially dangerous for trading — you could display the wrong price for a contract.

**Tip:** Always scope WebSocket handlers. Use `req_id` for request-response flows and `subscription.id` for streaming updates. Never rely on a single global msg_type listener when multiple instances exist.

---

## Lesson 9: Auth vs Public WebSocket — Read the API Docs First

**What happened:** We built the entire Slice 4 trading UI on the public WebSocket. Proposals worked (public endpoint supports them), but buy/sell/portfolio returned "please login." We had to retrofit an authenticated WebSocket connection after the fact.

**Why it matters:** The Deriv API has distinct endpoints for public vs authenticated operations. This was documented in the API reference from day 1, but we didn't fully implement the dual WS strategy planned in Slice 1's architecture decisions.

**Tip:** When your API docs show separate auth/public endpoints, implement the authenticated connection BEFORE building features that need it. Don't assume you can add auth later — it may require restructuring your provider hierarchy (as it did for us: swapping AuthProvider and WebSocketProvider order).

---

## Lesson 10: API Version Differences — Don't Assume Auth Requirements

**What happened:** We sent `proposal` requests on the public WebSocket, assuming they'd work (as they do in Deriv API V1). In V2, `proposal` is an authenticated endpoint — it returned "Unknown contract proposal" on the public WS.

**Why it matters:** API auth requirements can change between versions. The V2 API has a stricter split: public WS for market data only, authenticated WS for everything trade-related (proposals, buy, sell, portfolio). A one-line fix took hours of debugging because the error message ("Unknown contract proposal") was misleading — it sounded like a wrong contract type, not an auth issue.

**Tip:** When migrating between API versions, don't just check endpoint names — verify auth requirements for every endpoint. Build a matrix of which endpoints work on which connection type.

---

## Lesson 11: Netlify CLI Deploy Workarounds

**What happened:** After working fine for multiple deploys, `npx netlify deploy --prod` started failing with "Failed publishing static content" from `@netlify/plugin-nextjs`. The build itself succeeded — only the plugin's `onPostBuild` step failed.

**Why it matters:** Deploy infrastructure can break independently of your code. Having a workaround ready prevents being blocked.

**Tip:** For Netlify + Next.js, if the plugin fails: build locally with `npm run build`, then deploy with `npx netlify deploy --prod --no-build`. This skips the plugin's build/post-build steps and just uploads the pre-built assets.

---

---

## Lesson 12: "Wait" Is a Valid and Valuable Command

**What happened:** AI started rewriting the entire landing page from scratch when the user's actual intent was to add a games feature ON TOP OF the existing professional page. User said "Wait" and stopped the execution before it went too far.

**Why it matters:** AI will execute confidently even when it has misunderstood the intent. The user's instinct to pause was correct — a full landing page rewrite would have discarded 3 slices of polished work and taken the app in the wrong direction.

**Tip:** When AI starts executing something that feels wrong, stop it immediately. A mid-task interruption is cheaper than a full revert. Then use plan mode to realign before writing any code.

---

## Lesson 13: Additive Features Preserve Existing Value

**What happened:** We debated whether to rebrand around the games concept (full pivot) or keep the professional trading features and add games on top. We chose additive.

**Why it matters:** For a competition, you want judges to see EVERYTHING you built. A full pivot hides earlier work. The additive approach — professional trading + games — gives two compelling angles: technical depth AND creative differentiation.

**Tip:** When adding a new feature to an existing app, default to additive (new route, new section) rather than replacement. Only pivot if the existing feature is genuinely broken or misaligned with the product direction.

---

## Lesson 14: Plan Mode Pays Off on Ambiguous Features

**What happened:** "Add options trading as games" could have meant many things — new page, rebranded existing page, overlay UI, different contract types, different scopes. Two clarifying questions (landing angle + game count) fully resolved the ambiguity before implementation started.

**Why it matters:** Ambiguous prompts produce misaligned code. The plan session took ~5 minutes and produced a written plan the user approved without changes. Implementation then ran straight through with zero course corrections.

**Tip:** For features that touch multiple parts of the app or have multiple valid interpretations, always plan first. The question "what should this look like?" is much cheaper before coding than after.

---

## Lesson 15: Reuse Hooks, Don't Rewrite Them

**What happened:** The games feature needed live prices, contract proposals, WebSocket buy calls, and auth state. We already had `useTicks`, `useProposal`, `useWs`, and `useAuth`. All four worked without modification.

**Why it matters:** When hooks are written with parameters rather than hardcoded concerns, they compose into new features naturally. `useProposal` doesn't care whether it's called from TradePanel or RiseFallGame — it just takes params and returns a live quote.

**Tip:** Before writing a new hook, check if an existing one covers the use case with different params. Param-driven hooks are reusable; component-specific hooks aren't.

---

---

## Lesson 16: Know What You're Paying Per Unit

**What happened:** Netlify's free tier has a "100 credits" limit. We assumed credits = builds (server-side). They're actually credits = deploys. At 15 credits per production deploy, 11 deploys consumed 165 credits — well over the assumed limit — before noticing.

**Why it matters:** Serverless platforms price differently. Netlify charges per deploy. Vercel charges per seat/team feature. Cloudflare charges per request. Read the pricing unit before committing to a platform for a high-iteration project.

**Tip:** For hackathons with many deploys, use Vercel (free tier, unlimited deploys) or Cloudflare Pages. Netlify's credit system is opaque and expensive for rapid iteration workflows.

---

---

## Lesson 17: Request Field Names ≠ Response Field Names

**What happened:** `useProposal` sent `underlying_symbol` in the proposal request, but Deriv API V2 expects `symbol`. The field name `underlying_symbol` came from the `active_symbols` response object — it was copy-pasted into the request without checking. The API returned "Unknown contract proposal" — no indication of a wrong field name.

**Why it matters:** API response shapes and request shapes often differ. A field called `underlying_symbol` in a response object doesn't mean `underlying_symbol` is the parameter name in a request. The error message gave no hint — debugging by trial and error wastes time.

**Tip:** When writing request params, reference the API's *request* docs, not the response object shape. Cross-check field names against a known-working example in the API reference.

---

---

## Lesson 18: Shared Clocks Can Replace Shared State

**What happened:** Needed two players to run the same fight game simultaneously without a database. Three storage solutions were considered and rejected (Upstash, in-memory Map, SQLite). The solution was to realize the game doesn't need shared state — it needs a shared starting signal. A Unix timestamp in a URL is that signal.

**Why it matters:** Developers default to "I need state → I need a store." But when the underlying data source is already synchronized (Deriv tick streams), shared state is redundant. The timestamp in the URL is a coordination message, not a state store. No database, no server, no credentials.

**Tip:** Before building a real-time sync solution, ask: "Is the data source already synchronized?" Tick streams, clocks, and deterministic computation can replace server state. The simpler the infrastructure, the more reliable the system.

---

## Lesson 19: Serverless + In-Memory State = Unreliable at Scale

**What happened:** Used a module-level `Map` in a Next.js API route to store room state. Works perfectly in development (single process). On Vercel, different requests can hit different cold-started instances — each with its own empty Map. Two players could be in different "rooms" with no way to sync.

**Why it matters:** Module-level state in serverless functions is not shared state — it's per-instance local state. This is a well-known serverless footgun. In development it works, in production under any meaningful load it fails silently.

**Tip:** Never use module-level variables as a database in serverless functions. Either use a real store (Redis, database) or architect around statelessness entirely. For a hackathon, the stateless architecture is almost always the better choice.

---

## Lesson 20: R3F Requires `ssr: false` — Don't Forget It

**What happened:** `@react-three/fiber` requires WebGL and `window`. In Next.js App Router, all imports are SSR'd by default. Importing `BearVsBullCanvas` directly caused build errors ("window is not defined", "WebGL not available").

**Why it matters:** Any Three.js / R3F code that runs at import time (module-level) will fail during SSR. This applies to canvas contexts, WebGL, and browser APIs in general.

**Fix:**
```typescript
const BearVsBullCanvas = dynamic(() => import("./BearVsBullCanvas"), { ssr: false });
```
One line. The loading fallback renders server-side; the canvas only renders client-side.

**Tip:** For any browser-only library (Three.js, Web Audio, canvas), `dynamic(() => import(...), { ssr: false })` is the standard Next.js pattern. Put all browser-specific logic in the dynamically imported component, not in the parent.

---

## Lesson 21: `useImperativeHandle` for Canvas-to-Parent Communication

**What happened:** The fight game needed to tell the 3D canvas "a Bull attack happened, animate it." Passing tick events as props would cause re-renders on every tick, potentially dropping frames at 60fps. Lifting canvas animation state to the parent would couple game logic to rendering details.

**Solution:** `useImperativeHandle` + `forwardRef` exposes imperative methods from the R3F canvas to the parent:
```typescript
canvasRef.current.triggerTick(event)   // call from parent
canvasRef.current.triggerKO("bear")    // no re-render triggered
canvasRef.current.triggerVictory("bull")
```
The canvas handles animation internally via refs + `useFrame`. Parent never re-renders due to canvas events.

**Why it matters:** For performance-critical animations, imperative calls are more appropriate than reactive state. React's reconciler isn't designed for 60fps per-frame updates. `useImperativeHandle` provides a clean escape hatch when you need to call methods on a child component without lifting state.

---

## Lesson 22: Combo State Needs Refs, Not State

**What happened:** The combo tracking system (`consecutiveDir`, `consecutiveCount`) initially used `useState`. Inside the tick `useEffect`, the state values were stale (captured at effect creation time). Combos never triggered correctly.

**Fix:** Moved all in-fight tracking to refs:
```typescript
const consecutiveDir = useRef<"up" | "down" | null>(null);
const consecutiveCount = useRef(0);
```
Refs are read/written synchronously in effects without re-render cycles or stale closure issues.

**Why it matters:** In tick-driven game loops, effects fire on every tick. State accessed inside those effects reflects the value at effect creation (the last dependency array change), not the current value. Refs bypass this — they're always current.

**Tip:** For values that change on every tick but don't need to trigger re-renders (HP refs, combo counts, prev quote, etc.), use refs. Only use state for values that need to update the UI.

## Lesson 23: GLB Models Face Their Own Direction — Check Before Rotating

**What happened:** After loading real GLB models for Bull and Bear, both characters faced outward (away from each other) instead of toward each other. The rotations `[0, -Math.PI/2, 0]` and `[0, +Math.PI/2, 0]` were copied from earlier procedural geometry that had a different local orientation. The signs were simply swapped.

**Why it matters:** Every GLB model has a baked-in facing direction determined at export time. You cannot assume a model faces +Z (the Three.js default "forward"). If the model was exported facing +X, rotating by `-PI/2` sends it backward.

**Tip:** When a GLB character faces the wrong direction, think about which world axis you want it to face, then determine what rotation gets its local +Z there. For a model facing +Z by default: rotate `+PI/2` around Y to face +X (right), `-PI/2` to face -X (left).

---

## Lesson 24: GLTF Materials Are Often Dark — Boost All Lights

**What happened:** Ambient light at `intensity={0.5}` looked fine with procedural `MeshToonMaterial` but made real GLTF models nearly invisible. GLTF materials (especially dark-colored ones like the black bear) absorb a lot of light, and the default R3F ambient intensity is far too low for realistic models.

**Why it matters:** Procedural geometries often use emissive or flat-shaded materials that don't depend heavily on scene lighting. GLTF models from tools like Blender use physically-based materials (PBR) that need proper scene lighting to look correct.

**Tip:** When switching from procedural to GLTF characters, expect to double or triple all light intensities. Start with `ambientLight intensity={2.0}` and a `hemisphereLight` for fill. Tune down from there — it's easier to darken than to figure out why a model is invisible.

---

## Lesson 25: Web Audio API Is Enough for Game Sound Effects

**What happened:** Needed 5 distinct sound effects (hit, critical, combo, KO, victory). External audio files would need hosting + CORS + preloading. Instead, built all sounds using Web Audio API oscillators — synthesized in-process, zero dependencies, zero network requests.

**Why it matters:** For a hackathon, managing 5+ audio files (load states, format compatibility, CORS headers) is a distraction. Oscillator-based synthesis produces surprisingly good results for game sounds and ships in 30 lines of code.

**Tip:** Use Web Audio API for game SFX when you need < 6 simple sounds. `AudioContext.createOscillator()` + `exponentialRampToValueAtTime()` handles hit thuds, sweeps, and fanfares. Only reach for audio files when you need recorded sounds (voice, instruments, ambience).

---

## Lesson 26: `<bufferAttribute>` in R3F Needs `args`, Not Flat Props

**What happened:** Added a procedural starfield using `<bufferAttribute attach="attributes-position" array={positions} count={500} itemSize={3} />`. TypeScript build failed: `Property 'args' is missing in type`.

**Why it matters:** React Three Fiber's JSX elements map props to Three.js constructor calls via the `args` prop. `<bufferAttribute>` is `new THREE.BufferAttribute(array, itemSize)` — so the correct JSX is `<bufferAttribute attach="attributes-position" args={[positions, 3]} />`. The `count` and `itemSize` as separate props are not valid on this element.

**Tip:** Whenever you use a Three.js class in R3F JSX, check the constructor signature. The `args` prop corresponds to constructor arguments in order. Flat property names on the JSX element are for *properties* of the instance (like `.color`, `.intensity`), not constructor parameters.

---

## Lesson 27: Identical Visual Metaphor = Perceived as Betting

**What happened:** Dragon Race (two entities racing, pick the winner) triggered a user question "Isnt this betting?" even though the underlying contract is a standard CALL/PUT — the same as Bear vs Bull which the user approved.

**Why it matters:** Dragon Race looks like horse-race gambling. Bear vs Bull looks like a fight. The **visual metaphor** determines whether users perceive it as gambling or entertainment. Racing = gambling association. Fighting = game association — even though the financial contract is identical.

**Lesson:** When building gamified trading, avoid racing/sports-betting visual metaphors even if the underlying contract is identical to approved games. The framing shapes perception more than the mechanics.

---

---

## Lesson 28: Conditionally-Rendered Canvas Components — Don't Call Refs in Click Handlers

**What happened:** `HexColorFillerCanvas` is only rendered when `gameState === "live"`. The launch button handler called `canvasRef.current?.reset(playerSide)` synchronously. At that point `gameState` was still `"idle"` — the canvas hadn't mounted yet, so `canvasRef.current` was `null`. The `neutralKeys` array was never populated, so `claimHex()` returned on every tick and nothing filled.

**Why it matters:** React state updates are asynchronous — `setGameState("live")` schedules a re-render, it doesn't immediately mount children. Calling an imperative ref method in the same synchronous frame as the state change will always hit a null ref.

**Tip:** When you need to call an imperative handle method immediately after a conditional component mounts, put the call in a `useEffect` watching the state that triggered the mount:
```typescript
useEffect(() => {
  if (gameState === "live") canvasRef.current?.reset(side);
}, [gameState]);
```
React guarantees `useEffect` runs after the DOM is committed and children have mounted.

---

## Lesson 29: Short Room Codes Are Better Than URLs for Human Handoff

**What happened:** Multiplayer duel used a full URL (`?duel={base64json}`). The URL was ~80 characters. Hard to share verbally, breaks on origin change, looks intimidating.

**Why it matters:** Any time two humans need to exchange a code in real time (in-person, voice call, chat), shorter is better. A 6-char alphanumeric code is readable, typeable, and works offline.

**Tip:** Bit-pack your session parameters into a 30-bit integer, encode as base36, display as `XXX YYY` (3+3). For symbol+ticks+timestamp, 30 bits is enough for years of sessions. Keep old URL decode as fallback so existing links don't break.

---

---

## Lesson 30: Visual Metaphor Shapes Perception More Than Mechanics

**What happened:** User rejected "Rocket Rise" as the Rise/Fall replacement — despite identical contract logic to the approved Bear vs Bull game. The replacement concept "Tidal Surge" (ocean waves) was approved instantly.

**Why it matters:** A rocket "rising" or "crashing" has a tech-startup connotation — it doesn't map to trading intuitively. An ocean tide rising and falling mirrors how traders describe markets ("the tide is turning," "riding the wave"). The metaphor must feel natural for the financial context, not just visually impressive.

**Tip:** When designing gamified trading experiences, test the metaphor against common trading language. If traders already use the metaphor in speech, it'll feel right in the game. "Riding the wave" = natural. "Launching a rocket" = forced.

---

## Lesson 31: Canvas Handle Interface = Crash-Resistant Contract

**What happened:** Built 4 games in parallel using background agents. 2 agents crashed after writing the Canvas file but before writing the Game file. Recovery was straightforward: the Canvas handle interface (the `useImperativeHandle` methods) defined exactly what the Game file needed to call.

**Why it matters:** When parallelizing with agents, the interface between components is the most important artifact. If an agent crashes after writing the Canvas with `reset()`, `triggerResolve()`, `triggerAlarm()` methods, you can reconstruct the Game file from just those method signatures + established patterns.

**Tip:** Design the imperative handle interface FIRST, before building either Canvas or Game. It's the contract that survives infrastructure failures. Document it in the plan. If an agent crashes, the interface tells you exactly what the missing file needs to implement.

---

## Lesson 32: Type Narrowing from Hook Returns

**What happened:** `useTicks` returns `direction` as `string`, but `TickHistoryItem.dir` expects `"up" | "down" | "flat"`. Assigning `direction || "flat"` to a typed field produced `Type 'string' is not assignable to type '"up" | "down" | "flat"'`.

**Fix:**
```typescript
// BEFORE — TypeScript sees this as string
const dir = direction || "flat";

// AFTER — explicit narrowing
const dir: "up" | "down" | "flat" = direction === "up" ? "up" : direction === "down" ? "down" : "flat";
```

**Why it matters:** Custom hooks often return wider types than their consumers expect. `useTicks` returns `string` because it handles any direction value from the API. Consumers that need a union type must explicitly narrow, not just provide a fallback.

**Tip:** When a hook returns `string` but you need a union type, use conditional assignment (ternary chain) rather than `||` fallback. The `||` approach preserves the `string` type; the ternary produces a typed literal union.

---

## Lesson 33: 2D Canvas + Parallax Can Match 3D Visual Quality

**What happened:** Tidal Surge uses 2D HTML5 Canvas with 4-layer parallax waves. The visual result (ocean depth, wave motion, ship bobbing, moonlit atmosphere) is comparable to 3D Three.js scenes — without the WebGL overhead, bundle size, or SSR issues.

**Why it matters:** Three.js adds ~300KB to the bundle and requires `ssr: false` dynamic imports. For games where the visual metaphor is fundamentally 2D (waves, vaults, boards), 2D Canvas with layering techniques produces equivalent perceived quality at a fraction of the cost.

**Tip:** Before reaching for Three.js, ask: "Does this scene need depth or spatial interaction?" If the answer is "no — it just needs smooth animation and layering," 2D Canvas with parallax is the better tool. Reserve 3D for scenes that need perspective, refraction, or spatial object interaction (like the crystal ball or penalty kick).

---

## Lesson 34: Parallel Agents Are High-Throughput but Fragile

**What happened:** Spawned 4 background agents simultaneously to build 4 games. 2 completed successfully, 2 crashed with "socket connection was closed unexpectedly" — likely due to context window or connection limits.

**Why it matters:** Parallel agents can cut build time from 2 hours to 30 minutes. But the failure rate scales with parallelism. With 4 agents, 50% crashed. The time saved by parallelism was partially offset by manual recovery work.

**Tip:** For parallel agent execution: (1) Design interfaces first so partial work is recoverable, (2) Expect ~50% failure rate for 4+ simultaneous agents, (3) Front-load the simpler/smaller file per agent (Canvas before Game) so the crash-resistant artifact is completed first, (4) Have a manual fallback plan — if an agent crashes, you should be able to write the missing file from the interface contract in 15 minutes.

---

## Lesson 35: Never Trust TypeScript Interfaces for WebSocket Data

**What happened:** Deriv API returns `tick.quote` as a JSON string, but our TypeScript `Tick` interface declared it as `number`. Calling `.toFixed()` on the string crashed TidalSurge at runtime. TypeScript compiled clean — zero errors — but the app crashed in the browser.

**Why it matters:** TypeScript interfaces describe the *expected* shape, not the *actual* shape. JSON doesn't distinguish between `"123.45"` and `123.45` at the type level — both are valid JSON. WebSocket APIs frequently return numbers as strings.

**Tip:** Always coerce at the system boundary (where data enters your app). `Number(value)` in hooks like `useTicks` and `useProfitTable` catches this class of bug before it reaches components.

---

## Lesson 36: Tick Frequency vs Animation Duration = Race Condition

**What happened:** Penalty Shootout with 1HZ markets. Ticks arrive every ~1 second, but goal animations take 800ms. A new tick arriving during the animation was processed as a second kick, corrupting the score.

**Why it matters:** When external event frequency approaches your UI transition duration, you get race conditions. This doesn't happen with slower markets (R_100 ticks every ~2s) but breaks with 1HZ.

**Tip:** Block re-entry at the ref level (synchronous), not with `setState` (async/batched). Set `phaseRef.current = "idle"` immediately when you capture a tick, before any `setTimeout` animations.

---

## Lesson 37: API Response Fields ≠ Your Interface Fields

**What happened:** Our `ProfitTransaction` interface included `profit_loss: number`, but the Deriv `profit_table` API response has no such field. It only returns `buy_price`, `sell_price`, and `payout`. `Number(undefined)` silently became `NaN`, breaking the entire history page.

**Why it matters:** TypeScript interfaces written during planning may assume fields that don't exist. This is especially dangerous because `Number(undefined) === NaN` doesn't throw — it propagates silently through arithmetic, comparisons, and formatting.

**Tip:** When integrating with an external API, log the first raw response object to verify field names match your interface. Better yet, use runtime validation (Zod, io-ts) at the boundary.

---

## Lesson 38: Game Contracts Settle Differently

**What happened:** Standard contracts have `sell_price > 0` when sold. But game contracts (DIGITODD, DIGITEVEN, ONETOUCH) that expire in-the-money have `sell_price: 0` with the winnings in `payout`. Our P&L calculation only looked at `sell_price`, showing all game wins as losses.

**Why it matters:** Different contract types have different settlement mechanics. A single formula doesn't cover all cases.

**Tip:** Use `sell_price || payout` to handle both manually-sold and auto-settled contracts. The fallback chain is: sell_price (for sold contracts) → payout (for expired-in-the-money) → 0 (for expired-out-of-the-money).

---

## Lesson 39: Landing Page Copy Drifts

**What happened:** After building 10 games, the landing page still said "Two intuitive games" and showed preview cards for "Rise or Fall" and "Guess the Digit" — games that no longer existed.

**Why it matters:** The landing page is the first thing judges see. Stale copy creates a disconnect between the promise and the product. Even worse, clicking through to the games page shows completely different games.

**Tip:** Add "audit landing page" to your pre-deployment checklist. Feature counts, game names, and screenshots all need updating when the product evolves.

---

## Lesson 40: 1HZ Markets Transform Game Pacing

**What happened:** Games originally used R_100/R_50 markets (ticks every ~2 seconds). Adding 1HZ markets (1 tick/second) made games noticeably more responsive and engaging. Penalty Shootout kicks resolved faster, Hex Color Filler cells painted more frequently, and overall gameplay felt more dynamic.

**Why it matters:** Market tick frequency directly impacts game UX. Slower ticks create awkward waiting pauses. Faster ticks create excitement. But faster ticks also expose timing bugs (see Lesson 36).

**Tip:** Always offer 1HZ markets for tick-based games. But test your animation and state machine timing at 1-tick-per-second frequency — bugs hidden at 2-second intervals become visible at 1-second intervals.

---

## Lesson 41: Batch Operations Need Systematic Tracking

**What happened:** "Remove cash out from 4 games and add 1HZ markets to all games" touched 7 files with 2 types of changes each. Without a todo list, it would be easy to miss a file or leave a stale `handleCashOut` reference.

**Why it matters:** Cross-cutting changes across many files are error-prone. Each file has slightly different code patterns (some use `useCallback`, some use function declarations, some have info text mentioning cash out).

**Tip:** Use a tracking mechanism (todo list, checklist) for batch operations. Mark each file done as you go. Run type check after each file change — the compiler catches dangling references immediately.
