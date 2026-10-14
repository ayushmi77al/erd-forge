# System Architecture — ERD Forge
# Local-First ERD Modeling & Data Catalog Platform

**Version:** 1.0.0  
**Date:** 2026-09-10  
**Status:** Draft

---

## 1. Architecture Philosophy

ERD Forge is built on four non-negotiable architectural principles:

1. **Local-First**: All data lives on the user's filesystem. No network calls, no telemetry, no auth services.
2. **Engine Abstraction**: The diagram rendering engine is abstracted behind an interface so it can be swapped without changing business logic.
3. **Event Sourcing for Undo**: All state mutations are commands that can be applied/reversed, enabling unlimited undo/redo.
4. **Layered Architecture**: Clear separation between domain model, application services, storage, and presentation.

---

## 2. Technology Stack Decision

### 2.1 Evaluation Matrix

| Dimension | React + Vite | Next.js | Vue 3 | Winner |
|-----------|-------------|---------|-------|--------|
| Local-first suitability | ✅ Excellent | ⚠️ SSR overhead | ✅ Good | React + Vite |
| Large-schema performance | ✅ | ✅ | ✅ | Tie |
| Ecosystem maturity | ✅ | ✅ | ⚠️ | React |
| TypeScript support | ✅ | ✅ | ✅ | Tie |

**Decision: React 18 + Vite 5 + TypeScript**

### 2.2 Diagram Engine Evaluation

| Engine | Nodes@1000 | Custom Styling | Edge Routing | Bundle Size | Winner |
|--------|-----------|----------------|--------------|-------------|--------|
| React Flow | ✅ Good | ✅ Excellent | ✅ Good | 🟡 Medium | ✅ |
| Cytoscape.js | ✅ Excellent | ⚠️ Complex | ✅ Excellent | ✅ Small | Backup |
| JointJS | ✅ Good | ✅ | ✅ | ❌ Large | ❌ |
| D3.js | ✅ | ❌ Manual | ❌ Manual | ✅ | ❌ Too low-level |

**Decision: React Flow v12 (primary), Cytoscape.js (fallback/large schema mode)**

### 2.3 Storage Evaluation

| Storage | Capacity | Queryable | Human-readable | Portability | Winner |
|---------|----------|-----------|----------------|-------------|--------|
| IndexedDB | ✅ Excellent | ⚠️ Limited | ❌ | ⚠️ | Backup |
| SQLite (via OPFS) | ✅ Excellent | ✅ Full SQL | ❌ | ✅ | Primary DB |
| Local JSON files | ✅ | ❌ | ✅ | ✅ Excellent | Project format |
| localStorage | ❌ 5-10MB | ❌ | ❌ | ❌ | ❌ |

**Decision: SQLite via OPFS (wa-sqlite) for catalog DB + JSON project files for portability**

### 2.4 Desktop Packaging Evaluation

| Option | Install Required | Admin Needed | Native APIs | Complexity |
|--------|-----------------|--------------|-------------|------------|
| Browser-only | ❌ | ❌ | ❌ | ✅ Lowest |
| Electron | ✅ | ❌ | ✅ Full | ⚠️ Medium |
| Tauri v2 | ✅ | ❌ | ✅ Full | ⚠️ Medium |
| PWA | ❌ | ❌ | ⚠️ Partial | ✅ Low |

**Decision: Phase 1 = Progressive Web App (PWA) with OPFS + File System Access API. Phase 2 = Tauri v2 wrapper.**

### 2.5 Final Recommended Stack

```
┌─────────────────────────────────────────────────────────┐
│                    ERD FORGE STACK                      │
├─────────────────────────────────────────────────────────┤
│  Language        TypeScript 5.x                         │
│  Framework       React 18 + Vite 5                      │
│  State           Zustand 4 + Immer (for undo/redo)      │
│  Diagram         React Flow v12 (xyflow)                │
│  Code Editor     CodeMirror 6 (SDL + SQL)               │
│  Storage         wa-sqlite (OPFS) + JSON project files  │
│  Styling         CSS Modules + CSS Custom Properties    │
│  Icons           Lucide React                           │
│  Rich Text       TipTap (Markdown notes)               │
│  PDF Export      @react-pdf/renderer                   │
│  SQL Parser      node-sql-parser                       │
│  SDL Parser      Custom PEG.js grammar                 │
│  Testing         Vitest + Playwright                    │
│  Build           Vite 5 + PWA plugin                   │
│  Packaging       Tauri v2 (Phase 2)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ERD FORGE APPLICATION                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    PRESENTATION LAYER                        │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │   │
│  │  │  SDL     │  │  Canvas  │  │ Catalog  │  │  Docs /   │  │   │
│  │  │  Editor  │  │  Viewer  │  │ Explorer │  │  Notes    │  │   │
│  │  │(CodeMir6)│  │(React    │  │  Panel   │  │  Panel    │  │   │
│  │  │          │  │  Flow)   │  │          │  │  (TipTap) │  │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │   │
│  │       │              │              │               │         │   │
│  │  ┌────▼──────────────▼──────────────▼───────────────▼─────┐ │   │
│  │  │                 UI STATE (Zustand Stores)               │ │   │
│  │  │  projectStore | editorStore | canvasStore | uiStore    │ │   │
│  │  │  catalogStore | historyStore                           │ │   │
│  │  └────────────────────────┬────────────────────────────────┘ │   │
│  └───────────────────────────┼──────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐   │
│  │                   APPLICATION LAYER                          │   │
│  │                                                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │  Schema    │  │  Diagram   │  │  Catalog   │             │   │
│  │  │  Service   │  │  Service   │  │  Service   │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │  Import /  │  │  Export    │  │  Command   │             │   │
│  │  │  Parser    │  │  Service   │  │  Manager   │             │   │
│  │  │  Service   │  │            │  │ (Undo/Redo)│             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐   │
│  │                    DOMAIN / CORE LAYER                       │   │
│  │                                                              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐   │   │
│  │  │ Table   │  │ Column  │  │Relation-│  │  Domain     │   │   │
│  │  │ Model   │  │ Model   │  │  ship   │  │  Model      │   │   │
│  │  └─────────┘  └─────────┘  │  Model  │  └─────────────┘   │   │
│  │  ┌─────────┐  ┌─────────┐  └─────────┘  ┌─────────────┐   │   │
│  │  │ Sheet   │  │ Project │               │  Glossary   │   │   │
│  │  │ Model   │  │ Model   │               │  Term Model │   │   │
│  │  └─────────┘  └─────────┘               └─────────────┘   │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│  ┌───────────────────────────▼──────────────────────────────────┐   │
│  │                   STORAGE / PERSISTENCE LAYER                │   │
│  │                                                              │   │
│  │  ┌───────────────────┐        ┌───────────────────────────┐  │   │
│  │  │  SQLite (OPFS)    │        │  File System Access API   │  │   │
│  │  │  (Catalog DB)     │        │  (Project .erdforge files)│  │   │
│  │  │                   │        │                           │  │   │
│  │  │ - tables          │        │ - project.erdforge (JSON) │  │   │
│  │  │ - columns         │        │ - project-backup.erdforge │  │   │
│  │  │ - relationships   │        │ - snapshots/             │  │   │
│  │  │ - domains         │        │                           │  │   │
│  │  │ - tags            │        └───────────────────────────┘  │   │
│  │  │ - comments        │                                       │   │
│  │  │ - glossary terms  │                                       │   │
│  │  └───────────────────┘                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Module Architecture

### 4.1 Core Modules

```
src/
├── core/                          # Domain models (pure TypeScript, no React)
│   ├── models/
│   │   ├── Table.ts
│   │   ├── Column.ts
│   │   ├── Relationship.ts
│   │   ├── Domain.ts
│   │   ├── Sheet.ts
│   │   ├── Project.ts
│   │   ├── Tag.ts
│   │   ├── GlossaryTerm.ts
│   │   └── Comment.ts
│   ├── commands/                  # Command pattern for undo/redo
│   │   ├── CommandManager.ts
│   │   ├── AddTableCommand.ts
│   │   ├── RemoveTableCommand.ts
│   │   ├── EditColumnCommand.ts
│   │   └── ...
│   └── validators/                # Schema validation rules
│       ├── SchemaValidator.ts
│       └── rules/
│
├── services/                      # Application services
│   ├── SchemaService.ts           # Table/column CRUD
│   ├── DiagramService.ts          # Layout, positioning
│   ├── CatalogService.ts          # Metadata queries
│   ├── SearchService.ts           # Full-text search
│   ├── ImpactAnalysisService.ts   # Graph traversal
│   ├── ExportService.ts           # All export formats
│   ├── ImportService.ts           # All import formats
│   ├── AutoSaveService.ts         # Debounced persistence
│   └── SnapshotService.ts         # Version snapshots
│
├── parsers/                       # SDL and SQL parsers
│   ├── sdl/
│   │   ├── grammar.pegjs          # PEG.js grammar definition
│   │   ├── SDLParser.ts           # Parser wrapper
│   │   ├── SDLFormatter.ts        # Code formatter
│   │   └── SDLValidator.ts        # Semantic validator
│   └── sql/
│       ├── DDLParser.ts           # SQL DDL parser (node-sql-parser)
│       └── DDLGenerator.ts        # Schema -> SQL export
│
├── storage/                       # Persistence adapters
│   ├── StorageAdapter.ts          # Interface
│   ├── OPFSSQLiteAdapter.ts       # wa-sqlite implementation
│   ├── FileSystemAdapter.ts       # File System Access API
│   └── IndexedDBAdapter.ts        # Fallback
│
├── stores/                        # Zustand state stores
│   ├── projectStore.ts            # Current project state
│   ├── editorStore.ts             # SDL editor state
│   ├── canvasStore.ts             # Diagram canvas state
│   ├── catalogStore.ts            # Catalog/explorer state
│   ├── uiStore.ts                 # UI panels, modals, etc.
│   └── historyStore.ts            # Undo/redo history state
│
├── components/                    # React UI components
│   ├── layout/                    # App shell
│   ├── canvas/                    # Diagram canvas
│   ├── editor/                    # SDL code editor
│   ├── catalog/                   # Catalog explorer
│   ├── panels/                    # Side panels
│   ├── modals/                    # Dialogs
│   ├── toolbar/                   # Toolbars
│   └── shared/                    # Shared UI components
│
├── hooks/                         # Custom React hooks
├── utils/                         # Pure utility functions
└── types/                         # TypeScript type definitions
```

---

## 5. SDL Parser Architecture

The Schema Definition Language (SDL) is parsed using a PEG.js grammar, producing a typed AST.

### 5.1 SDL Grammar (Conceptual)

```pegjs
// ERD Forge SDL Grammar (simplified)

Program       = _ (Statement _)* EOF
Statement     = TableDef / ViewDef / RelationshipDef / DomainDef

TableDef      = "Table" _ Identifier _ "{" _ ColumnDef* _ "}" TableMeta?
ViewDef       = "View" _ Identifier _ "{" _ ColumnDef* _ "}"
ColumnDef     = Identifier _ DataType _ ColumnOptions? Comment? Newline
ColumnOptions = "[" _ Option ("," _ Option)* _ "]"
Option        = PkOption / FkOption / UniqueOption / NotNullOption / DefaultOption

PkOption      = "pk"
FkOption      = "ref:" _ RefDirection _ QualifiedCol
RefDirection  = ">" / "<" / "-" / "<>"
QualifiedCol  = Identifier "." Identifier
UniqueOption  = "unique"
NotNullOption = "not null"
DefaultOption = "default:" _ Value

TableMeta     = "[" _ MetaPair ("," _ MetaPair)* _ "]"
MetaPair      = "note:" Value / "domain:" Value / "owner:" Value
```

### 5.2 AST Node Types

```typescript
interface ProgramNode {
  type: 'program';
  statements: StatementNode[];
}

interface TableNode {
  type: 'table';
  name: string;
  columns: ColumnNode[];
  meta?: TableMetaNode;
  position?: { line: number; col: number };
}

interface ColumnNode {
  type: 'column';
  name: string;
  dataType: DataTypeNode;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isNullable: boolean;
  defaultValue?: ValueNode;
  references?: ReferenceNode;
  comment?: string;
}

interface ReferenceNode {
  type: 'reference';
  direction: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
  targetTable: string;
  targetColumn: string;
}
```

---

## 6. Storage Architecture

### 6.1 Project File Format (.erdforge)

The project file is a JSON document that acts as the source of truth for all schema and layout data.

```json
{
  "version": "1.0.0",
  "id": "uuid-v4",
  "name": "My Data Warehouse",
  "createdAt": "2026-09-10T00:00:00Z",
  "updatedAt": "2026-09-10T00:00:00Z",
  "schema": {
    "tables": [...],
    "views": [...],
    "relationships": [...]
  },
  "domains": [...],
  "sheets": [...],
  "glossary": [...],
  "tags": [...],
  "settings": {...}
}
```

### 6.2 SQLite Catalog Schema

The embedded SQLite database provides fast queryable access to catalog metadata.

```sql
-- Core entity tables
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('table', 'view')),
  name TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  source_system TEXT,
  refresh_logic TEXT,
  review_status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE columns (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  ordinal_position INTEGER NOT NULL,
  is_primary_key BOOLEAN DEFAULT FALSE,
  is_nullable BOOLEAN DEFAULT TRUE,
  is_unique BOOLEAN DEFAULT FALSE,
  description TEXT,
  examples TEXT,  -- JSON array
  calculation_logic TEXT,
  pii_classification TEXT CHECK(pii_classification IN ('none', 'pii', 'sensitive', 'highly-sensitive')),
  data_quality_rules TEXT,  -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_entity_id TEXT NOT NULL REFERENCES entities(id),
  source_column_id TEXT NOT NULL REFERENCES columns(id),
  target_entity_id TEXT NOT NULL REFERENCES entities(id),
  target_column_id TEXT NOT NULL REFERENCES columns(id),
  cardinality TEXT NOT NULL,  -- 'one_to_one', 'one_to_many', 'many_to_many'
  description TEXT,
  join_logic TEXT
);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT,
  owner TEXT,
  contact TEXT
);

CREATE TABLE entity_domains (
  entity_id TEXT REFERENCES entities(id),
  domain_id TEXT REFERENCES domains(id),
  PRIMARY KEY (entity_id, domain_id)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT
);

CREATE TABLE entity_tags (
  entity_id TEXT REFERENCES entities(id),
  tag_id TEXT REFERENCES tags(id),
  PRIMARY KEY (entity_id, tag_id)
);

CREATE TABLE column_tags (
  column_id TEXT REFERENCES columns(id),
  tag_id TEXT REFERENCES tags(id),
  PRIMARY KEY (column_id, tag_id)
);

CREATE TABLE sheets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ordinal_position INTEGER NOT NULL
);

CREATE TABLE sheet_entities (
  sheet_id TEXT REFERENCES sheets(id),
  entity_id TEXT REFERENCES entities(id),
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (sheet_id, entity_id)
);

CREATE TABLE glossary_terms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  domain_id TEXT REFERENCES domains(id),
  owner TEXT
);

CREATE TABLE term_column_links (
  term_id TEXT REFERENCES glossary_terms(id),
  column_id TEXT REFERENCES columns(id),
  PRIMARY KEY (term_id, column_id)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  target_type TEXT NOT NULL,  -- 'entity', 'column', 'sheet'
  target_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  parent_id TEXT REFERENCES comments(id)
);

-- Full-text search virtual tables
CREATE VIRTUAL TABLE entities_fts USING fts5(
  name, description, owner, source_system,
  content='entities', content_rowid='rowid'
);

CREATE VIRTUAL TABLE columns_fts USING fts5(
  name, description, data_type, calculation_logic,
  content='columns', content_rowid='rowid'
);
```

---

## 7. Command Pattern (Undo/Redo)

Every state-mutating action in ERD Forge is a Command object.

```typescript
interface Command {
  id: string;
  timestamp: number;
  description: string;           // Human-readable: "Add table Customer"
  execute(state: ProjectState): ProjectState;
  undo(state: ProjectState): ProjectState;
}

class CommandManager {
  private history: Command[] = [];
  private cursor: number = -1;
  private maxHistory: number = 1000;

  execute(command: Command): void {
    // Truncate redo history
    this.history = this.history.slice(0, this.cursor + 1);
    this.history.push(command);
    this.cursor++;
    // Apply to state
  }

  undo(): void {
    if (this.cursor < 0) return;
    this.cursor--;
  }

  redo(): void {
    if (this.cursor >= this.history.length - 1) return;
    this.cursor++;
  }
}
```

---

## 8. Performance Strategy

### 8.1 Virtual Canvas Rendering

For large schemas (500+ tables), the canvas employs:
- **Viewport culling**: Only render nodes visible in the current viewport + buffer zone
- **Level-of-detail (LOD)**: At zoom < 50%, render tables as compact cards (name only)
- **Edge bundling**: Group parallel edges to reduce visual clutter and DOM nodes

### 8.2 Web Worker Architecture

Heavy computations run in Web Workers off the main thread:
- SDL parsing
- SQL DDL parsing
- Auto-layout algorithms (ELK.js via worker)
- Full-text search indexing
- Export generation

### 8.3 Incremental React Updates

- React `memo` on all canvas nodes
- Zustand slices to prevent global re-renders
- `startTransition` for non-urgent canvas updates

### 8.4 IndexedDB / OPFS Read Caching

- Cache frequently accessed catalog queries in memory
- Invalidate on mutation
- LRU cache with 100MB soft limit

---

## 9. Import/Export Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   IMPORT PIPELINE                       │
│                                                         │
│  Raw Input                                              │
│  (SQL/DBML/CSV/JSON/Excel)                              │
│       │                                                 │
│       ▼                                                 │
│  Format Detector                                        │
│       │                                                 │
│       ▼                                                 │
│  Parser (format-specific)                               │
│       │                                                 │
│       ▼                                                 │
│  Intermediate Representation (IR)                       │
│  { tables, columns, relationships }                     │
│       │                                                 │
│       ▼                                                 │
│  IR Validator (conflict detection, deduplication)       │
│       │                                                 │
│       ▼                                                 │
│  Merge Strategy (replace / merge / append)              │
│       │                                                 │
│       ▼                                                 │
│  Project State Update                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   EXPORT PIPELINE                       │
│                                                         │
│  Project State + Selected Scope                         │
│  (all / sheet / domain)                                 │
│       │                                                 │
│       ▼                                                 │
│  Export Serializer                                      │
│       │                                                 │
│  ┌────┴──────────────────────────────────────────┐      │
│  │                                               │      │
│  ▼           ▼          ▼          ▼             ▼      │
│ SQL DDL    PNG/SVG    HTML       Markdown      JSON     │
│ Generator  Renderer   Doc Gen    Doc Gen     Serializer │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 10. Future Architecture (Phase 2)

### 10.1 Tauri v2 Desktop App

```
┌──────────────────────────────┐
│  React Frontend (WebView)    │
│  (same codebase, no changes) │
└────────────┬─────────────────┘
             │ Tauri IPC Commands
┌────────────▼─────────────────┐
│  Tauri Backend (Rust)        │
│  - File system operations    │
│  - SQLite via rusqlite       │
│  - Auto-updater              │
│  - System tray               │
│  - Native menus              │
└──────────────────────────────┘
```

### 10.2 Git Integration (Phase 3)

- Store project files in a Git repository
- Auto-commit on save with meaningful messages
- Diff viewer for schema changes between commits
- Branch support for schema experiments

### 10.3 AI-Assisted Schema Design (Phase 4)

- Local LLM (Ollama) integration
- Natural language to SDL generation
- Schema optimization suggestions
- Documentation generation from column names
