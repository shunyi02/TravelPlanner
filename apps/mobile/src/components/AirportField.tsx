import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { findAirport, searchAirports } from '../airports';
import { useTheme, type ThemeColors } from '../theme';

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
  const [open, setOpen] = useState(false);
  const results = open ? searchAirports(value) : [];
  const resolved = findAirport(value);

  return (
    <View style={{ zIndex: 1 }}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        value={value}
        onChangeText={(v) => {
          onChange(v.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoCapitalize="characters"
      />
      {open && results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((a) => (
            <Pressable
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
            </Pressable>
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
    input: {
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 6,
      marginTop: 4,
      zIndex: 10,
      elevation: 4,
    },
    dropdownItem: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    dropdownText: { color: colors.ink, fontSize: 13 },
    hint: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  });
}
