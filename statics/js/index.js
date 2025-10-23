/**
 * index.js — App shell controller for the Health Navigation App
 *
 * Purpose
 * - Manage bottom navigation (active state, indicator, ripple)
 * - Load subpages into a Shadow DOM sandbox
 * - Run page lifecycle hooks: initX / destroyX
 * - Open/close the center-action modal
 *
 * Why Shadow DOM?
 * - Isolates subpage CSS/JS from the global shell
 * - Allows each page to safely include its own <style>/<link>
 */

// Root elements for the app shell (outside Shadow DOM)
const navItems = document.querySelectorAll(".nav-item");
const indicator = document.getElementById("indicator");
const centerBtn = document.getElementById("centerBtn");
const content = document.getElementById("content");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modalContent");

// Haptics helper - 使用统一的震动管理器
const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());

// 使用HapticManager，如果未加载则提供fallback
const hapticImpact = (style, options) => {
  if (window.HapticManager) {
    window.HapticManager.impact(style, options);
  } else if (window.__hapticImpact__) {
    window.__hapticImpact__(style);
  }
};

// StatusBar helper
function getStatusBar() {
  const C = window.Capacitor || {};
  return (C.Plugins && C.Plugins.StatusBar) || window.StatusBar || C.StatusBar || null;
}

// Apply status bar theme based on prefers-color-scheme
function applyStatusBarTheme() {
  if (!isNative) return;
  const sb = getStatusBar();
  if (!sb) return;
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    // Ensure it does not overlay the webview
    if (typeof sb.setOverlaysWebView === 'function') {
      sb.setOverlaysWebView({ overlay: false });
    }
    // Set text/icon style to contrast with background
    if (typeof sb.setStyle === 'function') {
      sb.setStyle({ style: isDark ? 'Light' : 'Dark' });
    }
    // Android: set background color explicitly to match theme
    if (typeof sb.setBackgroundColor === 'function') {
      sb.setBackgroundColor({ color: isDark ? '#18181C' : '#FFFFFF' });
    }
  } catch (e) {
    // ignore if not supported
  }
}

// 智能StoreKit评分管理
function initRating() {
  if (window.OfficialRating) {
    console.log('智能StoreKit评分插件已加载');
    
    // 初始化用户数据
    initUserData();
    
    // 延迟检查评分条件
    setTimeout(async () => {
      try {
        const shouldShow = await checkRatingEligibility();
        if (shouldShow) {
          await window.OfficialRating.requestReview();
          console.log('智能触发原生StoreKit评分弹窗');
        }
      } catch (error) {
        console.log('智能评分触发失败:', error.message);
      }
    }, 5000); // 5秒后检查
  }
}

// 初始化用户数据
function initUserData() {
  const now = Date.now();
  
  // 设置安装日期（如果不存在）
  if (!localStorage.getItem('appInstallDate')) {
    localStorage.setItem('appInstallDate', now.toString());
  }
  
  // 增加启动次数
  const launchCount = parseInt(localStorage.getItem('launchCount') || '0') + 1;
  localStorage.setItem('launchCount', launchCount.toString());
  
  // 记录启动时间
  localStorage.setItem('lastLaunchTime', now.toString());
}

// 检查评分资格
function checkRatingEligibility() {
  const now = Date.now();
  const installDate = parseInt(localStorage.getItem('appInstallDate') || '0');
  const launchCount = parseInt(localStorage.getItem('launchCount') || '0');
  const lastRatingRequest = parseInt(localStorage.getItem('lastRatingRequest') || '0');
  
  // 最少使用7天
  const minDays = 7;
  const daysSinceInstall = (now - installDate) / (1000 * 60 * 60 * 24);
  
  // 最少启动10次
  const minLaunches = 10;
  
  // 评分间隔30天
  const ratingInterval = 30;
  const daysSinceLastRating = (now - lastRatingRequest) / (1000 * 60 * 60 * 24);
  
  const shouldShow = 
    daysSinceInstall >= minDays && 
    launchCount >= minLaunches && 
    daysSinceLastRating >= ratingInterval;
  
  console.log('评分资格检查:', {
    daysSinceInstall: Math.floor(daysSinceInstall),
    launchCount,
    daysSinceLastRating: Math.floor(daysSinceLastRating),
    shouldShow
  });
  
  return shouldShow;
}

// 记录用户重要操作
function trackUserAction(action) {
  const now = Date.now();
  const actionCount = parseInt(localStorage.getItem(`action_${action}`) || '0') + 1;
  localStorage.setItem(`action_${action}`, actionCount.toString());
  localStorage.setItem(`last_${action}`, now.toString());
  
  // 检查是否应该触发评分
  setTimeout(async () => {
    try {
      const shouldShow = await checkRatingEligibility();
      if (shouldShow) {
        await window.OfficialRating.requestReview();
        localStorage.setItem('lastRatingRequest', now.toString());
        console.log('用户操作触发原生StoreKit评分弹窗');
      }
    } catch (error) {
      console.log('用户操作评分触发失败:', error.message);
    }
  }, 2000);
}

// Keep dynamic content scrollable and size it under the fixed bottom nav
function setNavHeightVar() {
  const nav = document.querySelector(".nav-container");
  if (!nav) return;
  const h = nav.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--nav-h", h + "px");
}
// Recalculate on load, resize, and after fonts load (icon fonts may change height)
window.addEventListener("load", setNavHeightVar);
window.addEventListener("resize", setNavHeightVar);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(setNavHeightVar);
}

// Subpage paths by tab index (HTML fragments or full HTML docs)
const pageMap = [
  "../../src/daily.html",
  "../../src/notification.html",
  "../../src/square.html",
  "../../src/me.html",
];

// Current active tab index
let activeIndex = 0;

// Track current page's destroy hook and ShadowRoot for cleanup during navigation
let currentDestroy = null;
let currentShadowRoot = null;

/**
 * Inject inline <style> tags and page-scoped stylesheets into the ShadowRoot.
 *
 * @param {Document} doc      Parsed HTML document returned by fetch
 * @param {ShadowRoot} shadow Shadow root hosting the subpage
 *
 * Behavior:
 * - Clone all inline <style> blocks from the subpage
 * - Clone <link rel="stylesheet"> except for global assets already loaded in the host
 * - Append icon fixes so Ionicons and iconfont render inside the Shadow DOM
 */
function injectPageStyles(doc, shadow) {
  // Copy all inline <style> tags from <head> and <body>
  doc.querySelectorAll("style").forEach((styleEl) => {
    shadow.appendChild(styleEl.cloneNode(true));
  });
  // Global styles to skip (already loaded in the host <head>)
  const globalHrefs = new Set([
    new URL("../../statics/css/nav.css", location.href).href,
  ]);
  doc.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = new URL(link.getAttribute("href"), location.href).href;
    if (globalHrefs.has(href)) return; // skip globals
    const clone = link.cloneNode(true);
    shadow.appendChild(clone);
  });
  // Icon font fix: ensure ligatures resolve inside the Shadow DOM
  const fix = document.createElement("style");
  fix.textContent = `
    /* Ensure Ionicons size consistently inside Shadow DOM */
    ion-icon { width: 24px; height: 24px; display: inline-block; }
    .iconfont { font-family: "iconfont" !important; font-style: normal; font-weight: normal; }
  `;
  shadow.appendChild(fix);
}

// 缓存已加载的页面脚本，避免重复加载
const loadedScripts = new Set();
const pageInstances = new Map(); // 缓存页面实例

/**
 * Load a subpage by index and mount it under #content using Shadow DOM.
 *
 * @param {number} index Tab index from the navbar
 *
 * Steps:
 * 1) Run previous page's destroy hook (if any)
 * 2) Fetch subpage HTML and parse via DOMParser
 * 3) Create a ShadowRoot host and mount the page content
 * 4) Inject page styles into the ShadowRoot
 * 5) Load the page script (daily/case/square/me) with cache-busting
 * 6) Call initX(shadowRoot) and store destroyX for teardown on navigation
 */
function loadPage(index) {
  // run previous page teardown if available
  if (typeof currentDestroy === "function") {
    try {
      currentDestroy();
    } catch (e) {
      console.warn(e);
    }
    currentDestroy = null;
  }

  fetch(pageMap[index])
    .then((res) => res.text())
    .then((html) => {
      // Parse the incoming document and take only the <body> content (fallback to raw HTML)
      const doc = new DOMParser().parseFromString(html, "text/html");
      const bodyHTML = doc.body ? doc.body.innerHTML : html;

      // Create a host element and attach a ShadowRoot to sandbox styles/scripts
      const host = document.createElement("div");
      host.className = "page-host";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = bodyHTML;

      injectPageStyles(doc, shadow);

      // Mount the new page (replace previous content)
      content.replaceChildren(host);
      currentShadowRoot = shadow;

      // Load the corresponding page script with cache-busting
      const scriptMap = [
        "../../statics/js/daily.js",
        "../../statics/js/notification.js",
        "../../statics/js/square.js",
        "../../statics/js/me.js",
      ];

      if (scriptMap[index]) {
        const scriptPath = scriptMap[index];
        
        // 检查脚本是否已经加载过
        if (loadedScripts.has(scriptPath)) {
          // 脚本已加载，直接调用初始化函数
          const initName = scriptPath.split("/").pop().replace(".js", "");
          const cap = initName.charAt(0).toUpperCase() + initName.slice(1);
          
          // 特殊处理不同页面的初始化函数
          let initFn, destroyFn;
          if (initName === 'notification') {
            initFn = window.initNotification || window.initCase;
            destroyFn = window.destroyNotification || window.destroyCase;
          } else if (initName === 'square') {
            initFn = window.initSquare;
            destroyFn = window.destroySquare;
          } else {
            initFn = window[`init${cap}`];
            destroyFn = window[`destroy${cap}`];
          }
          
          if (typeof destroyFn === "function") currentDestroy = destroyFn;
          if (typeof initFn === "function") {
            console.log("📦 使用已缓存的脚本:", scriptPath);
            initFn(currentShadowRoot);
          }
          return;
        }

        // Remove old script tag for this page (if any)
        const oldScript = document.querySelector(
          `script[data-page-script="${scriptPath}"]`
        );
        if (oldScript) oldScript.remove();

        const script = document.createElement("script");
        script.src = `${scriptPath}?t=${Date.now()}`; // avoid cached non-execution
        script.setAttribute("data-page-script", scriptPath);
        script.onload = () => {
          // 标记脚本已加载
          loadedScripts.add(scriptPath);
          
          // Call page init with the ShadowRoot so code scopes to its own DOM
          const initName = scriptPath.split("/").pop().replace(".js", ""); // daily / notification / deepseek / me
          const cap = initName.charAt(0).toUpperCase() + initName.slice(1);
          
          // 特殊处理不同页面的初始化函数
          let initFn, destroyFn;
          if (initName === 'notification') {
            initFn = window.initNotification || window.initCase;
            destroyFn = window.destroyNotification || window.destroyCase;
          } else if (initName === 'square') {
            initFn = window.initSquare;
            destroyFn = window.destroySquare;
          } else {
            initFn = window[`init${cap}`];
            destroyFn = window[`destroy${cap}`];
          }
          
          if (typeof destroyFn === "function") currentDestroy = destroyFn;
          if (typeof initFn === "function") initFn(currentShadowRoot);
        };
        document.body.appendChild(script);

        console.log("📦 动态加载脚本:", scriptPath);
      }
    })
    .catch((err) => {
      // Fallback UI
      content.innerHTML =
        "<p style='padding: 2em; text-align:center;'>⚠️ 页面加载失败</p>";
      console.error("加载页面出错:", err);
      currentShadowRoot = null;
    });
}

// 使用新的高性能涟漪效果系统
document.addEventListener('DOMContentLoaded', () => {
  // 初始化原生StoreKit评分管理
  initRating();
  
  // 为导航按钮添加涟漪效果
  document.querySelectorAll(".nav-item .icon").forEach((button) => {
    if (window.AnimationUtils) {
      window.AnimationUtils.createRipple(button, {
        color: 'rgba(98, 0, 234, 0.12)',
        duration: 400
      });
    }
  });

  // 为中心按钮添加涟漪效果
  const centerButton = document.getElementById("centerBtn");
  if (centerButton && window.AnimationUtils) {
    window.AnimationUtils.createRipple(centerButton, {
      color: 'rgba(255, 255, 255, 0.3)',
      duration: 800,
      centered: true
    });
  }
});

// 增强的tab切换动画
function updateActive(index) {
  navItems.forEach((item, i) => {
    const isActive = i === index;
    item.classList.toggle("active", isActive);
    
    // 添加切换动画
    if (isActive && window.AnimationUtils) {
      const button = item.querySelector('.icon');
      if (button) {
        // 添加微妙的弹性动画
        button.style.animation = 'none';
        button.offsetHeight; // 强制重排
        button.style.animation = 'pulseScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
      }
    }
  });

  // 增强的指示器动画
  indicator.style.transform = `translateX(${index * 100}%)`;
  activeIndex = index;

  // Emit a global event so external scripts (outside Shadow DOM) can react
  try {
    window.dispatchEvent(new CustomEvent('pageChanged', { detail: { index } }));
  } catch (_) {}

  // 页面切换动画
  if (window.AnimationUtils && content) {
    // 淡出当前内容
    window.AnimationUtils.fadeOut(content, 200).then(() => {
      loadPage(index);
      // 内容加载后淡入
      setTimeout(() => {
        window.AnimationUtils.fadeIn(content, 300);
      }, 100);
    });
  } else {
    loadPage(index);
  }
}

navItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    // 使用上下文标识防止与涟漪效果的震动重复
    hapticImpact("Light", { context: 'nav-tab', debounce: 150 });
    
    // 记录用户导航行为
    trackUserAction('navigation_click');
    
    updateActive(index);
  });
});

// Center action modal: loads add.html into the modal content and add.js for its logic
function openModal() {
  modal.style.display = "flex";
  modalContent.innerHTML =
    '<div style="text-align:center;padding:2em;">加载中...</div>';

  fetch("../../src/add.html")
    .then((res) => res.text())
    .then((html) => {
      modalContent.innerHTML = html;

      // 移除之前加载的 add.js 脚本（如果存在）
      const existingScript = document.querySelector('script[data-add-script]');
      if (existingScript) {
        existingScript.remove();
      }

      // 动态加载 add.js，每次都使用新的时间戳来避免缓存问题
      const script = document.createElement("script");
      script.src = "../../statics/js/add.js?t=" + Date.now();
      script.setAttribute("data-add-script", "true");

      // 在脚本加载完成后初始化页面
      script.onload = () => {
        console.log("index.js: add.js脚本加载完成，准备初始化");
        // 给一点额外时间确保DOM完全渲染
        setTimeout(() => {
          if (window.initAddPage) {
            window.initAddPage();
          } else {
            console.warn("index.js: initAddPage函数未找到");
          }
        }, 100);
      };

      modalContent.appendChild(script);
    })
    .catch(() => {
      modalContent.innerHTML =
        "<p style='text-align:center;'>⚠️ 无法加载内容</p>";
    });
}

// Close modal with a small exit animation; cleanup DOM after animation ends
function closeModal() {
  modalContent.classList.add("closing");
  modalContent.addEventListener("animationend", function handler() {
    modal.style.display = "none";
    modalContent.classList.remove("closing");
    modalContent.innerHTML = "";

    // 清理 add.js 中的全局状态（在移除脚本之前）
    if (window.cleanupAddPage && typeof window.cleanupAddPage === 'function') {
      try {
        window.cleanupAddPage();
      } catch (error) {
        console.warn("清理add.js状态时出错:", error);
      }
    }

    // 清理可能残留的 add.js 脚本
    const existingScript = document.querySelector('script[data-add-script]');
    if (existingScript) {
      existingScript.remove();
    }

    modalContent.removeEventListener("animationend", handler);
  });
}

// Toggle the center action modal and animate the FAB rotation
centerBtn.addEventListener("click", () => {
  // 改为直接跳转到选项页面
  try { hapticImpact("Medium"); } catch(_) {}
  
  // 记录用户重要操作
  trackUserAction('center_button_click');
  
  // 使用URL工具函数跳转到选项页面
  window.navigateTo("src/options.html");
});

// Click outside (backdrop) closes the modal
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal();
    centerBtn.classList.remove("pulse");
    hapticImpact("Light");
  }
});

// Boot the default tab once the shell is ready
document.addEventListener("DOMContentLoaded", () => {
  setNavHeightVar();
  // Ensure status bar does not overlay the webview in native runtime
  if (isNative) {
    applyStatusBarTheme();
    // react to theme changes
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', applyStatusBarTheme);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(applyStatusBarTheme);
      }
    }
  }
  updateActive(0);
});
