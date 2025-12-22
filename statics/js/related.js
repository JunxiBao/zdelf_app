(function() {
  // 与 calendar 一致的触觉反馈入口
  function addHapticFeedback(intensity = 'Light') {
    if (window.__hapticImpact__) {
      window.__hapticImpact__(intensity);
    } else if (window.HapticManager) {
      try { window.HapticManager.impact(intensity); } catch(_) {}
    }
  }
  function getApiBase() {
    try {
      const base = (window.__API_BASE__ || window.API_BASE || 'https://app.zdelf.cn').trim();
      return base.replace(/\/$/, '');
    } catch (_) { return 'https://app.zdelf.cn'; }
  }

  function normalizeUrl(u) {
    if (!u) return '';
    try {
      const s = String(u).trim();
      if (!s) return '';
      if (/^https?:\/\//i.test(s)) return s;
      return getApiBase() + s;
    } catch (_) { return ''; }
  }

  async function resolveUserIdentity() {
    let user_id = '';
    try {
      user_id = localStorage.getItem('userId') || sessionStorage.getItem('userId') || '';
    } catch(_) {}
    return { user_id };
  }

  function formatTime(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(); } catch(_) { return iso; }
  }

  function initials(name){
    if (!name) return '?';
    return (name.trim()[0] || '?').toUpperCase();
  }

  function render(items, currentUserId) {
    const list = document.getElementById('relatedList');
    const skeleton = document.getElementById('relatedSkeleton');
    const empty = document.getElementById('relatedEmpty');
    skeleton.style.display = 'none';
    list.innerHTML = '';
    try {
      const c = document.getElementById('relatedCount');
      if (c) c.textContent = items ? items.length : 0;
    } catch(_) {}
    if (!items || !items.length) {
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    items.forEach((it, idx) => {
      const isMyPost = it.post_user_id === currentUserId;
      const isReplyToMe = !!it.parent_comment_id;
      const badgeText = isReplyToMe ? '回复了你' : (isMyPost ? '评论帖子' : '相关更新');

      const div = document.createElement('div');
      div.className = 'related-item enter-anim';
      div.style.animationDelay = (Math.min(idx, 8) * 60) + 'ms';
      const url = normalizeUrl(it.avatar_url);
      const avatarHTML = (url) ? `
        <div class="avatar-slot">
          <div class="avatar avatar-fallback">${initials(it.username || '匿')}</div>
          <img class="avatar-img" src="${url}" alt="avatar"
               onload="this.previousElementSibling.style.display='none'"
               onerror="this.style.display='none'; this.previousElementSibling.style.display='inline-flex'" />
        </div>
      ` : `
        <div class="avatar">${initials(it.username || '匿')}</div>
      `;
      div.innerHTML = `
        <div class="row">
          ${avatarHTML}
          <div>
            <div class="meta">
              <span class="badge">${badgeText}</span>
              <span>${it.username || '匿名用户'}</span>
              <span>•</span>
              <span>${formatTime(it.created_at)}</span>
            </div>
            <div class="text">${(it.text || '').replace(/</g,'&lt;')}</div>
          </div>
        </div>
      `;
      // 点击打开对应帖子（通过壳页动态加载再定位）
      div.addEventListener('click', () => {
        addHapticFeedback('Light');
        try {
          localStorage.setItem('open_square_post_id', String(it.post_id || ''));
          localStorage.setItem('global_loading', '1');
        } catch(_) {}
        // 显示本页全屏加载覆盖，避免中间过程闪烁（使用与daily页面一致的加载动画）
        try {
          const ov = document.createElement('div');
          ov.id = 'route-loading-overlay';
          ov.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;';
          ov.innerHTML = `
            <style>
              #route-loading-overlay{background:var(--bg, #ffffff)}
              #route-loading-overlay .spinner{width:40px;height:40px;border:3px solid rgba(176,143,199,0.1);border-top:3px solid #b08fc7;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px;box-shadow:0 2px 12px rgba(176,143,199,0.2)}
              #route-loading-overlay .loading-text{color:#666;font-size:0.9rem;font-weight:500;opacity:0.8;letter-spacing:-0.01em}
              @media (prefers-color-scheme: dark){
                #route-loading-overlay{background:var(--bg, #0f1115)}
                #route-loading-overlay .spinner{border:3px solid rgba(176,143,199,0.1);border-top:3px solid #b08fc7;box-shadow:0 2px 12px rgba(176,143,199,0.2)}
                #route-loading-overlay .loading-text{color:#d1d5db}
              }
              @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
            </style>
            <div class="spinner"></div>
            <div class="loading-text">正在跳转...</div>
          `;
          document.body.appendChild(ov);
        } catch(_) {}
        // 返回到壳页，由 index.js 负责切换到广场并打开帖子
        window.location.href = '../index.html';
      });
      list.appendChild(div);
    });

    // Reveal on scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('enter-anim');
          io.unobserve(e.target);
        }
      })
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
    list.querySelectorAll('.related-item').forEach(el => io.observe(el));
  }

  async function main() {
    const { user_id } = await resolveUserIdentity();
    const API_BASE = getApiBase();
    const resp = await fetch(API_BASE + '/square/related', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_user_id: user_id, limit: 500 })
    });
    const json = await resp.json();
    if (!json.success) throw new Error(json.message || '加载失败');
    // 过滤"自己回复自己"，并按时间倒序（最新在上）
    const rows = Array.isArray(json.data) ? json.data
      .filter(it => it && it.user_id !== user_id)
      .sort((a, b) => {
        const ta = a && a.created_at ? Date.parse(a.created_at) : 0;
        const tb = b && b.created_at ? Date.parse(b.created_at) : 0;
        return tb - ta;
      }) : [];
    render(rows, user_id);
    
    // 保存最新查看时间到缓存
    // 如果有数据，保存最新数据的时间戳
    // 如果没有数据，保存当前时间，表示用户已查看（虽然没有更新）
    try {
      let timeToSave = null;
      if (rows.length > 0 && rows[0].created_at) {
        const latestTime = Date.parse(rows[0].created_at);
        if (!isNaN(latestTime)) {
          timeToSave = latestTime;
        }
      } else {
        // 如果没有数据，保存当前时间，表示用户已查看
        timeToSave = Date.now();
      }
      
      if (timeToSave !== null) {
        localStorage.setItem('related_last_view_time', String(timeToSave));
        console.log('已保存 relate 页面最新查看时间:', new Date(timeToSave).toLocaleString());
      }
    } catch (err) {
      console.error('保存 relate 查看时间失败:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 与其他页面一致：进入轻触感
    addHapticFeedback('Light');
    const refresh = () => main().catch(err => {
      document.getElementById('relatedSkeleton').style.display = 'none';
      const empty = document.getElementById('relatedEmpty');
      empty.style.display = '';
      empty.querySelector('h3').textContent = '加载失败，请稍后重试';
      console.error('[related] load error', err);
    });

    // no refresh button on this page anymore

    // Back button haptic feedback (align with calendar)
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) {
      // Avoid double navigation if inline onclick exists
      try { backBtn.removeAttribute('onclick'); } catch(_) {}
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        addHapticFeedback('Medium');
        history.back();
      });
    }

    refresh();
  });
})();


