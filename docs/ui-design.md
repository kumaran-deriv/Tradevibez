# DerivEdge — UI Design Plan

## Approach: Feature Vertical Slices
Build one complete feature at a time (UI + API + logic). Each slice ships fully functional.

## Layout: Sidebar + Top Header

```
+----------+----------------------------------------+
|  LOGO    |  Header: Search | Balance | Account    |
+----------+----------------------------------------+
|          |                                        |
|  Nav     |   Main Content Area                    |
|  ------  |   (changes per page)                   |
|  Markets |                                        |
|  Trade   |                                        |
|  History |                                        |
|  Stats   |                                        |
|          |                                        |
+----------+----------------------------------------+
```

- Sidebar: 64px collapsed (icons), 240px expanded (icons + labels)
- Header: 64px height, sticky
- Content: fills remaining space, scrollable

---

## Build Order (Vertical Slices)

### Slice 1: Foundation + Layout Shell
**What:** Next.js project, Tailwind, layout components, landing page
**Pages:** `/` (landing/login)
**Components:**
```
DashboardLayout
├── Sidebar (nav items, logo, collapse toggle)
├── Header (balance placeholder, account menu)
└── Content slot

Landing Page
├── Hero section (app name, tagline)
├── Login button → Deriv OAuth
└── Feature highlights
```
**No API calls yet** — just structure + navigation

---

### Slice 2: Market Data (First Real Feature)
**What:** Live market data via public WebSocket — works without login
**Pages:** `/dashboard` (default view)
**Components:**
```
Dashboard Page
├── MarketSelector (grouped by market type)
│   ├── Market tabs: Synthetics | Forex | Stocks | Commodities
│   └── Symbol list with live prices
├── PriceChart (TradingView Lightweight Charts)
│   ├── Candlestick chart
│   ├── Time range selector (1m, 5m, 15m, 1h, 4h, 1d)
│   └── Current price overlay
└── TickerBar (horizontal scroll of top symbols + live prices)
```
**API calls:**
- `active_symbols` → populate market selector
- `ticks` (subscribe) → live price updates
- `ticks_history` → chart candle data

**Layout on dashboard:**
```
+----------+----------------------------------------+
| Sidebar  | Header                                 |
+----------+----------------------------------------+
|          | [Synthetics] [Forex] [Stocks] [Crypto] |
|          +---------------------+------------------+
|          |                     |  Symbol List     |
|          |   CHART             |  - Vol 100  ↑   |
|          |   (candlestick)     |  - Vol 75   ↓   |
|          |                     |  - Vol 50   ↑   |
|          |                     |  - Vol 25   ↑   |
|          +---------------------+------------------+
|          | Ticker: R_100 345.67 ↑ | EUR/USD 1.08  |
+----------+----------------------------------------+
```

---

### Slice 3: Authentication
**What:** OAuth 2.0 PKCE login, token management, account info
**Pages:** `/` (login button), `/api/auth/*` (callback + token routes)
**Components:**
```
AuthContext (wraps app)
├── Login state management
├── Token storage (httpOnly cookie via API route)
└── Account info display

Header (enhanced)
├── Balance display (live after login)
├── Account dropdown
│   ├── Account ID
│   ├── Switch Demo/Real
│   └── Logout
└── Login button (when not authenticated)
```
**API calls:**
- OAuth redirect → `auth.deriv.com/oauth2/auth`
- Token exchange → `auth.deriv.com/oauth2/token` (server-side)
- `GET /trading/v1/options/accounts` → account list
- OTP generation → authenticated WebSocket URL

---

### Slice 4: Trading Execution
**What:** Contract proposals, buy/sell, open positions monitoring
**Pages:** `/trade`
**Components:**
```
Trade Page
├── PriceChart (reused from Slice 2, with selected symbol)
├── TradePanel
│   ├── Contract type selector (Rise/Fall, Higher/Lower, Digits, etc.)
│   ├── Duration picker (amount + unit: s/m/h/d/t)
│   ├── Stake/Payout input with basis toggle
│   ├── ProposalCard (live pricing, payout, return %)
│   │   ├── Ask price
│   │   ├── Potential payout
│   │   └── Spot price
│   ├── [BUY / RISE] button (green)
│   └── [SELL / FALL] button (red)
└── OpenPositions
    ├── Active contract cards
    │   ├── Symbol + contract type
    │   ├── Entry vs current price
    │   ├── Live P&L (color-coded)
    │   └── [Sell] button
    └── Empty state when no positions

```
**Layout:**
```
+----------+----------------------------------------+
| Sidebar  | Header                                 |
+----------+----------------------------------------+
|          | [Symbol: Vol 100 Index ▼]              |
|          +-------------------------+--------------+
|          |                         | Trade Panel  |
|          |   CHART                 | Type: [Rise] |
|          |   (large, live)         | Dur:  [5 min]|
|          |                         | Stake: [$10] |
|          |                         +~~~~~~~~~~~~~~+
|          |                         | Payout: $19  |
|          |                         | Return: 90%  |
|          |                         +~~~~~~~~~~~~~~+
|          |                         | [🟢 BUY]    |
|          |                         | [🔴 SELL]   |
|          +-------------------------+--------------+
|          | Open Positions                          |
|          | Vol100 CALL | +$3.50 | [Sell]          |
|          | R_50  PUT   | -$1.20 | [Sell]          |
+----------+----------------------------------------+
```
**API calls:**
- `proposal` (subscribe) → live pricing
- `buy` → execute trade
- `sell` → close position
- `proposal_open_contract` (subscribe) → live position tracking
- `portfolio` → list open positions
- `balance` (subscribe) → live balance updates

---

### Slice 5: Trade History & Analytics
**What:** Past trades, profit/loss tracking, basic analytics
**Pages:** `/history`
**Components:**
```
History Page
├── Filters (date range, symbol, outcome)
├── TradeHistory table
│   ├── Columns: Date | Symbol | Type | Buy | Sell | P&L
│   ├── Pagination (25 per page)
│   ├── Sort by date (newest first)
│   └── Color-coded P&L cells
└── Analytics Cards (top row)
    ├── PnLSummary
    │   ├── Total profit
    │   ├── Total loss
    │   └── Net P&L
    ├── WinRateCard
    │   ├── Win % (circular progress)
    │   ├── Total trades
    │   └── Win/Loss count
    └── ProfitLossChart
        └── Line chart of cumulative P&L over time
```
**Layout:**
```
+----------+----------------------------------------+
| Sidebar  | Header                                 |
+----------+----------------------------------------+
|          | [P&L: +$245] [Win Rate: 62%] [Trades]  |
|          +----------------------------------------+
|          | [Cumulative P&L Chart                 ] |
|          +----------------------------------------+
|          | Trade History                           |
|          | Date     | Symbol | Type | Buy | P&L   |
|          | Apr 6    | R_100  | CALL | $10 | +$8   |
|          | Apr 6    | R_50   | PUT  | $5  | -$5   |
|          | Apr 5    | EUR/USD| CALL | $20 | +$18  |
|          |                    [1] [2] [3] [Next]   |
+----------+----------------------------------------+
```
**API calls:**
- `profit_table` → completed trades with pagination
- `statement` → transaction history

---

### Slice 6: Innovation (If Time Permits)
**What:** Risk Meter + AI Trade Signal
**Components:**
```
RiskMeter (embedded in TradePanel)
├── Circular gauge (0-100)
├── Color: green/amber/red
├── Factor breakdown on hover
└── Updates on every proposal change

TradeSignal (embedded in chart area)
├── Badge: Bullish/Bearish/Neutral
├── Confidence bar
├── MA lines on chart (if possible)
└── Disclaimer text
```

---

## Component Size Guidelines

| Component | Desktop Width | Height |
|-----------|--------------|--------|
| Sidebar | 240px (64px collapsed) | Full height |
| Header | Fluid | 64px |
| Chart | Fluid (fill available) | 400-500px |
| Trade Panel | 320px | Auto |
| Symbol List | 280px | 400px |
| Position Card | Fluid | 80px |
| Analytics Card | 1/3 grid | 120px |

## Navigation Items

| Icon | Label | Route | Auth Required |
|------|-------|-------|---------------|
| LayoutDashboard | Markets | /dashboard | No |
| TrendingUp | Trade | /trade | Yes |
| History | History | /history | Yes |
| BarChart3 | Analytics | /history#analytics | Yes |
| Settings | Settings | — | Yes |

---

## Priority: Core First, AI Later

**Must ship (Phase 1-5):**
- Layout shell with navigation
- Live market data + charts
- Authentication
- Trade execution
- Trade history + basic analytics

**Nice to have (Phase 6):**
- Risk Meter
- AI Trade Signal
- Smart Duration Picker
