import { createElement, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { X } from '../icons';
import { radius, typeScale, useColorMode, useTheme } from '../theme';
import type { DateFieldProps } from './DateField';
import { Field } from './Field';

/** Web build of DateField: the browser's own date or datetime-local input, which
 *  react-native-community/datetimepicker doesn't provide on web. */
export function DateField({ label, mode = 'date', value, onChange, optional, hint, error }: DateFieldProps) {
  const colors = useTheme();
  const colorMode = useColorMode();
  const [focused, setFocused] = useState(false);

  return (
    <Field label={label} hint={hint} error={error}>
      <View>
        {createElement('input', {
          type: mode === 'date' ? 'date' : 'datetime-local',
          // The browser uses "T" between date and time; the forms use a space.
          value: value.replace(' ', 'T'),
          onChange: (e: { target: { value: string } }) => onChange(e.target.value.replace('T', ' ')),
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          'aria-label': label,
          style: {
            boxSizing: 'border-box',
            width: '100%',
            minHeight: 46,
            padding: `10px ${optional && value ? 40 : 14}px 10px 14px`,
            borderRadius: radius.sm + 2,
            border: `1px solid ${error ? colors.owe : focused ? colors.route : colors.rule}`,
            boxShadow: focused ? `0 0 0 3px ${colors.routeSoft}` : 'none',
            outline: 'none',
            backgroundColor: colors.surface,
            color: value ? colors.ink : colors.inkSoft,
            fontSize: typeScale.subhead,
            // The same system stack react-native-web gives Text; 'inherit' finds no font on a View.
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            fontVariantNumeric: 'tabular-nums',
            colorScheme: colorMode,
          },
        })}
        {optional && value !== '' && (
          <Pressable
            onPress={() => onChange('')}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            style={styles.clear}
          >
            <X size={16} color={colors.inkSoft} />
          </Pressable>
        )}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  clear: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
});
