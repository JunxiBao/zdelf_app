(function () {
  'use strict';

  // Inject minimal CSS (fixed to main document, not inside Shadow DOM)
  function injectStyles() {
    if (document.getElementById('ai-heart-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-heart-styles';
    style.textContent = `
      #aiHeartBtn { position: fixed; right: -10px; bottom: 33vh; width: 44px; height: 44px; z-index: 2147483000; display: none; cursor: pointer; border: none; background: transparent; padding: 0; opacity: 0.45; transition: right 220ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 220ms, opacity 180ms ease; }
      #aiHeartBtn img { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; }
      #aiHeartBtn.revealed { right: 12px; opacity: 1; }
      #aiHeartBtn:hover { opacity: 0.9; }
      #aiAssistantModal { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 2147483646; backdrop-filter: blur(12px); }
      #aiAssistantModal .ai-modal-box { width: min(740px, 96vw); height: min(86vh, 820px); background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%); border-radius: 28px; overflow: hidden; box-shadow: 0 32px 64px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6); position: relative; transform: translateZ(0); }
      @media (prefers-color-scheme: dark) { #aiAssistantModal .ai-modal-box { background: linear-gradient(145deg, #1f2937 0%, #111827 100%); box-shadow: 0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08); } }
      #aiAssistantModal .ai-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; background: var(--brand, #b08fc7); color: #111827; border-radius: 28px 28px 0 0; }
      #aiAssistantModal .ai-title { margin: 0; font-size: 1.1rem; font-weight: 700; letter-spacing: 0.5px; }
      #aiAssistantModal .ai-close { width: 44px; height: 44px; border-radius: 16px; background: rgba(17,24,39,0.14); color: #111827; display: grid; place-items: center; cursor: pointer; box-shadow: none; transition: transform 160ms ease, background 160ms ease; position: relative; }
      #aiAssistantModal .ai-close:hover { transform: translateY(-1px); background: rgba(17,24,39,0.20); }
      #aiAssistantModal .ai-close:active { transform: scale(0.96); }
      #aiAssistantModal .ai-close::before, #aiAssistantModal .ai-close::after { content: ''; width: 18px; height: 2px; background: #111827; border-radius: 2px; position: absolute; }
      #aiAssistantModal .ai-close::before { transform: rotate(45deg); }
      #aiAssistantModal .ai-close::after { transform: rotate(-45deg); }
      #aiAssistantModal .ai-body { position: relative; padding: 8px; height: calc(100% - 72px); }
      #aiAssistantModal .ai-iframe { width: 100%; height: 100%; border: 0; background: transparent; display: block; border-radius: 16px; }
      #aiAssistantModal .ai-loading { position: absolute; inset: 8px; border-radius: 16px; display: grid; place-items: center; color: #64748b; font-size: 14px; }
    `;
    document.head.appendChild(style);
  }

  function createHeartButton() {
    if (document.getElementById('aiHeartBtn')) return document.getElementById('aiHeartBtn');
    const btn = document.createElement('div');
    btn.id = 'aiHeartBtn';
    const img = document.createElement('img');
    // Prefer docter.png per requirement, fall back to doctor.png which exists in repo
    img.src = './images/docter.png';
    img.onerror = function () { this.onerror = null; this.src = './images/doctor.png'; };
    img.alt = 'AI';
    btn.appendChild(img);
    document.body.appendChild(btn);
    return btn;
  }

  function createAIModal() {
    if (document.getElementById('aiAssistantModal')) return document.getElementById('aiAssistantModal');
    const overlay = document.createElement('div');
    overlay.id = 'aiAssistantModal';
    const box = document.createElement('div');
    box.className = 'ai-modal-box';
    const header = document.createElement('div');
    header.className = 'ai-header';
    const title = document.createElement('h3');
    title.className = 'ai-title';
    title.textContent = 'AI 助手';
    const close = document.createElement('div');
    close.className = 'ai-close';
    close.setAttribute('role', 'button');
    close.setAttribute('aria-label', '关闭');
    close.setAttribute('tabindex', '0');
    header.appendChild(title);
    header.appendChild(close);

    const body = document.createElement('div');
    body.className = 'ai-body';
    const loading = document.createElement('div');
    loading.className = 'ai-loading';
    loading.textContent = '加载中...';
    const iframe = document.createElement('iframe');
    iframe.className = 'ai-iframe';
    body.appendChild(iframe);
    body.appendChild(loading);

    box.appendChild(header);
    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Closing interactions
    close.addEventListener('click', () => hideModal());
    close.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape') {
        ev.preventDefault();
        hideModal();
      }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideModal(); });

    return overlay;
  }

  function resolveDeepseekPath() {
    // Try candidate paths relative to document URL
    const candidates = ['src/deepseek.html', '../src/deepseek.html', '../../src/deepseek.html'];
    return new Promise((resolve) => {
      let index = 0;
      const tryNext = () => {
        if (index >= candidates.length) { resolve(candidates[0]); return; }
        const url = candidates[index++];
        fetch(url, { method: 'HEAD' }).then((r) => {
          if (r.ok) resolve(url); else tryNext();
        }).catch(tryNext);
      };
      tryNext();
    });
  }

  function showModal() {
    const overlay = createAIModal();
    const iframe = overlay.querySelector('.ai-iframe');
    const loading = overlay.querySelector('.ai-loading');
    overlay.style.display = 'flex';

    resolveDeepseekPath().then((path) => {
      iframe.onload = () => {
        loading.style.display = 'none';
        try {
          iframe.contentWindow.__API_BASE__ = window.__API_BASE__ || 'https://app.zdelf.cn';
          iframe.contentWindow.__hapticImpact__ = window.__hapticImpact__;
        } catch (_) {}
      };
      iframe.onerror = () => { loading.textContent = '加载失败'; };
      iframe.src = path + '?t=' + Date.now();
    });
  }

  function hideModal() {
    const overlay = document.getElementById('aiAssistantModal');
    if (!overlay) return;
    const iframe = overlay.querySelector('.ai-iframe');
    overlay.style.display = 'none';
    if (iframe) { iframe.src = 'about:blank'; }
    // tuck the heart back after closing
    const btn = document.getElementById('aiHeartBtn');
    if (btn) btn.classList.remove('revealed');
  }

  function setHeartVisible(visible) {
    const btn = document.getElementById('aiHeartBtn');
    if (!btn) return;
    btn.style.display = visible ? 'block' : 'none';
  }

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    const btn = createHeartButton();
    btn.addEventListener('click', () => {
      try { if (window.__hapticImpact__) window.__hapticImpact__('Light'); } catch(_) {}
      // first reveal the full heart, then open modal
      btn.classList.add('revealed');
      setTimeout(() => showModal(), 220);
    });

    // Default: show on first tab (daily)
    setHeartVisible(true);
  });

  // Listen page change event from the shell
  window.addEventListener('pageChanged', (e) => {
    const index = (e && e.detail && typeof e.detail.index === 'number') ? e.detail.index : 0;
    // 显示在所有主页面（包含日常、提醒、广场、我的）
    setHeartVisible(true);
  });
})();


