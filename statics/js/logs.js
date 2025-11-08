(function () {
  'use strict';
  console.debug('[logs] logs.js 已加载');

  // DOM
  let backBtn, fileSelect, tailSelect, refreshBtn, autoRefresh, stickBottom;
  let searchInput, clearSearch, viewer, loadingEl, logContent;
  let levelToggles;
  let showLineNumbersToggle, useRegexToggle, caseSensitiveToggle;
  let prevMatchBtn, nextMatchBtn, matchCountBadge, copyBtn, downloadBtn, jumpBottomBtn;
  let controlsEl, toggleControlsBtn, summaryFileEl, summaryTailEl, summaryAutoEl;
  let fileListEl;
  // Auth overlay
  let authOverlay, authUsername, authPassword, authLoginBtn, authErrorEl;

  // 状态
  let files = [];
  let currentFile = '';
  let currentTail = 1000;
  let rawText = '';
  let searchQuery = '';
  let activeLevels = new Set(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']);
  let timer = null;
  let isInitial = true;
  let useRegex = false;
  let caseSensitive = false;
  let showLineNumbers = false;
  let lastMarks = [];
  let currentMarkIndex = -1;

  function getApiBase() {
    try {
      let base = (window.__API_BASE__ || window.API_BASE || localStorage.getItem('API_BASE') || '').trim();
      if (!base) {
        // 与项目其它页面保持一致的默认值
        base = 'https://app.zdelf.cn';
      }
      return base.replace(/\/$/, '');
    } catch (_) { return 'https://app.zdelf.cn'; }
  }
  function api(path) {
    const base = getApiBase();
    return `${base}${path}`;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  function showLoading(show) {
    if (!loadingEl) return;
    loadingEl.hidden = !show;
    viewer.setAttribute('aria-busy', show ? 'true' : 'false');
  }

  function formatBytes(b) {
    if (b == null) return '';
    const units = ['B','KB','MB','GB']; let u = 0; let n = b;
    while (n >= 1024 && u < units.length - 1) { n /= 1024; u++; }
    return `${n.toFixed(1)}${units[u]}`;
  }

  function levelOf(line) {
    // 兼容两种格式：
    // 1) 2025-... [LEVEL] [name] message
    // 2) HH:MM:SS L message（L 为等级首字母）
    let m = line.match(/\[(DEBUG|INFO|WARNING|ERROR|CRITICAL)\]/);
    if (m) return m[1];
    m = line.match(/^\d{2}:\d{2}:\d{2}\s+([DIWEC])\b/);
    if (m) {
      const map = { D: 'DEBUG', I: 'INFO', W: 'WARNING', E: 'ERROR', C: 'CRITICAL' };
      return map[m[1]] || '';
    }
    return '';
  }
  function classForLevel(level) {
    switch (level) {
      case 'DEBUG': return 'level-debug';
      case 'INFO': return 'level-info';
      case 'WARNING': return 'level-warning';
      case 'ERROR': return 'level-error';
      case 'CRITICAL': return 'level-critical';
      default: return '';
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function highlight(text, query) {
    if (!query) return escapeHtml(text);
    try {
      if (useRegex) {
        const flags = caseSensitive ? 'g' : 'gi';
        const re = new RegExp(query, flags);
        return escapeHtml(text).replace(re, m => `<mark>${m}</mark>`);
      } else {
        const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = caseSensitive ? 'g' : 'gi';
        return escapeHtml(text).replace(new RegExp(esc, flags), m => `<mark>${m}</mark>`);
      }
    } catch (_) {
      return escapeHtml(text);
    }
  }

  function render() {
    if (!logContent) return;
    const lines = rawText ? rawText.split('\n') : [];
    const q = searchQuery.trim();
    const frag = document.createDocumentFragment();
    let currentEntry = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 解析行的时间/等级/消息
      let time = '', lvl = '', msg = line;
      let m = line.match(/^(\d{2}:\d{2}:\d{2})\s+([DIWEC])\b(.*)$/);
      if (m) {
        time = m[1];
        const map = { D:'DEBUG', I:'INFO', W:'WARNING', E:'ERROR', C:'CRITICAL' };
        lvl = map[m[2]] || m[2];
        msg = (m[3] || '').trim();
      } else {
        // 格式2
        m = line.match(/^\S+\s+\S+\s+\[(DEBUG|INFO|WARNING|ERROR|CRITICAL)\]\s+(.*)$/);
        if (m) {
          const t = line.match(/^(\d{4}-\d{2}-\d{2}[^ ]*)/);
          time = t ? t[1] : '';
          lvl = m[1];
          msg = m[2];
        } else {
          lvl = levelOf(line);
          msg = line;
        }
      }
      if (lvl && !activeLevels.has(lvl)) continue;
      if (q) {
        const target = caseSensitive ? line : line.toLowerCase();
        const qq = caseSensitive ? q : q.toLowerCase();
        if (!useRegex && !target.includes(qq)) {
          // 对于正则，我们在 highlight 阶段处理匹配，无需快速跳过
          if (!useRegex) continue;
        }
      }
      // 以“检测到时间戳”的行作为一个日志的起始行，开启新 entry
      const isHead = !!time;
      if (isHead || !currentEntry) {
        currentEntry = document.createElement('div');
        currentEntry.className = 'entry';
        frag.appendChild(currentEntry);
      }
      const div = document.createElement('div');
      div.className = 'line';
      const timeEl = document.createElement('div');
      timeEl.className = 'tok-time';
      timeEl.innerHTML = time ? highlight(time, q) : '';
      const levelEl = document.createElement('div');
      if (lvl && time) {
        const chip = document.createElement('span');
        const levelCls = (function(){switch (lvl){case 'DEBUG':return 'level-debug';case 'INFO':return 'level-info';case 'WARNING':return 'level-warning';case 'ERROR':return 'level-error';case 'CRITICAL':return 'level-critical';default:return ''}})();
        chip.className = `chip ${levelCls}`;
        chip.textContent = lvl;
        levelEl.appendChild(chip);
      } else {
        levelEl.textContent = '';
      }
      const msgEl = document.createElement('div');
      msgEl.className = 'tok-msg';
      msgEl.innerHTML = highlight(msg, q) || '&nbsp;';
      div.appendChild(timeEl);
      div.appendChild(levelEl);
      div.appendChild(msgEl);
      currentEntry.appendChild(div);
    }
    logContent.innerHTML = '';
    logContent.appendChild(frag);
    // 行号显示
    logContent.classList.toggle('show-line-numbers', showLineNumbers);
    // 统计高亮数量并重置游标
    lastMarks = Array.from(logContent.querySelectorAll('mark'));
    currentMarkIndex = lastMarks.length ? 0 : -1;
    updateMatchCounter();
    if (currentMarkIndex >= 0) {
      scrollToMark(currentMarkIndex, false);
    }
    if (stickBottom && stickBottom.checked) {
      logContent.scrollTop = logContent.scrollHeight;
    }
  }

  function updateMatchCounter() {
    if (!matchCountBadge) return;
    matchCountBadge.textContent = String(lastMarks.length || 0);
  }
  function scrollToMark(idx, smooth = true) {
    if (idx < 0 || idx >= lastMarks.length) return;
    const el = lastMarks[idx];
    el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    // 简单闪烁
    el.style.transition = 'background-color .2s';
    el.style.backgroundColor = 'gold';
    setTimeout(() => { el.style.backgroundColor = ''; }, 300);
  }

  function copyVisibleText() {
    try {
      const clone = logContent.cloneNode(true);
      // 移除行号伪元素，不影响纯文本
      const text = clone.textContent || '';
      navigator.clipboard.writeText(text);
    } catch (e) {
      console.warn('复制失败', e);
    }
  }

  function downloadCurrentFile() {
    try {
      const blob = new Blob([rawText || ''], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = currentFile || 'log.txt';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
      a.remove();
    } catch (e) {
      console.warn('下载失败', e);
    }
  }

  function updateSummary() {
    try {
      if (summaryFileEl) {
        const fileLabel = currentFile || '';
        summaryFileEl.textContent = fileLabel ? `文件: ${fileLabel}` : '';
      }
      if (summaryTailEl) {
        summaryTailEl.textContent = `尾行数: ${currentTail}`;
      }
      if (summaryAutoEl) {
        summaryAutoEl.textContent = `自动刷新: ${autoRefresh && autoRefresh.checked ? '开' : '关'}`;
      }
    } catch (_) {}
  }

  function setControlsCollapsed(collapsed) {
    if (!controlsEl || !toggleControlsBtn) return;
    controlsEl.classList.toggle('collapsed', !!collapsed);
    try {
      const chev = toggleControlsBtn.querySelector('use[data-chev]');
      if (chev) chev.setAttribute('href', collapsed ? '#icon-chevron-down' : '#icon-chevron-up');
    } catch (_) {}
  }

  async function loadFiles(showSpinner = true) {
    try {
      if (showSpinner) showLoading(true);
      const endpoint = api(`/logs/files?t=${Date.now()}`);
      const res = await fetchWithTimeout(endpoint, { credentials: 'include', cache: 'no-store', headers: { 'Cache-Control': 'no-store' } });
      const data = await res.json();
      files = Array.isArray(data.files) ? data.files : [];
      // 渲染选择器
      fileSelect.innerHTML = '';
      files.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.name;
        const time = f.mtime ? new Date(f.mtime * 1000).toLocaleString() : '';
        opt.textContent = `${f.name} (${formatBytes(f.size)}) ${time ? ' - ' + time : ''}`;
        fileSelect.appendChild(opt);
      });
      // 渲染侧栏文件列表（桌面端）
      renderFileList();
      // 选中第一个或保留当前
      if (!currentFile && files.length) {
        currentFile = files[0].name;
      }
      if (currentFile) {
        fileSelect.value = currentFile;
      }
      updateSummary();
    } catch (e) {
      console.warn('读取日志文件列表失败', e);
      if (logContent) {
        logContent.textContent = '⚠️ 无法加载日志文件列表，请检查网络或 API_BASE 配置。';
      }
    } finally {
      if (showSpinner) showLoading(false);
    }
  }

  async function loadContent(showSpinner = true) {
    if (!currentFile) return;
    try {
      if (showSpinner) showLoading(true);
      const url = api(`/logs/content?file=${encodeURIComponent(currentFile)}&tail=${currentTail}&t=${Date.now()}`);
      const res = await fetchWithTimeout(url, { credentials: 'include', cache: 'no-store', headers: { 'Cache-Control': 'no-store' } });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      rawText = String(data.content || '');
      render();
      updateSummary();
    } catch (e) {
      console.warn('读取日志内容失败', e);
      if (logContent) {
        logContent.textContent = '⚠️ 无法加载日志内容，请检查网络或 API_BASE 配置。';
      }
    } finally {
      if (showSpinner) showLoading(false);
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (autoRefresh && autoRefresh.checked) {
      // 自动刷新不显示加载中
      timer = setInterval(() => loadContent(false), 2000);
    }
  }
  function stopAutoRefresh() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function bindEvents() {
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        try { window.history.back(); } catch (_) {}
      });
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadFiles(true).then(() => loadContent(true));
        if (window.__hapticImpact__) window.__hapticImpact__('Light');
      });
    }
    if (autoRefresh) {
      autoRefresh.addEventListener('change', () => {
        startAutoRefresh();
        updateSummary();
      });
    }
    tailSelect.addEventListener('change', () => {
      currentTail = parseInt(tailSelect.value, 10) || 1000;
      loadContent();
      updateSummary();
    });
    fileSelect.addEventListener('change', () => {
      currentFile = fileSelect.value || '';
      loadContent();
      updateSummary();
      markActiveFileInList();
    });
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value || '';
      render();
    });
    clearSearch.addEventListener('click', () => {
      searchQuery = '';
      searchInput.value = '';
      render();
    });
    if (useRegexToggle) {
      useRegexToggle.addEventListener('change', () => {
        useRegex = !!useRegexToggle.checked;
        render();
      });
    }
    if (caseSensitiveToggle) {
      caseSensitiveToggle.addEventListener('change', () => {
        caseSensitive = !!caseSensitiveToggle.checked;
        render();
      });
    }
    if (showLineNumbersToggle) {
      showLineNumbersToggle.addEventListener('change', () => {
        showLineNumbers = !!showLineNumbersToggle.checked;
        render();
      });
    }
    levelToggles.forEach(cb => {
      cb.addEventListener('change', () => {
        const lvl = cb.getAttribute('data-level');
        if (cb.checked) activeLevels.add(lvl);
        else activeLevels.delete(lvl);
        render();
      });
    });
    if (nextMatchBtn) {
      nextMatchBtn.addEventListener('click', () => {
        if (!lastMarks.length) return;
        currentMarkIndex = (currentMarkIndex + 1) % lastMarks.length;
        scrollToMark(currentMarkIndex);
      });
    }
    if (prevMatchBtn) {
      prevMatchBtn.addEventListener('click', () => {
        if (!lastMarks.length) return;
        currentMarkIndex = (currentMarkIndex - 1 + lastMarks.length) % lastMarks.length;
        scrollToMark(currentMarkIndex);
      });
    }
    if (copyBtn) copyBtn.addEventListener('click', copyVisibleText);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadCurrentFile);
    if (jumpBottomBtn) {
      jumpBottomBtn.addEventListener('click', () => {
        logContent.scrollTop = logContent.scrollHeight;
      });
    }
    toggleControlsBtn.addEventListener('click', () => {
      const isCollapsed = controlsEl.classList.contains('collapsed');
      setControlsCollapsed(!isCollapsed);
    });
    if (fileListEl) {
      fileListEl.addEventListener('click', (e) => {
        const li = e.target.closest('li[data-name]');
        if (!li) return;
        const name = li.getAttribute('data-name') || '';
        if (!name) return;
        if (currentFile !== name) {
          currentFile = name;
          if (fileSelect) fileSelect.value = name;
          loadContent();
          updateSummary();
          markActiveFileInList();
        }
      });
    }
    // 视口可见时，自动刷新才生效
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoRefresh();
      else startAutoRefresh();
    });
  }

  // ---------- Auth ----------
  const ALLOWED_USERS = new Set(['Qkr', 'JunxiBao']);
  function isAuthorized() {
    try {
      const uid = localStorage.getItem('userId') || '';
      const uname = localStorage.getItem('username') || '';
      return !!uid && ALLOWED_USERS.has(uname);
    } catch (_) { return false; }
  }
  function showAuth(errMsg) {
    if (authOverlay) authOverlay.hidden = false;
    if (authErrorEl) {
      if (errMsg) { authErrorEl.textContent = errMsg; authErrorEl.hidden = false; }
      else authErrorEl.hidden = true;
    }
  }
  function hideAuth() {
    if (authOverlay) authOverlay.hidden = true;
  }
  async function doAuthLogin() {
    const username = (authUsername && authUsername.value || '').trim();
    const password = (authPassword && authPassword.value) || '';
    if (!username || !password) {
      showAuth('请输入用户名和密码');
      return;
    }
    try {
      const res = await fetch(api('/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      let data = {};
      try { data = await res.json(); } catch(_) {}
      if (res.ok && data && data.success) {
        if (!ALLOWED_USERS.has(username)) {
          showAuth('该账户无权限访问此页面');
          return;
        }
        try {
          localStorage.setItem('userId', data.userId || '');
          localStorage.setItem('username', username);
        } catch(_) {}
        hideAuth();
        // 启动页面逻辑
        loadFiles(true).then(() => loadContent(true)).finally(() => startAutoRefresh());
      } else {
        showAuth('用户名或密码错误');
      }
    } catch (e) {
      showAuth('网络异常，请稍后重试');
    }
  }

  function init() {
    // 获取元素
    backBtn = document.getElementById('backBtn');
    controlsEl = document.querySelector('.controls');
    toggleControlsBtn = document.getElementById('toggleControls');
    summaryFileEl = document.getElementById('summaryFile');
    summaryTailEl = document.getElementById('summaryTail');
    summaryAutoEl = document.getElementById('summaryAuto');
    fileListEl = document.getElementById('fileList');
    authOverlay = document.getElementById('authOverlay');
    authUsername = document.getElementById('authUsername');
    authPassword = document.getElementById('authPassword');
    authLoginBtn = document.getElementById('authLoginBtn');
    authErrorEl = document.getElementById('authError');
    fileSelect = document.getElementById('fileSelect');
    tailSelect = document.getElementById('tailSelect');
    refreshBtn = document.getElementById('refreshBtn');
    autoRefresh = document.getElementById('autoRefresh');
    stickBottom = document.getElementById('stickBottom');
    showLineNumbersToggle = document.getElementById('showLineNumbers');
    searchInput = document.getElementById('searchInput');
    clearSearch = document.getElementById('clearSearch');
    useRegexToggle = document.getElementById('useRegex');
    caseSensitiveToggle = document.getElementById('caseSensitive');
    prevMatchBtn = document.getElementById('prevMatch');
    nextMatchBtn = document.getElementById('nextMatch');
    matchCountBadge = document.getElementById('matchCount');
    copyBtn = document.getElementById('copyVisible');
    downloadBtn = document.getElementById('downloadFile');
    jumpBottomBtn = document.getElementById('jumpBottom');
    viewer = document.getElementById('viewer');
    loadingEl = document.getElementById('loading');
    logContent = document.getElementById('logContent');
    levelToggles = Array.from(document.querySelectorAll('.levels input[type="checkbox"]'));

    // 初始尾行数
    currentTail = parseInt(tailSelect.value, 10) || 1000;
    useRegex = !!(useRegexToggle && useRegexToggle.checked);
    caseSensitive = !!(caseSensitiveToggle && caseSensitiveToggle.checked);
    showLineNumbers = !!(showLineNumbersToggle && showLineNumbersToggle.checked);

    bindEvents();
    // 绑定认证按钮
    if (authLoginBtn) {
      authLoginBtn.addEventListener('click', doAuthLogin);
      (authPassword || {}).addEventListener && authPassword.addEventListener('keydown', (e)=>{ if (e.key==='Enter') doAuthLogin(); });
    }
    // 授权校验
    if (!isAuthorized()) {
      showAuth();
      // 暂不初始化内容加载，待登录成功后执行
      // 默认折叠工具栏
      setControlsCollapsed(true);
      updateSummary();
      return;
    }
    // 已授权，正常初始化
    setControlsCollapsed(true);
    updateSummary();
    loadFiles(true).then(()=>loadContent(true)).finally(()=>{ isInitial=false; startAutoRefresh(); });
  }

  function renderFileList() {
    if (!fileListEl) return;
    fileListEl.innerHTML = '';
    files.forEach((f) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.setAttribute('data-name', f.name);
      const mtime = f.mtime ? new Date(f.mtime * 1000).toLocaleString() : '';
      li.innerHTML = `
        <div class="name" title="${f.name}">${f.name}</div>
        <div class="meta">
          <span>${formatBytes(f.size)}</span>
          ${mtime ? `<span>${mtime}</span>` : ''}
        </div>
      `;
      fileListEl.appendChild(li);
    });
    markActiveFileInList();
  }

  function markActiveFileInList() {
    if (!fileListEl) return;
    const items = fileListEl.querySelectorAll('.file-item');
    items.forEach((it) => {
      const name = it.getAttribute('data-name') || '';
      it.classList.toggle('active', !!currentFile && name === currentFile);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})(); 


