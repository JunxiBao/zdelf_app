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
  console.log("🔧 尝试隐藏加载动画");
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = 'none';
    console.log("✅ 加载动画已隐藏");
  } else {
    console.error("❌ 未找到 loader 元素");
  }
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
  document.getElementById('greeting').textContent = `${greeting}，${username}`;
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
  getUsername();
  
  // 调试：5秒后强制隐藏加载动画
  setTimeout(() => {
    console.log("🕐 5秒后强制隐藏加载动画");
    hideLoader();
  }, 5000);
});

// 调试函数：强制隐藏加载动画
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
