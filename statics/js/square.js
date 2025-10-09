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
let userAvatar, avatarImage, avatarInitials, userName, refreshBtn;
let anonymousBtn;
let isAnonymous = false;

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
  
  // 统一执行清理函数
  cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
  cleanupFns = [];
  
  // 重置状态
  messages = [];
  currentUser = null;
  isInitialized = false;
  squareRoot = document;
  
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
  refreshBtn = squareRoot.getElementById('refreshBtn');
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
  
  // 刷新按钮
  if (refreshBtn) {
    const refreshHandler = () => handleRefresh();
    refreshBtn.addEventListener('click', refreshHandler);
    cleanupFns.push(() => refreshBtn.removeEventListener('click', refreshHandler));
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
    user_id: isAnon ? undefined : (identity.user_id || undefined),
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
    if (publishSection) publishSection.style.display = 'none';
    if (publishTriggerBtn) publishTriggerBtn.style.display = 'flex';
    if (window.__hapticImpact__) window.__hapticImpact__('Medium');
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
 * 处理刷新
 */
function handleRefresh() {
  loadMessages();
  
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
  
  // 显示发布区域
  if (publishSection) {
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
    publishSection.style.display = 'none';
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
    const resp = await fetch(API_BASE + '/square/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 50 })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const list = (data && data.success && Array.isArray(data.data)) ? data.data : [];

    // 归一化为现有渲染结构
    messages = list.map((it) => {
      const apiBase = getApiBase();
      const avatar = it.avatar_url ? (it.avatar_url.startsWith('http') ? it.avatar_url : (apiBase + it.avatar_url)) : null;
      const imgs = Array.isArray(it.images) ? it.images : (Array.isArray(it.image_urls) ? it.image_urls : []);
      const normImgs = imgs.map(u => (typeof u === 'string' ? (u.startsWith('http') ? u : (apiBase + u)) : '')).filter(Boolean);
      return {
        id: it.id,
        author: it.username || '匿名用户',
        authorId: it.user_id || '',
        avatar: avatar,
        text: it.text || it.text_content || '',
        images: normImgs,
        timestamp: it.created_at || new Date().toISOString(),
        likes: 0,
        comments: 0
      };
    });

    updateMessagesList();
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
  
  const timeAgo = getTimeAgo(message.timestamp);
  
  // 调试信息
  console.log('创建消息元素:', message.author, '图片数量:', message.images ? message.images.length : 0);
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
    </div>
    <div class="message-content">
      ${message.text ? `<div class="message-text">${escapeHtml(message.text)}</div>` : ''}
      ${message.images && message.images.length > 0 ? 
        `<div class="message-images">
          ${message.images.map((img, imgIndex) => 
            `<img src="${img}" alt="消息图片" class="message-image" onclick="openImageModal('${img}')" onerror="console.error('图片加载失败:', this.src); this.style.display='none'" onload="console.log('图片加载成功:', this.src)" loading="lazy">`
          ).join('')}
        </div>` : ''}
    </div>
    <div class="message-actions">
      <button class="comment-btn" onclick="toggleComments('${message.id}')">
        <ion-icon ios="chatbubble-outline" md="chatbubble-sharp" aria-hidden="true"></ion-icon>
        <span>评论</span>
      </button>
    </div>
    <div class="comments-section" id="comments-${message.id}" style="display: none;">
      <div class="comments-list" id="comments-list-${message.id}">
        <!-- 评论将通过JavaScript动态添加 -->
      </div>
      <div class="comment-input-section">
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
    </div>
  `;
  
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
 * 更新消息计数
 */
function updateMessageCount() {
  if (messageCount) {
    messageCount.textContent = `${messages.length} 条消息`;
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
  const commentsSection = squareRoot.getElementById(`comments-${postId}`);
  if (!commentsSection) return;
  
  const isVisible = commentsSection.style.display !== 'none';
  
  if (isVisible) {
    // 隐藏评论区域
    commentsSection.style.display = 'none';
  } else {
    // 显示评论区域并加载评论
    commentsSection.style.display = 'block';
    loadComments(postId);
  }
  
  // 触觉反馈
  if (window.__hapticImpact__) {
    window.__hapticImpact__('Light');
  }
}

/**
 * 加载指定消息的评论
 * @param {string} postId - 消息ID
 */
async function loadComments(postId) {
  try {
    const API_BASE = getApiBase();
    const resp = await fetch(API_BASE + '/square/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId })
    });
    
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    
    if (!data.success) throw new Error(data.message || '加载评论失败');
    
    const comments = data.data || [];
    renderComments(postId, comments);
  } catch (error) {
    console.error('加载评论失败:', error);
    showToast('加载评论失败');
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
    commentsList.innerHTML = '<div class="no-comments">还没有评论，来抢沙发吧！</div>';
    return;
  }
  
  commentsList.innerHTML = comments.map(comment => createCommentElement(comment)).join('');
}

/**
 * 创建评论元素
 * @param {Object} comment - 评论对象
 * @returns {string} 评论HTML
 */
function createCommentElement(comment) {
  const timeAgo = getTimeAgo(comment.created_at);
  
  return `
    <div class="comment-item">
      <div class="comment-avatar">
        ${comment.avatar_url ? 
          `<img src="${comment.avatar_url}" alt="${comment.username}" class="avatar-image">` :
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
    </div>
  `;
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
    
    if (!data.success) throw new Error(data.message || '评论失败');
    
    // 清空输入框
    commentInput.value = '';
    
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

// -----------------------------
// Public API / 对外导出
// -----------------------------
window.initSquare = initSquare;
window.destroySquare = destroySquare;
window.openImageModal = openImageModal;
window.toggleComments = toggleComments;
window.submitComment = submitComment;
window.deleteComment = deleteComment;

})();
