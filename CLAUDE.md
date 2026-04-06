# DerivEdge — Project Instructions

## What This Is
A real-time trading web app built with the Deriv API V2 for a hackathon competition. Due: April 17, 2026.

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS v4
- **Charts:** TradingView Lightweight Charts
- **Icons:** Lucide React
- **API:** Deriv API V2 (REST + WebSocket)
- **Deploy:** Vercel
- **App ID:** 1089 (test default)

## Role-Based Skills
Before writing any code, read the relevant skills file:
- **Code/API work** → `.claude/skills/fullstack-engineer.md`
- **UI/Layout work** → `.claude/skills/product-designer.md`
- **AI features/docs** → `.claude/skills/ai-architect.md`

These are STRICT rules — follow them exactly.

## Key Architecture Rules
1. No separate backend — Next.js API routes only
2. Two WebSocket connections max: public (market data) + authenticated (trading)
3. React Context for shared state — no Redux, Zustand, etc.
4. TypeScript strict mode — no `any` types
5. Dark theme only — no theme toggle
6. Demo account first — all development against demo

## API Reference
Full Deriv API V2 docs: `docs/api-reference.md`

## Vibe-Coding (IMPORTANT)
This is a first-class competition deliverable. After completing any meaningful work:
1. Log the prompt/outcome in `docs/vibe-coding/prompts-log.md`
2. Document iterations in `docs/vibe-coding/iterations.md`
3. Record architecture decisions in `docs/vibe-coding/architecture.md`
4. Note lessons in `docs/vibe-coding/lessons-learned.md`

## Environment Variables
```
NEXT_PUBLIC_DERIV_APP_ID=1089
DERIV_APP_ID=1089
DERIV_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

## Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run linter
```

## File Conventions
- Components: `PascalCase.tsx`
- Hooks: `use*.ts` in `src/hooks/`
- API routes: `route.ts` (Next.js convention)
- Types: `src/types/deriv.ts`
- No barrel files — import directly from source
