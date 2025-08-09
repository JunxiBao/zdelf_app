// --- iOS/WKWebView viewport fix & no-scroll ---
(function () {
  function setVH() {
    var h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    document.documentElement.style.setProperty('--vh', h + 'px');
  }
  // expose so other handlers can call it after blur
  window.__setVH = setVH;
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', setVH);
  window.addEventListener('pageshow', setVH);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', setVH);
    visualViewport.addEventListener('scroll', setVH);
  }
  // 禁止页面上下滚动（仍允许容器内部必要的交互）
  document.addEventListener('touchmove', function (e) {
    if (e.target.closest('.record-container')) return; // 允许在卡片内滚动（如果将来有溢出）
    e.preventDefault();
  }, { passive: false });
})();
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loading-overlay';
loadingOverlay.innerHTML = '<div class="spinner"></div>';
document.body.appendChild(loadingOverlay);

const style = document.createElement('style');
style.innerHTML = `
#loading-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(255, 255, 255, 0.8);
  z-index: 9999;
  display: none;
  align-items: center;
  justify-content: center;
transition: background 0.3s ease;
}

@media (prefers-color-scheme: dark) {
  #loading-overlay {
    background: rgba(0, 0, 0, 0.6);
  }

  .spinner {
    border: 6px solid #444;
    border-top-color: #b197fc;
  }
}
.spinner {
  width: 50px;
  height: 50px;
  border: 6px solid #ccc;
  border-top-color: #7b2cbf;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);

const popup = document.getElementById("popup");
const popupText = document.getElementById("popupText");

function showPopup(message, time = 2000) {
  popupText.textContent = message;
  popup.classList.add("show");
  setTimeout(() => {
    popup.classList.remove("show");
  }, time);
}

document.addEventListener("DOMContentLoaded", () => {

  // 当输入框收起键盘后，延迟更新一次视口高度，避免卡片停在下方
  const allInputs = document.querySelectorAll('input, textarea');
  allInputs.forEach((el) => {
    el.addEventListener('blur', () => setTimeout(() => window.__setVH && window.__setVH(), 60), true);
  });

  const loginBtn = document.getElementById("loginBtn");
  loginBtn.addEventListener("click", () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || username.length > 20) {
      showPopup("用户名不能为空且不超过20位");
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,20}$/;
    if (!passwordRegex.test(password)) {
      showPopup("密码必须为8到20位，包含大写字母、小写字母和数字，一些特殊字符不能包括");
      return;
    }

    showLoading();

    fetch("https://zhucan.xyz:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          hideLoading();
          localStorage.setItem("userId", data.userId);
          window.location.href = "../index.html";
        } else {
          hideLoading();
          showPopup("用户名或密码错误");
        }
      })
      .catch(err => {
        hideLoading();
        console.error(err);
        showPopup("服务器连接失败");
      });
  });
});

function showLoading() {
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

// 初始化隐藏
hideLoading();