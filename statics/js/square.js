/**
 * square.js — AI Assistant page logic
 * AI助手页面逻辑：调用DeepSeek.html
 *
 * Responsibilities:
 * - Load and display DeepSeek.html content
 * - Provide initSquare(rootEl) / destroySquare() lifecycle for dynamic page loader
 *
 * Supports both:
 * - Standalone HTML usage (rootEl = document)
 * - Shadow DOM injection (rootEl = ShadowRoot)
 */
(function () {
  console.debug("[square] square.js evaluated");

  // Array of teardown callbacks to run when leaving the page
  let cleanupFns = [];
  let currentShadowRoot = null;

  /**
   * Initialize the AI Assistant page UI.
   * @param {Document|ShadowRoot} rootEl - Scope for DOM queries.
   */
  function initSquare(rootEl) {
    const root = rootEl || document;
    currentShadowRoot = root;

    // 创建AI助手页面内容
    const aiAssistantContent = createAIAssistantContent();
    root.innerHTML = aiAssistantContent;

    // 加载DeepSeek.html内容
    loadDeepSeekContent(root);

    console.log('✅ initSquare 执行，AI助手页面已初始化');
  }

  /**
   * 创建AI助手页面内容
   */
  function createAIAssistantContent() {
    return `
      <div class="ai-assistant-container">
        <div class="ai-header">
          <h1>AI助手</h1>
          <p>智能健康咨询助手，为您提供专业的健康建议</p>
        </div>
        <div class="ai-content" id="ai-content">
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">正在加载AI助手...</div>
          </div>
        </div>
      </div>
      
      <style>
        .ai-assistant-container {
          padding: 20px;
          min-height: calc(100vh - 80px);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        
        .ai-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .ai-header h1 {
          font-size: 2rem;
          margin: 0 0 10px 0;
          font-weight: 700;
        }
        
        .ai-header p {
          font-size: 1rem;
          margin: 0;
          opacity: 0.9;
        }
        
        .ai-content {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 20px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          min-height: 400px;
        }
        
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-text {
          color: white;
          font-size: 1rem;
          opacity: 0.8;
        }
        
        /* DeepSeek内容样式 */
        .deepseek-container {
          width: 100%;
          height: 100%;
        }
        
        .deepseek-container iframe {
          width: 100%;
          height: 500px;
          border: none;
          border-radius: 10px;
          background: white;
        }
      </style>
    `;
  }

  /**
   * 加载DeepSeek.html内容
   */
  function loadDeepSeekContent(root) {
    const contentEl = root.querySelector('#ai-content');
    if (!contentEl) return;

    // 创建iframe来加载DeepSeek.html
    const iframe = document.createElement('iframe');
    iframe.src = '../src/deepseek.html';
    iframe.className = 'deepseek-iframe';
    iframe.style.cssText = `
      width: 100%;
      height: 500px;
      border: none;
      border-radius: 10px;
      background: white;
    `;
    
    iframe.onload = () => {
      console.log('✅ DeepSeek.html 加载完成');
      // 移除加载动画
      const loadingContainer = contentEl.querySelector('.loading-container');
      if (loadingContainer) {
        loadingContainer.remove();
      }
    };
    
    iframe.onerror = () => {
      console.error('❌ DeepSeek.html 加载失败');
      contentEl.innerHTML = `
        <div style="text-align: center; padding: 40px; color: white;">
          <h3>AI助手暂时无法访问</h3>
          <p>请检查网络连接或稍后重试</p>
        </div>
      `;
    };

    contentEl.appendChild(iframe);
  }

  /**
   * Cleanup function: run all stored teardown callbacks.
   * Called before leaving the page to prevent leaks.
   */
  function destroySquare() {
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

    console.log('🧹 destroySquare 清理完成');
  }

  // 页面加载时初始化（独立运行模式）
  document.addEventListener("DOMContentLoaded", function () {
    console.log("🤖 AI助手页面初始化");
    initSquare(document);
  });

  // Expose lifecycle functions to global scope for loader
  console.debug("[square] exposing lifecycle: initSquare/destroySquare");
  window.initSquare = initSquare;
  window.destroySquare = destroySquare;
})();