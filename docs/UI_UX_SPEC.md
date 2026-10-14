# UI/UX Design Specification — ERD Forge
# Wireframes, Component Architecture & Design System

**Version:** 1.0.0  
**Date:** 2026-09-10  

---

## 1. Design System

### 1.1 Color Palette

```css
:root {
  /* Brand */
  --color-brand-500: hsl(230, 70%, 55%);       /* Primary blue-indigo */
  --color-brand-400: hsl(230, 70%, 65%);
  --color-brand-600: hsl(230, 70%, 45%);
  
  /* Surfaces (Dark Mode) */
  --color-surface-base: hsl(220, 20%, 8%);      /* App background */
  --color-surface-raised: hsl(220, 18%, 12%);   /* Cards, panels */
  --color-surface-overlay: hsl(220, 16%, 16%);  /* Modals, dropdowns */
  --color-surface-sunken: hsl(220, 22%, 6%);    /* Code editor */
  
  /* Borders */
  --color-border-subtle: hsl(220, 15%, 20%);
  --color-border-default: hsl(220, 15%, 25%);
  --color-border-strong: hsl(220, 15%, 35%);
  
  /* Text */
  --color-text-primary: hsl(220, 15%, 95%);
  --color-text-secondary: hsl(220, 12%, 65%);
  --color-text-muted: hsl(220, 10%, 45%);
  
  /* Semantic */
  --color-success: hsl(152, 60%, 48%);
  --color-warning: hsl(38, 92%, 55%);
  --color-error: hsl(355, 70%, 55%);
  --color-info: hsl(210, 80%, 58%);
  
  /* Domain Colors (10 preset + custom) */
  --domain-sales:       hsl(14, 80%, 58%);
  --domain-finance:     hsl(152, 60%, 45%);
  --domain-marketing:   hsl(280, 65%, 58%);
  --domain-customer:    hsl(198, 75%, 52%);
  --domain-hr:          hsl(330, 65%, 55%);
  --domain-supply:      hsl(38, 85%, 52%);
  --domain-product:     hsl(175, 60%, 45%);
  --domain-analytics:   hsl(230, 70%, 58%);
  --domain-ops:         hsl(20, 70%, 52%);
  --domain-legal:       hsl(260, 55%, 55%);
  
  /* Review Status */
  --status-draft:       hsl(220, 10%, 55%);
  --status-review:      hsl(38, 85%, 52%);
  --status-approved:    hsl(152, 60%, 48%);
  --status-deprecated:  hsl(355, 60%, 50%);
  
  /* Typography */
  --font-ui: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

> **Font Bundling (REQUIRED — No CDN)**
>
> Fonts MUST be bundled locally. Do NOT use Google Fonts CDN links.
>
> Install via npm:
> ```bash
> pnpm add @fontsource-variable/inter @fontsource-variable/jetbrains-mono
> ```
>
> Import in `main.tsx`:
> ```typescript
> import '@fontsource-variable/inter';
> import '@fontsource-variable/jetbrains-mono';
> ```
>
> These packages are already listed in `apps/web/package.json` devDependencies.

  
  /* Spacing Scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  
  /* Transitions */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-fast: 120ms;
  --duration-normal: 200ms;
  --duration-slow: 350ms;
}
```

> [!IMPORTANT]
> **Font Bundling (Local-First Requirement)**
> 
> ERD Forge makes ZERO network calls. Fonts MUST be bundled locally:
> 1. Download `Inter` and `JetBrains Mono` from Google Fonts / JetBrains
> 2. Place `.woff2` files in `public/fonts/`
> 3. Load via `@font-face` in `styles/global.css` — NOT via `<link>` to Google Fonts CDN
> 
> ```css
> /* styles/global.css — Example */
> @font-face {
>   font-family: 'Inter';
>   font-weight: 100 900;
>   font-display: swap;
>   src: url('/fonts/Inter-Variable.woff2') format('woff2');
> }
> @font-face {
>   font-family: 'JetBrains Mono';
>   font-weight: 400 700;
>   font-display: swap;
>   src: url('/fonts/JetBrainsMono-Variable.woff2') format('woff2');
> }
> ```

### 1.2 Typography Scale

```
Display 2XL:  32px / 700 weight / -0.5px tracking
Display XL:   28px / 700 weight / -0.4px tracking
Heading L:    22px / 600 weight / -0.3px tracking
Heading M:    18px / 600 weight / -0.2px tracking
Heading S:    15px / 600 weight / -0.1px tracking
Body L:       16px / 400 weight / 0 tracking
Body M:       14px / 400 weight / 0 tracking
Body S:       13px / 400 weight / 0 tracking
Caption:      12px / 400 weight / 0.1px tracking
Mono:         13px / 400 weight / 0 tracking (JetBrains Mono)
```

---

## 2. Application Shell Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TITLE BAR  [ERD Forge] [Project Name ▼]          [─] [□] [×]              │
├────────────────┬────────────────────────────────────────────────────────────┤
│                │  TOOLBAR                                                    │
│                │  [Select▼] [Add Table] [Add View] | [Layout▼] [Zoom: 75%] │
│                │  [Search...] [Domain Filter▼] | [Undo] [Redo] [Save]      │
│  LEFT SIDEBAR  ├────────────────────────────────────────────────────────────┤
│  (240px)       │                                                            │
│                │                                                            │
│  ┌──────────┐  │                                                            │
│  │ 🔍 Search│  │              DIAGRAM CANVAS                                │
│  └──────────┘  │              (React Flow)                                  │
│                │                                                            │
│  ▼ Domains     │                                                            │
│    ● Sales     │                                                            │
│    ● Finance   │                                                            │
│    ● Marketing │                                                            │
│    + Add domain│                                                            │
│                │                                                            │
│  ▼ Sheets      │                                                            │
│    📄 Overview │                                                            │
│    📄 Customer │                                                            │
│    📄 Finance  │                                                            │
│    + Add sheet │                                                            │
│                │                                                            │
│  ▼ Recent      │                                                            │
│    Customer    │                                                            │
│    Orders      │                                                            │
│    Products    │                                                            │
│                │                                                            │
├────────────────┤                                                            │
│  [⚙] Settings │                    [MINIMAP]                               │
└────────────────┴────────────────────────────────────────────────────────────┘
```

### With Right Panel Expanded (Entity Inspector)

```
┌─────────────┬──────────────────────────────────────┬───────────────────────┐
│             │  TOOLBAR                             │   ENTITY INSPECTOR    │
│  LEFT       ├──────────────────────────────────────┤  (360px)              │
│  SIDEBAR    │                                      │                       │
│             │                                      │  Table: Customer      │
│             │        DIAGRAM CANVAS                │  ─────────────────────│
│             │                                      │  Domain: ● Sales      │
│             │                                      │  Owner: John Smith    │
│             │                                      │  Status: ✅ Approved  │
│             │                                      │                       │
│             │                                      │  ▼ Description        │
│             │                                      │  Primary customer...  │
│             │                                      │                       │
│             │                                      │  ▼ Columns (12)       │
│             │                                      │  🔑 CustomerID int    │
│             │                                      │    CustomerName var..  │
│             │                                      │    Email varchar      │
│             │                                      │    ⚠ PhoneNumber [PII]│
│             │                                      │                       │
│             │                                      │  ▼ Relationships (3)  │
│             │                                      │    → Orders (1:N)     │
│             │                                      │    → Addresses (1:N)  │
│             │                                      │    ← Agents (N:1)     │
│             │                                      │                       │
│             │                                      │  ▼ Tags               │
│             │                                      │  [core] [pii-present] │
│             │                                      │                       │
│             │                                      │  ▼ Comments (2)       │
│             │                                      │  [+ Add comment]      │
└─────────────┴──────────────────────────────────────┴───────────────────────┘
```

---

## 3. Application Modes / Views

### Mode 1: Split View (SDL + Canvas)

```
┌────────────┬───────────────────────────────────────────────────────────────┐
│            │                                                               │
│            │  ┌────────────────────────┬────────────────────────────────┐ │
│   LEFT     │  │   SDL EDITOR           │   CANVAS                       │ │
│  SIDEBAR   │  │   (CodeMirror 6)       │   (React Flow)                  │ │
│            │  │                        │                                 │ │
│            │  │  Table Customer {      │   ┌──────────────┐              │ │
│            │  │    CustomerID int [pk] │   │  Customer    │              │ │
│            │  │    CustomerName var    │   │──────────────│              │ │
│            │  │    Email varchar       │   │ 🔑 ID int    │              │ │
│            │  │  }                     │   │  Name var    │              │ │
│            │  │                        │   │  Email var   │              │ │
│            │  │  Table Orders {        │   └──────┬───────┘              │ │
│            │  │    OrderID int [pk]    │          │ 1:N                  │ │
│            │  │    CustomerID int      │          ▼                      │ │
│            │  │      [ref: > Customer  │   ┌──────────────┐              │ │
│            │  │       .CustomerID]     │   │   Orders     │              │ │
│            │  │    Total decimal       │   │──────────────│              │ │
│            │  │  }                     │   │ 🔑 ID int    │              │ │
│            │  │                        │   │ CustomerID   │              │ │
│            │  │  ▶ 0 errors            │   │ Total dec    │              │ │
│            │  └────────────────────────┴────────────────────────────────┘ │
└────────────┴───────────────────────────────────────────────────────────────┘
```

### Mode 2: Catalog Explorer View

```
┌────────────┬───────────────────────────────────────────────────────────────┐
│            │  CATALOG EXPLORER                                             │
│   LEFT     │  ──────────────────────────────────────────────────          │
│  SIDEBAR   │  [🔍 Search tables, columns, domains...                    ] │
│            │                                                               │
│            │  Filters: [Domain ▼] [Status ▼] [Tag ▼] [PII only]          │
│            │                                                               │
│            │  ┌─────────────────────────────────────────────────────────┐ │
│            │  │  Entity            │ Domain   │ Owner  │Status │Cols    │ │
│            │  │─────────────────────────────────────────────────────────│ │
│            │  │  📋 Customer       │ ● Sales  │ J.Smith│   ✅  │  12   │ │
│            │  │  📋 Orders         │ ● Sales  │ J.Smith│   ✅  │   8   │ │
│            │  │  📋 Products       │ ● Catalog│ K.Patel│   📝  │  15   │ │
│            │  │  👁 vw_SalesReport │ ● Sales  │ -      │   📝  │   6   │ │
│            │  │  📋 Employees      │ ● HR     │ M.Jones│   🔍  │  22   │ │
│            │  │  📋 GL_Accounts    │ ● Finance│ A.Chen │   ✅  │  18   │ │
│            │  └─────────────────────────────────────────────────────────┘ │
│            │                                                               │
│            │  Showing 6 of 143 entities                                   │
└────────────┴───────────────────────────────────────────────────────────────┘
```

### Mode 3: Impact Analysis View

```
┌────────────┬───────────────────────────────────────────────────────────────┐
│            │  IMPACT ANALYSIS: Customer                                    │
│   LEFT     │  ──────────────────────────────────────────────────────────  │
│  SIDEBAR   │                                                               │
│            │  ▲ UPSTREAM (tables that feed Customer)                       │
│            │  ┌─────────────────────────────────────────────┐             │
│            │  │  Source.Customers (ERP)                     │             │
│            │  │       ↓                                     │             │
│            │  │  Staging.stg_customers                      │             │
│            │  │       ↓                                     │             │
│            │  │  ▶ Customer  ◀──── (selected)               │             │
│            │  └─────────────────────────────────────────────┘             │
│            │                                                               │
│            │  ▼ DOWNSTREAM (tables that depend on Customer)                │
│            │  ┌─────────────────────────────────────────────┐             │
│            │  │  ▶ Customer ──┬──→ Orders                   │             │
│            │  │               ├──→ CustomerAddresses         │             │
│            │  │               ├──→ CustomerTags              │             │
│            │  │               └──→ fct_Sales                 │             │
│            │  │                        ↓                    │             │
│            │  │                   rpt_SalesSummary           │             │
│            │  └─────────────────────────────────────────────┘             │
│            │                                                               │
│            │  [View on Canvas] [Export as Markdown]                        │
└────────────┴───────────────────────────────────────────────────────────────┘
```

---

## 4. Canvas Node Design

### Standard Table Node

```
┌─────────────────────────────────────────────────┐
│  📋 Customer                          ● Sales   │  ← Header with domain badge
│─────────────────────────────────────────────────│
│  🔑 CustomerID      int                         │  ← PK (gold key icon)
│     CustomerName    varchar(255)                │
│  📧 Email           varchar(255)     ⚠ PII     │  ← PII badge
│     PhoneNumber     varchar(20)      ⚠ PII     │
│     CreatedAt       datetime                    │
│     UpdatedAt       datetime                    │
│     IsActive        boolean                     │
│  🔗 AddressID       int             FK →        │  ← FK (link icon)
│─────────────────────────────────────────────────│
│  📝 Draft  •  8 columns  •  J. Smith           │  ← Footer metadata
└─────────────────────────────────────────────────┘
```

### Compact Node (for medium zoom)

```
┌──────────────────────────────────┐
│  📋 Customer           ● Sales   │
│──────────────────────────────────│
│  🔑 CustomerID  • Email  • +5   │
└──────────────────────────────────┘
```

### Name-Only Node (for low zoom / overview)

```
┌───────────────────┐
│  📋 Customer      │
└───────────────────┘
```

### Relationship Edge Styles

```
One-to-Many:    ───────────────────<
Many-to-One:    >───────────────────
One-to-One:     │───────────────────│
Many-to-Many:   >──────────────────<
Self-referencing: ╮──────────────╯
```

---

## 5. Component Architecture

```
src/components/
│
├── layout/
│   ├── AppShell.tsx              # Root layout, panel orchestration
│   ├── TitleBar.tsx              # Project name, window controls (Tauri)
│   ├── LeftSidebar.tsx           # Collapsible left navigation
│   ├── RightPanel.tsx            # Collapsible entity inspector
│   └── StatusBar.tsx             # Bottom status: entity count, zoom, mode
│
├── canvas/
│   ├── DiagramCanvas.tsx         # React Flow wrapper
│   ├── nodes/
│   │   ├── TableNode.tsx         # Standard table node
│   │   ├── ViewNode.tsx          # View node (italic name)
│   │   └── NodeDisplayModes.tsx  # full / compact / name_only variants
│   ├── edges/
│   │   ├── RelationshipEdge.tsx  # Custom edge with cardinality labels
│   │   └── edgeTypes.ts          # Edge type registry
│   ├── controls/
│   │   ├── CanvasToolbar.tsx     # Zoom, layout, filter controls
│   │   ├── MiniMap.tsx           # Domain-colored minimap
│   │   └── ZoomControls.tsx      # Zoom in/out/fit buttons
│   └── overlays/
│       ├── DomainFilterBar.tsx   # Active domain filter chips
│       └── SearchHighlight.tsx   # Search result highlighting
│
├── editor/
│   ├── SDLEditor.tsx             # CodeMirror 6 wrapper
│   ├── sdl-language/
│   │   ├── highlight.ts          # Syntax highlighting
│   │   ├── autocomplete.ts       # Table/column/keyword completion
│   │   ├── linter.ts             # Error highlighting
│   │   └── formatter.ts          # Code formatting
│   ├── EditorToolbar.tsx         # Format, sync, copy buttons
│   └── ErrorPanel.tsx            # Error list below editor
│
├── inspector/                    # Right panel entity inspector
│   ├── EntityInspector.tsx       # Root inspector component
│   ├── TableInspectorPanel.tsx   # Table metadata form
│   ├── ColumnList.tsx            # Column accordion list
│   ├── ColumnInspectorForm.tsx   # Column metadata form
│   ├── RelationshipList.tsx      # Related entity list
│   ├── DomainAssignPanel.tsx     # Domain checkboxes
│   ├── TagPanel.tsx              # Tag management
│   ├── CommentThread.tsx         # Comment display + add
│   └── StatusBadge.tsx           # Review status selector
│
├── catalog/
│   ├── CatalogExplorer.tsx       # Full catalog table view
│   ├── CatalogFilters.tsx        # Domain / status / tag filters
│   ├── CatalogTableRow.tsx       # Table row component
│   ├── ColumnCatalogView.tsx     # Flat column list with entity context
│   └── PIIReport.tsx             # PII column audit view
│
├── domains/
│   ├── DomainList.tsx            # Sidebar domain list
│   ├── DomainForm.tsx            # Create/edit domain modal
│   └── DomainBadge.tsx           # Colored domain chip
│
├── sheets/
│   ├── SheetTabs.tsx             # Sheet tab bar
│   ├── SheetList.tsx             # Sidebar sheet list
│   └── SheetForm.tsx             # Create/edit sheet modal
│
├── glossary/
│   ├── GlossaryPanel.tsx         # Glossary term browser
│   ├── GlossaryTermForm.tsx      # Create/edit term
│   └── TermBadge.tsx             # Inline term chip
│
├── impact/
│   ├── ImpactAnalysisView.tsx    # Impact analysis panel
│   ├── DependencyGraph.tsx       # Upstream/downstream tree
│   └── PathTracer.tsx            # Shortest path view
│
├── toolbar/
│   ├── MainToolbar.tsx           # Top toolbar
│   ├── ModeSelector.tsx          # Canvas / Split / Catalog mode
│   └── ExportMenu.tsx            # Export format dropdown
│
├── modals/
│   ├── ImportModal.tsx           # Import file/paste SDL
│   ├── ExportModal.tsx           # Export format selector + preview
│   ├── SnapshotModal.tsx         # Create/restore version snapshots
│   ├── ProjectSettingsModal.tsx  # Project-level settings
│   └── ShortcutsModal.tsx        # Keyboard shortcut reference
│
└── shared/
    ├── Button.tsx
    ├── Input.tsx
    ├── Select.tsx
    ├── Toggle.tsx
    ├── Badge.tsx
    ├── Tooltip.tsx
    ├── DropdownMenu.tsx
    ├── Modal.tsx
    ├── Accordion.tsx
    ├── ResizablePanel.tsx
    ├── EmptyState.tsx
    └── KeyboardShortcut.tsx
```

---

## 6. Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| Save | Ctrl+S | Cmd+S |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z | Cmd+Shift+Z |
| New Table | Ctrl+T | Cmd+T |
| Global Search | Ctrl+K | Cmd+K |
| Toggle SDL Editor | Ctrl+E | Cmd+E |
| Fit View | Ctrl+Shift+F | Cmd+Shift+F |
| Zoom In | Ctrl+= | Cmd+= |
| Zoom Out | Ctrl+- | Cmd+- |
| Reset Zoom | Ctrl+0 | Cmd+0 |
| Auto Layout | Ctrl+L | Cmd+L |
| Toggle Left Panel | Ctrl+[ | Cmd+[ |
| Toggle Right Panel | Ctrl+] | Cmd+] |
| Copy Entity | Ctrl+C | Cmd+C |
| Paste Entity | Ctrl+V | Cmd+V |
| Delete Selected | Delete/Backspace | Delete |
| Impact Analysis | Ctrl+I | Cmd+I |
| Export | Ctrl+Shift+E | Cmd+Shift+E |
| Keyboard Shortcuts Help | ? | ? |
| Navigate Sheets | Ctrl+1-9 | Cmd+1-9 |
| Switch to Canvas Mode | Alt+1 | Option+1 |
| Switch to Split Mode | Alt+2 | Option+2 |
| Switch to Catalog Mode | Alt+3 | Option+3 |

---

## 7. Responsive Breakpoints

ERD Forge is primarily a desktop application but adapts gracefully:

```
Compact (1024px - 1279px):   Single panel visible, sidebar auto-collapse
Standard (1280px - 1599px):  Default layout, right panel overlay
Wide (1600px - 1919px):      Full three-panel layout
Ultra-wide (1920px+):        Full layout + canvas gets extra space
```

---

## 8. Onboarding Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WELCOME TO ERD FORGE                             │
│                                                                     │
│            Design. Document. Govern. All locally.                   │
│                                                                     │
│  ┌──────────────────────┐   ┌──────────────────────┐               │
│  │   🆕 New Project     │   │   📂 Open Project     │               │
│  │   Start from scratch │   │   Open .erdforge file │               │
│  └──────────────────────┘   └──────────────────────┘               │
│                                                                     │
│  ┌──────────────────────┐   ┌──────────────────────┐               │
│  │   📥 Import Schema   │   │   📚 Load Example     │               │
│  │   SQL DDL / DBML     │   │   E-commerce Schema   │               │
│  └──────────────────────┘   └──────────────────────┘               │
│                                                                     │
│  ─────────────────── Recent Projects ──────────────────────────    │
│  📁 Data Warehouse Model          Last opened: 2h ago               │
│  📁 HR Analytics Schema           Last opened: 2d ago               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```
