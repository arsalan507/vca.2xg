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
  textDim: '#9A9AA2',
  textMuted: '#75757E',
  danger: '#EF4444',
  success: '#22C55E',
  hook: '#F59E0B',
  story: '#818CF8',
  cta: '#34D399',
  shotDone: '#374151',
};

const QUICK_TAGS = ['judge', 'revenge', 'mechanic', 'delivery', 'kid', 'family', 'emi', 'warranty'];

type View = 'home' | 'add' | 'detail' | 'results' | 'bin';

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 18 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(value === star ? 0 : star)}
          disabled={!onChange}
          className="transition-transform hover:scale-110 disabled:cursor-default"
          style={{ color: star <= value ? T.accent : T.textDim, fontSize: size, lineHeight: 1 }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── Swipeable Script Card ──────────────────────────────────────────────────
// Gesture #2: Swipe left to reveal actions
// Gesture #4: Long press for quick preview

function ScriptCard({ script, onClick, onToggleShot, onDelete, onLongPress, showScore }: {
  script: SvScript;
  onClick: () => void;
  onToggleShot?: () => void;
  onDelete?: () => void;
  onLongPress?: () => void;
  showScore?: boolean;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [moving, setMoving] = useState(false);
  const touchRef = useRef({ startX: 0, startY: 0, didSwipe: false, swiping: false });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealed = offsetX < -50;
  const done = script.shot_done;

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { startX: t.clientX, startY: t.clientY, didSwipe: false, swiping: false };
    setMoving(true);

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      if (!touchRef.current.didSwipe) {
        onLongPress?.();
        if (navigator.vibrate) navigator.vibrate(25);
      }
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.startX;
    const dy = Math.abs(t.clientY - touchRef.current.startY);

    // Cancel long press on any movement
    if (Math.abs(dx) > 8 || dy > 8) {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    }

    // If mostly vertical, don't swipe card
    if (dy > 30 && !touchRef.current.swiping) { setMoving(false); return; }

    if (Math.abs(dx) > 10) {
      touchRef.current.didSwipe = true;
      touchRef.current.swiping = true;
    }

    if (touchRef.current.swiping) {
      // Swipe left to reveal, swipe right to close
      const base = revealed ? -100 : 0;
      const next = base + dx;
      setOffsetX(Math.max(Math.min(next, 0), -110));
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    setMoving(false);

    // Snap: reveal if past halfway, otherwise close
    if (offsetX < -50) setOffsetX(-100);
    else setOffsetX(0);
  };

  const handleClick = () => {
    if (touchRef.current.didSwipe) return;
    if (revealed) { setOffsetX(0); return; }
    onClick();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action buttons behind the card */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-stretch"
        style={{ width: 100, opacity: Math.min(Math.abs(offsetX) / 60, 1) }}
      >
        <button
          onClick={() => { onToggleShot?.(); setOffsetX(0); }}
          className="flex-1 flex items-center justify-center"
          style={{ backgroundColor: done ? T.textDim : T.success }}
        >
          <span className="text-white text-xs font-semibold">{done ? 'Undo' : 'Shot'}</span>
        </button>
        <button
          onClick={() => { onDelete?.(); setOffsetX(0); }}
          className="flex-1 flex items-center justify-center"
          style={{ backgroundColor: T.danger }}
        >
          <span className="text-white text-xs font-semibold">Del</span>
        </button>
      </div>

      {/* Main card content — slides left */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className="relative z-10 w-full text-left rounded-2xl px-4 py-3.5"
        style={{
          backgroundColor: T.surface,
          borderLeft: !done && script.rating >= 4 ? `3px solid ${script.rating === 5 ? T.accent : T.accentDim}` : '3px solid transparent',
          opacity: done ? 0.5 : 1,
          transform: `translateX(${offsetX}px)`,
          transition: moving ? 'none' : 'transform 0.25s ease-out',
        }}
      >
        {/* Row 1: title + rating */}
        <div className="flex items-center gap-2 mb-1">
          {done && (
            <span className="text-xs shrink-0" style={{ color: T.success }}>✓</span>
          )}
          <span className="font-semibold text-[16px] truncate flex-1" style={{ color: T.text }}>
            {script.title}
          </span>
          {showScore && script.relevance_score !== undefined && (
            <span
              className="sv-mono shrink-0 text-[11px] px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: T.accentDim, color: T.accent }}
            >
              {Math.round(script.relevance_score)}
            </span>
          )}
          <span className="shrink-0"><StarRating value={script.rating} size={14} /></span>
        </div>

        {/* Row 2: hook preview */}
        <p className="text-[14px] leading-snug mb-1.5 truncate" style={{ color: T.textDim }}>
          {script.hook}
        </p>

        {/* Row 3: tags */}
        <p className="text-[12px] truncate" style={{ color: T.textMuted }}>
          {script.tags.slice(0, 5).join(' · ')}
          {script.tags.length > 5 ? ` +${script.tags.length - 5}` : ''}
        </p>
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-sm font-semibold z-50 sv-fade-in shadow-lg"
      style={{ backgroundColor: T.accent, color: T.bg, bottom: 96 }}
    >
      {message}
    </div>
  );
}

// ─── Undo Toast ──────────────────────────────────────────────────────────────

function UndoToast({ message, visible, onUndo }: { message: string; visible: boolean; onUndo: () => void }) {
  if (!visible) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full text-sm font-medium z-50 sv-fade-in flex items-center gap-3 shadow-lg"
      style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}`, minWidth: 220, bottom: 96 }}
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={onUndo}
        className="font-bold text-xs tracking-wide shrink-0 active:scale-95"
        style={{ color: T.accent }}
      >
        UNDO
      </button>
    </div>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────────────────────────

function ConfirmDialog({ title, body, actionLabel, destructive, onConfirm, onCancel }: {
  title: string;
  body: string;
  actionLabel: string;
  destructive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center sv-fade-in"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onCancel}
    >
      <div
        className="mx-6 max-w-[340px] w-full rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold" style={{ color: T.text }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: T.textDim }}>{body}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl text-sm font-medium active:scale-[0.98]"
            style={{ height: 44, backgroundColor: T.bg, color: T.textDim, border: `1px solid ${T.border}` }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl text-sm font-semibold active:scale-[0.98]"
            style={{ height: 44, backgroundColor: destructive ? T.danger : T.accent, color: destructive ? '#fff' : T.bg }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bin Script Card ────────────────────────────────────────────────────────

function BinScriptCard({ script, selected, selectionMode, onTap, onLongPress }: {
  script: SvScript;
  selected: boolean;
  selectionMode: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  const daysAgo = Math.floor((Date.now() - new Date(script.deleted_at!).getTime()) / 86400000);
  const timeLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`;

  const startLongPress = () => {
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) {
        onLongPress();
        if (navigator.vibrate) navigator.vibrate(25);
      }
    }, 450);
  };

  const cancelLongPress = () => {
    touchMoved.current = true;
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const endLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  return (
    <div
      className="relative rounded-2xl px-4 py-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform select-none"
      style={{ backgroundColor: T.surface }}
      onClick={() => { if (!touchMoved.current) onTap(); }}
      onTouchStart={startLongPress}
      onTouchMove={cancelLongPress}
      onTouchEnd={endLongPress}
      onMouseDown={startLongPress}
      onMouseMove={(e) => { if (e.buttons > 0) cancelLongPress(); }}
      onMouseUp={endLongPress}
      onMouseLeave={endLongPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Checkbox — always in DOM for layout, visible in selection mode */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full border-2 transition-colors"
        style={{
          width: selectionMode ? 22 : 0,
          height: 22,
          borderColor: selected ? T.accent : T.border,
          backgroundColor: selected ? T.accent : 'transparent',
          opacity: selectionMode ? 1 : 0,
          marginRight: selectionMode ? 0 : -12,
          transition: 'all 0.2s ease-out',
          overflow: 'hidden',
        }}
      >
        {selected && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={T.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6L5 8.5L9.5 3.5" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {/* Row 1: title + time label */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-[16px] truncate flex-1" style={{ color: T.text }}>
            {script.title}
          </span>
          <span className="text-[11px] shrink-0 px-1.5 py-0.5 rounded-md" style={{ backgroundColor: T.bg, color: T.textDim }}>
            {timeLabel}
          </span>
        </div>

        {/* Row 2: hook preview */}
        <p className="text-[14px] leading-snug mb-1.5 truncate" style={{ color: T.textDim }}>
          {script.hook}
        </p>

        {/* Row 3: tags */}
        <p className="text-[12px] truncate" style={{ color: T.textMuted }}>
          {script.tags.slice(0, 5).join(' . ')}
          {script.tags.length > 5 ? ` +${script.tags.length - 5}` : ''}
        </p>
      </div>
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
  const [saving, setSaving] = useState(false);
  const synonymMapRef = useRef<SynonymMap>(new Map());

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formHook, setFormHook] = useState('');
  const [formStory, setFormStory] = useState('');
  const [formCta, setFormCta] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formRating, setFormRating] = useState(0);

  // ─── Gesture state ──────────────────────────────────────────

  // #1: Swipe back from left edge
  const [swipeBackProgress, setSwipeBackProgress] = useState(0);
  const swipeBackRef = useRef({ startX: 0, startY: 0, active: false, progress: 0 });

  // #3: Pull to refresh
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef({ startY: 0, active: false, pulling: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  // #4: Long press preview
  const [previewScript, setPreviewScript] = useState<SvScript | null>(null);

  // #5: Swipe down to dismiss detail
  const [detailDismissY, setDetailDismissY] = useState(0);
  const detailSwipeRef = useRef({ startY: 0, active: false, moving: false });

  // ─── Bin state ────────────────────────────────────────────
  const [binScripts, setBinScripts] = useState<SvScript[]>([]);
  const [binLoading, setBinLoading] = useState(false);
  const [binSelectionMode, setBinSelectionMode] = useState(false);
  const [selectedBinIds, setSelectedBinIds] = useState<Set<string>>(new Set());
  const [binMenuOpen, setBinMenuOpen] = useState(false);
  const [binCount, setBinCount] = useState<number | null>(null);
  const [undoToast, setUndoToast] = useState<{ message: string; scriptId: string; visible: boolean }>({ message: '', scriptId: '', visible: false });
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; body: string; actionLabel: string; destructive: boolean; onConfirm: () => void } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  // ─── Gesture #1: Swipe back from left edge ─────────────────

  const goBackRef = useRef(() => {});

  useEffect(() => {
    const canSwipeBack = view !== 'home';
    if (!canSwipeBack) { setSwipeBackProgress(0); return; }

    const onStart = (e: TouchEvent) => {
      if (e.touches[0].clientX < 25) {
        swipeBackRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, active: true, progress: 0 };
      }
    };
    const onMove = (e: TouchEvent) => {
      const s = swipeBackRef.current;
      if (!s.active) return;
      const dx = e.touches[0].clientX - s.startX;
      const dy = Math.abs(e.touches[0].clientY - s.startY);
      if (dy > 60) { s.active = false; setSwipeBackProgress(0); return; }
      const p = Math.min(Math.max(dx / 100, 0), 1);
      s.progress = p;
      setSwipeBackProgress(p);
    };
    const onEnd = () => {
      if (swipeBackRef.current.active && swipeBackRef.current.progress > 0.6) {
        goBackRef.current();
      }
      swipeBackRef.current.active = false;
      setSwipeBackProgress(0);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [view]);

  // ─── PWA manifest swap ─────────────────────────────────────

  useEffect(() => {
    const existingManifest = document.querySelector('link[rel="manifest"]');
    const svManifest = document.createElement('link');
    svManifest.rel = 'manifest';
    svManifest.href = '/sv-manifest.json';
    if (existingManifest) existingManifest.replaceWith(svManifest);
    else document.head.appendChild(svManifest);

    let themeTag = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const prevThemeColor = themeTag?.content || '#3b82f6';
    if (themeTag) themeTag.content = '#0A0A0B';
    else {
      themeTag = document.createElement('meta');
      themeTag.name = 'theme-color';
      themeTag.content = '#0A0A0B';
      document.head.appendChild(themeTag);
    }

    const prevTitle = document.title;
    document.title = 'Script Vault';

    return () => {
      const current = document.querySelector('link[rel="manifest"]');
      const vcaManifest = document.createElement('link');
      vcaManifest.rel = 'manifest';
      vcaManifest.href = '/manifest.webmanifest';
      if (current) current.replaceWith(vcaManifest);
      const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (meta) meta.content = prevThemeColor;
      document.title = prevTitle;
    };
  }, []);

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

  useEffect(() => {
    if (!query.trim()) {
      if (view === 'results') {
        setView('home');
        setSearchResults([]);
        setExpandedTerms([]);
      }
      return;
    }
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  // ─── CRUD ────────────────────────────────────────────────────

  const handleAddScript = async () => {
    if (!formTitle.trim() || !formHook.trim() || saving) return;
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShot = async (script: SvScript) => {
    try {
      const updated = await scriptVaultService.toggleShotDone(script.id, script.shot_done);
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

  const handleDelete = (id: string) => {
    handleSoftDelete(id);
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
    if (!selectedScript || !formTitle.trim() || !formHook.trim() || saving) return;
    setSaving(true);
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
    } finally {
      setSaving(false);
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

  // ─── Bin handlers ───────────────────────────────────────────

  const loadBinScripts = async () => {
    setBinLoading(true);
    try {
      const deleted = await scriptVaultService.getDeletedScripts();
      // Auto-cleanup items older than 30 days
      const cutoff = Date.now() - 30 * 86400000;
      const expired = deleted.filter((s) => new Date(s.deleted_at!).getTime() < cutoff);
      const kept = deleted.filter((s) => new Date(s.deleted_at!).getTime() >= cutoff);
      if (expired.length > 0) {
        await scriptVaultService.permanentlyDeleteMultiple(expired.map((s) => s.id));
      }
      setBinScripts(kept);
      setBinCount(kept.length);
    } catch (err) {
      console.error('Failed to load bin:', err);
    } finally {
      setBinLoading(false);
    }
  };

  const openBin = () => {
    setBinSelectionMode(false);
    setSelectedBinIds(new Set());
    setBinMenuOpen(false);
    setView('bin');
    loadBinScripts();
  };

  const handleSoftDelete = async (id: string) => {
    try {
      await scriptVaultService.deleteScript(id);
      setScripts((prev) => prev.filter((s) => s.id !== id));
      setSearchResults((prev) => prev.filter((s) => s.id !== id));
      if (view === 'detail') setView('home');
      setBinCount((prev) => (prev ?? 0) + 1);

      // Clear any existing undo timer
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);

      setUndoToast({ message: 'Moved to Bin', scriptId: id, visible: true });
      undoTimerRef.current = setTimeout(() => {
        setUndoToast((prev) => ({ ...prev, visible: false }));
      }, 5000);
    } catch (err) {
      console.error('Soft delete failed:', err);
      showToast('Failed to delete');
    }
  };

  const handleUndoDelete = async () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast((prev) => ({ ...prev, visible: false }));
    try {
      await scriptVaultService.restoreScript(undoToast.scriptId);
      setBinCount((prev) => prev !== null && prev > 0 ? prev - 1 : prev);
      await refreshScripts();
    } catch (err) {
      console.error('Undo failed:', err);
      showToast('Failed to undo');
    }
  };

  const handleBinRestore = async (ids: string[]) => {
    try {
      await scriptVaultService.restoreMultiple(ids);
      setBinScripts((prev) => prev.filter((s) => !ids.includes(s.id)));
      setSelectedBinIds(new Set());
      setBinSelectionMode(false);
      setBinCount((prev) => prev !== null ? Math.max(0, prev - ids.length) : null);
      showToast(`Restored ${ids.length === 1 ? 'script' : ids.length + ' scripts'}`);
      refreshScripts();
    } catch (err) {
      console.error('Restore failed:', err);
      showToast('Failed to restore');
    }
  };

  const handleBinPermanentDelete = (ids: string[]) => {
    setConfirmDialog({
      title: 'Delete forever?',
      body: `${ids.length === 1 ? 'This script' : `These ${ids.length} scripts`} will be permanently deleted. This cannot be undone.`,
      actionLabel: 'Delete Forever',
      destructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await scriptVaultService.permanentlyDeleteMultiple(ids);
          setBinScripts((prev) => prev.filter((s) => !ids.includes(s.id)));
          setSelectedBinIds(new Set());
          setBinSelectionMode(false);
          setBinCount((prev) => prev !== null ? Math.max(0, prev - ids.length) : null);
          showToast('Deleted forever');
        } catch (err) {
          console.error('Permanent delete failed:', err);
          showToast('Failed to delete');
        }
      },
    });
  };

  const handleEmptyBin = () => {
    setConfirmDialog({
      title: 'Empty Bin?',
      body: `All ${binScripts.length} script${binScripts.length !== 1 ? 's' : ''} will be permanently deleted. This cannot be undone.`,
      actionLabel: 'Empty Bin',
      destructive: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setBinMenuOpen(false);
        try {
          await scriptVaultService.emptyBin();
          setBinScripts([]);
          setSelectedBinIds(new Set());
          setBinSelectionMode(false);
          setBinCount(0);
          showToast('Bin emptied');
        } catch (err) {
          console.error('Empty bin failed:', err);
          showToast('Failed to empty bin');
        }
      },
    });
  };

  const handleRestoreAll = () => {
    setBinMenuOpen(false);
    setConfirmDialog({
      title: 'Restore all?',
      body: `All ${binScripts.length} script${binScripts.length !== 1 ? 's' : ''} will be restored to your vault.`,
      actionLabel: 'Restore All',
      destructive: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await scriptVaultService.restoreMultiple(binScripts.map((s) => s.id));
          setBinScripts([]);
          setSelectedBinIds(new Set());
          setBinSelectionMode(false);
          setBinCount(0);
          showToast('All scripts restored');
          refreshScripts();
        } catch (err) {
          console.error('Restore all failed:', err);
          showToast('Failed to restore');
        }
      },
    });
  };

  const toggleBinSelect = (id: string) => {
    setSelectedBinIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllBin = () => {
    if (selectedBinIds.size === binScripts.length) {
      setSelectedBinIds(new Set());
    } else {
      setSelectedBinIds(new Set(binScripts.map((s) => s.id)));
    }
  };

  const enterBinSelectionMode = (id: string) => {
    setBinSelectionMode(true);
    setSelectedBinIds(new Set([id]));
  };

  const goDetail = (script: SvScript) => {
    setSelectedScript(script);
    setEditing(false);
    setView('detail');
  };

  const goBack = useCallback(() => {
    if (view === 'detail' && editing) {
      setEditing(false);
      return;
    }
    if (view === 'bin') {
      setBinSelectionMode(false);
      setSelectedBinIds(new Set());
      setBinMenuOpen(false);
      setView('home');
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
  }, [view, editing, searchResults.length]);

  // Keep goBackRef in sync for gesture #1
  goBackRef.current = goBack;

  // ─── Gesture #3: Pull to refresh ──────────────────────────

  const handleScrollTouchStart = (e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (el && el.scrollTop <= 0 && (view === 'home' || view === 'results' || view === 'bin')) {
      pullRef.current = { startY: e.touches[0].clientY, active: true, pulling: false };
    }
    // Gesture #5: Swipe down to dismiss detail
    if (view === 'detail' && !editing && el && el.scrollTop <= 0) {
      detailSwipeRef.current = { startY: e.touches[0].clientY, active: true, moving: false };
    }
  };

  const handleScrollTouchMove = (e: React.TouchEvent) => {
    // Pull to refresh
    const p = pullRef.current;
    if (p.active && (view === 'home' || view === 'results' || view === 'bin')) {
      const dy = e.touches[0].clientY - p.startY;
      if (dy > 10) {
        p.pulling = true;
        setPullDistance(Math.min(dy * 0.4, 80));
      } else if (dy < -10) {
        p.active = false;
        setPullDistance(0);
      }
    }

    // Swipe down to dismiss detail
    const d = detailSwipeRef.current;
    if (d.active && view === 'detail' && !editing) {
      const dy = e.touches[0].clientY - d.startY;
      if (dy > 15) {
        d.moving = true;
        setDetailDismissY(Math.min(dy * 0.6, 200));
      } else if (dy < -15) {
        d.active = false;
        setDetailDismissY(0);
      }
    }
  };

  const handleScrollTouchEnd = async () => {
    // Pull to refresh
    if (pullRef.current.pulling && pullDistance > 50 && !refreshing) {
      setRefreshing(true);
      if (view === 'bin') {
        await loadBinScripts();
      } else {
        await refreshScripts();
      }
      setRefreshing(false);
      showToast('Refreshed');
    }
    pullRef.current = { startY: 0, active: false, pulling: false };
    setPullDistance(0);

    // Swipe down to dismiss
    if (detailSwipeRef.current.moving && detailDismissY > 80) {
      goBack();
    }
    detailSwipeRef.current = { startY: 0, active: false, moving: false };
    setDetailDismissY(0);
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: T.bg, color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
        .sv-root { font-family: 'DM Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
        .sv-root textarea, .sv-root input { font-family: 'DM Sans', sans-serif; }
        .sv-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes sv-spin { to { transform: rotate(360deg); } }
        .sv-spin { animation: sv-spin 1s linear infinite; }
        @keyframes sv-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .sv-fade-in { animation: sv-fade 0.2s ease-out; }
        @keyframes sv-view-enter { from { opacity: 0; } to { opacity: 1; } }
        .sv-view-enter { animation: sv-view-enter 0.15s ease-out; }
        .sv-search:focus { background-color: #1C1C1F !important; border-color: #F59E0B !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.12); }
        .sv-root ::placeholder { color: #5A5A62; }
        .sv-root ::-webkit-scrollbar { display: none; }
        .sv-no-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: max(12px, env(safe-area-inset-bottom, 12px)); }
      `}</style>

      <div className="sv-root max-w-[480px] mx-auto relative min-h-screen flex flex-col">

        {/* ═══ Gesture #1: Swipe-back indicator ═══ */}
        {swipeBackProgress > 0 && (
          <div
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[60] flex items-center justify-center rounded-full"
            style={{
              width: 36 * swipeBackProgress + 8,
              height: 36 * swipeBackProgress + 8,
              marginLeft: 6,
              backgroundColor: `${T.accent}${Math.round(swipeBackProgress * 200).toString(16).padStart(2, '0')}`,
              transition: swipeBackRef.current.active ? 'none' : 'all 0.2s ease-out',
            }}
          >
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              stroke={T.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: swipeBackProgress }}
            >
              <path d="M10 3L5 8L10 13" />
            </svg>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            HEADER — compact, context-aware
            ════════════════════════════════════════════════════════════ */}
        <header
          className="sticky top-0 z-40 px-4 flex items-center gap-3 shrink-0"
          style={{
            backgroundColor: `${T.bg}E6`,
            backdropFilter: 'blur(12px)',
            minHeight: 52,
            paddingTop: 'env(safe-area-inset-top, 0px)',
          }}
        >
          {view !== 'home' && !(view === 'bin' && binSelectionMode) && (
            <button
              onClick={goBack}
              className="flex items-center justify-center shrink-0"
              style={{ width: 44, height: 44, color: T.textDim }}
              aria-label="Back"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 4L7 10L13 16" />
              </svg>
            </button>
          )}

          {view === 'home' && (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2L18 6L8 16H4V12L14 2Z" />
                  <path d="M12 4L16 8" />
                </svg>
                <span className="sv-mono text-sm font-medium tracking-widest" style={{ color: T.accent }}>
                  VAULT
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: T.surfaceHover, color: T.textDim }}>
                  {scripts.length}
                </span>
                <button
                  onClick={openBin}
                  className="relative flex items-center justify-center"
                  style={{ width: 36, height: 36, color: T.textDim }}
                  aria-label="Bin"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 5H15M6 5V3.5C6 3.22 6.22 3 6.5 3H11.5C11.78 3 12 3.22 12 3.5V5M7 8V13M11 8V13M4 5L5 15.5C5 15.78 5.22 16 5.5 16H12.5C12.78 16 13 15.78 13 15.5L14 5" />
                  </svg>
                  {binCount !== null && binCount > 0 && (
                    <span
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1"
                      style={{ backgroundColor: T.danger, color: '#fff' }}
                    >
                      {binCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {view === 'results' && (
            <span className="text-sm font-medium truncate" style={{ color: T.text }}>
              {searchResults.length} results
            </span>
          )}

          {view === 'add' && (
            <span className="text-sm font-medium" style={{ color: T.text }}>
              New Script
            </span>
          )}

          {view === 'detail' && selectedScript && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: T.text }}>
                {editing ? 'Edit Script' : selectedScript.title}
              </p>
              {!editing && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StarRating
                    value={selectedScript.rating}
                    onChange={(v) => handleUpdateRating(selectedScript.id, v)}
                    size={11}
                  />
                  <span className="text-[10px]" style={{ color: T.textDim }}>
                    · {new Date(selectedScript.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          )}

          {view === 'bin' && !binSelectionMode && (
            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: T.text }}>Bin</span>
                {binScripts.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: T.surfaceHover, color: T.textDim }}>
                    {binScripts.length}
                  </span>
                )}
              </div>
              {binScripts.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setBinMenuOpen((p) => !p)}
                    className="flex items-center justify-center"
                    style={{ width: 36, height: 36, color: T.textDim }}
                    aria-label="Menu"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                      <circle cx="9" cy="4" r="1.5" />
                      <circle cx="9" cy="9" r="1.5" />
                      <circle cx="9" cy="14" r="1.5" />
                    </svg>
                  </button>
                  {binMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setBinMenuOpen(false)} />
                      <div
                        className="absolute right-0 top-10 z-50 rounded-xl py-1 shadow-xl sv-fade-in"
                        style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, minWidth: 160 }}
                      >
                        <button
                          onClick={() => { setBinMenuOpen(false); handleRestoreAll(); }}
                          className="w-full text-left px-4 py-2.5 text-sm"
                          style={{ color: T.text }}
                        >
                          Restore All
                        </button>
                        <button
                          onClick={() => { setBinMenuOpen(false); handleEmptyBin(); }}
                          className="w-full text-left px-4 py-2.5 text-sm"
                          style={{ color: T.danger }}
                        >
                          Empty Bin
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'bin' && binSelectionMode && (
            <div className="flex items-center justify-between flex-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setBinSelectionMode(false); setSelectedBinIds(new Set()); }}
                  className="flex items-center justify-center"
                  style={{ width: 36, height: 36, color: T.textDim }}
                  aria-label="Cancel selection"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 4L14 14M14 4L4 14" />
                  </svg>
                </button>
                <span className="text-sm font-medium" style={{ color: T.text }}>
                  {selectedBinIds.size} selected
                </span>
              </div>
              <button
                onClick={selectAllBin}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg active:scale-95"
                style={{ color: T.accent, backgroundColor: `${T.accent}15` }}
              >
                {selectedBinIds.size === binScripts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}
        </header>

        {/* ════════════════════════════════════════════════════════════
            SCROLLABLE CONTENT
            ════════════════════════════════════════════════════════════ */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          onTouchStart={handleScrollTouchStart}
          onTouchMove={handleScrollTouchMove}
          onTouchEnd={handleScrollTouchEnd}
          style={{
            // Gesture #5: translate down on swipe dismiss
            transform: detailDismissY > 0 ? `translateY(${detailDismissY}px)` : undefined,
            opacity: detailDismissY > 0 ? 1 - detailDismissY / 300 : 1,
            transition: detailSwipeRef.current.moving ? 'none' : 'all 0.25s ease-out',
          }}
        >

          {/* ═══ Gesture #3: Pull to refresh indicator ═══ */}
          {(pullDistance > 0 || refreshing) && (
            <div
              className="flex items-center justify-center overflow-hidden"
              style={{
                height: refreshing ? 48 : pullDistance,
                transition: pullRef.current.pulling ? 'none' : 'height 0.25s ease-out',
              }}
            >
              <div
                className={refreshing ? 'sv-spin' : ''}
                style={{
                  color: T.accent,
                  fontSize: 18,
                  transform: `rotate(${pullDistance * 3}deg)`,
                  opacity: Math.min(pullDistance / 40, 1),
                }}
              >
                ↻
              </div>
            </div>
          )}

          {/* ─── Loading ─── */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="sv-spin text-2xl" style={{ color: T.accent }}>↻</div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              HOME VIEW
              ═══════════════════════════════════════════════════════ */}
          {!loading && view === 'home' && (
            <div className="px-4 pb-24 sv-view-enter">
              {/* Search bar */}
              <form onSubmit={handleSearchSubmit} className="relative mb-3">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                  stroke={T.textDim} strokeWidth="1.5" strokeLinecap="round"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M11 11L14 14" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search scripts..."
                  className="w-full pl-10 pr-4 rounded-2xl text-sm outline-none transition-all sv-search"
                  style={{
                    backgroundColor: T.surface,
                    color: T.text,
                    border: `1.5px solid ${T.border}`,
                    height: 46,
                  }}
                />
              </form>

              {/* Quick tags */}
              <div className="mb-4 -mx-4 px-4">
                <div className="flex gap-2 overflow-x-auto sv-no-scroll pb-1">
                  {QUICK_TAGS.map((tag) => {
                    const isActive = query.toLowerCase().trim() === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          if (isActive) { setQuery(''); }
                          else { setQuery(tag); doSearch(tag); }
                        }}
                        className="shrink-0 text-[13px] font-medium rounded-full transition-all active:scale-95"
                        style={{
                          backgroundColor: isActive ? `${T.accent}20` : T.surfaceHover,
                          color: isActive ? T.accent : T.textDim,
                          border: `1px solid ${isActive ? T.accent + '40' : T.border}`,
                          height: 36,
                          paddingLeft: 16,
                          paddingRight: 16,
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Script list — swipeable cards */}
              <div className="space-y-2">
                {scripts.map((script) => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    onClick={() => goDetail(script)}
                    onToggleShot={() => handleToggleShot(script)}
                    onDelete={() => handleDelete(script.id)}
                    onLongPress={() => setPreviewScript(script)}
                  />
                ))}
                {scripts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke={T.textDim} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity={0.35}>
                      <path d="M30 6L38 14L16 36H8V28L30 6Z" />
                      <path d="M26 10L34 18" />
                      <path d="M8 42H40" />
                    </svg>
                    <p className="text-sm font-medium" style={{ color: T.textDim }}>No scripts yet</p>
                    <p className="text-xs" style={{ color: T.textMuted }}>Tap + to write your first one</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              ADD VIEW
              ═══════════════════════════════════════════════════════ */}
          {!loading && view === 'add' && (
            <div className="px-4 pb-24 space-y-4 sv-view-enter">
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.text }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.text }} />
                  Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. The Vegetable Bag"
                  className="w-full px-4 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}`, height: 46 }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.hook }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.hook }} />
                  Hook *
                </label>
                <textarea
                  value={formHook}
                  onChange={(e) => setFormHook(e.target.value)}
                  placeholder="First 3 seconds. What STOPS the scroll?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.story }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.story }} />
                  Story / Body
                </label>
                <textarea
                  value={formStory}
                  onChange={(e) => setFormStory(e.target.value)}
                  placeholder="The full narrative arc..."
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.cta }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.cta }} />
                  CTA
                </label>
                <textarea
                  value={formCta}
                  onChange={(e) => setFormCta(e.target.value)}
                  placeholder="Call to action. The line that sticks."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: T.textDim }}>Tags (space-separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="elderly mechanic revenge"
                    className="w-full px-4 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}`, height: 46 }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: T.textDim }}>Rating</label>
                  <div className="flex items-center" style={{ height: 46 }}>
                    <StarRating value={formRating} onChange={setFormRating} size={22} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              RESULTS VIEW
              ═══════════════════════════════════════════════════════ */}
          {!loading && view === 'results' && (
            <div className="px-4 pb-8 sv-view-enter">
              <form onSubmit={handleSearchSubmit} className="relative mb-3">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  width="16" height="16" viewBox="0 0 16 16" fill="none"
                  stroke={T.textDim} strokeWidth="1.5" strokeLinecap="round"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M11 11L14 14" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search scripts..."
                  className="w-full pl-10 pr-4 rounded-2xl text-sm outline-none transition-all sv-search"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1.5px solid ${T.border}`, height: 46 }}
                />
              </form>

              {expandedTerms.length > 0 && (
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: T.textDim }}>
                  <span style={{ color: T.accent }}>Matched: </span>
                  {expandedTerms.slice(0, 12).join(' · ')}
                  {expandedTerms.length > 12 && ` +${expandedTerms.length - 12}`}
                </p>
              )}

              {searching && (
                <div className="flex items-center justify-center gap-2 py-16">
                  <span className="sv-spin text-lg" style={{ color: T.accent }}>↻</span>
                  <span className="text-sm" style={{ color: T.textDim }}>Searching...</span>
                </div>
              )}

              {!searching && (
                <div className="space-y-2">
                  {searchResults.map((script) => (
                    <ScriptCard
                      key={script.id}
                      script={script}
                      onClick={() => goDetail(script)}
                      onToggleShot={() => handleToggleShot(script)}
                      onDelete={() => handleDelete(script.id)}
                      onLongPress={() => setPreviewScript(script)}
                      showScore
                    />
                  ))}
                  {searchResults.length === 0 && (
                    <p className="text-center py-16 text-sm" style={{ color: T.textDim }}>
                      No scripts found for &ldquo;{query}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              DETAIL VIEW — read mode
              ═══════════════════════════════════════════════════════ */}
          {!loading && view === 'detail' && selectedScript && !editing && (
            <div className="px-4 pb-24 space-y-5 sv-view-enter">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: T.hook }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.hook }} />
                  Hook
                </label>
                <div
                  className="rounded-xl p-3.5 text-[15px] leading-relaxed"
                  style={{ backgroundColor: T.surface, borderLeft: `3px solid ${T.hook}`, color: T.text }}
                >
                  {selectedScript.hook}
                </div>
              </div>

              {selectedScript.story && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: T.story }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.story }} />
                    Story
                  </label>
                  <div
                    className="rounded-xl p-3.5 text-[15px] leading-relaxed whitespace-pre-wrap"
                    style={{ backgroundColor: T.surface, borderLeft: `3px solid ${T.story}`, color: T.text }}
                  >
                    {selectedScript.story}
                  </div>
                </div>
              )}

              {selectedScript.cta && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: T.cta }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.cta }} />
                    CTA
                  </label>
                  <div
                    className="rounded-xl p-3.5 text-[15px] leading-relaxed font-semibold"
                    style={{ backgroundColor: T.surface, borderLeft: `3px solid ${T.cta}`, color: T.text }}
                  >
                    {selectedScript.cta}
                  </div>
                </div>
              )}

              {selectedScript.tags.length > 0 && (
                <p className="text-[13px]" style={{ color: T.textMuted }}>
                  {selectedScript.tags.join(' · ')}
                </p>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              DETAIL VIEW — edit mode
              ═══════════════════════════════════════════════════════ */}
          {!loading && view === 'detail' && selectedScript && editing && (
            <div className="px-4 pb-24 space-y-4 sv-view-enter">
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.text }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.text }} />
                  Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}`, height: 46 }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.hook }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.hook }} />
                  Hook *
                </label>
                <textarea
                  value={formHook}
                  onChange={(e) => setFormHook(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.story }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.story }} />
                  Story / Body
                </label>
                <textarea
                  value={formStory}
                  onChange={(e) => setFormStory(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: T.cta }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.cta }} />
                  CTA
                </label>
                <textarea
                  value={formCta}
                  onChange={(e) => setFormCta(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y"
                  style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}` }}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: T.textDim }}>Tags</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    className="w-full px-4 rounded-xl text-sm outline-none"
                    style={{ backgroundColor: T.surface, color: T.text, border: `1px solid ${T.border}`, height: 46 }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: T.textDim }}>Rating</label>
                  <div className="flex items-center" style={{ height: 46 }}>
                    <StarRating value={formRating} onChange={setFormRating} size={22} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              BIN VIEW
              ═══════════════════════════════════════════════════════ */}
          {!loading && view === 'bin' && (
            <div className="px-4 pb-24 sv-view-enter">
              {/* Info banner */}
              <div
                className="rounded-xl px-3.5 py-2.5 mb-3 text-[12px] flex items-center gap-2"
                style={{ backgroundColor: 'rgba(245,158,11,0.08)', color: T.textDim, border: '1px solid rgba(245,158,11,0.15)' }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="7" cy="7" r="6" />
                  <path d="M7 4.5V7.5M7 9.5V9.5" />
                </svg>
                <span>Deleted scripts are removed after 30 days</span>
              </div>

              {binLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="sv-spin text-2xl" style={{ color: T.accent }}>↻</div>
                </div>
              )}

              {!binLoading && binScripts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke={T.textDim} strokeWidth="1.5" strokeLinecap="round" opacity={0.4}>
                    <path d="M8 14H40M16 14V10C16 9.45 16.45 9 17 9H31C31.55 9 32 9.45 32 10V14M19 21V35M29 21V35M10 14L12 40C12 40.55 12.45 41 13 41H35C35.55 41 36 40.55 36 40L38 14" />
                  </svg>
                  <p className="text-sm" style={{ color: T.textDim }}>Bin is empty</p>
                </div>
              )}

              {!binLoading && binScripts.length > 0 && (
                <div className="space-y-2">
                  {binScripts.map((script) => (
                    <BinScriptCard
                      key={script.id}
                      script={script}
                      selected={selectedBinIds.has(script.id)}
                      selectionMode={binSelectionMode}
                      onTap={() => {
                        if (binSelectionMode) toggleBinSelect(script.id);
                      }}
                      onLongPress={() => {
                        if (!binSelectionMode) enterBinSelectionMode(script.id);
                        else toggleBinSelect(script.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════
            STICKY BOTTOM BARS
            ════════════════════════════════════════════════════════════ */}

        {/* FAB — Home view */}
        {!loading && view === 'home' && (
          <button
            onClick={() => { resetForm(); setView('add'); }}
            className="fixed z-50 flex items-center justify-center rounded-2xl shadow-lg active:scale-95 transition-transform"
            style={{
              backgroundColor: T.accent,
              color: T.bg,
              width: 56,
              height: 56,
              bottom: 24,
              right: 'max(24px, calc((100vw - 480px) / 2 + 24px))',
            }}
            aria-label="Add script"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5V19M5 12H19" />
            </svg>
          </button>
        )}

        {/* Bottom bar — Add form */}
        {!loading && view === 'add' && (
          <div
            className="sticky bottom-0 z-40 px-4 py-3 pb-safe shrink-0"
            style={{ backgroundColor: `${T.bg}F2`, backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.border}` }}
          >
            <button
              onClick={handleAddScript}
              disabled={!formTitle.trim() || !formHook.trim() || saving}
              className="w-full rounded-xl text-sm font-semibold transition-opacity disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ backgroundColor: T.accent, color: T.bg, height: 48 }}
            >
              {saving && <span className="sv-spin text-base">↻</span>}
              {saving ? 'Saving...' : 'Save Script'}
            </button>
          </div>
        )}

        {/* Bottom bar — Detail read mode */}
        {!loading && view === 'detail' && selectedScript && !editing && (
          <div
            className="sticky bottom-0 z-40 px-4 py-3 pb-safe flex items-center gap-2 shrink-0"
            style={{ backgroundColor: `${T.bg}F2`, backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.border}` }}
          >
            <button
              onClick={() => handleToggleShot(selectedScript)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-medium active:scale-[0.98]"
              style={{
                height: 48,
                backgroundColor: selectedScript.shot_done ? T.success : T.surface,
                color: selectedScript.shot_done ? '#fff' : T.textDim,
                border: `1px solid ${selectedScript.shot_done ? T.success : T.border}`,
              }}
            >
              {selectedScript.shot_done ? '✓ Shot' : '○ Shot'}
            </button>
            <button
              onClick={() => startEditing(selectedScript)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold active:scale-[0.98]"
              style={{ height: 48, backgroundColor: T.accent, color: T.bg }}
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(selectedScript.id)}
              className="flex items-center justify-center rounded-xl active:scale-[0.98]"
              style={{
                width: 48,
                height: 48,
                backgroundColor: T.surface,
                color: T.danger,
                border: `1px solid ${T.border}`,
              }}
              aria-label="Delete"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 5H15M6 5V3.5C6 3.22 6.22 3 6.5 3H11.5C11.78 3 12 3.22 12 3.5V5M7 8V13M11 8V13M4 5L5 15.5C5 15.78 5.22 16 5.5 16H12.5C12.78 16 13 15.78 13 15.5L14 5" />
              </svg>
            </button>
          </div>
        )}

        {/* Bottom bar — Detail edit mode */}
        {!loading && view === 'detail' && selectedScript && editing && (
          <div
            className="sticky bottom-0 z-40 px-4 py-3 pb-safe flex gap-2 shrink-0"
            style={{ backgroundColor: `${T.bg}F2`, backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.border}` }}
          >
            <button
              onClick={() => setEditing(false)}
              className="flex-1 rounded-xl text-sm font-medium active:scale-[0.98]"
              style={{ height: 48, backgroundColor: T.surface, color: T.textDim, border: `1px solid ${T.border}` }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!formTitle.trim() || !formHook.trim() || saving}
              className="flex-1 rounded-xl text-sm font-semibold disabled:opacity-30 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ height: 48, backgroundColor: T.accent, color: T.bg }}
            >
              {saving && <span className="sv-spin text-base">↻</span>}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Bin selection bottom bar */}
        {view === 'bin' && binSelectionMode && selectedBinIds.size > 0 && (
          <div
            className="sticky bottom-0 z-40 px-4 py-3 pb-safe flex gap-2 shrink-0"
            style={{ backgroundColor: `${T.bg}F2`, backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.border}` }}
          >
            <button
              onClick={() => handleBinRestore(Array.from(selectedBinIds))}
              className="flex-1 rounded-xl text-sm font-semibold active:scale-[0.98]"
              style={{ height: 48, backgroundColor: T.accent, color: T.bg }}
            >
              Restore{selectedBinIds.size > 1 ? ` (${selectedBinIds.size})` : ''}
            </button>
            <button
              onClick={() => handleBinPermanentDelete(Array.from(selectedBinIds))}
              className="flex-1 rounded-xl text-sm font-semibold active:scale-[0.98]"
              style={{ height: 48, backgroundColor: T.danger, color: '#fff' }}
            >
              Delete Forever{selectedBinIds.size > 1 ? ` (${selectedBinIds.size})` : ''}
            </button>
          </div>
        )}

        {/* ═══ Gesture #4: Long press preview overlay ═══ */}
        {previewScript && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center sv-fade-in"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
            onClick={() => setPreviewScript(null)}
          >
            <div
              className="mx-5 max-w-[420px] w-full rounded-2xl p-5 space-y-3"
              style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold truncate pr-3" style={{ color: T.text }}>
                  {previewScript.title}
                </h3>
                <StarRating value={previewScript.rating} size={13} />
              </div>

              <div
                className="rounded-lg p-3 text-[14px] leading-relaxed"
                style={{ backgroundColor: T.bg, borderLeft: `3px solid ${T.hook}`, color: T.text }}
              >
                {previewScript.hook}
              </div>

              {previewScript.story && (
                <p className="text-[13px] leading-relaxed" style={{ color: T.textDim }}>
                  {previewScript.story.length > 200
                    ? previewScript.story.slice(0, 200) + '...'
                    : previewScript.story}
                </p>
              )}

              {previewScript.tags.length > 0 && (
                <p className="text-[12px]" style={{ color: T.textMuted }}>
                  {previewScript.tags.join(' · ')}
                </p>
              )}

              <button
                onClick={() => { setPreviewScript(null); goDetail(previewScript); }}
                className="w-full rounded-xl text-sm font-semibold active:scale-[0.98]"
                style={{ height: 44, backgroundColor: T.accent, color: T.bg }}
              >
                Open Full Script
              </button>
            </div>
          </div>
        )}

        <Toast message={toast} visible={!!toast} />
        <UndoToast message={undoToast.message} visible={undoToast.visible} onUndo={handleUndoDelete} />
        {confirmDialog && (
          <ConfirmDialog
            title={confirmDialog.title}
            body={confirmDialog.body}
            actionLabel={confirmDialog.actionLabel}
            destructive={confirmDialog.destructive}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}
      </div>
    </div>
  );
}
