!(function () {
  console.debug("[edit] edit.js evaluated");
  let e = [],
    Capacitor = null;
  try {
    ((Capacitor = window.Capacitor),
      Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications
        ? console.log("✅ [edit] Capacitor LocalNotifications 插件已加载")
        : console.warn(
            "⚠️ [edit] Capacitor LocalNotifications 插件未找到",
          ));
  } catch (e) {
    console.warn("⚠️ [edit] 无法加载Capacitor插件:", e);
  }
  function o(e = "Light", t = {}) {
    try {
      window.HapticManager
        ? window.HapticManager.impact(e, {
            context: "edit-page",
            debounce: 100,
            ...t,
          })
        : window.__hapticImpact__ && window.__hapticImpact__(e);
    } catch (e) {
      console.warn("震动反馈失败:", e);
    }
  }
  function i(e) {
    const t = e.currentTarget;
    o("Light");
    const n = t.getBoundingClientRect(),
      a = document.createElement("span"),
      i = Math.max(n.width, n.height);
    ((a.className = "ripple"), (a.style.width = a.style.height = i + "px"));
    const s = (e.clientX || n.left + n.width / 2) - n.left - i / 2,
      r = (e.clientY || n.top + n.height / 2) - n.top - i / 2;
    ((a.style.left = s + "px"),
      (a.style.top = r + "px"),
      t.appendChild(a),
      setTimeout(() => {
        a.parentNode && a.remove();
      }, 600));
  }
  function d(e, t = "出错了") {
    window.ModalManager
      ? window.ModalManager.alert(e, { title: t })
      : alert(e);
  }
  function m(e, t = "已保存") {
    window.ModalManager
      ? window.ModalManager.alert(e, { title: t, confirmType: "primary" })
      : alert(e);
  }
  // Validation helpers - same as register.js
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
    // Same validation logic as register.js, but allow empty for editing
    // If empty, return true (can be cleared in edit mode)
    if (!v || (typeof v === "string" && v.trim() === "")) return true;
    // Same validation as register: must be integer, but range is 0-120 (not 1-120)
    var n = Number((v || "").trim());
    return Number.isInteger(n) && n >= 0 && n <= 120;
  }
  // Convert date string to YYYY-MM-DD format for date input
  function formatDateForInput(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return "";
    var trimmed = dateStr.trim();
    if (!trimmed) return "";
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    // Try to parse common date formats
    // Format like "12月1日" or "2024年12月1日"
    var match = trimmed.match(/(\d{4})?年?(\d{1,2})月(\d{1,2})日?/);
    if (match) {
      var year = match[1] || new Date().getFullYear();
      var month = String(match[2]).padStart(2, "0");
      var day = String(match[3]).padStart(2, "0");
      return year + "-" + month + "-" + day;
    }
    // Try to parse as Date object
    var date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      var y = date.getFullYear();
      var m = String(date.getMonth() + 1).padStart(2, "0");
      var d = String(date.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + d;
    }
    // If cannot parse, return empty
    return "";
  }
  (console.debug("[edit] exposing lifecycle: initEdit/destroyEdit"),
    (window.initEdit = function (t) {
      const c = t || document;
      console.log("[edit] ========== initEdit初始化开始 ==========");
      const u = c.querySelector("#backBtn"),
        p = c.querySelector("#saveBtn"),
        g = c.querySelector("#phoneDisplay"),
        h = c.querySelector("#nameInput"),
        f = c.querySelector("#genderSelect"),
        y = c.querySelector("#ageInput"),
        w = c.querySelector("#regionInput"),
        v = c.querySelector("#occupationInput"),
        b = c.querySelector("#purpuraTypeInput"),
        x = c.querySelector("#firstOnsetInput"),
        j = c.querySelector("#passwordDisplayItem"),
        F = c.querySelector("#passwordDisplay");
      const k =
        (("undefined" != typeof window && window.__API_BASE__) ||
          "https://app.zdelf.cn")
          .trim()
          .replace(/\/$/, "") || "https://app.zdelf.cn";
      const S =
        localStorage.getItem("userId") ||
        sessionStorage.getItem("userId") ||
        localStorage.getItem("UserID") ||
        sessionStorage.getItem("UserID");
      const _ =
        localStorage.getItem("username") ||
        localStorage.getItem("Username") ||
        sessionStorage.getItem("username") ||
        sessionStorage.getItem("Username");
      console.log("[edit] 用户标识:", { userId: S, username: _ });
      if (!S && !_) {
        d("未找到用户ID/用户名，请先登录");
        return;
      }
      let originalData = {};
      async function E() {
        try {
          const e = S
              ? { table_name: "users", user_id: S }
              : { table_name: "users", username: _ };
          console.log("[edit] 加载用户数据:", e);
          const t = await fetch(k + "/readdata", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(e),
          });
          if (!t.ok) throw new Error(`HTTP ${t.status}: ${t.statusText}`);
          const n = await t.json();
          if (!n || !0 !== n.success || !Array.isArray(n.data) || 0 === n.data.length)
            return void d("无法从服务器读取资料");
          const o = n.data[0] || {};
          console.log("[edit] 用户数据:", o);
          originalData = {
            username: o.username || "",
            gender: o.gender || "",
            age: o.age || null,
            region: o.region || "",
            occupation: o.occupation || "",
            purpura_type: o.purpura_type || "",
            first_onset_time: o.first_onset_time || "",
          };
          const a = o.phone_number || o.phone || "无",
            r = originalData.username,
            l = originalData.gender,
            i = originalData.age,
            s = originalData.region,
            c = originalData.occupation,
            u = originalData.purpura_type,
            p = originalData.first_onset_time;
          if (
            (g && (g.textContent = a),
            h && (h.value = r),
            f && (f.value = l),
            y && (i ? (y.value = String(i)) : (y.value = "")),
            w && (w.value = s),
            v && (v.value = c),
            b && (b.value = u),
            x && (x.value = formatDateForInput(p)),
            console.log("[edit] 数据加载完成"))
          )
            return;
        } catch (e) {
          console.error("[edit] 加载用户数据失败:", e);
          d("加载用户数据失败，请稍后再试");
        }
      }
      E();
      // Show password change modal
      function showPasswordChangeModal() {
        try {
          console.log("[edit] 打开密码更改窗口");
          o("Light");
          // Prevent background scrolling
          const scrollY = window.scrollY;
          document.body.style.position = "fixed";
          document.body.style.top = `-${scrollY}px`;
          document.body.style.width = "100%";
          document.body.style.overflow = "hidden";
          // Create modal mask
          const mask = document.createElement("div");
          mask.className = "password-modal-mask";
          mask.style.cssText = `
          position: fixed;
          inset: 0;
          background: color-mix(in srgb, var(--text, #000) 20%, transparent);
          backdrop-filter: saturate(120%) blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.18s ease;
          z-index: 10000;
        `;
          // Create modal dialog
          const dialog = document.createElement("div");
          dialog.className = "password-modal-dialog";
          dialog.style.cssText = `
          width: min(92vw, 400px);
          background: var(--card, #fff);
          color: var(--text, #111);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          transform: translateY(12px) scale(0.98);
          opacity: 0;
          transition: transform 0.2s ease, opacity 0.2s ease;
          border: 1px solid var(--divider, rgba(0, 0, 0, 0.06));
          padding: 20px;
        `;
          dialog.innerHTML = `
          <div style="font-weight: 600; font-size: 18px; margin-bottom: 20px;">更改密码</div>
          <div style="margin-bottom: 16px;">
            <div style="font-size: 14px; color: var(--text-secondary, #666); margin-bottom: 8px;">新密码</div>
            <div style="position: relative;">
              <input
                type="password"
                id="modalNewPassword"
                placeholder="8-20位，含大小写、数字，可含符号"
                autocomplete="new-password"
                style="width: 100%; padding: 10px 44px 10px 12px; border: 1px solid var(--divider, rgba(0, 0, 0, 0.1)); border-radius: 12px; background: var(--surface, #fff); color: var(--text, #111); font-size: 14px; outline: none; box-sizing: border-box; text-align: left !important; direction: ltr !important; font-family: inherit;"
              />
              <button
                type="button"
                class="toggle-password-modal"
                data-target="modalNewPassword"
                style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 6px; opacity: 0.8; z-index: 10; pointer-events: auto;"
              >
                <svg class="icon eye icon-visible visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; display: block;">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg class="icon eye-off icon-hidden hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; display: none;">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
                  <path d="M1 1l22 22" />
                  <path d="M9.9 4.24A10.93 10.93 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-3.87 5.19" />
                  <path d="M14.12 14.12A3 3 0 0 1 12 15a3 3 0 0 1-3-3 3 3 0 0 1 .88-2.12" />
                </svg>
              </button>
            </div>
          </div>
          <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; color: var(--text-secondary, #666); margin-bottom: 8px;">确认密码</div>
            <div style="position: relative;">
              <input
                type="password"
                id="modalConfirmPassword"
                placeholder="请再次输入密码"
                autocomplete="new-password"
                style="width: 100%; padding: 10px 44px 10px 12px; border: 1px solid var(--divider, rgba(0, 0, 0, 0.1)); border-radius: 12px; background: var(--surface, #fff); color: var(--text, #111); font-size: 14px; outline: none; box-sizing: border-box; text-align: left !important; direction: ltr !important; font-family: inherit;"
              />
              <button
                type="button"
                class="toggle-password-modal"
                data-target="modalConfirmPassword"
                style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; border: none; cursor: pointer; padding: 6px; opacity: 0.8; z-index: 10; pointer-events: auto;"
              >
                <svg class="icon eye icon-visible visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; display: block;">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <svg class="icon eye-off icon-hidden hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; display: none;">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
                  <path d="M1 1l22 22" />
                  <path d="M9.9 4.24A10.93 10.93 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-3.87 5.19" />
                  <path d="M14.12 14.12A3 3 0 0 1 12 15a3 3 0 0 1-3-3 3 3 0 0 1 .88-2.12" />
                </svg>
              </button>
            </div>
          </div>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button
              class="btn-ghost"
              id="modalCancelBtn"
              style="appearance: none; border: 0; padding: 9px 14px; border-radius: 12px; cursor: pointer; font-size: 14px; background: var(--surface, rgba(0, 0, 0, 0.04)); color: var(--text, #111);"
            >取消</button>
            <button
              class="btn-primary"
              id="modalSaveBtn"
              style="appearance: none; border: 0; padding: 9px 14px; border-radius: 12px; cursor: pointer; font-size: 14px; background: var(--brand, #1a73e8); color: #fff;"
            >保存</button>
          </div>
        `;
          mask.appendChild(dialog);
          document.body.appendChild(mask);
          // Immediately set styles for password inputs - must do this BEFORE any other operations
          const modalPasswordInputs = dialog.querySelectorAll("#modalNewPassword, #modalConfirmPassword");
          modalPasswordInputs.forEach((input) => {
            // Remove any classes that might affect alignment
            input.className = "";
            // Force left alignment with multiple methods
            input.style.cssText += "text-align: left !important; direction: ltr !important;";
            input.setAttribute("style", input.getAttribute("style") + " text-align: left !important; direction: ltr !important;");
            // Set via setProperty for maximum priority
            input.style.setProperty("text-align", "left", "important");
            input.style.setProperty("direction", "ltr", "important");
            // Also set for placeholder
            const style = document.createElement("style");
            style.id = `style-${input.id}`;
            style.textContent = `
              #${input.id} {
                text-align: left !important;
                direction: ltr !important;
              }
              #${input.id}::placeholder {
                text-align: left !important;
                direction: ltr !important;
              }
            `;
            document.head.appendChild(style);
          });
          // Add global style tag to ensure modal password inputs are left-aligned
          let globalModalStyle = document.getElementById("modal-password-input-style");
          if (!globalModalStyle) {
            globalModalStyle = document.createElement("style");
            globalModalStyle.id = "modal-password-input-style";
            globalModalStyle.textContent = `
              #modalNewPassword,
              #modalConfirmPassword {
                text-align: left !important;
                direction: ltr !important;
              }
              #modalNewPassword::placeholder,
              #modalConfirmPassword::placeholder {
                text-align: left !important;
                direction: ltr !important;
              }
            `;
            document.head.appendChild(globalModalStyle);
          }
          // Bind password toggles in modal - must be done before animation
          const toggleBtns = dialog.querySelectorAll(".toggle-password-modal");
          toggleBtns.forEach((btn) => {
            const targetId = btn.getAttribute("data-target");
            const input = dialog.querySelector("#" + targetId);
            if (!input) {
              console.warn("[edit] 未找到密码输入框:", targetId);
              return;
            }
            const eye = btn.querySelector(".eye");
            const eyeOff = btn.querySelector(".eye-off");
            if (!eye || !eyeOff) {
              console.warn("[edit] 未找到眼睛图标");
              return;
            }
            function setState(show) {
              input.setAttribute("type", show ? "text" : "password");
              // Ensure text alignment stays left
              input.style.textAlign = "left";
              input.style.direction = "ltr";
              input.style.setProperty("text-align", "left", "important");
              input.style.setProperty("direction", "ltr", "important");
              if (eye) {
                eye.style.display = show ? "none" : "block";
              }
              if (eyeOff) {
                eyeOff.style.display = show ? "block" : "none";
              }
            }
            btn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              o("Light");
              const show = input.getAttribute("type") === "password";
              setState(show);
            });
            setState(false);
          });
          // Double-check alignment after toggle setup
          const allModalInputs = dialog.querySelectorAll("#modalNewPassword, #modalConfirmPassword");
          allModalInputs.forEach((input) => {
            // Force alignment again
            input.style.setProperty("text-align", "left", "important");
            input.style.setProperty("direction", "ltr", "important");
            // Add multiple event listeners to ensure alignment stays left
            ["input", "focus", "click", "keydown"].forEach(eventType => {
              input.addEventListener(eventType, function() {
                this.style.setProperty("text-align", "left", "important");
                this.style.setProperty("direction", "ltr", "important");
              }, true);
            });
          });
          // Show animation
          requestAnimationFrame(() => {
            mask.style.opacity = "1";
            dialog.style.transform = "translateY(0) scale(1)";
            dialog.style.opacity = "1";
          });
          // Close modal function
          const closeModal = () => {
            dialog.style.transform = "translateY(12px) scale(0.98)";
            dialog.style.opacity = "0";
            mask.style.opacity = "0";
            setTimeout(() => {
              if (mask && mask.parentNode) {
                mask.remove();
              }
              // Restore background scrolling
              const scrollY = document.body.style.top;
              document.body.style.position = "";
              document.body.style.top = "";
              document.body.style.width = "";
              document.body.style.overflow = "";
              if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || "0") * -1);
              }
            }, 200);
          };
          // Cancel button
          const cancelBtn = dialog.querySelector("#modalCancelBtn");
          if (cancelBtn) {
            cancelBtn.addEventListener("click", () => {
              o("Light");
              closeModal();
            });
          }
          // Save button
          const saveBtn = dialog.querySelector("#modalSaveBtn");
          if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
              o("Medium");
              const newPwdInput = dialog.querySelector("#modalNewPassword");
              const confirmPwdInput = dialog.querySelector("#modalConfirmPassword");
              if (!newPwdInput || !confirmPwdInput) {
                d("无法获取密码输入框");
                return;
              }
              const newPwd = newPwdInput.value;
              const confirmPwd = confirmPwdInput.value;
              if (!newPwd) {
                d("请填写新密码");
                return;
              }
              if (!isValidPassword(newPwd)) {
                d("密码必须为8到20位，包含大写字母、小写字母和数字，一些特殊字符不能包括");
                return;
              }
              if (newPwd !== confirmPwd) {
                d("两次输入的密码不一致");
                return;
              }
              try {
                saveBtn.disabled = true;
                saveBtn.textContent = "保存中...";
                const updateData = { table_name: "users" };
                S ? (updateData.user_id = S) : _ && (updateData.username = _);
                updateData.new_password = newPwd;
                const res = await fetch(k + "/editdata", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updateData),
                });
                let result = null;
                try {
                  result = await res.json();
                } catch (e) {}
                if (!res.ok || !result || !0 !== result.success) {
                  d(result && result.message ? result.message : "保存失败 (" + res.status + ")");
                  saveBtn.disabled = false;
                  saveBtn.textContent = "保存";
                  return;
                }
                m("密码修改成功");
                closeModal();
              } catch (e) {
                console.error("[edit] 保存密码失败:", e);
                d("保存失败，请稍后再试");
                saveBtn.disabled = false;
                saveBtn.textContent = "保存";
              }
            });
          }
          // Click mask to close
          mask.addEventListener("click", (e) => {
            if (e.target === mask) {
              o("Light");
              closeModal();
            }
          });
          e.push(() => {
            if (mask && mask.parentNode) {
              mask.remove();
            }
            // Restore background scrolling on cleanup
            const scrollY = document.body.style.top;
            document.body.style.position = "";
            document.body.style.top = "";
            document.body.style.width = "";
            document.body.style.overflow = "";
            if (scrollY) {
              window.scrollTo(0, parseInt(scrollY || "0") * -1);
            }
          });
        } catch (err) {
          console.error("[edit] 创建密码更改窗口失败:", err, err.stack);
          d("创建密码更改窗口失败: " + (err.message || "未知错误"));
          // Restore background scrolling on error
          const scrollY = document.body.style.top;
          document.body.style.position = "";
          document.body.style.top = "";
          document.body.style.width = "";
          document.body.style.overflow = "";
          if (scrollY) {
            window.scrollTo(0, parseInt(scrollY || "0") * -1);
          }
        }
      }
      // Password display click handler - must be before rippleable binding
      if (j) {
        const passwordClickHandler = (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          console.log("[edit] 密码显示项被点击");
          try {
            showPasswordChangeModal();
          } catch (err) {
            console.error("[edit] 打开密码更改窗口失败:", err, err.stack);
            d("打开密码更改窗口失败: " + (err.message || "未知错误"));
          }
        };
        j.addEventListener("click", passwordClickHandler, true); // Use capture phase to run before other handlers
        e.push(() => j.removeEventListener("click", passwordClickHandler, true));
      }
      if (u) {
        const t = () => {
          o("Light");
          try {
            // Use history.back() like settings page does
            // This will return to the previous page (me page in index.html)
            window.history.back();
          } catch (e) {
            console.error("[edit] 返回失败:", e);
            // Fallback: navigate to index.html with switchToTab
            try {
              localStorage.setItem("switchToTab", "3");
              "function" == typeof window.navigateTo
                ? window.navigateTo("../index.html")
                : (window.location.href = "../index.html");
            } catch (e2) {
              window.location.href = "../index.html";
            }
          }
        };
        (u.addEventListener("click", t),
          e.push(() => u.removeEventListener("click", t)));
      }
      if (p) {
        const t = async () => {
          o("Medium");
          const n = h ? h.value.trim() : "",
            a = f ? f.value.trim() : "",
            r = y ? y.value.trim() : "",
            l = w ? w.value.trim() : "",
            i = v ? v.value.trim() : "",
            s = b ? b.value.trim() : "",
            c = x ? (x.value ? x.value.trim() : "") : "";
          const u = { table_name: "users" };
          S ? (u.user_id = S) : _ && (u.username = _);
          let hasChanges = !1;
          // Check username - same validation as register page
          if (n !== originalData.username) {
            if (!n || n.trim() === "") {
              return void d("用户名不能为空");
            }
            if (!isValidUsername(n)) {
              return void d("用户名不能为空且不超过20位");
            }
            u.username = n;
            hasChanges = !0;
          }
          // Check gender
          if (a !== originalData.gender) {
            u.gender = a || null;
            hasChanges = !0;
          }
          // Check age - same validation as register page
          if (r !== (originalData.age !== null ? String(originalData.age) : "")) {
            if (!isValidAge(r)) {
              return void d("年龄必须是0-120之间的整数");
            }
            const ageVal = r ? parseInt(r, 10) : null;
            u.age = ageVal;
            hasChanges = !0;
          }
          // Check region
          if (l !== originalData.region) {
            u.region = l || null;
            hasChanges = !0;
          }
          // Check occupation
          if (i !== originalData.occupation) {
            u.occupation = i || null;
            hasChanges = !0;
          }
          // Check purpura_type
          if (s !== originalData.purpura_type) {
            u.purpura_type = s || null;
            hasChanges = !0;
          }
          // Check first_onset_time
          if (c !== originalData.first_onset_time) {
            u.first_onset_time = c || null;
            hasChanges = !0;
          }
          if (!hasChanges) return void d("您没有任何改动");
          try {
            ((p.disabled = !0),
              (p.dataset._label = p.textContent),
              (p.textContent = "保存中..."));
            const e = await fetch(k + "/editdata", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(u),
            });
            let t = null;
            try {
              t = await e.json();
            } catch (e) {}
            if (!e.ok || !t || !0 !== t.success)
              return (
                d(
                  t && t.message
                    ? t.message
                    : "保存失败 (" + e.status + ")",
                ),
                (p.disabled = !1),
                void (p.textContent = p.dataset._label || "保存")
              );
            m("修改成功");
            setTimeout(() => {
              try {
                // Use history.back() like settings page does
                // This will return to the previous page (me page in index.html)
                window.history.back();
              } catch (e) {
                console.error("[edit] 返回失败:", e);
                // Fallback: navigate to index.html with switchToTab
                try {
                  localStorage.setItem("switchToTab", "3");
                  "function" == typeof window.navigateTo
                    ? window.navigateTo("../index.html")
                    : (window.location.href = "../index.html");
                } catch (e2) {
                  window.location.href = "../index.html";
                }
              }
            }, 1000);
          } catch (e) {
            (console.error("[edit] 保存失败:", e),
              d("保存失败，请稍后再试"));
          } finally {
            ((p.disabled = !1),
              p.dataset._label &&
                (p.textContent = p.dataset._label),
              delete p.dataset._label);
          }
        };
        (p.addEventListener("click", t),
          e.push(() => p.removeEventListener("click", t)));
      }
      c.querySelectorAll(".rippleable").forEach((t) => {
        // Skip password display item - it has its own handler
        if (t.id === "passwordDisplayItem") return;
        const n = (e) => i(e),
          a = (e) => {
            ("Enter" !== e.key && " " !== e.key) || t.click();
          };
        (t.addEventListener("click", n),
          t.addEventListener("keydown", a),
          e.push(() => {
            (t.removeEventListener("click", n),
              t.removeEventListener("keydown", a));
          }));
      });
    }),
    (window.destroyEdit = function () {
      e.forEach((e) => {
        try {
          e();
        } catch (e) {}
      }),
        (e = []);
    }));
  if (
    document.readyState === "loading" ||
    document.readyState === "interactive"
  ) {
    const t = () => {
      document.removeEventListener("DOMContentLoaded", t),
        window.initEdit && window.initEdit();
    };
    document.addEventListener("DOMContentLoaded", t);
  } else {
    window.initEdit && window.initEdit();
  }
})();

