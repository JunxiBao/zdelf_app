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

// 显示加载动画
function showLoader() {
  document.getElementById('loader').style.display = 'flex';
}

// 隐藏加载动画
function hideLoader() {
  document.getElementById('loader').style.display = 'none';
}

// 获取用户名
function getUsername() {
  showLoader();

  const userId = localStorage.getItem('userId');
  console.log("🧪 获取到的 userId:", userId);

  if (!userId || userId === 'undefined' || userId === 'null') {
    console.warn("⚠️ 未获取到有效 userId，显示访客");
    displayGreeting("访客");
    hideLoader();
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.error("⏰ 请求超时，已中断");
    displayGreeting("访客");
    hideLoader();
  }, 8000);

  console.log("📡 正在请求用户信息...");

  fetch('https://zhucan.xyz:5000/readdata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      table_name: "users",
      user_id: userId
    }),
    signal: controller.signal
  })
    .then(response => {
      clearTimeout(timeoutId);
      console.log("✅ 收到服务器响应");
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
      hideLoader();
    })
    .catch(error => {
      console.error('❌ 获取用户信息失败:', error);
      displayGreeting("访客");
      hideLoader();
    });
}

// 显示问候语
function displayGreeting(username) {
  const greeting = getGreeting();
  document.getElementById('greeting').textContent = `${greeting}，${username}`;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
  getUsername();
});
