!(function () {
  console.debug("[debug] debug.js evaluated");
  let e = [];
  let Capacitor = null;
  let LocalNotifications = null;

  try {
    Capacitor = window.Capacitor;
    if (
      Capacitor &&
      Capacitor.Plugins &&
      Capacitor.Plugins.LocalNotifications
    ) {
      LocalNotifications = Capacitor.Plugins.LocalNotifications;
      console.log("✅ [debug] Capacitor LocalNotifications 插件已加载");
    } else {
      console.warn("⚠️ [debug] Capacitor LocalNotifications 插件未找到");
    }
  } catch (e) {
    console.warn("⚠️ [debug] 无法加载Capacitor插件:", e);
  }

  function o(e = "Light", t = {}) {
    try {
      window.HapticManager
        ? window.HapticManager.impact(e, {
            context: "debug-page",
            debounce: 100,
            ...t,
          })
        : window.__hapticImpact__ && window.__hapticImpact__(e);
    } catch (e) {
      console.warn("震动反馈失败:", e);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "未知";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Shanghai",
      });
    } catch (e) {
      return dateString;
    }
  }

  function getNotificationType(notification) {
    if (!notification.extra) return "other";
    if (notification.extra.type === "checkin_reminder") return "checkin";
    if (notification.extra.reminderId) return "reminder";
    return "other";
  }

  function getNotificationTypeLabel(type) {
    const labels = {
      checkin: "打卡提醒",
      reminder: "用药提醒",
      other: "其他",
    };
    return labels[type] || "未知";
  }

  async function loadNotifications() {
    const container = document.getElementById("notificationsContainer");
    const statsContainer = document.getElementById("statsContainer");

    if (!container) {
      console.error("[debug] 未找到通知容器");
      return;
    }

    container.innerHTML = '<div class="loading">正在加载...</div>';

    if (!LocalNotifications) {
      container.innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">LocalNotifications 插件不可用</div></div>';
      if (statsContainer) statsContainer.innerHTML = "";
      return;
    }

    try {
      let notifications = [];
      if (typeof LocalNotifications.getPending === "function") {
        const result = await LocalNotifications.getPending();
        notifications =
          result && result.notifications ? result.notifications : [];
      } else {
        container.innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">getPending 方法不可用</div></div>';
        if (statsContainer) statsContainer.innerHTML = "";
        return;
      }

      console.log("[debug] 找到", notifications.length, "个预约通知");
      
      // 详细日志：显示所有打卡提醒的详细信息
      const checkinNotifications = notifications.filter(
        (n) => n.extra && n.extra.type === "checkin_reminder"
      );
      if (checkinNotifications.length > 0) {
        console.log("[debug] 打卡提醒详情:");
        checkinNotifications.forEach((n) => {
          console.log("[debug] - ID:", n.id, "目标日期:", n.extra.targetDate, "触发时间:", n.schedule?.at);
        });
      } else {
        console.log("[debug] ⚠️ 没有找到打卡提醒通知");
      }

      // 更新统计信息
      if (statsContainer) {
        const checkinCount = notifications.filter(
          (n) => n.extra && n.extra.type === "checkin_reminder"
        ).length;
        const reminderCount = notifications.filter(
          (n) => n.extra && n.extra.reminderId
        ).length;
        const otherCount = notifications.length - checkinCount - reminderCount;

        statsContainer.innerHTML = `
          <div class="stat-card">
            <div class="stat-value">${notifications.length}</div>
            <div class="stat-label">总计</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${checkinCount}</div>
            <div class="stat-label">打卡提醒</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${reminderCount}</div>
            <div class="stat-label">用药提醒</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${otherCount}</div>
            <div class="stat-label">其他</div>
          </div>
        `;
      }

      if (notifications.length === 0) {
        container.innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">没有预约的通知</div></div>';
        return;
      }

      // 按触发时间排序
      notifications.sort((a, b) => {
        const timeA = a.schedule?.at
          ? new Date(a.schedule.at).getTime()
          : 0;
        const timeB = b.schedule?.at
          ? new Date(b.schedule.at).getTime()
          : 0;
        return timeA - timeB;
      });

      const list = document.createElement("div");
      list.className = "notification-list";

      notifications.forEach((notification) => {
        const type = getNotificationType(notification);
        const typeLabel = getNotificationTypeLabel(type);
        const scheduleTime = notification.schedule?.at
          ? formatDate(notification.schedule.at)
          : "未知";
        const title = notification.title || "无标题";
        const body = notification.body || "无内容";

        const item = document.createElement("div");
        item.className = "notification-item";

        const header = document.createElement("div");
        header.className = "notification-item-header";
        header.innerHTML = `
          <span class="notification-id">ID: ${notification.id}</span>
          <span class="notification-type ${type}">${typeLabel}</span>
        `;

        const details = document.createElement("div");
        details.className = "notification-details";
        details.innerHTML = `
          <div class="notification-detail-row">
            <span class="notification-detail-label">标题:</span>
            <span class="notification-detail-value">${title}</span>
          </div>
          <div class="notification-detail-row">
            <span class="notification-detail-label">内容:</span>
            <span class="notification-detail-value">${body}</span>
          </div>
          <div class="notification-detail-row">
            <span class="notification-detail-label">触发时间:</span>
            <span class="notification-detail-value notification-schedule">${scheduleTime}</span>
          </div>
        `;

        // 添加额外信息
        if (notification.extra) {
          const extraDiv = document.createElement("div");
          extraDiv.className = "notification-details";
          extraDiv.style.marginTop = "8px";
          extraDiv.style.paddingTop = "8px";
          extraDiv.style.borderTop = "1px solid var(--divider)";

          let extraHtml = '<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">额外信息:</div>';

          if (notification.extra.type) {
            extraHtml += `
              <div class="notification-detail-row">
                <span class="notification-detail-label">类型:</span>
                <span class="notification-detail-value">${notification.extra.type}</span>
              </div>
            `;
          }

          if (notification.extra.targetDate) {
            extraHtml += `
              <div class="notification-detail-row">
                <span class="notification-detail-label">目标日期:</span>
                <span class="notification-detail-value">${notification.extra.targetDate}</span>
              </div>
            `;
          }

          if (notification.extra.reminderId) {
            extraHtml += `
              <div class="notification-detail-row">
                <span class="notification-detail-label">提醒ID:</span>
                <span class="notification-detail-value">${notification.extra.reminderId}</span>
              </div>
            `;
          }

          if (notification.extra.dateOffset !== undefined) {
            extraHtml += `
              <div class="notification-detail-row">
                <span class="notification-detail-label">日期偏移:</span>
                <span class="notification-detail-value">${notification.extra.dateOffset}</span>
              </div>
            `;
          }

          // 显示所有其他额外信息
          Object.keys(notification.extra).forEach((key) => {
            if (
              !["type", "targetDate", "reminderId", "dateOffset"].includes(
                key
              )
            ) {
              extraHtml += `
                <div class="notification-detail-row">
                  <span class="notification-detail-label">${key}:</span>
                  <span class="notification-detail-value">${JSON.stringify(notification.extra[key])}</span>
                </div>
              `;
            }
          });

          extraDiv.innerHTML = extraHtml;
          details.appendChild(extraDiv);
        }

        item.appendChild(header);
        item.appendChild(details);
        list.appendChild(item);
      });

      container.innerHTML = "";
      container.appendChild(list);
    } catch (error) {
      console.error("[debug] 加载通知失败:", error);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <div class="empty-state-text">加载失败: ${error.message || error}</div>
        </div>
      `;
      if (statsContainer) statsContainer.innerHTML = "";
    }
  }

  window.initDebug = function (t) {
    const c = t || document;
    console.log("[debug] ========== initDebug初始化开始 ==========");

    const backBtn = c.querySelector("#backBtn");
    if (backBtn) {
      const handleBack = () => {
        o("Light");
        window.history.back();
      };
      backBtn.addEventListener("click", handleBack);
      e.push(() => backBtn.removeEventListener("click", handleBack));
    }

    const refreshBtn = c.querySelector("#refreshBtn");
    if (refreshBtn) {
      const handleRefresh = () => {
        o("Medium");
        loadNotifications();
      };
      refreshBtn.addEventListener("click", handleRefresh);
      e.push(() => refreshBtn.removeEventListener("click", handleRefresh));
    }

    // 初始化加载通知列表
    loadNotifications();
  };

  window.destroyDebug = function () {
    console.log("[debug] 销毁调试页面");
    e.forEach((e) => {
      try {
        e();
      } catch (e) {
        console.warn("[debug] 清理函数执行失败:", e);
      }
    });
    e = [];
  };

  // 自动初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      window.initDebug();
    });
  } else {
    window.initDebug();
  }
})();



