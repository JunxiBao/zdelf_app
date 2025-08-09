/**
 * me.js — Logic for the "Me" / Profile page
 *
 * Responsibilities:
 * - Populate user profile info (username, age, initials)
 * - Bind ripple effect to interactive elements
 * - Handle edit profile, logout, and custom [data-action] buttons
 * - Provide initMe(rootEl) / destroyMe() lifecycle for dynamic page loader
 *
 * Supports both:
 * - Standalone HTML usage (rootEl = document)
 * - Shadow DOM injection (rootEl = ShadowRoot)
 */
(function () {
  console.debug('[me] me.js evaluated');
  // Array of teardown callbacks to run when leaving the page
  let cleanupFns = [];

  // Abort controller for in-flight requests
  let fetchController = null;
  function abortInFlight() {
    if (fetchController) {
      try { fetchController.abort(); } catch (e) {}
      fetchController = null;
    }
  }

  // User data; will be hydrated from the backend. Default to "无" when missing.
  let user = {
    name: '无',        // 显示为用户名
    age: '无'         // 显示为年龄
  };

  /**
   * Create a Material-like ripple effect inside the clicked element.
   * Used for elements with `.rippleable` class.
   */
  function addRipple(e) {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    const x = (e.clientX || (rect.left + rect.width / 2)) - rect.left - size / 2;
    const y = (e.clientY || (rect.top + rect.height / 2)) - rect.top - size / 2;
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    target.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  // Helpers to safely read fields and compute initials
  function pick(obj, keys, fallback = '无') {
    for (const k of keys) {
      if (obj && obj[k] != null && obj[k] !== '') return obj[k];
    }
    return fallback;
  }
  function initialsFrom(name) {
    if (!name || name === '无') return '无';
    const trimmed = String(name).trim();
    if (!trimmed) return '无';
    // Check if first character is a Chinese character (CJK Unified Ideographs)
    const firstChar = trimmed[0];
    if (/[\u4E00-\u9FFF]/.test(firstChar)) {
      return firstChar;
    }
    // English or other: extract uppercase letters
    const upperLetters = (trimmed.match(/[A-Z]/g) || []);
    if (upperLetters.length >= 2) {
      return (upperLetters[0] + upperLetters[1]).toUpperCase();
    }
    // Fallback: use first two characters, only uppercase the first character
    const part = trimmed.slice(0, 2);
    return part.charAt(0).toUpperCase() + part.slice(1);
  }

  /**
   * Initialize the "Me" page UI.
   * @param {Document|ShadowRoot} rootEl - Scope for DOM queries.
   */
  function initMe(rootEl) {
    const root = rootEl || document; // allow manual boot for standalone use

    // Toast notification helper for transient messages (must be defined before use)
    const toast = (msg) => {
      const t = document.createElement('div');
      t.textContent = msg;
      t.style.position = 'fixed';
      t.style.left = '50%';
      t.style.bottom = '28px';
      t.style.transform = 'translateX(-50%)';
      t.style.background = 'var(--card)';
      t.style.color = 'var(--text)';
      t.style.padding = '10px 14px';
      t.style.borderRadius = '12px';
      t.style.boxShadow = 'var(--shadow-2)';
      t.style.zIndex = '9999';
      t.style.opacity = '0';
      t.style.transition = 'opacity .2s ease, translate .2s ease';
      document.body.appendChild(t);
      requestAnimationFrame(() => { t.style.opacity = '1'; t.style.translate = '0 -8px'; });
      const hideTimer = setTimeout(() => {
        t.style.opacity = '0'; t.style.translate = '0 0';
        t.addEventListener('transitionend', () => t.remove(), { once: true });
      }, 1500);
      cleanupFns.push(() => { clearTimeout(hideTimer); if (t.parentNode) t.remove(); });
    };

    // Fill profile name/email/initials in the UI (will hydrate from DB)
    const nameEl = root.querySelector('#displayName');
    const emailEl = root.querySelector('#displayEmail');
    const initialsEl = root.querySelector('#avatarInitials');

    function renderUser() {
      if (nameEl) nameEl.textContent = user.name || '无';
      if (emailEl) emailEl.textContent = (user.age !== '无' ? '年龄：' + user.age : '年龄：无');
      if (initialsEl) initialsEl.textContent = initialsFrom(user.name);
    }

    // Try to load from backend using stored UserID
    const appRoot = root.querySelector('main.app');
    const tableName = (appRoot && appRoot.dataset && appRoot.dataset.table) ? appRoot.dataset.table : 'users';
    // Align with daily.js: prefer lower-cased 'userId' key
    const storedId = localStorage.getItem('userId') || sessionStorage.getItem('userId') || localStorage.getItem('UserID') || sessionStorage.getItem('UserID');
    const storedUsername = localStorage.getItem('username') || localStorage.getItem('Username') || sessionStorage.getItem('username') || sessionStorage.getItem('Username');
    console.debug('[me] table:', tableName, 'userId:', storedId, 'username:', storedUsername);

    // Initial paint with defaults ("无")
    renderUser();

    if (storedId || storedUsername) {
      abortInFlight();
      fetchController = new AbortController();
      // Build payload: prefer userId like daily.js; fallback to username if needed
      const payload = storedId ? { table_name: tableName, user_id: storedId } : { table_name: tableName, username: storedUsername };
      // Prefer meta tag or window var; otherwise use the same host as daily.js for consistency
      const configuredBase = (document.querySelector('meta[name="api-base"]')?.content || window.API_BASE || '').trim();
      const defaultBase = 'https://zhucan.xyz:5000';
      const apiBase = (configuredBase || defaultBase).replace(/\/$/, '');
      const url = apiBase + '/readdata';
      console.debug('[me] POST', url, payload);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: fetchController.signal,
      })
        .then((response) => {
          console.log('📡 [me] 收到响应，状态码:', response.status);
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        })
        .then(json => {
          if (!json || json.success !== true || !Array.isArray(json.data)) {
            toast('无法从服务器读取资料');
            return;
          }
          const rec = json.data[0] || {};
          console.debug('[me] /readdata result:', json);
          // Map fields using your users schema exactly (user_id, username, password, age)
          const username = rec && rec.username ? rec.username : '无';
          const age = (rec && (rec.age !== null && rec.age !== undefined && rec.age !== '')) ? rec.age : '无';
          user = { name: username, age };
          renderUser();
        })
        .catch((err) => {
          // Network error or aborted; keep defaults
          console.warn('[me] /readdata error:', err);
          toast('网络错误，显示本地占位信息');
        })
        .finally(() => { fetchController = null; });
      // ensure request is aborted on page destroy
      cleanupFns.push(() => abortInFlight());
    } else {
      // No identifier found; keep defaults and notify once
      toast('未找到用户ID/用户名，本地显示占位');
    }

    // Custom confirm modal with animation and dark mode support
    function ensureConfirmStyles() {
      if (document.getElementById('app-confirm-style')) return;
      const s = document.createElement('style');
      s.id = 'app-confirm-style';
      s.textContent = `
      .app-confirm-mask {position: fixed; inset: 0; background: color-mix(in srgb, var(--text, #000) 20%, transparent); backdrop-filter: saturate(120%) blur(2px); display:flex; align-items:center; justify-content:center; opacity:0; transition: opacity .18s ease; z-index: 10000;}
      .app-confirm-mask.show {opacity:1;}
      .app-confirm { width: min(92vw, 360px); background: var(--card, #fff); color: var(--text, #111); border-radius: 16px; box-shadow: var(--shadow-3, 0 10px 30px rgba(0,0,0,.15)); transform: translateY(12px) scale(.98); opacity: 0; transition: transform .2s ease, opacity .2s ease; border: 1px solid var(--border, rgba(0,0,0,.06));}
      .app-confirm.show { transform: translateY(0) scale(1); opacity: 1; }
      .app-confirm__body { padding: 18px 18px 8px; font-size: 15px; line-height: 1.5; }
      .app-confirm__footer { display:flex; gap: 10px; justify-content: flex-end; padding: 0 12px 12px; }
      .app-confirm__btn { appearance: none; border: 0; padding: 9px 14px; border-radius: 12px; cursor: pointer; font-size: 14px; }
      .app-confirm__btn--ghost { background: var(--surface, rgba(0,0,0,.04)); color: var(--text, #111); }
      .app-confirm__btn--primary { background: var(--accent, #2b7cff); color: #fff; }
      .app-confirm__btn:focus { outline: 2px solid var(--accent, #2b7cff); outline-offset: 2px; }
      @media (prefers-color-scheme: dark) { 
        .app-confirm-mask { background: color-mix(in srgb, #000 50%, transparent); }
        .app-confirm { background: var(--card, #1e1f22); color: var(--text, #e6e6e6); border-color: var(--border, rgba(255,255,255,.08)); }
        .app-confirm__btn--ghost { background: var(--surface, rgba(255,255,255,.08)); color: var(--text, #e6e6e6); }
      }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => { if (s.parentNode) s.remove(); });
    }

    function confirmDialog(message) {
      ensureConfirmStyles();
      return new Promise((resolve) => {
        const mask = document.createElement('div');
        mask.className = 'app-confirm-mask';

        const box = document.createElement('div');
        box.className = 'app-confirm';

        const body = document.createElement('div');
        body.className = 'app-confirm__body';
        body.textContent = message || '确定要执行此操作吗？';

        const footer = document.createElement('div');
        footer.className = 'app-confirm__footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'app-confirm__btn app-confirm__btn--ghost';
        cancelBtn.textContent = '取消';

        const okBtn = document.createElement('button');
        okBtn.className = 'app-confirm__btn app-confirm__btn--primary';
        okBtn.textContent = '确定';

        footer.append(cancelBtn, okBtn);
        box.append(body, footer);
        mask.appendChild(box);
        document.body.appendChild(mask);

        // force reflow then show for animation
        requestAnimationFrame(() => { mask.classList.add('show'); box.classList.add('show'); });

        const close = (result) => {
          box.classList.remove('show');
          mask.classList.remove('show');
          const onEnd = () => { mask.removeEventListener('transitionend', onEnd); if (mask.parentNode) mask.remove(); };
          mask.addEventListener('transitionend', onEnd);
          resolve(result);
        };

        // interactions
        cancelBtn.addEventListener('click', () => close(false), { once: true });
        okBtn.addEventListener('click', () => close(true), { once: true });
        mask.addEventListener('click', (e) => { if (e.target === mask) close(false); });
        document.addEventListener('keydown', function escHandler(ev){ if (ev.key === 'Escape') { document.removeEventListener('keydown', escHandler); close(false); } });

        // focus management
        setTimeout(() => okBtn.focus(), 0);
      });
    }

    // Bind ripple effect and keyboard accessibility to `.rippleable` elements
    root.querySelectorAll('.rippleable').forEach(el => {
      const clickHandler = (e) => addRipple(e);
      const keyHandler = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { el.click(); } };
      el.addEventListener('click', clickHandler);
      el.addEventListener('keydown', keyHandler);
      cleanupFns.push(() => {
        el.removeEventListener('click', clickHandler);
        el.removeEventListener('keydown', keyHandler);
      });
    });

    // -----------------------------
    // Edit modal (age + password) with dark mode support
    // -----------------------------
    function ensureEditStyles() {
      if (document.getElementById('edit-profile-style')) return;
      const s = document.createElement('style');
      s.id = 'edit-profile-style';
      s.textContent = `
      .edit-mask{position:fixed;inset:0;background:color-mix(in srgb, var(--text,#000) 20%, transparent);backdrop-filter:saturate(120%) blur(2px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;z-index:10000}
      .edit-mask.show{opacity:1}
      .edit-dialog{width:min(92vw,400px);background:var(--card,#fff);color:var(--text,#111);border-radius:16px;box-shadow:var(--shadow-3,0 10px 30px rgba(0,0,0,.15));transform:translateY(12px) scale(.98);opacity:0;transition:transform .2s ease,opacity .2s ease;border:1px solid var(--border,rgba(0,0,0,.06))}
      .edit-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .edit-header{padding:16px 18px 8px;font-weight:600;font-size:16px}
      .edit-body{padding:0 18px 12px;}
      .field{display:flex;flex-direction:column;gap:6px;margin:12px 0}
      .field label{font-size:13px;opacity:.8}
      .field input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--border,rgba(0,0,0,.1));background:var(--surface,#fff);color:var(--text,#111);}
      .field input:focus{outline:2px solid var(--accent,#7c3aed);outline-offset:2px}
      .edit-footer{display:flex;gap:10px;justify-content:flex-end;padding:0 12px 14px 12px}
      .btn{appearance:none;border:0;padding:9px 14px;border-radius:12px;cursor:pointer;font-size:14px}
      .btn-ghost{background:var(--surface,rgba(0,0,0,.04));color:var(--text,#111)}
      .btn-primary{background:var(--accent,#7c3aed);color:#fff}
      @media (prefers-color-scheme: dark){
        .edit-mask{background:color-mix(in srgb,#000 50%, transparent)}
        .edit-dialog{background:var(--card,#1e1f22);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.08))}
        .field input{background:var(--surface,#232428);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.12))}
        .btn-ghost{background:var(--surface,rgba(255,255,255,.08));color:var(--text,#e6e6e6)}
      }
      @supports(padding: max(0px)){ .edit-dialog{ margin-bottom: env(safe-area-inset-bottom); } }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => { if (s.parentNode) s.remove(); });
    }

    function openEditDialog() {
      ensureEditStyles();
      const mask = document.createElement('div');
      mask.className = 'edit-mask';

      const dialog = document.createElement('div');
      dialog.className = 'edit-dialog';

      const header = document.createElement('div');
      header.className = 'edit-header';
      header.textContent = '编辑资料';

      const body = document.createElement('div');
      body.className = 'edit-body';

      const fAge = document.createElement('div'); fAge.className = 'field';
      const lAge = document.createElement('label'); lAge.textContent = '年龄'; lAge.setAttribute('for','edit-age');
      const iAge = document.createElement('input'); iAge.id='edit-age'; iAge.type='number'; iAge.min='0'; iAge.max='120'; iAge.placeholder='请输入年龄';
      if (user && user.age !== '无' && user.age !== undefined && user.age !== null && user.age !== '') { iAge.value = parseInt(user.age,10); }
      fAge.append(lAge,iAge);

      // 新增原始密码字段
      const fPwdOld = document.createElement('div'); fPwdOld.className = 'field';
      const lPwdOld = document.createElement('label'); lPwdOld.textContent = '原始密码'; lPwdOld.setAttribute('for','edit-pwd-old');
      const iPwdOld = document.createElement('input'); iPwdOld.id='edit-pwd-old'; iPwdOld.type='password'; iPwdOld.placeholder='请输入原始密码'; iPwdOld.autocomplete='current-password';
      fPwdOld.append(lPwdOld,iPwdOld);

      const fPwd = document.createElement('div'); fPwd.className = 'field';
      const lPwd = document.createElement('label'); lPwd.textContent = '新密码'; lPwd.setAttribute('for','edit-pwd');
      const iPwd = document.createElement('input'); iPwd.id='edit-pwd'; iPwd.type='password'; iPwd.placeholder='不少于 6 位'; iPwd.autocomplete='new-password';
      fPwd.append(lPwd,iPwd);

      // 按顺序添加：年龄、原始密码、新密码
      body.append(fAge, fPwdOld, fPwd);

      const footer = document.createElement('div'); footer.className = 'edit-footer';
      const btnCancel = document.createElement('button'); btnCancel.className='btn btn-ghost'; btnCancel.textContent='取消';
      const btnSave = document.createElement('button'); btnSave.className='btn btn-primary'; btnSave.textContent='保存';
      footer.append(btnCancel, btnSave);

      dialog.append(header, body, footer);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      requestAnimationFrame(()=>{ mask.classList.add('show'); dialog.classList.add('show'); });

      const close = () => {
        dialog.classList.remove('show');
        mask.classList.remove('show');
        const onEnd = () => { mask.removeEventListener('transitionend', onEnd); if (mask.parentNode) mask.remove(); };
        mask.addEventListener('transitionend', onEnd);
      };

      btnCancel.addEventListener('click', close, { once:true });
      mask.addEventListener('click', (e)=>{ if (e.target === mask) close(); });

      btnSave.addEventListener('click', async () => {
        const ageVal = iAge.value.trim();
        const oldPwdVal = iPwdOld.value.trim();
        const newPwdVal = iPwd.value.trim();
        if (ageVal && (isNaN(Number(ageVal)) || Number(ageVal) < 0 || Number(ageVal) > 120)) {
          toast('年龄范围应在 0~120');
          return;
        }
        // 如果要修改密码，必须同时提供原始密码和新密码
        if (oldPwdVal || newPwdVal) {
          if (!oldPwdVal) { toast('请填写原始密码'); return; }
          if (!newPwdVal) { toast('请填写新密码'); return; }
          const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,20}$/;
          if (!passwordRegex.test(newPwdVal)) {
            toast('新密码需为8-20位，包含大写字母、小写字母和数字');
            return;
          }
        }
        try {
          await saveProfile(ageVal, newPwdVal, oldPwdVal);
          if (ageVal !== '') user.age = ageVal; // 更新本地展示
          renderUser();
          toast('已保存');
          close();
        } catch (e) {
          console.warn('[me] 保存失败:', e);
          toast('保存失败，请稍后再试');
        }
      });

      cleanupFns.push(() => { if (mask.parentNode) mask.remove(); });
    }

    async function saveProfile(age, password, oldPassword) {
      // 读取当前 ID
      const uid = localStorage.getItem('userId') || sessionStorage.getItem('userId') || localStorage.getItem('UserID') || sessionStorage.getItem('UserID');
      if (!uid) throw new Error('missing userId');
      const table = tableName || 'users';
      const configuredBase = (document.querySelector('meta[name="api-base"]')?.content || window.API_BASE || '').trim();
      const defaultBase = 'https://zhucan.xyz:5000';
      const apiBase = (configuredBase || defaultBase).replace(/\/$/, '');
      const url = apiBase + '/updatedata';
      const updates = {};
      if (age !== '') updates.age = Number(age);
      if (password) updates.password = password;
      if (oldPassword) updates.old_password = oldPassword; // 交给后端做原始密码校验
      const payload = { table_name: table, user_id: uid, updates };
      console.debug('[me] PUT', url, payload);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      console.debug('[me] /updatedata result:', json);
      if (!json || json.success !== true) throw new Error('update failed');
      return json;
    }

    // Bind "Edit Profile" button click -> open edit modal
    const editBtn = root.querySelector('#editProfileBtn');
    if (editBtn) {
      const editHandler = () => openEditDialog();
      editBtn.addEventListener('click', editHandler);
      cleanupFns.push(() => editBtn.removeEventListener('click', editHandler));
    }

    // Bind "Logout" button click: clear storage and redirect to login page
    const logoutBtn = root.querySelector('#logoutBtn');
    if (logoutBtn) {
      const logoutHandler = async () => {
        const ok = await confirmDialog('确定要退出登录吗？');
        if (!ok) return;
        try {
          const keys = ['UserID', 'userid', 'userId'];
          keys.forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
        } catch (e) { }
        window.location.replace('src/login.html');
      };
      logoutBtn.addEventListener('click', logoutHandler);
      cleanupFns.push(() => logoutBtn.removeEventListener('click', logoutHandler));
    }

    // Bind click for custom action items; show toast with action name
    root.querySelectorAll('[data-action]').forEach(el => {
      const actionHandler = () => toast('打开：' + el.dataset.action);
      el.addEventListener('click', actionHandler);
      cleanupFns.push(() => el.removeEventListener('click', actionHandler));
    });
  }

  /**
   * Cleanup function: run all stored teardown callbacks.
   * Called before leaving the page to prevent leaks.
   */
  function destroyMe() {
    // abort any in-flight fetch
    abortInFlight();
    // run and clear all teardown callbacks
    cleanupFns.forEach(fn => { try { fn(); } catch (e) {} });
    cleanupFns = [];
  }

  // Expose lifecycle functions to global scope for loader
  console.debug('[me] exposing lifecycle: initMe/destroyMe');
  window.initMe = initMe;
  window.destroyMe = destroyMe;
})();