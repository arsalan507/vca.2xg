import { useState, useEffect, useRef, useCallback } from 'react';
import { scriptVaultService, type SvScript, type SvScriptInput } from '@/services/scriptVaultService';
import { buildSynonymMap, expandQuery, type SynonymMap } from '@/lib/scriptVaultSearch';

// ─── Theme ───────────────────────────────────────────────────────────────────

const T = {
  bg: '#0A0A0B',
  surface: '#141416',
  surfaceHover: '#1C1C1F',
  border: '#262629',
  accent: '#F59E0B',
  accentDim: '#92610A',
  text: '#EEEEF0',
  textDim: '#7A7A80',
  danger: '#EF4444',
  success: '#22C55E',
  hook: '#F59E0B',
  story: '#818CF8',
  cta: '#34D399',
  shotDone: '#374151',
};

const QUICK_TAGS = ['judge', 'revenge', 'mechanic', 'delivery', 'kid', 'family', 'emi', 'warranty'];

type View = 'home' | 'add' | 'detail' | 'results';

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 18 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(value === star ? 0 : star)}
          disabled={!onChange}
          className="transition-transform hover:scale-110 disabled:cursor-default"
          style={{ color: star <= value ? T.accent : T.textDim, fontSize: size }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── Script Card ─────────────────────────────────────────────────────────────

function ScriptCard({ script, onClick, onToggleShot, showScore }: {
  script: SvScript;
  onClick: () => void;
  onToggleShot: (e: React.MouseEvent) => void;
  showScore?: boolean;
}) {
  const dimmed = script.shot_done;
  return (
    <div
      onClick={onClick}
      className="relative rounded-xl p-4 cursor-pointer transition-colors"
      style={{
        backgroundColor: T.surface,
        border: `1px solid ${T.border}`,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      {/* Shot toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleShot(e); }}
        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors"
        style={{
          backgroundColor: dimmed ? T.success : T.surfaceHover,
          color: dimmed ? '#fff' : T.textDim,
          border: `1px solid ${dimmed ? T.success : T.border}`,
        }}
        title={dimmed ? 'Mark as not shot' : 'Mark as shot'}
      >
        {dimmed ? '✓' : '🎬'}
      </button>

      {/* Title + score */}
      <div className="flex items-start gap-2 pr-10 mb-1">
        <h3 className="font-semibold text-[15px] leading-tight" style={{ color: T.text }}>
          {script.title}
        </h3>
        {showScore && script.relevance_score !== undefined && (
          <span
            className="shrink-0 text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: T.accentDim, color: T.accent, fontFamily: 'JetBrains Mono, monospace' }}
          >
            {Math.round(script.relevance_score)}pts
          </span>
        )}
      </div>

      {/* Rating */}
      <div className="mb-2">
        <StarRating value={script.rating} size={14} />
      </div>

      {/* Hook preview */}
      <p
        className="text-[13px] leading-relaxed mb-2"
        style={{
          color: T.textDim,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {script.hook}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {script.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: T.surfaceHover, color: T.textDim }}>
            {tag}
          </span>
        ))}
        {script.tags.length > 4 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: T.surfaceHover, color: T.textDim }}>
            +{script.tags.length - 4}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-medium z-50 animate-fade-in"
      style={{ backgroundColor: T.surface, color: T.accent, border: `1px solid ${T.border}` }}
    >
      {message}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function ScriptVaultApp() {
  const [view, setView] = useState<View>('home');
  const [scripts, setScripts] = useState<SvScript[]>([]);
  const [searchResults, setSearchResults] = useState<SvScript[]>([]);
  const [selectedScript, setSelectedScript] = useState<SvScript | null>(null);
  const [query, setQuery] = useState('');
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [editing, setEditing] = useState(false);
  const synonymMapRef = useRef<SynonymMap>(new Map());

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formHook, setFormHook] = useState('');
  const [formStory, setFormStory] = useState('');
  const [formCta, setFormCta] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formRating, setFormRating] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  // Load scripts + synonyms on mount
  useEffect(() => {
    (async () => {
      try {
        const [allScripts, synonyms] = await Promise.all([
          scriptVaultService.getAllScripts(),
          scriptVaultService.getSynonyms(),
        ]);
        setScripts(allScripts);
        synonymMapRef.current = buildSynonymMap(synonyms);
      } catch (err) {
        console.error('Failed to load:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshScripts = async () => {
    try {
      const allScripts = await scriptVaultService.getAllScripts();
      setScripts(allScripts);
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  // ─── Search ──────────────────────────────────────────────────

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setView('results');

    try {
      const expanded = expandQuery(q, synonymMapRef.current);
      setExpandedTerms(expanded);
      const results = await scriptVaultService.searchScripts(q.trim(), expanded);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  // ─── CRUD ────────────────────────────────────────────────────

  const handleAddScript = async () => {
    if (!formTitle.trim() || !formHook.trim()) return;

    const input: SvScriptInput = {
      title: formTitle.trim(),
      hook: formHook.trim(),
      story: formStory.trim(),
      cta: formCta.trim(),
      tags: formTags.trim().split(/\s+/).filter(Boolean),
      rating: formRating,
    };

    try {
      await scriptVaultService.addScript(input);
      showToast('Script added');
      resetForm();
      setView('home');
      refreshScripts();
    } catch (err) {
      console.error('Add failed:', err);
      showToast('Failed to add script');
    }
  };

  const handleToggleShot = async (script: SvScript) => {
    try {
      const updated = await scriptVaultService.toggleShotDone(script.id, script.shot_done);
      // Update in all lists
      const updater = (list: SvScript[]) => list.map((s) => (s.id === updated.id ? updated : s));
      setScripts(updater);
      setSearchResults(updater);
      if (selectedScript?.id === updated.id) setSelectedScript(updated);
      showToast(updated.shot_done ? 'Marked as shot' : 'Unmarked');
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleUpdateRating = async (id: string, rating: number) => {
    try {
      const updated = await scriptVaultService.updateRating(id, rating);
      const updater = (list: SvScript[]) => list.map((s) => (s.id === updated.id ? updated : s));
      setScripts(updater);
      setSearchResults(updater);
      if (selectedScript?.id === updated.id) setSelectedScript(updated);
    } catch (err) {
      console.error('Rating update failed:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this script?')) return;
    try {
      await scriptVaultService.deleteScript(id);
      showToast('Script deleted');
      setView('home');
      refreshScripts();
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Failed to delete');
    }
  };

  const startEditing = (script: SvScript) => {
    setFormTitle(script.title);
    setFormHook(script.hook);
    setFormStory(script.story);
    setFormCta(script.cta);
    setFormTags(script.tags.join(' '));
    setFormRating(script.rating);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedScript || !formTitle.trim() || !formHook.trim()) return;

    try {
      const updated = await scriptVaultService.updateScript(selectedScript.id, {
        title: formTitle.trim(),
        hook: formHook.trim(),
        story: formStory.trim(),
        cta: formCta.trim(),
        tags: formTags.trim().split(/\s+/).filter(Boolean),
        rating: formRating,
      });
      const updater = (list: SvScript[]) => list.map((s) => (s.id === updated.id ? updated : s));
      setScripts(updater);
      setSearchResults(updater);
      setSelectedScript(updated);
      setEditing(false);
      showToast('Script updated');
    } catch (err) {
      console.error('Update failed:', err);
      showToast('Failed to update');
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormHook('');
    setFormStory('');
    setFormCta('');
    setFormTags('');
    setFormRating(0);
  };

  const goDetail = (script: SvScript) => {
    setSelectedScript(script);
    setEditing(false);
    setView('detail');
  };

  const goBack = () => {
    if (view === 'detail' && editing) {
      setEditing(false);
      return;
    }
    if (view === 'detail' && searchResults.length > 0) {
      setView('results');
    } else {
      setView('home');
      setQuery('');
      setExpandedTerms([]);
      setSearchResults([]);
    }
  };

  // ─── Render ──────────────────────────────────────────────────

  const subtitle = view === 'home'
    ? `${scripts.length} scripts`
    : view === 'add'
      ? 'new script'
      : view === 'results'
        ? `${searchResults.length} results`
        : editing
          ? 'editing'
          : 'detail';

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* Inline styles for fonts + animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
        .sv-root { font-family: 'DM Sans', sans-serif; }
        .sv-root textarea, .sv-root input { font-family: 'DM Sans', sans-serif; }
        .sv-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes sv-spin { to { transform: rotate(360deg); } }
        .sv-spin { animation: sv-spin 1s linear infinite; }
        @keyframes sv-fade-in { from { opacity: 0; transform: translateY(8px) translateX(-50%); } to { opacity: 1; transform: translateY(0) translateX(-50%); } }
        .animate-fade-in { animation: sv-fade-in 0.2s ease-out; }
        .sv-root ::placeholder { color: #4A4A50; }
        .sv-root ::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="sv-root max-w-[480px] mx-auto relative pb-8">
        {/* ─── Header ─── */}
        <header
          className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
          style={{ backgroundColor: `${T.bg}E6`, backdropFilter: 'blur(12px)' }}
        >
          <div className="flex items-center gap-3">
            {view !== 'home' && (
              <button onClick={goBack} className="text-lg" style={{ color: T.textDim }}>
                ←
              </button>
            )}
            <div>
              <h1 className="sv-mono text-base font-medium tracking-wide" style={{ color: T.accent }}>
                SCRIPT VAULT
              </h1>
              <p className="text-[11px]" style={{ color: T.textDim }}>{subtitle}</p>
            </div>
          </div>
          {view === 'home' && (
            <button
              onClick={() => { resetForm(); setView('add'); }}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: T.accent, color: T.bg }}
            >
              + Add
            </button>
          )}
        </header>

        {/* ─── Loading ─── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="sv-spin text-2xl" style={{ color: T.accent }}>↻</div>
          </div>
        )}

        {/* ─── HOME ─── */}
        {!loading && view === 'home' && (
          <div className="px-4 space-y-4">
            {/* Search bar */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scripts..."
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{
                  backgroundColor: T.surface,
                  color: T.text,
                  border: `1px solid ${T.border}`,
                }}
                onFocus={(e) => (e.target.style.borderColor = T.accent)}
                onBlur={(e) => (e.target.style.borderColor = T.border)}
              />
              <button
                type="submit"
                className="px-4 rounded-xl text-sm font-medium"
                style={{ backgroundColor: T.accent, color: T.bg }}
              >
                🔍
              </button>
            </form>

            {/* Quick tags */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => { setQuery(tag); doSearch(tag); }}
                  className="text-[12px] px-3 py-1 rounded-full transition-colors"
                  style={{ backgroundColor: T.surfaceHover, color: T.textDim, border: `1px solid ${T.border}` }}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Script list */}
            <div className="space-y-3">
              {scripts.map((script) => (
                <ScriptCard
                  key={script.id}
                  script={script}
                  onClick={() => goDetail(script)}
                  onToggleShot={() => handleToggleShot(script)}
                />
              ))}
              {scripts.length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: T.textDim }}>
                  No scripts yet. Tap + Add to create one.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ─── ADD ─── */}
        {!loading && view === 'add' && (
          <div className="px-4 space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: T.textDim }}>Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. The Vegetable Bag"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>

            {/* Hook */}
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: T.hook }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.hook }} />
                Hook *
              </label>
              <textarea
                value={formHook}
                onChange={(e) => setFormHook(e.target.value)}
                placeholder="First 3 seconds. What STOPS the scroll?"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-y"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>

            {/* Story */}
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: T.story }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.story }} />
                Story / Body
              </label>
              <textarea
                value={formStory}
                onChange={(e) => setFormStory(e.target.value)}
                placeholder="The full narrative arc..."
                rows={5}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-y"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>

            {/* CTA */}
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: T.cta }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.cta }} />
                CTA
              </label>
              <textarea
                value={formCta}
                onChange={(e) => setFormCta(e.target.value)}
                placeholder="Call to action. The line that sticks."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-y"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: T.textDim }}>Tags (space-separated)</label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="elderly mechanic revenge emi judge"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>

            {/* Rating */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: T.textDim }}>Rating</label>
              <StarRating value={formRating} onChange={setFormRating} size={24} />
            </div>

            {/* Save button */}
            <button
              onClick={handleAddScript}
              disabled={!formTitle.trim() || !formHook.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ backgroundColor: T.accent, color: T.bg }}
            >
              Save Script
            </button>
          </div>
        )}

        {/* ─── RESULTS ─── */}
        {!loading && view === 'results' && (
          <div className="px-4 space-y-4">
            {/* Search bar (persistent) */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search scripts..."
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
              <button
                type="submit"
                className="px-4 rounded-xl text-sm font-medium"
                style={{ backgroundColor: T.accent, color: T.bg }}
              >
                🔍
              </button>
            </form>

            {/* Expanded terms */}
            {expandedTerms.length > 0 && (
              <div className="text-[11px]" style={{ color: T.textDim }}>
                <span className="font-medium" style={{ color: T.accent }}>Matched: </span>
                {expandedTerms.slice(0, 15).join(' · ')}
                {expandedTerms.length > 15 && ` +${expandedTerms.length - 15} more`}
              </div>
            )}

            {/* Loading */}
            {searching && (
              <div className="flex items-center justify-center gap-2 py-12">
                <span className="sv-spin text-lg" style={{ color: T.accent }}>↻</span>
                <span className="text-sm" style={{ color: T.textDim }}>Expanding search...</span>
              </div>
            )}

            {/* Results */}
            {!searching && (
              <div className="space-y-3">
                {searchResults.map((script) => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    onClick={() => goDetail(script)}
                    onToggleShot={() => handleToggleShot(script)}
                    showScore
                  />
                ))}
                {searchResults.length === 0 && (
                  <p className="text-center py-12 text-sm" style={{ color: T.textDim }}>
                    No scripts found for "{query}"
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── DETAIL (read mode) ─── */}
        {!loading && view === 'detail' && selectedScript && !editing && (
          <div className="px-4 space-y-5">
            {/* Title + rating + date */}
            <div>
              <h2 className="text-[22px] font-bold mb-1" style={{ color: T.text }}>
                {selectedScript.title}
              </h2>
              <StarRating
                value={selectedScript.rating}
                onChange={(v) => handleUpdateRating(selectedScript.id, v)}
                size={22}
              />
              <p className="text-[11px] mt-1" style={{ color: T.textDim }}>
                {new Date(selectedScript.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </div>

            {/* Action buttons row */}
            <div className="flex gap-2">
              <button
                onClick={() => handleToggleShot(selectedScript)}
                className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                style={{
                  backgroundColor: selectedScript.shot_done ? T.success : T.surface,
                  color: selectedScript.shot_done ? '#fff' : T.textDim,
                  border: `1px solid ${selectedScript.shot_done ? T.success : T.border}`,
                }}
              >
                {selectedScript.shot_done ? '✓ Shot Done' : '○ Mark as Shot'}
              </button>
              <button
                onClick={() => startEditing(selectedScript)}
                className="px-5 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ backgroundColor: T.accent, color: T.bg }}
              >
                Edit
              </button>
            </div>

            {/* Hook */}
            <div>
              <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.hook }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.hook }} />
                Hook
              </label>
              <div
                className="rounded-xl p-3 text-sm leading-relaxed"
                style={{
                  backgroundColor: T.surface,
                  borderLeft: `3px solid ${T.hook}`,
                  color: T.text,
                }}
              >
                {selectedScript.hook}
              </div>
            </div>

            {/* Story */}
            {selectedScript.story && (
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.story }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.story }} />
                  Story
                </label>
                <div
                  className="rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    backgroundColor: T.surface,
                    borderLeft: `3px solid ${T.story}`,
                    color: T.text,
                  }}
                >
                  {selectedScript.story}
                </div>
              </div>
            )}

            {/* CTA */}
            {selectedScript.cta && (
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.cta }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.cta }} />
                  CTA
                </label>
                <div
                  className="rounded-xl p-3 text-sm leading-relaxed font-semibold"
                  style={{
                    backgroundColor: T.surface,
                    borderLeft: `3px solid ${T.cta}`,
                    color: T.text,
                  }}
                >
                  {selectedScript.cta}
                </div>
              </div>
            )}

            {/* Tags */}
            {selectedScript.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedScript.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[12px] px-3 py-1 rounded-full"
                    style={{ backgroundColor: T.surfaceHover, color: T.textDim }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Delete */}
            <button
              onClick={() => handleDelete(selectedScript.id)}
              className="w-full py-3 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'transparent',
                color: T.danger,
                border: `1px solid ${T.danger}`,
              }}
            >
              Delete Script
            </button>
          </div>
        )}

        {/* ─── DETAIL (edit mode) ─── */}
        {!loading && view === 'detail' && selectedScript && editing && (
          <div className="px-4 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: T.textDim }}>Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: T.hook }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.hook }} />
                Hook *
              </label>
              <textarea
                value={formHook}
                onChange={(e) => setFormHook(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-y"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: T.story }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.story }} />
                Story / Body
              </label>
              <textarea
                value={formStory}
                onChange={(e) => setFormStory(e.target.value)}
                rows={5}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-y"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: T.cta }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.cta }} />
                CTA
              </label>
              <textarea
                value={formCta}
                onChange={(e) => setFormCta(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-y"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: T.textDim }}>Tags (space-separated)</label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: T.textDim }}>Rating</label>
              <StarRating value={formRating} onChange={setFormRating} size={24} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ backgroundColor: T.surface, color: T.textDim, border: `1px solid ${T.border}` }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!formTitle.trim() || !formHook.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: T.accent, color: T.bg }}
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        <Toast message={toast} visible={!!toast} />
      </div>
    </div>
  );
}
