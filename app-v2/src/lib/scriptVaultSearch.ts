import type { SvSynonym } from '@/services/scriptVaultService';

export type SynonymMap = Map<string, Set<string>>;

/**
 * Build a bidirectional synonym map from DB rows.
 * canonical -> Set<synonym> AND synonym -> Set<canonical>
 */
export function buildSynonymMap(rows: SvSynonym[]): SynonymMap {
  const map: SynonymMap = new Map();

  for (const row of rows) {
    const canon = row.canonical.toLowerCase();
    const syn = row.synonym.toLowerCase();

    // canonical -> synonym
    if (!map.has(canon)) map.set(canon, new Set());
    map.get(canon)!.add(syn);

    // synonym -> canonical (reverse lookup)
    if (!map.has(syn)) map.set(syn, new Set());
    map.get(syn)!.add(canon);
  }

  return map;
}

// Common Hinglish suffixes to strip for compound detection
const SUFFIXES = ['wala', 'wali', 'wale', 'vala', 'vali', 'vale', 'vanu', 'valu'];

/**
 * Strip common suffixes: "autowala" -> "auto", "deliverywala" -> "delivery"
 */
export function stripSuffixes(word: string): string[] {
  const results: string[] = [];
  const lower = word.toLowerCase();

  for (const suffix of SUFFIXES) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 1) {
      results.push(lower.slice(0, -suffix.length));
    }
  }

  return results;
}

/**
 * Split compound words using known synonym keys.
 * "oldman" -> finds "old" in knownKeys -> ["old", "man"]
 */
export function splitCompounds(word: string, knownKeys: Set<string>): string[] {
  const lower = word.toLowerCase();
  const parts: string[] = [];

  for (const key of knownKeys) {
    if (key.length >= 2 && lower.includes(key) && lower !== key) {
      parts.push(key);
      const remainder = lower.replace(key, '');
      if (remainder.length >= 2) {
        parts.push(remainder);
      }
    }
  }

  return parts;
}

/**
 * Main expansion: take user query, return array of expanded terms for RPC.
 * Handles synonym lookup, compound splitting, and suffix stripping.
 */
export function expandQuery(query: string, synonymMap: SynonymMap): string[] {
  const terms = new Set<string>();
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const knownKeys = new Set(synonymMap.keys());

  for (const word of words) {
    // 1. Direct synonym lookup
    const synonyms = synonymMap.get(word);
    if (synonyms) {
      for (const s of synonyms) terms.add(s);
    }

    // 2. Suffix stripping: "autowala" -> "auto" -> expand "auto"
    const stripped = stripSuffixes(word);
    for (const base of stripped) {
      terms.add(base);
      const baseSynonyms = synonymMap.get(base);
      if (baseSynonyms) {
        for (const s of baseSynonyms) terms.add(s);
      }
    }

    // 3. Compound splitting: "oldman" -> "old" + "man"
    const compounds = splitCompounds(word, knownKeys);
    for (const part of compounds) {
      terms.add(part);
      const partSynonyms = synonymMap.get(part);
      if (partSynonyms) {
        for (const s of partSynonyms) terms.add(s);
      }
    }
  }

  // Remove original query words from expanded terms (they're sent separately as query_text)
  for (const word of words) {
    terms.delete(word);
  }

  return Array.from(terms);
}
