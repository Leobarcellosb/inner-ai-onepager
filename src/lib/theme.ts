type Theme = 'dark' | 'light' | 'system';

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.toggle('light', resolved === 'light');
}

export function initTheme() {
  const stored = (localStorage.getItem('inner-theme') || 'dark') as Theme;
  applyTheme(stored);

  // Listen for system theme changes when in 'system' mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = (localStorage.getItem('inner-theme') || 'dark') as Theme;
    if (current === 'system') applyTheme('system');
  });
}

export function setTheme(theme: Theme) {
  localStorage.setItem('inner-theme', theme);
  applyTheme(theme);
}
