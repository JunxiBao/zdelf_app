
(function () {
  const phone = document.getElementById('phone');
  const code = document.getElementById('smsCode');
  const sendBtn = document.getElementById('sendCodeBtn');
  const loginBtn = document.getElementById('smsLoginBtn');
  const popup = document.getElementById('popup');
  const popupText = document.getElementById('popupText');

  function toast(text) {
    if (!popup || !popupText) return alert(text);
    popupText.textContent = text;
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 1800);
  }

  // 仅允许中国大陆手机号（可选+86/86 前缀），号段 13-19，固定 11 位
  function validPhone(v) {
    const raw = v.trim().replace(/\s|-/g, '');
    let num = raw;
    if (raw.startsWith('+86')) num = raw.slice(3);
    else if (raw.startsWith('86')) num = raw.slice(2);
    return /^1[3-9]\d{9}$/.test(num);
  }

  let ticking = false;
  let remain = 60;
  let timer = null;

  function setSendState(disabled) {
    sendBtn.disabled = disabled;
    sendBtn.textContent = disabled ? '重新发送 (' + remain + 's)' : '获取验证码';
  }

  function startCountdown() {
    ticking = true;
    remain = 60;
    setSendState(true);
    timer = setInterval(() => {
      remain -= 1;
      if (remain <= 0) {
        clearInterval(timer);
        ticking = false;
        setSendState(false);
      } else {
        setSendState(true);
      }
    }, 1000);
  }

  sendBtn.addEventListener('click', () => {
    const v = phone.value.trim();
    if (!validPhone(v)) {
      toast('请填写有效手机号');
      return;
    }
    // 视觉反馈
    sendBtn.animate([{ transform: 'translateY(-50%) scale(1)' }, { transform: 'translateY(-50%) scale(0.96)' }, { transform: 'translateY(-50%) scale(1)' }], { duration: 140, easing: 'ease-out' });

    // 标准化为 E.164（+86 开头）
    const normalized = (() => {
      const raw = v.replace(/\s|-/g, '');
      if (raw.startsWith('+86')) return raw;
      if (raw.startsWith('86')) return '+' + raw;
      return '+86' + raw;
    })();

    // TODO: 在此调用后端发送验证码接口，例如 /api/auth/sms/send
    // await fetch('/api/auth/sms/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized }) })

    // 设置加载态（视觉上转圈），这里模拟网络延迟
    sendBtn.classList.add('loading');
    setTimeout(() => {
      sendBtn.classList.remove('loading');
      toast('验证码已发送');
      if (!ticking) startCountdown();
    }, 500);
  });

  loginBtn.addEventListener('click', () => {
    const v = phone.value.trim();
    const c = code.value.trim();

    if (!validPhone(v)) {
      toast('请填写有效手机号');
      return;
    }
    if (!/^\d{6}$/.test(c)) {
      toast('请填写6位验证码');
      return;
    }

    // 标准化为 E.164
    const normalized = (() => {
      const raw = v.replace(/\s|-/g, '');
      if (raw.startsWith('+86')) return raw;
      if (raw.startsWith('86')) return '+' + raw;
      return '+86' + raw;
    })();

    // TODO: 在此调用后端校验接口，例如 /api/auth/sms/login
    // fetch('/api/auth/sms/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: normalized, code: c }) })

    toast('登录中...');
  });
})();
