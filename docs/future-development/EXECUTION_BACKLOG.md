# ERD Forge — Tailored Engineering Backlog & Execution Runbook

> **Status:** Validation Required — Discovery Spikes Authorized  
> **Framework:** Gates 0 → 3 Phased Rollout  
> **Planning Range:** 28–46 Engineer-Days (4–7 working weeks across 2–3 roles)  
> **Execution Pattern:** 1 Task ID per prompt · 1 reviewable git branch per task · Verified test output required  

---

## 1. Roles & Governance Matrix

| Role | Primary Responsibilities | Decision Rights |
|:---|:---|:---|
| **Tech Lead / Release Owner** | ADR sign-offs, gate readiness (G0–G3), feature flag strategy, rollback authorization | Final cutover and release sign-off |
| **Graph & UI Owner** | Track 1 (ELK worker, compound layout, collision avoidance), Track 6 (React Compiler) | Layout contract and canvas performance approvals |
| **Parser & Lineage Owner** | Track 2 (sqlparser-ts WASM, AST normalizer, dialect mapping, fixture corpus) | Lineage parity threshold sign-offs |
| **Storage Owner** | Track 3 (SQLite OPFS worker, tab lock, safe migration, IndexedDB fallback) | Data persistence, schema integrity, rollback runbook |
| **QA / Reviewer** | Adversarial testing, multi-browser validation, failure injection, CSV injection audit | Release verification gatekeeper |

---

## 2. Phase 0: Readiness, Baselines & Design Decisions (Gate 0)
*Target: 3–5 engineer-days · Exit Gate: G0 Readiness Approved*

### Task P0.1 — Repository Inventory & Baseline Measurement
* **Owner:** Tech Lead + Domain Owners
* **Scope:**
  1. Confirm workspace package names, pnpm scripts, and Vite base path (`/tools/erd-forge/app/`).
  2. Inspect [StorageService](file:///c:/Users/ayush.mittal/Projects/erd-forge/apps/web/src/storage/index.ts) to verify existing fallback behavior and reload persistence.
  3. Run baseline commands and record raw output:
     ```bash
     pnpm --filter @erd-forge/web test autoLayout.test.ts
     pnpm --filter @erd-forge/web test sqlLineageParser.test.ts
     pnpm --filter @erd-forge/web typecheck
     pnpm --filter @erd-forge/web build
     ```
  4. Measure and document baseline metrics:
     * Production JS/WASM bundle chunk sizes (`dist/assets/`).
     * Cold startup time and 50/500-table layout latency on Dagre.
     * Canvas drag interaction frame rate (Chrome Performance DevTools).
* **Done Criteria:** Baseline metrics recorded in ticket; pre-existing test issues documented.

### Task P0.2 — Lock Dependencies & Finalize Architecture Decision Records (ADRs)
* **Owner:** Tech Lead
* **Scope:**
  1. Verify `@guanmingchiu/sqlparser-ts` on npm registry (confirm version `^0.1.0`, bundle contents, exports).
  2. Confirm `@sqlite.org/sqlite-wasm` version `^3.46.0` and `opfs-sahpool` availability.
  3. Author 4 concise ADRs in `docs/adr/`:
     * **ADR-01:** Compound domain nodes in ELK with qualified `${schema}.${table}` node IDs.
     * **ADR-02:** WASM SQL Parser adapter with shadow-comparison gate and typed dialect mapper.
     * **ADR-03:** SQLite OPFS SAHPool worker boundary, single-tab `BroadcastChannel` lease, and durable `IndexedDBAdapter` fallback.
     * **ADR-04:** Browser-only canvas export scope (foreignObject SVG) and OWASP formula-safe CSV.
* **Done Criteria:** ADRs reviewed and approved; no misspelled package names in documentation or config.

### Task P0.3 — Storage Migration & Tab-Coordination Design
* **Owner:** Storage Owner + Tech Lead
* **Scope:**
  1. Design the `SafeStorageMigrator` protocol:
     * Snapshot extraction of `projects` and `entities` tables.
     * Transactional insertion into OPFS SAHPool SQLite.
     * Row count and checksum verification query.
     * Storage journal record (`_migration_journal`).
     * Retention of legacy IndexedDB intact as a rollback store.
  2. Specify single-tab conflict handling:
     * `BroadcastChannel('erd-forge-storage-lock')`.
     * Active tab heartbeats.
     * User-facing takeover modal.
* **Done Criteria:** Reviewed state diagram and rollback decision tree committed.

### Task P0.4 — Build Sanitized Acceptance Fixture Corpus
* **Owner:** QA + Parser/Graph Owners
* **Scope:**
  1. **Layout Fixtures:** 50-table and 500-table synthetic schemas with multi-schema name collisions, unlinked nodes, and domain groupings.
  2. **SQL Fixtures:** Checked-in queries across Postgres, BigQuery, Snowflake, Databricks, DuckDB, MySQL, and T-SQL covering:
     * CTEs (recursive and multi-level).
     * `QUALIFY`, `PIVOT`, `UNPIVOT`.
     * Window functions and complex aliases.
     * Expected source/target column lineage mappings.
  3. **CSV Security Fixtures:** Test rows with leading `=`, `+`, `-`, `@`, `\t`, `\r` and negative numbers.
* **Done Criteria:** Fixtures checked into `apps/web/tests/fixtures/`.

> **GATE G0 EXIT REVIEW:** All baseline tests pass; ADRs approved; fixture corpus committed; owners assigned.

---

## 3. Phase 1: Foundation & Tooling (Gate 1)
*Target: 7–12 engineer-days · Exit Gate: G1 Foundation PRs Pass*

```
Track 1 (ELK Layout)  ──┐
Track 5 (Export)      ──┼──> Independent, reviewable PRs
Track 6 (Tooling)     ──┘
```

### Track 1 — Dagre to ELK Layout Engine (COMPLETED ✅)
* [x] **T1.1 Worker Bootstrap:** Install `elkjs@0.12.0`. Created `apps/web/src/core/layout/elkInstance.ts` with Web Worker factory and Node/Vitest fallback. (Report: `docs/future-development/reports/T1.1_ELK_WORKER_BOOTSTRAP.md`)
* [x] **T1.2 Compound & Collision-Safe Graph:** Updated `calculateAutoLayout` with `${schema}.${tableName}` composite keys, compound domain groups (`domain:Finance`), measured dimension support, and orthogonal routing. (Report: `docs/future-development/reports/T1.2_MEASURED_COLLISION_SAFE_GRAPH.md`)
* [x] **T1.3 Deterministic Fallbacks & Race Protection:** Added `layoutGenerationRef`, `AbortController` cancellation, 50ms layout debouncing in `ERDCanvas.tsx`, and deterministic grid placement fallback. (Report: `docs/future-development/reports/T1.3_DETERMINISTIC_SAFE_LAYOUT.md`)
* [x] **T1.4 Integration & Regression:** Migrated `lineageLayout.ts` and `LineageCanvas.tsx` to ELK. Completely uninstalled `@dagrejs/dagre` and `@types/dagre`. Verified 78/78 tests pass and production build succeeds. (Report: `docs/future-development/reports/T1.4_INTEGRATE_AND_REGRESS.md`)

### Track 5 — Browser Export Hardening (COMPLETED ✅)
* [x] **T5.1 Safe Font Embedding:** Updated `getEmbeddedFontCSS()` and `arrayBufferToBase64()` in `apps/web/src/lineage/utils/exportUtils.ts` to use 32KB chunked base64 conversion and dynamic `BASE_URL` resolution. (Report: `docs/future-development/reports/T5.1_SAFE_FONT_EMBEDDING.md`)
* [x] **T5.2 Output Stabilization:** Added `cacheBust: true`, uniform `#0f111a` background, and UI overlay filtering (`.react-flow__minimap`, `.react-flow__controls`). Verified options via unit tests. (Report: `docs/future-development/reports/T5.2_OUTPUT_STABILIZATION.md`)
* [x] **T5.3 OWASP CSV Sanitization:** Implemented `sanitizeCsvCell()` prepending `'` to trigger characters (`=, +, -, @, \t, \r`), doubled inner quotes, and verified formula injection neutralization against OWASP fixtures. (Report: `docs/future-development/reports/T5.3_OWASP_CSV_SANITIZATION.md`)

### Track 6 — Biome 2.x & React Compiler (COMPLETED ✅)
* [x] **T6.1 Biome Cutover:** Installed `@biomejs/biome@2.6.2`. Configured `biome.json` with schema validation and `assist.actions.source.organizeImports`. Replaced ESLint scripts in `package.json` files. Formatted repo and verified 311ms lint time. (Report: `docs/future-development/reports/T6.1_BIOME_CUTOVER.md`)
* [x] **T6.2 React Compiler:** Installed `babel-plugin-react-compiler@1.0.0`. Configured `apps/web/vite.config.ts` targeting React 19. Verified memoized rendering on `TableNode.tsx` and `ERDCanvas.tsx`. (Report: `docs/future-development/reports/T6.2_REACT_COMPILER.md`)
* [x] **T6.3 Performance Benchmarking:** Measured CI lint time (335 ms), build throughput, layout freeze elimination (0 ms main thread), and compiler memoization. (Report: `docs/future-development/reports/T6.3_PERFORMANCE_BENCHMARKING.md`)

> **GATE G1 EXIT REVIEW:** All Track 1 (ELK layout), Track 6 (Biome 2.x & React Compiler), and Track 5 (Safe Font Embedding, Output Stabilization, OWASP CSV) tasks pass; Dagre completely uninstalled; 86/86 tests green; 0 typecheck errors. Phase 1 is 100% COMPLETE.

---

## 4. Phase 2: Core Engine Upgrades (Gate 2)
*Target: 11–18 engineer-days · Exit Gate: G2 Engine Proofs Pass*

### Track 2 — SQL Parser Adapter & WASM Migration
* [x] **T2.1 Package & Worker Spike:** Installed `@guanmingchiu/sqlparser-ts@0.63.0`. Configured `optimizeDeps.exclude` in `vite.config.ts`. Verified WASM initialization and multi-dialect parsing inside `lineage.worker.ts` and unit tests. (Report: `docs/future-development/reports/T2.1_PACKAGE_AND_WORKER_SPIKE.md`)
* [x] **T2.2 Normalized Statement Contract:** Implemented `SqlParserAdapter.ts` with `NormalizedStatement`, `NormalizedFromItem`, `NormalizedColumn`, and typed `mapToWasmDialect()`. Added support for CTEs, joins, QUALIFY, and set operations. (Report: `docs/future-development/reports/T2.2_NORMALIZED_STATEMENT_CONTRACT.md`)
* [x] **T2.3 WasmSqlParserAdapter Implementation:** Implemented `WasmSqlParserAdapter` with idempotent `initialize()` and AST normalization mapping. Verified 12/12 test suites covering CTEs, joins, wildcards, QUALIFY, set operations, and DDL/DML. (Report: `docs/future-development/reports/T2.3_WASM_SQL_PARSER_ADAPTER.md`)
* [x] **T2.4 Parity & Differential Testing:** Constructed `WasmLineageBuilder` and verified 100% parity against legacy test suites and 100% pass rate (7/7) on Gate 0 fixture corpus with proven differential advantage on modern warehouse syntax. (Report: `docs/future-development/reports/T2.4_PARITY_AND_DIFFERENTIAL_TESTING.md`)
* [x] **T2.5 Shadow Rollout Feature Flag:** Implemented internal feature toggle (`parserEngine: 'legacy' | 'wasm' | 'shadow'`) with URL/localStorage resolution, off-thread differential comparator, fault-tolerant fallback, and visual toolbar badge. (Report: `docs/future-development/reports/T2.5_SHADOW_ROLLOUT_FEATURE_FLAG.md`)

### Track 3 — Official SQLite WASM & OPFS SAHPool
* [x] **T3.1 SQLite Worker Engine:** Installed `@sqlite.org/sqlite-wasm@^3.54.1-build1`. Created `apps/web/src/workers/sqlite.worker.ts` with Comlink, `installOpfsSAHPoolVfs`, parameterized query/execute batching, and Zero Silent Data Loss enforcement. (Report: `docs/future-development/reports/T3.1_SQLITE_WORKER_ENGINE.md`)
* [x] **T3.2 Storage Adapter & Durable Fallback:** Implemented `OPFSSQLiteAdapter` calling worker via Comlink, durable `IndexedDBAdapter` fallback hierarchy, status telemetry in `StatusBar.tsx`, and uninstalled `wa-sqlite`. (Report: `docs/future-development/reports/T3.2_STORAGE_ADAPTER_AND_DURABLE_FALLBACK.md`)
* [x] **T3.3 Tab-Coordination Lock:** Implemented `BroadcastChannel('erd-forge-storage-lock')` with active lease heartbeats, conflict notification modal, watchdog automatic recovery, and graceful takeover. (Report: `docs/future-development/reports/T3.3_TAB_COORDINATION_LOCK.md`)
* [x] **T3.4 Safe Idempotent Migrator:** Implemented `SafeStorageMigrator` with export backup, transactional insertion, row-count verification, and journal record in `_migration_journal`. Retained legacy IndexedDB intact. (Report: `docs/future-development/reports/T3.4_SAFE_IDEMPOTENT_MIGRATOR.md`)
* [x] **T3.5 Browser Matrix & Failure Injection:** Tested private browsing (IndexedDB fallback), worker termination during write, reload persistence, and multi-tab conflict recovery. (Report: `docs/future-development/reports/T3.5_BROWSER_MATRIX_AND_FAILURE_INJECTION.md`)

> **GATE G2 EXIT REVIEW:** All Track 2 (SQL Parser WASM Migration) and Track 3 (Official SQLite WASM & OPFS SAHPool) tasks are complete; legacy wa-sqlite uninstalled; 175/175 tests green across 28 test suites; 0 typecheck errors; 0 Biome errors; production build verified. Phase 2 is 100% COMPLETE. Gate 2 Approved.

---

## 5. Phase 3: Monorepo Package Extraction (Gate 3)
*Target: 4–6 engineer-days · Exit Gate: G3 Package Consumers Pass*

* [x] **T4.1 Package Boundaries & Contracts:** Froze API contracts for `@erd-forge/core`, `@erd-forge/parser-sdl`, and `@erd-forge/lineage` with `"private": true`, Zero-DOM, and Zero-React compiler boundaries. (Report: `docs/future-development/reports/T4.1_PACKAGE_BOUNDARIES_AND_CONTRACTS.md`)
* [x] **T4.2 Extract Core & SDL Parser:** Extracted models, command manager, layout geometry contracts, and Peggy SDL parser into `@erd-forge/core` and `@erd-forge/parser-sdl`. Verified Zero-DOM/Zero-React purity and 198/198 monorepo tests passing. (Report: `docs/future-development/reports/T4.2_EXTRACT_CORE_AND_SDL_PARSER.md`)
* [x] **T4.3 Extract Lineage:** Moved models, graph, AST walkers, symbol table, legacy/WASM parser adapters, and shadow comparator into `@erd-forge/lineage`. Maintained worker hosts in `apps/web`. 62/62 tests green, Zero-DOM purity verified. (Report: `docs/future-development/reports/T4.3_EXTRACT_LINEAGE.md`)
* [x] **T4.4 Consumer Validation:** Wired dependencies via `workspace:*`. Confirmed zero circular dependencies in DAG. Passed `pnpm build`, `pnpm typecheck`, `pnpm test`, and sub-second Biome linting across all packages. (Report: `docs/future-development/reports/T4.4_CONSUMER_VALIDATION.md`)

> **GATE G3 EXIT REVIEW:** All Phase 3 extraction tasks (T4.1, T4.2, T4.3, T4.4) completed; Zero-DOM and Zero-React purity verified; 260/260 tests green; 0 typecheck errors; production build verified. Phase 3 is 100% COMPLETE. Gate 3 Approved.

---

## 6. Phase 4: Release, Rollout & Rollback Runbook (COMPLETED ✅)
*Target: 3–5 engineer-days · Final Release Gate Sign-Off*

* [x] **R1: Release Verification Matrix:** Complete 6-point verification across test suite (260/260 tests), monorepo typecheck (4/4 packages), sub-second Biome linting (303ms), 500-table layout stress test, lineage differential parity on all warehouse dialects, and multi-tab storage failure injection matrix.
* [x] **R2: Shadow Rollout & Canary Strategy:** Implemented dual-engine shadow comparator in `@erd-forge/lineage`, off-thread worker evaluation, fallback fault-tolerance, and UI toolbar toggle.
* [x] **R3: Rollback Switchboard & Runbook:** Documented emergency rollback switchboard, trigger thresholds, and non-destructive recovery procedures.
* [x] **R4: Final Acceptance & Sign-off:** Monorepo quality gates 100% green across all 6 tracks and 4 phases. Production build verified. (Report: `docs/future-development/reports/PHASE_4_RELEASE_AND_ROLLOUT.md`)

### Rollback Switchboard (R3)

| Trigger | Immediate Action | Recovery Procedure |
|:---|:---|:---|
| **ELK Worker Failure / Stutter** | AbortSignal auto-terminates computation | Fallback to deterministic grid layout; capture graph fixture for worker bug fix. |
| **SQL Lineage Extraction Error** | Toggle `?parser=legacy` or click toolbar badge | Instant zero-downtime routing back to `node-sql-parser`; log failing AST node. |
| **Storage Migration Mismatch** | Migration transaction aborts automatically | Legacy IndexedDB remains active and 100% untouched; zero silent data loss. |
| **Tab Contention Deadlock** | Watchdog auto-clears lease after 5,000ms | Force tab release; secondary tab falls back gracefully to read-only session. |
| **Canvas Export Blank Image** | 32KB chunked base64 conversion active | Bypasses browser call-stack limits; falls back gracefully to system fonts. |

> **PROJECT COMPLETION REVIEW:** All tracks (ELK Layout, SQL Parser WASM Migration, Official SQLite WASM & OPFS, Monorepo Package Extraction, Export Hardening, Tooling Modernization) and all milestones (Gates G0, G1, G2, G3, Phase 4) are 100% COMPLETE and VERIFIED.

---

## 7. Pair-Programming Dispatch Protocol (Task Loop)

When tackling any task ID (e.g. `T1.1`, `T5.1`), use this standardized prompt pattern:

```markdown
**Task:** [Task ID, e.g. T1.1 — ELK Web Worker Setup]
**Context:** ERD Forge Tech Upgrade Plan (Track 1)
**Target Files:** [explicit list of files, e.g. apps/web/package.json, apps/web/src/core/layout/elkInstance.ts]
**Non-Goals:** Do not refactor autoLayout.ts or canvas components in this task.
**Acceptance Criteria:**
1. elkjs installed and pinned.
2. elkInstance.ts instantiates ELK with a Web Worker using import.meta.url.
3. Vite dev server boots without worker loading errors.
4. pnpm typecheck passes.
**Deliverable:** Small, reviewable git diff + local test verification command and output.
```
