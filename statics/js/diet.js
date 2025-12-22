// 全局变量
let mealCounter = 1; // 餐次计数器
let dietData = {}; // 存储饮食数据
let dietImagesMap = {}; // { mealId: [dataUrl,...] }

// 统一的保存状态管理函数
function initSaveState() {
    const saveBtn = document.querySelector('.global-save-btn');
    const spinner = document.getElementById('global-spinner');
    const btnText = saveBtn.querySelector('.btn-text');
    
    return {
        saveBtn,
        spinner,
        btnText,
        originalText: btnText.textContent
    };
}

function showSaveLoading(saveState, loadingText = '保存中...') {
    saveState.saveBtn.disabled = true;
    saveState.btnText.textContent = loadingText;
    saveState.spinner.classList.add('show');
}

function hideSaveLoading(saveState, originalText = null) {
    saveState.saveBtn.disabled = false;
    saveState.btnText.textContent = originalText || saveState.originalText;
    saveState.spinner.classList.remove('show');
}

// 震动反馈 - 使用统一的HapticManager
// HapticManager已在index.html中全局加载，这里直接使用即可

// 页面初始化
function initDietPage() {
    // 检查是否需要强制清除缓存（用于解决浏览器缓存问题）
    const forceClear = new URLSearchParams(window.location.search).get('clear');
    if (forceClear === 'true') {
        clearAllDietData();
        // 移除URL参数
        const url = new URL(window.location);
        url.searchParams.delete('clear');
        window.history.replaceState({}, '', url);
        return;
    }
    
    // 从本地存储加载已保存的数据
    loadDietData();

    // 初始化顶部日期默认值
    try {
        const dInput = document.getElementById('diet-record-date-input');
        if (dInput && !dInput.value) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            dInput.value = `${year}-${month}-${day}`;
        }
    } catch(_) {}

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

    // 初始化第一个餐次的图片上传按钮
    initDietImageUploadForMeal(1);

    // 使用输入框增强模块（优化键盘弹出和震动体验）
    if (window.InputEnhancement) {
        // 自动增强所有输入框，配置为聚焦时震动
        window.InputEnhancement.autoEnhance({
            hapticDelay: 50,        // 延迟震动，不干扰键盘
            hapticOnBlur: true,     // 输入完成时震动
            hapticOnInput: false    // 输入过程不震动
        });
        console.log('饮食记录 - 输入框增强已启用');
    } else {
        console.warn('饮食记录 - InputEnhancement 模块未加载');
    }

    console.log('饮食记录页面初始化完成');
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
// silent: true = 静默模式（加载数据时），不触发震动
function addNewMeal(silent = false) {
    // 🔧 修复：只在用户主动点击时震动，加载数据时不震动
    if (!silent) {
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Light');
        } catch(_) {}
    }

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
            <div class="image-upload-section">
                <h4 class="upload-title">上传图片</h4>
                <div class="image-upload-container">
                    <div class="image-upload-btn" id="dietImageUploadBtn-${mealId}">
                        <div class="upload-icon">+</div>
                        <div class="upload-text">(上传图片)</div>
                    </div>
                    <div class="uploaded-images" id="dietUploadedImages-${mealId}"></div>
                </div>
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

    // 初始化该餐次的图片上传
    initDietImageUploadForMeal(mealId);

    console.log(`添加新餐次: ${mealId}`);
}

// 删除餐次
async function deleteMeal(mealId) {
    // 使用统一的弹窗管理器
    if (!window.ModalManager) {
        console.error('ModalManager 未加载');
        return;
    }

    const confirmed = await window.ModalManager.confirmDelete(
        '确定要删除这个餐次记录吗？',
        {
            detail: '此操作无法撤销',
            onConfirm: () => {
                // 执行删除操作
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
            }
        }
    );
}

// 保存所有餐次数据
async function saveAllMeals() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

    // 统一的保存状态管理
    const saveState = initSaveState();
    showSaveLoading(saveState, '保存中...');

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
            const images = Array.isArray(dietImagesMap[mealId]) ? dietImagesMap[mealId] : [];

            // 检查是否有食物内容
            if (foodValue || images.length > 0) {
                const mealData = {
                    time: timeValue,
                    food: foodValue,
                    mealId: parseInt(mealId),
                    images
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
            await showMessage('请至少记录一餐的食物或上传图片', 'error');
            return;
        }

        // 如果有空的餐次，提醒用户
        if (emptyMeals.length > 0) {
            const emptyMealNumbers = emptyMeals.join('、');
            await showMessage(`第${emptyMealNumbers}餐没有输入食物内容，将跳过这些餐次`, 'warning');
        }

        // 保存到全局数据
        dietData = { ...dietData, ...allMealsData };

        // 保存到本地存储
        localStorage.setItem('health_diet_data', JSON.stringify(dietData));

        // 创建导出数据对象（顶部日期为整天记录归属）
        function getDietSelectedDate() {
            try {
                var el = document.getElementById('diet-record-date-input');
                var val = (el && el.value) ? el.value : '';
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
            } catch(_) {}
            var now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        const __dietSelectedDate = getDietSelectedDate();

        // 统一为每一餐补齐 date 与 timestamp（用于日常页严格按天展示）
        try {
            Object.keys(allMealsData).forEach((key) => {
                const meal = allMealsData[key] || {};
                const timeStr = String(meal.time || '00:00:00');
                const parts = timeStr.split(':');
                const hm = parts.length===2
                    ? (parts[0].padStart(2,'0')+':' + parts[1].padStart(2,'0')+':00')
                    : (parts[0].padStart(2,'0')+':' + (parts[1]||'00').padStart(2,'0')+':' + String(parts[2]||'00').padStart(2,'0'));
                meal.date = __dietSelectedDate;
                meal.timestamp = __dietSelectedDate + ' ' + hm;
                allMealsData[key] = meal;
            });
        } catch(_) {}
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
                recordTime: (function(){
                    // 选用首餐的时间作为 recordTime
                    try {
                        const first = Object.values(allMealsData)[0];
                        let hm = '00:00:00';
                        if (first && first.time) {
                            const parts = String(first.time).split(':');
                            hm = parts.length===2 ? (parts[0].padStart(2,'0')+':'+parts[1].padStart(2,'0')+':00') : (parts[0].padStart(2,'0')+':'+parts[1].padStart(2,'0')+':'+String(parts[2]||'00').padStart(2,'0'));
                        } else {
                            const n=new Date(); hm = String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');
                        }
                        return __dietSelectedDate + ' ' + hm;
                    } catch(_) {
                        return __dietSelectedDate + ' 00:00:00';
                    }
                })(),
                version: '1.0',
                appName: '紫癜精灵',
                dataType: 'diet_record'
            },
            dietData: allMealsData
        };

        // 获取身份：优先从本地缓存，缺失时调用 /readdata 补全
        const identity = await resolveUserIdentity();
        const user_id = identity.user_id || '';

        // 在上传前先检查是否是今天第一次提交
        let shouldShowAnimation = false;
        let preCheckResult = null;
        try {
            if (window.StreakCelebration && user_id) {
                preCheckResult = await window.StreakCelebration.checkFirstSubmissionToday(user_id);
                console.log('[diet] 上传前检查结果:', preCheckResult);
                if (preCheckResult && preCheckResult.isFirst && preCheckResult.newStreak > 0) {
                    shouldShowAnimation = true;
                    console.log('[diet] ✅ 确认是今天第一次提交，上传后将显示动画');
                } else {
                    console.log('[diet] ⚠️ 不是今天第一次提交，上传后不显示动画');
                }
            }
        } catch (error) {
            console.warn('[diet] 上传前检查失败:', error);
        }

        // 记录开始提交日志
        if (window.writeCheckinReminderLog) {
            window.writeCheckinReminderLog('log', `开始提交饮食数据（日期: ${__dietSelectedDate}，${validMealsCount}餐）`);
        }
        
        // 上传到后端数据库
        try {
            await uploadDietToServer(exportData);
            // 记录日志
            if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('log', `饮食数据提交成功（日期: ${__dietSelectedDate}，${validMealsCount}餐）`);
            }
            await showMessage(`成功保存 ${validMealsCount} 餐食物记录并上传云端！`, 'success');
            
            // 取消今天的打卡提醒并预约明天的提醒（如果用户已提交数据）
            // 必须在跳转前完成，否则页面跳转会中断执行
            if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('log', `========== 开始处理打卡提醒调度（日期: ${__dietSelectedDate}）==========`);
            }
            try {
                const todayStr = window.getTodayDateString ? window.getTodayDateString() : __dietSelectedDate;
                
                // 1. 先取消今天的提醒（优先使用 cancelCheckinReminderForDate，避免定时器冲突）
                if (window.cancelCheckinReminderForDate) {
                    if (window.writeCheckinReminderLog) {
                        window.writeCheckinReminderLog('log', `取消今天的打卡提醒（日期: ${todayStr}）`);
                    }
                    await window.cancelCheckinReminderForDate(todayStr);
                } else if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
                    // 后备方案：直接使用 LocalNotifications API 取消提醒
                    const LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
                    try {
                        const pending = await LocalNotifications.getPending();
                        const pendingNotifications = pending && pending.notifications ? pending.notifications : [];
                        const notificationsToCancel = pendingNotifications
                            .filter(n => n && n.extra && n.extra.type === 'checkin_reminder')
                            .map(n => ({ id: n.id }));
                        if (notificationsToCancel.length > 0) {
                            await LocalNotifications.cancel({ notifications: notificationsToCancel });
                            if (window.writeCheckinReminderLog) {
                                window.writeCheckinReminderLog('log', `✅ 已取消 ${notificationsToCancel.length} 个今天的打卡提醒`);
                            }
                        }
                    } catch (e) {
                        if (window.writeCheckinReminderLog) {
                            window.writeCheckinReminderLog('warn', `取消提醒失败: ${e.message || e}`);
                        }
                    }
                }
                
                // 2. 清除今天的提交状态缓存
                if (window.clearSubmissionCache) {
                    if (window.writeCheckinReminderLog) {
                        window.writeCheckinReminderLog('log', `清除提交状态缓存（日期: ${todayStr}）`);
                    }
                    window.clearSubmissionCache(todayStr);
                }
                
                // 3. 清除可能存在的延迟定时器（如果之前调用了 cancelCheckinReminderForToday）
                if (window.scheduleTimeout) {
                    clearTimeout(window.scheduleTimeout);
                    window.scheduleTimeout = null;
                    if (window.writeCheckinReminderLog) {
                        window.writeCheckinReminderLog('log', '已清除之前的延迟定时器');
                    }
                }
                
                // 4. 直接调用 scheduleCheckinReminder 预约明天的提醒
                // 因为数据已经上传成功，不需要等待延迟定时器
                if (window.scheduleCheckinReminder) {
                    if (window.writeCheckinReminderLog) {
                        window.writeCheckinReminderLog('log', '直接调用 scheduleCheckinReminder 预约明天的提醒');
                    }
                    // 等待一小段时间确保数据已同步到服务器（1秒应该足够）
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await window.scheduleCheckinReminder({ forceTodaySubmitted: true });
                    if (window.writeCheckinReminderLog) {
                        window.writeCheckinReminderLog('log', '✅ 提醒调度完成，明天的提醒已预约');
                        window.writeCheckinReminderLog('log', '========== 打卡完成后的提醒处理流程结束 ==========');
                    }
                } else {
                    if (window.writeCheckinReminderLog) {
                        window.writeCheckinReminderLog('warn', 'scheduleCheckinReminder 函数不存在，无法预约提醒');
                    }
                    console.warn('[diet] scheduleCheckinReminder 函数不存在');
                }
            } catch (error) {
                const errorMsg = `处理打卡提醒失败: ${error.message || error}`;
                console.warn('[diet]', errorMsg);
                if (window.writeCheckinReminderLog) {
                    window.writeCheckinReminderLog('error', errorMsg);
                    if (error.stack) {
                        window.writeCheckinReminderLog('error', `错误堆栈: ${error.stack}`);
                    }
                }
            }
            
            // 显示连胜庆祝动画（如果是今天第一次提交）
            let animationShown = false;
            try {
                if (window.StreakCelebration && user_id && shouldShowAnimation && preCheckResult) {
                    // 上传前已检查过，跳过后端检查，使用上传前检查的结果直接显示动画
                    const animationPromise = window.StreakCelebration.handleUploadSuccess(user_id, { 
                        skipBackendCheck: true,
                        checkResult: preCheckResult
                    });
                    if (animationPromise && animationPromise.then) {
                        // 如果返回了Promise，说明显示了动画，等待动画完成
                        animationShown = true;
                        await animationPromise;
                        console.log('[diet] 庆祝动画已完成');
                    }
                } else if (window.StreakCelebration && user_id) {
                    // 上传前未检查或检查失败，使用原来的逻辑
                    const animationPromise = window.StreakCelebration.handleUploadSuccess(user_id);
                    if (animationPromise && animationPromise.then) {
                        animationShown = true;
                        await animationPromise;
                        console.log('[diet] 庆祝动画已完成');
                    }
                }
            } catch (error) {
                console.warn('[diet] 显示庆祝动画失败:', error);
            }
            
            // 清除表单数据和本地存储
            clearAllDietData();
            try { localStorage.removeItem('health_record_data'); } catch(_) {}
            
            // 强制清除全局数据变量
            dietData = {};
            
            // 如果显示了动画，动画完成后立即跳转；否则等待1.5秒后跳转
            // 注意：跳转前确保 cancelCheckinReminderForToday 已完成（已在上面 await）
            if (!animationShown) {
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 1500);
            } else {
                // 动画已完成，立即跳转
                window.location.href = '../index.html';
            }
        } catch (uploadError) {
            console.warn('饮食记录上传失败:', uploadError);
            // 记录日志
            if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('warn', `饮食数据提交失败: ${uploadError.message || uploadError}`);
            }
            await showMessage(`已保存本地，云端上传失败`, 'warning');
        }

        // 成功保存的强震动反馈
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Heavy');
        } catch(_) {}

        console.log('保存所有餐次数据:', allMealsData);

    } catch (error) {
        console.error('保存数据失败:', error);
        // 记录日志
        if (window.writeCheckinReminderLog) {
            window.writeCheckinReminderLog('error', `饮食数据保存失败: ${error.message || error}`);
        }
        await showMessage('保存失败，请重试', 'error');
    } finally {
        // 恢复按钮状态
        setTimeout(() => {
            hideSaveLoading(saveState, '保存记录');
        }, 1500);
    }
}

// =========== 图片上传相关（与 metrics 保持一致的流程） ==========

function initDietImageUploadForMeal(mealId) {
    // 🔧 移除初始化时的震动（只应在点击时震动）
    const btn = document.getElementById(`dietImageUploadBtn-${mealId}`);
    if (!btn) return;
    btn.addEventListener('click', async function() {
        // 点击上传按钮时的震动反馈
        try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}
        
        try {
            // 权限（原生时）
            const permissions = await window.cameraUtils.checkPermissions();
            if (permissions.camera === 'denied' || permissions.photos === 'denied') {
                const newPermissions = await window.cameraUtils.requestPermissions();
                if (newPermissions.camera === 'denied' || newPermissions.photos === 'denied') {
                    await showMessage('需要相机和相册权限才能上传图片', 'error');
                    return;
                }
            }

            await window.cameraUtils.showImageOptions(
                (dataUrl) => handleDietImageDataUrl(mealId, dataUrl),
                async (err) => await showMessage('图片选择失败: ' + err, 'error')
            );
        } catch (e) {
            console.error('[diet] 图片选择异常:', e);
            await showMessage('图片上传失败: ' + (e?.message || e), 'error');
        }
    });
}

async function handleDietImageDataUrl(mealId, dataUrl) {
    showDietCompressionProgress('图片处理中...');
    
    try {
        const file = await dataURLToFile(dataUrl, `diet-image-${mealId}.jpg`);
        
        // 检查文件大小（原始文件不超过10MB）
        const maxOriginalSizeMB = 10;
        if (file.size > maxOriginalSizeMB * 1024 * 1024) {
            hideDietCompressionProgress();
            await showMessage(`图片文件过大，请选择小于${maxOriginalSizeMB}MB的图片`, 'error');
            return;
        }
        
        const compressedDataUrl = await compressImagePromise(file, 500);
        
        // 上传图片到服务器
        const imageUrl = await uploadDietImageToServer(compressedDataUrl, 'diet');
        
        hideDietCompressionProgress();
        addDietImageToMeal(mealId, imageUrl, file.name);
        
        // 图片上传成功时的震动反馈
        try { window.__hapticImpact__ && window.__hapticImpact__('Medium'); } catch(_) {}
        
        // 显示上传成功信息
        const originalSizeKB = (file.size / 1024).toFixed(1);
        const compressedSizeKB = ((compressedDataUrl.length * 0.75) / 1024).toFixed(1);
        const compressionRatio = ((1 - compressedDataUrl.length * 0.75 / file.size) * 100).toFixed(1);
        
        await showMessage(`图片上传成功！原始: ${originalSizeKB}KB → 压缩后: ${compressedSizeKB}KB (压缩率: ${compressionRatio}%)`, 'success');
    } catch (error) {
        hideDietCompressionProgress();
        await showMessage('图片处理失败: ' + (error?.message || error), 'error');
    }
}

// 复用 metrics 中的方法（复制轻量实现，避免依赖）
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

// 压缩图片的Promise版本
function compressImagePromise(file, maxSizeKB = 500) {
    return new Promise((resolve, reject) => {
        compressImage(file, resolve, reject, maxSizeKB);
    });
}

// 上传饮食图片到服务器
async function uploadDietImageToServer(imageData, imageType) {
    try {
        // 获取用户身份信息
        const identity = await resolveUserIdentity();
        const user_id = identity.user_id || '';
        const username = identity.username || '';

        if (!user_id) {
            throw new Error('无法获取用户ID');
        }

        // 构建请求数据
        const payload = {
            user_id: user_id,
            username: username,
            image_data: imageData,
            image_type: imageType
        };

        // 获取API基础URL
        var API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
        if (API_BASE && API_BASE.endsWith('/')) API_BASE = API_BASE.slice(0, -1);

        // 发送上传请求
        const response = await fetch(API_BASE + '/upload_image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || '图片上传失败');
        }

        // 返回完整的图片URL
        const imageUrl = result.data.image_url;
        return imageUrl.startsWith('http') ? imageUrl : API_BASE + imageUrl;
    } catch (error) {
        console.error('上传饮食图片失败:', error);
        throw error;
    }
}

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

function addDietImageToMeal(mealId, imageSrc, fileName) {
    if (!dietImagesMap[mealId]) dietImagesMap[mealId] = [];
    dietImagesMap[mealId].push(imageSrc);
    const container = document.getElementById(`dietUploadedImages-${mealId}`);
    if (!container) return;
    const item = document.createElement('div');
    item.className = 'uploaded-image-item';
    const img = document.createElement('img');
    img.src = imageSrc; img.alt = fileName || '';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image-btn';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = function() {
        // 删除图片时的震动反馈 - 使用Heavy表示删除操作
        try { window.__hapticImpact__ && window.__hapticImpact__('Heavy'); } catch(_) {}
        
        item.remove();
        dietImagesMap[mealId] = (dietImagesMap[mealId] || []).filter(u => u !== imageSrc);
    };
    item.appendChild(img); item.appendChild(removeBtn); container.appendChild(item);
    item.style.opacity = '0'; item.style.transform = 'scale(0.8)';
    setTimeout(()=>{ item.style.transition='all 0.3s ease'; item.style.opacity='1'; item.style.transform='scale(1)'; },10);
}

function showDietCompressionProgress(fileName) {
    const html = `
        <div class="diet-compression-progress" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: #fff; padding: 20px 30px; border-radius: 12px; z-index: 10000; text-align: center; backdrop-filter: blur(8px);">
            <div style="margin-bottom: 12px;"><div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div></div>
            <div style="font-size: 0.9rem; color: #ccc;">正在压缩图片...</div>
            <div style="font-size: 0.8rem; color: #999; margin-top: 4px;">${fileName}</div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function hideDietCompressionProgress() {
    const el = document.querySelector('.diet-compression-progress');
    if (el) el.remove();
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

            // 重置图片映射
            dietImagesMap = {};

            // 重新创建餐次
            sortedMeals.forEach((mealData, index) => {
                if (index === 0) {
                    // 更新第一个餐次
                    fillMealData(1, mealData);
                } else {
                    // 添加新的餐次（静默模式，不震动）
                    addNewMeal(true);
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
        // 恢复图片
        if (Array.isArray(data.images) && data.images.length > 0) {
            data.images.forEach(src => addDietImageToMeal(mealId.toString(), src, ''));
        }
    } catch (error) {
        console.error(`填充餐次${mealId}数据失败:`, error);
    }
}

// 保存饮食数据到本地存储
function saveDietData() {
    try {
        // 从DOM收集当前表单与图片（便于中途离开也能恢复）
        const mealRecords = document.querySelectorAll('.meal-record');
        const draft = {};
        mealRecords.forEach((el) => {
            const mealId = el.dataset.mealId;
            const timeValue = document.getElementById(`time-${mealId}`)?.value || '';
            const foodValue = document.getElementById(`food-${mealId}`)?.value?.trim() || '';
            const images = Array.isArray(dietImagesMap[mealId]) ? dietImagesMap[mealId] : [];
            if (timeValue || foodValue || images.length > 0) {
                draft[`meal_${mealId}`] = { time: timeValue, food: foodValue, mealId: parseInt(mealId), images };
            }
        });
        localStorage.setItem('health_diet_data', JSON.stringify(draft));
    } catch (error) {
        console.error('保存饮食数据到本地存储失败:', error);
    }
}

/**
 * 显示提示弹窗（使用统一的弹窗管理器）
 * @param {string} message - 提示消息
 * @param {string} type - 弹窗类型 ('success' | 'error' | 'warning' | 'info')，默认为 'info'
 * @param {string} title - 弹窗标题，如果不提供则根据 type 自动设置
 * @returns {Promise<void>}
 */
async function showMessage(message, type = 'info', title = null) {
    if (window.ModalManager && window.ModalManager.alert) {
        // 根据类型选择按钮样式
        let confirmType = 'primary';
        if (type === 'error' || type === 'danger') {
            confirmType = 'danger';
        }
        
        // 根据类型设置标题
        let alertTitle = title;
        if (!alertTitle) {
            switch(type) {
                case 'success':
                    alertTitle = '成功';
                    break;
                case 'error':
                    alertTitle = '错误';
                    break;
                case 'warning':
                    alertTitle = '警告';
                    break;
                default:
                    alertTitle = '提示';
            }
        }
        
        return window.ModalManager.alert(message, {
            title: alertTitle,
            confirmText: '我知道了',
            confirmType: confirmType
        });
    } else {
        // 降级处理：如果 ModalManager 未加载，使用原生 alert
        alert(message);
        return Promise.resolve();
    }
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
            // 记录日志
            if (window.writeCheckinReminderLog) {
                window.writeCheckinReminderLog('warn', `饮食数据上传失败: ${result.message || '未知错误'}`);
            }
            throw new Error(result.message || '上传失败');
        }
    } catch (error) {
        console.warn('[diet] 上传饮食数据异常:', error);
        // 记录日志
        if (window.writeCheckinReminderLog) {
            window.writeCheckinReminderLog('error', `饮食数据上传异常: ${error.message || error}`);
        }
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
                    // 清除第一餐图片
                    const firstImages = record.querySelector(`#dietUploadedImages-1`);
                    if (firstImages) firstImages.innerHTML = '';
                }
            });
            
            // 隐藏第一个餐次的删除按钮
            const firstDeleteBtn = dietContainer.querySelector('.delete-meal-btn');
            if (firstDeleteBtn) {
                firstDeleteBtn.style.display = 'none';
            }
        }
        
        // 重置餐次计数器
        mealCounter = 1;
        
        // 清除本地存储
        localStorage.removeItem('health_diet_data');
        
        // 强制清除全局数据变量
        dietData = {};
        dietImagesMap = {};
        
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
        // ESC键返回上一页（弹窗管理器会自动处理ESC键）
        goBack();
    }
});

// 页面离开前保存数据
window.addEventListener('beforeunload', function() {
    saveDietData();
});
