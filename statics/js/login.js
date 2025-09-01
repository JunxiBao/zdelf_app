(function () {
  "use strict";

  // Lightweight haptics bridge for standalone page (only if not already provided)
  try {
    if (!window.__hapticImpact__) {
      var isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
      function getHaptics() {
        var C = window.Capacitor || {};
        return (C.Plugins && C.Plugins.Haptics) || window.Haptics || C.Haptics || null;
      }
      window.__hapticImpact__ = function(style){
        if (!isNative) return;
        var h = getHaptics();
        if (!h) return;
        try { h.impact && h.impact({ style: style }); } catch(_) {}
      };
    }
  } catch(_) {}

  /* =============================
   * 1) Viewport & scroll handling
   * ============================= */
  var docEl = document.documentElement;
  var vwRAF = null;

  function setVH() {
    // Throttle to next frame to avoid layout thrash
    if (vwRAF) cancelAnimationFrame(vwRAF);
    vwRAF = requestAnimationFrame(function () {
      var h =
        (window.visualViewport && window.visualViewport.height) ||
        window.innerHeight ||
        0;
      docEl.style.setProperty("--vh", h + "px");
    });
  }
  // expose so other handlers can call it after blur
  window.__setVH = setVH;

  setVH();
  window.addEventListener("resize", setVH);
  window.addEventListener("orientationchange", setVH);
  window.addEventListener("pageshow", setVH);
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", setVH);
    visualViewport.addEventListener("scroll", setVH);
  }

  // Prevent page vertical scroll; allow interactions inside card
  // 禁止页面上下滚动（卡片内允许交互/滚动）
  document.addEventListener(
    "touchmove",
    function (e) {
      if (e.target && e.target.closest && e.target.closest(".record-container"))
        return;
      e.preventDefault();
    },
    { passive: false }
  );

  /* =============================
   * 2) Loading overlay (once)
   * ============================= */
  var loadingOverlay = document.getElementById("loading-overlay");
  if (!loadingOverlay) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loading-overlay";
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingOverlay);
  }

  // Inject styles if absent
  (function ensureStyle() {
    var styleId = "login-runtime-style";
    if (document.getElementById(styleId)) return;
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
#loading-overlay{position:fixed;inset:0;width:100%;height:100%;background:rgba(255,255,255,0.8);z-index:9999;display:none;align-items:center;justify-content:center;transition:background .3s ease}
@media (prefers-color-scheme: dark){#loading-overlay{background:rgba(0,0,0,0.6)}.spinner{border:6px solid #444;border-top-color:#b197fc}}
.spinner{width:50px;height:50px;border:6px solid #ccc;border-top-color:#7b2cbf;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(style);
  })();

  function showLoading() {
    loadingOverlay.style.display = "flex";
  }
  function hideLoading() {
    loadingOverlay.style.display = "none";
  }

  /* =============================
   * 3) Toast / popup helper
   * ============================= */
  var popup = document.getElementById("popup");
  var popupText = document.getElementById("popupText");
  function showPopup(message, time) {
    if (time === void 0) time = 2000;
    if (!popup || !popupText) {
      alert(message);
      return;
    }
    try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
    popupText.textContent = message;
    popup.classList.add("show");
    setTimeout(function () {
      popup.classList.remove("show");
    }, time);
  }

  /* =============================
   * 4) Validation helpers
   * ============================= */
  var USERNAME_MAX = 20;
  function isValidUsername(v) {
    return !!v && v.length <= USERNAME_MAX;
  }
  // 8–20 chars; at least 1 lower, 1 upper, 1 digit; allows most punctuation
  var PASS_RE =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]{8,20}$/;
  function isValidPassword(v) {
    return PASS_RE.test(v);
  }

  /* =============================
   * 5) DOM ready wiring
   * ============================= */
  document.addEventListener("DOMContentLoaded", function () {
    // After input blur, update viewport in case keyboard collapsed
    // 输入框收起键盘后，延迟刷新高度，避免卡片停在下方
    var allInputs = document.querySelectorAll("input, textarea");
    allInputs.forEach(function (el) {
      el.addEventListener(
        "blur",
        function () {
          setTimeout(function () {
            window.__setVH && window.__setVH();
          }, 60);
        },
        true
      );
    });

    var loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
      loginBtn.addEventListener("click", function(){ try { window.__hapticImpact__ && window.__hapticImpact__('Medium'); } catch(_) {} });
      loginBtn.addEventListener("click", handleLogin);
    }
  });

  /* =============================
   * 6) Login handler (async/await)
   * ============================= */
  var API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "https://app.zdelf.cn";
  if (API_BASE && API_BASE.endsWith("/")) {
    API_BASE = API_BASE.slice(0, -1);
  }
  var LOGIN_ENDPOINT = API_BASE + "/login";
  async function handleLogin() {
    var usernameEl = document.getElementById("username");
    var passwordEl = document.getElementById("password");
    if (!usernameEl || !passwordEl) return;

    var username = (usernameEl.value || "").trim();
    var password = passwordEl.value || "";

    if (!isValidUsername(username)) {
      showPopup("用户名不能为空且不超过20位");
      return;
    }
    if (!isValidPassword(password)) {
      showPopup(
        "密码必须为8到20位，包含大写字母、小写字母和数字，一些特殊字符不能包括"
      );
      return;
    }

    showLoading();
    try {
      var res = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password }),
      });
      var data = {};
      try {
        data = await res.json();
      } catch (_) {
        data = {};
      }

      if (res.ok && data && data.success) {
        hideLoading();
        try {
          localStorage.setItem("userId", data.userId);
        } catch (_) {}
        window.location.href = "../index.html";
      } else {
        hideLoading();
        showPopup("用户名或密码错误");
      }
    } catch (err) {
      hideLoading();
      console.error(err);
      showPopup("服务器连接失败");
    }
  }

  /* =============================
   * 7) Password visibility toggles
   * ============================= */
  (function bindPasswordToggles() {
    var buttons = document.querySelectorAll(".toggle-password");
    buttons.forEach(function (btn) {
      var targetId = btn.getAttribute("data-target");
      var input = document.getElementById(targetId);
      if (!input) return;
      var eye = btn.querySelector(".eye");
      var eyeOff = btn.querySelector(".eye-off");
      function setState(show) {
        input.setAttribute("type", show ? "text" : "password");
        btn.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
        btn.setAttribute("title", show ? "隐藏密码" : "显示密码");
        if (eye) {
          eye.classList.toggle("visible", !show);
          eye.classList.toggle("hidden", show);
        }
        if (eyeOff) {
          eyeOff.classList.toggle("visible", show);
          eyeOff.classList.toggle("hidden", !show);
        }
      }
      btn.addEventListener("click", function () {
        try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
        var show = input.getAttribute("type") === "password";
        var icon = show ? eyeOff : eye;
        if (icon && icon.animate) {
          icon.animate(
            [
              { transform: "scale(0.96)", opacity: 0.8 },
              { transform: "scale(1.06)", opacity: 1 },
              { transform: "scale(1)", opacity: 1 },
            ],
            { duration: 160, easing: "ease-out" }
          );
        }
        setState(show);
      });
      setState(false);
    });
  })();

  // Initialize hidden overlay
  hideLoading();
})();
