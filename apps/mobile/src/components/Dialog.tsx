import { createContext, useCallback, useContext, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, typeScale, useTheme, type ThemeColors } from '../theme';
import { Button } from './Button';

export interface DialogAction {
  label: string;
  /** cancel = outlined, also what dismissing the dialog runs; destructive = red. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogOptions {
  title: string;
  message?: string;
  /** Defaults to a single "OK". */
  actions?: DialogAction[];
}

const DialogContext = createContext<(options: DialogOptions) => void>(() => {});

/**
 * In-app replacement for Alert.alert. react-native-web ignores Alert.alert's
 * buttons, so confirms and menus built on it did nothing in the browser; this
 * renders the same everywhere and follows the theme.
 */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const showDialog = useCallback((options: DialogOptions) => setDialog(options), []);

  const actions = dialog?.actions ?? [{ label: 'OK' }];
  const run = (action?: DialogAction) => {
    setDialog(null);
    action?.onPress?.();
  };
  const dismiss = () => run(actions.find((a) => a.style === 'cancel'));

  return (
    <DialogContext.Provider value={showDialog}>
      {children}
      <Modal visible={dialog !== null} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityLabel="Dismiss" />
          {dialog && (
            <View style={styles.card} accessibilityRole="alert">
              <Text style={styles.title}>{dialog.title}</Text>
              {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
              <View style={styles.actions}>
                {actions.map((action) => (
                  <Button
                    key={action.label}
                    label={action.label}
                    variant={action.style === 'cancel' ? 'secondary' : 'primary'}
                    tone={action.style === 'destructive' ? 'danger' : 'accent'}
                    onPress={() => run(action)}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  return useContext(DialogContext);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    card: {
      width: '100%',
      maxWidth: 360,
      padding: 20,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
    },
    title: { fontSize: typeScale.body, fontWeight: '600', color: colors.ink },
    message: { fontSize: typeScale.subhead, lineHeight: 21, color: colors.inkSoft, marginTop: 6 },
    actions: { gap: 10, marginTop: 20 },
  });
}
