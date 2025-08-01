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
  // 显示加载动画
  showLoader();
  
  // 从localStorage获取用户ID（假设登录时存储了）
  const userId = localStorage.getItem('userId');
  
  if (!userId) {
    // 如果没有用户ID，显示默认问候
    displayGreeting("访客");
    hideLoader();
    return;
  }

  // 调用后端API获取用户信息
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
  .then(response => response.json())
  .then(data => {
    if (data.success && data.data.length > 0) {
      const username = data.data[0].username;
      displayGreeting(username);
    } else {
      displayGreeting("访客");
    }
    hideLoader();
  })
  .catch(error => {
    console.error('获取用户信息失败:', error);
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
