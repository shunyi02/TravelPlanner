import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { radius, typeScale, useTheme } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'text';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  /** primary = filled accent, secondary = outlined, text = bare label (row actions, links). */
  variant?: ButtonVariant;
  /** danger swaps the accent for the "owe" red — use for remove/delete/log out. */
  tone?: 'accent' | 'danger';
  size?: 'md' | 'sm';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** The app's one button: consistent sizing, a pressed state, and a 44pt-ish touch target. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'accent',
  size = 'md',
  disabled = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const colors = useTheme();
  const accent = tone === 'danger' ? colors.owe : colors.route;

  const shape =
    variant === 'primary'
      ? { backgroundColor: accent }
      : variant === 'secondary'
        ? { borderWidth: 1, borderColor: accent, backgroundColor: colors.surface }
        : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      // Text buttons are visually small; stretch the touch area instead of the layout.
      hitSlop={variant === 'text' ? 8 : undefined}
      style={({ pressed }) => [
        variant === 'text' ? styles.text : size === 'sm' ? styles.sm : styles.md,
        shape,
        disabled && styles.disabled,
        pressed && !disabled && (variant === 'text' ? styles.pressedText : styles.pressed),
        style,
      ]}
    >
      <Text
        style={[
          size === 'sm' || variant === 'text' ? styles.labelSm : styles.labelMd,
          { color: variant === 'primary' ? colors.onRoute : accent },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  md: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  labelMd: { fontSize: typeScale.subhead, fontWeight: '600' },
  labelSm: { fontSize: typeScale.subhead, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  pressedText: { opacity: 0.55 },
});
