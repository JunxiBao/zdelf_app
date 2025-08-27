/**
 * Register page script — organized & documented
 * 注册页脚本（整理 + 注释 + 轻量健壮性增强）
 * - iOS/WKWebView viewport fix (safe reflow)
 * - Global loading overlay (light/dark aware, injected once)
 * - Popup/toast helper (fallback to alert)
 * - Form validation (username/password/confirm/age)
 * - Register request via async/await
 * - Password visibility toggle
 * - Mainland China SMS code utilities (send + countdown)
 */
(function () {
  "use strict";

  /* =============================
   * 1) Viewport & scroll handling
   * ============================= */
  var docEl = document.documentElement;
  var vwRAF = null;
  function setVH() {
    if (vwRAF) cancelAnimationFrame(vwRAF);
    vwRAF = requestAnimationFrame(function () {
      var h =
        (window.visualViewport && window.visualViewport.height) ||
        window.innerHeight ||
        0;
      docEl.style.setProperty("--vh", h + "px");
    });
  }
  window.__setVH = setVH; // expose for blur handlers
  setVH();
  window.addEventListener("resize", setVH);
  window.addEventListener("orientationchange", setVH);
  window.addEventListener("pageshow", setVH);
  if (window.visualViewport) {
    visualViewport.addEventListener("resize", setVH);
    visualViewport.addEventListener("scroll", setVH);
  }
  // Prevent page vertical scroll; allow interactions inside card
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
   * 2) Loading overlay (ensure once)
   * ============================= */
  var loadingOverlay = document.getElementById("loading-overlay");
  if (!loadingOverlay) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loading-overlay";
    loadingOverlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(loadingOverlay);
  }
  (function ensureStyle() {
    var id = "register-runtime-style";
    if (document.getElementById(id)) return;
    var style = document.createElement("style");
    style.id = id;
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
   * 3) Popup / toast helper
   * ============================= */
  var popup = document.getElementById("popup");
  var popupText = document.getElementById("popupText");
  function showPopup(message, time) {
    if (time === void 0) time = 2000;
    if (!popup || !popupText) {
      alert(message);
      return;
    }
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
  var PASS_RE =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]{8,20}$/;
  function isValidUsername(v) {
    return !!v && v.length <= USERNAME_MAX;
  }
  function isValidPassword(v) {
    return PASS_RE.test(v);
  }
  function isValidAge(v) {
    var n = Number((v || "").trim());
    return Number.isInteger(n) && n >= 1 && n <= 120;
  }

  // Mainland China phone only: allow optional +86/86, segments 13-19, 11 digits
  function isValidCNPhone(v) {
    var raw = (v || "").trim().replace(/\s|-/g, "");
    var num = raw;
    if (raw.startsWith("+86")) num = raw.slice(3);
    else if (raw.startsWith("86")) num = raw.slice(2);
    return /^1[3-9]\d{9}$/.test(num);
  }
  function toE164CN(v) {
    var raw = (v || "").trim().replace(/\s|-/g, "");
    if (raw.startsWith("+86")) return raw;
    if (raw.startsWith("86")) return "+" + raw;
    return "+86" + raw;
  }

  /* =============================
   * 5) DOM ready wiring
   * ============================= */
  document.addEventListener("DOMContentLoaded", function () {
    // After input blur, update viewport in case keyboard collapsed
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

    // Register button
    var registerBtn = document.getElementById("registerBtn");
    if (registerBtn) registerBtn.addEventListener("click", handleRegister);

    // Password toggles
    bindPasswordToggles();

    // SMS code (if present on page)
    bindSMS();
  });

  /* =============================
   * 6) Register handler
   * ============================= */
  // 同源请求，交给 Nginx 反代；如需覆盖，可提前设置 window.__API_BASE__
  var API_BASE = "";
  if (typeof window !== "undefined" && window.__API_BASE__) {
    API_BASE = window.__API_BASE__;
  }
  // Normalize API_BASE to avoid double slashes
  if (API_BASE && API_BASE.endsWith("/")) {
    API_BASE = API_BASE.slice(0, -1);
  }
  var SMS_SEND_ENDPOINT = API_BASE + "/sms/send";
  var SMS_VERIFY_ENDPOINT = API_BASE + "/sms/verify";
  var REGISTER_ENDPOINT = API_BASE + "/account/register";
  async function handleRegister() {
    var usernameEl = document.getElementById("username");
    var passwordEl = document.getElementById("password");
    var confirmEl = document.getElementById("confirmPassword");
    var ageEl = document.getElementById("age");
    var phoneEl = document.getElementById("phoneReg");
    var codeEl = document.getElementById("smsCodeReg");

    var username = ((usernameEl && usernameEl.value) || "").trim();
    var password = (passwordEl && passwordEl.value) || "";
    var confirm = (confirmEl && confirmEl.value) || "";
    var age = ((ageEl && ageEl.value) || "").trim();
    var phoneRaw = ((phoneEl && phoneEl.value) || "").trim();
    var code = ((codeEl && codeEl.value) || "").trim();

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
    if (password !== confirm) {
      showPopup("两次输入的密码不一致");
      return;
    }
    if (!isValidAge(age)) {
      showPopup("年龄必须是1-120之间的整数");
      return;
    }
    if (!isValidCNPhone(phoneRaw)) {
      showPopup("请填写有效的中国大陆手机号");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      showPopup("请输入 6 位短信验证码");
      return;
    }

    var phoneE164 = toE164CN(phoneRaw);

    showLoading();
    try {
      // 1) 先校验短信验证码
      var vRes = await fetch(SMS_VERIFY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164, code: code }),
      });
      var vData = {};
      try {
        vData = await vRes.json();
      } catch (_) {
        vData = {};
      }
      if (!vRes.ok || !vData || !vData.success) {
        hideLoading();
        showPopup(
          "验证码校验失败：" +
            (vData && vData.message
              ? vData.message
              : vRes.status + " " + vRes.statusText)
        );
        return;
      }
      // 可选：保存后端返回的 token（若有）
      if (vData.token) {
        try {
          localStorage.setItem("token", vData.token);
        } catch (_) {}
      }

      // 2) 再完成账号注册（把用户名/密码/年龄入库）
      var rRes = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          password: password,
          age: age,
          phone: phoneE164,
        }),
      });
      var rData = {};
      try {
        rData = await rRes.json();
      } catch (_) {
        rData = {};
      }

      if (rRes.ok && rData && rData.success) {
        showPopup("注册成功！");
        setTimeout(function () {
          window.location.href = "login.html";
          hideLoading();
        }, 1500);
      } else {
        hideLoading();
        showPopup(
          "注册失败: " +
            (rData && rData.message
              ? rData.message
              : rRes.status + " " + rRes.statusText)
        );
      }
    } catch (err) {
      hideLoading();
      showPopup("网络错误: " + (err && err.message ? err.message : err));
    }
  }

  /* =============================
   * 7) Password visibility toggles
   * ============================= */
  function bindPasswordToggles() {
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
  }

  /* =============================
   * 8) SMS code binding (China only)
   * ============================= */
  function bindSMS() {
    var phone = document.getElementById("phoneReg");
    var code = document.getElementById("smsCodeReg");
    var sendBtn = document.getElementById("sendCodeBtnReg");
    if (!phone || !code || !sendBtn) return; // not on this page

    var ticking = false;
    var remain = 60;
    var timer = null;

    function setSendState(disabled) {
      sendBtn.disabled = disabled;
      sendBtn.textContent = disabled
        ? "重新发送 (" + remain + "s)"
        : "获取验证码";
    }
    function startCountdown() {
      ticking = true;
      remain = 60;
      setSendState(true);
      timer = setInterval(function () {
        remain -= 1;
        if (remain <= 0) {
          clearInterval(timer);
          ticking = false;
          setSendState(false);
        } else {
          setSendState(true);
        }
      }, 1000);
    }

    sendBtn.addEventListener("click", async function () {
      var v = (phone.value || "").trim();
      if (!isValidCNPhone(v)) {
        showPopup("请填写有效的中国大陆手机号");
        return;
      }

      // micro interaction
      sendBtn.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(0.96)" },
          { transform: "scale(1)" },
        ],
        { duration: 140, easing: "ease-out" }
      );

      var normalized = toE164CN(v);

      // 调用后端发送验证码接口
      try {
        sendBtn.disabled = true;
        sendBtn.classList.add("loading");
        var res = await fetch(SMS_SEND_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalized }),
        });
        var data = {};
        try {
          data = await res.json();
        } catch (_) {
          data = {};
        }
        if (!res.ok || !data || !data.success) {
          var msg =
            data && data.message
              ? data.message
              : res.status + " " + res.statusText;
          showPopup("发送失败：" + msg);
          sendBtn.disabled = false;
          sendBtn.classList.remove("loading");
          return;
        }
        showPopup("验证码已发送");
        sendBtn.classList.remove("loading");
        if (!ticking) startCountdown();
      } catch (e) {
        showPopup("网络错误：" + (e && e.message ? e.message : e));
        sendBtn.disabled = false;
        sendBtn.classList.remove("loading");
      }
    });
  }

  // Initialize hidden overlay
  hideLoading();
})();
