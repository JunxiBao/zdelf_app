(function () {
  'use strict';
  console.debug('[logs] logs.js 已加载');

  // DOM
  let backBtn, fileSelect, tailSelect, refreshBtn, autoRefresh, stickBottom;
  let searchInput, clearSearch, viewer, loadingEl, logContent;
  let levelToggles;

  // 状态
  let files = [];
  let currentFile = '';
  let currentTail = 1000;
  let rawText = '';
  let searchQuery = '';
  let activeLevels = new Set(['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']);
  let timer = null;

  function getApiBase() {
    try {
      const base = (window.__API_BASE__ || '').trim();
      return base.replace(/\/$/, '');
    } catch (_) { return ''; }
  }
  function api(path) {
    const base = getApiBase();
    return `${base}${path}`;
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
      const esc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return escapeHtml(text).replace(new RegExp(esc, 'gi'), m => `<mark>${m}</mark>`);
    } catch (_) {
      return escapeHtml(text);
    }
  }

  function render() {
    if (!logContent) return;
    const lines = rawText ? rawText.split('\n') : [];
    const q = searchQuery.trim();
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lvl = levelOf(line);
      if (lvl && !activeLevels.has(lvl)) continue;
      if (q && !line.toLowerCase().includes(q.toLowerCase())) continue;
      const cls = classForLevel(lvl);
      out.push(cls ? `<span class="${cls}">${highlight(line, q)}</span>` : highlight(line, q));
    }
    logContent.innerHTML = out.join('\n');
    if (stickBottom && stickBottom.checked) {
      logContent.scrollTop = logContent.scrollHeight;
    }
  }

  async function loadFiles() {
    try {
      showLoading(true);
      const res = await fetch(api('/logs/files'), { credentials: 'include' });
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
      // 选中第一个或保留当前
      if (!currentFile && files.length) {
        currentFile = files[0].name;
      }
      if (currentFile) {
        fileSelect.value = currentFile;
      }
    } catch (e) {
      console.warn('读取日志文件列表失败', e);
    } finally {
      showLoading(false);
    }
  }

  async function loadContent() {
    if (!currentFile) return;
    try {
      showLoading(true);
      const url = api(`/logs/content?file=${encodeURIComponent(currentFile)}&tail=${currentTail}`);
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      rawText = String(data.content || '');
      render();
    } catch (e) {
      console.warn('读取日志内容失败', e);
    } finally {
      showLoading(false);
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (autoRefresh && autoRefresh.checked) {
      timer = setInterval(loadContent, 2000);
    }
  }
  function stopAutoRefresh() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function bindEvents() {
    backBtn.addEventListener('click', () => {
      try { window.history.back(); } catch (_) {}
    });
    refreshBtn.addEventListener('click', () => {
      loadFiles().then(loadContent);
      if (window.__hapticImpact__) window.__hapticImpact__('Light');
    });
    autoRefresh.addEventListener('change', () => {
      startAutoRefresh();
    });
    tailSelect.addEventListener('change', () => {
      currentTail = parseInt(tailSelect.value, 10) || 1000;
      loadContent();
    });
    fileSelect.addEventListener('change', () => {
      currentFile = fileSelect.value || '';
      loadContent();
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
    levelToggles.forEach(cb => {
      cb.addEventListener('change', () => {
        const lvl = cb.getAttribute('data-level');
        if (cb.checked) activeLevels.add(lvl);
        else activeLevels.delete(lvl);
        render();
      });
    });
    // 视口可见时，自动刷新才生效
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoRefresh();
      else startAutoRefresh();
    });
  }

  function init() {
    // 获取元素
    backBtn = document.getElementById('backBtn');
    fileSelect = document.getElementById('fileSelect');
    tailSelect = document.getElementById('tailSelect');
    refreshBtn = document.getElementById('refreshBtn');
    autoRefresh = document.getElementById('autoRefresh');
    stickBottom = document.getElementById('stickBottom');
    searchInput = document.getElementById('searchInput');
    clearSearch = document.getElementById('clearSearch');
    viewer = document.getElementById('viewer');
    loadingEl = document.getElementById('loading');
    logContent = document.getElementById('logContent');
    levelToggles = Array.from(document.querySelectorAll('.levels input[type="checkbox"]'));

    // 初始尾行数
    currentTail = parseInt(tailSelect.value, 10) || 1000;

    bindEvents();
    loadFiles().then(() => loadContent());
    startAutoRefresh();
  }

  document.addEventListener('DOMContentLoaded', init);
})(); 


