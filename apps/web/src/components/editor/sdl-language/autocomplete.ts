import { autocompletion, CompletionContext } from '@codemirror/autocomplete';

const keywords = ['Table', 'View', 'Enum', 'Ref', 'Domain', 'Component'];
const types = ['varchar', 'int', 'decimal', 'boolean', 'timestamp', 'date', 'json', 'text'];

export const sdlAutocomplete = () => autocompletion({
  override: [
    (context: CompletionContext) => {
      const word = context.matchBefore(/\w*/);
      if (!word || (word.from === word.to && !context.explicit)) return null;

      return {
        from: word.from,
        options: [
          ...keywords.map(k => ({ label: k, type: 'keyword' })),
          ...types.map(t => ({ label: t, type: 'type' }))
        ]
      };
    }
  ]
});
