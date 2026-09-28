import { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { paperForLocale, renderItinerarySheet, themeDefinitionById, type PaperSize } from '@travel-planner/shared';
import type { TripDetail } from '../api';
import { radius, typeScale, useTheme, useThemeSetting, type ThemeColors } from '../theme';
import { Button } from './Button';
import { Tappable } from './Tappable';

/** Page size in PostScript points, which expo-print takes. */
const PAGE_POINTS: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 595, height: 842 },
  Letter: { width: 612, height: 792 },
};

function formatDay(day: string): string {
  return new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** On the web build, print the sheet from a hidden iframe: expo-print's
 *  printAsync prints the current page there, not the given HTML. */
function printOnWeb(document: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = window.document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.onload = () => {
      const win = frame.contentWindow;
      const done = () => {
        frame.remove();
        resolve();
      };
      if (!win) return done();
      win.addEventListener('afterprint', () => setTimeout(done, 0));
      win.focus();
      win.print();
    };
    frame.srcdoc = document;
    window.document.body.appendChild(frame);
  });
}

/** Export options for the itinerary (whole trip or one day, everyone or one
 *  person, what to show), then a PDF to share. The pages come from the shared
 *  itinerary sheet, the same one web prints. */
export function ExportSheet({
  visible,
  trip,
  days,
  onClose,
}: {
  visible: boolean;
  trip: TripDetail;
  /** The trip's days ("YYYY-MM-DD"); empty when it has no dates. */
  days: string[];
  onClose: () => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { themeId } = useThemeSetting();
  const memberNames = Object.fromEntries(trip.members.map((m) => [m.userId, m.user.name]));
  const memberIds = Object.keys(memberNames);

  const [scope, setScope] = useState<'trip' | 'day'>('trip');
  const [day, setDay] = useState(days[0] ?? '');
  const [person, setPerson] = useState<string | null>(null);
  const [include, setInclude] = useState({ map: true, notes: true, checkboxes: true });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setWorking(true);
    setError(null);
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      const paper = paperForLocale(locale);
      const sheet = renderItinerarySheet(trip, memberNames, {
        scope: scope === 'day' && day ? 'day' : 'trip',
        day: scope === 'day' ? day : undefined,
        personId: person,
        include,
        variant: 'print',
        paper,
        // Exports are always light and on-brand, even when the app is in dark mode.
        palette: themeDefinitionById(themeId).light,
        // iOS takes margins from expo-print; Android reads them from @page.
        cssPageMargins: Platform.OS !== 'ios',
      });

      if (Platform.OS === 'web') {
        await printOnWeb(sheet.document);
        onClose();
        return;
      }

      const { uri } = await Print.printToFileAsync({
        html: sheet.document,
        ...PAGE_POINTS[paper],
        margins: { left: 40, right: 40, top: 40, bottom: 46 },
      });
      // expo-print names the file randomly; give it the trip's name so it's
      // recognisable wherever it's shared or saved.
      const named = new File(Paths.cache, `${sheet.title}.pdf`);
      await new File(uri).move(named, { overwrite: true });

      if (!(await Sharing.isAvailableAsync())) {
        setError('Sharing isn’t available on this device.');
        return;
      }
      await Sharing.shareAsync(named.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: sheet.title,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t create the PDF. Try again.');
    } finally {
      setWorking(false);
    }
  };

  const chip = (key: string, label: string, selected: boolean, onPress: () => void, disabled = false) => (
    <Tappable
      key={key}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.chip, selected && styles.chipSelected, disabled && { opacity: 0.45 }]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Tappable>
  );

  const toggles: Array<[keyof typeof include, string, string]> = [
    ['map', 'Route maps', 'A sketch of each day, numbered like the list'],
    ['notes', 'Notes', 'What you wrote on each stop'],
    ['checkboxes', 'Tick boxes', 'To tick stops off on a printed copy'],
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Button label="Cancel" variant="text" onPress={onClose} disabled={working} />
          <Text style={styles.title}>Export itinerary</Text>
          <View style={{ width: 52 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.label}>What to include</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {chip('trip', days.length ? `Whole trip, ${days.length} days` : 'Whole trip', scope === 'trip', () => setScope('trip'))}
            {chip('day', 'One day', scope === 'day', () => setScope('day'), days.length === 0)}
          </View>
          {scope === 'day' && days.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { marginTop: 10 }]}>
              {days.map((d, i) => chip(d, `Day ${i + 1} · ${formatDay(d)}`, day === d, () => setDay(d)))}
            </ScrollView>
          )}

          {memberIds.length > 1 && (
            <>
              <Text style={[styles.label, styles.gap]}>Whose plan</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {chip('all', 'Everyone', person === null, () => setPerson(null))}
                {memberIds.map((id) => chip(id, memberNames[id] ?? 'Member', person === id, () => setPerson(id)))}
              </View>
            </>
          )}

          <Text style={[styles.label, styles.gap]}>Show</Text>
          <View style={styles.card}>
            {toggles.map(([key, label, hint], i) => (
              <View key={key} style={[styles.toggleRow, i < toggles.length - 1 && styles.divider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{label}</Text>
                  <Text style={styles.toggleHint}>{hint}</Text>
                </View>
                <Switch
                  value={include[key]}
                  onValueChange={(v) => setInclude((prev) => ({ ...prev, [key]: v }))}
                  trackColor={{ true: colors.route, false: colors.rule }}
                  accessibilityLabel={label}
                />
              </View>
            ))}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label={working ? 'Creating PDF…' : Platform.OS === 'web' ? 'Print or save as PDF' : 'Share PDF'}
            onPress={handleExport}
            disabled={working}
            style={{ marginTop: 24 }}
          />
          <Text style={styles.note}>
            {Platform.OS === 'web'
              ? 'Choose Save as PDF in the print window, and turn off its headers and footers for a clean page.'
              : 'Save it to Files, or send it straight to your travel group.'}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: colors.bg },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.rule,
    },
    title: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink },
    body: { padding: 20 },
    label: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft, marginBottom: 8 },
    gap: { marginTop: 22 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.rule,
      backgroundColor: colors.surface,
    },
    chipSelected: { backgroundColor: colors.route, borderColor: colors.route },
    chipText: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.ink },
    chipTextSelected: { color: colors.onRoute, fontWeight: '600' },
    card: { borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 14 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
    toggleLabel: { fontSize: typeScale.subhead, fontWeight: '600', color: colors.ink },
    toggleHint: { fontSize: typeScale.footnote, color: colors.inkSoft, marginTop: 1 },
    error: { fontSize: typeScale.footnote, color: colors.owe, marginTop: 16 },
    note: { fontSize: typeScale.footnote, lineHeight: 18, color: colors.inkSoft, marginTop: 10, textAlign: 'center' },
  });
}
