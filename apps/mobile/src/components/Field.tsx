import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';

/** A form row: a visible label, the control, then a hint or an error. Placeholder
 *  text alone disappears as soon as someone types, so every input gets a label. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const colors = useTheme();
  const styles = fieldStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** A labelled text input in the app's input style, with a focus ring. */
export function TextField({
  label,
  hint,
  error,
  style,
  ...inputProps
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const colors = useTheme();
  const styles = fieldStyles(colors);
  const [focused, setFocused] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      <TextInput
        placeholderTextColor={colors.inkSoft}
        accessibilityLabel={label}
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused, !!error && styles.inputError, style]}
      />
    </Field>
  );
}

export function fieldStyles(colors: ThemeColors) {
  return StyleSheet.create({
    field: { marginBottom: 14 },
    label: { fontSize: typeScale.footnote, fontWeight: '600', color: colors.inkSoft, marginBottom: 6 },
    input: {
      minHeight: 46,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: radius.sm + 2,
      borderWidth: 1,
      borderColor: colors.rule,
      backgroundColor: colors.surface,
      color: colors.ink,
      fontSize: typeScale.subhead,
    },
    inputFocused: { borderColor: colors.route, boxShadow: `0 0 0 3px ${colors.routeSoft}` },
    inputError: { borderColor: colors.owe },
    hint: { fontSize: typeScale.caption, color: colors.inkSoft, marginTop: 5 },
    error: { fontSize: typeScale.caption, fontWeight: '500', color: colors.owe, marginTop: 5 },
  });
}
