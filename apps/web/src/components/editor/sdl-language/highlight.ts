import { styleTags, tags as t } from '@lezer/highlight';

export const sdlHighlighting = styleTags({
  'Table View Enum Ref Domain Component': t.keyword,
  'String': t.string,
  'LineComment': t.lineComment,
  'BlockComment': t.blockComment,
  'Boolean': t.bool,
  'Number': t.number,
  'TypeName': t.typeName,
  'PropertyName': t.propertyName,
  'Identifier': t.variableName,
  '[ ] { } ( ) < >': t.punctuation
});
