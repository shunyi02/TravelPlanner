import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemeSetting, type ThemeColors } from '../src/theme';

export default function SettingsScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const { themeId, setThemeId, themes } = useThemeSetting();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.sectionLabel}>Theme</Text>
      <View style={styles.grid}>
        {themes.map((theme) => (
          <Pressable
            key={theme.id}
            style={[styles.swatch, { backgroundColor: theme.colors.bg, borderColor: colors.rule }]}
            onPress={() => setThemeId(theme.id)}
          >
            <View style={[styles.swatchDot, { backgroundColor: theme.colors.route }]} />
            <Text style={[styles.swatchName, { color: theme.colors.ink }]}>{theme.name}</Text>
            {themeId === theme.id && <Text style={[styles.checkmark, { color: theme.colors.route }]}>✓</Text>}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    sectionLabel: { fontSize: 13, color: colors.inkSoft, marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    swatch: {
      width: 130,
      height: 90,
      borderRadius: 8,
      borderWidth: 1,
      padding: 12,
      justifyContent: 'space-between',
    },
    swatchDot: { width: 20, height: 20, borderRadius: 10 },
    swatchName: { fontSize: 14, fontWeight: '600' },
    checkmark: { position: 'absolute', top: 8, right: 10, fontSize: 16, fontWeight: '700' },
  });
}
