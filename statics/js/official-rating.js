/**
 * 官方Capacitor评分插件
 * 使用@capacitor-community/in-app-review
 */

class OfficialRating {
  constructor() {
    this.isInitialized = false;
    this.init();
  }

  async init() {
    try {
      // 等待Capacitor加载
      if (window.Capacitor) {
        this.isInitialized = true;
        console.log('OfficialRating插件初始化成功');
      } else {
        // 延迟重试
        setTimeout(() => this.init(), 100);
      }
    } catch (error) {
      console.error('OfficialRating插件初始化失败:', error);
    }
  }

  async requestReview() {
    if (!this.isInitialized) {
      throw new Error('插件未初始化');
    }

    // 只在iOS原生环境中调用原生StoreKit
    if (window.Capacitor && window.Capacitor.isNativePlatform() && window.Capacitor.getPlatform() === 'ios') {
      try {
        // 使用官方插件调用原生StoreKit
        if (window.Capacitor.Plugins && window.Capacitor.Plugins.InAppReview) {
          const result = await window.Capacitor.Plugins.InAppReview.requestReview();
          console.log('官方原生StoreKit评分弹窗已显示:', result);
          return result;
        } else {
          throw new Error('InAppReview插件不可用');
        }
      } catch (error) {
        console.error('原生StoreKit调用失败:', error);
        throw error;
      }
    } else {
      // 非iOS环境不显示评分弹窗
      console.log('非iOS环境：评分功能不可用');
      return;
    }
  }
}

// 创建全局实例
window.OfficialRating = new OfficialRating();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfficialRating;
}
