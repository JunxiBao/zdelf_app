/**
 * animation-utils.js — 高级动画工具库
 * 为整个应用提供统一、高性能的动画控制
 * 
 * 功能特性：
 * - GPU加速的动画
 * - 交叉观察器驱动的滚动动画
 * - 高性能的涟漪效果
 * - 页面转场动画
 * - 响应式和可访问性支持
 */

(function() {
  'use strict';

  // =========================================================
  // 动画配置和常量
  // =========================================================
  const ANIMATION_CONFIG = {
    duration: {
      fast: 150,
      normal: 300,
      slow: 500,
      slower: 800
    },
    easing: {
      smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      back: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      expo: 'cubic-bezier(0.16, 1, 0.3, 1)'
    }
  };

  // 检查是否支持减少动画
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =========================================================
  // 工具函数
  // =========================================================
  
  /**
   * 获取调整后的动画持续时间（考虑用户偏好和设备性能）
   */
  function getAdjustedDuration(duration) {
    if (prefersReducedMotion) return 1;
    
    // 移动设备优化
    if (window.innerWidth <= 768) {
      return Math.max(duration * 0.7, 100);
    }
    
    return duration;
  }

  /**
   * 添加GPU加速
   */
  function enableGPUAcceleration(element) {
    if (!element) return;
    element.style.transform = element.style.transform || 'translateZ(0)';
    element.style.backfaceVisibility = 'hidden';
    element.style.perspective = '1000px';
  }

  /**
   * 移除GPU加速
   */
  function disableGPUAcceleration(element) {
    if (!element) return;
    element.style.transform = '';
    element.style.backfaceVisibility = '';
    element.style.perspective = '';
    element.style.willChange = 'auto';
  }

  /**
   * 设置will-change属性优化
   */
  function setWillChange(element, property) {
    if (!element) return;
    element.style.willChange = property;
  }

  /**
   * 清除will-change属性
   */
  function clearWillChange(element) {
    if (!element) return;
    element.style.willChange = 'auto';
  }

  // =========================================================
  // 高性能涟漪效果
  // =========================================================
  class RippleEffect {
    constructor(element, options = {}) {
      this.element = element;
      this.options = {
        color: options.color || 'rgba(255, 255, 255, 0.6)',
        duration: getAdjustedDuration(options.duration || ANIMATION_CONFIG.duration.normal),
        centered: options.centered || false,
        ...options
      };
      
      this.init();
    }

    init() {
      if (!this.element) return;
      
      // 确保元素有相对定位
      const computedStyle = getComputedStyle(this.element);
      if (computedStyle.position === 'static') {
        this.element.style.position = 'relative';
      }
      
      // 确保溢出隐藏
      this.element.style.overflow = 'hidden';
      
      // 绑定事件
      this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
      this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    }

    handleMouseDown(e) {
      this.createRipple(e.clientX, e.clientY, e.currentTarget);
    }

    handleTouchStart(e) {
      const touch = e.touches[0];
      this.createRipple(touch.clientX, touch.clientY, e.currentTarget);
    }

    createRipple(clientX, clientY, target) {
      if (prefersReducedMotion) return;

      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');
      
      // 计算涟漪大小和位置
      const size = Math.max(rect.width, rect.height);
      const radius = size / 2;
      
      let x, y;
      if (this.options.centered) {
        x = rect.width / 2 - radius;
        y = rect.height / 2 - radius;
      } else {
        x = clientX - rect.left - radius;
        y = clientY - rect.top - radius;
      }

      // 设置涟漪样式
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: ${this.options.color};
        border-radius: 50%;
        pointer-events: none;
        transform: scale(0);
        opacity: 0.6;
        z-index: 1000;
      `;

      // 启用GPU加速
      enableGPUAcceleration(ripple);
      setWillChange(ripple, 'transform, opacity');

      // 添加到DOM
      target.appendChild(ripple);

      // 执行动画
      ripple.animate([
        { transform: 'scale(0)', opacity: 0.6 },
        { transform: 'scale(4)', opacity: 0 }
      ], {
        duration: this.options.duration,
        easing: ANIMATION_CONFIG.easing.smooth,
        fill: 'forwards'
      }).addEventListener('finish', () => {
        clearWillChange(ripple);
        ripple.remove();
      });

      // 触觉反馈
      if (window.__hapticImpact__) {
        try {
          window.__hapticImpact__('Light');
        } catch (e) {
          // 忽略错误
        }
      }
    }

    destroy() {
      if (this.element) {
        this.element.removeEventListener('mousedown', this.handleMouseDown);
        this.element.removeEventListener('touchstart', this.handleTouchStart);
      }
    }
  }

  // =========================================================
  // 滚动触发动画
  // =========================================================
  class ScrollReveal {
    constructor(options = {}) {
      this.options = {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px 0px -50px 0px',
        ...options
      };
      
      this.observer = null;
      this.elements = new Set();
      this.init();
    }

    init() {
      if (!window.IntersectionObserver || prefersReducedMotion) {
        // 降级处理：直接显示所有元素
        this.fallbackReveal();
        return;
      }

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.revealElement(entry.target);
            this.observer.unobserve(entry.target);
            this.elements.delete(entry.target);
          }
        });
      }, this.options);
    }

    observe(element) {
      if (!element || !this.observer) return;
      
      this.elements.add(element);
      this.observer.observe(element);
      
      // 初始化元素状态
      element.style.opacity = '0';
      element.style.transform = this.getInitialTransform(element);
      element.style.transition = `opacity ${getAdjustedDuration(ANIMATION_CONFIG.duration.slow)}ms ${ANIMATION_CONFIG.easing.smooth}, transform ${getAdjustedDuration(ANIMATION_CONFIG.duration.slow)}ms ${ANIMATION_CONFIG.easing.smooth}`;
      
      enableGPUAcceleration(element);
    }

    observeAll(selector) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => this.observe(element));
    }

    getInitialTransform(element) {
      const classes = element.classList;
      if (classes.contains('scroll-reveal-left')) {
        return 'translateX(-30px)';
      } else if (classes.contains('scroll-reveal-right')) {
        return 'translateX(30px)';
      } else if (classes.contains('scroll-reveal-up')) {
        return 'translateY(30px)';
      } else if (classes.contains('scroll-reveal-down')) {
        return 'translateY(-30px)';
      }
      return 'translateY(30px)'; // 默认从下方进入
    }

    revealElement(element) {
      setWillChange(element, 'opacity, transform');
      
      element.style.opacity = '1';
      element.style.transform = 'translate3d(0, 0, 0)';
      
      // 清理will-change
      setTimeout(() => {
        clearWillChange(element);
      }, getAdjustedDuration(ANIMATION_CONFIG.duration.slow));
    }

    fallbackReveal() {
      // 为不支持IntersectionObserver的浏览器提供降级方案
      document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-up, .scroll-reveal-down').forEach(element => {
        element.style.opacity = '1';
        element.style.transform = 'translate3d(0, 0, 0)';
      });
    }

    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.elements.clear();
    }
  }

  // =========================================================
  // 页面转场动画
  // =========================================================
  class PageTransition {
    constructor() {
      this.isTransitioning = false;
    }

    async fadeOut(element, duration = ANIMATION_CONFIG.duration.normal) {
      if (!element || this.isTransitioning) return;
      
      this.isTransitioning = true;
      const adjustedDuration = getAdjustedDuration(duration);
      
      enableGPUAcceleration(element);
      setWillChange(element, 'opacity');

      return new Promise(resolve => {
        if (prefersReducedMotion) {
          element.style.opacity = '0';
          resolve();
          return;
        }

        element.animate([
          { opacity: 1 },
          { opacity: 0 }
        ], {
          duration: adjustedDuration,
          easing: ANIMATION_CONFIG.easing.smooth,
          fill: 'forwards'
        }).addEventListener('finish', () => {
          clearWillChange(element);
          this.isTransitioning = false;
          resolve();
        });
      });
    }

    async fadeIn(element, duration = ANIMATION_CONFIG.duration.normal) {
      if (!element || this.isTransitioning) return;
      
      this.isTransitioning = true;
      const adjustedDuration = getAdjustedDuration(duration);
      
      element.style.opacity = '0';
      enableGPUAcceleration(element);
      setWillChange(element, 'opacity');

      return new Promise(resolve => {
        if (prefersReducedMotion) {
          element.style.opacity = '1';
          resolve();
          return;
        }

        element.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], {
          duration: adjustedDuration,
          easing: ANIMATION_CONFIG.easing.smooth,
          fill: 'forwards'
        }).addEventListener('finish', () => {
          clearWillChange(element);
          this.isTransitioning = false;
          resolve();
        });
      });
    }

    async slideUp(element, duration = ANIMATION_CONFIG.duration.normal) {
      if (!element || this.isTransitioning) return;
      
      this.isTransitioning = true;
      const adjustedDuration = getAdjustedDuration(duration);
      
      enableGPUAcceleration(element);
      setWillChange(element, 'transform, opacity');

      return new Promise(resolve => {
        if (prefersReducedMotion) {
          element.style.opacity = '1';
          element.style.transform = 'translate3d(0, 0, 0)';
          resolve();
          return;
        }

        element.animate([
          { opacity: 0, transform: 'translate3d(0, 30px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ], {
          duration: adjustedDuration,
          easing: ANIMATION_CONFIG.easing.smooth,
          fill: 'forwards'
        }).addEventListener('finish', () => {
          clearWillChange(element);
          this.isTransitioning = false;
          resolve();
        });
      });
    }
  }

  // =========================================================
  // 高性能动画队列
  // =========================================================
  class AnimationQueue {
    constructor() {
      this.queue = [];
      this.isRunning = false;
    }

    add(animationFn, delay = 0) {
      this.queue.push({ fn: animationFn, delay });
      if (!this.isRunning) {
        this.run();
      }
    }

    async run() {
      if (this.isRunning || this.queue.length === 0) return;
      
      this.isRunning = true;

      while (this.queue.length > 0) {
        const { fn, delay } = this.queue.shift();
        
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        try {
          await fn();
        } catch (error) {
          console.warn('Animation error:', error);
        }
      }

      this.isRunning = false;
    }

    clear() {
      this.queue = [];
      this.isRunning = false;
    }
  }

  // =========================================================
  // 动画工具函数
  // =========================================================
  const AnimationUtils = {
    // 配置
    config: ANIMATION_CONFIG,
    
    // 创建涟漪效果
    createRipple(element, options = {}) {
      return new RippleEffect(element, options);
    },

    // 创建滚动揭示动画
    createScrollReveal(options = {}) {
      return new ScrollReveal(options);
    },

    // 创建页面转场动画
    createPageTransition() {
      return new PageTransition();
    },

    // 创建动画队列
    createAnimationQueue() {
      return new AnimationQueue();
    },

    // 工具函数
    enableGPUAcceleration,
    disableGPUAcceleration,
    setWillChange,
    clearWillChange,
    getAdjustedDuration,

    // 快捷动画函数
    async fadeIn(element, duration = ANIMATION_CONFIG.duration.normal) {
      const transition = new PageTransition();
      return transition.fadeIn(element, duration);
    },

    async fadeOut(element, duration = ANIMATION_CONFIG.duration.normal) {
      const transition = new PageTransition();
      return transition.fadeOut(element, duration);
    },

    async slideUp(element, duration = ANIMATION_CONFIG.duration.normal) {
      const transition = new PageTransition();
      return transition.slideUp(element, duration);
    },

    // 批量添加动画类
    addAnimationClass(elements, className, delay = 0) {
      const elementList = Array.isArray(elements) ? elements : [elements];
      
      elementList.forEach((element, index) => {
        if (!element) return;
        
        setTimeout(() => {
          element.classList.add(className);
        }, delay * index);
      });
    },

    // 序列动画
    async sequence(animations) {
      for (const animation of animations) {
        try {
          await animation();
        } catch (error) {
          console.warn('Sequence animation error:', error);
        }
      }
    },

    // 并行动画
    async parallel(animations) {
      const promises = animations.map(animation => {
        try {
          return animation();
        } catch (error) {
          console.warn('Parallel animation error:', error);
          return Promise.resolve();
        }
      });
      
      return Promise.all(promises);
    },

    // 检查动画支持
    isAnimationSupported() {
      return !prefersReducedMotion && 'animate' in Element.prototype;
    },

    // 获取最佳性能的动画属性
    getPerformantProperties() {
      return ['transform', 'opacity'];
    },

    // 表单验证动画
    showFormError(element, message) {
      if (!element) return;
      
      // 添加错误样式
      element.classList.add('form-error');
      
      // 移除其他状态
      element.classList.remove('form-success', 'form-warning');
      
      // 显示错误消息
      if (message) {
        this.showMessage(element, message, 'error');
      }
      
      // 自动清除动画类
      setTimeout(() => {
        element.classList.remove('form-error');
      }, 1500);
    },

    showFormSuccess(element, message) {
      if (!element) return;
      
      element.classList.add('form-success');
      element.classList.remove('form-error', 'form-warning');
      
      if (message) {
        this.showMessage(element, message, 'success');
      }
      
      setTimeout(() => {
        element.classList.remove('form-success');
      }, 1500);
    },

    showFormWarning(element, message) {
      if (!element) return;
      
      element.classList.add('form-warning');
      element.classList.remove('form-error', 'form-success');
      
      if (message) {
        this.showMessage(element, message, 'warning');
      }
      
      setTimeout(() => {
        element.classList.remove('form-warning');
      }, 1500);
    },

    showMessage(element, message, type = 'error') {
      const existingMessage = element.parentNode.querySelector('.validation-message');
      if (existingMessage) {
        existingMessage.remove();
      }
      
      const messageEl = document.createElement('div');
      messageEl.className = `validation-message ${type}-message`;
      messageEl.textContent = message;
      messageEl.style.cssText = `
        font-size: 12px;
        margin-top: 4px;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
      `;
      
      element.parentNode.appendChild(messageEl);
      
      // 触发动画
      requestAnimationFrame(() => {
        messageEl.style.opacity = '1';
        messageEl.style.transform = 'translateY(0)';
      });
      
      // 自动移除
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.style.opacity = '0';
          messageEl.style.transform = 'translateY(-10px)';
          setTimeout(() => {
            if (messageEl.parentNode) {
              messageEl.remove();
            }
          }, 300);
        }
      }, 3000);
    },

    // 数据可视化动画
    animateChart(element, type = 'bar') {
      if (!element || prefersReducedMotion) return;
      
      element.classList.add('chart-enter');
      
      if (type === 'line') {
        const lines = element.querySelectorAll('path, line');
        lines.forEach(line => {
          line.classList.add('chart-line');
        });
      } else if (type === 'bar') {
        const bars = element.querySelectorAll('rect, .bar');
        bars.forEach((bar, index) => {
          bar.style.animationDelay = `${index * 100}ms`;
          bar.classList.add('chart-bar');
        });
      }
      
      // 数字动画
      const numbers = element.querySelectorAll('.chart-number, .metric-value');
      numbers.forEach((num, index) => {
        num.style.animationDelay = `${index * 150}ms`;
        num.classList.add('chart-number');
      });
    },

    // 创建骨架屏 - 已禁用，避免创建不必要的DOM元素
    createSkeleton(type = 'card') {
      console.warn('createSkeleton has been disabled to prevent rendering issues');
      return document.createElement('div'); // 返回空div避免错误
    }
  };

  // =========================================================
  // 自动初始化
  // =========================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 简化初始化，只保留必要功能
    console.log('Animation utils loaded with minimal features');
    
    // 禁用自动滚动揭示动画，避免潜在问题
    // const scrollReveal = new ScrollReveal();
    // scrollReveal.observeAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-up, .scroll-reveal-down');

    // 禁用自动涟漪效果
    // document.querySelectorAll('.ripple, .rippleable').forEach(element => {
    //   new RippleEffect(element);
    // });
  });

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    if (window.__scrollReveal__) {
      window.__scrollReveal__.destroy();
    }
  });

  // 导出到全局
  window.AnimationUtils = AnimationUtils;

})();
