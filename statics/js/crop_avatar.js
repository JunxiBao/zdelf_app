/**
 * crop_avatar.js — Logic for the avatar cropping page
 *
 * Responsibilities:
 * - Handle file selection and validation
 * - Provide image cropping interface with drag and zoom
 * - Generate circular avatar preview
 * - Handle saving and navigation
 */

(function () {
  console.debug("[crop_avatar] crop_avatar.js evaluated");

  // Global variables
  let selectedFile = null;
  let originalImage = null;
  let canvas = null;
  let ctx = null;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let imagePos = { x: 0, y: 0 };
  let scale = 1;
  let cropSize = 200;

  // DOM elements
  const fileSection = document.getElementById('fileSection');
  const fileDropZone = document.getElementById('fileDropZone');
  const fileInput = document.getElementById('fileInput');
  const selectFileBtn = document.getElementById('selectFileBtn');
  const fileInfo = document.getElementById('fileInfo');
  const filePreview = document.getElementById('filePreview');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const changeFileBtn = document.getElementById('changeFileBtn');
  
  const cropSection = document.getElementById('cropSection');
  const cropCanvas = document.getElementById('cropCanvas');
  const zoomSlider = document.getElementById('zoomSlider');
  const zoomValue = document.getElementById('zoomValue');
  const resetBtn = document.getElementById('resetBtn');
  const cropBtn = document.getElementById('cropBtn');
  
  const resultSection = document.getElementById('resultSection');
  const resultImage = document.getElementById('resultImage');
  const editAgainBtn = document.getElementById('editAgainBtn');
  const saveBtn = document.getElementById('saveBtn');
  
  const loadingOverlay = document.getElementById('loadingOverlay');
  const toast = document.getElementById('toast');
  const backBtn = document.getElementById('backBtn');

  // Utility functions
  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }

  function showLoading(show = true) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function validateFile(file) {
    // Check file type
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error');
      return false;
    }

    // Check file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      showToast('图片文件过大，请选择小于2MB的图片', 'error');
      return false;
    }

    return true;
  }

  function validateImageDimensions(image) {
    const MAX_WIDTH = 512;
    const MAX_HEIGHT = 512;
    
    if (image.width > MAX_WIDTH || image.height > MAX_HEIGHT) {
      showToast(`图片分辨率过大 (${image.width}x${image.height})，建议使用512x512以内的图片`, 'warning');
      // 不阻止上传，但给出警告
    }
    
    return true;
  }

  function handleFileSelect(file) {
    if (!validateFile(file)) return;

    selectedFile = file;
    
    // Update file info display
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = function(e) {
      filePreview.src = e.target.result;
      fileInfo.style.display = 'flex';
      fileDropZone.style.display = 'none';
      
      // Load image for cropping
      loadImageForCropping(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  function loadImageForCropping(imageSrc) {
    originalImage = new Image();
    originalImage.onload = function() {
      // 检查图片分辨率
      validateImageDimensions(originalImage);
      
      setupCanvas();
      drawImage();
      cropSection.style.display = 'block';
    };
    originalImage.src = imageSrc;
  }

  function setupCanvas() {
    canvas = cropCanvas;
    ctx = canvas.getContext('2d');
    
    // Set canvas size
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    // Reset image position and scale
    imagePos = { x: 0, y: 0 };
    scale = 1;
    zoomSlider.value = 1;
    zoomValue.textContent = '100%';
  }

  function drawImage() {
    if (!originalImage || !ctx) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Calculate image dimensions
    const imgWidth = originalImage.width * scale;
    const imgHeight = originalImage.height * scale;
    
    // Calculate position to center the image
    const x = (canvasWidth - imgWidth) / 2 + imagePos.x;
    const y = (canvasHeight - imgHeight) / 2 + imagePos.y;
    
    // Draw image
    ctx.drawImage(originalImage, x, y, imgWidth, imgHeight);
  }

  // Event listeners
  function initEventListeners() {
    // File selection
    selectFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });

    // Drag and drop
    fileDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropZone.classList.add('dragover');
    });

    fileDropZone.addEventListener('dragleave', () => {
      fileDropZone.classList.remove('dragover');
    });

    fileDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropZone.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files[0]) {
        handleFileSelect(files[0]);
      }
    });

    // Change file
    changeFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    // Canvas interactions
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);

    // Zoom control
    zoomSlider.addEventListener('input', (e) => {
      scale = parseFloat(e.target.value);
      zoomValue.textContent = Math.round(scale * 100) + '%';
      drawImage();
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
      imagePos = { x: 0, y: 0 };
      scale = 1;
      zoomSlider.value = 1;
      zoomValue.textContent = '100%';
      drawImage();
    });

    // Crop button
    cropBtn.addEventListener('click', performCrop);

    // Result actions
    editAgainBtn.addEventListener('click', () => {
      resultSection.style.display = 'none';
      cropSection.style.display = 'block';
    });

    saveBtn.addEventListener('click', saveAvatar);

    // Back button
    backBtn.addEventListener('click', () => {
      if (confirm('确定要离开吗？未保存的更改将丢失。')) {
        window.history.back();
      }
    });
  }

  // Mouse event handlers
  function handleMouseDown(e) {
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    dragStart.x = e.clientX - rect.left;
    dragStart.y = e.clientY - rect.top;
    canvas.style.cursor = 'grabbing';
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    imagePos.x += currentX - dragStart.x;
    imagePos.y += currentY - dragStart.y;
    
    dragStart.x = currentX;
    dragStart.y = currentY;
    
    drawImage();
  }

  function handleMouseUp() {
    isDragging = false;
    canvas.style.cursor = 'move';
  }

  // Touch event handlers
  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    dragStart.x = touch.clientX - rect.left;
    dragStart.y = touch.clientY - rect.top;
    isDragging = true;
  }

  function handleTouchMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;
    
    imagePos.x += currentX - dragStart.x;
    imagePos.y += currentY - dragStart.y;
    
    dragStart.x = currentX;
    dragStart.y = currentY;
    
    drawImage();
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    isDragging = false;
  }

  // Crop functionality
  function performCrop() {
    showLoading(true);
    
    // Create a new canvas for the cropped image
    const cropCanvas = document.createElement('canvas');
    const cropCtx = cropCanvas.getContext('2d');
    
    // 设置目标尺寸为200x200（与后端一致）
    const targetSize = 200;
    cropCanvas.width = targetSize;
    cropCanvas.height = targetSize;
    
    // Calculate the center of the main canvas
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Calculate the source rectangle
    const imgWidth = originalImage.width * scale;
    const imgHeight = originalImage.height * scale;
    const imgX = (canvas.width - imgWidth) / 2 + imagePos.x;
    const imgY = (canvas.height - imgHeight) / 2 + imagePos.y;
    
    // Calculate crop area
    const cropX = centerX - cropSize / 2;
    const cropY = centerY - cropSize / 2;
    
    // Draw the cropped area with high quality scaling
    cropCtx.drawImage(
      canvas,
      cropX, cropY, cropSize, cropSize,
      0, 0, targetSize, targetSize
    );
    
    // 应用圆形蒙版
    applyCircularMask(cropCanvas, cropCtx);
    
    // Convert to blob with compression
    cropCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      resultImage.src = url;
      resultSection.style.display = 'block';
      cropSection.style.display = 'none';
      showLoading(false);
      showToast('头像裁剪完成！', 'success');
      
      // 记录文件大小
      const fileSizeKB = Math.round(blob.size / 1024);
      console.log(`压缩后头像大小: ${fileSizeKB}KB`);
    }, 'image/png', 0.9); // 90% 质量压缩
  }
  
  // 应用圆形蒙版
  function applyCircularMask(canvas, ctx) {
    const size = canvas.width;
    
    // 创建圆形蒙版
    const maskCanvas = document.createElement('canvas');
    const maskCtx = maskCanvas.getContext('2d');
    maskCanvas.width = size;
    maskCanvas.height = size;
    
    // 绘制圆形
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, size, size);
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.beginPath();
    maskCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    maskCtx.fill();
    
    // 应用蒙版
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Save functionality
  async function saveAvatar() {
    showLoading(true);
    
    try {
      // 直接使用已经压缩和裁剪好的图片
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      // 设置为目标尺寸200x200
      const targetSize = 200;
      tempCanvas.width = targetSize;
      tempCanvas.height = targetSize;
      
      // 绘制结果图片
      tempCtx.drawImage(resultImage, 0, 0, targetSize, targetSize);
      
      // 转换为base64，使用压缩
      const base64 = tempCanvas.toDataURL('image/png', 0.9);
      
      // Get user ID from localStorage
      const userId = localStorage.getItem('userId') || 
                    localStorage.getItem('UserID') || 
                    sessionStorage.getItem('userId') || 
                    sessionStorage.getItem('UserID');
      
      const username = localStorage.getItem('username') || 
                      localStorage.getItem('Username') || 
                      sessionStorage.getItem('username') || 
                      sessionStorage.getItem('Username');
      
      if (!userId && !username) {
        showToast('未找到用户信息，请重新登录', 'error');
        showLoading(false);
        return;
      }
      
      // API base URL
      const apiBase = (
        document.querySelector('meta[name="api-base"]')?.content ||
        window.__API_BASE__ ||
        window.API_BASE ||
        "https://app.zdelf.cn"
      ).trim().replace(/\/$/, "");
      
      // Send to server
      const payload = {
        user_id: userId || username,
        avatar_data: base64
      };
      
      const response = await fetch(apiBase + "/upload_avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || '头像上传失败');
      }
      
      showLoading(false);
      showToast('头像保存成功！', 'success');
      
      // Navigate back to me page after a delay
      setTimeout(() => {
        window.location.href = 'me.html';
      }, 1500);
      
    } catch (error) {
      console.error('保存头像失败:', error);
      showLoading(false);
      showToast('头像保存失败: ' + error.message, 'error');
    }
  }

  // Initialize the page
  function init() {
    console.debug("[crop_avatar] Initializing crop avatar page");
    initEventListeners();
    
    // Set up canvas initially
    if (cropCanvas) {
      setupCanvas();
    }
  }

  // Start the application
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose functions for external use
  window.cropAvatar = {
    init,
    showToast,
    showLoading
  };

})();
