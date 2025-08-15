(function () {
  const phone = document.getElementById('phone');
  const code = document.getElementById('smsCode');
  const sendBtn = document.getElementById('sendCodeBtn');
  const loginBtn = document.getElementById('smsLoginBtn');
  const popup = document.getElementById('popup');
  const popupText = document.getElementById('popupText');
  const loadingOverlay = document.getElementById('loading-overlay');
  function showLoading() { if (loadingOverlay) loadingOverlay.style.display = 'flex'; }
  function hideLoading() { if (loadingOverlay) loadingOverlay.style.display = 'none'; }

  // 自动探测后端基址：若当前页面是标准 443 端口（location.port 为空），则尝试走同域的 5000 端口直连 Flask；
  // 否则走同源相对路径（假设反向代理已转发 /sms/* 到 Flask）。
  const API_BASE = (!location.port && location.protocol.startsWith('http'))
    ? `${location.protocol}//${location.hostname}:5000`
    : '';
  // 如需强制指定，可在页面上提前设置 window.__API_BASE__ = 'https://your-domain:5000';
  const BASE = (typeof window !== 'undefined' && window.__API_BASE__) || API_BASE;
  const API_SEND = `${BASE}/sms/send`;
  const API_VERIFY = `${BASE}/sms/verify`;

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

    showLoading();
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
      hideLoading();
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

    showLoading();
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

      // 校验通过：如果返回了 user_id/userId 则写入本地并进入首页；否则跳到注册页并带上手机号
      try {
        var uid = data && (data.user_id || data.userId);
        if (uid) {
          localStorage.setItem('loggedInPhone', normalized);
          localStorage.setItem('loggedInUserId', uid);
          localStorage.setItem('userId', uid);
          toast('登录成功，正在进入...');
          setTimeout(function () {
            // 相对路径更稳：避免不同部署子路径下 “/index.html” 指向错误
            window.location.href = '/index.html';
          }, 300);
        } else {
          // 未注册：把手机号暂存以便注册页自动填充
          try { localStorage.setItem('pendingRegisterPhone', normalized); } catch (_) {}
          toast('该手机号尚未注册，正在前往注册页...');
          setTimeout(function () {
            window.location.href = 'register.html';
          }, 300);
        }
      } catch (_) {}
    } catch (e) {
      toast('网络异常，请检查连接');
    } finally {
      loginBtn.classList.remove('loading');
      hideLoading();
    }
  });
})();
