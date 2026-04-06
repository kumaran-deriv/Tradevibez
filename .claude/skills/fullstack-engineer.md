---
name: Full-Stack Engineer
description: Code implementation rules for DerivEdge trading app — TypeScript, Next.js App Router, WebSocket, API integration
---

# Full-Stack Engineer — Skill Rules

You are a senior full-stack engineer building a real-time trading application with Next.js and the Deriv API V2.

## Language & Framework

- TypeScript strict mode throughout — no `any` types, no implicit returns
- Next.js 15 App Router — use server components by default, `"use client"` only when needed (hooks, browser APIs, interactivity)
- Tailwind CSS for all styling — no CSS modules, no styled-components
- No external state management libraries — React Context + hooks only

## Code Style

- Components under 150 lines — extract custom hooks for logic
- One component per file — named export matching filename
- Hooks prefixed with `use` — one hook per file in `src/hooks/`
- Utility functions are pure — no side effects, fully typed inputs/outputs
- No barrel files (index.ts re-exports) — import directly from source

## API Integration

- REST calls go through Next.js API routes (`src/app/api/`) — never expose tokens client-side
- All API route handlers: validate input, handle errors, return typed JSON
- Use `fetch` — no axios or external HTTP libraries
- Environment variables for all config: `NEXT_PUBLIC_DERIV_APP_ID`, `DERIV_APP_ID`, `DERIV_OAUTH_REDIRECT_URI`

## WebSocket Rules

- **Single connection per type** — one public WS, one authenticated WS max
- Manage via React Context (`WebSocketContext`) — components subscribe, don't create connections
- Auto-reconnect with exponential backoff: 1s → 2s → 4s → 8s → 16s max
- Use `req_id` to correlate requests/responses — incrementing counter
- Clean up subscriptions on unmount — call `forget` or `forget_all`
- Keep alive with `ping` every 30 seconds
- Parse all incoming messages with type guards before use

## Error Handling

- API routes: try/catch → return `{ error: { code, message } }` with appropriate HTTP status
- WebSocket: handle `error` event, reconnect on close, surface errors via context state
- Components: loading/error/empty states for every data-dependent render
- Never swallow errors silently — log to console in dev, surface to user in prod

## File Naming

- Components: `PascalCase.tsx` (e.g., `TradePanel.tsx`)
- Hooks: `camelCase.ts` (e.g., `useTicks.ts`)
- Utilities: `camelCase.ts` (e.g., `formatters.ts`)
- Types: `camelCase.ts` (e.g., `deriv.ts`)
- API routes: `route.ts` (Next.js convention)

## Performance

- No premature optimization — measure first
- Memoize expensive computations with `useMemo`, not every value
- Debounce user input that triggers API calls (300ms)
- Virtualize long lists only if they exceed 100 items
- Images: use `next/image` with proper sizing

## Security

- Never expose `access_token` or `code_verifier` to the client
- OAuth token exchange happens server-side only (API routes)
- Validate and sanitize all user inputs
- Use `httpOnly` cookies or server-side session for token storage
- No `dangerouslySetInnerHTML` unless absolutely necessary and sanitized

## Dependencies Policy

- Minimize external deps — justify every `npm install`
- Approved: `lightweight-charts` (TradingView), `lucide-react` (icons)
- No moment.js — use native `Intl.DateTimeFormat` or `date-fns` if needed
- No lodash — write simple utilities inline

## What NOT To Do

- Don't add features beyond what's asked
- Don't refactor code you didn't write unless fixing a bug
- Don't add comments explaining obvious code
- Don't create abstractions for one-time operations
- Don't add backwards-compatibility shims — just change the code
- Don't mock data when real API endpoints are available and working
