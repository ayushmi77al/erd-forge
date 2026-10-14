# ERD Forge

> **Design. Document. Govern. All locally.**

A local-first, production-grade Entity Relationship Diagram (ERD) modeling and SQL Lineage platform that combines code-first schema definition, visual diagram editing, multi-dialect SQL lineage tracing, and data catalog governance — with zero cloud dependency.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646cff.svg)](https://vitejs.dev/)
[![React Flow](https://img.shields.io/badge/React_Flow-v12-ff0072.svg)](https://reactflow.dev/)
[![Tests](https://img.shields.io/badge/Vitest-63%20Passing-brightgreen.svg)](./apps/web/tests)
[![CI](https://github.com/fobiddenai/erd-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/fobiddenai/erd-forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## What is ERD Forge?

ERD Forge unites your **schema modeling**, **SQL data lineage**, **data catalog**, and **business documentation** into a single cohesive, lightning-fast workstation running entirely on your machine.

| You want to... | ERD Forge gives you... |
|---------------|----------------------|
| **Define schemas in code** | A dedicated Schema Definition Language (SDL) with real-time diagram rendering |
| **Inspect database relationships** | dbdiagram-inspired canvas with smooth bezier routing and column-level handles |
| **Trace data pipelines & lineage** | Full SQL Lineage Studio supporting BigQuery, Snowflake, Redshift, Databricks, PostgreSQL, and MySQL |
| **Import existing databases** | Multi-dialect SQL DDL reverse engineering (`CREATE TABLE`, `ALTER TABLE`, foreign keys) |
| **Auto-arrange complex schemas** | 1-click Dagre topological layout engine ordering entities into clear dependency tiers |
| **Navigate large schemas** | Real-time catalog search, column type inspection, and canvas camera auto-focus |
| **Safeguard design iterations** | Transactional Command Pattern with unlimited undo/redo history |
| **Stay private & portable** | 100% local. Zero telemetry or cloud required. SQLite embedded in browser OPFS |

---

## Core Capabilities

### 1. Code-First Schema Modeling (SDL)
- **Custom Peggy Grammar**: High-performance parser compiling ERD Forge SDL into typed relational models.
- **CodeMirror 6 Editor**: Syntax highlighting, entity autocompletion, live error underlining, and a dedicated error diagnostic tray.
- **Bi-directional Synchronization**: Changes in the SDL editor reflect immediately on the canvas; table movements preserve across parses.

### 2. Interactive ERD Canvas
- **Direct Column Handles**: Connection lines route with precision from primary key rows directly to foreign key target rows.
- **Rounded Bezier Edges**: Clear, collision-minimized lines with interactive cardinality badges (`1`, `N`).
- **1-Click Auto-Arrange**: Topological Dagre engine organizes tables left-to-right from parent sources to dependent child tables.
- **Visual Table Cards**: Field icons, PK pill badges, nullability indicators, and domain tags.

### 3. Multi-Dialect SQL Lineage Studio
- **Deep AST Parsing**: Powered by recursive AST walkers and scope symbol tables.
- **Enterprise Dialect Support**: Validated across BigQuery, Snowflake, Amazon Redshift, Databricks, PostgreSQL, and MySQL.
- **Advanced SQL Patterns**: Resolves `WITH` CTE scopes, nested subqueries, compound `UNION` / `UNION ALL` statements, and multi-part qualified names (`db.schema.table`).
- **Interactive Inspector**: Inspect upstream sources, downstream sinks, column mappings, and virtual/external table classifications.
- **Physics-Inspired Squishy Mode**: Fluid toggle between ERD and Lineage workspaces.

### 4. SQL DDL Reverse Engineering
- **Import Modal**: Paste raw DDL scripts or drag-and-drop `.sql`/`.ddl` schema files.
- **Multi-Dialect DDL**: Extracts tables, columns, primary keys, foreign keys, and inline or `ALTER TABLE` constraints.
- **Built-in Presets**: 1-click demo schemas (E-Commerce, Blog/CMS) to instantly explore complex schemas.

### 5. Local-First & Zero-Cloud Storage
- **wa-sqlite (OPFS)**: High-speed SQLite running inside the browser's Origin Private File System.
- **File System Access API**: Direct open/save integration with your local hard drive.
- **Offline Reliability**: Fully functional without network connectivity.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Core UI** | React 19 + TypeScript 5.5 | Type-safe reactive component tree |
| **Build & Tooling** | Vite 5 + Turborepo + pnpm | Instant HMR, monorepo pipeline orchestration |
| **Diagram Canvas** | React Flow v12 (`@xyflow/react`) | High-performance graph canvas, node dragging, camera controls |
| **Graph Layout** | `@dagrejs/dagre` | Multi-graph topological DAG auto-arrangement |
| **Code Editor** | CodeMirror 6 (`@codemirror/*`) | Extensible web code editor with custom SDL language pack |
| **SQL & AST Parsing** | `node-sql-parser` + Custom Walkers | Multi-dialect SQL AST traversal and lineage extraction |
| **Grammar Engine** | Peggy 5.1 (PEG.js) | Custom ERD Forge Schema Definition Language grammar |
| **State Management** | Zustand 5 + Immer 11 | Granular, decoupled reactive state stores |
| **Local Persistence** | `wa-sqlite` (OPFS) + `idb` | Embedded local database storage with zero cloud dependency |
| **Styling** | Vanilla CSS Modules + Design Tokens | Clean styling with custom properties and WCAG-compliant themes |
| **Testing** | Vitest 2.0 | Unit, integration, and parser test runner |

---

## Repository Navigation & Structure

For an exhaustive, file-by-file directory tree and module responsibility guide, consult:
👉 **[`REPO_NAVIGATION.md`](./REPO_NAVIGATION.md)**

### High-Level Folder Layout

```
erd-forge/
├── apps/
│   └── web/                     # Main React + Vite web application
│       ├── public/              # Static assets, icons & fonts
│       ├── src/
│       │   ├── components/      # UI components (canvas, editor, lineage, layout, modals)
│       │   ├── core/            # Domain models, Command Pattern (undo/redo), autoLayout
│       │   ├── lineage/         # SQL Lineage parser, AST walker, symbol table, layout
│       │   ├── parsers/         # Peggy SDL grammar & SQL DDL importer
│       │   ├── storage/         # wa-sqlite OPFS, File System Access API adapters
│       │   ├── stores/          # Zustand state stores (project, sdl, canvas, lineage, ui)
│       │   ├── styles/          # Design tokens, CSS modules, dark/light themes
│       │   └── workers/         # Background web workers for off-thread parsing
│       └── tests/               # 15 Vitest test suites (63 passing tests)
├── docs/                        # Specifications, BRD, ARCHITECTURE, ADRs, UI/UX specs
├── packages/                    # Workspace packages reserved for shared modules
├── DEVLOG.md                    # Chronological record of architectural updates
├── REPO_NAVIGATION.md           # Complete repository file & folder hierarchy map
└── README.md                    # Project overview & documentation
```

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher)
- [pnpm](https://pnpm.io/) (v9 recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/fobiddenai/erd-forge.git
cd erd-forge

# Install monorepo dependencies
pnpm install
```

### Development Server

```bash
# Start Vite development server
pnpm dev
```
Open your browser at `http://localhost:5173` to start modeling schemas.

### Running Tests

All automated test suites are isolated under [`apps/web/tests/`](./apps/web/tests/):

```bash
# Run all 63 automated tests
pnpm test

# Run tests in interactive watch mode
pnpm --filter @erd-forge/web test:watch
```

### Type Checking & Build

```bash
# Verify TypeScript strict types across the project
pnpm typecheck

# Recompile the Peggy SDL grammar (if grammar.pegjs is edited)
pnpm --filter @erd-forge/web build:grammar

# Build production bundle
pnpm build
```

---

## SDL Syntax Reference

Here is a quick demonstration of ERD Forge's Schema Definition Language:

```sdl
Domain Commerce {
  color: "#6366f1"
  owner: "Payments Platform"
}

Table Customers [domain: Commerce] {
  id          uuid          [pk]
  email       varchar(255)  [unique, not null, pii: "email"]
  first_name  varchar(100)  [not null]
  last_name   varchar(100)  [not null]
  created_at  timestamp     [not null, default: `now()`]

  Note: "Primary user account records"
}

Table Orders [domain: Commerce] {
  id          uuid          [pk]
  customer_id uuid          [not null, ref: > Customers.id]
  total_cents int           [not null]
  status      varchar(50)   [not null]
  created_at  timestamp     [not null]
}

Table OrderItems [domain: Commerce] {
  id          uuid          [pk]
  order_id    uuid          [not null, ref: > Orders.id]
  product_id  uuid          [not null]
  quantity    int           [not null]
  unit_price  int           [not null]
}
```

Paste this into the SDL editor to generate clean, connected tables with immediate bezier relationships.

---

## Project Documentation

Detailed design specifications and architectural blueprints:

| Document | Description |
|----------|-------------|
| [`REPO_NAVIGATION.md`](./REPO_NAVIGATION.md) | Exhaustive directory tree, module responsibilities & navigation |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Technical architecture, storage design & performance strategy |
| [`docs/TECH_STACK_REQUIREMENTS.md`](./docs/TECH_STACK_REQUIREMENTS.md) | Comprehensive technology stack, system prerequisites & SLA specifications |
| [`docs/BRD.md`](./docs/BRD.md) | Business Requirements Document, personas & functional targets |
| [`docs/UI_UX_SPEC.md`](./docs/UI_UX_SPEC.md) | Design system, layout guidelines & interaction states |
| [`docs/SDL_REFERENCE.md`](./docs/SDL_REFERENCE.md) | Full syntax grammar reference for the SDL language |
| [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) | SQLite catalog schema and `.erdforge` JSON specifications |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Feature roadmap across release milestones |
| [`docs/ADRs/ADR-001-to-004.md`](./docs/ADRs/ADR-001-to-004.md) | Architecture Decision Records for core technology choices |
| [`DEVLOG.md`](./DEVLOG.md) | Chronological development changelog and decision history |

---

## Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for details on code style, testing requirements, and the pull request process.

---

## License

This project is licensed under the MIT License — see the [`LICENSE`](./LICENSE) file for details.

