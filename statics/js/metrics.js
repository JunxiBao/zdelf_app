// 全局变量存储指标数据
let metricsData = {};

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
    // 从本地存储加载已保存的数据
    loadMetricsData();

    // 为全局保存按钮添加涟漪效果
    const globalSaveBtn = document.querySelector('.global-save-btn');
    if (globalSaveBtn) {
        globalSaveBtn.addEventListener('click', function(e) {
            attachButtonRipple(this);
        });
    }

    // 初始化出血点选择功能
    initBleedingPointSelection();

    // 初始化自我评分滑块功能
    initSelfRatingSlider();

    // 初始化尿液检测指标矩阵
    initUrinalysisMatrix();

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

    const saveBtn = document.querySelector('.global-save-btn');
    const spinner = document.getElementById('global-spinner');
    const btnText = saveBtn.querySelector('.btn-text');

    // 禁用按钮并显示保存中状态
    const originalText = btnText.textContent;
    saveBtn.disabled = true;
    btnText.textContent = '保存中...';
    spinner.classList.add('show');

    try {
        let allData = {};
        let hasValidData = false;

        // 收集所有指标数据
        const metricTypes = ['symptoms', 'temperature', 'urinalysis', 'proteinuria', 'blood-test', 'bleeding-point', 'self-rating', 'urinalysis-matrix'];

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
                    if (temp && !isNaN(parseFloat(temp))) {
                        const tempValue = parseFloat(temp);
                        if (tempValue >= 35 && tempValue <= 45) {
                            data = { temperature: tempValue };
                            hasValidData = true;
                        }
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
                    const _bpEl = document.getElementById('bleeding-point-select');
                    const _bpOtherEl = document.getElementById('other-bleeding-text');
                    const bleedingPoint = _bpEl ? _bpEl.value : '';
                    const otherBleedingText = _bpOtherEl ? _bpOtherEl.value.trim() : '';
                    
                    if (bleedingPoint) {
                        data = { bleedingPoint };
                        if (bleedingPoint === 'other' && otherBleedingText) {
                            data.otherDescription = otherBleedingText;
                        }
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

                case 'urinalysis-matrix':
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
                        data = { urinalysisMatrix: urinalysisData };
                        hasValidData = true;
                    }
                    break;
            }

            if (Object.keys(data).length > 0) {
                allData[metricType] = {
                    ...data,
                    timestamp: new Date().toISOString()
                };
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
                const payload = {
                    exportInfo: {
                        exportTime: new Date().toISOString(),
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
                } else {
                    console.log('指标上传成功:', resJson);
                    showToast('已保存并上传云端');
                }
            } catch (e) {
                console.warn('上传异常:', e);
                showToast('已保存本地，云端上传异常');
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
            btnText.textContent = originalText;
            saveBtn.disabled = false;
            spinner.classList.remove('show');
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
                if (data.bleedingPoint) {
                    document.getElementById('bleeding-point-select').value = data.bleedingPoint;
                    // 如果选择的是"其他"，显示其他输入框并填充内容
                    if (data.bleedingPoint === 'other') {
                        const otherInput = document.getElementById('other-bleeding-input');
                        otherInput.style.display = 'block';
                        if (data.otherDescription) {
                            document.getElementById('other-bleeding-text').value = data.otherDescription;
                        }
                    }
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

            case 'urinalysis-matrix':
                if (data.urinalysisMatrix && Array.isArray(data.urinalysisMatrix)) {
                    // 清空现有项目
                    const container = document.getElementById('urinalysis-matrix-container');
                    container.innerHTML = '';
                    
                    // 重新创建项目
                    data.urinalysisMatrix.forEach((item, index) => {
                        addUrinalysisItem(item.item, item.value, index);
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
    const bleedingSelect = document.getElementById('bleeding-point-select');
    const otherInput = document.getElementById('other-bleeding-input');
    
    if (bleedingSelect && otherInput) {
        // 选择器变化时的震动反馈
        bleedingSelect.addEventListener('change', function() {
            // 添加震动反馈
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Medium');
            } catch(_) {}
            
            if (this.value === 'other') {
                otherInput.style.display = 'block';
                // 聚焦到其他输入框
                const otherTextInput = document.getElementById('other-bleeding-text');
                if (otherTextInput) {
                    otherTextInput.focus();
                }
            } else {
                otherInput.style.display = 'none';
                // 清空其他输入框的内容
                const otherTextInput = document.getElementById('other-bleeding-text');
                if (otherTextInput) {
                    otherTextInput.value = '';
                }
            }
        });

        // 选择器聚焦时的轻微震动
        bleedingSelect.addEventListener('focus', function() {
            try {
                window.__hapticImpact__ && window.__hapticImpact__('Light');
            } catch(_) {}
        });

        // 其他输入框的震动反馈
        const otherTextInput = document.getElementById('other-bleeding-text');
        if (otherTextInput) {
            otherTextInput.addEventListener('focus', function() {
                try {
                    window.__hapticImpact__ && window.__hapticImpact__('Light');
                } catch(_) {}
            });

            otherTextInput.addEventListener('input', function() {
                // 输入时的轻微震动（防抖处理）
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
    }
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
            background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
            border-color: #374151;
            color: #f9fafb;
        }

        /* 取消深色模式出血点选择框悬停高亮效果 */

        .custom-select:focus {
            border-color: #a78bfa;
            box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.2);
            background: linear-gradient(135deg, #1f2937 0%, #1e1b4b 100%);
        }

        .select-arrow {
            color: #9ca3af;
        }

        .custom-select:focus + .select-arrow {
            color: #a78bfa;
        }

        .custom-select option {
            background: #1f2937;
            color: #f9fafb;
        }

        .custom-select option:hover {
            background: #1e1b4b;
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

    // 2) 若本地无，则尝试从本地单独缓存键读取
    try {
        const idOnly = localStorage.getItem('user_id') || '';
        if (idOnly) {
            user_id = idOnly;
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
                    if (user_id) localStorage.setItem('user_id', user_id);
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
            </select>
            <button type="button" class="remove-btn" onclick="removeUrinalysisItem(this)" onmousedown="try { window.__hapticImpact__ && window.__hapticImpact__('Light'); } catch(_) {}">×</button>
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

// 初始化尿液检测指标矩阵
function initUrinalysisMatrix() {
    const container = document.getElementById('urinalysis-matrix-container');
    if (!container) return;
    
    // 为现有的选择器添加事件监听器
    const existingSelects = container.querySelectorAll('.urinalysis-select');
    existingSelects.forEach(select => {
        select.addEventListener('change', function() {
            updateUnitReference(this);
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
                symptoms,
                timestamp: new Date().toISOString()
            };
            hasValidData = true;
        }
        
        // 体温数据
        const temp = getElementValue('temperature-input');
        if (temp && !isNaN(parseFloat(temp))) {
            const tempValue = parseFloat(temp);
            if (tempValue >= 35 && tempValue <= 45) {
                allData.temperature = {
                    temperature: tempValue,
                    timestamp: new Date().toISOString()
                };
                hasValidData = true;
            }
        }
        
        // 尿常规数据
        const protein = getElementValue('protein-input').trim();
        const glucose = getElementValue('glucose-input').trim();
        const ketones = getElementValue('ketones-input').trim();
        const blood = getElementValue('blood-input').trim();
        
        if (protein || glucose || ketones || blood) {
            allData.urinalysis = {
                protein, glucose, ketones, blood,
                timestamp: new Date().toISOString()
            };
            hasValidData = true;
        }
        
        // 24h尿蛋白数据
        const protein24h = getElementValue('proteinuria-input');
        if (protein24h && !isNaN(parseFloat(protein24h))) {
            const proteinValue = parseFloat(protein24h);
            if (proteinValue >= 0) {
                allData.proteinuria = {
                    proteinuria24h: proteinValue,
                    timestamp: new Date().toISOString()
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
            allData['blood-test'] = {
                ...bloodData,
                timestamp: new Date().toISOString()
            };
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
            allData['bleeding-point'] = {
                ...bleedingData,
                timestamp: new Date().toISOString()
            };
            hasValidData = true;
        }
        
        // 自我评分数据
        const rating = getElementValue('self-rating-slider');
        if (rating && !isNaN(parseInt(rating))) {
            const ratingValue = parseInt(rating);
            if (ratingValue >= 0 && ratingValue <= 10) {
                allData['self-rating'] = {
                    selfRating: ratingValue,
                    timestamp: new Date().toISOString()
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
                urinalysisMatrix: urinalysisData,
                timestamp: new Date().toISOString()
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
                exportTime: new Date().toISOString(),
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
