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
  const modalContent = document.getElementById('modal-content');
  // 其他代码...

  const script = document.createElement("script");
  script.src = "../../statics/js/add.js";
  script.async = false; // 确保脚本顺序执行
  modalContent.appendChild(script);
}