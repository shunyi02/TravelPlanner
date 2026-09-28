import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BatteryCharging,
  Check,
  Drop,
  FirstAidKit,
  IdentificationCard,
  Package,
  PencilSimple,
  Plus,
  Suitcase,
  TShirt,
  Tent,
  type Icon,
} from '@phosphor-icons/react';
import { CHECKLIST_CATEGORIES, CHECKLIST_STARTERS } from '@travel-planner/shared';
import { api, type ChecklistItem } from '../api';
import { useAuth } from '../authContext';
import { initials } from '../format';

type Filter = 'all' | 'todo' | 'mine' | 'packed';

const CATEGORY_ICONS: Record<string, Icon> = {
  Documents: IdentificationCard,
  Clothing: TShirt,
  Toiletries: Drop,
  Electronics: BatteryCharging,
  Health: FirstAidKit,
  'Shared gear': Tent,
};

/** How long "Undo" stays offered before a removal is sent to the server. */
const UNDO_MS = 5000;

const byCreated = (a: ChecklistItem, b: ChecklistItem) => a.createdAt.localeCompare(b.createdAt);

/** The trip's shared packing list: one card per category, ticked off as things are packed. */
export function ChecklistTab({ tripId, memberNames }: { tripId: string; memberNames: Record<string, string> }) {
  const { currentUser } = useAuth();
  // null until the first load finishes, so loading never reads as an empty list.
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showStarters, setShowStarters] = useState(false);
  // A removal waiting out its undo window; it's already hidden from the list.
  const [removed, setRemoved] = useState<ChecklistItem | null>(null);
  const removeTimer = useRef<number | undefined>(undefined);
  const flushRemoval = useRef<() => void>(() => {});

  const load = () => {
    setError(null);
    api
      .listChecklist(tripId)
      .then((list) => {
        setItems(list);
        if (list.length === 0) setShowStarters(true);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [tripId]);
  // Leaving the tab mid-undo still removes the item.
  useEffect(() => () => flushRemoval.current(), []);

  const fail = (fallback: string) => (err: unknown) => setError(err instanceof Error ? err.message : fallback);

  const replace = (updated: ChecklistItem) =>
    setItems((prev) => prev && prev.map((i) => (i.id === updated.id ? updated : i)));

  const add = async (data: { label: string; category: string; assigneeId?: string }) => {
    setError(null);
    try {
      const item = await api.addChecklistItem(tripId, data);
      setItems((prev) => [...(prev ?? []), item]);
      return true;
    } catch (err) {
      fail('Could not add the item')(err);
      return false;
    }
  };

  // Ticking is optimistic so the box answers instantly; a failure reloads the true state.
  const toggle = (item: ChecklistItem) => {
    replace({ ...item, packed: !item.packed });
    api.updateChecklistItem(tripId, item.id, { packed: !item.packed }).then(replace).catch(load);
  };

  const save = async (item: ChecklistItem, data: { label: string; category: string; assigneeId: string | null }) => {
    setError(null);
    try {
      replace(await api.updateChecklistItem(tripId, item.id, data));
      setEditingId(null);
    } catch (err) {
      fail('Could not save the item')(err);
    }
  };

  const remove = (item: ChecklistItem) => {
    flushRemoval.current();
    setEditingId(null);
    setItems((prev) => prev && prev.filter((i) => i.id !== item.id));
    setRemoved(item);
    const send = () => {
      window.clearTimeout(removeTimer.current);
      flushRemoval.current = () => {};
      setRemoved(null);
      api.deleteChecklistItem(tripId, item.id).catch((err) => {
        setItems((prev) => prev && [...prev, item].sort(byCreated));
        fail('Could not remove the item')(err);
      });
    };
    flushRemoval.current = send;
    removeTimer.current = window.setTimeout(send, UNDO_MS);
  };

  const undoRemove = () => {
    if (!removed) return;
    window.clearTimeout(removeTimer.current);
    flushRemoval.current = () => {};
    setItems((prev) => prev && [...prev, removed].sort(byCreated));
    setRemoved(null);
  };

  const unpackAll = () => api.unpackChecklist(tripId).then(setItems).catch(fail('Could not untick the list'));

  if (!items) {
    return error ? <p className="empty-state">Couldn't load the checklist: {error}</p> : <ChecklistSkeleton />;
  }

  const meId = currentUser?.id;
  const memberIds = Object.keys(memberNames);
  const shared = memberIds.length > 1;
  // "Mine" is what I have to pack: my own copy of everyday items plus what I bring for the group.
  const isMine = (i: ChecklistItem) => i.assigneeId === null || i.assigneeId === meId;
  const inFilter = (i: ChecklistItem) =>
    filter === 'todo' ? !i.packed : filter === 'packed' ? i.packed : filter === 'mine' ? isMine(i) : true;

  const packedCount = items.filter((i) => i.packed).length;
  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'todo', label: 'To pack' },
    ...(shared && meId ? [{ id: 'mine' as const, label: 'Mine' }] : []),
    { id: 'packed', label: 'Packed' },
  ];

  // Known categories in their set order, then any others (e.g. retired ones) after.
  const categories = [...new Set<string>([...CHECKLIST_CATEGORIES, ...items.map((i) => i.category)])];
  const groups = categories
    .map((cat) => ({ cat, all: items.filter((i) => i.category === cat) }))
    .map((g) => ({ ...g, shown: g.all.filter(inFilter) }))
    // Every category stays open for adding under "All"; other filters show only matches.
    .filter((g) =>
      filter === 'all' ? (CHECKLIST_CATEGORIES as readonly string[]).includes(g.cat) || g.all.length > 0 : g.shown.length > 0,
    );
  const starters = CHECKLIST_STARTERS.filter((s) => !items.some((i) => i.label.toLowerCase() === s.label.toLowerCase()));

  return (
    <div className="checklist">
      {items.length > 0 && (
        <section className="checklist-bar card" aria-label="Packing progress">
          <div className="checklist-bar-progress">
            <p className="checklist-bar-count">
              <strong>{packedCount}</strong> of {items.length} packed
            </p>
            <progress max={items.length} value={packedCount} aria-label="Packing progress" />
          </div>
          <div className="checklist-bar-actions">
            <div className="segmented-control" role="group" aria-label="Filter items">
              {filters.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  className={filter === f.id ? 'active' : ''}
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {packedCount > 0 && (
              <button type="button" className="text-btn" onClick={unpackAll}>
                Untick everything
              </button>
            )}
          </div>
        </section>
      )}

      {error && <p className="form-error">{error}</p>}

      {showStarters && starters.length > 0 && (
        <section className="checklist-starters card" aria-labelledby="checklist-starters-heading">
          <Suitcase size={32} weight="duotone" aria-hidden className="checklist-starters-icon" />
          <div className="checklist-starters-body">
            <h3 id="checklist-starters-heading">Start your packing list</h3>
            <p>Tap to add common items, or type your own into any category below.</p>
            <div className="checklist-starters-chips">
              {starters.map((s) => (
                <button type="button" key={s.label} className="checklist-chip" onClick={() => add(s)}>
                  <Plus size={14} weight="bold" aria-hidden /> {s.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="text-btn checklist-starters-done" onClick={() => setShowStarters(false)}>
            Done
          </button>
        </section>
      )}

      {groups.length === 0 ? (
        <p className="empty-state">
          {filter === 'packed' ? 'Nothing packed yet.' : filter === 'mine' ? 'Nothing for you to pack.' : 'Everything is packed.'}
        </p>
      ) : (
        <div className="checklist-board">
          {groups.map((g) => (
            <CategoryCard
              key={g.cat}
              category={g.cat}
              all={g.all}
              shown={g.shown}
              filter={filter}
              memberNames={memberNames}
              shared={shared}
              editingId={editingId}
              onAdd={(label) => add({ label, category: g.cat })}
              onToggle={toggle}
              onEdit={setEditingId}
              onSave={save}
              onRemove={remove}
            />
          ))}
        </div>
      )}

      <div className="undo-toast" role="status">
        {removed && (
          <>
            <span>Removed “{removed.label}”</span>
            <button type="button" className="text-btn" onClick={undoRemove}>
              Undo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface RowHandlers {
  memberNames: Record<string, string>;
  shared: boolean;
  editingId: string | null;
  onToggle: (item: ChecklistItem) => void;
  onEdit: (id: string | null) => void;
  onSave: (item: ChecklistItem, data: { label: string; category: string; assigneeId: string | null }) => void;
  onRemove: (item: ChecklistItem) => void;
}

function CategoryCard({
  category,
  all,
  shown,
  filter,
  onAdd,
  ...rows
}: RowHandlers & {
  category: string;
  all: ChecklistItem[];
  shown: ChecklistItem[];
  filter: Filter;
  onAdd: (label: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState('');
  const CategoryIcon = CATEGORY_ICONS[category] ?? Package;
  const headingId = `checklist-${category.replace(/\s+/g, '-').toLowerCase()}`;
  // Under "Packed" the packed items are the list; elsewhere they fold away below it.
  const open = filter === 'packed' ? shown : shown.filter((i) => !i.packed);
  const folded = filter === 'packed' ? [] : shown.filter((i) => i.packed);
  const packedTotal = all.filter((i) => i.packed).length;

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (draft.trim() && (await onAdd(draft.trim()))) setDraft('');
  };

  const renderRow = (item: ChecklistItem) =>
    rows.editingId === item.id ? (
      <EditRow key={item.id} item={item} {...rows} />
    ) : (
      <ItemRow key={item.id} item={item} {...rows} />
    );

  return (
    <section className="checklist-group card" aria-labelledby={headingId}>
      <header className="checklist-group-head">
        <span className="checklist-group-icon" aria-hidden="true">
          <CategoryIcon size={18} weight="duotone" />
        </span>
        <h3 id={headingId}>{category}</h3>
        {all.length > 0 && (
          <span className={`checklist-group-count${packedTotal === all.length ? ' is-done' : ''}`}>
            {packedTotal}/{all.length}
          </span>
        )}
      </header>

      {open.length > 0 && <ul className="checklist-list">{open.map(renderRow)}</ul>}

      {filter === 'all' && (
        <form className="checklist-add" onSubmit={handleAdd}>
          <Plus size={16} aria-hidden className="checklist-add-icon" />
          <input
            aria-label={`Add to ${category}`}
            placeholder={all.length ? 'Add item' : `Add to ${category.toLowerCase()}`}
            maxLength={200}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          {draft.trim() && (
            <button type="submit" className="btn btn-sm">
              Add
            </button>
          )}
        </form>
      )}

      {folded.length > 0 && (
        <details className="checklist-folded">
          <summary>Packed ({folded.length})</summary>
          <ul className="checklist-list">{folded.map(renderRow)}</ul>
        </details>
      )}
    </section>
  );
}

function ItemRow({ item, memberNames, onToggle, onEdit }: RowHandlers & { item: ChecklistItem }) {
  const bringer = item.assigneeId ? (memberNames[item.assigneeId] ?? 'Former member') : null;
  return (
    <li className={`checklist-item${item.packed ? ' is-packed' : ''}`}>
      <label className="checklist-item-main">
        <input type="checkbox" className="visually-hidden" checked={item.packed} onChange={() => onToggle(item)} />
        <span className="checklist-box" aria-hidden="true">
          <Check size={13} weight="bold" />
        </span>
        <span className="checklist-item-label">{item.label}</span>
      </label>
      {bringer && (
        <span className="checklist-avatar" title={`${bringer} brings it`}>
          <span aria-hidden="true">{initials(bringer)}</span>
          <span className="visually-hidden">{bringer} brings it</span>
        </span>
      )}
      <button type="button" className="checklist-edit" aria-label={`Edit ${item.label}`} onClick={() => onEdit(item.id)}>
        <PencilSimple size={16} aria-hidden />
      </button>
    </li>
  );
}

function EditRow({ item, memberNames, shared, onEdit, onSave, onRemove }: RowHandlers & { item: ChecklistItem }) {
  const [label, setLabel] = useState(item.label);
  const [category, setCategory] = useState(item.category);
  const [assigneeId, setAssigneeId] = useState(item.assigneeId ?? '');
  const categories = [...new Set<string>([...CHECKLIST_CATEGORIES, item.category])];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (label.trim()) onSave(item, { label: label.trim(), category, assigneeId: assigneeId || null });
  };

  return (
    <li className="checklist-item is-editing">
      <form
        className="checklist-edit-form"
        onSubmit={handleSubmit}
        onKeyDown={(e) => e.key === 'Escape' && onEdit(null)}
      >
        <input
          aria-label="Item"
          maxLength={200}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
        />
        <div className="checklist-edit-fields">
          <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {shared && (
            <select aria-label="Who brings it" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Everyone brings their own</option>
              {Object.entries(memberNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name} brings it for the group
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="checklist-edit-actions">
          <button type="button" className="text-btn text-btn-danger" onClick={() => onRemove(item)}>
            Remove
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => onEdit(null)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-sm" disabled={!label.trim()}>
            Save
          </button>
        </div>
      </form>
    </li>
  );
}

/** Shaped like the loaded tab (progress bar, two category cards) so nothing jumps. */
function ChecklistSkeleton() {
  return (
    <div className="checklist" aria-busy="true" aria-label="Loading checklist">
      <div className="checklist-skeleton checklist-skeleton-bar" />
      <div className="checklist-board">
        {[4, 3].map((rows, i) => (
          <div className="checklist-group card" key={i}>
            <div className="checklist-skeleton checklist-skeleton-head" />
            {Array.from({ length: rows }, (_, r) => (
              <div className="checklist-skeleton checklist-skeleton-row" key={r} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
