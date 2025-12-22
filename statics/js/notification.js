/**
 * notification.js — Logic for the "Reminder" / 用药提醒 page
 * 用药提醒页面逻辑
 *
 * Responsibilities:
 * - 用药提醒管理（添加、编辑、删除）
 * - 本地存储持久化
 * - 提醒通知（基于时间）- 使用Capacitor本地通知插件
 * - Provide initCase(rootEl) / destroyCase() lifecycle for dynamic page loader
 *
 * Supports both:
 * - Standalone HTML usage (rootEl = document)
 * - Shadow DOM injection (rootEl = ShadowRoot)
 */
(function () {
  console.debug("[reminder] notification.js evaluated");
  if (typeof window !== 'undefined') {
    if (window.__notification_loaded__) {
      console.debug('[reminder] notification.js already loaded, skip');
      return;
    }
    window.__notification_loaded__ = true;
  }

  // Capacitor LocalNotifications 插件
  let LocalNotifications = null;
  let Capacitor = null;
  let listenersBound = false; // 防重复绑定监听器

  // Backend API base: absolute by default; can be overridden via window.__API_BASE__
  const __API_BASE_DEFAULT__ = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
  const __API_BASE__ = __API_BASE_DEFAULT__ && __API_BASE_DEFAULT__.endsWith('/')
    ? __API_BASE_DEFAULT__.slice(0, -1)
    : __API_BASE_DEFAULT__;

  // 尝试导入Capacitor插件
  try {
    Capacitor = window.Capacitor;
    if (Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
      LocalNotifications = Capacitor.Plugins.LocalNotifications;
      // 检查是否是浏览器通知封装
      const isBrowserNotification = LocalNotifications && typeof LocalNotifications._showNotification === 'function';
      if (isBrowserNotification) {
        console.log('✅ 浏览器通知封装已加载，将使用浏览器原生通知');
      } else {
        console.log('✅ Capacitor LocalNotifications 插件已加载');
      }
    } else {
      console.warn('⚠️ LocalNotifications 插件未找到');
    }
  } catch (error) {
    console.warn('⚠️ 无法加载通知插件:', error);
  }

  // Array of teardown callbacks to run when leaving the page
  let cleanupFns = [];

  // 提醒数据
  let reminders = [];
  let editingReminderId = null;
  let pendingDeleteId = null; // 待删除的提醒ID
  let reminderTimeouts = new Map(); // 存储定时器引用（fallback用）
  let uiAdvanceTimeouts = new Map(); // 仅用于UI推进的定时器（原生调度时使用）
  let currentRoot = null; // 当前的Shadow Root引用
  let isSettingUpReminders = false; // 防止重复设置提醒
  let sentNotifications = new Set(); // 防止重复发送通知
  let lastNotificationTime = new Map(); // 记录最后发送通知的时间
  let handledNotificationIds = new Set(); // 已处理的本地通知ID，避免重复推进
  let isActiveReminderView = false; // 是否在提醒页面处于激活状态（由 init/destroy 控制）
  let allowedFireAt = new Map(); // 允许触发的时间窗口：reminderId -> epoch ms（今天最近一次）
  let scheduledNotificationIds = new Set(); // 已调度的通知ID，防止重复调度
  let notificationCooldown = new Map(); // 通知冷却期管理

  // 预排程配置（滚动窗口）
  const ROLLING_SCHEDULE_DAYS = 7; // 未来预排程的天数窗口
  const MAX_SCHEDULE_PER_REMINDER = 32; // 每个提醒最多同时挂起的原生通知数
  const MAX_SCHEDULE_TOTAL = 64; // 全局最多同时挂起的原生通知数（iOS上常见限制）
  const CANCEL_LOOKAHEAD_DAYS = ROLLING_SCHEDULE_DAYS + 14; // 取消兜底向前看天数

  // 依据提醒ID生成稳定的数字通知ID，避免重复调度
  function stableIdFromString(str) {
    try {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // 32位
      }
      hash = Math.abs(hash);
      return hash === 0 ? 1 : hash; // 避免0
    } catch (_) {
      return Math.floor(Math.random() * 900000) + 100000;
    }
  }

  // 日期格式化：YYYY-MM-DD（本地时区）
  function formatDateYMD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 生成未来一段时间内的触发时间点（按启用的 dailyTimes），不含过去时刻
  function enumerateUpcomingOccurrences(reminder, fromTime, maxDays, perReminderCap) {
    const occurrences = [];
    if (!(reminder && reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0)) return occurrences;
    const enabledTimes = [...reminder.dailyTimes].filter(Boolean).filter(t => isTimeEnabled(reminder, t)).sort();
    if (enabledTimes.length === 0) return occurrences;

    const now = new Date(fromTime);
    const startBoundary = reminder.startDate ? new Date(`${reminder.startDate}T00:00:00`) : null;
    const endBoundary = reminder.endDate ? new Date(`${reminder.endDate}T23:59:59`) : null;

    for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + dayOffset);
      if (startBoundary && day < startBoundary) continue;
      if (endBoundary && day > endBoundary) break;

      const ymd = formatDateYMD(day);
      for (const t of enabledTimes) {
        const at = new Date(`${ymd}T${t}:00`);
        if (at <= now) continue; // 跳过过去时刻
        if (endBoundary && at > endBoundary) continue;
        occurrences.push(at);
        if (occurrences.length >= perReminderCap) return occurrences;
      }
    }
    return occurrences;
  }

  // 不考虑启用状态，枚举未来一段时间内的所有可能时间点（用于取消兜底）
  function enumerateOccurrencesAllTimes(reminder, fromTime, maxDays, perReminderCap) {
    const occurrences = [];
    if (!(reminder && reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0)) return occurrences;
    const allTimes = [...reminder.dailyTimes].filter(Boolean).sort();
    if (allTimes.length === 0) return occurrences;

    const now = new Date(fromTime);
    const startBoundary = reminder.startDate ? new Date(`${reminder.startDate}T00:00:00`) : null;
    const endBoundary = reminder.endDate ? new Date(`${reminder.endDate}T23:59:59`) : null;

    for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + dayOffset);
      if (startBoundary && day < startBoundary) continue;
      if (endBoundary && day > endBoundary) break;

      const ymd = formatDateYMD(day);
      for (const t of allTimes) {
        const at = new Date(`${ymd}T${t}:00`);
        if (at <= now) continue;
        if (endBoundary && at > endBoundary) continue;
        occurrences.push(at);
        if (occurrences.length >= perReminderCap) return occurrences;
      }
    }
    return occurrences;
  }

  // 构建一个原生通知对象（带日期+时间唯一ID）
  function buildScheduledNotification(reminder, at, title, body) {
    const dateStr = formatDateYMD(at);
    const timeStr = at.toTimeString().slice(0, 5); // HH:MM
    const idKey = `${reminder.id}|${dateStr}|${timeStr}`;
    return {
      id: stableIdFromString(idKey),
      title,
      body,
      schedule: { at },
      sound: 'default',
      actionTypeId: 'medication_reminder',
      extra: {
        reminderId: reminder.id,
        medicationName: reminder.name,
        plannedAt: at.getTime(),
        dateStr,
        timeStr
      }
    };
  }

  // 取消某个提醒下的所有待触发原生通知（优先使用 getPending）
  // 重要：此函数只取消用药提醒，绝不取消打卡提醒
  async function cancelAllScheduledForReminder(reminderId) {
    if (!LocalNotifications) return;
    try {
      if (typeof LocalNotifications.getPending === 'function') {
        const pending = await LocalNotifications.getPending();
        const toCancel = (pending && pending.notifications ? pending.notifications : [])
          .filter(n => {
            // 严格过滤：只取消用药提醒，绝不取消打卡提醒
            if (!n || !n.extra) return false;
            // 确保是用药提醒（有 reminderId 且不是打卡提醒）
            if (n.extra.type === 'checkin_reminder') {
              console.warn('[notification] ⚠️ 保护：检测到打卡提醒，跳过取消', n.id);
              return false;
            }
            // 只取消匹配 reminderId 的用药提醒
            return n.extra.reminderId === reminderId;
          })
          .map(n => ({ id: n.id }));
        if (toCancel.length > 0) {
          try { 
            await LocalNotifications.cancel({ notifications: toCancel }); 
            console.log('[notification] ✅ 已取消', toCancel.length, '个用药提醒通知（reminderId:', reminderId, '）');
          } catch (e) { 
            console.error('[notification] ❌ 取消用药提醒失败:', e);
          }
        }
      } else {
        // 兜底：无法获取待排队列表时，按日期+时间规则推断一批未来ID进行取消
        // 注意：此方法只取消用药提醒的ID，不会影响打卡提醒
        const r = reminders.find(x => x.id === reminderId);
        if (r && Array.isArray(r.dailyTimes) && r.dailyTimes.length > 0) {
          const occ = enumerateOccurrencesAllTimes(r, new Date(), CANCEL_LOOKAHEAD_DAYS, 256);
          const cancelIds = occ.map(at => {
            const dateStr = formatDateYMD(at);
            const timeStr = at.toTimeString().slice(0, 5);
            return { id: stableIdFromString(`${reminderId}|${dateStr}|${timeStr}`) };
          });
          // 兼容旧ID
          cancelIds.push({ id: stableIdFromString(reminderId) });
          r.dailyTimes.filter(Boolean).forEach(t => cancelIds.push({ id: stableIdFromString(reminderId + '|' + t) }));
          if (cancelIds.length > 0) {
            try { 
              await LocalNotifications.cancel({ notifications: cancelIds }); 
              console.log('[notification] ✅ 已取消', cancelIds.length, '个用药提醒通知（兜底方案，reminderId:', reminderId, '）');
            } catch (e) { 
              console.error('[notification] ❌ 取消用药提醒失败（兜底方案）:', e);
            }
          }
        }
      }
    } catch (e) { 
      console.error('[notification] ❌ cancelAllScheduledForReminder 执行失败:', e);
    }
  }

  // 分批调度，避免一次性过大数组
  async function scheduleNotificationsChunked(notifications, chunkSize = 16) {
    if (!LocalNotifications || !Array.isArray(notifications) || notifications.length === 0) return;
    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize);
      try { await LocalNotifications.schedule({ notifications: chunk }); } catch (e) { console.error('❌ 调度分批失败:', e); throw e; }
    }
  }

  // 内部硬删除：不弹确认，直接删除指定提醒
  async function hardDeleteReminder(reminderId) {
    try {
      // 定位当前提醒
      const target = reminders.find(r => r.id === reminderId);
      // 清理fallback定时器
      if (reminderTimeouts.has(reminderId)) { clearTimeout(reminderTimeouts.get(reminderId)); reminderTimeouts.delete(reminderId); }
      // 清理所有该提醒相关的"按时间点"定时器
      [...reminderTimeouts.keys()].forEach(key => {
        if (typeof key === 'string' && key.startsWith(reminderId + '|')) {
          clearTimeout(reminderTimeouts.get(key));
          reminderTimeouts.delete(key);
        }
      });
      // 清理UI推进定时器
      if (uiAdvanceTimeouts.has(reminderId)) {
        clearTimeout(uiAdvanceTimeouts.get(reminderId));
        uiAdvanceTimeouts.delete(reminderId);
      }
      // 清理允许窗口
      if (allowedFireAt.has(reminderId)) allowedFireAt.delete(reminderId);
      // 取消原生通知（包括日期+时间预排程）
      // cancelAllScheduledForReminder 已经处理了所有相关的通知取消，包括通过 getPending 过滤和兜底方案
      await cancelAllScheduledForReminder(reminderId);
      // 移除数据、保存并刷新
      reminders = reminders.filter(r => r.id !== reminderId);
      saveReminders();
      if (currentRoot) renderReminders(currentRoot);
    } catch (e) {
      console.error('硬删除提醒失败:', e);
    }
  }

  // 存储键名
  const STORAGE_KEY = 'medication_reminders';

  // 震动反馈函数
  function hapticFeedback(style = 'Light') {
    try { window.__hapticImpact__ && window.__hapticImpact__(style); } catch (_) { }
  }

  // 判断某个具体时间点是否启用（向后兼容：未设置映射时默认启用）
  function isTimeEnabled(reminder, timeHHMM) {
    if (!reminder) return false;
    const map = reminder.dailyTimeEnabled;
    if (!map || typeof map !== 'object') return true;
    if (Object.prototype.hasOwnProperty.call(map, timeHHMM)) {
      return !!map[timeHHMM];
    }
    return true;
  }

  /**
   * 根据当前时间返回有趣的问候语
   */
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 8) return "🌅 早安，今天不要忘记吃药～"; // Very early morning
    if (hour >= 8 && hour < 12) return "☀️ 早上好，该吃药啦"; // Morning
    if (hour >= 12 && hour < 14) return "🌞 中午好，吃药时间到"; // Noon
    if (hour >= 14 && hour < 17) return "⛅ 下午好，不要忘记吃药哦"; // Afternoon
    if (hour >= 17 && hour < 19) return "🌆 黄昏好，坚持吃药哦"; // Evening
    if (hour >= 19 && hour < 22) return "🌙 晚上好，睡觉前记得吃药哦"; // Night
    if (hour >= 22 || hour < 2) return "🌃 夜深了，赶紧吃药睡觉哦"; // Late night
    return "🕐 嘿，时间过得真快，又该吃药啦"; // Default
  }

  // 根据指定时间返回问候语（用于预排程按目标时刻选择合适问候）
  function getGreetingAt(date) {
    try {
      const hour = (date instanceof Date ? date : new Date(date)).getHours();
      if (hour >= 5 && hour < 8) return "🌅 早安，今天不要忘记吃药～";
      if (hour >= 8 && hour < 12) return "☀️ 早上好，该吃药啦";
      if (hour >= 12 && hour < 14) return "🌞 中午好，吃药时间到";
      if (hour >= 14 && hour < 17) return "⛅ 下午好，不要忘记吃药哦";
      if (hour >= 17 && hour < 19) return "🌆 黄昏好，坚持吃药哦";
      if (hour >= 19 && hour < 22) return "🌙 晚上好，睡觉前记得吃药哦";
      if (hour >= 22 || hour < 2) return "🌃 夜深了，赶紧吃药睡觉哦";
      return "🕐 嘿，时间过得真快，又该吃药啦";
    } catch (_) {
      return getGreeting();
    }
  }

  // 工具函数：Promise化获取用户名
  async function getUsernameAsync() {
    return await new Promise((resolve) => {
      try { getUsername((name) => resolve(name || '访客')); } catch (_) { resolve('访客'); }
    });
  }

  // 工具函数：构建通知标题
  function buildNotificationTitle() {
    return getGreeting();
  }

  // 工具函数：构建通知内容
  function buildNotificationBody(username, reminder) {
    const medicationName = (reminder && reminder.name) ? reminder.name : '药品';
    let body = `嘿，${username}！该吃${medicationName}啦`;
    if (reminder && reminder.dosage) {
      body += `，记得吃 ${reminder.dosage}`;
    }
    return body;
  }

  /**
   * 获取用户名
   */
  function getUsername(callback) {
    const userId = localStorage.getItem('userId');

    if (!userId || userId === 'undefined' || userId === 'null') {
      callback('访客');
      return;
    }

    // 请求后端获取用户信息
    fetch(__API_BASE__ + '/readdata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_name: 'users', user_id: userId }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        return response.json();
      })
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const username = data.data[0].username || '访客';
          callback(username);
        } else {
          callback('访客');
        }
      })
      .catch((error) => {
        console.error('❌ 获取用户信息失败:', error);
        callback('访客');
      });
  }


  /**
   * Initialize the "Reminder" page UI.
   * @param {Document|ShadowRoot} rootEl - Scope for DOM queries.
   */
  async function initCase(rootEl) {
    console.log('🚀 initCase 开始执行', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
    const root = rootEl || document;
    currentRoot = root; // 存储当前的root引用
    isActiveReminderView = true;

    // 加载保存的提醒数据
    loadReminders();

    // 先补齐已过期的提醒到下一次
    catchUpOverdueReminders();

    // 设置日期输入框的最小值为今天，防止选择过去的日期（使用本地时间）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    const startDateInput = root.getElementById('startDate');
    const endDateInput = root.getElementById('endDate');

    if (startDateInput) {
      startDateInput.min = today;
      startDateInput.value = today; // 设置默认值为今天
      console.log('📅 设置开始日期默认值和最小值为今天:', today);
    }
    if (endDateInput) {
      endDateInput.min = today;
      endDateInput.value = today; // 设置默认值为今天
      console.log('📅 设置结束日期默认值和最小值为今天:', today);
    }

    // 绑定事件监听器
    bindEvents(root);

    // 请求通知权限
    const hasPermission = await requestNotificationPermission();
    console.log('🔍 通知权限状态:', hasPermission);

    // 渲染提醒列表
    renderReminders(root);

    // 设置提醒定时器
    await setupReminders();

    console.log('✅ initCase 执行，用药提醒页面已初始化');
  }

  /**
   * 绑定所有事件监听器
   */
  function bindEvents(root) {
    // 添加提醒按钮 - 注意：这个按钮是在 renderReminders 中动态创建的
    // 所以这里不需要绑定，事件绑定在 renderReminders 中处理

    // 注意：模态框是动态创建的，所以这里不需要绑定静态HTML中的事件
    // 所有模态框相关的事件绑定都在 openModal 和 bindReminderFormEvents 中处理

    // 所有表单相关的事件绑定都在动态创建的模态框中处理
  }

  /**
   * 从本地存储加载提醒数据
   */
  function loadReminders() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        reminders = JSON.parse(stored);
        console.log('📦 加载了', reminders.length, '个提醒');
      } else {
        reminders = [];
        console.log('📦 没有找到保存的提醒数据');
      }
    } catch (error) {
      console.error('❌ 加载提醒数据失败:', error);
      reminders = [];
    }
  }

  /**
   * 保存提醒数据到本地存储
   */
  function saveReminders() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
      console.log('💾 保存了', reminders.length, '个提醒');
    } catch (error) {
      console.error('❌ 保存提醒数据失败:', error);
    }
  }

  /**
   * 渲染提醒列表
   */
  function renderReminders(root) {
    const container = root.getElementById('remindersContainer');
    if (!container) return;

    if (reminders.length === 0) {
      container.innerHTML = `
        <div class="empty-state" id="emptyAddCard" style="cursor:pointer;">
          <div class="icon">💊</div>
          <h3>还没有用药提醒</h3>
          <p>点击此方框添加您的第一个药提醒</p>
        </div>
      `;
      // 绑定点击打开新增提醒
      const emptyCard = container.querySelector('#emptyAddCard');
      if (emptyCard) {
        const emptyClick = () => { hapticFeedback('Light'); openModal(currentRoot || document); };
        emptyCard.addEventListener('click', emptyClick);
      }
      return;
    }

    // 按日期+时间排序（若有dailyTimes按第一项参与排序）
    const sortedReminders = [...reminders].sort((a, b) => {
      const dateA = a.startDate || '1970-01-01';
      const dateB = b.startDate || '1970-01-01';
      const timeA = (Array.isArray(a.dailyTimes) && a.dailyTimes[0]) || '00:00';
      const timeB = (Array.isArray(b.dailyTimes) && b.dailyTimes[0]) || '00:00';
      const isoA = `${dateA}T${timeA}:00`;
      const isoB = `${dateB}T${timeB}:00`;
      return new Date(isoA) - new Date(isoB);
    });

    container.innerHTML = sortedReminders.map(reminder => {
      const intervalText = formatRepeatText(reminder);
      const hasTimes = reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0;
      const timesHtml = hasTimes
        ? `<div class=\"reminder-details\"><div style=\"margin-bottom:6px;\">每日${reminder.dailyCount}次</div><div class=\"reminder-times\" style=\"display:flex;flex-wrap:wrap;gap:8px;\">${reminder.dailyTimes.map(t => t ? `<label class=\"time-item\" style=\"display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #ddd;border-radius:6px;\"><input type=\"checkbox\" class=\"time-toggle\" data-id=\"${reminder.id}\" data-time=\"${t}\" ${isTimeEnabled(reminder, t) ? 'checked' : ''}/> <span>${t}</span></label>` : '').join('')}</div></div>`
        : '';
      const rangeText = `${reminder.startDate || ''}${reminder.endDate ? ' ~ ' + reminder.endDate : ''}`;
      return `
      <div class=\"reminder-card\" data-id=\"${reminder.id}\">\n        <div class=\"reminder-header\">\n          <h3 class=\"medication-name\">${reminder.name}</h3>\n          <span class=\"reminder-time\">${rangeText}</span>\n        </div>\n        ${reminder.dosage ? `<div class=\\\"reminder-details\\\">剂量：${reminder.dosage}</div>` : ''}\n        ${intervalText ? `<div class=\\\"reminder-details\\\">${intervalText}</div>` : ''}\n        ${timesHtml}\n        ${reminder.notes ? `<div class=\\\"reminder-details\\\">备注：${reminder.notes}</div>` : ''}\n        <div class=\"reminder-actions\">\n          <button class=\"btn btn-secondary\" data-action=\"edit\" data-id=\"${reminder.id}\">编辑</button>\n          <button class=\"btn btn-danger\" data-action=\"delete\" data-id=\"${reminder.id}\">删除</button>\n        </div>\n      </div>`;
    }).join('');

    // 添加"新增提醒"虚线卡片
    const addCardHtml = `
      <div class="reminder-card add-card" id="addReminderCard">
        <div class="add-card-inner">增加用药提醒</div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', addCardHtml);

    // 绑定卡片内事件保持不变
    const handleButtonClick = (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;

      hapticFeedback('Light');
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'edit') {
        editReminder(id);
      } else if (action === 'delete') {
        deleteReminder(id);
      }
    };

    const oldHandler = container._buttonClickHandler;
    if (oldHandler) {
      container.removeEventListener('click', oldHandler);
    }
    container.addEventListener('click', handleButtonClick);
    container._buttonClickHandler = handleButtonClick;

    // 勾选/取消某个时间点的启用开关
    const handleToggleChange = async (e) => {
      const chk = e.target.closest && e.target.closest('.time-toggle');
      if (!chk) return;
      const reminderId = chk.getAttribute('data-id');
      const time = chk.getAttribute('data-time');
      const rIdx = reminders.findIndex(r => r.id === reminderId);
      if (rIdx === -1) return;
      if (!reminders[rIdx].dailyTimeEnabled || typeof reminders[rIdx].dailyTimeEnabled !== 'object') {
        reminders[rIdx].dailyTimeEnabled = {};
      }
      reminders[rIdx].dailyTimeEnabled[time] = !!chk.checked;
      reminders[rIdx].updatedAt = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      saveReminders();
      hapticFeedback('Light');
      // 重新设置调度
      await setupReminders();
    };
    const prevToggle = container._timeToggleHandler;
    if (prevToggle) {
      container.removeEventListener('change', prevToggle);
    }
    container.addEventListener('change', handleToggleChange);
    container._timeToggleHandler = handleToggleChange;

    // 绑定新增卡片点击
    const addCard = container.querySelector('#addReminderCard');
    if (addCard) {
      const addHandler = () => {
        hapticFeedback('Light');
        openModal(root);
      };
      addCard.addEventListener('click', addHandler);
      // 记录清理函数
      if (!container._addCardCleanup) {
        container._addCardCleanup = [];
      }
      container._addCardCleanup.push(() => addCard.removeEventListener('click', addHandler));
    }
  }

  /**
   * 格式化时间显示
   */
  function formatTime(timeString) {
    if (!timeString) return '未设置';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? '下午' : '上午';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${ampm} ${displayHour}:${minutes}`;
  }

  /**
   * 打开添加/编辑模态框
   */
  function openModal(root, reminderId = null) {
    // 检测深色模式
    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 创建弹窗 - 完全使用内联样式
    const modal = document.createElement('div');

    // 弹窗容器样式
    modal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 20px !important;
      box-sizing: border-box !important;
      width: 100vw !important;
      height: 100vh !important;
      margin: 0 !important;
      overflow: hidden !important;
    `;

    // 根据深色模式选择样式
    const backdropStyle = isDarkMode
      ? "background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(12px);"
      : "background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(12px);";

    const modalContentStyle = isDarkMode
      ? "background: linear-gradient(145deg, #1f2937 0%, #111827 100%); border-radius: 28px; box-shadow: 0 32px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1); max-width: 90vw; max-height: calc(100vh - 120px); width: 100%; max-width: 700px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); margin: 0 auto; transform: translateZ(0);"
      : "background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%); border-radius: 28px; box-shadow: 0 32px 64px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6); max-width: 90vw; max-height: calc(100vh - 120px); width: 100%; max-width: 700px; overflow: hidden; border: none; margin: 0 auto; transform: translateZ(0);";

    const headerStyle = isDarkMode
      ? "display: flex; justify-content: space-between; align-items: center; padding: 28px 32px 24px; border-bottom: 1px solid rgba(17, 24, 39, 0.12); background: var(--brand, #b08fc7); color: #111827; border-radius: 28px 28px 0 0;"
      : "display: flex; justify-content: space-between; align-items: center; padding: 28px 32px 24px; border-bottom: 1px solid rgba(17, 24, 39, 0.12); background: var(--brand, #b08fc7); color: #111827; border-radius: 28px 28px 0 0;";

    const closeBtnStyle = isDarkMode
      ? "background: rgba(17, 24, 39, 0.14); border: none; font-size: 1.6rem; color: #111827; cursor: pointer; padding: 12px; border-radius: 16px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;"
      : "background: rgba(17, 24, 39, 0.14); border: none; font-size: 1.6rem; color: #111827; cursor: pointer; padding: 12px; border-radius: 16px; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;";

    editingReminderId = reminderId;
    const isEditMode = !!reminderId;
    const titleText = isEditMode ? '编辑用药提醒' : '添加用药提醒';

    // 获取提醒数据（如果是编辑模式）
    let reminder = null;
    if (reminderId) {
      reminder = reminders.find(r => r.id === reminderId);
    }

    modal.innerHTML = '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; ' + backdropStyle + '"></div>' +
      '<div style="position: relative; ' + modalContentStyle + '">' +
      '<div style="' + headerStyle + '">' +
      '<h3 style="margin: 0; font-size: 1.5rem; font-weight: 700;">' + titleText + '</h3>' +
      '<button style="' + closeBtnStyle + '">&times;</button>' +
      '</div>' +
      '<div style="padding: 32px; max-height: calc(100vh - 240px); overflow-y: auto;">' +
      createReminderFormHTML(reminder, isDarkMode) +
      '</div>' +
      '</div>';

    // 将弹窗添加到主文档，而不是 Shadow DOM，以便正确控制滚动
    document.body.appendChild(modal);

    // 禁用页面滚动
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // 绑定关闭事件
    const closeBtn = modal.querySelector('button');
    const backdrop = modal.querySelector('div[style*="backdrop-filter"]');

    const closeModal = () => {
      // 恢复页面滚动
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      modal.remove();
    };

    closeBtn.addEventListener('click', () => {
      hapticFeedback('Light');
      closeModal();
    });

    backdrop.addEventListener('click', () => {
      hapticFeedback('Light');
      closeModal();
    });

    // 绑定表单事件
    bindReminderFormEvents(modal, closeModal, reminder);
  }

  /**
   * 创建提醒表单HTML
   */
  function createReminderFormHTML(reminder, isDarkMode) {
    const formGroupStyle = isDarkMode
      ? "margin-bottom: 24px;"
      : "margin-bottom: 24px;";

    const labelStyle = isDarkMode
      ? "display: block; margin-bottom: 8px; color: #e2e8f0; font-weight: 600; font-size: 0.95rem;"
      : "display: block; margin-bottom: 8px; color: #374151; font-weight: 600; font-size: 0.95rem;";

    const inputStyle = isDarkMode
      ? "width: 100%; padding: 12px 16px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); color: #f1f5f9; font-size: 0.95rem; box-sizing: border-box; transition: all 0.2s ease; display: block; -webkit-appearance: none; appearance: none;"
      : "width: 100%; padding: 12px 16px; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); color: #1e293b; font-size: 0.95rem; box-sizing: border-box; transition: all 0.2s ease; display: block; -webkit-appearance: none; appearance: none;";

    const textareaStyle = isDarkMode
      ? "width: 100%; padding: 12px 16px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); color: #f1f5f9; font-size: 0.95rem; box-sizing: border-box; min-height: 80px; resize: vertical; transition: all 0.2s ease; display: block;"
      : "width: 100%; padding: 12px 16px; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); color: #1e293b; font-size: 0.95rem; box-sizing: border-box; min-height: 80px; resize: vertical; transition: all 0.2s ease; display: block;";

    const buttonStyle = isDarkMode
      ? "padding: 12px 24px; border: none; border-radius: 12px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; margin-right: 12px;"
      : "padding: 12px 24px; border: none; border-radius: 12px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; margin-right: 12px;";

    const primaryButtonStyle = isDarkMode
      ? buttonStyle + ' background: var(--brand, #b08fc7); color: #111827; box-shadow: 0 4px 12px rgba(176, 143, 199, 0.35);'
      : buttonStyle + ' background: var(--brand, #b08fc7); color: #111827; box-shadow: 0 4px 12px rgba(176, 143, 199, 0.35);';

    const secondaryButtonStyle = isDarkMode
      ? buttonStyle + ' background: rgba(255, 255, 255, 0.1); color: #d1d5db; border: 1px solid rgba(255, 255, 255, 0.2);'
      : buttonStyle + ' background: rgba(0, 0, 0, 0.05); color: #64748b; border: 1px solid rgba(0, 0, 0, 0.1);';

    const actionsStyle = isDarkMode
      ? "display: flex; justify-content: flex-end; align-items: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1);"
      : "display: flex; justify-content: flex-end; align-items: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(0, 0, 0, 0.1);";

    // 设置默认值
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    const name = reminder ? reminder.name || '' : '';
    const startDate = reminder ? reminder.startDate || currentDate : currentDate;
    const endDate = reminder ? reminder.endDate || currentDate : currentDate;
    const dosage = reminder ? reminder.dosage || '' : '';
    const notes = reminder ? reminder.notes || '' : '';
    const repeatInterval = reminder ? reminder.repeatInterval || 'none' : 'none';
    const repeatCustomValue = reminder ? reminder.repeatCustomValue || '' : '';
    const dailyCount = reminder ? reminder.dailyCount || '' : '';
    const dailyTimes = reminder && Array.isArray(reminder.dailyTimes) ? reminder.dailyTimes : [];

    let optionsHtml = '';
    for (let i = 1; i <= 20; i++) {
      const selected = dailyCount == i ? ' selected' : '';
      optionsHtml += '<option value="' + i + '"' + selected + '>' + i + '</option>';
    }

    let repeatOptionsHtml = '';
    const repeatOptions = [
      { value: 'none', text: '不循环' },
      { value: 'daily', text: '每天' },
      { value: 'weekly', text: '每周' },
      { value: 'monthly', text: '每月' },
      { value: 'yearly', text: '每年' }
    ];

    repeatOptions.forEach(option => {
      const selected = repeatInterval === option.value ? ' selected' : '';
      repeatOptionsHtml += '<option value="' + option.value + '"' + selected + '>' + option.text + '</option>';
    });

    return '<form id="reminderForm">' +
      '<div style="' + formGroupStyle + '">' +
      '<label style="' + labelStyle + '" for="medicationName">药品名称 *</label>' +
      '<input type="text" id="medicationName" placeholder="请输入药品名称" value="' + name + '" required style="' + inputStyle + '">' +
      '</div>' +
      '<div style="' + formGroupStyle + '">' +
      '<label style="' + labelStyle + '" for="startDate">开始日期 *</label>' +
      '<input type="date" id="startDate" value="' + startDate + '" required style="' + inputStyle + '">' +
      '</div>' +
      '<div style="' + formGroupStyle + '">' +
      '<label style="' + labelStyle + '" for="endDate">结束日期 *</label>' +
      '<input type="date" id="endDate" value="' + endDate + '" required style="' + inputStyle + '">' +
      '</div>' +
      '<div style="' + formGroupStyle + '">' +
      '<label style="' + labelStyle + '" for="dailyCount">每日提醒次数 *</label>' +
      '<select id="dailyCount" required style="' + inputStyle + '">' +
      '<option value="" disabled' + (!dailyCount ? ' selected' : '') + '>请选择次数（1-20）</option>' +
      optionsHtml +
      '</select>' +
      '</div>' +
      '<div id="dailyTimesGroup" style="' + formGroupStyle + ' display: ' + (dailyCount > 0 ? 'block' : 'none') + ';">' +
      '<label style="' + labelStyle + '">每天提醒时间 *</label>' +
      '<div id="dailyTimesList"></div>' +
      '<button type="button" id="addDailyTimeBtn" style="' + secondaryButtonStyle + '">新增提醒时间</button>' +
      '</div>' +
      '<div style="' + formGroupStyle + '">' +
      '<label style="' + labelStyle + '" for="dosage">剂量</label>' +
      '<input type="text" id="dosage" placeholder="例如：1片、2ml" value="' + dosage + '" style="' + inputStyle + '">' +
      '</div>' +
      '<div style="' + formGroupStyle + '">' +
      '<label style="' + labelStyle + '" for="repeatInterval">循环频率</label>' +
      '<select id="repeatInterval" style="' + inputStyle + '">' +
      repeatOptionsHtml +
      '</select>' +
      '</div>' +
      '<div id="repeatCustomGroup" style="' + formGroupStyle + ' display: ' + (repeatInterval !== 'none' ? 'block' : 'none') + ';">' +
      '<label style="' + labelStyle + '" id="repeatCustomLabel" for="repeatCustomValue">自定义间隔</label>' +
      '<input type="number" min="1" step="1" id="repeatCustomValue" placeholder="例如：2" value="' + repeatCustomValue + '" style="' + inputStyle + '">' +
      '</div>' +
      '<div style="' + formGroupStyle + '">' +
      '<label style="' + labelStyle + '" for="notes">备注</label>' +
      '<textarea id="notes" placeholder="其他注意事项..." style="' + textareaStyle + '">' + notes + '</textarea>' +
      '</div>' +
      '<div style="' + actionsStyle + '">' +
      '<button type="button" id="cancelBtn" style="' + secondaryButtonStyle + '">取消</button>' +
      '<button type="submit" id="saveBtn" style="' + primaryButtonStyle + '">保存</button>' +
      '</div>' +
      '</form>';
  }

  /**
   * 绑定提醒表单事件
   */
  function bindReminderFormEvents(modal, closeModal, reminder = null) {
    const form = modal.querySelector('#reminderForm');
    const cancelBtn = modal.querySelector('#cancelBtn');
    const dailyCountEl = modal.querySelector('#dailyCount');
    const dailyGroup = modal.querySelector('#dailyTimesGroup');
    const dailyList = modal.querySelector('#dailyTimesList');
    const addDailyBtn = modal.querySelector('#addDailyTimeBtn');
    const repeatSelect = modal.querySelector('#repeatInterval');
    const repeatGroup = modal.querySelector('#repeatCustomGroup');
    const repeatLabel = modal.querySelector('#repeatCustomLabel');
    const startDateEl = modal.querySelector('#startDate');
    const endDateEl = modal.querySelector('#endDate');

    // 取消按钮
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        hapticFeedback('Light');
        closeModal();
      });
    }

    // 表单提交
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveReminderFromModal(modal, closeModal);
      });
    }

    // 每日次数变化
    if (dailyCountEl && dailyGroup && dailyList && addDailyBtn) {
      const onCountChange = () => {
        let n = parseInt(dailyCountEl.value || '0', 10) || 0;
        if (n > 20) {
          n = 20;
          dailyCountEl.value = '20';
          hapticFeedback('Medium');
        }
        dailyGroup.style.display = n > 0 ? 'block' : 'none';
        // 获取当前的时间值
        const currentTimes = [...dailyList.querySelectorAll('input[type="time"]')].map(i => i.value);
        renderDailyTimesEditorInModal(modal, n, currentTimes);
      };

      const onAddRow = () => {
        const currentCount = parseInt(dailyCountEl.value || '0', 10) || 0;
        if (currentCount >= 20) {
          hapticFeedback('Heavy');
          return;
        }
        hapticFeedback('Light');
        dailyCountEl.value = String(currentCount + 1);
        // 获取当前的时间值
        const currentTimes = [...dailyList.querySelectorAll('input[type="time"]')].map(i => i.value);
        renderDailyTimesEditorInModal(modal, currentCount + 1, currentTimes);
      };

      dailyCountEl.addEventListener('change', onCountChange);
      addDailyBtn.addEventListener('click', onAddRow);
    }

    // 循环频率变化
    if (repeatSelect && repeatGroup && repeatLabel) {
      const onRepeatChange = () => {
        const v = repeatSelect.value;
        repeatGroup.style.display = (v !== 'none') ? 'block' : 'none';
        repeatLabel.textContent = `自定义间隔（${v === 'daily' ? '天' : v === 'weekly' ? '周' : v === 'monthly' ? '月' : v === 'yearly' ? '年' : ''}）`;
      };
      repeatSelect.addEventListener('change', onRepeatChange);
    }

    // 日期联动
    if (startDateEl && endDateEl) {
      // 当开始/结束日期不相等时，默认将循环频率设置为"每天"；相等时默认改回"不循环"
      // 同时根据范围启用/禁用下拉选项：
      // - 单日：仅允许 不循环
      // - 跨天：隐藏/禁用 不循环，允许 其他循环选项
      const updateRepeatDefaultByDateRange = () => {
        try {
          const s = startDateEl && startDateEl.value;
          const e = endDateEl && endDateEl.value;
          if (repeatSelect && s && e) {
            const isSame = s === e;
            // 启用/禁用各选项
            try {
              const options = Array.from(repeatSelect.options || []);
              options.forEach(opt => {
                if (!opt || typeof opt.value !== 'string') return;
                if (opt.value === 'none') {
                  opt.disabled = !isSame;
                  opt.hidden = !isSame;
                } else {
                  opt.disabled = isSame;
                  opt.hidden = isSame;
                }
              });
            } catch (_) { }

            // 若当前选择不合法则按规则重设
            if (isSame) {
              if (repeatSelect.value !== 'none') {
                repeatSelect.value = 'none';
              }
            } else {
              if (repeatSelect.value === 'none') {
                repeatSelect.value = 'daily';
              }
            }
            // 触发change以同步显示自定义间隔标签/分组
            try { repeatSelect.dispatchEvent(new Event('change')); } catch (_) { }
          }
        } catch (_) { }
      };

      const onStartChange = () => {
        if (startDateEl.value) endDateEl.min = startDateEl.value;
        if (endDateEl.value && startDateEl.value && endDateEl.value < startDateEl.value) {
          endDateEl.value = startDateEl.value;
        }
        updateRepeatDefaultByDateRange();
      };
      startDateEl.addEventListener('change', onStartChange);

      const onEndChange = () => {
        // 仅根据范围决定默认循环
        updateRepeatDefaultByDateRange();
      };
      endDateEl.addEventListener('change', onEndChange);

      // 初始根据默认日期执行一次，确保选项可用性正确
      updateRepeatDefaultByDateRange();
    }

    // 初始化每日时间编辑器
    if (dailyCountEl) {
      const count = parseInt(dailyCountEl.value || '0', 10) || 0;
      if (count > 0) {
        // 获取现有的时间值
        const existingTimes = reminder && Array.isArray(reminder.dailyTimes) ? reminder.dailyTimes : [];
        renderDailyTimesEditorInModal(modal, count, existingTimes);
      }
    }
  }

  /**
   * 在模态框中渲染每日时间编辑器
   */
  function renderDailyTimesEditorInModal(modal, count, existingTimes = []) {
    const dailyList = modal.querySelector('#dailyTimesList');
    if (!dailyList) return;

    const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    const rowStyle = "display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;";
    const cellStyle = "display: flex; gap: 6px;";
    const inputStyle = isDarkMode
      ? "flex: 1; padding: 8px 12px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); color: #f1f5f9; font-size: 0.9rem;"
      : "flex: 1; padding: 8px 12px; border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 8px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); color: #1e293b; font-size: 0.9rem;";
    const removeBtnStyle = isDarkMode
      ? "padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #fca5a5; font-size: 0.8rem; cursor: pointer;"
      : "padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #dc2626; font-size: 0.8rem; cursor: pointer;";

    dailyList.innerHTML = '';

    for (let i = 0; i < count; i += 2) {
      const row = document.createElement('div');
      row.style.cssText = rowStyle;

      // 左格
      const leftCell = document.createElement('div');
      leftCell.style.cssText = cellStyle;
      const leftValue = existingTimes[i] || '';
      leftCell.innerHTML = '<input type="time" style="' + inputStyle + '" value="' + leftValue + '">' +
        '<button type="button" data-remove-input style="' + removeBtnStyle + '">删除</button>';
      row.appendChild(leftCell);

      // 右格（如果存在）
      if (i + 1 < count) {
        const rightCell = document.createElement('div');
        rightCell.style.cssText = cellStyle;
        const rightValue = existingTimes[i + 1] || '';
        rightCell.innerHTML = '<input type="time" style="' + inputStyle + '" value="' + rightValue + '">' +
          '<button type="button" data-remove-input style="' + removeBtnStyle + '">删除</button>';
        row.appendChild(rightCell);
      } else {
        const placeholder = document.createElement('div');
        row.appendChild(placeholder);
      }

      dailyList.appendChild(row);
    }

    // 绑定删除按钮事件 - 为每个按钮单独绑定，避免重复绑定
    dailyList.querySelectorAll('[data-remove-input]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hapticFeedback('Medium');
        const input = btn.parentElement.querySelector('input[type="time"]');
        const all = [...dailyList.querySelectorAll('input[type="time"]')];
        const values = all.map(i => i.value);
        const idx = all.indexOf(input);
        if (idx >= 0) {
          values.splice(idx, 1);
          const n = Math.max(0, count - 1);
          // 获取当前的时间值
          const currentTimes = [...dailyList.querySelectorAll('input[type="time"]')].map(i => i.value);
          renderDailyTimesEditorInModal(modal, n, currentTimes);
          const dailyCountEl = modal.querySelector('#dailyCount');
          if (dailyCountEl) {
            dailyCountEl.value = n > 0 ? String(n) : '';
          }
          const dailyGroup = modal.querySelector('#dailyTimesGroup');
          if (dailyGroup) {
            dailyGroup.style.display = n > 0 ? 'block' : 'none';
          }
        }
      });
    });
  }

  /**
   * 从模态框保存提醒
   */
  async function saveReminderFromModal(modal, closeModal) {
    const name = modal.querySelector('#medicationName').value.trim();
    const startDate = modal.querySelector('#startDate').value;
    const endDate = modal.querySelector('#endDate').value;
    const dosage = modal.querySelector('#dosage').value.trim();
    const notes = modal.querySelector('#notes').value.trim();
    const repeatInterval = modal.querySelector('#repeatInterval').value;
    const repeatCustomValueRaw = modal.querySelector('#repeatCustomValue').value;
    const repeatCustomValue = repeatCustomValueRaw ? Math.max(1, parseInt(repeatCustomValueRaw, 10)) : null;
    const dailyCount = parseInt(modal.querySelector('#dailyCount').value || '0', 10) || 0;
    const dailyList = modal.querySelector('#dailyTimesList');
    const dailyTimes = dailyList ? [...dailyList.querySelectorAll('input[type="time"]')].map(i => i.value).filter(Boolean) : [];

    if (!name || !startDate) {
      alert('请填写药品名称与开始日期');
      return;
    }

    // 检查开始日期不能是过去的日期
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    if (startDate < today) {
      alert('开始日期不能是过去的日期');
      return;
    }

    if (!endDate) {
      alert('请填写结束日期');
      return;
    }
    if (endDate < startDate) {
      alert('结束日期必须大于或等于开始日期');
      return;
    }

    if (endDate < today) {
      alert('结束日期不能是过去的日期');
      return;
    }

    if (!dailyCount || dailyCount < 1) {
      alert('请填写每日提醒次数（至少为1次）');
      return;
    }
    if (!Array.isArray(dailyTimes) || dailyTimes.length !== dailyCount) {
      alert('请填写与次数相同数量的提醒时间');
      return;
    }

    // 校验：每天提醒时间不得在同一分钟重复
    const timeSet = new Set();
    let duplicateValue = null;
    for (const t of dailyTimes) {
      if (timeSet.has(t)) { duplicateValue = t; break; }
      timeSet.add(t);
    }
    if (duplicateValue) {
      alert('每天提醒时间不能相同，请修改重复的时间：' + duplicateValue);
      return;
    }

    // 生成/合并每日时间启用状态映射
    let dailyTimeEnabled = {};
    if (editingReminderId) {
      const existing = reminders.find(r => r.id === editingReminderId);
      if (existing && existing.dailyTimeEnabled && typeof existing.dailyTimeEnabled === 'object') {
        dailyTimes.forEach(t => {
          if (Object.prototype.hasOwnProperty.call(existing.dailyTimeEnabled, t)) {
            dailyTimeEnabled[t] = !!existing.dailyTimeEnabled[t];
          } else {
            dailyTimeEnabled[t] = true;
          }
        });
      } else {
        dailyTimes.forEach(t => { dailyTimeEnabled[t] = true; });
      }
    } else {
      dailyTimes.forEach(t => { dailyTimeEnabled[t] = true; });
    }

    const reminder = {
      id: editingReminderId || generateId(),
      name,
      startDate,
      endDate,
      dosage,
      notes,
      repeatInterval,
      repeatCustomValue,
      dailyCount,
      dailyTimes,
      dailyTimeEnabled,
      createdAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      updatedAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    };

    if (editingReminderId) {
      const index = reminders.findIndex(r => r.id === editingReminderId);
      if (index !== -1) {
        reminders[index] = reminder;
      }
    } else {
      reminders.push(reminder);
    }

    saveReminders();
    renderReminders(currentRoot || document);
    await setupReminders();
    closeModal();
    hapticFeedback('Medium');
  }

  /**
   * 关闭模态框
   */
  function closeModal(root) {
    const modal = root.getElementById('reminderModal');
    if (modal) {
      modal.classList.remove('show');
    }
    editingReminderId = null;
  }

  /**
   * 保存提醒
   */
  async function saveReminder(root) {
    const name = root.getElementById('medicationName').value.trim();
    const startDate = (root.getElementById('startDate') && root.getElementById('startDate').value) || '';
    const endDateEl = root.getElementById('endDate');
    const endDate = (endDateEl && endDateEl.value) || '';
    const dosage = root.getElementById('dosage').value.trim();
    const notes = root.getElementById('notes').value.trim();
    const repeatInterval = (root.getElementById('repeatInterval') && root.getElementById('repeatInterval').value) || 'none';
    const repeatCustomValueRaw = (root.getElementById('repeatCustomValue') && root.getElementById('repeatCustomValue').value) || '';
    const repeatCustomValue = repeatCustomValueRaw ? Math.max(1, parseInt(repeatCustomValueRaw, 10)) : null;
    const dailyCount = parseInt((root.getElementById('dailyCount') && root.getElementById('dailyCount').value) || '0', 10) || 0;
    const dailyList = root.getElementById('dailyTimesList');
    const dailyTimes = dailyList ? [...dailyList.querySelectorAll('input[type="time"]')].map(i => i.value).filter(Boolean) : [];

    if (!name || !startDate) {
      alert('请填写药品名称与开始日期');
      return;
    }

    // 检查开始日期不能是过去的日期（使用本地时间）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    if (startDate < today) {
      alert('开始日期不能是过去的日期');
      return;
    }

    if (!endDate) {
      alert('请填写结束日期');
      if (endDateEl && typeof endDateEl.scrollIntoView === 'function') endDateEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (endDateEl && typeof endDateEl.focus === 'function') endDateEl.focus();
      return;
    }
    if (endDate && endDate < startDate) {
      alert('结束日期必须大于或等于开始日期');
      if (endDateEl && typeof endDateEl.scrollIntoView === 'function') endDateEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (endDateEl && typeof endDateEl.focus === 'function') endDateEl.focus();
      return;
    }

    // 检查结束日期不能是过去的日期
    if (endDate && endDate < today) {
      alert('结束日期不能是过去的日期');
      if (endDateEl && typeof endDateEl.scrollIntoView === 'function') endDateEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (endDateEl && typeof endDateEl.focus === 'function') endDateEl.focus();
      return;
    }

    // 校验：每日提醒次数与每日提醒时间为必填
    const dailyCountEl = root.getElementById('dailyCount');
    const dailyTimesGroup = root.getElementById('dailyTimesGroup');
    if (!dailyCount || dailyCount < 1) {
      alert('请填写每日提醒次数（至少为1次）');
      if (dailyCountEl && typeof dailyCountEl.scrollIntoView === 'function') dailyCountEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (dailyCountEl && typeof dailyCountEl.focus === 'function') dailyCountEl.focus();
      return;
    }
    if (!Array.isArray(dailyTimes) || dailyTimes.length !== dailyCount) {
      alert('请填写与次数相同数量的提醒时间');
      if (dailyTimesGroup && typeof dailyTimesGroup.scrollIntoView === 'function') dailyTimesGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstEmpty = dailyList && [...dailyList.querySelectorAll('input[type="time"]')].find(i => !i.value);
      if (firstEmpty && typeof firstEmpty.focus === 'function') firstEmpty.focus();
      return;
    }

    // 校验：每天提醒时间不得在同一分钟重复
    const timeSet = new Set();
    let duplicateValue = null;
    for (const t of dailyTimes) {
      if (timeSet.has(t)) { duplicateValue = t; break; }
      timeSet.add(t);
    }
    if (duplicateValue) {
      alert('每天提醒时间不能相同，请修改重复的时间：' + duplicateValue);
      if (dailyTimesGroup && typeof dailyTimesGroup.scrollIntoView === 'function') dailyTimesGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const dupInput = dailyList && [...dailyList.querySelectorAll('input[type="time"]')].find(i => i.value === duplicateValue);
      if (dupInput && typeof dupInput.focus === 'function') dupInput.focus();
      return;
    }

    // 生成/合并每日时间启用状态映射
    let dailyTimeEnabled = {};
    if (editingReminderId) {
      const existing = reminders.find(r => r.id === editingReminderId);
      if (existing && existing.dailyTimeEnabled && typeof existing.dailyTimeEnabled === 'object') {
        // 保留已有状态
        dailyTimes.forEach(t => {
          if (Object.prototype.hasOwnProperty.call(existing.dailyTimeEnabled, t)) {
            dailyTimeEnabled[t] = !!existing.dailyTimeEnabled[t];
          } else {
            dailyTimeEnabled[t] = true; // 新增时间默认启用
          }
        });
      } else {
        dailyTimes.forEach(t => { dailyTimeEnabled[t] = true; });
      }
    } else {
      dailyTimes.forEach(t => { dailyTimeEnabled[t] = true; });
    }

    const reminder = {
      id: editingReminderId || generateId(),
      name,
      startDate,
      endDate,
      dosage,
      notes,
      repeatInterval,
      repeatCustomValue,
      dailyCount,
      dailyTimes,
      dailyTimeEnabled,
      createdAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      updatedAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    };

    if (editingReminderId) {
      // 更新现有提醒
      const index = reminders.findIndex(r => r.id === editingReminderId);
      if (index !== -1) {
        reminders[index] = reminder;
      }
    } else {
      // 添加新提醒
      reminders.push(reminder);
    }

    saveReminders();
    renderReminders(root);
    await setupReminders(); // 重新设置定时器
    closeModal(root);
    hapticFeedback('Medium');
  }

  /**
   * 编辑提醒
   */
  function editReminder(reminderId) {
    if (!currentRoot) {
      console.error('❌ currentRoot未设置，无法编辑提醒');
      return;
    }
    editingReminderId = reminderId;
    openModal(currentRoot, reminderId);
  }

  /**
   * 删除提醒 - 显示确认弹窗
   */
  function deleteReminder(reminderId) {
    if (!currentRoot) {
      console.error('❌ currentRoot未设置，无法删除提醒');
      return;
    }
    pendingDeleteId = reminderId;
    showDeleteModal(currentRoot);
  }

  /**
   * 显示删除确认弹窗（使用统一的弹窗管理器）
   */
  async function showDeleteModal(root) {
    if (!window.ModalManager) {
      console.error('ModalManager 未加载');
      return;
    }

    const confirmed = await window.ModalManager.confirmDelete(
      '确定要删除这个用药提醒吗？',
      {
        detail: '此操作无法撤销，相关的定时提醒也将被取消。',
        onConfirm: () => {
          confirmDelete(root);
        }
      }
    );
  }


  /**
   * 确认删除提醒
   */
  async function confirmDelete(root) {
    if (!pendingDeleteId) return;

    const reminderId = pendingDeleteId;

    try {
      // 清除相关的定时器
      const target = reminders.find(r => r.id === reminderId);
      if (reminderTimeouts.has(reminderId)) { clearTimeout(reminderTimeouts.get(reminderId)); reminderTimeouts.delete(reminderId); }
      [...reminderTimeouts.keys()].forEach(key => {
        if (typeof key === 'string' && key.startsWith(reminderId + '|')) {
          clearTimeout(reminderTimeouts.get(key));
          reminderTimeouts.delete(key);
        }
      });

      // 取消Capacitor通知（包括日期+时间预排程）
      // cancelAllScheduledForReminder 已经处理了所有相关的通知取消，包括通过 getPending 过滤和兜底方案
      await cancelAllScheduledForReminder(reminderId);
      console.log('🔔 已取消Capacitor通知:', reminderId);

      // 从数组中移除提醒
      reminders = reminders.filter(r => r.id !== reminderId);
      saveReminders();

      // 重新渲染列表
      renderReminders(root);

      // 重新设置提醒（因为删除了一个）
      await setupReminders();

      hapticFeedback('Medium');
      console.log('✅ 提醒已删除:', reminderId);

    } catch (error) {
      console.error('❌ 删除提醒失败:', error);
      // 即使删除失败，也要从UI中移除
      reminders = reminders.filter(r => r.id !== reminderId);
      saveReminders();
      renderReminders(root);
      hapticFeedback('Medium');
    }
  }

  /**
   * 生成唯一ID
   */
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 设置提醒定时器
   */
  async function setupReminders() {
    console.log('⏰ setupReminders 开始执行', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
    // 防止重复设置提醒
    if (isSettingUpReminders) {
      console.log('⏰ setupReminders 跳过：正在设置中');
      return;
    }

    isSettingUpReminders = true;

    try {
      // 清除所有现有定时器
      reminderTimeouts.forEach(timeout => clearTimeout(timeout));
      reminderTimeouts.clear();
      uiAdvanceTimeouts.forEach(timeout => clearTimeout(timeout));
      uiAdvanceTimeouts.clear();
      allowedFireAt.clear(); // 清除允许触发窗口
      scheduledNotificationIds.clear(); // 清除已调度的通知ID

      if (LocalNotifications) {
        // 在调度用药提醒之前，先保存所有现有的打卡提醒（多重保险）
        let savedCheckinReminders = [];
        let savedCheckinRemindersBackup = []; // 备份
        try {
          if (typeof LocalNotifications.getPending === 'function') {
            const pending = await LocalNotifications.getPending();
            const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
            // 严格过滤：只保存打卡提醒
            savedCheckinReminders = pendingNotifications
              .filter(n => {
                if (!n || !n.extra) return false;
                // 确保是打卡提醒
                return n.extra.type === 'checkin_reminder';
              })
              .map(n => ({
                id: n.id,
                title: n.title,
                body: n.body,
                schedule: n.schedule,
                sound: n.sound || 'default',
                actionTypeId: n.actionTypeId || 'checkin_reminder',
                extra: { ...n.extra } // 深拷贝 extra，避免引用问题
              }));
            // 创建备份
            savedCheckinRemindersBackup = savedCheckinReminders.map(n => ({ ...n }));
            console.log('[notification] 📋 保存了', savedCheckinReminders.length, '个打卡提醒，将在用药提醒调度后重新调度');
            if (savedCheckinReminders.length > 0) {
              console.log('[notification] 📋 打卡提醒详情:', savedCheckinReminders.map(n => ({
                id: n.id,
                targetDate: n.extra?.targetDate,
                scheduleAt: n.schedule?.at
              })));
            }
          }
        } catch (e) {
          console.warn('[notification] ⚠️ 获取现有打卡提醒失败:', e);
        }
        
        // 将保存的打卡提醒存储到函数上下文中，供 finally 块使用
        setupReminders._savedCheckinReminders = savedCheckinReminders;
        setupReminders._savedCheckinRemindersBackup = savedCheckinRemindersBackup;

        // 使用原生本地通知进行滚动预排程
        const notifications = [];

        // 统一用户名
        let username = '访客';
        try { username = await getUsernameAsync(); } catch (_) { }

        let totalScheduled = 0;

        for (const reminder of reminders) {
          if (!(reminder && reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0)) continue;

          // 清理该提醒历史挂起，避免重复
          await cancelAllScheduledForReminder(reminder.id);

          const now = new Date();
          const occ = enumerateUpcomingOccurrences(reminder, now, ROLLING_SCHEDULE_DAYS, MAX_SCHEDULE_PER_REMINDER);
          if (occ.length === 0) continue;

          // UI推进到最近一次
          const nextAtForUi = occ[0];
          if (nextAtForUi) scheduleUiAdvance(reminder.id, nextAtForUi);

          for (const at of occ) {
            if (totalScheduled >= MAX_SCHEDULE_TOTAL) break;
            const n = buildScheduledNotification(reminder, at, getGreetingAt(at), buildNotificationBody(username, reminder));
            notifications.push(n);
            totalScheduled += 1;
          }
          if (totalScheduled >= MAX_SCHEDULE_TOTAL) break;
        }

        // 只调度用药提醒，不包含打卡提醒
        // 因为 Capacitor 的 schedule() 可能会替换所有通知，所以我们分开调度
        if (notifications.length > 0) {
          try { 
            // 在调度前再次验证打卡提醒是否还在
            let checkinCountBeforeSchedule = 0;
            if (typeof LocalNotifications.getPending === 'function') {
              try {
                const pendingBefore = await LocalNotifications.getPending();
                const pendingBeforeNotifications = pendingBefore && pendingBefore.notifications ? pendingBefore.notifications : [];
                checkinCountBeforeSchedule = pendingBeforeNotifications.filter(n => 
                  n && n.extra && n.extra.type === 'checkin_reminder'
                ).length;
                console.log('[notification] 📊 调度用药提醒前，打卡提醒数量:', checkinCountBeforeSchedule);
              } catch (e) {
                console.warn('[notification] ⚠️ 调度前验证打卡提醒失败:', e);
              }
            }
            
            await scheduleNotificationsChunked(notifications, 16);
            console.log('[notification] ✅ 已调度', notifications.length, '个用药提醒');
            
            // 调度后立即验证打卡提醒是否还在
            if (typeof LocalNotifications.getPending === 'function') {
              try {
                await new Promise(resolve => setTimeout(resolve, 200)); // 等待200ms让系统处理
                const pendingAfter = await LocalNotifications.getPending();
                const pendingAfterNotifications = pendingAfter && pendingAfter.notifications ? pendingAfter.notifications : [];
                const checkinCountAfterSchedule = pendingAfterNotifications.filter(n => 
                  n && n.extra && n.extra.type === 'checkin_reminder'
                ).length;
                console.log('[notification] 📊 调度用药提醒后，打卡提醒数量:', checkinCountAfterSchedule);
                
                if (checkinCountAfterSchedule < checkinCountBeforeSchedule) {
                  console.warn('[notification] ⚠️ 警告：调度用药提醒后，打卡提醒数量减少了！', 
                    '调度前:', checkinCountBeforeSchedule, '调度后:', checkinCountAfterSchedule);
                  // 如果打卡提醒减少了，标记需要重新调度
                  if (savedCheckinReminders.length === 0 && checkinCountBeforeSchedule > 0) {
                    console.warn('[notification] ⚠️ 检测到打卡提醒被清除，将在 finally 块中重新调度');
                    // 尝试从 pending 中重新获取打卡提醒
                    const currentCheckinReminders = pendingAfterNotifications
                      .filter(n => n && n.extra && n.extra.type === 'checkin_reminder')
                      .map(n => ({
                        id: n.id,
                        title: n.title,
                        body: n.body,
                        schedule: n.schedule,
                        sound: n.sound || 'default',
                        actionTypeId: n.actionTypeId || 'checkin_reminder',
                        extra: { ...n.extra }
                      }));
                    if (currentCheckinReminders.length > 0) {
                      setupReminders._savedCheckinReminders = currentCheckinReminders;
                      console.log('[notification] 📋 从当前待触发列表中重新获取了', currentCheckinReminders.length, '个打卡提醒');
                    }
                  }
                }
              } catch (e) {
                console.warn('[notification] ⚠️ 调度后验证打卡提醒失败:', e);
              }
            }
          }
          catch (e) { console.error('❌ Capacitor通知调度失败:', e); throw e; }
        }
      } else {
        // 回退模式：按dailyTimes设置
        reminderTimeouts.forEach(timeout => clearTimeout(timeout));
        reminderTimeouts.clear();
        const now = new Date();
        reminders.forEach(reminder => {
          if (!(reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0)) return;
          const times = [...reminder.dailyTimes].filter(Boolean).filter(t => isTimeEnabled(reminder, t)).sort();
          times.forEach((t) => {
            const baseDate = reminder.startDate || (() => {
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            })();
            const baseTime = new Date(`${baseDate}T${t}:00`);

            // 如果基础时间已过，跳到下一天
            let firstTime = baseTime;
            if (firstTime <= now) {
              const nextDay = new Date(baseTime);
              nextDay.setDate(nextDay.getDate() + 1);
              const year = nextDay.getFullYear();
              const month = String(nextDay.getMonth() + 1).padStart(2, '0');
              const day = String(nextDay.getDate()).padStart(2, '0');
              firstTime = new Date(`${year}-${month}-${day}T${t}:00`);
            }

            // 范围检查
            if (reminder.endDate) {
              const end = new Date(`${reminder.endDate}T23:59:59`);
              if (firstTime > end) return;
            }

            const delay = firstTime - now;
            // 只有时间在未来才设置定时器
            if (delay > 0) {
              const timeout = setTimeout(() => {
                if (canSendNotification(reminder.id)) showNotification(reminder);
                if (reminder.repeatInterval && reminder.repeatInterval !== 'none') scheduleNextFallback(reminder);
              }, delay);
              reminderTimeouts.set(reminder.id + '|' + t, timeout);
            }
          });
        });
      }
    } catch (error) {
      console.error('❌ 设置提醒失败:', error);
      // 如果Capacitor通知失败，回退到setTimeout方式
      setupFallbackReminders();
    } finally {
      // 重置设置标志位
      isSettingUpReminders = false;
      
      // 重新调度打卡提醒，因为 LocalNotifications.schedule 可能会清除所有现有通知
      // 如果之前保存了打卡提醒，直接重新调度它们；否则调用 scheduleCheckinReminder
      Promise.resolve().then(async () => {
        try {
          // 检查是否有保存的打卡提醒（优先使用主备份，如果主备份为空则使用备份）
          let savedCheckinReminders = setupReminders._savedCheckinReminders || [];
          const savedCheckinRemindersBackup = setupReminders._savedCheckinRemindersBackup || [];
          
          // 如果主备份为空但备份不为空，使用备份
          if (savedCheckinReminders.length === 0 && savedCheckinRemindersBackup.length > 0) {
            console.log('[notification] 📋 主备份为空，使用备份恢复', savedCheckinRemindersBackup.length, '个打卡提醒');
            savedCheckinReminders = savedCheckinRemindersBackup.map(n => ({ ...n }));
            setupReminders._savedCheckinReminders = savedCheckinReminders;
          }
          
          // 如果仍然为空，尝试从当前待触发列表中获取
          if (savedCheckinReminders.length === 0 && typeof LocalNotifications.getPending === 'function') {
            try {
              await new Promise(resolve => setTimeout(resolve, 200));
              const pending = await LocalNotifications.getPending();
              const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
              const currentCheckinReminders = pendingNotifications
                .filter(n => n && n.extra && n.extra.type === 'checkin_reminder')
                .map(n => ({
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  schedule: n.schedule,
                  sound: n.sound || 'default',
                  actionTypeId: n.actionTypeId || 'checkin_reminder',
                  extra: { ...n.extra }
                }));
              if (currentCheckinReminders.length > 0) {
                console.log('[notification] 📋 从当前待触发列表中获取了', currentCheckinReminders.length, '个打卡提醒');
                savedCheckinReminders = currentCheckinReminders;
                setupReminders._savedCheckinReminders = savedCheckinReminders;
              }
            } catch (e) {
              console.warn('[notification] ⚠️ 从待触发列表获取打卡提醒失败:', e);
            }
          }
          
          if (savedCheckinReminders.length > 0) {
            console.log('[notification] ⏰ 用药提醒调度完成，开始重新调度', savedCheckinReminders.length, '个打卡提醒...');
            // 稍微延迟一下，确保用药提醒的调度操作完全完成
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 验证并重新调度保存的打卡提醒
            const now = new Date();
            const validCheckinReminders = savedCheckinReminders
              .map(n => {
                let scheduleAt = n.schedule?.at;
                const originalScheduleAt = scheduleAt;
                
                if (typeof scheduleAt === 'string') {
                  scheduleAt = new Date(scheduleAt);
                } else if (!(scheduleAt instanceof Date)) {
                  scheduleAt = new Date(scheduleAt);
                }
                
                console.log('[notification] 处理打卡提醒:', {
                  id: n.id,
                  originalScheduleAt: originalScheduleAt,
                  parsedScheduleAt: scheduleAt.toISOString(),
                  isValid: !isNaN(scheduleAt.getTime()),
                  isFuture: scheduleAt > now,
                  now: now.toISOString()
                });
                
                if (!scheduleAt || isNaN(scheduleAt.getTime())) {
                  console.warn('[notification] 打卡提醒时间无效:', n.id, '原始时间:', originalScheduleAt);
                  return null;
                }
                
                if (scheduleAt <= now) {
                  console.warn('[notification] 打卡提醒时间已过期:', n.id, '时间:', scheduleAt.toISOString(), '现在:', now.toISOString());
                  return null;
                }
                
                const notification = {
                  id: n.id,
                  title: n.title,
                  body: n.body,
                  schedule: { at: scheduleAt },
                  sound: n.sound || 'default',
                  actionTypeId: n.actionTypeId || 'checkin_reminder',
                  extra: n.extra
                };
                
                console.log('[notification] 准备调度打卡提醒:', {
                  id: notification.id,
                  title: notification.title,
                  scheduleAt: scheduleAt.toISOString(),
                  targetDate: notification.extra?.targetDate
                });
                
                return notification;
              })
              .filter(n => n !== null);
            
            if (validCheckinReminders.length > 0 && LocalNotifications) {
              try {
                console.log('[notification] 开始调度', validCheckinReminders.length, '个打卡提醒...');
                
                // 直接调度，不使用 scheduleCheckinReminder（因为它会先取消所有打卡提醒）
                // 批量调度，而不是逐个调度，避免 Capacitor 的 schedule() 替换所有通知
                try {
                  await scheduleNotificationsChunked(validCheckinReminders, 16);
                  console.log('[notification] ✅ 已重新调度', validCheckinReminders.length, '个打卡提醒');
                } catch (e) {
                  console.error('[notification] ❌ 批量调度失败，尝试逐个调度:', e);
                  // 如果批量调度失败，尝试逐个调度
                  for (const notification of validCheckinReminders) {
                    try {
                      await LocalNotifications.schedule({ notifications: [notification] });
                      console.log('[notification] ✅ 已调度打卡提醒:', notification.id, '时间:', notification.schedule.at.toISOString());
                    } catch (err) {
                      console.error('[notification] ❌ 调度单个打卡提醒失败:', notification.id, err);
                    }
                  }
                }
                
                // 多重验证调度是否成功（验证3次，每次间隔500ms）
                let verificationPassed = false;
                for (let verifyAttempt = 1; verifyAttempt <= 3; verifyAttempt++) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  if (typeof LocalNotifications.getPending === 'function') {
                    try {
                      const pending = await LocalNotifications.getPending();
                      const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
                      const checkinCount = pendingNotifications.filter(n => 
                        n && n.extra && n.extra.type === 'checkin_reminder'
                      ).length;
                      console.log('[notification] 验证', verifyAttempt, '/3：当前待触发的打卡提醒数量:', checkinCount);
                      
                      if (checkinCount > 0) {
                        verificationPassed = true;
                        console.log('[notification] ✅ 验证成功（第', verifyAttempt, '次）：打卡提醒已正确调度');
                        break;
                      } else if (verifyAttempt === 3) {
                        console.warn('[notification] ⚠️ 警告：3次验证后仍然没有找到打卡提醒，可能调度失败或被清除');
                        // 最后一次验证失败，尝试重新调度
                        if (savedCheckinReminders.length > 0) {
                          console.log('[notification] 🔄 尝试重新调度打卡提醒...');
                          try {
                            // 逐个调度，确保每个都能成功
                            let successCount = 0;
                            for (const notification of validCheckinReminders) {
                              try {
                                await LocalNotifications.schedule({ notifications: [notification] });
                                successCount++;
                                console.log('[notification] ✅ 重新调度成功:', notification.id);
                              } catch (err) {
                                console.error('[notification] ❌ 重新调度失败:', notification.id, err);
                              }
                            }
                            if (successCount > 0) {
                              console.log('[notification] ✅ 重新调度完成，成功', successCount, '个');
                              verificationPassed = true;
                            }
                          } catch (e) {
                            console.error('[notification] ❌ 重新调度失败:', e);
                          }
                        }
                      }
                    } catch (e) {
                      console.warn('[notification] ⚠️ 验证失败（第', verifyAttempt, '次）:', e);
                    }
                  }
                }
                
                // 如果所有验证都失败，记录严重警告
                if (!verificationPassed) {
                  console.error('[notification] ❌ 严重警告：所有验证都失败，打卡提醒可能已被清除！');
                  // 最后尝试调用 scheduleCheckinReminder（但要注意它会先取消所有打卡提醒）
                  if (typeof window.scheduleCheckinReminder === 'function') {
                    console.log('[notification] 🔄 最后尝试：调用 scheduleCheckinReminder...');
                    try {
                      await window.scheduleCheckinReminder();
                      console.log('[notification] ✅ scheduleCheckinReminder 执行完成');
                    } catch (e) {
                      console.error('[notification] ❌ scheduleCheckinReminder 执行失败:', e);
                    }
                  }
                }
              } catch (e) {
                console.error('[notification] ❌ 重新调度打卡提醒失败:', e);
                // 如果直接调度失败，回退到调用 scheduleCheckinReminder
                // 但要注意，这会先取消所有打卡提醒
                if (typeof window.scheduleCheckinReminder === 'function') {
                  console.log('[notification] 回退到 scheduleCheckinReminder...');
                  await window.scheduleCheckinReminder();
                }
              }
            } else {
              console.log('[notification] 没有有效的打卡提醒需要重新调度，validCheckinReminders.length:', validCheckinReminders.length);
              // 如果没有有效的打卡提醒，调用 scheduleCheckinReminder 来创建新的
              if (typeof window.scheduleCheckinReminder === 'function') {
                console.log('[notification] 调用 scheduleCheckinReminder 创建新的打卡提醒...');
                await window.scheduleCheckinReminder();
              }
            }
            
            // 清除保存的打卡提醒（但保留备份，以防万一）
            setupReminders._savedCheckinReminders = null;
            // 延迟清除备份，给系统更多时间稳定
            setTimeout(() => {
              setupReminders._savedCheckinRemindersBackup = null;
            }, 5000);
          } else if (typeof window.scheduleCheckinReminder === 'function') {
            console.log('[notification] ⏰ 用药提醒调度完成，调用 scheduleCheckinReminder 重新调度打卡提醒...');
            await new Promise(resolve => setTimeout(resolve, 300));
            await window.scheduleCheckinReminder();
            console.log('[notification] ✅ 打卡提醒重新调度完成');
          } else {
            console.warn('[notification] ⚠️ scheduleCheckinReminder 函数不可用，且没有保存的打卡提醒');
          }
        } catch (e) {
          console.error('[notification] ❌ 重新调度打卡提醒失败:', e);
        }
      });
    }
  }

  /**
   * 回退到setTimeout方式设置提醒（当Capacitor不可用时）
   */
  function setupFallbackReminders() {
    // 仅在提醒页面激活时才使用回退定时器，防止动态加载到其他页面误发
    if (!isActiveReminderView) {
      console.warn('回退模式已跳过：当前不在提醒页面');
      return;
    }
    reminderTimeouts.forEach(timeout => clearTimeout(timeout));
    reminderTimeouts.clear();
    uiAdvanceTimeouts.forEach(timeout => clearTimeout(timeout));
    uiAdvanceTimeouts.clear();
    allowedFireAt.clear(); // 清除允许触发窗口

    const now = new Date();
    reminders.forEach(reminder => {
      if (!(reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0)) return;
      if (reminder.repeatInterval === 'none') return; // 不循环则不进入fallback循环

      const times = [...reminder.dailyTimes].filter(Boolean).filter(t => isTimeEnabled(reminder, t)).sort();
      times.forEach((t) => {
        const baseDate = reminder.startDate || (() => {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })();
        const baseTime = new Date(`${baseDate}T${t}:00`);

        // 如果基础时间已过，跳到下一天
        let firstTime = baseTime;
        if (firstTime <= now) {
          const nextDay = new Date(baseTime);
          nextDay.setDate(nextDay.getDate() + 1);
          const year = nextDay.getFullYear();
          const month = String(nextDay.getMonth() + 1).padStart(2, '0');
          const day = String(nextDay.getDate()).padStart(2, '0');
          firstTime = new Date(`${year}-${month}-${day}T${t}:00`);
        }

        // 检查是否超出结束日期
        if (reminder.endDate) {
          const end = new Date(`${reminder.endDate}T23:59:59`);
          if (firstTime > end) return;
        }

        const timeUntilReminder = firstTime - now;

        // 只有时间在未来才设置定时器
        if (timeUntilReminder > 0) {
          const timeout = setTimeout(() => {
            if (canSendNotification(reminder.id)) {
              showNotification(reminder);
            }
            scheduleNextFallback(reminder);
          }, timeUntilReminder);

          reminderTimeouts.set(reminder.id + '|' + t, timeout);
        }
      });
    });

    console.log('⏰ 回退模式：设置了', reminderTimeouts.size, '个提醒定时器');
  }

  function computeNextTime(reminder, baseTime, fromTime) {
    // 若配置了每日多个时间，优先使用它们（每日重复）
    if (reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0) {
      const times = [...reminder.dailyTimes].filter(Boolean).filter(t => isTimeEnabled(reminder, t)).sort(); // "HH:MM"
      const from = new Date(fromTime);
      const fromDateStr = (() => {
        const year = from.getFullYear();
        const month = String(from.getMonth() + 1).padStart(2, '0');
        const day = String(from.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      })();
      const fromHhmm = from.toTimeString().slice(0, 5);

      // 检查今天剩余的时间
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        if (t > fromHhmm) {
          return new Date(`${fromDateStr}T${t}:00`);
        }
      }

      // 如果今天的时间都过了，跳到下一天的第一个时间
      const nextDay = new Date(from);
      nextDay.setDate(nextDay.getDate() + 1);
      const year = nextDay.getFullYear();
      const month = String(nextDay.getMonth() + 1).padStart(2, '0');
      const day = String(nextDay.getDate()).padStart(2, '0');
      const nextDayStr = `${year}-${month}-${day}`;
      const first = times[0];
      return new Date(`${nextDayStr}T${first}:00`);
    }

    let next = new Date(baseTime.getTime());
    if (reminder.repeatInterval === 'daily') {
      const mult = reminder.repeatCustomValue && reminder.repeatCustomValue > 0 ? reminder.repeatCustomValue : 1;
      while (next <= fromTime) next.setDate(next.getDate() + mult);
    } else if (reminder.repeatInterval === 'weekly') {
      const mult = reminder.repeatCustomValue && reminder.repeatCustomValue > 0 ? reminder.repeatCustomValue : 1;
      while (next <= fromTime) next.setDate(next.getDate() + 7 * mult);
    } else if (reminder.repeatInterval === 'monthly') {
      const mult = reminder.repeatCustomValue && reminder.repeatCustomValue > 0 ? reminder.repeatCustomValue : 1;
      while (next <= fromTime) {
        const m = next.getMonth() + mult;
        next = new Date(next.getFullYear(), m, next.getDate(), next.getHours(), next.getMinutes(), 0, 0);
      }
    } else if (reminder.repeatInterval === 'yearly') {
      const mult = reminder.repeatCustomValue && reminder.repeatCustomValue > 0 ? reminder.repeatCustomValue : 1;
      while (next <= fromTime) {
        next = new Date(next.getFullYear() + mult, next.getMonth(), next.getDate(), next.getHours(), next.getMinutes(), 0, 0);
      }
    } else {
      if (next <= fromTime) next.setDate(next.getDate() + 1);
    }
    return next;
  }

  function scheduleNextFallback(reminder) {
    if (reminder.repeatInterval === 'none') return;
    let intervalMs = 24 * 60 * 60 * 1000; // 默认每天
    if (reminder.repeatInterval === 'daily') {
      const mult = (reminder.repeatCustomValue && reminder.repeatCustomValue > 0) ? reminder.repeatCustomValue : 1;
      intervalMs = mult * 24 * 60 * 60 * 1000;
    } else if (reminder.repeatInterval === 'weekly') {
      const mult = (reminder.repeatCustomValue && reminder.repeatCustomValue > 0) ? reminder.repeatCustomValue : 1;
      intervalMs = mult * 7 * 24 * 60 * 60 * 1000;
    } else if (reminder.repeatInterval === 'monthly') {
      const mult = (reminder.repeatCustomValue && reminder.repeatCustomValue > 0) ? reminder.repeatCustomValue : 1;
      intervalMs = mult * 30 * 24 * 60 * 60 * 1000; // 近似每月30天
    } else if (reminder.repeatInterval === 'yearly') {
      const mult = (reminder.repeatCustomValue && reminder.repeatCustomValue > 0) ? reminder.repeatCustomValue : 1;
      intervalMs = mult * 365 * 24 * 60 * 60 * 1000; // 近似每年365天
    }

    const timeout = setTimeout(() => {
      if (canSendNotification(reminder.id)) {
        showNotification(reminder);
      }
      scheduleNextFallback(reminder);
    }, intervalMs);

    reminderTimeouts.set(reminder.id, timeout);
  }

  /**
   * 为明天设置提醒
   */
  function setupReminderForTomorrow(reminder) {
    // 兼容旧逻辑：保留按天循环，但若配置了其它周期，则走新函数
    if (reminder.repeatInterval && reminder.repeatInterval !== 'daily' && reminder.repeatInterval !== 'none') {
      scheduleNextFallback(reminder);
      return;
    }

    const timeout = setTimeout(() => {
      // 检查是否可以发送通知（防重复）
      if (canSendNotification(reminder.id)) {
        showNotification(reminder);
      }
      setupReminderForTomorrow(reminder); // 递归设置下一天
    }, 24 * 60 * 60 * 1000); // 24小时

    reminderTimeouts.set(reminder.id, timeout);
  }

  /**
   * 检查是否可以发送通知（防重复）
   */
  function canSendNotification(reminderId) {
    const now = Date.now();
    const lastTime = lastNotificationTime.get(reminderId);
    const cooldownPeriod = 2 * 60 * 1000; // 2分钟冷却期，减少重复发送

    if (lastTime && (now - lastTime) < cooldownPeriod) {
      console.log('⏰ 通知冷却中，跳过发送:', reminderId, '剩余冷却时间:', Math.ceil((cooldownPeriod - (now - lastTime)) / 1000), '秒');
      return false;
    }

    // 检查是否已经在处理冷却期（防止重复处理）
    const cooldownEnd = notificationCooldown.get(reminderId);
    if (cooldownEnd && now < cooldownEnd) {
      console.log('⏰ 通知处理冷却中，跳过发送:', reminderId, '剩余冷却时间:', Math.ceil((cooldownEnd - now) / 1000), '秒');
      return false;
    }

    return true;
  }

  /**
   * 显示提醒通知
   */
  async function showNotification(reminder) {
    // 防重复发送检查
    if (!canSendNotification(reminder.id)) {
      return;
    }

    try {
      // 检查通知是否可用（Capacitor 或浏览器通知）
      if (!LocalNotifications) {
        console.warn('⚠️ LocalNotifications 不可用，无法发送通知');
        return;
      }

      // 获取用户名
      const username = await getUsernameAsync();

      const notificationTitle = buildNotificationTitle();
      const notificationBody = buildNotificationBody(username, reminder);

      // 优先使用Capacitor本地通知
      if (LocalNotifications) {
        const notificationId = Math.floor(Math.random() * 900000) + 100000;
        const notificationData = {
          id: notificationId,
          title: notificationTitle,
          body: notificationBody,
          schedule: { at: new Date() },
          sound: 'default',
          actionTypeId: 'medication_reminder',
          extra: {
            reminderId: reminder.id,
            medicationName: reminder.name,
            plannedAt: Date.now()
          }
        };

        try {
          await LocalNotifications.schedule({
            notifications: [notificationData]
          });
          console.log('🔔 通知已发送:', reminder.name);
        } catch (error) {
          console.error('❌ Capacitor通知发送失败:', error);
          throw error;
        }
      } else {
        // 通知不可用
        console.warn('⚠️ LocalNotifications 不可用，无法发送通知');
      }

      // 记录发送时间和冷却期
      const now = Date.now();
      lastNotificationTime.set(reminder.id, now);
      notificationCooldown.set(reminder.id, now + 2 * 60 * 1000); // 2分钟冷却期
      sentNotifications.add(reminder.id);

      // 震动反馈
      hapticFeedback('Heavy');

      console.log('🔔 通知已发送:', reminder.name, '时间:', new Date().toLocaleString('zh-CN'));

      // 非循环：仅当"今天所有时间点都发完"才删除；否则继续等今天的下一个时间点
      if (!reminder.repeatInterval || reminder.repeatInterval === 'none') {
        const nextToday = getNextTimeToday(reminder, new Date());
        if (nextToday) {
          scheduleUiAdvance(reminder.id, nextToday);
        } else {
          await hardDeleteReminder(reminder.id);
        }
        return;
      }

      // 循环：推进到下一次触发时间（同日或跨日）
      advanceReminderNextRun(reminder);

    } catch (error) {
      console.error('❌ 发送通知失败:', error);
    }
  }

  function advanceReminderNextRun(reminder) {
    try {
      const idx = reminders.findIndex(r => r.id === reminder.id);
      if (idx === -1) return;

      // 范围检查，若超过结束日期则直接删除
      if (isReminderExpired(reminder)) {
        hardDeleteReminder(reminder.id);
        return;
      }

      // 使用 dailyTimes 推进到下一次最近时间（仅考虑启用的时间）
      if (reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0) {
        const now = new Date();
        const next = computeNextTime(reminder, new Date(`${reminder.startDate || (() => {
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })()}T00:00:00`), now);
        // 若 next 超过结束日期，则删除
        if (isReminderExpired(reminder, next)) {
          hardDeleteReminder(reminder.id);
          return;
        }
        const nextDate = (() => {
          const year = next.getFullYear();
          const month = String(next.getMonth() + 1).padStart(2, '0');
          const day = String(next.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })();
        const nextTime = next.toTimeString().slice(0, 5);
        reminders[idx] = { ...reminders[idx], startDate: reminders[idx].startDate || nextDate, updatedAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) };
        // 不再单独存 time 字段
        saveReminders();
        if (currentRoot) { renderReminders(currentRoot); updateEditingModalIfOpen(currentRoot, reminders[idx]); }
        scheduleUiAdvance(reminders[idx].id, next);
        if (LocalNotifications) {
          const needsCustomNative = (reminder.repeatInterval === 'daily' && reminder.repeatCustomValue && reminder.repeatCustomValue > 1)
            || (reminder.repeatInterval === 'weekly' && reminder.repeatCustomValue && reminder.repeatCustomValue > 1)
            || (reminder.repeatInterval === 'monthly' && reminder.repeatCustomValue && reminder.repeatCustomValue > 1)
            || (reminder.repeatInterval === 'yearly' && reminder.repeatCustomValue && reminder.repeatCustomValue > 1);
          if (needsCustomNative) scheduleNextNative(reminders[idx]);
        } else {
          scheduleNextFallback(reminders[idx]);
        }
        return;
      }

      // 无时间点则不推进
    } catch (e) {
      console.error('推进下次提醒失败:', e);
    }
  }

  function scheduleNextNative(reminder) {
    try {
      if (!LocalNotifications) return;
      // 计算下一次at
      const now = new Date();
      let nextAt = null;
      if (reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0) {
        // 优先使用每日时间
        const nextToday = getNextTimeToday(reminder, now);
        if (nextToday) {
          nextAt = nextToday;
        } else {
          // 如果今天没有剩余时间，跳到下一天
          const baseDate = (reminder.startDate || (() => {
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          })());
          // 选择下一个启用的第一个时间
          const enabledTimes = [...reminder.dailyTimes].filter(Boolean).filter(t => isTimeEnabled(reminder, t)).sort();
          const firstEnabled = enabledTimes[0] || reminder.dailyTimes[0] || '00:00';
          const baseTime = new Date(`${baseDate}T${firstEnabled}:00`);
          if (baseTime <= now) {
            // 如果基础时间已过，跳到下一天
            const nextDay = new Date(baseTime);
            nextDay.setDate(nextDay.getDate() + 1);
            const year = nextDay.getFullYear();
            const month = String(nextDay.getMonth() + 1).padStart(2, '0');
            const day = String(nextDay.getDate()).padStart(2, '0');
            nextAt = new Date(`${year}-${month}-${day}T${firstEnabled}:00`);
          } else {
            nextAt = baseTime;
          }
        }
      } else {
        // 无dailyTimes则不重调度
        return;
      }
      // 范围检查
      if (reminder.endDate) {
        const end = new Date(`${reminder.endDate}T23:59:59`);
        if (nextAt > end) return;
      }
      // 安全窗口修正：若过早，推迟到计划点；若非常接近，向后偏移500ms
      const nowMs = Date.now();
      let atMs = nextAt.getTime();
      if (atMs < nowMs) atMs = nowMs + 500;
      const at = new Date(atMs);

      // 对于按多个时间点调度，按"明确定点时间"的ID来调度，以便与启用状态对齐
      const enabledTimes = [...(reminder.dailyTimes || [])].filter(Boolean).filter(t => isTimeEnabled(reminder, t)).sort();
      const nextTimeHHMM = nextAt.toTimeString().slice(0, 5);
      const idKey = enabledTimes.includes(nextTimeHHMM) ? (reminder.id + '|' + nextTimeHHMM) : reminder.id;
      const notificationId = stableIdFromString(idKey);
      // 先取消相关ID，再按 at 调度，不使用 repeats
      const cancelIds = [{ id: stableIdFromString(reminder.id) }];
      enabledTimes.forEach(t => cancelIds.push({ id: stableIdFromString(reminder.id + '|' + t) }));
      LocalNotifications.cancel({ notifications: cancelIds }).catch(() => { });
      LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: buildNotificationTitle(),
          body: buildNotificationBody('您', reminder),
          schedule: { at },
          sound: 'default',
          actionTypeId: 'medication_reminder',
          extra: { reminderId: reminder.id, medicationName: reminder.name, plannedAt: at.getTime() }
        }]
      });
      // 同步UI推进窗口
      scheduleUiAdvance(reminder.id, at);
    } catch (_) { }
  }

  function updateEditingModalIfOpen(root, updatedReminder) {
    try {
      const modal = root.getElementById('reminderModal');
      if (!modal || !modal.classList.contains('show')) return;
      if (!editingReminderId || editingReminderId !== updatedReminder.id) return;
      const sEl = root.getElementById('startDate');
      const eEl = root.getElementById('endDate');
      if (sEl) sEl.value = updatedReminder.startDate || '';
      if (eEl) eEl.value = updatedReminder.endDate || '';
    } catch (_) { }
  }

  function advanceReminderNextRunById(reminderId) {
    const reminder = reminders.find(r => r.id === reminderId);
    if (reminder) advanceReminderNextRun(reminder);
  }

  /**
   * 请求通知权限
   */
  async function requestNotificationPermission() {
    try {
      // 优先使用Capacitor的通知权限
      if (LocalNotifications) {
        const result = await LocalNotifications.requestPermissions();
        if (result.display === 'granted') {
          console.log('✅ Capacitor通知权限已授予');
          return true;
        } else {
          console.warn('❌ Capacitor通知权限被拒绝');
          return false;
        }
      } else {
        // 通知不可用
        console.warn('⚠️ LocalNotifications 不可用，无法请求通知权限');
        return false;
      }
    } catch (error) {
      console.error('❌ 请求通知权限失败:', error);
      return false;
    }
  }

  /**
   * Cleanup function: run all stored teardown callbacks.
   * Called before leaving the page to prevent leaks.
   */
  function destroyCase() {
    console.log('🧹 开始清理资源...');

    // 清除所有定时器
    reminderTimeouts.forEach(timeout => clearTimeout(timeout));
    reminderTimeouts.clear();
    uiAdvanceTimeouts.forEach(timeout => clearTimeout(timeout));
    uiAdvanceTimeouts.clear();
    allowedFireAt.clear(); // 清除允许触发窗口
    scheduledNotificationIds.clear(); // 清除已调度的通知ID
    notificationCooldown.clear(); // 清除通知冷却期
    handledNotificationIds.clear(); // 清除已处理的通知ID
    sentNotifications.clear(); // 清除已发送通知记录
    lastNotificationTime.clear(); // 清除最后通知时间

    // 不取消原生通知，保证后台调度持续生效

    // 清理当前的root引用
    currentRoot = null;
    isActiveReminderView = false;
    isSettingUpReminders = false;

    // 统一执行清理函数
    cleanupFns.forEach(fn => { try { fn(); } catch (_) { } });
    cleanupFns = [];

    // 清理新增卡片事件监听器
    if (currentRoot) {
      const addCard = currentRoot.querySelector('#addReminderCard');
      if (addCard) {
        const addHandler = () => {
          hapticFeedback('Light');
          openModal(currentRoot);
        };
        addCard.removeEventListener('click', addHandler);
      }
    }

    console.log('🧹 destroyCase 清理完成');
  }

  function catchUpOverdueReminders() {
    // 进入/恢复页面时，对已过时间点的提醒做"静默对齐"：
    // - 不发送通知
    // - 仅推进到下一个计划时间或删除一次性提醒
    try {
      const now = new Date();
      const toDelete = [];

      reminders.forEach((reminder) => {
        if (!(reminder && reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0)) return;

        // 若已超过结束日期，则直接删除
        if (isReminderExpired(reminder, now)) {
          toDelete.push(reminder.id);
          return;
        }

        // 一次性（不循环）：若今天没有剩余时间点，删除；否则推进到今天的下一个时间
        if (!reminder.repeatInterval || reminder.repeatInterval === 'none') {
          const nextToday = getNextTimeToday(reminder, now);
          if (nextToday) {
            scheduleUiAdvance(reminder.id, nextToday);
          } else {
            toDelete.push(reminder.id);
          }
          return;
        }

        // 循环：计算从当前时刻开始的下一次触发时间
        const baseDateStr = (() => {
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        })();
        const nextAt = computeNextTime(reminder, new Date(`${baseDateStr}T00:00:00`), now);

        // 若下一次已超出结束日期，则删除，否则推进UI到 nextAt
        if (!nextAt || isReminderExpired(reminder, nextAt)) {
          toDelete.push(reminder.id);
        } else {
          scheduleUiAdvance(reminder.id, nextAt);
        }
      });

      toDelete.forEach((rid) => { try { hardDeleteReminder(rid); } catch (_) { } });
      if (currentRoot) renderReminders(currentRoot);
      console.log('⏰ 已对齐过期提醒（静默推进/清理）。');
    } catch (e) {
      console.warn('⏰ 对齐过期提醒失败:', e);
    }
  }

  function scheduleUiAdvance(reminderId, atDate) {
    try {
      if (uiAdvanceTimeouts.has(reminderId)) {
        clearTimeout(uiAdvanceTimeouts.get(reminderId));
        uiAdvanceTimeouts.delete(reminderId);
      }
      // 记录允许触发窗口（以该时间为准）
      allowedFireAt.set(reminderId, atDate.getTime());

      const now = Date.now();
      const delay = Math.max(0, atDate.getTime() - now + 500); // 微小偏移，确保在系统展示后推进
      const timeout = setTimeout(() => {
        const r = reminders.find(x => x.id === reminderId);
        if (!r) return;
        const nextToday = getNextTimeToday(r, new Date());
        if (!r.repeatInterval || r.repeatInterval === 'none') {
          if (nextToday) {
            scheduleUiAdvance(reminderId, nextToday);
          } else {
            hardDeleteReminder(reminderId);
          }
        } else {
          advanceReminderNextRunById(reminderId);
        }
      }, delay);
      uiAdvanceTimeouts.set(reminderId, timeout);
    } catch (_) { }
  }

  function formatRepeatText(reminder) {
    if (!reminder || !reminder.repeatInterval || reminder.repeatInterval === 'none') return '';
    const n = reminder.repeatCustomValue && reminder.repeatCustomValue > 0 ? reminder.repeatCustomValue : 1;
    if (reminder.repeatInterval === 'daily') {
      return `循环：每${n === 1 ? '' : n}天`.replace('每天', '每天');
    }
    if (reminder.repeatInterval === 'weekly') {
      return `循环：每${n === 1 ? '' : n}周`;
    }
    if (reminder.repeatInterval === 'monthly') {
      return `循环：每${n === 1 ? '' : n}月`;
    }
    if (reminder.repeatInterval === 'yearly') {
      return `循环：每${n === 1 ? '' : n}年`;
    }
    return '';
  }

  function renderDailyTimesEditor(root, times) {
    const list = root.getElementById('dailyTimesList');
    if (!list) return;
    const values = Array.isArray(times) ? [...times] : [];
    list.innerHTML = '';

    // 工具：创建一行，左格必有输入；右格可选（若为null则只放占位）
    const createRow = (leftVal = '', rightVal = null) => {
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr 1fr';
      row.style.gap = '8px';
      row.style.marginBottom = '8px';
      const makeCell = (val) => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '6px';
        wrap.innerHTML = `<input type=\"time\" class=\"form-input\" value=\"${val}\" style=\"flex:1;\"/><button type=\"button\" class=\"btn btn-danger\" data-remove-input>删除</button>`;
        return wrap;
      };
      // 左格（必有输入）
      row.appendChild(makeCell(leftVal));
      // 右格（可为空占位）
      if (rightVal !== null && rightVal !== undefined) {
        row.appendChild(makeCell(rightVal));
      } else {
        const placeholder = document.createElement('div');
        row.appendChild(placeholder);
      }
      list.appendChild(row);
    };

    // 按两列布局渲染，最后一行若为奇数则只渲染一个输入
    for (let i = 0; i < values.length; i += 2) {
      if (i + 1 < values.length) {
        createRow(values[i] || '', values[i + 1] || '');
      } else {
        createRow(values[i] || '', null);
      }
    }

    // 若没有任何值，初始化一行一个输入（第二格占位），避免空白
    if (values.length === 0) {
      createRow('', null);
    }
  }

  // 计算"今天内"的下一次时间（仅针对 dailyTimes），若没有则返回 null
  function getNextTimeToday(reminder, fromDate) {
    if (!(reminder && reminder.dailyCount > 0 && Array.isArray(reminder.dailyTimes) && reminder.dailyTimes.length > 0)) return null;
    const times = [...reminder.dailyTimes].filter(Boolean).filter(t => isTimeEnabled(reminder, t)).sort();
    const from = fromDate ? new Date(fromDate) : new Date();
    const dateStr = (() => {
      const year = from.getFullYear();
      const month = String(from.getMonth() + 1).padStart(2, '0');
      const day = String(from.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })();
    const hhmm = from.toTimeString().slice(0, 5);
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      if (t > hhmm) return new Date(`${dateStr}T${t}:00`);
    }
    return null;
  }

  // 检查提醒是否超出结束日期
  function isReminderExpired(reminder, checkTime = new Date()) {
    if (!reminder.endDate) return false;
    const end = new Date(`${reminder.endDate}T23:59:59`);
    return checkTime > end;
  }

  // 页面加载时初始化（独立运行模式）
  document.addEventListener("DOMContentLoaded", async function () {
    // 检查是否已经在Shadow DOM中运行，避免重复初始化
    if (window.location.pathname.includes('notification.html')) {
      // 请求通知权限
      await requestNotificationPermission();

      // 设置通知监听器
      setupNotificationListeners();

      // 初始化页面
      initCase(document);
    }

    // 添加测试功能（仅在开发环境下）
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.testNotification = async () => {
        const testReminder = {
          id: 'test-reminder',
          name: '测试药品',
          dosage: '100mg',
          time: '12:00'
        };
        await showNotification(testReminder);
      };
    }
  });

  /**
   * 设置通知监听器
   */
  function setupNotificationListeners() {
    if (!LocalNotifications) {
      return;
    }

    // 防止重复绑定
    if (listenersBound) {
      return;
    }

    try {
      listenersBound = true;
      // 监听通知接收事件（前台触达）
      LocalNotifications.addListener('localNotificationReceived', (notification) => {
        console.log('🔔 收到通知:', notification);
        hapticFeedback('Heavy');
        const id = notification && notification.id;
        if (id && handledNotificationIds.has(id)) {
          console.log('🔔 通知已处理过，跳过:', id);
          return;
        }
        if (id) handledNotificationIds.add(id);

        const rid = notification && notification.extra && notification.extra.reminderId;
        if (!rid) {
          console.log('🔔 通知缺少reminderId，跳过');
          return;
        }

        // 时间窗口与冷却期校验，避免非计划时间的立即触发导致刷屏
        const planned = (notification && notification.extra && notification.extra.plannedAt) || allowedFireAt.get(rid) || null;
        const nowMs = Date.now();
        const EARLY = 90 * 1000; // 最早提前90秒
        const LATE = 5 * 60 * 1000; // 最迟滞后5分钟
        if (!planned || nowMs < planned - EARLY || nowMs > planned + LATE) {
          console.warn('🔔 跳过超出允许窗口的通知:', { rid, planned, nowMs });
          return;
        }
        if (!canSendNotification(rid)) {
          console.log('⏰ 冷却中，跳过处理:', rid);
          return;
        }

        const r = reminders.find(x => x.id === rid);
        if (!r) {
          console.log('🔔 找不到对应的提醒，跳过:', rid);
          return;
        }

        console.log('🔔 处理通知:', r.name, '循环类型:', r.repeatInterval);

        // 设置处理冷却期，防止重复处理同一个通知
        const notificationId = notification.id || 'unknown';
        handledNotificationIds.add(notificationId);

        // 记录冷却，防止重复
        try {
          lastNotificationTime.set(rid, nowMs);
          notificationCooldown.set(rid, nowMs + 2 * 60 * 1000);
        } catch (_) { }

        if (!r.repeatInterval || r.repeatInterval === 'none') {
          const nextToday = getNextTimeToday(r, new Date());
          if (nextToday) {
            console.log('🔔 设置下次提醒:', nextToday.toLocaleString('zh-CN'));
            scheduleUiAdvance(rid, nextToday);
          } else {
            console.log('🔔 今天没有更多提醒，删除提醒');
            hardDeleteReminder(rid);
          }
        } else {
          console.log('🔔 推进到下次循环');
          advanceReminderNextRunById(rid);
        }
      });

      // 监听通知点击事件（用户点开）
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        console.log('🔔 用户点击通知:', notificationAction);
        const { notification } = notificationAction;
        const id = notification && notification.id;
        if (id && handledNotificationIds.has(id)) {
          console.log('🔔 通知已处理过，跳过:', id);
          return;
        }
        if (id) handledNotificationIds.add(id);

        if (!(notification.extra && notification.extra.reminderId)) {
          console.log('🔔 通知缺少reminderId，跳过');
          return;
        }

        const reminderId = notification.extra.reminderId;
        const r = reminders.find(x => x.id === reminderId);
        if (!r) {
          console.log('🔔 找不到对应的提醒，跳过:', reminderId);
          return;
        }

        console.log('🔔 用户点击处理通知:', r.name);

        // 设置处理冷却期，防止重复处理同一个通知
        const notificationId = notification.id || 'unknown';
        handledNotificationIds.add(notificationId);

        if (!r.repeatInterval || r.repeatInterval === 'none') {
          const nextToday = getNextTimeToday(r, new Date());
          if (nextToday) {
            console.log('🔔 设置下次提醒:', nextToday.toLocaleString('zh-CN'));
            scheduleUiAdvance(reminderId, nextToday);
          } else {
            console.log('🔔 今天没有更多提醒，删除提醒');
            hardDeleteReminder(reminderId);
          }
        } else {
          console.log('🔔 推进到下次循环');
          advanceReminderNextRunById(reminderId);
          highlightReminder(reminderId);
        }
      });
    } catch (error) {
      console.error('❌ 设置通知监听器失败:', error);
    }
  }

  /**
   * 高亮显示特定提醒（当用户点击通知时）
   */
  function highlightReminder(reminderId) {
    const reminderCard = document.querySelector(`[data-id="${reminderId}"]`);
    if (reminderCard) {
      reminderCard.style.animation = 'highlight 2s ease-out';
      reminderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        reminderCard.style.animation = '';
      }, 2000);
    }
  }

  // Expose lifecycle functions to global scope for loader
  window.initNotification = initCase;
  window.destroyNotification = destroyCase;

  // 暴露全局函数供HTML调用
  window.editReminder = editReminder;
  window.deleteReminder = deleteReminder;
})();
