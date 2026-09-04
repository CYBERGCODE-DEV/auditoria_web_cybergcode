(() => {
  const STORAGE_KEY = 'cybergcode-audit-theme';
  const root = document.documentElement;
  const media = window.matchMedia?.('(prefers-color-scheme: light)');

  const resolve = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return media?.matches ? 'light' : 'dark';
  };

  const set = (theme, persist = true) => {
    const value = theme === 'light' ? 'light' : 'dark';
    root.dataset.theme = value;
    if (persist) localStorage.setItem(STORAGE_KEY, value);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', value === 'light' ? '#f5f7fa' : '#070b12');
    window.dispatchEvent(new CustomEvent('cybergcode-themechange', { detail: { theme: value } }));
    return value;
  };

  set(resolve(), false);
  window.CGAuditTheme = {
    get: () => root.dataset.theme || resolve(),
    set,
    toggle: () => set((root.dataset.theme || resolve()) === 'dark' ? 'light' : 'dark')
  };

  media?.addEventListener?.('change', () => {
    if (!localStorage.getItem(STORAGE_KEY)) set(resolve(), false);
  });
})();
