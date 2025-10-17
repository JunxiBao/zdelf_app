/**
 * square.js — 广场页面控制器
 *
 * 功能:
 * - 管理用户发布消息（文字和图片）
 * - 显示所有用户消息和头像
 * - 处理图片上传和预览
 * - 管理消息列表的显示和更新
 */

(function () {
  'use strict';
  console.debug('[square] square.js 已加载');
  
  // 清理函数数组
  let cleanupFns = [];
  
  // 全局变量
let messages = [];
  let currentUser = null;
  let isInitialized = false;
  let squareRoot = document; // 将由 initSquare 赋值

// DOM 元素引用
let messageTextarea, publishBtn, addImageBtn, imageFileInput, uploadedImages;
let messagesList, loadingState, emptyState, messageCount, charCount;
let publishTriggerBtn, publishSection, cancelBtn;
let userAvatar, avatarImage, avatarInitials, userName;
let searchInput, clearSearchBtn;
let anonymousBtn;
let isAnonymous = false;
let searchQuery = '';
let allMessages = []; // 存储所有消息用于搜索
let searchTimeout = null; // 搜索防抖定时器
let isDetailView = false; // 是否在详情视图
let currentDetailPostId = null; // 当前详情视图的帖子ID

/**
 * 初始化广场页面
 * @param {ShadowRoot} shadowRoot - Shadow DOM 根节点
 */
function initSquare(shadowRoot) {
  // 缓存并使用 ShadowRoot
  squareRoot = shadowRoot || document;
  console.log('🏛️ 初始化广场页面', { hasShadowRoot: !!shadowRoot });
  
  // 如果已经初始化，先清理
  if (isInitialized) {
    destroySquare();
  }
  
  // 获取DOM元素
  initializeElements();
  
  // 设置事件监听器
  setupEventListeners();
  // 初始化匿名按钮外观
  refreshAnonymousButton();
  // 设置全局菜单关闭
  setupGlobalMenuClose();

  // 接入全局动画系统，优化进入时的过渡，避免布局跳动
  try {
    if (window.AnimationUtils) {
      const hostEl = squareRoot && squareRoot.host ? squareRoot.host : null;
      if (hostEl) {
        window.AnimationUtils.enableGPUAcceleration(hostEl);
      }
      const card = squareRoot.querySelector('.publish-card');
      if (card) {
        card.style.opacity = '0';
        window.AnimationUtils.slideUp(card, 260).then(() => {
          card.style.opacity = '1';
        });
      }
    }
  } catch (_) {}
  
  // 加载用户信息
  loadUserInfo();
  
  // 加载消息列表
  loadMessages();
  
  isInitialized = true;
}

/**
 * 销毁广场页面
 */
function destroySquare() {
  console.log('🏛️ 销毁广场页面');
  
  // 清除防抖定时器
  if (searchTimeout) {
    clearTimeout(searchTimeout);
    searchTimeout = null;
  }
  
  // 清理所有动态创建的评论菜单
  const allCommentMenus = squareRoot.querySelectorAll('.comment-dropdown-menu');
  allCommentMenus.forEach(menu => {
    if (menu.parentNode) {
      menu.parentNode.removeChild(menu);
    }
  });
  
  // 统一执行清理函数
  cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
  cleanupFns = [];
  
  // 重置状态
  messages = [];
  allMessages = [];
  currentUser = null;
  isInitialized = false;
  squareRoot = document;
  searchQuery = '';
  isDetailView = false;
  currentDetailPostId = null;
  
  console.log('🧹 destroySquare 清理完成');
}

/**
 * 初始化DOM元素引用
 */
function initializeElements() {
  messageTextarea = squareRoot.getElementById('messageText');
  publishBtn = squareRoot.getElementById('publishBtn');
  addImageBtn = squareRoot.getElementById('addImageBtn');
  imageFileInput = squareRoot.getElementById('imageFileInput');
  uploadedImages = squareRoot.getElementById('uploadedImages');
  messagesList = squareRoot.getElementById('messagesList');
  loadingState = squareRoot.getElementById('loadingState');
  emptyState = squareRoot.getElementById('emptyState');
  messageCount = squareRoot.getElementById('messageCount');
  charCount = squareRoot.getElementById('charCount');
  userAvatar = squareRoot.getElementById('userAvatar');
  avatarImage = squareRoot.getElementById('avatarImage');
  avatarInitials = squareRoot.getElementById('avatarInitials');
  userName = squareRoot.getElementById('userName');
  searchInput = squareRoot.getElementById('searchInput');
  clearSearchBtn = squareRoot.getElementById('clearSearchBtn');
  publishTriggerBtn = squareRoot.getElementById('publishTriggerBtn');
  publishSection = squareRoot.getElementById('publishSection');
  cancelBtn = squareRoot.getElementById('cancelBtn');
  anonymousBtn = squareRoot.getElementById('anonymousBtn');
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
  // 文字输入监听
  if (messageTextarea) {
    const textHandler = () => handleTextChange();
    messageTextarea.addEventListener('input', textHandler);
    cleanupFns.push(() => messageTextarea.removeEventListener('input', textHandler));
  }
  
  // 发布按钮
  if (publishBtn) {
    const publishHandler = () => handlePublish();
    publishBtn.addEventListener('click', publishHandler);
    cleanupFns.push(() => publishBtn.removeEventListener('click', publishHandler));
  }
  
  // 添加图片按钮
  if (addImageBtn) {
    const addImageHandler = () => handleAddImage();
    addImageBtn.addEventListener('click', addImageHandler);
    cleanupFns.push(() => addImageBtn.removeEventListener('click', addImageHandler));
  }
  
  // 图片文件选择
  if (imageFileInput) {
    const imageHandler = (e) => handleImageSelect(e);
    imageFileInput.addEventListener('change', imageHandler);
    cleanupFns.push(() => imageFileInput.removeEventListener('change', imageHandler));
  }
  
  // 搜索输入框
  if (searchInput) {
    const searchInputHandler = (e) => handleSearchInput(e);
    searchInput.addEventListener('input', searchInputHandler);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });
    cleanupFns.push(() => searchInput.removeEventListener('input', searchInputHandler));
  }
  
  
  // 清除搜索按钮
  if (clearSearchBtn) {
    const clearHandler = () => handleClearSearch();
    clearSearchBtn.addEventListener('click', clearHandler);
    cleanupFns.push(() => clearSearchBtn.removeEventListener('click', clearHandler));
  }

  // 发布触发按钮
  if (publishTriggerBtn) {
    const triggerHandler = () => handlePublishTrigger();
    publishTriggerBtn.addEventListener('click', triggerHandler);
    cleanupFns.push(() => publishTriggerBtn.removeEventListener('click', triggerHandler));
  }

  // 取消按钮
  if (cancelBtn) {
    const cancelHandler = () => handleCancel();
    cancelBtn.addEventListener('click', cancelHandler);
    cleanupFns.push(() => cancelBtn.removeEventListener('click', cancelHandler));
  }

  // 匿名发布按钮
  if (anonymousBtn) {
    const btnHandler = () => handleAnonymousBtnClick();
    anonymousBtn.addEventListener('click', btnHandler);
    cleanupFns.push(() => anonymousBtn.removeEventListener('click', btnHandler));
  }
}

// 根据当前状态刷新匿名按钮的外观与文案
function refreshAnonymousButton() {
  if (!anonymousBtn) return;
  anonymousBtn.setAttribute('aria-pressed', String(isAnonymous));
  anonymousBtn.classList.toggle('is-on', isAnonymous);
  if (isAnonymous) {
    anonymousBtn.innerHTML = '<ion-icon ios="person-outline" md="person-sharp" aria-hidden="true"></ion-icon><span>实名发布</span>';
  } else {
    anonymousBtn.innerHTML = '<ion-icon ios="eye-off-outline" md="eye-off-sharp" aria-hidden="true"></ion-icon><span>匿名发布</span>';
  }
}

/**
 * 加载用户信息
 */
function loadUserInfo() {
  try {
    // 从localStorage获取用户信息
    const userId = localStorage.getItem('userId');
    const userData = localStorage.getItem('userData');
    
    if (userData) {
      const user = JSON.parse(userData);
      currentUser = {
        id: userId,
        name: user.name || '匿名用户',
        avatar: user.avatar || null
      };
      
      // 更新UI
      updateUserInfo();
    } else {
      // 默认用户信息
      currentUser = {
        id: 'anonymous',
        name: '匿名用户',
        avatar: null
      };
      updateUserInfo();
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
    currentUser = {
      id: 'anonymous',
      name: '匿名用户',
      avatar: null
    };
    updateUserInfo();
  }

  // 异步从后端补全真实头像和用户名
  (async () => {
    try {
      const identity = await resolveUserIdentity();
      if (identity && (identity.username || identity.avatar_url)) {
        const API_BASE = getApiBase();
        currentUser = {
          id: identity.user_id || (currentUser && currentUser.id) || 'anonymous',
          name: identity.username || (currentUser && currentUser.name) || '匿名用户',
          avatar: identity.avatar_url
            ? (identity.avatar_url.startsWith('http') ? identity.avatar_url : (API_BASE + identity.avatar_url))
            : (currentUser && currentUser.avatar) || null
        };
        updateUserInfo();
      }
    } catch (_) {}
  })();
}

/**
 * 更新用户信息显示
 */
function updateUserInfo() {
  if (!currentUser) return;
  const isAnon = !!isAnonymous;

  if (userName) {
    userName.textContent = isAnon ? '匿名用户' : (currentUser.name || '匿名用户');
  }
  
  if (userAvatar) {
    if (!isAnon && currentUser.avatar) {
      if (avatarImage) {
        avatarImage.src = currentUser.avatar;
        avatarImage.style.display = 'block';
      }
      if (avatarInitials) {
        avatarInitials.style.display = 'none';
      }
    } else {
      if (avatarInitials) {
        const txt = isAnon ? '匿' : getInitials(currentUser.name);
        avatarInitials.textContent = txt;
        avatarInitials.style.display = 'flex';
      }
      if (avatarImage) {
        avatarImage.style.display = 'none';
      }
    }
  }
}

function handleAnonymousBtnClick() {
  isAnonymous = !isAnonymous;
  refreshAnonymousButton();
  updateUserInfo();
}

// 统一获取 API 基础地址
function getApiBase() {
  try {
    const configuredBase = (
      (squareRoot && squareRoot.ownerDocument && squareRoot.ownerDocument.querySelector('meta[name="api-base"]')?.content) ||
      window.__API_BASE__ ||
      window.API_BASE ||
      ''
    ).trim();
    const defaultBase = 'https://app.zdelf.cn';
    const base = (configuredBase || defaultBase).replace(/\/$/, '');
    return base;
  } catch (_) {
    return 'https://app.zdelf.cn';
  }
}

// 解析用户身份：优先本地，其次 /readdata（users）
async function resolveUserIdentity() {
  let user_id = '';
  let username = '';
  let avatar_url = '';

  // 1) 本地缓存
  try {
    user_id = localStorage.getItem('userId') || sessionStorage.getItem('userId') || '';
  } catch(_) {}

  // 2) 通过 /readdata 查询用户名和头像
  if (user_id) {
    try {
      const API_BASE = getApiBase();
      const resp = await fetch(API_BASE + '/readdata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'users', user_id })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success && Array.isArray(data.data)) {
          const rec = data.data[0] || {};
          username = rec.username || '';
          avatar_url = rec.avatar_url || '';
        }
      }
    } catch (e) {
      console.warn('[square] 解析用户身份失败:', e);
    }
  }

  return { user_id, username, avatar_url };
}

// 上传单张图片（dataURL）到服务器，返回完整URL
async function uploadImageToServer(dataUrl, imageType) {
  const API_BASE = getApiBase();
  const payload = {
    image_data: dataUrl,
    image_type: imageType || 'square'
  };
  // 附加用户信息（若可用）
  try {
    const id = localStorage.getItem('userId') || '';
    if (id) payload.user_id = id;
  } catch(_) {}

  const res = await fetch(API_BASE + '/upload_image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || '图片上传失败');
  const url = json.data && json.data.image_url;
  return url && url.startsWith('http') ? url : (API_BASE + url);
}

/**
 * 获取用户名首字母
 * @param {string} name - 用户名
 * @returns {string} 首字母
 */
function getInitials(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

/**
 * 处理文字输入变化
 */
function handleTextChange() {
  if (!messageTextarea || !charCount || !publishBtn) return;
  
  const text = messageTextarea.value;
  const length = text.length;
  
  // 更新字符计数
  charCount.textContent = length;
  
  // 更新发布按钮状态
  const hasText = text.trim().length > 0;
  const hasImage = uploadedImages && uploadedImages.querySelectorAll('.uploaded-image-item').length > 0;
  
  publishBtn.disabled = !hasText && !hasImage;
}

/**
 * 处理添加图片
 */
function handleAddImage() {
  if (imageFileInput) {
    imageFileInput.click();
  }
}

/**
 * 处理图片选择
 * @param {Event} event - 文件选择事件
 */
async function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }
  
  // 检查文件大小（原始文件不超过10MB）
  const maxOriginalSizeMB = 10;
  if (file.size > maxOriginalSizeMB * 1024 * 1024) {
    alert(`图片文件过大，请选择小于${maxOriginalSizeMB}MB的图片`);
    return;
  }

  try {
    // 将File转成DataURL，再复用diet同款流程（dataURL → File → 压缩）
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
      reader.readAsDataURL(file);
    });

    await handleSquareImageDataUrl(dataUrl);

  } catch (error) {
    hideCompressionProgress();
    console.error('图片处理失败:', error);
    
    // 获取更详细的错误信息
    let errorMessage = '图片处理失败';
    if (error && typeof error === 'object') {
      errorMessage = error.message || error.toString() || '图片处理失败';
    } else if (error && typeof error === 'string') {
      errorMessage = error;
    }
    
    alert('图片处理失败: ' + errorMessage);
    
    // 确保清空文件输入
    if (imageFileInput) {
      imageFileInput.value = '';
    }
  }
}

/**
 * 复用diet流程：处理图片DataURL（dataURL -> File -> 压缩 -> 预览）
 */
async function handleSquareImageDataUrl(dataUrl) {
  showCompressionProgress('图片处理中...');
  try {
    const file = await dataURLToFile(dataUrl, 'square-image.jpg');

    // 原图限制10MB（与diet一致）
    const maxOriginalSizeMB = 10;
    if (file.size > maxOriginalSizeMB * 1024 * 1024) {
      hideCompressionProgress();
      alert(`图片文件过大，请选择小于${maxOriginalSizeMB}MB的图片`);
      return;
    }

    const compressedDataUrl = await compressImagePromise(file, 500);

    hideCompressionProgress();
    addImageToUploadArea(compressedDataUrl, file.name);

    const originalSizeKB = (file.size / 1024).toFixed(1);
    const compressedSizeKB = ((compressedDataUrl.length * 0.75) / 1024).toFixed(1);
    const compressionRatio = ((1 - compressedDataUrl.length * 0.75 / file.size) * 100).toFixed(1);
    showToast(`图片上传成功！原始: ${originalSizeKB}KB → 压缩后: ${compressedSizeKB}KB (压缩率: ${compressionRatio}%)`);
  } catch (error) {
    hideCompressionProgress();
    const msg = error?.message || error?.toString() || '图片处理失败';
    console.error('[square] 图片处理失败:', msg);
    showToast('图片处理失败: ' + msg);
  }
}

/**
 * 复制diet的 dataURLToFile 实现
 */
function dataURLToFile(dataUrl, filename) {
  return new Promise((resolve, reject) => {
    try {
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const file = new File([u8arr], filename, { type: mime });
      resolve(file);
    } catch (error) {
      reject(error);
    }
  });
}

// 显示toast（复制diet实现）
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(98, 0, 234, 0.9);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.9em;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(98, 0, 234, 0.3);
        z-index: 1000;
        animation: toastIn 0.3s ease-out;
    `;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    toast.style.background = 'rgba(187, 134, 252, 0.9)';
  }
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease-out';
    setTimeout(() => { try { document.body.removeChild(toast); } catch (_) {} }, 280);
  }, 3000);
}

/**
 * 添加图片到上传区域
 * @param {string} imageSrc - 图片源
 * @param {string} fileName - 文件名
 */
function addImageToUploadArea(imageSrc, fileName) {
  if (!uploadedImages) return;
  
  const item = document.createElement('div');
  item.className = 'uploaded-image-item';
  
  const img = document.createElement('img');
  img.src = imageSrc;
  img.alt = fileName || '';
  
  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-image-btn';
  removeBtn.innerHTML = '×';
  removeBtn.onclick = function() {
    item.remove();
    // 更新发布按钮状态
    handleTextChange();
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
  };
  
  item.appendChild(img);
  item.appendChild(removeBtn);
  uploadedImages.appendChild(item);
  
  // 添加动画效果
  item.style.opacity = '0';
  item.style.transform = 'scale(0.8)';
  setTimeout(() => {
    item.style.transition = 'all 0.3s ease';
    item.style.opacity = '1';
    item.style.transform = 'scale(1)';
  }, 10);
  
  // 更新发布按钮状态
  handleTextChange();
}

/**
 * 处理发布消息
 */
async function handlePublish() {
  const identity = await resolveUserIdentity();
  if (!identity.user_id && !identity.username) {
    alert('未获取到用户身份，请先登录');
    return;
  }

  const text = messageTextarea ? messageTextarea.value.trim() : '';
  const uploadedImageItems = uploadedImages ? uploadedImages.querySelectorAll('.uploaded-image-item') : [];
  const hasImages = uploadedImageItems.length > 0;
  if (!text && !hasImages) {
    alert('请输入消息内容或添加图片');
    return;
  }

  try {
    // 1) 上传图片到服务器，得到可访问URL
    const uploadedUrls = [];
    for (const item of Array.from(uploadedImageItems)) {
      const img = item.querySelector('img');
      if (img && img.src && img.src.startsWith('data:image')) {
        const url = await uploadImageToServer(img.src, 'square');
        uploadedUrls.push(url);
      }
    }

    // 2) 调用 /square/publish 写入数据库
    const API_BASE = getApiBase();
  const isAnon = !!isAnonymous;
  const payload = {
    user_id: identity.user_id || undefined, // 匿名时也记录user_id，但前端显示时隐藏
    username: isAnon ? '匿名用户' : (identity.username || undefined),
    avatar_url: isAnon ? undefined : (identity.avatar_url || undefined),
    text: text || undefined,
    images: uploadedUrls
  };
    const resp = await fetch(API_BASE + '/square/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const resJson = await resp.json();
    if (!resJson.success) throw new Error(resJson.message || '发布失败');

    // 3) 成功后刷新列表并清空表单
    clearPublishForm();
    if (publishSection) {
      // 取消所有动画
      try {
        const animations = publishSection.getAnimations();
        animations.forEach(anim => anim.cancel());
      } catch (e) {
        // 忽略错误
      }
      publishSection.style.display = 'none';
      publishSection.style.opacity = '1';
    }
    if (publishTriggerBtn) publishTriggerBtn.style.display = 'flex';
    if (window.__hapticImpact__) window.__hapticImpact__('Medium');
    
    // 匿名发布时不再需要本地存储记录，因为后端会记录user_id
    
    await loadMessages();
  } catch (error) {
    console.error('发布消息失败:', error);
    alert('发布失败，请重试');
  }
}

/**
 * 清空发布表单
 */
function clearPublishForm() {
  if (messageTextarea) {
    messageTextarea.value = '';
  }
  if (uploadedImages) {
    uploadedImages.innerHTML = '';
  }
  if (imageFileInput) {
    imageFileInput.value = '';
  }
  if (charCount) {
    charCount.textContent = '0';
  }
  if (publishBtn) {
    publishBtn.disabled = true;
  }
}

/**
 * 处理搜索输入
 */
function handleSearchInput(e) {
  const query = e.target.value.trim();
  searchQuery = query;
  
  // 显示/隐藏清除按钮
  if (clearSearchBtn) {
    clearSearchBtn.classList.toggle('hidden', !query);
  }
  
  // 清除之前的定时器
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // 设置防抖，300ms后执行搜索
  searchTimeout = setTimeout(() => {
    performSearch(query);
  }, 300);
}


/**
 * 执行搜索
 */
function performSearch(query) {
  if (!query || allMessages.length === 0) {
    messages = [...allMessages];
    updateMessagesList();
    return;
  }
  
  // 搜索消息内容和作者名称
  const filteredMessages = allMessages.filter(message => {
    const textMatch = message.text && message.text.toLowerCase().includes(query.toLowerCase());
    const authorMatch = message.author && message.author.toLowerCase().includes(query.toLowerCase());
    return textMatch || authorMatch;
  });
  
  messages = filteredMessages;
  updateMessagesList();
}

/**
 * 清除搜索
 */
function handleClearSearch() {
  // 清除防抖定时器
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  if (searchInput) {
    searchInput.value = '';
    searchQuery = '';
  }
  
  if (clearSearchBtn) {
    clearSearchBtn.classList.add('hidden');
  }
  
  // 显示所有消息
  messages = [...allMessages];
  updateMessagesList();
  
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
}

/**
 * 处理发布触发按钮点击
 */
function handlePublishTrigger() {
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 显示发布区域，完全重置所有样式
  if (publishSection) {
    // 取消所有动画（如果有）
    const animations = publishSection.getAnimations();
    animations.forEach(anim => anim.cancel());
    
    // 清除所有可能的残留样式，并强制设置可见
    publishSection.style.opacity = '1';  // 强制设置为1而不是清空
    publishSection.style.transform = '';
    publishSection.style.transition = '';
    publishSection.style.display = 'block';
    publishSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  // 隐藏触发按钮
  if (publishTriggerBtn) {
    publishTriggerBtn.style.display = 'none';
  }
  
  // 聚焦到文本输入框
  if (messageTextarea) {
    setTimeout(() => {
      messageTextarea.focus();
    }, 300);
  }
}

/**
 * 处理取消按钮点击
 */
function handleCancel() {
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 清空表单
  clearPublishForm();
  
  // 隐藏发布区域
  if (publishSection) {
    // 取消所有动画
    try {
      const animations = publishSection.getAnimations();
      animations.forEach(anim => anim.cancel());
    } catch (e) {
      // 忽略错误
    }
    
    publishSection.style.display = 'none';
    publishSection.style.opacity = '1';  // 设置为1以覆盖任何动画状态
  }
  
  // 显示触发按钮
  if (publishTriggerBtn) {
    publishTriggerBtn.style.display = 'flex';
  }
}

/**
 * 加载消息列表
 */
async function loadMessages() {
  try {
    // 使用全局动画：先保持容器高度，淡出列表区域，避免跳动
    if (messagesList && window.AnimationUtils) {
      const h = messagesList.offsetHeight;
      messagesList.style.minHeight = h ? h + 'px' : '160px';
      await window.AnimationUtils.fadeOut(messagesList, 150);
    }
    showLoading();
    const API_BASE = getApiBase();
    const identity = await resolveUserIdentity();
    const resp = await fetch(API_BASE + '/square/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        limit: 50,
        current_user_id: identity.user_id || null
      })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const list = (data && data.success && Array.isArray(data.data)) ? data.data : [];
    
    // 归一化为现有渲染结构
    const loadedMessages = list.map((it) => {
      const apiBase = getApiBase();
      const avatar = it.avatar_url ? (it.avatar_url.startsWith('http') ? it.avatar_url : (apiBase + it.avatar_url)) : null;
      const imgs = Array.isArray(it.images) ? it.images : (Array.isArray(it.image_urls) ? it.image_urls : []);
      const normImgs = imgs.map(u => (typeof u === 'string' ? (u.startsWith('http') ? u : (apiBase + u)) : '')).filter(Boolean);
      
      // 尝试多种可能的评论计数字段名
      const commentCount = it.comment_count || it.comments_count || it.num_comments || it.comments || 0;
      
      return {
        id: it.id,
        author: it.username || '匿名用户',
        authorId: it.user_id || '',
        avatar: avatar,
        text: it.text || it.text_content || '',
        images: normImgs,
        timestamp: it.created_at || new Date().toISOString(),
        likes: 0,
        comments: 0,
        comments_count: commentCount
      };
    });
    
    // 保存到 allMessages 用于搜索
    allMessages = [...loadedMessages];
    messages = [...loadedMessages];

    updateMessagesList();
    
    // 主动加载所有帖子的实际评论数
    loadAllCommentCounts(loadedMessages);
    
    // 列表渲染后淡入
    if (messagesList && window.AnimationUtils) {
      await window.AnimationUtils.fadeIn(messagesList, 220);
      // 渐变完成后释放 min-height，避免影响后续布局
      setTimeout(() => { try { messagesList.style.minHeight = ''; } catch(_) {} }, 50);
    }
  } catch (error) {
    console.error('加载消息失败:', error);
    showError('加载消息失败');
  }
}

/**
 * 创建示例消息
 * @returns {Array} 示例消息数组
 */
function createSampleMessages() {
  return [
    {
      id: '1',
      author: '健康小助手',
      authorId: 'system',
      avatar: null,
      text: '欢迎来到健康广场！在这里你可以分享你的健康心得，与其他用户交流经验。',
      images: [],
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      likes: 5,
      comments: 2
    },
    {
      id: '2',
      author: '运动达人',
      authorId: 'user2',
      avatar: null,
      text: '今天完成了5公里跑步，感觉身体状态很好！坚持运动真的很重要。🏃‍♂️',
      images: [
        'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop&crop=center'
      ],
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      likes: 8,
      comments: 3
    },
    {
      id: '3',
      author: '营养师小王',
      authorId: 'user3',
      avatar: null,
      text: '分享一个健康饮食小贴士：每天至少喝8杯水，多吃蔬菜水果，少吃油腻食物。🥗',
      images: [
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&crop=center'
      ],
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      likes: 12,
      comments: 5
    },
    {
      id: '4',
      author: '健身爱好者',
      authorId: 'user4',
      avatar: null,
      text: '今天的健身餐，营养搭配很均衡！蛋白质、碳水、维生素都齐全了 💪',
      images: [
        'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop&crop=center'
      ],
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      likes: 15,
      comments: 7
    },
    {
      id: '5',
      author: '瑜伽老师',
      authorId: 'user5',
      avatar: null,
      text: '晨练瑜伽，开启美好的一天！身心都得到了很好的放松 🧘‍♀️',
      images: [
        'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop&crop=center'
      ],
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      likes: 20,
      comments: 4
    },
    {
      id: '6',
      author: '健康管理师',
      authorId: 'user6',
      avatar: null,
      text: '今天测量了血压和心率，数据都很正常。定期监测身体指标很重要！📊',
      images: [
        'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=400&h=300&fit=crop&crop=center'
      ],
      timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      likes: 25,
      comments: 8
    },
    {
      id: '7',
      author: '户外运动爱好者',
      authorId: 'user7',
      avatar: null,
      text: '周末爬山，呼吸新鲜空气，感受大自然的魅力！🌲',
      images: [
        'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop&crop=center',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&crop=center'
      ],
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      likes: 18,
      comments: 6
    }
  ];
}

/**
 * 保存消息到localStorage
 */
function saveMessages() {
  try {
    localStorage.setItem('squareMessages', JSON.stringify(messages));
  } catch (error) {
    console.error('保存消息失败:', error);
  }
}

/**
 * 显示帖子详情
 * @param {string} postId - 帖子ID
 */
async function showPostDetail(postId) {
  console.log('显示帖子详情:', postId);
  
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 设置详情视图状态
  isDetailView = true;
  currentDetailPostId = postId;
  
  // 给容器添加详情模式class，减少顶部空白
  const appContainer = squareRoot.querySelector('.app');
  if (appContainer) {
    appContainer.classList.add('detail-view-mode');
  }
  
  // 获取需要操作的元素
  const allMessageItems = squareRoot.querySelectorAll('.message-item');
  const searchContainer = squareRoot.querySelector('.search-container');
  const publishTrigger = squareRoot.querySelector('.publish-trigger-section');
  const publishSec = squareRoot.querySelector('.publish-section');
  const commentsSection = squareRoot.getElementById(`comments-${postId}`);
  const messagesHeader = squareRoot.querySelector('.messages-header');
  
  // 收集要淡出的元素
  const fadeOutElements = [];
  if (searchContainer) fadeOutElements.push(searchContainer);
  if (publishTrigger) fadeOutElements.push(publishTrigger);
  if (publishSec) fadeOutElements.push(publishSec);
  if (messagesHeader) fadeOutElements.push(messagesHeader);
  
  // 找到当前显示的帖子并添加详情模式样式
  let currentPostElement = null;
  allMessageItems.forEach(item => {
    if (item.dataset.postId !== postId) {
      fadeOutElements.push(item);
    } else {
      currentPostElement = item;
      // 添加详情模式class，让帖子展开显示
      item.classList.add('detail-mode');
    }
  });
  
  // 使用全局动画系统并行淡出所有元素
  if (window.AnimationUtils) {
    // 启用GPU加速
    fadeOutElements.forEach(el => {
      window.AnimationUtils.enableGPUAcceleration(el);
      window.AnimationUtils.setWillChange(el, 'opacity, transform');
    });
    
    // 并行执行淡出动画
    await window.AnimationUtils.parallel(
      fadeOutElements.map(el => () => window.AnimationUtils.fadeOut(el, 250))
    );
    
    // 隐藏元素并完全清理样式
    fadeOutElements.forEach(el => {
      // 取消所有Web Animations API的动画
      try {
        const animations = el.getAnimations();
        animations.forEach(anim => anim.cancel());
      } catch (e) {
        // 忽略错误
      }
      
      el.style.display = 'none';
      el.style.opacity = '';
      el.style.transform = '';
      el.style.transition = '';
      window.AnimationUtils.clearWillChange(el);
    });
  } else {
    // 降级处理：使用传统方式
    fadeOutElements.forEach(el => {
      el.style.transition = 'opacity 0.25s ease';
      el.style.opacity = '0';
    });
    await new Promise(resolve => setTimeout(resolve, 260));
    fadeOutElements.forEach(el => {
      el.style.display = 'none';
      el.style.opacity = '';
      el.style.transition = '';
    });
  }
  
  // 添加返回按钮（带动画）
  addBackButton();
  
  // 准备评论区域
  if (commentsSection) {
    commentsSection.style.display = 'block';
    commentsSection.style.opacity = '0';
    if (window.AnimationUtils) {
      window.AnimationUtils.enableGPUAcceleration(commentsSection);
      window.AnimationUtils.setWillChange(commentsSection, 'opacity, transform');
    }
  }
  
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // 等待一帧
  await new Promise(resolve => requestAnimationFrame(resolve));
  
  // 加载评论
  await loadComments(postId);
  
  // 淡入评论区域
  if (commentsSection && window.AnimationUtils) {
    await window.AnimationUtils.slideUp(commentsSection, 300);
    window.AnimationUtils.clearWillChange(commentsSection);
  } else if (commentsSection) {
    // 降级处理
    commentsSection.style.transition = 'opacity 0.3s ease';
    commentsSection.style.opacity = '1';
    setTimeout(() => {
      commentsSection.style.transition = '';
    }, 350);
  }
}

/**
 * 返回列表视图
 */
async function backToList() {
  console.log('返回列表视图');
  
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 重置详情视图状态
  const previousPostId = currentDetailPostId;
  isDetailView = false;
  currentDetailPostId = null;
  
  // 移除容器的详情模式class
  const appContainer = squareRoot.querySelector('.app');
  if (appContainer) {
    appContainer.classList.remove('detail-view-mode');
  }
  
  // 获取需要操作的元素
  const commentsSection = previousPostId ? squareRoot.getElementById(`comments-${previousPostId}`) : null;
  const allMessageItems = squareRoot.querySelectorAll('.message-item');
  const searchContainer = squareRoot.querySelector('.search-container');
  const publishTrigger = squareRoot.querySelector('.publish-trigger-section');
  const publishSec = squareRoot.querySelector('.publish-section');
  const messagesHeader = squareRoot.querySelector('.messages-header');
  const backButtonContainer = squareRoot.querySelector('.back-button-container');
  
  // 使用全局动画系统淡出评论和返回按钮
  const fadeOutItems = [];
  if (commentsSection) fadeOutItems.push(commentsSection);
  if (backButtonContainer) fadeOutItems.push(backButtonContainer);
  
  if (window.AnimationUtils && fadeOutItems.length > 0) {
    // 启用GPU加速
    fadeOutItems.forEach(el => {
      window.AnimationUtils.enableGPUAcceleration(el);
      window.AnimationUtils.setWillChange(el, 'opacity, transform');
    });
    
    // 并行淡出
    await window.AnimationUtils.parallel(
      fadeOutItems.map(el => () => window.AnimationUtils.fadeOut(el, 200))
    );
    
    // 清理
    if (commentsSection) {
      commentsSection.style.display = 'none';
      window.AnimationUtils.clearWillChange(commentsSection);
    }
    if (backButtonContainer) {
      removeBackButton();
    }
  } else {
    // 降级处理
    if (commentsSection) {
      commentsSection.style.transition = 'opacity 0.2s ease';
      commentsSection.style.opacity = '0';
      await new Promise(resolve => setTimeout(resolve, 210));
      commentsSection.style.display = 'none';
      commentsSection.style.opacity = '';
      commentsSection.style.transition = '';
    }
    if (backButtonContainer) {
      backButtonContainer.style.transition = 'opacity 0.2s ease';
      backButtonContainer.style.opacity = '0';
      setTimeout(() => removeBackButton(), 210);
    }
  }
  
  // 直接显示所有元素，不使用淡入动画
  allMessageItems.forEach(item => {
    // 移除详情模式class，恢复卡片样式
    item.classList.remove('detail-mode');
    
    if (item.style.display === 'none') {
      item.style.display = 'block';
    }
    // 清除所有可能的内联样式
    item.style.opacity = '';
    item.style.transform = '';
    item.style.transition = '';
  });
  
  if (searchContainer && searchContainer.style.display === 'none') {
    searchContainer.style.display = 'block';
  }
  if (searchContainer) {
    searchContainer.style.opacity = '';
    searchContainer.style.transform = '';
    searchContainer.style.transition = '';
  }
  
  if (publishTrigger && publishTrigger.style.display === 'none') {
    publishTrigger.style.display = 'flex';
  }
  if (publishTrigger) {
    publishTrigger.style.opacity = '';
    publishTrigger.style.transform = '';
    publishTrigger.style.transition = '';
  }
  
  if (messagesHeader && messagesHeader.style.display === 'none') {
    messagesHeader.style.display = 'flex';
  }
  if (messagesHeader) {
    messagesHeader.style.opacity = '';
    messagesHeader.style.transform = '';
    messagesHeader.style.transition = '';
  }
  
  // 重置发布区域状态（确保隐藏并清除所有样式）
  if (publishSec) {
    // 取消所有动画
    try {
      const animations = publishSec.getAnimations();
      animations.forEach(anim => anim.cancel());
    } catch (e) {
      // 忽略错误
    }
    
    publishSec.style.display = 'none';
    publishSec.style.opacity = '1';
    publishSec.style.transform = '';
    publishSec.style.transition = '';
  }
  
  // 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * 添加返回按钮
 */
async function addBackButton() {
  // 如果已经存在返回按钮，不重复添加
  if (squareRoot.querySelector('.back-button-container')) {
    return;
  }
  
  const backButtonContainer = document.createElement('div');
  backButtonContainer.className = 'back-button-container';
  backButtonContainer.innerHTML = `
    <button class="back-to-list-btn" onclick="backToList()">
      <ion-icon ios="close-outline" md="close-sharp" aria-hidden="true"></ion-icon>
    </button>
  `;
  
  // 插入到 messages-section 前面
  const messagesSection = squareRoot.querySelector('.messages-section');
  if (messagesSection && messagesSection.parentNode) {
    messagesSection.parentNode.insertBefore(backButtonContainer, messagesSection);
    
    // 使用全局动画系统
    if (window.AnimationUtils) {
      // 初始状态
      backButtonContainer.style.opacity = '0';
      backButtonContainer.style.transform = 'scale(0.8)';
      
      // 启用GPU加速
      window.AnimationUtils.enableGPUAcceleration(backButtonContainer);
      window.AnimationUtils.setWillChange(backButtonContainer, 'opacity, transform');
      
      // 等待一帧
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // 使用Web Animations API
      const animation = backButtonContainer.animate([
        { opacity: 0, transform: 'scale(0.8)' },
        { opacity: 1, transform: 'scale(1)' }
      ], {
        duration: window.AnimationUtils.getAdjustedDuration(250),
        easing: window.AnimationUtils.config.easing.smooth,
        fill: 'forwards'
      });
      
      animation.addEventListener('finish', () => {
        backButtonContainer.style.opacity = '';
        backButtonContainer.style.transform = '';
        window.AnimationUtils.clearWillChange(backButtonContainer);
      });
    } else {
      // 降级处理
      backButtonContainer.style.opacity = '0';
      backButtonContainer.style.transform = 'scale(0.8)';
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          backButtonContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          backButtonContainer.style.opacity = '1';
          backButtonContainer.style.transform = 'scale(1)';
          
          setTimeout(() => {
            backButtonContainer.style.transition = '';
            backButtonContainer.style.transform = '';
          }, 320);
        });
      });
    }
  }
}

/**
 * 移除返回按钮
 */
function removeBackButton() {
  const backButtonContainer = squareRoot.querySelector('.back-button-container');
  if (backButtonContainer && backButtonContainer.parentNode) {
    backButtonContainer.parentNode.removeChild(backButtonContainer);
  }
}

/**
 * 更新消息列表显示
 */
function updateMessagesList() {
  if (!messagesList) return;
  
  hideLoading();
  
  if (messages.length === 0) {
    showEmpty();
    return;
  }
  
  hideEmpty();
  
  // 清空现有内容
  messagesList.innerHTML = '';
  
  // 渲染消息
  messages.forEach((message, index) => {
    const messageElement = createMessageElement(message, index);
    messagesList.appendChild(messageElement);
  });
  
  // 更新消息计数
  updateMessageCount();
}

/**
 * 创建消息元素
 * @param {Object} message - 消息对象
 * @param {number} index - 消息索引
 * @returns {HTMLElement} 消息元素
 */
function createMessageElement(message, index) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message-item';
  messageDiv.style.animationDelay = `${index * 0.1}s`;
  messageDiv.dataset.postId = message.id; // 存储帖子ID
  
  const timeAgo = getTimeAgo(message.timestamp);
  
  // 判断是否是当前用户的消息
  // 1. 实名消息：通过 user_id 匹配
  // 2. 匿名消息：也通过 user_id 匹配（后端会记录user_id，但前端显示时保持匿名）
  const isCurrentUser = currentUser && message.authorId && currentUser.id === message.authorId;
  
  // 调试信息
  console.log('创建消息元素:', message.author, '图片数量:', message.images ? message.images.length : 0, '是否当前用户:', isCurrentUser);
  if (message.images && message.images.length > 0) {
    console.log('图片URLs:', message.images);
  }
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <div class="message-avatar">
        ${message.avatar ? 
          `<img src="${message.avatar}" alt="${message.author}" class="avatar-image">` :
          `<div class="avatar-initials">${getInitials(message.author)}</div>`
        }
      </div>
      <div class="message-info">
        <div class="message-author">${escapeHtml(message.author)}</div>
        <div class="message-time">${timeAgo}</div>
      </div>
      <button class="menu-btn" onclick="toggleMessageMenu('${message.id}', event)">
        <ion-icon ios="ellipsis-horizontal-outline" md="ellipsis-horizontal-sharp" aria-hidden="true"></ion-icon>
      </button>
      <div class="dropdown-menu" id="message-menu-${message.id}" style="display: none;">
        ${isCurrentUser ? `
          <button class="dropdown-menu-item" onclick="deletePost('${message.id}')">
            <ion-icon ios="trash-outline" md="trash-sharp" aria-hidden="true"></ion-icon>
            <span>删除</span>
          </button>
        ` : `
          <button class="dropdown-menu-item" onclick="reportContent('post', '${message.id}', '${message.authorId || ''}')">
            <ion-icon ios="flag-outline" md="flag-sharp" aria-hidden="true"></ion-icon>
            <span>举报</span>
          </button>
          ${message.authorId && message.author !== '匿名用户' ? `
            <button class="dropdown-menu-item dropdown-menu-item-danger" onclick="blockUser('${message.authorId}', '${escapeHtml(message.author)}')">
              <ion-icon ios="ban-outline" md="ban-sharp" aria-hidden="true"></ion-icon>
              <span>屏蔽用户</span>
            </button>
          ` : ''}
        `}
      </div>
    </div>
    <div class="message-content">
      ${message.text ? `<div class="message-text">${escapeHtml(message.text)}</div>` : ''}
      ${message.images && message.images.length > 0 ? 
        `<div class="message-images">
          ${message.images.map((img, imgIndex) => 
            `<img src="${img}" alt="消息图片" class="message-image" onclick="openImageModal('${img}'); event.stopPropagation();" onerror="console.error('图片加载失败:', this.src); this.style.display='none'" onload="console.log('图片加载成功:', this.src)" loading="lazy">`
          ).join('')}
        </div>` : ''}
    </div>
    <div class="message-footer">
      <div class="comment-count" id="comment-count-${message.id}">
        <ion-icon ios="chatbubble-outline" md="chatbubble-sharp" aria-hidden="true"></ion-icon>
        <span class="count-text">${message.comments_count || message.comments || 0}</span>
      </div>
    </div>
    <div class="comments-section" id="comments-${message.id}" style="display: none;">
      <div class="comments-list" id="comments-list-${message.id}">
        <!-- 评论将通过JavaScript动态添加 -->
      </div>
      <div class="comment-input-section" id="comment-input-section-${message.id}" style="display: none;">
        <div class="comment-input-header">
          <span class="comment-input-title">添加评论</span>
          <button class="comment-close-btn" onclick="hideCommentInput('${message.id}')">
            <ion-icon ios="close-outline" md="close-sharp" aria-hidden="true"></ion-icon>
          </button>
        </div>
        <div class="comment-input-container">
          <textarea 
            class="comment-input" 
            id="comment-input-${message.id}"
            placeholder="写下你的评论..."
            maxlength="500"
          ></textarea>
          <button class="comment-submit-btn" onclick="submitComment('${message.id}')">
            <ion-icon ios="send-outline" md="send-sharp" aria-hidden="true"></ion-icon>
          </button>
        </div>
      </div>
      <div class="add-comment-section">
        <button class="add-comment-btn" onclick="showCommentInput('${message.id}')">
          <ion-icon ios="add-circle-outline" md="add-circle-sharp" aria-hidden="true"></ion-icon>
          <span>增加评论</span>
        </button>
      </div>
    </div>
  `;
  
  // 添加点击事件来显示帖子详情
  const messageContent = messageDiv.querySelector('.message-content');
  const messageHeader = messageDiv.querySelector('.message-header');
  
  const clickHandler = (e) => {
    // 如果点击的是菜单按钮、图片或评论计数，不触发详情视图
    if (e.target.closest('.menu-btn') || 
        e.target.closest('.dropdown-menu') || 
        e.target.closest('.message-image') ||
        e.target.closest('.comment-count')) {
      return;
    }
    showPostDetail(message.id);
  };
  
  if (messageContent) {
    messageContent.addEventListener('click', clickHandler);
  }
  if (messageHeader) {
    messageHeader.addEventListener('click', clickHandler);
  }
  
  return messageDiv;
}

/**
 * 转义HTML字符
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 获取相对时间
 * @param {string} timestamp - 时间戳
 * @returns {string} 相对时间字符串
 */
function getTimeAgo(timestamp) {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffMs = now - messageTime;
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) {
    return '刚刚';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return messageTime.toLocaleDateString('zh-CN');
  }
}

/**
 * 判断是否在删除时间窗口内（5分钟）
 * @param {string} timestamp - 时间戳
 * @returns {boolean} 是否在删除窗口内
 */
function isWithinDeleteWindow(timestamp) {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffMs = now - messageTime;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  // 5分钟内的匿名消息/评论允许删除
  return diffMinutes <= 5;
}

// 本地存储相关函数已移除，现在统一使用user_id匹配

/**
 * 更新消息计数
 */
function updateMessageCount() {
  if (messageCount) {
    if (searchQuery) {
      messageCount.textContent = `${messages.length} 条搜索结果`;
    } else {
      messageCount.textContent = `${messages.length} 条消息`;
    }
  }
}

/**
 * 显示加载状态
 */
function showLoading() {
  if (loadingState) {
    loadingState.style.display = 'flex';
  }
  if (messagesList) {
    messagesList.style.display = 'none';
  }
  if (emptyState) {
    emptyState.style.display = 'none';
  }
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
  if (loadingState) {
    loadingState.style.display = 'none';
  }
  if (messagesList) {
    messagesList.style.display = 'flex';
  }
}

/**
 * 显示空状态
 */
function showEmpty() {
  if (emptyState) {
    emptyState.style.display = 'block';
  }
  if (messagesList) {
    messagesList.style.display = 'none';
  }
}

/**
 * 隐藏空状态
 */
function hideEmpty() {
  if (emptyState) {
    emptyState.style.display = 'none';
  }
}

/**
 * 显示错误信息
 * @param {string} message - 错误消息
 */
function showError(message) {
  hideLoading();
  if (messagesList) {
    messagesList.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>加载失败</h3>
        <p>${message}</p>
        <button onclick="loadMessages()" class="retry-btn">重试</button>
      </div>
    `;
  }
}

/**
 * 打开图片模态框
 * @param {string} imageSrc - 图片源
 */
function openImageModal(imageSrc) {
  // 创建图片查看模态框
  const modal = document.createElement('div');
  modal.className = 'image-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    cursor: pointer;
  `;
  
  const img = document.createElement('img');
  img.src = imageSrc;
  img.style.cssText = `
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
  `;
  
  modal.appendChild(img);
  document.body.appendChild(modal);
  
  // 点击关闭
  modal.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}


/**
 * 显示压缩进度
 * @param {string} fileName - 文件名
 */
function showCompressionProgress(fileName) {
  const html = `
    <div class="square-compression-progress" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: #fff; padding: 20px 30px; border-radius: 12px; z-index: 10000; text-align: center; backdrop-filter: blur(8px);">
      <div style="margin-bottom: 12px;"><div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div></div>
      <div style="font-size: 0.9rem; color: #ccc;">正在压缩图片...</div>
      <div style="font-size: 0.8rem; color: #999; margin-top: 4px;">${fileName}</div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * 隐藏压缩进度
 */
function hideCompressionProgress() {
  const el = document.querySelector('.square-compression-progress');
  if (el) el.remove();
}

/**
 * 压缩图片的Promise版本
 * @param {File} file - 图片文件
 * @param {number} maxSizeKB - 最大大小(KB)
 * @returns {Promise<string>} 压缩后的DataURL
 */
function compressImagePromise(file, maxSizeKB = 500) {
  return new Promise((resolve, reject) => {
    compressImage(file, resolve, reject, maxSizeKB);
  });
}

/**
 * 压缩图片 - 完全复制diet.js的实现
 * @param {File} file - 图片文件
 * @param {Function} callback - 成功回调
 * @param {Function} errorCallback - 错误回调
 * @param {number} maxSizeKB - 最大大小(KB)
 */
function compressImage(file, callback, errorCallback, maxSizeKB = 500) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = function() {
    try {
      let { width, height } = calculateCompressedSize(img.width, img.height, maxSizeKB);
      canvas.width = width; canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      compressWithQuality(canvas, file.type, maxSizeKB, callback);
    } catch (err) { errorCallback && errorCallback(err.message || '图片处理失败'); }
  };
  img.onerror = function() { errorCallback && errorCallback('图片加载失败'); };
  img.src = URL.createObjectURL(file);
}

/**
 * 计算压缩后的尺寸 - 完全复制diet.js的实现
 * @param {number} originalWidth - 原始宽度
 * @param {number} originalHeight - 原始高度
 * @param {number} maxSizeKB - 最大大小(KB)
 * @returns {Object} 压缩后的宽高
 */
function calculateCompressedSize(originalWidth, originalHeight, maxSizeKB) {
  const maxWidth = maxSizeKB <= 500 ? 1200 : 1920;
  const maxHeight = maxSizeKB <= 500 ? 900 : 1080;
  let width = originalWidth, height = originalHeight;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  }
  const estimatedBytesPerPixel = maxSizeKB <= 500 ? 0.3 : 0.2;
  const maxPixels = (maxSizeKB * 1024) / estimatedBytesPerPixel;
  const currentPixels = width * height;
  if (currentPixels <= maxPixels) return { width, height };
  const ratio = Math.sqrt(maxPixels / currentPixels);
  return { width: Math.floor(width * ratio), height: Math.floor(height * ratio) };
}

/**
 * 使用质量压缩 - 完全复制diet.js的实现
 * @param {HTMLCanvasElement} canvas - 画布元素
 * @param {string} mimeType - MIME类型
 * @param {number} maxSizeKB - 最大大小(KB)
 * @param {Function} callback - 回调函数
 * @param {number} quality - 质量参数
 */
function compressWithQuality(canvas, mimeType, maxSizeKB, callback, quality = null) {
  if (quality === null) quality = maxSizeKB <= 500 ? 0.6 : 0.8;
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const sizeKB = (dataUrl.length * 0.75) / 1024;
  if (sizeKB <= maxSizeKB || quality <= 0.1) {
    callback(dataUrl);
  } else {
    const step = maxSizeKB <= 500 ? 0.1 : 0.05;
    compressWithQuality(canvas, mimeType, maxSizeKB, callback, quality - step);
  }
}

/**
 * 切换评论区域显示/隐藏
 * @param {string} postId - 消息ID
 */
function toggleComments(postId) {
  // 添加震动反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  const commentsSection = squareRoot.getElementById(`comments-${postId}`);
  const commentBtn = squareRoot.querySelector(`button[onclick="toggleComments('${postId}')"]`);
  if (!commentsSection || !commentBtn) return;
  
  const isVisible = commentsSection.style.display !== 'none';
  
  if (isVisible) {
    // 隐藏评论区域
    commentsSection.style.display = 'none';
    commentBtn.innerHTML = '<ion-icon ios="chatbubble-outline" md="chatbubble-sharp" aria-hidden="true"></ion-icon><span>评论</span>';
  } else {
    // 显示评论区域
    commentsSection.style.display = 'block';
    commentBtn.innerHTML = '<ion-icon ios="chevron-up-outline" md="chevron-up-sharp" aria-hidden="true"></ion-icon><span>收起</span>';
  }
}

/**
 * 批量加载所有帖子的评论数
 * @param {Array} messages - 帖子数组
 */
async function loadAllCommentCounts(messages) {
  if (!messages || messages.length === 0) return;
  
  // 异步加载每个帖子的评论数，不阻塞UI，并分散请求时间
  messages.forEach((message, index) => {
    // 每个请求间隔50ms，避免同时发送太多请求
    setTimeout(async () => {
      try {
        const API_BASE = getApiBase();
        const identity = await resolveUserIdentity();
        const resp = await fetch(API_BASE + '/square/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            post_id: message.id,
            current_user_id: identity.user_id || null
          })
        });
        
        if (!resp.ok) return; // 静默失败，不影响用户体验
        const data = await resp.json();
        
        if (data.success && Array.isArray(data.data)) {
          // 更新评论计数显示
          updateCommentCount(message.id, data.data.length);
        }
      } catch (error) {
        // 静默失败，不显示错误
        console.debug(`加载帖子 ${message.id} 的评论数失败:`, error);
      }
    }, index * 50); // 每个请求延迟50ms
  });
}

/**
 * 加载指定消息的评论
 * @param {string} postId - 消息ID
 */
async function loadComments(postId) {
  try {
    console.log('开始加载评论:', postId);
    const API_BASE = getApiBase();
    const identity = await resolveUserIdentity();
    const resp = await fetch(API_BASE + '/square/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        post_id: postId,
        current_user_id: identity.user_id || null
      })
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '加载评论失败');
    
    const comments = data.data || [];
    console.log('加载到评论数量:', comments.length);
    console.log('评论数据:', comments);
    renderComments(postId, comments);
    console.log('评论渲染完成');
  } catch (error) {
    console.error('加载评论失败:', error);
    console.error('错误详情:', error.message, error.stack);
    showToast('加载评论失败');
  }
}

/**
 * 更新评论计数
 * @param {string} postId - 消息ID
 * @param {number} count - 评论数量
 */
function updateCommentCount(postId, count) {
  const commentCountElement = squareRoot.getElementById(`comment-count-${postId}`);
  if (commentCountElement) {
    const countText = commentCountElement.querySelector('.count-text');
    if (countText) {
      countText.textContent = count;
    }
  }
}

/**
 * 渲染评论列表
 * @param {string} postId - 消息ID
 * @param {Array} comments - 评论数组
 */
function renderComments(postId, comments) {
  const commentsList = squareRoot.getElementById(`comments-list-${postId}`);
  if (!commentsList) return;
  
  if (comments.length === 0) {
    // 没有评论时不显示任何内容，但保持容器存在
    commentsList.innerHTML = '';
    updateCommentCount(postId, 0);
    return;
  }
  
  // 创建评论映射，方便查找父评论
  const commentMap = {};
  comments.forEach(comment => {
    commentMap[comment.id] = comment;
  });
  
  // 为每个评论添加父评论信息
  const commentsWithParent = comments.map(comment => {
    if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
      comment.parentComment = commentMap[comment.parent_comment_id];
    }
    return comment;
  });
  
  // 分离主评论和回复评论
  const mainComments = commentsWithParent.filter(comment => !comment.parent_comment_id);
  const replyComments = commentsWithParent.filter(comment => comment.parent_comment_id);
  
  // 创建回复评论映射
  const repliesByParent = {};
  replyComments.forEach(reply => {
    if (!repliesByParent[reply.parent_comment_id]) {
      repliesByParent[reply.parent_comment_id] = [];
    }
    repliesByParent[reply.parent_comment_id].push(reply);
  });
  
  // 渲染主评论，每个主评论后面跟着它的回复
  let html = '';
  try {
    mainComments.forEach(comment => {
      html += createCommentElement(comment);
      // 先添加该评论的所有回复（默认折叠）
      if (repliesByParent[comment.id]) {
        const replyCount = repliesByParent[comment.id].length;
        html += createRepliesSection(comment.id, repliesByParent[comment.id], replyCount);
      }
      // 然后添加回复输入框（只在主评论后显示）
      html += createReplyInputSection(comment.id, comment.username);
    });
    
    commentsList.innerHTML = html;
    updateCommentCount(postId, comments.length);
    
    // 为每个评论创建菜单（放在主容器中）
    commentsWithParent.forEach(comment => {
      createCommentMenu(comment);
    });
    
    // 为每个回复也创建菜单
    replyComments.forEach(reply => {
      createCommentMenu(reply);
    });
  } catch (error) {
    console.error('渲染评论时出错:', error);
    // 如果渲染失败，尝试简单的渲染方式
    commentsList.innerHTML = commentsWithParent.map(comment => createCommentElement(comment)).join('');
    updateCommentCount(postId, comments.length);
    commentsWithParent.forEach(comment => {
      createCommentMenu(comment);
    });
  }
}

/**
 * 创建回复区域容器（包含折叠/展开功能）
 * @param {string} commentId - 评论ID
 * @param {Array} replies - 回复数组
 * @param {number} replyCount - 回复数量
 * @returns {string} 回复区域HTML
 */
function createRepliesSection(commentId, replies, replyCount) {
  const repliesHtml = replies.map(reply => createReplyElement(reply)).join('');
  
  return `
    <div class="replies-section" data-comment-id="${commentId}">
      <div class="replies-toggle" onclick="toggleReplies('${commentId}')">
        <div class="replies-toggle-content">
          <ion-icon name="chevron-down-outline" class="replies-chevron"></ion-icon>
          <span class="replies-count">${replyCount} 条回复</span>
        </div>
      </div>
      <div class="replies-list" id="replies-list-${commentId}" style="display: none;">
        ${repliesHtml}
      </div>
    </div>
  `;
}


/**
 * 创建回复输入框
 * @param {string} commentId - 评论ID
 * @param {string} username - 被回复的用户名
 * @returns {string} 回复输入框HTML
 */
function createReplyInputSection(commentId, username) {
  return `
    <div class="reply-input-section" id="reply-input-section-${commentId}" style="display: none;">
      <div class="reply-input-wrapper">
        <div class="reply-input-header">
          <span class="reply-input-label">回复 ${escapeHtml(username)}</span>
          <button class="reply-close-btn" onclick="hideReplyInput('${commentId}')">
            <ion-icon ios="close-outline" md="close-sharp" aria-hidden="true"></ion-icon>
          </button>
        </div>
        <div class="reply-input-container">
          <textarea 
            class="reply-input" 
            id="reply-input-${commentId}"
            placeholder="写下你的回复..."
            maxlength="500"
            rows="3"
          ></textarea>
          <div class="reply-actions">
            <div class="reply-char-count">
              <span id="reply-char-count-${commentId}">0</span>/500
            </div>
            <button class="reply-submit-btn" onclick="submitReply('${commentId}')">
              <ion-icon ios="send-outline" md="send-sharp" aria-hidden="true"></ion-icon>
              <span>发送</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 处理评论点击事件
 * @param {string} commentId - 评论ID
 * @param {Event} event - 点击事件
 */
function handleCommentClick(commentId, event) {
  // 如果点击的是菜单按钮，不处理评论点击
  if (event.target.closest('.comment-menu-btn')) {
    return;
  }
  
  // 添加震动反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 显示回复输入框
  toggleReplyInput(commentId);
}

/**
 * 切换回复列表显示状态
 * @param {string} commentId - 评论ID
 */
function toggleReplies(commentId) {
  // 添加震动反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  const repliesList = squareRoot.getElementById(`replies-list-${commentId}`);
  const chevron = squareRoot.querySelector(`[data-comment-id="${commentId}"] .replies-chevron`);
  
  if (!repliesList || !chevron) {
    console.error('未找到回复列表或箭头图标');
    return;
  }
  
  const isVisible = repliesList.style.display !== 'none';
  
  if (isVisible) {
    // 隐藏回复列表
    repliesList.style.display = 'none';
    chevron.name = 'chevron-down-outline';
  } else {
    // 显示回复列表
    repliesList.style.display = 'block';
    chevron.name = 'chevron-up-outline';
  }
}

/**
 * 切换回复输入框显示状态
 * @param {string} commentId - 评论ID
 */
function toggleReplyInput(commentId) {
  console.log('点击回复按钮:', commentId);
  
  // 添加震动反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 确保 squareRoot 可用
  const root = squareRoot || document;
  const replySection = root.getElementById(`reply-input-section-${commentId}`);
  
  console.log('查找回复输入框:', replySection);
  
  if (replySection) {
    const isVisible = replySection.style.display !== 'none';
    console.log('当前显示状态:', isVisible);
    
    replySection.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      // 显示时聚焦到输入框
      const textarea = replySection.querySelector('.reply-input');
      if (textarea) {
        console.log('聚焦到输入框');
        setTimeout(() => textarea.focus(), 100);
      } else {
        console.log('未找到输入框');
      }
    }
  } else {
    console.error('未找到回复输入框:', `reply-input-section-${commentId}`);
    // 尝试在全局文档中查找
    const globalReplySection = document.getElementById(`reply-input-section-${commentId}`);
    if (globalReplySection) {
      console.log('在全局文档中找到回复输入框');
      const isVisible = globalReplySection.style.display !== 'none';
      globalReplySection.style.display = isVisible ? 'none' : 'block';
      
      if (!isVisible) {
        const textarea = globalReplySection.querySelector('.reply-input');
        if (textarea) {
          setTimeout(() => textarea.focus(), 100);
        }
      }
    }
  }
}

/**
 * 隐藏回复输入框
 * @param {string} commentId - 评论ID
 */
function hideReplyInput(commentId) {
  console.log('隐藏回复输入框:', commentId);
  
  // 添加震动反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 确保 squareRoot 可用
  const root = squareRoot || document;
  const replySection = root.getElementById(`reply-input-section-${commentId}`);
  
  if (replySection) {
    replySection.style.display = 'none';
    console.log('回复输入框已隐藏');
  } else {
    console.error('未找到回复输入框:', `reply-input-section-${commentId}`);
    // 尝试在全局文档中查找
    const globalReplySection = document.getElementById(`reply-input-section-${commentId}`);
    if (globalReplySection) {
      globalReplySection.style.display = 'none';
      console.log('在全局文档中隐藏回复输入框');
    }
  }
}

/**
 * 创建回复元素（简化版，显示在父评论下方）
 * @param {Object} reply - 回复对象
 * @returns {string} 回复HTML
 */
function createReplyElement(reply) {
  try {
    const timeAgo = getTimeAgo(reply.created_at);
    
    return `
      <div class="reply-item" data-comment-id="${reply.id}" data-parent-comment-id="${reply.parent_comment_id}">
        <div class="reply-content">
          <div class="reply-header">
            <span class="reply-username">${escapeHtml(reply.username || '匿名用户')}</span>
            <span class="reply-time">${timeAgo}</span>
          </div>
          <div class="reply-text">${escapeHtml(reply.text || '')}</div>
        </div>
        <button class="comment-menu-btn reply-menu-btn" onclick="toggleCommentMenu('${reply.id}', event)" data-comment-id="${reply.id}">
          <ion-icon ios="ellipsis-horizontal-outline" md="ellipsis-horizontal-sharp" aria-hidden="true"></ion-icon>
        </button>
      </div>
    `;
  } catch (error) {
    console.error('创建回复元素时出错:', error, reply);
    return `<div class="reply-item">回复加载失败</div>`;
  }
}

/**
 * 创建评论元素
 * @param {Object} comment - 评论对象
 * @returns {string} 评论HTML
 */
function createCommentElement(comment) {
  try {
    const timeAgo = getTimeAgo(comment.created_at);
    
    // 处理头像URL，确保是完整的URL
    const apiBase = getApiBase();
    const avatarUrl = comment.avatar_url ? 
      (comment.avatar_url.startsWith('http') ? comment.avatar_url : (apiBase + comment.avatar_url)) : 
      null;
    
    // 判断是否是当前用户的评论
    // 1. 实名评论：通过 user_id 匹配
    // 2. 匿名评论：也通过 user_id 匹配（后端会记录user_id，但前端显示时保持匿名）
    const isCurrentUser = currentUser && comment.user_id && currentUser.id === comment.user_id;
  
  // 主评论不需要显示回复信息，因为回复会显示在下方
  
  // 菜单现在不放在评论容器内，而是放到页面主容器
  return `
    <div class="comment-item" data-comment-id="${comment.id}" data-parent-comment-id="${comment.parent_comment_id || ''}" onclick="handleCommentClick('${comment.id}', event)">
      <div class="comment-avatar">
        ${avatarUrl ? 
          `<img src="${avatarUrl}" alt="${comment.username}" class="avatar-image">` :
          `<div class="avatar-initials">${getInitials(comment.username)}</div>`
        }
      </div>
      <div class="comment-content">
        <div class="comment-header">
          <div class="comment-author">${escapeHtml(comment.username)}</div>
          <div class="comment-time">${timeAgo}</div>
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
      </div>
      <button class="comment-menu-btn" onclick="toggleCommentMenu('${comment.id}', event)" data-comment-id="${comment.id}">
        <ion-icon ios="ellipsis-horizontal-outline" md="ellipsis-horizontal-sharp" aria-hidden="true"></ion-icon>
      </button>
    </div>
  `;
  } catch (error) {
    console.error('创建评论元素时出错:', error, comment);
    return `<div class="comment-item">评论加载失败</div>`;
  }
}

/**
 * 创建评论菜单（在主容器中）
 * @param {Object} comment - 评论对象
 */
function createCommentMenu(comment) {
  // 判断是否是当前用户的评论
  const isCurrentUser = currentUser && comment.user_id && currentUser.id === comment.user_id;
  
  // 移除已存在的同ID菜单
  const existingMenu = squareRoot.getElementById(`comment-menu-${comment.id}`);
  if (existingMenu) {
    existingMenu.remove();
  }
  
  // 创建菜单元素
  const menu = document.createElement('div');
  menu.className = 'comment-dropdown-menu';
  menu.id = `comment-menu-${comment.id}`;
  menu.style.display = 'none';
  menu.style.position = 'fixed';
  menu.style.zIndex = '10000';
  
  // 菜单内容
  menu.innerHTML = isCurrentUser ? `
    <button class="dropdown-menu-item" onclick="deleteCommentWithRefresh('${comment.id}')">
      <ion-icon ios="trash-outline" md="trash-sharp" aria-hidden="true"></ion-icon>
      <span>删除</span>
    </button>
  ` : `
    <button class="dropdown-menu-item" onclick="reportContent('comment', '${comment.id}', '${comment.user_id || ''}')">
      <ion-icon ios="flag-outline" md="flag-sharp" aria-hidden="true"></ion-icon>
      <span>举报</span>
    </button>
    ${comment.user_id && comment.username !== '匿名用户' ? `
      <button class="dropdown-menu-item dropdown-menu-item-danger" onclick="blockUser('${comment.user_id}', '${escapeHtml(comment.username)}')">
        <ion-icon ios="ban-outline" md="ban-sharp" aria-hidden="true"></ion-icon>
        <span>屏蔽用户</span>
      </button>
    ` : ''}
  `;
  
  // 添加到页面主容器
  const appContainer = squareRoot.querySelector('.app') || squareRoot.querySelector('body') || squareRoot;
  appContainer.appendChild(menu);
  
  return menu;
}

/**
 * 显示评论输入框
 * @param {string} postId - 消息ID
 */
function showCommentInput(postId) {
  const inputSection = squareRoot.getElementById(`comment-input-section-${postId}`);
  const addCommentSection = squareRoot.querySelector(`button[onclick="showCommentInput('${postId}')"]`)?.parentElement;
  
  if (inputSection && addCommentSection) {
    // 隐藏"增加评论"按钮
    addCommentSection.style.display = 'none';
    
    // 显示输入框
    inputSection.style.display = 'block';
    
    // 聚焦到输入框
    const textarea = squareRoot.getElementById(`comment-input-${postId}`);
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
      }, 100);
    }
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
  }
}

/**
 * 隐藏评论输入框
 * @param {string} postId - 消息ID
 */
function hideCommentInput(postId) {
  const inputSection = squareRoot.getElementById(`comment-input-section-${postId}`);
  const addCommentSection = squareRoot.querySelector(`button[onclick="showCommentInput('${postId}')"]`)?.parentElement;
  
  if (inputSection && addCommentSection) {
    // 隐藏输入框
    inputSection.style.display = 'none';
    
    // 显示"增加评论"按钮
    addCommentSection.style.display = 'block';
    
    // 清空输入框内容
    const textarea = squareRoot.getElementById(`comment-input-${postId}`);
    if (textarea) {
      textarea.value = '';
    }
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
  }
}

/**
 * 提交评论
 * @param {string} postId - 消息ID
 */
async function submitComment(postId) {
  const commentInput = squareRoot.getElementById(`comment-input-${postId}`);
  if (!commentInput) return;
  
  const text = commentInput.value.trim();
  if (!text) {
    showToast('请输入评论内容');
    return;
  }
  
  try {
    const identity = await resolveUserIdentity();
    if (!identity.user_id && !identity.username) {
      alert('未获取到用户身份，请先登录');
      return;
    }
    
    const API_BASE = getApiBase();
    const payload = {
      post_id: postId,
      user_id: identity.user_id || undefined, // 匿名时也记录user_id
      username: identity.username || undefined,
      avatar_url: identity.avatar_url || undefined,
      text: text
    };
    
    const resp = await fetch(API_BASE + '/square/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '评论失败');
    
    // 匿名评论时不再需要本地存储记录，因为后端会记录user_id
    
    // 清空输入框
    commentInput.value = '';
    
    // 隐藏输入框，显示"增加评论"按钮
    const inputSection = squareRoot.getElementById(`comment-input-section-${postId}`);
    const addCommentSection = squareRoot.querySelector(`button[onclick="showCommentInput('${postId}')"]`)?.parentElement;
    
    if (inputSection && addCommentSection) {
      inputSection.style.display = 'none';
      addCommentSection.style.display = 'block';
    }
    
    // 重新加载评论
    await loadComments(postId);
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
    
    showToast('评论成功');
  } catch (error) {
    console.error('评论失败:', error);
    showToast('评论失败，请重试');
  }
}

/**
 * 显示回复输入框
 * @param {string} commentId - 评论ID
 */
function showReplyInput(commentId) {
  const replySection = squareRoot.getElementById(`reply-input-section-${commentId}`);
  const replyBtn = squareRoot.querySelector(`button[onclick="showReplyInput('${commentId}')"]`);
  
  if (replySection && replyBtn) {
    // 隐藏回复按钮
    replyBtn.style.display = 'none';
    
    // 显示回复输入框
    replySection.style.display = 'block';
    
    // 聚焦到输入框并设置字符计数
    const textarea = squareRoot.getElementById(`reply-input-${commentId}`);
    const charCount = squareRoot.getElementById(`reply-char-count-${commentId}`);
    if (textarea) {
      setTimeout(() => {
        textarea.focus();
      }, 100);
      
      // 添加字符计数监听
      const updateCharCount = () => {
        if (charCount) {
          charCount.textContent = textarea.value.length;
        }
      };
      
      textarea.addEventListener('input', updateCharCount);
      // 清理函数
      const cleanup = () => {
        textarea.removeEventListener('input', updateCharCount);
      };
      cleanupFns.push(cleanup);
    }
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Light');
    }
  }
}

/**
 * 隐藏回复输入框
 * @param {string} commentId - 评论ID
 */

/**
 * 提交回复
 * @param {string} commentId - 评论ID
 */
async function submitReply(commentId) {
  const replyInput = squareRoot.getElementById(`reply-input-${commentId}`);
  if (!replyInput) return;
  
  const text = replyInput.value.trim();
  if (!text) {
    showToast('请输入回复内容');
    return;
  }
  
  // 添加震动反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Medium');
  }
  
  try {
    const identity = await resolveUserIdentity();
    if (!identity.user_id && !identity.username) {
      alert('未获取到用户身份，请先登录');
      return;
    }
    
    // 获取帖子ID
    const commentElement = squareRoot.querySelector(`[data-comment-id="${commentId}"]`);
    if (!commentElement) {
      showToast('找不到评论信息');
      return;
    }
    
    // 从评论元素向上查找帖子ID
    const commentsSection = commentElement.closest('.comments-section');
    if (!commentsSection) {
      showToast('找不到帖子信息');
      return;
    }
    const postId = commentsSection.id.replace('comments-', '');
    
    const API_BASE = getApiBase();
    const payload = {
      post_id: postId,
      parent_comment_id: commentId, // 设置父评论ID
      user_id: identity.user_id || undefined,
      username: identity.username || undefined,
      avatar_url: identity.avatar_url || undefined,
      text: text
    };
    
    const resp = await fetch(API_BASE + '/square/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '回复失败');
    
    // 清空输入框
    replyInput.value = '';
    
    // 隐藏回复输入框，显示回复按钮
    hideReplyInput(commentId);
    
    // 重新加载评论
    await loadComments(postId);
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
    
    showToast('回复成功');
  } catch (error) {
    console.error('回复失败:', error);
    showToast('回复失败，请重试');
  }
}

/**
 * 删除评论
 * @param {string} commentId - 评论ID
 */
async function deleteComment(commentId) {
  if (!confirm('确定要删除这条评论吗？')) return;
  
  try {
    const API_BASE = getApiBase();
    const resp = await fetch(API_BASE + `/square/comment/${commentId}`, {
      method: 'DELETE'
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '删除失败');
    
    showToast('删除成功');
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
  } catch (error) {
    console.error('删除评论失败:', error);
    showToast('删除失败，请重试');
  }
}

/**
 * 切换消息菜单显示/隐藏
 * @param {string} messageId - 消息ID
 * @param {Event} event - 点击事件
 */
function toggleMessageMenu(messageId, event) {
  event.stopPropagation();
  
  const menu = squareRoot.getElementById(`message-menu-${messageId}`);
  if (!menu) return;
  
  // 关闭所有其他菜单
  const allMenus = squareRoot.querySelectorAll('.dropdown-menu, .comment-dropdown-menu');
  allMenus.forEach(m => {
    if (m.id !== `message-menu-${messageId}`) {
      m.style.display = 'none';
    }
  });
  
  // 切换当前菜单
  if (menu.style.display === 'none') {
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
  
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
}

/**
 * 切换评论菜单显示/隐藏
 * @param {string} commentId - 评论ID
 * @param {Event} event - 点击事件
 */
function toggleCommentMenu(commentId, event) {
  event.stopPropagation();
  
  const menu = squareRoot.getElementById(`comment-menu-${commentId}`);
  if (!menu) return;
  
  // 关闭所有其他菜单
  const allMenus = squareRoot.querySelectorAll('.dropdown-menu, .comment-dropdown-menu');
  allMenus.forEach(m => {
    if (m.id !== `comment-menu-${commentId}`) {
      m.style.display = 'none';
    }
  });
  
  // 切换当前菜单
  if (menu.style.display === 'none') {
    // 计算菜单位置
    const button = event.target.closest('.comment-menu-btn');
    if (button) {
      const rect = button.getBoundingClientRect();
      
      // 设置菜单位置（在按钮右侧偏下）
      menu.style.top = `${rect.bottom + 5}px`;
      menu.style.right = `${window.innerWidth - rect.right}px`;
      menu.style.left = 'auto';
    }
    
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
  
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
}

/**
 * 删除消息
 * @param {string} postId - 消息ID
 */
async function deletePost(postId) {
  const confirmed = await confirmDialog('确定要删除这条消息吗？删除后将无法恢复。', 'danger');
  if (!confirmed) return;
  
  try {
    const API_BASE = getApiBase();
    const resp = await fetch(API_BASE + `/square/post/${postId}`, {
      method: 'DELETE'
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '删除失败');
    
    showToast('删除成功');
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
    
    // 如果删除的是当前详情视图的帖子，返回列表
    if (isDetailView && currentDetailPostId === postId) {
      backToList();
    }
    
    // 重新加载消息列表
    await loadMessages();
  } catch (error) {
    console.error('删除消息失败:', error);
    showToast('删除失败，请重试');
  }
}

/**
 * 删除评论并刷新评论列表
 * @param {string} commentId - 评论ID
 */
async function deleteCommentWithRefresh(commentId) {
  console.log('开始删除评论:', commentId);
  const confirmed = await confirmDialog('确定要删除这条评论吗？', 'danger');
  if (!confirmed) return;
  
  try {
    const API_BASE = getApiBase();
    console.log('发送删除请求到:', API_BASE + `/square/comment/${commentId}`);
    const resp = await fetch(API_BASE + `/square/comment/${commentId}`, {
      method: 'DELETE'
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '删除失败');
    
    console.log('删除成功，开始刷新评论');
    showToast('删除成功');
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
    
    // 不再需要从本地存储中移除，因为统一通过user_id匹配
    
    // 找到评论所属的消息ID并重新加载该消息的评论
    // 使用更可靠的方法：通过data-comment-id属性查找
    const commentElement = squareRoot.querySelector(`[data-comment-id="${commentId}"]`);
    if (commentElement) {
      const commentsSection = commentElement.closest('.comments-section');
      if (commentsSection) {
        const postId = commentsSection.id.replace('comments-', '');
        console.log('删除评论后刷新帖子评论:', postId);
        await loadComments(postId);
        return; // 成功刷新后直接返回，避免重复刷新
      }
    }
    
    // 如果找不到特定评论元素，刷新所有可见的评论列表（只执行一次）
    console.log('未找到评论元素，刷新所有评论列表');
    const allCommentsSections = squareRoot.querySelectorAll('.comments-section');
    const refreshPromises = [];
    for (const section of allCommentsSections) {
      const postId = section.id.replace('comments-', '');
      if (postId) {
        console.log('刷新帖子评论:', postId);
        refreshPromises.push(loadComments(postId));
      }
    }
    // 并行刷新所有评论列表，提高效率
    await Promise.all(refreshPromises);
  } catch (error) {
    console.error('删除评论失败:', error);
    showToast('删除失败，请重试');
  }
}

// 点击页面其他地方关闭所有菜单
function setupGlobalMenuClose() {
  const handler = (event) => {
    // 如果点击的不是菜单按钮
    if (!event.target.closest('.menu-btn') && !event.target.closest('.comment-menu-btn')) {
      const allMenus = squareRoot.querySelectorAll('.dropdown-menu, .comment-dropdown-menu');
      allMenus.forEach(menu => {
        menu.style.display = 'none';
      });
    }
  };
  
  squareRoot.addEventListener('click', handler);
  cleanupFns.push(() => squareRoot.removeEventListener('click', handler));
}

/**
 * 确保确认弹窗样式已加载
 */
function ensureConfirmStyles() {
  if (document.getElementById("app-confirm-style")) return;
  const s = document.createElement("style");
  s.id = "app-confirm-style";
  s.textContent = `
    .app-confirm-mask {
      position: fixed; 
      inset: 0; 
      background: color-mix(in srgb, var(--text, #000) 20%, transparent); 
      backdrop-filter: saturate(120%) blur(2px); 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      opacity: 0; 
      transition: opacity .18s ease; 
      z-index: 10000;
    }
    .app-confirm-mask.show {
      opacity: 1;
    }
    .app-confirm { 
      width: min(92vw, 360px); 
      background: var(--card, #fff); 
      color: var(--text, #111); 
      border-radius: 16px; 
      box-shadow: var(--shadow-2, 0 10px 30px rgba(0,0,0,.15)); 
      transform: translateY(12px) scale(.98); 
      opacity: 0; 
      transition: transform .2s ease, opacity .2s ease; 
      border: 1px solid var(--divider, rgba(0,0,0,.06));
    }
    .app-confirm.show { 
      transform: translateY(0) scale(1); 
      opacity: 1; 
    }
    .app-confirm__body { 
      padding: 18px 18px 8px; 
      font-size: 15px; 
      line-height: 1.5; 
    }
    .app-confirm__footer { 
      display: flex; 
      gap: 10px; 
      justify-content: flex-end; 
      padding: 0 12px 12px; 
    }
    .app-confirm__btn { 
      appearance: none; 
      border: 0; 
      padding: 9px 14px; 
      border-radius: 12px; 
      cursor: pointer; 
      font-size: 14px; 
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .app-confirm__btn--ghost { 
      background: var(--divider, rgba(0,0,0,.04)); 
      color: var(--text, #111); 
    }
    .app-confirm__btn--ghost:hover {
      background: var(--text-secondary, rgba(0,0,0,.08));
    }
    .app-confirm__btn--primary { 
      background: var(--brand, #6200ea); 
      color: #fff; 
    }
    .app-confirm__btn--primary:hover {
      background: var(--brand-700, #4b00b5);
      transform: translateY(-1px);
    }
    .app-confirm__btn--danger { 
      background: var(--danger, #e53935); 
      color: #fff; 
    }
    .app-confirm__btn--danger:hover {
      background: #d32f2f;
      transform: translateY(-1px);
    }
    .app-confirm__btn:focus { 
      outline: 2px solid var(--brand, #6200ea); 
      outline-offset: 2px; 
    }
    @media (prefers-color-scheme: dark) { 
      .app-confirm-mask { 
        background: color-mix(in srgb, #000 50%, transparent); 
      }
      .app-confirm { 
        background: var(--card, #1e1f22); 
        color: var(--text, #e6e6e6); 
        border-color: var(--divider, rgba(255,255,255,.08)); 
      }
      .app-confirm__btn--ghost { 
        background: var(--divider, rgba(255,255,255,.08)); 
        color: var(--text, #e6e6e6); 
      }
      .app-confirm__btn--ghost:hover {
        background: var(--text-secondary, rgba(255,255,255,.12));
      }
    }
  `;
  document.head.appendChild(s);
  cleanupFns.push(() => {
    if (s.parentNode) s.remove();
  });
}

/**
 * 自定义确认弹窗
 * @param {string} message - 确认消息
 * @param {string} type - 弹窗类型 ('danger' | 'warning' | 'info')
 * @returns {Promise<boolean>} 用户是否确认
 */
function confirmDialog(message, type = 'danger') {
  ensureConfirmStyles();
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'app-confirm-mask';

    const box = document.createElement('div');
    box.className = 'app-confirm';

    const body = document.createElement('div');
    body.className = 'app-confirm__body';
    body.textContent = message || '确定要执行此操作吗？';

    const footer = document.createElement('div');
    footer.className = 'app-confirm__footer';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'app-confirm__btn app-confirm__btn--ghost';
    cancelBtn.textContent = '取消';

    const okBtn = document.createElement('button');
    okBtn.className = `app-confirm__btn app-confirm__btn--${type}`;
    okBtn.textContent = '确定';

    footer.append(cancelBtn, okBtn);
    box.append(body, footer);
    mask.appendChild(box);
    document.body.appendChild(mask);

    // 显示动画
    requestAnimationFrame(() => {
      mask.classList.add('show');
      box.classList.add('show');
    });

    const close = (result) => {
      box.classList.remove('show');
      mask.classList.remove('show');
      const onEnd = () => {
        mask.removeEventListener('transitionend', onEnd);
        if (mask.parentNode) mask.remove();
      };
      mask.addEventListener('transitionend', onEnd);
      resolve(result);
    };

    // 事件处理
    cancelBtn.addEventListener('click', () => {
      if (window.__hapticImpact__) {
        window.__hapticImpact__('Light');
      }
      close(false);
    }, { once: true });

    okBtn.addEventListener('click', () => {
      if (window.__hapticImpact__) {
        window.__hapticImpact__('Medium');
      }
      close(true);
    }, { once: true });

    mask.addEventListener('click', (e) => {
      if (e.target === mask) {
        close(false);
      }
    }, { once: true });

    // ESC键关闭
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        close(false);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // 聚焦到确定按钮
    setTimeout(() => okBtn.focus(), 0);
  });
}

/**
 * 举报内容
 * @param {string} contentType - 'post' or 'comment'
 * @param {string} contentId - 内容ID
 * @param {string} reportedUserId - 被举报用户ID
 */
async function reportContent(contentType, contentId, reportedUserId) {
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 关闭菜单
  const allMenus = squareRoot.querySelectorAll('.dropdown-menu, .comment-dropdown-menu');
  allMenus.forEach(menu => menu.style.display = 'none');
  
  // 显示举报原因选择对话框
  const reason = await showReportDialog();
  if (!reason) return;
  
  try {
    const identity = await resolveUserIdentity();
    if (!identity.user_id) {
      showToast('请先登录');
      return;
    }
    
    const API_BASE = getApiBase();
    const payload = {
      reporter_id: identity.user_id,
      content_type: contentType,
      content_id: contentId,
      reported_user_id: reportedUserId || undefined,
      reason: reason.value,
      details: reason.details || undefined
    };
    
    const resp = await fetch(API_BASE + '/report/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '举报失败');
    
    showToast('举报已提交，感谢您的反馈');
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
  } catch (error) {
    console.error('举报失败:', error);
    showToast(error.message || '举报失败，请重试');
  }
}

/**
 * 屏蔽用户
 * @param {string} blockedId - 被屏蔽用户ID
 * @param {string} blockedName - 被屏蔽用户名
 */
async function blockUser(blockedId, blockedName) {
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
  
  // 关闭菜单
  const allMenus = squareRoot.querySelectorAll('.dropdown-menu, .comment-dropdown-menu');
  allMenus.forEach(menu => menu.style.display = 'none');
  
  const confirmed = await confirmDialog(
    `确定要屏蔽用户"${blockedName}"吗？屏蔽后将不会看到该用户的任何内容。`,
    'danger'
  );
  if (!confirmed) return;
  
  try {
    const identity = await resolveUserIdentity();
    if (!identity.user_id) {
      showToast('请先登录');
      return;
    }
    
    const API_BASE = getApiBase();
    const payload = {
      blocker_id: identity.user_id,
      blocked_id: blockedId
    };
    
    const resp = await fetch(API_BASE + '/block/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '屏蔽失败');
    
    showToast('已屏蔽该用户');
    
    // 触觉反馈
    if (window.__hapticImpact__) {
      window.__hapticImpact__('Medium');
    }
    
    // 重新加载消息列表以过滤被屏蔽用户的内容
    await loadMessages();
  } catch (error) {
    console.error('屏蔽用户失败:', error);
    showToast(error.message || '屏蔽失败，请重试');
  }
}

/**
 * 显示举报原因选择对话框
 * @returns {Promise<Object|null>} 返回选择的原因和详情，或null
 */
function showReportDialog() {
  ensureReportDialogStyles();
  
  return new Promise((resolve) => {
    const mask = document.createElement('div');
    mask.className = 'report-dialog-mask';
    
    const dialog = document.createElement('div');
    dialog.className = 'report-dialog';
    
    const title = document.createElement('h3');
    title.className = 'report-dialog-title';
    title.textContent = '举报原因';
    
    const reasons = [
      { value: 'spam', label: '垃圾广告', icon: 'megaphone' },
      { value: 'harassment', label: '骚扰辱骂', icon: 'sad' },
      { value: 'hate_speech', label: '仇恨言论', icon: 'warning' },
      { value: 'violence', label: '暴力内容', icon: 'alert-circle' },
      { value: 'adult_content', label: '色情内容', icon: 'eye-off' },
      { value: 'misleading', label: '虚假误导', icon: 'help-circle' },
      { value: 'privacy_violation', label: '侵犯隐私', icon: 'lock-closed' },
      { value: 'other', label: '其他', icon: 'ellipsis-horizontal-circle' }
    ];
    
    const reasonsList = document.createElement('div');
    reasonsList.className = 'report-reasons-list';
    
    let selectedReason = null;
    
    reasons.forEach(reason => {
      const item = document.createElement('button');
      item.className = 'report-reason-item';
      item.innerHTML = `
        <ion-icon ios="${reason.icon}-outline" md="${reason.icon}-sharp"></ion-icon>
        <span>${reason.label}</span>
      `;
      
      item.addEventListener('click', () => {
        // 移除其他选中状态
        reasonsList.querySelectorAll('.report-reason-item').forEach(i => {
          i.classList.remove('selected');
        });
        // 设置当前选中
        item.classList.add('selected');
        selectedReason = reason.value;
        submitBtn.disabled = false;
      });
      
      reasonsList.appendChild(item);
    });
    
    const detailsLabel = document.createElement('label');
    detailsLabel.className = 'report-details-label';
    detailsLabel.textContent = '补充说明（可选）';
    
    const detailsTextarea = document.createElement('textarea');
    detailsTextarea.className = 'report-details-textarea';
    detailsTextarea.placeholder = '请详细描述问题...';
    detailsTextarea.maxLength = 500;
    
    const footer = document.createElement('div');
    footer.className = 'report-dialog-footer';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'report-dialog-btn report-dialog-btn-cancel';
    cancelBtn.textContent = '取消';
    
    const submitBtn = document.createElement('button');
    submitBtn.className = 'report-dialog-btn report-dialog-btn-submit';
    submitBtn.textContent = '提交举报';
    submitBtn.disabled = true;
    
    footer.append(cancelBtn, submitBtn);
    dialog.append(title, reasonsList, detailsLabel, detailsTextarea, footer);
    mask.appendChild(dialog);
    document.body.appendChild(mask);
    
    // 显示动画
    requestAnimationFrame(() => {
      mask.classList.add('show');
      dialog.classList.add('show');
    });
    
    const close = (result) => {
      dialog.classList.remove('show');
      mask.classList.remove('show');
      setTimeout(() => {
        if (mask.parentNode) mask.remove();
      }, 200);
      resolve(result);
    };
    
    cancelBtn.addEventListener('click', () => {
      if (window.__hapticImpact__) window.__hapticImpact__('Light');
      close(null);
    });
    
    submitBtn.addEventListener('click', () => {
      if (window.__hapticImpact__) window.__hapticImpact__('Medium');
      if (selectedReason) {
        close({
          value: selectedReason,
          details: detailsTextarea.value.trim() || null
        });
      }
    });
    
    mask.addEventListener('click', (e) => {
      if (e.target === mask) close(null);
    });
  });
}

/**
 * 确保举报对话框样式已加载
 */
function ensureReportDialogStyles() {
  if (document.getElementById('report-dialog-style')) return;
  
  const style = document.createElement('style');
  style.id = 'report-dialog-style';
  style.textContent = `
    .report-dialog-mask {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    .report-dialog-mask.show {
      opacity: 1;
    }
    
    .report-dialog {
      width: min(90vw, 420px);
      max-height: 80vh;
      background: var(--card, #fff);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      transform: translateY(20px) scale(0.95);
      opacity: 0;
      transition: all 0.2s ease;
      overflow-y: auto;
    }
    
    .report-dialog.show {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    
    .report-dialog-title {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text, #111);
    }
    
    .report-reasons-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    
    .report-reason-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 16px 8px;
      border: 2px solid var(--divider, #e0e0e0);
      border-radius: 12px;
      background: var(--card, #fff);
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 13px;
      color: var(--text-secondary, #666);
    }
    
    .report-reason-item ion-icon {
      font-size: 24px;
      color: var(--text-secondary, #666);
    }
    
    .report-reason-item:hover {
      border-color: var(--brand, #6200ea);
      background: var(--brand-light, #f3e5f5);
    }
    
    .report-reason-item.selected {
      border-color: var(--brand, #6200ea);
      background: var(--brand-light, #f3e5f5);
      color: var(--brand, #6200ea);
    }
    
    .report-reason-item.selected ion-icon {
      color: var(--brand, #6200ea);
    }
    
    .report-details-label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text, #111);
    }
    
    .report-details-textarea {
      width: 100%;
      min-height: 80px;
      padding: 12px;
      border: 1px solid var(--divider, #e0e0e0);
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      margin-bottom: 16px;
      background: var(--card, #fff);
      color: var(--text, #111);
    }
    
    .report-details-textarea:focus {
      outline: none;
      border-color: var(--brand, #6200ea);
    }
    
    .report-dialog-footer {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    
    .report-dialog-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .report-dialog-btn-cancel {
      background: var(--divider, #e0e0e0);
      color: var(--text, #111);
    }
    
    .report-dialog-btn-cancel:hover {
      background: var(--divider-dark, #bdbdbd);
    }
    
    .report-dialog-btn-submit {
      background: var(--brand, #6200ea);
      color: #fff;
    }
    
    .report-dialog-btn-submit:hover:not(:disabled) {
      background: var(--brand-700, #4b00b5);
      transform: translateY(-1px);
    }
    
    .report-dialog-btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    @media (prefers-color-scheme: dark) {
      .report-dialog {
        background: var(--card, #1e1f22);
      }
      
      .report-dialog-title {
        color: var(--text, #e6e6e6);
      }
      
      .report-reason-item {
        background: var(--card, #2b2d31);
        border-color: var(--divider, #3a3c42);
        color: var(--text-secondary, #b0b3b8);
      }
      
      .report-reason-item ion-icon {
        color: var(--text-secondary, #b0b3b8);
      }
      
      .report-reason-item:hover {
        background: var(--brand-dark, #2a0066);
      }
      
      .report-reason-item.selected {
        background: var(--brand-dark, #2a0066);
      }
      
      .report-details-label {
        color: var(--text, #e6e6e6);
      }
      
      .report-details-textarea {
        background: var(--card, #2b2d31);
        border-color: var(--divider, #3a3c42);
        color: var(--text, #e6e6e6);
      }
      
      .report-dialog-btn-cancel {
        background: var(--divider, #3a3c42);
        color: var(--text, #e6e6e6);
      }
    }
  `;
  
  document.head.appendChild(style);
  cleanupFns.push(() => {
    if (style.parentNode) style.remove();
  });
}

// -----------------------------
// Public API / 对外导出
// -----------------------------
window.initSquare = initSquare;
window.destroySquare = destroySquare;
window.openImageModal = openImageModal;
window.toggleComments = toggleComments;
window.submitComment = submitComment;
window.deleteComment = deleteComment;
window.showCommentInput = showCommentInput;
window.hideCommentInput = hideCommentInput;
window.toggleMessageMenu = toggleMessageMenu;
window.toggleCommentMenu = toggleCommentMenu;
window.deletePost = deletePost;
window.deleteCommentWithRefresh = deleteCommentWithRefresh;
window.confirmDialog = confirmDialog;
window.showPostDetail = showPostDetail;
window.backToList = backToList;
window.reportContent = reportContent;
window.blockUser = blockUser;
window.showReplyInput = showReplyInput;
window.hideReplyInput = hideReplyInput;
window.submitReply = submitReply;
window.toggleReplyInput = toggleReplyInput;
window.toggleReplies = toggleReplies;
window.handleCommentClick = handleCommentClick;

})();
