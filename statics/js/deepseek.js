/**
 * deepseek.js — AI Assistant page logic (runs inside a Shadow DOM)
 * AI助手页脚本：在 Shadow DOM 内运行，现在使用通义千问API
 *
 * Responsibilities / 职责
 * - Load and display DeepSeek.html content / 加载并显示DeepSeek.html内容
 * - Expose lifecycle hooks: initDeepseek(shadowRoot), destroyDeepseek() / 导出生命周期钩子
 * - Support context-aware conversations with Qwen API / 支持通义千问的上下文对话
 *
 * This module is loaded dynamically by the shell (index.js) and receives the
 * page's ShadowRoot via initDeepseek(shadowRoot). All DOM lookups must be scoped
 * to that ShadowRoot to avoid leaking to the host document.
 * 本模块由外壳(index.js)动态加载，通过 initDeepseek(shadowRoot) 接收子页的 ShadowRoot。
 * 所有 DOM 查询都应使用该 ShadowRoot，避免影响宿主文档。
 */

(function () {
  'use strict';
  console.debug('[deepseek] deepseek.js evaluated');
  let cleanupFns = [];
  let currentShadowRoot = null;

// -----------------------------
// State / 模块状态
// -----------------------------
let deepseekRoot = document; // Will be set by initDeepseek(shadowRoot) / 将由 initDeepseek 赋值

// -----------------------------
// Lifecycle / 生命周期
// -----------------------------
/**
 * initDeepseek — Boot the AI Assistant page inside the provided ShadowRoot.
 * 在传入的 ShadowRoot 中启动AI助手页逻辑。
 *
 * @param {ShadowRoot} shadowRoot - Shadow root for this page / 本页的 ShadowRoot
 */
function initDeepseek(shadowRoot) {
  // Cache and use the ShadowRoot / 记录并使用 ShadowRoot
  deepseekRoot = shadowRoot || document;
  currentShadowRoot = shadowRoot;
  console.log('✅ initDeepseek 执行', { hasShadowRoot: !!shadowRoot });

  // 直接加载DeepSeek.html内容
  loadDeepSeekContent(shadowRoot);

  console.log('✅ initDeepseek 执行，AI助手页面已初始化');
}

/**
 * loadDeepSeekContent — 加载DeepSeek.html内容
 * @param {Document|ShadowRoot} root - Scope for DOM queries / 查询作用域
 */
function loadDeepSeekContent(root) {
  // 直接加载DeepSeek.html内容到Shadow DOM，而不是使用iframe
  fetch('../src/deepseek.html')
    .then(response => response.text())
    .then(html => {
      // 解析HTML并提取body内容
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const bodyHTML = doc.body ? doc.body.innerHTML : html;
      
      // 将内容直接插入到Shadow DOM中
      root.innerHTML = bodyHTML;
      
      // 设置API基础路径到Shadow DOM中
      if (window.__API_BASE__) {
        // 在Shadow DOM中设置全局变量
        const script = document.createElement('script');
        script.textContent = `window.__API_BASE__ = '${window.__API_BASE__}';`;
        root.appendChild(script);
      }
      
      console.log('✅ AI助手页面加载完成 (使用通义千问API)');
    })
    .catch(error => {
      console.error('❌ AI助手页面加载失败:', error);
      root.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #333;">
          <h3>AI助手暂时无法访问</h3>
          <p>请检查网络连接或稍后重试</p>
        </div>
      `;
    });
}

/**
 * destroyDeepseek — Tear down listeners and observers for a clean unmount.
 * 清理监听与观察者，便于无痕卸载。
 */
function destroyDeepseek() {
  // 清理iframe
  if (currentShadowRoot) {
    const iframe = currentShadowRoot.querySelector('iframe');
    if (iframe) {
      iframe.src = '';
      iframe.remove();
    }
  }

  // 统一执行清理函数
  cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
  cleanupFns = [];
  currentShadowRoot = null;
  deepseekRoot = document;

  console.log('🧹 destroyDeepseek 清理完成');
}

// -----------------------------
// Public API / 对外导出
// -----------------------------
window.initDeepseek = initDeepseek;
window.destroyDeepseek = destroyDeepseek;
})();