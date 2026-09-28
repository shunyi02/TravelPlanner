import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { typeScale, useTheme } from '../theme';

/** The app's logo: the accent-colored triangle and the name, as in web's top bar. */
export function BrandMark() {
  const colors = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Cuti">
      <Svg width={24} height={24} viewBox="0 0 32 32">
        <Path d="M16 3 30 29H2z" fill={colors.route} />
      </Svg>
      <Text style={[styles.name, { color: colors.ink }]}>Cuti</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: typeScale.body + 1, fontWeight: '600', letterSpacing: -0.2 },
});
