import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { COUNTRIES, countryName } from '@travel-planner/shared';
import { X } from '../icons';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Field, fieldStyles } from './Field';
import { Tappable } from './Tappable';

const MAX_RESULTS = 6;

/** A labelled country picker: type to filter, tap a suggestion. The value is
 *  an ISO 3166-1 alpha-2 code ("" for none); the input shows the country
 *  name. Same dropdown pattern as AirportField. */
export function CountryField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const inputStyles = fieldStyles(colors);
  const [query, setQuery] = useState<string | null>(null); // null while not typing
  const [focused, setFocused] = useState(false);

  const shown = query ?? countryName(value) ?? '';
  const needle = (query ?? '').trim().toLowerCase();
  const results =
    query === null
      ? []
      : COUNTRIES.filter((c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase() === needle).slice(
          0,
          MAX_RESULTS,
        );

  return (
    <Field label={label}>
      <View style={{ zIndex: 1 }}>
        <View>
          <TextInput
            accessibilityLabel={label}
            style={[inputStyles.input, focused && inputStyles.inputFocused, value ? styles.withClear : null]}
            placeholder="Search countries"
            placeholderTextColor={colors.inkSoft}
            value={shown}
            onChangeText={setQuery}
            onFocus={() => {
              setFocused(true);
              setQuery('');
            }}
            onBlur={() => {
              setFocused(false);
              // Let a tap on a suggestion land before the list closes.
              setTimeout(() => setQuery(null), 150);
            }}
            autoCorrect={false}
          />
          {value && query === null ? (
            <Tappable
              onPress={() => onChange('')}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${label.toLowerCase()}`}
              style={styles.clear}
              hitSlop={8}
            >
              <X size={16} color={colors.inkSoft} />
            </Tappable>
          ) : null}
        </View>
        {results.length > 0 && (
          <View style={styles.dropdown}>
            {results.map((c) => (
              <Tappable
                key={c.code}
                style={styles.dropdownItem}
                accessibilityRole="button"
                onPress={() => {
                  onChange(c.code);
                  setQuery(null);
                }}
              >
                <Text style={styles.dropdownText}>{c.name}</Text>
              </Tappable>
            ))}
          </View>
        )}
      </View>
    </Field>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    withClear: { paddingRight: 40 },
    clear: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
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
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    dropdownText: { color: colors.ink, fontSize: typeScale.subhead },
  });
}
