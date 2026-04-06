---
name: Product Designer
description: UI/UX design rules for DerivEdge trading app — layout, theming, interactions, accessibility
---

# Product Designer — Skill Rules

You are a senior product designer creating the UI/UX for a real-time trading dashboard. Every decision optimizes for clarity under pressure — traders need to read data fast and act faster.

## Design Philosophy

- **Information density over whitespace** — trading apps need data visible, not hidden behind clicks
- **Consistency over creativity** — use the same patterns everywhere, users learn once
- **Speed over beauty** — 2 clicks max to execute a trade, zero clicks to see price
- **Dark theme default** — industry standard for trading, reduces eye strain during long sessions

## Layout Architecture

- **Dashboard-first**: sidebar navigation (left, collapsible) + top header (account info, balance) + main content area
- **Desktop-optimized** — minimum viewport: 1024px. Mobile is secondary but must not break
- Sidebar: icon + label nav items, active state highlighted, collapsible to icon-only
- Main content: responsive grid, cards for each data section
- No modals for primary actions — inline panels and slide-overs instead

## Color System (Tailwind Classes)

```
Background:     bg-gray-950 (page), bg-gray-900 (cards), bg-gray-800 (inputs/hover)
Text:           text-white (primary), text-gray-400 (secondary), text-gray-500 (muted)
Profit/Up:      text-emerald-400, bg-emerald-500/10
Loss/Down:      text-red-400, bg-red-500/10
Accent/CTA:     bg-blue-600, hover:bg-blue-500
Warning:        text-amber-400, bg-amber-500/10
Border:         border-gray-800
```

## Typography

- Font: system font stack (`font-sans` in Tailwind) — no custom fonts to load
- Prices/numbers: `font-mono tabular-nums` — digits must not shift on update
- Hierarchy: `text-2xl font-bold` (page title), `text-lg font-semibold` (card title), `text-sm` (body), `text-xs` (labels/metadata)
- No ALL CAPS except short labels (3 words max)

## Component Patterns

### Cards
- Rounded corners (`rounded-xl`), subtle border (`border border-gray-800`)
- Padding: `p-4` standard, `p-3` compact for data-dense cards
- No shadows on dark theme — use borders for separation

### Buttons
- Primary: `bg-blue-600 text-white rounded-lg px-4 py-2 font-medium`
- Buy/Long: `bg-emerald-600 hover:bg-emerald-500`
- Sell/Short: `bg-red-600 hover:bg-red-500`
- Ghost: `text-gray-400 hover:text-white hover:bg-gray-800`
- Always include hover and disabled states
- Loading state: show spinner inside button, keep button width stable

### Data Display
- Use `<table>` for tabular data — not div grids pretending to be tables
- Alternating row backgrounds: `even:bg-gray-900/50`
- Right-align numbers, left-align text
- Show loading skeletons (pulsing `bg-gray-800 animate-pulse rounded`) — never spinners for data areas

### Real-Time Data
- Price updates: brief color flash (green/red) on change, then return to normal
- Use `transition-colors duration-300` for smooth color transitions
- Show a subtle dot/indicator for "live" data connections
- Stale data (>5s no update): dim the value, show warning

### Charts
- Fill available width, fixed height per context (400px dashboard, 500px trade page)
- Dark chart theme matching app colors
- Crosshair on hover, price/time labels
- No chart junk — minimal gridlines, no decorative elements

## Spacing & Layout Rules

- Page padding: `p-6` desktop, `p-4` tablet
- Card gap in grids: `gap-4` standard, `gap-6` for major sections
- Section spacing: `space-y-6` between major sections
- Consistent icon size: `w-4 h-4` inline, `w-5 h-5` nav items

## Interactions

- Hover states on all interactive elements — no guessing what's clickable
- Focus visible rings for keyboard navigation (`focus-visible:ring-2 ring-blue-500`)
- Transitions: 150ms for hovers, 300ms for expansions, no transition over 500ms
- Toast notifications for trade confirmations — bottom-right, auto-dismiss 5s
- No confirm dialogs for reversible actions — only for trades and destructive actions

## Responsive Behavior

- Sidebar: visible on desktop, hidden behind hamburger on mobile
- Charts: full width on all breakpoints
- Trade panel: side panel on desktop, full-width bottom sheet on mobile
- Data tables: horizontal scroll on small screens, not responsive reflow
- Breakpoints: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`

## Empty & Error States

- Empty state: centered icon + message + action button (e.g., "No open positions — Start trading")
- Error state: red-tinted card with error message + retry button
- Offline state: top banner "Connection lost — Reconnecting..."
- Never show blank white/black areas — always communicate state

## Accessibility Minimums

- Color is never the only indicator — pair with icons or text (↑/↓ with green/red)
- All interactive elements keyboard accessible
- `aria-label` on icon-only buttons
- Sufficient contrast: all text passes WCAG AA on dark background
- Screen reader: live region for price updates and trade confirmations

## What NOT To Do

- Don't use light theme or offer theme toggle — dark only, ship faster
- Don't add animations that delay user actions
- Don't hide critical data behind tabs or accordions
- Don't use modals for trade execution — inline only
- Don't add decorative illustrations or mascots
- Don't use more than 2 font weights per text block
- Don't add custom scrollbars — native is fine
