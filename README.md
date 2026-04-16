# TradeVibez

**Gamified Options Trading on Deriv API V2**

> Real Deriv contracts. Game mechanics. Zero jargon.

**Live:** [tradevibez.vercel.app](https://tradevibez.vercel.app)

---

## What is TradeVibez?

TradeVibez transforms real options trading into interactive games. Every game uses live Deriv API contracts — no fake RNG, no simulations. Players predict market movements through intuitive game mechanics (arena fights, vault heists, penalty shootouts) instead of reading charts and order books.

Built solo in 12 days for the Deriv Hackathon (April 2026) using AI-assisted vibe-coding with Claude Code.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| 3D Graphics | React Three Fiber + Three.js |
| Charts | TradingView Lightweight Charts v5 |
| Icons | Lucide React |
| API | Deriv API V2 (REST + WebSocket) |
| Auth | OAuth 2.0 PKCE |
| Deploy | Vercel |
| Language | TypeScript (strict mode) |

---

## Features

### Market Data
- Live WebSocket tick streaming across 50+ synthetic & forex markets
- Interactive candlestick, line, and area charts (TradingView)
- Real-time price ticker with direction indicators

### Trading
- One-click trade execution via authenticated WebSocket
- Live proposal streaming with dynamic payouts
- Open positions panel with real-time P&L
- Support for Rise/Fall, Digits, Touch, Asian, and barrier contracts

### Gamified Trading (10 Solo Games)

| Game | Mechanic | Contract Type |
|------|----------|--------------|
| Bear vs Bull | 3D arena fight — ticks deal damage | CALL / PUT |
| Vault Heist | Crack tumbler locks with predictions | CALL |
| Tick Plinko | Ball drops through tick-driven paths | CALL / PUT |
| Penalty Shootout | 5 kicks — predict odd or even each | DIGITODD / DIGITEVEN |
| Hex Color Filler | Ticks paint a honeycomb grid | CALL / PUT |
| Market Melody | Ticks compose a melody on a piano | CALL / PUT |
| Tidal Surge | Ride ocean waves — predict the tide | CALL / PUT |
| Digit Oracle | Crystal ball reveals the last digit | DIGITMATCH / DIGITDIFF |
| Grand Prix | Pick your car — ticks power the race | CALL / PUT |
| Pressure Blaster | Crash/Boom pressure chamber | ONETOUCH |

### Multiplayer
- **Bear vs Bull Duel** — Challenge a friend via 6-character room codes
- Zero server state — synchronized via shared Deriv tick streams
- 3 more multiplayer modes planned (Chain Race, Market Battle, Tick Boxing)

### Analytics
- Trade history with pagination and search
- KPI dashboard: Total P&L, Win Rate, Avg Return, Total Trades
- Color-coded profit/loss indicators

---

## Architecture Highlights

- **No separate backend** — Next.js API routes handle OAuth token exchange and OTP
- **Dual WebSocket** — Public connection (market data) + Authenticated connection (trading)
- **React Context only** — No Redux/Zustand; 2 contexts (WebSocket + Auth) cover all shared state
- **Canvas Handle pattern** — `useImperativeHandle` bridges game logic to 2D/3D canvases
- **URL-based multiplayer sync** — Shared epoch timestamp in room codes, both players subscribe to same tick stream

---

## Vibe-Coding

This project was built using AI-assisted vibe-coding — every feature designed, implemented, and debugged through human-AI collaboration.

**Full documentation:** [docs/vibe-coding/](docs/vibe-coding/)

| Metric | Value |
|--------|-------|
| AI interactions | 57+ |
| Architecture decisions | 25 |
| Documented iterations | 32+ |
| Lessons learned | 41 |
| Files generated | 50+ |

---

## Project Structure

```
src/
  app/              # Next.js routes (/, /dashboard, /trade, /history, /games, /api/)
  components/
    games/          # 10 game components + canvas files + multiplayer
    history/        # Trade stats + history table
    layout/         # Sidebar, Header, DashboardLayout
    landing/        # SpaceView hero visualization
    ui/             # Button, Card, Badge, Spinner primitives
  context/          # WebSocketContext, AuthContext, ThemeContext
  hooks/            # useTicks, useProposal, useProfitTable, useActiveSymbols
  types/            # Deriv API TypeScript definitions
  utils/            # Formatters, constants
docs/
  api-reference.md  # Full Deriv API V2 documentation
  vibe-coding/      # Prompts log, architecture, iterations, lessons
```

---

## Built By

**Kumaran Subramani** — Solo developer & architect
**Claude Code (Sonnet/Opus 4.6)** — AI co-pilot

Built for the Deriv API V2 Hackathon, April 2026.
