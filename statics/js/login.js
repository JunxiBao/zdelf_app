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
  const userId = localStorage.getItem("userId");
  if (userId) {
    window.location.href = "../index.html";
    return;
  }

  const loginBtn = document.getElementById("loginBtn");
  loginBtn.addEventListener("click", () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || username.length > 20) {
      showPopup("用户名不能为空且不超过20位");
      return;
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,20}$/;
    if (!passwordRegex.test(password)) {
      showPopup("密码需8-20位，包含大小写和数字");
      return;
    }

    fetch("https://zhucan.xyz:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          localStorage.setItem("userId", data.userId);
          window.location.href = "../index.html";
        } else {
          showPopup("用户名或密码错误");
        }
      })
      .catch(err => {
        console.error(err);
        showPopup("服务器连接失败");
      });
  });
});