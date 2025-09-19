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
 * 从后端获取用户的 metrics/diet/case 数据并以卡片形式展示
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

  // 并行加载三种类型的数据
  const dataTypes = ['metrics', 'diet', 'case'];
  const promises = dataTypes.map(type => 
    fetch(`${__API_BASE__}/getjson/${type}?user_id=${encodeURIComponent(userId)}&limit=10`)
      .then(res => res.json())
      .then(data => ({ type, data }))
      .catch(err => {
        console.warn(`加载 ${type} 数据失败:`, err);
        return { type, data: { success: false, data: [] } };
      })
  );

  Promise.all(promises).then(results => {
    renderDataCards(results, cardsContainer);
  });
}

/**
 * renderDataCards — 渲染数据卡片
 */
function renderDataCards(results, container) {
  const cardsHtml = results.map(({ type, data }) => {
    if (!data.success || !data.data || data.data.length === 0) {
      return `
        <div class="data-card empty">
          <div class="card-icon">${getTypeIcon(type)}</div>
          <div class="card-content">
            <h3>${getTypeTitle(type)}</h3>
            <p>暂无数据</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="data-card">
        <div class="card-icon">${getTypeIcon(type)}</div>
        <div class="card-content">
          <h3>${getTypeTitle(type)}</h3>
          <p>共 ${data.count} 条记录</p>
          <div class="recent-items">
            ${data.data.slice(0, 3).map(item => `
              <div class="recent-item" data-file-id="${item.id}" data-type="${type}">
                <span class="item-title">${formatFileName(item.file_name)}</span>
                <span class="item-date">${formatDate(item.created_at)}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="card-actions">
          <button class="view-all-btn" data-type="${type}">查看全部</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = cardsHtml;

  // 绑定点击事件
  bindCardEvents(container);
}

/**
 * bindCardEvents — 绑定卡片事件
 */
function bindCardEvents(container) {
  // 点击最近项目查看详情
  container.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const fileId = item.dataset.fileId;
      const type = item.dataset.type;
      showDetailModal(fileId, type);
    });
  });

  // 点击查看全部按钮
  container.querySelectorAll('.view-all-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.dataset.type;
      showAllItemsModal(type);
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
        <div class="loading">正在加载详情...</div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 绑定关闭事件
  const closeBtn = modal.querySelector('.close-btn');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  const closeModal = () => {
    modal.remove();
  };
  
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

  // 加载详情数据
  fetch(`${__API_BASE__}/getjson/${type}/${fileId}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
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

  document.body.appendChild(modal);

  // 绑定关闭事件
  const closeBtn = modal.querySelector('.close-btn');
  const backdrop = modal.querySelector('.modal-backdrop');
  
  const closeModal = () => {
    modal.remove();
  };
  
  closeBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);

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
 * renderDetailContent — 渲染详情内容
 */
function renderDetailContent(data, container) {
  const content = data.content || {};
  const exportInfo = content.exportInfo || {};
  
  container.innerHTML = `
    <div class="detail-info">
      <div class="info-item">
        <label>文件名:</label>
        <span>${data.file_name || '未知'}</span>
      </div>
      <div class="info-item">
        <label>创建时间:</label>
        <span>${formatDate(data.created_at)}</span>
      </div>
      <div class="info-item">
        <label>导出时间:</label>
        <span>${formatDate(exportInfo.exportTime)}</span>
      </div>
      <div class="info-item">
        <label>应用版本:</label>
        <span>${exportInfo.version || '未知'}</span>
      </div>
    </div>
    <div class="detail-data">
      <h4>数据内容:</h4>
      <pre class="json-content">${JSON.stringify(content, null, 2)}</pre>
    </div>
  `;
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
