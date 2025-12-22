/**
 * page-transitions.js — 页面转场动画增强
 * 为页面切换提供流畅的转场效果
 */

(function() {
  'use strict';

  // 页面转场管理器
  class PageTransitionManager {
    constructor() {
      this.isTransitioning = false;
      this.transitionDuration = 300;
      this.currentPage = null;
      this.previousPage = null;
      
      this.init();
    }

    init() {
      // 监听页面切换事件
      this.observePageChanges();
      
      // 为所有页面添加初始状态
      this.setupInitialStates();
    }

    observePageChanges() {
      // 监听导航点击
      document.addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (navItem && !this.isTransitioning) {
          const index = Array.from(document.querySelectorAll('.nav-item')).indexOf(navItem);
          this.handlePageTransition(index);
        }
      });
    }

    setupInitialStates() {
      const content = document.getElementById('content');
      if (content) {
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
        content.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      }
    }

    async handlePageTransition(targetIndex) {
      if (this.isTransitioning) return;
      
      this.isTransitioning = true;
      const content = document.getElementById('content');
      
      if (!content) {
        this.isTransitioning = false;
        return;
      }

      try {
        // 简化的页面转场：只做基本的淡入淡出
        await this.fadeOutContent(content);
        await this.wait(50);
        await this.fadeInContent(content);
        
      } catch (error) {
        console.warn('Page transition error:', error);
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
      } finally {
        this.isTransitioning = false;
      }
    }

    fadeOutContent(element) {
      return new Promise(resolve => {
        if (!element) {
          resolve();
          return;
        }

        // 检查是否支持动画
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          element.style.opacity = '0';
          resolve();
          return;
        }

        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';
        
        setTimeout(resolve, this.transitionDuration / 2);
      });
    }

    fadeInContent(element) {
      return new Promise(resolve => {
        if (!element) {
          resolve();
          return;
        }

        // 检查是否支持动画
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
          resolve();
          return;
        }

        // 设置初始状态
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        
        // 强制重排
        element.offsetHeight;
        
        // 执行动画
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        
        setTimeout(resolve, this.transitionDuration);
      });
    }

    wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 为特定页面添加自定义入场动画
    addCustomPageAnimation(pageSelector, animationClass) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.matches && node.matches(pageSelector)) {
              this.applyCustomAnimation(node, animationClass);
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      return observer;
    }

    applyCustomAnimation(element, animationClass) {
      if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      element.classList.add(animationClass);
      
      // 清理动画类
      element.addEventListener('animationend', () => {
        element.classList.remove(animationClass);
      }, { once: true });
    }
  }

  // 简化的卡片动画 - 移除可能导致问题的复杂逻辑
  class CardStackAnimation {
    constructor(containerSelector = '.timeline-container, .reminders-container, .data-cards-container') {
      // 禁用自动动画，避免产生不必要的元素
      console.log('CardStackAnimation disabled to prevent rendering issues');
    }

    init() {
      // 空实现
    }

    setupCardAnimations() {
      // 空实现
    }

    observeNewCards() {
      // 空实现
    }

    animateNewCard() {
      // 空实现
    }
  }

  // 滚动视差效果
  class ScrollParallax {
    constructor() {
      this.elements = [];
      this.isScrolling = false;
      this.init();
    }

    init() {
      this.findParallaxElements();
      this.bindScrollEvent();
    }

    findParallaxElements() {
      // 查找具有parallax属性的元素
      const parallaxElements = document.querySelectorAll('[data-parallax]');
      
      parallaxElements.forEach(element => {
        const speed = parseFloat(element.dataset.parallax) || 0.5;
        this.elements.push({
          element,
          speed,
          offset: element.getBoundingClientRect().top + window.pageYOffset
        });
      });
    }

    bindScrollEvent() {
      let ticking = false;

      const updateParallax = () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          return;
        }

        const scrolled = window.pageYOffset;

        this.elements.forEach(({ element, speed, offset }) => {
          const yPos = -(scrolled - offset) * speed;
          element.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });

        ticking = false;
      };

      window.addEventListener('scroll', () => {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      }, { passive: true });
    }
  }

  // 微交互增强
  class MicroInteractions {
    constructor() {
      this.init();
    }

    init() {
      this.setupHoverEffects();
      this.setupClickEffects();
      this.setupFocusEffects();
    }

    setupHoverEffects() {
      // 为按钮添加磁性效果
      document.addEventListener('mousemove', (e) => {
        const buttons = document.querySelectorAll('.btn, .center-button, .nav-item .icon');
        
        buttons.forEach(button => {
          const rect = button.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const deltaX = e.clientX - centerX;
          const deltaY = e.clientY - centerY;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance < 100) { // 100px 范围内
            const strength = (100 - distance) / 100;
            const moveX = deltaX * strength * 0.1;
            const moveY = deltaY * strength * 0.1;
            
            if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
              button.style.transform = `translate(${moveX}px, ${moveY}px)`;
            }
          } else {
            button.style.transform = '';
          }
        });
      });
    }

    setupClickEffects() {
      // 点击波纹效果增强
      document.addEventListener('click', (e) => {
        const target = e.target.closest('.btn, .reminder-card, .timeline-content, .unified-card');
        
        if (target && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.createClickRipple(e, target);
        }
      });
    }

    setupFocusEffects() {
      // 焦点环增强
      document.addEventListener('focusin', (e) => {
        if (e.target.matches('input, button, select, textarea, [tabindex]')) {
          this.enhanceFocusRing(e.target);
        }
      });

      document.addEventListener('focusout', (e) => {
        this.removeFocusEnhancement(e.target);
      });
    }

    createClickRipple(event, element) {
      // 禁用涟漪效果，避免创建额外DOM元素
      return;
    }

    enhanceFocusRing(element) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      element.style.boxShadow = '0 0 0 3px rgba(98, 0, 234, 0.3), 0 0 0 6px rgba(98, 0, 234, 0.1)';
      element.style.transition = 'box-shadow 0.2s ease';
    }

    removeFocusEnhancement(element) {
      element.style.boxShadow = '';
    }
  }

  // CSS动画注入
  const injectAnimationCSS = () => {
    if (document.getElementById('page-transitions-css')) return;

    const style = document.createElement('style');
    style.id = 'page-transitions-css';
    style.textContent = `
      @keyframes clickRipple {
        0% {
          transform: scale(0);
          opacity: 0.8;
        }
        100% {
          transform: scale(4);
          opacity: 0;
        }
      }

      .page-transition-enter {
        animation: pageEnter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }

      .page-transition-exit {
        animation: pageExit 0.3s cubic-bezier(0.4, 0, 0.2, 1) both;
      }

      @keyframes pageEnter {
        from {
          opacity: 0;
          transform: translateY(20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes pageExit {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(-10px) scale(1.02);
        }
      }

      /* 减少动画支持 */
      @media (prefers-reduced-motion: reduce) {
        .page-transition-enter,
        .page-transition-exit {
          animation: none !important;
        }
        
        @keyframes clickRipple {
          0%, 100% { opacity: 0; }
        }
      }
    `;
    document.head.appendChild(style);
  };

  // 初始化 - 简化版本
  document.addEventListener('DOMContentLoaded', () => {
    injectAnimationCSS();
    
    // 只初始化基本的页面转场，禁用可能导致问题的组件
    window.pageTransitionManager = new PageTransitionManager();
    // window.cardStackAnimation = new CardStackAnimation(); // 已禁用
    // window.scrollParallax = new ScrollParallax(); // 暂时禁用
    // window.microInteractions = new MicroInteractions(); // 暂时禁用
    
    console.log('🎨 简化的页面转场系统已初始化');
  });

  // 导出到全局
  window.PageTransitions = {
    PageTransitionManager,
    CardStackAnimation,
    ScrollParallax,
    MicroInteractions
  };

})();
