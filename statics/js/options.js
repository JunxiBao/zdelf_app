// 全局变量存储记录数据
let recordData = null;

// 页面初始化
function initOptionsPage() {
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
    const optionCards = document.querySelectorAll('.option-card');
    optionCards.forEach(card => {
        card.addEventListener('click', handleOptionClick);
        // 添加涟漪效果
        attachButtonRipple(card);
    });
}

// 处理选项点击
function handleOptionClick(event) {
    const card = event.currentTarget;
    const optionType = card.dataset.type;

    // 触觉反馈
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

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
    // 跳转到健康指标录入页面
    window.location.href = 'metrics.html';
}

// 跳转到饮食记录页面
function navigateToDiet() {
    // 跳转到饮食录入页面
    window.location.href = 'diet.html';
}

// 跳转到病例页面
function navigateToCases() {
    // 这里可以跳转到病例管理页面
    // 暂时显示提示信息
    showToast('病例功能开发中...');
    console.log('跳转到病例页面');
}

// 返回上一页
function goBack() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

    // 清空本地存储的数据
    localStorage.removeItem('health_record_data');

    // 返回到首页
    window.location.href = '../index.html';
}

// 为按钮添加涟漪效果
function attachButtonRipple(btn) {
    if (!btn) return;

    btn.addEventListener("click", function (e) {
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Light');
        } catch(_) {}

        // 涟漪效果已经在CSS中处理，这里可以添加额外的逻辑
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
