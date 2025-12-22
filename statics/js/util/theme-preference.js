(function () {
  const STORAGE_KEY = 'theme_preference_mode';
  const ALLOWED = new Set(['system', 'light', 'dark']);
  const capacitor = window.Capacitor;
  const themePlugin = capacitor?.Plugins?.ThemePreference || null;

  const normalize = (mode) => (ALLOWED.has(mode) ? mode : 'system');

  const savePreference = (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
  };

  const getPreference = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalize(stored || 'system');
  };

  const applyDomPreference = (mode) => {
    document.documentElement.dataset.themePreference = mode;
    if (mode === 'dark') {
      document.documentElement.style.colorScheme = 'dark';
    } else if (mode === 'light') {
      document.documentElement.style.colorScheme = 'light';
    } else {
      document.documentElement.style.removeProperty('color-scheme');
    }
  };

  const syncStatusBar = () => {
    try {
      if (typeof window.applyStatusBarTheme === 'function') {
        window.applyStatusBarTheme();
      }
    } catch (err) {
      console.warn('[theme-preference] 更新状态栏样式失败:', err);
    }
  };

  const syncNative = async (mode) => {
    if (!capacitor?.isNativePlatform || !capacitor.isNativePlatform()) return;
    if (!themePlugin) {
      console.warn('[theme-preference] 原生插件未找到，使用网页样式');
      return;
    }
    try {
      await themePlugin.setTheme({ mode });
      console.log('[theme-preference] 原生主题已设置:', mode);
    } catch (err) {
      console.warn('[theme-preference] 原生主题切换失败，将继续使用网页样式:', err);
    }
  };

  async function setPreference(mode) {
    const normalized = normalize(mode);
    savePreference(normalized);
    applyDomPreference(normalized);
    await syncNative(normalized);
    syncStatusBar();
    return normalized;
  }

  async function applyStoredPreference() {
    const mode = getPreference();
    applyDomPreference(mode);
    await syncNative(mode);
    syncStatusBar();
    return mode;
  }

  // 跟随系统主题变化（仅在选择“跟随系统”时生效）
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (getPreference() === 'system') {
        applyDomPreference('system');
        syncNative('system');
        syncStatusBar();
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handleChange);
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(handleChange);
    }
  }

  window.ThemePreferenceManager = {
    setPreference,
    applyStoredPreference,
    getPreference,
  };

  // 页面加载时自动应用本地偏好
  applyStoredPreference().catch((err) => {
    console.warn('[theme-preference] 应用主题偏好失败:', err);
  });
})();
