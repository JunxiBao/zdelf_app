/**
 * animation-performance.js — 动画性能监控和优化
 * 监控动画性能并提供优化建议
 */

(function() {
  'use strict';

  class AnimationPerformanceMonitor {
    constructor() {
      this.isEnabled = true;
      this.metrics = {
        fps: [],
        frameDrops: 0,
        animationCount: 0,
        memoryUsage: [],
        renderTime: []
      };
      
      this.thresholds = {
        minFPS: 30,
        maxFrameDrops: 5,
        maxAnimations: 10
      };

      this.init();
    }

    init() {
      if (!this.isEnabled || !window.performance) return;

      this.startFPSMonitoring();
      this.monitorAnimations();
      this.optimizeBasedOnDevice();
      this.setupPerformanceObserver();
    }

    // FPS监控
    startFPSMonitoring() {
      let lastTime = performance.now();
      let frameCount = 0;

      const measureFPS = (currentTime) => {
        frameCount++;
        
        if (currentTime - lastTime >= 1000) {
          const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
          this.metrics.fps.push(fps);
          
          // 保持最近10秒的数据
          if (this.metrics.fps.length > 10) {
            this.metrics.fps.shift();
          }

          // 检测帧率下降
          if (fps < this.thresholds.minFPS) {
            this.metrics.frameDrops++;
            this.handleLowFPS(fps);
          }

          frameCount = 0;
          lastTime = currentTime;
        }

        if (this.isEnabled) {
          requestAnimationFrame(measureFPS);
        }
      };

      requestAnimationFrame(measureFPS);
    }

    // 动画数量监控
    monitorAnimations() {
      const originalAnimate = Element.prototype.animate;
      const monitor = this;

      Element.prototype.animate = function(keyframes, options) {
        monitor.metrics.animationCount++;
        
        const animation = originalAnimate.call(this, keyframes, options);
        
        animation.addEventListener('finish', () => {
          monitor.metrics.animationCount--;
        });

        animation.addEventListener('cancel', () => {
          monitor.metrics.animationCount--;
        });

        // 检查是否有太多并发动画
        if (monitor.metrics.animationCount > monitor.thresholds.maxAnimations) {
          monitor.handleTooManyAnimations();
        }

        return animation;
      };
    }

    // 设备性能检测和优化
    optimizeBasedOnDevice() {
      const deviceInfo = this.getDeviceInfo();
      
      if (deviceInfo.isLowEnd) {
        this.applyLowEndOptimizations();
      }

      if (deviceInfo.isMobile) {
        this.applyMobileOptimizations();
      }

      if (deviceInfo.hasLimitedMemory) {
        this.applyMemoryOptimizations();
      }
    }

    getDeviceInfo() {
      const info = {
        isLowEnd: false,
        isMobile: false,
        hasLimitedMemory: false,
        cores: navigator.hardwareConcurrency || 2,
        memory: navigator.deviceMemory || 2
      };

      // 检测移动设备
      info.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // 检测低端设备
      info.isLowEnd = info.cores < 4 || info.memory < 4 || 
                      (info.isMobile && window.innerWidth < 768);
      
      // 检测内存限制
      info.hasLimitedMemory = info.memory < 2;

      return info;
    }

    applyLowEndOptimizations() {
      console.log('🔧 应用低端设备优化');
      
      // 减少动画持续时间
      document.documentElement.style.setProperty('--duration-fast', '0.1s');
      document.documentElement.style.setProperty('--duration-normal', '0.2s');
      document.documentElement.style.setProperty('--duration-slow', '0.3s');
      
      // 禁用复杂动画
      this.disableComplexAnimations();
      
      // 减少阴影效果
      this.reduceShadowEffects();
    }

    applyMobileOptimizations() {
      console.log('📱 应用移动设备优化');
      
      // 优化触摸延迟
      document.addEventListener('touchstart', () => {}, { passive: true });
      
      // 减少悬停效果（移动设备不需要）
      const style = document.createElement('style');
      style.id = 'mobile-animation-optimizations';
      style.textContent = `
        @media (hover: none) {
          .hover-lift:hover,
          .hover-scale:hover,
          .card-hover:hover,
          .btn-enhanced:hover,
          .nav-item-enhanced:hover {
            transform: none !important;
            box-shadow: inherit !important;
          }
          
          /* 移动设备上的触摸反馈 */
          .hover-lift:active,
          .card-hover:active {
            transform: translateY(-1px) !important;
            transition-duration: 0.1s !important;
          }
          
          .hover-scale:active {
            transform: scale(0.98) !important;
            transition-duration: 0.1s !important;
          }
        }
        
        @media (max-width: 768px) {
          /* 减少移动端动画复杂度 */
          .animate-bounceIn,
          .animate-bounceInUp,
          .animate-wobble,
          .animate-swing {
            animation: fadeInUp 0.2s ease both !important;
          }
          
          /* 优化涟漪效果 */
          .ripple-effect {
            animation-duration: 0.3s !important;
          }
          
          /* 简化页面转场 */
          .page-transition-enter {
            animation-duration: 0.2s !important;
          }
          
          .page-transition-exit {
            animation-duration: 0.15s !important;
          }
          
          /* 减少阴影效果 */
          .card-hover:hover,
          .btn-enhanced:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
          }
        }
        
        @media (max-width: 480px) {
          /* 超小屏幕进一步优化 */
          * {
            animation-duration: 0.1s !important;
            transition-duration: 0.1s !important;
          }
          
          .loading-skeleton {
            animation-duration: 1s !important;
          }
          
          /* 禁用视差效果 */
          [data-parallax] {
            transform: none !important;
          }
        }
      `;
      document.head.appendChild(style);
      
      // 优化滚动性能
      this.optimizeScrollPerformance();
      
      // 限制并发动画
      this.thresholds.maxAnimations = 3;
    }

    optimizeScrollPerformance() {
      // 使用 passive 监听器
      const passiveEvents = ['scroll', 'touchstart', 'touchmove', 'touchend'];
      passiveEvents.forEach(event => {
        document.addEventListener(event, () => {}, { passive: true });
      });
      
      // 节流滚动事件
      let scrollTimeout;
      const originalScrollHandler = window.onscroll;
      
      window.addEventListener('scroll', () => {
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(() => {
          if (originalScrollHandler) {
            originalScrollHandler();
          }
        }, 16); // 约60fps
      }, { passive: true });
    }

    applyMemoryOptimizations() {
      console.log('💾 应用内存优化');
      
      // 限制同时运行的动画数量
      this.thresholds.maxAnimations = 5;
      
      // 清理不必要的动画监听器
      this.cleanupAnimationListeners();
    }

    disableComplexAnimations() {
      const complexAnimations = [
        '.animate-bounceIn',
        '.animate-bounceInUp',
        '.animate-wobble',
        '.animate-swing'
      ];

      const style = document.createElement('style');
      style.textContent = complexAnimations.map(selector => 
        `${selector} { animation: fadeIn 0.2s ease both !important; }`
      ).join('\n');
      
      document.head.appendChild(style);
    }

    reduceShadowEffects() {
      const style = document.createElement('style');
      style.textContent = `
        .card-hover:hover,
        .timeline-content:hover,
        .reminder-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
        }
      `;
      document.head.appendChild(style);
    }

    cleanupAnimationListeners() {
      // 清理旧的动画监听器
      const elements = document.querySelectorAll('[data-animation-cleanup]');
      elements.forEach(element => {
        element.removeAttribute('data-animation-cleanup');
        // 这里可以添加更多清理逻辑
      });
    }

    // 性能观察器
    setupPerformanceObserver() {
      if (!window.PerformanceObserver) return;

      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          
          entries.forEach(entry => {
            if (entry.entryType === 'measure') {
              this.metrics.renderTime.push(entry.duration);
              
              // 保持最近50个测量值
              if (this.metrics.renderTime.length > 50) {
                this.metrics.renderTime.shift();
              }
            }
          });
        });

        observer.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }

    // 处理低FPS
    handleLowFPS(fps) {
      console.warn(`⚠️ 检测到低帧率: ${fps}fps`);
      
      if (this.metrics.frameDrops > this.thresholds.maxFrameDrops) {
        console.log('🔧 自动应用性能优化');
        this.applyEmergencyOptimizations();
      }
    }

    // 处理过多动画
    handleTooManyAnimations() {
      console.warn(`⚠️ 并发动画过多: ${this.metrics.animationCount}`);
      
      // 可以在这里实现动画队列或限制机制
      this.queueAnimations();
    }

    queueAnimations() {
      // 实现动画队列逻辑
      // 这里可以暂停一些非关键动画
    }

    // 紧急性能优化
    applyEmergencyOptimizations() {
      // 禁用所有非关键动画
      const style = document.createElement('style');
      style.id = 'emergency-optimizations';
      style.textContent = `
        * {
          animation-duration: 0.1s !important;
          transition-duration: 0.1s !important;
        }
        
        .timeline-content:hover,
        .reminder-card:hover,
        .card-hover:hover {
          transform: none !important;
          box-shadow: inherit !important;
        }
      `;
      
      document.head.appendChild(style);
      
      // 5秒后恢复
      setTimeout(() => {
        const emergencyStyle = document.getElementById('emergency-optimizations');
        if (emergencyStyle) {
          emergencyStyle.remove();
        }
      }, 5000);
    }

    // 获取性能报告
    getPerformanceReport() {
      const avgFPS = this.metrics.fps.length > 0 
        ? this.metrics.fps.reduce((a, b) => a + b, 0) / this.metrics.fps.length 
        : 0;
      
      const avgRenderTime = this.metrics.renderTime.length > 0
        ? this.metrics.renderTime.reduce((a, b) => a + b, 0) / this.metrics.renderTime.length
        : 0;

      return {
        averageFPS: Math.round(avgFPS),
        frameDrops: this.metrics.frameDrops,
        activeAnimations: this.metrics.animationCount,
        averageRenderTime: Math.round(avgRenderTime * 100) / 100,
        memoryUsage: this.getMemoryUsage(),
        recommendations: this.getRecommendations()
      };
    }

    getMemoryUsage() {
      if (performance.memory) {
        return {
          used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
          total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
        };
      }
      return null;
    }

    getRecommendations() {
      const recommendations = [];
      const avgFPS = this.metrics.fps.length > 0 
        ? this.metrics.fps.reduce((a, b) => a + b, 0) / this.metrics.fps.length 
        : 60;

      if (avgFPS < 30) {
        recommendations.push('考虑减少并发动画数量');
        recommendations.push('使用transform代替改变layout的属性');
      }

      if (this.metrics.frameDrops > 5) {
        recommendations.push('检查是否有长时间运行的JavaScript代码');
        recommendations.push('考虑使用will-change属性优化动画元素');
      }

      if (this.metrics.animationCount > 10) {
        recommendations.push('实现动画队列来限制并发动画');
      }

      const memory = this.getMemoryUsage();
      if (memory && memory.used > memory.limit * 0.8) {
        recommendations.push('内存使用率过高，考虑清理不必要的DOM元素');
      }

      return recommendations;
    }

    // 启用/禁用监控
    enable() {
      this.isEnabled = true;
      this.init();
    }

    disable() {
      this.isEnabled = false;
    }

    // 重置指标
    reset() {
      this.metrics = {
        fps: [],
        frameDrops: 0,
        animationCount: 0,
        memoryUsage: [],
        renderTime: []
      };
    }
  }

  // 动画性能工具
  const AnimationPerformanceUtils = {
    // 检查元素是否在视口中
    isInViewport(element) {
      const rect = element.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    },

    // 优化动画时机
    optimizeAnimationTiming(element, animation) {
      if (!this.isInViewport(element)) {
        // 元素不在视口中，延迟动画
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              animation();
              observer.unobserve(element);
            }
          });
        });
        
        observer.observe(element);
      } else {
        // 元素在视口中，立即执行动画
        animation();
      }
    },

    // 批量动画优化
    batchAnimations(animations, batchSize = 3, interval = 100) {
      const batches = [];
      for (let i = 0; i < animations.length; i += batchSize) {
        batches.push(animations.slice(i, i + batchSize));
      }

      batches.forEach((batch, index) => {
        setTimeout(() => {
          batch.forEach(animation => animation());
        }, index * interval);
      });
    },

    // 检测动画性能
    measureAnimationPerformance(element, animationFn) {
      const startTime = performance.now();
      
      animationFn().then(() => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (duration > 16) { // 超过一帧的时间
          console.warn(`动画性能警告: ${element.tagName} 动画耗时 ${duration.toFixed(2)}ms`);
        }
      });
    }
  };

  // 初始化性能监控
  let performanceMonitor = null;

  document.addEventListener('DOMContentLoaded', () => {
    // 只在开发环境或需要时启用性能监控
    const enablePerformanceMonitoring = 
      localStorage.getItem('animation-performance-monitoring') === 'true' ||
      window.location.search.includes('debug=true');

    if (enablePerformanceMonitoring) {
      performanceMonitor = new AnimationPerformanceMonitor();
      
      // 每30秒输出性能报告
      setInterval(() => {
        const report = performanceMonitor.getPerformanceReport();
        console.group('🎭 动画性能报告');
        console.log('平均FPS:', report.averageFPS);
        console.log('掉帧次数:', report.frameDrops);
        console.log('活跃动画:', report.activeAnimations);
        console.log('平均渲染时间:', report.averageRenderTime + 'ms');
        if (report.memoryUsage) {
          console.log('内存使用:', `${report.memoryUsage.used}MB / ${report.memoryUsage.total}MB`);
        }
        if (report.recommendations.length > 0) {
          console.log('优化建议:', report.recommendations);
        }
        console.groupEnd();
      }, 30000);
    }
  });

  // 导出到全局
  window.AnimationPerformance = {
    Monitor: AnimationPerformanceMonitor,
    Utils: AnimationPerformanceUtils,
    getInstance: () => performanceMonitor
  };

})();
