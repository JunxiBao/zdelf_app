/**
 * index.js — App shell controller for Health app
 *
 * Responsibilities
 * - Bottom navbar interactions (active state, indicator, ripple)
 * - Page loader: fetches subpage HTML and mounts it in a Shadow DOM sandbox
 * - Lifecycle: calls page-specific init/destroy (e.g., initDaily/destroyDaily)
 * - Modal open/close and dynamic content for the center button
 *
 * Why Shadow DOM?
 * - Prevents subpage CSS from leaking to the global shell (e.g., bottom nav icons)
 * - Each page can ship its own <style>/<link> safely; we inject them into the shadow root
 */

// Root elements for the shell UI (outside Shadow DOM)
const navItems = document.querySelectorAll(".nav-item");
const indicator = document.getElementById("indicator");
const centerBtn = document.getElementById("centerBtn");
const content = document.getElementById("content");
const modal = document.getElementById("modal");
const modalContent = document.getElementById("modalContent");

// Mapping of tab index -> subpage path (HTML fragments or full HTML docs)
const pageMap = [
  "../../src/daily.html",
  "../../src/case.html",
  "../../src/square.html",
  "../../src/me.html"
];

// Current active tab index for the bottom navbar
let activeIndex = 0;

// Track current page's destroy hook and shadow root so we can clean up on navigation
let currentDestroy = null;
let currentShadowRoot = null;

/**
 * Inject <style> and page-scoped stylesheets into the ShadowRoot.
 *
 * @param {Document} doc    Parsed HTML document returned by fetch
 * @param {ShadowRoot} shadow Shadow root hosting the subpage
 *
 * Behavior:
 * - Clones all inline <style> blocks from the subpage
 * - Clones <link rel="stylesheet"> except for global assets already loaded in the host
 * - Ensures base.css exists inside the ShadowRoot (for cards/shadows/utility tokens)
 * - Appends an icon-font fix so Material Icons / Symbols and iconfont render in Shadow DOM
 */
function injectPageStyles(doc, shadow) {
  // Copy <style> from <head> and <body>
  doc.querySelectorAll('style').forEach(styleEl => {
    shadow.appendChild(styleEl.cloneNode(true));
  });
  // Styles we intentionally DO NOT duplicate into the shadow (they live in host <head>)
  const globalHrefs = new Set([
    new URL('../../statics/iconfont/iconfont.css', location.href).href,
    new URL('../../statics/css/nav.css', location.href).href,
  ]);
  doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = new URL(link.getAttribute('href'), location.href).href;
    if (globalHrefs.has(href)) return; // skip globals
    const clone = link.cloneNode(true);
    shadow.appendChild(clone);
  });
  // Ensure base.css is available inside ShadowRoot so card shadows and utilities work
  const baseHref = new URL('../../statics/css/base.css', location.href).href;
  const hasBase = [...shadow.querySelectorAll('link[rel="stylesheet"]')].some(l => new URL(l.getAttribute('href'), location.href).href === baseHref);
  if (!hasBase) {
    const baseLink = document.createElement('link');
    baseLink.rel = 'stylesheet';
    baseLink.href = baseHref;
    shadow.appendChild(baseLink);
  }
  // Font fix: Shadow DOM isolates styles, so ensure icon ligatures resolve inside the page
  const fix = document.createElement('style');
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
 * Steps:
 * 1) Run previous page's destroy hook (if any)
 * 2) Fetch subpage HTML and parse via DOMParser
 * 3) Create a ShadowRoot and write the body HTML
 * 4) Inject the subpage's styles (and base.css) into the shadow
 * 5) Load the page script (daily/case/square/me) with cache-busting
 * 6) Call initX(shadowRoot); retain destroyX for when we navigate away
 */
function loadPage(index) {
  // run previous page teardown if available
  if (typeof currentDestroy === "function") {
    try { currentDestroy(); } catch (e) { console.warn(e); }
    currentDestroy = null;
  }

  fetch(pageMap[index])
    .then(res => res.text())
    .then(html => {
      // Parse the incoming document and take only the <body> content
      const doc = new DOMParser().parseFromString(html, "text/html");
      const bodyHTML = doc.body ? doc.body.innerHTML : html;

      // Create a host element and attach Shadow DOM to sandbox styles/scripts
      const host = document.createElement("div");
      host.className = "page-host";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = bodyHTML;

      injectPageStyles(doc, shadow);

      // Mount the new page (replace previous content entirely)
      content.replaceChildren(host);
      currentShadowRoot = shadow;

      // Dynamically load the corresponding JavaScript file with cache-busting
      const scriptMap = [
        "../../statics/js/daily.js",
        "../../statics/js/case.js",
        "../../statics/js/square.js",
        "../../statics/js/me.js"
      ];

      if (scriptMap[index]) {
        // Remove old script tag for this page (if any)
        const oldScript = document.querySelector(`script[data-page-script="${scriptMap[index]}"]`);
        if (oldScript) oldScript.remove();

        const script = document.createElement("script");
        script.src = `${scriptMap[index]}?t=${Date.now()}`; // avoid cached non-execution
        script.setAttribute("data-page-script", scriptMap[index]);
        script.onload = () => {
          // Call lifecycle init with the ShadowRoot so page code scopes to its own DOM
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
    .catch(err => {
      // fallback UI
      content.innerHTML = "<p style='padding: 2em; text-align:center;'>⚠️ 页面加载失败</p>";
      console.error("加载页面出错:", err);
      currentShadowRoot = null;
    });
}

// Lightweight ripple effect for nav icons (mousedown/touchstart)
document.querySelectorAll('.nav-item').forEach(item => {
  ['mousedown', 'touchstart'].forEach(evt => {
    item.addEventListener(evt, function (e) {
      const targetButton = item.querySelector('.icon');
      if (!targetButton) return;
      const circle = document.createElement('span');
      circle.classList.add('ripple-effect');
      circle.style.position = 'absolute';
      circle.style.pointerEvents = 'none';
      const rect = targetButton.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      circle.style.width = circle.style.height = size + 'px';
      circle.style.left = e.clientX - rect.left - size / 2 + 'px';
      circle.style.top = e.clientY - rect.top - size / 2 + 'px';
      const existing = targetButton.querySelector('.ripple-effect');
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
    updateActive(index);
  });
});

// Center action modal: loads add.html into the modal content and add.js for its logic
function openModal() {
  modal.style.display = "flex";
  modalContent.innerHTML = '<div style="text-align:center;padding:2em;">加载中...</div>';

  fetch("../../src/add.html")
    .then(res => res.text())
    .then(html => {
      modalContent.innerHTML = html;
      // 动态加载 add.js
      const script = document.createElement("script");
      script.src = "../../statics/js/add.js";
      modalContent.appendChild(script);
    })
    .catch(() => {
      modalContent.innerHTML = "<p style='text-align:center;'>⚠️ 无法加载内容</p>";
    });
}

// Close modal with a small exit animation; cleanup DOM after animation ends
function closeModal() {
  modalContent.classList.add("closing");
  modalContent.addEventListener("animationend", function handler() {
    modal.style.display = "none";
    modalContent.classList.remove("closing");
    modalContent.innerHTML = "";
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
});

// Click outside (backdrop) closes the modal
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    closeModal();
    centerBtn.classList.remove("rotate");
  }
});

// Boot the default tab after the shell is ready
document.addEventListener("DOMContentLoaded", () => {
  updateActive(0);
});