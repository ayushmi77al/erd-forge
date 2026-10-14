# ERD Forge — Repository Navigation & File Hierarchy

> Comprehensive map of the ERD Forge monorepo: directory layout, file-by-file hierarchy, module responsibilities, and architecture navigation.

---

## Table of Contents
1. [Repository Overview](#repository-overview)
2. [Complete File & Folder Hierarchy](#complete-file--folder-hierarchy)
3. [Architecture & Module Breakdown](#architecture--module-breakdown)
   - [apps/web/src/components](#1-appswebsrccomponents--ui-components)
   - [apps/web/src/core](#2-appswebsrccore--domain-models--commands)
   - [apps/web/src/lineage](#3-appswebsrclineage--sql-lineage-engine)
   - [apps/web/src/parsers](#4-appswebsrcparsers--sdl--ddl-parsers)
   - [apps/web/src/storage](#5-appswebsrcstorage--local-storage-adapters)
   - [apps/web/src/stores](#6-appswebsrcstores--zustand-state-stores)
   - [apps/web/src/styles](#7-appswebsrcstyles--design-system--themes)
   - [apps/web/src/workers](#8-appswebsrcworkers--web-workers)
   - [apps/web/tests](#9-appswebtests--test-suites)
   - [docs](#10-docs--specifications--architecture)
   - [Root Configuration & Tooling](#11-root-configuration--tooling)
4. [Key Entry Points & Flow](#key-entry-points--flow)
5. [Commands & Developer Cheatsheet](#commands--developer-cheatsheet)

---

## Repository Overview

ERD Forge is structured as a **pnpm + Turborepo** monorepo designed for local-first, privacy-respecting database modeling, diagramming, and SQL lineage exploration.

| Path | Purpose |
|------|---------|
| [`apps/web/`](./apps/web) | Primary React 19 + Vite 5 single-page application & PWA |
| [`apps/web/src/`](./apps/web/src) | Application source code (components, core models, parsers, lineage engine, stores) |
| [`apps/web/tests/`](./apps/web/tests) | Vitest test suites (15 test suites, 63 passing tests) isolated from source |
| [`docs/`](./docs) | Architecture specifications, Business Requirements (BRD), ADRs, and schema docs |
| [`packages/`](./packages) | Workspace packages directory reserved for future extracted core modules |
| [`scratch/`](./scratch) | Developer migration scripts, AST exploration helpers, and scratch files |
| [`gemini_artifacts/`](./gemini_artifacts) | Project audit reports, implementation roadmaps, and lineage design plans |

---

## Complete File & Folder Hierarchy

```
Area51/
├── .agents/                                # AI agent configs, rules, and workflows
│   ├── rules/
│   │   ├── coding-standards.md             # Enforced architectural & coding conventions
│   │   ├── devlog-tracking.md              # Rule for recording development changes
│   │   └── graphify.md                     # Knowledge graph integration rule
│   ├── skills/
│   │   └── erd-forge-builder/
│   │       └── SKILL.md                    # ERD Forge builder skill guide
│   └── workflows/
│       └── graphify.md                     # Graphify workflow configuration
├── apps/
│   └── web/                                # Frontend application (React 19, Vite, React Flow)
│       ├── public/
│       │   └── fonts/                      # Static typography assets
│       ├── src/
│       │   ├── components/                 # Presentation & UI layer
│       │   │   ├── canvas/                 # ERD Visual Canvas components
│       │   │   │   ├── edges/
│       │   │   │   │   └── RelationEdge.tsx    # Smoothstep Bezier edge with cardinality badges
│       │   │   │   ├── nodes/
│       │   │   │   │   ├── TableNode.module.css
│       │   │   │   │   └── TableNode.tsx       # dbdiagram-style table node with column handles
│       │   │   │   ├── ERDCanvas.module.css
│       │   │   │   └── ERDCanvas.tsx           # React Flow canvas wrapper for ERD
│       │   │   ├── editor/                 # CodeMirror 6 SDL Editor
│       │   │   │   ├── sdl-language/       # Custom language support for ERD Forge SDL
│       │   │   │   │   ├── autocomplete.ts # Keyword and entity autocompletion
│       │   │   │   │   ├── highlight.ts    # Syntax highlighting rules
│       │   │   │   │   └── linter.ts       # In-editor error checking & lint diagnostics
│       │   │   │   ├── ErrorPanel.module.css
│       │   │   │   ├── ErrorPanel.tsx          # Collapsible SDL syntax error tray
│       │   │   │   ├── SDLEditor.module.css
│       │   │   │   └── SDLEditor.tsx           # Main CodeMirror editor component
│       │   │   ├── layout/                 # Application shell & structural scaffolding
│       │   │   │   ├── AppShell.module.css
│       │   │   │   ├── AppShell.tsx            # Main shell with resizable panes & restore bars
│       │   │   │   ├── Header.module.css
│       │   │   │   ├── Header.tsx              # Top navigation header (project title, actions)
│       │   │   │   ├── ResizablePanel.module.css
│       │   │   │   ├── ResizablePanel.tsx      # Drag-to-resize panel component
│       │   │   │   ├── Sidebar.module.css
│       │   │   │   ├── Sidebar.tsx             # Data Catalog sidebar with search & table trees
│       │   │   │   ├── StatusBar.module.css
│       │   │   │   └── StatusBar.tsx           # Bottom status bar (zoom, table count, health)
│       │   │   ├── lineage/                # SQL Lineage Studio UI
│       │   │   │   ├── nodes/
│       │   │   │   │   ├── SqlLineageNode.module.css
│       │   │   │   │   └── SqlLineageNode.tsx  # Lineage node (Table/View/CTE/Virtual/External)
│       │   │   │   ├── LineageCanvas.module.css
│       │   │   │   ├── LineageCanvas.tsx       # Interactive lineage graph canvas with minimap
│       │   │   │   ├── LineageInspector.module.css
│       │   │   │   ├── LineageInspector.tsx    # Node details, upstream/downstream dependencies
│       │   │   │   ├── LineageSQLEditor.module.css
│       │   │   │   ├── LineageSQLEditor.tsx    # SQL query authoring editor with dialect selector
│       │   │   │   ├── LineageTab.module.css
│       │   │   │   ├── LineageTab.tsx          # Lineage Studio tab root view
│       │   │   │   ├── LineageToolbar.module.css
│       │   │   │   ├── LineageToolbar.tsx      # Lineage toolbar (dialect, sample queries, layout)
│       │   │   │   ├── SquishyToggle.module.css
│       │   │   │   └── SquishyToggle.tsx       # Physics-inspired squishy toggle switch
│       │   │   ├── modals/                 # Application dialogs & overlays
│       │   │   │   ├── ImportModal.module.css
│       │   │   │   └── ImportModal.tsx         # Multi-dialect SQL DDL import modal
│       │   │   └── toolbar/                # ERD Canvas toolbar controls
│       │   │       ├── MainToolbar.module.css
│       │   │       └── MainToolbar.tsx         # Undo, Redo, Auto-Arrange, View Mode toggles
│       │   ├── core/                       # Domain logic, models, and command system
│       │   │   ├── commands/               # Command Pattern undo/redo implementations
│       │   │   │   ├── column/
│       │   │   │   │   ├── AddColumnCommand.ts
│       │   │   │   │   ├── EditColumnCommand.ts
│       │   │   │   │   └── RemoveColumnCommand.ts
│       │   │   │   ├── domain/
│       │   │   │   │   ├── AddDomainCommand.ts
│       │   │   │   │   └── AssignDomainCommand.ts
│       │   │   │   ├── relationship/
│       │   │   │   │   ├── AddRelationshipCommand.ts
│       │   │   │   │   └── RemoveRelationshipCommand.ts
│       │   │   │   ├── sheet/
│       │   │   │   │   ├── AddEntityToSheetCommand.ts
│       │   │   │   │   ├── AddSheetCommand.ts
│       │   │   │   │   └── UpdateLayoutCommand.ts
│       │   │   │   ├── table/
│       │   │   │   │   ├── AddTableCommand.ts
│       │   │   │   │   ├── RemoveTableCommand.ts
│       │   │   │   │   └── RenameTableCommand.ts
│       │   │   │   ├── Command.ts              # Command abstract base class
│       │   │   │   └── CommandManager.ts       # History stack management (undo/redo)
│       │   │   ├── layout/
│       │   │   │   └── autoLayout.ts           # Dagre topological auto-arrange engine
│       │   │   └── models/                     # Immutable domain types & interfaces
│       │   │       ├── Column.ts               # Column definition (pk, fk, type, nullable)
│       │   │       ├── Comment.ts              # Field and table level discussion threads
│       │   │       ├── Domain.ts               # Business domain boundary definition
│       │   │       ├── GlossaryTerm.ts         # Business glossary metadata
│       │   │       ├── index.ts                # Barrel export for models
│       │   │       ├── Project.ts              # Root project schema and metadata
│       │   │       ├── Relationship.ts         # Foreign key / cardinality relationships
│       │   │       ├── Sheet.ts                # Diagram views / canvases per project
│       │   │       ├── Table.ts                # Table entity model
│       │   │       └── Tag.ts                  # Tagging metadata
│       │   ├── lineage/                    # SQL Lineage Parsing & Graph Engine
│       │   │   ├── constants/
│       │   │   │   └── sampleQueries.ts        # Presets (Multi-Dialect, E-Commerce, CTEs, Unions)
│       │   │   ├── graph/
│       │   │   │   ├── ERDLinker.ts            # Bridges lineage nodes with ERD canvas tables
│       │   │   │   └── PipelineStitcher.ts     # Multi-statement ETL lineage pipeline builder
│       │   │   ├── layout/
│       │   │   │   └── lineageLayout.ts        # Layered DAG layout algorithm for lineage nodes
│       │   │   ├── models/
│       │   │   │   ├── index.ts
│       │   │   │   ├── LineageEdge.ts          # Edge data model (source, target, column mapping)
│       │   │   │   ├── LineageGraph.ts         # Complete lineage graph representation
│       │   │   │   └── LineageNode.ts          # Node model (Table, View, CTE, Subquery, Virtual)
│       │   │   ├── parser/
│       │   │   │   ├── ASTWalker.ts            # Recursive AST traversal across query clauses
│       │   │   │   ├── sqlLineageParser.ts     # Main lineage parser (BigQuery, Snowflake, etc.)
│       │   │   │   └── SymbolTable.ts          # Scope & alias resolution symbol table
│       │   │   └── utils/
│       │   │       └── exportUtils.ts          # Export lineage diagrams as JSON / PNG / SVG
│       │   ├── parsers/                    # Language & schema parsers
│       │   │   ├── sdl/
│       │   │   │   ├── grammar.pegjs           # Peggy source grammar for ERD Forge SDL
│       │   │   │   ├── grammar.js              # Compiled Peggy parser JavaScript
│       │   │   │   ├── SDLParser.ts            # Safe SDL parse wrapper with diagnostics
│       │   │   │   ├── SDLSerializer.ts        # Converts internal schema back to SDL text
│       │   │   │   └── SDLValidator.ts         # Semantic validation (missing references, cycles)
│       │   │   └── sql/
│       │   │       └── sqlToSdl.ts             # DDL parser converting CREATE/ALTER TABLE to SDL
│       │   ├── storage/                    # Storage abstraction layer
│       │   │   ├── migrations/
│       │   │   │   ├── 001_initial_schema.sql  # SQLite catalog schema definition
│       │   │   │   └── MigrationRunner.ts      # Database migration execution engine
│       │   │   ├── FileSystemAdapter.ts        # File System Access API adapter
│       │   │   ├── index.ts                    # Storage module export
│       │   │   ├── IndexedDBAdapter.ts         # IDB storage fallback
│       │   │   ├── OPFSSQLiteAdapter.ts        # wa-sqlite SQLite-over-OPFS implementation
│       │   │   └── StorageAdapter.ts           # Unified storage interface
│       │   ├── stores/                     # Reactive state management (Zustand + Immer)
│       │   │   ├── canvasStore.ts          # Canvas viewport, zoom, and node positions
│       │   │   ├── catalogStore.ts         # Catalog search, filter, and selection state
│       │   │   ├── editorStore.ts          # CodeMirror cursor, content, and lint state
│       │   │   ├── historyStore.ts         # Command stack state (canUndo, canRedo)
│       │   │   ├── index.ts                # Stores barrel export
│       │   │   ├── lineageStore.ts         # SQL lineage query, graph, node selection & dialect
│       │   │   ├── projectStore.ts         # Active project metadata and schema definitions
│       │   │   ├── sdlStore.ts             # Active SDL source and AST synchronization
│       │   │   └── uiStore.ts              # Modal states, active tabs, panel dimensions
│       │   ├── styles/                     # Styling & design system tokens
│       │   │   ├── themes/
│       │   │   │   ├── dark.css            # Dark theme color variables
│       │   │   │   └── light.css           # Light theme color variables
│       │   │   ├── global.css              # Global application typography & styles
│       │   │   ├── reset.css               # CSS reset
│       │   │   └── tokens.css              # Design tokens (colors, spacing, shadows, borders)
│       │   ├── types/                      # Ambient TypeScript definitions
│       │   │   ├── file-system-access.d.ts # FSA API typing
│       │   │   └── sdl.d.ts                # AST node type definitions for SDL
│       │   ├── workers/                    # Web Workers for off-main-thread compute
│       │   │   ├── lineage.worker.ts       # Background SQL lineage computation
│       │   │   └── parser.worker.ts        # Background Peggy SDL parsing
│       │   ├── App.tsx                     # Top-level application component with tab routing
│       │   ├── main.tsx                    # Application entry point mounting to DOM
│       │   └── vite-env.d.ts               # Vite environment types
│       ├── tests/                          # Vitest Test Suites (Rooted under tests/)
│       │   ├── core/
│       │   │   ├── commands/
│       │   │   │   ├── column/
│       │   │   │   │   └── AddColumnCommand.test.ts    # Column creation & undo testing
│       │   │   │   ├── table/
│       │   │   │   │   └── RemoveTableCommand.test.ts # Table deletion & restoration testing
│       │   │   │   └── CommandManager.test.ts          # History stack, undo/redo limits
│       │   │   └── layout/
│       │   │       └── autoLayout.test.ts              # Dagre topological rank layout tests
│       │   ├── lineage/
│       │   │   ├── validation/
│       │   │   │   ├── clause-dependencies.test.ts     # SELECT, WHERE, GROUP BY dependencies
│       │   │   │   ├── cte-scopes.test.ts              # WITH ... AS CTE scoping & masking
│       │   │   │   ├── dialects.test.ts                # BigQuery, Snowflake, Redshift, etc.
│       │   │   │   ├── nested-subqueries.test.ts       # Deeply nested subquery resolution
│       │   │   │   ├── qualified-names.test.ts         # db.schema.table multi-part identifiers
│       │   │   │   └── union-operations.test.ts        # UNION & UNION ALL multi-branch tests
│       │   │   ├── rank.test.ts                        # Topological level assignment tests
│       │   │   └── sqlLineageParser.test.ts            # End-to-end SQL lineage AST parser tests
│       │   ├── parsers/
│       │   │   ├── sdl/
│       │   │   │   └── SDLParser.test.ts               # Peggy SDL parser validation tests
│       │   │   └── sql/
│       │   │       └── sqlToSdl.test.ts                # SQL DDL to SDL conversion tests
│       │   └── stores/
│       │       └── sdlStore.test.ts                    # Zustand SDL store synchronizer tests
│       ├── index.html                      # HTML shell template
│       ├── package.json                    # Web app package manifest & dependencies
│       ├── tsconfig.json                   # TypeScript configuration
│       ├── tsconfig.node.json              # TypeScript configuration for Vite/Node tooling
│       └── vite.config.ts                  # Vite build & Vitest configuration
├── docs/                                   # Project Documentation & Architecture
│   ├── ADRs/
│   │   └── ADR-001-to-004.md               # Architecture Decision Records
│   ├── ARCHITECTURE.md                     # Deep technical architecture & storage design
│   ├── BRD.md                              # Business Requirements Document
│   ├── CONTRIBUTING.md                     # Contributor guidelines
│   ├── DATABASE_SCHEMA.md                  # Project file schema & SQLite catalog specs
│   ├── REPO_STRUCTURE.md                   # Initial architectural layout blueprint
│   ├── ROADMAP.md                          # Release phases & planned capabilities
│   ├── SDL_REFERENCE.md                    # Syntax guide for the Schema Definition Language
│   ├── TECH_STACK_REQUIREMENTS.md          # Technology stack, system requirements & SLAs
│   └── UI_UX_SPEC.md                       # Design system & user experience specification
├── gemini_artifacts/                       # Audit & Planning Documents
│   ├── audit_report.md
│   ├── implementation_plan.md
│   ├── plan.md
│   ├── sql-lineage-gap-analysis.md
│   ├── sql_lineage_requirements.md
│   └── walkthrough.md
├── packages/                               # Monorepo packages directory (future shared libs)
├── scratch/                                # Scratchpad and maintenance utilities
│   ├── move_tests.js                       # Test migration script
│   ├── test-ast.js                         # AST inspection scratch script
│   ├── test-ast.ts                         # TypeScript AST inspector
│   └── test-parser.ts                      # Parser testing playground
├── DEVLOG.md                               # Chronological engineering decision log
├── package.json                            # Monorepo root configuration & scripts
├── pnpm-lock.yaml                          # Exact dependency lockfile
├── pnpm-workspace.yaml                     # pnpm workspace definition
├── README.md                               # Project presentation & quick start guide
├── REPO_NAVIGATION.md                      # This file
└── turbo.json                              # Turborepo task pipeline configuration
```

---

## Architecture & Module Breakdown

### 1. `apps/web/src/components` — UI Components
All user interface elements are grouped logically by capability and feature area:
- **`canvas/`**: The visual interactive ERD canvas built with `@xyflow/react`.
  - [`ERDCanvas.tsx`](./apps/web/src/components/canvas/ERDCanvas.tsx): Core canvas handling viewport zoom, panning, table selection, and layout rendering.
  - [`nodes/TableNode.tsx`](./apps/web/src/components/canvas/nodes/TableNode.tsx): Table card with individual column handles (left/right) for precise connection routing, PK key badges, and FK indicators.
  - [`edges/RelationEdge.tsx`](./apps/web/src/components/canvas/edges/RelationEdge.tsx): Custom SVG connection path rendering smooth curves with cardinality markers (e.g., `1`, `N`).
- **`editor/`**: CodeMirror 6 code editor for ERD Forge SDL.
  - [`SDLEditor.tsx`](./apps/web/src/components/editor/SDLEditor.tsx): Embedded text editor syncing live keystrokes to the canvas with debounce.
  - [`sdl-language/`](./apps/web/src/components/editor/sdl-language): Custom grammar highlighting, schema autocompletion, and real-time linter diagnostics.
  - [`ErrorPanel.tsx`](./apps/web/src/components/editor/ErrorPanel.tsx): Drawer highlighting syntax errors with exact line and column numbers.
- **`lineage/`**: The SQL Lineage Studio interface.
  - [`LineageTab.tsx`](./apps/web/src/components/lineage/LineageTab.tsx): Container with split-view layout between SQL editor, lineage graph, and inspector.
  - [`LineageCanvas.tsx`](./apps/web/src/components/lineage/LineageCanvas.tsx): Visual graph rendering of SQL data pipelines.
  - [`LineageSQLEditor.tsx`](./apps/web/src/components/lineage/LineageSQLEditor.tsx): SQL query editor with dialect switcher and parse status.
  - [`LineageInspector.tsx`](./apps/web/src/components/lineage/LineageInspector.tsx): Detailed drawer displaying table columns, CTE origins, and upstream/downstream dependencies.
  - [`LineageToolbar.tsx`](./apps/web/src/components/lineage/LineageToolbar.tsx): Lineage controls with sample queries and layout controls.
  - [`SquishyToggle.tsx`](./apps/web/src/components/lineage/SquishyToggle.tsx): Physics-based toggle for switching Lineage / ERD modes.
- **`layout/`**: Shell elements including [`AppShell.tsx`](./apps/web/src/components/layout/AppShell.tsx), [`Sidebar.tsx`](./apps/web/src/components/layout/Sidebar.tsx) (Data Catalog search & table explorer), [`Header.tsx`](./apps/web/src/components/layout/Header.tsx), and [`StatusBar.tsx`](./apps/web/src/components/layout/StatusBar.tsx).
- **`modals/`**: [`ImportModal.tsx`](./apps/web/src/components/modals/ImportModal.tsx) for importing SQL DDL from files or clipboard into the active schema.
- **`toolbar/`**: [`MainToolbar.tsx`](./apps/web/src/components/toolbar/MainToolbar.tsx) for canvas zoom, fit view, auto-layout, undo, and redo actions.

---

### 2. `apps/web/src/core` — Domain Models & Commands
- **`models/`**: Strongly-typed domain models representing database objects:
  - [`Table.ts`](./apps/web/src/core/models/Table.ts), [`Column.ts`](./apps/web/src/core/models/Column.ts), [`Relationship.ts`](./apps/web/src/core/models/Relationship.ts), [`Domain.ts`](./apps/web/src/core/models/Domain.ts), [`Sheet.ts`](./apps/web/src/core/models/Sheet.ts), [`Project.ts`](./apps/web/src/core/models/Project.ts).
- **`commands/`**: Command Pattern engine enabling transactional mutations with full undo/redo:
  - [`CommandManager.ts`](./apps/web/src/core/commands/CommandManager.ts): Manages execute, undo, and redo stacks.
  - Subcommands: [`AddTableCommand.ts`](./apps/web/src/core/commands/table/AddTableCommand.ts), [`RemoveTableCommand.ts`](./apps/web/src/core/commands/table/RemoveTableCommand.ts), [`AddColumnCommand.ts`](./apps/web/src/core/commands/column/AddColumnCommand.ts), etc.
- **`layout/`**: [`autoLayout.ts`](./apps/web/src/core/layout/autoLayout.ts):
  - Uses `@dagrejs/dagre` multigraph layout engine.
  - Dynamically calculates table heights and organizes tables into left-to-right topological tiers based on foreign key relationships.

---

### 3. `apps/web/src/lineage` — SQL Lineage Engine
A robust parser and pipeline analyzer transforming SQL scripts into dependency graphs:
- **`parser/sqlLineageParser.ts`**: Core entry point parsing multi-statement SQL with multi-dialect support (BigQuery, Snowflake, Redshift, Databricks, PostgreSQL, MySQL).
- **`parser/ASTWalker.ts`**: Traverses AST clauses (`SELECT`, `FROM`, `JOIN`, `WHERE`, `GROUP BY`, `UNION`) to extract table and column dependencies.
- **`parser/SymbolTable.ts`**: Resolves CTE definitions (`WITH ... AS`), subqueries, and aliases to their canonical source tables.
- **`graph/ERDLinker.ts`**: Maps SQL lineage nodes to existing ERD schema tables to bridge lineage insights with schema architecture.
- **`layout/lineageLayout.ts`**: Arranges lineage nodes hierarchically from sources (Rank 0) through transformations to targets.

---

### 4. `apps/web/src/parsers` — SDL & DDL Parsers
- **`sdl/`**: Schema Definition Language parser.
  - [`grammar.pegjs`](./apps/web/src/parsers/sdl/grammar.pegjs): PEG grammar defining tables, domains, columns, constraints, references, and notes.
  - [`SDLParser.ts`](./apps/web/src/parsers/sdl/SDLParser.ts): High-level parser converting SDL text into internal TypeScript models.
  - [`SDLSerializer.ts`](./apps/web/src/parsers/sdl/SDLSerializer.ts): Serializes project models back into clean, formatted SDL syntax.
- **`sql/sqlToSdl.ts`**: Reverse-engineers standard SQL `CREATE TABLE` and `ALTER TABLE` statements into ERD Forge SDL format.

---

### 5. `apps/web/src/storage` — Local Storage Adapters
- [`StorageAdapter.ts`](./apps/web/src/storage/StorageAdapter.ts): Common interface for storage backends.
- [`OPFSSQLiteAdapter.ts`](./apps/web/src/storage/OPFSSQLiteAdapter.ts): High-performance SQLite database embedded in Origin Private File System using `wa-sqlite`.
- [`IndexedDBAdapter.ts`](./apps/web/src/storage/IndexedDBAdapter.ts): Browser fallback storage.
- [`FileSystemAdapter.ts`](./apps/web/src/storage/FileSystemAdapter.ts): Direct disk read/write via browser File System Access API.

---

### 6. `apps/web/src/stores` — Zustand State Stores
Decoupled, observable stores powered by Zustand and Immer:
- [`projectStore.ts`](./apps/web/src/stores/projectStore.ts): Tables, columns, relationships, domains, active sheet.
- [`sdlStore.ts`](./apps/web/src/stores/sdlStore.ts): Raw SDL text, AST cache, and error list.
- [`canvasStore.ts`](./apps/web/src/stores/canvasStore.ts): Node positions, zoom level, pan offsets, selected node.
- [`lineageStore.ts`](./apps/web/src/stores/lineageStore.ts): Current SQL query, parsed lineage graph, selected lineage node, active dialect.
- [`uiStore.ts`](./apps/web/src/stores/uiStore.ts): Modal state, active tab (`erd` vs `lineage`), sidebar collapsed state, auto-layout trigger.
- [`historyStore.ts`](./apps/web/src/stores/historyStore.ts): Exposes undo and redo availability to the UI.

---

### 7. `apps/web/src/styles` — Design System & Themes
- [`tokens.css`](./apps/web/src/styles/tokens.css): Comprehensive design system tokens (palette, spacing, shadows, radii, z-indices).
- [`themes/dark.css`](./apps/web/src/styles/themes/dark.css) & [`themes/light.css`](./apps/web/src/styles/themes/light.css): Palette themes adhering to WCAG contrast standards.
- [`global.css`](./apps/web/src/styles/global.css): Global font configurations (Inter variable, JetBrains Mono variable).

---

### 8. `apps/web/src/workers` — Web Workers
- [`parser.worker.ts`](./apps/web/src/workers/parser.worker.ts): Executes Peggy SDL parsing in a web worker to guarantee zero UI stuttering on large schemas.
- [`lineage.worker.ts`](./apps/web/src/workers/lineage.worker.ts): Offloads heavy SQL parsing and dependency graph building.

---

### 9. `apps/web/tests` — Test Suites
All automated tests are cleanly isolated in [`apps/web/tests/`](./apps/web/tests):

```
apps/web/tests/
├── core/
│   ├── commands/
│   │   ├── column/AddColumnCommand.test.ts   # Tests column addition & rollback
│   │   ├── table/RemoveTableCommand.test.ts  # Tests table removal & restoration
│   │   └── CommandManager.test.ts            # Stack limits & execution sequence
│   └── layout/autoLayout.test.ts             # Dagre layout coordinates & non-overlapping tiers
├── lineage/
│   ├── validation/
│   │   ├── clause-dependencies.test.ts       # SELECT, WHERE, HAVING column extractions
│   │   ├── cte-scopes.test.ts                # WITH CTE isolation & masking
│   │   ├── dialects.test.ts                  # BigQuery, Snowflake, Redshift, Databricks syntax
│   │   ├── nested-subqueries.test.ts         # Deep subquery dependency propagation
│   │   ├── qualified-names.test.ts           # Multi-part naming (database.schema.table)
│   │   └── union-operations.test.ts          # Compound queries (UNION / UNION ALL)
│   ├── rank.test.ts                          # Topological stage hierarchy (sources -> targets)
│   └── sqlLineageParser.test.ts              # Full SQL AST parse & edge construction
├── parsers/
│   ├── sdl/SDLParser.test.ts                 # Full SDL grammar parse tests
│   └── sql/sqlToSdl.test.ts                  # DDL conversion tests (Postgres, MySQL, SQLite)
└── stores/
    └── sdlStore.test.ts                      # Reactive synchronization tests
```

---

### 10. `docs` — Specifications & Architecture
In-depth technical and business specifications:
- [`ARCHITECTURE.md`](./docs/ARCHITECTURE.md): System architecture, storage engine design, and performance budgeting.
- [`TECH_STACK_REQUIREMENTS.md`](./docs/TECH_STACK_REQUIREMENTS.md): Comprehensive system prerequisites, browser compatibility, library versions, and SLAs.
- [`BRD.md`](./docs/BRD.md): Business requirements, user personas, and target outcomes.
- [`DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md): DDL schemas for `.erdforge` project files and SQLite catalog.
- [`SDL_REFERENCE.md`](./docs/SDL_REFERENCE.md): Full syntax guide and examples for ERD Forge SDL.
- [`UI_UX_SPEC.md`](./docs/UI_UX_SPEC.md): Visual hierarchy, keyboard shortcuts, and component interaction states.
- [`ROADMAP.md`](./docs/ROADMAP.md): Release schedule across 4 phases.

---

### 11. Root Configuration & Tooling
- [`package.json`](./package.json): Defines root scripts for Turborepo orchestration.
- [`turbo.json`](./turbo.json): Turborepo caching pipelines for `build`, `test`, `typecheck`, and `lint`.
- [`pnpm-workspace.yaml`](./pnpm-workspace.yaml): Declares monorepo workspaces (`apps/*`, `packages/*`).
- [`DEVLOG.md`](./DEVLOG.md): Detailed chronological log of code modifications and rationale.

---

## Key Entry Points & Flow

```
                      ┌────────────────────────┐
                      │    apps/web/main.tsx   │
                      └───────────┬────────────┘
                                  │ mounts
                      ┌───────────▼────────────┐
                      │    apps/web/App.tsx    │
                      └───────────┬────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         │ activeTab: 'erd'                                │ activeTab: 'lineage'
┌────────▼───────────────┐                       ┌─────────▼──────────────┐
│  AppShell.tsx (Layout) │                       │     LineageTab.tsx     │
├────────────────────────┤                       ├────────────────────────┤
│ • Sidebar (Catalog)    │                       │ • LineageSQLEditor     │
│ • SDLEditor (Code)     │                       │ • LineageToolbar       │
│ • ERDCanvas (Diagram)  │                       │ • LineageCanvas (Flow) │
│ • StatusBar (Metrics)  │                       │ • LineageInspector     │
└────────────────────────┘                       └────────────────────────┘
```

1. **User opens ERD Canvas**:
   - `sdlStore` initializes default schema or loads project.
   - `SDLParser` converts text into `Table[]` and `Relationship[]`.
   - `autoLayout` arranges tables topologically using Dagre.
   - `ERDCanvas` mounts React Flow nodes (`TableNode`) and edges (`RelationEdge`).
2. **User switches to SQL Lineage**:
   - `LineageTab` mounts.
   - User inputs or selects SQL query (BigQuery, Snowflake, Postgres, etc.).
   - `sqlLineageParser` uses AST traversal to build `LineageGraph`.
   - `lineageLayout` computes hierarchical layer positions.
   - `LineageCanvas` renders interactive pipeline DAG with click-to-inspect dependencies.

---

## Commands & Developer Cheatsheet

Run from the repository root:

```bash
# Start local development server
pnpm dev

# Run all automated tests (63 tests across 15 suites)
pnpm test

# Run tests in watch mode
pnpm --filter @erd-forge/web test:watch

# Typecheck TypeScript files
pnpm typecheck

# Recompile the Peggy SDL grammar
pnpm --filter @erd-forge/web build:grammar

# Build production bundle
pnpm build
```
