/**
 * browser-notifications.js — 浏览器通知封装
 * 
 * 提供与 Capacitor LocalNotifications 兼容的 API，在浏览器环境下使用浏览器原生通知
 * 
 * 支持的 API:
 * - schedule({ notifications: [...] })
 * - cancel({ notifications: [...] })
 * - getPending()
 * - requestPermissions()
 * - checkPermissions()
 * - addListener(event, callback)
 */

(function () {
  'use strict';

  // 如果已经加载过，跳过
  if (window.__browser_notifications_loaded__) {
    return;
  }
  window.__browser_notifications_loaded__ = true;

  // 存储待发送的通知
  const pendingNotifications = new Map(); // id -> notification data
  const scheduledNotifications = new Map(); // id -> timeout reference
  const listeners = {
    localNotificationReceived: [],
    localNotificationActionPerformed: []
  };

  // 检查浏览器是否支持通知
  const isSupported = () => {
    return 'Notification' in window;
  };

  // 浏览器通知封装类
  const BrowserNotifications = {
    /**
     * 调度通知
     * @param {Object} options - { notifications: [...] }
     * @returns {Promise}
     */
    async schedule(options) {
      if (!isSupported()) {
        throw new Error('浏览器不支持通知功能');
      }

      const { notifications } = options || {};
      if (!Array.isArray(notifications) || notifications.length === 0) {
        return { notifications: [] };
      }

      // 请求权限（如果需要）
      const permission = await this.checkPermissions();
      if (permission.display !== 'granted') {
        const result = await this.requestPermissions();
        if (result.display !== 'granted') {
          throw new Error('通知权限未授予');
        }
      }

      const results = [];

      for (const notificationData of notifications) {
        try {
          const { id, title, body, schedule, extra, sound, actionTypeId } = notificationData;
          
          // 计算通知触发时间
          let triggerTime = null;
          if (schedule) {
            if (schedule.at) {
              // schedule.at 可能是 Date 对象、时间戳或日期字符串
              const atValue = schedule.at;
              if (atValue instanceof Date) {
                triggerTime = atValue.getTime();
              } else if (typeof atValue === 'number') {
                triggerTime = atValue;
              } else {
                triggerTime = new Date(atValue).getTime();
              }
              // 如果时间无效，使用当前时间
              if (isNaN(triggerTime)) {
                console.warn('⚠️ 无效的通知时间，使用当前时间');
                triggerTime = Date.now();
              }
            } else if (schedule.on) {
              // 处理日期触发
              const date = new Date(schedule.on.date);
              if (schedule.on.hour !== undefined && schedule.on.minute !== undefined) {
                date.setHours(schedule.on.hour, schedule.on.minute, 0, 0);
              }
              triggerTime = date.getTime();
            } else if (schedule.every) {
              // 重复通知 - 浏览器不支持，使用 setTimeout 模拟
              console.warn('⚠️ 浏览器通知不支持重复通知，将立即发送');
              triggerTime = Date.now();
            } else if (schedule.in) {
              // 延迟通知
              triggerTime = Date.now() + (schedule.in.seconds * 1000 || 0);
            } else {
              triggerTime = Date.now();
            }
          } else {
            // 没有 schedule，立即发送
            triggerTime = Date.now();
          }

          // 存储通知数据
          pendingNotifications.set(id, {
            id,
            title: title || '通知',
            body: body || '',
            extra: extra || {},
            sound,
            actionTypeId,
            scheduledAt: triggerTime
          });

          // 计算延迟时间
          const delay = Math.max(0, triggerTime - Date.now());
          
          // 如果通知时间已过期，立即发送（delay = 0）
          if (delay === 0 && triggerTime < Date.now() - 1000) {
            console.log('⚠️ 通知时间已过期，立即发送:', title);
          }

          // 调度通知
          const timeoutId = setTimeout(() => {
            this._showNotification(id, title, body, extra, actionTypeId);
            pendingNotifications.delete(id);
            scheduledNotifications.delete(id);
          }, delay);

          scheduledNotifications.set(id, timeoutId);

          results.push({ id });
        } catch (error) {
          console.error('❌ 调度浏览器通知失败:', error);
          results.push({ id: notificationData.id, error: error.message });
        }
      }

      return { notifications: results };
    },

    /**
     * 显示通知（内部方法）
     */
    _showNotification(id, title, body, extra, actionTypeId) {
      if (!isSupported() || Notification.permission !== 'granted') {
        return;
      }

      try {
        // 尝试使用应用图标，如果不存在则使用默认图标
        // 使用相对路径，兼容不同的部署环境
        const iconPath = './images/happy.png'; // 使用应用图标
        
        const notification = new Notification(title, {
          body: body,
          icon: iconPath,
          tag: `notification-${id}`,
          data: extra || {},
          badge: iconPath,
          requireInteraction: false // 允许通知自动关闭
        });

        // 触发 localNotificationReceived 事件
        // 注意：Capacitor 的 localNotificationReceived 事件直接传递通知对象，不是包装在 { notification: ... } 中
        this._triggerEvent('localNotificationReceived', {
          id,
          title,
          body,
          extra: extra || {},
          actionTypeId
        });

        // 点击通知时触发 localNotificationActionPerformed
        notification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          notification.close();

          this._triggerEvent('localNotificationActionPerformed', {
            notification: {
              id,
              title,
              body,
              extra: extra || {},
              actionTypeId
            },
            actionId: 'tap'
          });
        };

        // 自动关闭通知（5秒后）
        setTimeout(() => {
          notification.close();
        }, 5000);

        console.log('🔔 浏览器通知已发送:', title);
      } catch (error) {
        console.error('❌ 显示浏览器通知失败:', error);
      }
    },

    /**
     * 取消通知
     * @param {Object} options - { notifications: [{ id: ... }, ...] }
     * @returns {Promise}
     */
    async cancel(options) {
      const { notifications } = options || {};
      if (!Array.isArray(notifications)) {
        return;
      }

      for (const { id } of notifications) {
        // 清除定时器
        const timeoutId = scheduledNotifications.get(id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          scheduledNotifications.delete(id);
        }

        // 从待发送列表中移除
        pendingNotifications.delete(id);
      }

      return;
    },

    /**
     * 获取待发送的通知
     * @returns {Promise<{ notifications: [...] }>}
     */
    async getPending() {
      const notifications = Array.from(pendingNotifications.values()).map(notif => ({
        id: notif.id,
        title: notif.title,
        body: notif.body,
        schedule: {
          at: new Date(notif.scheduledAt)
        },
        extra: notif.extra,
        sound: notif.sound,
        actionTypeId: notif.actionTypeId
      }));

      return { notifications };
    },

    /**
     * 请求通知权限
     * @returns {Promise<{ display: 'granted' | 'denied' | 'prompt' }>}
     */
    async requestPermissions() {
      if (!isSupported()) {
        return { display: 'denied' };
      }

      try {
        const permission = await Notification.requestPermission();
        return { display: permission };
      } catch (error) {
        console.error('❌ 请求通知权限失败:', error);
        return { display: 'denied' };
      }
    },

    /**
     * 检查通知权限
     * @returns {Promise<{ display: 'granted' | 'denied' | 'prompt' }>}
     */
    async checkPermissions() {
      if (!isSupported()) {
        return { display: 'denied' };
      }

      return { display: Notification.permission };
    },

    /**
     * 添加事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Object} - 包含 remove 方法的对象
     */
    addListener(event, callback) {
      if (!listeners[event]) {
        listeners[event] = [];
      }

      listeners[event].push(callback);

      // 返回移除函数
      return {
        remove: () => {
          const index = listeners[event].indexOf(callback);
          if (index > -1) {
            listeners[event].splice(index, 1);
          }
        }
      };
    },

    /**
     * 触发事件（内部方法）
     */
    _triggerEvent(event, data) {
      if (listeners[event]) {
        listeners[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`❌ 事件监听器执行失败 (${event}):`, error);
          }
        });
      }
    }
  };

  // 如果 Capacitor LocalNotifications 不可用，且浏览器支持通知，则使用浏览器通知
  if (typeof window !== 'undefined' && isSupported()) {
    // 挂载浏览器通知的函数
    const mountBrowserNotifications = () => {
      // 检查是否在浏览器环境（非 Capacitor 原生环境）
      const isBrowser = !window.Capacitor || 
                        !window.Capacitor.isNativePlatform || 
                        !window.Capacitor.isNativePlatform();

      if (isBrowser) {
        // 如果 Capacitor LocalNotifications 不可用，则使用浏览器通知
        if (!window.Capacitor || 
            !window.Capacitor.Plugins || 
            !window.Capacitor.Plugins.LocalNotifications) {
          
          // 创建 Capacitor.Plugins 对象（如果不存在）
          if (!window.Capacitor) {
            window.Capacitor = {};
          }
          if (!window.Capacitor.Plugins) {
            window.Capacitor.Plugins = {};
          }

          // 将浏览器通知封装挂载到 Capacitor.Plugins.LocalNotifications
          window.Capacitor.Plugins.LocalNotifications = BrowserNotifications;
          
          console.log('✅ 浏览器通知封装已加载，将使用浏览器原生通知');
          return true;
        } else {
          console.log('✅ Capacitor LocalNotifications 已可用，将使用原生通知');
          return false;
        }
      }
      return false;
    };

    // 立即尝试挂载
    mountBrowserNotifications();

    // 如果 Capacitor 还未加载，监听 DOMContentLoaded 事件
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(mountBrowserNotifications, 100);
      });
    }

    // 延迟挂载（给 Capacitor 一些时间加载）
    setTimeout(mountBrowserNotifications, 500);
  }

  // 暴露到全局（可选，用于调试）
  if (typeof window !== 'undefined') {
    window.BrowserNotifications = BrowserNotifications;
    
    // 页面关闭时清理所有定时器
    window.addEventListener('beforeunload', () => {
      scheduledNotifications.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      scheduledNotifications.clear();
      pendingNotifications.clear();
    });
    
    // 页面隐藏时的处理（某些浏览器会在页面隐藏时限制通知）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 页面隐藏时，可以保留定时器，但记录状态
        const pendingCount = pendingNotifications.size;
        if (pendingCount > 0) {
          console.warn(`[browser-notifications] ⚠️ 页面已隐藏，但仍有 ${pendingCount} 个通知待发送。注意：如果页面关闭，这些通知将丢失（浏览器限制）`);
        }
      }
    });
  }

  console.log('[browser-notifications] ✅ 浏览器通知封装模块已加载');
})();

