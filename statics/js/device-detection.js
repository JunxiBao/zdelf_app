/**
 * 设备检测和安全区适配
 * 用于检测Android/iOS设备并应用相应的安全区配置
 */

class DeviceDetection {
  constructor() {
    this.isAndroid = false;
    this.isIOS = false;
    this.isFullscreenSupported = false;
    
    this.detectDevice();
    this.applyDeviceSpecificStyles();
  }
  
  detectDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // 检测Android设备
    this.isAndroid = /android/.test(userAgent);
    
    // 检测iOS设备
    this.isIOS = /iphone|ipad|ipod/.test(userAgent);
    
    // 检测是否支持全屏API
    this.isFullscreenSupported = !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
    );
    
    // 检测Android设备特性（从MainActivity传递的信息）
    this.androidCapabilities = this.detectAndroidCapabilities();
    
    console.log('设备检测结果:', {
      isAndroid: this.isAndroid,
      isIOS: this.isIOS,
      isFullscreenSupported: this.isFullscreenSupported,
      androidCapabilities: this.androidCapabilities
    });
  }
  
  /**
   * 检测Android设备特性
   */
  detectAndroidCapabilities() {
    // 从MainActivity传递的设备信息
    if (window.deviceCapabilities) {
      return window.deviceCapabilities;
    }
    
    // 如果无法获取设备信息，使用默认值
    return {
      isNotchScreen: false,
      supportsFullscreen: true,
      sdkVersion: 0
    };
  }
  
  applyDeviceSpecificStyles() {
    const html = document.documentElement;
    const body = document.body;
    
    if (this.isAndroid) {
      // Android设备：根据设备特性应用相应样式
      html.classList.add('android-device');
      
      if (this.androidCapabilities.supportsFullscreen) {
        if (this.androidCapabilities.isNotchScreen) {
          // 挖孔屏设备：边缘到边缘显示
          body.classList.add('android-notch-screen');
          html.style.paddingTop = '0';
          html.style.paddingLeft = '0';
          html.style.paddingRight = '0';
          html.style.paddingBottom = '0';
          console.log('已应用Android挖孔屏边缘到边缘样式');
        } else {
          // 普通设备：完全全屏模式
          body.classList.add('android-fullscreen');
          html.style.paddingTop = '0';
          html.style.paddingLeft = '0';
          html.style.paddingRight = '0';
          html.style.paddingBottom = '0';
          console.log('已应用Android完全全屏模式样式');
        }
      } else {
        // 不支持全屏的设备：标准模式
        body.classList.add('android-standard');
        console.log('已应用Android标准模式样式');
      }
    } else if (this.isIOS) {
      // iOS设备：保持现有安全区配置
      html.classList.add('ios-device');
      body.classList.add('ios-safe-area');
      
      console.log('已应用iOS安全区样式');
    }
  }
  
  // 获取设备信息
  getDeviceInfo() {
    return {
      isAndroid: this.isAndroid,
      isIOS: this.isIOS,
      isFullscreenSupported: this.isFullscreenSupported,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  }
  
  // 监听屏幕方向变化
  handleOrientationChange() {
    setTimeout(() => {
      console.log('屏幕方向变化，重新应用样式');
      this.applyDeviceSpecificStyles();
    }, 100);
  }
  
  // 初始化事件监听
  init() {
    // 监听屏幕方向变化
    window.addEventListener('orientationchange', () => {
      this.handleOrientationChange();
    });
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      this.handleOrientationChange();
    });
    
    // 监听全屏状态变化
    document.addEventListener('fullscreenchange', () => {
      console.log('全屏状态变化');
      this.applyDeviceSpecificStyles();
    });
  }
}

// 创建全局实例
window.deviceDetection = new DeviceDetection();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.deviceDetection.init();
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeviceDetection;
}
