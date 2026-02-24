# Phase 1 Build — What Was Created & Changed

## Overview
Phase 1 adds script content fields (Hook, Body, CTA), cast composition, character/actor tags, smart search, and per-project script cards with copy buttons across the production pipeline.

---

## 1. Database Migration
**File:** `supabase/migrations/20260224_phase1_script_fields.sql`

- Adds `script_body TEXT` column to `viral_analyses`
- Adds `script_cta TEXT` column to `viral_analyses`
- Inserts 8 BCH profile entries into `profile_list`:
  BCH Main, BCH Growth, BCH Stories, BCH Kannada, BCH Tamil, BCH Youth, BCH Finance, BCH Reels

**Run this migration on the production DB before deploying.**

---

## 2. Types (`app-v2/src/types/index.ts`)

Added to `ViralAnalysis`:
- `script_body?: string`
- `script_cta?: string`

Added to `AnalysisFormData`:
- `hookText?: string`
- `scriptBody?: string`
- `scriptCta?: string`
- `castComposition?: Partial<CastComposition>`
- `characterTagIds?: string[]`

Removed duplicate `characterTagIds` that existed lower in `AnalysisFormData`.

---

## 3. Analyses Service (`app-v2/src/services/analysesService.ts`)

In `createAnalysis()`:
- Saves `hook`, `script_body`, `script_cta` from form data
- Saves `cast_composition` (normalised with all keys + `total: 0`)
- After insert, saves character tag rows to `analysis_character_tags`

---

## 4. New Component: CastCompositionPicker (`app-v2/src/components/CastCompositionPicker.tsx`)

Controlled component for selecting cast composition (Man, Woman, Boy, Girl — increment/decrement steppers). Also has an "Include Owner" toggle. Shows a total people count badge when > 0.

Props:
- `value: Partial<CastComposition>` — current values
- `onChange: (value: Partial<CastComposition>) => void`

---

## 5. Updated Component: CharacterTagSelector (`app-v2/src/components/CharacterTagSelector.tsx`)

Changed `analysisId: string` → `analysisId?: string` (optional).

When `analysisId` is omitted (e.g. on the new-script form before analysis is created), the component operates in **local-only mode** — tag toggles update state immediately without hitting the DB. Tags are saved when the form is submitted via `createAnalysis`.

When `analysisId` is provided (e.g. on ReviewPage), it auto-saves to DB on every toggle.

Already supports `readOnly` mode (used in videographer ProjectDetailPage).

---

## 6. Smart Search Utility (`app-v2/src/lib/smartSearch.ts`)

Multi-keyword, synonym-aware search across all text fields of `ViralAnalysis`.

Key features:
- Splits query into tokens, expands each with synonyms
- SYNONYMS groups: boy/kid/son/child, father/dad, outdoor/street/park, gym/fitness/workout, silent/muted/no audio, food/cooking/restaurant, fashion/style/clothing, etc.
- Scores each result: `matchedTokens / totalTokens` (0–1)
- Searches across: title, notes, why_viral, how_to_replicate, hook, script_body, cta, creator, shoot_type, works_without_audio, author, content_id, character_tags
- Returns `SearchResult[]` sorted by score (highest first), filtered to score > 0
- Also exports `highlight(text, variants)` — wraps matched terms in `<mark>` tags

---

## 7. Writer New Script Page (`app-v2/src/pages/writer/NewScriptPage.tsx`)

Complete rewrite. New sections added:

- **Script section** (yellow dashed box): Hook textarea, Body/Script textarea, CTA textarea
- **Cast & Characters section**: CastCompositionPicker + CharacterTagSelector (local-only mode)
- On submit: passes `hookText`, `scriptBody`, `scriptCta`, `castComposition`, and `characterTagIds` to `createAnalysis`

---

## 8. Admin New Script Page (`app-v2/src/pages/admin/NewScriptPage.tsx`)

Same additions as writer version. Keeps auto-approve behaviour (sets status = APPROVED, production_stage = PLANNING immediately on create).

---

## 9. Admin Pending Page (`app-v2/src/pages/admin/PendingPage.tsx`)

Added smart search bar above the platform filter tabs:
- Input with clear (X) button
- Hint text: "💡 Try: 'father son night' · 'outdoor cafe' · 'no audio'"
- Shows result count when a query is active
- Filtering pipeline: platform tab filter → smart search (score > 0, sorted by relevance)

---

## 10. Videographer Available Page (`app-v2/src/pages/videographer/AvailablePage.tsx`)

Added:
- Smart search input with hint text
- Character filter chips row — tap a character to filter, tap again to remove; "Clear all" button
- Cast count badge on project cards (e.g. "👥 3")
- Character tag pills on project cards (coloured by name hash)

Filtering pipeline: tab filter → character filter (any overlap) → smart search

Also loads all character tags in parallel with projects via `Promise.all`.

---

## 11. Videographer Service (`app-v2/src/services/videographerService.ts`)

Both `getAvailableProjects` and `getProjectById` select queries updated to include the character tags join:
```
character_tags:analysis_character_tags(character_tag:character_tags(id, name, is_active))
```
Mapped results unwrap the nested join:
```ts
character_tags: (project.character_tags || []).map((ct: any) => ct.character_tag).filter(Boolean)
```

---

## 12. Videographer Project Detail Page (`app-v2/src/pages/videographer/ProjectDetailPage.tsx`)

**Script tab completely replaced.** New layout:

| Card | Background | Content |
|------|-----------|---------|
| 🎣 Hook | `bg-amber-50 border-amber-200` | `project.hook` + Copy button |
| 📝 Body/Script | `bg-green-50 border-green-200` | `project.script_body` + Copy button |
| 📣 CTA | `bg-red-50 border-red-200` | `project.script_cta` + Copy button |
| 📌 Notes for Team | `bg-blue-50 border-blue-200` | `project.production_notes` + Copy button |

Copy buttons use `navigator.clipboard.writeText()` with a toast confirmation.

Below the cards:
- **Characters / Actors** — `CharacterTagSelector` in `readOnly` mode (shows coloured pills)
- **Voice Notes** — shown only if any voice note URLs exist (hook/why viral/how to replicate)

Empty state shown if none of the 4 card fields have content.

---

## 13. Admin Review Page (`app-v2/src/pages/admin/ReviewPage.tsx`)

Script preview section updated to show Hook/Body/CTA cards (same colour scheme as videographer view) between "How to Replicate" and the Character Tags selector. Each card has a Copy button.

---

## How Fields Flow Through the System

```
Writer/Admin submits script
  → hook, script_body, script_cta, cast_composition saved to viral_analyses
  → character_tag_ids saved to analysis_character_tags

Admin reviews
  → sees Hook / Body / CTA cards with copy buttons
  → can edit character tags (auto-saved)
  → approves → project moves to PLANNING → assigned to videographer

Videographer opens project
  → Script tab shows Hook / Body / CTA / Notes cards with copy buttons
  → Characters shown as coloured pills (read-only)

Available page (videographer)
  → Smart search across all script fields
  → Filter by character/actor
  → Cast count + character pills shown on each card
```

---

## Deployment Checklist

1. Run DB migration: `supabase/migrations/20260224_phase1_script_fields.sql`
2. Build and push: `cd app-v2 && npm run build`
3. Push to both remotes: `git push-both`
4. Verify Coolify deploys from `personal` remote
