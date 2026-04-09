# Architecture Decisions — DerivEdge

Record of AI-assisted architecture decisions, trade-offs considered, and reasoning.

---

## Decision 1: Next.js over Vite + React

**Context:** Needed a React framework for a trading app deployed on Vercel.
**Options considered:**
1. **Next.js 15** — SSR, API routes, built-in Vercel deploy
2. **Vite + React** — Lighter, faster dev, needs separate API server
3. **Create React App** — Familiar but outdated, no SSR

**Decision:** Next.js 15 with App Router
**Reasoning:** API routes eliminate the need for a separate backend. OAuth token exchange MUST happen server-side — Next.js API routes handle this natively. Vercel deployment is zero-config. The trade-off is a slightly heavier framework, but for a competition with a deadline, convenience wins.

**AI's role:** Presented all three options with trade-offs. Recommended Next.js for the API routes + Vercel angle, which aligned with our server-side token exchange requirement.

---

## Decision 2: No Separate Backend

**Context:** Trading app needs server-side logic for OAuth and OTP generation.
**Options considered:**
1. **Separate Express/Node server** — Full control, more infrastructure
2. **Next.js API routes** — Co-located, simpler deploy
3. **Serverless functions (standalone)** — Flexible but harder to manage

**Decision:** Next.js API routes only
**Reasoning:** We only need 3 server-side operations: OAuth callback, token exchange, and OTP generation. These map perfectly to API routes. No database, no sessions to manage server-side, no reason for a full backend.

**AI's role:** Identified that our server-side needs were minimal (3 operations) and recommended against over-engineering.

---

## Decision 3: Dual WebSocket Strategy (Public + Authenticated)

**Context:** Deriv API V2 has separate WebSocket endpoints for public data and authenticated trading.
**Options considered:**
1. **Single authenticated WS for everything** — Simpler code, but requires login to see any data
2. **Public WS first, add authenticated WS after login** — Users see live market data immediately
3. **REST polling for market data** — Simpler but not real-time

**Decision:** Dual WebSocket — public for market data, authenticated for trading
**Reasoning:** Users should see live prices the moment they open the app, even before logging in. This creates a "wow" first impression and demonstrates real-time capability. The public WS is free (no auth overhead). After login, we add the authenticated WS for trading operations.

**AI's role:** Discovered during API doc research that the public WebSocket endpoint requires zero authentication. This insight directly shaped the dual-WS architecture.

---

## Decision 4: React Context over State Management Library

**Context:** Need shared state for WebSocket connections, auth tokens, and subscriptions.
**Options considered:**
1. **Redux / Zustand** — Powerful but adds dependency and boilerplate
2. **React Context + hooks** — Built-in, sufficient for our needs
3. **Jotai / Recoil** — Atomic state, good for reactive updates

**Decision:** React Context with custom hooks
**Reasoning:** We have exactly 2 pieces of shared state: auth status and WebSocket connections. Both are singleton resources, not complex state trees. Context handles this perfectly. Custom hooks (`useTicks`, `useBalance`, etc.) encapsulate subscription logic cleanly. Adding a state library for 2 contexts is over-engineering.

**AI's role:** Enforced the "no external state management" rule from the skills file. Correctly identified that our state needs are simple enough for Context.

---

## Decision 5: Dark Theme Only

**Context:** Trading apps need a theme system.
**Options considered:**
1. **Dark + light theme with toggle** — More work, user preference
2. **Dark theme only** — Industry standard, ship faster
3. **System preference detection** — Automatic but still need both themes

**Decision:** Dark theme only, no toggle
**Reasoning:** Every serious trading platform is dark-themed (Binance, TradingView, Bloomberg Terminal). Building two themes doubles the CSS work for a feature traders don't want. For a hackathon with 10 days, we ship one polished dark theme.

**AI's role:** Product Designer skills file enforced this decision upfront, preventing scope creep.

---

## Decision 6: Netlify Over Vercel / GitHub Pages

**Context:** Need to deploy with a public HTTPS URL for Deriv OAuth redirect. Repo is under an org account (kumaran-deriv).
**Options considered:**
1. **Vercel** — Best Next.js support, but requires connecting org GitHub repo
2. **GitHub Pages** — Free, but static-only — can't run API routes for token exchange
3. **Netlify (CLI deploy)** — Supports Next.js serverless functions, deploy from local without GitHub connection
4. **Cloudflare Pages** — Good alternative but less familiar

**Decision:** Netlify with CLI deployment
**Reasoning:** The org repo restriction ruled out easy Vercel/Netlify GitHub integration. GitHub Pages can't run serverless functions (needed for secure token exchange). Netlify CLI lets us deploy directly from the local machine with `npx netlify deploy --prod` — zero GitHub connection required. Serverless functions handle our 4 API routes perfectly.

**AI's role:** Presented all options with trade-offs. When GitHub integration was blocked, pivoted to CLI deployment as the path of least resistance. Handled the Netlify Blobs error (known issue) by linking the site first.

---

## Decision 7: App Name — TradeVibez

**Context:** Needed a unique name across Netlify, Deriv app registry, and GitHub.
**Iterations:**
1. "DerivEdge" → original name, but pivot requested
2. "VibeTrader" → taken on Netlify (auto-assigned suffix)
3. "VibeTrader" → also taken on Deriv app registration
4. **"TradeVibez"** → unique on all platforms

**Decision:** TradeVibez
**Reasoning:** Available everywhere, memorable, conveys the "vibe-coding" theme of the competition.

**AI's role:** Presented 4 alternatives with previewed Netlify domains. The user chose based on uniqueness + feel.

---

## Decision 8: OAuth Token Storage — sessionStorage

**Context:** After OAuth token exchange, where to store the access token?
**Options considered:**
1. **httpOnly cookie** — Most secure, but requires server-side session management
2. **sessionStorage** — Cleared on tab close, simple, client-accessible
3. **localStorage** — Persists across sessions, but XSS-vulnerable for tokens

**Decision:** sessionStorage
**Reasoning:** Token expires in 3600s and there's no refresh token mechanism in Deriv API. Persisting across sessions (localStorage) would store expired tokens. httpOnly cookies would need server-side session infrastructure we don't want. sessionStorage is the right fit: token lives as long as the tab, auto-clears on close.

**AI's role:** Made this decision in the AuthContext implementation. The trade-off (user re-authenticates per session) is acceptable for a competition demo.

---

## Decision 9: Dual WebSocket — Public + Authenticated

**Context:** Trading operations (buy, sell, portfolio) returned "please login" errors because the app only used the public WebSocket.
**Options considered:**
1. **Single auth WS** — Replace public WS with authenticated one after login
2. **Dual WS** — Keep public WS for market data, add authenticated WS for trading
3. **Auth token in message** — Send token with each request on public WS

**Decision:** Dual WebSocket (option 2)
**Reasoning:** The Deriv API V2 has distinct WS endpoints: `/ws/public` (no auth) and `/ws/demo?otp=...` (authenticated). You can't send auth tokens on the public endpoint. Replacing the public WS would break market data during OTP fetch. Dual connections let market data flow uninterrupted while trading uses its own authenticated channel.

**Implementation:** `WebSocketContext` manages both. Public WS connects on mount. Auth WS connects when `AuthProvider` provides a token + account — it fetches an OTP via `/api/deriv/otp`, then connects to the OTP URL. Provider order swapped: `AuthProvider` wraps `WebSocketProvider` so WS context can read auth state.

**AI's role:** Identified the root cause from user's error report, researched the API docs for the OTP flow, and implemented the dual WS architecture with proper lifecycle management.

---

---

## Decision 10: Games Feature Is Additive — Not a Replacement

**Context:** Wanted to differentiate the hackathon submission with a gamified trading experience, but the professional trading features (CFDs, charts, history) were already built and polished.
**Options considered:**
1. **Full pivot** — Replace the landing page and rebrand entirely around games
2. **Additive** — Keep all existing features, add `/games` as a new page, add teaser to landing

**Decision:** Additive — new `/games` route alongside existing pages
**Reasoning:** Three slices of professional trading work were already done. Replacing it would discard proven functionality and risk breaking what works. Games as an additional layer gives judges two things to evaluate: professional-grade trading AND a creative differentiator. The landing page teaser bridges both audiences.

**AI's role:** Initially started executing a full pivot. User caught it with "Wait." After a planning session and two clarifying questions, the additive approach was chosen. The plan was approved without changes.

---

## Decision 11: Rise/Fall + Digits (2 Games, Not 4)

**Context:** Deriv supports many contract types that could become games — Rise/Fall, Touch/No Touch, Digits, Higher/Lower, Accumulators.
**Options considered:**
1. **All 4 core games** — More variety, but shallower implementation
2. **2 games: Rise/Fall + Digits** — Deep, polished, distinct mechanics
3. **1 game only** — Maximum polish, less demo variety

**Decision:** 2 games — Rise/Fall and Guess the Digit
**Reasoning:** These two have the most distinct game mechanics:
- Rise/Fall: real-time countdown, directional prediction, binary outcome — most familiar to non-traders
- Digits: tick-by-tick last-digit feed, mode variety (Even/Odd + Match), fast feedback loop — uniquely Deriv

Two games gives judges enough variety to see the pattern without the time cost of building four.

**AI's role:** Presented the options with reasoning. User confirmed "2 games: Rise/Fall + Digits" as the recommended choice.

---

---

## Decision 12: SidebarContext for Collapse State

**Context:** Sidebar had local `collapsed` state. `Header` (`left-60`) and `DashboardLayout` (`ml-60`) were hardcoded — sidebar collapse had no visual effect on layout.
**Options considered:**
1. **Prop drilling** — DashboardLayout owns state, passes to Sidebar + Header
2. **SidebarContext** — new context file, both Sidebar and Header read from it
3. **CSS custom properties** — Sidebar sets `--sidebar-w` on `:root`, others use `left: var(--sidebar-w)`

**Decision:** SidebarContext
**Reasoning:** Matches existing pattern (AuthContext, WebSocketContext, ThemeContext). Avoids prop drilling through DashboardLayout → Header. One new file, clean separation. The provider/consumer split — `DashboardLayout` renders `SidebarProvider`, `DashboardLayoutInner` consumes `useSidebar()` — is the standard pattern for a component that must both provide and consume the same context.

---

## Decision 13: requestAnimationFrame for Space View Animation

**Context:** Space View needed 25 planets orbiting simultaneously. Options for animation:
1. **CSS keyframes** — requires unique `@keyframes` per planet speed, messy with dynamic data
2. **CSS custom properties + shared keyframe** — clever but limited (can't do perspective depth or pause-on-hover cleanly)
3. **requestAnimationFrame + useState** — JS-driven, full control, ~60fps re-renders
4. **requestAnimationFrame + direct DOM manipulation** — most performant, but bypasses React

**Decision:** requestAnimationFrame + useState
**Reasoning:** 25 planets × 60fps re-renders is well within React 18's concurrent rendering budget. Full control over pause/resume, depth scaling, and perspective math. Direct DOM manipulation would require refs for every planet and lose the declarative React model for tooltips and click handlers.

**Pause pattern:** `pauseOffsetRef` accumulates total paused milliseconds; effective elapsed = `(rawTs - start - pauseOffset) / 1000`. `hoveredRef` keeps the RAF closure in sync with React's `hovered` state without re-creating the effect on every hover change.

---

## Decision 14: Vercel over Netlify for Production

**Context:** Netlify charges ~15 credits per production deploy. After 11 deploys (165 credits), remaining budget was ~6 more deploys before the competition deadline.
**Options considered:**
1. **Stay on Netlify, deploy less frequently** — risky, blocks testing
2. **ngrok for local OAuth testing** — not available in this environment
3. **Vercel** — free tier, unlimited deploys, native Next.js support
4. **Cloudflare Pages** — also free, but requires different build config

**Decision:** Vercel
**Reasoning:** Made by the Next.js team — zero config, all API routes and serverless functions work out of the box. No per-deploy charges. CLI deploy (`npx vercel --prod`) mirrors the Netlify CLI workflow exactly. Migration took one command.

**Note:** Netlify URL (`tradevibez.netlify.app`) remains live but should not receive new deploys.

---

---

## Decision 15: URL-Based Epoch Sync for Multiplayer (Zero Server State)

**Context:** Bear vs Bull Duel needs two players to watch the same fight. Options considered for syncing game state:
1. **Upstash Redis** — persistent, globally consistent, but requires account/credentials
2. **In-memory Map in API route** — zero setup, but unreliable across serverless instances
3. **SQLite** — familiar, but filesystem not shared across serverless instances
4. **URL-based epoch sync** — no server state at all

**Decision:** URL-based epoch sync
**Reasoning:** Deriv tick streams are naturally synchronized. Two clients subscribing to `R_100` at the same time receive identical tick sequences with identical epoch timestamps. Game outcomes are 100% deterministic from tick data. The only thing that needs coordination is "when to start counting ticks" — solvable by embedding a future Unix timestamp in the shareable URL.

**How it works:**
1. Host picks settings → generates `/games?duel=<base64(symbol+ticks+startAt)>` (startAt = now + 45s)
2. Guest opens URL → decodes config → sees countdown to same timestamp
3. Both clients subscribe to Deriv ticks independently at startAt
4. Same tick stream → same damage → same HP → identical fight on both screens
5. Each player buys their own Deriv contract independently

**No server state required whatsoever.** Works across any number of Vercel instances. No database, no Redis, no SSE needed for game sync.

**AI's role:** After three storage options were explored and rejected, recognized that the Deriv tick stream was already the synchronization primitive. The URL is just a coordination message, not a state store.

---

## Decision 16: React Three Fiber for 3D Fight Scene

**Context:** Bear vs Bull game needs animated 3D characters. Options:
1. **CSS 3D transforms** — no depth, no lighting, no particles
2. **Pixi.js / Phaser** — 2D game engines, not 3D
3. **Three.js directly** — full power, but imperative API, hard to integrate with React lifecycle
4. **React Three Fiber** — React bindings for Three.js, declarative components

**Decision:** React Three Fiber (`@react-three/fiber`) + `@react-three/drei`
**Reasoning:** R3F wraps Three.js in React's component model — characters are React components with `<mesh>`, `<boxGeometry>`, `<meshToonMaterial>`. No scene management boilerplate. `MeshToonMaterial` gives cel-shading for the low-poly cartoon look in one prop. `@react-three/drei`'s `<Sparkles>` handles impact particles. `useFrame` handles 60fps animation with ref-based state to avoid stale closures.

**Key constraint handled:** Three.js requires `window` and WebGL context — can't run during Next.js SSR. `BearVsBullCanvas` is dynamically imported with `ssr: false`.

**Animation pattern:** `useImperativeHandle` exposes `triggerTick`, `triggerKO`, `triggerVictory` methods from the canvas to the parent game logic. Parent calls canvas methods; canvas handles animation internally. Avoids prop-drilling tick events through the R3F component tree.

---

## Decision 17: Games Page — Two-Section Layout

**Context:** Games page originally had a tab switcher (Rise/Fall | Digits). Adding Bear vs Bull solo + Bear vs Bull Duel multiplayer made tabs inadequate.
**Options considered:**
1. **More tabs** — doesn't differentiate solo vs multiplayer
2. **Separate pages** — extra routing complexity
3. **Two sections (Solo + Group)** — one page, clear separation, expandable

**Decision:** Single page with `SOLO GAMES` and `GROUP GAMES` sections, each with game cards that expand inline on click.

**Reasoning:** Judges see everything on one scroll. Solo and multiplayer are meaningfully different categories (one player vs real opponent). Section headers with dividers communicate the distinction visually. Expandable cards keep the URL stable while showing different games.

**URL auto-routing:** If the URL contains `?duel=`, the page auto-opens the group game lobby, so share links from GameLobby route guests directly to the join flow without extra navigation steps.

*(More decisions will be added as we build)*
