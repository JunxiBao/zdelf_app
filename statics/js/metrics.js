// 全局变量存储指标数据
let metricsData = {};

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
function initMetricsPage() {
    // 检查是否需要强制清除缓存（用于解决浏览器缓存问题）
    const forceClear = new URLSearchParams(window.location.search).get('clear');
    if (forceClear === 'true') {
        clearAllFormData();
        // 移除URL参数
        const url = new URL(window.location);
        url.searchParams.delete('clear');
        window.history.replaceState({}, '', url);
        return;
    }
    
    // 从本地存储加载已保存的数据
    loadMetricsData();

    // 为全局保存按钮添加涟漪效果
    const globalSaveBtn = document.querySelector('.global-save-btn');
    if (globalSaveBtn) {
        globalSaveBtn.addEventListener('click', function(e) {
            attachButtonRipple(this);
        });
    }

    // 初始化记录日期/时间默认值
    try {
        const dateInput = document.getElementById('record-date-input');
        const timeInput = document.getElementById('record-time-input');
        const now = new Date();
        if (dateInput && !dateInput.value) {
            dateInput.value = now.toISOString().slice(0,10);
        }
        if (timeInput && !timeInput.value) {
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            timeInput.value = `${hh}:${mm}:${ss}`;
        }
    } catch (_) {}

    // 初始化出血点选择功能
    initBleedingPointSelection();
    
    // 初始化出血点图片上传功能
    initBleedingImageUpload();
    
    // 初始化JSON大小显示功能
    initJsonSizeDisplay();
    
    // 初始显示JSON大小
    updateJsonSizeDisplay();

    // 初始化自我评分滑块功能
    initSelfRatingSlider();

    // 初始化尿液检测指标矩阵
    initUrinalysisMatrix();
    
    // 初始化血常规检测指标矩阵
    initBloodTestMatrix();

    console.log('健康指标页面初始化完成');
}

// 返回上一页
function goBack() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

    // 保存当前数据到本地存储
    saveMetricsData();

    // 返回到选项页面
    window.location.href = 'options.html';
}

// 保存所有指标数据
function saveAllMetrics() {
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Light');
    } catch(_) {}

    // 统一的保存状态管理
    const saveState = initSaveState();
    showSaveLoading(saveState, '保存中...');

    try {
        let allData = {};
        let hasValidData = false;

        // 收集所有指标数据
        const metricTypes = ['symptoms', 'temperature', 'urinalysis', 'proteinuria', 'blood-test', 'blood-test-matrix', 'bleeding-point', 'self-rating', 'urinalysis-matrix'];

        for (const metricType of metricTypes) {
            let data = {};

            switch(metricType) {
                case 'symptoms':
                    const _symEl = document.getElementById('symptoms-input');
                    const symptoms = _symEl ? _symEl.value.trim() : '';
                    if (symptoms) {
                        data = { symptoms };
                        hasValidData = true;
                    }
                    break;

                case 'temperature':
                    const _tempEl = document.getElementById('temperature-input');
                    const temp = _tempEl ? _tempEl.value : '';
                    console.log('体温输入值:', temp, '元素:', _tempEl);
                    if (temp && !isNaN(parseFloat(temp))) {
                        const tempValue = parseFloat(temp);
                        console.log('体温数值:', tempValue);
                        if (tempValue >= 35 && tempValue <= 45) {
                            data = { temperature: tempValue };
                            hasValidData = true;
                            console.log('体温数据已保存:', data);
                        } else {
                            console.log('体温超出范围:', tempValue);
                        }
                    } else {
                        console.log('体温输入无效:', temp);
                    }
                    break;

                case 'urinalysis':
                    const _proteinEl = document.getElementById('protein-input');
                    const _glucoseEl = document.getElementById('glucose-input');
                    const _ketonesEl = document.getElementById('ketones-input');
                    const _bloodEl = document.getElementById('blood-input');
                    const protein = _proteinEl ? _proteinEl.value.trim() : '';
                    const glucose = _glucoseEl ? _glucoseEl.value.trim() : '';
                    const ketones = _ketonesEl ? _ketonesEl.value.trim() : '';
                    const blood = _bloodEl ? _bloodEl.value.trim() : '';

                    if (protein || glucose || ketones || blood) {
                        data = { protein, glucose, ketones, blood };
                        hasValidData = true;
                    }
                    break;

                case 'proteinuria':
                    const _p24El = document.getElementById('proteinuria-input');
                    const protein24h = _p24El ? _p24El.value : '';
                    if (protein24h && !isNaN(parseFloat(protein24h))) {
                        const proteinValue = parseFloat(protein24h);
                        if (proteinValue >= 0) {
                            data = { proteinuria24h: proteinValue };
                            hasValidData = true;
                        }
                    }
                    break;

                case 'blood-test':
                    const _wbcEl = document.getElementById('wbc-input');
                    const _rbcEl = document.getElementById('rbc-input');
                    const _hbEl = document.getElementById('hb-input');
                    const _pltEl = document.getElementById('plt-input');
                    const wbc = _wbcEl ? _wbcEl.value : '';
                    const rbc = _rbcEl ? _rbcEl.value : '';
                    const hb = _hbEl ? _hbEl.value : '';
                    const plt = _pltEl ? _pltEl.value : '';

                    const bloodData = {};
                    if (wbc && !isNaN(parseFloat(wbc))) bloodData.wbc = parseFloat(wbc);
                    if (rbc && !isNaN(parseFloat(rbc))) bloodData.rbc = parseFloat(rbc);
                    if (hb && !isNaN(parseInt(hb))) bloodData.hb = parseInt(hb);
                    if (plt && !isNaN(parseInt(plt))) bloodData.plt = parseInt(plt);

                    if (Object.keys(bloodData).length > 0) {
                        data = bloodData;
                        hasValidData = true;
                    }
                    break;

                case 'bleeding-point':
                    const bleedingPoints = [];
                    const bleedingPointItems = document.querySelectorAll('.bleeding-point-item');
                    
                    bleedingPointItems.forEach(item => {
                        const select = item.querySelector('.bleeding-point-select');
                        const otherInput = item.querySelector('.other-bleeding-text');
                        
                        if (select && select.value) {
                            const bleedingData = { bleedingPoint: select.value };
                            if (select.value === 'other' && otherInput && otherInput.value.trim()) {
                                bleedingData.otherDescription = otherInput.value.trim();
                            }
                            bleedingPoints.push(bleedingData);
                        }
                    });
                    
                    // 收集图片数据
                    const bleedingImages = [];
                    const imageItems = document.querySelectorAll('#bleedingUploadedImages .uploaded-image-item img');
                    imageItems.forEach(img => {
                        bleedingImages.push(img.src);
                    });
                    
                    if (bleedingPoints.length > 0 || bleedingImages.length > 0) {
                        data = { bleedingPoints, bleedingImages };
                        hasValidData = true;
                    }
                    break;

                case 'self-rating':
                    const _ratingEl = document.getElementById('self-rating-slider');
                    const rating = _ratingEl ? _ratingEl.value : '';
                    if (rating && !isNaN(parseInt(rating))) {
                        const ratingValue = parseInt(rating);
                        if (ratingValue >= 0 && ratingValue <= 10) {
                            data = { selfRating: ratingValue };
                            hasValidData = true;
                        }
                    }
                    break;

                case 'blood-test-matrix':
                    const bloodTestItems = document.querySelectorAll('.blood-test-item');
                    const bloodTestData = [];
                    
                    bloodTestItems.forEach((item, index) => {
                        const select = item.querySelector('.blood-test-select');
                        const valueInput = item.querySelector('.blood-test-value');
                        const customNameInput = item.querySelector('.custom-blood-test-name');
                        
                        if (select && select.value && valueInput && valueInput.value.trim()) {
                            const data = {
                                item: select.value,
                                value: valueInput.value.trim(),
                                index: index
                            };
                            
                            // 如果是自定义项目，添加自定义名称
                            if (select.value === 'custom' && customNameInput && customNameInput.value.trim()) {
                                data.customName = customNameInput.value.trim();
                            }
                            
                            bloodTestData.push(data);
                        }
                    });
                    
                    if (bloodTestData.length > 0) {
                        data = { bloodTestMatrix: bloodTestData };
                        hasValidData = true;
                    }
                    break;

                case 'urinalysis-matrix':
                    const urinalysisItems = document.querySelectorAll('.urinalysis-item');
                    const urinalysisData = [];
                    
                    urinalysisItems.forEach((item, index) => {
                        const select = item.querySelector('.urinalysis-select');
                        const valueInput = item.querySelector('.urinalysis-value');
                        const customNameInput = item.querySelector('.custom-urinalysis-name');
                        
                        if (select && select.value && valueInput && valueInput.value.trim()) {
                            const data = {
                                item: select.value,
                                value: valueInput.value.trim(),
                                index: index
                            };
                            
                            // 如果是自定义项目，添加自定义名称
                            if (select.value === 'custom' && customNameInput && customNameInput.value.trim()) {
                                data.customName = customNameInput.value.trim();
                            }
                            
                            urinalysisData.push(data);
                        }
                    });
                    
                    if (urinalysisData.length > 0) {
                        data = { urinalysisMatrix: urinalysisData };
                        hasValidData = true;
                    }
                    break;
            }

            if (Object.keys(data).length > 0) {
                allData[metricType] = data;
            }
        }

        if (!hasValidData) {
            showToast('请至少填写一项指标数据');
            return;
        }

        // 保存所有数据（本地）
        metricsData = { ...metricsData, ...allData };
        localStorage.setItem('health_metrics_data', JSON.stringify(metricsData));

        // 自动上传到后端（metrics 表）
        (async function uploadAfterSave(){
            try {
                // 读取 add 页面选择的日期（YYYY-MM-DD），若无则使用今日
                function getSelectedDate() {
                    var el = document.getElementById('record-date-input');
                    var val = (el && el.value) ? el.value : '';
                    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
                    var now = new Date();
                    return now.toISOString().slice(0,10);
                }
                function getSelectedHms() {
                    var el = document.getElementById('record-time-input');
                    var val = (el && el.value) ? el.value : '';
                    if (/^\d{2}:\d{2}(:\d{2})?$/.test(val)) {
                        var parts = val.split(':');
                        return parts.length === 2 ? (parts[0].padStart(2,'0')+':'+parts[1].padStart(2,'0')+':00') : (parts[0].padStart(2,'0')+':'+parts[1].padStart(2,'0')+':'+String(parts[2]||'00').padStart(2,'0'));
                    }
                    var now = new Date();
                    var hh = String(now.getHours()).padStart(2,'0');
                    var mm = String(now.getMinutes()).padStart(2,'0');
                    var ss = String(now.getSeconds()).padStart(2,'0');
                    return hh+':'+mm+':'+ss;
                }
                const selectedDate = getSelectedDate();
                const currentHms = getSelectedHms();
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
                        recordTime: selectedDate + ' ' + currentHms,
                        version: '1.0',
                        appName: '紫癜精灵',
                        dataType: 'health_metrics'
                    },
                    metricsData: allData
                };

                // 获取身份：优先从本地缓存，缺失时调用 /readdata 补全
                const identity = await resolveUserIdentity();
                const user_id = identity.user_id || '';
                const username = identity.username || '';

                // 检查JSON文件大小
                const jsonString = JSON.stringify({ user_id, username, payload });
                const jsonSizeKB = (new Blob([jsonString]).size / 1024).toFixed(1);
                const maxJsonSizeKB = 5120; // 5MB限制
                
                console.log(`JSON文件大小: ${jsonSizeKB}KB`);
                
                if (jsonSizeKB > maxJsonSizeKB) {
                    // 恢复按钮状态
                    hideSaveLoading(saveState, '保存所有指标');
                    
                    showMessage(`数据过大 (${jsonSizeKB}KB > ${maxJsonSizeKB}KB)！请删除一些图片或减少文本内容`, 'error');
                    return;
                }

                var API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || 'https://app.zdelf.cn';
                if (API_BASE && API_BASE.endsWith('/')) API_BASE = API_BASE.slice(0, -1);

                const resp = await fetch(API_BASE + '/uploadjson/metrics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id, username, payload })
                });
                const resJson = await resp.json();
                if (!resp.ok || !resJson.success) {
                    console.warn('指标上传失败:', resJson);
                    showToast('已保存本地，云端上传失败');
                    // 清空加页选择的日期
                    try { localStorage.removeItem('health_record_data'); } catch(_) {}
                } else {
                    console.log('指标上传成功:', resJson);
                    showToast('已保存并上传云端');
                    // 清空加页选择的日期
                    try { localStorage.removeItem('health_record_data'); } catch(_) {}
                    
                    // 清除表单数据和本地存储
                    clearAllFormData();
                    
                    // 强制清除全局数据变量
                    metricsData = {};
                    
                    // 跳转到daily页面
                    setTimeout(() => {
                        window.location.href = '../index.html';
                    }, 1500);
                }
            } catch (e) {
                console.warn('上传异常:', e);
                showToast('已保存本地，云端上传异常');
                // 清空加页选择的日期
                try { localStorage.removeItem('health_record_data'); } catch(_) {}
            }
        })();

        // 成功保存的强震动反馈
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Heavy');
        } catch(_) {}

        console.log('保存所有指标数据:', allData);

    } catch (error) {
        console.error('保存数据失败:', error);
        showToast('保存失败，请重试');
    } finally {
        // 恢复按钮状态
        setTimeout(() => {
            hideSaveLoading(saveState, '保存所有指标');
        }, 1500);
    }
}



// 从本地存储加载数据
function loadMetricsData() {
    try {
        const storedData = localStorage.getItem('health_metrics_data');
        if (storedData) {
            metricsData = JSON.parse(storedData);

            // 填充表单数据
            Object.keys(metricsData).forEach(type => {
                const data = metricsData[type];
                fillFormData(type, data);
            });

            console.log('加载已保存的指标数据:', metricsData);
        }
    } catch (error) {
        console.error('加载指标数据失败:', error);
    }
}

// 填充表单数据
function fillFormData(type, data) {
    try {
        switch(type) {
            case 'symptoms':
                if (data.symptoms) {
                    document.getElementById('symptoms-input').value = data.symptoms;
                }
                break;

            case 'temperature':
                if (data.temperature !== null) {
                    document.getElementById('temperature-input').value = data.temperature;
                }
                break;

            case 'urinalysis':
                // 页面可能没有独立的尿常规输入框（改为矩阵方式），因此需判空
                const __proteinEl = document.getElementById('protein-input');
                const __glucoseEl = document.getElementById('glucose-input');
                const __ketonesEl = document.getElementById('ketones-input');
                const __bloodEl = document.getElementById('blood-input');
                if (__proteinEl && data.protein != null) __proteinEl.value = data.protein;
                if (__glucoseEl && data.glucose != null) __glucoseEl.value = data.glucose;
                if (__ketonesEl && data.ketones != null) __ketonesEl.value = data.ketones;
                if (__bloodEl && data.blood != null) __bloodEl.value = data.blood;
                break;

            case 'proteinuria':
                if (data.proteinuria24h !== null) {
                    document.getElementById('proteinuria-input').value = data.proteinuria24h;
                }
                break;

            case 'blood-test':
                if (data.wbc !== null) document.getElementById('wbc-input').value = data.wbc;
                if (data.rbc !== null) document.getElementById('rbc-input').value = data.rbc;
                if (data.hb !== null) document.getElementById('hb-input').value = data.hb;
                if (data.plt !== null) document.getElementById('plt-input').value = data.plt;
                break;

            case 'bleeding-point':
                if (data.bleedingPoints && Array.isArray(data.bleedingPoints)) {
                    // 清空现有出血点
                    const container = document.getElementById('bleeding-points-list');
                    container.innerHTML = '';
                    
                    // 重新创建出血点项目
                    data.bleedingPoints.forEach((item, index) => {
                        addBleedingPoint(item.bleedingPoint, item.otherDescription, index);
                    });
                }
                
                // 恢复图片
                if (data.bleedingImages && Array.isArray(data.bleedingImages)) {
                    const imageContainer = document.getElementById('bleedingUploadedImages');
                    imageContainer.innerHTML = '';
                    
                    data.bleedingImages.forEach(imageSrc => {
                        addBleedingImageToContainer(imageSrc);
                    });
                }
                break;

            case 'self-rating':
                if (data.selfRating !== null && data.selfRating !== undefined) {
                    const slider = document.getElementById('self-rating-slider');
                    const ratingValue = document.getElementById('rating-value');
                    slider.value = data.selfRating;
                    ratingValue.textContent = data.selfRating;
                    updateSliderFill(data.selfRating);
                }
                break;

            case 'blood-test-matrix':
                if (data.bloodTestMatrix && Array.isArray(data.bloodTestMatrix)) {
                    // 清空现有项目
                    const container = document.getElementById('blood-test-matrix-container');
                    container.innerHTML = '';
                    
                    // 重新创建项目
                    data.bloodTestMatrix.forEach((item, index) => {
                        addBloodTestItem(item.item, item.value, index);
                        
                        // 如果是自定义项目，设置自定义名称
                        if (item.item === 'custom' && item.customName) {
                            setTimeout(() => {
                                const customInput = document.querySelector(`[data-index="${index}"] .custom-blood-test-name`);
                                if (customInput) {
                                    customInput.value = item.customName;
                                }
                            }, 100);
                        }
                    });
                }
                break;

            case 'urinalysis-matrix':
                if (data.urinalysisMatrix && Array.isArray(data.urinalysisMatrix)) {
                    // 清空现有项目
                    const container = document.getElementById('urinalysis-matrix-container');
                    container.innerHTML = '';
                    
                    // 重新创建项目
                    data.urinalysisMatrix.forEach((item, index) => {
                        addUrinalysisItem(item.item, item.value, index);
                        
                        // 如果是自定义项目，设置自定义名称
                        if (item.item === 'custom' && item.customName) {
                            setTimeout(() => {
                                const customInput = document.querySelector(`[data-index="${index}"] .custom-urinalysis-name`);
                                if (customInput) {
                                    customInput.value = item.customName;
                                }
                            }, 100);
                        }
                    });
                }
                break;
        }
    } catch (error) {
        console.error(`填充${type}表单数据失败:`, error);
    }
}

// 初始化出血点选择功能
function initBleedingPointSelection() {
    // 添加第一个出血点项目
    addBleedingPoint();
}

// 添加出血点项目
function addBleedingPoint(selectedValue = '', otherDescription = '', index = null) {
    const container = document.getElementById('bleeding-points-list');
    if (!container) return;
    
    // 添加按钮点击动画
    const addBtn = document.querySelector('.add-bleeding-point-btn');
    if (addBtn) {
        addBtn.classList.add('clicking');
        setTimeout(() => {
            addBtn.classList.remove('clicking');
        }, 300);
    }
    
    // 添加按钮点击时的震动反馈
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Medium');
    } catch(_) {}
    
    const itemIndex = index !== null ? index : container.children.length;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'bleeding-point-item';
    
    itemDiv.innerHTML = `
        <div class="bleeding-point-header">
            <div class="custom-select-wrapper">
                <select class="bleeding-point-select custom-select" data-index="${itemIndex}">
                    <option value="">请选择出血部位</option>
                    <option value="joints">🦴 关节</option>
                    <option value="thigh">🦵 大腿</option>
                    <option value="calf">🦵 小腿</option>
                    <option value="upper-arm">💪 大臂</option>
                    <option value="forearm">💪 小臂</option>
                    <option value="abdomen">🫁 腹部</option>
                    <option value="other">📝 其他</option>
                </select>
                <div class="select-arrow">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </div>
            <button type="button" class="remove-bleeding-point-btn" onclick="removeBleedingPoint(this)" onmousedown="try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}">×</button>
        </div>
        <div class="other-bleeding-input" style="display: none;">
            <div class="other-input-wrapper">
                <input type="text" class="other-bleeding-text other-text-input" placeholder="请描述其他出血部位...">
                <div class="input-icon">✏️</div>
            </div>
        </div>
    `;
    
    container.appendChild(itemDiv);
    
    // 如果提供了选中的值，设置选择器
    if (selectedValue) {
        const select = itemDiv.querySelector('.bleeding-point-select');
        select.value = selectedValue;
        
        if (selectedValue === 'other') {
            const otherInput = itemDiv.querySelector('.other-bleeding-input');
            otherInput.style.display = 'block';
            const otherTextInput = itemDiv.querySelector('.other-bleeding-text');
            if (otherDescription) {
                otherTextInput.value = otherDescription;
            }
        }
    }
    
    // 添加事件监听器
    const select = itemDiv.querySelector('.bleeding-point-select');
    select.addEventListener('change', function() {
        const otherInput = itemDiv.querySelector('.other-bleeding-input');
        const otherTextInput = itemDiv.querySelector('.other-bleeding-text');
        
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Medium');
        } catch(_) {}
        
        if (this.value === 'other') {
            otherInput.style.display = 'block';
            if (otherTextInput) {
                otherTextInput.focus();
            }
        } else {
            otherInput.style.display = 'none';
            if (otherTextInput) {
                otherTextInput.value = '';
            }
        }
    });
    
    // 选择器聚焦时的震动
    select.addEventListener('focus', function() {
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Light');
        } catch(_) {}
    });
    
    const otherTextInput = itemDiv.querySelector('.other-bleeding-text');
    if (otherTextInput) {
        otherTextInput.addEventListener('focus', function() {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });

        otherTextInput.addEventListener('input', function() {
            if (this._inputTimer) {
                clearTimeout(this._inputTimer);
            }
            this._inputTimer = setTimeout(() => {
                try {
                    window.__hapticImpact__ && window.__hapticImpact__('Light');
                } catch(_) {}
            }, 300);
        });
    }
    
    // 更新删除按钮显示状态
    updateBleedingPointRemoveButtons();
    
    // 添加震动反馈
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Heavy');
    } catch(_) {}
}

// 删除出血点项目
function removeBleedingPoint(button) {
    const item = button.closest('.bleeding-point-item');
    if (item) {
        // 删除按钮动画
        button.classList.add('removing');
        
        // 删除前的震动反馈
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Medium');
        } catch(_) {}
        
        // 添加项目滑出动画
        item.classList.add('removing');
        
        // 等待动画完成后删除元素
        setTimeout(() => {
            item.remove();
            updateBleedingPointRemoveButtons();
            
            // 删除完成后的震动反馈
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Heavy');
            } catch(_) {}
        }, 400);
    }
}

// 更新出血点删除按钮显示状态
function updateBleedingPointRemoveButtons() {
    const items = document.querySelectorAll('.bleeding-point-item');
    const removeButtons = document.querySelectorAll('.remove-bleeding-point-btn');
    
    // 如果只有一个项目，隐藏删除按钮
    removeButtons.forEach(button => {
        button.style.display = items.length > 1 ? 'flex' : 'none';
    });
}

// 初始化出血点图片上传功能
function initBleedingImageUpload() {
    const imageUploadBtn = document.getElementById('bleedingImageUploadBtn');
    
    if (imageUploadBtn) {
        // 点击上传按钮触发图片选择
        imageUploadBtn.addEventListener('click', async function() {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Medium');
                
                // 检查并请求权限
                const permissions = await window.cameraUtils.checkPermissions();
                if (permissions.camera === 'denied' || permissions.photos === 'denied') {
                    const newPermissions = await window.cameraUtils.requestPermissions();
                    if (newPermissions.camera === 'denied' || newPermissions.photos === 'denied') {
                        showMessage('需要相机和相册权限才能上传图片', 'error');
                        return;
                    }
                }

                // 显示图片选择选项
                await window.cameraUtils.showImageOptions(
                    (dataUrl) => {
                        // 成功获取图片
                        handleBleedingImageDataUrl(dataUrl);
                    },
                    (error) => {
                        // 错误处理
                        showMessage('图片选择失败: ' + error, 'error');
                    }
                );
            } catch (error) {
                console.error('图片上传失败:', error);
                showMessage('图片上传失败: ' + error.message, 'error');
            }
        });
    }
}

// 处理出血点图片数据URL（新的统一处理函数）
function handleBleedingImageDataUrl(dataUrl) {
    // 显示压缩进度
    showBleedingCompressionProgress('图片处理中...');
    
    // 将DataURL转换为File对象进行压缩
    dataURLToFile(dataUrl, 'bleeding-image.jpg').then(file => {
        compressImage(file, (compressedDataUrl) => {
            hideBleedingCompressionProgress();
            
            // 添加新图片到容器
            addBleedingImageToContainer(compressedDataUrl, file.name);
            
            // 显示压缩成功信息
            const originalSizeKB = (file.size / 1024).toFixed(1);
            const compressedSizeKB = ((compressedDataUrl.length * 0.75) / 1024).toFixed(1);
            const compressionRatio = ((1 - compressedDataUrl.length * 0.75 / file.size) * 100).toFixed(1);
            
            showMessage(`图片压缩成功！原始: ${originalSizeKB}KB → 压缩后: ${compressedSizeKB}KB (压缩率: ${compressionRatio}%)`, 'success');
        }, (error) => {
            hideBleedingCompressionProgress();
            showMessage(`图片压缩失败: ${error}`, 'error');
        }, 500); // 限制为500KB
    }).catch(error => {
        hideBleedingCompressionProgress();
        showMessage(`图片处理失败: ${error.message}`, 'error');
    });
}

// 将DataURL转换为File对象
function dataURLToFile(dataUrl, filename) {
    return new Promise((resolve, reject) => {
        try {
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const file = new File([u8arr], filename, { type: mime });
            resolve(file);
        } catch (error) {
            reject(error);
        }
    });
}

// 处理出血点图片上传
function handleBleedingImageUpload(files) {
    Array.from(files).forEach(file => {
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            showMessage('请选择图片文件', 'error');
            return;
        }
        
        // 检查文件大小（原始文件不超过10MB）
        const maxOriginalSizeMB = 10;
        if (file.size > maxOriginalSizeMB * 1024 * 1024) {
            showMessage(`图片文件过大，请选择小于${maxOriginalSizeMB}MB的图片`, 'error');
            return;
        }
        
        // 显示压缩进度
        showBleedingCompressionProgress(file.name);
        
        compressImage(file, (compressedDataUrl) => {
            hideBleedingCompressionProgress();
            
            // 添加新图片到容器
            addBleedingImageToContainer(compressedDataUrl, file.name);
            
            // 显示压缩成功信息
            const originalSizeKB = (file.size / 1024).toFixed(1);
            const compressedSizeKB = ((compressedDataUrl.length * 0.75) / 1024).toFixed(1);
            const compressionRatio = ((1 - compressedDataUrl.length * 0.75 / file.size) * 100).toFixed(1);
            
            showMessage(`图片 ${file.name} 压缩成功！原始: ${originalSizeKB}KB → 压缩后: ${compressedSizeKB}KB (压缩率: ${compressionRatio}%)`, 'success');
            
            // 更新JSON大小显示
            updateJsonSizeDisplay();
        }, (error) => {
            hideBleedingCompressionProgress();
            showMessage(`图片 ${file.name} 压缩失败: ${error}`, 'error');
        }, 500); // 限制为500KB
    });
}

// 显示出血点图片压缩进度
function showBleedingCompressionProgress(fileName) {
    const progressHtml = `
        <div class="bleeding-compression-progress" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            z-index: 10000;
            text-align: center;
            backdrop-filter: blur(8px);
        ">
            <div style="margin-bottom: 12px;">
                <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
            <div style="font-size: 0.9rem; color: #ccc;">正在压缩图片...</div>
            <div style="font-size: 0.8rem; color: #999; margin-top: 4px;">${fileName}</div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', progressHtml);
}

// 隐藏出血点图片压缩进度
function hideBleedingCompressionProgress() {
    const progress = document.querySelector('.bleeding-compression-progress');
    if (progress) {
        progress.remove();
    }
}

// 添加出血点图片到容器
function addBleedingImageToContainer(imageSrc, fileName) {
    const imageContainer = document.getElementById('bleedingUploadedImages');
    const imageItem = document.createElement('div');
    imageItem.className = 'uploaded-image-item';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = fileName;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image-btn';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = function() {
        imageItem.remove();
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Medium');
        } catch(_) {}
        // 更新JSON大小显示
        updateJsonSizeDisplay();
    };
    
    imageItem.appendChild(img);
    imageItem.appendChild(removeBtn);
    imageContainer.appendChild(imageItem);
    
    // 添加动画效果
    imageItem.style.opacity = '0';
    imageItem.style.transform = 'scale(0.8)';
    setTimeout(() => {
        imageItem.style.transition = 'all 0.3s ease';
        imageItem.style.opacity = '1';
        imageItem.style.transform = 'scale(1)';
    }, 10);
}

// 初始化自我评分滑块功能
function initSelfRatingSlider() {
    const slider = document.getElementById('self-rating-slider');
    const ratingValue = document.getElementById('rating-value');
    
    if (slider && ratingValue) {
        // 初始化滑块填充
        updateSliderFill(parseInt(slider.value));
        
        let lastValue = parseInt(slider.value);
        let isDragging = false;
        let dragStartTime = 0;
        
        // 滑块开始拖动
        slider.addEventListener('mousedown', function() {
            isDragging = true;
            dragStartTime = Date.now();
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });
        
        slider.addEventListener('touchstart', function() {
            isDragging = true;
            dragStartTime = Date.now();
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });
        
        // 滑块拖动过程中
        slider.addEventListener('input', function() {
            const value = parseInt(this.value);
            ratingValue.textContent = value;
            updateSliderFill(value);
            
            // 根据评分值提供不同的震动反馈
            if (value !== lastValue) {
                let hapticType = 'Light';
                
                // 根据评分范围选择震动强度
                if (value <= 2) {
                    hapticType = 'Heavy'; // 低分用强震动
                } else if (value <= 4) {
                    hapticType = 'Medium'; // 中低分用中等震动
                } else if (value <= 6) {
                    hapticType = 'Light'; // 中等分用轻微震动
                } else if (value <= 8) {
                    hapticType = 'Medium'; // 中高分用中等震动
                } else {
                    hapticType = 'Heavy'; // 高分用强震动
                }
                
                // 防抖处理，避免过于频繁的震动
                if (this._hapticTimer) {
                    clearTimeout(this._hapticTimer);
                }
                this._hapticTimer = setTimeout(() => {
                    try {
                        window.__hapticImpact__ && window.__hapticImpact__(hapticType);
                    } catch(_) {}
                }, 50);
                
                lastValue = value;
            }
        });
        
        // 滑块拖动结束
        slider.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                const dragDuration = Date.now() - dragStartTime;
                const value = parseInt(this.value);
                
                // 根据拖动时长和最终值提供反馈
                if (dragDuration > 500) {
                    // 长时间拖动，提供确认震动
                    try {
                        window.__hapticImpact__ && window.__hapticImpact__('Medium');
                    } catch(_) {}
                } else {
                    // 快速拖动，根据最终值提供震动
                    let hapticType = 'Light';
                    if (value <= 3 || value >= 8) {
                        hapticType = 'Heavy';
                    } else if (value <= 5 || value >= 7) {
                        hapticType = 'Medium';
                    }
                    
                    try {
                        window.__hapticImpact__ && window.__hapticImpact__(hapticType);
                    } catch(_) {}
                }
            }
        });
        
        slider.addEventListener('touchend', function() {
            if (isDragging) {
                isDragging = false;
                const dragDuration = Date.now() - dragStartTime;
                const value = parseInt(this.value);
                
                // 根据拖动时长和最终值提供反馈
                if (dragDuration > 500) {
                    // 长时间拖动，提供确认震动
                    try {
                        window.__hapticImpact__ && window.__hapticImpact__('Medium');
                    } catch(_) {}
                } else {
                    // 快速拖动，根据最终值提供震动
                    let hapticType = 'Light';
                    if (value <= 3 || value >= 8) {
                        hapticType = 'Heavy';
                    } else if (value <= 5 || value >= 7) {
                        hapticType = 'Medium';
                    }
                    
                    try {
                        window.__hapticImpact__ && window.__hapticImpact__(hapticType);
                    } catch(_) {}
                }
            }
        });
        
        // 滑块聚焦时的震动
        slider.addEventListener('focus', function() {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });
        
        // 键盘操作时的震动反馈
        slider.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                try {
                    window.__hapticImpact__ && window.__hapticImpact__('Light');
                } catch(_) {}
            }
        });
    }
}

// 更新滑块填充效果
function updateSliderFill(value) {
    const sliderFill = document.getElementById('slider-fill');
    if (sliderFill) {
        const percentage = (value / 10) * 100;
        sliderFill.style.width = percentage + '%';
        
        // 根据评分值改变颜色
        if (value <= 3) {
            sliderFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
        } else if (value <= 6) {
            sliderFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
        } else {
            sliderFill.style.background = 'linear-gradient(90deg, #44ff44, #66ff66)';
        }
    }
}

// 保存所有指标数据到本地存储
function saveMetricsData() {
    try {
        localStorage.setItem('health_metrics_data', JSON.stringify(metricsData));
    } catch (error) {
        console.error('保存指标数据到本地存储失败:', error);
    }
}

// 显示消息提示（与病历页面保持一致）
function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message-toast message-${type}`;
    messageEl.textContent = message;
    
    // 根据类型选择颜色
    let backgroundColor;
    switch(type) {
        case 'success':
            backgroundColor = '#4caf50';
            break;
        case 'error':
            backgroundColor = '#f44336';
            break;
        case 'warning':
            backgroundColor = '#ff9800';
            break;
        default:
            backgroundColor = '#2196f3';
    }
    
    // 添加样式
    messageEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${backgroundColor};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        font-size: 1em;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: messageSlideIn 0.3s ease-out;
        max-width: 90vw;
        word-wrap: break-word;
    `;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes messageSlideIn {
            from {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.8);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
        }
        @keyframes messageSlideOut {
            from {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            to {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.8);
            }
        }
    `;
    document.head.appendChild(style);
    
    // 添加到页面
    document.body.appendChild(messageEl);
    
    // 自动移除
    setTimeout(() => {
        messageEl.style.animation = 'messageSlideOut 0.3s ease-in';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 300);
    }, 3000);
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

    const rect = btn.getBoundingClientRect();
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

    /* 自我评分滑块样式 */
    .rating-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px 0;
    }

    .rating-labels {
        display: flex;
        justify-content: space-between;
        font-size: 0.85em;
        color: #666;
        margin-bottom: 8px;
    }

    .rating-label {
        font-weight: 500;
    }

    .slider-container {
        position: relative;
        height: 40px;
        display: flex;
        align-items: center;
    }

    .rating-slider {
        width: 100%;
        height: 6px;
        background: transparent;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
        position: relative;
        z-index: 2;
        cursor: pointer;
    }

    .rating-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        background: #6200ea;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(98, 0, 234, 0.3);
        transition: all 0.2s ease;
    }

    .rating-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(98, 0, 234, 0.4);
    }

    .rating-slider::-moz-range-thumb {
        width: 24px;
        height: 24px;
        background: #6200ea;
        border-radius: 50%;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 6px rgba(98, 0, 234, 0.3);
        transition: all 0.2s ease;
    }

    .rating-slider::-moz-range-thumb:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(98, 0, 234, 0.4);
    }

    .slider-track {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 6px;
        background: #e0e0e0;
        border-radius: 3px;
        transform: translateY(-50%);
        z-index: 1;
    }

    .slider-fill {
        position: absolute;
        top: 50%;
        left: 0;
        height: 6px;
        background: linear-gradient(90deg, #ff4444, #ff6666);
        border-radius: 3px;
        transform: translateY(-50%);
        z-index: 1;
        transition: all 0.3s ease;
    }

    .rating-display {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        margin-top: 8px;
    }

    .rating-value {
        font-size: 1.5em;
        font-weight: bold;
        color: #6200ea;
        min-width: 24px;
        text-align: center;
    }

    .rating-unit {
        font-size: 1em;
        color: #666;
    }

    /* 深色模式适配 */
    @media (prefers-color-scheme: dark) {
        .rating-labels {
            color: #aaa;
        }
        
        .slider-track {
            background: #444;
        }
        
        .rating-unit {
            color: #aaa;
        }
    }

    /* 出血点选择器美化样式 */
    .bleeding-selector-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .custom-select-wrapper {
        position: relative;
        width: 100%;
    }

    .custom-select {
        width: 100%;
        padding: 16px 48px 16px 16px;
        font-size: 16px;
        font-weight: 500;
        color: #333;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        border: 2px solid #e1e5e9;
        border-radius: 12px;
        outline: none;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    /* 取消出血点选择框悬停高亮效果 */

    .custom-select:focus {
        border-color: #6200ea;
        box-shadow: 0 0 0 3px rgba(98, 0, 234, 0.1);
        background: linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%);
    }

    .custom-select:active {
        transform: translateY(0);
    }

    .select-arrow {
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        color: #666;
        pointer-events: none;
        transition: all 0.3s ease;
        z-index: 1;
    }

    .custom-select:focus + .select-arrow {
        color: #6200ea;
        transform: translateY(-50%) rotate(180deg);
    }

    .custom-select option {
        padding: 12px 16px;
        font-size: 16px;
        font-weight: 500;
        background: #ffffff;
        color: #333;
        border: none;
    }

    .custom-select option:hover {
        background: #f0f4ff;
        color: #6200ea;
    }

    .custom-select option:checked {
        background: #6200ea;
        color: #ffffff;
    }

    .other-input-container {
        animation: slideDown 0.3s ease-out;
        overflow: hidden;
    }

    .other-input-wrapper {
        position: relative;
        width: 100%;
    }

    .other-text-input {
        width: 100%;
        padding: 16px 48px 16px 16px;
        font-size: 16px;
        font-weight: 500;
        color: #333;
        background: linear-gradient(135deg, #fff5f5 0%, #fef2f2 100%);
        border: 2px solid #fecaca;
        border-radius: 12px;
        outline: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.1);
    }

    .other-text-input:focus {
        border-color: #ef4444;
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);
    }

    .other-text-input::placeholder {
        color: #9ca3af;
        font-weight: 400;
    }

    .input-icon {
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 18px;
        color: #ef4444;
        pointer-events: none;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            max-height: 100px;
            transform: translateY(0);
        }
    }

    /* 移动端优化 */
    @media (max-width: 768px) {
        .custom-select {
            padding: 18px 48px 18px 18px;
            font-size: 17px;
        }

        .other-text-input {
            padding: 18px 48px 18px 18px;
            font-size: 17px;
        }

        .select-arrow {
            right: 18px;
        }

        .input-icon {
            right: 18px;
        }
    }

    /* 深色模式适配 */
    @media (prefers-color-scheme: dark) {
        .custom-select {
            background: #1e1e1e;
            border-color: #444;
            color: #f9fafb;
        }

        /* 取消深色模式出血点选择框悬停高亮效果 */

        .custom-select:focus {
            border-color: #a78bfa;
            box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.2);
            background: #222;
        }

        .select-arrow {
            color: #9ca3af;
        }

        .custom-select:focus + .select-arrow {
            color: #a78bfa;
        }

        .custom-select option {
            background: #1e1e1e;
            color: #f9fafb;
        }

        .custom-select option:hover {
            background: #333;
            color: #a78bfa;
        }

        .custom-select option:checked {
            background: #a78bfa;
            color: #1f2937;
        }

        .other-text-input {
            background: linear-gradient(135deg, #2d1b1b 0%, #1f1b1b 100%);
            border-color: #7f1d1d;
            color: #f9fafb;
        }

        .other-text-input:focus {
            border-color: #dc2626;
            box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
            background: linear-gradient(135deg, #1f2937 0%, #2d1b1b 100%);
        }

        .other-text-input::placeholder {
            color: #6b7280;
        }

        .input-icon {
            color: #dc2626;
        }
    }

    /* 高对比度模式 */
    @media (prefers-contrast: high) {
        .custom-select {
            border-width: 3px;
        }

        .other-text-input {
            border-width: 3px;
        }
    }

    /* 减少动画模式 */
    @media (prefers-reduced-motion: reduce) {
        .custom-select,
        .other-text-input,
        .select-arrow,
        .other-input-container {
            transition: none;
        }

        .other-input-container {
            animation: none;
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

                // 回写本地（不覆盖现有 userId 键，仅更新 user_profile 和 username）
                try {
                    const merged = Object.assign({}, cached || {}, { user_id, username });
                    localStorage.setItem('user_profile', JSON.stringify(merged));
                    if (username) localStorage.setItem('username', username);
                } catch(_) {}

                return { user_id, username };
            }
        } catch (e) {
            console.warn('resolveUserIdentity 通过 user_id 调用 /readdata 失败:', e);
        }
        // 查询失败时，至少返回 user_id，username 留空
        return { user_id, username: '' };
    }

    // 兜底为空
    return { user_id: '', username: '' };
}

// 尿液检测指标矩阵相关函数
let urinalysisItemIndex = 0;

// 添加尿液检测项目
function addUrinalysisItem(selectedItem = '', value = '', index = null) {
    const container = document.getElementById('urinalysis-matrix-container');
    if (!container) return;
    
    // 添加按钮点击动画
    const addBtn = document.querySelector('.add-btn');
    if (addBtn) {
        addBtn.classList.add('clicking');
        setTimeout(() => {
            addBtn.classList.remove('clicking');
        }, 300);
    }
    
    // 添加按钮点击时的震动反馈
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Medium');
    } catch(_) {}
    
    const itemIndex = index !== null ? index : urinalysisItemIndex++;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'urinalysis-item';
    
    itemDiv.innerHTML = `
        <div class="item-header">
            <select class="urinalysis-select" data-index="${itemIndex}">
                <option value="">请选择检测项目</option>
                <option value="ph" data-unit="" data-reference="5.0-8.0">pH</option>
                <option value="color" data-unit="" data-reference="颜色">颜色</option>
                <option value="nitrite" data-unit="" data-reference="阴性">亚硝酸盐</option>
                <option value="glucose" data-unit="" data-reference="阴性">葡萄糖</option>
                <option value="specific-gravity" data-unit="" data-reference="1.005-1.030">比重</option>
                <option value="occult-blood" data-unit="" data-reference="阴性">隐血</option>
                <option value="protein" data-unit="" data-reference="阴性">蛋白质</option>
                <option value="bilirubin" data-unit="" data-reference="阴性">胆红素</option>
                <option value="leukocyte-esterase" data-unit="" data-reference="阴性">白细胞酯酶</option>
                <option value="rbc-count" data-unit="/μl" data-reference="0-17.0">红细胞（定量）</option>
                <option value="wbc-count" data-unit="/μl" data-reference="0-28.0">白细胞（定量）</option>
                <option value="hyaline-casts" data-unit="/μl" data-reference="0-1">透明管型</option>
                <option value="conductivity" data-unit="mS/cm" data-reference="5-32">电导率</option>
                <option value="crystals" data-unit="/μl" data-reference="">结晶</option>
                <option value="osmolality" data-unit="mOsm/kgH2O" data-reference="40-1400">渗透压</option>
                <option value="mucus" data-unit="/μl" data-reference="0-46">粘液丝</option>
                <option value="squamous-epithelial" data-unit="/μl" data-reference="0-28">鳞状上皮细胞</option>
                <option value="nonsquamous-epithelial" data-unit="/μl" data-reference="0-6">非鳞状上皮细胞</option>
                <option value="wbc-clumps" data-unit="/μl" data-reference="0-2.0">白细胞团</option>
                <option value="urine-creatinine" data-unit="g/L" data-reference="0.1-2.0">尿肌酐</option>
                <option value="up-cr" data-unit="mg/gCr" data-reference="0-30">尿白蛋白/尿肌酐</option>
                <option value="vitamin-c" data-unit="" data-reference="阴性">维生素C</option>
                <option value="urine-rbc" data-unit="/μl" data-reference="0.0-30.7">尿红细胞计数</option>
                <option value="urine-wbc" data-unit="/μl" data-reference="0.0-39.0">尿白细胞计数</option>
                <option value="urine-epithelial" data-unit="/μl" data-reference="0.0-45.6">尿上皮细胞计数</option>
                <option value="custom" data-unit="" data-reference="">自定义项目</option>
            </select>
            <button type="button" class="remove-btn" onclick="removeUrinalysisItem(this)" onmousedown="try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}">×</button>
        </div>
        <div class="custom-input-wrapper" style="display: none;">
            <input type="text" class="custom-urinalysis-name" placeholder="请输入自定义项目名称" data-index="${itemIndex}">
        </div>
        <div class="item-input">
            <input type="text" class="urinalysis-value" placeholder="请输入数值" data-index="${itemIndex}" value="${value}">
            <div class="unit-reference">
                <span class="unit-display">单位</span>
                <span class="reference-display">参考值</span>
            </div>
        </div>
    `;
    
    container.appendChild(itemDiv);
    
    // 如果提供了选中的项目，设置选择器
    if (selectedItem) {
        const select = itemDiv.querySelector('.urinalysis-select');
        select.value = selectedItem;
        updateUnitReference(select);
    }
    
    // 添加事件监听器
    const select = itemDiv.querySelector('.urinalysis-select');
    select.addEventListener('change', function() {
        updateUnitReference(this);
        toggleCustomInput(this);
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Medium');
        } catch(_) {}
    });
    
    // 选择器聚焦时的震动
    select.addEventListener('focus', function() {
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Light');
        } catch(_) {}
    });
    
    const valueInput = itemDiv.querySelector('.urinalysis-value');
    let inputTimer;
    
    valueInput.addEventListener('input', function() {
        // 清除之前的定时器
        if (inputTimer) {
            clearTimeout(inputTimer);
        }
        
        // 防抖处理，避免过于频繁的震动
        inputTimer = setTimeout(() => {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        }, 200);
    });
    
    // 输入框聚焦时的震动
    valueInput.addEventListener('focus', function() {
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Light');
        } catch(_) {}
    });
    
    // 输入框失去焦点时的震动（输入完成）
    valueInput.addEventListener('blur', function() {
        if (this.value.trim()) {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Medium');
            } catch(_) {}
        }
    });
    
    // 更新删除按钮显示状态
    updateRemoveButtons();
    
    // 添加震动反馈 - 添加项目时使用强震动
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Heavy');
    } catch(_) {}
}

// 删除尿液检测项目
function removeUrinalysisItem(button) {
    const item = button.closest('.urinalysis-item');
    if (item) {
        // 删除按钮动画
        button.classList.add('removing');
        
        // 删除前的震动反馈
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Medium');
        } catch(_) {}
        
        // 添加项目滑出动画
        item.classList.add('removing');
        
        // 等待动画完成后删除元素
        setTimeout(() => {
            item.remove();
            updateRemoveButtons();
            
            // 删除完成后的震动反馈
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Heavy');
            } catch(_) {}
        }, 400); // 增加时间以匹配CSS动画时长
    }
}

// 更新单位和参考值显示
function updateUnitReference(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const unitDisplay = selectElement.closest('.urinalysis-item').querySelector('.unit-display');
    const referenceDisplay = selectElement.closest('.urinalysis-item').querySelector('.reference-display');
    
    if (selectedOption && unitDisplay && referenceDisplay) {
        const unit = selectedOption.getAttribute('data-unit') || '';
        const reference = selectedOption.getAttribute('data-reference') || '';
        
        // 添加更新动画
        unitDisplay.classList.add('updating');
        referenceDisplay.classList.add('updating');
        
        // 更新内容
        unitDisplay.textContent = unit || '单位';
        referenceDisplay.textContent = reference || '参考值';
        
        // 动画完成后移除类
        setTimeout(() => {
            unitDisplay.classList.remove('updating');
            referenceDisplay.classList.remove('updating');
        }, 300);
    }
}

// 更新删除按钮显示状态
function updateRemoveButtons() {
    const items = document.querySelectorAll('.urinalysis-item');
    const removeButtons = document.querySelectorAll('.remove-btn');
    
    // 如果只有一个项目，隐藏删除按钮
    removeButtons.forEach(button => {
        button.style.display = items.length > 1 ? 'flex' : 'none';
    });
}

// 血常规检测指标矩阵相关函数
let bloodTestItemIndex = 0;

// 切换自定义输入框显示/隐藏
function toggleCustomInput(selectElement) {
    const itemDiv = selectElement.closest('.blood-test-item, .urinalysis-item');
    if (!itemDiv) return;
    
    const customWrapper = itemDiv.querySelector('.custom-input-wrapper');
    if (!customWrapper) return;
    
    if (selectElement.value === 'custom') {
        customWrapper.style.display = 'block';
        // 添加动画效果
        customWrapper.style.opacity = '0';
        customWrapper.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            customWrapper.style.transition = 'all 0.3s ease';
            customWrapper.style.opacity = '1';
            customWrapper.style.transform = 'translateY(0)';
        }, 10);
    } else {
        customWrapper.style.display = 'none';
        // 清除自定义输入框的值
        const customInput = customWrapper.querySelector('input');
        if (customInput) {
            customInput.value = '';
        }
    }
}

// 添加血常规检测项目
function addBloodTestItem(selectedItem = '', value = '', index = null) {
    const container = document.getElementById('blood-test-matrix-container');
    if (!container) return;
    
    // 添加按钮点击动画
    const addBtn = document.querySelector('.add-btn');
    if (addBtn) {
        addBtn.classList.add('clicking');
        setTimeout(() => {
            addBtn.classList.remove('clicking');
        }, 300);
    }
    
    // 添加按钮点击时的震动反馈
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Medium');
    } catch(_) {}
    
    const itemIndex = index !== null ? index : bloodTestItemIndex++;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'blood-test-item';
    
    itemDiv.innerHTML = `
        <div class="item-header">
            <select class="blood-test-select" data-index="${itemIndex}">
                <option value="">请选择检测项目</option>
                <!-- 白细胞相关 -->
                <option value="wbc-count" data-unit="×10⁹/L" data-reference="4-10">白细胞计数</option>
                <option value="neutrophils-abs" data-unit="×10⁹/L" data-reference="2-7.5">中性粒细胞(绝对值)</option>
                <option value="lymphocytes-abs" data-unit="×10⁹/L" data-reference="0.8-4">淋巴细胞(绝对值)</option>
                <option value="monocytes-abs" data-unit="×10⁹/L" data-reference="0.16-1.2">单核细胞(绝对值)</option>
                <option value="eosinophils-abs" data-unit="×10⁹/L" data-reference="0.02-0.5">嗜酸性粒细胞(绝对值)</option>
                <option value="basophils-abs" data-unit="×10⁹/L" data-reference="0-0.1">嗜碱性粒细胞(绝对值)</option>
                <option value="neutrophils-percent" data-unit="%" data-reference="50-75">中性粒细胞(百分比)</option>
                <option value="lymphocytes-percent" data-unit="%" data-reference="20-40">淋巴细胞(百分比)</option>
                <option value="monocytes-percent" data-unit="%" data-reference="4-12">单核细胞(百分比)</option>
                <option value="eosinophils-percent" data-unit="%" data-reference="0.5-5">嗜酸性粒细胞(百分比)</option>
                <option value="basophils-percent" data-unit="%" data-reference="0-1">嗜碱性粒细胞(百分比)</option>
                <!-- 红细胞相关 -->
                <option value="rbc-count" data-unit="×10¹²/L" data-reference="3.5-5.5">红细胞计数</option>
                <option value="hemoglobin" data-unit="g/L" data-reference="110-160">血红蛋白</option>
                <option value="hematocrit" data-unit="%" data-reference="37-49">红细胞压积</option>
                <option value="mcv" data-unit="fL" data-reference="82-95">平均红细胞体积</option>
                <option value="mch" data-unit="pg" data-reference="27-31">平均红细胞血红蛋白量</option>
                <option value="mchc" data-unit="g/L" data-reference="320-360">平均红细胞血红蛋白浓度</option>
                <option value="rdw-sd" data-unit="fL" data-reference="37-54">红细胞分布宽度(SD)</option>
                <option value="rdw-cv" data-unit="%" data-reference="11-16">红细胞分布宽度(CV)</option>
                <!-- 血小板相关 -->
                <option value="platelet-count" data-unit="×10⁹/L" data-reference="100-300">血小板计数</option>
                <option value="pdw" data-unit="fL" data-reference="9-17">血小板分布宽度</option>
                <option value="mpv" data-unit="fL" data-reference="9.4-12.5">平均血小板体积</option>
                <option value="pct" data-unit="%" data-reference="0.11-0.27">血小板压积</option>
                <option value="p-lcr" data-unit="%" data-reference="13-43">大型血小板比率</option>
                <option value="custom" data-unit="" data-reference="">自定义项目</option>
            </select>
            <button type="button" class="remove-btn" onclick="removeBloodTestItem(this)" onmousedown="try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}">×</button>
        </div>
        <div class="custom-input-wrapper" style="display: none;">
            <input type="text" class="custom-blood-test-name" placeholder="请输入自定义项目名称" data-index="${itemIndex}">
        </div>
        <div class="item-input">
            <input type="text" class="blood-test-value" placeholder="请输入数值" data-index="${itemIndex}" value="${value}">
            <div class="unit-reference">
                <span class="unit-display">单位</span>
                <span class="reference-display">参考值</span>
            </div>
        </div>
    `;
    
    container.appendChild(itemDiv);
    
    // 如果提供了选中的项目，设置选择器
    if (selectedItem) {
        const select = itemDiv.querySelector('.blood-test-select');
        select.value = selectedItem;
        updateBloodTestUnitReference(select);
    }
    
    // 添加事件监听器
    const select = itemDiv.querySelector('.blood-test-select');
    select.addEventListener('change', function() {
        updateBloodTestUnitReference(this);
        toggleCustomInput(this);
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Medium');
        } catch(_) {}
    });
    
    // 选择器聚焦时的震动
    select.addEventListener('focus', function() {
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Light');
        } catch(_) {}
    });
    
    const valueInput = itemDiv.querySelector('.blood-test-value');
    let inputTimer;
    
    valueInput.addEventListener('input', function() {
        // 清除之前的定时器
        if (inputTimer) {
            clearTimeout(inputTimer);
        }
        
        // 防抖处理，避免过于频繁的震动
        inputTimer = setTimeout(() => {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        }, 200);
    });
    
    // 输入框聚焦时的震动
    valueInput.addEventListener('focus', function() {
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Light');
        } catch(_) {}
    });
    
    // 输入框失去焦点时的震动（输入完成）
    valueInput.addEventListener('blur', function() {
        if (this.value.trim()) {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Medium');
            } catch(_) {}
        }
    });
    
    // 更新删除按钮显示状态
    updateBloodTestRemoveButtons();
    
    // 添加震动反馈 - 添加项目时使用强震动
    try {
        window.__hapticImpact__ && window.__hapticImpact__('Heavy');
    } catch(_) {}
}

// 删除血常规检测项目
function removeBloodTestItem(button) {
    const item = button.closest('.blood-test-item');
    if (item) {
        // 删除按钮动画
        button.classList.add('removing');
        
        // 删除前的震动反馈
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Medium');
        } catch(_) {}
        
        // 添加项目滑出动画
        item.classList.add('removing');
        
        // 等待动画完成后删除元素
        setTimeout(() => {
            item.remove();
            updateBloodTestRemoveButtons();
            
            // 删除完成后的震动反馈
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Heavy');
            } catch(_) {}
        }, 400); // 增加时间以匹配CSS动画时长
    }
}

// 更新血常规单位和参考值显示
function updateBloodTestUnitReference(selectElement) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const unitDisplay = selectElement.closest('.blood-test-item').querySelector('.unit-display');
    const referenceDisplay = selectElement.closest('.blood-test-item').querySelector('.reference-display');
    
    if (selectedOption && unitDisplay && referenceDisplay) {
        const unit = selectedOption.getAttribute('data-unit') || '';
        const reference = selectedOption.getAttribute('data-reference') || '';
        
        // 添加更新动画
        unitDisplay.classList.add('updating');
        referenceDisplay.classList.add('updating');
        
        // 更新内容
        unitDisplay.textContent = unit || '单位';
        referenceDisplay.textContent = reference || '参考值';
        
        // 动画完成后移除类
        setTimeout(() => {
            unitDisplay.classList.remove('updating');
            referenceDisplay.classList.remove('updating');
        }, 300);
    }
}

// 更新血常规删除按钮显示状态
function updateBloodTestRemoveButtons() {
    const items = document.querySelectorAll('.blood-test-item');
    const removeButtons = document.querySelectorAll('.blood-test-item .remove-btn');
    
    // 如果只有一个项目，隐藏删除按钮
    removeButtons.forEach(button => {
        button.style.display = items.length > 1 ? 'flex' : 'none';
    });
}

// 初始化血常规检测指标矩阵
function initBloodTestMatrix() {
    const container = document.getElementById('blood-test-matrix-container');
    if (!container) return;
    
    // 为现有的选择器添加事件监听器
    const existingSelects = container.querySelectorAll('.blood-test-select');
    existingSelects.forEach(select => {
        select.addEventListener('change', function() {
            updateBloodTestUnitReference(this);
            toggleCustomInput(this);
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Medium');
            } catch(_) {}
        });
        
        // 选择器聚焦时的震动
        select.addEventListener('focus', function() {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });
    });
    
    const existingInputs = container.querySelectorAll('.blood-test-value');
    existingInputs.forEach(input => {
        let inputTimer;
        
        input.addEventListener('input', function() {
            // 清除之前的定时器
            if (inputTimer) {
                clearTimeout(inputTimer);
            }
            
            // 防抖处理，避免过于频繁的震动
            inputTimer = setTimeout(() => {
                try {
                    window.__hapticImpact__ && window.__hapticImpact__('Light');
                } catch(_) {}
            }, 200);
        });
        
        // 输入框聚焦时的震动
        input.addEventListener('focus', function() {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });
        
        // 输入框失去焦点时的震动（输入完成）
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                try {
                    window.__hapticImpact__ && window.__hapticImpact__('Medium');
                } catch(_) {}
            }
        });
    });
    
    // 初始化删除按钮状态
    updateBloodTestRemoveButtons();
}

// 初始化尿液检测指标矩阵
function initUrinalysisMatrix() {
    const container = document.getElementById('urinalysis-matrix-container');
    if (!container) return;
    
    // 为现有的选择器添加事件监听器
    const existingSelects = container.querySelectorAll('.urinalysis-select');
    existingSelects.forEach(select => {
        select.addEventListener('change', function() {
            updateUnitReference(this);
            toggleCustomInput(this);
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Medium');
            } catch(_) {}
        });
        
        // 选择器聚焦时的震动
        select.addEventListener('focus', function() {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });
    });
    
    const existingInputs = container.querySelectorAll('.urinalysis-value');
    existingInputs.forEach(input => {
        let inputTimer;
        
        input.addEventListener('input', function() {
            // 清除之前的定时器
            if (inputTimer) {
                clearTimeout(inputTimer);
            }
            
            // 防抖处理，避免过于频繁的震动
            inputTimer = setTimeout(() => {
                try {
                    window.__hapticImpact__ && window.__hapticImpact__('Light');
                } catch(_) {}
            }, 200);
        });
        
        // 输入框聚焦时的震动
        input.addEventListener('focus', function() {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });
        
        // 输入框失去焦点时的震动（输入完成）
        input.addEventListener('blur', function() {
            if (this.value.trim()) {
                try {
                    window.__hapticImpact__ && window.__hapticImpact__('Medium');
                } catch(_) {}
            }
        });
    });
    
    // 初始化删除按钮状态
    updateRemoveButtons();
}

// 导出健康指标数据为JSON文件
function exportMetricsData() {
    try {
        // 添加震动反馈
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Medium');
        } catch(_) {}
        
        // 收集所有指标数据
        let allData = {};
        let hasValidData = false;
        
        // 安全获取元素值的辅助函数
        function getElementValue(id) {
            const el = document.getElementById(id);
            return el ? el.value : '';
        }
        
        // 症状数据
        const symptoms = getElementValue('symptoms-input').trim();
        if (symptoms) {
            allData.symptoms = {
                symptoms
            };
            hasValidData = true;
        }
        
        // 体温数据
        const temp = getElementValue('temperature-input');
        console.log('导出时体温输入值:', temp);
        if (temp && !isNaN(parseFloat(temp))) {
            const tempValue = parseFloat(temp);
            console.log('导出时体温数值:', tempValue);
            if (tempValue >= 35 && tempValue <= 45) {
                allData['temperature'] = {
                    temperature: tempValue
                };
                hasValidData = true;
                console.log('导出时体温数据已保存:', allData['temperature']);
            } else {
                console.log('导出时体温超出范围:', tempValue);
            }
        } else {
            console.log('导出时体温输入无效:', temp);
        }
        
        // 尿常规数据
        const protein = getElementValue('protein-input').trim();
        const glucose = getElementValue('glucose-input').trim();
        const ketones = getElementValue('ketones-input').trim();
        const blood = getElementValue('blood-input').trim();
        
        if (protein || glucose || ketones || blood) {
            allData.urinalysis = {
                protein, glucose, ketones, blood
            };
            hasValidData = true;
        }
        
        // 24h尿蛋白数据
        const protein24h = getElementValue('proteinuria-input');
        if (protein24h && !isNaN(parseFloat(protein24h))) {
            const proteinValue = parseFloat(protein24h);
            if (proteinValue >= 0) {
                allData.proteinuria = {
                    proteinuria24h: proteinValue
                };
                hasValidData = true;
            }
        }
        
        // 血常规数据
        const wbc = getElementValue('wbc-input');
        const rbc = getElementValue('rbc-input');
        const hb = getElementValue('hb-input');
        const plt = getElementValue('plt-input');
        
        const bloodData = {};
        if (wbc && !isNaN(parseFloat(wbc))) bloodData.wbc = parseFloat(wbc);
        if (rbc && !isNaN(parseFloat(rbc))) bloodData.rbc = parseFloat(rbc);
        if (hb && !isNaN(parseInt(hb))) bloodData.hb = parseInt(hb);
        if (plt && !isNaN(parseInt(plt))) bloodData.plt = parseInt(plt);
        
        if (Object.keys(bloodData).length > 0) {
            allData['blood-test'] = bloodData;
            hasValidData = true;
        }
        
        // 出血点数据
        const bleedingPoint = getElementValue('bleeding-point-select');
        const otherBleedingText = getElementValue('other-bleeding-text').trim();
        
        if (bleedingPoint) {
            const bleedingData = { bleedingPoint };
            if (bleedingPoint === 'other' && otherBleedingText) {
                bleedingData.otherDescription = otherBleedingText;
            }
            allData['bleeding-point'] = bleedingData;
            hasValidData = true;
        }
        
        // 自我评分数据
        const rating = getElementValue('self-rating-slider');
        if (rating && !isNaN(parseInt(rating))) {
            const ratingValue = parseInt(rating);
            if (ratingValue >= 0 && ratingValue <= 10) {
                allData['self-rating'] = {
                    selfRating: ratingValue
                };
                hasValidData = true;
            }
        }
        
        // 尿液检测指标矩阵数据
        const urinalysisItems = document.querySelectorAll('.urinalysis-item');
        const urinalysisData = [];
        
        urinalysisItems.forEach((item, index) => {
            const select = item.querySelector('.urinalysis-select');
            const valueInput = item.querySelector('.urinalysis-value');
            
            if (select && select.value && valueInput && valueInput.value.trim()) {
                urinalysisData.push({
                    item: select.value,
                    value: valueInput.value.trim(),
                    index: index
                });
            }
        });
        
        if (urinalysisData.length > 0) {
            allData['urinalysis-matrix'] = {
                urinalysisMatrix: urinalysisData
            };
            hasValidData = true;
        }
        
        if (!hasValidData) {
            showToast('没有数据可导出，请先填写一些指标数据');
            return;
        }
        
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
                dataType: 'health_metrics'
            },
            metricsData: allData
        };
        
        // 转换为JSON字符串
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // 创建Blob对象
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // 生成文件名（包含时间戳）
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        link.download = `health_metrics_${timestamp}.json`;
        
        // 触发下载
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理URL对象
        URL.revokeObjectURL(url);
        
        // 显示成功提示
        showToast(`成功导出 ${Object.keys(allData).length} 项指标数据！`);
        
        // 成功导出的强震动反馈
        try {
            window.__hapticImpact__ && window.__hapticImpact__('Heavy');
        } catch(_) {}
        
        console.log('导出健康指标数据:', exportData);
        
    } catch (error) {
        console.error('导出数据失败:', error);
        showToast('导出失败，请重试');
    }
}

// 清除所有表单数据
function clearAllFormData() {
    try {
        // 清除所有输入框
        const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input[type="time"], textarea, select');
        inputs.forEach(input => {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
            } else {
                input.value = '';
            }
        });
        
        // 清除滑块值
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            slider.value = slider.min || 0;
            // 更新滑块显示
            const valueDisplay = slider.parentElement.querySelector('.slider-value');
            if (valueDisplay) {
                valueDisplay.textContent = slider.value;
            }
            // 更新自我评分滑块显示
            const ratingValue = document.getElementById('rating-value');
            if (ratingValue) {
                ratingValue.textContent = slider.value;
            }
            // 更新滑块填充效果
            updateSliderFill(parseInt(slider.value));
        });
        
        // 清除血常规检测矩阵
        const bloodTestItems = document.querySelectorAll('.blood-test-item');
        bloodTestItems.forEach(item => {
            const select = item.querySelector('.blood-test-select');
            const valueInput = item.querySelector('.blood-test-value');
            const customNameInput = item.querySelector('.custom-blood-test-name');
            if (select) select.value = '';
            if (valueInput) valueInput.value = '';
            if (customNameInput) customNameInput.value = '';
        });
        
        // 清除尿液检测矩阵
        const urinalysisItems = document.querySelectorAll('.urinalysis-item');
        urinalysisItems.forEach(item => {
            const select = item.querySelector('.urinalysis-select');
            const valueInput = item.querySelector('.urinalysis-value');
            const customNameInput = item.querySelector('.custom-urinalysis-name');
            if (select) select.value = '';
            if (valueInput) valueInput.value = '';
            if (customNameInput) customNameInput.value = '';
        });
        
        // 重置血常规检测矩阵到初始状态（只保留一个空项目）
        const bloodTestContainer = document.getElementById('blood-test-matrix-container');
        if (bloodTestContainer) {
            bloodTestContainer.innerHTML = `
                <div class="blood-test-item">
                    <div class="item-header">
                        <select class="blood-test-select" data-index="0">
                            <option value="">请选择检测项目</option>
                            <!-- 白细胞相关 -->
                            <option value="wbc-count" data-unit="×10⁹/L" data-reference="4-10">白细胞计数</option>
                            <option value="neutrophils-abs" data-unit="×10⁹/L" data-reference="2-7.5">中性粒细胞(绝对值)</option>
                            <option value="lymphocytes-abs" data-unit="×10⁹/L" data-reference="0.8-4">淋巴细胞(绝对值)</option>
                            <option value="monocytes-abs" data-unit="×10⁹/L" data-reference="0.16-1.2">单核细胞(绝对值)</option>
                            <option value="eosinophils-abs" data-unit="×10⁹/L" data-reference="0.02-0.5">嗜酸性粒细胞(绝对值)</option>
                            <option value="basophils-abs" data-unit="×10⁹/L" data-reference="0-0.1">嗜碱性粒细胞(绝对值)</option>
                            <option value="neutrophils-percent" data-unit="%" data-reference="50-75">中性粒细胞(百分比)</option>
                            <option value="lymphocytes-percent" data-unit="%" data-reference="20-40">淋巴细胞(百分比)</option>
                            <option value="monocytes-percent" data-unit="%" data-reference="4-12">单核细胞(百分比)</option>
                            <option value="eosinophils-percent" data-unit="%" data-reference="0.5-5">嗜酸性粒细胞(百分比)</option>
                            <option value="basophils-percent" data-unit="%" data-reference="0-1">嗜碱性粒细胞(百分比)</option>
                            <!-- 红细胞相关 -->
                            <option value="rbc-count" data-unit="×10¹²/L" data-reference="3.5-5.5">红细胞计数</option>
                            <option value="hemoglobin" data-unit="g/L" data-reference="110-160">血红蛋白</option>
                            <option value="hematocrit" data-unit="%" data-reference="37-49">红细胞压积</option>
                            <option value="mcv" data-unit="fL" data-reference="82-95">平均红细胞体积</option>
                            <option value="mch" data-unit="pg" data-reference="27-31">平均红细胞血红蛋白量</option>
                            <option value="mchc" data-unit="g/L" data-reference="320-360">平均红细胞血红蛋白浓度</option>
                            <option value="rdw-sd" data-unit="fL" data-reference="37-54">红细胞分布宽度(SD)</option>
                            <option value="rdw-cv" data-unit="%" data-reference="11-16">红细胞分布宽度(CV)</option>
                            <!-- 血小板相关 -->
                            <option value="platelet-count" data-unit="×10⁹/L" data-reference="100-300">血小板计数</option>
                            <option value="pdw" data-unit="fL" data-reference="9-17">血小板分布宽度</option>
                            <option value="mpv" data-unit="fL" data-reference="9.4-12.5">平均血小板体积</option>
                            <option value="pct" data-unit="%" data-reference="0.11-0.27">血小板压积</option>
                            <option value="p-lcr" data-unit="%" data-reference="13-43">大型血小板比率</option>
                            <option value="custom" data-unit="" data-reference="">自定义项目</option>
                        </select>
                        <button type="button" class="remove-btn" onclick="removeBloodTestItem(this)" style="display: none;" onmousedown="try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}">×</button>
                    </div>
                    <div class="custom-input-wrapper" style="display: none;">
                        <input type="text" class="custom-blood-test-name" placeholder="请输入自定义项目名称" data-index="0">
                    </div>
                    <div class="item-input">
                        <input type="text" class="blood-test-value" placeholder="请输入数值" data-index="0">
                        <div class="unit-reference">
                            <span class="unit-display">单位</span>
                            <span class="reference-display">参考值</span>
                        </div>
                    </div>
                </div>
            `;
            // 重新初始化血常规检测矩阵
            initBloodTestMatrix();
        }
        
        // 重置尿液检测矩阵到初始状态（只保留一个空项目）
        const container = document.getElementById('urinalysis-matrix-container');
        if (container) {
            container.innerHTML = `
                <div class="urinalysis-item">
                    <div class="item-header">
                        <select class="urinalysis-select" data-index="0">
                            <option value="">请选择检测项目</option>
                            <option value="ph" data-unit="" data-reference="5.0-8.0">pH</option>
                            <option value="color" data-unit="" data-reference="颜色">颜色</option>
                            <option value="nitrite" data-unit="" data-reference="阴性">亚硝酸盐</option>
                            <option value="glucose" data-unit="" data-reference="阴性">葡萄糖</option>
                            <option value="specific-gravity" data-unit="" data-reference="1.005-1.030">比重</option>
                            <option value="occult-blood" data-unit="" data-reference="阴性">隐血</option>
                            <option value="protein" data-unit="" data-reference="阴性">蛋白质</option>
                            <option value="bilirubin" data-unit="" data-reference="阴性">胆红素</option>
                            <option value="leukocyte-esterase" data-unit="" data-reference="阴性">白细胞酯酶</option>
                            <option value="rbc-count" data-unit="/μl" data-reference="0-17.0">红细胞（定量）</option>
                            <option value="wbc-count" data-unit="/μl" data-reference="0-28.0">白细胞（定量）</option>
                            <option value="hyaline-casts" data-unit="/μl" data-reference="0-1">透明管型</option>
                            <option value="conductivity" data-unit="mS/cm" data-reference="5-32">电导率</option>
                            <option value="crystals" data-unit="/μl" data-reference="">结晶</option>
                            <option value="osmolality" data-unit="mOsm/kgH2O" data-reference="40-1400">渗透压</option>
                            <option value="mucus" data-unit="/μl" data-reference="0-46">粘液丝</option>
                            <option value="squamous-epithelial" data-unit="/μl" data-reference="0-28">鳞状上皮细胞</option>
                            <option value="nonsquamous-epithelial" data-unit="/μl" data-reference="0-6">非鳞状上皮细胞</option>
                            <option value="wbc-clumps" data-unit="/μl" data-reference="0-2.0">白细胞团</option>
                            <option value="urine-creatinine" data-unit="g/L" data-reference="0.1-2.0">尿肌酐</option>
                            <option value="up-cr" data-unit="mg/gCr" data-reference="0-30">尿白蛋白/尿肌酐</option>
                            <option value="vitamin-c" data-unit="" data-reference="阴性">维生素C</option>
                            <option value="urine-rbc" data-unit="/μl" data-reference="0.0-30.7">尿红细胞计数</option>
                            <option value="urine-wbc" data-unit="/μl" data-reference="0.0-39.0">尿白细胞计数</option>
                            <option value="urine-epithelial" data-unit="/μl" data-reference="0.0-45.6">尿上皮细胞计数</option>
                            <option value="custom" data-unit="" data-reference="">自定义项目</option>
                        </select>
                        <button type="button" class="remove-btn" onclick="removeUrinalysisItem(this)" style="display: none;" onmousedown="try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}">×</button>
                    </div>
                    <div class="custom-input-wrapper" style="display: none;">
                        <input type="text" class="custom-urinalysis-name" placeholder="请输入自定义项目名称" data-index="0">
                    </div>
                    <div class="item-input">
                        <input type="text" class="urinalysis-value" placeholder="请输入数值" data-index="0">
                        <div class="unit-reference">
                            <span class="unit-display">单位</span>
                            <span class="reference-display">参考值</span>
                        </div>
                    </div>
                </div>
            `;
            // 重新初始化尿液检测矩阵
            initUrinalysisMatrix();
        }
        
        // 重置出血点选择
        const bleedingPointsList = document.getElementById('bleeding-points-list');
        if (bleedingPointsList) {
            bleedingPointsList.innerHTML = '';
            // 重新添加一个空的出血点项目
            addBleedingPoint();
        }
        
        // 清除出血点图片
        const bleedingImages = document.getElementById('bleedingUploadedImages');
        if (bleedingImages) {
            bleedingImages.innerHTML = '';
        }
        
        // 清除本地存储
        localStorage.removeItem('health_metrics_data');
        
        // 强制清除全局数据变量
        metricsData = {};
        
        console.log('所有表单数据已清除');
    } catch (error) {
        console.error('清除表单数据失败:', error);
    }
}

// 初始化JSON大小显示功能
function initJsonSizeDisplay() {
    // 绑定表单输入事件，实时更新JSON大小
    const formInputs = ['symptoms-input', 'temperature-input', 'proteinuria-input', 'wbc-input', 'rbc-input', 'hb-input', 'plt-input'];
    formInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', updateJsonSizeDisplay);
        }
    });
    
    // 为出血点选择器添加事件监听
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('bleeding-point-select') || e.target.classList.contains('other-bleeding-text')) {
            updateJsonSizeDisplay();
        }
    });
    
    // 为血常规检测矩阵添加事件监听
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('blood-test-select') || e.target.classList.contains('blood-test-value')) {
            updateJsonSizeDisplay();
        }
    });
    
    // 为尿液检测矩阵添加事件监听
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('urinalysis-select') || e.target.classList.contains('urinalysis-value')) {
            updateJsonSizeDisplay();
        }
    });
    
    // 为自我评分滑块添加事件监听
    const ratingSlider = document.getElementById('self-rating-slider');
    if (ratingSlider) {
        ratingSlider.addEventListener('input', updateJsonSizeDisplay);
    }
}

// 更新JSON大小显示
function updateJsonSizeDisplay() {
    // 收集当前数据
    const symptoms = document.getElementById('symptoms-input')?.value.trim() || '';
    const temperature = document.getElementById('temperature-input')?.value || '';
    const proteinuria = document.getElementById('proteinuria-input')?.value || '';
    const wbc = document.getElementById('wbc-input')?.value || '';
    const rbc = document.getElementById('rbc-input')?.value || '';
    const hb = document.getElementById('hb-input')?.value || '';
    const plt = document.getElementById('plt-input')?.value || '';
    
    // 收集出血点数据
    const bleedingPoints = [];
    const bleedingPointItems = document.querySelectorAll('.bleeding-point-item');
    bleedingPointItems.forEach(item => {
        const select = item.querySelector('.bleeding-point-select');
        const otherInput = item.querySelector('.other-bleeding-text');
        
        if (select && select.value) {
            const bleedingData = { bleedingPoint: select.value };
            if (select.value === 'other' && otherInput && otherInput.value.trim()) {
                bleedingData.otherDescription = otherInput.value.trim();
            }
            bleedingPoints.push(bleedingData);
        }
    });
    
    // 收集血常规检测矩阵数据
    const bloodTestData = [];
    const bloodTestItems = document.querySelectorAll('.blood-test-item');
    bloodTestItems.forEach((item, index) => {
        const select = item.querySelector('.blood-test-select');
        const valueInput = item.querySelector('.blood-test-value');
        
        if (select && select.value && valueInput && valueInput.value.trim()) {
            bloodTestData.push({
                item: select.value,
                value: valueInput.value.trim(),
                index: index
            });
        }
    });
    
    // 收集尿液检测矩阵数据
    const urinalysisData = [];
    const urinalysisItems = document.querySelectorAll('.urinalysis-item');
    urinalysisItems.forEach((item, index) => {
        const select = item.querySelector('.urinalysis-select');
        const valueInput = item.querySelector('.urinalysis-value');
        
        if (select && select.value && valueInput && valueInput.value.trim()) {
            urinalysisData.push({
                item: select.value,
                value: valueInput.value.trim(),
                index: index
            });
        }
    });
    
    // 收集图片数据
    const bleedingImages = [];
    const imageItems = document.querySelectorAll('#bleedingUploadedImages .uploaded-image-item img');
    imageItems.forEach(img => {
        bleedingImages.push(img.src);
    });
    
    // 收集自我评分数据
    const selfRating = document.getElementById('self-rating-slider')?.value || '';
    
    // 构建测试数据
    const testMetricsData = {
        symptoms: symptoms ? { symptoms } : null,
        temperature: temperature && !isNaN(parseFloat(temperature)) ? { temperature: parseFloat(temperature) } : null,
        proteinuria: proteinuria && !isNaN(parseFloat(proteinuria)) ? { proteinuria24h: parseFloat(proteinuria) } : null,
        'blood-test': (() => {
            const bloodData = {};
            if (wbc && !isNaN(parseFloat(wbc))) bloodData.wbc = parseFloat(wbc);
            if (rbc && !isNaN(parseFloat(rbc))) bloodData.rbc = parseFloat(rbc);
            if (hb && !isNaN(parseInt(hb))) bloodData.hb = parseInt(hb);
            if (plt && !isNaN(parseInt(plt))) bloodData.plt = parseInt(plt);
            return Object.keys(bloodData).length > 0 ? bloodData : null;
        })(),
        'bleeding-point': bleedingPoints.length > 0 || bleedingImages.length > 0 ? { bleedingPoints, bleedingImages } : null,
        'blood-test-matrix': bloodTestData.length > 0 ? { bloodTestMatrix: bloodTestData } : null,
        'urinalysis-matrix': urinalysisData.length > 0 ? { urinalysisMatrix: urinalysisData } : null,
        'self-rating': selfRating && !isNaN(parseInt(selfRating)) ? { selfRating: parseInt(selfRating) } : null,
        timestamp: new Date().toISOString(),
        id: 'test'
    };
    
    // 过滤掉null值
    Object.keys(testMetricsData).forEach(key => {
        if (testMetricsData[key] === null) {
            delete testMetricsData[key];
        }
    });
    
    const testPayload = {
        exportInfo: {
            exportTime: new Date().toLocaleString('zh-CN'),
            version: '1.0',
            appName: '紫癜精灵',
            dataType: 'health_metrics'
        },
        metricsData: testMetricsData
    };
    
    // 计算JSON大小
    const jsonString = JSON.stringify({ user_id: 'test', username: 'test', payload: testPayload });
    const jsonSizeKB = (new Blob([jsonString]).size / 1024).toFixed(1);
    const maxJsonSizeKB = 5120; // 5MB限制
    
    // 更新显示
    const sizeDisplay = document.getElementById('json-size-display');
    if (!sizeDisplay) return;
    
    // 检查是否有图片上传
    const hasImages = bleedingImages.length > 0;
    
    if (!hasImages) {
        // 没有图片时隐藏大小显示
        sizeDisplay.style.display = 'none';
        return;
    }
    
    // 有图片时显示大小
    sizeDisplay.style.display = 'block';
    const isOverLimit = jsonSizeKB > maxJsonSizeKB;
    sizeDisplay.innerHTML = `
        <div style="color: ${isOverLimit ? '#e74c3c' : '#27ae60'}; font-weight: 600;">
            当前数据大小: ${jsonSizeKB}KB / ${maxJsonSizeKB}KB
        </div>
        ${isOverLimit ? '<div style="color: #e74c3c; margin-top: 4px;">⚠️ 数据过大，请删除一些图片或减少文本内容</div>' : ''}
    `;
}

// 图片压缩函数（从病历页面复制）
function compressImage(file, callback, errorCallback, maxSizeKB = 500) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = function() {
        try {
            // 计算压缩后的尺寸
            let { width, height } = calculateCompressedSize(img.width, img.height, maxSizeKB);
            
            // 设置canvas尺寸
            canvas.width = width;
            canvas.height = height;
            
            // 绘制压缩后的图片
            ctx.drawImage(img, 0, 0, width, height);
            
            // 尝试不同的质量直到文件大小符合要求
            compressWithQuality(canvas, file.type, maxSizeKB, callback);
        } catch (error) {
            if (errorCallback) {
                errorCallback(error.message || '图片处理失败');
            }
        }
    };
    
    img.onerror = function() {
        if (errorCallback) {
            errorCallback('图片加载失败');
        }
    };
    
    img.src = URL.createObjectURL(file);
}

// 计算压缩后的尺寸
function calculateCompressedSize(originalWidth, originalHeight, maxSizeKB) {
    // 对于500KB限制，设置更小的最大尺寸以确保压缩效果
    const maxWidth = maxSizeKB <= 500 ? 1200 : 1920;
    const maxHeight = maxSizeKB <= 500 ? 900 : 1080;
    
    // 先按最大尺寸限制
    let width = originalWidth;
    let height = originalHeight;
    
    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
    }
    
    // 对于500KB，使用更保守的像素估算
    const estimatedBytesPerPixel = maxSizeKB <= 500 ? 0.3 : 0.2;
    const maxPixels = (maxSizeKB * 1024) / estimatedBytesPerPixel;
    const currentPixels = width * height;
    
    if (currentPixels <= maxPixels) {
        return { width, height };
    }
    
    // 进一步压缩尺寸
    const ratio = Math.sqrt(maxPixels / currentPixels);
    return {
        width: Math.floor(width * ratio),
        height: Math.floor(height * ratio)
    };
}

// 使用不同质量压缩
function compressWithQuality(canvas, mimeType, maxSizeKB, callback, quality = null) {
    // 根据目标大小设置起始质量，对于500KB使用更低的质量
    if (quality === null) {
        quality = maxSizeKB <= 500 ? 0.6 : 0.8;
    }
    
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const sizeKB = (dataUrl.length * 0.75) / 1024; // Base64转字节再转KB
    
    console.log(`压缩质量: ${quality.toFixed(1)}, 文件大小: ${sizeKB.toFixed(1)}KB`);
    
    if (sizeKB <= maxSizeKB || quality <= 0.1) {
        callback(dataUrl);
    } else {
        // 降低质量继续压缩，对于500KB使用更大的步长
        const step = maxSizeKB <= 500 ? 0.1 : 0.05;
        compressWithQuality(canvas, mimeType, maxSizeKB, callback, quality - step);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initMetricsPage);

// 支持键盘导航
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        goBack();
    }
});

// 页面离开前保存数据
window.addEventListener('beforeunload', function() {
    saveMetricsData();
});
