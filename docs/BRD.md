# Business Requirements Document (BRD)
# ERD Forge — Local-First ERD Modeling & Data Catalog Platform

**Version:** 1.0.0  
**Date:** 2026-09-10  
**Status:** Draft  
**Author:** Principal Software Architect / Product Designer  
**Classification:** Internal — Product Planning

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context & Problem Statement](#2-business-context--problem-statement)
3. [Stakeholders & User Personas](#3-stakeholders--user-personas)
4. [Product Vision](#4-product-vision)
5. [Business Goals & Success Metrics](#5-business-goals--success-metrics)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [User Workflows](#8-user-workflows)
9. [Constraints & Assumptions](#9-constraints--assumptions)
10. [Out of Scope (v1.0)](#10-out-of-scope-v10)
11. [Risk Register](#11-risk-register)
12. [Glossary](#12-glossary)

---

## 1. Executive Summary

**ERD Forge** is a local-first, desktop-class web application for designing, documenting, governing, and sharing Entity Relationship Diagrams (ERDs). It addresses a critical gap in the data engineering and analytics ecosystem: the absence of a self-hosted, privacy-respecting tool that combines the expressiveness of a code-first schema language with the visual richness of enterprise ERD tools and the metadata depth of a data catalog.

Unlike cloud-based tools (dbdiagram.io, Lucidchart, Miro), ERD Forge stores all data locally with zero cloud dependency, zero telemetry, and no subscription model. It is designed to handle production-grade schemas with 1,000+ tables and serve data architects, data engineers, database administrators, and data governance professionals in regulated and security-conscious environments.

---

## 2. Business Context & Problem Statement

### 2.1 Current Landscape

| Tool | Strength | Weakness |
|------|----------|----------|
| dbdiagram.io | Code-first, fast, clean | Cloud-only, limited docs, no domains |
| Lucidchart | Visual richness | Expensive, cloud, no code-first |
| Draw.io | Free, local-capable | No schema intelligence |
| DataGrip ERD | SQL-aware | IDE-locked, read-only |
| erwin | Enterprise-grade | Expensive, outdated UX |
| Hackolade | JSON/NoSQL focus | Narrow scope |

### 2.2 Pain Points

1. **Privacy & Security**: Sensitive schema definitions (PII columns, business logic) cannot be shared with cloud SaaS tools in regulated environments.
2. **Scale**: No free/local tool handles 500+ table schemas without performance degradation.
3. **Documentation Gap**: ERD tools focus on diagrams, not data documentation. Data catalogs don't generate diagrams.
4. **Domain Organization**: No tool allows multi-domain, multi-stakeholder views from a single schema definition.
5. **Metadata Poverty**: Column-level notes, PII flags, data quality rules, and ownership are not first-class in any ERD tool.
6. **Portability**: Vendor lock-in through proprietary formats prevents schema portability.

### 2.3 Opportunity

Build the first truly local-first, production-grade ERD tool that collapses the gap between schema design, visual modeling, and enterprise data catalog features — all in a privacy-first, zero-cloud architecture.

---

## 3. Stakeholders & User Personas

### Persona 1: "The Data Architect" — Priya

- **Role**: Senior Data Architect at a financial services firm
- **Experience**: 12 years in data modeling
- **Goals**: Maintain canonical data models, enforce naming standards, document business glossary
- **Frustrations**: Constant context-switching between SQL tools, documentation wikis, and ERD editors
- **Needs**: Code-first schema definition, domain organization, export to documentation, approval workflows
- **Usage Pattern**: Heavy daily user, works with 400+ table warehouse models

### Persona 2: "The Data Engineer" — Marcus

- **Role**: Senior Data Engineer at a healthcare startup
- **Experience**: 6 years, Python/SQL heavy
- **Goals**: Build pipeline-ready schemas, understand upstream/downstream dependencies
- **Frustrations**: No local tool that understands FK relationships at scale
- **Needs**: Impact analysis, path tracing, SQL DDL import/export, CLI-friendliness
- **Usage Pattern**: Daily user, frequently switches between code and visual view

### Persona 3: "The DBA" — Sandra

- **Role**: Database Administrator at a manufacturing company
- **Experience**: 15 years, Oracle/SQL Server
- **Goals**: Document existing production schemas, flag deprecated tables, track ownership
- **Frustrations**: Existing schemas are undocumented; erwin is too expensive
- **Needs**: SQL DDL import, column-level metadata, PII tagging, export to data dictionary
- **Usage Pattern**: Moderate user, primarily documentation-focused

### Persona 4: "The Analytics Engineer" — Jay

- **Role**: Analytics Engineer at a retail company
- **Experience**: 4 years, dbt/Snowflake
- **Goals**: Document mart layer, create stakeholder-facing diagrams from complex models
- **Frustrations**: Can't create "executive view" diagrams without duplicating work
- **Needs**: Multiple diagram sheets, domain views, Markdown export
- **Usage Pattern**: Weekly user, stakeholder presentation-focused

### Persona 5: "The Data Governance Manager" — Claire

- **Role**: Data Governance Lead at an insurance firm
- **Experience**: 8 years
- **Goals**: Maintain business glossary, track data owners, manage review/approval lifecycle
- **Frustrations**: Governance metadata lives in spreadsheets, disconnected from actual schemas
- **Needs**: Business glossary integration, review status, ownership tracking, data dictionary export
- **Usage Pattern**: Weekly governance reviews, catalog explorer

---

## 4. Product Vision

> **"ERD Forge is the only local-first data modeling platform that treats your schema, your documentation, your business domains, and your data governance as a unified, living system."**

### 4.1 Product Pillars

| Pillar | Description |
|--------|-------------|
| **Local-First** | Zero cloud dependency. All data on your machine, your filesystem, your control |
| **Code + Visual** | Code-first schema definition with real-time visual rendering — no forced choice |
| **Domain-Organized** | Business domains are first-class citizens, not afterthoughts |
| **Documentation-Rich** | Every entity, column, and relationship can carry rich, structured metadata |
| **Catalog-Native** | Built-in data catalog and business glossary, not a bolt-on |
| **Scalable** | Designed from day 1 for 1,000+ table production schemas |

---

## 5. Business Goals & Success Metrics

### 5.1 Goals

| ID | Goal |
|----|------|
| G1 | Enable full schema lifecycle management in a single local tool |
| G2 | Reduce time to create stakeholder documentation by 70% |
| G3 | Support regulated industries where cloud tools are prohibited |
| G4 | Provide a free, open-source alternative to enterprise ERD tools |
| G5 | Enable schema portability via open formats (JSON, SQL, Markdown) |

### 5.2 Success Metrics

| Metric | Target |
|--------|--------|
| Schema load time for 1,000 tables | < 2 seconds |
| Diagram render time (500 tables) | < 3 seconds |
| Search result latency | < 100ms |
| Undo/redo operations per session | Unlimited (up to 1,000 steps) |
| Export fidelity (SQL roundtrip) | 100% |
| Crash-free session rate | > 99.9% |

---

## 6. Functional Requirements

### FR-1: Schema Definition Language (SDL)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Support table, view, column, and relationship definitions in a custom DSL | P0 |
| FR-1.2 | Real-time live parsing with diagram synchronization | P0 |
| FR-1.3 | Syntax error highlighting with line-level diagnostics | P0 |
| FR-1.4 | Auto-complete for keywords, table names, column names, data types | P0 |
| FR-1.5 | Support PK, FK, composite key, unique constraint definitions | P0 |
| FR-1.6 | Support inline comments in SDL | P0 |
| FR-1.7 | Formatter / code beautifier | P1 |
| FR-1.8 | SDL <-> SQL DDL bidirectional conversion | P1 |
| FR-1.9 | Import from dbdiagram.io DBML format | P1 |

### FR-2: Visual ERD Designer

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Render tables as nodes with column-level detail | P0 |
| FR-2.2 | Render relationships as edges with cardinality labels | P0 |
| FR-2.3 | Drag-and-drop repositioning with position persistence | P0 |
| FR-2.4 | Pan and zoom (mouse wheel + trackpad) | P0 |
| FR-2.5 | Auto-layout (hierarchical, force-directed, orthogonal) | P1 |
| FR-2.6 | Relationship highlighting on entity selection | P0 |
| FR-2.7 | Entity search with canvas focus navigation | P1 |
| FR-2.8 | Visual inline editing of table/column properties | P1 |
| FR-2.9 | Minimap for large schema navigation | P1 |
| FR-2.10 | Domain color-coding on diagram canvas | P0 |
| FR-2.11 | Lasso/box selection for multi-entity operations | P2 |
| FR-2.12 | Customizable node appearance (compact / full / collapsed) | P2 |

### FR-3: Business Domain Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Create, rename, delete business domains | P0 |
| FR-3.2 | Assign tables/views to one or more domains | P0 |
| FR-3.3 | Color-code domains on canvas and in navigation | P0 |
| FR-3.4 | Domain-scoped diagram sheets | P1 |
| FR-3.5 | Domain ownership metadata (team, contact, DRI) | P1 |
| FR-3.6 | Domain-level description and notes | P1 |
| FR-3.7 | Filter canvas by domain | P0 |
| FR-3.8 | Cross-domain relationship visualization | P1 |

### FR-4: Multi-Sheet Diagram Workspaces

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Create multiple named diagram sheets within a project | P0 |
| FR-4.2 | Add/remove tables to specific sheets independently | P0 |
| FR-4.3 | Independent layout positions per sheet | P0 |
| FR-4.4 | Shared metadata across sheets (descriptions, domains, etc.) | P0 |
| FR-4.5 | Sheet-level notes and scope description | P1 |
| FR-4.6 | Template sheets (Dimensional Model, Operational, Reporting) | P2 |
| FR-4.7 | Cross-sheet navigation links | P2 |

### FR-5: Documentation & Metadata

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Table-level description, owner, source system, refresh logic, tags | P0 |
| FR-5.2 | Column-level definition, data quality rules, examples, PII classification | P0 |
| FR-5.3 | Relationship-level business explanation and join logic | P1 |
| FR-5.4 | Rich text notes (Markdown) at entity and sheet level | P1 |
| FR-5.5 | Tagging system with global tag management | P1 |
| FR-5.6 | Review status per entity (Draft / Review / Approved / Deprecated) | P1 |
| FR-5.7 | Comment threads on tables, columns, and sheets | P2 |
| FR-5.8 | Annotation pins on canvas | P2 |

### FR-6: Navigation & Discovery

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Global search across tables, columns, domains, tags | P0 |
| FR-6.2 | Impact analysis — upstream/downstream entity graph | P1 |
| FR-6.3 | Shortest-path relationship tracing | P2 |
| FR-6.4 | Recently viewed entities | P1 |
| FR-6.5 | Favorites / bookmarks | P2 |
| FR-6.6 | Catalog explorer side panel | P0 |

### FR-7: Data Catalog

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | Full catalog table/view/column browser | P0 |
| FR-7.2 | Business glossary with term definitions | P1 |
| FR-7.3 | Term-to-column linkage | P2 |
| FR-7.4 | Metadata completeness scoring | P2 |
| FR-7.5 | Data dictionary generation | P1 |

### FR-8: Import / Export

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-8.1 | Export to PNG, SVG | P0 |
| FR-8.2 | Export to PDF | P1 |
| FR-8.3 | Export to JSON project file | P0 |
| FR-8.4 | Export to HTML documentation site | P1 |
| FR-8.5 | Export to Markdown documentation | P1 |
| FR-8.6 | Export to SQL DDL (PostgreSQL, MySQL, SQL Server, Oracle) | P1 |
| FR-8.7 | Export to Excel/CSV data dictionary | P2 |
| FR-8.8 | Import from SQL DDL | P1 |
| FR-8.9 | Import from JSON schema | P2 |
| FR-8.10 | Import from DBML (dbdiagram.io format) | P1 |
| FR-8.11 | Import from Excel/CSV metadata | P2 |

### FR-9: Productivity

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-9.1 | Unlimited undo/redo | P0 |
| FR-9.2 | Keyboard shortcuts (comprehensive) | P1 |
| FR-9.3 | Copy/paste entities between sheets | P1 |
| FR-9.4 | Bulk domain assignment | P2 |
| FR-9.5 | Table templates (audit columns, SCD columns) | P2 |
| FR-9.6 | Auto-backup on change (debounced) | P0 |
| FR-9.7 | Version snapshots with restore | P2 |
| FR-9.8 | Project file format versioning | P0 |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| NFR | Target |
|-----|--------|
| Initial app load time | < 3 seconds |
| Schema with 1,000 tables — parse time | < 1 second |
| Schema with 1,000 tables — render time | < 3 seconds |
| Search latency | < 100ms |
| Auto-save write time | < 200ms |
| Memory usage (1,000 tables) | < 512MB |

### 7.2 Reliability

| NFR | Target |
|-----|--------|
| Auto-save interval | Every 30 seconds + on every significant action |
| Crash recovery | Restore last auto-save on restart |
| Data corruption resilience | Atomic file writes with backup copy |

### 7.3 Accessibility

| NFR | Requirement |
|-----|-------------|
| WCAG 2.1 AA compliance | Required for all UI panels |
| Keyboard navigation | Full keyboard operability |
| Screen reader support | ARIA labels on all interactive elements |
| High-contrast mode | Supported |
| Color-blind friendly palette | Required for relationship/domain colors |

### 7.4 Security

| NFR | Requirement |
|-----|-------------|
| Zero telemetry | No analytics, crash reports, or network calls |
| Local-only storage | All data stays on the filesystem |
| No authentication service | Single-user, local mode only |
| Content Security Policy | Strict CSP for Tauri/PWA/browser context |

### 7.5 Compatibility

| NFR | Target |
|-----|--------|
| Browser support (web mode) | Chrome 110+, Firefox 115+, Edge 110+ |
| OS (Tauri mode) | Windows 10+, macOS 12+, Ubuntu 20.04+ |
| Minimum RAM | 4GB |
| Minimum display | 1280×768 |

---

## 8. User Workflows

### Workflow 1: New Schema from Scratch

```
1. Create new project
2. Open SDL editor
3. Type table definitions in ERD Forge SDL
4. See live diagram render
5. Assign tables to domains
6. Add documentation (descriptions, owners, tags)
7. Create multiple diagram sheets
8. Export to HTML documentation
```

### Workflow 2: Import Existing Schema

```
1. Create new project
2. Import SQL DDL file
3. Review auto-generated tables/columns
4. Assign domains
5. Add missing documentation
6. Create stakeholder views (sheets)
7. Export data dictionary
```

### Workflow 3: Impact Analysis

```
1. Open existing project
2. Search for target table
3. Open Impact Analysis panel
4. View upstream (tables that feed this table)
5. View downstream (tables that depend on this table)
6. Navigate to related entities
7. Export impact analysis as Markdown
```

### Workflow 4: Domain Documentation Review

```
1. Open project
2. Navigate to domain (e.g., "Finance")
3. Open domain diagram sheet
4. Review tables in domain
5. Open Catalog Explorer
6. Check metadata completeness
7. Update descriptions and tags
8. Mark entities as "Approved"
```

---

## 9. Constraints & Assumptions

### 9.1 Constraints

- Must run without internet connectivity
- Must not require admin/sudo permissions
- Storage mechanism must be human-readable and portable (JSON or SQLite)
- Must handle schemas up to 2,000 tables without performance degradation
- Binary dependencies must be bundled (no external runtime requirements)

### 9.2 Assumptions

- Single user per installation (no multi-user concurrent editing in v1)
- Users have a modern web browser or desktop OS
- File system access is available (for project file storage)
- Node.js toolchain is acceptable for build (not for runtime in browser mode)

---

## 10. Out of Scope (v1.0)

| Feature | Rationale |
|---------|-----------|
| Real-time collaboration (multi-user) | Requires server infrastructure |
| Cloud sync / backup | Conflicts with local-first principle |
| Live database connection (introspection) | High complexity, future roadmap |
| Version control integration (Git) | P2+ |
| AI/LLM schema suggestions | P2+ |
| Role-based access control | Single-user in v1 |
| Mobile / tablet support | Desktop-first in v1 |
| No-SQL / document store support | Relational-first in v1 |

---

## 11. Risk Register

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | Performance degradation at 1,000+ tables | High | Critical | Virtualization, incremental rendering, canvas culling |
| R2 | SDL parser ambiguity | Medium | High | PEG.js grammar with strict AST, comprehensive test suite |
| R3 | File corruption on crash | Medium | High | Atomic writes, shadow file, auto-backup |
| R4 | Diagram engine limitations (React Flow vs Cytoscape) | Medium | High | Abstract diagram engine interface, allow swapping |
| R5 | Complex import format parity (SQL DDL dialects) | High | Medium | Use established parser (node-sql-parser), dialect flags |
| R6 | Desktop packaging complexity (Tauri) | Low | Medium | Ship browser mode first, add Tauri in v1.5 |
| R7 | Accessibility compliance gaps | Medium | Medium | Automated axe-core testing in CI |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **SDL** | Schema Definition Language — the ERD Forge DSL for defining tables, columns, and relationships |
| **Entity** | A table or view within the data model |
| **Domain** | A business grouping of related entities (e.g., Sales, Finance) |
| **Sheet** | A named diagram workspace showing a subset of entities with their own layout |
| **Catalog** | The structured metadata store containing all entity and column metadata |
| **Glossary** | A curated list of business terms linked to specific columns or entities |
| **Impact Analysis** | The process of identifying all upstream and downstream dependencies of an entity |
| **DBML** | Database Markup Language — the schema language used by dbdiagram.io |
| **DDL** | Data Definition Language — SQL statements that define schema structure (CREATE TABLE, etc.) |
| **PII** | Personally Identifiable Information — data requiring special handling and classification |
| **DRI** | Directly Responsible Individual — the single owner of a domain or entity |
| **AST** | Abstract Syntax Tree — the parsed representation of SDL/SDL code |
| **Local-first** | A software architecture where all data is stored locally with no cloud dependency |
