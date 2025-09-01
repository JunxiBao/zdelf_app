// 全局变量存储选中的心情
let selectedMood = null;

// 心情选择处理函数
function handleMoodSelection() {
  const moodBtns = document.querySelectorAll('.mood-btn');

  moodBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      // 移除其他按钮的选中状态
      moodBtns.forEach(b => b.classList.remove('selected'));

      // 添加选中状态到当前按钮
      this.classList.add('selected');

      // 存储选中的心情
      selectedMood = {
        mood: this.dataset.mood
      };

      // 触觉反馈
      try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
    });
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

function initAdd() {
  flatpickr("#record-date", {
    dateFormat: "Y-m-d",
    defaultDate: "today",
    altInput: true,
    altFormat: "F j, Y",
    allowInput: true,
    clickOpens: true,
    onReady: function (selectedDates, dateStr, instance) {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        instance.element._flatpickr.calendarContainer.classList.add(
          "flatpickr-dark"
        );
      }
    },
  });

  // 初始化心情选择器
  handleMoodSelection();
}

if (document.getElementById("record-date")) {
  initAdd();
}

function openModal() {
  const modal = document.getElementById("modal");
  const modalContent = document.getElementById("modalContent");

  // 清空内容，确保每次都是全新加载
  modalContent.innerHTML = "";

  // 动态加载 HTML 内容（你可以根据实际路径调整此地址）
  fetch("src/add.html")
    .then((res) => res.text())
    .then((html) => {
      modalContent.innerHTML = html;

      // 动态插入 add.js 脚本
      const script = document.createElement("script");
      script.src = "statics/js/add.js";
      script.async = false;
      document.body.appendChild(script);

      modal.style.display = "block";
    })
    .catch((err) => {
      console.error("加载 add.html 失败：", err);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.querySelector(".record-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", handleRecordSave);
    attachButtonRipple(saveBtn);
  }
});
