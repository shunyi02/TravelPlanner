import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import RNDateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarBlank, X } from '../icons';
import { radius, typeScale, useColorMode, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';
import { Field, fieldStyles } from './Field';
import { formatValue, fromDate, toDate, type DateFieldMode } from './dateFieldValue';
import { Tappable } from './Tappable';

export interface DateFieldProps {
  label: string;
  mode?: DateFieldMode;
  value: string;
  onChange: (value: string) => void;
  /** Shows a clear button; the value can then be "". */
  optional?: boolean;
  /** Where the picker opens when the field is empty ("YYYY-MM-DD"). */
  defaultDay?: string;
  hint?: string;
  error?: string | null;
}

/** A labelled date (or date and time) field that opens the platform's own picker.
 *  The web build uses DateField.web.tsx. */
export function DateField({
  label,
  mode = 'date',
  value,
  onChange,
  optional,
  defaultDay,
  hint,
  error,
}: DateFieldProps) {
  const colors = useTheme();
  const colorMode = useColorMode();
  const styles = createStyles(colors);
  const inputStyles = fieldStyles(colors);
  const insets = useSafeAreaInsets();
  const [iosDraft, setIosDraft] = useState<Date | null>(null);

  const initial = () => toDate(value, mode) ?? toDate(defaultDay ?? '', 'date') ?? new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      // Android shows date and time as two separate dialogs.
      DateTimePickerAndroid.open({
        value: initial(),
        mode: 'date',
        onChange: (event, day) => {
          if (event.type !== 'set' || !day) return;
          if (mode === 'date') return onChange(fromDate(day, 'date'));
          DateTimePickerAndroid.open({
            value: day,
            mode: 'time',
            onChange: (e, time) => {
              if (e.type === 'set' && time) onChange(fromDate(time, 'datetime'));
            },
          });
        },
      });
    } else {
      setIosDraft(initial());
    }
  };

  const shown = formatValue(value, mode);

  return (
    <Field label={label} hint={hint} error={error}>
      <View>
        <Tappable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown || 'not set'}`}
          style={[inputStyles.input, styles.control, !!error && inputStyles.inputError]}
        >
          <CalendarBlank size={18} color={colors.inkSoft} />
          <Text style={[styles.value, !shown && { color: colors.inkSoft }]} numberOfLines={1}>
            {shown || (mode === 'date' ? 'Pick a date' : 'Pick a date and time')}
          </Text>
        </Tappable>
        {optional && value !== '' && (
          <Pressable
            onPress={() => onChange('')}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            hitSlop={8}
            style={styles.clear}
          >
            <X size={16} color={colors.inkSoft} />
          </Pressable>
        )}
      </View>

      <Modal visible={iosDraft !== null} transparent animationType="slide" onRequestClose={() => setIosDraft(null)}>
        <Pressable style={styles.backdrop} onPress={() => setIosDraft(null)} accessibilityLabel="Cancel" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHead}>
            <Button label="Cancel" variant="text" onPress={() => setIosDraft(null)} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <Button
              label="Done"
              variant="text"
              onPress={() => {
                if (iosDraft) onChange(fromDate(iosDraft, mode));
                setIosDraft(null);
              }}
            />
          </View>
          {iosDraft && (
            <RNDateTimePicker
              value={iosDraft}
              mode={mode}
              display="inline"
              themeVariant={colorMode}
              accentColor={colors.route}
              onChange={(_, d) => d && setIosDraft(d)}
            />
          )}
        </View>
      </Modal>
    </Field>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    control: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 40 },
    value: { flex: 1, fontSize: typeScale.subhead, color: colors.ink, fontVariant: ['tabular-nums'] },
    clear: { position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.35)' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: 12,
    },
    sheetHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 10,
    },
    sheetTitle: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink },
  });
}
