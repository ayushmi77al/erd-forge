# ERD Forge — AI Agent Guidelines & Architecture Manual

Welcome to **ERD Forge**. This repository is a high-performance, local-first database modeling tool and SQL lineage explorer built for pro developers and data engineers.

When working in this repository, all agents MUST adhere to these architectural principles, UI/UX standards, and operational workflows.

---

## 1. Core Architectural Laws (Non-Negotiable)

1. **Local-First & Zero Network Calls (MUST):**
   - ZERO network calls in production client code. No external `fetch()`, analytics, crash tracking, or telemetry.
   - All fonts (Inter, JetBrains Mono) are locally bundled via `@fontsource-variable`.
   - Data persistence is strictly local via OPFS (Origin Private File System), SQLite-WASM, and IndexedDB.

2. **Layer Boundaries & Monorepo Structure:**
   - `apps/web/`: React 19 + Vite 5 single-page application & PWA.
   - `packages/core/`: Domain models, commands, catalog, and schema engines.
   - `packages/parser-sdl/`: Peggy PEG grammar parser for ERD Forge SDL.
   - `packages/lineage/`: SQL lineage parser and column-level DAG stitcher.
   - **Boundary Rule:** UI components import from `hooks/` and `stores/` only. Never bypass domain boundaries.

3. **Command Pattern for Schema Mutations (MUST):**
   - ALL mutations to project schema data MUST pass through `CommandManager.execute(command)`.
   - NEVER modify `projectStore` directly for schema changes. Only transient UI state (zoom level, drawer toggle, modal open) may be set directly on Zustand stores.

4. **Web Worker Offloading (MUST):**
   - Heavy parsing (SDL, SQL DDL) and layout computations (ELKjs auto-layout) must run inside dedicated web workers (`workers/parser.worker.ts`, `workers/layout.worker.ts`). Main thread must remain 60fps responsive.

---

## 2. UI/UX Design Standards & Anti-AI-Slop

ERD Forge adheres strictly to high-density, pro developer tool ergonomics (linear, dbdiagram, and VS Code-grade polish).

> **Full Rules:** See [`.agents/rules/ui-ux-design-standards.md`](./.agents/rules/ui-ux-design-standards.md)

### Key Design Mandates:
- **No AI Slop:** No purple/indigo gradient washes, floaty oversized cards, unstyled default controls, or low-contrast washed-out text.
- **Design Tokens (`apps/web/src/styles/tokens.css`):**
  - Surfaces: `var(--color-surface-base)`, `var(--color-surface-raised)`, `var(--color-surface-overlay)`, `var(--color-surface-sunken)`
  - Borders: `var(--color-border-subtle)`, `var(--color-border-default)`, `var(--color-border-strong)`
  - Spacing: `var(--space-1)` (4px) to `var(--space-12)` (48px). NEVER hardcode raw pixel padding/margins.
  - Typography: `var(--font-ui)` for interface chrome, `var(--font-mono)` for table names, column types, and SQL.
- **CSS Modules:** 1 module per component (`[Component].module.css`) with camelCase class names. No global stylesheet pollution.
- **Theming:** Full parity between Dark (`[data-theme="dark"]`, default) and Light (`[data-theme="light"]`). Never use `@media (prefers-color-scheme)` in component styles.
- **Canvas Nodes:** Custom React Flow nodes (`TableNode`, `SqlLineageNode`) MUST be wrapped in `React.memo` to prevent re-render cascades.
- **Accessibility:** Minimum 4.5:1 text contrast, visible `:focus-visible` outlines, descriptive `aria-label`s on all icon-only buttons, and `Escape` handlers on modals.

---

## 3. Specialized Workflows

When performing UI, engineering, or review tasks, activate the corresponding workflow from `.agents/workflows/`:

| Command / Workflow | File | Description |
|---|---|---|
| **`/design-new-page`** | [`.agents/workflows/design-new-page.md`](./.agents/workflows/design-new-page.md) | Design & build a new screen, panel, or modal using Mobbin patterns, `frontend-ui-engineering`, and DevTools verification. |
| **`/redesign-screen`** | [`.agents/workflows/redesign-screen.md`](./.agents/workflows/redesign-screen.md) | Redesign an existing component using evidence-backed patterns from shipped developer tools. |
| **`/ui-audit`** | [`.agents/workflows/ui-audit.md`](./.agents/workflows/ui-audit.md) | Audit UI/UX quality, token compliance, accessibility (WCAG AA), and anti-slop rules. |
| **`/webperf`** | [`.agents/workflows/webperf.md`](./.agents/workflows/webperf.md) | Audit Core Web Vitals (LCP, INP, CLS), layout shifts, and bundle weights. |
| **`/review`** | [`.agents/workflows/review.md`](./.agents/workflows/review.md) | 5-axis code review (correctness, architecture, security, performance, readability). |
| **`/build`** | [`.agents/workflows/build.md`](./.agents/workflows/build.md) | Incremental slice-based implementation with automated tests. |
| **`/test`** | [`.agents/workflows/test.md`](./.agents/workflows/test.md) | Test-driven development loop (unit tests + Playwright E2E). |

---

## 4. UI/UX Skills & Tooling Integration

Leverage these installed skills and subagents for design and visual validation:

- **Mobbin (`search`, `redesign-screen`):** Query 600K+ real app screens for developer-tool UI patterns before writing interface code.
- **`frontend-ui-engineering`:** Builds accessible, responsive, token-compliant components.
- **`react-best-practices`:** 70 performance rules to prevent render waterfalls, wasteful re-renders, and bloated bundles.
- **`browser-testing-with-devtools`:** Inspect live DOM, capture screenshots, and verify visual output in real browser sessions.
- **`a11y-debugging`:** Run accessibility audits on tap targets, contrast, and ARIA labels.
- **Subagents (`web-performance-auditor`, `code-reviewer`):** Run specialized reviews before merging changes.

---

## 5. Development & Verification Cheatsheet

```bash
# Run development server
pnpm dev

# Typecheck all monorepo packages (zero errors permitted)
pnpm typecheck

# Run unit tests
pnpm test

# Run E2E tests (Playwright)
pnpm test:e2e

# Run Biome linter & formatter
pnpm lint
pnpm format

# Rebuild Peggy SDL grammar (if grammar.pegjs changed)
pnpm build:grammar
```

