# Product Roadmap — ERD Forge
# P0 to P3 Feature Prioritization

**Version:** 1.0.0  
**Date:** 2026-09-10  
**Planning Horizon:** 18 months

---

## Priority Definitions

| Priority | Label | Timeframe | Description |
|----------|-------|-----------|-------------|
| **P0** | Must Have | v1.0 (Month 1-3) | Core, non-negotiable features. App is not usable without these. |
| **P1** | Should Have | v1.1-1.2 (Month 4-6) | High value, significantly improves the product. |
| **P2** | Nice to Have | v1.3-1.5 (Month 7-12) | Valuable but the app is fully usable without these. |
| **P3** | Future Vision | v2.0+ (Month 13+) | Differentiated features that define long-term competitive advantage. |

---

## P0 — Version 1.0 (Core Foundation)

**Goal**: Deliver a functional, polished ERD tool that replaces dbdiagram.io for local usage.

### Schema & Modeling
- [ ] SDL parser (PEG.js grammar)
- [ ] Live diagram generation from SDL
- [ ] Syntax error highlighting
- [ ] Table and column model
- [ ] Relationship definitions (1:1, 1:N, N:1, N:N)
- [ ] Self-referencing relationships
- [ ] Primary key, foreign key, unique constraint support
- [ ] View definitions

### Visual Canvas
- [ ] React Flow canvas with table nodes
- [ ] Drag-and-drop entity repositioning
- [ ] Pan and zoom
- [ ] Relationship edge rendering with cardinality labels
- [ ] Node selection with relationship highlight
- [ ] Domain color-coding on nodes

### Business Domains
- [ ] Create/edit/delete domains
- [ ] Color assignment to domains
- [ ] Assign entities to domains
- [ ] Filter canvas by domain

### Multiple Sheets
- [ ] Create/rename/delete diagram sheets
- [ ] Add/remove entities per sheet
- [ ] Independent layout per sheet
- [ ] Shared entity metadata across sheets

### Documentation
- [ ] Table-level description, owner, source system, tags
- [ ] Column-level description, PII classification
- [ ] Review status (Draft / Review / Approved / Deprecated)
- [ ] Tag system with global management

### Storage & Reliability
- [ ] Project file format (.erdforge JSON)
- [ ] SQLite catalog via wa-sqlite (OPFS)
- [ ] Auto-save (debounced, every 30 seconds)
- [ ] File System Access API for project open/save
- [ ] Crash recovery from last auto-save
- [ ] Undo/redo (up to 1,000 steps)

### Navigation
- [ ] Global search (tables, columns, domains, tags)
- [ ] Catalog Explorer panel
- [ ] Left sidebar navigation (domains, sheets)

### Export
- [ ] Export to PNG
- [ ] Export to SVG
- [ ] Export to JSON project file

### App Shell
- [ ] Application shell with left sidebar + canvas + right inspector
- [ ] Split view (SDL editor + canvas)
- [ ] Dark mode / light mode / system theme
- [ ] PWA installability
- [ ] Onboarding / welcome screen
- [ ] Example project files (e-commerce, HR, data warehouse)

---

## P1 — Version 1.1-1.2 (Documentation & Import Power)

**Goal**: Make ERD Forge a complete documentation platform, not just a diagram tool.

### Enhanced Documentation
- [ ] Rich text notes (Markdown via TipTap) at entity and sheet level
- [ ] Relationship-level documentation (join logic, transformation notes)
- [ ] Sheet-level scope and stakeholder notes
- [ ] Column-level calculation logic and data quality rules
- [ ] Column examples field

### Import Capabilities
- [ ] Import from SQL DDL (PostgreSQL, MySQL, SQL Server)
- [ ] Import from DBML (dbdiagram.io format)
- [ ] SDL import from `.erdforge-sdl` file
- [ ] Import merge strategies (replace / merge / append)

### Export Enhancements
- [ ] Export to PDF
- [ ] Export to HTML documentation site (self-contained, offline)
- [ ] Export to Markdown documentation
- [ ] Export to SQL DDL (PostgreSQL, MySQL, SQL Server, Oracle)
- [ ] Export to data dictionary (Excel/XLSX)

### Visual Canvas Improvements
- [ ] Auto-layout (ELK.js: layered hierarchical)
- [ ] Force-directed layout option
- [ ] Minimap for large schema navigation
- [ ] Canvas search with entity focus
- [ ] SDL formatter / code beautifier

### Catalog Features
- [ ] Business glossary panel
- [ ] Glossary term creation and definition
- [ ] Metadata completeness scoring per entity
- [ ] PII column report/audit view
- [ ] Domain overview sheets (auto-generated)

### Navigation
- [ ] Impact analysis panel (upstream / downstream)
- [ ] Recently viewed entities list
- [ ] Cross-domain relationship highlighting

### Quality of Life
- [ ] Keyboard shortcuts (comprehensive, documented)
- [ ] Copy/paste entities between sheets
- [ ] Auto-complete for SDL (table names, column names, data types)
- [ ] SDL validation errors with quick-fix hints
- [ ] Version snapshot with restore (manual)

---

## P2 — Version 1.3-1.5 (Power User Features)

**Goal**: Serve enterprise power users with advanced governance, navigation, and productivity features.

### Advanced Navigation
- [ ] Shortest-path relationship tracer between two entities
- [ ] Bookmarks / favorites list
- [ ] Advanced filter builder (multi-domain, multi-tag, status combinations)
- [ ] Entity dependency tree view

### Visual Enhancements
- [ ] Lasso/box selection for multi-entity operations
- [ ] Bulk domain assignment via selection
- [ ] Compact node display mode
- [ ] Name-only node at low zoom (LOD)
- [ ] Orthogonal edge routing option
- [ ] Custom node color overrides
- [ ] Canvas annotation pins

### Documentation Enhancements
- [ ] Comment threads on entities, columns, sheets
- [ ] Glossary term → column linkage
- [ ] Composite key documentation
- [ ] Column-level review status

### Import Enhancements
- [ ] Import from Excel/CSV metadata template
- [ ] Import from JSON schema (JSON Schema v7)
- [ ] Import from Oracle DDL
- [ ] Conflict detection on import

### Export Enhancements
- [ ] Export to CSV data dictionary
- [ ] Scoped export (by sheet or domain)
- [ ] Export to dbt YAML schema

### Developer Experience
- [ ] Monorepo CLI tool (`erdforge-cli`)
  - `erdforge validate schema.sdl`
  - `erdforge export --format sql --dialect postgresql`
  - `erdforge import schema.sql --output project.erdforge`
- [ ] SDL language server (LSP) for IDE integration
- [ ] VS Code extension for `.erdforge-sdl` files

### Table Templates
- [ ] Audit column template (created_at, updated_at, created_by)
- [ ] SCD Type 2 template
- [ ] Surrogate key template
- [ ] Soft delete template

### Diagram Templates
- [ ] Star schema template (Fact + Dimension)
- [ ] Data vault template (Hub, Link, Satellite)
- [ ] 3NF operational template
- [ ] Event sourcing template

---

## P3 — Version 2.0+ (Platform Differentiation)

**Goal**: Transform ERD Forge from a tool into a data modeling platform with integrations, AI, and collaboration.

### Git Integration
- [ ] Store projects in Git repositories
- [ ] Auto-commit on save with meaningful messages
- [ ] Schema diff viewer (branch comparison)
- [ ] Pull request-like review workflow for schema changes
- [ ] Changelog generation from git history

### Live Database Introspection
- [ ] Connect to local PostgreSQL / MySQL / SQLite
- [ ] Auto-generate schema from live database
- [ ] Detect schema drift (model vs actual DB)
- [ ] Sync changes back to DB via migrations

### AI-Assisted Design (Local LLM)
- [ ] Natural language to SDL: "Create a table for tracking customer orders"
- [ ] Schema optimization suggestions ("Consider normalizing...")
- [ ] Auto-generate column documentation from names
- [ ] Detect naming inconsistencies
- [ ] Suggest missing relationships
- [ ] Uses Ollama (local, no cloud)

### Multi-Project Workspace
- [ ] Project library / workspace browser
- [ ] Cross-project entity reuse
- [ ] Shared domain library
- [ ] Shared table templates library

### Data Lineage
- [ ] ETL/pipeline lineage (source → staging → mart)
- [ ] dbt lineage import from `manifest.json`
- [ ] Airflow DAG lineage integration
- [ ] Column-level lineage tracking

### Advanced Governance
- [ ] Data retention policies per entity
- [ ] GDPR/CCPA compliance checklist per entity
- [ ] Access tier classification (public / internal / restricted / confidential)
- [ ] Regulatory tag system (HIPAA, PCI-DSS, SOX, GDPR)
- [ ] Governance dashboard

### Plugin System
- [ ] Plugin API for custom exporters
- [ ] Plugin API for custom importers
- [ ] Plugin API for custom auto-layout algorithms
- [ ] Community plugin marketplace

### Team Mode (Future, Optional)
- [ ] Local network sharing (no cloud required)
- [ ] Conflict-free replicated data type (CRDT) sync
- [ ] Change attribution (who changed what)
- [ ] Review/approval workflow with notifications

---

## Version Release Timeline

```
Month 1-3    │  v1.0.0 — Core Foundation (P0)
             │  - SDL parser + live canvas
             │  - Domains + sheets
             │  - Basic documentation
             │  - PNG/SVG/JSON export
             │  - PWA + local storage

Month 4-6    │  v1.1.0 — Documentation Power (P1 first half)
             │  - Rich text notes
             │  - SQL DDL import
             │  - HTML + Markdown export
             │  - Impact analysis
             │  - Auto-layout

Month 6-8    │  v1.2.0 — Catalog & Governance (P1 second half)
             │  - Business glossary
             │  - PDF export
             │  - Data dictionary (Excel)
             │  - PII audit report
             │  - Keyboard shortcuts

Month 9-11   │  v1.3.0 — Power User (P2 first half)
             │  - Comment threads
             │  - CLI tool
             │  - LSP / VS Code extension
             │  - Advanced filters
             │  - Table templates

Month 12-15  │  v1.5.0 — Desktop + Developer (P2 second half)
             │  - Tauri v2 desktop app
             │  - Diagram templates
             │  - JSON schema import
             │  - dbt YAML export

Month 16-18  │  v2.0.0-alpha — Platform (P3 first)
             │  - Git integration
             │  - Live DB introspection
             │  - AI-assisted design (Ollama)
             │  - Column-level lineage
```

---

## Feature Dependency Map

```
P0: SDL Parser
  └─► P0: Live Canvas
        └─► P0: Domains
              └─► P0: Sheets
                    └─► P1: HTML Export
                    └─► P1: Auto-layout
                          └─► P2: Diagram Templates

P0: Storage
  └─► P0: Auto-save
        └─► P2: Git Integration (P3)

P1: SQL DDL Import
  └─► P2: Live DB Introspection (P3)
  └─► P2: Schema Drift Detection (P3)

P1: Impact Analysis
  └─► P3: Data Lineage
        └─► P3: dbt Lineage Import

P1: Business Glossary
  └─► P2: Governance Dashboard (P3)
        └─► P3: GDPR/HIPAA Compliance
```
