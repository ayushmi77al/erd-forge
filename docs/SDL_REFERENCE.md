# ERD Forge SDL — Language Reference

**Version:** 1.0.0  
**Date:** 2026-09-10

---

## Overview

The **ERD Forge Schema Definition Language (SDL)** is a human-readable, code-first language for defining database schemas. It is inspired by DBML (dbdiagram.io) but extends it with domain organization, metadata annotations, view support, composite keys, and governance metadata.

SDL files use the `.erdforge-sdl` extension and can be embedded directly inside `.erdforge` project files.

---

## Quick Example

```sdl
// E-Commerce Data Model
// Domain: Sales

Domain Sales {
  color: "#e04a2f"
  owner: "Sales Team"
}

Domain Catalog {
  color: "#2f7de0"
}

Table Customer [domain: Sales, owner: "John Smith"] {
  CustomerID    int          [pk]
  Email         varchar(255) [unique, not null, pii: "email"]
  FirstName     varchar(100) [not null]
  LastName      varchar(100) [not null]
  CreatedAt     datetime     [not null, default: `CURRENT_TIMESTAMP`]
  IsActive      boolean      [not null, default: true]
  
  Note: "Primary customer entity. Source: CRM system. Refreshed daily."
}

Table Product [domain: Catalog] {
  ProductID     int          [pk]
  ProductName   varchar(255) [not null]
  SKU           varchar(50)  [unique, not null]
  Price         decimal(18,2)[not null]
  CategoryID    int          [ref: > Category.CategoryID]
  
  Note: "Master product catalog."
}

Table Category [domain: Catalog] {
  CategoryID    int          [pk]
  CategoryName  varchar(100) [not null]
  ParentID      int          [ref: > Category.CategoryID]  // Self-referencing
}

Table Orders [domain: Sales] {
  OrderID       int          [pk]
  CustomerID    int          [not null, ref: > Customer.CustomerID]
  OrderDate     datetime     [not null]
  TotalAmount   decimal(18,2)[not null]
  Status        varchar(20)  [not null, default: "pending"]
  
  indexes {
    (CustomerID, OrderDate) [name: "idx_customer_orders"]
    (Status)
  }
}

Table OrderItem [domain: Sales] {
  OrderItemID   int          [pk]
  OrderID       int          [not null, ref: > Orders.OrderID]
  ProductID     int          [not null, ref: > Product.ProductID]
  Quantity      int          [not null]
  UnitPrice     decimal(18,2)[not null]
  
  // Composite PK alternative
  // indexes { (OrderID, ProductID) [pk] }
}

View vw_OrderSummary [domain: Sales] {
  OrderID
  CustomerID
  CustomerEmail
  OrderDate
  TotalAmount
  ItemCount
  
  Note: "Aggregated order view for reporting. Source: Orders + OrderItem."
}
```

---

## Syntax Reference

### 1. Table Definition

```sdl
Table <TableName> [<table-options>] {
  <ColumnDefinitions>
  [<IndexDefinitions>]
  [Note: "<documentation>"]
}
```

**Table Options** (in square brackets):
```sdl
Table Customer [
  domain: Sales,
  owner: "John Smith",
  source: "CRM",
  status: approved,
  tags: ["core", "pii-present"]
] {
  ...
}
```

| Option | Type | Description |
|--------|------|-------------|
| `domain` | DomainRef | Business domain |
| `owner` | string | DRI / data owner |
| `source` | string | Source system name |
| `status` | keyword | `draft` \| `review` \| `approved` \| `deprecated` |
| `tags` | string[] | Tag list |

---

### 2. Column Definition

```sdl
ColumnName   DataType   [column-options]
```

**Column Options:**

| Option | Example | Description |
|--------|---------|-------------|
| `pk` | `[pk]` | Primary key |
| `unique` | `[unique]` | Unique constraint |
| `not null` | `[not null]` | NOT NULL constraint |
| `null` | `[null]` | Explicitly nullable |
| `default: <value>` | `[default: 0]` | Default value |
| `ref: > Table.Col` | `[ref: > Customer.ID]` | Foreign key reference |
| `pii: "<type>"` | `[pii: "email"]` | PII classification |
| `note: "<text>"` | `[note: "SSN. Encrypted."]` | Column documentation |
| `increment` | `[increment]` | Auto-increment (identity) column |

**Reference Direction:**

| Symbol | Meaning |
|--------|---------|
| `>` | Many-to-one (this column → target) |
| `<` | One-to-many (this table → target) |
| `-` | One-to-one |
| `<>` | Many-to-many |

---

### 3. Data Types

```sdl
// Numeric
int / integer / bigint / smallint / tinyint
decimal(precision, scale) / numeric(precision, scale)
float / real / double

// String
varchar(length) / nvarchar(length)
char(length) / nchar(length)
text / ntext / clob

// Date/Time
date / time / datetime / timestamp
timestamptz / timetz / interval

// Boolean
boolean / bool

// Binary
binary(length) / varbinary(length) / blob / bytea

// JSON / Array
json / jsonb
<type>[]              // Array: e.g., varchar(100)[]

// UUID / Special
uuid
xml
money

// User-defined (pass-through)
<any_identifier>      // Custom or DB-specific types
```

---

### 4. Index Definition

```sdl
indexes {
  (Column1, Column2)                    // Composite index
  (Column1, Column2) [pk]              // Composite primary key
  (Column1) [unique]                   // Unique index
  (Column1) [name: "idx_name"]         // Named index
  (Column1) [type: btree]              // Index type
  (Column1) [unique, name: "idx_email_unique"]
}
```

---

### 5. View Definition

```sdl
View <ViewName> [<view-options>] {
  <ColumnName>           // Column list (types optional)
  <ColumnName> varchar   // Optional type annotation
  
  Note: "<documentation>"
}
```

Views share the same options as tables. Column types are optional in views.

---

### 6. Domain Definition

```sdl
Domain <DomainName> {
  color: "<hex or hsl>"
  owner: "<owner name>"
  contact: "<email>"
  description: "<description>"
}
```

---

### 7. Relationship Shortcuts (Top-level)

For relationships that don't follow a simple FK pattern:

```sdl
Ref: Table1.Column1 > Table2.Column2     // Many-to-one
Ref: Table1.Column1 < Table2.Column2     // One-to-many  
Ref: Table1.Column1 - Table2.Column2     // One-to-one
Ref: Table1.Column1 <> Table2.Column2    // Many-to-many

// With documentation
Ref OrdersToCustomer: Orders.CustomerID > Customer.CustomerID {
  note: "An order belongs to exactly one customer. JOIN condition: Orders.CustomerID = Customer.CustomerID"
}
```

---

### 8. Comments

```sdl
// Single-line comment

/* 
   Multi-line comment
*/

Table Customer {
  CustomerID int [pk]  // Inline comment on column
}
```

---

### 9. Groups (Sheet Hints)

SDL can embed hints for which diagram sheet to include a table in:

```sdl
Group "Executive Overview" {
  Customer
  Orders
  Products
}

Group "Finance Domain" {
  GL_Accounts
  CostCenters
  Budgets
}
```

---

## PII Classification Values

```sdl
[pii: "none"]          // Default, no PII
[pii: "email"]         // Email address
[pii: "name"]          // Personal name
[pii: "phone"]         // Phone number
[pii: "ssn"]           // Social Security Number
[pii: "dob"]           // Date of birth
[pii: "address"]       // Physical address
[pii: "financial"]     // Financial account numbers
[pii: "health"]        // Health/medical information
[pii: "biometric"]     // Biometric data
[pii: "sensitive"]     // General sensitive (not PII specifically)
```

---

## Complete Real-World Example

```sdl
// ================================================
// Healthcare Data Warehouse Schema
// Domains: Clinical, Administrative, Finance
// ================================================

Domain Clinical {
  color: "#2f7de0"
  owner: "Clinical Informatics"
  description: "Patient care and clinical operations data"
}

Domain Administrative {
  color: "#e0a02f"
  owner: "Hospital Administration"
}

Domain Finance {
  color: "#2fe07d"
  owner: "Finance Department"
}

// ---- CLINICAL ----

Table Patient [domain: Clinical, status: approved, owner: "Clinical Informatics"] {
  PatientID         int           [pk]
  MRN               varchar(20)   [unique, not null, pii: "sensitive", note: "Medical Record Number"]
  FirstName         varchar(100)  [not null, pii: "name"]
  LastName          varchar(100)  [not null, pii: "name"]
  DateOfBirth       date          [not null, pii: "dob"]
  SSN               varchar(11)   [pii: "ssn"]
  Gender            varchar(10)
  BloodType         varchar(5)
  PrimaryPhysID     int           [ref: > Physician.PhysicianID]
  
  indexes {
    (LastName, FirstName) [name: "idx_patient_name"]
    (MRN) [unique]
  }
  
  Note: "Core patient master record. Source: Epic EHR. HIPAA applies to all PII columns."
}

Table Physician [domain: Clinical, status: approved] {
  PhysicianID       int           [pk]
  NPI               varchar(10)   [unique, not null, note: "National Provider Identifier"]
  FirstName         varchar(100)  [not null, pii: "name"]
  LastName          varchar(100)  [not null, pii: "name"]
  Specialty         varchar(100)
  DepartmentID      int           [ref: > Department.DepartmentID]
  LicenseNumber     varchar(50)   [pii: "sensitive"]
}

Table Encounter [domain: Clinical, status: review] {
  EncounterID       int           [pk]
  PatientID         int           [not null, ref: > Patient.PatientID]
  PhysicianID       int           [ref: > Physician.PhysicianID]
  DepartmentID      int           [ref: > Department.DepartmentID]
  AdmissionDate     datetime      [not null]
  DischargeDate     datetime
  DiagnosisCode     varchar(10)   [note: "ICD-10 code"]
  EncounterType     varchar(50)   [not null, note: "inpatient / outpatient / emergency"]
  
  Note: "Patient encounter/visit record. Basis for billing and clinical reporting."
}

// ---- ADMINISTRATIVE ----

Table Department [domain: Administrative, status: approved] {
  DepartmentID      int           [pk]
  DepartmentName    varchar(200)  [not null]
  DepartmentCode    varchar(20)   [unique, not null]
  LocationID        int           [ref: > Location.LocationID]
  DirectorID        int           [ref: > Physician.PhysicianID]
}

Table Location [domain: Administrative] {
  LocationID        int           [pk]
  BuildingName      varchar(200)
  Floor             varchar(10)
  Room              varchar(20)
}

// ---- FINANCE ----

Table Billing [domain: Finance, status: draft] {
  BillingID         int           [pk]
  EncounterID       int           [not null, ref: > Encounter.EncounterID]
  PatientID         int           [not null, ref: > Patient.PatientID]
  BillingDate       date          [not null]
  Amount            decimal(18,2) [not null]
  PaidAmount        decimal(18,2) [default: 0]
  InsuranceClaimID  varchar(50)
  Status            varchar(30)   [not null, default: "pending"]
  
  Note: "Billing records generated from patient encounters."
}

// ---- VIEWS ----

View vw_PatientEncounterSummary [domain: Clinical] {
  PatientID
  MRN
  PatientName
  TotalEncounters
  LastEncounterDate
  PrimaryPhysicianName
  
  Note: "Aggregated patient encounter summary for clinical dashboard."
}

// ---- GROUPS (Sheet Assignments) ----

Group "Executive Dashboard" {
  Patient
  Encounter
  Billing
  vw_PatientEncounterSummary
}

Group "Clinical Domain" {
  Patient
  Physician
  Encounter
  Department
}

Group "Finance Domain" {
  Billing
  Encounter
  Patient
}
```

---

## SDL Grammar (Formal BNF-like)

```bnf
Program         ::= Statement* EOF
Statement       ::= TableDef | ViewDef | DomainDef | RefDef | GroupDef | Comment

TableDef        ::= 'Table' Identifier Options? '{' TableBody '}'
ViewDef         ::= 'View' Identifier Options? '{' ViewBody '}'
DomainDef       ::= 'Domain' Identifier '{' DomainBody '}'
RefDef          ::= 'Ref' Identifier? ':' QualifiedCol Direction QualifiedCol ('{' RefBody '}')?
GroupDef        ::= 'Group' StringLit '{' Identifier* '}'

TableBody       ::= ColumnDef* IndexBlock? NoteField?
ViewBody        ::= ViewColumn* NoteField?
DomainBody      ::= (KeyValue)*

ColumnDef       ::= Identifier DataType ('[' ColumnOption (',' ColumnOption)* ']')? Comment?
ViewColumn      ::= Identifier DataType? Comment?

ColumnOption    ::= 'pk' | 'unique' | 'not null' | 'null'
                  | 'default:' Value
                  | 'ref:' Direction QualifiedCol
                  | 'pii:' StringLit
                  | 'note:' StringLit
                  | 'increment'

IndexBlock      ::= 'indexes' '{' IndexDef* '}'
IndexDef        ::= '(' Identifier (',' Identifier)* ')' ('[' IndexOption (',' IndexOption)* ']')?
IndexOption     ::= 'pk' | 'unique' | 'name:' StringLit | 'type:' Identifier

Options         ::= '[' Option (',' Option)* ']'
Option          ::= Identifier ':' Value

Direction       ::= '>' | '<' | '-' | '<>'
QualifiedCol    ::= Identifier '.' Identifier

DataType        ::= Identifier ('(' Number (',' Number)? ')')? '[]'?
Value           ::= StringLit | NumberLit | BoolLit | BacktickExpr | Identifier
StringLit       ::= '"' [^"]* '"' | "'" [^']* "'"
BacktickExpr    ::= '`' [^`]* '`'
NoteField       ::= 'Note:' StringLit

Identifier      ::= [a-zA-Z_] [a-zA-Z0-9_]*
Comment         ::= '//' [^\n]* | '/*' .* '*/'
```
