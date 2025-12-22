!(function () {
  console.debug("[settings] settings.js evaluated");
  let e = [],
    t = null,
    Capacitor = null;
  function n(e, t) {}
  (window.writeCheckinReminderLog || (window.writeCheckinReminderLog = n),
    window.getCheckinReminderLogs ||
    (window.getCheckinReminderLogs = function () {
      return [];
    }),
    window.clearCheckinReminderLogs ||
    (window.clearCheckinReminderLogs = function () {}));
  const a = [
    { value: "system", label: "跟随系统", desc: "根据系统外观自动切换" },
    { value: "light", label: "浅色模式", desc: "始终使用浅色界面" },
    { value: "dark", label: "深色模式", desc: "始终使用深色界面" },
  ];
  // ==================== 应用版本配置 ====================
  const APP_VERSION = "2.0.0.0";
  const BUILD_TIMESTAMP = Date.now();
  const VERSION_CHECK_CONFIG = {
    enabled: true,
    serverUrl: "https://app.zdelf.cn/version/version.json",
    timeout: 10000,
  };
  // ====================================================
  try {
    ((Capacitor = window.Capacitor),
      Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications
        ? ((t = Capacitor.Plugins.LocalNotifications),
          // 检查是否是浏览器通知封装
          t && typeof t._showNotification === 'function'
            ? console.log("✅ [settings] 浏览器通知封装已加载，将使用浏览器原生通知")
            : console.log("✅ [settings] Capacitor LocalNotifications 插件已加载"))
        : console.warn(
            "⚠️ [settings] LocalNotifications 插件未找到",
          ));
  } catch (e) {
    console.warn(
      "⚠️ [settings] 无法加载通知插件:",
      e,
    );
  }
  function o(e = "Light", t = {}) {
    try {
      window.HapticManager
        ? window.HapticManager.impact(e, {
            context: "settings-page",
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
  function s() {
    if (document.getElementById("vibration-modal-style")) return;
    const t = document.createElement("style");
    ((t.id = "vibration-modal-style"),
      (t.textContent =
        "\n      .vibration-mask{position:fixed;inset:0;background:color-mix(in srgb, var(--text,#000) 20%, transparent);backdrop-filter:saturate(120%) blur(2px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;z-index:10000}\n      .vibration-mask.show{opacity:1}\n      .vibration-dialog{width:min(92vw,400px);background:var(--card,#fff);color:var(--text,#111);border-radius:16px;box-shadow:var(--shadow-3,0 10px 30px rgba(0,0,0,.15));transform:translateY(12px) scale(.98);opacity:0;transition:transform .2s ease,opacity .2s ease;border:1px solid var(--border,rgba(0,0,0,.06))}\n      .vibration-dialog.show{transform:translateY(0) scale(1);opacity:1}\n      .vibration-header{padding:20px 24px 16px;font-weight:700;font-size:18px;text-align:center;border-bottom:1px solid var(--divider,rgba(0,0,0,.1))}\n      .vibration-body{padding:20px 24px;line-height:1.6}\n      .vibration-section{margin-bottom:20px}\n      .vibration-section:last-child{margin-bottom:0}\n      .vibration-section h3{font-size:16px;font-weight:600;margin:0 0 12px 0;color:var(--text,#111)}\n      .vibration-section p{margin:0 0 8px 0;color:var(--text-secondary,#666)}\n      .vibration-section p:last-child{margin-bottom:0}\n      .vibration-toggle{display:flex;align-items:center;justify-content:space-between;padding:16px;background:var(--surface,rgba(0,0,0,.04));border-radius:12px;border:1px solid var(--border,rgba(0,0,0,.1))}\n      .vibration-toggle-info{flex:1}\n      .vibration-toggle-label{font-size:16px;font-weight:500;color:var(--text,#111);margin:0 0 4px 0}\n      .vibration-toggle-desc{font-size:14px;color:var(--text-secondary,#666);margin:0}\n      .vibration-switch{position:relative;width:52px;height:32px;background:var(--border,rgba(0,0,0,.2));border-radius:16px;cursor:pointer;transition:all 0.3s ease;border:none;outline:none}\n      .vibration-switch.active{background:var(--brand,#1a73e8)}\n      .vibration-switch::before{content:'';position:absolute;top:2px;left:2px;width:28px;height:28px;background:#fff;border-radius:50%;transition:all 0.3s ease;box-shadow:0 2px 4px rgba(0,0,0,.2)}\n      .vibration-switch.active::before{transform:translateX(20px)}\n      .vibration-footer{display:flex;justify-content:center;padding:0 24px 20px}\n      .vibration-btn{appearance:none;border:0;padding:12px 24px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;background:var(--brand,#1a73e8);color:#fff;transition:all 0.2s ease}\n      .vibration-btn:hover{background:var(--brand-700,#1558b3);transform:translateY(-1px)}\n      @media (prefers-color-scheme: dark){\n        .vibration-mask{background:color-mix(in srgb,#000 50%, transparent)}\n        .vibration-dialog{background:var(--card,#1e1f22);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.08))}\n        .vibration-section h3{color:var(--text,#e6e6e6)}\n        .vibration-section p{color:var(--text-secondary,#9aa3af)}\n        .vibration-toggle{background:var(--surface,rgba(255,255,255,.08));border-color:var(--border,rgba(255,255,255,.12))}\n        .vibration-toggle-label{color:var(--text,#e6e6e6)}\n        .vibration-toggle-desc{color:var(--text-secondary,#9aa3af)}\n        .vibration-switch{background:rgba(255,255,255,.2)}\n        .vibration-switch.active{background:var(--brand,#8ab4f8)}\n      }\n    "),
      document.head.appendChild(t),
      e.push(() => {
        t.parentNode && t.remove();
      }));
  }
  function r() {
    const e = localStorage.getItem("checkin_reminder_enabled");
    // 默认打开：如果未设置或值为 "true"，返回 true
    return e === null || e === undefined || e === "true";
  }
  function c(e) {
    localStorage.setItem("checkin_reminder_enabled", e.toString());
  }
  function l() {
    return localStorage.getItem("checkin_reminder_time") || "09:00";
  }
  async function d() {
    try {
      if (t) {
        const e = await t.requestPermissions();
        return (
          console.log("[settings] 通知权限请求结果:", e),
          "granted" === e.display
        );
      }
      if ("Notification" in window) {
        const e = await Notification.requestPermission();
        return (console.log("[settings] 浏览器通知权限:", e), "granted" === e);
      }
      return !1;
    } catch (e) {
      return (console.error("[settings] 请求通知权限失败:", e), !1);
    }
  }
  async function m() {
    try {
      if (t) {
        const e = await t.checkPermissions();
        return (
          console.log("[settings] 通知权限状态:", e),
          "granted" === e.display
        );
      }
      return "Notification" in window && "granted" === Notification.permission;
    } catch (e) {
      return (console.error("[settings] 检查通知权限失败:", e), !1);
    }
  }
  const g = new Map();
  function u(e) {
    return 0 === e ? 10001 : 1 === e ? 10002 : null;
  }
  async function p() {
    try {
      if (t) {
        let e = [];
        if ("function" == typeof t.getPending)
          try {
            const a = await t.getPending(),
              o = a && a.notifications ? a.notifications : [];
            o.length;
            for (const t of o)
              t.extra &&
                "checkin_reminder" === t.extra.type &&
                (e.push({ id: t.id }), n(0, (t.id, t.extra.targetDate)));
            e.length > 0 && e.length;
          } catch (e) {
            e.message;
          }
        (0 === e.length && (e = [{ id: 10001 }, { id: 10002 }]),
          e.length > 0 &&
            (e.length, await t.cancel({ notifications: e }), e.length));
      }
      (h.size, h.clear());
    } catch (e) {
      const t = `取消打卡提醒通知失败: ${e.message || e}`;
      (console.error("[settings]", t), e.stack && e.stack);
    }
  }
  async function cancelAllNotifications() {
    try {
      if (!t) {
        console.warn("[settings] LocalNotifications 不可用，无法取消所有通知");
        return;
      }
      let notificationsToCancel = [];
      if ("function" == typeof t.getPending) {
        try {
          const e = await t.getPending(),
            a = e && e.notifications ? e.notifications : [];
          console.log("[settings] 找到", a.length, "个待触发的通知");
          for (const e of a) {
            // 重要：只取消打卡提醒，绝不取消用药提醒
            if (e && e.id && e.extra && e.extra.type === "checkin_reminder") {
              notificationsToCancel.push({ id: e.id });
              console.log("[settings] 准备取消打卡提醒 ID:", e.id);
            } else if (e && e.id && e.extra && e.extra.type !== "checkin_reminder") {
              // 保护用药提醒，跳过取消
              console.log("[settings] 保护：跳过取消用药提醒 ID:", e.id, "类型:", e.extra?.type || "未知");
            }
          }
        } catch (e) {
          console.warn("[settings] 获取待触发通知列表失败:", e.message || e);
        }
      }
      if (notificationsToCancel.length > 0) {
        console.log("[settings] 正在取消", notificationsToCancel.length, "个打卡提醒");
        await t.cancel({ notifications: notificationsToCancel });
        console.log("[settings] ✅ 已成功取消所有打卡提醒（用药提醒已保护）");
      } else {
        console.log("[settings] 没有找到需要取消的打卡提醒");
      }
      h.clear();
    } catch (e) {
      const t = `取消所有打卡提醒失败: ${e.message || e}`;
      console.error("[settings]", t, e.stack && e.stack);
    }
  }
  let h = new Map();
  async function f(e) {
    try {
      if (!t) {
        const e = "LocalNotifications 不可用，无法取消提醒";
        return void console.warn("[settings]", e);
      }
      if (!e || "string" != typeof e || !e.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const t = `无效的日期格式: ${e}`;
        return void console.error("[settings]", t);
      }
      b(e);
      const n = h.get(e);
      if (n && n.id) {
        n.id;
        try {
          (n.id,
            await t.cancel({ notifications: [{ id: n.id }] }),
            h.delete(e),
            n.id,
            console.log(
              "[settings] 已取消日期",
              e,
              "的打卡提醒（通知ID:",
              n.id,
              ")",
            ));
        } catch (t) {
          const n = `取消通知失败: ${t.message || t}`;
          (console.error("[settings]", n), h.delete(e));
        }
      } else {
        console.warn(
          "[settings] 未找到日期",
          e,
          "的通知映射，尝试通过日期范围取消",
        );
        const n = L(new Date()),
          a = new Date(e + "T00:00:00"),
          o = new Date(n + "T00:00:00"),
          i = a.getTime() - o.getTime();
        if (1 === Math.floor(i / 864e5)) {
          const n = u(1);
          if (n)
            try {
              (await t.cancel({ notifications: [{ id: n }] }),
                console.log(
                  "[settings] 已通过日期偏移取消日期",
                  e,
                  "的打卡提醒（通知ID:",
                  n,
                  ")",
                ));
            } catch (e) {
              const t = `通过日期偏移取消通知失败: ${e.message || e}`;
              console.error("[settings]", t);
            }
        }
      }
    } catch (e) {
      const t = `取消指定日期打卡提醒失败: ${e.message || e}`;
      (console.error("[settings]", t),
        e.stack && e.stack,
        console.log("[settings] 回退到重新调度所有提醒"),
        r() && (await S()));
    }
  }
  async function v(e, t = !0) {
    try {
      if (t) {
        const t = g.get(e);
        if (t) {
          const n = Date.now() - t.timestamp;
          if (n < 3e5) {
            const a = `使用缓存的提交状态: ${e} = ${t.hasSubmission ? "已提交" : "未提交"}（缓存年龄: ${Math.round(n / 1e3)}秒）`;
            return (console.log("[settings]", a), t.hasSubmission);
          }
          (Math.round(n / 1e3), g.delete(e));
        }
      }
      const n =
          localStorage.getItem("userId") ||
          sessionStorage.getItem("userId") ||
          localStorage.getItem("UserID") ||
          sessionStorage.getItem("UserID"),
        a =
          localStorage.getItem("username") ||
          localStorage.getItem("Username") ||
          sessionStorage.getItem("username") ||
          sessionStorage.getItem("Username");
      if (!n && !a) {
        const e = "无法检查提交记录：缺少用户ID和用户名";
        return (console.warn("[settings]", e), !1);
      }
      const o =
          ("undefined" != typeof window && window.__API_BASE__) ||
          "https://app.zdelf.cn",
        i = o.endsWith("/") ? o.slice(0, -1) : o,
        s = ["diet", "metrics", "case"];
      s.join(", ");
      const r = s.map(async (t) => {
          try {
            const o = `${i}/getjson/${t}?${n ? "user_id=" + encodeURIComponent(n) : "username=" + encodeURIComponent(a)}&date=${e}&limit=1`,
              s = await fetch(o, { cache: "no-cache" });
            if (!s.ok) return (s.status, !1);
            const r = await s.json();
            return r.success && r.data && r.data.length > 0;
          } catch (e) {
            const n = `检查${t}提交失败: ${e.message || e}`;
            return (console.warn("[settings]", n), !1);
          }
        }),
        c = await Promise.all(r),
        l = c.some((e) => !0 === e);
      return (
        c[0],
        c[1],
        c[2],
        g.set(e, { hasSubmission: l, timestamp: Date.now() }),
        console.log("[settings] 日期", e, "的提交检查结果:", {
          diet: c[0],
          metrics: c[1],
          case: c[2],
          hasSubmission: l,
        }),
        l
      );
    } catch (e) {
      const t = `检查用户提交失败: ${e.message || e}`;
      return (console.error("[settings]", t), e.stack && e.stack, !1);
    }
  }
  function b(e) {
    e ? (g.has(e), g.delete(e)) : (g.size, g.clear());
  }
  async function w() {
    try {
      if (!t) return;
      const e = new Date();
      e.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
      const a = [];
      if ("function" == typeof t.getPending)
        try {
          const o = await t.getPending(),
            i = o && o.notifications ? o.notifications : [];
          i.length;
          for (const t of i)
            if (
              t.extra &&
              "checkin_reminder" === t.extra.type &&
              (n(0, (t.id, t.extra.targetDate)), t.schedule && t.schedule.at)
            ) {
              const o = new Date(t.schedule.at);
              if (
                (n(0, o.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })),
                e > o)
              ) {
                (a.push({ id: t.id }),
                  t.extra.targetDate &&
                    (h.delete(t.extra.targetDate), n(0, t.extra.targetDate)));
                const e = `发现已过期的通知（触发时间: ${o.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}, 通知ID: ${t.id}）`;
                (console.log("[settings]", e), n());
              } else n();
            }
        } catch (e) {
          const t = `获取待触发通知列表失败，使用后备方案: ${e.message || e}`;
          console.warn("[settings]", t);
        }
      if (0 === a.length) {
        h.size;
        for (const [t, o] of h.entries()) {
          const i = l(),
            [s, r] = i.split(":").map(Number),
            c = new Date(t + "T00:00:00");
          if (
            (c.setHours(s, r, 0, 0),
            n(0, c.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })),
            e > c && o && o.id)
          ) {
            (a.push({ id: o.id }), h.delete(t));
            const e = `发现已过期的通知（日期: ${t}, 时间: ${i}, 通知ID: ${o.id}）`;
            (console.log("[settings]", e), n());
          }
        }
      }
      // 移除错误的后备清理逻辑
      // 该逻辑会错误地取消明天的提醒，因为明天的提醒时间应该总是大于当前时间
      // 如果当前时间大于明天的提醒时间，说明代码有bug，不应该取消明天的提醒
      if (a.length > 0) {
        (a.length, await t.cancel({ notifications: a }));
        const e = `✅ 已清理 ${a.length} 个已过期的打卡提醒`;
        console.log("[settings]", e);
      } else {
        const e = "没有发现已过期的打卡提醒";
        console.log("[settings]", e);
      }
    } catch (e) {
      const t = `清理过期打卡提醒失败: ${e.message || e}`;
      (console.error("[settings]", t), e.stack && e.stack);
    }
  }
  ((window.clearSubmissionCache = b),
    (window.getCheckinReminderSetting = r),
    (window.setCheckinReminderSetting = c),
    (window.scheduleCheckinReminder = S),
    (window.cancelAllCheckinReminders = p),
    (window.cancelAllNotifications = cancelAllNotifications),
    (window.cancelCheckinReminderForDate = f),
    (window.checkNotificationPermission = m),
    (window.requestNotificationPermission = d),
    (window.checkUserHasSubmissionForDate = v),
    (window.getDateString = L),
    (window.getTodayDateString = N),
    (window.cleanupExpiredCheckinReminders = w));
  let y = !1,
    x = null;
  async function S(e = {}) {
    const n = !(!e || !e.forceTodaySubmitted);
    if (y) {
      const e = "正在调度中，跳过重复调用";
      return void console.log("[settings]", e);
    }
    try {
      y = !0;
      if (!r()) return (await p(), void (y = !1));
      if (!(await m())) {
        const e = "没有通知权限，无法调度打卡提醒";
        return (console.warn("[settings]", e), void (y = !1));
      }
      const e = l();
      if (!e || !e.match(/^\d{2}:\d{2}$/)) {
        const t = `提醒时间格式无效: ${e}`;
        return (console.error("[settings]", t), void (y = !1));
      }
      const [a, o] = e.split(":").map(Number);
      if (isNaN(a) || isNaN(o) || a < 0 || a > 23 || o < 0 || o > 59) {
        const e = `提醒时间值无效: 小时=${a}, 分钟=${o}`;
        return (console.error("[settings]", e), void (y = !1));
      }
      await w();
      
      // 在调度打卡提醒之前，先保存所有现有的用药提醒（多重保险）
      let savedMedicationReminders = [];
      let savedMedicationRemindersBackup = [];
      try {
        if (t && "function" == typeof t.getPending) {
          const pending = await t.getPending();
          const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
          // 严格过滤：只保存用药提醒
          savedMedicationReminders = pendingNotifications
            .filter(n => {
              if (!n || !n.extra) return false;
              // 确保是用药提醒（有 reminderId 且不是打卡提醒）
              return n.extra.reminderId && n.extra.type !== "checkin_reminder";
            })
            .map(n => ({
              id: n.id,
              title: n.title,
              body: n.body,
              schedule: n.schedule,
              sound: n.sound || "default",
              actionTypeId: n.actionTypeId || "medication_reminder",
              extra: { ...n.extra } // 深拷贝 extra，避免引用问题
            }));
          // 创建备份
          savedMedicationRemindersBackup = savedMedicationReminders.map(n => ({ ...n }));
          console.log("[settings] 📋 保存了", savedMedicationReminders.length, "个用药提醒，将在打卡提醒调度后重新调度");
          if (savedMedicationReminders.length > 0) {
            console.log("[settings] 📋 用药提醒详情:", savedMedicationReminders.map(n => ({
              id: n.id,
              reminderId: n.extra?.reminderId,
              scheduleAt: n.schedule?.at
            })));
          }
        }
      } catch (e) {
        console.warn("[settings] ⚠️ 获取现有用药提醒失败:", e);
      }
      
      const i = N(),
        s = new Date();
      s.setDate(s.getDate() - 1);
      const c = L(s),
        d = new Date();
      d.setDate(d.getDate() + 1);
      const g = L(d);
      let f = !1,
        x = !1,
        S = !1;
      if (n) {
        // forceTodaySubmitted 为 true：今天已提交，需要检查昨天和明天
        b(i), b(g);
        f = await v(c, !1); // 检查昨天
        x = !0; // 今天强制设为已提交
        // 对于未来的日期（明天），不需要调用后端API，直接假设未提交
        // 因为未来日期肯定不会有提交记录
        S = !1;
        console.log("[settings] forceTodaySubmitted=true: 今天已提交，明天未提交（未来日期）");
      } else {
        // 正常流程：检查昨天、今天、明天
        f = await v(c, !1);
        x = await v(i, !1);
        // 对于未来的日期（明天），不需要调用后端API，直接假设未提交
        // 因为未来日期肯定不会有提交记录
        S = !1;
        console.log("[settings] 正常流程: 明天未提交（未来日期）");
      }
      await p();
      // 正确的逻辑：前一天完成打卡时才预约下一次
      // 严格按照逻辑：昨天已提交 && 今天未提交 → 预约今天的提醒
      //                 今天已提交 && 明天未提交 → 预约明天的提醒
      const shouldScheduleToday = f && !x;
      const shouldScheduleTomorrow = x && !S;
      console.log("[settings] 调度判断详情:", {
        forceTodaySubmitted: n,
        yesterday: f,
        today: x,
        tomorrow: S,
        shouldScheduleToday,
        shouldScheduleTomorrow,
      });
      if (!shouldScheduleToday && !shouldScheduleTomorrow) {
        const e = `无需预约提醒：昨天${f ? "已" : "未"}提交，今天${x ? "已" : "未"}提交，明天${S ? "已" : "未"}提交`;
        return (console.log("[settings]", e), void (y = !1));
      }
      const I = `开始调度提醒：昨天${f ? "已" : "未"}提交，今天${x ? "已" : "未"}提交，明天${S ? "已" : "未"}提交。将预约：${shouldScheduleToday ? "今天的提醒" : ""}${shouldScheduleToday && shouldScheduleTomorrow ? "和" : ""}${shouldScheduleTomorrow ? "明天的提醒" : ""}`;
      console.log("[settings]", I);
      const C = await (async function () {
        try {
          const e =
            localStorage.getItem("userId") ||
            sessionStorage.getItem("userId") ||
            localStorage.getItem("UserID") ||
            sessionStorage.getItem("UserID");
          if (!e || "undefined" === e || "null" === e) return "用户";
          const t = localStorage.getItem("cached_username_userId"),
            n =
              localStorage.getItem("username") ||
              localStorage.getItem("Username") ||
              sessionStorage.getItem("username") ||
              sessionStorage.getItem("Username");
          if (n && "undefined" !== n && "null" !== n && t === e) return n;
          t &&
            t !== e &&
            (console.log("[settings] 检测到用户切换，清除旧的用户名缓存"),
            localStorage.removeItem("username"),
            localStorage.removeItem("Username"),
            sessionStorage.removeItem("username"),
            sessionStorage.removeItem("Username"),
            b());
          const a =
              ("undefined" != typeof window && window.__API_BASE__) ||
              "https://app.zdelf.cn",
            o = a.endsWith("/") ? a.slice(0, -1) : a,
            i = await fetch(`${o}/readdata`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ table_name: "users", user_id: e }),
            });
          if (i.ok) {
            const t = await i.json();
            if (t.success && Array.isArray(t.data) && t.data.length > 0) {
              const n = t.data[0].username || "用户";
              return (
                localStorage.setItem("username", n),
                localStorage.setItem("cached_username_userId", e),
                n
              );
            }
          }
          return "用户";
        } catch (e) {
          return (console.warn("[settings] 获取用户名失败:", e), "用户");
        }
      })();
      let _ = 0;
      try {
        const e =
          localStorage.getItem("userId") || sessionStorage.getItem("userId");
        if (e) {
          const t =
              ("undefined" != typeof window && window.__API_BASE__) ||
              "https://app.zdelf.cn",
            n = t.endsWith("/") ? t.slice(0, -1) : t,
            a = await fetch(`${n}/stats/get_streak`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: e }),
              cache: "no-cache",
            });
          if (a.ok) {
            const e = await a.json();
            e.success && e.data && (_ = e.data.current_streak || 0);
          } else a.status;
        }
      } catch (e) {
        const t = `获取连胜天数失败: ${e.message || e}`;
        console.warn("[settings]", t);
      }
      const $ = [
          "记得完成今日打卡哦！",
          "今天还没有记录呢，快来打卡吧！",
          "别忘了完成今天的记录哦！",
          "该打卡啦！保持你的记录习惯！",
          "今天也要记得打卡哦！",
          "坚持记录，今天也要打卡！",
          "别忘了完成今日的记录！",
          "打卡时间到啦！",
          "今天也要保持记录的好习惯！",
          "记得完成今天的打卡任务！",
          "不要忘记今天的记录哦！",
          "坚持就是胜利，今天也要打卡！",
          "打卡提醒：今天还没有记录呢！",
          "保持连续记录，今天也要打卡！",
          "今天也要记得完成记录哦！",
        ],
        D = () => {
          const e = $[Math.floor(Math.random() * $.length)];
          if (_ > 0) {
            const t = [
              `难道你希望${_}天的连胜就那么没有了吗？`,
              `你已经坚持了${_}天，不要前功尽弃哦！`,
              `${_}天的连胜记录，你真的要放弃吗？`,
              `保持${_}天的连胜不容易，今天也要坚持！`,
              `你的${_}天连胜记录正在等你续写！`,
              `不要让${_}天的努力白费，今天也要打卡！`,
              `${_}天的坚持很不容易，继续加油！`,
              `你的${_}天连胜记录需要你的坚持！`,
            ];
            return `${e}\n${t[Math.floor(Math.random() * t.length)]}`;
          }
          return e;
        };
      if (t) {
        const e = new Date(),
          n = [];
        if (
          (e.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
          h.clear(),
          shouldScheduleToday)
        ) {
          const todayTime = new Date(e);
          if (
            (todayTime.setHours(a, o, 0, 0),
            todayTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
            todayTime > e)
          ) {
            const notificationId = u(0),
              notificationBody = D();
            notificationBody.substring(0, 50);
            const s = {
              id: notificationId,
              title: `${C}，记得完成${new Date(todayTime).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}的记录哦`,
              body: notificationBody,
              schedule: { at: todayTime },
              sound: "default",
              actionTypeId: "checkin_reminder",
              extra: { type: "checkin_reminder", targetDate: i, dateOffset: 0 },
            };
            (n.push(s),
              h.set(i, { id: notificationId, targetDate: i, offset: 0 }),
              String(o).padStart(2, "0"),
              console.log("[settings] 已预约今天的提醒（", i, "）"));
          } else {
            const skipMsg = `今天的提醒时间已过（${todayTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}），跳过预约`;
            console.log("[settings]", skipMsg);
          }
        }
        if (shouldScheduleTomorrow) {
          const tomorrowTime = new Date(e);
          if (
            (tomorrowTime.setDate(tomorrowTime.getDate() + 1),
            tomorrowTime.setHours(a, o, 0, 0),
            tomorrowTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
            tomorrowTime > e)
          ) {
            const notificationId = u(1),
              notificationBody = D();
            notificationBody.substring(0, 50);
            const tomorrowNotification = {
              id: notificationId,
              title: `${C}，记得完成${new Date(tomorrowTime).toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}的记录哦`,
              body: notificationBody,
              schedule: { at: tomorrowTime },
              sound: "default",
              actionTypeId: "checkin_reminder",
              extra: { type: "checkin_reminder", targetDate: g, dateOffset: 1 },
            };
            (n.push(tomorrowNotification),
              h.set(g, { id: notificationId, targetDate: g, offset: 1 }),
              String(o).padStart(2, "0"),
              console.log("[settings] 已预约明天的提醒（", g, "）"));
          } else {
            const skipMsg = `明天的提醒时间已过期（${tomorrowTime.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}），跳过调度`;
            console.warn("[settings]", skipMsg);
          }
        }
        if (n.length > 0) {
          const notificationDetails = n
            .map(
              (e) =>
                `ID=${e.id}, 日期=${e.extra?.targetDate}, 时间=${new Date(e.schedule.at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
            )
            .join("; ");
          console.log("[settings] 准备调度打卡提醒:", notificationDetails);
          console.log("[settings] 打卡提醒数量:", n.length);
          
          // 调度前验证用药提醒数量
          let medicationCountBeforeSchedule = 0;
          if ("function" == typeof t.getPending) {
            try {
              const pendingBefore = await t.getPending();
              const pendingBeforeNotifications = pendingBefore && pendingBefore.notifications ? pendingBefore.notifications : [];
              medicationCountBeforeSchedule = pendingBeforeNotifications.filter(n => 
                n && n.extra && n.extra.reminderId && n.extra.type !== "checkin_reminder"
              ).length;
              console.log("[settings] 📊 调度打卡提醒前，用药提醒数量:", medicationCountBeforeSchedule);
            } catch (e) {
              console.warn("[settings] ⚠️ 调度前验证用药提醒失败:", e);
            }
          }
          
          try {
            await t.schedule({ notifications: n });
            const scheduledDates = n
              .map((e) => e.extra?.targetDate)
              .filter(Boolean)
              .join(", ");
            console.log("[settings] ✅ 成功调度", n.length, "个打卡提醒，日期:", scheduledDates);
            
            // 调度后立即验证用药提醒是否还在
            if ("function" == typeof t.getPending) {
              try {
                await new Promise(resolve => setTimeout(resolve, 200)); // 等待200ms让系统处理
                const pendingAfter = await t.getPending();
                const pendingAfterNotifications = pendingAfter && pendingAfter.notifications ? pendingAfter.notifications : [];
                const medicationCountAfterSchedule = pendingAfterNotifications.filter(n => 
                  n && n.extra && n.extra.reminderId && n.extra.type !== "checkin_reminder"
                ).length;
                console.log("[settings] 📊 调度打卡提醒后，用药提醒数量:", medicationCountAfterSchedule);
                
                if (medicationCountAfterSchedule < medicationCountBeforeSchedule) {
                  console.warn("[settings] ⚠️ 警告：调度打卡提醒后，用药提醒数量减少了！", 
                    "调度前:", medicationCountBeforeSchedule, "调度后:", medicationCountAfterSchedule);
                  // 如果用药提醒减少了，标记需要重新调度
                  if (savedMedicationReminders.length === 0 && medicationCountBeforeSchedule > 0) {
                    console.warn("[settings] ⚠️ 检测到用药提醒被清除，将在 finally 块中重新调度");
                    // 尝试从 pending 中重新获取用药提醒
                    const currentMedicationReminders = pendingAfterNotifications
                      .filter(n => n && n.extra && n.extra.reminderId && n.extra.type !== "checkin_reminder")
                      .map(n => ({
                        id: n.id,
                        title: n.title,
                        body: n.body,
                        schedule: n.schedule,
                        sound: n.sound || "default",
                        actionTypeId: n.actionTypeId || "medication_reminder",
                        extra: { ...n.extra }
                      }));
                    if (currentMedicationReminders.length > 0) {
                      savedMedicationReminders = currentMedicationReminders;
                      console.log("[settings] 📋 从当前待触发列表中重新获取了", currentMedicationReminders.length, "个用药提醒");
                    }
                  }
                }
              } catch (e) {
                console.warn("[settings] ⚠️ 调度后验证用药提醒失败:", e);
              }
            }
          } catch (scheduleError) {
            console.error("[settings] ❌ 调度打卡提醒失败:", scheduleError);
            throw scheduleError;
          }
        } else {
          console.log("[settings] ⚠️ 没有需要调度的打卡提醒");
        }
      } else {
        // 如果没有 LocalNotifications，尝试使用浏览器通知（但浏览器不支持定时通知）
        if ("Notification" in window && "granted" === Notification.permission) {
          console.warn("[settings] 通知不可用，无法调度提醒。请确保浏览器通知封装已正确加载");
        } else {
          console.warn("[settings] 通知不可用，无法调度提醒");
        }
      }
    } catch (e) {
      const t = `调度打卡提醒失败: ${e.message || e}`;
      (console.error("[settings]", t), e.stack && e.stack);
      try {
        await p();
      } catch (e) {
        const t = `清理失败的通知时出错: ${e.message || e}`;
        console.error("[settings]", t);
      }
    } finally {
      // 重新调度用药提醒，因为 LocalNotifications.schedule 可能会清除所有现有通知
      Promise.resolve().then(async () => {
        try {
          // 检查是否有保存的用药提醒（优先使用主备份，如果主备份为空则使用备份）
          let medicationReminders = savedMedicationReminders || [];
          const medicationRemindersBackup = savedMedicationRemindersBackup || [];
          
          // 如果主备份为空但备份不为空，使用备份
          if (medicationReminders.length === 0 && medicationRemindersBackup.length > 0) {
            console.log("[settings] 📋 主备份为空，使用备份恢复", medicationRemindersBackup.length, "个用药提醒");
            medicationReminders = medicationRemindersBackup.map(n => ({ ...n }));
          }
          
          // 如果仍然为空，尝试从当前待触发列表中获取
          if (medicationReminders.length === 0 && t && "function" == typeof t.getPending) {
            try {
              await new Promise(resolve => setTimeout(resolve, 200));
              const pending = await t.getPending();
              const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
              const currentMedicationReminders = pendingNotifications
                .filter(n => n && n.extra && n.extra.reminderId && n.extra.type !== "checkin_reminder")
                .map(n => ({
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  schedule: n.schedule,
                  sound: n.sound || "default",
                  actionTypeId: n.actionTypeId || "medication_reminder",
                  extra: { ...n.extra }
                }));
              if (currentMedicationReminders.length > 0) {
                console.log("[settings] 📋 从当前待触发列表中获取了", currentMedicationReminders.length, "个用药提醒");
                medicationReminders = currentMedicationReminders;
              }
            } catch (e) {
              console.warn("[settings] ⚠️ 从待触发列表获取用药提醒失败:", e);
            }
          }
          
          if (medicationReminders.length > 0 && t) {
            console.log("[settings] ⏰ 打卡提醒调度完成，开始重新调度", medicationReminders.length, "个用药提醒...");
            // 稍微延迟一下，确保打卡提醒的调度操作完全完成
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 验证并重新调度保存的用药提醒
            const now = new Date();
            const validMedicationReminders = medicationReminders
              .map(n => {
                let scheduleAt = n.schedule?.at;
                const originalScheduleAt = scheduleAt;
                
                if (typeof scheduleAt === "string") {
                  scheduleAt = new Date(scheduleAt);
                } else if (!(scheduleAt instanceof Date)) {
                  scheduleAt = new Date(scheduleAt);
                }
                
                if (!scheduleAt || isNaN(scheduleAt.getTime())) {
                  console.warn("[settings] 用药提醒时间无效:", n.id, "原始时间:", originalScheduleAt);
                  return null;
                }
                
                if (scheduleAt <= now) {
                  console.warn("[settings] 用药提醒时间已过期:", n.id, "时间:", scheduleAt.toISOString(), "现在:", now.toISOString());
                  return null;
                }
                
                return {
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  schedule: { at: scheduleAt },
                  sound: n.sound || "default",
                  actionTypeId: n.actionTypeId || "medication_reminder",
                  extra: n.extra
                };
              })
              .filter(n => n !== null);
            
            if (validMedicationReminders.length > 0) {
              try {
                console.log("[settings] 开始调度", validMedicationReminders.length, "个用药提醒...");
                
                // 分批调度，避免一次性过大数组
                const chunkSize = 16;
                for (let i = 0; i < validMedicationReminders.length; i += chunkSize) {
                  const chunk = validMedicationReminders.slice(i, i + chunkSize);
                  try {
                    await t.schedule({ notifications: chunk });
                    console.log("[settings] ✅ 已调度", chunk.length, "个用药提醒（批次", Math.floor(i / chunkSize) + 1, "）");
                  } catch (e) {
                    console.error("[settings] ❌ 调度用药提醒批次失败:", e);
                    // 如果批量调度失败，尝试逐个调度
                    for (const notification of chunk) {
                      try {
                        await t.schedule({ notifications: [notification] });
                        console.log("[settings] ✅ 已调度用药提醒:", notification.id);
                      } catch (err) {
                        console.error("[settings] ❌ 调度单个用药提醒失败:", notification.id, err);
                      }
                    }
                  }
                }
                
                // 多重验证调度是否成功（验证3次，每次间隔500ms）
                let verificationPassed = false;
                for (let verifyAttempt = 1; verifyAttempt <= 3; verifyAttempt++) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  if ("function" == typeof t.getPending) {
                    try {
                      const pending = await t.getPending();
                      const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
                      const medicationCount = pendingNotifications.filter(n => 
                        n && n.extra && n.extra.reminderId && n.extra.type !== "checkin_reminder"
                      ).length;
                      console.log("[settings] 验证", verifyAttempt, "/3：当前待触发的用药提醒数量:", medicationCount);
                      
                      if (medicationCount > 0) {
                        verificationPassed = true;
                        console.log("[settings] ✅ 验证成功（第", verifyAttempt, "次）：用药提醒已正确调度");
                        break;
                      } else if (verifyAttempt === 3) {
                        console.warn("[settings] ⚠️ 警告：3次验证后仍然没有找到用药提醒，可能调度失败或被清除");
                      }
                    } catch (e) {
                      console.warn("[settings] ⚠️ 验证失败（第", verifyAttempt, "次）:", e);
                    }
                  }
                }
                
                if (!verificationPassed) {
                  console.error("[settings] ❌ 严重警告：所有验证都失败，用药提醒可能已被清除！");
                }
              } catch (e) {
                console.error("[settings] ❌ 重新调度用药提醒失败:", e);
              }
            } else {
              console.log("[settings] 没有有效的用药提醒需要重新调度");
            }
          } else {
            console.log("[settings] ⏰ 打卡提醒调度完成，没有用药提醒需要重新调度");
          }
        } catch (e) {
          console.error("[settings] ❌ 重新调度用药提醒失败:", e);
        }
      });
      
      y = !1;
    }
  }
  function k(e, t = "出错了") {
    window.ModalManager
      ? window.ModalManager.alert(e, { title: t, confirmType: "danger" })
      : alert(e);
  }
  async function E(e, t = "确认") {
    if (!window.ModalManager || !window.ModalManager.confirm)
      return (
        console.warn("[settings] ModalManager 未加载，使用原生 confirm"),
        Promise.resolve(confirm(e))
      );
    try {
      return await window.ModalManager.confirm(e, {
        title: t,
        confirmType: "primary",
      });
    } catch (t) {
      return (
        console.error("[settings] confirmDialog 错误:", t),
        Promise.resolve(confirm(e))
      );
    }
  }
  function L(e = new Date()) {
    try {
      const t = new Date(
          e.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }),
        ),
        n = t.getFullYear();
      return `${n}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
    } catch (t) {
      return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
    }
  }
  function N() {
    return L(new Date());
  }
  ((window.cancelCheckinReminderForToday = async function () {
    try {
      const e = N();
      (await f(e),
        b(e),
        r() &&
          (x && clearTimeout(x),
          (x = setTimeout(async () => {
            try {
              await S({ forceTodaySubmitted: !0 });
            } catch (e) {
              e.message;
            } finally {
              x = null;
            }
          }, 2e3))));
    } catch (e) {
      e.message;
    }
  }),
    (window.checkAndCancelCheckinReminderForDate = async function (e) {
      try {
        await f(e);
        r() &&
          (x && (clearTimeout(x), (x = null)),
          (x = setTimeout(async () => {
            try {
              await S();
            } catch (e) {
              const t = `重新调度提醒失败: ${e.message || e}`;
              (console.error("[settings]", t), e.stack && e.stack);
            } finally {
              x = null;
            }
          }, 1e3)));
      } catch (e) {
        const t = `取消指定日期打卡提醒失败: ${e.message || e}`;
        (console.error("[settings]", t), e.stack && e.stack);
      }
    }));
  const I =
    ("undefined" != typeof window && window.__API_BASE__) ||
    "https://app.zdelf.cn";
  function getCurrentVersion() {
    try {
      if (!APP_VERSION || typeof APP_VERSION !== "string") {
        throw new Error("版本号配置无效");
      }
      console.log("[settings] 从配置获取版本:", APP_VERSION);
      return APP_VERSION;
    } catch (e) {
      console.warn("[settings] 获取版本信息失败:", e);
      return "1.0.0.0";
    }
  }
  function compareVersions(version1, version2) {
    try {
      if (!version1 || !version2) {
        throw new Error("版本号不能为空");
      }
      const v1parts = version1.split(".").map((part) => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
      });
      const v2parts = version2.split(".").map((part) => {
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
    } catch (e) {
      console.warn("[settings] 版本比较失败:", e);
      return 0;
    }
  }
  function clearAllCache() {
    try {
      console.log("[settings] 开始清除缓存...");
      const versionCacheKeys = [
        "version_check_cache",
        "version_data_cache",
        "app_version_cache",
        "server_version_cache",
      ];
      versionCacheKeys.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`[settings] 已清除localStorage缓存: ${key}`);
        }
      });
      versionCacheKeys.forEach((key) => {
        if (sessionStorage.getItem(key)) {
          sessionStorage.removeItem(key);
          console.log(`[settings] 已清除sessionStorage缓存: ${key}`);
        }
      });
      if ("caches" in window) {
        caches
          .keys()
          .then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
              if (
                cacheName.includes("version") ||
                cacheName.includes("app")
              ) {
                caches.delete(cacheName);
                console.log(`[settings] 已清除浏览器缓存: ${cacheName}`);
              }
            });
          })
          .catch((err) => {
            console.log("[settings] 清除浏览器缓存失败:", err);
          });
      }
      const timestamp = Date.now();
      console.log(`[settings] 缓存清除完成，时间戳: ${timestamp}`);
      return timestamp;
    } catch (e) {
      console.warn("[settings] 清除缓存时出错:", e);
      return Date.now();
    }
  }
  function ensureVersionModalStyles() {
    if (document.getElementById("version-modal-style")) return;
    const s = document.createElement("style");
    s.id = "version-modal-style";
    s.textContent = `
      .version-mask{position:fixed;inset:0;background:color-mix(in srgb, var(--text,#000) 20%, transparent);backdrop-filter:saturate(120%) blur(2px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;z-index:10000}
      .version-mask.show{opacity:1}
      .version-dialog{width:min(92vw,500px);background:var(--card,#fff);color:var(--text,#111);border-radius:16px;box-shadow:var(--shadow-3,0 10px 30px rgba(0,0,0,.15));transform:translateY(12px) scale(.98);opacity:0;transition:transform .2s ease,opacity .2s ease;border:1px solid var(--border,rgba(0,0,0,.06))}
      .version-dialog.show{transform:translateY(0) scale(1);opacity:1}
      .version-header{padding:20px 24px 16px;font-weight:700;font-size:18px;text-align:center;border-bottom:1px solid var(--divider,rgba(0,0,0,.1))}
      .version-body{padding:20px 24px;line-height:1.6;max-height:60vh;overflow-y:auto}
      .version-section{margin-bottom:20px}
      .version-section:last-child{margin-bottom:0}
      .version-compare{display:flex;justify-content:space-between;margin:20px 0;padding:15px;background:rgba(255,255,255,0.05);border-radius:8px}
      .version-item{text-align:center;flex:1}
      .version-label{font-size:14px;color:var(--text-secondary,#666);margin-bottom:5px}
      .version-value{font-size:18px;font-weight:bold}
      .version-changelog{margin-top:20px;padding:15px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.1)}
      .version-changelog-title{font-size:16px;font-weight:bold;margin-bottom:10px;color:#fff}
      .version-changelog-list{list-style:none;padding:0;margin:0}
      .version-changelog-list li{margin:4px 0;font-size:13px;color:#ccc}
      .download-buttons{display:flex;flex-direction:column;gap:12px;margin-top:20px}
      .download-btn{appearance:none;border:0;padding:14px 20px;border-radius:12px;cursor:pointer;font-size:15px;font-weight:600;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.2s ease;text-align:center}
      .download-btn-ios{background:linear-gradient(135deg,#000,#333);color:#fff}
      .download-btn-android{background:linear-gradient(135deg,#3ddc84,#2bb96b);color:#fff}
      .version-footer{display:flex;justify-content:center;padding:0 24px 20px}
      .version-btn{appearance:none;border:0;padding:12px 24px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;background:var(--brand,#1a73e8);color:#fff;transition:all 0.2s ease}
      .version-btn:hover{background:var(--brand-700,#1558b3);transform:translateY(-1px)}
      @media (prefers-color-scheme: dark){
        .version-mask{background:color-mix(in srgb,#000 50%, transparent)}
        .version-dialog{background:var(--card,#1e1f22);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.08))}
        .version-label{color:var(--text-secondary,#9aa3af)}
        .version-value{color:var(--text,#e6e6e6)}
      }
    `;
    document.head.appendChild(s);
    e.push(() => {
      if (s.parentNode) s.remove();
    });
  }
  async function checkVersionAndShowModal() {
    if (!VERSION_CHECK_CONFIG.enabled) {
      console.log("[settings] 版本检查已禁用");
      showDownloadModal();
      return;
    }
    const cacheTimestamp = clearAllCache();
    const currentVersion = getCurrentVersion();
    console.log("[settings] 获取到的当前版本:", currentVersion);
    ensureVersionModalStyles();
    const mask = document.createElement("div");
    mask.className = "version-mask";
    const dialog = document.createElement("div");
    dialog.className = "version-dialog";
    const header = document.createElement("div");
    header.className = "version-header";
    header.textContent = "检查更新中...";
    const body = document.createElement("div");
    body.className = "version-body";
    body.innerHTML = '<div style="text-align:center;padding:20px;">正在检查更新...</div>';
    const footer = document.createElement("div");
    footer.className = "version-footer";
    const closeBtn = document.createElement("button");
    closeBtn.className = "version-btn";
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
      o("Light");
      close();
    }, { once: !0 });
    mask.addEventListener("click", (e) => {
      if (e.target === mask) close();
    });
    document.addEventListener("keydown", function escHandler(ev) {
      if (ev.key === "Escape") {
        document.removeEventListener("keydown", escHandler);
        close();
      }
    });
    try {
      const serverUrl = VERSION_CHECK_CONFIG.serverUrl;
      const separator = serverUrl.includes("?") ? "&" : "?";
      const urlWithTimestamp = `${serverUrl}${separator}t=${cacheTimestamp}&_t=${Date.now()}`;
      console.log("[settings] 使用服务器URL:", urlWithTimestamp);
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        VERSION_CHECK_CONFIG.timeout,
      );
      let response;
      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.Http
      ) {
        const http = window.Capacitor.Plugins.Http;
        const httpResponse = await http.request({
          url: urlWithTimestamp,
          method: "GET",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });
        response = {
          ok: httpResponse.status >= 200 && httpResponse.status < 300,
          status: httpResponse.status,
          statusText: httpResponse.statusText || "OK",
          json: () => Promise.resolve(httpResponse.data),
        };
      } else {
        response = await fetch(urlWithTimestamp, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
          signal: controller.signal,
        });
      }
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(
          `网络请求失败: ${response.status} ${response.statusText}`,
        );
      }
      const versionData = await response.json();
      console.log("[settings] 获取到的版本数据:", versionData);
      const allVersions = versionData.versions;
      if (
        !allVersions ||
        !Array.isArray(allVersions) ||
        allVersions.length === 0
      ) {
        throw new Error("版本信息不完整");
      }
      const latestVersionInfo = allVersions[allVersions.length - 1];
      if (!latestVersionInfo || !latestVersionInfo.version) {
        throw new Error("版本信息不完整");
      }
      const serverVersion = latestVersionInfo.version;
      const relevantVersions = allVersions.filter((versionInfo) => {
        return compareVersions(currentVersion, versionInfo.version) < 0;
      });
      console.log("[settings] 当前版本:", currentVersion, "服务器版本:", serverVersion);
      const isLatest = compareVersions(currentVersion, serverVersion) >= 0;
      console.log("[settings] 是否最新版本:", isLatest);
      header.textContent = isLatest ? "版本信息" : "发现新版本";
      body.innerHTML = "";
      const versionInfo = document.createElement("div");
      versionInfo.className = "version-section";
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
      const versionCompare = document.createElement("div");
      versionCompare.className = "version-compare";
      const currentVersionDiv = document.createElement("div");
      currentVersionDiv.className = "version-item";
      const currentLabel = document.createElement("div");
      currentLabel.className = "version-label";
      currentLabel.textContent = "当前版本";
      const currentVersionText = document.createElement("div");
      currentVersionText.className = "version-value";
      currentVersionText.textContent = `v${currentVersion}`;
      currentVersionDiv.append(currentLabel, currentVersionText);
      const serverVersionDiv = document.createElement("div");
      serverVersionDiv.className = "version-item";
      const serverLabel = document.createElement("div");
      serverLabel.className = "version-label";
      serverLabel.textContent = "最新版本";
      const serverVersionText = document.createElement("div");
      serverVersionText.className = "version-value";
      serverVersionText.textContent = `v${serverVersion}`;
      serverVersionText.style.color = isLatest ? "#4CAF50" : "#FF9800";
      serverVersionDiv.append(serverLabel, serverVersionText);
      versionCompare.append(currentVersionDiv, serverVersionDiv);
      versionInfo.append(versionCompare);
      if (relevantVersions.length > 0) {
        const changelogDiv = document.createElement("div");
        changelogDiv.className = "version-changelog";
        const changelogTitle = document.createElement("div");
        changelogTitle.className = "version-changelog-title";
        changelogTitle.textContent =
          relevantVersions.length > 1 ? "版本更新内容" : "更新内容";
        const sortedVersions = relevantVersions.sort((a, b) =>
          compareVersions(a.version, b.version),
        );
        const changelogList = document.createElement("ul");
        changelogList.className = "version-changelog-list";
        sortedVersions.forEach((versionInfo) => {
          if (versionInfo.changes && versionInfo.changes.length > 0) {
            const versionTitle = document.createElement("li");
            versionTitle.style.fontWeight = "bold";
            versionTitle.style.color = "#4CAF50";
            versionTitle.textContent = `v${versionInfo.version} (${versionInfo.release_date || ""})`;
            changelogList.append(versionTitle);
            versionInfo.changes.forEach((change) => {
              const li = document.createElement("li");
              li.textContent = `• ${change}`;
              changelogList.append(li);
            });
          }
        });
        changelogDiv.append(changelogTitle, changelogList);
        versionInfo.append(changelogDiv);
      }
      const buttons = document.createElement("div");
      buttons.className = "download-buttons";
      if (!isLatest) {
        const iosBtn = document.createElement("a");
        iosBtn.className = "download-btn download-btn-ios";
        iosBtn.href =
          "https://apps.apple.com/cn/app/%E7%B4%AB%E7%99%9C%E7%B2%BE%E7%81%B5/id6749155721";
        iosBtn.target = "_blank";
        iosBtn.rel = "noopener noreferrer";
        iosBtn.innerHTML =
          '<ion-icon name="logo-apple"></ion-icon><span>iOS 下载</span>';
        const androidBtn = document.createElement("a");
        androidBtn.className = "download-btn download-btn-android";
        androidBtn.href = "https://zdelf.cn/share/app-release.apk";
        androidBtn.target = "_blank";
        androidBtn.rel = "noopener noreferrer";
        androidBtn.innerHTML =
          '<ion-icon name="logo-android"></ion-icon><span>Android 下载</span>';
        buttons.append(iosBtn, androidBtn);
        iosBtn.addEventListener("click", () => o("Medium"));
        androidBtn.addEventListener("click", () => o("Medium"));
      }
      body.append(versionInfo, buttons);
      e.push(() => {
        if (mask.parentNode) mask.remove();
      });
    } catch (error) {
      console.error("[settings] 版本检查失败:", error);
      header.textContent = "检查更新失败";
      body.innerHTML = `
        <div style="text-align:center;padding:20px;">
          <p style="color:var(--text-secondary,#666);margin-bottom:16px;">${error.message || "未知错误"}</p>
          <p style="color:var(--text-secondary,#666);font-size:14px;">请检查网络连接后重试</p>
        </div>
      `;
    }
  }
  function showDownloadModal() {
    ensureVersionModalStyles();
    const mask = document.createElement("div");
    mask.className = "version-mask";
    const dialog = document.createElement("div");
    dialog.className = "version-dialog";
    const header = document.createElement("div");
    header.className = "version-header";
    header.textContent = "下载应用";
    const body = document.createElement("div");
    body.className = "version-body";
    const section = document.createElement("div");
    section.className = "version-section";
    const text = document.createElement("p");
    text.textContent = "选择您的设备平台下载紫癜精灵：";
    section.append(text);
    const buttons = document.createElement("div");
    buttons.className = "download-buttons";
    const iosBtn = document.createElement("a");
    iosBtn.className = "download-btn download-btn-ios";
    iosBtn.href =
      "https://apps.apple.com/cn/app/%E7%B4%AB%E7%99%9C%E7%B2%BE%E7%81%B5/id6749155721";
    iosBtn.target = "_blank";
    iosBtn.rel = "noopener noreferrer";
    iosBtn.innerHTML =
      '<ion-icon name="logo-apple"></ion-icon><span>iOS 下载</span>';
    const androidBtn = document.createElement("a");
    androidBtn.className = "download-btn download-btn-android";
    androidBtn.href = "https://zdelf.cn/share/app-release.apk";
    androidBtn.target = "_blank";
    androidBtn.rel = "noopener noreferrer";
    androidBtn.innerHTML =
      '<ion-icon name="logo-android"></ion-icon><span>Android 下载</span>';
    buttons.append(iosBtn, androidBtn);
    body.append(section, buttons);
    const footer = document.createElement("div");
    footer.className = "version-footer";
    const closeBtn = document.createElement("button");
    closeBtn.className = "version-btn";
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
      o("Light");
      close();
    }, { once: !0 });
    mask.addEventListener("click", (e) => {
      if (e.target === mask) close();
    });
    document.addEventListener("keydown", function escHandler(ev) {
      if (ev.key === "Escape") {
        document.removeEventListener("keydown", escHandler);
        close();
      }
    });
    iosBtn.addEventListener("click", () => o("Medium"));
    androidBtn.addEventListener("click", () => o("Medium"));
    e.push(() => {
      if (mask.parentNode) mask.remove();
    });
  }
  function C() {
    return {
      storedId:
        localStorage.getItem("userId") ||
        sessionStorage.getItem("userId") ||
        localStorage.getItem("UserID") ||
        sessionStorage.getItem("UserID"),
      storedUsername:
        localStorage.getItem("username") ||
        localStorage.getItem("Username") ||
        sessionStorage.getItem("username") ||
        sessionStorage.getItem("Username"),
    };
  }
  function _() {
    console.log("[settings] 初始化设置页面");
    try {
      const e = !(
          !Capacitor ||
          "function" != typeof Capacitor.isNativePlatform ||
          !Capacitor.isNativePlatform() ||
          "function" != typeof Capacitor.getPlatform ||
          "ios" !== Capacitor.getPlatform()
        ),
        t = document.querySelector('[data-action="theme-preference"]');
      t && !e && (t.style.display = "none");
    } catch (e) {
      console.warn("[settings] 检测平台失败，隐藏主题模式设置:", e);
      const t = document.querySelector('[data-action="theme-preference"]');
      t && (t.style.display = "none");
    }
    const n = document.querySelector("#backBtn");
    if (n) {
      const t = () => {
        (o("Light"), window.history.back());
      };
      (n.addEventListener("click", t),
        e.push(() => n.removeEventListener("click", t)));
    }
    if (
      (document.querySelectorAll("[data-action]").forEach((n) => {
        const i = async () => {
          (o("Light"),
            "vibration" === n.dataset.action
              ? (function () {
                  s();
                  const t = document.createElement("div");
                  t.className = "vibration-mask";
                  const n = document.createElement("div");
                  n.className = "vibration-dialog";
                  const a = document.createElement("div");
                  ((a.className = "vibration-header"),
                    (a.textContent = "震动反馈设置"));
                  const i = document.createElement("div");
                  i.className = "vibration-body";
                  const r = document.createElement("div");
                  r.className = "vibration-section";
                  const c = document.createElement("h3");
                  c.textContent = "触觉反馈";
                  const l = document.createElement("p");
                  ((l.textContent =
                    "开启震动反馈可以在点击按钮、完成操作时提供触觉反馈，提升使用体验。"),
                    r.append(c, l));
                  const d = document.createElement("div");
                  d.className = "vibration-section";
                  const m = document.createElement("div");
                  m.className = "vibration-toggle";
                  const g = document.createElement("div");
                  g.className = "vibration-toggle-info";
                  const u = document.createElement("div");
                  ((u.className = "vibration-toggle-label"),
                    (u.textContent = "震动反馈"));
                  const p = document.createElement("div");
                  ((p.className = "vibration-toggle-desc"),
                    (p.textContent = "点击按钮时提供触觉反馈"),
                    g.append(u, p));
                  const h = document.createElement("button");
                  ((h.className = "vibration-switch"),
                    h.setAttribute("role", "switch"),
                    h.setAttribute("aria-label", "震动反馈开关"),
                    (function () {
                      const e = localStorage.getItem("vibration_enabled");
                      return null === e || "true" === e;
                    })()
                      ? (h.classList.add("active"),
                        h.setAttribute("aria-checked", "true"))
                      : h.setAttribute("aria-checked", "false"),
                    h.addEventListener("click", () => {
                      const e = !h.classList.contains("active");
                      var t;
                      (h.classList.toggle("active", e),
                        h.setAttribute("aria-checked", e.toString()),
                        (t = e),
                        localStorage.setItem("vibration_enabled", t.toString()),
                        e && o("Medium"));
                    }),
                    m.append(g, h),
                    d.append(m),
                    i.append(r, d));
                  const f = document.createElement("div");
                  f.className = "vibration-footer";
                  const v = document.createElement("button");
                  ((v.className = "vibration-btn"),
                    (v.textContent = "完成"),
                    f.append(v),
                    n.append(a, i, f),
                    t.appendChild(n),
                    document.body.appendChild(t),
                    requestAnimationFrame(() => {
                      (t.classList.add("show"), n.classList.add("show"));
                    }));
                  const b = () => {
                    (n.classList.remove("show"), t.classList.remove("show"));
                    const e = () => {
                      (t.removeEventListener("transitionend", e),
                        t.parentNode && t.remove());
                    };
                    t.addEventListener("transitionend", e);
                  };
                  (v.addEventListener(
                    "click",
                    () => {
                      (o("Light"), b());
                    },
                    { once: !0 },
                  ),
                    t.addEventListener("click", (e) => {
                      e.target === t && b();
                    }),
                    document.addEventListener("keydown", function e(t) {
                      "Escape" === t.key &&
                        (document.removeEventListener("keydown", e), b());
                    }),
                    e.push(() => {
                      t.parentNode && t.remove();
                    }));
                })()
              : "theme-preference" === n.dataset.action
                ? (function () {
                    s();
                    const t = document.createElement("div");
                    t.className = "vibration-mask";
                    const n = document.createElement("div");
                    n.className = "vibration-dialog";
                    const i = document.createElement("div");
                    ((i.className = "vibration-header"),
                      (i.textContent = "主题模式"));
                    const r = document.createElement("div");
                    r.className = "vibration-body";
                    const c = document.createElement("div");
                    c.className = "vibration-section";
                    const l = document.createElement("p");
                    l.textContent =
                      "选择深色、浅色或跟随系统的主题模式。支持的设备上将通过原生层进行切换。";
                    const d = document.createElement("p");
                    ((d.textContent =
                      "提示：主题切换目前仅在 App 原生客户端中生效，浏览器网页版暂不支持"),
                      (d.style.fontSize = "12px"),
                      (d.style.color = "var(--text-secondary, #999)"),
                      (d.style.marginTop = "6px"),
                      c.append(l, d));
                    const m = document.createElement("div");
                    ((m.className = "vibration-section"),
                      (m.style.marginBottom = "12px"));
                    const g = document.createElement("div");
                    ((g.style.display = "flex"),
                      (g.style.flexDirection = "column"),
                      (g.style.gap = "12px"));
                    const u = (function () {
                        try {
                          if (
                            window.ThemePreferenceManager &&
                            "function" ==
                              typeof window.ThemePreferenceManager.getPreference
                          )
                            return window.ThemePreferenceManager.getPreference();
                        } catch (e) {
                          console.warn(
                            "[settings] 获取主题偏好失败（使用本地存储回退）:",
                            e,
                          );
                        }
                        const e = localStorage.getItem("theme_preference_mode");
                        return ["system", "light", "dark"].includes(e)
                          ? e
                          : "system";
                      })(),
                      p = [],
                      h = (e) => {
                        p.forEach(
                          ({ button: t, checkmark: n, optionValue: a }) => {
                            const o = a === e;
                            (t.classList.toggle("active", o),
                              (n.style.opacity = o ? "1" : "0"),
                              (n.style.transform = o
                                ? "scale(1)"
                                : "scale(0.9)"),
                              (t.style.borderColor = o
                                ? "var(--brand, #1a73e8)"
                                : "var(--divider, rgba(0,0,0,.12))"),
                              (t.style.background = o
                                ? "var(--card, #f2f6ff)"
                                : "var(--surface, rgba(0,0,0,.04))"));
                          },
                        );
                      };
                    (a.forEach((e) => {
                      const t = document.createElement("button");
                      ((t.className = "theme-option-btn"),
                        (t.type = "button"),
                        (t.style.cssText =
                          "\n        width: 100%;\n        text-align: left;\n        border: 1px solid var(--divider, rgba(0,0,0,.12));\n        background: var(--surface, rgba(0,0,0,.04));\n        border-radius: 14px;\n        padding: 14px 16px;\n        display: flex;\n        align-items: center;\n        gap: 12px;\n        cursor: pointer;\n        transition: all 0.2s ease;\n      "));
                      const n = document.createElement("span");
                      ((n.textContent = "✓"),
                        (n.style.cssText =
                          "\n        width: 22px;\n        height: 22px;\n        display: inline-flex;\n        align-items: center;\n        justify-content: center;\n        border-radius: 999px;\n        background: var(--brand, #1a73e8);\n        color: #fff;\n        font-size: 12px;\n        font-weight: 700;\n        opacity: 0;\n        transform: scale(0.9);\n        transition: all 0.2s ease;\n      "));
                      const a = document.createElement("div");
                      a.style.flex = "1";
                      const i = document.createElement("div");
                      ((i.textContent = e.label),
                        (i.style.fontSize = "16px"),
                        (i.style.fontWeight = "600"),
                        (i.style.color = "var(--text, #111)"));
                      const s = document.createElement("div");
                      ((s.textContent = e.desc),
                        (s.style.fontSize = "14px"),
                        (s.style.color = "var(--text-secondary, #666)"),
                        (s.style.marginTop = "4px"),
                        a.append(i, s),
                        t.append(n, a),
                        t.addEventListener("mouseenter", () => {
                          ((t.style.transform = "translateY(-1px)"),
                            (t.style.boxShadow =
                              "0 8px 18px rgba(0,0,0,0.08)"));
                        }),
                        t.addEventListener("mouseleave", () => {
                          ((t.style.transform = "translateY(0)"),
                            (t.style.boxShadow = "none"));
                        }),
                        t.addEventListener("click", async () => {
                          o("Light");
                          const t = await (async function (e) {
                            const t = ["system", "light", "dark"].includes(e)
                              ? e
                              : "system";
                            try {
                              if (
                                window.ThemePreferenceManager &&
                                "function" ==
                                  typeof window.ThemePreferenceManager
                                    .setPreference
                              )
                                return await window.ThemePreferenceManager.setPreference(
                                  t,
                                );
                            } catch (e) {
                              console.warn(
                                "[settings] 设置主题偏好失败（使用网页样式回退）:",
                                e,
                              );
                            }
                            return (
                              localStorage.setItem("theme_preference_mode", t),
                              (document.documentElement.dataset.themePreference =
                                t),
                              t
                            );
                          })(e.value);
                          h(t);
                        }),
                        g.append(t),
                        p.push({
                          button: t,
                          checkmark: n,
                          optionValue: e.value,
                        }));
                    }),
                      h(u),
                      m.append(g),
                      r.append(c, m));
                    const f = document.createElement("div");
                    f.className = "vibration-footer";
                    const v = document.createElement("button");
                    ((v.className = "vibration-btn"),
                      (v.textContent = "完成"),
                      f.append(v),
                      n.append(i, r, f),
                      t.appendChild(n),
                      document.body.appendChild(t),
                      requestAnimationFrame(() => {
                        (t.classList.add("show"), n.classList.add("show"));
                      }));
                    const b = () => {
                      (n.classList.remove("show"), t.classList.remove("show"));
                      const e = () => {
                        (t.removeEventListener("transitionend", e),
                          t.parentNode && t.remove());
                      };
                      t.addEventListener("transitionend", e);
                    };
                    (v.addEventListener(
                      "click",
                      () => {
                        (o("Light"), b());
                      },
                      { once: !0 },
                    ),
                      t.addEventListener("click", (e) => {
                        e.target === t && b();
                      }),
                      document.addEventListener("keydown", function e(t) {
                        "Escape" === t.key &&
                          (document.removeEventListener("keydown", e), b());
                      }),
                      e.push(() => {
                        t.parentNode && t.remove();
                      }));
                  })()
                : "checkin-reminder" === n.dataset.action
                  ? (function () {
                      s();
                      const t = document.createElement("div");
                      t.className = "vibration-mask";
                      const n = document.createElement("div");
                      n.className = "vibration-dialog";
                      const a = document.createElement("div");
                      ((a.className = "vibration-header"),
                        (a.textContent = "打卡提醒设置"));
                      const i = document.createElement("div");
                      i.className = "vibration-body";
                      const g = document.createElement("div");
                      g.className = "vibration-section";
                      const u = document.createElement("p");
                      ((u.textContent =
                        "开启后，每日会在指定时间提醒您完成打卡。"),
                        g.append(u));
                      const h = document.createElement("div");
                      h.className = "vibration-section";
                      const f = document.createElement("div");
                      f.className = "vibration-toggle";
                      const v = document.createElement("div");
                      v.className = "vibration-toggle-info";
                      const b = document.createElement("div");
                      ((b.className = "vibration-toggle-label"),
                        (b.textContent = "开启打卡提醒"));
                      const w = document.createElement("div");
                      ((w.className = "vibration-toggle-desc"),
                        (w.textContent = "每日定时提醒完成打卡"),
                        v.append(b, w));
                      const y = document.createElement("button");
                      ((y.className = "vibration-switch"),
                        y.setAttribute("role", "switch"),
                        y.setAttribute("aria-label", "打卡提醒开关"));
                      const x = r();
                      x
                        ? (y.classList.add("active"),
                          y.setAttribute("aria-checked", "true"))
                        : y.setAttribute("aria-checked", "false");
                      const E = document.createElement("div");
                      ((E.className = "vibration-section"),
                        (E.style.cssText =
                          "\n      display: flex;\n      flex-direction: column;\n      align-items: center;\n      text-align: center;\n    "));
                      const L = document.createElement("div");
                      ((L.className = "vibration-toggle-label"),
                        (L.textContent = "提醒时间"),
                        (L.style.marginBottom = "12px"),
                        (L.style.textAlign = "center"));
                      const N = document.createElement("div");
                      ((N.className = "checkin-time-input-container"),
                        (N.style.cssText =
                          "\n      position: relative;\n      width: 80%;\n      max-width: 300px;\n      display: flex;\n      justify-content: center;\n    "));
                      const I = document.createElement("input");
                      ((I.type = "time"),
                        (I.value = l()),
                        (I.className = "checkin-time-input"),
                        (I.style.cssText =
                          "\n      width: 100%;\n      padding: 14px 16px;\n      font-size: 17px;\n      font-weight: 500;\n      border: 2px solid var(--divider, rgba(0,0,0,.12));\n      border-radius: 12px;\n      background: var(--surface, rgba(0,0,0,.04));\n      color: var(--text, #111);\n      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);\n      outline: none;\n      cursor: pointer;\n      box-sizing: border-box;\n      text-align: center;\n    "));
                      const C =
                          window.matchMedia &&
                          window.matchMedia("(prefers-color-scheme: dark)")
                            .matches,
                        _ = (e) => {
                          e
                            ? ((E.style.opacity = "1"),
                              (E.style.pointerEvents = "auto"),
                              (I.disabled = !1),
                              (I.style.borderColor = "var(--brand, #1a73e8)"),
                              (I.style.background = C
                                ? "rgba(255, 255, 255, 0.08)"
                                : "var(--card, #fff)"),
                              (I.style.color = C
                                ? "#e6e6e6"
                                : "var(--text, #111)"),
                              (I.style.cursor = "pointer"),
                              (I.style.opacity = "1"))
                            : ((E.style.opacity = "0.5"),
                              (E.style.pointerEvents = "none"),
                              (I.disabled = !0),
                              (I.style.borderColor = C
                                ? "rgba(255, 255, 255, 0.12)"
                                : "var(--divider, rgba(0,0,0,.12))"),
                              (I.style.background = C
                                ? "rgba(255, 255, 255, 0.04)"
                                : "var(--surface, rgba(0,0,0,.04))"),
                              (I.style.color = C
                                ? "rgba(230, 230, 230, 0.5)"
                                : "rgba(17, 17, 17, 0.4)"),
                              (I.style.cursor = "not-allowed"),
                              (I.style.opacity = "0.6"));
                        };
                      (_(x),
                        I.addEventListener("focus", () => {
                          I.disabled ||
                            ((I.style.borderColor = "var(--brand, #1a73e8)"),
                            (I.style.boxShadow = C
                              ? "0 0 0 3px rgba(26, 115, 232, 0.2)"
                              : "0 0 0 3px rgba(26, 115, 232, 0.1)"),
                            (I.style.background = C
                              ? "rgba(255, 255, 255, 0.1)"
                              : "var(--card, #fff)"));
                        }),
                        I.addEventListener("blur", () => {
                          if (!I.disabled) {
                            I.style.boxShadow = "none";
                            const e = r();
                            _(e);
                          }
                        }),
                        I.addEventListener("mouseenter", () => {
                          I.disabled ||
                            document.activeElement === I ||
                            (I.style.borderColor = "var(--brand, #1a73e8)");
                        }),
                        I.addEventListener("mouseleave", () => {
                          I.disabled ||
                            document.activeElement === I ||
                            (I.style.borderColor = C
                              ? "rgba(255, 255, 255, 0.12)"
                              : "var(--divider, rgba(0,0,0,.12))");
                        }),
                        I.addEventListener("change", async () => {
                          var e;
                          ((e = I.value),
                            l(),
                            localStorage.setItem("checkin_reminder_time", e),
                            r() && (await S()),
                            o("Light"));
                        }),
                        N.appendChild(I),
                        E.append(L, N),
                        y.addEventListener("click", async () => {
                          const e = !y.classList.contains("active");
                          if (
                            (y.classList.toggle("active", e),
                            y.setAttribute("aria-checked", e.toString()),
                            c(e),
                            _(e),
                            e)
                          ) {
                            if (!(await m()) && !(await d()))
                              return (
                                y.classList.remove("active"),
                                y.setAttribute("aria-checked", "false"),
                                c(!1),
                                _(!1),
                                void k(
                                  "需要通知权限才能开启打卡提醒，请在系统设置中开启通知权限",
                                )
                              );
                            (await S(), o("Medium"));
                          } else (await p(), o("Light"));
                        }),
                        f.append(v, y),
                        h.append(f),
                        i.append(g, h, E));
                      const $ = document.createElement("div");
                      $.className = "vibration-footer";
                      const D = document.createElement("button");
                      ((D.className = "vibration-btn"),
                        (D.textContent = "完成"),
                        $.append(D),
                        n.append(a, i, $),
                        t.appendChild(n),
                        document.body.appendChild(t),
                        requestAnimationFrame(() => {
                          (t.classList.add("show"), n.classList.add("show"));
                        }));
                      const A = () => {
                        (n.classList.remove("show"),
                          t.classList.remove("show"));
                        const e = () => {
                          (t.removeEventListener("transitionend", e),
                            t.parentNode && t.remove());
                        };
                        t.addEventListener("transitionend", e);
                      };
                      (D.addEventListener(
                        "click",
                        () => {
                          (o("Light"), A());
                        },
                        { once: !0 },
                      ),
                        t.addEventListener("click", (e) => {
                          e.target === t && A();
                        }),
                        document.addEventListener("keydown", function e(t) {
                          "Escape" === t.key &&
                            (document.removeEventListener("keydown", e), A());
                        }),
                        e.push(() => {
                          t.parentNode && t.remove();
                        }));
                    })()
                  : "streak-celebration" === n.dataset.action
                    ? (function () {
                        s();
                        const t = document.createElement("div");
                        t.className = "vibration-mask";
                        const n = document.createElement("div");
                        n.className = "vibration-dialog";
                        const a = document.createElement("div");
                        ((a.className = "vibration-header"),
                          (a.textContent = "连胜庆祝动画设置"));
                        const i = document.createElement("div");
                        i.className = "vibration-body";
                        const r = document.createElement("div");
                        r.className = "vibration-section";
                        const c = document.createElement("h3");
                        c.textContent = "庆祝动画";
                        const l = document.createElement("p");
                        ((l.textContent =
                          "开启后，在每天第一次完成记录时会显示连胜庆祝动画，鼓励你继续保持记录的好习惯。"),
                          r.append(c, l));
                        const d = document.createElement("div");
                        d.className = "vibration-section";
                        const m = document.createElement("div");
                        m.className = "vibration-toggle";
                        const g = document.createElement("div");
                        g.className = "vibration-toggle-info";
                        const u = document.createElement("div");
                        ((u.className = "vibration-toggle-label"),
                          (u.textContent = "开启庆祝动画"));
                        const p = document.createElement("div");
                        ((p.className = "vibration-toggle-desc"),
                          (p.textContent = "每天第一次记录时显示庆祝动画"),
                          g.append(u, p));
                        const h = document.createElement("button");
                        ((h.className = "vibration-switch"),
                          h.setAttribute("role", "switch"),
                          h.setAttribute("aria-label", "庆祝动画开关"),
                          (function () {
                            const e = localStorage.getItem(
                              "streak_celebration_enabled",
                            );
                            return null === e || "true" === e;
                          })()
                            ? (h.classList.add("active"),
                              h.setAttribute("aria-checked", "true"))
                            : h.setAttribute("aria-checked", "false"),
                          h.addEventListener("click", () => {
                            const e = !h.classList.contains("active");
                            var t;
                            (h.classList.toggle("active", e),
                              h.setAttribute("aria-checked", e.toString()),
                              (t = e),
                              localStorage.setItem(
                                "streak_celebration_enabled",
                                t.toString(),
                              ),
                              o("Light"));
                          }),
                          m.append(g, h),
                          d.append(m));
                        i.append(r, d);
                        const b = document.createElement("div");
                        b.className = "vibration-footer";
                        const w = document.createElement("button");
                        ((w.className = "vibration-btn"),
                          (w.textContent = "完成"),
                          b.append(w),
                          n.append(a, i, b),
                          t.appendChild(n),
                          document.body.appendChild(t),
                          requestAnimationFrame(() => {
                            (t.classList.add("show"), n.classList.add("show"));
                          }));
                        const y = () => {
                          (n.classList.remove("show"),
                            t.classList.remove("show"));
                          const e = () => {
                            (t.removeEventListener("transitionend", e),
                              t.parentNode && t.remove());
                          };
                          t.addEventListener("transitionend", e);
                        };
                        (w.addEventListener(
                          "click",
                          () => {
                            (o("Light"), y());
                          },
                          { once: !0 },
                        ),
                          t.addEventListener("click", (e) => {
                            e.target === t && y();
                          }),
                          document.addEventListener("keydown", function e(t) {
                            "Escape" === t.key &&
                              (document.removeEventListener("keydown", e), y());
                          }),
                          e.push(() => {
                            t.parentNode && t.remove();
                          }));
                      })()
                    : "debug-tools" === n.dataset.action
                      ? (function () {
                          s();
                          const t = document.createElement("div");
                          t.className = "vibration-mask";
                          const n = document.createElement("div");
                          n.className = "vibration-dialog";
                          const a = document.createElement("div");
                          ((a.className = "vibration-header"),
                            (a.textContent = "调试工具"));
                          const i = document.createElement("div");
                          i.className = "vibration-body";
                          const r = document.createElement("div");
                          r.className = "vibration-section";
                          const c = document.createElement("h3");
                          c.textContent = "调试选项";
                          const l = document.createElement("p");
                          ((l.textContent =
                            "开发者调试和测试工具，用于诊断和测试应用功能。"),
                            r.append(c, l));
                          const d = document.createElement("div");
                          d.className = "vibration-section";
                          const debugPageBtn = document.createElement("button");
                          ((debugPageBtn.className = "vibration-btn"),
                            (debugPageBtn.style.cssText =
                              "\n      width: 100%;\n      padding: 14px 20px;\n      background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);\n      border: none;\n      border-radius: 12px;\n      color: white;\n      font-size: 15px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: all 0.3s ease;\n      box-shadow: 0 4px 15px rgba(26, 115, 232, 0.4);\n      margin-top: 8px;\n    "),
                            (debugPageBtn.textContent = "消息推送调试"),
                            debugPageBtn.addEventListener("click", () => {
                              o("Light");
                              try {
                                // 构建完整 URL，确保无论当前在哪个目录都能正确跳转
                                const baseUrl = window.location.origin;
                                const debugPath = "/src/debug/notificationDebug.html";
                                const debugUrl = baseUrl + debugPath;
                                window.location.href = debugUrl;
                              } catch (e) {
                                console.error("[settings] 跳转到调试工具页面失败:", e);
                                // 回退：尝试使用相对路径（如果 navigateTo 可用）
                                if ("function" == typeof window.navigateTo) {
                                  window.navigateTo("src/debug/notificationDebug.html");
                                } else {
                                  window.location.href = "/src/debug/notificationDebug.html";
                                }
                              }
                            }),
                            debugPageBtn.addEventListener("mouseenter", () => {
                              ((debugPageBtn.style.transform = "translateY(-2px)"),
                                (debugPageBtn.style.boxShadow =
                                  "0 6px 20px rgba(26, 115, 232, 0.6)"));
                            }),
                            debugPageBtn.addEventListener("mouseleave", () => {
                              ((debugPageBtn.style.transform = "translateY(0)"),
                                (debugPageBtn.style.boxShadow =
                                  "0 4px 15px rgba(26, 115, 232, 0.4)"));
                            }),
                            d.append(debugPageBtn));
                          const f = document.createElement("div");
                          f.className = "vibration-section";
                          const v = document.createElement("button");
                          ((v.className = "vibration-btn"),
                            (v.style.cssText =
                              "\n      width: 100%;\n      padding: 14px 20px;\n      background: linear-gradient(135deg, #9333ea 0%, #a855f7 100%);\n      border: none;\n      border-radius: 12px;\n      color: white;\n      font-size: 15px;\n      font-weight: 600;\n      cursor: pointer;\n      transition: all 0.3s ease;\n      box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);\n      margin-top: 8px;\n    "),
                            (v.textContent = "庆祝动画调试"),
                            v.addEventListener("click", () => {
                              (o("Light"),
                                (window.location.href =
                                  "../../src/debug/streakCelebrationDebug.html"));
                            }),
                            v.addEventListener("mouseenter", () => {
                              ((v.style.transform = "translateY(-2px)"),
                                (v.style.boxShadow =
                                  "0 6px 20px rgba(147, 51, 234, 0.6)"));
                            }),
                            v.addEventListener("mouseleave", () => {
                              ((v.style.transform = "translateY(0)"),
                                (v.style.boxShadow =
                                  "0 4px 15px rgba(147, 51, 234, 0.4)"));
                            }),
                            f.append(v),
                            i.append(r, d, f));
                          const b = document.createElement("div");
                          b.className = "vibration-footer";
                          const w = document.createElement("button");
                          ((w.className = "vibration-btn"),
                            (w.textContent = "完成"),
                            b.append(w),
                            n.append(a, i, b),
                            t.appendChild(n),
                            document.body.appendChild(t),
                            requestAnimationFrame(() => {
                              (t.classList.add("show"), n.classList.add("show"));
                            }));
                          const y = () => {
                            (n.classList.remove("show"),
                              t.classList.remove("show"));
                            const e = () => {
                              (t.removeEventListener("transitionend", e),
                                t.parentNode && t.remove());
                            };
                            t.addEventListener("transitionend", e);
                          };
                          (w.addEventListener(
                            "click",
                            () => {
                              (o("Light"), y());
                            },
                            { once: !0 },
                          ),
                            t.addEventListener("click", (e) => {
                              e.target === t && y();
                            }),
                            document.addEventListener("keydown", function e(t) {
                              "Escape" === t.key &&
                                (document.removeEventListener("keydown", e), y());
                            }),
                            e.push(() => {
                              t.parentNode && t.remove();
                            }));
                        })()
                    : "disclaimer" === n.dataset.action
                      ? (function () {
                          o("Light");
                          (function () {
                            if (document.getElementById("disclaimer-modal-style"))
                              return;
                            const t = document.createElement("style");
                            ((t.id = "disclaimer-modal-style"),
                              (t.textContent =
                                "\n      .disclaimer-mask{position:fixed;inset:0;background:color-mix(in srgb, var(--text,#000) 20%, transparent);backdrop-filter:saturate(120%) blur(2px);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;z-index:10000}\n      .disclaimer-mask.show{opacity:1}\n      .disclaimer-dialog{width:min(92vw,500px);background:var(--card,#fff);color:var(--text,#111);border-radius:16px;box-shadow:var(--shadow-3,0 10px 30px rgba(0,0,0,.15));transform:translateY(12px) scale(.98);opacity:0;transition:transform .2s ease,opacity .2s ease;border:1px solid var(--border,rgba(0,0,0,.06))}\n      .disclaimer-dialog.show{transform:translateY(0) scale(1);opacity:1}\n      .disclaimer-header{padding:20px 24px 16px;font-weight:700;font-size:18px;text-align:center;border-bottom:1px solid var(--divider,rgba(0,0,0,.1))}\n      .disclaimer-body{padding:20px 24px;line-height:1.6;max-height:60vh;overflow-y:auto}\n      .disclaimer-section{margin-bottom:20px}\n      .disclaimer-section:last-child{margin-bottom:0}\n      .disclaimer-section h3{font-size:16px;font-weight:600;margin:0 0 12px 0;color:var(--text,#111)}\n      .disclaimer-section p{margin:0 0 8px 0;color:var(--text-secondary,#666)}\n      .disclaimer-section p:last-child{margin-bottom:0}\n      .disclaimer-section ul{margin:8px 0;padding-left:20px}\n      .disclaimer-section li{margin:4px 0;color:var(--text-secondary,#666);line-height:1.6}\n      .disclaimer-section li strong{color:var(--text,#111);font-weight:600}\n      .contact-info{background:linear-gradient(135deg,rgba(126,63,242,0.08),transparent);padding:16px;border-radius:12px;border:1px solid rgba(126,63,242,0.2)}\n      .contact-email{color:var(--brand,#1a73e8);font-weight:600;text-decoration:none;word-break:break-all}\n      .contact-email:hover{text-decoration:underline}\n      .disclaimer-footer{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 24px 20px;width:100%}\n      .disclaimer-btn{appearance:none;border:0;padding:12px 24px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;background:var(--brand,#1a73e8);color:#fff;transition:all 0.2s ease}\n      .disclaimer-btn:hover{background:var(--brand-700,#1558b3);transform:translateY(-1px)}\n      @media (prefers-color-scheme: dark){\n        .disclaimer-mask{background:color-mix(in srgb,#000 50%, transparent)}\n        .disclaimer-dialog{background:var(--card,#1e1f22);color:var(--text,#e6e6e6);border-color:var(--border,rgba(255,255,255,.08))}\n        .disclaimer-section h3{color:var(--text,#e6e6e6)}\n        .disclaimer-section p{color:var(--text-secondary,#9aa3af)}\n        .disclaimer-section li{color:var(--text-secondary,#9aa3af)}\n        .disclaimer-section li strong{color:var(--text,#e6e6e6)}\n        .contact-info{background:linear-gradient(135deg,rgba(126,63,242,0.15),transparent);border-color:rgba(126,63,242,0.3)}\n        .contact-email{color:var(--brand,#8ab4f8)}\n      }\n    "),
                              document.head.appendChild(t),
                              e.push(() => {
                                t.parentNode && t.remove();
                              }));
                          })();
                          const t = document.createElement("div");
                          t.className = "disclaimer-mask";
                          const n = document.createElement("div");
                          n.className = "disclaimer-dialog";
                          const a = document.createElement("div");
                          ((a.className = "disclaimer-header"),
                            (a.textContent = "关于与帮助"));
                          const i = document.createElement("div");
                          i.className = "disclaimer-body";
                          const aboutApp = document.createElement("div");
                          aboutApp.className = "disclaimer-section";
                          const aboutTitle = document.createElement("h3");
                          aboutTitle.textContent = "关于应用";
                          const aboutDesc = document.createElement("p");
                          aboutDesc.innerHTML = "本应用是一款专注于健康管理的工具，帮助您记录和追踪日常健康数据，包括饮食、指标、病例等信息。我们致力于为您提供便捷、安全的健康管理服务。";
                          aboutApp.append(aboutTitle, aboutDesc);
                          const usageGuide = document.createElement("div");
                          usageGuide.className = "disclaimer-section";
                          const guideTitle = document.createElement("h3");
                          guideTitle.textContent = "使用指南";
                          const guideDesc = document.createElement("p");
                          guideDesc.innerHTML = "快速了解如何使用本应用：";
                          const guideList = document.createElement("ul");
                          guideList.innerHTML =
                            "\n        <li><strong>每日打卡：</strong>记录您的饮食、健康指标和病例信息，建立完整的健康档案</li>\n        <li><strong>连续打卡：</strong>坚持每日记录可获得连续打卡天数，培养健康管理习惯</li>\n        <li><strong>广场互动：</strong>在广场中分享您的健康心得，与其他用户交流经验</li>\n        <li><strong>提醒设置：</strong>在设置中开启打卡提醒，不错过每日记录</li>\n        <li><strong>数据安全：</strong>您的所有数据都经过加密保护，只有您本人可以访问</li>\n      ";
                          usageGuide.append(guideTitle, guideDesc, guideList);
                          const privacy = document.createElement("div");
                          privacy.className = "disclaimer-section";
                          const privacyTitle = document.createElement("h3");
                          privacyTitle.textContent = "隐私保护";
                          const privacyDesc = document.createElement("p");
                          privacyDesc.innerHTML = "我们非常重视您的隐私安全，承诺：";
                          const privacyList = document.createElement("ul");
                          privacyList.innerHTML =
                            "\n        <li>严格加密保护您的个人健康数据，确保数据安全</li>\n        <li>不会向任何第三方泄露、出售或共享您的个人信息</li>\n        <li>仅在提供必要服务时收集和使用数据，遵循最小化原则</li>\n        <li>您拥有完全的数据控制权，可随时查看、修改或删除您的账户和数据</li>\n        <li>我们采用行业标准的安全措施，定期更新安全防护</li>\n      ";
                          privacy.append(privacyTitle, privacyDesc, privacyList);
                          const faq = document.createElement("div");
                          faq.className = "disclaimer-section";
                          const faqTitle = document.createElement("h3");
                          faqTitle.textContent = "常见问题";
                          const faqList = document.createElement("ul");
                          faqList.innerHTML =
                            "\n        <li><strong>如何修改个人资料？</strong><br>在「我的」页面点击「编辑资料」按钮即可修改年龄和密码</li>\n        <li><strong>忘记密码怎么办？</strong><br>可以使用手机号和验证码进行登录，经过app的「我的」页面点击「编辑资料」就可以更改密码</li>\n        <li><strong>数据会丢失吗？</strong><br>不会，您的数据都安全存储在服务器上，可随时访问</li>\n        <li><strong>如何删除账号？</strong><br>在设置页面点击「注销账号」，确认后即可永久删除账号及所有数据</li>\n        <li><strong>应用是免费的吗？</strong><br>是的，本应用完全免费使用，无任何隐藏收费</li>\n      ";
                          faq.append(faqTitle, faqList);
                          const important = document.createElement("div");
                          important.className = "disclaimer-section";
                          const importantTitle = document.createElement("h3");
                          importantTitle.textContent = "重要提示";
                          const importantDesc = document.createElement("p");
                          importantDesc.innerHTML = "为了您的健康安全，请注意：";
                          const importantList = document.createElement("ul");
                          importantList.innerHTML =
                            "\n        <li>本应用提供的信息和工具仅供参考，不能替代专业医疗诊断和治疗建议</li>\n        <li>如有健康问题或身体不适，请及时咨询专业医生或前往医院就诊</li>\n        <li>请理性对待应用中的健康建议，根据自身情况合理使用</li>\n        <li>我们不对因使用本应用而产生的任何医疗后果承担责任</li>\n      ";
                          important.append(importantTitle, importantDesc, importantList);
                          const contact = document.createElement("div");
                          contact.className = "disclaimer-section";
                          const contactTitle = document.createElement("h3");
                          contactTitle.textContent = "联系我们";
                          const contactInfo = document.createElement("div");
                          contactInfo.className = "contact-info";
                          const contactDesc = document.createElement("p");
                          contactDesc.textContent = "如有任何问题、建议或反馈，欢迎联系我们：";
                          const developer = document.createElement("p");
                          developer.innerHTML =
                            "开发者：鲍俊希 <a class='contact-email' href='mailto:junxibao2007@gmail.com'>junxibao2007@gmail.com</a>";
                          const designer = document.createElement("p");
                          designer.innerHTML =
                            "设计师：裘可然 <a class='contact-email' href='mailto:qiukhloe@gmail.com'>qiukhloe@gmail.com</a>";
                          contactInfo.append(contactDesc, developer, designer);
                          const icp = document.createElement("p");
                          icp.style.cssText = "font-size:12px;color:var(--text-secondary,#666);text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--divider,#e5e7eb)";
                          icp.textContent = "浙ICP备2023040285号-4A";
                          const copyright = document.createElement("p");
                          copyright.style.cssText = "font-size:12px;color:var(--text-secondary,#666);text-align:center;margin-top:8px";
                          copyright.textContent = "© 2025 JunxiBao. All rights reserved.";
                          contact.append(contactTitle, contactInfo, icp, copyright);
                          i.append(aboutApp, usageGuide, privacy, faq, important, contact);
                          const $ = document.createElement("div");
                          (($.className = "disclaimer-footer"),
                            ($.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:0 24px 20px"));
                          const D = document.createElement("button");
                          ((D.className = "disclaimer-btn"),
                            (D.textContent = "我已阅读并同意"),
                            $.append(D),
                            n.append(a, i, $),
                            t.appendChild(n),
                            document.body.appendChild(t),
                            requestAnimationFrame(() => {
                              (t.classList.add("show"), n.classList.add("show"));
                            }));
                          const A = () => {
                            (n.classList.remove("show"),
                              t.classList.remove("show"));
                            const e = () => {
                              (t.removeEventListener("transitionend", e),
                                t.parentNode && t.remove());
                            };
                            t.addEventListener("transitionend", e);
                          };
                          (D.addEventListener(
                            "click",
                            () => {
                              (o("Light"), A());
                            },
                            { once: !0 },
                          ),
                            t.addEventListener("click", (e) => {
                              e.target === t && A();
                            }),
                            document.addEventListener("keydown", function e(t) {
                              "Escape" === t.key &&
                                (document.removeEventListener("keydown", e), A());
                            }),
                            e.push(() => {
                              t.parentNode && t.remove();
                            }));
                        })()
                    : "check-update" === n.dataset.action
                      ? (function () {
                          o("Medium");
                          checkVersionAndShowModal();
                        })()
                    : "blocked-users" === n.dataset.action
                      ? (function () {
                          o("Light");
                          try {
                            "function" == typeof window.navigateTo
                              ? window.navigateTo("blocked_users.html")
                              : (window.location.href = "blocked_users.html");
                          } catch (e) {
                            console.error("[settings] 跳转到屏蔽用户页面失败:", e);
                            window.location.href = "blocked_users.html";
                          }
                        })()
                    : "logout" === n.dataset.action
                      ? await (async function () {
                          if ((o("Medium"), await E("确定要退出登录吗？")))
                            try {
                              const { storedId: e } = C();
                              if (
                                (["UserID", "userid", "userId"].forEach((e) => {
                                  (localStorage.removeItem(e),
                                    sessionStorage.removeItem(e));
                                }),
                                localStorage.removeItem("username"),
                                localStorage.removeItem("Username"),
                                localStorage.removeItem(
                                  "cached_username_userId",
                                ),
                                sessionStorage.removeItem("username"),
                                sessionStorage.removeItem("Username"),
                                "function" ==
                                  typeof window.clearSubmissionCache &&
                                  window.clearSubmissionCache(),
                                "function" ==
                                  typeof window.cancelAllNotifications)
                              )
                                try {
                                  await window.cancelAllNotifications();
                                } catch (e) {
                                  console.error(
                                    "[settings] 取消所有通知失败:",
                                    e,
                                  );
                                }
                              else if (
                                "function" ==
                                  typeof window.cancelAllCheckinReminders
                              )
                                try {
                                  await window.cancelAllCheckinReminders();
                                } catch (e) {
                                  console.error(
                                    "[settings] 取消打卡提醒通知失败:",
                                    e,
                                  );
                                }
                              else
                                try {
                                  if (t) {
                                    const e = [{ id: 10001 }, { id: 10002 }];
                                    await t.cancel({ notifications: e });
                                  }
                                } catch (e) {
                                  console.error(
                                    "[settings] 后备方案取消通知失败:",
                                    e,
                                  );
                                }
                              (localStorage.removeItem(
                                "checkin_reminder_enabled",
                              ),
                                localStorage.removeItem(
                                  "checkin_reminder_time",
                                ),
                                await new Promise((e) => setTimeout(e, 100)),
                                window.location.replace("login.html"));
                            } catch (e) {
                              (console.error(
                                "[settings] 退出登录时发生错误:",
                                e,
                              ),
                                k("退出登录时发生错误，请稍后再试"));
                            }
                        })()
                      : "delete-account" === n.dataset.action &&
                        (await (async function () {
                          if (
                            (o("Medium"),
                            !(await E(
                              "此操作将永久删除您的账号与相关数据，且不可恢复。是否继续？",
                            )))
                          )
                            return;
                          if (
                            !(await E(
                              "再次确认：真的要注销账号吗？此操作不可撤销。",
                            ))
                          )
                            return;
                          const e = document.querySelector(
                            '[data-action="delete-account"]',
                          );
                          if (e) {
                            e.disabled = !0;
                            const t = e.querySelector(".label");
                            t &&
                              ((e.dataset._label = t.textContent),
                              (t.textContent = "正在注销..."));
                          }
                          try {
                            const { storedId: n, storedUsername: a } = C(),
                              o = {};
                            n
                              ? (o.user_id = String(n))
                              : a && (o.username = String(a));
                            const i = await fetch(
                              I + "/account/delete_account",
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(o),
                              },
                            );
                            let s = null;
                            try {
                              s = await i.json();
                            } catch (e) {}
                            if (!i.ok || !s || !0 !== s.success) {
                              if (
                                (k(
                                  s && s.message
                                    ? s.message
                                    : "注销失败 (" + i.status + ")",
                                ),
                                e && e.dataset._label)
                              ) {
                                e.disabled = !1;
                                const t = e.querySelector(".label");
                                t && (t.textContent = e.dataset._label);
                              }
                              return;
                            }
                            try {
                              if (
                                ([
                                  "UserID",
                                  "userid",
                                  "userId",
                                  "Username",
                                  "username",
                                ].forEach((e) => {
                                  (localStorage.removeItem(e),
                                    sessionStorage.removeItem(e));
                                }),
                                "function" ==
                                  typeof window.clearSubmissionCache &&
                                  window.clearSubmissionCache(),
                                "function" ==
                                  typeof window.cancelAllNotifications)
                              )
                                try {
                                  await window.cancelAllNotifications();
                                } catch (e) {
                                  console.error(
                                    "[settings] 取消所有通知失败:",
                                    e,
                                  );
                                }
                              else if (
                                "function" ==
                                  typeof window.cancelAllCheckinReminders
                              )
                                try {
                                  await window.cancelAllCheckinReminders();
                                } catch (e) {
                                  console.error(
                                    "[settings] 取消打卡提醒通知失败:",
                                    e,
                                  );
                                }
                              else
                                try {
                                  if (t) {
                                    const e = [{ id: 10001 }, { id: 10002 }];
                                    await t.cancel({ notifications: e });
                                  }
                                } catch (e) {
                                  console.error(
                                    "[settings] 后备方案取消通知失败:",
                                    e,
                                  );
                                }
                              (localStorage.removeItem(
                                "checkin_reminder_enabled",
                              ),
                                localStorage.removeItem(
                                  "checkin_reminder_time",
                                ));
                            } catch (e) {
                              console.error(
                                "[settings] 注销账号时清理数据发生错误:",
                                e,
                              );
                            }
                            let r = "账号已注销";
                            if (s && s.deleted_counts) {
                              const e = s.deleted_counts,
                                t = [];
                              (e.metrics_files > 0 &&
                                t.push(`健康指标数据 ${e.metrics_files} 条`),
                                e.diet_files > 0 &&
                                  t.push(`饮食记录 ${e.diet_files} 条`),
                                e.case_files > 0 &&
                                  t.push(`病例记录 ${e.case_files} 条`),
                                e.sms_codes > 0 &&
                                  t.push(`短信记录 ${e.sms_codes} 条`),
                                t.length > 0 &&
                                  (r += `\n\n已删除相关数据：\n${t.join("\n")}`));
                            }
                            (!(function (e, t = "成功") {
                              window.ModalManager
                                ? window.ModalManager.alert(e, {
                                    title: t,
                                    confirmType: "success",
                                  })
                                : alert(e);
                            })(r),
                              setTimeout(() => {
                                window.location.replace("login.html");
                              }, 1500));
                          } catch (t) {
                            if (
                              (console.warn("[settings] 注销失败:", t),
                              k("网络错误或服务器异常，请稍后再试"),
                              e && e.dataset._label)
                            ) {
                              e.disabled = !1;
                              const t = e.querySelector(".label");
                              t && (t.textContent = e.dataset._label);
                            }
                          }
                        })()));
        };
        (n.addEventListener("click", i),
          e.push(() => n.removeEventListener("click", i)));
      }),
      document.querySelectorAll(".rippleable").forEach((t) => {
        (t.addEventListener("click", i),
          e.push(() => t.removeEventListener("click", i)));
      }),
      t && "function" == typeof t.addListener)
    )
      try {
        (t.addListener("localNotificationReceived", async (e) => {
          e &&
            e.extra &&
            "checkin_reminder" === e.extra.type &&
            console.log("[settings] 打卡提醒通知已触发:", e);
        }),
          t.addListener("localNotificationActionPerformed", async (e) => {
            const t = e?.notification;
            t &&
              t.extra &&
              "checkin_reminder" === t.extra.type &&
              console.log("[settings] 用户点击了打卡提醒通知:", t);
          }));
      } catch (e) {
        console.warn("[settings] 无法添加通知监听器:", e);
      }
  }
  ("loading" === document.readyState
    ? document.addEventListener("DOMContentLoaded", _)
    : _(),
    (window.initSettings = _),
    (window.destroySettings = function () {
      (console.log("[settings] 销毁设置页面"),
        e.forEach((e) => {
          try {
            e();
          } catch (e) {
            console.warn("[settings] 清理函数执行失败:", e);
          }
        }),
        (e = []));
    }));
})();
