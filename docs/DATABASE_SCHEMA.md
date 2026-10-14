# Database Schema Design — ERD Forge
# Internal SQLite Catalog & Project File Schema

**Version:** 1.0.0  
**Date:** 2026-09-10

---

## 1. Overview

ERD Forge uses a dual-storage approach:

| Storage | Format | Purpose |
|---------|--------|---------|
| **Project File** | `.erdforge` (JSON) | Portable project data, schema definitions, layouts |
| **Catalog DB** | SQLite (OPFS) | Fast queryable catalog, full-text search, metadata |

The two are kept in sync: the project file is the source of truth, the SQLite DB is a read-optimized projection.

---

## 2. Project File Schema (JSON)

### 2.1 Root Structure

```typescript
interface ERDForgeProject {
  version: string;                    // "1.0.0"
  id: string;                         // UUID v4
  name: string;
  description?: string;
  createdAt: string;                  // ISO 8601
  updatedAt: string;
  
  schema: SchemaDefinition;
  domains: Domain[];
  sheets: Sheet[];
  tags: Tag[];
  glossary: GlossaryTerm[];
  comments: Comment[];
  settings: ProjectSettings;
}
```

### 2.2 Schema Definition

```typescript
interface SchemaDefinition {
  tables: Table[];
  views: View[];
  relationships: Relationship[];
}

interface Table {
  id: string;
  name: string;
  schema?: string;                    // Database schema (e.g., "dbo", "public")
  columns: Column[];
  
  // Metadata
  description?: string;
  businessPurpose?: string;
  owner?: string;
  sourceSystem?: string;
  refreshLogic?: string;
  reviewStatus: 'draft' | 'review' | 'approved' | 'deprecated';
  
  // Governance
  domainIds: string[];
  tagIds: string[];
  
  // SDL source position (for editor sync)
  sdlLine?: number;
}

interface View {
  id: string;
  name: string;
  schema?: string;
  columns: Column[];
  underlyingTables: string[];         // Table IDs
  sqlDefinition?: string;
  
  // Metadata (same as Table)
  description?: string;
  owner?: string;
  reviewStatus: 'draft' | 'review' | 'approved' | 'deprecated';
  domainIds: string[];
  tagIds: string[];
}

interface Column {
  id: string;
  name: string;
  dataType: DataType;
  ordinalPosition: number;
  
  // Constraints
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
  checkConstraint?: string;
  
  // Metadata
  description?: string;
  businessDefinition?: string;
  examples?: string[];
  calculationLogic?: string;
  dataQualityRules?: string[];
  piiClassification: 'none' | 'pii' | 'sensitive' | 'highly_sensitive';
  
  tagIds: string[];
  glossaryTermIds: string[];
}

/**
 * PII Classification Mapping
 * 
 * The SDL language supports granular PII types (email, ssn, phone, etc.)
 * The storage layer normalizes these to 4 classification LEVELS:
 *
 * | SDL `pii:` value           | Storage `pii_classification` |
 * |----------------------------|------------------------------|
 * | `"none"` (or omitted)      | `none`                       |
 * | `"email"`, `"name"`,       | `pii`                        |
 * | `"phone"`, `"address"`     |                              |
 * | `"dob"`, `"financial"`     | `sensitive`                  |
 * | `"ssn"`, `"health"`,       | `highly_sensitive`           |
 * | `"biometric"`              |                              |
 *
 * The original SDL `pii:` value string is preserved in a separate
 * `pii_type` field for display purposes. The `pii_classification`
 * field is used for filtering and governance queries.
 */

interface DataType {
  name: string;                       // varchar, int, decimal, etc.
  length?: number;                    // varchar(255) -> 255
  precision?: number;                 // decimal(18,2) -> 18
  scale?: number;                     // decimal(18,2) -> 2
  isArray?: boolean;
}

interface Relationship {
  id: string;
  sourceEntityId: string;
  sourceColumnId: string;
  targetEntityId: string;
  targetColumnId: string;
  cardinality: 'one_to_one' | 'one_to_many' | 'many_to_one' | 'many_to_many';
  
  // Metadata
  description?: string;
  joinLogic?: string;
  transformationNotes?: string;
  isEnforced: boolean;               // Physical FK or logical only
}
```

### 2.3 Domain

```typescript
interface Domain {
  id: string;
  name: string;
  color: string;                     // HSL color string
  description?: string;
  owner?: string;
  contactEmail?: string;
  team?: string;
  parentDomainId?: string;           // For nested domains
  ordinalPosition: number;
}
```

### 2.4 Sheet

```typescript
interface Sheet {
  id: string;
  name: string;
  description?: string;
  scope?: string;                    // Markdown notes on scope
  stakeholderNotes?: string;
  ordinalPosition: number;
  
  // Entities included in this sheet
  entityLayouts: SheetEntityLayout[];
  
  // Display settings
  zoom: number;
  panX: number;
  panY: number;
}

interface SheetEntityLayout {
  entityId: string;
  x: number;
  y: number;
  width?: number;
  collapsed: boolean;               // Show only table name
  displayMode: 'full' | 'compact' | 'name_only';
}
```

### 2.5 Tags & Glossary

```typescript
interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  category?: string;               // e.g., "governance", "technical", "business"
}

interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  examples?: string[];
  synonyms?: string[];
  domainId?: string;
  owner?: string;
  linkedColumnIds: string[];
  linkedEntityIds: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 2.6 Comments

```typescript
interface Comment {
  id: string;
  targetType: 'entity' | 'column' | 'relationship' | 'sheet' | 'domain';
  targetId: string;
  content: string;                 // Markdown
  author?: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;               // For threaded replies
  resolved: boolean;
}
```

### 2.7 Project Settings

```typescript
interface ProjectSettings {
  defaultSchema?: string;          // Default DB schema name
  defaultDialect: 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'sqlite';
  autoSaveInterval: number;        // Seconds
  maxUndoHistory: number;          // Default 1000
  canvasBackground: 'dots' | 'lines' | 'none';
  theme: 'light' | 'dark' | 'system';
  defaultNodeDisplayMode: 'full' | 'compact';
  namingConvention?: {
    tables: 'snake_case' | 'PascalCase' | 'camelCase';
    columns: 'snake_case' | 'PascalCase' | 'camelCase';
  };
}
```

---

## 3. SQLite Catalog Schema

### 3.1 Entity Registry

```sql
-- ============================================================
-- CORE ENTITIES
-- ============================================================

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  file_path     TEXT,              -- Path to .erdforge file (if known)
  last_opened   DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entities (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL CHECK(entity_type IN ('table', 'view')),
  name            TEXT NOT NULL,
  schema_name     TEXT,
  
  -- Documentation
  description          TEXT,
  business_purpose     TEXT,
  owner                TEXT,
  source_system        TEXT,
  refresh_logic        TEXT,
  
  -- Governance
  review_status   TEXT NOT NULL DEFAULT 'draft'
                  CHECK(review_status IN ('draft', 'review', 'approved', 'deprecated')),
  
  -- Audit
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(project_id, entity_type, schema_name, name)
);

CREATE INDEX idx_entities_project ON entities(project_id);
CREATE INDEX idx_entities_status ON entities(review_status);
CREATE INDEX idx_entities_owner ON entities(owner);

-- ============================================================
-- COLUMNS
-- ============================================================

CREATE TABLE columns (
  id                  TEXT PRIMARY KEY,
  entity_id           TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  project_id          TEXT NOT NULL,
  name                TEXT NOT NULL,
  ordinal_position    INTEGER NOT NULL,
  
  -- Type
  data_type           TEXT NOT NULL,
  type_length         INTEGER,
  type_precision      INTEGER,
  type_scale          INTEGER,
  is_array            BOOLEAN DEFAULT FALSE,
  
  -- Constraints
  is_primary_key      BOOLEAN DEFAULT FALSE,
  is_nullable         BOOLEAN DEFAULT TRUE,
  is_unique           BOOLEAN DEFAULT FALSE,
  default_value       TEXT,
  check_constraint    TEXT,
  
  -- Documentation
  description              TEXT,
  business_definition      TEXT,
  examples                 TEXT,    -- JSON array: ["value1", "value2"]
  calculation_logic        TEXT,
  data_quality_rules       TEXT,    -- JSON array of rules
  pii_classification       TEXT NOT NULL DEFAULT 'none'
                           CHECK(pii_classification IN ('none', 'pii', 'sensitive', 'highly_sensitive')),
  
  -- Audit
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(entity_id, name)
);

CREATE INDEX idx_columns_entity ON columns(entity_id);
CREATE INDEX idx_columns_project ON columns(project_id);
CREATE INDEX idx_columns_pii ON columns(pii_classification) WHERE pii_classification != 'none';
CREATE INDEX idx_columns_pk ON columns(entity_id) WHERE is_primary_key = TRUE;

-- ============================================================
-- RELATIONSHIPS
-- ============================================================

CREATE TABLE relationships (
  id                    TEXT PRIMARY KEY,
  project_id            TEXT NOT NULL,
  source_entity_id      TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_column_id      TEXT NOT NULL REFERENCES columns(id),
  target_entity_id      TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_column_id      TEXT NOT NULL REFERENCES columns(id),
  cardinality           TEXT NOT NULL
                        CHECK(cardinality IN ('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many')),
  
  -- Metadata
  description           TEXT,
  join_logic            TEXT,
  transformation_notes  TEXT,
  is_enforced           BOOLEAN DEFAULT TRUE,  -- Physical vs logical FK
  
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rel_source ON relationships(source_entity_id);
CREATE INDEX idx_rel_target ON relationships(target_entity_id);
CREATE INDEX idx_rel_project ON relationships(project_id);

-- ============================================================
-- DOMAINS
-- ============================================================

CREATE TABLE domains (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  name              TEXT NOT NULL,
  color             TEXT NOT NULL,
  description       TEXT,
  owner             TEXT,
  contact_email     TEXT,
  team              TEXT,
  parent_domain_id  TEXT REFERENCES domains(id),
  ordinal_position  INTEGER NOT NULL DEFAULT 0,
  
  UNIQUE(project_id, name)
);

CREATE TABLE entity_domains (
  entity_id   TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  domain_id   TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_id, domain_id)
);

CREATE INDEX idx_entity_domains_domain ON entity_domains(domain_id);

-- ============================================================
-- TAGS
-- ============================================================

CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT,
  description TEXT,
  category    TEXT,
  
  UNIQUE(project_id, name)
);

CREATE TABLE entity_tags (
  entity_id   TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_id, tag_id)
);

CREATE TABLE column_tags (
  column_id   TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (column_id, tag_id)
);

-- ============================================================
-- SHEETS
-- ============================================================

CREATE TABLE sheets (
  id                  TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  scope_notes         TEXT,
  stakeholder_notes   TEXT,
  ordinal_position    INTEGER NOT NULL DEFAULT 0,
  zoom                REAL DEFAULT 1.0,
  pan_x               REAL DEFAULT 0,
  pan_y               REAL DEFAULT 0,
  
  UNIQUE(project_id, name)
);

CREATE TABLE sheet_entities (
  sheet_id      TEXT NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  entity_id     TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  position_x    REAL NOT NULL DEFAULT 0,
  position_y    REAL NOT NULL DEFAULT 0,
  width         REAL,
  collapsed     BOOLEAN DEFAULT FALSE,
  display_mode  TEXT DEFAULT 'full' CHECK(display_mode IN ('full', 'compact', 'name_only')),
  PRIMARY KEY (sheet_id, entity_id)
);

CREATE INDEX idx_sheet_entities_sheet ON sheet_entities(sheet_id);

-- ============================================================
-- GLOSSARY
-- ============================================================

CREATE TABLE glossary_terms (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  term        TEXT NOT NULL,
  definition  TEXT NOT NULL,
  examples    TEXT,              -- JSON array
  synonyms    TEXT,              -- JSON array
  domain_id   TEXT REFERENCES domains(id),
  owner       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(project_id, term)
);

CREATE TABLE term_entity_links (
  term_id     TEXT NOT NULL REFERENCES glossary_terms(id) ON DELETE CASCADE,
  entity_id   TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, entity_id)
);

CREATE TABLE term_column_links (
  term_id     TEXT NOT NULL REFERENCES glossary_terms(id) ON DELETE CASCADE,
  column_id   TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, column_id)
);

-- ============================================================
-- COMMENTS
-- ============================================================

CREATE TABLE comments (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  target_type   TEXT NOT NULL CHECK(target_type IN ('entity', 'column', 'relationship', 'sheet', 'domain')),
  target_id     TEXT NOT NULL,
  content       TEXT NOT NULL,
  author        TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME,
  parent_id     TEXT REFERENCES comments(id),
  resolved      BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id);

-- ============================================================
-- SNAPSHOTS (Version History)
-- ============================================================

CREATE TABLE snapshots (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  name          TEXT NOT NULL,         -- "Before adding Finance domain"
  project_json  TEXT NOT NULL,         -- Full project JSON blob
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  auto_created  BOOLEAN DEFAULT FALSE  -- True for auto-snapshots
);

CREATE INDEX idx_snapshots_project ON snapshots(project_id, created_at DESC);

-- ============================================================
-- FULL-TEXT SEARCH (FTS5)
-- ============================================================

CREATE VIRTUAL TABLE entities_fts USING fts5(
  id UNINDEXED,
  name,
  description,
  business_purpose,
  owner,
  source_system,
  content='entities',
  content_rowid='rowid'
);

CREATE VIRTUAL TABLE columns_fts USING fts5(
  id UNINDEXED,
  entity_id UNINDEXED,
  name,
  description,
  business_definition,
  calculation_logic,
  data_type,
  content='columns',
  content_rowid='rowid'
);

CREATE VIRTUAL TABLE glossary_fts USING fts5(
  id UNINDEXED,
  term,
  definition,
  content='glossary_terms',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER entities_fts_insert AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(rowid, id, name, description, business_purpose, owner, source_system)
  VALUES (new.rowid, new.id, new.name, new.description, new.business_purpose, new.owner, new.source_system);
END;

CREATE TRIGGER entities_fts_delete AFTER DELETE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, id, name, description, business_purpose, owner, source_system)
  VALUES ('delete', old.rowid, old.id, old.name, old.description, old.business_purpose, old.owner, old.source_system);
END;

CREATE TRIGGER entities_fts_update AFTER UPDATE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, id, name, description, business_purpose, owner, source_system)
  VALUES ('delete', old.rowid, old.id, old.name, old.description, old.business_purpose, old.owner, old.source_system);
  INSERT INTO entities_fts(rowid, id, name, description, business_purpose, owner, source_system)
  VALUES (new.rowid, new.id, new.name, new.description, new.business_purpose, new.owner, new.source_system);
END;

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- Column overview with entity context
CREATE VIEW v_column_detail AS
SELECT
  c.id,
  c.name AS column_name,
  c.data_type,
  c.is_primary_key,
  c.is_nullable,
  c.is_unique,
  c.pii_classification,
  c.description,
  e.id AS entity_id,
  e.name AS entity_name,
  e.entity_type,
  e.project_id
FROM columns c
JOIN entities e ON e.id = c.entity_id
ORDER BY e.name, c.ordinal_position;

-- Relationship detail with entity names
CREATE VIEW v_relationship_detail AS
SELECT
  r.id,
  r.cardinality,
  r.is_enforced,
  se.name AS source_entity,
  sc.name AS source_column,
  te.name AS target_entity,
  tc.name AS target_column,
  r.description,
  r.project_id
FROM relationships r
JOIN entities se ON se.id = r.source_entity_id
JOIN columns sc ON sc.id = r.source_column_id
JOIN entities te ON te.id = r.target_entity_id
JOIN columns tc ON tc.id = r.target_column_id;

-- PII column report
CREATE VIEW v_pii_columns AS
SELECT
  e.name AS entity_name,
  c.name AS column_name,
  c.pii_classification,
  c.data_type,
  e.owner,
  group_concat(d.name, ', ') AS domains
FROM columns c
JOIN entities e ON e.id = c.entity_id
LEFT JOIN entity_domains ed ON ed.entity_id = e.id
LEFT JOIN domains d ON d.id = ed.domain_id
WHERE c.pii_classification != 'none'
GROUP BY e.name, c.name, c.pii_classification, c.data_type, e.owner;

-- Metadata completeness score
CREATE VIEW v_entity_completeness AS
SELECT
  e.id,
  e.name,
  e.entity_type,
  e.project_id,
  CASE WHEN e.description IS NOT NULL AND e.description != '' THEN 1 ELSE 0 END +
  CASE WHEN e.owner IS NOT NULL AND e.owner != '' THEN 1 ELSE 0 END +
  CASE WHEN e.source_system IS NOT NULL AND e.source_system != '' THEN 1 ELSE 0 END +
  CASE WHEN (SELECT COUNT(*) FROM entity_tags et WHERE et.entity_id = e.id) > 0 THEN 1 ELSE 0 END +
  CASE WHEN (SELECT COUNT(*) FROM entity_domains ed WHERE ed.entity_id = e.id) > 0 THEN 1 ELSE 0 END
  AS completeness_score,  -- 0-5 score
  5 AS max_score
FROM entities e;
```

---

## 4. ERD of the Catalog Database

```
┌─────────────────┐       ┌─────────────────┐
│    projects     │       │    snapshots     │
│─────────────────│       │─────────────────│
│ id (PK)         │◄──────│ project_id (FK) │
│ name            │       │ id (PK)         │
│ description     │       │ name            │
│ file_path       │       │ project_json    │
│ last_opened     │       │ created_at      │
└─────────────────┘       └─────────────────┘
        │
        │ 1:N
        ▼
┌─────────────────┐       ┌─────────────────┐
│    entities     │       │    domains      │
│─────────────────│       │─────────────────│
│ id (PK)         │◄──────│ project_id (FK) │
│ project_id (FK) │       │ id (PK)         │
│ entity_type     │       │ name            │
│ name            │       │ color           │
│ description     │       │ owner           │
│ owner           │       └─────────────────┘
│ review_status   │              │
└─────────────────┘              │ N:M via entity_domains
        │                       ◄┘
        │ 1:N
        ▼
┌─────────────────┐       ┌─────────────────┐
│    columns      │       │      tags       │
│─────────────────│       │─────────────────│
│ id (PK)         │       │ id (PK)         │
│ entity_id (FK)  │       │ project_id (FK) │
│ name            │       │ name            │
│ data_type       │       │ color           │
│ is_primary_key  │       └─────────────────┘
│ pii_classif.    │              │
│ description     │       N:M via entity_tags, column_tags
└─────────────────┘
        │
        │ N:M via term_column_links
        ▼
┌─────────────────┐
│  glossary_terms │
│─────────────────│
│ id (PK)         │
│ project_id (FK) │
│ term            │
│ definition      │
│ domain_id (FK)  │
└─────────────────┘

┌─────────────────┐       ┌─────────────────┐
│  relationships  │       │    sheets       │
│─────────────────│       │─────────────────│
│ id (PK)         │       │ id (PK)         │
│ source_entity   │       │ project_id (FK) │
│ source_column   │       │ name            │
│ target_entity   │       │ description     │
│ target_column   │       └─────────────────┘
│ cardinality     │              │
└─────────────────┘              │ N:M via sheet_entities
                                ◄┘ (with position_x, position_y)
```
