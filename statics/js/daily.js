/**
 * daily.js — Daily page logic (runs inside a Shadow DOM)
 * 日常页脚本：在 Shadow DOM 内运行
 *
 * Responsibilities / 职责
 * - Render greeting based on time & username / 根据时间与用户名显示问候语
 * - Wire up doctor popup interactions / 绑定“问诊弹窗”的交互
 * - Expose lifecycle hooks: initDaily(shadowRoot), destroyDaily() / 导出生命周期钩子
 *
 * This module is loaded dynamically by the shell (index.js) and receives the
 * page's ShadowRoot via initDaily(shadowRoot). All DOM lookups must be scoped
 * to that ShadowRoot to avoid leaking to the host document.
 * 本模块由外壳(index.js)动态加载，通过 initDaily(shadowRoot) 接收子页的 ShadowRoot。
 * 所有 DOM 查询都应使用该 ShadowRoot，避免影响宿主文档。
 */

(function () {
  'use strict';
  // Backend API base: absolute by default; can be overridden via window.__API_BASE__
  const __API_BASE_DEFAULT__ = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
  const __API_BASE__ = __API_BASE_DEFAULT__ && __API_BASE_DEFAULT__.endsWith('/')
    ? __API_BASE_DEFAULT__.slice(0, -1)
    : __API_BASE_DEFAULT__;
  console.debug('[daily] daily.js evaluated');
  let cleanupFns = [];
  let fetchController = null;
  function abortInFlight() {
    if (fetchController) {
      try { fetchController.abort(); } catch (_) {}
    }
    fetchController = null;
  }

// -----------------------------
// State / 模块状态
// -----------------------------
let dailyRoot = document; // Will be set by initDaily(shadowRoot) / 将由 initDaily 赋值
let onDoctorClick = null; // Cached handler for cleanup / 缓存处理器，便于清理
let onDocumentClick = null; // Ditto / 同上
let doctorObserver = null; // MutationObserver reference / 观察者引用

// -----------------------------
// Utilities / 工具函数
// -----------------------------
/**
 * getGreeting — Return a localized greeting string based on current hour.
 * 根据当前小时返回合适的问候语。
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "早上好"; // Good morning
  if (hour >= 12 && hour < 14) return "中午好"; // Good noon
  if (hour >= 14 && hour < 18) return "下午好"; // Good afternoon
  if (hour >= 18 && hour < 22) return "晚上好"; // Good evening
  return "夜深了"; // Late night
}

/**
 * displayGreeting — Render greeting into #greeting inside the current scope.
 * 在当前作用域（dailyRoot 或传入的 root）中，渲染 #greeting。
 *
 * @param {string} username - Display name / 要显示的用户名
 * @param {Document|ShadowRoot} [root=dailyRoot] - Scope to query / 查询作用域
 */
function displayGreeting(username, root = dailyRoot) {
  const scope = root || document;
  const el = scope.querySelector("#greeting"); // ShadowRoot has no getElementById
  if (!el) {
    console.error("❌ 未找到 greeting 元素 (scope=", scope, ")");
    return;
  }
  el.textContent = `${getGreeting()}，${username}`;
}

/**
 * getUsername — Read username for the current userId and render greeting.
 * 读取当前 userId 对应的用户名并渲染问候语。
 *
 * Behavior / 行为：
 * - When userId is missing/invalid, render as "访客".
 *   当 userId 缺失或无效时，显示“访客”。
 * - Otherwise POST to backend and use data.data[0].username if present.
 *   否则请求后端，用返回的用户名（若存在）。
 */
function getUsername() {
  const userId = localStorage.getItem('userId');
  console.log('🧪 获取到的 userId:', userId);

  if (!userId || userId === 'undefined' || userId === 'null') {
    console.warn('⚠️ 未获取到有效 userId，显示访客');
    displayGreeting('访客', dailyRoot);
    return;
  }

  // 在发起新的请求前中止旧的
  abortInFlight();
  fetchController = new AbortController();

  console.log('🌐 测试网络连接...');
  fetch(__API_BASE__ + '/readdata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table_name: 'users', user_id: userId }),
    signal: fetchController.signal,
  })
    .then((response) => {
      console.log('📡 收到响应，状态码:', response.status);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    })
    .then((data) => {
      console.log('📦 返回数据：', data);
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const username = data.data[0].username || '访客';
        displayGreeting(username, dailyRoot);
      } else {
        displayGreeting('访客', dailyRoot);
      }
    })
    .catch((error) => {
      if (error && error.name === 'AbortError') {
        console.warn('⏹️ 请求已取消');
      } else {
        console.error('❌ 获取用户信息失败:', error);
        displayGreeting('访客', dailyRoot);
      }
    })
    .finally(() => {
      // 清理 controller 引用
      fetchController = null;
    });
}

// -----------------------------
// Lifecycle / 生命周期
// -----------------------------
/**
 * initDaily — Boot the daily page inside the provided ShadowRoot.
 * 在传入的 ShadowRoot 中启动日常页逻辑。
 *
 * @param {ShadowRoot} shadowRoot - Shadow root for this page / 本页的 ShadowRoot
 */
function initDaily(shadowRoot) {
  // Cache and use the ShadowRoot / 记录并使用 ShadowRoot
  dailyRoot = shadowRoot || document;
  console.log('✅ initDaily 执行', { hasShadowRoot: !!shadowRoot });

  // 启动前中止可能在途的请求
  abortInFlight();

  // Render greeting / 渲染问候语
  getUsername();

  // Load and display user data cards / 加载并显示用户数据卡片
  loadUserDataCards();

  // 为doctor按钮添加固定定位样式到Shadow DOM
  const doctorStyle = document.createElement('style');
  doctorStyle.textContent = `
    #doctor-button {
      position: fixed !important;
      bottom: 24px !important;
      right: -25px !important;
      width: 50px !important;
      height: 50px !important;
      cursor: pointer !important;
      transition: right 0.3s ease !important;
      opacity: 0.3 !important;
      z-index: 1001 !important;
    }
    #doctor-button:hover {
      right: 0 !important;
      opacity: 1 !important;
    }
    #doctor-button img {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      border-radius: 5px !important;
    }
  `;
  dailyRoot.appendChild(doctorStyle);

  // 强制应用样式到doctor按钮
  setTimeout(() => {
    const doctorButton = dailyRoot.querySelector('#doctor-button');
    if (doctorButton) {
      doctorButton.style.position = 'fixed';
      doctorButton.style.bottom = '24px';
      doctorButton.style.right = '-25px';
      doctorButton.style.width = '50px';
      doctorButton.style.height = '50px';
      doctorButton.style.zIndex = '1001';
      doctorButton.style.cursor = 'pointer';
      doctorButton.style.opacity = '0.3';
      doctorButton.style.transition = 'right 0.3s ease';
      console.log('✅ Doctor按钮样式已强制应用');
    }
  }, 100);

  // Wire up doctor popup interactions scoped to Shadow DOM
  const doctorButton = dailyRoot.querySelector('#doctor-button');
  const doctorPopup = dailyRoot.querySelector('#doctor-popup');

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
}

/**
 * loadUserDataCards — 加载并显示用户数据卡片
 * 从后端获取所有用户数据并按时间排序展示
 */
function loadUserDataCards() {
  const userId = localStorage.getItem('userId') || 
                 localStorage.getItem('UserID') || 
                 sessionStorage.getItem('userId') || 
                 sessionStorage.getItem('UserID');
  
  if (!userId || userId === 'undefined' || userId === 'null') {
    console.warn('⚠️ 未获取到有效 userId，跳过数据卡片加载');
    return;
  }

  // 创建卡片容器
  const cardsContainer = dailyRoot.querySelector('#data-cards-container');
  if (!cardsContainer) {
    console.warn('⚠️ 未找到卡片容器 #data-cards-container');
    return;
  }

  // 显示加载状态
  cardsContainer.innerHTML = `
    <div class="loading-cards">
      <div class="loading-spinner"></div>
      <p>正在加载您的数据...</p>
    </div>
  `;

  // 并行加载所有类型的数据
  const dataTypes = ['metrics', 'diet', 'case'];
  const promises = dataTypes.map(type => 
    fetch(`${__API_BASE__}/getjson/${type}?user_id=${encodeURIComponent(userId)}&limit=50`)
      .then(res => res.json())
      .then(data => ({ type, data }))
      .catch(err => {
        console.warn(`加载 ${type} 数据失败:`, err);
        return { type, data: { success: false, data: [] } };
      })
  );

  Promise.all(promises).then(results => {
    // 合并所有数据并按时间排序
    const allItems = [];
    results.forEach(({ type, data }) => {
      if (data.success && data.data) {
        data.data.forEach(item => {
          allItems.push({
            ...item,
            dataType: type
          });
        });
      }
    });

    // 按创建时间降序排序
    allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    renderUnifiedCards(allItems, cardsContainer);
  });
}

/**
 * renderUnifiedCards — 渲染统一的数据卡片
 */
function renderUnifiedCards(items, container) {
  if (items.length === 0) {
    container.innerHTML = `
      <div class="no-data-message">
        <div class="no-data-icon">📝</div>
        <h3>暂无数据记录</h3>
        <p>开始记录您的健康数据吧</p>
      </div>
    `;
    return;
  }

  const cardsHtml = items.map(item => {
    const content = item.content || {};
    const summary = parseContentToSummary(content, item.dataType);
    
    return `
      <div class="unified-card" data-file-id="${item.id}" data-type="${item.dataType}">
        <div class="card-header">
          <div class="card-type-badge">${getTypeTitle(item.dataType)}</div>
          <div class="card-date">${formatDate(item.created_at)}</div>
        </div>
        <div class="card-content">
          <div class="card-summary">
            ${summary}
          </div>
        </div>
        <div class="card-footer">
          <div class="card-actions">
            <button class="view-detail-btn">查看详情</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;

  // 绑定点击事件
  bindUnifiedCardEvents(container);
}

/**
 * bindUnifiedCardEvents — 绑定统一卡片事件
 */
function bindUnifiedCardEvents(container) {
  // 点击卡片查看详情
  container.querySelectorAll('.unified-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__hapticImpact__) {
        window.__hapticImpact__('Medium');
      }
      const fileId = card.dataset.fileId;
      const type = card.dataset.type;
      showDetailModal(fileId, type);
    });
  });

  // 点击查看详情按钮
  container.querySelectorAll('.view-detail-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__hapticImpact__) {
        window.__hapticImpact__('Medium');
      }
      const card = btn.closest('.unified-card');
      const fileId = card.dataset.fileId;
      const type = card.dataset.type;
      showDetailModal(fileId, type);
    });
  });
}

/**
 * showDetailModal — 显示详情弹窗
 */
function showDetailModal(fileId, type) {
  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'detail-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>${getTypeTitle(type)} 详情</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <div class="loading-text">正在加载详情...</div>
        </div>
      </div>
    </div>
  `;

  // 注入详情弹窗样式到 Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    /* 详情弹窗 */
    .detail-modal {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      z-index: 99999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 20px 20px 100px 20px !important;
      box-sizing: border-box !important;
      width: 100vw !important;
      height: 100vh !important;
    }

    .modal-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(12px);
      animation: backdropFadeIn 0.4s ease-out;
    }

    @keyframes backdropFadeIn {
      from { 
        opacity: 0; 
        backdrop-filter: blur(0px);
      }
      to { 
        opacity: 1; 
        backdrop-filter: blur(12px);
      }
    }

    .modal-content {
      position: relative !important;
      background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%) !important;
      border-radius: 28px !important;
      box-shadow: 
        0 32px 64px rgba(0, 0, 0, 0.25),
        0 0 0 1px rgba(255, 255, 255, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
      max-width: 90vw !important;
      max-height: calc(100vh - 200px) !important;
      width: 100% !important;
      max-width: 700px !important;
      overflow: hidden !important;
      animation: modalSlideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      margin: 0 auto !important;
      transform: translateZ(0) !important;
    }

    .modal-content::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
      z-index: 1;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: scale(0.8) translateY(20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 28px 32px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      overflow: hidden;
    }

    .modal-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(45deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(255,255,255,0.08) 100%);
      pointer-events: none;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 1;
      letter-spacing: -0.02em;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      font-size: 1.6rem;
      color: white;
      cursor: pointer;
      padding: 12px;
      border-radius: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(10px);
      position: relative;
      z-index: 1;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.1) rotate(90deg);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    }

    .close-btn:active {
      transform: scale(0.95) rotate(90deg);
    }

    .modal-body {
      padding: 32px;
      max-height: calc(100vh - 200px);
      overflow-y: auto;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      position: relative;
    }

    .modal-body::-webkit-scrollbar {
      width: 8px;
    }

    .modal-body::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.05);
      border-radius: 4px;
    }

    .modal-body::-webkit-scrollbar-thumb {
      background: linear-gradient(180deg, #667eea, #764ba2);
      border-radius: 4px;
    }

    .modal-body::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, #5a67d8, #6b46c1);
    }

    /* 详情信息 */
    .detail-info {
      margin-bottom: 32px;
      background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      position: relative;
      overflow: hidden;
    }

    .detail-info::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2, #f093fb);
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      position: relative;
      transition: all 0.2s ease;
    }

    .info-item:hover {
      background: rgba(102, 126, 234, 0.05);
      margin: 0 -24px;
      padding-left: 24px;
      padding-right: 24px;
      border-radius: 8px;
    }

    .info-item:last-child {
      border-bottom: none;
    }

    .info-item label {
      font-weight: 700;
      color: #1e293b;
      font-size: 0.95rem;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 100px;
    }

    .info-item label::before {
      content: '●';
      color: #667eea;
      font-size: 0.6rem;
    }

    .info-item span {
      color: #475569;
      font-size: 0.9rem;
      font-weight: 500;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-align: right;
    }

    /* 格式化内容样式 */
    .detail-data h4 {
      margin: 0 0 24px 0;
      color: #1e293b;
      font-size: 1.3rem;
      font-weight: 700;
      text-align: center;
      position: relative;
      padding-bottom: 12px;
    }

    .detail-data h4::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 2px;
    }

    .formatted-content {
      color: #1e293b;
    }

    .metrics-detail {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .detail-section {
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 16px;
      padding: 24px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .detail-section:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    .detail-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(180deg, #667eea, #764ba2);
    }

    .detail-section h5 {
      margin: 0 0 16px 0;
      color: #1e293b;
      font-size: 1.1rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.01em;
    }

    .detail-section h5::before {
      content: '▶';
      color: #667eea;
      font-size: 0.8rem;
    }

    .detail-section p {
      margin: 0;
      color: #475569;
      font-size: 0.95rem;
      line-height: 1.6;
      font-weight: 500;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-top: 8px;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      transition: all 0.2s ease;
    }

    .detail-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: rgba(102, 126, 234, 0.2);
    }

    .detail-item span:first-child {
      color: #64748b;
      font-weight: 600;
      font-size: 0.9rem;
      letter-spacing: -0.01em;
    }

    .detail-item span:last-child {
      color: #1e293b;
      font-weight: 700;
      font-size: 0.95rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .matrix-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 8px;
    }

    .matrix-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.05);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .matrix-item::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 3px;
      height: 100%;
      background: linear-gradient(180deg, #667eea, #764ba2);
    }

    .matrix-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
      border-color: rgba(102, 126, 234, 0.3);
    }

    .item-name {
      color: #64748b;
      font-weight: 600;
      font-size: 0.9rem;
      letter-spacing: -0.01em;
    }

    .item-value {
      color: #1e293b;
      font-weight: 700;
      font-size: 0.95rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .json-content {
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 16px;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      color: #495057;
      white-space: pre-wrap;
      overflow-x: auto;
    }

    /* 加载动画样式 */
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      min-height: 200px;
    }

    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(102, 126, 234, 0.2);
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    .loading-text {
      color: #64748b;
      font-size: 1rem;
      font-weight: 500;
      text-align: center;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* 暗色模式支持 */
    @media (prefers-color-scheme: dark) {
      .modal-content {
        background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .modal-header {
        background: linear-gradient(135deg, #1e40af 0%, #7c3aed 100%);
      }
      
      .modal-body {
        background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
      }
      
      .detail-info {
        background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .info-item label {
        color: #e2e8f0;
      }
      
      .info-item span {
        color: #cbd5e1;
      }
      
      .detail-data h4 {
        color: #f1f5f9;
      }
      
      .formatted-content {
        color: #f1f5f9;
      }
      
      .detail-section {
        background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .detail-section h5 {
        color: #f1f5f9;
      }
      
      .detail-section p {
        color: #cbd5e1;
      }
      
      .detail-item {
        background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .detail-item span:first-child {
        color: #94a3b8;
      }
      
      .detail-item span:last-child {
        color: #f1f5f9;
      }
      
      .matrix-item {
        background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .item-name {
        color: #94a3b8;
      }
      
      .item-value {
        color: #f1f5f9;
      }
      
      .json-content {
        background: #0f172a;
        color: #e2e8f0;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .loading-spinner {
        border: 4px solid rgba(102, 126, 234, 0.2);
        border-top: 4px solid #667eea;
      }

      .loading-text {
        color: #cbd5e1;
      }
    }
  `;
  
  modal.appendChild(style);
  
  // 将弹窗添加到主文档，而不是 Shadow DOM，以便正确控制滚动
  document.body.appendChild(modal);
  
  // 禁用页面滚动
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // 绑定关闭事件
  const closeBtn = modal.querySelector('.close-btn');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  const closeModal = () => {
    // 恢复页面滚动
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    modal.remove();
  };
  
  closeBtn.addEventListener('click', () => {
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    closeModal();
  });
  
  backdrop.addEventListener('click', () => {
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    closeModal();
  });

  // 加载详情数据
  fetch(`${__API_BASE__}/getjson/${type}/${fileId}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // 添加数据类型到数据对象中
        data.data.dataType = type;
        renderDetailContent(data.data, modal.querySelector('.modal-body'));
      } else {
        modal.querySelector('.modal-body').innerHTML = '<p>加载失败</p>';
      }
    })
    .catch(err => {
      console.error('加载详情失败:', err);
      modal.querySelector('.modal-body').innerHTML = '<p>加载失败</p>';
    });
}

/**
 * showAllItemsModal — 显示全部项目弹窗
 */
function showAllItemsModal(type) {
  const userId = localStorage.getItem('userId') || 
                 localStorage.getItem('UserID') || 
                 sessionStorage.getItem('userId') || 
                 sessionStorage.getItem('UserID');

  // 创建弹窗
  const modal = document.createElement('div');
  modal.className = 'all-items-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>全部 ${getTypeTitle(type)} 记录</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="loading">正在加载...</div>
      </div>
    </div>
  `;

  // 将弹窗添加到主文档，而不是 Shadow DOM，以便正确控制滚动
  document.body.appendChild(modal);
  
  // 禁用页面滚动
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // 绑定关闭事件
  const closeBtn = modal.querySelector('.close-btn');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  const closeModal = () => {
    // 恢复页面滚动
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    modal.remove();
  };
  
  closeBtn.addEventListener('click', () => {
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    closeModal();
  });
  
  backdrop.addEventListener('click', () => {
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
    closeModal();
  });

  // 加载全部数据
  fetch(`${__API_BASE__}/getjson/${type}?user_id=${encodeURIComponent(userId)}&limit=100`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        renderAllItemsContent(data.data, type, modal.querySelector('.modal-body'));
      } else {
        modal.querySelector('.modal-body').innerHTML = '<p>加载失败</p>';
      }
    })
    .catch(err => {
      console.error('加载全部数据失败:', err);
      modal.querySelector('.modal-body').innerHTML = '<p>加载失败</p>';
    });
}

/**
 * parseContentToSummary — 解析内容为中文摘要
 */
function parseContentToSummary(content, dataType) {
  const metricsData = content.metricsData || {};
  const exportInfo = content.exportInfo || {};
  
  switch (dataType) {
    case 'metrics':
      return parseMetricsSummary(metricsData);
    case 'diet':
      return parseDietSummary(content);
    case 'case':
      return parseCaseSummary(content);
    default:
      return '未知数据类型';
  }
}

/**
 * parseMetricsSummary — 解析健康指标摘要
 */
function parseMetricsSummary(metricsData) {
  const summaries = [];
  
  // 症状
  if (metricsData.symptoms?.symptoms) {
    summaries.push(`症状: ${metricsData.symptoms.symptoms}`);
  }
  
  // 体温
  if (metricsData.temperature?.temperature) {
    summaries.push(`体温: ${metricsData.temperature.temperature}°C`);
  }
  
  // 尿常规
  if (metricsData.urinalysis) {
    const urinalysis = metricsData.urinalysis;
    const items = [];
    if (urinalysis.protein) items.push(`蛋白质: ${urinalysis.protein}`);
    if (urinalysis.glucose) items.push(`葡萄糖: ${urinalysis.glucose}`);
    if (urinalysis.ketones) items.push(`酮体: ${urinalysis.ketones}`);
    if (urinalysis.blood) items.push(`隐血: ${urinalysis.blood}`);
    if (items.length > 0) {
      summaries.push(`尿常规: ${items.join(', ')}`);
    }
  }
  
  // 24h尿蛋白
  if (metricsData.proteinuria?.proteinuria24h) {
    summaries.push(`24h尿蛋白: ${metricsData.proteinuria.proteinuria24h}g`);
  }
  
  // 血常规
  if (metricsData['blood-test']) {
    const blood = metricsData['blood-test'];
    const items = [];
    if (blood.wbc) items.push(`白细胞: ${blood.wbc}×10⁹/L`);
    if (blood.rbc) items.push(`红细胞: ${blood.rbc}×10¹²/L`);
    if (blood.hb) items.push(`血红蛋白: ${blood.hb}g/L`);
    if (blood.plt) items.push(`血小板: ${blood.plt}×10⁹/L`);
    if (items.length > 0) {
      summaries.push(`血常规: ${items.join(', ')}`);
    }
  }
  
  // 出血点
  if (metricsData['bleeding-point']?.bleedingPoint) {
    const bleeding = metricsData['bleeding-point'];
    let bleedingText = getBleedingPointText(bleeding.bleedingPoint);
    if (bleeding.otherDescription) {
      bleedingText += ` (${bleeding.otherDescription})`;
    }
    summaries.push(`出血点: ${bleedingText}`);
  }
  
  // 自我评分
  if (metricsData['self-rating']?.selfRating !== undefined) {
    summaries.push(`自我评分: ${metricsData['self-rating'].selfRating}/10分`);
  }
  
  // 尿液检测矩阵
  if (metricsData['urinalysis-matrix']?.urinalysisMatrix) {
    const matrix = metricsData['urinalysis-matrix'].urinalysisMatrix;
    if (matrix.length > 0) {
      summaries.push(`尿液检测: ${matrix.length}项指标`);
    }
  }
  
  return summaries.length > 0 ? summaries.join(' | ') : '健康指标记录';
}

/**
 * parseDietSummary — 解析饮食记录摘要
 */
function parseDietSummary(content) {
  // 这里可以根据实际的饮食数据结构来解析
  return '饮食记录数据';
}

/**
 * parseCaseSummary — 解析病例记录摘要
 */
function parseCaseSummary(content) {
  // 这里可以根据实际的病例数据结构来解析
  return '病例记录数据';
}

/**
 * getBleedingPointText — 获取出血点中文描述
 */
function getBleedingPointText(bleedingPoint) {
  const bleedingMap = {
    'nose': '鼻子',
    'gums': '牙龈',
    'skin': '皮肤',
    'joints': '关节',
    'muscles': '肌肉',
    'urine': '尿液',
    'stool': '大便',
    'vomit': '呕吐物',
    'menstrual': '月经',
    'other': '其他'
  };
  return bleedingMap[bleedingPoint] || bleedingPoint;
}

/**
 * renderDetailContent — 渲染详情内容
 */
function renderDetailContent(data, container) {
  const content = data.content || {};
  const exportInfo = content.exportInfo || {};
  const dataType = data.dataType || 'unknown';
  
  container.innerHTML = `
    <div class="detail-info">
      <div class="info-item">
        <label>记录类型:</label>
        <span>${getTypeTitle(dataType)}</span>
      </div>
      <div class="info-item">
        <label>创建时间:</label>
        <span>${formatDate(data.created_at)}</span>
      </div>
      <div class="info-item">
        <label>导出时间:</label>
        <span>${formatDate(exportInfo.exportTime)}</span>
      </div>
    </div>
    <div class="detail-data">
      <h4>详细内容:</h4>
      <div class="formatted-content">
        ${formatContentForDisplay(content, dataType)}
      </div>
    </div>
  `;
}

/**
 * formatContentForDisplay — 格式化内容用于显示
 */
function formatContentForDisplay(content, dataType) {
  console.log('formatContentForDisplay called with:', { content, dataType });
  
  const metricsData = content.metricsData || {};
  
  switch (dataType) {
    case 'metrics':
      const result = formatMetricsForDisplay(metricsData);
      console.log('formatMetricsForDisplay result:', result);
      return result;
    case 'diet':
      return formatDietForDisplay(content);
    case 'case':
      return formatCaseForDisplay(content);
    default:
      console.log('Unknown dataType:', dataType);
      return '<p>暂无详细内容</p>';
  }
}

/**
 * formatMetricsForDisplay — 格式化健康指标用于显示
 */
function formatMetricsForDisplay(metricsData) {
  console.log('formatMetricsForDisplay called with:', metricsData);
  
  let html = '<div class="metrics-detail">';
  let hasContent = false;
  
  // 症状
  if (metricsData.symptoms?.symptoms) {
    html += `
      <div class="detail-section">
        <h5>症状描述</h5>
        <p>${metricsData.symptoms.symptoms}</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 体温
  if (metricsData.temperature?.temperature) {
    html += `
      <div class="detail-section">
        <h5>体温</h5>
        <p>${metricsData.temperature.temperature}°C</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 尿常规
  if (metricsData.urinalysis) {
    const urinalysis = metricsData.urinalysis;
    const hasUrinalysisData = urinalysis.protein || urinalysis.glucose || urinalysis.ketones || urinalysis.blood;
    if (hasUrinalysisData) {
      html += `
        <div class="detail-section">
          <h5>尿常规检查</h5>
          <div class="detail-grid">
            ${urinalysis.protein ? `<div class="detail-item"><span>蛋白质:</span><span>${urinalysis.protein}</span></div>` : ''}
            ${urinalysis.glucose ? `<div class="detail-item"><span>葡萄糖:</span><span>${urinalysis.glucose}</span></div>` : ''}
            ${urinalysis.ketones ? `<div class="detail-item"><span>酮体:</span><span>${urinalysis.ketones}</span></div>` : ''}
            ${urinalysis.blood ? `<div class="detail-item"><span>隐血:</span><span>${urinalysis.blood}</span></div>` : ''}
          </div>
        </div>
      `;
      hasContent = true;
    }
  }
  
  // 24h尿蛋白
  if (metricsData.proteinuria?.proteinuria24h) {
    html += `
      <div class="detail-section">
        <h5>24小时尿蛋白</h5>
        <p>${metricsData.proteinuria.proteinuria24h}g/24h</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 血常规
  if (metricsData['blood-test']) {
    const blood = metricsData['blood-test'];
    const hasBloodData = blood.wbc || blood.rbc || blood.hb || blood.plt;
    if (hasBloodData) {
      html += `
        <div class="detail-section">
          <h5>血常规检查</h5>
          <div class="detail-grid">
            ${blood.wbc ? `<div class="detail-item"><span>白细胞:</span><span>${blood.wbc}×10⁹/L</span></div>` : ''}
            ${blood.rbc ? `<div class="detail-item"><span>红细胞:</span><span>${blood.rbc}×10¹²/L</span></div>` : ''}
            ${blood.hb ? `<div class="detail-item"><span>血红蛋白:</span><span>${blood.hb}g/L</span></div>` : ''}
            ${blood.plt ? `<div class="detail-item"><span>血小板:</span><span>${blood.plt}×10⁹/L</span></div>` : ''}
          </div>
        </div>
      `;
      hasContent = true;
    }
  }
  
  // 出血点
  if (metricsData['bleeding-point']?.bleedingPoint) {
    const bleeding = metricsData['bleeding-point'];
    let bleedingText = getBleedingPointText(bleeding.bleedingPoint);
    if (bleeding.otherDescription) {
      bleedingText += ` (${bleeding.otherDescription})`;
    }
    html += `
      <div class="detail-section">
        <h5>出血点</h5>
        <p>${bleedingText}</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 自我评分
  if (metricsData['self-rating']?.selfRating !== undefined) {
    html += `
      <div class="detail-section">
        <h5>自我评分</h5>
        <p>${metricsData['self-rating'].selfRating}/10分</p>
      </div>
    `;
    hasContent = true;
  }
  
  // 尿液检测矩阵
  if (metricsData['urinalysis-matrix']?.urinalysisMatrix) {
    const matrix = metricsData['urinalysis-matrix'].urinalysisMatrix;
    if (matrix.length > 0) {
      html += `
        <div class="detail-section">
          <h5>尿液检测指标</h5>
          <div class="matrix-grid">
            ${matrix.map(item => `
              <div class="matrix-item">
                <span class="item-name">${item.item}</span>
                <span class="item-value">${item.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      hasContent = true;
    }
  }
  
  // 如果没有找到任何内容，显示原始数据
  if (!hasContent) {
    html += `
      <div class="detail-section">
        <h5>原始数据</h5>
        <pre class="json-content">${JSON.stringify(metricsData, null, 2)}</pre>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

/**
 * formatDietForDisplay — 格式化饮食记录用于显示
 */
function formatDietForDisplay(content) {
  return '<p>饮食记录详细内容</p>';
}

/**
 * formatCaseForDisplay — 格式化病例记录用于显示
 */
function formatCaseForDisplay(content) {
  return '<p>病例记录详细内容</p>';
}

/**
 * renderAllItemsContent — 渲染全部项目内容
 */
function renderAllItemsContent(items, type, container) {
  if (items.length === 0) {
    container.innerHTML = '<p>暂无数据</p>';
    return;
  }

  const itemsHtml = items.map(item => `
    <div class="all-item" data-file-id="${item.id}" data-type="${type}">
      <div class="item-info">
        <h4>${formatFileName(item.file_name)}</h4>
        <p>${formatDate(item.created_at)}</p>
      </div>
      <div class="item-preview">
        ${item.preview ? JSON.stringify(item.preview, null, 1).substring(0, 100) + '...' : '无预览'}
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="all-items-list">
      ${itemsHtml}
    </div>
  `;

  // 绑定点击事件
  container.querySelectorAll('.all-item').forEach(item => {
    item.addEventListener('click', () => {
      const fileId = item.dataset.fileId;
      const type = item.dataset.type;
      // 关闭当前弹窗
      item.closest('.all-items-modal').remove();
      // 打开详情弹窗
      showDetailModal(fileId, type);
    });
  });
}

// 工具函数
function getTypeIcon(type) {
  const icons = {
    metrics: '📊',
    diet: '🍎',
    case: '📋'
  };
  return icons[type] || '📄';
}

function getTypeTitle(type) {
  const titles = {
    metrics: '健康指标',
    diet: '饮食记录',
    case: '病例记录'
  };
  return titles[type] || '数据记录';
}

function formatFileName(fileName) {
  if (!fileName) return '未知文件';
  // 移除时间戳后缀，只保留主要部分
  return fileName.replace(/_\d{8}T\d{6}Z\.json$/, '');
}

function formatDate(dateString) {
  if (!dateString) return '未知时间';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * destroyDaily — Tear down listeners and observers for a clean unmount.
 * 清理监听与观察者，便于无痕卸载。
 */
function destroyDaily() {
  // 中止在途请求
  abortInFlight();

  // 统一执行清理函数
  cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
  cleanupFns = [];

  onDoctorClick = null;
  onDocumentClick = null;
  dailyRoot = document;
  console.log('🧹 destroyDaily 清理完成');
}

// -----------------------------
// Public API / 对外导出
// -----------------------------
window.initDaily = initDaily;
window.destroyDaily = destroyDaily;
})();
