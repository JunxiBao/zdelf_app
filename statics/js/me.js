/**
 * me.js — Logic for the "Me" / Profile page
 *
 * Responsibilities:
 * - Populate user profile info (name, email, initials)
 * - Bind ripple effect to interactive elements
 * - Handle edit profile, logout, and custom [data-action] buttons
 * - Provide initMe(rootEl) / destroyMe() lifecycle for dynamic page loader
 *
 * Supports both:
 * - Standalone HTML usage (rootEl = document)
 * - Shadow DOM injection (rootEl = ShadowRoot)
 */
(function () {
  // Array of teardown callbacks to run when leaving the page
  let cleanupFns = [];

  // Placeholder user data; replace with actual API call in production
  const user = {
    name: 'Junxi Bao',
    email: 'junxi@example.com'
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

  /**
   * Initialize the "Me" page UI.
   * @param {Document|ShadowRoot} rootEl - Scope for DOM queries.
   */
  function initMe(rootEl) {
    const root = rootEl || document; // allow manual boot for standalone use

    // Fill profile name/email/initials in the UI
    const nameEl = root.querySelector('#displayName');
    const emailEl = root.querySelector('#displayEmail');
    const initialsEl = root.querySelector('#avatarInitials');
    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (initialsEl) {
      initialsEl.textContent = user.name
        .split(/\s+/)
        .map(s => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }

    // Toast notification helper for transient messages
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

    // Bind "Edit Profile" button click
    const editBtn = root.querySelector('#editProfileBtn');
    if (editBtn) {
      const editHandler = () => toast('打开资料编辑');
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
    // run and clear all teardown callbacks
    cleanupFns.forEach(fn => { try { fn(); } catch (e) {} });
    cleanupFns = [];
  }

  // Expose lifecycle functions to global scope for loader
  window.initMe = initMe;
  window.destroyMe = destroyMe;
})();