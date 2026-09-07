'use client';

import "@/lib/i18n";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
};

export function LocaleSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // i18next may report a regional variant (e.g. "en-US"); only the base
  // language maps to a shipped bundle, so derive the selected option from the
  // supported list and fall back to the default.
  const selected = (SUPPORTED_LANGUAGES as readonly string[]).includes(
    i18n.language,
  )
    ? i18n.language
    : DEFAULT_LANGUAGE;

  return (
    <select
      value={selected}
      onChange={(e) => changeLanguage(e.target.value)}
      aria-label="Language"
      className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-1 text-sm"
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <option key={lng} value={lng}>
          {LANGUAGE_LABELS[lng]}
        </option>
      ))}
    </select>
  );
}