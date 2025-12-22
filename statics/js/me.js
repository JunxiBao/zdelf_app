!(function () {
  (console.debug("[me] me.js evaluated"), Date.now());
  let e = [],
    t = null,
    Capacitor = null;
  try {
    ((Capacitor = window.Capacitor),
      Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications
        ? ((t = Capacitor.Plugins.LocalNotifications),
          console.log("✅ [me] Capacitor LocalNotifications 插件已加载"))
        : console.warn(
            "⚠️ [me] Capacitor LocalNotifications 插件未找到，将使用浏览器原生通知",
          ));
  } catch (e) {
    console.warn("⚠️ [me] 无法加载Capacitor插件，将使用浏览器原生通知:", e);
  }
  let n = null;
  function o() {
    if (n) {
      try {
        n.abort();
      } catch (e) {}
      n = null;
    }
  }
  let a = {
      name: "加载中...",
      age: null,
      phone: "无",
      avatar_url: null,
      current_streak: 0,
      max_streak: 0,
      first_onset_time: null,
    },
    r = "",
    s = null;
  // Calculate days since first onset
  function calculateDiseaseDays(firstOnsetTime) {
    if (!firstOnsetTime || typeof firstOnsetTime !== "string" || firstOnsetTime.trim() === "") {
      return null;
    }
    try {
      var dateStr = firstOnsetTime.trim();
      var onsetDate = null;
      
      // Try to parse YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        onsetDate = new Date(dateStr + "T00:00:00");
      } else {
        // Try to parse other formats like "12月1日" or "2024年12月1日"
        var match = dateStr.match(/(\d{4})?年?(\d{1,2})月(\d{1,2})日?/);
        if (match) {
          var year = match[1] || new Date().getFullYear();
          var month = parseInt(match[2], 10) - 1; // Month is 0-indexed
          var day = parseInt(match[3], 10);
          onsetDate = new Date(year, month, day);
        } else {
          // Try to parse as Date object
          onsetDate = new Date(dateStr);
        }
      }
      
      if (!onsetDate || isNaN(onsetDate.getTime())) {
        return null;
      }
      
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      onsetDate.setHours(0, 0, 0, 0);
      
      var diffTime = today.getTime() - onsetDate.getTime();
      var diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays >= 0 ? diffDays : null;
    } catch (e) {
      console.warn("[me] 计算发病天数失败:", e, firstOnsetTime);
      return null;
    }
  }
  function i(e = "Light", t = {}) {
    try {
      window.HapticManager
        ? window.HapticManager.impact(e, {
            context: "me-page",
            debounce: 100,
            ...t,
          })
        : window.__hapticImpact__ && window.__hapticImpact__(e);
    } catch (e) {
      console.warn("震动反馈失败:", e);
    }
  }
  function l(e, t, n = "无") {
    for (const n of t) if (e && null != e[n] && "" !== e[n]) return e[n];
    return n;
  }
  (console.debug("[me] exposing lifecycle: initMe/destroyMe"),
    (window.initMe = function (t) {
      const c = t || document;
      (console.log("[me] ========== initMe初始化开始 =========="),
        console.log("[me] rootEl:", t),
        console.log("[me] root:", c),
        console.log("[me] root类型:", c.constructor.name),
        P(),
        requestAnimationFrame(() => {
          const e = c.querySelector(".profile-card");
          e &&
            setTimeout(() => {
              e.classList.add("animate-in");
            }, 100);
          const t = c.querySelector(".my-posts-section");
          t &&
            setTimeout(() => {
              t.classList.add("animate-in");
            }, 200);
        }));
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
      const u = c.querySelector("#displayName"),
        p = c.querySelector("#displayAge"),
        g = c.querySelector("#displayPhone"),
        h = c.querySelector("#checkinStatus"),
        f = h ? h.querySelector(".checkin-status-text") : null,
        y =
          (c.querySelector("#reminderStatusEnabled"),
          c.querySelector("#reminderStatusTime"),
          c.querySelector("#reminderStatusToday"),
          c.querySelector("#reminderStatusTomorrow"),
          c.querySelector("#reminderStatusPending"),
          c.querySelector("#refreshReminderStatusBtn"),
          c.querySelector("#avatarInitials")),
        w = c.querySelector("#avatarImage"),
        v =
          (c.querySelector("#streakInfo"),
          c.querySelector("#currentStreak"),
          c.querySelector("#maxStreak"),
          c.querySelector("#streakDisplay")),
        b = c.querySelector("#currentStreakDisplay"),
        x = c.querySelector("#diseaseInfo"),
        k = c.querySelector("#diseaseText"),
        S = w,
        _ = y;
      async function E() {
        try {
          const e = (function (e = new Date()) {
            try {
              const t = new Date(
                e.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }),
              );
              return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
            } catch (t) {
              return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
            }
          })(new Date());
          console.log("[me] 检查打卡状态 - 今天日期:", e);
          const t =
              localStorage.getItem("userId") ||
              sessionStorage.getItem("userId") ||
              localStorage.getItem("UserID") ||
              sessionStorage.getItem("UserID"),
            n =
              localStorage.getItem("username") ||
              localStorage.getItem("Username") ||
              sessionStorage.getItem("username") ||
              sessionStorage.getItem("Username");
          if (
            (console.log("[me] 检查打卡状态 - 用户标识:", {
              userId: t,
              username: n,
            }),
            !t && !n)
          )
            return (console.warn("[me] 检查打卡状态失败: 缺少用户标识"), !1);
          const o =
              ("undefined" != typeof window && window.__API_BASE__) ||
              "https://app.zdelf.cn",
            a = o.endsWith("/") ? o.slice(0, -1) : o,
            r = ["diet", "metrics", "case"].map(async (o) => {
              try {
                const r = `${a}/getjson/${o}?${t ? "user_id=" + encodeURIComponent(t) : "username=" + encodeURIComponent(n)}&date=${e}&limit=1`;
                console.log(`[me] 检查${o}类型 - 请求URL:`, r);
                const s = await fetch(r, { cache: "no-cache" });
                if (!s.ok)
                  return (
                    console.warn(
                      `[me] 检查${o}类型 - HTTP错误:`,
                      s.status,
                      s.statusText,
                    ),
                    !1
                  );
                const i = await s.json();
                console.log(`[me] 检查${o}类型 - API返回:`, {
                  success: i.success,
                  dataLength: i.data ? i.data.length : 0,
                  hasData: i.success && i.data && i.data.length > 0,
                  firstItem: i.data && i.data.length > 0 ? i.data[0] : null,
                });
                const l = i.success && i.data && i.data.length > 0;
                return (
                  l
                    ? console.log(`[me] ✓ 日期 ${e} 的 ${o} 类型有提交记录`)
                    : console.log(`[me] ○ 日期 ${e} 的 ${o} 类型无提交记录`),
                  l
                );
              } catch (e) {
                return (console.warn(`[me] 检查${o}提交失败:`, e), !1);
              }
            }),
            s = await Promise.all(r),
            i = s.some((e) => !0 === e);
          return (
            console.log("[me] 打卡状态检查结果:", {
              diet: s[0],
              metrics: s[1],
              case: s[2],
              final: i,
            }),
            i
          );
        } catch (e) {
          return (console.error("[me] 检查打卡状态失败:", e), !1);
        }
      }
      async function C() {
        if (h && f) {
          const e = await E();
          const wasAlreadyLoaded = h.classList.contains("loaded");
          const wasAlreadyVisible = h.style.display === "block";
          
          // 更新文本和颜色
          e
            ? ((f.textContent = "今日已打卡"), (f.style.color = "#D5BCE8"))
            : ((f.textContent = "今日未打卡"), (f.style.color = "#999999"));
          
          // 如果元素已经显示且有 loaded 类，只更新内容，不触发动画
          if (wasAlreadyVisible && wasAlreadyLoaded) {
            // 元素已经显示，只更新文本，不触发动画
            return;
          }
          
          // 首次显示或需要重新显示时，触发动画
          h.style.display = "block";
          if (!wasAlreadyLoaded) {
            h.classList.remove("loaded");
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                h.classList.add("loaded");
              });
            });
          } else {
            // 如果已经有 loaded 类，确保它保持
            h.classList.add("loaded");
          }
        }
      }
      async function L() {
        try {
          const e =
              localStorage.getItem("userId") ||
              sessionStorage.getItem("userId") ||
              localStorage.getItem("UserID") ||
              sessionStorage.getItem("UserID"),
            t =
              localStorage.getItem("username") ||
              localStorage.getItem("Username") ||
              sessionStorage.getItem("username") ||
              sessionStorage.getItem("Username");
          if (!e && !t)
            return void console.debug(
              "[me] 未找到用户ID/用户名，跳过加载连续天数统计",
            );
          const n =
              ("undefined" != typeof window && window.__API_BASE__) ||
              "https://app.zdelf.cn",
            o = n.endsWith("/") ? n.slice(0, -1) : n,
            r = e ? { user_id: e } : { username: t },
            s = await fetch(`${o}/stats/get_streak`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(r),
            });
          if (!s.ok)
            return void console.warn("[me] 获取连续天数统计失败:", s.status);
          const i = await s.json();
          i.success &&
            i.data &&
            ((a.current_streak = i.data.current_streak || 0),
            (a.max_streak = i.data.max_streak || 0),
            console.log("[me] 连续天数统计:", {
              current_streak: a.current_streak,
              max_streak: a.max_streak,
            }),
            I());
        } catch (e) {
          console.warn("[me] 加载连续天数统计出错:", e);
        }
      }
      function I() {
        console.log("[me] renderUser 开始，用户数据:", a);
        const e =
          "加载中..." === a.name || null === a.name || void 0 === a.name;
        if (
          (u
            ? ((u.textContent = a.name || "无"),
              console.log("[me] 更新用户名:", a.name || "无"),
              e ||
                requestAnimationFrame(() => {
                  u.classList.add("loaded");
                }))
            : console.warn("[me] nameEl 未找到"),
          p)
        ) {
          if (
            (a.age &&
            "无" !== a.age &&
            "" !== a.age &&
            null !== a.age &&
            void 0 !== a.age
              ? ((p.textContent = "年龄 : " + a.age + "岁"),
                console.log("[me] 更新年龄:", a.age + "岁"))
              : ((p.textContent = "年龄 : 无"),
                console.log("[me] 年龄为空，显示'无'")),
            !e)
          ) {
            const e = p.parentElement;
            e &&
              e.classList.contains("meta") &&
              requestAnimationFrame(() => {
                e.classList.add("loaded");
              });
          }
        } else console.warn("[me] ageEl 未找到");
        if (
          (g &&
            (g.textContent =
              a.phone && "无" !== a.phone
                ? "手机号：" +
                  (function (e) {
                    if (!e || "无" === e) return "无";
                    const t = String(e).replace(/\s+/g, ""),
                      n = t.match(/(?:(?:\+?86)?)(\d{11})$/);
                    if (n) {
                      const e = n[1];
                      return e.slice(0, 3) + "****" + e.slice(7);
                    }
                    return t;
                  })(a.phone)
                : "手机号：无"),
          y)
        ) {
          const t = (function (e) {
            if (!e || "无" === e) return "无";
            const t = String(e).trim();
            if (!t) return "无";
            const n = t[0];
            if (/[\u4E00-\u9FFF]/.test(n)) return n;
            const o = t.match(/[A-Z]/g) || [];
            if (o.length >= 2) return (o[0] + o[1]).toUpperCase();
            const a = t.slice(0, 2);
            return a.charAt(0).toUpperCase() + a.slice(1);
          })(a.name);
          ((y.textContent = t),
            console.log("[me] 更新头像首字母:", t),
            e ||
              requestAnimationFrame(() => {
                y.classList.add("loaded");
              }));
        }
        // Display disease days
        if (x && k) {
          const diseaseDays = calculateDiseaseDays(a.first_onset_time);
          if (diseaseDays !== null && diseaseDays >= 0) {
            k.textContent = "过敏性紫癜 " + diseaseDays + " 天";
            x.style.display = "block";
            console.log("[me] 显示发病天数:", diseaseDays);
            e ||
              requestAnimationFrame(() => {
                x.classList.add("loaded");
              });
          } else {
            x.style.display = "none";
            console.log("[me] 未设置首次发病时间，隐藏发病天数");
          }
        } else {
          console.warn("[me] 发病信息元素未找到:", {
            diseaseInfoEl: x,
            diseaseTextEl: k,
          });
        }
        if (v && b) {
          const t = a.current_streak || 0;
          ((b.textContent = t),
            (v.style.display = "flex"),
            console.log("[me] 连续打卡天数显示:", t),
            e ||
              requestAnimationFrame(() => {
                v.classList.add("loaded");
              }));
        } else
          console.warn("[me] 连续天数元素未找到:", {
            streakDisplayEl: v,
            currentStreakDisplayEl: b,
          });
        if (
          (h &&
            f &&
            (e ||
              requestAnimationFrame(() => {
                h.classList.add("loaded");
              })),
          console.log("[me] renderUser - 头像元素:", S, _),
          console.log("[me] renderUser - 用户头像URL:", a.avatar_url),
          S && _)
        )
          if (a.avatar_url) {
            console.log("[me] 显示头像图片:", a.avatar_url);
            const e = new Image();
            ((e.onload = () => {
              ((S.src = a.avatar_url),
                (S.style.display = "block"),
                (_.style.display = "none"),
                requestAnimationFrame(() => {
                  S.classList.add("loaded");
                }));
            }),
              (e.onerror = () => {
                ((S.style.display = "none"),
                  (_.style.display = "grid"),
                  requestAnimationFrame(() => {
                    _.classList.add("loaded");
                  }));
              }),
              (e.src = a.avatar_url));
          } else
            (console.log("[me] 显示用户名首字母"),
              (S.style.display = "none"),
              (_.style.display = "grid"),
              e ||
                requestAnimationFrame(() => {
                  _.classList.add("loaded");
                }));
        else
          console.warn("[me] 头像元素未找到:", {
            finalAvatarImageEl: S,
            finalInitialsEl: _,
          });
        console.log("[me] renderUser 完成");
      }
      function T(e) {
        const t = document.createElement("div");
        return ((t.textContent = e), t.innerHTML);
      }
      (console.log("[me] 元素查询结果:", {
        nameEl: u,
        ageEl: p,
        initialsEl: y,
        avatarImageEl: w,
        streakDisplayEl: v,
        currentStreakDisplayEl: b,
        diseaseInfoEl: x,
        diseaseTextEl: k,
      }),
        console.log("[me] DOM查询结果:", { avatarImageEl: S, initialsEl: _ }));
      const $ = c.querySelector("main.app"),
        q = $ && $.dataset && $.dataset.table ? $.dataset.table : "users",
        A =
          localStorage.getItem("userId") ||
          sessionStorage.getItem("userId") ||
          localStorage.getItem("UserID") ||
          sessionStorage.getItem("UserID"),
        M =
          localStorage.getItem("username") ||
          localStorage.getItem("Username") ||
          sessionStorage.getItem("username") ||
          sessionStorage.getItem("Username");
      console.debug("[me] table:", q, "userId:", A, "username:", M);
      const D = (
        (
          document.querySelector('meta[name="api-base"]')?.content ||
          window.__API_BASE__ ||
          window.API_BASE ||
          ""
        ).trim() || "https://app.zdelf.cn"
      ).replace(/\/$/, "");
      if (
        (console.log("[me] 开始初始渲染，用户数据:", a),
        I(),
        C(),
        L(),
        console.log("[me] 初始化流程完成，等待数据加载..."),
        A || M)
      ) {
        (o(), (n = new AbortController()));
        const t = A
            ? { table_name: q, user_id: A }
            : { table_name: q, username: M },
          m = D + "/readdata";
        (console.debug("[me] POST", m, t),
          fetch(m, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(t),
            signal: n.signal,
          })
            .then((e) => {
              if ((console.log("📡 [me] 收到响应，状态码:", e.status), !e.ok))
                throw new Error(`HTTP ${e.status}: ${e.statusText}`);
              return e.json();
            })
            .then((e) => {
              if (!e || !0 !== e.success || !Array.isArray(e.data))
                return void d("无法从服务器读取资料");
              const t = e.data[0] || {};
              console.debug("[me] /readdata result:", e);
              const n = t && t.username ? t.username : "无",
                o =
                  t && null !== t.age && void 0 !== t.age && "" !== t.age
                    ? String(t.age)
                    : null,
                m = l(t, ["phone", "mobile", "phone_number"], "无"),
                g = l(t, ["avatar_url", "avatar", "profile_picture"], null),
                h = t.current_streak || 0,
                f = t.max_streak || 0,
                firstOnset = t.first_onset_time || null;
              if (
                (console.log("[me] 从数据库获取的头像URL:", g),
                (a = {
                  name: n,
                  age: o,
                  phone: m,
                  avatar_url: g,
                  current_streak: h,
                  max_streak: f,
                  first_onset_time: firstOnset,
                }),
                a.avatar_url &&
                  !a.avatar_url.startsWith("http") &&
                  (a.avatar_url = D + a.avatar_url),
                a.avatar_url)
              ) {
                const e = a.avatar_url.includes("?") ? "&" : "?";
                ((a.avatar_url = a.avatar_url + e + "t=" + Date.now()),
                  console.log("[me] 完整头像URL（带时间戳）:", a.avatar_url));
              }
              (console.log("[me] 最终用户数据:", a),
                (s = "string" == typeof t.password ? t.password : null),
                (r = ""),
                console.log("[me] 数据加载完成，开始更新UI"),
                I(),
                setTimeout(() => {
                  if ((u && u.classList.add("loaded"), p)) {
                    const e = p.parentElement;
                    e &&
                      e.classList.contains("meta") &&
                      e.classList.add("loaded");
                  }
                  (y && y.classList.add("loaded"),
                    v && v.classList.add("loaded"));
                }, 50),
                C(),
                ((0 === a.current_streak && 0 === a.max_streak) ||
                  !t.current_streak) &&
                  L(),
                (async function () {
                  const e = c.querySelector("#postsGrid");
                  if (!e)
                    return void console.warn("[me] 未找到帖子容器 #postsGrid");
                  const t = A || M;
                  if (!t)
                    return (
                      console.warn("[me] 未找到用户ID，无法加载帖子"),
                      void (e.innerHTML = "")
                    );
                  const postsEmptyEl = c.querySelector("#postsEmpty");
                  try {
                    const n = await fetch(D + "/square/list", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ limit: 50, current_user_id: t }),
                    });
                    if (!n.ok) throw new Error(`HTTP ${n.status}`);
                    const o = await n.json();
                    !(function (e, t) {
                      if (((t.innerHTML = ""), 0 === e.length)) {
                        if (postsEmptyEl) {
                          postsEmptyEl.style.display = "block";
                          t.style.display = "none";
                        }
                        return;
                      }
                      if (postsEmptyEl) {
                        postsEmptyEl.style.display = "none";
                        t.style.display = "grid";
                      }
                      const n = e
                        .sort((e, t) => {
                          const n = e.created_at
                            ? new Date(e.created_at).getTime()
                            : 0;
                          return (
                            (t.created_at
                              ? new Date(t.created_at).getTime()
                              : 0) - n
                          );
                        })
                        .slice(0, 6);
                      n.forEach((e) => {
                        const o = document.createElement("div");
                        ((o.className = "post-card rippleable"),
                          o.addEventListener("click", () => {
                            i("Light");
                            try {
                              (localStorage.setItem(
                                "open_square_post_id",
                                String(e.id || ""),
                              ),
                                localStorage.setItem("global_loading", "1"),
                                console.log("[me] 设置帖子ID:", e.id));
                            } catch (e) {
                              console.warn("[me] 设置帖子ID失败:", e);
                            }
                            try {
                              const e = document.body,
                                t = document.createElement("div");
                              ((t.id = "route-loading-overlay"),
                                (t.style.cssText =
                                  "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;"),
                                (t.innerHTML =
                                  '\n              <style>\n                #route-loading-overlay{background:var(--bg, #ffffff)}\n                #route-loading-overlay .spinner{width:40px;height:40px;border:3px solid rgba(176,143,199,0.1);border-top:3px solid #b08fc7;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:16px;box-shadow:0 2px 12px rgba(176,143,199,0.2)}\n                #route-loading-overlay .loading-text{color:#666;font-size:0.9rem;font-weight:500;opacity:0.8;letter-spacing:-0.01em}\n                @media (prefers-color-scheme: dark){\n                  #route-loading-overlay{background:var(--bg, #0f1115)}\n                  #route-loading-overlay .spinner{border:3px solid rgba(176,143,199,0.1);border-top:3px solid #b08fc7;box-shadow:0 2px 12px rgba(176,143,199,0.2)}\n                  #route-loading-overlay .loading-text{color:#d1d5db}\n                }\n                @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}\n              </style>\n              <div class="spinner"></div>\n              <div class="loading-text">正在跳转...</div>\n            '),
                                e
                                  ? e.appendChild(t)
                                  : console.warn("[me] document.body 不可用"));
                            } catch (e) {
                              console.warn("[me] 创建加载覆盖层失败:", e);
                            }
                            window.location.href = "../index.html";
                          }));
                        let a = "";
                        if (e.created_at)
                          try {
                            const t = new Date(e.created_at);
                            a = `<div>${t.getMonth() + 1}月${t.getDate()}日</div><div>${t.getFullYear()}年</div>`;
                          } catch (e) {
                            a = "";
                          }
                        let r =
                          e.comment_count ||
                          e.comments_count ||
                          e.comments ||
                          0;
                        const s = Array.isArray(e.images) ? e.images : [],
                          l = s.length > 0 ? s[0] : null,
                          c = l ? (l.startsWith("http") ? l : D + l) : null;
                        ((o.innerHTML = `\n          <div class="post-date">${a}</div>\n          ${c ? `<img src="${T(c)}" class="post-image" alt="帖子图片" />` : ""}\n          <div class="post-content">${T(e.text || "")}</div>\n          <div class="post-footer">\n            <ion-icon ios="chatbubble-outline" md="chatbubble-sharp" class="post-comment-icon"></ion-icon>\n            <span class="post-comment-count" data-post-id="${e.id}">${r}</span>\n          </div>\n        `),
                          t.appendChild(o),
                          (async function (e, t) {
                            try {
                              const n = await fetch(D + "/square/comments", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  post_id: e,
                                  current_user_id: A || M || null,
                                }),
                              });
                              if (!n.ok) return;
                              const o = await n.json();
                              if (o.success && Array.isArray(o.data)) {
                                const n = o.data.length,
                                  a = t.querySelector(
                                    `.post-comment-count[data-post-id="${e}"]`,
                                  );
                                a && (a.textContent = n);
                              }
                            } catch (t) {
                              console.debug(
                                `[me] 加载帖子 ${e} 的评论数失败:`,
                                t,
                              );
                            }
                          })(e.id, o));
                        const d = n.indexOf(e);
                        setTimeout(
                          () => {
                            o.classList.add("animate-in");
                          },
                          300 + 50 * d,
                        );
                      });
                    })(
                      o && o.success && Array.isArray(o.data)
                        ? o.data.filter((e) => e.user_id === t)
                        : [],
                      e,
                    );
                  } catch (t) {
                    (console.error("[me] 加载帖子失败:", t),
                      (e.innerHTML = ""),
                      postsEmptyEl && (postsEmptyEl.style.display = "block"),
                      (e.style.display = "none"));
                  }
                })());
            })
            .catch((e) => {
              (console.warn("[me] /readdata error:", e),
                d("网络错误，请稍后再试"));
            })
            .finally(() => {
              n = null;
            }),
          e.push(() => o()));
      } else
        ((t) => {
          const n = document.createElement("div");
          ((n.textContent = t),
            (n.style.position = "fixed"),
            (n.style.left = "50%"),
            (n.style.bottom = "28px"),
            (n.style.transform = "translateX(-50%)"),
            (n.style.background = "var(--card)"),
            (n.style.color = "var(--text)"),
            (n.style.padding = "10px 14px"),
            (n.style.borderRadius = "12px"),
            (n.style.boxShadow = "var(--shadow-2)"),
            (n.style.zIndex = "12001"),
            (n.style.pointerEvents = "none"),
            (n.style.opacity = "0"),
            (n.style.transition = "opacity .2s ease, translate .2s ease"));
          const o = document.querySelector(".edit-mask");
          (o && o.parentNode
            ? o.parentNode.insertBefore(n, o)
            : document.body.appendChild(n),
            requestAnimationFrame(() => {
              ((n.style.opacity = "1"), (n.style.translate = "0 -8px"));
            }));
          const a = setTimeout(() => {
            ((n.style.opacity = "0"),
              (n.style.translate = "0 0"),
              n.addEventListener("transitionend", () => n.remove(), {
                once: !0,
              }));
          }, 1500);
          e.push(() => {
            (clearTimeout(a), n.parentNode && n.remove());
          });
        })("未找到用户ID/用户名，本地显示占位");
      c.querySelectorAll(".rippleable").forEach((t) => {
        const n = (e) =>
            (function (e) {
              const t = e.currentTarget;
              i("Light");
              const n = t.getBoundingClientRect(),
                o = document.createElement("span"),
                a = Math.max(n.width, n.height),
                r = (e.clientX || n.left + n.width / 2) - n.left - a / 2,
                s = (e.clientY || n.top + n.height / 2) - n.top - a / 2,
                l =
                  window.matchMedia &&
                  window.matchMedia("(prefers-color-scheme: dark)").matches;
              ((o.style.cssText = `\n      position: absolute;\n      width: ${a}px;\n      height: ${a}px;\n      left: ${r}px;\n      top: ${s}px;\n      border-radius: 50%;\n      background: ${l ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)"};\n      transform: scale(0);\n      pointer-events: none;\n      animation: ripple-animation 0.6s ease-out forwards;\n    `),
                (function (e) {
                  const t = e.getRootNode(),
                    n = "ripple-animation-style";
                  if (
                    11 === t.nodeType
                      ? t.querySelector(`#${n}`)
                      : t.getElementById(n)
                  )
                    return;
                  const o = document.createElement("style");
                  if (
                    ((o.id = n),
                    (o.textContent =
                      "\n      @keyframes ripple-animation {\n        to {\n          transform: scale(4);\n          opacity: 0;\n        }\n      }\n    "),
                    11 === t.nodeType)
                  )
                    t.appendChild(o);
                  else {
                    const e =
                      t.head || t.querySelector("head") || t.documentElement;
                    e && e.appendChild(o);
                  }
                })(t),
                t.appendChild(o),
                o.addEventListener("animationend", () => o.remove(), {
                  once: !0,
                }));
            })(e),
          o = (e) => {
            ("Enter" !== e.key && " " !== e.key) || t.click();
          };
        (t.addEventListener("click", n),
          t.addEventListener("keydown", o),
          e.push(() => {
            (t.removeEventListener("click", n),
              t.removeEventListener("keydown", o));
          }));
      });
      const N = c.querySelector("#editProfileBtn");
      if (N) {
        const t = () => {
          i("Light");
          try {
            "function" == typeof window.navigateTo
              ? window.navigateTo("src/edit.html")
              : (window.location.href = "src/edit.html");
                      } catch (e) {
            (console.error("[me] 跳转到编辑资料页面失败:", e),
              (window.location.href = "src/edit.html"));
          }
          };
        (N.addEventListener("click", t),
          e.push(() => N.removeEventListener("click", t)));
      }
      const R = c.querySelector("#settingsBtn");
      if (R) {
        const t = () => {
          i("Light");
          try {
            "function" == typeof window.navigateTo
              ? window.navigateTo("src/settings.html")
              : (window.location.href = "src/settings.html");
          } catch (e) {
            (console.error("[me] 跳转到设置页面失败:", e),
              (window.location.href = "src/settings.html"));
          }
        };
        (R.addEventListener("click", t),
          e.push(() => R.removeEventListener("click", t)));
      }
      async function P() {
        try {
          let e = 0;
          const t = 4;
          for (; e < t && !window.scheduleCheckinReminder; )
            (await new Promise((e) => setTimeout(e, 500)), e++);
          if (!window.scheduleCheckinReminder)
            return void console.warn(
              "[me] settings.js 未加载，无法初始化打卡提醒",
            );
          const n = window.getCheckinReminderSetting,
            o = window.checkNotificationPermission,
            a = window.scheduleCheckinReminder;
          if (
            (window.cancelCheckinReminderForDate,
            window.getTodayDateString,
            !n || !o || !a)
          )
            return void console.warn(
              "[me] settings.js 中的打卡提醒函数未完全加载",
            );
          if (!n()) return;
          if (!(await o())) {
            window.setCheckinReminderSetting &&
              window.setCheckinReminderSetting(!1);
            return;
          }
          // 检查是否有正在调度的打卡提醒
          // 如果有，说明可能正在从其他页面（如用药提醒页面）重新调度，不要取消它们
          let hasPendingCheckinReminders = false;
          try {
            if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
              const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
              if (typeof LocalNotifications.getPending === 'function') {
                const pending = await LocalNotifications.getPending();
                const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
                hasPendingCheckinReminders = pendingNotifications.some(n => 
                  n && n.extra && n.extra.type === 'checkin_reminder'
                );
                if (hasPendingCheckinReminders) {
                  console.log("[me] 检测到现有的打卡提醒，跳过取消操作，直接调用 scheduleCheckinReminder");
                }
              }
            }
          } catch (err) {
            console.warn("[me] 检查现有打卡提醒失败:", err);
          }
          
          // 只有在没有现有打卡提醒时才清理过期提醒和取消所有提醒
          // 这样可以避免在用药提醒页面重新调度后，又被取消
          if (!hasPendingCheckinReminders) {
            window.cleanupExpiredCheckinReminders &&
              (await window.cleanupExpiredCheckinReminders());
            window.cancelAllCheckinReminders &&
              (await window.cancelAllCheckinReminders());
          }
          await a();
        } catch (e) {
          console.error("[me] 初始化打卡提醒失败:", e);
        }
      }
      ((window.initCheckinReminder = P),
        window.cancelCheckinReminderForToday ||
          (window.cancelCheckinReminderForToday = async function () {
            try {
              const e = window.getTodayDateString || e,
                t = window.cancelCheckinReminderForDate || t;
              if (e && t) {
                const n = e();
                await t(n);
              }
              let n = 0;
              const o = 4;
              for (; n < o && !window.scheduleCheckinReminder; )
                (await new Promise((e) => setTimeout(e, 500)), n++);
              window.scheduleCheckinReminder
                ? (window.clearSubmissionCache &&
                    window.clearSubmissionCache(todayStr),
                  setTimeout(async () => {
                    try {
                      await window.scheduleCheckinReminder({
                        forceTodaySubmitted: !0,
                      });
                    } catch (e) {
                      console.warn("[me] 后备实现重新调度打卡提醒失败:", e);
                    }
                  }, 2e3))
                : console.warn("[me] settings.js 未加载，无法重新调度提醒");
            } catch (e) {
              console.error("[me] 取消今天的打卡提醒失败:", e);
            }
          }),
        window.checkAndCancelCheckinReminderForDate ||
          (window.checkAndCancelCheckinReminderForDate = async function (e) {
            const t = window.cancelCheckinReminderForDate || t;
            t && (await t(e));
          }));
      const U = c.querySelector("#avatarUploadBtn"),
        j = c.querySelector("#avatarFileInput");
      function F(t) {
        (console.log("[me] 文件选择事件触发"),
          console.log("[me] 事件对象:", t),
          console.log("[me] 事件目标:", t.target),
          console.log("[me] 文件列表:", t.target.files));
        const n = t.target.files[0];
        if (!n) return void console.log("[me] 没有选择文件");
        if (
          (console.log("[me] 选择的文件:", n.name, n.size, n.type),
          !n.type.startsWith("image/"))
        )
          return void d("请选择图片文件");
        if (n.size > 10485760)
          return void d("图片文件过大，请选择小于10MB的图片");
        const o = new FileReader();
        ((o.onload = function (t) {
          (console.log("[me] 文件读取完成，显示裁剪界面"),
            (function (t, n, o) {
              console.log(
                "[me] 显示头像裁剪模态框，图片数据长度:",
                t ? t.length : 0,
              );
              const r =
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches;
              console.log("[me] 深色模式:", r);
              const s = document.querySelector(".avatar-crop-mask");
              s && s.remove();
              const l = document.createElement("div");
              l.className = "avatar-crop-mask";
              const c = r ? "rgba(0, 0, 0, 0.9)" : "rgba(0, 0, 0, 0.8)";
              l.style.cssText = `\n        position: fixed;\n        top: 0;\n        left: 0;\n        width: 100vw;\n        height: 100vh;\n        background: ${c};\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        z-index: 99999;\n        opacity: 1;\n      `;
              const u = document.createElement("div");
              u.className = "avatar-crop-dialog";
              const p = r
                  ? "linear-gradient(135deg, #1f2937 0%, #111827 100%)"
                  : "white",
                g = r
                  ? "0 20px 40px rgba(0, 0, 0, 0.5)"
                  : "0 20px 40px rgba(0, 0, 0, 0.3)";
              u.style.cssText = `\n        width: 90vw;\n        max-width: 400px;\n        background: ${p};\n        border-radius: 16px;\n        box-shadow: ${g};\n        overflow: hidden;\n        position: relative;\n        z-index: 100000;\n        opacity: 1;\n        transform: scale(1);\n        border: ${r ? "1px solid rgba(255, 255, 255, 0.1)" : "none"};\n      `;
              const h = r ? "transparent" : "white",
                f = r ? "#f9fafb" : "#333",
                y = r ? "#d1d5db" : "#666",
                w = r ? "#b08fc7" : "#1a73e8",
                v = r ? "#374151" : "#f5f5f5",
                b = r ? "#4b5563" : "#ddd",
                x = r ? "#f9fafb" : "#333",
                k = r ? "#b08fc7" : "#1a73e8";
              ((u.innerHTML = `\n        <div style="padding: 20px; text-align: center; background: ${h}; min-height: 400px;">\n          <h3 style="margin: 0 0 16px 0; color: ${f}; font-size: 18px; font-weight: 600;">头像裁剪</h3>\n          <div id="cropContainer" style="position: relative; width: 300px; height: 300px; margin: 0 auto 16px; border: 2px solid ${w}; border-radius: 8px; overflow: hidden; background: #f0f0f0; touch-action: none;">\n            <img id="cropImage" src="${t}" style="width: 100%; height: 100%; object-fit: contain; cursor: move; user-select: none; pointer-events: none;" alt="裁剪图片">\n            <div id="cropOverlay" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 200px; height: 200px; border: 3px solid ${w}; border-radius: 50%; background: transparent; cursor: move; box-shadow: 0 0 0 9999px rgba(0,0,0,0.5); pointer-events: none;"></div>\n          </div>\n          <p style="margin: 0 0 20px 0; color: ${y}; font-size: 14px;">拖拽调整位置，滚轮/捏合缩放，圆形区域为最终头像</p>\n          <div style="display: flex; gap: 12px; justify-content: center;">\n            <button id="cancelCrop" style="padding: 10px 20px; border: 1px solid ${b}; background: ${v}; color: ${x}; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s;">取消</button>\n            <button id="confirmCrop" style="padding: 10px 20px; border: none; background: ${k}; color: white; border-radius: 8px; cursor: pointer; font-size: 14px; transition: all 0.2s;">确认</button>\n          </div>\n        </div>\n      `),
                l.appendChild(u),
                document.body.appendChild(l),
                console.log("[me] 模态框已添加到DOM"));
              const S = u.querySelector("#cropContainer"),
                _ = u.querySelector("#cropImage"),
                E = u.querySelector("#cropOverlay");
              let C = !1,
                L = 0,
                T = 0,
                $ = 0,
                q = 0,
                A = 1,
                M = 0;
              function N() {
                _.style.transform = `translate(${$}px, ${q}px) scale(${A})`;
              }
              (S.addEventListener("mousedown", (e) => {
                ((C = !0),
                  (L = e.clientX - $),
                  (T = e.clientY - q),
                  (S.style.cursor = "grabbing"));
              }),
                document.addEventListener("mousemove", (e) => {
                  C &&
                    (e.preventDefault(),
                    ($ = e.clientX - L),
                    (q = e.clientY - T),
                    N());
                }),
                document.addEventListener("mouseup", () => {
                  C && ((C = !1), (S.style.cursor = "move"));
                }),
                S.addEventListener("wheel", (e) => {
                  e.preventDefault();
                  const t = e.deltaY > 0 ? -0.1 : 0.1;
                  ((A = Math.max(0.5, Math.min(3, A + t))), N());
                }),
                S.addEventListener("touchstart", (e) => {
                  if ((e.preventDefault(), 1 === e.touches.length)) {
                    C = !0;
                    const t = e.touches[0];
                    ((L = t.clientX - $), (T = t.clientY - q));
                  } else if (2 === e.touches.length) {
                    C = !1;
                    const t = e.touches[0],
                      n = e.touches[1];
                    M = Math.sqrt(
                      Math.pow(n.clientX - t.clientX, 2) +
                        Math.pow(n.clientY - t.clientY, 2),
                    );
                  }
                }),
                S.addEventListener("touchmove", (e) => {
                  if ((e.preventDefault(), 1 === e.touches.length && C)) {
                    const t = e.touches[0];
                    (($ = t.clientX - L), (q = t.clientY - T), N());
                  } else if (2 === e.touches.length) {
                    C = !1;
                    const t = e.touches[0],
                      n = e.touches[1],
                      o = Math.sqrt(
                        Math.pow(n.clientX - t.clientX, 2) +
                          Math.pow(n.clientY - t.clientY, 2),
                      );
                    if (M > 0) {
                      const e = o / M;
                      ((A = Math.max(0.5, Math.min(3, A * e))), N());
                    }
                    M = o;
                  }
                }),
                S.addEventListener("touchend", (e) => {
                  0 === e.touches.length && (C = !1);
                }),
                setTimeout(() => {
                  (console.log("[me] 模态框应该可见了"),
                    console.log("[me] 模态框位置:", l.getBoundingClientRect()),
                    console.log("[me] 模态框样式:", l.style.cssText),
                    (l.style.display = "flex"),
                    (l.style.opacity = "1"),
                    (l.style.visibility = "visible"));
                }, 100));
              const R = () => {
                  l.parentNode && l.remove();
                },
                P = u.querySelector("#cancelCrop"),
                U = u.querySelector("#confirmCrop");
              (P &&
                (P.addEventListener("mouseenter", () => {
                  r
                    ? ((P.style.background = "#4b5563"),
                      (P.style.borderColor = "#6b7280"))
                    : (P.style.background = "#e5e7eb");
                }),
                P.addEventListener("mouseleave", () => {
                  r
                    ? ((P.style.background = "#374151"),
                      (P.style.borderColor = "#4b5563"))
                    : (P.style.background = "#f5f5f5");
                })),
                U &&
                  (U.addEventListener("mouseenter", () => {
                    U.style.background = r ? "#9d7ab8" : "#1557b0";
                  }),
                  U.addEventListener("mouseleave", () => {
                    U.style.background = r ? "#b08fc7" : "#1a73e8";
                  })),
                P.addEventListener(
                  "click",
                  () => {
                    (i("Light"), R());
                  },
                  { once: !0 },
                ),
                l.addEventListener("click", (e) => {
                  e.target === l && R();
                }),
                U.addEventListener(
                  "click",
                  () => {
                    i("Medium");
                    const e = E.getBoundingClientRect(),
                      r = S.getBoundingClientRect(),
                      s = e.left + e.width / 2 - r.left,
                      l = e.top + e.height / 2 - r.top,
                      c = e.width / 2,
                      u = _.naturalWidth,
                      p = _.naturalHeight,
                      g = r.width,
                      h = r.height;
                    let f, y, w, v;
                    u / p > g / h
                      ? ((f = g), (y = (g * p) / u), (w = 0), (v = (h - y) / 2))
                      : ((y = h),
                        (f = (h * u) / p),
                        (w = (g - f) / 2),
                        (v = 0));
                    const b = s - (g / 2 + $),
                      x = l - (h / 2 + q),
                      k = f / u,
                      C = b / (k * A),
                      L = x / (k * A),
                      T = u / 2 + C,
                      M = p / 2 + L,
                      N = (2 * c) / (k * A),
                      P = T - N / 2,
                      U = M - N / 2;
                    (console.log("[me] 预览一致裁剪（原图像素）:", {
                      displayWidth: f,
                      displayHeight: y,
                      baseScale: k,
                      currentScale: A,
                      dxContainer: b,
                      dyContainer: x,
                      dxOriginal: C,
                      dyOriginal: L,
                      centerXOriginal: T,
                      centerYOriginal: M,
                      sourceSizePx: N,
                      sourceX: P,
                      sourceY: U,
                    }),
                      (async function (e, t, n, o, r, s) {
                        try {
                          const i = new Image();
                          ((i.onload = async function () {
                            const e = 200,
                              l = document.createElement("canvas"),
                              c = l.getContext("2d");
                            ((l.width = e),
                              (l.height = e),
                              c.clearRect(0, 0, e, e),
                              c.drawImage(i, t, n, o, o, 0, 0, e, e),
                              (c.globalCompositeOperation = "destination-in"),
                              c.beginPath(),
                              c.arc(100, 100, 100, 0, 2 * Math.PI),
                              c.closePath(),
                              c.fill());
                            const u = l.toDataURL("image/png", 0.95);
                            await (async function (e, t, n) {
                              try {
                                (console.log(
                                  "[me] 开始上传头像，用户ID:",
                                  t || n,
                                ),
                                  console.log(
                                    "[me] API地址:",
                                    D + "/upload_avatar",
                                  ));
                                const o = await (async function (e) {
                                  return new Promise((t, n) => {
                                    console.log("[me] 开始压缩图片");
                                    const o = new Image();
                                    ((o.onload = function () {
                                      console.log(
                                        "[me] 图片加载完成，原始尺寸:",
                                        o.width,
                                        "x",
                                        o.height,
                                      );
                                      const e =
                                          document.createElement("canvas"),
                                        n = e.getContext("2d"),
                                        a = 200;
                                      ((e.width = a),
                                        (e.height = a),
                                        n.drawImage(o, 0, 0, a, a));
                                      const r =
                                          document.createElement("canvas"),
                                        s = r.getContext("2d");
                                      ((r.width = a),
                                        (r.height = a),
                                        s.beginPath(),
                                        s.arc(
                                          a / 2,
                                          a / 2,
                                          a / 2,
                                          0,
                                          2 * Math.PI,
                                        ),
                                        s.fill(),
                                        (n.globalCompositeOperation =
                                          "destination-in"),
                                        n.drawImage(r, 0, 0));
                                      const i = e.toDataURL("image/png", 0.9);
                                      (console.log(
                                        "[me] 图片压缩完成，压缩后大小:",
                                        i.length,
                                      ),
                                        t(i));
                                    }),
                                      (o.onerror = function () {
                                        (console.error("[me] 图片加载失败"),
                                          n(new Error("图片加载失败")));
                                      }),
                                      (o.src = e));
                                  });
                                })(e);
                                console.log(
                                  "[me] 图片压缩完成，压缩后大小:",
                                  o.length,
                                );
                                const r = { user_id: t || n, avatar_data: o };
                                console.log(
                                  "[me] 发送请求，payload keys:",
                                  Object.keys(r),
                                );
                                const s = await fetch(D + "/upload_avatar", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify(r),
                                });
                                console.log(
                                  "[me] 响应状态:",
                                  s.status,
                                  s.statusText,
                                );
                                const i = await s.json();
                                if (
                                  (console.log("[me] 响应数据:", i),
                                  !s.ok || !i.success)
                                )
                                  return (
                                    console.error("[me] 上传失败:", i),
                                    void d(i.message || "头像上传失败")
                                  );
                                if (
                                  ((a.avatar_url = i.data.avatar_url),
                                  console.log(
                                    "[me] 更新头像URL:",
                                    a.avatar_url,
                                  ),
                                  a.avatar_url &&
                                    !a.avatar_url.startsWith("http") &&
                                    (a.avatar_url = D + a.avatar_url),
                                  a.avatar_url)
                                ) {
                                  const e = a.avatar_url.includes("?")
                                    ? "&"
                                    : "?";
                                  ((a.avatar_url =
                                    a.avatar_url + e + "t=" + Date.now()),
                                    console.log(
                                      "[me] 完整头像URL（带时间戳）:",
                                      a.avatar_url,
                                    ));
                                }
                                (I(), m("头像上传成功"));
                              } catch (e) {
                                (console.error("[me] 头像上传失败:", e),
                                  console.error(
                                    "[me] 错误详情:",
                                    e.message,
                                    e.stack,
                                  ),
                                  d("头像上传失败，请稍后再试"));
                              }
                            })(u, r, s);
                          }),
                            (i.onerror = function () {
                              d("图片处理失败");
                            }),
                            (i.src = e));
                        } catch (e) {
                          (console.error("[me] 精准裁剪失败:", e),
                            d("头像裁剪失败，请稍后再试"));
                        }
                      })(t, P, U, N, n, o),
                      R());
                  },
                  { once: !0 },
                ));
              const j = (e) => {
                "Escape" === e.key &&
                  (document.removeEventListener("keydown", j), R());
              };
              (document.addEventListener("keydown", j),
                e.push(() => {
                  (document.removeEventListener("keydown", j),
                    l.parentNode && l.remove());
                }));
            })(t.target.result, A, M));
        }),
          o.readAsDataURL(n));
      }
      if (
        (console.log("[me] 头像上传按钮:", U),
        console.log("[me] 文件输入:", j),
        U && j)
      ) {
        const t = (e) => {
          (console.log("[me] 头像上传按钮被点击"),
            e.preventDefault(),
            e.stopPropagation(),
            i("Light"),
            console.log("[me] 触发文件选择器"),
            console.log("[me] 文件输入状态:", {
              disabled: j.disabled,
              hidden: j.hidden,
              style: j.style.display,
              offsetParent: j.offsetParent,
            }));
          try {
            (j.click(), console.log("[me] 文件选择器已触发"));
          } catch (e) {
            console.error("[me] 触发文件选择器失败:", e);
          }
        };
        (U.addEventListener("click", t),
          e.push(() => U.removeEventListener("click", t)),
          console.log("[me] 绑定文件选择事件监听器"),
          j.addEventListener("change", F),
          e.push(() => j.removeEventListener("change", F)),
          console.log("[me] 文件输入元素:", j),
          console.log("[me] 文件输入属性:", {
            type: j.type,
            accept: j.accept,
            style: j.style.display,
          }));
      } else console.warn("[me] 头像上传按钮或文件输入未找到");
    }),
    (window.destroyMe = function () {
      (o(),
        e.forEach((e) => {
          try {
            e();
          } catch (e) {}
        }),
        (e = []));
    }));
})();
