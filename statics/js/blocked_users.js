/**
 * blocked_users.js — 屏蔽用户管理页面控制器
 *
 * 功能:
 * - 显示已屏蔽用户列表
 * - 支持取消屏蔽用户
 */

(function () {
  'use strict';
  
  console.debug('[blocked_users] blocked_users.js 已加载');
  
  // 全局变量
  let blockedUsers = [];
  let currentUserId = null;
  
  // DOM 元素引用
  let loadingState, blockedList, emptyState, backBtn;
  
  /**
   * 初始化页面
   */
  function init() {
    console.log('🚫 初始化屏蔽用户管理页面');
    
    // 获取DOM元素
    loadingState = document.getElementById('loadingState');
    blockedList = document.getElementById('blockedList');
    emptyState = document.getElementById('emptyState');
    backBtn = document.getElementById('backBtn');
    
    // 设置事件监听器
    if (backBtn) {
      backBtn.addEventListener('click', goBack);
    }
    
    // 获取当前用户ID
    try {
      currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
      if (!currentUserId) {
        showToast('请先登录');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 1500);
        return;
      }
    } catch (error) {
      console.error('获取用户ID失败:', error);
      showToast('获取用户信息失败');
      return;
    }
    
    // 加载屏蔽用户列表
    loadBlockedUsers();
  }
  
  /**
   * 返回上一页
   */
  function goBack() {
    hapticImpact('Light');
    window.history.back();
  }
  
  /**
   * 触觉反馈
   */
  function hapticImpact(style) {
    try {
      if (window.HapticManager) {
        window.HapticManager.impact(style);
      } else if (window.__hapticImpact__) {
        window.__hapticImpact__(style);
      }
    } catch (e) {
      console.warn('震动反馈失败:', e);
    }
  }
  
  /**
   * 获取 API 基础地址
   */
  function getApiBase() {
    try {
      const defaultBase = 'https://app.zdelf.cn';
      const base = (window.__API_BASE__ || window.API_BASE || defaultBase).trim();
      return base.replace(/\/$/, '');
    } catch (_) {
      return 'https://app.zdelf.cn';
    }
  }
  
  /**
   * 加载屏蔽用户列表
   */
  async function loadBlockedUsers() {
    try {
      showLoading();
      
      const API_BASE = getApiBase();
      const resp = await fetch(API_BASE + '/block/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocker_id: currentUserId })
      });
      
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      
      if (!data.success) throw new Error(data.message || '加载失败');
      
      blockedUsers = data.data || [];
      
      // 如果有屏蔽用户，加载用户详细信息
      if (blockedUsers.length > 0) {
        await loadUsersInfo();
      }
      
      renderBlockedUsers();
    } catch (error) {
      console.error('加载屏蔽用户列表失败:', error);
      showToast('加载失败，请重试');
      hideLoading();
      showEmpty();
    }
  }
  
  /**
   * 加载用户详细信息
   */
  async function loadUsersInfo() {
    const API_BASE = getApiBase();
    
    // 批量加载用户信息
    const promises = blockedUsers.map(async (user) => {
      try {
        const resp = await fetch(API_BASE + '/readdata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: 'users',
            user_id: user.user_id
          })
        });
        
        if (!resp.ok) return;
        const data = await resp.json();
        
        if (data && data.success && Array.isArray(data.data)) {
          const userInfo = data.data[0] || {};
          user.username = userInfo.username || '未知用户';
          user.avatar_url = userInfo.avatar_url || null;
        }
      } catch (error) {
        console.error('加载用户信息失败:', error);
      }
    });
    
    await Promise.all(promises);
  }
  
  /**
   * 渲染屏蔽用户列表
   */
  function renderBlockedUsers() {
    hideLoading();
    
    if (blockedUsers.length === 0) {
      showEmpty();
      return;
    }
    
    hideEmpty();
    
    // 清空现有内容
    if (blockedList) {
      blockedList.innerHTML = '';
      
      // 渲染用户项
      blockedUsers.forEach((user, index) => {
        const userElement = createUserElement(user, index);
        blockedList.appendChild(userElement);
      });
    }
  }
  
  /**
   * 创建用户元素
   */
  function createUserElement(user, index) {
    const div = document.createElement('div');
    div.className = 'blocked-user-item';
    div.style.animationDelay = `${index * 0.08}s`;
    
    const API_BASE = getApiBase();
    const avatarUrl = user.avatar_url ?
      (user.avatar_url.startsWith('http') ? user.avatar_url : (API_BASE + user.avatar_url)) :
      null;
    
    const blockedDate = user.blocked_at ? formatDate(user.blocked_at) : '';
    
    div.innerHTML = `
      <div class="user-avatar">
        ${avatarUrl ?
          `<img src="${avatarUrl}" alt="${escapeHtml(user.username || '用户')}" class="avatar-image">` :
          `<div class="avatar-initials">${getInitials(user.username || '?')}</div>`
        }
      </div>
      <div class="user-info">
        <div class="user-name">${escapeHtml(user.username || '未知用户')}</div>
        <div class="user-id">ID: ${escapeHtml(user.user_id)}</div>
        ${blockedDate ? `<div class="blocked-date">屏蔽于 ${blockedDate}</div>` : ''}
      </div>
      <button class="unblock-btn" data-user-id="${user.user_id}" data-username="${escapeHtml(user.username || '用户')}">
        <span>取消屏蔽</span>
      </button>
    `;
    
    // 添加点击事件
    const unblockBtn = div.querySelector('.unblock-btn');
    if (unblockBtn) {
      unblockBtn.addEventListener('click', () => {
        const userId = unblockBtn.dataset.userId;
        const username = unblockBtn.dataset.username;
        handleUnblock(userId, username);
      });
    }
    
    return div;
  }
  
  /**
   * 确认弹窗样式（复制自me.js）
   */
  function ensureConfirmStyles() {
    if (document.getElementById("app-confirm-style")) return;
    const s = document.createElement("style");
    s.id = "app-confirm-style";
    s.textContent = `
      .app-confirm-mask {
        position: fixed; 
        inset: 0; 
        background: color-mix(in srgb, var(--text, #000) 20%, transparent); 
        backdrop-filter: saturate(120%) blur(2px); 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        opacity: 0; 
        transition: opacity .18s ease; 
        z-index: 10000;
      }
      .app-confirm-mask.show {
        opacity: 1;
      }
      .app-confirm { 
        width: min(92vw, 360px); 
        background: var(--card, #fff); 
        color: var(--text, #111); 
        border-radius: 16px; 
        box-shadow: var(--shadow-2, 0 10px 30px rgba(0,0,0,.15)); 
        transform: translateY(12px) scale(.98); 
        opacity: 0; 
        transition: transform .2s ease, opacity .2s ease; 
        border: 1px solid var(--divider, rgba(0,0,0,.06));
      }
      .app-confirm.show { 
        transform: translateY(0) scale(1); 
        opacity: 1; 
      }
      .app-confirm__body { 
        padding: 18px 18px 8px; 
        font-size: 15px; 
        line-height: 1.5; 
      }
      .app-confirm__footer { 
        display:flex; 
        gap: 10px; 
        justify-content: flex-end; 
        padding: 0 12px 12px; 
      }
      .app-confirm__btn { 
        appearance: none; 
        border: 0; 
        padding: 9px 14px; 
        border-radius: 12px; 
        cursor: pointer; 
        font-size: 14px; 
        font-weight: 500;
        transition: all 0.2s ease;
      }
      .app-confirm__btn--ghost { 
        background: var(--surface, rgba(0,0,0,.04)); 
        color: var(--text, #111); 
      }
      .app-confirm__btn--ghost:hover {
        background: rgba(0,0,0,.08);
      }
      .app-confirm__btn--primary { 
        background: var(--accent, #2b7cff); 
        color: #fff; 
      }
      .app-confirm__btn--primary:hover {
        background: #1a6de8;
        transform: translateY(-1px);
      }
      .app-confirm__btn:focus { 
        outline: 2px solid var(--accent, #2b7cff); 
        outline-offset: 2px; 
      }
      @media (prefers-color-scheme: dark) { 
        .app-confirm-mask { 
          background: color-mix(in srgb, #000 50%, transparent); 
        }
        .app-confirm { 
          background: var(--card, #1e1f22); 
          color: var(--text, #e6e6e6); 
          border-color: var(--border, rgba(255,255,255,.08)); 
        }
        .app-confirm__btn--ghost { 
          background: var(--surface, rgba(255,255,255,.08)); 
          color: var(--text, #e6e6e6); 
        }
        .app-confirm__btn--ghost:hover {
          background: rgba(255,255,255,.12);
        }
      }
    `;
    document.head.appendChild(s);
  }

  /**
   * 确认对话框（复制自me.js）
   */
  function confirmDialog(message) {
    ensureConfirmStyles();
    return new Promise((resolve) => {
      const mask = document.createElement("div");
      mask.className = "app-confirm-mask";

      const box = document.createElement("div");
      box.className = "app-confirm";

      const body = document.createElement("div");
      body.className = "app-confirm__body";
      body.textContent = message || "确定要执行此操作吗？";

      const footer = document.createElement("div");
      footer.className = "app-confirm__footer";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "app-confirm__btn app-confirm__btn--ghost";
      cancelBtn.textContent = "取消";

      const okBtn = document.createElement("button");
      okBtn.className = "app-confirm__btn app-confirm__btn--primary";
      okBtn.textContent = "确定";

      footer.append(cancelBtn, okBtn);
      box.append(body, footer);
      mask.appendChild(box);
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        box.classList.add("show");
      });

      const close = (result) => {
        box.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
        resolve(result);
      };

      // 事件处理
      cancelBtn.addEventListener("click", () => {
        hapticImpact('Light');
        close(false);
      }, { once: true });

      okBtn.addEventListener("click", () => {
        hapticImpact('Medium');
        close(true);
      }, { once: true });

      mask.addEventListener("click", (e) => {
        if (e.target === mask) {
          close(false);
        }
      }, { once: true });

      // ESC键关闭
      const handleEsc = (e) => {
        if (e.key === "Escape") {
          close(false);
          document.removeEventListener("keydown", handleEsc);
        }
      };
      document.addEventListener("keydown", handleEsc);

      // 聚焦到确定按钮
      setTimeout(() => okBtn.focus(), 0);
    });
  }

  /**
   * 处理取消屏蔽
   */
  async function handleUnblock(userId, username) {
    hapticImpact('Light');
    
    const confirmed = await confirmDialog(`确定要取消屏蔽用户"${username}"吗？`);
    if (!confirmed) {
      return;
    }
    
    try {
      const API_BASE = getApiBase();
      const resp = await fetch(API_BASE + '/block/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocker_id: currentUserId,
          blocked_id: userId
        })
      });
      
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      
      if (!data.success) throw new Error(data.message || '取消屏蔽失败');
      
      showToast('已取消屏蔽');
      hapticImpact('Medium');
      
      // 添加删除动画
      const userItem = document.querySelector(`[data-user-id="${userId}"]`)?.closest('.blocked-user-item');
      if (userItem) {
        userItem.classList.add('removing');
        // 等待动画完成后再重新加载列表
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      
      // 重新加载列表
      await loadBlockedUsers();
    } catch (error) {
      console.error('取消屏蔽失败:', error);
      showToast(error.message || '操作失败，请重试');
    }
  }
  
  /**
   * 获取用户名首字母
   */
  function getInitials(name) {
    if (!name || name === '?') return '?';
    return name.charAt(0).toUpperCase();
  }
  
  /**
   * 转义HTML字符
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * 格式化日期
   */
  function formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return '今天';
      } else if (diffDays === 1) {
        return '昨天';
      } else if (diffDays < 7) {
        return `${diffDays}天前`;
      } else {
        return date.toLocaleDateString('zh-CN');
      }
    } catch (error) {
      return '';
    }
  }
  
  /**
   * 显示加载状态
   */
  function showLoading() {
    if (loadingState) loadingState.style.display = 'flex';
    if (blockedList) blockedList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
  }
  
  /**
   * 隐藏加载状态
   */
  function hideLoading() {
    if (loadingState) loadingState.style.display = 'none';
    if (blockedList) blockedList.style.display = 'flex';
  }
  
  /**
   * 显示空状态
   */
  function showEmpty() {
    if (emptyState) emptyState.style.display = 'flex';
    if (blockedList) blockedList.style.display = 'none';
  }
  
  /**
   * 隐藏空状态
   */
  function hideEmpty() {
    if (emptyState) emptyState.style.display = 'none';
  }
  
  /**
   * 显示提示消息
   */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
  
  // 页面加载完成后初始化
  document.addEventListener('DOMContentLoaded', init);
  
})();

