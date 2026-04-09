# Vibe-Coding Documentation — TradeVibez

## What is Vibe-Coding?

Vibe-coding is AI-assisted software development where a human developer collaborates with an AI co-pilot to build software through natural language conversation. The developer provides direction, context, and judgment — the AI provides code generation, pattern recognition, and rapid iteration.

## Our Setup

- **Human:** Kumaran — solo developer, architect, decision-maker
- **AI Co-Pilot:** Claude Code (Claude Opus 4.6) — code generation, API research, debugging
- **Project:** TradeVibez — real-time trading web app using Deriv API V2
- **Live URL:** https://tradevibez.netlify.app
- **Timeline:** ~10 days (April 6–17, 2026)
- **Stack:** Next.js 15, Tailwind CSS v4, Deriv API V2 (REST + WebSocket)

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

## Stats (Updated as we build)

| Metric | Value |
|--------|-------|
| Build phases completed | 3 / 7 (Foundation, Market Data, Auth) |
| Total meaningful interactions | 18 |
| Files generated with AI | 32 |
| Architecture decisions documented | 8 |
| Iterations documented | 5 |
| Lessons learned | 7 |
| Bugs introduced by AI | 2 (chart v5 API, TypeScript strict) |
| Bugs fixed by AI | 2 (same session, <5 min each) |
| App renames | 3 (DerivEdge → VibeTrader → TradeVibez) |
| Deploy attempts | 2 (1 failed blobs error, 1 success) |
| OAuth flow | Working end-to-end on first proper attempt |
