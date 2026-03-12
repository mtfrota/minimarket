export type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "minimkt:theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return raw === "light" ? "light" : "dark";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light");
  root.classList.add(theme === "light" ? "theme-light" : "theme-dark");
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new Event("theme:changed"));
}

export function toggleTheme(theme: ThemeMode): ThemeMode {
  const next = theme === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
