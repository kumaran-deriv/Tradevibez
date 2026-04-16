# TradeVibez — Submission Summary

**Tagline:** Real Deriv contracts. Game mechanics. Zero jargon.

**Live URL:** [tradevibez.vercel.app](https://tradevibez.vercel.app)

**Repo:** GitHub (private during competition)

---

## What is TradeVibez?

TradeVibez is a real-time trading web app that turns Deriv options contracts into interactive games. Instead of charts and order books, players predict market movements through 3D arena fights, vault heists, penalty shootouts, and more — all powered by live Deriv API V2 tick streams. Every game outcome is determined by real market data, not random number generators.

---

## Key Innovation: Gamified Trading

We built **10 solo games and 1 multiplayer mode**, each wrapping a real Deriv contract type in an intuitive game mechanic:

- **Bear vs Bull** — 3D arena fight where ticks deal damage (CALL/PUT)
- **Vault Heist** — Crack tumbler locks with sequential predictions (CALL)
- **Tick Plinko** — Ball drops through tick-driven paths (CALL/PUT)
- **Penalty Shootout** — 5 kicks, predict odd/even per kick (DIGITODD/DIGITEVEN)
- **Hex Color Filler** — Ticks paint a honeycomb grid (CALL/PUT)
- **Market Melody** — Ticks compose a melody on a piano (CALL/PUT)
- **Tidal Surge** — Ride ocean waves, predict the tide (CALL/PUT)
- **Digit Oracle** — Crystal ball reveals the last digit (DIGITMATCH/DIGITDIFF)
- **Grand Prix** — Pick your car, ticks power the race (CALL/PUT)
- **Pressure Blaster** — Crash/Boom pressure chamber (ONETOUCH)
- **Bear vs Bull Duel** — Multiplayer via room codes, zero server state

Every game shows a live tick feed so players can verify that outcomes come from real market movement.

---

## Tech Stack

| | |
|---|---|
| **Frontend** | Next.js 15, React 19, Tailwind CSS v4, TypeScript strict |
| **3D/Canvas** | React Three Fiber, Three.js, HTML5 Canvas |
| **Charts** | TradingView Lightweight Charts v5 |
| **API** | Deriv API V2 — REST + dual WebSocket (public + authenticated) |
| **Auth** | OAuth 2.0 PKCE flow |
| **Deploy** | Vercel (free tier) |

**No separate backend.** Next.js API routes handle token exchange and OTP. All trading happens over WebSocket.

---

## Feature Highlights

- **50+ live markets** — Synthetic indices, forex, 1-second tick indices
- **One-click trading** — Live proposal streaming with dynamic payouts
- **10 game modes** — 7 contract types across 10 unique visual experiences
- **Multiplayer** — Room code system with URL-based epoch sync (zero server state)
- **Trade history** — P&L analytics with win rate, avg return, and color-coded results
- **Premium dark UI** — Glassmorphism, accent glows, 3D orbital hero visualization
- **Responsive** — Works on desktop and tablet

---

## Vibe-Coding: How We Built It

TradeVibez was built entirely through AI-assisted vibe-coding — human direction + AI code generation via Claude Code.

| | |
|---|---|
| **Duration** | 12 days (April 6–17, 2026) |
| **AI interactions** | 57+ documented |
| **Architecture decisions** | 25 with trade-off analysis |
| **Documented iterations** | 32+ before/after evolutions |
| **Lessons learned** | 41 hard-won tips |
| **Files generated** | 50+ |

Full documentation: [docs/vibe-coding/](vibe-coding/)

---

## Architecture

```
Browser
  ├── Public WebSocket ──→ Deriv (ticks, symbols, proposals)
  ├── Auth WebSocket ────→ Deriv (buy, sell, portfolio)
  └── Next.js API Routes → Deriv REST (OAuth token, OTP, accounts)
```

- **Dual WebSocket** — Public connection for market data, authenticated for trading
- **React Context** — 2 contexts (WebSocket + Auth) manage all shared state
- **Canvas Handle pattern** — `useImperativeHandle` bridges game logic to 2D/3D renders
- **Multiplayer sync** — Shared epoch in room codes; both players subscribe to same tick stream

---

## What's Next

- 3 more multiplayer modes (Chain Race, Market Battle, Tick Boxing)
- Live balance subscription
- Mobile-optimized game controls

---

## Team

| | |
|---|---|
| **Developer** | Kumaran Subramani (solo) |
| **AI Co-Pilot** | Claude Code (Opus 4.6) |

Built for the Deriv API V2 Hackathon, April 2026.
