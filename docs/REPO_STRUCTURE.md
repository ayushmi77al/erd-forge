# Repository Structure — ERD Forge

**Version:** 1.0.0  
**Date:** 2026-09-10

> **Note:** For the live, updated repository hierarchy and file tree of the implemented codebase, see [REPO_NAVIGATION.md](../REPO_NAVIGATION.md).

---

## Project Root

```
erd-forge/
│
├── apps/
│   ├── web/                          # React + Vite PWA (primary)
│   │   ├── public/
│   │   │   ├── icons/                # App icons (PWA)
│   │   │   ├── manifest.webmanifest  # PWA manifest
│   │   │   └── sw.js                 # Service Worker
│   │   ├── src/
│   │   │   ├── core/                 # Domain models (pure TS)
│   │   │   │   ├── models/
│   │   │   │   │   ├── Table.ts
│   │   │   │   │   ├── Column.ts
│   │   │   │   │   ├── Relationship.ts
│   │   │   │   │   ├── Domain.ts
│   │   │   │   │   ├── Sheet.ts
│   │   │   │   │   ├── Project.ts
│   │   │   │   │   ├── Tag.ts
│   │   │   │   │   ├── GlossaryTerm.ts
│   │   │   │   │   └── Comment.ts
│   │   │   │   ├── commands/
│   │   │   │   │   ├── CommandManager.ts
│   │   │   │   │   ├── table/
│   │   │   │   │   │   ├── AddTableCommand.ts
│   │   │   │   │   │   ├── RemoveTableCommand.ts
│   │   │   │   │   │   ├── RenameTableCommand.ts
│   │   │   │   │   │   └── UpdateTableMetaCommand.ts
│   │   │   │   │   ├── column/
│   │   │   │   │   │   ├── AddColumnCommand.ts
│   │   │   │   │   │   ├── RemoveColumnCommand.ts
│   │   │   │   │   │   ├── EditColumnCommand.ts
│   │   │   │   │   │   └── ReorderColumnsCommand.ts
│   │   │   │   │   ├── relationship/
│   │   │   │   │   │   ├── AddRelationshipCommand.ts
│   │   │   │   │   │   └── RemoveRelationshipCommand.ts
│   │   │   │   │   ├── domain/
│   │   │   │   │   │   ├── AddDomainCommand.ts
│   │   │   │   │   │   └── AssignDomainCommand.ts
│   │   │   │   │   └── sheet/
│   │   │   │   │       ├── AddSheetCommand.ts
│   │   │   │   │       ├── AddEntityToSheetCommand.ts
│   │   │   │   │       └── UpdateLayoutCommand.ts
│   │   │   │   └── validators/
│   │   │   │       ├── SchemaValidator.ts
│   │   │   │       ├── NamingConventionValidator.ts
│   │   │   │       └── CircularReferenceDetector.ts
│   │   │   │
│   │   │   ├── parsers/
│   │   │   │   ├── sdl/
│   │   │   │   │   ├── grammar.pegjs          # PEG.js grammar source
│   │   │   │   │   ├── grammar.js             # Generated parser (build artifact)
│   │   │   │   │   ├── SDLParser.ts           # Parser wrapper
│   │   │   │   │   ├── SDLFormatter.ts        # Code formatter
│   │   │   │   │   ├── SDLValidator.ts        # Semantic validation
│   │   │   │   │   └── SDLSerializer.ts       # AST -> SDL string
│   │   │   │   └── sql/
│   │   │   │       ├── DDLParser.ts           # SQL -> IR (node-sql-parser)
│   │   │   │       ├── DDLGenerator.ts        # IR -> SQL per dialect
│   │   │   │       └── dialects/
│   │   │   │           ├── postgresql.ts
│   │   │   │           ├── mysql.ts
│   │   │   │           ├── mssql.ts
│   │   │   │           └── oracle.ts
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── SchemaService.ts           # Table/column/relationship CRUD
│   │   │   │   ├── DiagramService.ts          # Layout management
│   │   │   │   ├── CatalogService.ts          # Catalog queries
│   │   │   │   ├── SearchService.ts           # FTS + filter queries
│   │   │   │   ├── ImpactAnalysisService.ts   # BFS/DFS graph traversal
│   │   │   │   ├── ExportService.ts           # Export orchestrator
│   │   │   │   ├── ImportService.ts           # Import orchestrator
│   │   │   │   ├── AutoSaveService.ts         # Debounced auto-save
│   │   │   │   ├── SnapshotService.ts         # Version snapshots
│   │   │   │   ├── exporters/
│   │   │   │   │   ├── SQLExporter.ts
│   │   │   │   │   ├── HTMLExporter.ts
│   │   │   │   │   ├── MarkdownExporter.ts
│   │   │   │   │   ├── JSONExporter.ts
│   │   │   │   │   ├── ExcelExporter.ts       # xlsx library
│   │   │   │   │   └── ImageExporter.ts       # Canvas -> PNG/SVG
│   │   │   │   └── importers/
│   │   │   │       ├── SQLImporter.ts
│   │   │   │       ├── DBMLImporter.ts
│   │   │   │       ├── JSONImporter.ts
│   │   │   │       ├── ExcelImporter.ts
│   │   │   │       └── CSVImporter.ts
│   │   │   │
│   │   │   ├── storage/
│   │   │   │   ├── StorageAdapter.ts          # Adapter interface
│   │   │   │   ├── OPFSSQLiteAdapter.ts       # wa-sqlite (primary)
│   │   │   │   ├── FileSystemAdapter.ts       # File System Access API
│   │   │   │   ├── IndexedDBAdapter.ts        # Fallback
│   │   │   │   └── migrations/
│   │   │   │       ├── MigrationRunner.ts
│   │   │   │       ├── 001_initial_schema.sql
│   │   │   │       └── 002_add_glossary.sql
│   │   │   │
│   │   │   ├── stores/
│   │   │   │   ├── projectStore.ts            # Zustand: project data
│   │   │   │   ├── editorStore.ts             # SDL editor state
│   │   │   │   ├── canvasStore.ts             # Diagram canvas state
│   │   │   │   ├── catalogStore.ts            # Catalog UI state
│   │   │   │   ├── uiStore.ts                 # Modal, panel, theme state
│   │   │   │   └── historyStore.ts            # Undo/redo history
│   │   │   │
│   │   │   ├── workers/
│   │   │   │   ├── parser.worker.ts           # SDL/SQL parsing off-thread
│   │   │   │   ├── layout.worker.ts           # ELK.js auto-layout
│   │   │   │   ├── search.worker.ts           # FTS indexing
│   │   │   │   └── export.worker.ts           # Export generation
│   │   │   │
│   │   │   ├── components/                    # (see UI_UX_SPEC.md)
│   │   │   │   ├── layout/
│   │   │   │   ├── canvas/
│   │   │   │   ├── editor/
│   │   │   │   ├── inspector/
│   │   │   │   ├── catalog/
│   │   │   │   ├── domains/
│   │   │   │   ├── sheets/
│   │   │   │   ├── glossary/
│   │   │   │   ├── impact/
│   │   │   │   ├── toolbar/
│   │   │   │   ├── modals/
│   │   │   │   └── shared/
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useCommandManager.ts
│   │   │   │   ├── useCanvasLayout.ts
│   │   │   │   ├── useSearch.ts
│   │   │   │   ├── useAutoSave.ts
│   │   │   │   ├── useKeyboardShortcuts.ts
│   │   │   │   └── useImpactAnalysis.ts
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── uuid.ts
│   │   │   │   ├── color.ts
│   │   │   │   ├── dates.ts
│   │   │   │   ├── debounce.ts
│   │   │   │   ├── dataTypes.ts               # Data type registry
│   │   │   │   └── graphUtils.ts              # BFS/DFS utilities
│   │   │   │
│   │   │   ├── styles/
│   │   │   │   ├── global.css
│   │   │   │   ├── tokens.css                 # CSS custom properties
│   │   │   │   ├── reset.css
│   │   │   │   └── themes/
│   │   │   │       ├── dark.css
│   │   │   │       └── light.css
│   │   │   │
│   │   │   ├── types/
│   │   │   │   ├── project.d.ts
│   │   │   │   ├── canvas.d.ts
│   │   │   │   ├── catalog.d.ts
│   │   │   │   └── sdl.d.ts
│   │   │   │
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   │
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── desktop/                      # Tauri v2 wrapper (Phase 2)
│       ├── src-tauri/
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   ├── commands/         # Tauri IPC commands
│       │   │   │   ├── file_system.rs
│       │   │   │   └── sqlite.rs
│       │   │   └── menu.rs           # Native menu
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       └── package.json
│
├── packages/
│   ├── sdl-parser/                   # Standalone NPM package
│   │   ├── src/
│   │   │   ├── grammar.pegjs
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── schema-types/                 # Shared TypeScript types
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── docs/
│   ├── BRD.md                        # Business Requirements Document
│   ├── ARCHITECTURE.md               # System architecture
│   ├── DATABASE_SCHEMA.md            # DB schema design
│   ├── UI_UX_SPEC.md                 # UI wireframes and design system
│   ├── REPO_STRUCTURE.md             # This file
│   ├── SDL_REFERENCE.md              # SDL language reference
│   ├── ROADMAP.md                    # Feature roadmap P0-P3
│   ├── ADRs/                         # Architecture Decision Records
│   │   └── ADR-001-to-004.md         # ADR-001 through ADR-004 (single file)
│   └── CONTRIBUTING.md
│
├── .agents/                          # AI agent customizations
│   ├── skills/
│   │   └── erd-forge-builder/
│   │       └── SKILL.md              # AI skill for building this tool
│   └── rules/
│       └── coding-standards.md       # Project coding rules
│
├── examples/
│   ├── ecommerce-schema.erdforge
│   ├── data-warehouse.erdforge
│   └── hr-schema.erdforge
│
├── tests/
│   ├── unit/
│   │   ├── parsers/
│   │   ├── services/
│   │   └── commands/
│   ├── integration/
│   │   ├── import-export/
│   │   └── storage/
│   └── e2e/
│       ├── canvas.spec.ts
│       ├── editor.spec.ts
│       └── catalog.spec.ts
│
├── scripts/
│   ├── build-grammar.js              # PEG.js grammar build script
│   ├── generate-examples.js          # Generate example project files
│   └── bump-version.js              # Version bump utility
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Run tests on PR
│       ├── release.yml               # Build + release desktop app
│       └── lint.yml                  # Code quality
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # pnpm workspace
├── package.json                      # Root package.json
└── README.md
```

---

## Key Module Descriptions

| Module | Responsibility |
|--------|---------------|
| `core/models/` | Pure TypeScript data model interfaces. No React, no side effects. |
| `core/commands/` | Command pattern implementation for undo/redo |
| `parsers/sdl/` | ERD Forge DSL parser using PEG.js grammar |
| `parsers/sql/` | SQL DDL import/export using node-sql-parser |
| `services/` | Application logic layer; thin bridge between core and storage |
| `storage/` | Abstract file system + SQLite persistence adapters |
| `stores/` | Zustand reactive state slices for UI |
| `workers/` | Web Workers for CPU-intensive tasks off the main thread |
| `components/` | React UI components, purely presentational |
| `hooks/` | React hooks that connect stores to components |
| `packages/sdl-parser/` | Publishable NPM package for the SDL language |
