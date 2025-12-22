/**
 * checkin-reminder-logger.js — 打卡提醒日志系统（独立模块）
 * 
 * 这个模块在所有页面加载前就可用，确保日志记录功能始终可用
 * 即使 settings.js 还没加载，也能记录日志
 */

(function () {
  'use strict';
  
  // 日志存储键名
  const LOGS_STORAGE_KEY = 'checkin_reminder_logs';
  const MAX_LOGS = 500;

  // 从localStorage加载日志
  function loadCheckinReminderLogs() {
    try {
      const stored = localStorage.getItem(LOGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('[checkin-reminder-logger] 加载日志失败:', e);
    }
    return [];
  }

  // 保存日志到localStorage
  function saveCheckinReminderLogs(logs) {
    try {
      // 限制日志数量
      const logsToSave = logs.length > MAX_LOGS 
        ? logs.slice(-MAX_LOGS) 
        : logs;
      localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logsToSave));
    } catch (e) {
      console.warn('[checkin-reminder-logger] 保存日志失败:', e);
      // 如果存储空间不足，尝试删除一些旧日志
      try {
        const reducedLogs = logs.slice(-Math.floor(MAX_LOGS * 0.8));
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(reducedLogs));
      } catch (e2) {
        console.error('[checkin-reminder-logger] 保存日志失败（已尝试缩减）:', e2);
      }
    }
  }

  // 初始化日志数组（从localStorage加载）
  let checkinReminderLogs = loadCheckinReminderLogs();

  // 手动写入日志（供其他函数直接调用）
  function writeCheckinReminderLog(level, message) {
    const timestamp = new Date().toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const logEntry = {
      timestamp,
      level,
      message: String(message)
    };

    checkinReminderLogs.push(logEntry);

    // 限制日志数量并保存
    if (checkinReminderLogs.length > MAX_LOGS) {
      checkinReminderLogs.shift();
    }
    
    // 保存到localStorage（异步，避免阻塞）
    setTimeout(() => {
      saveCheckinReminderLogs(checkinReminderLogs);
    }, 0);

    // 同时输出到console
    if (level === 'error') {
      console.error('[checkin-reminder]', message);
    } else if (level === 'warn') {
      console.warn('[checkin-reminder]', message);
    } else {
      console.log('[checkin-reminder]', message);
    }
  }

  // 获取所有日志
  function getCheckinReminderLogs() {
    // 确保从localStorage加载最新数据
    checkinReminderLogs = loadCheckinReminderLogs();
    return [...checkinReminderLogs];
  }

  // 清空日志
  function clearCheckinReminderLogs() {
    checkinReminderLogs.length = 0;
    try {
      localStorage.removeItem(LOGS_STORAGE_KEY);
    } catch (e) {
      console.warn('[checkin-reminder-logger] 清空日志失败:', e);
    }
  }

  // 立即暴露到全局，确保所有页面都能使用
  window.writeCheckinReminderLog = writeCheckinReminderLog;
  window.getCheckinReminderLogs = getCheckinReminderLogs;
  window.clearCheckinReminderLogs = clearCheckinReminderLogs;

  // 记录模块加载日志
  writeCheckinReminderLog('log', '打卡提醒日志系统已初始化（独立模块）');
  
  console.log('[checkin-reminder-logger] ✅ 打卡提醒日志系统已加载');
})();

