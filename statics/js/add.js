// 全局变量存储选中的心情
let selectedMood = null;
let flatpickrInstance = null;
let isInitialized = false;

// 清理函数：重置所有状态
function cleanupAddPage() {
  try {
    console.log("add.js: 开始清理");

    // 重置全局变量
    selectedMood = null;
    isInitialized = false;

    // 销毁 Flatpickr 实例
    if (flatpickrInstance) {
      try {
        // 在销毁前清理主题监听器
        if (flatpickrInstance._themeChangeHandler && flatpickrInstance._mediaQuery) {
          if (flatpickrInstance._mediaQuery.removeEventListener) {
            flatpickrInstance._mediaQuery.removeEventListener("change", flatpickrInstance._themeChangeHandler);
          } else if (flatpickrInstance._mediaQuery.removeListener) {
            flatpickrInstance._mediaQuery.removeListener(flatpickrInstance._themeChangeHandler);
          }
        }

        flatpickrInstance.destroy();
        console.log("add.js: Flatpickr实例已销毁");
      } catch (error) {
        console.warn("add.js: 销毁Flatpickr实例时出错", error);
      }
      flatpickrInstance = null;
    }

    // 移除所有心情按钮的选中状态和事件绑定标记
    const moodBtns = document.querySelectorAll('.mood-btn');
    moodBtns.forEach(btn => {
      if (btn) {
        btn.classList.remove('selected');
        btn.removeAttribute('data-mood-listener-bound');
      }
    });

    // 清除保存按钮的事件绑定标记
    const saveBtn = document.querySelector('.record-btn');
    if (saveBtn) {
      saveBtn.removeAttribute('data-save-listener-bound');
    }

    console.log("add.js: 清理完成");
  } catch (error) {
    console.error("add.js: 清理过程中出现错误", error);
  }
}

// 心情选择处理函数
function handleMoodSelection() {
  const moodBtns = document.querySelectorAll('.mood-btn');

  moodBtns.forEach(btn => {
    // 检查是否已经绑定了事件监听器，避免重复绑定
    if (!btn.hasAttribute('data-mood-listener-bound')) {
      btn.addEventListener('click', function() {
        // 移除其他按钮的选中状态
        moodBtns.forEach(b => b.classList.remove('selected'));

        // 添加选中状态到当前按钮
        this.classList.add('selected');

        // 存储选中的心情
        selectedMood = {
          mood: this.dataset.mood
        };

        console.log("add.js: 选择了心情", selectedMood.mood);

        // 触觉反馈
        try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
      });

      // 标记已绑定事件监听器
      btn.setAttribute('data-mood-listener-bound', 'true');
    }
  });
}

// Backend API base: absolute by default; can be overridden via window.__API_BASE__
const __API_BASE_DEFAULT__ = (typeof window !== "undefined" && window.__API_BASE__) || "https://app.zdelf.cn";
const __API_BASE__ = __API_BASE_DEFAULT__ && __API_BASE_DEFAULT__.endsWith("/")
  ? __API_BASE_DEFAULT__.slice(0, -1)
  : __API_BASE_DEFAULT__;

// 弹窗显示函数
function showPopup() {
  const popup = document.getElementById("popup");
  popup.classList.add("show");
  setTimeout(() => {
    popup.classList.remove("show");
  }, 1500); // 1.5秒后自动关闭
}

// 创建/移除全屏加载遮罩
function ensureOverlay() {
  let overlay = document.querySelector(".loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "loading-overlay";
    document.body.appendChild(overlay);
  }
  return overlay;
}

// 为按钮添加涟漪效果
function attachButtonRipple(btn) {
  if (!btn) return;
  btn.addEventListener("click", function (e) {
    try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
    const rect = this.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    ripple.style.left = e.clientX - rect.left + "px";
    ripple.style.top = e.clientY - rect.top + "px";
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
  });
}

function handleRecordSave() {
  const date = document.getElementById("record-date").value;
  const moodSelector = document.querySelector(".mood-selector");

  if (!selectedMood) {
    // 用轻微抖动替代弹窗告警
    try { window.__hapticImpact__ && window.__hapticImpact__('Medium'); } catch(_) {}
    moodSelector.classList.remove("shake");
    void moodSelector.offsetWidth; // 触发重绘
    moodSelector.classList.add("shake");
    return;
  }

  // 保存心情数据到本地存储
  const recordData = {
    date: date,
    mood: selectedMood.mood
  };
  localStorage.setItem('health_record_data', JSON.stringify(recordData));

  // 直接跳转到选项页面
  window.location.href = 'src/options.html';
}

// 检查DOM元素是否准备就绪的函数
function waitForElements(callback, maxAttempts = 20) {
  let attempts = 0;

  const checkElements = () => {
    attempts++;
    try {
      const dateInput = document.getElementById("record-date");
      const moodBtns = document.querySelectorAll('.mood-btn');
      const saveBtn = document.querySelector('.record-btn');

      console.log(`add.js: 检查DOM元素 (尝试 ${attempts}/${maxAttempts}) - 日期输入: ${!!dateInput}, 心情按钮: ${moodBtns.length}, 保存按钮: ${!!saveBtn}`);

      // 检查必要的元素是否存在
      if (dateInput && moodBtns.length > 0 && saveBtn) {
        console.log("add.js: 所有DOM元素已准备就绪");
        callback();
      } else if (attempts < maxAttempts) {
        // 继续等待
        setTimeout(checkElements, 50); // 减少等待时间
      } else {
        console.warn("add.js: 等待DOM元素超时，尝试强制初始化");
        // 即使元素不完整也尝试初始化，避免页面卡死
        callback();
      }
    } catch (error) {
      console.error("add.js: 检查DOM元素时出错", error);
      // 发生错误时也尝试初始化
      callback();
    }
  };

  checkElements();
}

function initAdd() {
  console.log("add.js: 开始初始化");

  // 等待DOM元素准备就绪
  waitForElements(() => {
    try {
      console.log("add.js: DOM元素准备就绪，开始清理和初始化");

      // 清理之前的状态
      cleanupAddPage();

      // 创建新的 Flatpickr 实例
      const dateInput = document.getElementById("record-date");
      if (dateInput && typeof flatpickr !== 'undefined') {
        try {
          // 检查当前是否为深色模式
          const isDarkMode = window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;

          flatpickrInstance = flatpickr("#record-date", {
            dateFormat: "Y-m-d",
            defaultDate: "today",
            altInput: true,
            altFormat: "F j, Y",
            allowInput: true,
            clickOpens: true,
            theme: isDarkMode ? "dark" : "light",
            onReady: function (selectedDates, dateStr, instance) {
              // 应用深色模式样式
              if (isDarkMode) {
                instance.calendarContainer.classList.add("flatpickr-dark");
                instance.calendarContainer.classList.add("health-dark-theme");
              }

              // 监听主题变化
              const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
              const handleThemeChange = (e) => {
                if (e.matches) {
                  instance.calendarContainer.classList.add("flatpickr-dark");
                  instance.calendarContainer.classList.add("health-dark-theme");
                } else {
                  instance.calendarContainer.classList.remove("flatpickr-dark");
                  instance.calendarContainer.classList.remove("health-dark-theme");
                }
              };

              // 现代浏览器支持
              if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener("change", handleThemeChange);
              } else if (mediaQuery.addListener) {
                // 兼容性支持
                mediaQuery.addListener(handleThemeChange);
              }

              // 存储监听器引用以便后续清理
              instance._themeChangeHandler = handleThemeChange;
              instance._mediaQuery = mediaQuery;
            },
            onDestroy: function(instance) {
              // 清理主题变化监听器
              if (instance._themeChangeHandler && instance._mediaQuery) {
                if (instance._mediaQuery.removeEventListener) {
                  instance._mediaQuery.removeEventListener("change", instance._themeChangeHandler);
                } else if (instance._mediaQuery.removeListener) {
                  instance._mediaQuery.removeListener(instance._themeChangeHandler);
                }
              }
            }
          });
          console.log("add.js: Flatpickr 初始化成功");
        } catch (error) {
          console.error("add.js: Flatpickr 初始化失败", error);
        }
      } else {
        console.warn("add.js: Flatpickr库未找到或日期输入框不存在");
      }

      // 初始化心情选择器
      handleMoodSelection();

      // 绑定保存按钮事件
      const saveBtn = document.querySelector('.record-btn');
      if (saveBtn && !saveBtn.hasAttribute('data-save-listener-bound')) {
        saveBtn.addEventListener('click', handleRecordSave);
        attachButtonRipple(saveBtn);
        saveBtn.setAttribute('data-save-listener-bound', 'true');
        console.log("add.js: 保存按钮事件已绑定");
      }

      isInitialized = true;
      console.log("add.js: 初始化完成");
    } catch (error) {
      console.error("add.js: 初始化过程中出现错误", error);
    }
  });
}

// 检查是否在模态框环境中
function isInModal() {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");
  return modal && modalContent && modalContent.contains(document.getElementById("record-date"));
}

// 只在模态框场景下初始化，避免主页面加载时的重复初始化
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const dateInput = document.getElementById("record-date");
    if (!isInitialized && dateInput && isInModal()) {
      console.log("add.js: 在模态框环境中检测到add页面元素，开始初始化");
      initAdd();
    } else if (dateInput && !isInModal()) {
      console.log("add.js: 在主页面中检测到add元素，跳过初始化（避免重复）");
    }
  }, 100);
});

// 暴露初始化和清理函数供外部调用
window.initAddPage = initAdd;
window.cleanupAddPage = cleanupAddPage;
