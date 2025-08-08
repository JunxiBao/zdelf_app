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

// 创建/移除全屏加载遮罩
function ensureOverlay() {
  let overlay = document.querySelector('.loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    document.body.appendChild(overlay);
  }
  return overlay;
}

// 为按钮添加涟漪效果
function attachButtonRipple(btn) {
  if (!btn) return;
  btn.addEventListener('click', function (e) {
    const rect = this.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top = (e.clientY - rect.top) + 'px';
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
  });
}

async function handleRecordSave() {
  const textarea = document.querySelector('.record-textarea');
  const content = textarea.value.trim();
  const date = document.getElementById('record-date').value;

  const spinner = document.getElementById('spinner');
  const saveBtn = document.querySelector('.record-btn');

  if (!content) {
    // 用轻微抖动替代弹窗告警
    textarea.classList.remove('shake');
    void textarea.offsetWidth; // 触发重绘
    textarea.classList.add('shake');
    textarea.focus();
    return;
  }

  // UI: 禁用交互 + 遮罩 + 按钮文案
  const overlay = ensureOverlay();
  overlay.classList.add('show');
  spinner.classList.add('show');
  saveBtn.disabled = true;
  const prevText = saveBtn.textContent;
  saveBtn.textContent = '保存中…';

  try {
    const response = await fetch('https://zhucan.xyz:5000/deepseek/structured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `日期：${date}\n${content}`
      })
    });

    const data = await response.json();
    const prettyJSON = JSON.stringify(data, null, 2);

    // 半透明遮罩 + 面板
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.25); backdrop-filter: blur(2px); opacity: 0; transition: opacity .2s ease;`;

    const panel = document.createElement('div');
    panel.style.cssText = `transform: scale(.96); opacity: 0; transition: transform .2s ease, opacity .2s ease; background: #fff; color: #000; border: 1px solid #ccc; padding: 20px; max-width: 80vw; max-height: 80vh; overflow: auto; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.2);`;

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      panel.style.background = '#1e1e1e';
      panel.style.color = '#ddd';
      panel.style.border = '1px solid #444';
    }

    panel.innerHTML = `
      <h3 style="margin: 0 0 12px; color: var(--ai-panel-heading-color, #222);">AI分析结果</h3>
      <textarea
        id="aiResultEditor"
        style="
          width: 70vw;
          max-width: 900px;
          height: 50vh;
          min-height: 260px;
          resize: vertical;
          padding: 10px;
          border: 1px solid #ccc;
          font-size: 14px;
          background: var(--ai-panel-textarea-bg, #f5f5f5);
          color: var(--ai-panel-textarea-color, #222);
        "
      ></textarea>
      <div style="display:flex; gap:12px; justify-content:center; margin-top: 16px;">
        <button id="copyBtn" class="record-btn" style="max-width:220px; padding: 10px 18px;">复制到剪贴板</button>
        <button id="closeModalBtn" class="record-btn" style="max-width:220px; padding: 10px 18px;">确定</button>
      </div>`;

    // Dark mode adaptation
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      const textareaEl = panel.querySelector('#aiResultEditor');
      textareaEl.style.background = '#2b2b2b';
      textareaEl.style.color = '#ddd';
      textareaEl.style.border = '1px solid #444';
      const heading = panel.querySelector('h3');
      if (heading) heading.style.color = '#ddd';
      panel.querySelectorAll('.record-btn').forEach(btn => {
        btn.style.background = '#333';
        btn.style.color = '#ddd';
        btn.style.border = '1px solid #555';
      });
    }

    modal.appendChild(panel);
    document.body.appendChild(modal);

    // 填充文本，避免 innerHTML 转义问题
    panel.querySelector('#aiResultEditor').value = prettyJSON;

    // 入场动画
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
      panel.style.transform = 'scale(1)';
      panel.style.opacity = '1';
    });

    // 关闭逻辑
    function closeModal() {
      modal.style.opacity = '0';
      panel.style.transform = 'scale(.96)';
      panel.style.opacity = '0';
      setTimeout(() => modal.remove(), 180);
    }
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    panel.querySelector('#closeModalBtn').addEventListener('click', closeModal);
    document.addEventListener('keydown', function escClose(ev) {
      if (ev.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escClose); }
    });

    // 复制功能
    panel.querySelector('#copyBtn').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(panel.querySelector('#aiResultEditor').value); showPopup(); } catch (_) {}
    });

  } catch (error) {
    console.error('❌ 请求错误', error);
    textarea.classList.remove('shake'); void textarea.offsetWidth; textarea.classList.add('shake');
  } finally {
    spinner.classList.remove('show');
    overlay.classList.remove('show');
    saveBtn.disabled = false;
    saveBtn.textContent = prevText;
    showPopup();
  }
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
    attachButtonRipple(saveBtn);
  }
});