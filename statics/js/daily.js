// 获取问候语函数
function getGreeting() {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return "早上好";
  } else if (hour >= 12 && hour < 14) {
    return "中午好";
  } else if (hour >= 14 && hour < 18) {
    return "下午好";
  } else if (hour >= 18 && hour < 22) {
    return "晚上好";
  } else {
    return "夜深了";
  }
}



// 获取用户名
function getUsername() {
  const userId = localStorage.getItem('userId');
  console.log("🧪 获取到的 userId:", userId);

  if (!userId || userId === 'undefined' || userId === 'null') {
    console.warn("⚠️ 未获取到有效 userId，显示访客");
    displayGreeting("访客");
    return;
  }

  // 测试网络连接
  console.log("🌐 测试网络连接...");
  fetch('https://zhucan.xyz:5000/readdata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      table_name: "users",
      user_id: userId
    })
  })
  .then(response => {
    console.log("📡 收到响应，状态码:", response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log("📦 返回数据：", data);
    if (data.success && data.data.length > 0) {
      const username = data.data[0].username || "访客";
      displayGreeting(username);
    } else {
      displayGreeting("访客");
    }
  })
  .catch(error => {
    console.error('❌ 获取用户信息失败:', error);
    displayGreeting("访客");
  });
}

// 显示问候语
function displayGreeting(username) {
  const greeting = getGreeting();
  const greetingElement = document.getElementById('greeting');
  if (greetingElement) {
    greetingElement.textContent = `${greeting}，${username}`;
  } else {
    console.error("❌ 未找到 greeting 元素");
  }
}

// 页面加载时初始化
// 对于动态加载的脚本，DOMContentLoaded 可能已经触发过了
// 所以直接检查 DOM 状态并执行
if (document.readyState === 'loading') {
  // DOM 还在加载中，等待 DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    getUsername();
  });
} else {
  // DOM 已经加载完成，立即执行
  getUsername();
}



// deepseek
const doctorButton = document.getElementById('doctor-button');
const doctorPopup = document.getElementById('doctor-popup');

doctorButton.addEventListener('click', () => {
  if (!doctorPopup.classList.contains('show')) {
    doctorPopup.classList.add('show');
  } else if (!doctorPopup.classList.contains('hiding')) {
    doctorPopup.classList.add('hiding');
    doctorPopup.addEventListener('transitionend', function handler() {
      doctorPopup.classList.remove('show', 'hiding');
      doctorPopup.style.display = 'none';
      doctorPopup.removeEventListener('transitionend', handler);
    });
  }
});

document.addEventListener('click', (event) => {
  if (doctorPopup.classList.contains('show') && !doctorButton.contains(event.target) && !doctorPopup.contains(event.target)) {
    doctorPopup.classList.add('hiding');
    doctorPopup.addEventListener('transitionend', function handler() {
      doctorPopup.classList.remove('show', 'hiding');
      doctorPopup.style.display = 'none';
      doctorPopup.removeEventListener('transitionend', handler);
    });
  }
});

// Ensure display block is set when showing popup
const observer = new MutationObserver(() => {
  if (doctorPopup.classList.contains('show')) {
    doctorPopup.style.display = 'block';
  }
});
observer.observe(doctorPopup, { attributes: true, attributeFilter: ['class'] });


