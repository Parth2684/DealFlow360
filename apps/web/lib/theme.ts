export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "dealflow360.theme";
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function storePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A blocked storage partition only costs persistence, not the theme swap.
  }
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

/**
 * `data-theme` is only written for an explicit choice so that the "system"
 * preference keeps following `color-scheme: light dark`.
 */
export function applyTheme(
  preference: ThemePreference,
  resolved: ResolvedTheme,
): void {
  const root = document.documentElement;

  if (preference === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", resolved);
  }

  root.setAttribute("data-theme-resolved", resolved);
}

/**
 * Runs before first paint so the stored theme is already on `<html>`, which is
 * what keeps a reload from flashing the wrong palette.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var p=(s==="light"||s==="dark"||s==="system")?s:"system";var r=p==="system"?(matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY,
)}).matches?"dark":"light"):p;var e=document.documentElement;if(p==="system"){e.removeAttribute("data-theme")}else{e.setAttribute("data-theme",r)}e.setAttribute("data-theme-resolved",r)}catch(_){}})()`;
