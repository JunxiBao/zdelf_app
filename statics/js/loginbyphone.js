(function () {
  const phone = document.getElementById('phone');
  const code = document.getElementById('smsCode');
  const sendBtn = document.getElementById('sendCodeBtn');
  const loginBtn = document.getElementById('smsLoginBtn');
  const popup = document.getElementById('popup');
  const popupText = document.getElementById('popupText');

  const API_SEND = '/sms/send';
  const API_VERIFY = '/sms/verify';

  function toast(text) {
    if (!popup || !popupText) return alert(text);
    popupText.textContent = text;
    popup.classList.add('show');
    setTimeout(() => popup.classList.remove('show'), 1800);
  }

  // 仅允许中国大陆手机号（可选+86/86 前缀），号段 13-19，固定 11 位
  function validPhone(v) {
    const raw = (v || '').trim().replace(/\s|-/g, '');
    let num = raw;
    if (raw.startsWith('+86')) num = raw.slice(3);
    else if (raw.startsWith('86')) num = raw.slice(2);
    return /^1[3-9]\d{9}$/.test(num);
  }

  function normalizeE164(v) {
    const raw = (v || '').trim().replace(/\s|-/g, '');
    if (raw.startsWith('+86')) return raw;
    if (raw.startsWith('86')) return '+' + raw;
    return '+86' + raw;
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

  sendBtn.addEventListener('click', async () => {
    const v = phone.value;
    if (!validPhone(v)) {
      toast('请填写有效手机号');
      return;
    }

    // 视觉反馈
    sendBtn.animate([
      { transform: 'translateY(-50%) scale(1)' },
      { transform: 'translateY(-50%) scale(0.96)' },
      { transform: 'translateY(-50%) scale(1)' }
    ], { duration: 140, easing: 'ease-out' });

    const normalized = normalizeE164(v);

    try {
      sendBtn.classList.add('loading');
      const res = await fetch(API_SEND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: normalized })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        const msg = (data && data.message) || '发送失败，请稍后重试';
        toast(msg);
        return;
      }
      toast((data && data.message) || '验证码已发送');
      if (!ticking) startCountdown();
    } catch (e) {
      toast('网络异常，请检查连接');
    } finally {
      sendBtn.classList.remove('loading');
    }
  });

  loginBtn.addEventListener('click', async () => {
    const v = phone.value;
    const c = (code.value || '').trim();

    if (!validPhone(v)) {
      toast('请填写有效手机号');
      return;
    }
    if (!/^\d{6}$/.test(c)) {
      toast('请填写6位验证码');
      return;
    }

    const normalized = normalizeE164(v);

    try {
      loginBtn.classList.add('loading');
      const res = await fetch(API_VERIFY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phone: normalized, code: c })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.success === false) {
        const msg = (data && data.message) || '验证码校验失败';
        toast(msg);
        return;
      }

      // 校验通过：前端本地做登录标记并跳转主页（你的应用通过 index.html 动态加载）
      try {
        localStorage.setItem('loggedInPhone', normalized);
      } catch (_) {}
      toast('登录成功，正在进入...');
      setTimeout(() => {
        window.location.replace('index.html');
      }, 300);
    } catch (e) {
      toast('网络异常，请检查连接');
    } finally {
      loginBtn.classList.remove('loading');
    }
  });
})();
