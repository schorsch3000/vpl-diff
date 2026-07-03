// Light/dark/system theme toggle, persisted in localStorage.
//
// "system" is represented by the *absence* of a data-theme attribute, which
// lets css/style.css follow prefers-color-scheme automatically. Picking
// light/dark explicitly sets the attribute and overrides that.

const STORAGE_KEY = 'vpl-diff:theme';
const ORDER = ['system', 'light', 'dark'];
const LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' };
const ICON = { system: '\u{1F5A5}\u{FE0F}', light: '☀\u{FE0F}', dark: '\u{1F319}' };

function loadTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return ORDER.includes(t) ? t : 'system';
  } catch (e) {
    return 'system';
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch (e) {
    console.warn('Could not persist theme preference:', e);
  }
}

function applyTheme(theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function updateButton(button, theme) {
  button.textContent = `${ICON[theme]} ${LABEL[theme]}`;
  const label = `Color theme: ${LABEL[theme]} (click to change)`;
  button.setAttribute('aria-label', label);
  button.title = label;
}

export function initTheme(button) {
  let theme = loadTheme();
  applyTheme(theme);
  updateButton(button, theme);

  button.addEventListener('click', () => {
    theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    saveTheme(theme);
    applyTheme(theme);
    updateButton(button, theme);
  });
}
