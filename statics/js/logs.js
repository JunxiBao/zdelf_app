(function () {
  'use strict';
  console.debug('[logs] logs.js 已加载');

  // DOM
  let backBtn, fileSelect, tailSelect, refreshBtn, autoRefresh, stickBottom;
  let searchInput, clearSearch, viewer, loadingEl, logContent;
  let levelToggles;
  let showLineNumbersToggle, useRegexToggle, caseSensitiveToggle;
  let prevMatchBtn, nextMatchBtn, matchCountBadge, copyBtn, downloadBtn, jumpBottomBtn;

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
    let visibleCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lvl = levelOf(line);
      if (lvl && !activeLevels.has(lvl)) continue;
      if (q) {
        const target = caseSensitive ? line : line.toLowerCase();
        const qq = caseSensitive ? q : q.toLowerCase();
        if (!useRegex && !target.includes(qq)) {
          // 对于正则，我们在 highlight 阶段处理匹配，无需快速跳过
          if (!useRegex) continue;
        }
      }
      const cls = classForLevel(lvl);
      const div = document.createElement('div');
      div.className = 'line';
      const html = cls ? `<span class="${cls}">${highlight(line, q)}</span>` : highlight(line, q);
      div.innerHTML = html || '&nbsp;';
      frag.appendChild(div);
      visibleCount++;
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
      // 选中第一个或保留当前
      if (!currentFile && files.length) {
        currentFile = files[0].name;
      }
      if (currentFile) {
        fileSelect.value = currentFile;
      }
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
    refreshBtn.addEventListener('click', () => {
      loadFiles(true).then(() => loadContent(true));
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
    useRegexToggle.addEventListener('change', () => {
      useRegex = !!useRegexToggle.checked;
      render();
    });
    caseSensitiveToggle.addEventListener('change', () => {
      caseSensitive = !!caseSensitiveToggle.checked;
      render();
    });
    showLineNumbersToggle.addEventListener('change', () => {
      showLineNumbers = !!showLineNumbersToggle.checked;
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
    nextMatchBtn.addEventListener('click', () => {
      if (!lastMarks.length) return;
      currentMarkIndex = (currentMarkIndex + 1) % lastMarks.length;
      scrollToMark(currentMarkIndex);
    });
    prevMatchBtn.addEventListener('click', () => {
      if (!lastMarks.length) return;
      currentMarkIndex = (currentMarkIndex - 1 + lastMarks.length) % lastMarks.length;
      scrollToMark(currentMarkIndex);
    });
    copyBtn.addEventListener('click', copyVisibleText);
    downloadBtn.addEventListener('click', downloadCurrentFile);
    jumpBottomBtn.addEventListener('click', () => {
      logContent.scrollTop = logContent.scrollHeight;
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
    // 首次加载显示加载中，完成后启动自动刷新（自动刷新不显示加载中）
    loadFiles(true)
      .then(() => loadContent(true))
      .finally(() => {
        isInitial = false;
        startAutoRefresh();
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})(); 


