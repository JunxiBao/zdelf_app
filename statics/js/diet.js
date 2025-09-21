// 全局变量
let mealCounter = 1; // 餐次计数器
let dietData = {}; // 存储饮食数据
let pendingDeleteMealId = null; // 待删除的餐次ID

// 震动反馈初始化（兼容性处理）
(function() {
  'use strict';
  // 如果全局震动反馈不存在，提供fallback实现
  if (!window.__hapticImpact__) {
    var isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
    function getHaptics() {
      var C = window.Capacitor || {};
      return (C.Plugins && C.Plugins.Haptics) || window.Haptics || C.Haptics || null;
    }
    window.__hapticImpact__ = function(style){
      if (!isNative) return;
      var h = getHaptics();
      if (!h) return;
      try { h.impact && h.impact({ style: style }); } catch(_) {}
    };
  }
})();

// 页面初始化
function initDietPage() {
    // 从本地存储加载已保存的数据
    loadDietData();

    // 为第一个餐次设置默认时间
    setDefaultTimeForFirstMeal();

    // 为现有按钮添加事件监听器
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function(e) {
            attachButtonRipple(this);
        });
    }

    const addBtn = document.querySelector('.add-meal-btn');
    if (addBtn) {
        addBtn.addEventListener('click', function(e) {
            attachButtonRipple(this);
        });
    }

    console.log('食物记录页面初始化完成');
}

// 为第一个餐次设置默认时间
function setDefaultTimeForFirstMeal() {
    const firstTimeInput = document.getElementById('time-1');
    if (firstTimeInput && !firstTimeInput.value) {
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 5); // HH:MM 格式
        firstTimeInput.value = timeString;
    }
}

// 返回上一页
function goBack() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

    // 保存当前数据到本地存储
    saveDietData();

    // 返回到选项页面
    window.location.href = 'options.html';
}

// 添加新餐次
function addNewMeal() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

    mealCounter++;
    const mealId = mealCounter;

    // 创建新的餐次HTML
    const mealHTML = `
        <div class="meal-record" data-meal-id="${mealId}" style="animation: fadeInUp 0.5s ease-out;">
            <div class="meal-header">
                <div class="meal-time">
                    <label for="time-${mealId}">时间</label>
                    <input type="time" id="time-${mealId}" class="time-input">
                </div>
            </div>
            <div class="meal-content">
                <textarea id="food-${mealId}" placeholder="记录您摄入的食物..." rows="4"></textarea>
            </div>
            <div class="meal-actions">
                <button class="delete-meal-btn" onclick="deleteMeal(${mealId})">删除</button>
            </div>
        </div>
    `;

    // 添加到容器中（在添加按钮之前）
    const dietContainer = document.querySelector('.diet-container');
    const addButton = dietContainer.querySelector('.add-meal-btn');
    addButton.insertAdjacentHTML('beforebegin', mealHTML);

    // 设置当前时间为默认值
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5); // HH:MM 格式
    document.getElementById(`time-${mealId}`).value = timeString;

    // 显示删除按钮（除了第一个餐次）
    if (mealCounter > 1) {
        document.querySelector('.delete-meal-btn[style*="display: none"]').style.display = 'block';
    }

    console.log(`添加新餐次: ${mealId}`);
}

// 删除餐次
function deleteMeal(mealId) {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Heavy');
    } catch(_) {}

    // 显示自定义确认弹窗
    pendingDeleteMealId = mealId;
    showDeleteModal();
}

// 显示删除确认弹窗
function showDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.classList.add('show');

    // 添加遮罩层点击关闭功能
    const overlay = modal.querySelector('.delete-modal-overlay');
    overlay.onclick = cancelDelete;

    // 添加ESC键关闭功能
    document.addEventListener('keydown', handleModalKeydown);
}

// 隐藏删除确认弹窗
function hideDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('show');
    pendingDeleteMealId = null;

    // 移除事件监听器
    document.removeEventListener('keydown', handleModalKeydown);
}

// 取消删除
function cancelDelete() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

    hideDeleteModal();
}

// 确认删除
function confirmDelete() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Heavy');
    } catch(_) {}

    if (pendingDeleteMealId === null) return;

    const mealId = pendingDeleteMealId;
    const mealElement = document.querySelector(`[data-meal-id="${mealId}"]`);

    if (mealElement) {
        // 添加删除动画
        mealElement.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            mealElement.remove();

            // 如果只剩一个餐次，隐藏删除按钮
            const remainingMeals = document.querySelectorAll('.meal-record');
            if (remainingMeals.length === 1) {
                const deleteBtn = remainingMeals[0].querySelector('.delete-meal-btn');
                if (deleteBtn) {
                    deleteBtn.style.display = 'none';
                }
            }

            console.log(`删除餐次: ${mealId}`);
        }, 300);
    }

    hideDeleteModal();
}

// 处理弹窗键盘事件
function handleModalKeydown(event) {
    if (event.key === 'Escape') {
        cancelDelete();
    } else if (event.key === 'Enter') {
        confirmDelete();
    }
}

// 保存所有餐次数据
async function saveAllMeals() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

    const saveBtn = document.querySelector('.save-btn');
    const spinner = document.getElementById('save-spinner');
    const btnText = saveBtn.querySelector('.btn-text');

    // 禁用按钮并显示保存中状态
    const originalText = btnText.textContent;
    saveBtn.disabled = true;
    btnText.textContent = '保存中...';
    spinner.classList.add('show');

    try {
        let allMealsData = {};
        let validMealsCount = 0;

        // 收集所有餐次数据
        const mealRecords = document.querySelectorAll('.meal-record');
        const emptyMeals = []; // 记录空的餐次

        mealRecords.forEach((mealElement, index) => {
            const mealId = mealElement.dataset.mealId;
            const timeValue = document.getElementById(`time-${mealId}`).value;
            const foodValue = document.getElementById(`food-${mealId}`).value.trim();

            // 检查是否有食物内容
            if (foodValue) {
                const mealData = {
                    time: timeValue,
                    food: foodValue,
                    mealId: parseInt(mealId)
                };

                allMealsData[`meal_${mealId}`] = mealData;
                validMealsCount++;
            } else {
                // 记录空的餐次
                emptyMeals.push(parseInt(mealId));
            }
        });

        // 验证输入
        if (validMealsCount === 0) {
            showToast('请至少记录一餐的食物信息');
            return;
        }

        // 如果有空的餐次，提醒用户
        if (emptyMeals.length > 0) {
            const emptyMealNumbers = emptyMeals.join('、');
            showToast(`第${emptyMealNumbers}餐没有输入食物内容，将跳过这些餐次`);
        }

        // 保存到全局数据
        dietData = { ...dietData, ...allMealsData };

        // 保存到本地存储
        localStorage.setItem('health_diet_data', JSON.stringify(dietData));

        // 创建导出数据对象
        const exportData = {
            exportInfo: {
                exportTime: new Date().toLocaleString('zh-CN', { 
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }),
                version: '1.0',
                appName: '紫癜精灵',
                dataType: 'diet_record'
            },
            dietData: allMealsData
        };

        // 上传到后端数据库
        try {
            await uploadDietToServer(exportData);
            showToast(`成功保存 ${validMealsCount} 餐食物记录并上传云端！`);
            
            // 清除表单数据
            clearAllDietData();
            
            // 跳转到daily页面
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 1500);
        } catch (uploadError) {
            console.warn('饮食记录上传失败:', uploadError);
            showToast(`已保存本地，云端上传失败`);
        }

        // 成功保存的强震动反馈
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Heavy');
        } catch(_) {}

        console.log('保存所有餐次数据:', allMealsData);

    } catch (error) {
        console.error('保存数据失败:', error);
        showToast('保存失败，请重试');
    } finally {
        // 恢复按钮状态
        setTimeout(() => {
            btnText.textContent = originalText;
            saveBtn.disabled = false;
            spinner.classList.remove('show');
        }, 1500);
    }
}

// 从本地存储加载数据
function loadDietData() {
    try {
        const storedData = localStorage.getItem('health_diet_data');
        if (storedData) {
            dietData = JSON.parse(storedData);

            // 按mealId排序并重新创建餐次
            const sortedMeals = Object.values(dietData)
                .sort((a, b) => a.mealId - b.mealId);

            // 清除现有餐次（保留第一个）
            const mealRecords = document.querySelectorAll('.meal-record');
            for (let i = 1; i < mealRecords.length; i++) {
                mealRecords[i].remove();
            }

            // 重新创建餐次
            sortedMeals.forEach((mealData, index) => {
                if (index === 0) {
                    // 更新第一个餐次
                    fillMealData(1, mealData);
                } else {
                    // 添加新的餐次
                    addNewMeal();
                    fillMealData(mealData.mealId, mealData);
                }
            });

            // 更新计数器
            const maxMealId = Math.max(...Object.values(dietData).map(m => m.mealId));
            mealCounter = maxMealId;

            console.log('加载已保存的饮食数据:', dietData);
        }
    } catch (error) {
        console.error('加载饮食数据失败:', error);
    }
}

// 填充餐次数据
function fillMealData(mealId, data) {
    try {
        if (data.time) {
            document.getElementById(`time-${mealId}`).value = data.time;
        }
        if (data.food) {
            document.getElementById(`food-${mealId}`).value = data.food;
        }
    } catch (error) {
        console.error(`填充餐次${mealId}数据失败:`, error);
    }
}

// 保存饮食数据到本地存储
function saveDietData() {
    try {
        localStorage.setItem('health_diet_data', JSON.stringify(dietData));
    } catch (error) {
        console.error('保存饮食数据到本地存储失败:', error);
    }
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

// 为按钮添加涟漪效果
function attachButtonRipple(btn) {
    if (!btn) return;

    // 清除之前的涟漪效果
    const existingRipple = btn.querySelector('.btn-ripple');
    if (existingRipple) {
        existingRipple.remove();
    }

    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    ripple.style.left = "50%";
    ripple.style.top = "50%";
    ripple.style.transform = "translate(-50%, -50%)";
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }

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

    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
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

// 解析用户身份：本地缓存优先，不足则通过 /readdata 查询
async function resolveUserIdentity() {
    // 1) 本地 user_profile
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('user_profile') || 'null'); } catch(_) { cached = null; }

    let user_id = '';
    let username = '';

    if (cached) {
        user_id = (cached.user_id || cached.id || '').toString();
        // 忽略缓存中的 username，统一通过 user_id 查询服务端获取
    }

    // 2) 与 me.js 保持一致：优先从 localStorage/sessionStorage 读取 userId/UserID
    try {
        const storedId =
          localStorage.getItem('userId') ||
          sessionStorage.getItem('userId') ||
          localStorage.getItem('UserID') ||
          sessionStorage.getItem('UserID') || '';
        if (storedId) {
            user_id = storedId.toString();
        }
    } catch(_) {}

    // 3) 如果 user_id 存在，通过 /readdata 获取 username
    if (user_id) {
        try {
            var API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
            if (API_BASE && API_BASE.endsWith('/')) API_BASE = API_BASE.slice(0, -1);
            
            const resp = await fetch(API_BASE + '/readdata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id })
            });
            if (resp.ok) {
                const data = await resp.json();
                if (data.success && data.data && data.data.username) {
                    username = data.data.username;
                } else {
                    console.warn('[diet] /readdata 返回数据格式异常:', data);
                }
            } else {
                console.warn('[diet] /readdata 请求失败:', resp.status, resp.statusText);
            }
        } catch (e) {
            console.warn('[diet] 通过 user_id 调用 /readdata 失败:', e);
        }
        // 查询失败时，至少返回 user_id，username 留空
        return { user_id, username: '' };
    }

    // 兜底为空
    return { user_id: '', username: '' };
}

// 上传饮食数据到服务器
async function uploadDietToServer(exportData) {
    try {
        // 获取用户身份信息 - 使用与metrics.js相同的函数
        const identity = await resolveUserIdentity();
        const user_id = identity.user_id || '';
        const username = identity.username || '';

        if (!user_id) {
            console.warn('[diet] 无法获取用户ID，跳过服务器上传');
            return;
        }

        // 构建payload - 使用与metrics.js相同的格式
        const payload = {
            exportInfo: {
                exportTime: new Date().toLocaleString('zh-CN', { 
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                }),
                version: '1.0',
                appName: '紫癜精灵',
                dataType: 'diet_record'
            },
            dietData: exportData.dietData
        };

        console.log('[diet] 上传数据到服务器:', { user_id, username, payload });

        // 上传到后端 - 使用与metrics.js相同的API地址和格式
        var API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
        if (API_BASE && API_BASE.endsWith('/')) API_BASE = API_BASE.slice(0, -1);
        
        const response = await fetch(API_BASE + '/uploadjson/diet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id, username, payload })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.success) {
            console.log('[diet] 饮食数据上传成功:', result);
        } else {
            console.warn('[diet] 饮食数据上传失败:', result.message);
            throw new Error(result.message || '上传失败');
        }
    } catch (error) {
        console.warn('[diet] 上传饮食数据异常:', error);
        throw error; // 重新抛出异常，让调用者处理
    }
}

// 清除所有饮食记录表单数据
function clearAllDietData() {
    try {
        // 清除所有餐次记录
        const dietContainer = document.querySelector('.diet-container');
        if (dietContainer) {
            // 保留第一个餐次记录，清除其他所有餐次
            const mealRecords = dietContainer.querySelectorAll('.meal-record');
            mealRecords.forEach((record, index) => {
                if (index > 0) {
                    // 删除除第一个之外的所有餐次
                    record.remove();
                } else {
                    // 清除第一个餐次的内容
                    const timeInput = record.querySelector('.time-input');
                    const foodTextarea = record.querySelector('textarea');
                    if (timeInput) timeInput.value = '';
                    if (foodTextarea) foodTextarea.value = '';
                }
            });
        }
        
        // 清除本地存储
        localStorage.removeItem('health_diet_data');
        
        console.log('所有饮食记录表单数据已清除');
    } catch (error) {
        console.error('清除饮食记录表单数据失败:', error);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initDietPage);

// 支持键盘导航
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // 如果弹窗正在显示，关闭弹窗；否则返回上一页
        const modal = document.getElementById('delete-modal');
        if (modal.classList.contains('show')) {
            cancelDelete();
        } else {
            goBack();
        }
    }
});

// 页面离开前保存数据
window.addEventListener('beforeunload', function() {
    saveDietData();
});
