{
  function extractList(list, index) {
    return list.map(function(item) { return item[index]; });
  }
}

Program
  = _ statements:Statement* _ {
      return {
        type: "Program",
        statements: statements.filter(s => s !== null),
        location: location()
      };
    }

Statement
  = TableDef
  / ViewDef
  / DomainDef
  / RefDef
  / GroupDef
  / Comment { return null; }

TableDef
  = "Table" __ name:Identifier _ options:Options? _ "{" _ body:TableBody _ "}" _ {
      return {
        type: "Table",
        name: name,
        options: options || [],
        columns: body.columns,
        indexes: body.indexes,
        note: body.note,
        location: location()
      };
    }

TableBody
  = columns:ColumnDef* indexes:IndexBlock? note:NoteField? {
      return {
        columns: columns.filter(c => c !== null),
        indexes: indexes || null,
        note: note || null
      };
    }

ColumnDef
  = Comment { return null; }
  / !("indexes" _ "{") !("Note:" _ ) name:Identifier __ type:DataType? _ options:Options? _ note:NoteField? _ Comment? _ {
      return {
        type: "Column",
        name: name,
        dataType: type || null,
        options: options || [],
        note: note || null,
        location: location()
      };
    }

DataType
  = id:Identifier size:("(" _ TypeParam _ ("," _ TypeParam _)? ")")? array:"[]"? {
      let result = id;
      if (size) {
        result += "(" + size[2];
        if (size[4]) {
          result += "," + size[4][2];
        }
        result += ")";
      }
      if (array) {
        result += "[]";
      }
      return result;
    }

TypeParam
  = [0-9]+ { return parseInt(text(), 10); }
  / "max"i { return "max"; }
  / Identifier

Options
  = "[" _ head:Option tail:(_ "," _ Option)* _ "]" {
      return [head].concat(tail.map(t => t[3]));
    }

Option
  = "pk" { return { type: "Option", key: "pk", value: true }; }
  / "unique" { return { type: "Option", key: "unique", value: true }; }
  / "not null" { return { type: "Option", key: "not_null", value: true }; }
  / "null" { return { type: "Option", key: "not_null", value: false }; }
  / "increment" { return { type: "Option", key: "increment", value: true }; }
  / key:("default" / "ref" / "pii" / "note" / "name" / "type" / "domain" / "owner" / "source" / "status" / "tags" / "color" / "contact" / "description") _ ":" _ value:Value {
      return { type: "Option", key: key, value: value };
    }

Value
  = StringLit
  / BoolLit
  / BacktickExpr
  / DirectionQualifiedCol
  / ArrayLit
  / NumberLit
  / Identifier

ArrayLit
  = "[" _ head:Value tail:(_ "," _ Value)* _ "]" {
      return [head].concat(tail.map(t => t[3]));
    }

DirectionQualifiedCol
  = dir:Direction _ qc:QualifiedCol {
      return { direction: dir, target: qc };
    }

Direction
  = ">" / "<>" / "<" / "-"

QualifiedCol
  = table:Identifier "." col:Identifier {
      return { table: table, column: col };
    }

IndexBlock
  = "indexes" _ "{" _ indexes:IndexDef* _ "}" {
      return {
        type: "IndexBlock",
        indexes: indexes.filter(i => i !== null),
        location: location()
      };
    }

IndexDef
  = Comment { return null; }
  / "(" _ head:Identifier tail:(_ "," _ Identifier)* _ ")" _ options:Options? _ Comment? _ {
      return {
        type: "IndexDef",
        columns: [head].concat(tail.map(t => t[3])),
        options: options || [],
        location: location()
      };
    }

NoteField
  = "Note:" _ str:StringLit { return str; }

StringLit
  = '"' chars:[^"]* '"' { return chars.join(""); }
  / "'" chars:[^']* "'" { return chars.join(""); }

BacktickExpr
  = "`" chars:[^`]* "`" { return "`" + chars.join("") + "`"; }

BoolLit
  = "true" { return true; }
  / "false" { return false; }

NumberLit
  = "-"? [0-9]+ ("." [0-9]+)? { return parseFloat(text()); }

Integer
  = [0-9]+ { return parseInt(text(), 10); }

Identifier
  = [a-zA-Z_] [a-zA-Z0-9_]* { return text(); }

ViewDef
  = "View" __ name:Identifier _ options:Options? _ "{" _ body:ViewBody _ "}" _ {
      return {
        type: "View",
        name: name,
        options: options || [],
        columns: body.columns,
        note: body.note,
        location: location()
      };
    }

ViewBody
  = columns:ViewColumn* note:NoteField? {
      return {
        columns: columns.filter(c => c !== null),
        note: note || null
      };
    }

ViewColumn
  = Comment { return null; }
  / name:Identifier __ type:DataType? _ note:NoteField? _ Comment? _ {
      return {
        type: "ViewColumn",
        name: name,
        dataType: type || null,
        note: note || null,
        location: location()
      };
    }

DomainDef
  = "Domain" __ name:Identifier _ "{" _ body:DomainBody _ "}" _ {
      return {
        type: "Domain",
        name: name,
        properties: body,
        location: location()
      };
    }

DomainBody
  = props:OptionLine* { return props.filter(p => p !== null); }

OptionLine
  = Comment { return null; }
  / opt:Option _ Comment? _ { return opt; }

RefDef
  = "Ref" name:Identifier? ":" _ source:QualifiedCol _ dir:Direction _ target:QualifiedCol _ options:Options? _ note:NoteField? _ {
      return {
        type: "Ref",
        name: name || null,
        sourceTable: source.table,
        sourceColumn: source.column,
        direction: dir,
        targetTable: target.table,
        targetColumn: target.column,
        options: options || [],
        note: note || null,
        location: location()
      };
    }

GroupDef
  = "Group" __ name:StringLit _ "{" _ entities:Identifier* _ "}" _ {
      return {
        type: "Group",
        name: name,
        entities: entities,
        location: location()
      };
    }

Comment
  = "//" [^\n]* "\n"?
  / "/*" (!"*/" .)* "*/"

_ "whitespace"
  = ([ \t\n\r] / Comment)*

__ "mandatory whitespace"
  = ([ \t\n\r] / Comment)+
