/**
 * case.js — Logic for the "Case" / 病例 page
 * 病例页面逻辑：添加问诊弹窗功能
 *
 * Responsibilities:
 * - Handle doctor popup interactions / 处理问诊弹窗交互
 * - Provide initCase(rootEl) / destroyCase() lifecycle for dynamic page loader
 *
 * Supports both:
 * - Standalone HTML usage (rootEl = document)
 * - Shadow DOM injection (rootEl = ShadowRoot)
 */
(function () {
  console.debug("[case] case.js evaluated");

  // Array of teardown callbacks to run when leaving the page
  let cleanupFns = [];

  // Cached event handlers for cleanup
  let onDoctorClick = null;
  let onDocumentClick = null;
  let doctorObserver = null;

  /**
   * Initialize the "Case" page UI.
   * @param {Document|ShadowRoot} rootEl - Scope for DOM queries.
   */
  function initCase(rootEl) {
    const root = rootEl || document;

    // Wire up doctor popup interactions scoped to current page
    const doctorButton = root.querySelector('#doctor-button');
    const doctorPopup = root.querySelector('#doctor-popup');

    if (!doctorButton || !doctorPopup) {
      console.warn('⚠️ 未找到 doctorButton 或 doctorPopup（可能 DOM 尚未就绪）');
      return;
    }

    // 防止重复绑定：先移除旧监听
    if (onDoctorClick && doctorButton) doctorButton.removeEventListener('click', onDoctorClick);
    if (onDocumentClick) document.removeEventListener('click', onDocumentClick, true);
    if (doctorObserver) { doctorObserver.disconnect(); doctorObserver = null; }

    // Click to toggle popup / 点击切换弹窗
    onDoctorClick = () => {
      try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
      if (!doctorPopup.classList.contains('show')) {
        doctorPopup.classList.add('show');
        doctorPopup.style.display = 'block';
      } else if (!doctorPopup.classList.contains('hiding')) {
        doctorPopup.classList.add('hiding');
        doctorPopup.addEventListener('transitionend', function handler() {
          doctorPopup.classList.remove('show', 'hiding');
          doctorPopup.style.display = 'none';
          doctorPopup.removeEventListener('transitionend', handler);
        });
      }
    };
    doctorButton.addEventListener('click', onDoctorClick);
    cleanupFns.push(() => doctorButton.removeEventListener('click', onDoctorClick));

    // Click outside to close (capture to see outside shadow)
    onDocumentClick = (event) => {
      if (
        doctorPopup.classList.contains('show') &&
        !doctorButton.contains(event.target) &&
        !doctorPopup.contains(event.target)
      ) {
        try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
        doctorPopup.classList.add('hiding');
        doctorPopup.addEventListener('transitionend', function handler() {
          doctorPopup.classList.remove('show', 'hiding');
          doctorPopup.style.display = 'none';
          doctorPopup.removeEventListener('transitionend', handler);
        });
      }
    };
    document.addEventListener('click', onDocumentClick, true);
    cleanupFns.push(() => document.removeEventListener('click', onDocumentClick, true));

    // Keep display state consistent when class changes / 观察类名变化统一显示状态
    doctorObserver = new MutationObserver(() => {
      if (doctorPopup.classList.contains('show')) {
        doctorPopup.style.display = 'block';
      }
    });
    doctorObserver.observe(doctorPopup, { attributes: true, attributeFilter: ['class'] });
    cleanupFns.push(() => { try { doctorObserver && doctorObserver.disconnect(); } catch(_) {} doctorObserver = null; });

    console.log('✅ initCase 执行，医生按钮已绑定');
  }

  /**
   * Cleanup function: run all stored teardown callbacks.
   * Called before leaving the page to prevent leaks.
   */
  function destroyCase() {
    // 统一执行清理函数
    cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
    cleanupFns = [];

    onDoctorClick = null;
    onDocumentClick = null;
    console.log('🧹 destroyCase 清理完成');
  }

  // 页面加载时初始化（独立运行模式）
  document.addEventListener("DOMContentLoaded", function () {
    console.log("📋 病例页面初始化");
    initCase(document);
  });

  // Expose lifecycle functions to global scope for loader
  console.debug("[case] exposing lifecycle: initCase/destroyCase");
  window.initCase = initCase;
  window.destroyCase = destroyCase;
})();
