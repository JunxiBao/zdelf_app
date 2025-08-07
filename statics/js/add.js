function autoGrow(element) {
  element.style.height = "auto";
  element.style.height = (element.scrollHeight) + "px";
}
document.querySelectorAll('.record-textarea').forEach(autoGrow);

// 弹窗显示函数
function showPopup() {
  const popup = document.getElementById('popup');
  popup.classList.add('show');
  setTimeout(() => {
    popup.classList.remove('show');
  }, 1500); // 1.5秒后自动关闭
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
        instance.element._flatpickr.calendarContainer.classList.add("flatpickr-dark");
      }
    },
  });
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
    .then(res => res.text())
    .then(html => {
      modalContent.innerHTML = html;

      // 动态插入 add.js 脚本
      const script = document.createElement("script");
      script.src = "statics/js/add.js";
      script.async = false;
      document.body.appendChild(script);

      modal.style.display = "block";
    })
    .catch(err => {
      console.error("加载 add.html 失败：", err);
    });
}