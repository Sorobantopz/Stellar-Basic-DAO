import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/theme/ThemeContext';
import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../src/lib/i18n';

export function LocaleSwitcher() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();

  const changeLanguage = (lng: SupportedLanguage) => {
    i18n.changeLanguage(lng);
  };

  // i18n.language may briefly hold a non-normalized code (e.g. "en-US") —
  // fall back to a supported language for the picker selection.
  const activeLanguage = (SUPPORTED_LANGUAGES as readonly string[]).includes(
    i18n.language,
  )
    ? (i18n.language as SupportedLanguage)
    : 'en';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.textPrimary }]}>🌐 Language</Text>
      <Picker
        selectedValue={activeLanguage}
        onValueChange={changeLanguage}
        style={{ color: theme.textPrimary }}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <Picker.Item
            key={code}
            label={LANGUAGE_NAMES[code]}
            value={code}
          />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
});