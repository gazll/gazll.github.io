/* The reader's display choices: theme and text size. Per-device conveniences,
   so localStorage, never the Sheet — and every access is guarded, because a
   private window can throw on it and the page must still render.

   Both land as attributes on <html> (data-theme, data-text), which is what the
   CSS keys on. The same two keys are read by the inline script in
   nuxt.config.ts before first paint; keep the names in step with it. */
export const THEME_KEY = 'gazll:theme';
export const TEXT_KEY = 'gazll:text-size';
export const THEMES = Object.freeze(['auto', 'light', 'dark']);
export const TEXT_SIZES = Object.freeze(['default', 'large', 'larger']);

function read(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch (error) { return fallback; }
}

function write(key, value, fallback) {
  try {
    if (value === fallback) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (error) { /* private mode: the choice lasts this page only */ }
}

export function readDisplayPrefs() {
  return { theme: read(THEME_KEY, THEMES, 'auto'), text: read(TEXT_KEY, TEXT_SIZES, 'default') };
}

/** Auto removes the attribute, so prefers-color-scheme decides again. */
export function applyDisplayPrefs(root, { theme, text }) {
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  if (text === 'large' || text === 'larger') root.dataset.text = text;
  else delete root.dataset.text;
}

export function saveDisplayPrefs(prefs) {
  write(THEME_KEY, prefs.theme, 'auto');
  write(TEXT_KEY, prefs.text, 'default');
}
