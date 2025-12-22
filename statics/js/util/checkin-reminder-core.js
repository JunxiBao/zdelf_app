/**
 * checkin-reminder-core.js — 打卡提醒核心函数（提前加载）
 * 
 * 这个模块在所有页面加载前就可用，确保关键函数始终可用
 * 即使 settings.js 还没加载，也能正常工作
 */

(function () {
  'use strict';
  
  // 如果已经加载过，跳过
  if (window.__checkin_reminder_core_loaded__) {
    return;
  }
  window.__checkin_reminder_core_loaded__ = true;
  
  // 获取今天的日期字符串（使用Asia/Shanghai时区）
  function getTodayDateString() {
    try {
      const now = new Date();
      const shanghaiDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
      const year = shanghaiDate.getFullYear();
      const month = String(shanghaiDate.getMonth() + 1).padStart(2, '0');
      const day = String(shanghaiDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (_) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  // 暴露 getTodayDateString
  if (!window.getTodayDateString) {
    window.getTodayDateString = getTodayDateString;
  }
  
  // 取消今天的打卡提醒（后备实现，如果 settings.js 未加载）
  if (!window.cancelCheckinReminderForToday) {
    window.cancelCheckinReminderForToday = async function() {
      if (window.writeCheckinReminderLog) {
        window.writeCheckinReminderLog('log', '========== 打卡完成，开始处理提醒调度（使用核心模块后备实现）==========');
      }
      
      try {
        const todayStr = getTodayDateString();
        if (window.writeCheckinReminderLog) {
          window.writeCheckinReminderLog('log', `当前日期: ${todayStr}`);
        }
        
        // 尝试取消今天的提醒
        if (window.cancelCheckinReminderForDate) {
          if (window.writeCheckinReminderLog) {
            window.writeCheckinReminderLog('log', `调用 cancelCheckinReminderForDate（日期: ${todayStr}）`);
          }
          await window.cancelCheckinReminderForDate(todayStr);
        } else if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
          // 直接调用 LocalNotifications API
          const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
          if (window.writeCheckinReminderLog) {
            window.writeCheckinReminderLog('log', '使用 LocalNotifications API 直接取消通知');
          }
          
          // 尝试使用 getPending 获取所有打卡提醒通知
          let notificationsToCancel = [];
          if (typeof LocalNotifications.getPending === 'function') {
            try {
              const pending = await LocalNotifications.getPending();
              const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
              for (const notification of pendingNotifications) {
                if (notification.extra && notification.extra.type === 'checkin_reminder') {
                  notificationsToCancel.push({ id: notification.id });
                  if (window.writeCheckinReminderLog) {
                    window.writeCheckinReminderLog('log', `发现打卡提醒通知：ID ${notification.id}`);
                  }
                }
              }
            } catch (e) {
              if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('warn', `getPending 失败: ${e.message || e}`);
              }
            }
          }
          
          // 如果没有找到，使用固定ID
          if (notificationsToCancel.length === 0) {
            notificationsToCancel = [{ id: 10001 }, { id: 10002 }];
            if (window.writeCheckinReminderLog) {
              window.writeCheckinReminderLog('log', '使用固定通知ID取消');
            }
          }
          
          if (notificationsToCancel.length > 0) {
            await LocalNotifications.cancel({ notifications: notificationsToCancel });
            if (window.writeCheckinReminderLog) {
              window.writeCheckinReminderLog('log', `✅ 已取消 ${notificationsToCancel.length} 个通知`);
            }
          }
        }
        
        // 清除缓存
        if (window.clearSubmissionCache) {
          if (window.writeCheckinReminderLog) {
            window.writeCheckinReminderLog('log', `清除提交状态缓存: ${todayStr}`);
          }
          window.clearSubmissionCache(todayStr);
        }
        
        // 等待 settings.js 加载并重新调度
        if (window.writeCheckinReminderLog) {
          window.writeCheckinReminderLog('log', '检查提醒设置状态');
        }
        // 默认打开（如果未设置，返回 true）
        const stored = localStorage.getItem('checkin_reminder_enabled');
        const enabled = stored !== null ? stored === 'true' : true;
        if (window.writeCheckinReminderLog) {
          window.writeCheckinReminderLog('log', `提醒设置状态：${enabled ? '已启用' : '未启用'}`);
        }
        
        if (enabled) {
          // 等待 settings.js 加载完成（最多等待5秒）
          if (window.writeCheckinReminderLog) {
            window.writeCheckinReminderLog('log', '检查 settings.js 是否已加载');
          }
          
          let retryCount = 0;
          const maxRetries = 10; // 5秒（10次 * 500ms）
          
          const trySchedule = async () => {
            if (window.scheduleCheckinReminder) {
              if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('log', 'settings.js 已加载，开始重新调度提醒');
              }
              
              // 清除之前的定时器
              if (window.scheduleTimeout) {
                clearTimeout(window.scheduleTimeout);
              }
              
              // 延迟3秒再调度，确保数据已同步到服务器
              window.scheduleTimeout = setTimeout(async () => {
                try {
                  if (window.writeCheckinReminderLog) {
                    window.writeCheckinReminderLog('log', '延迟定时器触发，开始重新调度提醒');
                    window.writeCheckinReminderLog('log', '开始重新调度提醒（今天已提交，检查是否需要预约明天的提醒）');
                  }
                  await window.scheduleCheckinReminder({ forceTodaySubmitted: true });
                  if (window.writeCheckinReminderLog) {
                    window.writeCheckinReminderLog('log', '重新调度提醒完成');
                    window.writeCheckinReminderLog('log', '========== 打卡完成后的提醒处理流程结束 ==========');
                  }
                } catch (error) {
                  if (window.writeCheckinReminderLog) {
                    window.writeCheckinReminderLog('error', `重新调度提醒失败: ${error.message || error}`);
                    if (error.stack) {
                      window.writeCheckinReminderLog('error', `错误堆栈: ${error.stack}`);
                    }
                  }
                } finally {
                  window.scheduleTimeout = null;
                }
              }, 3000);
              
              if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('log', '延迟调度定时器已设置（3秒后执行）');
              }
            } else if (retryCount < maxRetries) {
              retryCount++;
              if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('log', `settings.js 未加载，等待中... (${retryCount}/${maxRetries})`);
              }
              setTimeout(trySchedule, 500);
            } else {
              if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('warn', 'settings.js 未加载，无法重新调度提醒');
                window.writeCheckinReminderLog('log', '========== 打卡完成后的提醒处理流程结束（settings.js未加载）==========');
              }
            }
          };
          
          // 立即检查一次，如果已加载则不需要等待
          trySchedule();
        } else {
          if (window.writeCheckinReminderLog) {
            window.writeCheckinReminderLog('log', '打卡提醒未启用，跳过重新调度');
            window.writeCheckinReminderLog('log', '========== 打卡完成后的提醒处理流程结束（提醒未启用）==========');
          }
        }
      } catch (error) {
        if (window.writeCheckinReminderLog) {
          window.writeCheckinReminderLog('error', `取消今天的打卡提醒失败: ${error.message || error}`);
          if (error.stack) {
            window.writeCheckinReminderLog('error', `错误堆栈: ${error.stack}`);
          }
          window.writeCheckinReminderLog('log', '========== 打卡完成后的提醒处理流程异常结束 ==========');
        }
        console.error('[checkin-reminder-core] 取消今天的打卡提醒失败:', error);
      }
    };
    
    if (window.writeCheckinReminderLog) {
      window.writeCheckinReminderLog('log', '✅ 打卡提醒核心函数已加载（后备实现）');
    }
  }
  
  console.log('[checkin-reminder-core] ✅ 打卡提醒核心函数模块已加载');
})();
