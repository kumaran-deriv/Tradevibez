# Vibe-Coding Documentation — TradeVibez

## What is Vibe-Coding?

Vibe-coding is AI-assisted software development where a human developer collaborates with an AI co-pilot to build software through natural language conversation. The developer provides direction, context, and judgment — the AI provides code generation, pattern recognition, and rapid iteration.

## Our Setup

- **Human:** Kumaran — solo developer, architect, decision-maker
- **AI Co-Pilot:** Claude Code (Claude Opus 4.6) — code generation, API research, debugging
- **Project:** TradeVibez — real-time trading web app using Deriv API V2
- **Live URL:** https://tradevibez.vercel.app
- **Timeline:** ~12 days (April 6–17, 2026)
- **Stack:** Next.js 15, React 19, Tailwind CSS v4, React Three Fiber, Three.js, TradingView Lightweight Charts v5, Deriv API V2 (REST + WebSocket)

## How We Work

1. **Plan first** — Every feature starts with a plan before code is written
2. **Role-based skills** — AI follows strict rules for 3 roles: Full-Stack Engineer, Product Designer, AI Architect
3. **Iterate openly** — First attempt rarely ships. We document what changed and why
4. **Document as we go** — Not retroactively. The log is a live artifact

## Documentation Index

| Document | Purpose |
|----------|---------|
| [prompts-log.md](prompts-log.md) | Chronological log of prompts, outcomes, and learnings |
| [architecture.md](architecture.md) | AI-assisted architecture decisions and trade-offs |
| [iterations.md](iterations.md) | Before/after evolution of features and components |
| [lessons-learned.md](lessons-learned.md) | What went wrong, what surprised us, tips for others |

## Stats

| Metric | Value |
|--------|-------|
| Build phases completed | 6 / 7 |
| Total meaningful interactions | 57+ |
| Files generated with AI | 50+ |
| Architecture decisions documented | 25 |
| Iterations documented | 32+ |
| Lessons learned | 41 |
| Solo games built | 10 |
| Multiplayer games | 1 active + 3 planned |
| Contract types used | CALL, PUT, DIGITODD, DIGITEVEN, DIGITMATCH, DIGITDIFF, ONETOUCH |
| Bugs introduced by AI | 5+ (chart v5 API, TypeScript strict, string quotes, double-fire, canvas race) |
| Bugs fixed by AI | All (same session, <10 min each) |
| App renames | 3 (DerivEdge → VibeTrader → TradeVibez) |
| Deploy migrations | 2 (Vercel → Netlify → Vercel) |
| OAuth flow | Working end-to-end |
