/**
 * Status Bar Configuration
 * 状态栏配置和优化
 */

// 等待Capacitor加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 延迟执行，确保Capacitor插件已加载
  setTimeout(initStatusBar, 100);
});

function initStatusBar() {
  try {
    // 检测暗色模式
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 设置状态栏样式
    setStatusBarStyle(isDarkMode);
    
    // 监听系统主题变化
    watchThemeChanges();
    
  } catch (error) {
    console.warn('StatusBar plugin not available:', error);
  }
}

function setStatusBarStyle(isDarkMode) {
  try {
    // 检查Capacitor是否可用
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.StatusBar) {
      const StatusBar = Capacitor.Plugins.StatusBar;
      
      // 设置状态栏样式
      StatusBar.setStyle({ 
        style: isDarkMode ? 'DARK' : 'LIGHT'
      });
      
      // 根据当前页面设置状态栏背景色
      let backgroundColor;
      if (window.location.pathname.includes('calendar.html')) {
        // 日历页面使用特定的背景色
        backgroundColor = isDarkMode ? '#1a1a1a' : '#f8fafc';
      } else {
        // 其他页面使用默认背景色
        backgroundColor = isDarkMode ? '#18181c' : '#ffffff';
      }
      
      StatusBar.setBackgroundColor({ 
        color: backgroundColor 
      });
      
      // 确保状态栏不覆盖内容
      StatusBar.setOverlaysWebView({ 
        overlay: false 
      });
      
      console.log('Status bar configured successfully for', window.location.pathname, 'with color:', backgroundColor);
    }
  } catch (error) {
    console.warn('Failed to set status bar style:', error);
  }
}

function watchThemeChanges() {
  // 监听系统主题变化
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    setStatusBarStyle(e.matches);
  });
}

// 导出到全局作用域
window.statusBarManager = {
  setStatusBarStyle: setStatusBarStyle,
  initStatusBar: initStatusBar
};
