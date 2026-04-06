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

*(More decisions will be added as we build)*
