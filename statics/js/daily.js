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
  fetch('https://zhucan.xyz:5000/readdata', {
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
