import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { findAirport, searchAirports } from '../airports';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Tappable } from './Tappable';
import { fieldStyles } from './Field';

/** A plain text input for an IATA airport code, with an autosuggest dropdown
 *  (code/name/city match) and a resolved "code — name, city" hint once the
 *  typed value matches a known airport. Bundled data (see ../airports.ts) —
 *  no network call, so it also works for codes not in the list (just no hint). */
export function AirportField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const inputStyles = fieldStyles(colors);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const results = open ? searchAirports(value) : [];
  const resolved = findAirport(value);

  return (
    <View style={{ zIndex: 1 }}>
      <TextInput
        style={[inputStyles.input, focused && inputStyles.inputFocused]}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        value={value}
        onChangeText={(v) => {
          onChange(v.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          setTimeout(() => setOpen(false), 150);
        }}
        autoCapitalize="characters"
      />
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((a) => (
            <Tappable
              key={a.code}
              style={styles.dropdownItem}
              onPress={() => {
                onChange(a.code);
                setOpen(false);
              }}
            >
              <Text style={styles.dropdownText}>
                <Text style={{ fontWeight: '700' }}>{a.code}</Text> — {a.name}
                {a.city ? `, ${a.city}` : ''}
              </Text>
            </Tappable>
          ))}
        </View>
      )}
      {!open && resolved && (
        <Text style={styles.hint}>
          {resolved.name}
          {resolved.city ? `, ${resolved.city}` : ''}
        </Text>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.sm,
      marginTop: 4,
      zIndex: 10,
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
    },
    dropdownItem: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    dropdownText: { color: colors.ink, fontSize: typeScale.footnote },
    hint: { fontSize: typeScale.caption, color: colors.inkSoft, marginTop: 4 },
  });
}
