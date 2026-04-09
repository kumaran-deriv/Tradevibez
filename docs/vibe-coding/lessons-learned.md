# Lessons Learned — DerivEdge

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

*(More lessons will be added throughout the build)*
