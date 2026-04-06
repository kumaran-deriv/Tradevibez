# Lessons Learned — DerivEdge

Mistakes, surprises, and tips from building a trading app with AI as co-pilot.

---

## Lesson 1: Plan Before You Prompt

**What happened:** We could have jumped straight into "write me a trading app" and gotten code immediately. Instead, we spent the first session planning architecture, defining roles, and documenting decisions.

**Why it matters:** The planning session surfaced critical insights — like the dual WebSocket strategy — that would have been expensive to retrofit later. AI is great at generating code fast, but bad code generated fast is still bad code.

**Tip:** Invest 20% of your time in planning. The AI will generate the remaining 80% faster AND better with clear constraints.

---

## Lesson 2: Skills Files Are Guardrails

**What happened:** Without explicit rules, AI tends to over-engineer — adding state management libraries, theme toggles, error boundaries for impossible scenarios. Skills files with "What NOT To Do" sections prevent this.

**Why it matters:** Constraints make AI more productive, not less. "Don't use external state management" eliminates a category of decisions and keeps the codebase simple.

**Tip:** Write your AI rules as "always do X" AND "never do Y". The negative constraints are equally important.

---

## Lesson 3: API Docs as Context = Massive Time Savings

**What happened:** AI fetched, parsed, and synthesized the entire Deriv API V2 documentation into a single reference file in under 2 minutes. Manually reading through 28 endpoint pages would have taken hours.

**Why it matters:** AI excels at information synthesis. Use it to condense large documentation into actionable references before writing any code.

**Tip:** Always have AI read the API docs first. The insights it extracts (e.g., "public WS needs no auth") directly shape architecture.

---

*(More lessons will be added throughout the build)*
