# ERD Forge — Development Change Log

> This log tracks every change made to the codebase: **what** action was performed, **why** it was chosen, and **what impact** it has. It prevents repetitive work and provides full traceability.

---

## Entry 001 — 2026-09-15: Fix tsconfig.node.json emit error
| Field | Detail |
|---|---|
| **Action** | Added `"noEmit": true` to `tsconfig.node.json` and corrected project references |
| **Why** | TypeScript project references require referenced configs to have emit disabled when the parent uses `--noEmit` |
| **Impact** | Unblocked `pnpm typecheck` — prerequisite for all subsequent work |

## Entry 002 — 2026-09-15: Generate core Command classes
| Field | Detail |
|---|---|
| **Action** | Created 12 Command classes (table, column, relationship, domain, sheet) |
| **Why** | The audit report identified these as missing — they power the undo/redo stack |
| **Impact** | `CommandManager` can now execute any schema mutation with full undo support |

## Entry 003 — 2026-09-15: Generate layout and canvas component scaffolds
| Field | Detail |
|---|---|
| **Action** | Created StatusBar, ResizablePanel, MainToolbar, ViewNode, CanvasToolbar, MiniMap, ZoomControls components |
| **Why** | Audit report Action Items 20-21 required these for the UI shell |
| **Impact** | All layout slots are now filled — app renders a complete shell |

## Entry 004 — 2026-09-15: Wire AppShell layout with toolbar and status bar
| Field | Detail |
|---|---|
| **Action** | Updated AppShell.tsx to mount MainToolbar and StatusBar; restructured CSS grid to 4 rows |
| **Why** | Components existed but were not connected to the layout |
| **Impact** | App shows toolbar (Undo/Redo/Save/mode selector) at top, status bar at bottom |

## Entry 005 — 2026-09-15: Fix React Flow canvas rendering
| Field | Detail |
|---|---|
| **Action** | Rewrote ERDCanvas to use `useNodesState`/`useEdgesState`, added position persistence, fixed edge handle IDs, added `MarkerType.ArrowClosed` |
| **Why** | Canvas had 0-height, edges were invisible (handles mismatched), node positions reset on every keystroke |
| **Impact** | Tables are draggable, edges render with arrow markers, positions survive SDL re-parses |

## Entry 006 — 2026-09-15: Install CodeMirror extensions
| Field | Detail |
|---|---|
| **Action** | Added `@codemirror/autocomplete`, `@codemirror/lint`, `@lezer/highlight` as dependencies |
| **Why** | SDLEditor needed syntax highlighting, linting, and autocomplete |
| **Impact** | Editor now provides keyword completion and a linter stub |

---

## Entry 007 — 2026-09-15: MVP Interaction Sprint (Planned)
| Field | Detail |
|---|---|
| **Action** | Remove Inspector panel, make Catalog/Editor collapsible, wire SDL/Split/Canvas mode buttons, fix edge visibility |
| **Why** | User reports: no buttons work, panels not collapsible, Inspector wastes space, mode buttons non-functional, edge line still not visible |
| **Impact** | App becomes a usable simple ERD creator |

## Entry 008 — 2026-09-15: Fix ERD Relationship Visuals (dbdiagram style)
| Field | Detail |
|---|---|
| **Action** | Moved `<Handle>` components into individual table columns. Switched from `getSmoothStepPath` to `getBezierPath`. Set strict Left-to-Right layout logic. Added explicit `fill: 'none'` to BaseEdge SVG path. |
| **Why** | Connection lines were invisible or routing from top/bottom of tables rather than specifically pointing to the connected column fields. Emulate dbdiagram.io's clean bezier curves connecting directly from the column row itself. |
| **Impact** | Relationships are now visually precise, routing horizontally across the canvas with bright cyan Bezier curves connecting exactly from `users.id` to `posts.user_id` on the exact vertical height of those rows. |

## Entry 009 — 2026-09-15: Fix SVG 0-width collapse & reverse-engineer dbdiagram.io styling
| Field | Detail |
|---|---|
| **Action** | 1. Removed `svg { max-width: 100%; }` from `reset.css` and added `.react-flow svg { max-width: none; }` and explicit overflow/width overrides in `ERDCanvas.module.css`.<br/>2. Rebuilt `RelationEdge.tsx` using `getSmoothStepPath` with `borderRadius: 12` and clean floating cardinality badges.<br/>3. Added dual handles (left/right) per column and `ConnectionMode.Loose` so lines route cleanly regardless of table positions.<br/>4. Enhanced `TableNode.tsx` with primary key row tints, foreign key chain icons, and NN/PK pill badges matching dbdiagram.io reference. |
| **Why** | Root cause discovered: `reset.css` collapsed React Flow's edge SVG container to 0px width because its parent has 0 width, rendering all edge paths completely invisible. The user provided dbdiagram.io reference (`media_1789412645849.png`) demonstrating clean rounded-step routing and column row indicators. |
| **Impact** | Connection lines are now fully visible, routing with pristine dbdiagram.io rounded smoothstep curves directly from PK column rows to FK column rows, with high-contrast cardinality badges and seamless dragging. |

## Entry 010 — 2026-09-15: Interactive Catalog & Sidebar Collapse/Restore Fix
| Field | Detail |
|---|---|
| **Action** | 1. Added `selectedTable` state in `uiStore.ts` and wired two-way click synchronization in `ERDCanvas.tsx` using `useReactFlow().fitView` to smoothly center/zoom on selected tables.<br/>2. Added live search filtering and expandable column trees (with PK key icons and data types) in `Sidebar.tsx`.<br/>3. Added quick `+` New Table creator in the catalog header.<br/>4. Fixed the sidebar restore issue by adding a `PanelLeft` toggle in `MainToolbar.tsx` and a floating "Catalog" restore tab in `AppShell.tsx` when collapsed. |
| **Why** | The user requested an interactive catalog (search, inspecting columns, selecting tables) and noted that once collapsed, the sidebar could not be restored because the toggle button was trapped inside the 0-width sidebar. |
| **Impact** | The catalog is now fully interactive with search, column inspection, and canvas camera navigation. The sidebar can be collapsed and restored effortlessly from anywhere. |

## Entry 011 — 2026-09-15: SQL DDL Import Engine & Interactive Import Modal
| Field | Detail |
|---|---|
| **Action** | 1. Implemented SQL DDL parser (`sqlToSdl.ts`) supporting PostgreSQL, MySQL, SQLite, and SQL Server dialects (`CREATE TABLE`, table-level `PRIMARY KEY`, table-level and column-level `FOREIGN KEY ... REFERENCES ...`, `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`).<br/>2. Built `ImportModal.tsx` and `ImportModal.module.css` featuring dark glassmorphism styling, Esc key shortcut, 1-click sample presets (E-Commerce 5-table schema, Blog/CMS 5-table schema), local `.sql`/`.ddl` file upload reader, live regex stats chips (`detectSqlStats`), and Replace vs Append schema modes.<br/>3. Added `Import` action buttons in top `Header.tsx` and `Sidebar.tsx` catalog header.<br/>4. Rendered `<ImportModal />` in `App.tsx` mapped to `uiStore.activeModal === 'import'`.<br/>5. Added unit test suite `sqlToSdl.test.ts` covering multi-dialect constraint syntax and SDL text generation. |
| **Why** | Users with existing database schemas need to visualize and model their databases in ERD Forge without manually re-authoring them in SDL. |
## Entry 012 — 2026-09-15: Auto-Arrange & Hierarchical Auto-Layout Engine
| Field | Detail |
|---|---|
| **Action** | 1. Implemented `calculateAutoLayout` in `autoLayout.ts` using `@dagrejs/dagre` multigraph layout with dynamic table height estimation (`estimateTableHeight`).<br/>2. Configured Left-to-Right (LR) topological ranking with parent tables (primary keys) to the left and dependent child tables (foreign keys) to the right.<br/>3. Added `layoutEpoch`, `layoutDirection`, and `triggerAutoLayout` in `uiStore.ts`.<br/>4. Updated `ERDCanvas.tsx` to automatically layout unpositioned tables, smoothly animate layout updates with `fitView({ duration: 500, padding: 0.25 })`, and dynamically re-orient connection edge handles on node drag or layout.<br/>5. Added 1-click Auto-Arrange action buttons (`Sparkles` icon) in `MainToolbar.tsx` and on-canvas `<Controls>`.<br/>6. Wired `ImportModal.tsx` to automatically trigger auto-layout on SQL schema import.<br/>7. Created comprehensive unit test suite in `autoLayout.test.ts` (6 passing tests). |
| **Why** | Tables imported from SQL or added via SDL were placed in flat single-row horizontal offsets, requiring tedious manual dragging. Users needed an intelligent 1-click auto-arrange to immediately organize complex relational schemas into clean, readable diagrams. |
| **Impact** | Schemas are now automatically organized into structured, non-overlapping topological tiers with optimal connection line routing. |

## Entry 013 — 2026-10-08: Test Suite Isolation & Workspace Cleanup
| Field | Detail |
|---|---|
| **Action** | 1. Isolated all 15 test suites from `apps/web/src/**/__tests__` into a dedicated root-level test directory `apps/web/tests/` organized into `core/`, `lineage/`, `parsers/`, and `stores/`.<br/>2. Updated all import paths in test suites to use the `@/` Vite alias.<br/>3. Relocated loose root-level test scripts (`test-ast.*`, `test-parser.ts`) into `scratch/`.<br/>4. Verified all 63 unit, integration, and dialect validation tests pass smoothly via Vitest. |
| **Why** | Keeps source code strictly focused on production implementation, prevents clutter in production bundles, and provides a clear, discoverable location for all test suites. |
| **Impact** | Clean separation of concerns between source and test code; Vitest runs cleanly across all 15 test files with 100% pass rate. |

## Entry 014 — 2026-10-08: Repository Navigation Map & README Refresh
| Field | Detail |
|---|---|
| **Action** | 1. Created `REPO_NAVIGATION.md` providing an exhaustive, file-by-file directory tree, module responsibility breakdowns, architecture diagrams, and developer command cheatsheet.<br/>2. Updated `README.md` to reflect implemented capabilities: Code-First SDL modeling, dbdiagram-style canvas, multi-dialect SQL Lineage Studio (BigQuery, Snowflake, Redshift, Databricks, Postgres, MySQL), DDL importer, and local-first SQLite OPFS storage.<br/>3. Updated `docs/REPO_STRUCTURE.md` with cross-reference to `REPO_NAVIGATION.md`. |
| **Why** | User requested an updated README and a dedicated repository navigation file mapping out all files and folder hierarchy for rapid project orientation. |
| **Impact** | High clarity, transparent repository structure, and immediate developer onboarding guidance. |

## Entry 015 — 2026-10-08: Formal Technology Stack Requirements Specification
| Field | Detail |
|---|---|
| **Action** | 1. Authored `docs/TECH_STACK_REQUIREMENTS.md` detailing client hardware prerequisites, browser compatibility matrix (OPFS, Wasm, File System Access API), monorepo tooling, presentation layer, diagram engine, CodeMirror 6 language tools, multi-dialect SQL lineage engine, local storage layer, test pipeline, and SLA performance budgets.<br/>2. Cross-referenced `docs/TECH_STACK_REQUIREMENTS.md` in `README.md` and `REPO_NAVIGATION.md`. |
| **Why** | Consolidate technical stack prerequisites, architectural constraints, licensing governance, and SLA metrics into a dedicated, formal specification for engineering, compliance, and enterprise deployment teams. |
| **Impact** | Single source of truth for technical stack requirements, eliminating ambiguity across engineering and governance. |

## Entry 016 — 2026-10-08: Codebase Redundancy Cleanup
| Field | Detail |
|---|---|
| **Action** | 1. Deleted 30MB of root binaries (`node.zip`, `node/`).<br/>2. Deleted stale transpiled configs (`apps/web/vite.config.js`, `.tsbuildinfo`).<br/>3. Removed temporary scratch scripts from `scratch/`.<br/>4. Cleaned up unused imports across all UI components (`LineageToolbar.tsx`, `LineageSQLEditor.tsx`, `LineageInspector.tsx`, `ERDCanvas.tsx`, `ImportModal.tsx`) and internal utilities. |
| **Why** | Implement "Immediate" priority action items from the Redundancy Analysis Report to reduce technical debt, improve lint times, and clear disk bloat. |
| **Impact** | Recovered ~30MB disk space, eliminated confusing stale configs, and improved codebase hygiene. |

## Entry 017 — 2026-10-08: Codebase Redundancy Cleanup (Phase 2)
| Field | Detail |
|---|---|
| **Action** | 1. Deleted unused `ErrorPanel.tsx` and `ErrorPanel.module.css`.<br/>2. Deleted 10 unused Command pattern classes (`EditColumnCommand`, `RenameTableCommand`, etc.) that were not integrated with the Zustand stores. |
| **Why** | Follow-up on the redundancy audit to remove dead UI code and unintegrated architecture (YAGNI), reducing cognitive load for future maintenance. |
| **Impact** | Reduced source code footprint; simpler architectural surface area. |
