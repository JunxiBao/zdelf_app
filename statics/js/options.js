// 全局变量存储记录数据
let recordData = null;

// 页面级别的震动防抖标志
// 注意：使用 sessionStorage 而不是全局变量，避免 bfcache 缓存问题
let isNavigating = false;

// 🔧 关键修复：监听 pageshow 事件，确保从缓存恢复时也重置标志
window.addEventListener('pageshow', function(event) {
    // bfcache: 浏览器的前进/后退缓存
    if (event.persisted) {
        console.log('[Options] 页面从 bfcache 恢复，重置 isNavigating');
        isNavigating = false;
    }
});

// 震动反馈 - 使用统一的HapticManager
// 注意：options.html是独立页面，需要单独加载HapticManager
function hapticImpact(style, options = {}) {
  try {
    // 页面级防抖：如果正在跳转，忽略所有震动请求
    // 这样可以避免跳转动画期间的重复震动
    if (isNavigating) {
      console.log(`[Options] 震动被跳转标志过滤: ${style}`);
      return;
    }
    
    console.log(`[Options] 震动触发: ${style}, context: ${options.context || 'default'}`);
    
    if (window.HapticManager) {
      // 直接传递 options，不覆盖调用者的配置
      window.HapticManager.impact(style, options);
    } else if (window.__hapticImpact__) {
      window.__hapticImpact__(style);
    }
  } catch(e) {
    console.warn('[Options] 震动反馈失败:', e);
  }
}

// 页面初始化
function initOptionsPage() {
    // 🔧 关键修复：重置跳转标志
    // 当用户返回 options 页面时，必须重置标志，否则无法再次触发震动
    isNavigating = false;
    console.log('[Options] 页面初始化，重置 isNavigating 标志');
    
    // 强制重新触发动画（防止缓存问题）
    const optionCards = document.querySelectorAll('.option-card');
    const optionsTitle = document.querySelector('.options-title');
    
    // 重置动画
    optionCards.forEach(card => {
        card.style.animation = 'none';
        card.offsetHeight; // 强制重排
        card.style.animation = null;
    });
    
    if (optionsTitle) {
        optionsTitle.style.animation = 'none';
        optionsTitle.offsetHeight; // 强制重排
        optionsTitle.style.animation = null;
    }

    // 从本地存储获取记录数据
    const storedData = localStorage.getItem('health_record_data');
    if (storedData) {
        try {
            recordData = JSON.parse(storedData);
            console.log('获取记录数据:', recordData);
        } catch (error) {
            console.error('解析记录数据失败:', error);
        }
    }

    // 为选项卡添加点击事件
    // 🔧 修复：先移除旧的监听器，避免重复添加
    optionCards.forEach(card => {
        // 移除可能存在的旧监听器
        card.removeEventListener('click', handleOptionClick);
        // 添加新的监听器
        card.addEventListener('click', handleOptionClick);
        // 添加涟漪效果
        attachButtonRipple(card);
    });
    
    console.log('[Options] 已为', optionCards.length, '个选项卡绑定点击事件');
}

// 处理选项点击
function handleOptionClick(event) {
    const card = event.currentTarget;
    const optionType = card.dataset.type;

    // 注意：震动反馈在具体的跳转函数中触发，这里不重复触发
    // 避免双重震动问题

    // 根据选项类型跳转到对应页面
    switch(optionType) {
        case 'metrics':
            navigateToMetrics();
            break;
        case 'diet':
            navigateToDiet();
            break;
        case 'cases':
            navigateToCases();
            break;
        default:
            console.warn('未知选项类型:', optionType);
    }
}

// 跳转到健康指标页面
function navigateToMetrics() {
    // 检查是否正在跳转
    if (isNavigating) return;
    
    // 🔧 修复：先触发震动，再设置跳转标志
    // 触发震动反馈 - 使用独立的 context 避免相互干扰
    hapticImpact('Medium', { context: 'navigate-metrics', debounce: 150 });
    
    // 设置跳转标志，防止后续重复触发
    isNavigating = true;
    
    // 延迟跳转，确保震动先执行
    setTimeout(() => {
        window.location.href = 'metrics.html';
    }, 50);
}

// 跳转到饮食记录页面
function navigateToDiet() {
    // 检查是否正在跳转
    if (isNavigating) return;
    
    // 🔧 修复：先触发震动，再设置跳转标志
    // 触发震动反馈 - 使用独立的 context 避免相互干扰
    hapticImpact('Medium', { context: 'navigate-diet', debounce: 150 });
    
    // 设置跳转标志，防止后续重复触发
    isNavigating = true;
    
    // 延迟跳转，确保震动先执行
    setTimeout(() => {
        window.location.href = 'diet.html';
    }, 50);
}

// 跳转到病例页面
function navigateToCases() {
    // 检查是否正在跳转
    if (isNavigating) return;
    
    // 🔧 修复：先触发震动，再设置跳转标志
    // 触发震动反馈 - 使用独立的 context 避免相互干扰
    hapticImpact('Medium', { context: 'navigate-cases', debounce: 150 });
    
    // 设置跳转标志，防止后续重复触发
    isNavigating = true;
    
    // 延迟跳转，确保震动先执行
    setTimeout(() => {
        window.location.href = 'case_record.html';
    }, 50);
}

// 返回上一页
function goBack() {
    hapticImpact('Light');
    // 清空本地存储的数据
    localStorage.removeItem('health_record_data');
    // 返回到首页
    window.location.href = '../index.html';
}

// 为按钮添加涟漪效果
function attachButtonRipple(btn) {
    if (!btn) return;
    
    // 🔧 修复：使用标记避免重复添加涟漪效果
    if (btn._hasRipple) return;
    btn._hasRipple = true;

    btn.addEventListener("click", function (e) {
        // 涟漪效果已经在CSS中处理，这里可以添加额外的逻辑
        // 注意：震动反馈由 handleOptionClick 处理，这里不重复触发
        const rect = this.getBoundingClientRect();
        const ripple = document.createElement("span");
        ripple.className = "btn-ripple";
        ripple.style.left = e.clientX - rect.left + "px";
        ripple.style.top = e.clientY - rect.top + "px";
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 520);
    });
}

// 显示提示消息
function showToast(message) {
    // 创建toast元素
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

    // 添加深色模式适配
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        toast.style.background = 'rgba(187, 134, 252, 0.9)';
    }

    document.body.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes toastIn {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }

    @keyframes toastOut {
        from {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
    }

    .btn-ripple {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        inset: 0;
        width: 20px;
        height: 20px;
        transform: translate(-50%, -50%) scale(0);
        background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.45) 0%,
            rgba(255, 255, 255, 0) 60%
        );
        animation: ripple 0.5s ease-out forwards;
    }

    @keyframes ripple {
        to {
            transform: translate(-50%, -50%) scale(12);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initOptionsPage);

// 支持键盘导航
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        goBack();
    }
});

// 支持浏览器后退按钮
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.page === 'options') {
        goBack();
    }
});

// 页面加载时设置历史状态
window.addEventListener('load', function() {
    if (window.history.pushState) {
        window.history.pushState({page: 'options'}, '选项页面', window.location.href);
    }
});
