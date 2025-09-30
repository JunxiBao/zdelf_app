/**
 * calendar.js - Calendar page functionality
 * 日历页面功能实现
 */

(function() {
    'use strict';

    // 震动反馈初始化（兼容性处理）
    if (!window.__hapticImpact__) {
        var isNative = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
        function getHaptics() {
            var C = window.Capacitor || {};
            return (C.Plugins && C.Plugins.Haptics) || window.Haptics || C.Haptics || null;
        }
        function isVibrationEnabled(){
            try{
                var v = localStorage.getItem('vibration_enabled');
                return v === null ? true : v === 'true';
            }catch(_){ return true; }
        }
        window.__hapticImpact__ = function(style){
            if (!isVibrationEnabled()) return;
            if (!isNative) {
                // 在非原生环境中，尝试使用Web Vibration API作为fallback
                if (navigator.vibrate) {
                    const patterns = {
                        'Light': 50,
                        'Medium': 100,
                        'Heavy': 200
                    };
                    navigator.vibrate(patterns[style] || 50);
                    console.log(`🔔 振动反馈: ${style} (${patterns[style] || 50}ms)`);
                }
                return;
            }
            var h = getHaptics();
            if (!h) return;
            try { 
                h.impact && h.impact({ style: style }); 
                console.log(`🔔 原生振动反馈: ${style}`);
            } catch(_) {}
        };
    }

    // 月份名称
    const monthNames = [
        '一月', '二月', '三月', '四月', '五月', '六月',
        '七月', '八月', '九月', '十月', '十一月', '十二月'
    ];

    // 当前显示的年月
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth();
    let selectedDate = null;
    
    // 症状数据缓存
    let monthlySymptomData = {};
    
    // 默认症状类型到颜色的映射 - 优化为在浅色和深色模式下都清晰可见
    const DEFAULT_SYMPTOM_COLORS = {
        0: null,                    // 无症状 - 不高亮
        1: '#FEE2E2',              // 皮肤型紫癜 - 深红色背景
        2: '#DBEAFE',              // 关节型紫癜 - 深蓝色背景  
        3: '#FEF3C7',              // 腹型紫癜 - 深黄色背景
        4: '#D1FAE5',              // 肾型紫癜 - 深绿色背景
        5: '#E0E7FF'               // 其他症状 - 深紫色背景
    };
    
    // 当前使用的症状颜色（可自定义）
    let SYMPTOM_COLORS = { ...DEFAULT_SYMPTOM_COLORS };
    
    // 症状类型名称
    const SYMPTOM_NAMES = {
        0: '无症状',
        1: '皮肤型紫癜',
        2: '关节型紫癜', 
        3: '腹型紫癜',
        4: '肾型紫癜',
        5: '其他症状'
    };

    // DOM 元素
    let yearElement, monthElement, calendarGrid, selectedDateText;
    let prevMonthBtn, nextMonthBtn, backBtn, colorSettingsBtn;
    
    /**
     * 加载用户自定义颜色配置
     */
    function loadCustomColors() {
        try {
            const savedColors = localStorage.getItem('calendar_symptom_colors');
            if (savedColors) {
                const customColors = JSON.parse(savedColors);
                SYMPTOM_COLORS = { ...DEFAULT_SYMPTOM_COLORS, ...customColors };
                console.log('✅ 加载用户自定义颜色:', SYMPTOM_COLORS);
                return true;
            }
        } catch (e) {
            console.warn('加载自定义颜色失败:', e);
        }
        return false;
    }
    
    /**
     * 保存用户自定义颜色配置
     */
    function saveCustomColors() {
        try {
            const customColors = {};
            for (let key in SYMPTOM_COLORS) {
                if (SYMPTOM_COLORS[key] !== DEFAULT_SYMPTOM_COLORS[key]) {
                    customColors[key] = SYMPTOM_COLORS[key];
                }
            }
            localStorage.setItem('calendar_symptom_colors', JSON.stringify(customColors));
            console.log('✅ 保存自定义颜色配置:', customColors);
            return true;
        } catch (e) {
            console.error('保存自定义颜色失败:', e);
            return false;
        }
    }
    
    /**
     * 重置所有颜色到默认值
     */
    function resetAllColors() {
        SYMPTOM_COLORS = { ...DEFAULT_SYMPTOM_COLORS };
        try {
            localStorage.removeItem('calendar_symptom_colors');
            console.log('✅ 重置所有颜色到默认值');
            return true;
        } catch (e) {
            console.error('重置颜色失败:', e);
            return false;
        }
    }
    
    /**
     * 更新症状图例的颜色显示
     */
    function updateSymptomLegend() {
        const legendItems = document.querySelectorAll('.legend-color');
        const symptomCodes = [1, 2, 3, 4, 5]; // 对应图例中的症状顺序
        
        legendItems.forEach((item, index) => {
            if (index < symptomCodes.length) {
                const symptomCode = symptomCodes[index];
                const color = SYMPTOM_COLORS[symptomCode];
                if (color) {
                    item.style.backgroundColor = color;
                }
            }
        });
    }

    /**
     * 显示加载动画
     */
    function showLoadingAnimation(customText = '正在加载日历数据...') {
        const loadingOverlay = document.getElementById('calendar-loading-overlay');
        const loadingText = document.querySelector('.calendar-loading-text');
        
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
            loadingOverlay.classList.remove('hidden');
            
            // 更新加载文本
            if (loadingText) {
                loadingText.textContent = customText;
            }
        }
    }
    
    /**
     * 隐藏加载动画
     */
    function hideLoadingAnimation() {
        const loadingOverlay = document.getElementById('calendar-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }
    }
    
    /**
     * 初始化日历
     */
    function initCalendar() {
        // 显示加载动画
        showLoadingAnimation();
        
        // 获取DOM元素
        yearElement = document.getElementById('current-year');
        monthElement = document.getElementById('current-month');
        calendarGrid = document.getElementById('calendar-grid');
        selectedDateText = document.getElementById('selected-date-text');
        prevMonthBtn = document.getElementById('prev-month');
        nextMonthBtn = document.getElementById('next-month');
        backBtn = document.getElementById('back-btn');
        colorSettingsBtn = document.getElementById('color-settings-btn');

        if (!yearElement || !monthElement || !calendarGrid || !selectedDateText) {
            console.error('❌ 日历页面DOM元素未找到');
            return;
        }

        // 绑定事件监听器
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                addHapticFeedback('Light');
                navigateMonth(-1);
            });
        }

        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                addHapticFeedback('Light');
                navigateMonth(1);
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                addHapticFeedback('Medium');
                goBack();
            });
        }

        if (colorSettingsBtn) {
            colorSettingsBtn.addEventListener('click', () => {
                addHapticFeedback('Light');
                openColorSettingsModal();
            });
            
            // 添加键盘导航支持
            colorSettingsBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    addHapticFeedback('Light');
                    openColorSettingsModal();
                }
            });
            
        }

        // 加载用户自定义颜色
        loadCustomColors();
        
        // 初始化颜色设置弹窗
        initColorSettingsModal();
        
        // 初始化显示
        updateCalendarDisplay();
        
        // 更新症状图例颜色
        updateSymptomLegend();
        
        console.log('✅ 日历初始化完成');
    }
    
    /**
     * 初始化颜色设置弹窗
     */
    function initColorSettingsModal() {
        const modal = document.getElementById('color-settings-modal');
        const closeBtn = document.getElementById('close-color-modal');
        const saveBtn = document.getElementById('save-colors');
        const resetAllBtn = document.getElementById('reset-all-colors');
        
        if (!modal) return;
        
        // 关闭弹窗事件
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                addHapticFeedback('Light');
                closeColorSettingsModal();
            });
        }
        
        // 点击背景关闭弹窗
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                addHapticFeedback('Light');
                closeColorSettingsModal();
            }
        });
        
        // 保存颜色设置
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                addHapticFeedback('Medium');
                saveColorSettings();
            });
        }
        
        // 重置所有颜色
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => {
                addHapticFeedback('Medium');
                resetAllColorSettings();
            });
        }
        
        // 初始化颜色选择器
        initColorPickers();
    }
    
    /**
     * 初始化颜色选择器
     */
    function initColorPickers() {
        const colorPickers = document.querySelectorAll('.color-picker');
        const resetButtons = document.querySelectorAll('.reset-color-btn');
        
        // 设置初始颜色值
        colorPickers.forEach(picker => {
            const symptomCode = picker.dataset.symptom;
            const currentColor = SYMPTOM_COLORS[symptomCode];
            if (currentColor) {
                picker.value = currentColor;
            }
            
            // 颜色变化事件
            picker.addEventListener('change', (e) => {
                addHapticFeedback('Light');
                const newColor = e.target.value;
                SYMPTOM_COLORS[symptomCode] = newColor;
                console.log(`🎨 症状${symptomCode}颜色更新为: ${newColor}`);
            });
        });
        
        // 重置单个颜色按钮
        resetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                addHapticFeedback('Light');
                const symptomCode = btn.dataset.symptom;
                const defaultColor = DEFAULT_SYMPTOM_COLORS[symptomCode];
                
                SYMPTOM_COLORS[symptomCode] = defaultColor;
                
                // 更新颜色选择器显示
                const picker = document.querySelector(`[data-symptom="${symptomCode}"]`);
                if (picker && defaultColor) {
                    picker.value = defaultColor;
                }
                
                console.log(`🔄 症状${symptomCode}颜色重置为默认: ${defaultColor}`);
            });
        });
    }
    
    /**
     * 打开颜色设置弹窗
     */
    function openColorSettingsModal() {
        const modal = document.getElementById('color-settings-modal');
        if (modal) {
            // 更新颜色选择器的当前值
            const colorPickers = document.querySelectorAll('.color-picker');
            colorPickers.forEach(picker => {
                const symptomCode = picker.dataset.symptom;
                const currentColor = SYMPTOM_COLORS[symptomCode];
                if (currentColor) {
                    picker.value = currentColor;
                }
            });
            
            modal.style.display = 'flex';
            console.log('🎨 打开颜色设置弹窗');
        }
    }
    
    /**
     * 关闭颜色设置弹窗
     */
    function closeColorSettingsModal() {
        const modal = document.getElementById('color-settings-modal');
        if (modal) {
            modal.style.display = 'none';
            console.log('❌ 关闭颜色设置弹窗');
        }
    }
    
    /**
     * 保存颜色设置
     */
    function saveColorSettings() {
        if (saveCustomColors()) {
            // 更新日历显示
            updateCalendarDisplay();
            // 更新症状图例
            updateSymptomLegend();
            // 关闭弹窗
            closeColorSettingsModal();
            
            // 显示成功提示
            showColorToast('颜色设置已保存！', 'success');
        } else {
            showColorToast('保存失败，请重试', 'error');
        }
    }
    
    /**
     * 重置所有颜色设置
     */
    function resetAllColorSettings() {
        if (resetAllColors()) {
            // 更新颜色选择器显示
            const colorPickers = document.querySelectorAll('.color-picker');
            colorPickers.forEach(picker => {
                const symptomCode = picker.dataset.symptom;
                const defaultColor = DEFAULT_SYMPTOM_COLORS[symptomCode];
                if (defaultColor) {
                    picker.value = defaultColor;
                }
            });
            
            // 更新日历显示
            updateCalendarDisplay();
            // 更新症状图例
            updateSymptomLegend();
            
            // 显示成功提示
            showColorToast('已恢复默认颜色！', 'success');
        } else {
            showColorToast('重置失败，请重试', 'error');
        }
    }
    
    /**
     * 显示颜色设置提示
     */
    function showColorToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'color-toast';
        toast.textContent = message;
        
        // 设置样式
        toast.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1001;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: colorToastSlideIn 0.3s ease;
        `;
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes colorToastSlideIn {
                from { opacity: 0; transform: translate(-50%, -20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
            @keyframes colorToastSlideOut {
                from { opacity: 1; transform: translate(-50%, 0); }
                to { opacity: 0; transform: translate(-50%, -20px); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(toast);
        
        // 3秒后移除
        setTimeout(() => {
            toast.style.animation = 'colorToastSlideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(toast);
                document.head.removeChild(style);
            }, 300);
        }, 3000);
    }

    /**
     * 导航到上/下个月
     */
    function navigateMonth(direction) {
        // 显示加载动画，使用月份切换专用文本
        const directionText = direction > 0 ? '下个月' : '上个月';
        showLoadingAnimation(`正在切换到${directionText}...`);
        
        // 添加月份切换动画
        if (calendarGrid) {
            calendarGrid.classList.add('calendar-month-transition-out');
        }
        
        setTimeout(() => {
            currentMonth += direction;
            
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            } else if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            
            updateCalendarDisplay();
            
            // 添加进入动画
            if (calendarGrid) {
                calendarGrid.classList.remove('calendar-month-transition-out');
                calendarGrid.classList.add('calendar-month-transition-in');
                
                setTimeout(() => {
                    calendarGrid.classList.remove('calendar-month-transition-in');
                }, 300);
            }
        }, 150);
    }

    /**
     * 获取用户身份信息 - 与其他页面保持一致的逻辑
     */
    async function getUserIdentity() {
        // 1) 本地 user_profile
        let cached = null;
        try { cached = JSON.parse(localStorage.getItem('user_profile') || 'null'); } catch(_) { cached = null; }

        let user_id = '';
        let username = '';

        if (cached) {
            user_id = (cached.user_id || cached.id || '').toString();
        }

        // 2) 与 me.js 保持一致：优先从 localStorage/sessionStorage 读取 userId/UserID
        try {
            const storedId =
              localStorage.getItem('userId') ||
              sessionStorage.getItem('userId') ||
              localStorage.getItem('UserID') ||
              sessionStorage.getItem('UserID');

            if (storedId) {
                user_id = String(storedId);
            }
        } catch(_) {}

        // 3) 仅当存在 user_id 时，通过 /readdata 使用 user_id 查询 username
        if (user_id) {
            try {
                var API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
                if (API_BASE && API_BASE.endsWith('/')) API_BASE = API_BASE.slice(0, -1);

                const body = { table_name: 'users', user_id: String(user_id) };
                const res = await fetch(API_BASE + '/readdata', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const json = await res.json();
                if (res.ok && json && json.success && Array.isArray(json.data) && json.data.length > 0) {
                    const rec = json.data[0] || {};
                    username = (rec.username || '').toString();

                    // 回写本地
                    try {
                        const merged = Object.assign({}, cached || {}, { user_id, username });
                        localStorage.setItem('user_profile', JSON.stringify(merged));
                        if (username) localStorage.setItem('username', username);
                    } catch(_) {}

                    console.log(`✅ 日历页面获取用户身份: user_id=${user_id}, username=${username}`);
                    return { user_id, username };
                }
            } catch (e) {
                console.warn('getUserIdentity 通过 user_id 调用 /readdata 失败:', e);
            }
            // 查询失败时，至少返回 user_id，username 留空
            console.log(`⚠️ 日历页面获取用户身份(仅ID): user_id=${user_id}`);
            return { user_id, username: '' };
        }

        // 兜底为空
        console.warn('⚠️ 日历页面未找到用户身份信息');
        return { user_id: '', username: '' };
    }
    
    /**
     * 加载月度症状数据
     */
    async function loadMonthlySymptomData(year, month) {
        try {
            const identity = await getUserIdentity();
            if (!identity.user_id) {
                console.warn('用户未登录，无法加载症状数据');
                return {};
            }
            
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
            
            // 检查缓存
            if (monthlySymptomData[monthKey]) {
                return monthlySymptomData[monthKey];
            }
            
            var API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
            if (API_BASE && API_BASE.endsWith('/')) API_BASE = API_BASE.slice(0, -1);
            
            const apiUrl = `${API_BASE}/getjson/symptoms/monthly/${identity.user_id}/${year}/${month + 1}`;
            console.log(`🔍 请求症状数据API: ${apiUrl}`);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`📡 API响应状态: ${response.status} ${response.statusText}`);
            const result = await response.json();
            console.log(`📊 API响应数据:`, result);
            
            if (result.success && result.data) {
                monthlySymptomData[monthKey] = result.data;
                const dataCount = Object.keys(result.data).length;
                console.log(`✅ 成功加载${year}年${month + 1}月症状数据，共${dataCount}条记录:`, result.data);
                return result.data;
            } else {
                console.warn(`❌ 加载症状数据失败: ${result.message || '未知错误'}`);
                console.warn('完整响应:', result);
                return {};
            }
        } catch (e) {
            console.error('加载症状数据异常:', e);
            return {};
        }
    }
    
    /**
     * 获取日期的症状颜色
     */
    function getDateSymptomColor(dateStr, symptomData) {
        const symptoms = symptomData[dateStr];
        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
            return null;
        }
        
        // 如果有多个症状，优先显示数字较大的（更严重的）
        const maxSymptom = Math.max(...symptoms.filter(s => s > 0));
        const color = SYMPTOM_COLORS[maxSymptom] || null;
        
        if (color) {
            console.log(`🎨 日期${dateStr}症状颜色: 症状${symptoms} -> 最高级别${maxSymptom} -> 颜色${color}`);
        }
        
        return color;
    }
    
    /**
     * 获取日期的症状描述
     */
    function getDateSymptomDescription(dateStr, symptomData) {
        const symptoms = symptomData[dateStr];
        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
            return '无症状记录';
        }
        
        const uniqueSymptoms = [...new Set(symptoms.filter(s => s > 0))];
        if (uniqueSymptoms.length === 0) {
            return '无症状';
        }
        
        return uniqueSymptoms.map(s => SYMPTOM_NAMES[s] || '未知症状').join('、');
    }

    /**
     * 更新日历显示
     */
    async function updateCalendarDisplay() {
        // 更新年月显示
        yearElement.textContent = currentYear;
        monthElement.textContent = monthNames[currentMonth];

        console.log(`📅 更新日历显示: ${currentYear}年${currentMonth + 1}月`);

        // 加载症状数据
        const symptomData = await loadMonthlySymptomData(currentYear, currentMonth);
        console.log(`🔍 获得症状数据:`, symptomData);

        // 生成日历网格
        generateCalendarGrid(symptomData);
        
        // 隐藏加载动画
        hideLoadingAnimation();
        
        console.log(`✅ 日历网格生成完成`);
    }

    /**
     * 生成日历网格
     */
    function generateCalendarGrid(symptomData = {}) {
        calendarGrid.innerHTML = '';

        // 获取当月第一天和最后一天
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        // 获取第一天是星期几 (0=Sunday, 1=Monday, ...)
        let firstDayOfWeek = firstDay.getDay();
        // 转换为 Monday = 0 的格式
        firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

        // 获取上个月的天数
        const prevMonth = new Date(currentYear, currentMonth, 0);
        const daysInPrevMonth = prevMonth.getDate();

        // 获取今天的日期
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;
        const todayDate = today.getDate();

        // 添加上个月的尾部日期
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            let prevMonthYear = currentYear;
            let prevMonth = currentMonth - 1;
            if (prevMonth < 0) {
                prevMonth = 11;
                prevMonthYear--;
            }
            const dayElement = createDayElement(dayNum, true, false, prevMonthYear, prevMonth, symptomData);
            calendarGrid.appendChild(dayElement);
        }

        // 添加当月日期
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = isCurrentMonth && day === todayDate;
            const dayElement = createDayElement(day, false, isToday, currentYear, currentMonth, symptomData);
            calendarGrid.appendChild(dayElement);
        }

        // 添加下个月的开头日期
        const totalCells = calendarGrid.children.length;
        const remainingCells = 42 - totalCells; // 6行 × 7列 = 42个格子
        
        for (let day = 1; day <= remainingCells && day <= 14; day++) {
            let nextMonthYear = currentYear;
            let nextMonth = currentMonth + 1;
            if (nextMonth > 11) {
                nextMonth = 0;
                nextMonthYear++;
            }
            const dayElement = createDayElement(day, true, false, nextMonthYear, nextMonth, symptomData);
            calendarGrid.appendChild(dayElement);
        }
    }

    /**
     * 创建日期元素
     */
    function createDayElement(dayNum, isOtherMonth, isToday, year, month, symptomData = {}) {
        const dayElement = document.createElement('button');
        dayElement.className = 'calendar-day';
        dayElement.textContent = dayNum;

        if (isOtherMonth) {
            dayElement.classList.add('other-month');
        }

        if (isToday) {
            dayElement.classList.add('today');
        }

        // 判断是否为周末
        const dayIndex = Array.from(calendarGrid.children).length % 7;
        if (dayIndex === 5 || dayIndex === 6) { // Saturday or Sunday
            dayElement.classList.add('weekend');
        }

        // 应用症状高亮
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const symptomColor = getDateSymptomColor(dateStr, symptomData);
        const symptomDescription = getDateSymptomDescription(dateStr, symptomData);
        
        if (symptomColor) {
            dayElement.style.backgroundColor = symptomColor;
            dayElement.classList.add('has-symptoms');
            dayElement.setAttribute('title', `${year}年${month + 1}月${dayNum}日: ${symptomDescription}`);
            
            // 添加症状指示器
            const indicator = document.createElement('div');
            indicator.className = 'symptom-indicator';
            indicator.style.cssText = `
                position: absolute;
                bottom: 2px;
                right: 2px;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background-color: ${symptomColor};
                border: 1px solid rgba(0,0,0,0.2);
            `;
            dayElement.style.position = 'relative';
            dayElement.appendChild(indicator);
        } else if (!isOtherMonth) {
            dayElement.setAttribute('title', `${year}年${month + 1}月${dayNum}日: 无症状记录`);
        }

        // 添加点击事件
        dayElement.addEventListener('click', () => {
            addHapticFeedback('Light');
            selectDate(dayElement, dayNum, isOtherMonth, year, month, symptomDescription);
        });

        return dayElement;
    }

    /**
     * 选择日期
     */
    function selectDate(dayElement, dayNum, isOtherMonth, year, month, symptomDescription = '无症状记录') {
        // 移除之前选中的状态
        const prevSelected = calendarGrid.querySelector('.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }

        // 添加选中状态
        dayElement.classList.add('selected');
        
        // 添加选中动画效果
        dayElement.style.animation = 'none';
        dayElement.offsetHeight; // 触发重排
        dayElement.style.animation = 'calendarSelectedPulse 0.6s ease-out';
        
        // 添加选中振动反馈
        addHapticFeedback('Medium');

        // 计算实际日期
        let actualYear = year || currentYear;
        let actualMonth = month !== undefined ? month : currentMonth;

        if (isOtherMonth && (year === undefined || month === undefined)) {
            const dayIndex = Array.from(calendarGrid.children).indexOf(dayElement);
            if (dayIndex < 15) { // 上个月
                actualMonth = currentMonth - 1;
                if (actualMonth < 0) {
                    actualMonth = 11;
                    actualYear = currentYear - 1;
                }
            } else { // 下个月
                actualMonth = currentMonth + 1;
                if (actualMonth > 11) {
                    actualMonth = 0;
                    actualYear = currentYear + 1;
                }
            }
        }

        selectedDate = new Date(actualYear, actualMonth, dayNum);
        
        // 更新选中日期显示，包含症状信息
        updateSelectedDateDisplay(symptomDescription);
    }

    /**
     * 更新选中日期显示
     */
    function updateSelectedDateDisplay(symptomDescription = '') {
        if (selectedDate) {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth() + 1;
            const day = selectedDate.getDate();
            const dateStr = `${year}年${month}月${day}日`;
            
            if (symptomDescription && symptomDescription !== '无症状记录') {
                selectedDateText.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 4px;">${dateStr}</div>
                    <div style="font-size: 12px; color: #666; line-height: 1.4;">
                        症状：${symptomDescription}
                    </div>
                `;
            } else {
                selectedDateText.textContent = dateStr;
            }
        } else {
            selectedDateText.textContent = '选择一个日期';
        }
    }

    /**
     * 返回上一页
     */
    function goBack() {
        // 如果有选中的日期，可以传递给父页面
        if (selectedDate && window.opener) {
            // 通知父页面选中的日期
            window.opener.postMessage({
                type: 'dateSelected',
                date: selectedDate.toISOString().split('T')[0]
            }, '*');
        }
        
        // 返回上一页
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // 如果没有历史记录，跳转到日常页面
            const dailyUrl = window.location.href.replace('/src/calendar.html', '/index.html');
            console.log('🔗 返回到日常页面:', dailyUrl);
            window.location.href = dailyUrl;
        }
    }

    /**
     * 添加触觉反馈
     */
    function addHapticFeedback(intensity = 'Light') {
        if (window.__hapticImpact__) {
            window.__hapticImpact__(intensity);
        }
    }

    /**
     * 监听键盘事件
     */
    function initKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    addHapticFeedback('Light');
                    navigateMonth(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    addHapticFeedback('Light');
                    navigateMonth(1);
                    break;
                case 'Escape':
                    e.preventDefault();
                    addHapticFeedback('Medium');
                    goBack();
                    break;
            }
        });
    }

    /**
     * 测试症状数据API（调试用）
     */
    async function testSymptomAPI() {
        console.log('🧪 开始测试症状API...');
        const identity = await getUserIdentity();
        console.log('👤 用户身份:', identity);
        
        if (!identity.user_id) {
            console.warn('❌ 无法测试API：用户未登录');
            return;
        }
        
        const testYear = new Date().getFullYear();
        const testMonth = new Date().getMonth() + 1;
        
        try {
            var API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
            if (API_BASE && API_BASE.endsWith('/')) API_BASE = API_BASE.slice(0, -1);
            
            const testUrl = `${API_BASE}/getjson/symptoms/monthly/${identity.user_id}/${testYear}/${testMonth}`;
            console.log(`🔗 测试URL: ${testUrl}`);
            
            const response = await fetch(testUrl);
            console.log(`📡 响应状态: ${response.status}`);
            
            const result = await response.json();
            console.log(`📊 API测试结果:`, result);
            
        } catch (e) {
            console.error('❌ API测试失败:', e);
        }
    }
    
    /**
     * 页面加载完成后初始化
     */
    document.addEventListener('DOMContentLoaded', () => {
        initCalendar();
        initKeyboardNavigation();
        
        // 调试：测试症状API
        setTimeout(() => {
            testSymptomAPI();
        }, 1000);
        
        // 检查URL参数中是否有指定日期
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');
        
        if (dateParam) {
            const date = new Date(dateParam);
            if (!isNaN(date.getTime())) {
                currentYear = date.getFullYear();
                currentMonth = date.getMonth();
                updateCalendarDisplay();
                
                // 选中对应日期
                setTimeout(() => {
                    const dayElements = calendarGrid.querySelectorAll('.calendar-day:not(.other-month)');
                    const targetDay = date.getDate();
                    const targetElement = Array.from(dayElements).find(el => 
                        parseInt(el.textContent) === targetDay
                    );
                    if (targetElement) {
                        targetElement.click();
                    }
                }, 100);
                return;
            }
        }
        
        // 默认设置初始选中日期为今天
        setTimeout(() => {
            const todayElement = calendarGrid.querySelector('.today');
            if (todayElement) {
                todayElement.click();
            }
        }, 100);
    });

    // 监听来自父页面的消息
    window.addEventListener('message', (event) => {
        if (event.data.type === 'setDate' && event.data.date) {
            const date = new Date(event.data.date);
            currentYear = date.getFullYear();
            currentMonth = date.getMonth();
            updateCalendarDisplay();
            
            // 选中对应日期
            setTimeout(() => {
                const dayElements = calendarGrid.querySelectorAll('.calendar-day:not(.other-month)');
                const targetDay = date.getDate();
                const targetElement = Array.from(dayElements).find(el => 
                    parseInt(el.textContent) === targetDay
                );
                if (targetElement) {
                    targetElement.click();
                }
            }, 100);
        }
    });

})();
