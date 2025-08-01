console.log("🚀 daily.js 开始加载...");

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

// 显示/隐藏加载动画的函数
function showLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = "flex";
}

function hideLoader() {
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = "none";
  }, 400);
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
  const greetingElement = document.getElementById('greeting');
  if (greetingElement) {
    greetingElement.textContent = `${greeting}，${username}`;
  } else {
    console.error("❌ 未找到 greeting 元素");
  }
}

// 页面加载时初始化
console.log("📋 准备添加 DOMContentLoaded 事件监听器...");
document.addEventListener('DOMContentLoaded', function() {
  console.log("🎯 DOMContentLoaded 事件触发了！");
  getUsername();
});

// 立即检查 DOM 是否已经加载完成
if (document.readyState === 'loading') {
  console.log("⏳ DOM 还在加载中...");
} else {
  console.log("✅ DOM 已经加载完成，立即调用 getUsername");
  getUsername();
}

// 调试函数：强制隐藏加载动画（仅在开发环境使用）
function forceHideLoader() {
  console.log("🔧 强制隐藏加载动画");
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = 'none';
    console.log("✅ 强制隐藏成功");
  } else {
    console.error("❌ 未找到 loader 元素");
  }
}

// 仅在开发环境暴露调试函数
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.forceHideLoader = forceHideLoader;
}
