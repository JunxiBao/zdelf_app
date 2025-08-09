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
      try { fetchController.abort(); } catch (e) { }
      fetchController = null;
    }
  }

  // User data; will be hydrated from the backend. Default to "无" when missing.
  let user = {
    name: '无',        // 显示为用户名
    age: '无'         // 显示为年龄
  };
  // Cache password from /readdata to prefill original password
  let userPassword = '';

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
  // 头像缩写：
  // - 中文：取首字（姓）
  // - 英文：若有两个及以上大写字母，取前两个；否则取前两个字符，仅首字母大写
  function initialsFrom(name) {
    if (!name || name === '无') return '无';
    const trimmed = String(name).trim();
    if (!trimmed) return '无';
    const firstChar = trimmed[0];
    if (/[\u4E00-\u9FFF]/.test(firstChar)) {
      return firstChar;
    }
    const upperLetters = (trimmed.match(/[A-Z]/g) || []);
    if (upperLetters.length >= 2) {
      return (upperLetters[0] + upperLetters[1]).toUpperCase();
    }
    const part = trimmed.slice(0, 2);
    return part.charAt(0).toUpperCase() + part.slice(1);
  }

  /**
   * Initialize the "Me" page UI.
   * @param {Document|ShadowRoot} rootEl - Scope for DOM queries.
   */
  function initMe(rootEl) {
    const root = rootEl || document; // allow manual boot for standalone use

    // Toast notification helper（放最顶层，且不阻挡点击）
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
      t.style.zIndex = '12001';
      t.style.pointerEvents = 'none';
      t.style.opacity = '0';
      t.style.transition = 'opacity .2s ease, translate .2s ease';
      // 如果有编辑弹窗，插到其前面，确保在最上层
      const editMask = document.querySelector('.edit-mask');
      if (editMask && editMask.parentNode) {
        editMask.parentNode.insertBefore(t, editMask);
      } else {
        document.body.appendChild(t);
      }
      requestAnimationFrame(() => { t.style.opacity = '1'; t.style.translate = '0 -8px'; });
      const hideTimer = setTimeout(() => {
        t.style.opacity = '0'; t.style.translate = '0 0';
        t.addEventListener('transitionend', () => t.remove(), { once: true });
      }, 1500);
      cleanupFns.push(() => { clearTimeout(hideTimer); if (t.parentNode) t.remove(); });
    };

    // -----------------------------
    // Pretty error modal (purple theme, dark-mode friendly)
    // -----------------------------
    function ensureErrorStyles() {
      if (document.getElementById('error-modal-style')) return;
      const s = document.createElement('style');
      s.id = 'error-modal-style';
      s.textContent = `
      .err-mask{position:fixed;inset:0;display:grid;place-items:center;opacity:0;pointer-events:none;transition:opacity .2s ease;z-index:12002;backdrop-filter:blur(8px)}
      .err-mask.show{opacity:1;pointer-events:auto}
      .err-dialog{width:min(92vw,420px);background:var(--card-bg,#fff);color:var(--text,#1b1b1f);border-radius:16px;box-shadow:0 18px 42px rgba(98,0,234,.20),0 6px 18px rgba(0,0,0,.1);border:1px solid var(--border,rgba(98,0,234,.12));transform:translateY(10px) scale(.98);opacity:.98;transition:transform .2s ease,opacity .2s ease}
      .err-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .err-head{display:flex;align-items:center;gap:10px;padding:16px 18px 8px}
      .err-title{font-weight:800;letter-spacing:.3px}
      .err-body{padding:6px 18px 14px;line-height:1.6;color:var(--text,#1b1b1f)}
      .err-footer{display:flex;justify-content:flex-end;gap:10px;padding:0 12px 14px}
      .err-btn{appearance:none;border:0;border-radius:12px;padding:9px 14px;font-weight:600;cursor:pointer}
      .err-btn-ghost{background:var(--surface,rgba(0,0,0,.04));color:var(--text,#1b1b1f)}
      .err-btn-primary{background:linear-gradient(180deg,var(--primary,#6200ea),var(--primary-600,#4b00b5));color:#fff}
      @media (prefers-color-scheme: dark){
        .err-dialog{background:#1c1c22;color:var(--text,#e6e6ea);border-color:rgba(255,255,255,.08);box-shadow:0 22px 48px rgba(0,0,0,.55)}
        .err-btn-ghost{background:rgba(255,255,255,.08);color:var(--text,#e6e6ea)}
      }
      @supports(padding:max(0px)){ .err-dialog{ margin-bottom: env(safe-area-inset-bottom); } }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => { if (s.parentNode) s.remove(); });
    }

    function showErrorModal(message, title = '出错了') {
      ensureErrorStyles();
      const mask = document.createElement('div');
      mask.className = 'err-mask';
      mask.setAttribute('role', 'dialog');
      mask.setAttribute('aria-modal', 'true');

      const dlg = document.createElement('div');
      dlg.className = 'err-dialog';

      const head = document.createElement('div'); head.className = 'err-head';
      const h = document.createElement('div'); h.className = 'err-title'; h.textContent = title;
      head.append(h);

      const body = document.createElement('div'); body.className = 'err-body'; body.textContent = message || '发生未知错误';

      const foot = document.createElement('div'); foot.className = 'err-footer';
      const ok = document.createElement('button'); ok.className = 'err-btn err-btn-primary'; ok.textContent = '我知道了';
      foot.append(ok);

      dlg.append(head, body, foot);
      mask.appendChild(dlg);

      // Insert as the top-most element
      const editMask = document.querySelector('.edit-mask');
      if (editMask && editMask.parentNode) editMask.parentNode.insertBefore(mask, editMask);
      else document.body.appendChild(mask);

      requestAnimationFrame(() => { mask.classList.add('show'); dlg.classList.add('show'); });

      const close = () => {
        dlg.classList.remove('show'); mask.classList.remove('show');
        const onEnd = () => { mask.removeEventListener('transitionend', onEnd); if (mask.parentNode) mask.remove(); };
        mask.addEventListener('transitionend', onEnd);
      };
      ok.addEventListener('click', close, { once: true });
      mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
      document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { document.removeEventListener('keydown', esc); close(); } });
    }

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
    const storedId = localStorage.getItem('userId') || sessionStorage.getItem('userId') ||
      localStorage.getItem('UserID') || sessionStorage.getItem('UserID');
    const storedUsername = localStorage.getItem('username') || localStorage.getItem('Username') ||
      sessionStorage.getItem('username') || sessionStorage.getItem('Username');
    console.debug('[me] table:', tableName, 'userId:', storedId, 'username:', storedUsername);

    // --- API base (shared in initMe) ---
    const configuredBase = (document.querySelector('meta[name="api-base"]')?.content || window.API_BASE || '').trim();
    const defaultBase = 'https://zhucan.xyz:5000';
    const apiBase = (configuredBase || defaultBase).replace(/\/$/, '');


    // Initial paint with defaults ("无")
    renderUser();

    if (storedId || storedUsername) {
      abortInFlight();
      fetchController = new AbortController();
      // Build payload: prefer userId like daily.js; fallback to username if needed
      const payload = storedId ? { table_name: tableName, user_id: storedId } : { table_name: tableName, username: storedUsername };
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
            showErrorModal('无法从服务器读取资料');
            return;
          }
          const rec = json.data[0] || {};
          console.debug('[me] /readdata result:', json);
          // Map by your users schema (user_id, username, password, age)
          const username = rec && rec.username ? rec.username : '无';
          const age = (rec && (rec.age !== null && rec.age !== undefined && rec.age !== '')) ? rec.age : '无';
          user = { name: username, age };
          // 安全考虑：不再从接口缓存/使用密码字段
          userPassword = '';
          renderUser();
        })
        .catch((err) => {
          console.warn('[me] /readdata error:', err);
          showErrorModal('网络错误，请稍后再试');
        })
        .finally(() => { fetchController = null; });
      cleanupFns.push(() => abortInFlight());
    } else {
      toast('未找到用户ID/用户名，本地显示占位');
    }

    // Confirm modal (for logout)
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

        requestAnimationFrame(() => { mask.classList.add('show'); box.classList.add('show'); });

        const close = (result) => {
          box.classList.remove('show');
          mask.classList.remove('show');
          const onEnd = () => { mask.removeEventListener('transitionend', onEnd); if (mask.parentNode) mask.remove(); };
          mask.addEventListener('transitionend', onEnd);
          resolve(result);
        };

        cancelBtn.addEventListener('click', () => close(false), { once: true });
        okBtn.addEventListener('click', () => close(true), { once: true });
        mask.addEventListener('click', (e) => { if (e.target === mask) close(false); });
        document.addEventListener('keydown', function escHandler(ev) { if (ev.key === 'Escape') { document.removeEventListener('keydown', escHandler); close(false); } });

        setTimeout(() => okBtn.focus(), 0);
      });
    }

    // 绑定 ripple
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

  /* Password toggle styles — 与登录页一致 */
  .input-with-toggle { position: relative; display: flex; align-items: center; }
  .input-with-toggle input.record-textarea { width: 100%; padding-right: 44px; box-sizing: border-box; }
  .toggle-password {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    background: transparent; border: none; cursor: pointer; padding: 6px;
    display: inline-flex; align-items: center; justify-content: center; border-radius: 10px;
    transition: background-color 120ms ease, transform 120ms ease, opacity 120ms ease; opacity: .8;
    -webkit-tap-highlight-color: transparent; z-index: 2;
  }
  .toggle-password:hover { background: rgba(98,0,234,0.08); opacity: 1; }
  .toggle-password:active { transform: translateY(-50%) scale(0.96); }
  .toggle-password:focus-visible { outline: 2px solid var(--primary,#6200ea); outline-offset: 2px; }
  .toggle-password .icon { width: 22px; height: 22px; display: block; }
  .toggle-password .icon.visible { display: block; }
  .toggle-password .icon.hidden  { display: none; }

  @media (prefers-color-scheme: dark) {
    .toggle-password:hover { background: rgba(255,255,255,0.06); }
  }
`;
      document.head.appendChild(s);
      cleanupFns.push(() => { if (s.parentNode) s.remove(); });
    }

    // 密码输入装饰器：添加“显示/隐藏”按钮（使用登录页样式与 SVG 图标）
    function decoratePasswordInput(inputEl) {
      const wrap = document.createElement('div');
      wrap.className = 'input-with-toggle';
      inputEl.classList.add('record-textarea');
      const parent = inputEl.parentNode;
      parent.replaceChild(wrap, inputEl);
      wrap.appendChild(inputEl);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toggle-password';
      btn.setAttribute('aria-label', '显示密码');
      btn.setAttribute('title', '显示密码');

      // 使用与登录页相同的 SVG 图标和类名
      btn.innerHTML = `
        <svg class="icon eye icon-visible visible" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <svg class="icon eye-off icon-hidden hidden" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94"></path>
          <path d="M1 1l22 22"></path>
          <path d="M9.9 4.24A10.93 10.93 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-3.87 5.19"></path>
          <path d="M14.12 14.12A3 3 0 0 1 12 15a3 3 0 0 1-3-3 3 3 0 0 1 .88-2.12"></path>
        </svg>
      `;
      wrap.appendChild(btn);

      const eye = btn.querySelector('.eye');
      const eyeOff = btn.querySelector('.eye-off');

      function setState(show) {
        inputEl.setAttribute('type', show ? 'text' : 'password');
        btn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
        btn.setAttribute('title', show ? '隐藏密码' : '显示密码');
        eye.classList.toggle('visible', !show);
        eye.classList.toggle('hidden', show);
        eyeOff.classList.toggle('visible', show);
        eyeOff.classList.toggle('hidden', !show);
      }

      btn.addEventListener('click', () => {
        const show = inputEl.getAttribute('type') === 'password';
        btn.animate([
          { transform: 'translateY(-50%) scale(1)' },
          { transform: 'translateY(-50%) scale(0.9)' },
          { transform: 'translateY(-50%) scale(1)' }
        ], { duration: 160, easing: 'ease-out' });
        setState(show);
      });

      // 默认隐藏密码
      setState(false);

      cleanupFns.push(() => btn.replaceWith(btn.cloneNode(true)));
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
      const lAge = document.createElement('label'); lAge.textContent = '年龄'; lAge.setAttribute('for', 'edit-age');
      const iAge = document.createElement('input'); iAge.id = 'edit-age'; iAge.type = 'number'; iAge.min = '0'; iAge.max = '120'; iAge.placeholder = '请输入年龄';
      if (user && user.age !== '无' && user.age !== undefined && user.age !== null && user.age !== '') { iAge.value = parseInt(user.age, 10); }
      fAge.append(lAge, iAge);

      // 原始密码
      const fPwdOld = document.createElement('div'); fPwdOld.className = 'field';
      const lPwdOld = document.createElement('label'); lPwdOld.textContent = '原始密码'; lPwdOld.setAttribute('for', 'edit-pwd-old');
      const iPwdOld = document.createElement('input'); iPwdOld.id = 'edit-pwd-old'; iPwdOld.type = 'password'; iPwdOld.placeholder = '请输入原始密码'; iPwdOld.autocomplete = 'current-password';
      // 出于安全考虑，不自动填充原始密码
      fPwdOld.append(lPwdOld, iPwdOld);
      decoratePasswordInput(iPwdOld);

      // 新密码
      const fPwd = document.createElement('div'); fPwd.className = 'field';
      const lPwd = document.createElement('label'); lPwd.textContent = '新密码'; lPwd.setAttribute('for', 'edit-pwd');
      const iPwd = document.createElement('input'); iPwd.id = 'edit-pwd'; iPwd.type = 'password'; iPwd.placeholder = '8-20位，含大小写和数字'; iPwd.autocomplete = 'new-password';
      fPwd.append(lPwd, iPwd);
      decoratePasswordInput(iPwd);

      // 添加顺序：年龄、原始密码、新密码
      body.append(fAge, fPwdOld, fPwd);

      const footer = document.createElement('div'); footer.className = 'edit-footer';
      const btnCancel = document.createElement('button'); btnCancel.className = 'btn btn-ghost'; btnCancel.textContent = '取消';
      const btnSave = document.createElement('button'); btnSave.className = 'btn btn-primary'; btnSave.textContent = '保存';
      footer.append(btnCancel, btnSave);

      dialog.append(header, body, footer);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      requestAnimationFrame(() => { mask.classList.add('show'); dialog.classList.add('show'); });

      const close = () => {
        dialog.classList.remove('show');
        mask.classList.remove('show');
        const onEnd = () => { mask.removeEventListener('transitionend', onEnd); if (mask.parentNode) mask.remove(); };
        mask.addEventListener('transitionend', onEnd);
      };

      btnCancel.addEventListener('click', close, { once: true });
      mask.addEventListener('click', (e) => { if (e.target === mask) close(); });

      btnSave.addEventListener('click', async () => {
        const ageVal = iAge.value.trim();
        const oldPwdVal = iPwdOld.value.trim();
        const newPwdVal = iPwd.value.trim();

        if (ageVal && (isNaN(Number(ageVal)) || Number(ageVal) < 0 || Number(ageVal) > 120)) {
          showErrorModal('年龄范围应在 0~120');
          return;
        }
        // 若修改密码：必须同时提供原始密码与新密码，并进行格式与一致性校验
        if (oldPwdVal || newPwdVal) {
          if (!oldPwdVal) { showErrorModal('请填写原始密码'); return; }
          if (!newPwdVal) { showErrorModal('请填写新密码'); return; }

          // 密码规则：8-20 位，至少 1 大写 + 1 小写 + 1 数字，仅限英文字母与数字
          const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,20}$/;
          if (!passwordRegex.test(newPwdVal)) {
            showErrorModal('新密码需为8-20位，包含大写字母、小写字母和数字');
            return;
          }
          // 不能与原始密码相同
          if (newPwdVal === oldPwdVal) {
            showErrorModal('新密码不能与原始密码相同');
            return;
          }
        }

        try {
          // 模拟成功：不实际调用后端
          if (ageVal !== '') user.age = ageVal; // 更新本地展示
          renderUser();
          toast('修改成功');
          close();
        } catch (e) {
          console.warn('[me] 保存失败:', e);
          showErrorModal('保存失败，请稍后再试');
        }
      });

      cleanupFns.push(() => { if (mask.parentNode) mask.remove(); });
    }

    // 绑定“编辑资料”按钮
    const editBtn = root.querySelector('#editProfileBtn');
    if (editBtn) {
      const editHandler = () => openEditDialog();
      editBtn.addEventListener('click', editHandler);
      cleanupFns.push(() => editBtn.removeEventListener('click', editHandler));
    }

    // 退出登录
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

    // 列表项点击
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
    abortInFlight();
    cleanupFns.forEach(fn => { try { fn(); } catch (e) { } });
    cleanupFns = [];
  }

  // Expose lifecycle functions to global scope for loader
  console.debug('[me] exposing lifecycle: initMe/destroyMe');
  window.initMe = initMe;
  window.destroyMe = destroyMe;
})();