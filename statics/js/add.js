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

// 新增：用于提交 textarea 内容和日期，展示返回 JSON
async function handleRecordSave() {
  const textarea = document.querySelector('.record-textarea');
  const content = textarea.value.trim();
  const date = document.getElementById('record-date').value;

  if (!content) {
    alert('请输入记录内容');
    return;
  }

  try {
    const response = await fetch('https://zhucan.xyz:5000/deepseek/structured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `日期：${date}\n${content}`
      })
    });

    const data = await response.json();
    console.log("AI 返回数据：", data);

    const aiReplyRaw = data;

    const prettyJSON = JSON.stringify(aiReplyRaw, null, 2);

    console.log("✅ prettyJSON = ", prettyJSON);
    console.log("✅ typeof prettyJSON = ", typeof prettyJSON);
    console.log("✅ aiReplyRaw = ", aiReplyRaw);

    // const blob = new Blob([prettyJSON], { type: 'application/json' });
    // const url = URL.createObjectURL(blob);

    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.border = '1px solid #ccc';
    modal.style.padding = '20px';
    modal.style.zIndex = 10000;
    modal.style.maxWidth = '80vw';
    modal.style.maxHeight = '80vh';
    modal.style.overflowY = 'auto';
    modal.innerHTML = `
      <h3>AI分析结果</h3>
      <pre style="white-space: pre-wrap; word-break: break-all;">${prettyJSON}</pre>
      <button onclick="this.parentNode.remove()">关闭</button>
    `;

    document.body.appendChild(modal);
  } catch (error) {
    console.error('❌ 请求错误', error);
    alert('请求失败，请稍后再试');
  }

  showPopup(); // 显示已保存弹窗
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

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.querySelector('.record-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleRecordSave);
  }
});