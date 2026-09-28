import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { radius, typeScale, useColorMode, useTheme, useThemeSetting, type Appearance, type ThemeColors } from '../src/theme';
import { Tappable } from '../src/components/Tappable';

const APPEARANCES: { id: Appearance; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const colors = useTheme();
  const mode = useColorMode();
  const styles = createStyles(colors);
  const { themeId, setThemeId, appearance, setAppearance, themes } = useThemeSetting();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
        {APPEARANCES.map((a) => {
          const selected = appearance === a.id;
          return (
            <Tappable
              key={a.id}
              onPress={() => setAppearance(a.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>{a.label}</Text>
            </Tappable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Theme colors</Text>
      <View style={styles.grid}>
        {themes.map((theme) => {
          const selected = themeId === theme.id;
          // Preview each theme in the mode the app is showing now.
          const preview = theme[mode];
          return (
            <Tappable
              key={theme.id}
              style={[
                styles.swatch,
                { backgroundColor: preview.bg, borderColor: selected ? preview.route : colors.rule },
                selected && styles.swatchSelected,
              ]}
              onPress={() => setThemeId(theme.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={theme.name}
            >
              <View style={[styles.swatchDot, { backgroundColor: preview.route }]} />
              <Text style={[styles.swatchName, { color: preview.ink }]}>{theme.name}</Text>
              {selected && <Text style={[styles.checkmark, { color: preview.route }]}>✓</Text>}
            </Tappable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    sectionLabel: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft, marginBottom: 12 },
    segmented: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      padding: 3,
      borderRadius: radius.sm + 2,
      backgroundColor: colors.rule,
    },
    segment: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: radius.sm },
    segmentSelected: { backgroundColor: colors.surface, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)' },
    segmentLabel: { fontSize: typeScale.footnote, fontWeight: '500', color: colors.inkSoft },
    segmentLabelSelected: { color: colors.ink, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    swatch: {
      width: 130,
      height: 90,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    swatchSelected: { borderWidth: 2, padding: 11 },
    swatchDot: { width: 20, height: 20, borderRadius: 10 },
    swatchName: { fontSize: typeScale.subhead, fontWeight: '600' },
    checkmark: { position: 'absolute', top: 8, right: 10, fontSize: typeScale.body, fontWeight: '700' },
  });
}
