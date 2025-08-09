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
      //!const handler = () => toast('打开资料编辑');
      editBtn.addEventListener('click', handler);
      cleanupFns.push(() => editBtn.removeEventListener('click', handler));
    }

    // Bind "Logout" button click: clear storage and redirect to login page
    const logoutBtn = root.querySelector('#logoutBtn');
    if (logoutBtn) {
      const handler = () => {
        try {
          const keys = ['UserID', 'userid', 'userId'];
          keys.forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
        } catch (e) { }
        // 跳转到登录页（按你的相对路径需求可调整）
        window.location.replace('./login.html');
      };
      logoutBtn.addEventListener('click', handler);
      cleanupFns.push(() => logoutBtn.removeEventListener('click', handler));
    }

    // Bind click for custom action items; show toast with action name
    root.querySelectorAll('[data-action]').forEach(el => {
      //!const handler = () => toast('打开：' + el.dataset.action);
      el.addEventListener('click', handler);
      cleanupFns.push(() => el.removeEventListener('click', handler));
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