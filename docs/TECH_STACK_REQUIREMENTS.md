# Technology Stack & System Requirements Specification — ERD Forge

> **Document ID:** DOC-TECH-001  
> **Version:** 1.0.0  
> **Date:** 2026-10-08  
> **Status:** Approved / Active Specification  
> **Target Audience:** Engineering, Architecture, DevOps, Security & Compliance Teams  

---

## Table of Contents
1. [Executive Summary & Core Principles](#1-executive-summary--core-principles)
2. [Client System & Hardware Requirements](#2-client-system--hardware-requirements)
3. [Browser & Web Platform Compatibility](#3-browser--web-platform-compatibility)
4. [Monorepo Tooling & Development Environment](#4-monorepo-tooling--development-environment)
5. [Frontend Framework & UI Presentation Layer](#5-frontend-framework--ui-presentation-layer)
6. [Diagram & Auto-Layout Engine](#6-diagram--auto-layout-engine)
7. [Code Editor & Language Tooling](#7-code-editor--language-tooling)
8. [SQL Parsing & Lineage Extraction Architecture](#8-sql-parsing--lineage-extraction-architecture)
9. [State Management & Command Pattern Engine](#9-state-management--command-pattern-engine)
10. [Local-First Storage & Persistence Layer](#10-local-first-storage--persistence-layer)
11. [Testing, QA & Build Verification Pipeline](#11-testing-qa--build-verification-pipeline)
12. [Performance Budgets & SLA Thresholds](#12-performance-budgets--sla-thresholds)
13. [Security, Privacy & Air-Gapped Compliance](#13-security-privacy--air-gapped-compliance)
14. [Open Source Licensing & Dependency Governance](#14-open-source-licensing--dependency-governance)

---

## 1. Executive Summary & Core Principles

ERD Forge is a **local-first, production-grade Entity Relationship Diagram (ERD) modeling and SQL Lineage platform**. It is architected around four non-negotiable technical tenets:

1. **Strict Zero-Cloud Architecture**: No remote server, no cloud storage, no telemetry, no tracking beacons, and no authentication endpoints. All schema definitions, database designs, and SQL queries remain strictly local on the client machine.
2. **Air-Gapped Operation**: Once assets are built and cached, the platform operates with 100% functionality in completely disconnected, network-isolated enterprise environments.
3. **High-Performance at Enterprise Scale**: Architected to support schemas exceeding 1,000 tables and 10,000 columns without frame drops during pan/zoom or UI latency during parsing.
4. **Open, Portable Standards**: Project state is serialized to human-readable, Git-friendly JSON files (`.erdforge`), supplemented by standard SQLite databases via the browser's Origin Private File System (OPFS).

---

## 2. Client System & Hardware Requirements

ERD Forge runs directly within modern web browser environments (and in desktop shells via Tauri in Phase 2). The minimum and recommended client specifications are:

| Resource | Minimum Requirement | Recommended Specification |
|---|---|---|
| **Operating System** | Windows 10/11 (64-bit), macOS 12+ (Monterey), Linux (Ubuntu 20.04+, Debian 11+, Fedora 36+) | Windows 11, macOS 14+ (Apple Silicon), modern Linux distro |
| **Processor (CPU)** | Dual-Core x86_64 or ARM64 (1.8 GHz+) | Quad-Core x86_64 or Apple Silicon (M1/M2/M3/M4) |
| **System Memory (RAM)** | 4 GB | 8 GB or 16 GB (for handling 1,000+ table schemas with 50+ CTEs) |
| **Local Disk Space** | 250 MB free disk space | 1 GB+ SSD storage (for local SQLite OPFS catalog storage) |
| **Display Resolution** | 1280 × 720 (minimum usable resolution) | 1920 × 1080 (FHD) or higher with multi-monitor support |
| **Network Connectivity** | Required only for initial npm package install / web page load | None required during operation (100% offline capable) |

---

## 3. Browser & Web Platform Compatibility

To support high-throughput local SQLite execution and native disk I/O, ERD Forge requires modern web platform APIs:

### 3.1 Browser Compatibility Matrix

| Browser | Minimum Version | Full OPFS Support | File System Access API | WebAssembly |
|---|---|---|---|---|
| **Google Chrome** | 110+ | ✅ Supported | ✅ Supported | ✅ Supported |
| **Microsoft Edge** | 110+ | ✅ Supported | ✅ Supported | ✅ Supported |
| **Brave / Chromium** | 110+ | ✅ Supported | ✅ Supported | ✅ Supported |
| **Mozilla Firefox** | 115+ (ESR) | ✅ Supported | ⚠️ Fallback to Input/Download | ✅ Supported |
| **Apple Safari** | 16.4+ | ✅ Supported | ⚠️ Fallback to Input/Download | ✅ Supported |

### 3.2 Required Web APIs

1. **Origin Private File System (OPFS)**:
   - Interface: `FileSystemDirectoryHandle`, `FileSystemSyncAccessHandle`.
   - Purpose: Direct block-level reads/writes for `wa-sqlite` database storage.
2. **File System Access API**:
   - Methods: `window.showOpenFilePicker()`, `window.showSaveFilePicker()`.
   - Purpose: Direct disk file loading and saving of native `.erdforge` project files.
   - Fallback: Standard `<input type="file">` upload and `URL.createObjectURL(blob)` download for non-Chromium browsers.
3. **WebAssembly (Wasm)**:
   - Purpose: Compiles and executes the SQLite C library in the browser sandbox.
4. **Web Workers API**:
   - Interfaces: `Worker`, `postMessage`, `Transferable` objects.
   - Purpose: Off-main-thread Peggy parsing and heavy SQL lineage AST traversal.
5. **Modern CSS Engine**:
   - Standards: CSS Custom Properties (Variables), CSS Grid level 2, Flexbox, CSS Modules, `:has()`, Container Queries.

---

## 4. Monorepo Tooling & Development Environment

The development workspace is structured as a high-performance monorepo using pnpm workspaces and Turborepo.

| Tool | Version | Role & Configuration |
|---|---|---|
| **Node.js** | `>= 18.0.0` (LTS v20 recommended) | Host JavaScript/TypeScript runtime |
| **pnpm** | `^9.0.0` | Strict, symlinked package manager with deterministic `pnpm-lock.yaml` |
| **Turborepo** | `^2.0.0` | High-speed build pipeline orchestrator (`turbo.json`) with task caching |
| **TypeScript** | `^5.5.0` | Strict type checking (`"strict": true`, `"noImplicitAny": true`, `"noEmit": true`) |
| **Vite** | `^5.0.0` | Instant HMR development server and Rollup-based production bundler |

---

## 5. Frontend Framework & UI Presentation Layer

| Dependency | Version | Architectural Responsibility |
|---|---|---|
| **React** | `^19.3.0` | Core UI library for declarative component rendering and hooks |
| **React DOM** | `^19.3.0` | DOM reconciliation and portal rendering for modals and context menus |
| **Lucide React** | `^1.44.0` | Vector icon suite providing consistent UI glyphs across toolbars and nodes |
| **Inter Variable Font** | `^5.3.0` | High-legibility sans-serif UI typography across interfaces |
| **JetBrains Mono** | `^5.3.0` | Monospaced typography for code editor, SQL views, and schema data types |
| **CSS Modules** | Native Vite | Scoped CSS styling avoiding global stylesheet conflicts |

---

## 6. Diagram & Auto-Layout Engine

Visualizing large relational models and complex SQL pipelines requires performant graph rendering:

| Component | Library / Version | Technical Specification |
|---|---|---|
| **Graph Canvas** | `@xyflow/react` (`^12.11.6`) | React Flow v12. Powers interactive panning, zooming, node selection, custom edge handles, and minimap rendering. |
| **Edge Routing** | Custom Smoothstep Bezier | Column-level connection routing with directional handles (Left/Right) and cardinality badges. |
| **Topological Auto-Layout** | `@dagrejs/dagre` (`^3.1.1`) | Directed multigraph layout algorithm. Calculates topological ranks (parents left, children right) with dynamic node height estimation. |
| **Raster / Vector Export** | `html-to-image` (`^1.11.13`) | Canvas rendering to PNG/SVG/PDF image outputs. |

---

## 7. Code Editor & Language Tooling

The code-first Schema Definition Language (SDL) interface requires a dedicated, rich IDE experience:

| Component | Library / Version | Technical Specification |
|---|---|---|
| **Editor Core** | CodeMirror 6 (`@codemirror/state`, `@codemirror/view`) | Modern, modular text editor with virtualized DOM line rendering. |
| **Syntax Highlighting** | `@codemirror/language`, `@lezer/highlight` | Custom syntax highlighting for ERD Forge SDL tokens (keywords, tables, domains, types). |
| **IntelliSense Autocomplete** | `@codemirror/autocomplete` | Context-aware keyword and entity name completions. |
| **Diagnostic Linter** | `@codemirror/lint` | Real-time syntax validation with in-editor squiggly underlines and error gutter markers. |
| **Parser Generator** | `peggy` (`^5.1.0`) | Compiles `grammar.pegjs` into an ES module parser (`grammar.js`) producing a structured AST. |

---

## 8. SQL Parsing & Lineage Extraction Architecture

The SQL Lineage Studio analyzes complex, multi-statement queries across diverse warehouse dialects:

| Feature | Library / Module | Technical Specification |
|---|---|---|
| **SQL Parser Base** | `node-sql-parser` (`^5.3.5`) | Generates ASTs from SQL queries across multiple dialects. |
| **AST Walker** | `src/lineage/parser/ASTWalker.ts` | Custom recursive clause walker traversing `SELECT`, `FROM`, `JOIN`, `WHERE`, `GROUP BY`, and `UNION`. |
| **Symbol Table** | `src/lineage/parser/SymbolTable.ts` | Resolves CTE scopes (`WITH ... AS`), subquery namespaces, table aliases, and source column derivations. |
| **Dialect Engine** | Validated in test suites | Dialect support for **BigQuery, Snowflake, Redshift, Databricks, PostgreSQL, and MySQL**. |
| **Lineage Graph Model** | `src/lineage/models/LineageGraph.ts` | Directed acyclic graph (DAG) assigning topological ranks from data sources (Rank 0) to transformation sinks. |
| **ERD Linking** | `src/lineage/graph/ERDLinker.ts` | Maps lineage nodes to existing ERD schema entities to provide unified architecture views. |

---

## 9. State Management & Command Pattern Engine

State architecture is bifurcated into **reactive UI state** and a **transactional Command stack** for undo/redo:

| Layer | Technology | Details |
|---|---|---|
| **Reactive Store** | `zustand` (`^5.0.15`) | Lightweight, hook-based state management divided into isolated slices (`projectStore`, `canvasStore`, `editorStore`, `lineageStore`, `uiStore`, `catalogStore`). |
| **Immutable Updates** | `immer` (`^11.1.18`) | Structural sharing ensuring deterministic state transitions and shallow equality rendering. |
| **Command Pattern** | `src/core/commands/CommandManager.ts` | Transactional mutations with explicit `execute()` and `undo()` implementations across tables, columns, relationships, domains, and sheets. |
| **Unique Identifiers** | `uuid` (`^14.0.2`) | Cryptographically secure RFC 4122 UUID v4 generation for all entities. |

---

## 10. Local-First Storage & Persistence Layer

| Engine | Library | Storage Location & Role |
|---|---|---|
| **Embedded SQL DB** | `wa-sqlite` (`^1.0.0`) | SQLite compiled to WebAssembly. Lives in the browser's OPFS. Serves as the high-speed data catalog, full-text search index, and metadata store. |
| **IndexedDB Fallback** | `idb` (`^8.0.3`) | Key-value browser storage fallback for browsers lacking OPFS synchronous handles. |
| **Native Project Files** | Browser FSA API | Saves and loads `.erdforge` project files directly to/from the host filesystem. |

---

## 11. Testing, QA & Build Verification Pipeline

The codebase enforces strict test-driven quality assurance with isolated test suites:

| Test Harness | Tool / Version | Scope & Metrics |
|---|---|---|
| **Unit & Integration** | `vitest` (`^2.0.0`) | 15 test suites, 63 automated tests located in [`apps/web/tests/`](../apps/web/tests). Fast parallel execution. |
| **DOM Environment** | `jsdom` (`^30.0.1`) | Headless browser environment simulating DOM events and custom canvas node renders. |
| **Testing Utilities** | `@testing-library/react` (`^16.3.3`) | Component rendering and user event verification. |
| **End-to-End Testing** | `@playwright/test` (`^1.63.0`) | Automated multi-browser regression testing across Chromium, Firefox, and WebKit. |
| **Static Typecheck** | `tsc --noEmit` | Strict compile-time validation with TypeScript project references. |

---

## 12. Performance Budgets & SLA Thresholds

ERD Forge enforces performance limits to ensure responsiveness even with enterprise schemas:

| Performance Metric | Threshold / SLA | Measured Under |
|---|---|---|
| **SDL Parsing (1,000 tables)** | `< 500 ms` | Background Web Worker |
| **Canvas Initial Render** | `< 3.0 s` | 1,000 tables + 2,000 foreign key edges |
| **Canvas Pan/Zoom Interaction** | `60 FPS` (`16.6 ms`/frame) | React Flow canvas with viewport culling |
| **Topological Auto-Layout** | `< 1.2 s` | 500-node schema using Dagre multigraph |
| **Catalog Search Latency** | `< 50 ms` | Searching across 10,000 columns |
| **SQL Lineage Parse (Complex CTE)** | `< 250 ms` | Multi-branch query with 10 CTEs & subqueries |
| **Peak Client Memory Usage** | `< 512 MB` | Full schema session with 1,000 tables |
| **Auto-Save Latency** | `< 150 ms` | SQLite OPFS transaction write |

---

## 13. Security, Privacy & Air-Gapped Compliance

1. **Zero External Network Calls**:
   - The application does not fetch remote fonts, CDN scripts, or analytics trackers at runtime. All fonts (`Inter`, `JetBrains Mono`) and assets are self-hosted in `public/`.
2. **Content Security Policy (CSP)**:
   - Configurable with `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'`.
3. **Data Loss Prevention**:
   - Debounced auto-save directly to local OPFS prevents data loss on browser refresh or accidental tab closure.
4. **Air-Gapped Ready**:
   - Compliant with Defense, Banking, and Healthcare air-gapped workstations where internet access is strictly prohibited.

---

## 14. Open Source Licensing & Dependency Governance

All libraries used across the ERD Forge dependency graph comply with permissive enterprise licensing requirements:

| Component | License | Permissive Status |
|---|---|---|
| **ERD Forge Core** | MIT License | Free & Open Source |
| **React & React DOM** | MIT | Permissive |
| **Vite & Rollup** | MIT | Permissive |
| **React Flow (`@xyflow/react`)** | MIT | Permissive |
| **CodeMirror 6** | MIT | Permissive |
| **Dagre** | MIT / BSD | Permissive |
| **Peggy** | MIT | Permissive |
| **node-sql-parser** | MIT | Permissive |
| **wa-sqlite** | Apache 2.0 | Permissive |
| **Zustand & Immer** | MIT | Permissive |
| **Lucide React** | ISC | Permissive |

> [!IMPORTANT]
> **Strict Governance Rule**: No libraries with viral copyleft licenses (e.g., GPL, AGPL, LGPL) are permitted in production dependencies to ensure unrestricted private, commercial, and enterprise adoption.
