const popup = document.getElementById("popup");
const popupText = document.getElementById("popupText");

function showPopup(message, time = 2000) {
  popupText.textContent = message;
  popup.classList.add("show");
  setTimeout(() => {
    popup.classList.remove("show");
  }, time);
}

document.getElementById('registerBtn').addEventListener('click', function () {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const age = document.getElementById('age').value.trim();

  if (!username) {
    showPopup('用户名不能为空');
    return;
  }

  if (username.length > 20) {
    showPopup('用户名不能超过20个字符');
    return;
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,20}$/;
  if (!passwordRegex.test(password)) {
    showPopup('密码必须为8到20位，包含大写字母、小写字母和数字');
    return;
  }

  if (password !== confirmPassword) {
    showPopup('两次输入的密码不一致');
    return;
  }

  if (!age || isNaN(age) || age <= 0) {
    showPopup('请输入有效的年龄');
    return;
  }

  showPopup('注册成功！');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 1500);
});