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
    
    // 跨平台安全区适配
    adaptSafeArea();
    
    // 监听窗口大小变化，重新适配
    window.addEventListener('resize', debounce(adaptSafeArea, 300));
    
    // 监听设备方向变化
    window.addEventListener('orientationchange', debounce(adaptSafeArea, 500));
    
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

// 跨平台安全区适配
function adaptSafeArea() {
  try {
    const platform = typeof Capacitor !== 'undefined' ? Capacitor.getPlatform() : 'web';
    console.log('检测到平台:', platform, '开始适配安全区');
    
    // 获取安全区信息
    const safeAreaInfo = getSafeAreaInfo();
    console.log('安全区信息:', safeAreaInfo);
    
    // 动态调整导航栏
    const navContainer = document.querySelector('.nav-container');
    if (navContainer) {
      // 应用安全区padding
      navContainer.style.paddingTop = `${safeAreaInfo.top}px`;
      navContainer.style.paddingLeft = `${safeAreaInfo.left}px`;
      navContainer.style.paddingRight = `${safeAreaInfo.right}px`;
      navContainer.style.paddingBottom = `${safeAreaInfo.bottom}px`;
      
      // 调整最小高度
      const minHeight = 80 + safeAreaInfo.bottom;
      navContainer.style.minHeight = `${minHeight}px`;
      
      console.log('导航栏安全区适配完成');
    }
    
    // 调整内容区域
    const content = document.querySelector('.content');
    if (content) {
      content.style.paddingLeft = `${Math.max(20, safeAreaInfo.left)}px`;
      content.style.paddingRight = `${Math.max(20, safeAreaInfo.right)}px`;
      content.style.bottom = `${80 + safeAreaInfo.bottom}px`;
      
      console.log('内容区域安全区适配完成');
    }
    
  } catch (error) {
    console.warn('安全区适配失败:', error);
  }
}

// 获取安全区信息
function getSafeAreaInfo() {
  try {
    const computedStyle = getComputedStyle(document.documentElement);
    
    return {
      top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
      right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
      bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')
    };
  } catch (error) {
    console.warn('获取安全区信息失败:', error);
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

// Android底部导航栏适配（保持向后兼容）
function adaptAndroidNavigationBar() {
  adaptSafeArea();
}

// 检测设备是否有底部导航栏
function detectBottomNavigation() {
  try {
    // 方法1: 通过视口高度检测
    const viewportHeight = window.innerHeight;
    const screenHeight = window.screen.height;
    const heightDifference = screenHeight - viewportHeight;
    
    // 方法2: 通过CSS环境变量检测
    const safeAreaBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom');
    
    // 方法3: 通过用户代理检测特定设备
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = userAgent.includes('android');
    
    // 综合判断
    const hasBottomNav = heightDifference > 100 || 
                        (safeAreaBottom && parseInt(safeAreaBottom) > 0) ||
                        (isAndroid && heightDifference > 50);
    
    console.log('底部导航栏检测结果:', {
      viewportHeight,
      screenHeight,
      heightDifference,
      safeAreaBottom,
      isAndroid,
      hasBottomNav
    });
    
    return hasBottomNav;
  } catch (error) {
    console.warn('检测底部导航栏失败:', error);
    return false;
  }
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 导出到全局作用域
window.statusBarManager = {
  setStatusBarStyle: setStatusBarStyle,
  initStatusBar: initStatusBar,
  adaptSafeArea: adaptSafeArea,
  adaptAndroidNavigationBar: adaptAndroidNavigationBar,
  getSafeAreaInfo: getSafeAreaInfo
};
