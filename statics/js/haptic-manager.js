/**
 * 统一震动反馈管理系统
 * Unified Haptic Feedback Manager
 * 
 * 功能特性:
 * - 防止重复触发 (防抖机制)
 * - 统一管理所有震动反馈
 * - 支持原生和Web环境
 * - 可配置的震动强度
 * - 全局开关控制
 */

(function() {
  'use strict';

  // 检测是否为原生环境
  const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  
  // 获取Haptics插件
  function getHaptics() {
    const C = window.Capacitor || {};
    return (C.Plugins && C.Plugins.Haptics) || window.Haptics || C.Haptics || null;
  }

  // 检查震动是否启用
  function isVibrationEnabled() {
    try {
      const v = localStorage.getItem('vibration_enabled');
      return v === null ? true : v === 'true';
    } catch (_) {
      return true;
    }
  }

  // 防抖记录器 - 防止短时间内重复触发
  const debounceMap = new Map();
  const DEFAULT_DEBOUNCE_TIME = 100; // 毫秒

  /**
   * 核心震动反馈函数
   * @param {string} style - 震动强度: 'Light' | 'Medium' | 'Heavy'
   * @param {Object} options - 可选配置
   * @param {number} options.debounce - 防抖时间(ms)，默认100ms
   * @param {string} options.context - 上下文标识，用于更精细的防抖控制
   */
  function hapticImpact(style = 'Light', options = {}) {
    // 检查是否启用震动
    if (!isVibrationEnabled()) return;

    // 防抖处理
    const debounceTime = options.debounce !== undefined ? options.debounce : DEFAULT_DEBOUNCE_TIME;
    const context = options.context || 'default';
    const debounceKey = `${context}_${style}`;
    
    const now = Date.now();
    const lastTime = debounceMap.get(debounceKey);
    
    if (lastTime && (now - lastTime) < debounceTime) {
      // console.log(`🔇 震动被防抖过滤: ${debounceKey}`);
      return; // 在防抖时间内，忽略此次触发
    }
    
    debounceMap.set(debounceKey, now);

    // Web环境回退
    if (!isNative) {
      try {
        if (navigator.vibrate) {
          const map = { Light: 10, Medium: 20, Heavy: 30 };
          navigator.vibrate(map[style] || 10);
        }
      } catch (_) {}
      return;
    }

    // 原生环境
    const h = getHaptics();
    if (!h) return;
    
    try {
      if (h.impact && typeof h.impact === 'function') {
        h.impact({ style });
      }
    } catch (e) {
      console.warn('Haptic feedback error:', e);
    }
  }

  /**
   * 通知型震动 - 用于成功/警告/错误提示
   * @param {string} type - 'success' | 'warning' | 'error'
   */
  function hapticNotification(type = 'success') {
    if (!isVibrationEnabled()) return;
    if (!isNative) {
      // Web环境使用不同的震动模式
      try {
        if (navigator.vibrate) {
          const patterns = {
            success: [10, 50, 10],
            warning: [20, 100, 20],
            error: [30, 100, 30, 100, 30]
          };
          navigator.vibrate(patterns[type] || [10]);
        }
      } catch (_) {}
      return;
    }

    const h = getHaptics();
    if (!h) return;
    
    try {
      if (h.notification && typeof h.notification === 'function') {
        h.notification({ type });
      }
    } catch (e) {
      console.warn('Haptic notification error:', e);
    }
  }

  /**
   * 选择型震动 - 用于滑动选择等场景
   */
  function hapticSelection() {
    if (!isVibrationEnabled()) return;
    
    if (!isNative) {
      try {
        if (navigator.vibrate) {
          navigator.vibrate(5);
        }
      } catch (_) {}
      return;
    }

    const h = getHaptics();
    if (!h) return;
    
    try {
      if (h.selectionStart && typeof h.selectionStart === 'function') {
        h.selectionStart();
      }
    } catch (e) {
      console.warn('Haptic selection error:', e);
    }
  }

  /**
   * 清理防抖记录 - 用于页面卸载时清理
   */
  function clearDebounce() {
    debounceMap.clear();
  }

  /**
   * 设置震动开关
   * @param {boolean} enabled 
   */
  function setVibrationEnabled(enabled) {
    try {
      localStorage.setItem('vibration_enabled', enabled ? 'true' : 'false');
    } catch (_) {}
  }

  // 全局API暴露
  window.HapticManager = {
    impact: hapticImpact,
    notification: hapticNotification,
    selection: hapticSelection,
    clearDebounce: clearDebounce,
    isEnabled: isVibrationEnabled,
    setEnabled: setVibrationEnabled
  };

  // 向后兼容 - 保留旧的全局函数
  window.__hapticImpact__ = hapticImpact;

  console.log('✅ HapticManager 已初始化');
})();

