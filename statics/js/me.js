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
  console.debug("[me] me.js evaluated");
  
  // ==================== 应用版本配置 ====================
  // 在这里修改应用版本号 - 格式: "主版本.次版本.修订版本.构建版本"
  const APP_VERSION = "1.4.0.0";
  
  // 构建时间戳 - 用于强制刷新缓存
  const BUILD_TIMESTAMP = Date.now();
  
  // 版本检查配置
  const VERSION_CHECK_CONFIG = {
    enabled: true,                    // 是否启用版本检查
    serverUrl: "https://app.zdelf.cn/version/version.json",
    timeout: 10000                    // 网络请求超时时间(毫秒)
  };
  // ====================================================
  
  // Array of teardown callbacks to run when leaving the page
  let cleanupFns = [];



  // Abort controller for in-flight requests
  let fetchController = null;
  function abortInFlight() {
    if (fetchController) {
      try {
        fetchController.abort();
      } catch (e) {}
      fetchController = null;
    }
  }

  // User data; will be hydrated from the backend. Default to "无" when missing.
  let user = {
    name: "无", // 显示为用户名
    age: "无", // 显示为年龄
    phone: "无", // 显示为手机号
    avatar_url: null, // 头像URL
  };
  // Cache password from /readdata to prefill original password
  let userPassword = "";
  // Keep current password only for equality check (never rendered)
  let currentPassword = null;

  // 震动反馈函数 - 使用统一的HapticManager
  function triggerVibration(type = 'Light', options = {}) {
    try {
      if (window.HapticManager) {
        // 使用新的统一震动管理器，带防抖功能
        window.HapticManager.impact(type, { context: 'me-page', debounce: 100, ...options });
      } else if (window.__hapticImpact__) {
        // 降级到旧版本
        window.__hapticImpact__(type);
      }
    } catch (e) {
      console.warn('震动反馈失败:', e);
    }
  }

  /**
   * Create a Material-like ripple effect inside the clicked element.
   * Used for elements with `.rippleable` class.
   */
  function addRipple(e) {
    const target = e.currentTarget;
    triggerVibration('Light');
    const rect = target.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height);
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = size + "px";
    const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    target.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), {
      once: true,
    });
  }

  // Helpers to safely read fields and compute initials
  function pick(obj, keys, fallback = "无") {
    for (const k of keys) {
      if (obj && obj[k] != null && obj[k] !== "") return obj[k];
    }
    return fallback;
  }
  // 头像缩写：
  // - 中文：取首字（姓）
  // - 英文：若有两个及以上大写字母，取前两个；否则取前两个字符，仅首字母大写
  function initialsFrom(name) {
    if (!name || name === "无") return "无";
    const trimmed = String(name).trim();
    if (!trimmed) return "无";
    const firstChar = trimmed[0];
    if (/[\u4E00-\u9FFF]/.test(firstChar)) {
      return firstChar;
    }
    const upperLetters = trimmed.match(/[A-Z]/g) || [];
    if (upperLetters.length >= 2) {
      return (upperLetters[0] + upperLetters[1]).toUpperCase();
    }
    const part = trimmed.slice(0, 2);
    return part.charAt(0).toUpperCase() + part.slice(1);
  }

  // 将手机号打码：11 位数字显示为 3-4-4 规则中间打码；其他情况原样返回
  function maskPhone(p) {
    if (!p || p === "无") return "无";
    const s = String(p).replace(/\s+/g, "");
    const m = s.match(/(?:(?:\+?86)?)(\d{11})$/);
    if (m) {
      const n = m[1];
      return n.slice(0, 3) + "****" + n.slice(7);
    }
    return s;
  }

  
  // 头像裁剪模态框
  function showAvatarCropModal(imageData, userId, username) {
    console.log("[me] 显示头像裁剪模态框，图片数据长度:", imageData ? imageData.length : 0);
    
    // 检测深色模式
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    console.log("[me] 深色模式:", isDarkMode);
    
    // 先移除可能存在的旧模态框
    const existingMask = document.querySelector('.avatar-crop-mask');
    if (existingMask) {
      existingMask.remove();
    }
    
    const mask = document.createElement("div");
    mask.className = "avatar-crop-mask";
    
    // 根据深色模式选择背景色
    const maskBackground = isDarkMode 
      ? "rgba(0, 0, 0, 0.9)" 
      : "rgba(0, 0, 0, 0.8)";
    
    mask.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: ${maskBackground};
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      opacity: 1;
    `;
    
    const dialog = document.createElement("div");
    dialog.className = "avatar-crop-dialog";
    
    // 根据深色模式选择对话框样式
    const dialogBackground = isDarkMode 
      ? "linear-gradient(135deg, #1f2937 0%, #111827 100%)" 
      : "white";
    const dialogShadow = isDarkMode 
      ? "0 20px 40px rgba(0, 0, 0, 0.5)" 
      : "0 20px 40px rgba(0, 0, 0, 0.3)";
    
    dialog.style.cssText = `
      width: 90vw;
      max-width: 400px;
      background: ${dialogBackground};
      border-radius: 16px;
      box-shadow: ${dialogShadow};
      overflow: hidden;
      position: relative;
      z-index: 100000;
      opacity: 1;
      transform: scale(1);
      border: ${isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'};
    `;
    
    // 根据深色模式选择内容样式
    const contentBackground = isDarkMode ? "transparent" : "white";
    const titleColor = isDarkMode ? "#f9fafb" : "#333";
    const textColor = isDarkMode ? "#d1d5db" : "#666";
    const borderColor = isDarkMode ? "#a78bfa" : "#1a73e8";
    const cancelBg = isDarkMode ? "#374151" : "#f5f5f5";
    const cancelBorder = isDarkMode ? "#4b5563" : "#ddd";
    const cancelText = isDarkMode ? "#f9fafb" : "#333";
    const confirmBg = isDarkMode ? "#a78bfa" : "#1a73e8";
    
    // 简化的模态框内容
    dialog.innerHTML = `
      <div style="padding: 20px; text-align: center; background: ${contentBackground}; min-height: 300px;">
        <h3 style="margin: 0 0 16px 0; color: ${titleColor}; font-size: 18px; font-weight: 600;">头像裁剪</h3>
        <div style="width: 200px; height: 200px; margin: 0 auto 16px; border-radius: 50%; overflow: hidden; border: 3px solid ${borderColor}; box-shadow: 0 4px 12px rgba(0,0,0,${isDarkMode ? '0.3' : '0.15'});">
          <img src="${imageData}" style="width: 100%; height: 100%; object-fit: cover;" alt="头像预览" onerror="console.log('图片加载失败')">
        </div>
        <p style="margin: 0 0 20px 0; color: ${textColor}; font-size: 14px;">圆形头像预览</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="cancelCrop" style="padding: 10px 20px; border: 1px solid ${cancelBorder}; background: ${cancelBg}; color: ${cancelText}; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s;">取消</button>
          <button id="confirmCrop" style="padding: 10px 20px; border: none; background: ${confirmBg}; color: white; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s;">确认</button>
        </div>
      </div>
    `;
    
    mask.appendChild(dialog);
    document.body.appendChild(mask);
    
    console.log("[me] 模态框已添加到DOM");
    
    // 立即显示，不使用动画
    setTimeout(() => {
      console.log("[me] 模态框应该可见了");
      console.log("[me] 模态框位置:", mask.getBoundingClientRect());
      console.log("[me] 模态框样式:", mask.style.cssText);
      // 强制显示
      mask.style.display = 'flex';
      mask.style.opacity = '1';
      mask.style.visibility = 'visible';
    }, 100);
    
    // 关闭函数
    const close = () => {
      if (mask.parentNode) mask.remove();
    };
    
    // 事件处理
    const cancelBtn = dialog.querySelector("#cancelCrop");
    const confirmBtn = dialog.querySelector("#confirmCrop");
    
    // 添加按钮悬停效果
    if (cancelBtn) {
      cancelBtn.addEventListener("mouseenter", () => {
        if (isDarkMode) {
          cancelBtn.style.background = "#4b5563";
          cancelBtn.style.borderColor = "#6b7280";
        } else {
          cancelBtn.style.background = "#e5e7eb";
        }
      });
      cancelBtn.addEventListener("mouseleave", () => {
        if (isDarkMode) {
          cancelBtn.style.background = "#374151";
          cancelBtn.style.borderColor = "#4b5563";
        } else {
          cancelBtn.style.background = "#f5f5f5";
        }
      });
    }
    
    if (confirmBtn) {
      confirmBtn.addEventListener("mouseenter", () => {
        if (isDarkMode) {
          confirmBtn.style.background = "#c4b5fd";
        } else {
          confirmBtn.style.background = "#1557b0";
        }
      });
      confirmBtn.addEventListener("mouseleave", () => {
        if (isDarkMode) {
          confirmBtn.style.background = "#a78bfa";
        } else {
          confirmBtn.style.background = "#1a73e8";
        }
      });
    }
    
    cancelBtn.addEventListener("click", close, { once: true });
    mask.addEventListener("click", (e) => {
      if (e.target === mask) close();
    });
    
    confirmBtn.addEventListener("click", () => {
      uploadAvatar(imageData, userId, username);
      close();
    }, { once: true });
    
    // ESC键关闭
    const escHandler = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", escHandler);
        close();
      }
    };
    document.addEventListener("keydown", escHandler);
    
    cleanupFns.push(() => {
      document.removeEventListener("keydown", escHandler);
      if (mask.parentNode) mask.remove();
    });
  }
  
  // 上传头像到服务器
  async function uploadAvatar(imageData, userId, username) {
    try {
      console.log("[me] 开始上传头像，用户ID:", userId || username);
      console.log("[me] API地址:", apiBase + "/upload_avatar");
      
      // 前端压缩处理
      const compressedData = await compressImage(imageData);
      console.log("[me] 图片压缩完成，压缩后大小:", compressedData.length);
      
      const payload = {
        user_id: userId || username,
        avatar_data: compressedData
      };
      
      console.log("[me] 发送请求，payload keys:", Object.keys(payload));
      
      const response = await fetch(apiBase + "/upload_avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      console.log("[me] 响应状态:", response.status, response.statusText);
      
      const result = await response.json();
      console.log("[me] 响应数据:", result);
      
      if (!response.ok || !result.success) {
        console.error("[me] 上传失败:", result);
        showErrorModal(result.message || "头像上传失败");
        return;
      }
      
      // 更新本地用户数据
      user.avatar_url = result.data.avatar_url;
      console.log("[me] 更新头像URL:", user.avatar_url);
      renderUser();
      showSuccessModal("头像上传成功");
      
    } catch (error) {
      console.error("[me] 头像上传失败:", error);
      console.error("[me] 错误详情:", error.message, error.stack);
      showErrorModal("头像上传失败，请稍后再试");
    }
  }
  

  /**
   * Initialize the "Me" page UI.
   * @param {Document|ShadowRoot} rootEl - Scope for DOM queries.
   */
  function initMe(rootEl) {
    const root = rootEl || document; // allow manual boot for standalone use
    
    console.log("[me] initMe初始化");
    
    
    // 初始化版本显示
    function updateVersionDisplay() {
      try {
        const version = getCurrentVersion();
        const versionElement = root.querySelector("#versionCard .version-number");
        
        if (!versionElement) {
          console.warn('版本显示元素未找到');
          return;
        }
        
        if (!version || typeof version !== 'string') {
          console.warn('版本号无效:', version);
          versionElement.textContent = "版本未知";
          return;
        }
        
        versionElement.textContent = `v${version}`;
        console.log('更新版本显示为:', version);
        console.log('构建时间戳:', BUILD_TIMESTAMP);
      } catch (error) {
        console.warn('更新版本显示失败:', error);
        const versionElement = root.querySelector("#versionCard .version-number");
        if (versionElement) {
          versionElement.textContent = "版本错误";
        }
      }
    }
    
    
    // 页面加载后更新版本显示
    updateVersionDisplay();

    // 震动反馈设置管理
    function getVibrationSetting() {
      const stored = localStorage.getItem('vibration_enabled');
      return stored !== null ? stored === 'true' : true; // 默认开启
    }

    function setVibrationSetting(enabled) {
      localStorage.setItem('vibration_enabled', enabled.toString());
    }


    // Toast notification helper（放最顶层，且不阻挡点击）
    const toast = (msg) => {
      const t = document.createElement("div");
      t.textContent = msg;
      t.style.position = "fixed";
      t.style.left = "50%";
      t.style.bottom = "28px";
      t.style.transform = "translateX(-50%)";
      t.style.background = "var(--card)";
      t.style.color = "var(--text)";
      t.style.padding = "10px 14px";
      t.style.borderRadius = "12px";
      t.style.boxShadow = "var(--shadow-2)";
      t.style.zIndex = "12001";
      t.style.pointerEvents = "none";
      t.style.opacity = "0";
      t.style.transition = "opacity .2s ease, translate .2s ease";
      // 如果有编辑弹窗，插到其前面，确保在最上层
      const editMask = document.querySelector(".edit-mask");
      if (editMask && editMask.parentNode) {
        editMask.parentNode.insertBefore(t, editMask);
      } else {
        document.body.appendChild(t);
      }
      requestAnimationFrame(() => {
        t.style.opacity = "1";
        t.style.translate = "0 -8px";
      });
      const hideTimer = setTimeout(() => {
        t.style.opacity = "0";
        t.style.translate = "0 0";
        t.addEventListener("transitionend", () => t.remove(), { once: true });
      }, 1500);
      cleanupFns.push(() => {
        clearTimeout(hideTimer);
        if (t.parentNode) t.remove();
      });
    };

    // -----------------------------
    // Pretty error modal (purple theme, dark-mode friendly)
    // -----------------------------
    function ensureErrorStyles() {
      if (document.getElementById("error-modal-style")) return;
      const s = document.createElement("style");
      s.id = "error-modal-style";
      s.textContent = `
      .err-mask{position:fixed;inset:0;display:grid;place-items:center;opacity:0;pointer-events:none;transition:opacity .2s ease;z-index:120000;backdrop-filter:blur(8px)}
      .err-mask.show{opacity:1;pointer-events:auto}
      .err-dialog{width:min(92vw,420px);background:var(--card-bg,#fff);color:var(--text,#1b1b1f);border-radius:16px;box-shadow:0 18px 42px rgba(98,0,234,.20),0 6px 18px rgba(0,0,0,.1);border:1px solid var(--border,rgba(98,0,234,.12));transform:translateY(10px) scale(.98);opacity:.98;transition:transform .2s ease,opacity .2s ease}
      .err-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .err-head{display:flex;align-items:center;gap:10px;padding:16px 18px 8px}
      .err-title{font-weight:800;letter-spacing:.3px}
      .err-body{padding:6px 18px 14px;line-height:1.6;color:inherit}
      .err-footer{display:flex;justify-content:flex-end;gap:10px;padding:0 12px 14px}
      .err-btn{appearance:none;border:0;border-radius:12px;padding:9px 14px;font-weight:600;cursor:pointer}
      .err-btn-ghost{background:var(--surface,rgba(0,0,0,.04));color:var(--text,#1b1b1f)}
      .err-btn-primary{background:linear-gradient(180deg,var(--primary,#6200ea),var(--primary-600,#4b00b5));color:#fff}
      @media (prefers-color-scheme: dark){
        .err-dialog{background:#1c1c22;color:#e6e6ea;border-color:rgba(255,255,255,.08);box-shadow:0 22px 48px rgba(0,0,0,.55)}
        .err-title{color:#e6e6ea}
        .err-body{color:#e6e6ea}
        .err-btn-ghost{background:rgba(255,255,255,.08);color:#e6e6ea}
      }
      @supports(padding:max(0px)){ .err-dialog{ margin-bottom: env(safe-area-inset-bottom); } }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => {
        if (s.parentNode) s.remove();
      });
    }

    function showErrorModal(message, title = "出错了") {
      ensureErrorStyles();
      const mask = document.createElement("div");
      mask.className = "err-mask";
      mask.setAttribute("role", "dialog");
      mask.setAttribute("aria-modal", "true");

      const dlg = document.createElement("div");
      dlg.className = "err-dialog";

      const head = document.createElement("div");
      head.className = "err-head";
      const h = document.createElement("div");
      h.className = "err-title";
      h.textContent = title;
      head.append(h);

      const body = document.createElement("div");
      body.className = "err-body";
      body.textContent = message || "发生未知错误";

      const foot = document.createElement("div");
      foot.className = "err-footer";
      const ok = document.createElement("button");
      ok.className = "err-btn err-btn-primary";
      ok.textContent = "我知道了";
      foot.append(ok);

      dlg.append(head, body, foot);
      mask.appendChild(dlg);

      // Always append to body so it stays on top of any modal
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        dlg.classList.add("show");
      });

      const close = () => {
        dlg.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
      };
      ok.addEventListener("click", close, { once: true });
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });
      document.addEventListener("keydown", function esc(ev) {
        if (ev.key === "Escape") {
          document.removeEventListener("keydown", esc);
          close();
        }
      });
    }

    // -----------------------------
    // Success modal (purple theme, dark-mode friendly)
    // -----------------------------
    function ensureSuccessStyles() {
      if (document.getElementById("success-modal-style")) return;
      const s = document.createElement("style");
      s.id = "success-modal-style";
      s.textContent = `
      .ok-mask{position:fixed;inset:0;display:grid;place-items:center;opacity:0;pointer-events:none;transition:opacity .2s ease;z-index:120000;backdrop-filter:blur(8px)}
      .ok-mask.show{opacity:1;pointer-events:auto}
      .ok-dialog{width:min(92vw,420px);background:var(--card-bg,#fff);color:var(--text,#1b1b1f);border-radius:16px;box-shadow:0 18px 42px rgba(98,0,234,.20),0 6px 18px rgba(0,0,0,.1);border:1px solid var(--border,rgba(98,0,234,.12));transform:translateY(10px) scale(.98);opacity:.98;transition:transform .2s ease,opacity .2s ease}
      .ok-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .ok-head{display:flex;align-items:center;gap:10px;padding:16px 18px 8px}
      .ok-title{font-weight:800;letter-spacing:.3px}
      .ok-body{padding:6px 18px 14px;line-height:1.6;color:inherit}
      .ok-footer{display:flex;justify-content:flex-end;gap:10px;padding:0 12px 14px}
      .ok-btn{appearance:none;border:0;border-radius:12px;padding:9px 14px;font-weight:600;cursor:pointer}
      .ok-btn-primary{background:linear-gradient(180deg,var(--primary,#6200ea),var(--primary-600,#4b00b5));color:#fff}
      @media (prefers-color-scheme: dark){
        .ok-dialog{background:#1c1c22;color:#e6e6ea;border-color:rgba(255,255,255,.08);box-shadow:0 22px 48px rgba(0,0,0,.55)}
        .ok-title{color:#e6e6ea}
        .ok-body{color:#e6e6ea}
      }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => {
        if (s.parentNode) s.remove();
      });
    }

    function showSuccessModal(message, title = "已保存") {
      ensureSuccessStyles();
      const mask = document.createElement("div");
      mask.className = "ok-mask";
      mask.setAttribute("role", "dialog");
      mask.setAttribute("aria-modal", "true");

      const dlg = document.createElement("div");
      dlg.className = "ok-dialog";

      const head = document.createElement("div");
      head.className = "ok-head";
      const h = document.createElement("div");
      h.className = "ok-title";
      h.textContent = title;
      head.append(h);

      const body = document.createElement("div");
      body.className = "ok-body";
      body.textContent = message || "保存成功";

      const foot = document.createElement("div");
      foot.className = "ok-footer";
      const ok = document.createElement("button");
      ok.className = "ok-btn ok-btn-primary";
      ok.textContent = "好的";
      foot.append(ok);

      dlg.append(head, body, foot);
      mask.appendChild(dlg);
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        dlg.classList.add("show");
      });

      const close = () => {
        dlg.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
      };
      ok.addEventListener("click", close, { once: true });
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });

      // auto close after 1.6s
      const timer = setTimeout(close, 1600);
      cleanupFns.push(() => {
        clearTimeout(timer);
        if (mask.parentNode) mask.remove();
      });
    }

    // Fill profile name/age/phone/initials in the UI (will hydrate from DB)
    const nameEl = root.querySelector("#displayName");
    const ageEl = root.querySelector("#displayAge");
    const phoneEl = root.querySelector("#displayPhone");
    const initialsEl = root.querySelector("#avatarInitials");
    const avatarImageEl = root.querySelector("#avatarImage");
    
    // 使用root查询的元素
    const finalAvatarImageEl = avatarImageEl;
    const finalInitialsEl = initialsEl;
    
    console.log("[me] DOM查询结果:", {
      avatarImageEl: finalAvatarImageEl,
      initialsEl: finalInitialsEl
    });

    function renderUser() {
      if (nameEl) nameEl.textContent = user.name || "无";
      if (ageEl)
        ageEl.textContent =
          user.age !== "无" ? "年龄：" + user.age : "年龄：无";
      if (phoneEl)
        phoneEl.textContent =
          user.phone && user.phone !== "无"
            ? "手机号：" + maskPhone(user.phone)
            : "手机号：无";
      if (initialsEl) initialsEl.textContent = initialsFrom(user.name);
      
      // 处理头像显示
      console.log("[me] renderUser - 头像元素:", finalAvatarImageEl, finalInitialsEl);
      console.log("[me] renderUser - 用户头像URL:", user.avatar_url);
      
      if (finalAvatarImageEl && finalInitialsEl) {
        if (user.avatar_url) {
          console.log("[me] 显示头像图片:", user.avatar_url);
          finalAvatarImageEl.src = user.avatar_url;
          finalAvatarImageEl.style.display = "block";
          finalInitialsEl.style.display = "none";
        } else {
          console.log("[me] 显示用户名首字母");
          finalAvatarImageEl.style.display = "none";
          finalInitialsEl.style.display = "grid";
        }
      } else {
        console.warn("[me] 头像元素未找到:", { finalAvatarImageEl, finalInitialsEl });
      }
    }

    // Try to load from backend using stored UserID
    const appRoot = root.querySelector("main.app");
    const tableName =
      appRoot && appRoot.dataset && appRoot.dataset.table
        ? appRoot.dataset.table
        : "users";
    // Align with daily.js: prefer lower-cased 'userId' key
    const storedId =
      localStorage.getItem("userId") ||
      sessionStorage.getItem("userId") ||
      localStorage.getItem("UserID") ||
      sessionStorage.getItem("UserID");
    const storedUsername =
      localStorage.getItem("username") ||
      localStorage.getItem("Username") ||
      sessionStorage.getItem("username") ||
      sessionStorage.getItem("Username");
    console.debug(
      "[me] table:",
      tableName,
      "userId:",
      storedId,
      "username:",
      storedUsername
    );

    // --- API base (shared in initMe) ---
    const configuredBase = (
      document.querySelector('meta[name="api-base"]')?.content ||
      window.__API_BASE__ ||
      window.API_BASE ||
      ""
    ).trim();
    const defaultBase = "https://app.zdelf.cn"; // default to absolute domain for native containers
    const apiBase = (configuredBase || defaultBase).replace(/\/$/, "");

    // Initial paint with defaults ("无")
    renderUser();

    if (storedId || storedUsername) {
      abortInFlight();
      fetchController = new AbortController();
      // Build payload: prefer userId like daily.js; fallback to username if needed
      const payload = storedId
        ? { table_name: tableName, user_id: storedId }
        : { table_name: tableName, username: storedUsername };
      const url = apiBase + "/readdata";
      console.debug("[me] POST", url, payload);
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: fetchController.signal,
      })
        .then((response) => {
          console.log("📡 [me] 收到响应，状态码:", response.status);
          if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          return response.json();
        })
        .then((json) => {
          if (!json || json.success !== true || !Array.isArray(json.data)) {
            showErrorModal("无法从服务器读取资料");
            return;
          }
          const rec = json.data[0] || {};
          console.debug("[me] /readdata result:", json);
          // Map by your users schema (user_id, username, password, age)
          const username = rec && rec.username ? rec.username : "无";
          const age =
            rec && rec.age !== null && rec.age !== undefined && rec.age !== ""
              ? rec.age
              : "无";
          const phone = pick(rec, ["phone", "mobile", "phone_number"], "无");
          const avatar_url = pick(rec, ["avatar_url", "avatar", "profile_picture"], null);
          console.log("[me] 从数据库获取的头像URL:", avatar_url);
          user = { name: username, age, phone, avatar_url };
          
          // 确保头像URL是完整的URL，并添加时间戳避免缓存
          if (user.avatar_url && !user.avatar_url.startsWith('http')) {
            user.avatar_url = apiBase + user.avatar_url;
          }
          // 添加时间戳参数避免缓存
          if (user.avatar_url) {
            const separator = user.avatar_url.includes('?') ? '&' : '?';
            user.avatar_url = user.avatar_url + separator + 't=' + Date.now();
            console.log("[me] 完整头像URL（带时间戳）:", user.avatar_url);
          }
          
          console.log("[me] 最终用户数据:", user);
          // 后端当前会返回明文密码，这里仅用于“新密码不能与原密码相同”的前端校验，不做任何回显
          currentPassword =
            typeof rec.password === "string" ? rec.password : null;
          // 安全考虑：不再从接口缓存/使用密码字段
          userPassword = "";
          renderUser();
        })
        .catch((err) => {
          console.warn("[me] /readdata error:", err);
          showErrorModal("网络错误，请稍后再试");
        })
        .finally(() => {
          fetchController = null;
        });
      cleanupFns.push(() => abortInFlight());
    } else {
      toast("未找到用户ID/用户名，本地显示占位");
    }

    // Confirm modal (for logout)
    function ensureConfirmStyles() {
      if (document.getElementById("app-confirm-style")) return;
      const s = document.createElement("style");
      s.id = "app-confirm-style";
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
      cleanupFns.push(() => {
        if (s.parentNode) s.remove();
      });
    }

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

        cancelBtn.addEventListener("click", () => {
          triggerVibration('Light');
          close(false);
        }, { once: true });
        okBtn.addEventListener("click", () => {
          triggerVibration('Medium');
          close(true);
        }, { once: true });
        mask.addEventListener("click", (e) => {
          if (e.target === mask) close(false);
        });
        document.addEventListener("keydown", function escHandler(ev) {
          if (ev.key === "Escape") {
            document.removeEventListener("keydown", escHandler);
            close(false);
          }
        });

        setTimeout(() => okBtn.focus(), 0);
      });
    }

    // 绑定 ripple
    root.querySelectorAll(".rippleable").forEach((el) => {
      const clickHandler = (e) => addRipple(e);
      const keyHandler = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          el.click();
        }
      };
      el.addEventListener("click", clickHandler);
      el.addEventListener("keydown", keyHandler);
      cleanupFns.push(() => {
        el.removeEventListener("click", clickHandler);
        el.removeEventListener("keydown", keyHandler);
      });
    });

    // -----------------------------
    // Edit modal (age + password) with dark mode support
    // -----------------------------
    function ensureEditStyles() {
      if (document.getElementById("edit-profile-style")) return;
      const s = document.createElement("style");
      s.id = "edit-profile-style";
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
      cleanupFns.push(() => {
        if (s.parentNode) s.remove();
      });
    }

    // 密码输入装饰器：添加“显示/隐藏”按钮（使用登录页样式与 SVG 图标）
    function decoratePasswordInput(inputEl) {
      const wrap = document.createElement("div");
      wrap.className = "input-with-toggle";
      inputEl.classList.add("record-textarea");
      const parent = inputEl.parentNode;
      parent.replaceChild(wrap, inputEl);
      wrap.appendChild(inputEl);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-password";
      btn.setAttribute("aria-label", "显示密码");
      btn.setAttribute("title", "显示密码");

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

      const eye = btn.querySelector(".eye");
      const eyeOff = btn.querySelector(".eye-off");

      function setState(show) {
        inputEl.setAttribute("type", show ? "text" : "password");
        btn.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
        btn.setAttribute("title", show ? "隐藏密码" : "显示密码");
        eye.classList.toggle("visible", !show);
        eye.classList.toggle("hidden", show);
        eyeOff.classList.toggle("visible", show);
        eyeOff.classList.toggle("hidden", !show);
      }

      btn.addEventListener("click", () => {
        const show = inputEl.getAttribute("type") === "password";
        btn.animate(
          [
            { transform: "translateY(-50%) scale(1)" },
            { transform: "translateY(-50%) scale(0.9)" },
            { transform: "translateY(-50%) scale(1)" },
          ],
          { duration: 160, easing: "ease-out" }
        );
        setState(show);
      });

      // 默认隐藏密码
      setState(false);

      cleanupFns.push(() => btn.replaceWith(btn.cloneNode(true)));
    }

    function openEditDialog() {
      ensureEditStyles();
      const mask = document.createElement("div");
      mask.className = "edit-mask";

      const dialog = document.createElement("div");
      dialog.className = "edit-dialog";

      const header = document.createElement("div");
      header.className = "edit-header";
      header.textContent = "编辑资料";

      const body = document.createElement("div");
      body.className = "edit-body";

      const fAge = document.createElement("div");
      fAge.className = "field";
      const lAge = document.createElement("label");
      lAge.textContent = "年龄";
      lAge.setAttribute("for", "edit-age");
      const iAge = document.createElement("input");
      iAge.id = "edit-age";
      iAge.type = "number";
      iAge.min = "0";
      iAge.max = "120";
      iAge.placeholder = "请输入年龄";
      if (
        user &&
        user.age !== "无" &&
        user.age !== undefined &&
        user.age !== null &&
        user.age !== ""
      ) {
        iAge.value = parseInt(user.age, 10);
      }
      fAge.append(lAge, iAge);

      // 新密码
      const fPwd = document.createElement("div");
      fPwd.className = "field";
      const lPwd = document.createElement("label");
      lPwd.textContent = "新密码";
      lPwd.setAttribute("for", "edit-pwd");
      const iPwd = document.createElement("input");
      iPwd.id = "edit-pwd";
      iPwd.type = "password";
      iPwd.placeholder = "8-20位，含大小写、数字，可含符号";
      iPwd.autocomplete = "new-password";
      fPwd.append(lPwd, iPwd);
      decoratePasswordInput(iPwd);

      // 添加顺序：年龄、新密码
      body.append(fAge, fPwd);

      const footer = document.createElement("div");
      footer.className = "edit-footer";
      const btnCancel = document.createElement("button");
      btnCancel.className = "btn btn-ghost";
      btnCancel.textContent = "取消";
      const btnSave = document.createElement("button");
      btnSave.className = "btn btn-primary";
      btnSave.textContent = "保存";
      footer.append(btnCancel, btnSave);

      dialog.append(header, body, footer);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        dialog.classList.add("show");
      });

      const close = () => {
        dialog.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
      };

      btnCancel.addEventListener("click", () => {
        triggerVibration('Light');
        close();
      }, { once: true });
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });

      btnSave.addEventListener("click", async () => {
        triggerVibration('Medium');
        const ageVal = iAge.value.trim();
        const newPwdVal = iPwd.value.trim();

        const ageChanged = ageVal !== "" && Number(ageVal) !== Number(user.age);
        const pwdChanged = !!newPwdVal;
        if (!ageChanged && !pwdChanged) {
          showErrorModal("您没有任何改动");
          return;
        }

        if (
          ageVal &&
          (isNaN(Number(ageVal)) || Number(ageVal) < 0 || Number(ageVal) > 120)
        ) {
          showErrorModal("年龄范围应在 0~120");
          return;
        }
        // 若填写了新密码，仅进行强度校验（不再需要原始密码）
        if (newPwdVal) {
          const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,20}$/;
          if (!passwordRegex.test(newPwdVal)) {
            showErrorModal(
              "新密码必须为8到20位，包含大写字母、小写字母和数字，一些特殊字符不能包括"
            );
            return;
          }
          // 不允许与原密码相同
          if (currentPassword != null && newPwdVal === currentPassword) {
            showErrorModal("不能设置一样的密码");
            return;
          }
        }

        try {
          // 进入保存请求：构建 payload（只发送有改动的字段）
          const payload = { table_name: tableName };
          if (storedId) payload.user_id = storedId;
          else if (storedUsername) payload.username = storedUsername;
          if (ageChanged) payload.age = Number(ageVal);
          if (newPwdVal) payload.new_password = newPwdVal;

          // 按钮 loading 状态
          btnSave.disabled = true;
          btnSave.dataset._label = btnSave.textContent;
          btnSave.textContent = "保存中...";

          const resp = await fetch(apiBase + "/editdata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          let result = null;
          try {
            result = await resp.json();
          } catch (_) {}

          if (!resp.ok || !result || result.success !== true) {
            const msg =
              result && result.message
                ? result.message
                : "保存失败 (" + resp.status + ")";
            showErrorModal(msg);
            btnSave.disabled = false;
            btnSave.textContent = btnSave.dataset._label || "保存";
            return;
          }

          // 更新本地展示（以服务端返回为准；若无返回则用输入值回填）
          if (result.data) {
            if (
              typeof result.data.age !== "undefined" &&
              result.data.age !== null
            ) {
              user.age = result.data.age;
            } else if (ageChanged) {
              user.age = Number(ageVal);
            }
            // 同步当前密码（仅用于“与旧密码相同”的前端比较，不做回显）
            if (typeof result.data.password === "string") {
              currentPassword = result.data.password;
            } else if (newPwdVal) {
              currentPassword = newPwdVal;
            }
          } else {
            if (ageChanged) user.age = Number(ageVal);
            if (newPwdVal) currentPassword = newPwdVal;
          }

          renderUser();
          showSuccessModal("修改成功");
          close();
        } catch (e) {
          console.warn("[me] 保存失败:", e);
          showErrorModal("保存失败，请稍后再试");
        } finally {
          btnSave.disabled = false;
          if (btnSave.dataset._label)
            btnSave.textContent = btnSave.dataset._label;
          delete btnSave.dataset._label;
        }
      });

      cleanupFns.push(() => {
        if (mask.parentNode) mask.remove();
      });
    }

    // 绑定"编辑资料"按钮
    const editBtn = root.querySelector("#editProfileBtn");
    if (editBtn) {
      const editHandler = () => openEditDialog();
      const h = () => { triggerVibration('Medium'); };
      editBtn.addEventListener("click", editHandler);
      editBtn.addEventListener("click", h);
      cleanupFns.push(() => editBtn.removeEventListener("click", editHandler));
      cleanupFns.push(() => editBtn.removeEventListener("click", h));
    }



    // 退出登录
    const logoutBtn = root.querySelector("#logoutBtn");
    if (logoutBtn) {
      const logoutHandler = async () => {
        triggerVibration('Medium');
        const ok = await confirmDialog("确定要退出登录吗？");
        if (!ok) return;
        try {
          const keys = ["UserID", "userid", "userId"];
          keys.forEach((k) => {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
          });
        } catch (e) {}
        window.location.replace("src/login.html");
      };
      logoutBtn.addEventListener("click", logoutHandler);
      cleanupFns.push(() =>
        logoutBtn.removeEventListener("click", logoutHandler)
      );
    }

    // 注销账号（不可恢复）
    const deleteBtn = root.querySelector("#deleteAccountBtn");
    if (deleteBtn) {
      const deleteHandler = async () => {
        triggerVibration('Medium');
        // 双重确认，防止误触
        const ok1 = await confirmDialog("此操作将永久删除您的账号与相关数据，且不可恢复。是否继续？");
        if (!ok1) return;
        const ok2 = await confirmDialog("再次确认：真的要注销账号吗？此操作不可撤销。");
        if (!ok2) return;

        // 禁用按钮，避免重复提交
        deleteBtn.disabled = true;
        deleteBtn.dataset._label = deleteBtn.textContent;
        deleteBtn.textContent = "正在注销...";
        try {
          // 构建请求载荷：优先使用 userId，其次 username（后端路由：/account/delete_account）
          const payload = {};
          if (storedId) payload.user_id = String(storedId);
          else if (storedUsername) payload.username = String(storedUsername);

          // 调用后端注销接口
          const resp = await fetch(apiBase + "/account/delete_account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          let result = null;
          try {
            result = await resp.json();
          } catch (_) {}

          if (!resp.ok || !result || result.success !== true) {
            const msg =
              result && result.message
                ? result.message
                : "注销失败 (" + resp.status + ")";
            showErrorModal(msg);
            return;
          }

          // 清理本地缓存并反馈
          try {
            const keys = [
              "UserID",
              "userid",
              "userId",
              "Username",
              "username",
            ];
            keys.forEach((k) => {
              localStorage.removeItem(k);
              sessionStorage.removeItem(k);
            });
          } catch (e) {}

          // 显示详细的注销成功信息
          let successMessage = "账号已注销";
          if (result && result.deleted_counts) {
            const counts = result.deleted_counts;
            const deletedItems = [];
            
            if (counts.metrics_files > 0) deletedItems.push(`健康指标数据 ${counts.metrics_files} 条`);
            if (counts.diet_files > 0) deletedItems.push(`饮食记录 ${counts.diet_files} 条`);
            if (counts.case_files > 0) deletedItems.push(`病例记录 ${counts.case_files} 条`);
            if (counts.sms_codes > 0) deletedItems.push(`短信记录 ${counts.sms_codes} 条`);
            
            if (deletedItems.length > 0) {
              successMessage += `\n\n已删除相关数据：\n${deletedItems.join('\n')}`;
            }
          }
          
          showSuccessModal(successMessage);
          // 短暂延迟后跳转到登录页
          setTimeout(() => {
            window.location.replace("src/login.html");
          }, 1500);
        } catch (e) {
          console.warn("[me] 注销失败:", e);
          showErrorModal("网络错误或服务器异常，请稍后再试");
        } finally {
          // 还原按钮态（若未跳转）
          deleteBtn.disabled = false;
          if (deleteBtn.dataset._label) {
            deleteBtn.textContent = deleteBtn.dataset._label;
            delete deleteBtn.dataset._label;
          }
        }
      };
      deleteBtn.addEventListener("click", deleteHandler);
      cleanupFns.push(() =>
        deleteBtn.removeEventListener("click", deleteHandler)
      );
    }

    // 帮助弹窗样式
    function ensureHelpStyles() {
      if (document.getElementById("help-modal-style")) return;
      const s = document.createElement("style");
      s.id = "help-modal-style";
      s.textContent = `
      .help-mask{position:fixed;inset:0;background:color-mix(in srgb, var(--text,#000) 20%, transparent);backdrop-filter:saturate(120%) blur(2px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;z-index:10000}
      .help-mask.show{opacity:1}
      .help-dialog{width:min(92vw,500px);background:var(--card,#fff);color:var(--text,#111);border-radius:16px;box-shadow:var(--shadow-3,0 10px 30px rgba(0,0,0,.15));transform:translateY(12px) scale(.98);opacity:0;transition:transform .2s ease,opacity .2s ease;border:1px solid var(--border,rgba(0,0,0,.06))}
      .help-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .help-header{padding:20px 24px 16px;font-weight:700;font-size:18px;text-align:center;border-bottom:1px solid var(--divider,rgba(0,0,0,.1))}
      .help-body{padding:20px 24px;line-height:1.6}
      .help-section{margin-bottom:20px}
      .help-section:last-child{margin-bottom:0}
      .help-section h3{font-size:16px;font-weight:600;margin:0 0 12px 0;color:var(--text,#111)}
      .help-section p{margin:0 0 8px 0;color:var(--text-secondary,#666)}
      .help-section p:last-child{margin-bottom:0}
      .contact-info{background:linear-gradient(135deg,rgba(126,63,242,0.08),transparent);padding:16px;border-radius:12px;border:1px solid rgba(126,63,242,0.2)}
      .contact-email{color:var(--brand,#1a73e8);font-weight:600;text-decoration:none;word-break:break-all}
      .contact-email:hover{text-decoration:underline}
      .help-footer{display:flex;justify-content:center;padding:0 24px 20px}
      .help-btn{appearance:none;border:0;padding:12px 24px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;background:var(--brand,#1a73e8);color:#fff;transition:all 0.2s ease}
      .help-btn:hover{background:var(--brand-700,#1558b3);transform:translateY(-1px)}
      @media (prefers-color-scheme: dark){
        .help-mask{background:color-mix(in srgb,#000 50%, transparent)}
        .help-dialog{background:var(--card,#1e1f22);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.08))}
        .help-section h3{color:var(--text,#e6e6e6)}
        .help-section p{color:var(--text-secondary,#9aa3af)}
        .contact-info{background:linear-gradient(135deg,rgba(126,63,242,0.15),transparent);border-color:rgba(126,63,242,0.3)}
        .contact-email{color:var(--brand,#8ab4f8)}
      }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => {
        if (s.parentNode) s.remove();
      });
    }

    // 合并的帮助与关于弹窗
    function showCombinedHelpModal() {
      ensureHelpStyles();
      const mask = document.createElement("div");
      mask.className = "help-mask";

      const dialog = document.createElement("div");
      dialog.className = "help-dialog";

      const header = document.createElement("div");
      header.className = "help-header";
      header.textContent = "关于与帮助";

      const body = document.createElement("div");
      body.className = "help-body";
      body.style.maxHeight = "60vh";
      body.style.overflowY = "auto";

      // App介绍
      const introSection = document.createElement("div");
      introSection.className = "help-section";
      const introTitle = document.createElement("h3");
      introTitle.textContent = "关于我们的应用";
      const introText = document.createElement("p");
      introText.textContent = "这是一个专注于健康管理的智能应用，帮助您记录和分析健康数据，提供个性化的健康建议。";
      introSection.append(introTitle, introText);

      // 功能特色
      const featuresSection = document.createElement("div");
      featuresSection.className = "help-section";
      const featuresTitle = document.createElement("h3");
      featuresTitle.textContent = "主要功能";
      const featuresText = document.createElement("p");
      featuresText.innerHTML = "• 健康指标记录与分析<br>• 饮食管理<br>• 病例记录<br>• 社区广场交流<br>• AI智能助手<br>• 数据可视化展示";
      featuresSection.append(featuresTitle, featuresText);

      // 免责声明部分
      const disclaimerSection = document.createElement("div");
      disclaimerSection.className = "help-section";
      const disclaimerTitle = document.createElement("h3");
      disclaimerTitle.textContent = "免责声明";
      const disclaimerText1 = document.createElement("p");
      disclaimerText1.innerHTML = "<strong>1. 健康建议仅供参考</strong><br>本应用提供的健康建议和信息仅供参考，不构成专业医疗意见。如有健康问题，请咨询专业医疗机构。";
      const disclaimerText2 = document.createElement("p");
      disclaimerText2.innerHTML = "<strong>2. 数据安全</strong><br>我们承诺保护您的个人健康数据，并采取必要的安全措施。但互联网传输存在固有风险。";
      const disclaimerText3 = document.createElement("p");
      disclaimerText3.innerHTML = "<strong>3. 服务变更</strong><br>我们保留随时修改或终止服务的权利，恕不另行通知。";
      const disclaimerText4 = document.createElement("p");
      disclaimerText4.innerHTML = "<strong>4. 用户责任</strong><br>用户应对自己发布的内容负责，不得发布违法、有害或侵权信息。";
      disclaimerSection.append(disclaimerTitle, disclaimerText1, disclaimerText2, disclaimerText3, disclaimerText4);

      // 联系方式（移到最后）
      const contactSection = document.createElement("div");
      contactSection.className = "help-section";
      const contactTitle = document.createElement("h3");
      contactTitle.textContent = "联系我们";
      const contactInfo = document.createElement("div");
      contactInfo.className = "contact-info";
      const contactText = document.createElement("p");
      contactText.textContent = "如有任何问题或建议，请通过以下方式联系我们：";
      const developerInfo = document.createElement("p");
      developerInfo.innerHTML = "开发者：鲍俊希 <a class='contact-email' href='mailto:junxibao@junxibao.com'>junxibao@junxibao.com</a>";
      const designerInfo = document.createElement("p");
      designerInfo.innerHTML = "设计师：裘可然 <a class='contact-email' href='mailto:391257652@qq.com'>391257652@qq.com</a>";
      contactInfo.append(contactText, developerInfo, designerInfo);
      contactSection.append(contactTitle, contactInfo);

      // 备案号和版权信息
      const footerSection = document.createElement("div");
      footerSection.className = "help-section";
      footerSection.style.marginTop = "24px";
      footerSection.style.paddingTop = "20px";
      footerSection.style.borderTop = "1px solid var(--divider, rgba(0,0,0,.1))";
      footerSection.style.textAlign = "center";
      
      const icpInfo = document.createElement("p");
      icpInfo.style.margin = "0 0 8px 0";
      icpInfo.style.fontSize = "12px";
      icpInfo.style.color = "var(--text-secondary, #666)";
      icpInfo.innerHTML = '<a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">浙ICP备2023040285号-4A</a>';
      
      const copyrightInfo = document.createElement("p");
      copyrightInfo.style.margin = "0";
      copyrightInfo.style.fontSize = "12px";
      copyrightInfo.style.color = "var(--text-secondary, #666)";
      copyrightInfo.textContent = "© 2025 JunxiBao. All rights reserved.";
      
      footerSection.append(icpInfo, copyrightInfo);

      body.append(introSection, featuresSection, disclaimerSection, contactSection, footerSection);

      const footer = document.createElement("div");
      footer.className = "help-footer";
      const closeBtn = document.createElement("button");
      closeBtn.className = "help-btn";
      closeBtn.textContent = "我知道了";
      footer.append(closeBtn);

      dialog.append(header, body, footer);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        dialog.classList.add("show");
      });

      const close = () => {
        dialog.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
      };

      closeBtn.addEventListener("click", () => {
        triggerVibration('Light');
        close();
      }, { once: true });
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });
      document.addEventListener("keydown", function escHandler(ev) {
        if (ev.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          close();
        }
      });

      cleanupFns.push(() => {
        if (mask.parentNode) mask.remove();
      });
    }

    // 免责声明弹窗样式
    function ensureDisclaimerStyles() {
      if (document.getElementById("disclaimer-modal-style")) return;
      const s = document.createElement("style");
      s.id = "disclaimer-modal-style";
      s.textContent = `
      .disclaimer-mask{position:fixed;inset:0;background:color-mix(in srgb, var(--text,#000) 20%, transparent);backdrop-filter:saturate(120%) blur(2px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;z-index:10000}
      .disclaimer-mask.show{opacity:1}
      .disclaimer-dialog{width:min(92vw,500px);background:var(--card,#fff);color:var(--text,#111);border-radius:16px;box-shadow:var(--shadow-3,0 10px 30px rgba(0,0,0,.15));transform:translateY(12px) scale(.98);opacity:0;transition:transform .2s ease,opacity .2s ease;border:1px solid var(--border,rgba(0,0,0,.06))}
      .disclaimer-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .disclaimer-header{padding:20px 24px 16px;font-weight:700;font-size:18px;text-align:center;border-bottom:1px solid var(--divider,rgba(0,0,0,.1))}
      .disclaimer-body{padding:20px 24px;line-height:1.6;max-height:60vh;overflow-y:auto}
      .disclaimer-section{margin-bottom:20px}
      .disclaimer-section:last-child{margin-bottom:0}
      .disclaimer-section h3{font-size:16px;font-weight:600;margin:0 0 12px 0;color:var(--text,#111)}
      .disclaimer-section p{margin:0 0 8px 0;color:var(--text-secondary,#666)}
      .disclaimer-section p:last-child{margin-bottom:0}
      .disclaimer-section ul{margin:8px 0;padding-left:20px}
      .disclaimer-section li{margin:4px 0;color:var(--text-secondary,#666)}
      .contact-info{background:linear-gradient(135deg,rgba(126,63,242,0.08),transparent);padding:16px;border-radius:12px;border:1px solid rgba(126,63,242,0.2)}
      .contact-email{color:var(--brand,#1a73e8);font-weight:600;text-decoration:none;word-break:break-all}
      .contact-email:hover{text-decoration:underline}
      .disclaimer-footer{display:flex;justify-content:center;padding:0 24px 20px}
      .disclaimer-btn{appearance:none;border:0;padding:12px 24px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;background:var(--brand,#1a73e8);color:#fff;transition:all 0.2s ease}
      .disclaimer-btn:hover{background:var(--brand-700,#1558b3);transform:translateY(-1px)}
      @media (prefers-color-scheme: dark){
        .disclaimer-mask{background:color-mix(in srgb,#000 50%, transparent)}
        .disclaimer-dialog{background:var(--card,#1e1f22);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.08))}
        .disclaimer-section h3{color:var(--text,#e6e6e6)}
        .disclaimer-section p{color:var(--text-secondary,#9aa3af)}
        .disclaimer-section li{color:var(--text-secondary,#9aa3af)}
        .contact-info{background:linear-gradient(135deg,rgba(126,63,242,0.15),transparent);border-color:rgba(126,63,242,0.3)}
        .contact-email{color:var(--brand,#8ab4f8)}
      }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => {
        if (s.parentNode) s.remove();
      });
    }

    function showDisclaimerModal() {
      ensureDisclaimerStyles();
      const mask = document.createElement("div");
      mask.className = "disclaimer-mask";

      const dialog = document.createElement("div");
      dialog.className = "disclaimer-dialog";

      const header = document.createElement("div");
      header.className = "disclaimer-header";
      header.textContent = "免责声明";

      const body = document.createElement("div");
      body.className = "disclaimer-body";

      // 使用条款
      const termsSection = document.createElement("div");
      termsSection.className = "disclaimer-section";
      const termsTitle = document.createElement("h3");
      termsTitle.textContent = "使用条款";
      const termsText = document.createElement("p");
      termsText.innerHTML = "使用本应用即表示您同意以下条款：";
      const termsList = document.createElement("ul");
      termsList.innerHTML = `
        <li>本应用仅供健康管理参考，不能替代专业医疗建议</li>
        <li>用户应自行承担使用本应用的风险</li>
        <li>禁止将本应用用于任何非法用途</li>
        <li>我们保留随时修改服务条款的权利</li>
      `;
      termsSection.append(termsTitle, termsText, termsList);

      // 隐私政策
      const privacySection = document.createElement("div");
      privacySection.className = "disclaimer-section";
      const privacyTitle = document.createElement("h3");
      privacyTitle.textContent = "隐私政策";
      const privacyText = document.createElement("p");
      privacyText.innerHTML = "我们重视您的隐私，承诺：";
      const privacyList = document.createElement("ul");
      privacyList.innerHTML = `
        <li>严格保护您的个人健康数据</li>
        <li>不会向第三方泄露您的个人信息</li>
        <li>仅在必要时收集和使用数据以提供服务</li>
        <li>您有权随时删除您的账户和数据</li>
      `;
      privacySection.append(privacyTitle, privacyText, privacyList);

      // 免责声明
      const disclaimerSection = document.createElement("div");
      disclaimerSection.className = "disclaimer-section";
      const disclaimerTitle = document.createElement("h3");
      disclaimerTitle.textContent = "免责声明";
      const disclaimerText = document.createElement("p");
      disclaimerText.innerHTML = "重要提醒：";
      const disclaimerList = document.createElement("ul");
      disclaimerList.innerHTML = `
        <li>本应用提供的信息仅供参考，不构成医疗建议</li>
        <li>如有健康问题，请及时咨询专业医生</li>
        <li>我们不对因使用本应用而产生的任何后果负责</li>
        <li>用户应理性对待应用中的健康建议</li>
      `;
      disclaimerSection.append(disclaimerTitle, disclaimerText, disclaimerList);

      // 联系方式
      const contactSection = document.createElement("div");
      contactSection.className = "disclaimer-section";
      const contactTitle = document.createElement("h3");
      contactTitle.textContent = "联系我们";
      const contactInfo = document.createElement("div");
      contactInfo.className = "contact-info";
      const contactText = document.createElement("p");
      contactText.textContent = "如有疑问，请联系：";
      const developerInfo = document.createElement("p");
      developerInfo.innerHTML = "开发者：鲍俊希 <a class='contact-email' href='mailto:junxibao@junxibao.com'>junxibao@junxibao.com</a>";
      const designerInfo = document.createElement("p");
      designerInfo.innerHTML = "设计师：裘可然 <a class='contact-email' href='mailto:391257652@qq.com'>391257652@qq.com</a>";
      contactInfo.append(contactText, developerInfo, designerInfo);
      contactSection.append(contactTitle, contactInfo);

      body.append(termsSection, privacySection, disclaimerSection, contactSection);

      const footer = document.createElement("div");
      footer.className = "disclaimer-footer";
      const closeBtn = document.createElement("button");
      closeBtn.className = "disclaimer-btn";
      closeBtn.textContent = "我已阅读并同意";
      footer.append(closeBtn);

      dialog.append(header, body, footer);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        dialog.classList.add("show");
      });

      const close = () => {
        dialog.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
      };

      closeBtn.addEventListener("click", () => {
        triggerVibration('Light');
        close();
      }, { once: true });
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });
      document.addEventListener("keydown", function escHandler(ev) {
        if (ev.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          close();
        }
      });

      cleanupFns.push(() => {
        if (mask.parentNode) mask.remove();
      });
    }

    // 震动反馈设置弹窗样式
    function ensureVibrationStyles() {
      if (document.getElementById("vibration-modal-style")) return;
      const s = document.createElement("style");
      s.id = "vibration-modal-style";
      s.textContent = `
      .vibration-mask{position:fixed;inset:0;background:color-mix(in srgb, var(--text,#000) 20%, transparent);backdrop-filter:saturate(120%) blur(2px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;z-index:10000}
      .vibration-mask.show{opacity:1}
      .vibration-dialog{width:min(92vw,400px);background:var(--card,#fff);color:var(--text,#111);border-radius:16px;box-shadow:var(--shadow-3,0 10px 30px rgba(0,0,0,.15));transform:translateY(12px) scale(.98);opacity:0;transition:transform .2s ease,opacity .2s ease;border:1px solid var(--border,rgba(0,0,0,.06))}
      .vibration-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .vibration-header{padding:20px 24px 16px;font-weight:700;font-size:18px;text-align:center;border-bottom:1px solid var(--divider,rgba(0,0,0,.1))}
      .vibration-body{padding:20px 24px;line-height:1.6}
      .vibration-section{margin-bottom:20px}
      .vibration-section:last-child{margin-bottom:0}
      .vibration-section h3{font-size:16px;font-weight:600;margin:0 0 12px 0;color:var(--text,#111)}
      .vibration-section p{margin:0 0 8px 0;color:var(--text-secondary,#666)}
      .vibration-section p:last-child{margin-bottom:0}
      .vibration-toggle{display:flex;align-items:center;justify-content:space-between;padding:16px;background:var(--surface,rgba(0,0,0,.04));border-radius:12px;border:1px solid var(--border,rgba(0,0,0,.1))}
      .vibration-toggle-info{flex:1}
      .vibration-toggle-label{font-size:16px;font-weight:500;color:var(--text,#111);margin:0 0 4px 0}
      .vibration-toggle-desc{font-size:14px;color:var(--text-secondary,#666);margin:0}
      .vibration-switch{position:relative;width:52px;height:32px;background:var(--border,rgba(0,0,0,.2));border-radius:16px;cursor:pointer;transition:all 0.3s ease;border:none;outline:none}
      .vibration-switch.active{background:var(--brand,#1a73e8)}
      .vibration-switch::before{content:'';position:absolute;top:2px;left:2px;width:28px;height:28px;background:#fff;border-radius:50%;transition:all 0.3s ease;box-shadow:0 2px 4px rgba(0,0,0,.2)}
      .vibration-switch.active::before{transform:translateX(20px)}
      .vibration-footer{display:flex;justify-content:center;padding:0 24px 20px}
      .vibration-btn{appearance:none;border:0;padding:12px 24px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;background:var(--brand,#1a73e8);color:#fff;transition:all 0.2s ease}
      .vibration-btn:hover{background:var(--brand-700,#1558b3);transform:translateY(-1px)}
      @media (prefers-color-scheme: dark){
        .vibration-mask{background:color-mix(in srgb,#000 50%, transparent)}
        .vibration-dialog{background:var(--card,#1e1f22);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.08))}
        .vibration-section h3{color:var(--text,#e6e6e6)}
        .vibration-section p{color:var(--text-secondary,#9aa3af)}
        .vibration-toggle{background:var(--surface,rgba(255,255,255,.08));border-color:var(--border,rgba(255,255,255,.12))}
        .vibration-toggle-label{color:var(--text,#e6e6e6)}
        .vibration-toggle-desc{color:var(--text-secondary,#9aa3af)}
        .vibration-switch{background:rgba(255,255,255,.2)}
        .vibration-switch::before{background:#fff}
      }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => {
        if (s.parentNode) s.remove();
      });
    }

    function showVibrationModal() {
      ensureVibrationStyles();
      const mask = document.createElement("div");
      mask.className = "vibration-mask";

      const dialog = document.createElement("div");
      dialog.className = "vibration-dialog";

      const header = document.createElement("div");
      header.className = "vibration-header";
      header.textContent = "震动反馈设置";

      const body = document.createElement("div");
      body.className = "vibration-body";

      // 震动设置说明
      const infoSection = document.createElement("div");
      infoSection.className = "vibration-section";
      const infoTitle = document.createElement("h3");
      infoTitle.textContent = "触觉反馈";
      const infoText = document.createElement("p");
      infoText.textContent = "开启震动反馈可以在点击按钮、完成操作时提供触觉反馈，提升使用体验。";
      infoSection.append(infoTitle, infoText);

      // 震动开关
      const toggleSection = document.createElement("div");
      toggleSection.className = "vibration-section";
      const toggleContainer = document.createElement("div");
      toggleContainer.className = "vibration-toggle";
      
      const toggleInfo = document.createElement("div");
      toggleInfo.className = "vibration-toggle-info";
      const toggleLabel = document.createElement("div");
      toggleLabel.className = "vibration-toggle-label";
      toggleLabel.textContent = "震动反馈";
      const toggleDesc = document.createElement("div");
      toggleDesc.className = "vibration-toggle-desc";
      toggleDesc.textContent = "点击按钮时提供触觉反馈";
      
      toggleInfo.append(toggleLabel, toggleDesc);
      
      const toggleSwitch = document.createElement("button");
      toggleSwitch.className = "vibration-switch";
      toggleSwitch.setAttribute("role", "switch");
      toggleSwitch.setAttribute("aria-label", "震动反馈开关");
      
      // 设置初始状态
      const isEnabled = getVibrationSetting();
      if (isEnabled) {
        toggleSwitch.classList.add("active");
        toggleSwitch.setAttribute("aria-checked", "true");
      } else {
        toggleSwitch.setAttribute("aria-checked", "false");
      }
      
      // 切换功能
      toggleSwitch.addEventListener("click", () => {
        const currentState = toggleSwitch.classList.contains("active");
        const newState = !currentState;
        
        toggleSwitch.classList.toggle("active", newState);
        toggleSwitch.setAttribute("aria-checked", newState.toString());
        setVibrationSetting(newState);
        
        // 提供反馈
        if (newState) {
          triggerVibration('Medium');
        }
      });
      
      toggleContainer.append(toggleInfo, toggleSwitch);
      toggleSection.append(toggleContainer);

      body.append(infoSection, toggleSection);

      const footer = document.createElement("div");
      footer.className = "vibration-footer";
      const closeBtn = document.createElement("button");
      closeBtn.className = "vibration-btn";
      closeBtn.textContent = "完成";
      footer.append(closeBtn);

      dialog.append(header, body, footer);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        dialog.classList.add("show");
      });

      const close = () => {
        dialog.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
      };

      closeBtn.addEventListener("click", () => {
        triggerVibration('Light');
        close();
      }, { once: true });
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });
      document.addEventListener("keydown", function escHandler(ev) {
        if (ev.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          close();
        }
      });

      cleanupFns.push(() => {
        if (mask.parentNode) mask.remove();
      });
    }

    // 下载弹窗样式
    function ensureDownloadStyles() {
      if (document.getElementById("download-modal-style")) return;
      const s = document.createElement("style");
      s.id = "download-modal-style";
      s.textContent = `
      .download-mask{position:fixed;inset:0;background:color-mix(in srgb, var(--text,#000) 20%, transparent);backdrop-filter:saturate(120%) blur(2px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;z-index:10000}
      .download-mask.show{opacity:1}
      .download-dialog{width:min(92vw,400px);background:var(--card,#fff);color:var(--text,#111);border-radius:16px;box-shadow:var(--shadow-3,0 10px 30px rgba(0,0,0,.15));transform:translateY(12px) scale(.98);opacity:0;transition:transform .2s ease,opacity .2s ease;border:1px solid var(--border,rgba(0,0,0,.06))}
      .download-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .download-header{padding:20px 24px 16px;font-weight:700;font-size:18px;text-align:center;border-bottom:1px solid var(--divider,rgba(0,0,0,.1))}
      .download-body{padding:20px 24px;}
      .download-section{margin-bottom:20px}
      .download-section:last-child{margin-bottom:0}
      .download-section p{margin:0 0 16px 0;color:var(--text-secondary,#666);font-size:14px;line-height:1.6}
      .download-buttons{display:flex;flex-direction:column;gap:12px;}
      .download-btn{appearance:none;border:0;padding:14px 20px;border-radius:12px;cursor:pointer;font-size:15px;font-weight:600;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.2s ease;text-align:center;}
      .download-btn-ios{background:linear-gradient(135deg,#000,#333);color:#fff;}
      .download-btn-ios:hover{background:linear-gradient(135deg,#333,#555);transform:translateY(-1px);}
      .download-btn-android{background:linear-gradient(135deg,#3ddc84,#2bb96b);color:#fff;}
      .download-btn-android:hover{background:linear-gradient(135deg,#2bb96b,#229756);transform:translateY(-1px);}
      .download-btn ion-icon{width:20px;height:20px;}
      .download-footer{display:flex;justify-content:center;padding:0 24px 20px}
      .download-close-btn{appearance:none;border:0;padding:12px 24px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;background:var(--surface,rgba(0,0,0,.04));color:var(--text,#111);transition:all 0.2s ease}
      .download-close-btn:hover{background:var(--divider,rgba(0,0,0,.08));transform:translateY(-1px)}
      @media (prefers-color-scheme: dark){
        .download-mask{background:color-mix(in srgb,#000 50%, transparent)}
        .download-dialog{background:var(--card,#1e1f22);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.08))}
        .download-section p{color:var(--text-secondary,#9aa3af)}
        .download-close-btn{background:var(--surface,rgba(255,255,255,.08));color:var(--text,#e6e6e6)}
        .download-close-btn:hover{background:rgba(255,255,255,.12)}
      }
      `;
      document.head.appendChild(s);
      cleanupFns.push(() => {
        if (s.parentNode) s.remove();
      });
    }

    // 获取当前应用版本
    function getCurrentVersion() {
      try {
        if (!APP_VERSION || typeof APP_VERSION !== 'string') {
          throw new Error('版本号配置无效');
        }
        
        console.log('从配置获取版本:', APP_VERSION);
        console.log('构建时间戳:', BUILD_TIMESTAMP);
        console.log('当前时间:', new Date().toISOString());
        return APP_VERSION;
      } catch (error) {
        console.warn('获取版本信息失败:', error);
        return "1.0.0.0"; // 安全的默认版本
      }
    }

    // 强制清除所有缓存
    function clearAllCache() {
      try {
        console.log('开始清除缓存...');
        
        // 清除localStorage中的版本相关缓存
        const versionCacheKeys = [
          'version_check_cache',
          'version_data_cache', 
          'app_version_cache',
          'server_version_cache'
        ];
        
        versionCacheKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            console.log(`已清除localStorage缓存: ${key}`);
          }
        });
        
        // 清除sessionStorage中的版本相关缓存
        versionCacheKeys.forEach(key => {
          if (sessionStorage.getItem(key)) {
            sessionStorage.removeItem(key);
            console.log(`已清除sessionStorage缓存: ${key}`);
          }
        });
        
        // 尝试清除浏览器缓存（如果支持）
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              if (cacheName.includes('version') || cacheName.includes('app')) {
                caches.delete(cacheName);
                console.log(`已清除浏览器缓存: ${cacheName}`);
              }
            });
          }).catch(err => {
            console.log('清除浏览器缓存失败:', err);
          });
        }
        
        // 强制刷新页面资源（通过添加时间戳参数）
        const timestamp = Date.now();
        console.log(`缓存清除完成，时间戳: ${timestamp}`);
        
        return timestamp;
      } catch (error) {
        console.warn('清除缓存时出错:', error);
        return Date.now();
      }
    }

    // 检查版本并显示模态框
    async function checkVersionAndShowModal() {
      // 检查是否启用版本检查
      if (!VERSION_CHECK_CONFIG.enabled) {
        console.log('版本检查已禁用');
        showDownloadModal();
        return;
      }
      
      // 强制清除缓存
      const cacheTimestamp = clearAllCache();
      
      // 先获取当前版本号，避免被"检查中..."覆盖
      const currentVersion = getCurrentVersion();
      console.log('获取到的当前版本:', currentVersion);
      
      // 显示加载状态
      const versionNumber = root.querySelector("#versionCard .version-number");
      const originalText = versionNumber.textContent;
      versionNumber.textContent = "清除缓存中...";
      
      // 短暂延迟让用户看到清除缓存的状态
      await new Promise(resolve => setTimeout(resolve, 500));
      
      versionNumber.textContent = "检查中...";
      
      try {
        console.log('开始检查版本...');
        
        // 使用配置的服务器URL，添加时间戳参数避免缓存
        const serverUrl = VERSION_CHECK_CONFIG.serverUrl;
        const separator = serverUrl.includes('?') ? '&' : '?';
        const urlWithTimestamp = `${serverUrl}${separator}t=${cacheTimestamp}&_t=${Date.now()}`;
        console.log('使用服务器URL:', urlWithTimestamp);
        
        // 创建超时控制器
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VERSION_CHECK_CONFIG.timeout);
        
        // 获取服务器版本信息，使用CapacitorHttp避免WebView限制
        let response;
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Http) {
          // 使用CapacitorHttp插件
          const http = window.Capacitor.Plugins.Http;
          const httpResponse = await http.request({
            url: urlWithTimestamp,
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          // 将CapacitorHttp响应转换为标准Response格式
          response = {
            ok: httpResponse.status >= 200 && httpResponse.status < 300,
            status: httpResponse.status,
            statusText: httpResponse.statusText || 'OK',
            json: () => Promise.resolve(httpResponse.data)
          };
        } else {
          // 回退到普通fetch
          response = await fetch(urlWithTimestamp, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            signal: controller.signal
          });
        }
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`网络请求失败: ${response.status} ${response.statusText}`);
        }
        
        const versionData = await response.json();
        console.log('获取到的版本数据:', versionData);
        
        // 获取所有版本信息
        const allVersions = versionData.versions;
        console.log('所有版本信息:', allVersions);
        
        if (!allVersions || !Array.isArray(allVersions) || allVersions.length === 0) {
          throw new Error('版本信息不完整');
        }
        
        // 获取最新版本（数组中的最后一个元素）
        const latestVersionInfo = allVersions[allVersions.length - 1];
        console.log('最新版本信息:', latestVersionInfo);
        
        if (!latestVersionInfo || !latestVersionInfo.version) {
          throw new Error('版本信息不完整');
        }
        
        const serverVersion = latestVersionInfo.version;
        
        // 找出当前版本之后的所有版本更新
        const relevantVersions = allVersions.filter(versionInfo => {
          return compareVersions(currentVersion, versionInfo.version) < 0;
        });
        
        console.log('相关版本更新:', relevantVersions);
        
        console.log('当前版本:', currentVersion, '服务器版本:', serverVersion);
        
        // 恢复版本号显示
        versionNumber.textContent = originalText;
        
        // 比较版本
        const isLatest = compareVersions(currentVersion, serverVersion) >= 0;
        console.log('是否最新版本:', isLatest);
        
        // 显示相应的模态框
        showVersionModal(isLatest, serverVersion, currentVersion, latestVersionInfo, relevantVersions);
        
      } catch (error) {
        console.error('版本检查失败:', error);
        console.error('错误详情:', error.message, error.stack);
        
        // 恢复版本号显示
        const versionNumber = root.querySelector("#versionCard .version-number");
        versionNumber.textContent = originalText;
        
        // 检查是否是网络错误
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          console.log('网络请求被阻止，可能是CORS或网络策略问题');
          toast("网络请求被阻止，请检查网络设置");
        } else {
          // 显示更具体的错误信息
          const errorMessage = error.message || '未知错误';
          toast(`版本检查失败: ${errorMessage}`);
        }
        
        // 显示默认下载模态框
        showDownloadModal();
      }
    }

    // 比较版本号 - 返回: 1(v1>v2), 0(v1=v2), -1(v1<v2)
    function compareVersions(version1, version2) {
      try {
        if (!version1 || !version2) {
          throw new Error('版本号不能为空');
        }
        
        const v1parts = version1.split('.').map(part => {
          const num = parseInt(part, 10);
          return isNaN(num) ? 0 : num;
        });
        
        const v2parts = version2.split('.').map(part => {
          const num = parseInt(part, 10);
          return isNaN(num) ? 0 : num;
        });
        
        const maxLength = Math.max(v1parts.length, v2parts.length);
        
        for (let i = 0; i < maxLength; i++) {
          const v1part = v1parts[i] || 0;
          const v2part = v2parts[i] || 0;
          
          if (v1part > v2part) return 1;
          if (v1part < v2part) return -1;
        }
        
        return 0;
      } catch (error) {
        console.warn('版本比较失败:', error);
        return 0; // 比较失败时认为版本相同
      }
    }

    // 显示版本信息模态框
    function showVersionModal(isLatest, serverVersion, currentVersion, latestVersionInfo, relevantVersions = []) {
      ensureDownloadStyles();
      const mask = document.createElement("div");
      mask.className = "download-mask";

      const dialog = document.createElement("div");
      dialog.className = "download-dialog";

      const header = document.createElement("div");
      header.className = "download-header";
      header.textContent = isLatest ? "版本信息" : "发现新版本";

      const body = document.createElement("div");
      body.className = "download-body";

      // 版本信息部分
      const versionInfo = document.createElement("div");
      versionInfo.className = "download-section";
      
      if (isLatest) {
        const latestText = document.createElement("p");
        latestText.textContent = "您当前使用的是最新版本";
        latestText.style.color = "#4CAF50";
        latestText.style.fontWeight = "bold";
        latestText.style.textAlign = "center";
        latestText.style.marginBottom = "20px";
        versionInfo.append(latestText);
      } else {
        const updateText = document.createElement("p");
        updateText.textContent = "发现新版本，建议更新以获得更好的体验";
        updateText.style.color = "#FF9800";
        updateText.style.fontWeight = "bold";
        updateText.style.textAlign = "center";
        updateText.style.marginBottom = "20px";
        versionInfo.append(updateText);
      }

      // 版本号对比
      const versionCompare = document.createElement("div");
      versionCompare.style.display = "flex";
      versionCompare.style.justifyContent = "space-between";
      versionCompare.style.marginBottom = "20px";
      versionCompare.style.padding = "10px";
      versionCompare.style.backgroundColor = "rgba(255,255,255,0.05)";
      versionCompare.style.borderRadius = "8px";
      
      const currentVersionDiv = document.createElement("div");
      currentVersionDiv.style.textAlign = "center";
      const currentLabel = document.createElement("div");
      currentLabel.textContent = "当前版本";
      currentLabel.style.fontSize = "14px";
      currentLabel.style.color = "#999";
      currentLabel.style.marginBottom = "5px";
      const currentVersionText = document.createElement("div");
      currentVersionText.textContent = `v${currentVersion}`;
      currentVersionText.style.fontSize = "18px";
      currentVersionText.style.fontWeight = "bold";
      currentVersionDiv.append(currentLabel, currentVersionText);
      
      const serverVersionDiv = document.createElement("div");
      serverVersionDiv.style.textAlign = "center";
      const serverLabel = document.createElement("div");
      serverLabel.textContent = "最新版本";
      serverLabel.style.fontSize = "14px";
      serverLabel.style.color = "#999";
      serverLabel.style.marginBottom = "5px";
      const serverVersionText = document.createElement("div");
      serverVersionText.textContent = `v${serverVersion}`;
      serverVersionText.style.fontSize = "18px";
      serverVersionText.style.fontWeight = "bold";
      serverVersionText.style.color = isLatest ? "#4CAF50" : "#FF9800";
      serverVersionDiv.append(serverLabel, serverVersionText);
      
      versionCompare.append(currentVersionDiv, serverVersionDiv);
      versionInfo.append(versionCompare);

      // 显示更新日志（如果有的话）
      if (relevantVersions.length > 0) {
        const changelogDiv = document.createElement("div");
        changelogDiv.style.marginTop = "20px";
        changelogDiv.style.padding = "15px";
        changelogDiv.style.backgroundColor = "rgba(255,255,255,0.03)";
        changelogDiv.style.borderRadius = "8px";
        changelogDiv.style.border = "1px solid rgba(255,255,255,0.1)";
        
        const changelogTitle = document.createElement("div");
        changelogTitle.textContent = relevantVersions.length > 1 ? "版本更新内容" : "更新内容";
        changelogTitle.style.fontSize = "16px";
        changelogTitle.style.fontWeight = "bold";
        changelogTitle.style.marginBottom = "10px";
        changelogTitle.style.color = "#fff";
        
        // 按版本号排序（从旧到新）
        const sortedVersions = relevantVersions.sort((a, b) => compareVersions(a.version, b.version));
        
        sortedVersions.forEach((versionInfo, index) => {
          if (versionInfo.changes && versionInfo.changes.length > 0) {
            // 版本标题
            const versionTitle = document.createElement("div");
            versionTitle.textContent = `v${versionInfo.version} (${versionInfo.release_date || ''})`;
            versionTitle.style.fontSize = "14px";
            versionTitle.style.fontWeight = "bold";
            versionTitle.style.color = "#4CAF50";
            versionTitle.style.marginTop = index > 0 ? "15px" : "0";
            versionTitle.style.marginBottom = "8px";
            
            // 更新内容列表
            const changelogList = document.createElement("ul");
            changelogList.style.margin = "0";
            changelogList.style.paddingLeft = "20px";
            changelogList.style.color = "#ccc";
            changelogList.style.marginBottom = "10px";
            
            versionInfo.changes.forEach(change => {
              const li = document.createElement("li");
              li.textContent = change;
              li.style.marginBottom = "3px";
              li.style.fontSize = "13px";
              changelogList.append(li);
            });
            
            changelogDiv.append(versionTitle, changelogList);
          }
        });
        
        versionInfo.append(changelogDiv);
      }

      const buttons = document.createElement("div");
      buttons.className = "download-buttons";

      if (!isLatest) {
        // 只有不是最新版本时才显示下载按钮
        const downloadText = document.createElement("p");
        downloadText.textContent = "选择您的设备平台下载最新版本：";
        downloadText.style.marginBottom = "15px";
        versionInfo.append(downloadText);

        // iOS下载按钮
        const iosBtn = document.createElement("a");
        iosBtn.className = "download-btn download-btn-ios";
        iosBtn.href = "https://apps.apple.com/cn/app/%E7%B4%AB%E7%99%9C%E7%B2%BE%E7%81%B5/id6749155721";
        iosBtn.target = "_blank";
        iosBtn.rel = "noopener noreferrer";
        iosBtn.innerHTML = '<ion-icon name="logo-apple"></ion-icon><span>iOS 下载</span>';

        // Android下载按钮
        const androidBtn = document.createElement("a");
        androidBtn.className = "download-btn download-btn-android";
        androidBtn.href = "https://zdelf.cn/share/app-release.apk";
        androidBtn.target = "_blank";
        androidBtn.rel = "noopener noreferrer";
        androidBtn.innerHTML = '<ion-icon name="logo-android"></ion-icon><span>Android 下载</span>';

        buttons.append(iosBtn, androidBtn);
        
        // 为下载按钮添加点击震动
        iosBtn.addEventListener("click", () => triggerVibration('Medium'));
        androidBtn.addEventListener("click", () => triggerVibration('Medium'));
      }

      body.append(versionInfo, buttons);

      const footer = document.createElement("div");
      footer.className = "download-footer";
      const closeBtn = document.createElement("button");
      closeBtn.className = "download-close-btn";
      closeBtn.textContent = "关闭";
      footer.append(closeBtn);

      dialog.append(header, body, footer);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        dialog.classList.add("show");
      });

      const close = () => {
        dialog.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
      };

      closeBtn.addEventListener("click", () => {
        triggerVibration('Light');
        close();
      }, { once: true });
      
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });
      
      document.addEventListener("keydown", function escHandler(ev) {
        if (ev.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          close();
        }
      });

      cleanupFns.push(() => {
        if (mask.parentNode) mask.remove();
      });
    }

    function showDownloadModal() {
      ensureDownloadStyles();
      const mask = document.createElement("div");
      mask.className = "download-mask";

      const dialog = document.createElement("div");
      dialog.className = "download-dialog";

      const header = document.createElement("div");
      header.className = "download-header";
      header.textContent = "下载应用";

      const body = document.createElement("div");
      body.className = "download-body";

      const section = document.createElement("div");
      section.className = "download-section";
      const text = document.createElement("p");
      text.textContent = "选择您的设备平台下载紫癜精灵：";
      section.append(text);

      const buttons = document.createElement("div");
      buttons.className = "download-buttons";

      // iOS下载按钮
      const iosBtn = document.createElement("a");
      iosBtn.className = "download-btn download-btn-ios";
      iosBtn.href = "https://apps.apple.com/cn/app/%E7%B4%AB%E7%99%9C%E7%B2%BE%E7%81%B5/id6749155721";
      iosBtn.target = "_blank";
      iosBtn.rel = "noopener noreferrer";
      iosBtn.innerHTML = '<ion-icon name="logo-apple"></ion-icon><span>iOS 下载</span>';

      // Android下载按钮
      const androidBtn = document.createElement("a");
      androidBtn.className = "download-btn download-btn-android";
      androidBtn.href = "https://zdelf.cn/share/app-release.apk";
      androidBtn.target = "_blank";
      androidBtn.rel = "noopener noreferrer";
      androidBtn.innerHTML = '<ion-icon name="logo-android"></ion-icon><span>Android 下载</span>';

      buttons.append(iosBtn, androidBtn);
      body.append(section, buttons);

      const footer = document.createElement("div");
      footer.className = "download-footer";
      const closeBtn = document.createElement("button");
      closeBtn.className = "download-close-btn";
      closeBtn.textContent = "关闭";
      footer.append(closeBtn);

      dialog.append(header, body, footer);
      mask.appendChild(dialog);
      document.body.appendChild(mask);

      requestAnimationFrame(() => {
        mask.classList.add("show");
        dialog.classList.add("show");
      });

      const close = () => {
        dialog.classList.remove("show");
        mask.classList.remove("show");
        const onEnd = () => {
          mask.removeEventListener("transitionend", onEnd);
          if (mask.parentNode) mask.remove();
        };
        mask.addEventListener("transitionend", onEnd);
      };

      closeBtn.addEventListener("click", () => {
        triggerVibration('Light');
        close();
      }, { once: true });
      
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });
      
      document.addEventListener("keydown", function escHandler(ev) {
        if (ev.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          close();
        }
      });

      // 为下载按钮添加点击震动
      iosBtn.addEventListener("click", () => triggerVibration('Medium'));
      androidBtn.addEventListener("click", () => triggerVibration('Medium'));

      cleanupFns.push(() => {
        if (mask.parentNode) mask.remove();
      });
    }

    // 版本卡片点击
    const versionCard = root.querySelector("#versionCard");
    if (versionCard) {
      const versionHandler = () => {
        triggerVibration('Light');
        checkVersionAndShowModal();
      };
      versionCard.addEventListener("click", versionHandler);
      cleanupFns.push(() => versionCard.removeEventListener("click", versionHandler));
    }

    // 列表项点击
    root.querySelectorAll("[data-action]").forEach((el) => {
      const actionHandler = () => {
        // 添加震动反馈
        triggerVibration('Light');
        
        if (el.dataset.action === "help") {
          showCombinedHelpModal();
        } else if (el.dataset.action === "vibration") {
          showVibrationModal();
        } else if (el.dataset.action === "blocked-users") {
          // 跳转到屏蔽用户管理页面
          window.location.href = "src/blocked_users.html";
        } else {
          toast("打开：" + el.dataset.action);
        }
      };
      el.addEventListener("click", actionHandler);
      cleanupFns.push(() => el.removeEventListener("click", actionHandler));
    });

    // 头像上传功能
    const avatarUploadBtn = root.querySelector("#avatarUploadBtn");
    const avatarFileInput = root.querySelector("#avatarFileInput");
    
    console.log("[me] 头像上传按钮:", avatarUploadBtn);
    console.log("[me] 文件输入:", avatarFileInput);
    
    // 头像上传处理函数
    function handleAvatarUpload(event) {
      console.log("[me] 文件选择事件触发");
      console.log("[me] 事件对象:", event);
      console.log("[me] 事件目标:", event.target);
      console.log("[me] 文件列表:", event.target.files);
      
      const file = event.target.files[0];
      if (!file) {
        console.log("[me] 没有选择文件");
        return;
      }
      
      console.log("[me] 选择的文件:", file.name, file.size, file.type);
      
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        showErrorModal('请选择图片文件');
        return;
      }
      
      // 检查文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        showErrorModal('图片文件过大，请选择小于10MB的图片');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = function(e) {
        console.log("[me] 文件读取完成，显示裁剪界面");
        showAvatarCropModal(e.target.result, storedId, storedUsername);
      };
      reader.readAsDataURL(file);
    }
    
    // 头像裁剪模态框
    function showAvatarCropModal(imageData, userId, username) {
      console.log("[me] 显示头像裁剪模态框，图片数据长度:", imageData ? imageData.length : 0);
      
      // 检测深色模式
      const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      console.log("[me] 深色模式:", isDarkMode);
      
      // 先移除可能存在的旧模态框
      const existingMask = document.querySelector('.avatar-crop-mask');
      if (existingMask) {
        existingMask.remove();
      }
      
      const mask = document.createElement("div");
      mask.className = "avatar-crop-mask";
      
      // 根据深色模式选择背景色
      const maskBackground = isDarkMode 
        ? "rgba(0, 0, 0, 0.9)" 
        : "rgba(0, 0, 0, 0.8)";
      
      mask.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: ${maskBackground};
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        opacity: 1;
      `;
      
      const dialog = document.createElement("div");
      dialog.className = "avatar-crop-dialog";
      
      // 根据深色模式选择对话框样式
      const dialogBackground = isDarkMode 
        ? "linear-gradient(135deg, #1f2937 0%, #111827 100%)" 
        : "white";
      const dialogShadow = isDarkMode 
        ? "0 20px 40px rgba(0, 0, 0, 0.5)" 
        : "0 20px 40px rgba(0, 0, 0, 0.3)";
      
      dialog.style.cssText = `
        width: 90vw;
        max-width: 400px;
        background: ${dialogBackground};
        border-radius: 16px;
        box-shadow: ${dialogShadow};
        overflow: hidden;
        position: relative;
        z-index: 100000;
        opacity: 1;
        transform: scale(1);
        border: ${isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'};
      `;
      
      // 根据深色模式选择内容样式
      const contentBackground = isDarkMode ? "transparent" : "white";
      const titleColor = isDarkMode ? "#f9fafb" : "#333";
      const textColor = isDarkMode ? "#d1d5db" : "#666";
      const borderColor = isDarkMode ? "#a78bfa" : "#1a73e8";
      const cancelBg = isDarkMode ? "#374151" : "#f5f5f5";
      const cancelBorder = isDarkMode ? "#4b5563" : "#ddd";
      const cancelText = isDarkMode ? "#f9fafb" : "#333";
      const confirmBg = isDarkMode ? "#a78bfa" : "#1a73e8";
      
      // 裁剪模态框内容
      dialog.innerHTML = `
        <div style="padding: 20px; text-align: center; background: ${contentBackground}; min-height: 400px;">
          <h3 style="margin: 0 0 16px 0; color: ${titleColor}; font-size: 18px; font-weight: 600;">头像裁剪</h3>
          <div id="cropContainer" style="position: relative; width: 300px; height: 300px; margin: 0 auto 16px; border: 2px solid ${borderColor}; border-radius: 8px; overflow: hidden; background: #f0f0f0; touch-action: none;">
            <img id="cropImage" src="${imageData}" style="width: 100%; height: 100%; object-fit: contain; cursor: move; user-select: none; pointer-events: none;" alt="裁剪图片">
            <div id="cropOverlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 200px; height: 200px; border: 3px solid ${borderColor}; border-radius: 50%; background: transparent; cursor: move; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5); pointer-events: none;"></div>
          </div>
          <p style="margin: 0 0 20px 0; color: ${textColor}; font-size: 14px;">拖拽调整位置，滚轮/捏合缩放，圆形区域为最终头像</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button id="cancelCrop" style="padding: 10px 20px; border: 1px solid ${cancelBorder}; background: ${cancelBg}; color: ${cancelText}; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s;">取消</button>
            <button id="confirmCrop" style="padding: 10px 20px; border: none; background: ${confirmBg}; color: white; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s;">确认</button>
          </div>
        </div>
      `;
      
      mask.appendChild(dialog);
      document.body.appendChild(mask);
      
      console.log("[me] 模态框已添加到DOM");
      
      // 添加拖拽和缩放功能
      const cropContainer = dialog.querySelector("#cropContainer");
      const cropImage = dialog.querySelector("#cropImage");
      const cropOverlay = dialog.querySelector("#cropOverlay");
      
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let currentX = 0;
      let currentY = 0;
      let currentScale = 1;
      let minScale = 0.5;
      let maxScale = 3;
      let lastDistance = 0;
      
      // 更新图片变换
      function updateTransform() {
        cropImage.style.transform = `translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
      }
      
      // 鼠标拖拽事件（在容器上）
      cropContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - currentX;
        startY = e.clientY - currentY;
        cropContainer.style.cursor = 'grabbing';
      });
      
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - startX;
        currentY = e.clientY - startY;
        updateTransform();
      });
      
      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          cropContainer.style.cursor = 'move';
        }
      });
      
      // 鼠标滚轮缩放（在容器上）
      cropContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        currentScale = Math.max(minScale, Math.min(maxScale, currentScale + delta));
        updateTransform();
      });
      
      // 触摸事件支持（在容器上）
      cropContainer.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          isDragging = true;
          const touch = e.touches[0];
          startX = touch.clientX - currentX;
          startY = touch.clientY - currentY;
        } else if (e.touches.length === 2) {
          isDragging = false;
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          lastDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
        }
      });
      
      cropContainer.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging) {
          const touch = e.touches[0];
          currentX = touch.clientX - startX;
          currentY = touch.clientY - startY;
          updateTransform();
        } else if (e.touches.length === 2) {
          isDragging = false;
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) + 
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
          
          if (lastDistance > 0) {
            const scaleChange = distance / lastDistance;
            currentScale = Math.max(minScale, Math.min(maxScale, currentScale * scaleChange));
            updateTransform();
          }
          lastDistance = distance;
        }
      });
      
      cropContainer.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
          isDragging = false;
        }
      });
      
      // 立即显示，不使用动画
      setTimeout(() => {
        console.log("[me] 模态框应该可见了");
        console.log("[me] 模态框位置:", mask.getBoundingClientRect());
        console.log("[me] 模态框样式:", mask.style.cssText);
        // 强制显示
        mask.style.display = 'flex';
        mask.style.opacity = '1';
        mask.style.visibility = 'visible';
      }, 100);
      
      // 关闭函数
      const close = () => {
        if (mask.parentNode) mask.remove();
      };
      
      // 事件处理
      const cancelBtn = dialog.querySelector("#cancelCrop");
      const confirmBtn = dialog.querySelector("#confirmCrop");
      
      // 添加按钮悬停效果
      if (cancelBtn) {
        cancelBtn.addEventListener("mouseenter", () => {
          if (isDarkMode) {
            cancelBtn.style.background = "#4b5563";
            cancelBtn.style.borderColor = "#6b7280";
          } else {
            cancelBtn.style.background = "#e5e7eb";
          }
        });
        cancelBtn.addEventListener("mouseleave", () => {
          if (isDarkMode) {
            cancelBtn.style.background = "#374151";
            cancelBtn.style.borderColor = "#4b5563";
          } else {
            cancelBtn.style.background = "#f5f5f5";
          }
        });
      }
      
      if (confirmBtn) {
        confirmBtn.addEventListener("mouseenter", () => {
          if (isDarkMode) {
            confirmBtn.style.background = "#c4b5fd";
          } else {
            confirmBtn.style.background = "#1557b0";
          }
        });
        confirmBtn.addEventListener("mouseleave", () => {
          if (isDarkMode) {
            confirmBtn.style.background = "#a78bfa";
          } else {
            confirmBtn.style.background = "#1a73e8";
          }
        });
      }
      
      cancelBtn.addEventListener("click", () => {
        triggerVibration('Light');
        close();
      }, { once: true });
      mask.addEventListener("click", (e) => {
        if (e.target === mask) close();
      });
      
      confirmBtn.addEventListener("click", () => {
        triggerVibration('Medium');
        // 获取裁剪区域和容器的位置
        const cropRect = cropOverlay.getBoundingClientRect();
        const containerRect = cropContainer.getBoundingClientRect();
        
        // 计算裁剪区域相对于容器的中心位置
        const cropCenterX = cropRect.left + cropRect.width / 2 - containerRect.left;
        const cropCenterY = cropRect.top + cropRect.height / 2 - containerRect.top;
        const cropRadius = cropRect.width / 2;
        
        // 获取图片的原始尺寸
        const imageNaturalWidth = cropImage.naturalWidth;
        const imageNaturalHeight = cropImage.naturalHeight;
        
        // 计算图片在容器中的实际显示尺寸（object-fit: contain）
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        let displayWidth, displayHeight, imageOffsetX, imageOffsetY;
        
        // 计算图片的显示尺寸（保持宽高比，居中显示）
        if (imageNaturalWidth / imageNaturalHeight > containerWidth / containerHeight) {
          // 图片更宽，以容器宽度为准
          displayWidth = containerWidth;
          displayHeight = containerWidth * imageNaturalHeight / imageNaturalWidth;
          imageOffsetX = 0;
          imageOffsetY = (containerHeight - displayHeight) / 2;
        } else {
          // 图片更高，以容器高度为准
          displayHeight = containerHeight;
          displayWidth = containerHeight * imageNaturalWidth / imageNaturalHeight;
          imageOffsetX = (containerWidth - displayWidth) / 2;
          imageOffsetY = 0;
        }
        
        // 关键修复：严格按照预览中的平移/缩放计算原图像素级裁剪矩形
        // 1) 图片在容器中的中心（包含拖拽偏移）
        const imageCenterX = containerWidth / 2 + currentX;
        const imageCenterY = containerHeight / 2 + currentY;

        // 2) 预览圈中心相对图片中心的位移（容器像素）
        const dxContainer = (cropCenterX - imageCenterX);
        const dyContainer = (cropCenterY - imageCenterY);

        // 3) 原图到容器的基础缩放系数（不含用户缩放）
        const baseScale = displayWidth / imageNaturalWidth; // 等同于 displayHeight / imageNaturalHeight

        // 4) 将容器像素位移还原到原图像素位移
        const dxOriginal = dxContainer / (baseScale * currentScale);
        const dyOriginal = dyContainer / (baseScale * currentScale);

        // 5) 原图坐标系下的裁剪中心
        const centerXOriginal = imageNaturalWidth / 2 + dxOriginal;
        const centerYOriginal = imageNaturalHeight / 2 + dyOriginal;

        // 6) 原图像素级边长（使得映射到容器后直径等于圆形直径）
        const sourceSizePx = (cropRadius * 2) / (baseScale * currentScale);

        // 7) 原图像素级裁剪矩形（不做边界夹取，保持与预览一致；越界部分输出为透明）
        const sourceX = centerXOriginal - sourceSizePx / 2;
        const sourceY = centerYOriginal - sourceSizePx / 2;

        console.log('[me] 预览一致裁剪（原图像素）:', {
          displayWidth, displayHeight, baseScale, currentScale,
          dxContainer, dyContainer, dxOriginal, dyOriginal,
          centerXOriginal, centerYOriginal, sourceSizePx, sourceX, sourceY
        });

        // 使用像素级裁剪以确保与预览一致
        cropAndUploadAvatarFromSourceRect(imageData, sourceX, sourceY, sourceSizePx, userId, username);
        close();
      }, { once: true });
      
      // ESC键关闭
      const escHandler = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", escHandler);
          close();
        }
      };
      document.addEventListener("keydown", escHandler);
      
      cleanupFns.push(() => {
        document.removeEventListener("keydown", escHandler);
        if (mask.parentNode) mask.remove();
      });
    }
    
    // 裁剪并上传头像
    async function cropAndUploadAvatar(imageData, cropX, cropY, cropSize, userId, username) {
      try {
        console.log("[me] 开始裁剪头像，参数:", { cropX, cropY, cropSize });
        
        // 创建图片对象
        const img = new Image();
        img.onload = async function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 设置画布尺寸
          const targetSize = 200;
          canvas.width = targetSize;
          canvas.height = targetSize;
          
          // 重新计算裁剪区域，确保与预览一致
          // 获取原始图片尺寸
          const imgWidth = img.width;
          const imgHeight = img.height;
          
          // 计算裁剪区域的实际像素坐标
          // cropX, cropY 是相对于图片的坐标（0-1），表示裁剪中心点
          // cropSize 是相对于图片尺寸的比例（0-1），表示裁剪区域大小
          
          const sourceSize = cropSize * Math.min(imgWidth, imgHeight);
          const sourceX = (cropX * imgWidth) - sourceSize / 2;
          const sourceY = (cropY * imgHeight) - sourceSize / 2;
          
          console.log("[me] 原始裁剪参数:", { cropX, cropY, cropSize });
          console.log("[me] 图片尺寸:", { imgWidth, imgHeight });
          console.log("[me] 计算裁剪区域:", { sourceX, sourceY, sourceSize });
          
          // 确保裁剪区域在图片范围内
          const clampedSourceX = Math.max(0, Math.min(imgWidth - sourceSize, sourceX));
          const clampedSourceY = Math.max(0, Math.min(imgHeight - sourceSize, sourceY));
          const clampedSourceSize = Math.min(sourceSize, imgWidth - clampedSourceX, imgHeight - clampedSourceY);
          
          console.log("[me] 边界检查后:", { clampedSourceX, clampedSourceY, clampedSourceSize });
          
          // 先清空画布
          ctx.clearRect(0, 0, targetSize, targetSize);
          
          // 绘制裁剪后的图片
          ctx.drawImage(
            img,
            clampedSourceX, clampedSourceY, clampedSourceSize, clampedSourceSize,
            0, 0, targetSize, targetSize
          );
          
          // 应用圆形蒙版
          const maskCanvas = document.createElement('canvas');
          const maskCtx = maskCanvas.getContext('2d');
          maskCanvas.width = targetSize;
          maskCanvas.height = targetSize;
          
          // 创建圆形蒙版
          maskCtx.beginPath();
          maskCtx.arc(targetSize/2, targetSize/2, targetSize/2, 0, Math.PI * 2);
          maskCtx.fill();
          
          // 应用蒙版
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskCanvas, 0, 0);
          
          // 转换为base64
          const croppedData = canvas.toDataURL('image/png', 0.9);
          console.log("[me] 裁剪完成，数据大小:", croppedData.length);
          
          // 上传裁剪后的图片
          await uploadAvatar(croppedData, userId, username);
        };
        
        img.onerror = function() {
          console.error("[me] 图片加载失败");
          showErrorModal("图片处理失败");
        };
        
        img.src = imageData;
        
      } catch (error) {
        console.error("[me] 裁剪头像失败:", error);
        showErrorModal("头像裁剪失败，请稍后再试");
      }
    }
    
    // 使用源矩形进行精准裁剪并上传（与预览完全一致）
    async function cropAndUploadAvatarFromSourceRect(imageData, sourceX, sourceY, sourceSize, userId, username) {
      try {
        const img = new Image();
        img.onload = async function() {
          const targetSize = 200;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = targetSize;
          canvas.height = targetSize;

          // 开启透明背景，先清空
          ctx.clearRect(0, 0, targetSize, targetSize);

          // 如源矩形越界，drawImage 会自动只绘制交集部分，其余保持透明
          ctx.drawImage(
            img,
            sourceX, sourceY, sourceSize, sourceSize,
            0, 0, targetSize, targetSize
          );

          // 应用圆形裁剪以匹配预览圈
          ctx.globalCompositeOperation = 'destination-in';
          ctx.beginPath();
          ctx.arc(targetSize / 2, targetSize / 2, targetSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.fill();

          const croppedData = canvas.toDataURL('image/png', 0.95);
          await uploadAvatar(croppedData, userId, username);
        };
        img.onerror = function() {
          showErrorModal('图片处理失败');
        };
        img.src = imageData;
      } catch (err) {
        console.error('[me] 精准裁剪失败:', err);
        showErrorModal('头像裁剪失败，请稍后再试');
      }
    }
    
    // 上传头像到服务器
    async function uploadAvatar(imageData, userId, username) {
      try {
        console.log("[me] 开始上传头像，用户ID:", userId || username);
        console.log("[me] API地址:", apiBase + "/upload_avatar");
        
        // 前端压缩处理
        const compressedData = await compressImage(imageData);
        console.log("[me] 图片压缩完成，压缩后大小:", compressedData.length);
        
        const payload = {
          user_id: userId || username,
          avatar_data: compressedData
        };
        
        console.log("[me] 发送请求，payload keys:", Object.keys(payload));
        
        const response = await fetch(apiBase + "/upload_avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        console.log("[me] 响应状态:", response.status, response.statusText);
        
        const result = await response.json();
        console.log("[me] 响应数据:", result);
        
        if (!response.ok || !result.success) {
          console.error("[me] 上传失败:", result);
          showErrorModal(result.message || "头像上传失败");
          return;
        }
        
        // 更新本地用户数据
        user.avatar_url = result.data.avatar_url;
        console.log("[me] 更新头像URL:", user.avatar_url);
        
        // 确保头像URL是完整的URL，并添加时间戳避免缓存
        if (user.avatar_url && !user.avatar_url.startsWith('http')) {
          user.avatar_url = apiBase + user.avatar_url;
        }
        // 添加时间戳参数避免缓存
        if (user.avatar_url) {
          const separator = user.avatar_url.includes('?') ? '&' : '?';
          user.avatar_url = user.avatar_url + separator + 't=' + Date.now();
          console.log("[me] 完整头像URL（带时间戳）:", user.avatar_url);
        }
        
        renderUser();
        showSuccessModal("头像上传成功");
        
      } catch (error) {
        console.error("[me] 头像上传失败:", error);
        console.error("[me] 错误详情:", error.message, error.stack);
        showErrorModal("头像上传失败，请稍后再试");
      }
    }
    
    // 压缩图片到目标尺寸
    async function compressImage(imageData) {
      return new Promise((resolve, reject) => {
        console.log("[me] 开始压缩图片");
        const img = new Image();
        
        img.onload = function() {
          console.log("[me] 图片加载完成，原始尺寸:", img.width, "x", img.height);
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 设置目标尺寸
          const targetSize = 200;
          canvas.width = targetSize;
          canvas.height = targetSize;
          
          // 先绘制图片
          ctx.drawImage(img, 0, 0, targetSize, targetSize);
          
          // 创建圆形蒙版
          const maskCanvas = document.createElement('canvas');
          const maskCtx = maskCanvas.getContext('2d');
          maskCanvas.width = targetSize;
          maskCanvas.height = targetSize;
          
          // 绘制圆形蒙版
          maskCtx.beginPath();
          maskCtx.arc(targetSize/2, targetSize/2, targetSize/2, 0, Math.PI * 2);
          maskCtx.fill();
          
          // 应用蒙版
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskCanvas, 0, 0);
          
          // 转换为base64
          const compressedData = canvas.toDataURL('image/png', 0.9);
          console.log("[me] 图片压缩完成，压缩后大小:", compressedData.length);
          resolve(compressedData);
        };
        
        img.onerror = function() {
          console.error("[me] 图片加载失败");
          reject(new Error("图片加载失败"));
        };
        
        img.src = imageData;
      });
    }
    
    if (avatarUploadBtn && avatarFileInput) {
      const uploadHandler = (e) => {
        console.log("[me] 头像上传按钮被点击");
        e.preventDefault();
        e.stopPropagation();
        triggerVibration('Light');
        console.log("[me] 触发文件选择器");
        
        // 检查文件输入元素状态
        console.log("[me] 文件输入状态:", {
          disabled: avatarFileInput.disabled,
          hidden: avatarFileInput.hidden,
          style: avatarFileInput.style.display,
          offsetParent: avatarFileInput.offsetParent
        });
        
        // 直接触发文件选择，使用原有的头像裁剪功能
        try {
          avatarFileInput.click();
          console.log("[me] 文件选择器已触发");
        } catch (error) {
          console.error("[me] 触发文件选择器失败:", error);
        }
      };
      
      avatarUploadBtn.addEventListener("click", uploadHandler);
      cleanupFns.push(() => avatarUploadBtn.removeEventListener("click", uploadHandler));
      
      // 保留原有的文件选择功能作为备用
      console.log("[me] 绑定文件选择事件监听器");
      avatarFileInput.addEventListener("change", handleAvatarUpload);
      cleanupFns.push(() => avatarFileInput.removeEventListener("change", handleAvatarUpload));
      
      // 添加额外的调试信息
      console.log("[me] 文件输入元素:", avatarFileInput);
      console.log("[me] 文件输入属性:", {
        type: avatarFileInput.type,
        accept: avatarFileInput.accept,
        style: avatarFileInput.style.display
      });
    } else {
      console.warn("[me] 头像上传按钮或文件输入未找到");
    }
  }

  /**
   * Cleanup function: run all stored teardown callbacks.
   * Called before leaving the page to prevent leaks.
   */
  function destroyMe() {
    abortInFlight();



    cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
    cleanupFns = [];
  }

  // Expose lifecycle functions to global scope for loader
  console.debug("[me] exposing lifecycle: initMe/destroyMe");
  window.initMe = initMe;
  window.destroyMe = destroyMe;
})();
