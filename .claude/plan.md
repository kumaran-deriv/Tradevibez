# DerivEdge — Full Project Plan

## 🏗️ Architecture Overview

**Stack:** Next.js 15 + Tailwind CSS v4 + Deriv API V2 (REST + WebSocket)
**Deploy:** Vercel
**App ID:** 1089 (test/default)

### Data Flow
```
User → Next.js App → OAuth 2.0 PKCE → Deriv Auth
                   → REST API → Account management, OTP generation
                   → WebSocket (public) → Market data, ticks (no auth)
                   → WebSocket (authenticated via OTP) → Trading, portfolio, balance
```

### Key Design Decisions
- **No separate backend** — Next.js API routes handle server-side logic (token exchange, OTP)
- **WebSocket managed client-side** — React context for shared connection state
- **Demo account first** — Safe trading, easy testing, quick demo
- **Progressive enhancement** — Public data works without login, trading requires auth

---

## 📁 Project Structure

```
derivedge/
├── .claude/
│   └── skills/                    # Role-specific AI skill files
│       ├── fullstack-engineer.md
│       ├── product-designer.md
│       └── ai-architect.md
├── docs/
│   └── vibe-coding/               # Competition deliverable
│       ├── README.md              # Vibe-coding overview
│       ├── architecture.md        # AI-assisted architecture decisions
│       ├── prompts-log.md         # Prompts used + outcomes
│       ├── iterations.md          # Before/after iterations
│       └── lessons-learned.md     # Mistakes, fixes, improvements
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with providers
│   │   ├── page.tsx               # Landing / login page
│   │   ├── globals.css            # Tailwind imports + custom styles
│   │   ├── dashboard/
│   │   │   └── page.tsx           # Main trading dashboard
│   │   ├── trade/
│   │   │   └── page.tsx           # Trade execution page
│   │   ├── history/
│   │   │   └── page.tsx           # Trade history + analytics
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── callback/route.ts   # OAuth callback handler
│   │       │   └── token/route.ts      # Token exchange
│   │       └── deriv/
│   │           └── otp/route.ts        # OTP generation for WebSocket
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── trading/
│   │   │   ├── MarketSelector.tsx      # Symbol/market picker
│   │   │   ├── PriceChart.tsx          # TradingView lightweight charts
│   │   │   ├── TradePanel.tsx          # Buy/sell with contract config
│   │   │   ├── ProposalCard.tsx        # Live proposal pricing
│   │   │   └── OpenPositions.tsx       # Active contracts
│   │   ├── account/
│   │   │   ├── BalanceDisplay.tsx
│   │   │   ├── TradeHistory.tsx
│   │   │   └── ProfitLossChart.tsx
│   │   ├── analytics/
│   │   │   ├── WinRateCard.tsx
│   │   │   ├── PnLSummary.tsx
│   │   │   └── RiskMeter.tsx           # Innovation feature
│   │   └── ui/                         # Shared UI primitives
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Badge.tsx
│   │       └── Spinner.tsx
│   ├── context/
│   │   ├── AuthContext.tsx             # Auth state + token management
│   │   └── WebSocketContext.tsx        # WS connection + subscriptions
│   ├── hooks/
│   │   ├── useWebSocket.ts            # Core WS hook
│   │   ├── useTicks.ts                # Real-time price ticks
│   │   ├── useProposal.ts             # Live proposal pricing
│   │   ├── useBalance.ts              # Account balance subscription
│   │   ├── usePortfolio.ts            # Open positions
│   │   └── useTradeHistory.ts         # Profit table / statement
│   ├── lib/
│   │   ├── deriv-api.ts               # REST API client
│   │   ├── deriv-ws.ts                # WebSocket connection manager
│   │   ├── auth.ts                    # PKCE helpers, token utils
│   │   └── constants.ts               # App ID, WS URLs, market configs
│   ├── types/
│   │   └── deriv.ts                   # TypeScript types for API
│   └── utils/
│       ├── formatters.ts              # Currency, date, number formatting
│       └── analytics.ts               # P&L, win rate calculations
├── .env.local                         # DERIV_APP_ID, secrets
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── CLAUDE.md                          # Project instructions for Claude
└── README.md
```

---

## 🎭 Skills Files (3 Roles)

### 1. Full-Stack Engineer (`fullstack-engineer.md`)
**Scope:** All code implementation, API integration, WebSocket handling, error handling, performance
**Rules:**
- Write TypeScript throughout, strict mode
- Use Next.js App Router patterns (server components where possible, client only when needed)
- WebSocket: single connection, multiplexed subscriptions, auto-reconnect with exponential backoff
- API calls: proper error handling, loading states, type-safe responses
- No over-engineering — minimal abstractions, no premature optimization
- Keep components under 150 lines; extract hooks for logic
- Environment variables for all config (app_id, URLs)

### 2. Product Designer (`product-designer.md`)
**Scope:** UI/UX decisions, layout, component design, responsive design, accessibility
**Rules:**
- Dashboard-first layout: sidebar nav + main content area
- Dark theme (trading apps convention) with Tailwind
- Mobile-responsive but desktop-optimized (trading is desktop-heavy)
- Real-time data should feel alive (subtle animations, green/red for up/down)
- Key info hierarchy: Price > Chart > Trade Panel > History
- Maximum 2 clicks to execute a trade
- Loading skeletons over spinners for data-heavy views
- Color coding: green (#22c55e) for profit/up, red (#ef4444) for loss/down

### 3. AI Architect (`ai-architect.md`)
**Scope:** Innovation features, AI trade suggestions, risk assessment, vibe-coding documentation
**Rules:**
- AI features must be simple and explainable (no black-box)
- Trade suggestion: basic technical indicators (moving avg crossover, RSI)
- Risk meter: calculate based on volatility, account balance %, win streak
- All AI features are suggestions only — user always confirms trades
- Document every AI-assisted decision in vibe-coding docs
- Track prompts used, iterations, and what worked/failed

---

## 📄 Vibe-Coding Documentation Structure

This is a **first-class competition deliverable**. Updated continuously as we build.

### `docs/vibe-coding/README.md`
- What is vibe-coding
- Tools used (Claude Code, etc.)
- Summary stats (total prompts, files generated, time saved)

### `docs/vibe-coding/prompts-log.md`
- Chronological log of prompts used
- Format: `[Phase] Prompt → Outcome → What we learned`

### `docs/vibe-coding/architecture.md`
- How AI helped design the architecture
- Trade-offs discussed and decisions made
- Diagrams generated with AI assistance

### `docs/vibe-coding/iterations.md`
- Before/after code comparisons
- UI evolution screenshots
- Refactoring decisions

### `docs/vibe-coding/lessons-learned.md`
- What AI got wrong and how we fixed it
- What AI got right that surprised us
- Tips for future vibe-coders

---

## 🚀 Build Phases (Priority Order)

### Phase 1 — Foundation (Day 1)
- [ ] Project scaffolding (Next.js, Tailwind, folder structure)
- [ ] Skills files + CLAUDE.md
- [ ] Vibe-coding docs skeleton
- [ ] Constants, types, utility files
- [ ] UI primitives (Button, Card, Badge, Spinner)
- [ ] Dashboard layout shell (Sidebar, Header, DashboardLayout)

### Phase 2 — Market Data (Day 2)
- [ ] Public WebSocket connection manager
- [ ] `useTicks` hook — live price streaming
- [ ] `active_symbols` — market/symbol browser
- [ ] Price chart with TradingView Lightweight Charts
- [ ] MarketSelector component

### Phase 3 — Authentication (Day 3)
- [ ] OAuth 2.0 PKCE flow (auth.ts)
- [ ] API routes: callback, token exchange
- [ ] AuthContext with token persistence
- [ ] Login/logout UI
- [ ] OTP generation for authenticated WebSocket

### Phase 4 — Trading (Day 4-5)
- [ ] Authenticated WebSocket connection
- [ ] `useProposal` — live contract pricing
- [ ] `useBalance` — account balance subscription
- [ ] TradePanel — contract config + buy/sell
- [ ] OpenPositions — active contracts with live P&L
- [ ] Sell/close functionality

### Phase 5 — History & Analytics (Day 6)
- [ ] `useTradeHistory` — profit_table + statement
- [ ] TradeHistory component with pagination
- [ ] PnLSummary + WinRateCard
- [ ] ProfitLossChart (simple line/bar chart)

### Phase 6 — Innovation Features (Day 7-8)
- [ ] Risk Meter (volatility + balance-based)
- [ ] Simple AI trade suggestion (MA crossover)
- [ ] Trading times display

### Phase 7 — Polish & Deploy (Day 9-10)
- [ ] Responsive design pass
- [ ] Error boundaries + edge cases
- [ ] Vercel deployment
- [ ] Final vibe-coding documentation
- [ ] README + changelog

---

## 💡 Innovation Features

### 1. Risk Meter
Visual gauge showing trade risk based on:
- Current market volatility (from tick variance)
- Stake as % of account balance
- Recent win/loss streak
- Contract duration (shorter = riskier for some types)

### 2. AI Trade Suggestion (Simple)
- Compare short vs long moving averages from tick history
- Show "Bullish" / "Bearish" / "Neutral" signal
- Display confidence level based on signal strength
- User always manually confirms — it's a hint, not auto-trading
