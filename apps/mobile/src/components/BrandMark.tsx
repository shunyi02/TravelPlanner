import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { typeScale, useTheme } from '../theme';

/** The app's logo: the triangle and the name, as in web's top bar. `onHero` is
 *  for the dark banner, where the mark takes the warm highlight. */
export function BrandMark({ size = 'md', tone = 'default' }: { size?: 'md' | 'lg'; tone?: 'default' | 'onHero' }) {
  const colors = useTheme();
  const mark = size === 'lg' ? 34 : 24;
  return (
    <View style={[styles.row, size === 'lg' && styles.rowLg]} accessibilityRole="header" accessibilityLabel="Cuti">
      <Svg width={mark} height={mark} viewBox="0 0 32 32">
        <Path d="M16 3 30 29H2z" fill={tone === 'onHero' ? colors.highlight : colors.route} />
      </Svg>
      <Text
        style={[
          styles.name,
          size === 'lg' && styles.nameLg,
          { color: tone === 'onHero' ? colors.onHero : colors.ink },
        ]}
      >
        Cuti
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLg: { gap: 12 },
  name: { fontSize: typeScale.body + 1, fontWeight: '600', letterSpacing: -0.2 },
  nameLg: { fontSize: typeScale.title1, fontWeight: '700', letterSpacing: -0.6 },
});
