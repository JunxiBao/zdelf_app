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
        const metricTypes = ['symptoms', 'temperature', 'urinalysis', 'proteinuria', 'blood-test'];

        for (const metricType of metricTypes) {
            let data = {};

            switch(metricType) {
                case 'symptoms':
                    const symptoms = document.getElementById('symptoms-input').value.trim();
                    if (symptoms) {
                        data = { symptoms };
                        hasValidData = true;
                    }
                    break;

                case 'temperature':
                    const temp = document.getElementById('temperature-input').value;
                    if (temp && !isNaN(parseFloat(temp))) {
                        const tempValue = parseFloat(temp);
                        if (tempValue >= 35 && tempValue <= 45) {
                            data = { temperature: tempValue };
                            hasValidData = true;
                        }
                    }
                    break;

                case 'urinalysis':
                    const protein = document.getElementById('protein-input').value.trim();
                    const glucose = document.getElementById('glucose-input').value.trim();
                    const ketones = document.getElementById('ketones-input').value.trim();
                    const blood = document.getElementById('blood-input').value.trim();

                    if (protein || glucose || ketones || blood) {
                        data = { protein, glucose, ketones, blood };
                        hasValidData = true;
                    }
                    break;

                case 'proteinuria':
                    const protein24h = document.getElementById('proteinuria-input').value;
                    if (protein24h && !isNaN(parseFloat(protein24h))) {
                        const proteinValue = parseFloat(protein24h);
                        if (proteinValue >= 0) {
                            data = { proteinuria24h: proteinValue };
                            hasValidData = true;
                        }
                    }
                    break;

                case 'blood-test':
                    const wbc = document.getElementById('wbc-input').value;
                    const rbc = document.getElementById('rbc-input').value;
                    const hb = document.getElementById('hb-input').value;
                    const plt = document.getElementById('plt-input').value;

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

        // 保存所有数据
        metricsData = { ...metricsData, ...allData };

        // 保存到本地存储
        localStorage.setItem('health_metrics_data', JSON.stringify(metricsData));

        // 显示成功提示
        showToast(`成功保存 ${Object.keys(allData).length} 项指标数据！`);

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
                if (data.protein) document.getElementById('protein-input').value = data.protein;
                if (data.glucose) document.getElementById('glucose-input').value = data.glucose;
                if (data.ketones) document.getElementById('ketones-input').value = data.ketones;
                if (data.blood) document.getElementById('blood-input').value = data.blood;
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
        }
    } catch (error) {
        console.error(`填充${type}表单数据失败:`, error);
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
`;
document.head.appendChild(style);

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
