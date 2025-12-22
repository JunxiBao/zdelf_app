/**
 * URL工具函数 - 解决Android设备上的URL构建问题
 * 统一处理Capacitor环境和浏览器环境的URL构建
 */

class URLUtils {
  /**
   * 检测是否为Capacitor原生环境
   */
  static isCapacitorNative() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  
  /**
   * 构建页面URL
   * @param {string} path - 页面路径，如 'src/calendar.html'
   * @param {Object} params - URL参数对象
   * @returns {string} 完整的URL
   */
  static buildPageUrl(path, params = {}) {
    let url = path;
    
    // 添加参数
    if (Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, value);
      });
      url += `?${searchParams.toString()}`;
    }
    
    console.log('🔗 构建页面URL:', url);
    return url;
  }
  
  /**
   * 跳转到指定页面
   * @param {string} path - 页面路径
   * @param {Object} params - URL参数
   */
  static navigateTo(path, params = {}) {
    const url = this.buildPageUrl(path, params);
    window.location.href = url;
  }
  
  /**
   * 获取当前页面的基础路径
   * @returns {string} 基础路径
   */
  static getBasePath() {
    if (this.isCapacitorNative()) {
      return '';
    } else {
      return window.location.pathname.replace('/index.html', '').replace('/daily.html', '');
    }
  }
  
  /**
   * 构建完整的页面URL（用于浏览器环境）
   * @param {string} path - 页面路径
   * @param {Object} params - URL参数
   * @returns {string} 完整的URL
   */
  static buildFullUrl(path, params = {}) {
    if (this.isCapacitorNative()) {
      return this.buildPageUrl(path, params);
    } else {
      const basePath = this.getBasePath();
      const fullPath = `${basePath}/${path}`;
      let url = `${window.location.origin}${fullPath}`;
      
      if (Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          searchParams.append(key, value);
        });
        url += `?${searchParams.toString()}`;
      }
      
      return url;
    }
  }
  
  /**
   * 解析URL参数
   * @param {string} search - URL搜索字符串
   * @returns {Object} 参数对象
   */
  static parseUrlParams(search = window.location.search) {
    const params = {};
    const urlParams = new URLSearchParams(search);
    
    for (const [key, value] of urlParams.entries()) {
      params[key] = value;
    }
    
    return params;
  }
  
  /**
   * 获取当前日期字符串
   * @param {Date} date - 日期对象，默认为今天
   * @returns {string} 格式化的日期字符串 YYYY-MM-DD
   */
  static getDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// 导出到全局
window.URLUtils = URLUtils;

// 兼容性：提供简化的API
window.navigateTo = (path, params) => URLUtils.navigateTo(path, params);
window.buildPageUrl = (path, params) => URLUtils.buildPageUrl(path, params);
window.getDateString = (date) => URLUtils.getDateString(date);
window.parseUrlParams = (search) => URLUtils.parseUrlParams(search);

console.log('✅ URL工具函数已加载');
