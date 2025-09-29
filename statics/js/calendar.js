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
        window.__hapticImpact__ = function(style){
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
    
    // 症状类型到颜色的映射
    const SYMPTOM_COLORS = {
        0: null,                    // 无症状 - 不高亮
        1: '#FFE4E1',              // 皮肤型紫癜 - 浅红色
        2: '#E6F3FF',              // 关节型紫癜 - 浅蓝色  
        3: '#FFF8DC',              // 腹型紫癜 - 浅黄色
        4: '#F0F8E8',              // 肾型紫癜 - 浅绿色
        5: '#F5F0FF'               // 其他症状 - 浅紫色
    };
    
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
    let prevMonthBtn, nextMonthBtn, backBtn;

    /**
     * 初始化日历
     */
    function initCalendar() {
        // 获取DOM元素
        yearElement = document.getElementById('current-year');
        monthElement = document.getElementById('current-month');
        calendarGrid = document.getElementById('calendar-grid');
        selectedDateText = document.getElementById('selected-date-text');
        prevMonthBtn = document.getElementById('prev-month');
        nextMonthBtn = document.getElementById('next-month');
        backBtn = document.getElementById('back-btn');

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

        // 初始化显示
        updateCalendarDisplay();
        
        console.log('✅ 日历初始化完成');
    }

    /**
     * 导航到上/下个月
     */
    function navigateMonth(direction) {
        currentMonth += direction;
        
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        } else if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        
        updateCalendarDisplay();
    }

    /**
     * 获取用户身份信息
     */
    async function getUserIdentity() {
        try {
            // 从localStorage获取用户信息
            const cachedUserData = localStorage.getItem('user_data');
            if (cachedUserData) {
                const userData = JSON.parse(cachedUserData);
                return {
                    user_id: userData.user_id || '',
                    username: userData.username || ''
                };
            }
            return { user_id: '', username: '' };
        } catch (e) {
            console.warn('获取用户身份失败:', e);
            return { user_id: '', username: '' };
        }
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
            
            const response = await fetch(`${API_BASE}/getjson/symptoms/monthly/${identity.user_id}/${year}/${month + 1}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            if (result.success && result.data) {
                monthlySymptomData[monthKey] = result.data;
                console.log(`✅ 加载${year}年${month + 1}月症状数据:`, result.data);
                return result.data;
            } else {
                console.warn('加载症状数据失败:', result.message);
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
        return SYMPTOM_COLORS[maxSymptom] || null;
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

        // 加载症状数据
        const symptomData = await loadMonthlySymptomData(currentYear, currentMonth);

        // 生成日历网格
        generateCalendarGrid(symptomData);
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
     * 页面加载完成后初始化
     */
    document.addEventListener('DOMContentLoaded', () => {
        initCalendar();
        initKeyboardNavigation();
        
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
