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

// Haptics helper (only active in Capacitor native runtime)
const isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
function getHaptics() {
  const C = window.Capacitor || {};
  return (C.Plugins && C.Plugins.Haptics) || window.Haptics || C.Haptics || null;
}
function hapticImpact(style) {
  if (!isNative) return;
  const h = getHaptics();
  if (!h) return;
  try {
    h.impact && h.impact({ style });
  } catch (e) {
    // no-op in web or if plugin not available
  }
}

// Expose haptics globally for subpages
window.__hapticImpact__ = hapticImpact;

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
  "../../src/case.html",
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
 * - Append an icon-font fix so Material Icons / Symbols and iconfont render inside the Shadow DOM
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
    .material-icons,
    .material-icons-outlined {
      font-family: "Material Icons Outlined", "Material Icons" !important;
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      display: inline-block;
      text-transform: none;
      letter-spacing: normal;
      white-space: nowrap;
      direction: ltr;
      -webkit-font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
    }
    .material-symbols-rounded,
    .material-symbols-outlined {
      font-family: "Material Symbols Rounded", "Material Symbols Outlined" !important;
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      display: inline-block;
      text-transform: none;
      letter-spacing: normal;
      white-space: nowrap;
      direction: ltr;
      -webkit-font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
      font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    }
    .iconfont { font-family: "iconfont" !important; font-style: normal; font-weight: normal; }
  `;
  shadow.appendChild(fix);
}

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
        "../../statics/js/case.js",
        "../../statics/js/square.js",
        "../../statics/js/me.js",
      ];

      if (scriptMap[index]) {
        // Remove old script tag for this page (if any)
        const oldScript = document.querySelector(
          `script[data-page-script="${scriptMap[index]}"]`
        );
        if (oldScript) oldScript.remove();

        const script = document.createElement("script");
        script.src = `${scriptMap[index]}?t=${Date.now()}`; // avoid cached non-execution
        script.setAttribute("data-page-script", scriptMap[index]);
        script.onload = () => {
          // Call page init with the ShadowRoot so code scopes to its own DOM
          const initName = scriptMap[index].split("/").pop().replace(".js", ""); // daily / case / ...
          const cap = initName.charAt(0).toUpperCase() + initName.slice(1);
          const initFn = window[`init${cap}`];
          const destroyFn = window[`destroy${cap}`];
          if (typeof destroyFn === "function") currentDestroy = destroyFn;
          if (typeof initFn === "function") initFn(currentShadowRoot);
        };
        document.body.appendChild(script);

        console.log("📦 动态加载脚本:", scriptMap[index]);
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

// Lightweight ripple effect for nav icons (mousedown/touchstart)
document.querySelectorAll(".nav-item").forEach((item) => {
  ["mousedown", "touchstart"].forEach((evt) => {
    item.addEventListener(evt, function (e) {
      const targetButton = item.querySelector(".icon");
      if (!targetButton) return;
      const circle = document.createElement("span");
      circle.classList.add("ripple-effect");
      circle.style.position = "absolute";
      circle.style.pointerEvents = "none";
      const rect = targetButton.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      circle.style.width = circle.style.height = size + "px";
      circle.style.left = e.clientX - rect.left - size / 2 + "px";
      circle.style.top = e.clientY - rect.top - size / 2 + "px";
      const existing = targetButton.querySelector(".ripple-effect");
      if (existing) existing.remove();
      targetButton.appendChild(circle);
    });
  });
});

// Update active tab UI and trigger page load
function updateActive(index) {
  navItems.forEach((item, i) => {
    item.classList.toggle("active", i === index);
  });

  indicator.style.transform = `translateX(${index * 100}%)`;
  activeIndex = index;

  loadPage(index);
}

navItems.forEach((item, index) => {
  item.addEventListener("click", () => {
    hapticImpact("Light");
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
  const isOpen = modal.style.display === "flex";

  if (isOpen) {
    closeModal();
    centerBtn.classList.remove("rotate");
  } else {
    openModal();
    centerBtn.classList.add("rotate");
  }
  hapticImpact("Medium");
});

// Click outside (backdrop) closes the modal
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal();
    centerBtn.classList.remove("rotate");
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
