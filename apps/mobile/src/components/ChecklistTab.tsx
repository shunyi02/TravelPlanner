import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CHECKLIST_CATEGORIES, CHECKLIST_STARTERS } from '@travel-planner/shared';
import { api, type ChecklistItem } from '../api';
import {
  BatteryCharging,
  CaretDown,
  Check,
  Drop,
  FirstAidKit,
  IdentificationCard,
  Package,
  PencilSimple,
  Plus,
  Suitcase,
  Tent,
  TShirt,
} from '../icons';
import { initials } from '../initials';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';

type Filter = 'all' | 'todo' | 'mine' | 'packed';
type Styles = ReturnType<typeof createStyles>;

const CATEGORY_ICONS: Record<string, typeof Package> = {
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
export function ChecklistTab({
  tripId,
  memberNames,
  currentUserId,
}: {
  tripId: string;
  memberNames: Record<string, string>;
  currentUserId?: string;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  // null until the first load finishes, so loading never reads as an empty list.
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showStarters, setShowStarters] = useState(false);
  // A removal waiting out its undo window; it's already hidden from the list.
  const [removed, setRemoved] = useState<ChecklistItem | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRemoval = useRef<() => void>(() => {});

  const load = useCallback(() => {
    setError(null);
    api
      .listChecklist(tripId)
      .then((list) => {
        setItems(list);
        if (list.length === 0) setShowStarters(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the checklist'));
  }, [tripId]);

  useEffect(load, [load]);
  // Leaving the tab mid-undo still removes the item.
  useEffect(() => () => flushRemoval.current(), []);

  const fail = (fallback: string) => (err: unknown) => setError(err instanceof Error ? err.message : fallback);

  const replace = (updated: ChecklistItem) =>
    setItems((prev) => prev && prev.map((i) => (i.id === updated.id ? updated : i)));

  const add = async (data: { label: string; category: string }) => {
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
      clearTimeout(removeTimer.current);
      flushRemoval.current = () => {};
      setRemoved(null);
      api.deleteChecklistItem(tripId, item.id).catch((err) => {
        setItems((prev) => prev && [...prev, item].sort(byCreated));
        fail('Could not remove the item')(err);
      });
    };
    flushRemoval.current = send;
    removeTimer.current = setTimeout(send, UNDO_MS);
  };

  const undoRemove = () => {
    if (!removed) return;
    clearTimeout(removeTimer.current);
    flushRemoval.current = () => {};
    setItems((prev) => prev && [...prev, removed].sort(byCreated));
    setRemoved(null);
  };

  const unpackAll = () => api.unpackChecklist(tripId).then(setItems).catch(fail('Could not untick the list'));

  if (!items) {
    return error ? (
      <Text style={styles.error}>Couldn't load the checklist: {error}</Text>
    ) : (
      <View accessibilityLabel="Loading checklist">
        <View style={[styles.skeleton, { height: 76, borderRadius: radius.md, marginBottom: 20 }]} />
        {[60, 80, 45].map((w, i) => (
          <View key={i} style={[styles.skeleton, { width: `${w}%`, marginBottom: 18 }]} />
        ))}
      </View>
    );
  }

  const memberIds = Object.keys(memberNames);
  const shared = memberIds.length > 1;
  // "Mine" is what I have to pack: my own copy of everyday items plus what I bring for the group.
  const isMine = (i: ChecklistItem) => i.assigneeId === null || i.assigneeId === currentUserId;
  const inFilter = (i: ChecklistItem) =>
    filter === 'todo' ? !i.packed : filter === 'packed' ? i.packed : filter === 'mine' ? isMine(i) : true;

  const packedCount = items.filter((i) => i.packed).length;
  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'todo', label: 'To pack' },
    ...(shared && currentUserId ? [{ id: 'mine' as const, label: 'Mine' }] : []),
    { id: 'packed', label: 'Packed' },
  ];

  // Known categories in their set order, then any others (e.g. retired ones) after.
  const groups = [...new Set<string>([...CHECKLIST_CATEGORIES, ...items.map((i) => i.category)])]
    .map((cat) => ({ cat, all: items.filter((i) => i.category === cat) }))
    .map((g) => ({ ...g, shown: g.all.filter(inFilter) }))
    // Every category stays open for adding under "All"; other filters show only matches.
    .filter((g) =>
      filter === 'all' ? (CHECKLIST_CATEGORIES as readonly string[]).includes(g.cat) || g.all.length > 0 : g.shown.length > 0,
    );
  const starters = CHECKLIST_STARTERS.filter((s) => !items.some((i) => i.label.toLowerCase() === s.label.toLowerCase()));

  const rowProps = { styles, colors, memberNames, shared, editingId, onToggle: toggle, onEdit: setEditingId, onSave: save, onRemove: remove };

  return (
    <View>
      {items.length > 0 && (
        <View style={styles.bar}>
          <View style={styles.barTop}>
            <Text style={styles.barCount}>
              <Text style={styles.barCountBig}>{packedCount}</Text> of {items.length} packed
            </Text>
            {packedCount > 0 && <Button label="Untick all" variant="text" onPress={unpackAll} />}
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel="Packing progress"
            accessibilityValue={{ min: 0, max: items.length, now: packedCount }}
          >
            <View style={[styles.trackFill, { width: `${(packedCount / items.length) * 100}%` }]} />
          </View>
          <View style={styles.filters} accessibilityRole="tablist">
            {filters.map((f) => {
              const active = f.id === filter;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.filter, active && styles.filterActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {removed && (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Text style={styles.toastText} numberOfLines={1}>
            Removed “{removed.label}”
          </Text>
          <Pressable onPress={undoRemove} hitSlop={8} accessibilityRole="button">
            <Text style={styles.toastUndo}>Undo</Text>
          </Pressable>
        </View>
      )}

      {showStarters && starters.length > 0 && (
        <View style={styles.starters}>
          <View style={styles.startersHead}>
            <Suitcase size={28} weight="duotone" color={colors.route} />
            <View style={{ flex: 1 }}>
              <Text style={styles.startersTitle}>Start your packing list</Text>
              <Text style={styles.note}>Tap to add common items, or type your own into any category.</Text>
            </View>
            <Button label="Done" variant="text" onPress={() => setShowStarters(false)} />
          </View>
          <View style={styles.chips}>
            {starters.map((s) => (
              <Pressable
                key={s.label}
                onPress={() => add(s)}
                style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${s.label}`}
              >
                <Plus size={13} weight="bold" color={colors.route} />
                <Text style={styles.chipLabel}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {groups.length === 0 ? (
        <Text style={styles.note}>
          {filter === 'packed' ? 'Nothing packed yet.' : filter === 'mine' ? 'Nothing for you to pack.' : 'Everything is packed.'}
        </Text>
      ) : (
        groups.map((g) => (
          <CategorySection
            key={g.cat}
            category={g.cat}
            all={g.all}
            shown={g.shown}
            filter={filter}
            onAdd={(label) => add({ label, category: g.cat })}
            {...rowProps}
          />
        ))
      )}
    </View>
  );
}

interface RowProps {
  styles: Styles;
  colors: ThemeColors;
  memberNames: Record<string, string>;
  shared: boolean;
  editingId: string | null;
  onToggle: (item: ChecklistItem) => void;
  onEdit: (id: string | null) => void;
  onSave: (item: ChecklistItem, data: { label: string; category: string; assigneeId: string | null }) => void;
  onRemove: (item: ChecklistItem) => void;
}

function CategorySection({
  category,
  all,
  shown,
  filter,
  onAdd,
  ...rows
}: RowProps & {
  category: string;
  all: ChecklistItem[];
  shown: ChecklistItem[];
  filter: Filter;
  onAdd: (label: string) => Promise<boolean>;
}) {
  const { styles, colors } = rows;
  const [draft, setDraft] = useState('');
  const [showPacked, setShowPacked] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[category] ?? Package;
  // Under "Packed" the packed items are the list; elsewhere they fold away below it.
  const open = filter === 'packed' ? shown : shown.filter((i) => !i.packed);
  const folded = filter === 'packed' ? [] : shown.filter((i) => i.packed);
  const packedTotal = all.filter((i) => i.packed).length;
  const rowsShown = [...open, ...(showPacked ? folded : [])];

  const handleAdd = async () => {
    if (draft.trim() && (await onAdd(draft.trim()))) setDraft('');
  };

  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <View style={styles.groupIcon}>
          <CategoryIcon size={16} weight="duotone" color={colors.route} />
        </View>
        <Text style={styles.groupTitle} accessibilityRole="header">
          {category}
        </Text>
        {all.length > 0 && (
          <Text style={[styles.groupCount, packedTotal === all.length && { color: colors.route }]}>
            {packedTotal}/{all.length}
          </Text>
        )}
      </View>
      <View style={styles.card}>
        {rowsShown.map((item, i) => (
          <View key={item.id} style={i > 0 && styles.divider}>
            {rows.editingId === item.id ? <EditRow item={item} {...rows} /> : <ItemRow item={item} {...rows} />}
          </View>
        ))}

        {filter === 'all' && (
          <View style={[styles.addRow, rowsShown.length > 0 && styles.divider]}>
            <Plus size={16} color={colors.inkSoft} />
            <TextInput
              style={styles.addInput}
              placeholder={all.length ? 'Add item' : `Add to ${category.toLowerCase()}`}
              placeholderTextColor={colors.inkSoft}
              accessibilityLabel={`Add to ${category}`}
              maxLength={200}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={handleAdd}
              returnKeyType="done"
            />
            {draft.trim() !== '' && <Button label="Add" size="sm" onPress={handleAdd} />}
          </View>
        )}

        {folded.length > 0 && (
          <Pressable
            style={[styles.foldToggle, styles.divider]}
            onPress={() => setShowPacked((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showPacked }}
          >
            <Text style={styles.foldLabel}>
              {showPacked ? 'Hide packed' : `Packed (${folded.length})`}
            </Text>
            <View style={showPacked && { transform: [{ rotate: '180deg' }] }}>
              <CaretDown size={14} color={colors.inkSoft} />
            </View>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ItemRow({ item, styles, colors, memberNames, onToggle, onEdit }: RowProps & { item: ChecklistItem }) {
  const bringer = item.assigneeId ? (memberNames[item.assigneeId] ?? 'Former member') : null;
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.check}
        onPress={() => onToggle(item)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.packed }}
        accessibilityLabel={bringer ? `${item.label}, ${bringer} brings it` : item.label}
      >
        <View style={[styles.box, item.packed && styles.boxOn]}>
          {item.packed && <Check size={13} color={colors.onRoute} weight="bold" />}
        </View>
        <Text style={[styles.label, item.packed && styles.labelPacked]}>{item.label}</Text>
      </Pressable>
      {bringer && (
        <View style={styles.avatar} importantForAccessibility="no-hide-descendants">
          <Text style={styles.avatarText}>{initials(bringer)}</Text>
        </View>
      )}
      <Pressable
        onPress={() => onEdit(item.id)}
        hitSlop={6}
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.label}`}
      >
        <PencilSimple size={16} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}

function EditRow({ item, styles, colors, memberNames, shared, onEdit, onSave, onRemove }: RowProps & { item: ChecklistItem }) {
  const [label, setLabel] = useState(item.label);
  const [category, setCategory] = useState(item.category);
  const [assigneeId, setAssigneeId] = useState<string | null>(item.assigneeId);
  const categories = [...new Set<string>([...CHECKLIST_CATEGORIES, item.category])];
  const who: Array<{ id: string | null; label: string }> = [
    { id: null, label: 'Everyone' },
    ...Object.entries(memberNames).map(([id, name]) => ({ id, label: name })),
  ];

  const chip = (key: string, text: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[styles.pick, active && styles.pickActive]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.pickLabel, active && styles.pickLabelActive]}>{text}</Text>
    </Pressable>
  );

  return (
    <View style={styles.edit}>
      <TextInput
        style={styles.editInput}
        value={label}
        onChangeText={setLabel}
        maxLength={200}
        autoFocus
        accessibilityLabel="Item"
        placeholderTextColor={colors.inkSoft}
      />
      <Text style={styles.editLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
        {categories.map((c) => chip(c, c, c === category, () => setCategory(c)))}
      </ScrollView>
      {shared && (
        <>
          <Text style={styles.editLabel}>Who brings it</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
            {who.map((w) => chip(w.id ?? 'everyone', w.label, w.id === assigneeId, () => setAssigneeId(w.id)))}
          </ScrollView>
        </>
      )}
      <View style={styles.editActions}>
        <Button label="Remove" variant="text" tone="danger" onPress={() => onRemove(item)} style={{ marginRight: 'auto' }} />
        <Button label="Cancel" variant="secondary" size="sm" onPress={() => onEdit(null)} />
        <Button
          label="Save"
          size="sm"
          disabled={!label.trim()}
          onPress={() => onSave(item, { label: label.trim(), category, assigneeId })}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    error: { fontSize: typeScale.footnote, color: colors.owe, marginBottom: 12 },
    note: { fontSize: typeScale.footnote, lineHeight: 18, color: colors.inkSoft },
    skeleton: { height: 14, borderRadius: 4, backgroundColor: colors.rule },

    bar: { borderRadius: radius.md, backgroundColor: colors.surface, padding: 16, marginBottom: 20, gap: 12 },
    barTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    barCount: { fontSize: typeScale.subhead, color: colors.inkSoft },
    barCountBig: { fontSize: typeScale.title1, fontWeight: '700', letterSpacing: -0.5, color: colors.ink, fontVariant: ['tabular-nums'] },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.routeSoft, overflow: 'hidden' },
    trackFill: { height: '100%', borderRadius: 4, backgroundColor: colors.route },
    filters: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.pill, padding: 3, gap: 2 },
    filter: { flex: 1, minHeight: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    filterActive: { backgroundColor: colors.surface, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)' },
    filterLabel: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.inkSoft },
    filterLabelActive: { color: colors.ink, fontWeight: '600' },

    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: colors.hero,
      marginBottom: 16,
    },
    toastText: { flex: 1, fontSize: typeScale.subhead, color: '#ffffff' },
    toastUndo: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.highlight },

    starters: { borderRadius: radius.md, backgroundColor: colors.surface, padding: 16, marginBottom: 20 },
    startersHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
    startersTitle: { fontSize: typeScale.body, fontWeight: '700', color: colors.ink, marginBottom: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.rule,
    },
    chipLabel: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.ink },

    group: { marginBottom: 20 },
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    groupIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.routeSoft,
    },
    groupTitle: { flex: 1, fontSize: typeScale.body, fontWeight: '700', color: colors.ink },
    groupCount: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.inkSoft, fontVariant: ['tabular-nums'] },
    card: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },

    row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 6 },
    check: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingVertical: 12 },
    box: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: colors.inkSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxOn: { backgroundColor: colors.route, borderColor: colors.route },
    label: { flex: 1, fontSize: typeScale.subhead, color: colors.ink },
    labelPacked: { color: colors.inkSoft, textDecorationLine: 'line-through' },
    avatar: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bg,
    },
    avatarText: { fontSize: 11, fontWeight: '600', color: colors.ink },
    iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

    addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 17, paddingRight: 8, minHeight: 50 },
    addInput: { flex: 1, fontSize: typeScale.subhead, color: colors.ink, paddingVertical: 12 },

    foldToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44 },
    foldLabel: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.inkSoft },

    edit: { padding: 14, gap: 8, backgroundColor: colors.bg },
    editInput: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.route,
      backgroundColor: colors.surface,
      color: colors.ink,
      fontSize: typeScale.subhead,
    },
    editLabel: { fontSize: typeScale.caption, fontWeight: '600', color: colors.inkSoft, marginTop: 4 },
    pickRow: { gap: 6 },
    pick: {
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    pickActive: { backgroundColor: colors.routeSoft },
    pickLabel: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.inkSoft },
    pickLabelActive: { color: colors.route, fontWeight: '600' },
    editActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  });
}
