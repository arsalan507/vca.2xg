import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Loader2, Plus, Trash2, Users, X } from 'lucide-react';
import { adminService } from '@/services/adminService';
import toast from 'react-hot-toast';

interface Tag {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface Props {
  /** ID of the analysis — used to persist tags immediately on change.
   *  Omit (or pass empty string) for localOnly mode (e.g. new-script form). */
  analysisId?: string;
  /** Currently selected tags */
  value: Tag[];
  /** Called after tags are saved (or immediately in localOnly mode) */
  onChange?: (tags: Tag[]) => void;
  /** Optional: show in read-only mode (videographer, editor) */
  readOnly?: boolean;
}

// Pill colours cycling through a palette
const PILL_COLORS = [
  'bg-purple-100 text-purple-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
  'bg-yellow-100 text-yellow-700',
  'bg-indigo-100 text-indigo-700',
];

function pillColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PILL_COLORS[Math.abs(hash) % PILL_COLORS.length];
}

export default function CharacterTagSelector({ analysisId, value, onChange, readOnly = false }: Props) {
  const [open, setOpen] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [saving, setSaving] = useState(false);

  // "Add new tag" inline form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagDesc, setNewTagDesc] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const selectedIds = new Set(value.map(t => t.id));

  // Load tags when panel opens
  useEffect(() => {
    if (open && allTags.length === 0) {
      fetchTags();
    }
  }, [open]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const fetchTags = async () => {
    setLoadingTags(true);
    try {
      const data = await adminService.getAllCharacterTags();
      setAllTags(data);
    } catch {
      toast.error('Failed to load characters');
    } finally {
      setLoadingTags(false);
    }
  };

  const toggleTag = async (tag: Tag) => {
    const isSelected = selectedIds.has(tag.id);
    const newSelected = isSelected
      ? value.filter(t => t.id !== tag.id)
      : [...value, tag];

    // Local-only mode (no analysisId) — just update local state
    if (!analysisId) {
      onChange?.(newSelected);
      return;
    }

    try {
      setSaving(true);
      await adminService.setAnalysisCharacterTags(analysisId, newSelected.map(t => t.id));
      onChange?.(newSelected);
    } catch {
      toast.error('Failed to update characters');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      setCreatingTag(true);
      const created = await adminService.createCharacterTag(newTagName.trim(), newTagDesc.trim() || undefined);
      setAllTags(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
      setNewTagDesc('');
      setShowAddForm(false);
      toast.success(`"${created.name}" added`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create character');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (deletingId !== tag.id) {
      // First tap — confirm
      setDeletingId(tag.id);
      return;
    }
    // Second tap — delete
    try {
      await adminService.deleteCharacterTag(tag.id);
      setAllTags(prev => prev.filter(t => t.id !== tag.id));
      // If the deleted tag was selected, remove it
      if (selectedIds.has(tag.id)) {
        const newSelected = value.filter(t => t.id !== tag.id);
        if (analysisId) {
          await adminService.setAnalysisCharacterTags(analysisId, newSelected.map(t => t.id));
        }
        onChange?.(newSelected);
      }
      setDeletingId(null);
      toast.success(`"${tag.name}" deleted`);
    } catch {
      toast.error('Failed to delete character');
      setDeletingId(null);
    }
  };

  // ── Read-only view ────────────────────────────────────────────────────────
  if (readOnly) {
    if (value.length === 0) return null;
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Characters</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {value.map(tag => (
            <span key={tag.id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${pillColor(tag.name)}`}>
              {tag.name}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ── Editable view ─────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={panelRef}>
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Characters / Actors</span>
        </div>
        {saving && <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin" />}
      </div>

      {/* Selected pills + open button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full min-h-[42px] flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-left transition-colors ${
          open ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        {value.length === 0 ? (
          <span className="text-sm text-gray-400 flex-1">Tap to select characters…</span>
        ) : (
          value.map(tag => (
            <span
              key={tag.id}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${pillColor(tag.name)}`}
            >
              {tag.name}
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); toggleTag(tag); }}
                onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), toggleTag(tag))}
                className="hover:opacity-70 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </span>
            </span>
          ))
        )}
        <span className="ml-auto shrink-0">
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col overflow-hidden" style={{ maxHeight: '260px' }}>
          {/* Tag list — scrolls within the capped panel */}
          <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain">
            {loadingTags ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
              </div>
            ) : allTags.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No characters yet — add one below</p>
            ) : (
              allTags.map(tag => {
                const isSelected = selectedIds.has(tag.id);
                const isConfirmDelete = deletingId === tag.id;
                return (
                  <div
                    key={tag.id}
                    className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${
                      isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${
                        isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>

                    {/* Name */}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="flex-1 text-left"
                    >
                      <span className={`text-sm font-medium ${isSelected ? 'text-purple-700' : 'text-gray-800'}`}>
                        {tag.name}
                      </span>
                      {tag.description && (
                        <span className="block text-xs text-gray-400">{tag.description}</span>
                      )}
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDeleteTag(tag)}
                      className={`shrink-0 p-1 rounded transition-colors ${
                        isConfirmDelete
                          ? 'bg-red-500 text-white'
                          : 'text-gray-300 hover:text-red-400'
                      }`}
                      title={isConfirmDelete ? 'Tap again to confirm delete' : 'Delete character'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add new tag form — always visible at bottom, never scrolled away */}
          <div className="border-t border-gray-100 flex-shrink-0 bg-white">
            {!showAddForm ? (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-purple-600 font-medium hover:bg-purple-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add new character
              </button>
            ) : (
              <div className="p-3 space-y-2 bg-purple-50">
                <input
                  type="text"
                  value={newTagName}
                  onChange={e => setNewTagName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleCreateTag()}
                  placeholder="Character name (e.g. Zubair, Reddy Anna)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
                <input
                  type="text"
                  value={newTagDesc}
                  onChange={e => setNewTagDesc(e.target.value)}
                  placeholder="Role / description (optional)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowAddForm(false); setNewTagName(''); setNewTagDesc(''); }}
                    className="flex-1 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={creatingTag || !newTagName.trim()}
                    className="flex-1 py-2 text-xs font-medium text-white bg-purple-500 rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5 hover:bg-purple-600"
                  >
                    {creatingTag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
