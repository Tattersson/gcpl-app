'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_OFF_ICE_TAGS,
  OffIcePractice,
} from '@/types/planner';
import {
  filterOffIcePractices,
  getAvailableOffIceTags,
  normalizeImageList,
  normalizeStringList,
} from '@/lib/offIce';
import {
  BookOpen,
  Clock,
  Dumbbell,
  Edit3,
  Filter,
  Image as ImageIcon,
  Plus,
  PlusCircle,
  Search,
  Tag,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';

interface OffIceClientProps {
  initialPractices: OffIcePractice[];
  isAdmin?: boolean;
  /** Open this practice in the editor on load (from the detail page's Edit button); saving returns to the detail page. */
  editId?: string;
}

export default function OffIceClient({
  initialPractices,
  isAdmin = false,
  editId,
}: OffIceClientProps) {
  const router = useRouter();
  const [practices, setPractices] = useState<OffIcePractice[]>(initialPractices);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state (create or edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [equipmentInput, setEquipmentInput] = useState('');
  const [formTags, setFormTags] = useState<string[]>(['Lower Body']);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTags = useMemo(
    () => getAvailableOffIceTags(practices),
    [practices]
  );

  const filteredPractices = useMemo(
    () => filterOffIcePractices(practices, selectedTags, searchQuery),
    [practices, selectedTags, searchQuery]
  );

  function toggleFilterTag(tag: string) {
    setSelectedTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== tag.toLowerCase());
      }
      return [...prev, tag];
    });
  }

  function openCreateForm() {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDurationMinutes(20);
    setEquipmentInput('');
    setFormTags(selectedTags.length > 0 ? [...selectedTags] : ['Lower Body']);
    setFormImages([]);
    setCustomTagInput('');
    setError(null);
    setIsFormOpen(true);
  }

  function openEditForm(practice: OffIcePractice) {
    setEditingId(practice.id);
    setTitle(practice.title);
    setDescription(practice.description);
    setDurationMinutes(practice.durationMinutes);
    setEquipmentInput((practice.equipment || []).join(', '));
    setFormTags([...(practice.tags || [])]);
    setFormImages([...(practice.images || [])]);
    setCustomTagInput('');
    setError(null);
    setIsFormOpen(true);
  }

  useEffect(() => {
    const target = editId && initialPractices.find((p) => p.id === editId);
    if (target) openEditForm(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  function closeForm() {
    setIsFormOpen(false);
    if (editId && editingId === editId) router.push(`/off-ice/${editId}`);
  }

  // Lock background scroll while the full-screen mobile editor is open
  useEffect(() => {
    if (!isFormOpen) return;
    const prev = document.body.style.overflow;
    if (window.matchMedia('(max-width: 639px)').matches) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFormOpen]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const maxBytes = 2 * 1024 * 1024;
    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" is not an image file.`);
        continue;
      }
      if (file.size > maxBytes) {
        setError(`"${file.name}" exceeds the 2 MB limit per image.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const dataUrls = await Promise.all(
      validFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsDataURL(file);
          })
      )
    );

    setFormImages((prev) => normalizeImageList([...prev, ...dataUrls]));
  }

  function toggleFormTag(tag: string) {
    setFormTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === tag.toLowerCase());
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== tag.toLowerCase());
      }
      return [...prev, tag];
    });
  }

  function handleAddCustomTag() {
    const newTags = normalizeStringList(
      customTagInput.split(',').map((s) => s.trim())
    );
    if (newTags.length === 0) return;
    setFormTags((prev) => normalizeStringList([...prev, ...newTags]));
    setCustomTagInput('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a practice or move title.');
      return;
    }

    setSaving(true);
    setError(null);

    const pendingCustom = customTagInput.trim()
      ? customTagInput.split(',').map((s) => s.trim())
      : [];
    const finalTags = normalizeStringList([...formTags, ...pendingCustom]);
    const equipment = normalizeStringList(
      equipmentInput.split(',').map((s) => s.trim())
    );

    try {
      const url = editingId ? `/api/off-ice/${editingId}` : '/api/off-ice';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          durationMinutes: Number(durationMinutes) || 20,
          equipment,
          tags: finalTags,
          images: formImages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save off-ice practice');
      }

      if (editingId) {
        setPractices((prev) =>
          prev.map((p) => (p.id === editingId ? data.practice : p))
        );
      } else {
        setPractices((prev) => [data.practice, ...prev]);
      }
      if (editId && editingId === editId) {
        router.push(`/off-ice/${editId}`);
        router.refresh();
      }
      setIsFormOpen(false);
      setEditingId(null);
    } catch (err: any) {
      setError(err?.message || 'Could not save practice');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/off-ice/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPractices((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // Merge available tags with any newly added tags inside the open form so they show as selectable chips
  const formTagOptions = useMemo(
    () => normalizeStringList([...DEFAULT_OFF_ICE_TAGS, ...availableTags, ...formTags]),
    [availableTags, formTags]
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 p-4 text-white shadow-lg sm:p-6">
        <div>
          <span className="inline-block rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-300">
            Goalie Dryland &amp; Conditioning Database
          </span>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Off-Ice Goalie Practices
          </h1>
          <p className="mt-1 text-xs text-slate-300 sm:text-sm">
            Create, tag, and filter off-ice goalie drills for lower body power, upper body, balance, hand-eye coordination, and custom focus areas.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-sky-400 transition sm:w-auto sm:py-2.5"
        >
          <PlusCircle className="h-4 w-4" />
          New Off-Ice Practice
        </button>
      </div>

      {/* Create / Edit Modal Card */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="fixed inset-0 z-50 space-y-5 overflow-y-auto bg-white p-4 sm:static sm:z-auto sm:overflow-visible sm:rounded-2xl sm:border sm:border-sky-200 sm:p-6 sm:shadow-md"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-sky-600" />
              {editingId ? 'Edit Off-Ice Practice' : 'Create Off-Ice Practice'}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              aria-label="Close"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
                Practice / Move Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Single-Leg Lateral Bounds & Tennis Ball Catch"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min={1}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
              Moves, Sets / Reps &amp; Goalie Coaching Points
            </label>
            <textarea
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the off-ice moves, sets/reps, stance cues, and what the goalie should focus on..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
              Equipment (comma-separated)
            </label>
            <input
              type="text"
              value={equipmentInput}
              onChange={(e) => setEquipmentInput(e.target.value)}
              placeholder="e.g., Tennis Balls, BOSU Ball, Mini Band"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Preset & Custom Filters / Tags */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
              Practice Filters / Tags (Select presets or add custom tags)
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {formTagOptions.map((tag) => {
                const active = formTags.some(
                  (t) => t.toLowerCase() === tag.toLowerCase()
                );
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleFormTag(tag)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition border ${
                      active
                        ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                placeholder="Add custom filter/tag (e.g., Plyometrics, Juggling, Post-Game Stretch)..."
                className="min-w-0 flex-1 basis-48 rounded-xl border border-slate-300 px-3.5 py-2 text-base sm:py-1.5 sm:text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomTag}
                className="inline-flex items-center gap-1 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Custom Tag
              </button>
            </div>
          </div>

          {/* Visual Guide Images */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-700">
              Visual Guide Images (Optional, max 2 MB each)
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 transition">
                <Upload className="h-4 w-4" />
                Add Images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-slate-500">
                Attach stance photos, movement sequences, or diagrams so players can follow along.
              </span>
            </div>

            {formImages.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {formImages.map((src, idx) => (
                  <div
                    key={`${idx}-${src.slice(0, 32)}`}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                  >
                    <img
                      src={src}
                      alt={`Practice attachment ${idx + 1}`}
                      className="h-28 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      title="Remove image"
                      className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/75 p-1 text-white hover:bg-rose-600 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sticky -bottom-4 -mx-4 flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-4 py-4 sm:static sm:mx-0 sm:px-0 sm:pb-0">
            <button
              type="button"
              onClick={closeForm}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100 sm:flex-none sm:py-2 sm:text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50 sm:flex-none sm:py-2 sm:text-xs"
            >
              {saving
                ? 'Saving...'
                : editingId
                ? 'Save Changes'
                : 'Save Off-Ice Practice'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Tag Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-0 flex-1 basis-60">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search off-ice moves, descriptions, equipment, or tags..."
              className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {(selectedTags.length > 0 || searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setSelectedTags([]);
                setSearchQuery('');
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              <X className="h-3.5 w-3.5" />
              Clear Filters ({selectedTags.length})
            </button>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="h-3.5 w-3.5 text-sky-600" />
            Filter by Focus Area / Tag
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.some(
                (t) => t.toLowerCase() === tag.toLowerCase()
              );
              const count = practices.filter((p) =>
                (p.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase())
              ).length;

              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleFilterTag(tag)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition border ${
                    isSelected
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{tag}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      isSelected
                        ? 'bg-sky-800 text-sky-100'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">
          Off-Ice Practices ({filteredPractices.length}
          {filteredPractices.length !== practices.length
            ? ` of ${practices.length}`
            : ''}
          )
        </h2>
      </div>

      {/* Practices Grid */}
      {filteredPractices.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <Dumbbell className="mx-auto h-10 w-10 text-sky-600" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            No Matching Off-Ice Practices
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {practices.length === 0
              ? 'Create your first goalie off-ice practice and tag it with focus areas like Lower Body, Balance, or Hand-Eye Coordination.'
              : 'Try clearing some tag filters or broadening your search query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPractices.map((practice) => (
            <div
              key={practice.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div>
                {practice.images && practice.images.length > 0 && (
                  <Link
                    href={`/off-ice/${practice.id}`}
                    className="relative block border-b border-slate-100 bg-slate-50"
                  >
                    <img
                      src={practice.images[0]}
                      alt={practice.title}
                      className="h-40 w-full object-cover"
                    />
                    {practice.images.length > 1 && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-white">
                        <ImageIcon className="h-3 w-3" />
                        {practice.images.length} images
                      </span>
                    )}
                  </Link>
                )}

                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/off-ice/${practice.id}`}
                      className="text-base font-bold text-slate-900 hover:text-sky-600 transition"
                    >
                      {practice.title}
                    </Link>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-sky-600" />
                      {practice.durationMinutes} min
                    </span>
                  </div>

                {/* Filterable Tags */}
                {practice.tags && practice.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {practice.tags.map((tag) => {
                      const active = selectedTags.some(
                        (t) => t.toLowerCase() === tag.toLowerCase()
                      );
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleFilterTag(tag)}
                          title={`Filter by ${tag}`}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold border transition ${
                            active
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                          }`}
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600 line-clamp-4">
                  {practice.description || 'No description provided.'}
                </p>

                {practice.equipment && practice.equipment.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Wrench className="h-3 w-3 text-slate-400" />
                      Equipment:
                    </span>
                    {practice.equipment.map((item) => (
                      <span
                        key={item}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/off-ice/${practice.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-500 transition"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Read Practice
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEditForm(practice)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(practice.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
