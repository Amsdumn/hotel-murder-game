export type Language = "th" | "en";

export function normalizeLanguage(value: unknown): Language {
  return value === "en" ? "en" : "th";
}

export function localize(thai: string, english: string, language: Language): string {
  return language === "en" ? english : thai;
}

export function languageLabel(language: Language): string {
  return language === "en" ? "English" : "ไทย";
}
