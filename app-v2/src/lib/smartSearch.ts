/**
 * Smart Search Utility
 *
 * Multi-keyword, synonym-aware search across all text fields.
 * Scores results by how many query tokens matched.
 * Ported from smart-search-prototype.html.
 */

import type { ViralAnalysis } from '@/types';

// ─── Synonym Groups ──────────────────────────────────────────────────────────
// Each group = words that mean the same thing for search purposes.
const SYNONYMS: string[][] = [
  ['boy', 'kid', 'son', 'child', 'children', 'lad', 'toddler', 'teen'],
  ['girl', 'daughter', 'kid', 'child', 'children', 'lass'],
  ['father', 'dad', 'papa', 'parent', 'daddy'],
  ['mother', 'mom', 'mama', 'parent', 'mum'],
  ['couple', 'husband', 'wife', 'pair', 'partner'],
  ['store', 'shop', 'mall', 'retail', 'market', 'supermarket'],
  ['night', 'evening', 'dark', 'nighttime'],
  ['morning', 'sunrise', 'dawn', 'early'],
  ['outdoor', 'outside', 'exterior', 'street', 'park'],
  ['indoor', 'inside', 'interior', 'home', 'studio'],
  ['gym', 'fitness', 'workout', 'exercise', 'training'],
  ['food', 'cooking', 'recipe', 'eat', 'meal', 'restaurant', 'cafe', 'coffee'],
  ['fashion', 'style', 'outfit', 'clothing', 'dress', 'clothes'],
  ['funny', 'comedy', 'humor', 'humour', 'laugh'],
  ['travel', 'trip', 'journey', 'explore', 'adventure'],
  ['silent', 'muted', 'no audio', 'no sound', 'without audio'],
  ['warm', 'cozy', 'golden', 'soft light', 'ambient'],
  ['person', 'people', 'man', 'woman', 'individual', 'crew'],
];

// Expand a single token into all synonyms from matching groups
function expandToken(token: string): string[] {
  const expanded = new Set<string>([token]);
  for (const group of SYNONYMS) {
    if (group.some((word) => word.includes(token) || token.includes(word))) {
      for (const word of group) expanded.add(word);
    }
  }
  return Array.from(expanded);
}

export interface SearchResult extends ViralAnalysis {
  /** 0–1: fraction of query tokens that matched */
  score: number;
  /** Field names where matches were found */
  matchedFields: string[];
  /** Actual text variants that matched (for highlighting) */
  matchedVariants: string[];
  /** Snippet of text from best matching field */
  snippet?: string;
}

/** Run smart search over an array of analyses. Returns scored, ranked results. */
export function smartSearch(query: string, analyses: ViralAnalysis[]): SearchResult[] {
  if (!query.trim()) {
    return analyses.map((a) => ({
      ...a,
      score: 1,
      matchedFields: [],
      matchedVariants: [],
    }));
  }

  const rawTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const expandedGroups = rawTokens.map((t) => ({
    original: t,
    variants: expandToken(t),
  }));

  return analyses
    .map((analysis) => {
      // Build a flat map of searchable field text
      const fields: Record<string, string> = {
        title: analysis.title || '',
        notes: analysis.production_notes || '',
        'why viral': analysis.why_viral || '',
        hook: analysis.hook || '',
        'script body': analysis.script_body || '',
        cta: analysis.script_cta || '',
        creator: analysis.creator_name || '',
        'shoot type': analysis.shoot_type || '',
        author: analysis.full_name || '',
        'content id': analysis.content_id || '',
        characters: (analysis.character_tags || []).map((t) => t.name).join(' '),
      };

      const matchedFieldSet = new Set<string>();
      const matchedTokenSet = new Set<string>(); // original query tokens
      const matchedVariantSet = new Set<string>(); // actual text found

      for (const { original, variants } of expandedGroups) {
        for (const [fieldName, fieldVal] of Object.entries(fields)) {
          const lowerField = fieldVal.toLowerCase();
          for (const variant of variants) {
            if (lowerField.includes(variant)) {
              matchedFieldSet.add(fieldName);
              matchedTokenSet.add(original);
              matchedVariantSet.add(variant);
            }
          }
        }
      }

      const score = matchedTokenSet.size / rawTokens.length;

      // Build snippet from best matching field
      let snippet: string | undefined;
      if (matchedFieldSet.size > 0) {
        const priority = ['notes', 'how to replicate', 'why viral', 'hook', 'script body'];
        const bestField =
          priority.find((f) => matchedFieldSet.has(f)) ||
          Array.from(matchedFieldSet)[0];
        const fieldText = fields[bestField] || '';
        if (fieldText) {
          const variants = Array.from(matchedVariantSet);
          const tokenIdx = variants.reduce((best, t) => {
            const idx = fieldText.toLowerCase().indexOf(t);
            return idx !== -1 && (best === -1 || idx < best) ? idx : best;
          }, -1);
          if (tokenIdx !== -1) {
            const start = Math.max(0, tokenIdx - 30);
            const end = Math.min(fieldText.length, tokenIdx + 100);
            snippet =
              (start > 0 ? '…' : '') +
              fieldText.slice(start, end) +
              (end < fieldText.length ? '…' : '');
          }
        }
      }

      return {
        ...analysis,
        score,
        matchedFields: Array.from(matchedFieldSet),
        matchedVariants: Array.from(matchedVariantSet),
        snippet,
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Wrap matched tokens in <mark> tags for display (returns safe HTML string) */
export function highlight(text: string, variants: string[]): string {
  if (!variants.length) return escHtml(text);
  let result = escHtml(text);
  for (const variant of variants) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(escaped, 'gi'),
      (m) => `<mark class="bg-yellow-200 text-yellow-900 rounded px-0.5">${m}</mark>`
    );
  }
  return result;
}

function escHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
